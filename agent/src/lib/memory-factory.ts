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

/**
 * Check if database URL is for Supabase (requires SSL)
 */
function isSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('supabase') || url.includes('pooler.supabase.com');
}

/**
 * Get PostgreSQL connection pool configuration
 * Automatically enables SSL for Supabase connections
 */
function getPgConnectionConfig(databaseUrl: string | undefined) {
  const baseConfig = {
    max: 5,
    idleTimeoutMillis: 30_000,
  };

  // Enable SSL for Supabase connections
  if (isSupabaseUrl(databaseUrl)) {
    return {
      ...baseConfig,
      ssl: { rejectUnauthorized: false },
    };
  }

  return baseConfig;
}

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
    const pgConfig = getPgConnectionConfig(databaseUrl);
    sharedMemoryInstance = new Memory({
      storage: new PostgresStore({
        connectionString: databaseUrl,
        ...pgConfig,
      }),
      vector: new PgVector({
        connectionString: databaseUrl,
        ...pgConfig,
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
  const pgConfig = getPgConnectionConfig(databaseUrl);
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...pgConfig,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...pgConfig,
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
  const pgConfig = getPgConnectionConfig(databaseUrl);
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...pgConfig,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...pgConfig,
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
  const pgConfig = getPgConnectionConfig(databaseUrl);
  return new Memory({
    storage: new PostgresStore({
      connectionString: databaseUrl,
      ...pgConfig,
    }),
    vector: new PgVector({
      connectionString: databaseUrl,
      ...pgConfig,
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

// ============================================================================
// ROLE-BASED MEMORY CONFIGURATIONS (Per-Agent Strategy)
// ============================================================================

/**
 * Agent role types for memory configuration
 */
export type AgentRole = 'conversation' | 'query' | 'logger' | 'transactionManager';

/**
 * Cached memory instances per role (singleton pattern for performance)
 * These are shared across all users but isolated by thread/resource IDs at runtime
 */
const roleMemoryCache: Partial<Record<AgentRole, Memory | undefined>> = {};

/**
 * Maximum acceptable memory initialization time (ms)
 * If memory initialization exceeds this, we log a warning
 */
const MEMORY_INIT_TIMEOUT_MS = 2000;

/**
 * Maximum acceptable memory lookup time (ms) per operation
 * Used for latency monitoring in workflow steps
 */
export const MEMORY_LOOKUP_TIMEOUT_MS = 500;

/**
 * Get memory instance for a specific agent role
 *
 * This implements the per-agent memory strategy:
 * - Conversation agent: Extended context (12 messages) + semantic recall for better context
 * - Query agent: Lightweight (4 messages) + optional semantic recall for follow-ups
 * - Logger agent: No memory (fastest, no context needed)
 * - Transaction Manager: Minimal memory (3 messages) for edit context
 *
 * Memory instances are cached (singleton per role) to avoid connection overhead.
 * User isolation is achieved via thread/resource IDs passed at runtime.
 *
 * Latency considerations:
 * - Memory initialization is cached (one-time cost per role)
 * - Memory lookups are logged in workflow steps for monitoring
 * - If memory operations exceed thresholds, consider reducing lastMessages or disabling semantic recall
 *
 * @param role - Agent role identifier
 * @returns Memory instance or undefined (for logger role)
 */
export function getAgentMemory(role: AgentRole): Memory | undefined {
  const initStartTime = Date.now();

  // Check cache first
  if (roleMemoryCache[role] !== undefined) {
    return roleMemoryCache[role];
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    roleMemoryCache[role] = undefined;
    return undefined;
  }

  let memoryInstance: Memory | undefined;

  switch (role) {
    case 'conversation':
      // Extended context for conversation agent - needs more history for context-aware responses
      const conversationPgConfig = getPgConnectionConfig(databaseUrl);
      memoryInstance = new Memory({
        storage: new PostgresStore({
          connectionString: databaseUrl,
          ...conversationPgConfig,
        }),
        vector: new PgVector({
          connectionString: databaseUrl,
          ...conversationPgConfig,
        }),
        embedder: OPENAI_EMBEDDER_MODEL_ID,
        options: {
          lastMessages: 12, // Extended window for conversation context
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
        },
      });
      break;

    case 'query':
      // Lightweight memory for query agent - minimal context for follow-up questions
      const queryPgConfig = getPgConnectionConfig(databaseUrl);
      memoryInstance = new Memory({
        storage: new PostgresStore({
          connectionString: databaseUrl,
          ...queryPgConfig,
        }),
        vector: new PgVector({
          connectionString: databaseUrl,
          ...queryPgConfig,
        }),
        embedder: OPENAI_EMBEDDER_MODEL_ID,
        options: {
          lastMessages: 4, // Lightweight window for follow-ups
          semanticRecall: {
            topK: 2, // Reduced semantic recall for queries (less overhead)
            messageRange: {
              before: 1,
              after: 1,
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
        },
      });
      break;

    case 'logger':
      // No memory for logger agent - fastest performance, no context needed
      memoryInstance = undefined;
      break;

    case 'transactionManager':
      // Minimal memory for transaction manager - just enough for edit context
      const transactionManagerPgConfig = getPgConnectionConfig(databaseUrl);
      memoryInstance = new Memory({
        storage: new PostgresStore({
          connectionString: databaseUrl,
          ...transactionManagerPgConfig,
        }),
        vector: new PgVector({
          connectionString: databaseUrl,
          ...transactionManagerPgConfig,
        }),
        embedder: OPENAI_EMBEDDER_MODEL_ID,
        options: {
          lastMessages: 3, // Minimal context for edit operations
          semanticRecall: false, // No semantic recall needed for edits
          workingMemory: {
            enabled: false,
          },
        },
      });
      break;

    default:
      // Fallback: no memory
      memoryInstance = undefined;
  }

  // Cache the instance
  roleMemoryCache[role] = memoryInstance;

  // Log initialization time for monitoring
  const initDuration = Date.now() - initStartTime;
  if (initDuration > MEMORY_INIT_TIMEOUT_MS) {
    // Log warning if initialization is slow (should only happen once per role)
    console.warn(
      `[memory-factory] Slow memory initialization for role "${role}": ${initDuration}ms`
    );
  }

  return memoryInstance;
}

/**
 * Build standardized thread and resource IDs for user-scoped memory
 *
 * This ensures consistent memory isolation across webhook instances behind Traefik.
 * Both instances will use the same thread/resource IDs, so they share the same
 * Postgres-backed memory rows per user.
 *
 * IMPORTANT: We use `user-${userId}` (not role-specific) to allow conversation history
 * to be shared across all agents for the same user. This provides better context
 * when users switch between modes (logger → query → chat).
 *
 * @param userId - Telegram user ID
 * @param agentRole - Optional agent role (for logging/debugging, doesn't affect thread ID)
 * @returns Object with thread and resource IDs
 */
export function buildMemoryThreadIds(
  userId: number,
  agentRole?: AgentRole
): { thread: string; resource: string } {
  // Standard format: user-{userId} for thread, userId as string for resource
  // Shared thread ID across all agents for the same user enables cross-agent context
  const thread = `user-${userId}`;
  const resource = userId.toString();

  return { thread, resource };
}
