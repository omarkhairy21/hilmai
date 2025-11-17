/**
 * Hybrid Query Tool for HilmAI Agent V2
 *
 * Intelligently decides between SQL-first or fuzzy (embedding-based) search
 * Uses SQL for exact matches, pgvector for typos and semantic search
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { searchTransactionsSQL, searchTransactionsHybrid } from '../../lib/embeddings';

export const hybridQueryTool = createTool({
  id: 'hybrid-query',
  description:
    'Search transactions using SQL for exact matches or pgvector for fuzzy/semantic matches',
  inputSchema: z.object({
    userId: z.number().describe('Telegram user ID'),
    query: z
      .string()
      .optional()
      .describe('Search query for fuzzy matching (merchant name, description)'),
    merchant: z.string().optional().describe('Exact merchant name for SQL search'),
    category: z
      .string()
      .optional()
      .describe('Category filter (e.g., Groceries, Dining, Transport)'),
    dateFrom: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
    minAmount: z.number().optional().describe('Minimum amount filter'),
    maxAmount: z.number().optional().describe('Maximum amount filter'),
    limit: z.number().default(50).describe('Maximum number of results'),
    useFuzzy: z
      .boolean()
      .default(false)
      .describe('Force fuzzy search (use for typos or semantic search)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactions: z.array(
      z.object({
        id: z.string(), // UUID
        display_id: z.number(),
        amount: z.number(),
        currency: z.string(),
        merchant: z.string(),
        category: z.string(),
        description: z.string().nullable(),
        transaction_date: z.string(),
        similarity: z.number(),
        original_amount: z.number().nullable().optional(),
        original_currency: z.string().nullable().optional(),
        converted_amount: z.number().nullable().optional(),
        conversion_rate: z.number().nullable().optional(),
        converted_at: z.string().nullable().optional(),
      })
    ),
    searchMethod: z.enum(['sql', 'fuzzy']),
    totalResults: z.number(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const toolStartTime = Date.now();

    const {
      userId,
      query,
      merchant,
      category,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      limit,
      useFuzzy,
    } = context;

    try {
      logger?.info('[tool:hybrid-query]', {
        event: 'start',
        userId,
        useFuzzy,
        query,
        merchant,
        category,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
        limit,
      });

      // Decision: SQL-first or fuzzy search?
      const shouldUseFuzzy = useFuzzy || (query && !merchant);

      let transactions;
      let searchMethod: 'sql' | 'fuzzy';

      if (shouldUseFuzzy && query) {
        // Use fuzzy search (pgvector)
        logger?.debug('[tool:hybrid-query]', {
          event: 'using_fuzzy_search',
          query,
          userId,
        });
        searchMethod = 'fuzzy';

        const fuzzySearchStart = Date.now();
        transactions = await searchTransactionsHybrid({
          query,
          userId,
          category,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          similarityThreshold: 0.6, // Adjust based on testing
          limit,
        });

        logger?.info('[tool:performance]', {
          operation: 'fuzzy_search',
          duration: Date.now() - fuzzySearchStart,
          userId,
          resultsCount: transactions.length,
        });
      } else {
        // Use SQL search (exact or LIKE matching)
        logger?.debug('[tool:hybrid-query]', {
          event: 'using_sql_search',
          merchant: merchant || query,
          userId,
        });
        searchMethod = 'sql';

        const sqlSearchStart = Date.now();
        transactions = await searchTransactionsSQL({
          userId,
          merchant: merchant || query, // Use query as merchant if no exact merchant provided
          category,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          limit,
        });

        logger?.info('[tool:performance]', {
          operation: 'sql_search',
          duration: Date.now() - sqlSearchStart,
          userId,
          resultsCount: transactions.length,
        });
      }

      const totalDuration = Date.now() - toolStartTime;
      logger?.info('[tool:hybrid-query]', {
        event: 'success',
        searchMethod,
        totalResults: transactions.length,
        duration: totalDuration,
        userId,
      });

      return {
        success: true,
        transactions,
        searchMethod,
        totalResults: transactions.length,
      };
    } catch (error) {
      const errorDuration = Date.now() - toolStartTime;
      logger?.error('[tool:hybrid-query]', {
        event: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: errorDuration,
        userId,
      });

      return {
        success: false,
        transactions: [],
        searchMethod: 'sql' as const,
        totalResults: 0,
      };
    }
  },
});
