import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { getTransactionsIndex } from '../../lib/pinecone';
import { generateEmbeddingWithRetry } from '../rag/embeddings';

const MIN_FALLBACK_SIMILARITY = 0.35;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ['grocery', 'groceries', 'supermarket', 'super market', 'market'],
  dining: ['dining', 'restaurant', 'food', 'meal', 'coffee', 'cafe'],
  transport: ['transport', 'uber', 'lyft', 'taxi', 'bus', 'train', 'gas'],
  shopping: ['shopping', 'retail', 'store', 'mall', 'fashion'],
  bills: ['bill', 'utility', 'utilities', 'electric', 'internet', 'rent'],
  entertainment: ['entertainment', 'movie', 'cinema', 'concert', 'streaming'],
  healthcare: ['health', 'doctor', 'pharmacy', 'medicine', 'clinic'],
  education: ['education', 'school', 'course', 'tuition', 'class'],
  other: ['other', 'misc', 'miscellaneous'],
};

const detectCategoryFromQuery = (query: string): string | null => {
  const lowerQuery = query.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      return category;
    }
  }

  return null;
};

const normalizeDateInput = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
};

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
    startDate: z.string().optional().describe('Inclusive ISO timestamp lower bound'),
    endDate: z.string().optional().describe('Inclusive ISO timestamp upper bound'),
    merchant: z.string().optional().describe('Filter by merchant name'),
    category: z.string().optional().describe('Filter by category name'),
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
    const { userId, query, topK, minSimilarity, startDate, endDate, merchant, category } = context;

    try {
      const resolvedTopK = topK || 10;
      const normalizedQuery = query.toLowerCase();
      const detectedCategory = detectCategoryFromQuery(normalizedQuery);
      const resolvedCategory = category || detectedCategory || null;
      const normalizedCategory = resolvedCategory ? resolvedCategory.toLowerCase() : null;
      const normalizedMerchant = merchant ? merchant.trim().toLowerCase() : null;
      const initialThreshold =
        typeof minSimilarity === 'number' && !Number.isNaN(minSimilarity) ? minSimilarity : 0.7;
      const startDateIso = normalizeDateInput(startDate);
      const endDateIso = normalizeDateInput(endDate);

      // Generate embedding for the search query
      const queryEmbedding = await generateEmbeddingWithRetry(query);

      // Search in Pinecone using the user UUID
      const index = getTransactionsIndex();
      const pineconeFilter: Record<string, any> = {
        userId: { $eq: userId },
      };

      if (normalizedCategory) {
        pineconeFilter.categoryLower = { $eq: normalizedCategory };
      }

      if (normalizedMerchant) {
        pineconeFilter.merchantLower = { $eq: normalizedMerchant };
      }

      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: resolvedTopK,
        filter: pineconeFilter,
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
      const rawMatches = queryResponse.matches || [];
      const mapMatch = (matchList: typeof rawMatches) =>
        matchList.map((match) => ({
          id: match.id,
          similarity: match.score || 0,
        }));

      const primaryMatches = rawMatches.filter((match) => (match.score || 0) >= initialThreshold);
      let matches = mapMatch(primaryMatches);
      let appliedThreshold = initialThreshold;

      // Fallback: relax the similarity threshold if we received matches but all are below target
      if (
        matches.length === 0 &&
        rawMatches.length > 0 &&
        initialThreshold > MIN_FALLBACK_SIMILARITY
      ) {
        const fallbackMatches = rawMatches.filter(
          (match) => (match.score || 0) >= MIN_FALLBACK_SIMILARITY
        );
        if (fallbackMatches.length > 0) {
          matches = mapMatch(fallbackMatches);
          appliedThreshold = MIN_FALLBACK_SIMILARITY;
          console.log(
            `ℹ️ Similarity fallback applied for query "${query}": ${initialThreshold} → ${appliedThreshold}`
          );
        }
      }

      if (matches.length === 0) {
        // Structured fallback: if we can infer a category from the query, hit Supabase directly
        if (resolvedCategory) {
          let fallbackQuery = db
            .from('transactions')
            .select('id, amount, currency, merchant, category, transaction_date, description')
            .eq('user_id', userId)
            .ilike('category', resolvedCategory)
            .order('transaction_date', { ascending: false })
            .limit(resolvedTopK);

          if (startDateIso) fallbackQuery = fallbackQuery.gte('transaction_date', startDateIso);
          if (endDateIso) fallbackQuery = fallbackQuery.lte('transaction_date', endDateIso);
          if (normalizedMerchant) {
            fallbackQuery = fallbackQuery.ilike('merchant', `%${normalizedMerchant}%`);
          }

          const { data: categoryTransactions, error: categoryError } = await fallbackQuery;

          if (categoryError) {
            throw new Error(`Failed to fetch category transactions: ${categoryError.message}`);
          }

          if (categoryTransactions && categoryTransactions.length > 0) {
            const results = categoryTransactions.map((transaction) => ({
              id: transaction.id,
              amount: transaction.amount,
              currency: transaction.currency,
              merchant: transaction.merchant,
              category: transaction.category,
              date: transaction.transaction_date,
              description: transaction.description,
              similarity: MIN_FALLBACK_SIMILARITY,
            }));

            return {
              success: true,
              results,
              count: results.length,
              message: `Found ${results.length} transaction${
                results.length === 1 ? '' : 's'
              } by category match "${detectedCategory}".`,
            };
          }
        }

        return {
          success: true,
          results: [],
          count: 0,
          message: `No transactions found with similarity >= ${initialThreshold}`,
        };
      }

      // Fetch full transaction details from Supabase
      // Note: Pinecone has metadata, but we fetch from Supabase for complete/authoritative data
      const transactionIds = matches.map((m) => m.id);
      let detailsQuery = db
        .from('transactions')
        .select('id, amount, currency, merchant, category, transaction_date, description')
        .eq('user_id', userId)
        .in('id', transactionIds);

      if (startDateIso) detailsQuery = detailsQuery.gte('transaction_date', startDateIso);
      if (endDateIso) detailsQuery = detailsQuery.lte('transaction_date', endDateIso);
      if (normalizedMerchant) {
        detailsQuery = detailsQuery.ilike('merchant', `%${normalizedMerchant}%`);
      }
      if (resolvedCategory) {
        detailsQuery = detailsQuery.ilike('category', resolvedCategory);
      }

      const { data: transactions, error } = await detailsQuery;

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
        message: `Found ${results.length} matching transaction${
          results.length === 1 ? '' : 's'
        } (similarity ≥ ${appliedThreshold.toFixed(2)}).`,
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
