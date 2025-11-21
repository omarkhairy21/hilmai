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
import { LangfuseExporter } from '@mastra/langfuse';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
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

// Import API route handlers
import {
  handleHealthCheck,
  handleCheckout,
  handleBillingPortal,
  handleActivationCode,
  handleStripeWebhook,
  handleTelegramWebhook,
} from '../api';

// Import bot server utilities
import { getBotMode, validateWebhookConfig } from '../services/bot-server';

// Import usage tracker
import { UsageTrackingProcessor } from '../lib/usage-tracker';

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
    default: {
      enabled: !isDevelopment,
    },
    configs: {
      hilmAgentV2: {
        serviceName: config.telemetry.serviceName,
        exporters: [
          // Langfuse exporter for LLM observability
          ...(config.langfuse.publicKey && config.langfuse.secretKey
            ? [
                new LangfuseExporter({
                  publicKey: config.langfuse.publicKey,
                  secretKey: config.langfuse.secretKey,
                  baseUrl: config.langfuse.baseUrl,
                  realtime: isDevelopment, // Realtime in dev, batch in prod
                  logLevel: isDevelopment ? 'debug' : 'warn',
                  options: {
                    environment: config.app.nodeEnv,
                  },
                }),
              ]
            : []),
        ],
        processors: [new UsageTrackingProcessor()],
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
        handler: async (c: Context) => handleHealthCheck(c, mastra),
      }),

      // Stripe checkout session endpoint
      registerApiRoute('/billing/checkout', {
        method: 'POST',
        handler: async (c: Context) => handleCheckout(c, mastra),
      }),

      // Stripe billing portal endpoint
      registerApiRoute('/billing/portal', {
        method: 'POST',
        handler: async (c: Context) => handleBillingPortal(c, mastra),
      }),

      // Activation code generation endpoint (called after Stripe checkout)
      registerApiRoute('/billing/activation-code', {
        method: 'POST',
        handler: async (c: Context) => handleActivationCode(c, mastra),
      }),

      // Stripe webhook endpoint
      registerApiRoute('/stripe/webhook', {
        method: 'POST',
        handler: async (c: Context) => handleStripeWebhook(c, mastra),
      }),

      // Telegram bot webhook endpoint
      registerApiRoute('/telegram/webhook', {
        method: 'POST',
        handler: async (c: Context) => handleTelegramWebhook(c, mastra),
      }),
    ],
  },
});

// Validate webhook configuration after mastra instance creation
try {
  validateWebhookConfig(mastra);
  const botMode = getBotMode(mastra);
  mastra.getLogger().info('mastra:bot_mode', { mode: botMode });
} catch (error) {
  mastra.getLogger().warn('mastra:webhook_validation_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
}

// Bot instance (will be initialized lazily)
let bot: any | null = null;
let isShuttingDown = false;

// Health check logging
const logger = mastra.getLogger();

// Function to start bot in polling mode (for development)
export async function startPollingBot() {
  // Don't restart if already shutting down
  if (isShuttingDown || bot) {
    return;
  }

  const usePolling = config.telegram.polling;

  logger.debug('startPollingBot:check', {
    usePolling,
    TELEGRAM_POLLING: config.telegram.polling,
    NODE_ENV: config.app.nodeEnv,
    botExists: !!bot,
  });

  if (usePolling && !bot) {
    try {
      const { createBot } = await import('../bot.js');
      bot = createBot(mastra);
      await bot.start();
      logger.info('🤖 Bot started in polling mode');

      // Handle graceful shutdown
      const shutdownHandler = async () => {
        if (!isShuttingDown && bot) {
          isShuttingDown = true;
          logger.info('🛑 Stopping polling bot gracefully...');
          try {
            await bot.stop();
            bot = null;
            logger.info('✅ Bot stopped');
          } catch (error) {
            logger.error('Error stopping bot', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      };

      process.on('SIGINT', shutdownHandler);
      process.on('SIGTERM', shutdownHandler);
    } catch (error) {
      logger.error('Failed to start polling bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      bot = null;
    }
  } else if (!usePolling) {
    logger.debug('startPollingBot:skipped', {
      reason: 'TELEGRAM_POLLING not set to true',
    });
  }
}

// Start polling bot asynchronously but don't block Mastra initialization
if (config.telegram.polling) {
  // Defer bot startup to avoid blocking server initialization
  setImmediate(() => {
    startPollingBot().catch((error) => {
      logger.error('Deferred polling bot startup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}
