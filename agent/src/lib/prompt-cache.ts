/**
 * Agent Response Cache for HilmAI Agent V2
 *
 * Caches complete agent responses to reduce latency and cost
 * Uses LibSQL (Turso) for fast, distributed caching
 *
 * Cache Strategy:
 * - Cache queries and help requests (reusable)
 * - Don't cache transactions (dynamic, time-sensitive)
 * - TTL: 1 hour (3600 seconds)
 * - Version-based invalidation
 */

import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { getLibsqlClient } from './database';

/**
 * Cached response structure
 */
export interface CachedAgentResponse {
  response: string;
  metadata: Record<string, any>;
}

/**
 * Agent Response Cache manager
 */
export class AgentResponseCache {
  private static TABLE_NAME = 'agent_response_cache';
  private static CACHE_VERSION = 1; // Increment to invalidate all cache
  private static DEFAULT_TTL = 3600; // 1 hour in seconds

  /**
   * Ensure cache table exists
   * Creates table and indexes if not present
   */
  static async ensureTable(client: Client): Promise<void> {
    try {
      // Create table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
          cache_key TEXT PRIMARY KEY,
          response_json TEXT NOT NULL,
          version INTEGER NOT NULL,
          user_id BIGINT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Create index on expires_at for cleanup
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${this.TABLE_NAME}_expires_at
        ON ${this.TABLE_NAME}(expires_at)
      `);

      // Create index on user_id for user-specific lookups
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_${this.TABLE_NAME}_user_id
        ON ${this.TABLE_NAME}(user_id)
      `);

      console.log(`[cache] Table ${this.TABLE_NAME} ready`);
    } catch (error) {
      console.error('[cache] Error ensuring table:', error);
      throw error;
    }
  }

  /**
   * Generate cache key from user ID and message
   * Uses SHA256 hash of normalized input
   *
   * @param userId - Telegram user ID
   * @param message - User message (normalized)
   * @param context - Optional context object
   * @returns Cache key (hex string)
   */
  static generateKey(userId: number, message: string, context?: Record<string, any>): string {
    // Normalize message: lowercase, trim whitespace
    const normalized = message.trim().toLowerCase();

    // Include context if provided
    const contextStr = context ? JSON.stringify(context) : '';

    // Combine for hashing
    const input = `${userId}:${normalized}:${contextStr}`;

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get cached response
   *
   * @param userId - Telegram user ID
   * @param message - User message
   * @param context - Optional context
   * @returns Cached response or null if not found/expired
   */
  static async get(
    userId: number,
    message: string,
    context?: Record<string, any>
  ): Promise<CachedAgentResponse | null> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return null;
    }

    try {
      await this.ensureTable(client);

      const key = this.generateKey(userId, message, context);
      const now = Math.floor(Date.now() / 1000); // Unix timestamp

      const result = await client.execute({
        sql: `
          SELECT response_json, version
          FROM ${this.TABLE_NAME}
          WHERE cache_key = ?
            AND user_id = ?
            AND expires_at > ?
            AND version = ?
          LIMIT 1
        `,
        args: [key, userId, now, this.CACHE_VERSION],
      });

      if (!result.rows || result.rows.length === 0) {
        console.log(`[cache] Miss for user ${userId}`);
        return null;
      }

      const row = result.rows[0] as Record<string, any>;
      console.log(`[cache] Hit! ⚡ (user ${userId}, key: ${key.substring(0, 8)}...)`);

      return JSON.parse(row.response_json as string) as CachedAgentResponse;
    } catch (error) {
      console.warn('[cache] Get failed:', error);
      return null; // Fail gracefully
    }
  }

  /**
   * Set cached response
   *
   * @param userId - Telegram user ID
   * @param message - User message
   * @param response - Response to cache
   * @param context - Optional context
   * @param ttlSeconds - Time to live (default: 1 hour)
   */
  static async set(
    userId: number,
    message: string,
    response: CachedAgentResponse,
    context?: Record<string, any>,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<void> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return;
    }

    try {
      await this.ensureTable(client);

      const key = this.generateKey(userId, message, context);
      const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

      await client.execute({
        sql: `
          INSERT INTO ${this.TABLE_NAME}
            (cache_key, response_json, version, user_id, expires_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at,
            version = excluded.version
        `,
        args: [key, JSON.stringify(response), this.CACHE_VERSION, userId, expiresAt],
      });

      console.log('[cache] Stored');
    } catch (error) {
      console.warn('[cache] Set failed:', error);
      // Fail gracefully - cache errors shouldn't break the app
    }
  }

  /**
   * Delete expired cache entries
   * Should be called periodically (e.g., daily cron job)
   *
   * @returns Number of deleted entries
   */
  static async cleanup(): Promise<number> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return 0;
    }

    try {
      await this.ensureTable(client);

      const now = Math.floor(Date.now() / 1000);

      const result = await client.execute({
        sql: `DELETE FROM ${this.TABLE_NAME} WHERE expires_at <= ?`,
        args: [now],
      });

      const deleted = result.rowsAffected;
      console.log(`[cache] Cleaned up ${deleted} expired entries`);

      return deleted;
    } catch (error) {
      console.warn('[cache] Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clear all cache for a specific user
   * Useful for testing or user requests
   *
   * @param userId - Telegram user ID
   * @returns Number of deleted entries
   */
  static async clearUser(userId: number): Promise<number> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return 0;
    }

    try {
      await this.ensureTable(client);

      const result = await client.execute({
        sql: `DELETE FROM ${this.TABLE_NAME} WHERE user_id = ?`,
        args: [userId],
      });

      const deleted = result.rowsAffected;
      console.log(`[cache] Cleared ${deleted} entries for user ${userId}`);

      return deleted;
    } catch (error) {
      console.warn('[cache] Clear user failed:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   * Useful for cache invalidation after updates
   *
   * @returns Number of deleted entries
   */
  static async clearAll(): Promise<number> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return 0;
    }

    try {
      await this.ensureTable(client);

      const result = await client.execute({
        sql: `DELETE FROM ${this.TABLE_NAME}`,
        args: [],
      });

      const deleted = result.rowsAffected;
      console.log(`[cache] Cleared all ${deleted} entries`);

      return deleted;
    } catch (error) {
      console.warn('[cache] Clear all failed:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * Useful for monitoring and debugging
   *
   * @returns Cache stats
   */
  static async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  }> {
    const client = getLibsqlClient();
    if (!client) {
      console.warn('[cache] No LibSQL client available');
      return { totalEntries: 0, expiredEntries: 0, activeEntries: 0 };
    }

    try {
      await this.ensureTable(client);

      const now = Math.floor(Date.now() / 1000);

      // Total entries
      const totalResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM ${this.TABLE_NAME}`,
        args: [],
      });
      const totalEntries = (totalResult.rows[0] as Record<string, any>).count as number;

      // Expired entries
      const expiredResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM ${this.TABLE_NAME} WHERE expires_at <= ?`,
        args: [now],
      });
      const expiredEntries = (expiredResult.rows[0] as Record<string, any>).count as number;

      // Active entries
      const activeEntries = totalEntries - expiredEntries;

      return { totalEntries, expiredEntries, activeEntries };
    } catch (error) {
      console.warn('[cache] Get stats failed:', error);
      return { totalEntries: 0, expiredEntries: 0, activeEntries: 0 };
    }
  }
}
