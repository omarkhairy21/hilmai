import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { defineAuth, registerApiRoute } from '@mastra/core/server';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transactionExtractorAgent } from './agents/transaction-extractor-agent.js';
import { financeInsightsAgent } from './agents/finance-insights-agent.js';
import { messageClassifierAgent } from './agents/message-classifier-agent.js';
import { telegramRoutingWorkflow } from './workflows/telegram-routing-workflow.js';
import { telegramVoiceWorkflow } from './workflows/telegram-voice-workflow.js';
import { LangfuseExporter } from '@mastra/langfuse';

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
    enabled: true,
    export: {
      type: 'otlp',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    },
  },
  observability: {
    // Enables DefaultExporter and optional custom exporters
    default: { enabled: true },
    configs: {
      default: {
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
        handler: async (c: any) => {
          const secret = c.req.header('x-telegram-bot-api-secret-token');
          const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

          if (!expected || secret !== expected) {
            return new Response('unauthorized', { status: 401 });
          }

          // If running in polling mode locally, ignore webhook to avoid double-processing
          if (process.env.TELEGRAM_POLLING === 'true') {
            return c.json({ ok: true });
          }

          const update = await c.req.json();
          // Compute a file URL at runtime to avoid circular import during bundling
          const botModuleUrl = pathToFileURL(
            path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bot.js')
          ).href;
          const { handleUpdate } = await import(botModuleUrl);
          await handleUpdate(update);

          return c.json({ ok: true });
        },
      }),
    ],
  }
});
