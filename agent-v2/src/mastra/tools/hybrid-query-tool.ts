/**
 * Hybrid Query Tool for HilmAI Agent V2
 *
 * Intelligently decides between SQL-first or fuzzy (embedding-based) search
 * Uses SQL for exact matches, pgvector for typos and semantic search
 */

import { createTool } from "@mastra/core";
import { z } from "zod";
import {
  searchTransactionsSQL,
  searchTransactionsHybrid,
} from "../../lib/embeddings";

export const hybridQueryTool = createTool({
  id: "hybrid-query",
  description:
    "Search transactions using SQL for exact matches or pgvector for fuzzy/semantic matches",
  inputSchema: z.object({
    userId: z.number().describe("Telegram user ID"),
    query: z
      .string()
      .optional()
      .describe("Search query for fuzzy matching (merchant name, description)"),
    merchant: z
      .string()
      .optional()
      .describe("Exact merchant name for SQL search"),
    category: z
      .string()
      .optional()
      .describe("Category filter (e.g., Groceries, Dining, Transport)"),
    dateFrom: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
    minAmount: z.number().optional().describe("Minimum amount filter"),
    maxAmount: z.number().optional().describe("Maximum amount filter"),
    limit: z.number().default(50).describe("Maximum number of results"),
    useFuzzy: z
      .boolean()
      .default(false)
      .describe("Force fuzzy search (use for typos or semantic search)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactions: z.array(
      z.object({
        id: z.number(),
        amount: z.number(),
        currency: z.string(),
        merchant: z.string(),
        category: z.string(),
        description: z.string().nullable(),
        transaction_date: z.string(),
        similarity: z.number(),
      }),
    ),
    searchMethod: z.enum(["sql", "fuzzy"]),
    totalResults: z.number(),
  }),
  execute: async ({ context }) => {
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
      console.log(
        `[hybrid-query] Query for user ${userId}: fuzzy=${useFuzzy}, query="${query}", merchant="${merchant}"`,
      );

      // Decision: SQL-first or fuzzy search?
      const shouldUseFuzzy = useFuzzy || (query && !merchant);

      let transactions;
      let searchMethod: "sql" | "fuzzy";

      if (shouldUseFuzzy && query) {
        // Use fuzzy search (pgvector)
        console.log("[hybrid-query] Using fuzzy search");
        searchMethod = "fuzzy";

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
      } else {
        // Use SQL search (exact or LIKE matching)
        console.log("[hybrid-query] Using SQL search");
        searchMethod = "sql";

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
      }

      console.log(
        `[hybrid-query] Found ${transactions.length} results using ${searchMethod}`,
      );

      return {
        success: true,
        transactions,
        searchMethod,
        totalResults: transactions.length,
      };
    } catch (error) {
      console.error("[hybrid-query] Error:", error);

      return {
        success: false,
        transactions: [],
        searchMethod: "sql" as const,
        totalResults: 0,
      };
    }
  },
});
