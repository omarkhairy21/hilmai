import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { getLibsqlClient } from './libsql-client';
import type { QueryIntent } from './intent-types';

const CACHE_VERSION = 1;
let tableReady: Promise<void> | null = null;

const ensureTable = async (client: Client) => {
  if (!tableReady) {
    tableReady = client
      .execute(
        `
        CREATE TABLE IF NOT EXISTS intent_cache (
          message_hash TEXT PRIMARY KEY,
          intent_json TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

const hashMessage = (message: string) =>
  crypto.createHash('sha256').update(message.trim().toLowerCase()).digest('hex');

export const getCachedIntent = async (message: string): Promise<QueryIntent | null> => {
  const client = getLibsqlClient();
  if (!client) return null;

  try {
    await ensureTable(client);
    const hash = hashMessage(message);
    const result = await client.execute({
      sql: 'SELECT intent_json, version FROM intent_cache WHERE message_hash = ?',
      args: [hash],
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, any>;
    if (!row.intent_json || row.version !== CACHE_VERSION) {
      return null;
    }

    return JSON.parse(row.intent_json) as QueryIntent;
  } catch (error) {
    console.warn('[intent-cache] read failed', error);
    return null;
  }
};

export const cacheIntent = async (message: string, intent: QueryIntent) => {
  const client = getLibsqlClient();
  if (!client) return;

  try {
    await ensureTable(client);
    const hash = hashMessage(message);
    await client.execute({
      sql: `
        INSERT INTO intent_cache (message_hash, intent_json, version, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(message_hash) DO UPDATE SET
          intent_json = excluded.intent_json,
          version = excluded.version,
          updated_at = excluded.updated_at;
      `,
      args: [hash, JSON.stringify(intent), CACHE_VERSION],
    });
  } catch (error) {
    console.warn('[intent-cache] write failed', error);
  }
};
