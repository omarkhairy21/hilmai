import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { transactionExtractorAgent } from './agents/transaction-extractor-agent.js';
import { financeInsightsAgent } from './agents/finance-insights-agent.js';
import { messageClassifierAgent } from './agents/message-classifier-agent.js';

export const mastra = new Mastra({
  agents: {
    transactionExtractor: transactionExtractorAgent,
    financeInsights: financeInsightsAgent,
    messageClassifier: messageClassifierAgent,
  },

  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
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
});
