import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabase } from '../../lib/supabase.js';
import { getTransactionsIndex } from '../../lib/pinecone.js';
import { generateEmbeddingWithRetry } from '../rag/embeddings.js';

// Type-safe wrapper for Supabase operations
const db = supabase.schema('public');

export const searchTransactionsTool = createTool({
  id: 'search-transactions',
  description:
    'Search transactions using semantic search. Finds transactions based on natural language queries like "coffee purchases", "groceries last week", or "expensive meals".',
  inputSchema: z.object({
    userId: z.string().describe('Internal user UUID (from users.id table)'),
    query: z.string().describe('Natural language search query'),
    topK: z.number().optional().default(10).describe('Number of results to return (default: 10)'),
    minSimilarity: z
      .number()
      .optional()
      .default(0.7)
      .describe('Minimum similarity score (0-1, default: 0.7)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(
      z.object({
        id: z.string(),
        amount: z.number(),
        currency: z.string(),
        merchant: z.string(),
        category: z.string(),
        date: z.string(),
        description: z.string().nullable(),
        similarity: z.number(),
      })
    ),
    count: z.number(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { userId, query, topK, minSimilarity } = context;

    try {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbeddingWithRetry(query);

      // Search in Pinecone using the user UUID
      const index = getTransactionsIndex();
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: topK || 10,
        filter: {
          userId: { $eq: userId },
        },
        includeMetadata: true,
      });

      console.log('queryResponse', queryResponse, 'queryEmbedding', queryEmbedding, 'query', query);

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return {
          success: true,
          results: [],
          count: 0,
          message: 'No matching transactions found.',
        };
      }

      // Filter by minimum similarity and get transaction IDs
      const matches = queryResponse.matches
        .filter((match) => (match.score || 0) >= (minSimilarity || 0.7))
        .map((match) => ({
          id: match.id,
          similarity: match.score || 0,
        }));

      if (matches.length === 0) {
        return {
          success: true,
          results: [],
          count: 0,
          message: `No transactions found with similarity >= ${minSimilarity}`,
        };
      }

      // Fetch full transaction details from Supabase
      // Note: Pinecone has metadata, but we fetch from Supabase for complete/authoritative data
      const transactionIds = matches.map((m) => m.id);
      const { data: transactions, error } = await db
        .from('transactions')
        .select('id, amount, currency, merchant, category, transaction_date, description')
        .in('id', transactionIds);

      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      if (!transactions) {
        return {
          success: true,
          results: [],
          count: 0,
          message: 'No transactions found in database.',
        };
      }

      // Merge with similarity scores and sort by similarity
      const results = transactions
        .map((transaction) => {
          const match = matches.find((m) => m.id === transaction.id);
          return {
            id: transaction.id,
            amount: transaction.amount,
            currency: transaction.currency,
            merchant: transaction.merchant,
            category: transaction.category,
            date: transaction.transaction_date,
            description: transaction.description,
            similarity: match?.similarity || 0,
          };
        })
        .sort((a, b) => b.similarity - a.similarity);

      return {
        success: true,
        results,
        count: results.length,
        message: `Found ${results.length} matching transaction${results.length === 1 ? '' : 's'}.`,
      };
    } catch (error) {
      console.error('Error searching transactions:', error);
      return {
        success: false,
        results: [],
        count: 0,
        message: `Failed to search transactions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
