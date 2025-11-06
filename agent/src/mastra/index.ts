/**
 * Mastra Instance for HilmAI Agent V2
 *
 * Central configuration for all agents, tools, logger, storage, and server
 * Includes Mastra playground support for debugging
 *
 * SECURITY NOTES:
 * - Uses Supabase service role key for backend operations
 * - Service role bypasses RLS policies (necessary for system operations)
 * - All user data access is validated server-side with user_id checks
 * - Mastra system tables (mastra_*) have no RLS (framework tables, not user data)
 */

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { registerApiRoute } from '@mastra/core/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../lib/config';

// Import agents
import { supervisorAgent } from './agents/supervisor-agent';
import { transactionLoggerAgent } from './agents/transaction-logger-agent';
import { queryExecutorAgent } from './agents/query-executor-agent';
import { conversationAgent } from './agents/conversation-agent';
import { transactionManagerAgent } from './agents/transaction-manager-agent';

// Import workflows
import { messageProcessingWorkflow } from './workflows/message-processing-workflow';

// Import tools (for export - only tools used by agents)
import { saveTransactionTool } from './tools/save-transaction-tool';
import { hybridQueryTool } from './tools/hybrid-query-tool';

const isDevelopment = config.app.nodeEnv === 'development';

/**
 * Main Mastra instance with full configuration
 */
export const mastra = new Mastra({
  // Register agents
  agents: {
    supervisor: supervisorAgent,
    transactionLogger: transactionLoggerAgent,
    queryExecutor: queryExecutorAgent,
    conversation: conversationAgent,
    transactionManager: transactionManagerAgent,
  },

  // Register workflows
  workflows: {
    'message-processing': messageProcessingWorkflow,
  },

  // Storage for observability and logs (shared across processes)
  storage: new LibSQLStore({
    url:
      config.libsql.url ||
      `file:${path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mastra.db')}`,
    authToken: config.libsql.authToken,
  }),

  // Logger configuration
  logger: new PinoLogger({
    name: 'HilmAI-V2',
    level: isDevelopment ? 'debug' : (config.app.logLevel as 'info' | 'debug' | 'warn' | 'error'),
  }),

  // Telemetry (OpenTelemetry)
  telemetry: {
    serviceName: config.telemetry.serviceName,
    enabled: !isDevelopment,
    export: {
      type: 'otlp',
      endpoint: config.telemetry.endpoint,
    },
  },

  // Observability
  observability: {
    default: { enabled: !isDevelopment },
    configs: {
      hilmAgentV2: {
        serviceName: config.telemetry.serviceName,
        exporters: [],
      },
    },
  },

  // Server configuration for Mastra playground and API
  server: {
    port: config.app.mastraPort,
    // experimental_auth: isDevelopment
    //   ? undefined // Disable auth in development for easy playground access
    //   : defineAuth({
    //       public: ["/health"],
    //       authenticateToken: async (token) => {
    //         if (token && token === process.env.MASTRA_DASHBOARD_TOKEN) {
    //           return { role: "admin" };
    //         }
    //         throw new Error("Invalid token");
    //       },
    //       authorize: async () => true,
    //     }),
    apiRoutes: [
      // Health check endpoint
      registerApiRoute('/health', {
        method: 'GET',
        handler: async (c: any) => {
          return c.json({
            status: 'ok',
            service: 'hilm-ai-agent-v2',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          });
        },
      }),
    ],
  },
});

// Export individual agents for easy access
export const supervisor = mastra.getAgent('supervisor');
export const transactionLogger = mastra.getAgent('transactionLogger');
export const queryExecutor = mastra.getAgent('queryExecutor');
export const conversation = mastra.getAgent('conversation');

// Export tools for standalone use (only agent tools)
export const tools = {
  saveTransaction: saveTransactionTool,
  hybridQuery: hybridQueryTool,
};

// Bot instance (will be initialized lazily)
let bot: any | null = null;

// Health check logging
const logger = mastra.getLogger();
logger.info('HilmAI V2 initialized', {
  agents: ['supervisor', 'transactionLogger', 'queryExecutor', 'conversation'],
  tools: Object.keys(tools),
  environment: config.app.nodeEnv,
  port: config.app.mastraPort,
});

// Function to start bot in polling mode (for development)
export async function startPollingBot() {
  const usePolling = config.telegram.polling;

  logger.debug('startPollingBot:check', {
    usePolling,
    TELEGRAM_POLLING: config.telegram.polling,
    NODE_ENV: config.app.nodeEnv,
    botExists: !!bot,
  });

  if (usePolling && !bot) {
    const { createBot } = await import('../bot.js');
    bot = createBot(mastra);
    await bot.start();
    logger.info('🤖 Bot started in polling mode');
  } else if (!usePolling) {
    logger.debug('startPollingBot:skipped', {
      reason: 'TELEGRAM_POLLING not set to true',
    });
  }
}

// Export function to get bot instance (for testing/debugging)
export function getBotInstance() {
  return bot;
}

// Auto-start polling bot in development mode
startPollingBot().catch((error) => {
  logger.error('Failed to start polling bot', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});
