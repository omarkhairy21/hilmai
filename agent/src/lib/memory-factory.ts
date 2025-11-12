/**
 * Memory Factory for HilmAI Agent V2
 *
 * Provides optimized memory instances with singleton pattern
 * and performance-focused configuration
 *
 * IMPORTANT: Multi-User Safety
 * ---------------------------
 * The singleton pattern is SAFE for multiple users because:
 *
 * 1. The Memory instance is just the INFRASTRUCTURE (database connection)
 * 2. Each user's data is ISOLATED by thread/resource ID at runtime
 * 3. When calling agent.stream(), you pass unique thread ID per user:
 *
 *    User 123: thread: "user-123" → Queries WHERE thread_id = 'user-123'
 *    User 456: thread: "user-456" → Queries WHERE thread_id = 'user-456'
 *
 * 4. Users CANNOT see each other's conversation history
 * 5. Singleton IMPROVES performance by reusing connections
 *
 * See test-multi-user-memory.md for detailed explanation and verification
 */

import type { MemoryConfig } from '@mastra/core/memory';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { getDatabaseUrl } from './config';

const OPENAI_EMBEDDER_MODEL_ID = 'openai/text-embedding-3-small';

const PG_CONNECTION_POOL = {
  max: 5,
  idleTimeoutMillis: 30_000,
} as const;

const DEFAULT_SEMANTIC_RECALL = {
  topK: 3,
  messageRange: {
    before: 2,
    after: 1,
  },
  scope: 'resource' as const,
  indexConfig: {
    type: 'hnsw' as const,
    metric: 'cosine' as const,
    hnsw: {
      m: 32,
      efConstruction: 128,
    },
  },
} as const;

function buildPostgresMemoryOptions(lastMessages: number): MemoryConfig {
  return {
    lastMessages,
    semanticRecall: {
      topK: DEFAULT_SEMANTIC_RECALL.topK,
      messageRange: {
        ...DEFAULT_SEMANTIC_RECALL.messageRange,
      },
      scope: DEFAULT_SEMANTIC_RECALL.scope,
      indexConfig: {
        ...DEFAULT_SEMANTIC_RECALL.indexConfig,
        hnsw: {
          ...DEFAULT_SEMANTIC_RECALL.indexConfig.hnsw,
        },
      },
    },
    workingMemory: {
      enabled: false,
    },
  };
}

/**
 * Shared memory instance to avoid re-initialization on every agent invocation
 *
 * WHAT'S SHARED (Singleton):
 * - Postgres database connection
 * - PgVector connection
 * - Memory class infrastructure
 *
 * WHAT'S NOT SHARED (User-specific):
 * - Conversation history (isolated by thread_id)
 * - User messages (isolated by resource_id)
 * - Each user has unique thread: "user-${userId}"
 *
 * Singleton pattern reduces Postgres connection overhead significantly
 * while maintaining complete data isolation between users.
 */
let sharedMemoryInstance: Memory | null = null;

/**
 * Get or create the shared memory instance
 *
 * Performance optimizations applied:
 * - Singleton pattern: Reuses same Memory instance
 * - Balanced lastMessages window (6) for fast lookups without losing context
 * - Resource-scoped semantic recall (topK 3) backed by pgvector
 * - Working memory disabled: Supabase user_profiles holds persistent data
 *
 * @returns Memory instance or undefined if DATABASE_URL not set
 */
export function getSharedMemory(): Memory | undefined {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return undefined;
  }

  if (!sharedMemoryInstance) {
    sharedMemoryInstance = new Memory({
      storage: new PostgresStore({
        connectionString: databaseUrl,
        ...PG_CONNECTION_POOL,
      }),
      vector: new PgVector({
        connectionString: databaseUrl,
        ...PG_CONNECTION_POOL,
      }),
      embedder: OPENAI_EMBEDDER_MODEL_ID,
      // Keep token usage low while still recalling recent context and resource-level history
      options: buildPostgresMemoryOptions(6),
    });
  }

  return sharedMemoryInstance;
}

/**
 * Get a memory instance with more conversation history
 * Use this for agents that need deeper context
 *
 * Note: This will be slower than getSharedMemory()
 * Use only when necessary (e.g., complex conversation flows)
 *
 * @param lastMessages - Number of messages to load (default: 10)
 * @returns Memory instance or undefined if DATABASE_URL not set
 */
export function getExtendedMemory(lastMessages: number = 10): Memory | undefined {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return undefined;
  }

  const effectiveLastMessages = Math.max(lastMessages, 6);

  // Create a new instance each time for extended memory
  // This is intentional - extended memory should be used sparingly
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    embedder: OPENAI_EMBEDDER_MODEL_ID,
    // Allow callers to request more context while keeping semantic recall tuned the same way
    options: buildPostgresMemoryOptions(effectiveLastMessages),
  });
}

/**
 * Reset the shared memory instance
 * Useful for testing or when configuration changes
 */
export function resetSharedMemory(): void {
  sharedMemoryInstance = null;
}

/**
 * Create a memory-less agent configuration
 * For agents that don't need conversation context
 * Fastest option - no database queries at all
 */
export function getNoMemory(): undefined {
  return undefined;
}

// ============================================================================
// MODE-SPECIFIC MEMORY CONFIGURATIONS
// ============================================================================

/**
 * Logger Mode Memory: No memory (fastest)
 * For transaction logging - no conversation context needed
 *
 * Performance: ~0ms overhead
 * Use case: "I spent 50 AED at Carrefour"
 */
export function getLoggerMemory(): undefined {
  return undefined;
}

/**
 * Query Mode Memory: Minimal context (3 messages, no semantic recall)
 * Just enough for follow-up questions
 *
 * Performance: ~100-200ms overhead
 * Use case: "How much on groceries?" → "What about last week?"
 */
export function getQueryMemory(): Memory | undefined {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return undefined;
  }

  // Create lightweight memory for queries
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    embedder: OPENAI_EMBEDDER_MODEL_ID,
    options: {
      lastMessages: 3, // Minimal context
      semanticRecall: false, // No embedding-based recall
      workingMemory: {
        enabled: false,
      },
    },
  });
}

/**
 * Chat Mode Memory: Minimal context (3 messages, no semantic recall)
 * For general conversation and help
 *
 * Performance: ~100-200ms overhead
 * Use case: "How do I use this?" → "What about queries?"
 */
export function getChatMemory(): Memory | undefined {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return undefined;
  }

  // Create lightweight memory for chat
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...PG_CONNECTION_POOL,
    }),
    embedder: OPENAI_EMBEDDER_MODEL_ID,
    options: {
      lastMessages: 3, // Minimal context
      semanticRecall: false, // No embedding-based recall
      workingMemory: {
        enabled: false,
      },
    },
  });
}