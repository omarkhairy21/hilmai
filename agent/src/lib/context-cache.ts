import type { Client } from '@libsql/client';
import { getLibsqlClient } from './libsql-client';

let tableReady: Promise<void> | null = null;
const DEFAULT_TTL_SECONDS = 300;

const ensureTable = async (client: Client) => {
  if (!tableReady) {
    tableReady = client
      .execute(
        `
        CREATE TABLE IF NOT EXISTS context_cache (
          cache_key TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `
      )
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
};

export const getCachedContext = async <T = unknown>(key: string): Promise<T | null> => {
  const client = getLibsqlClient();
  if (!client) return null;

  try {
    await ensureTable(client);
    const now = Math.floor(Date.now() / 1000);
    const result = await client.execute({
      sql: 'SELECT payload, expires_at FROM context_cache WHERE cache_key = ?',
      args: [key],
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, any>;
    if (row.expires_at < now) {
      await client.execute({
        sql: 'DELETE FROM context_cache WHERE cache_key = ?',
        args: [key],
      });
      return null;
    }

    return JSON.parse(row.payload) as T;
  } catch (error) {
    console.warn('[context-cache] read failed', error);
    return null;
  }
};

export const setCachedContext = async <T = unknown>(
  key: string,
  payload: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
) => {
  const client = getLibsqlClient();
  if (!client) return;

  try {
    await ensureTable(client);
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(ttlSeconds, 60);
    await client.execute({
      sql: `
        INSERT INTO context_cache (cache_key, payload, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE
          SET payload = excluded.payload,
              expires_at = excluded.expires_at;
      `,
      args: [key, JSON.stringify(payload), expiresAt],
    });
  } catch (error) {
    console.warn('[context-cache] write failed', error);
  }
};
