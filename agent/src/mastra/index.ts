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

// Import subscription service
import {
  createCheckoutSession,
  createBillingPortalSession,
  handleStripeWebhook,
} from '../services/subscription.service';

// Import bot server utilities
import { getWebhookHandler, getBotMode, validateWebhookConfig } from '../services/bot-server';

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
        exporters: [],
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

      // Stripe checkout session endpoint
      registerApiRoute('/billing/checkout', {
        method: 'POST',
        handler: async (c: any) => {
          try {
            const body = await c.req.json();
            const { userId, planTier, successUrl, cancelUrl, includeTrial } = body;

            if (!userId || !planTier || !successUrl || !cancelUrl) {
              return c.json({ error: 'Missing required fields' }, 400);
            }

            const result = await createCheckoutSession(
              userId,
              planTier,
              successUrl,
              cancelUrl,
              includeTrial ?? false // Default to false (no trial) if not specified
            );

            if (result.error) {
              return c.json({ error: result.error }, 400);
            }

            return c.json({ url: result.url });
          } catch (error) {
            console.error('[api] Checkout error:', error);
            return c.json({ error: 'Internal server error' }, 500);
          }
        },
      }),

      // Stripe billing portal endpoint
      registerApiRoute('/billing/portal', {
        method: 'POST',
        handler: async (c: any) => {
          try {
            const body = await c.req.json();
            const { userId, returnUrl } = body;

            if (!userId || !returnUrl) {
              return c.json({ error: 'Missing required fields' }, 400);
            }

            const result = await createBillingPortalSession(userId, returnUrl);

            if (result.error) {
              return c.json({ error: result.error }, 400);
            }

            return c.json({ url: result.url });
          } catch (error) {
            console.error('[api] Billing portal error:', error);
            return c.json({ error: 'Internal server error' }, 500);
          }
        },
      }),

      // Stripe webhook endpoint
      registerApiRoute('/stripe/webhook', {
        method: 'POST',
        handler: async (c: any) => {
          try {
            const body = await c.req.text();
            const signature = c.req.header('stripe-signature');

            if (!signature) {
              return c.json({ error: 'Missing stripe-signature header' }, 400);
            }

            const result = await handleStripeWebhook(body, signature);

            if (!result.success) {
              return c.json({ error: result.error }, 400);
            }

            return c.json({ received: true });
          } catch (error) {
            console.error('[api] Webhook error:', error);
            return c.json({ error: 'Internal server error' }, 500);
          }
        },
      }),

      // Telegram bot webhook endpoint
      registerApiRoute('/telegram/webhook', {
        method: 'POST',
        handler: async (c: any) => {
          // Handler will be bound to mastra instance after initialization
          return getWebhookHandler(mastra)(c);
        },
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

// Health check logging
const logger = mastra.getLogger();
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


// Auto-start polling bot in development mode
startPollingBot().catch((error) => {
  logger.error('Failed to start polling bot', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});
