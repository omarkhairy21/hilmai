import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { defineAuth, registerApiRoute } from '@mastra/core/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transactionExtractorAgent } from './agents/transaction-extractor-agent';
import { financeInsightsAgent } from './agents/finance-insights-agent';
import { messageClassifierAgent } from './agents/message-classifier-agent';
import { telegramRoutingWorkflow } from './workflows/telegram-routing-workflow';
import { telegramVoiceWorkflow } from './workflows/telegram-voice-workflow';
import type { Bot } from 'grammy';
import { LangfuseExporter } from '@mastra/langfuse'; // BROKEN: Missing .js files in @mastra/core

// Bot instance (will be initialized lazily in webhook handler)
let bot: Bot | null = null;

export const mastra = new Mastra({
  agents: {
    transactionExtractor: transactionExtractorAgent,
    financeInsights: financeInsightsAgent,
    messageClassifier: messageClassifierAgent,
  },
  workflows: {
    telegramRouting: telegramRoutingWorkflow,
    telegramVoice: telegramVoiceWorkflow,
  },

  storage: new LibSQLStore({
    // Persist observability and logs so multiple processes (dev server + bot) share traces
    url: `file:${path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mastra.db')}`,
  }),

  logger: new PinoLogger({
    name: 'Hilm.ai',
    level: 'debug',
  }),

  telemetry: {
    serviceName: process.env.OTEL_SERVICE_NAME || 'hilm-agent',
    enabled: process.env.NODE_ENV !== 'development',
    export: {
      type: 'otlp',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    },
  },
  // BROKEN: Langfuse integration disabled due to missing .js files in @mastra/core
  // See: https://github.com/mastra-ai/mastra/issues/YOUR_ISSUE_NUMBER
  observability: {
    default: { enabled: true },
    configs: {
      hilmAgent: {
        serviceName: process.env.OTEL_SERVICE_NAME || 'hilm-agent',
        exporters: [
          process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
            ? new LangfuseExporter({
                publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
                secretKey: process.env.LANGFUSE_SECRET_KEY!,
                baseUrl: process.env.LANGFUSE_BASE_URL,
                options: { environment: process.env.NODE_ENV },
              })
            : undefined,
        ].filter(Boolean) as any,
      },
    },
  },
  server: {
    port: 4111,
    experimental_auth:
      process.env.NODE_ENV === 'development'
        ? undefined // Disable auth in development
        : defineAuth({
            public: ['/health', ['/telegram/webhook', ['POST']]],
            authenticateToken: async (token) => {
              if (token && token === process.env.MASTRA_DASHBOARD_TOKEN) {
                return { role: 'admin' };
              }
              throw new Error('invalid token');
            },
            authorize: async () => true,
          }),
    apiRoutes: [
      registerApiRoute('/health', {
        method: 'GET',
        handler: async (c: any) => {
          return c.json({
            status: 'ok',
            service: 'hilm-ai-agent',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          });
        },
      }),
      registerApiRoute('/telegram/webhook', {
        method: 'POST',
        handler: async (c) => {
          const logger = c.get('mastra').getLogger();
          const secret = c.req.header('x-telegram-bot-api-secret-token');
          const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

          // Log receipt (without sensitive data)
          logger.debug('telegram:webhook:received', {
            hasHeader: Boolean(secret),
            expectedConfigured: Boolean(expected),
          });

          if (!expected) {
            logger?.warn('telegram:webhook:reject:no_expected_secret_configured');
            return new Response('unauthorized', { status: 401 });
          }
          if (secret !== expected) {
            logger?.warn('telegram:webhook:reject:secret_mismatch', {
              providedLen: secret?.length ?? 0,
            });
            return new Response('unauthorized', { status: 401 });
          }

          // If running in polling mode locally, ignore webhook to avoid double-processing
          if (process.env.TELEGRAM_POLLING === 'true') {
            logger?.debug('telegram:webhook:ignored_due_to_polling');
            return c.json({ ok: true });
          }

          const update = await c.req.json();
          logger?.debug('telegram:webhook:update_received', {
            hasMessage: Boolean(update?.message),
            hasCallbackQuery: Boolean(update?.callback_query),
            updateId: update?.update_id,
          });

          // Initialize bot lazily to prevent circular dependency
          if (!bot) {
            const { createBot } = await import('../bot.js');
            bot = createBot(mastra);
            // Initialize bot for webhook mode - required by Grammy before handleUpdate
            await bot.init();
            logger?.debug('telegram:webhook:bot_initialized');
          }

          // Process update through Grammy bot
          try {
            await bot.handleUpdate(update);
            logger?.debug('telegram:webhook:processed');
          } catch (error) {
            logger?.error('telegram:webhook:error', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              errorObject: error,
            });
            return new Response('error processing update', { status: 500 });
          }

          return c.json({ ok: true });
        },
      }),
    ],
  },
});

// Function to start bot in polling mode (for local development)
export async function startPollingBot() {
  const usePolling = process.env.TELEGRAM_POLLING === 'true';
  const logger = mastra.getLogger();

  logger.debug('startPollingBot:check', {
    usePolling,
    TELEGRAM_POLLING: process.env.TELEGRAM_POLLING,
    NODE_ENV: process.env.NODE_ENV,
    botExists: !!bot,
  });

  if (usePolling && !bot) {
    const { createBot } = await import('../bot.js');
    bot = createBot(mastra);
    await bot.start();
    logger.info('🤖 Bot started in polling mode');
  } else if (!usePolling) {
    logger.debug('startPollingBot:skipped', {
      reason: 'TELEGRAM_POLLING not set to true, using webhook mode',
    });
  }
}

// Export function to get bot instance (for testing/debugging)
export function getBotInstance() {
  return bot;
}

// Auto-start polling bot in development mode
// This runs when the module is loaded by Mastra server
// Note: The condition is checked inside startPollingBot to prevent tree-shaking
startPollingBot().catch((error) => {
  console.error('Failed to start polling bot:', error);
});
