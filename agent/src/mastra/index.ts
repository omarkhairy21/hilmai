import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { registerApiRoute } from '@mastra/core/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transactionExtractorAgent } from './agents/transaction-extractor-agent.js';
import { financeInsightsAgent } from './agents/finance-insights-agent.js';
import { messageClassifierAgent } from './agents/message-classifier-agent.js';
import { telegramRoutingWorkflow } from './workflows/telegram-routing-workflow.js';
import { telegramVoiceWorkflow } from './workflows/telegram-voice-workflow.js';

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
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
  server: {
    port: 4111,
    apiRoutes: [
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
          const { handleUpdate } = await import('../bot.js');
          await handleUpdate(update);

          return c.json({ ok: true });
        },
      }),
    ],
  }
});
