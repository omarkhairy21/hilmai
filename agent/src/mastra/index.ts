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
import { LangfuseExporter } from '@mastra/langfuse';
import { createBot } from '../bot';


const isProduction = process.env.NODE_ENV === 'production';

console.log('isProduction', isProduction);
console.log('NODE_ENV', process.env.NODE_ENV);
console.log('OTEL_SERVICE_NAME', process.env.OTEL_SERVICE_NAME);
console.log('OTEL_EXPORTER_OTLP_ENDPOINT', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
console.log('LANGFUSE_PUBLIC_KEY', process.env.LANGFUSE_PUBLIC_KEY);
console.log('LANGFUSE_SECRET_KEY', process.env.LANGFUSE_SECRET_KEY);
console.log('LANGFUSE_BASE_URL', process.env.LANGFUSE_BASE_URL);
console.log('MASTRA_DASHBOARD_TOKEN', process.env.MASTRA_DASHBOARD_TOKEN);

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
  observability: {
    // Enables DefaultExporter and optional custom exporters
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
    experimental_auth: defineAuth({
      public: [
        '/health',
        ['/telegram/webhook', ['POST']]
      ],
      authenticateToken: async (token) => {
        if (token && token === process.env.MASTRA_DASHBOARD_TOKEN) {
          return { role: 'admin' };
        }
        throw new Error('invalid token');
      },
      authorize: async () => true
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

          // Process update through bot (bot is created after mastra initialization)
          bot.processUpdate(update);
          logger?.debug('telegram:webhook:processed');
          return c.json({ ok: true });
        },
      }),
    ],
  }
});

// Create bot instance with mastra
const bot = createBot(mastra);
