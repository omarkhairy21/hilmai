/**
 * Embeddings Library for HilmAI Agent V2
 *
 * Provides functions for:
 * - Generating embeddings using OpenAI text-embedding-3-small
 * - Caching merchant embeddings to reduce API calls
 * - Hybrid search using SQL + pgvector
 */

import { openai } from "./openai";
import { supabase } from "./supabase";

/**
 * Generate embedding vector using OpenAI API
 * Model: text-embedding-3-small (1536 dimensions)
 * Cost: ~$0.00001 per call
 *
 * @param text - Text to embed
 * @returns Vector array of 1536 dimensions
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.trim(),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("[embeddings] Error generating embedding:", error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get merchant embedding with caching
 * Checks cache first, generates and caches if miss
 * Reduces API calls by 80-90%
 *
 * @param merchant - Merchant name
 * @returns Cached or newly generated embedding vector
 */
export async function getMerchantEmbedding(
  merchant: string,
): Promise<number[]> {
  const normalized = merchant.trim().toLowerCase();

  if (!normalized) {
    throw new Error("Cannot get embedding for empty merchant name");
  }

  try {
    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from("merchant_embeddings_cache")
      .select("embedding")
      .eq("merchant_name", normalized)
      .single();

    if (cached && !cacheError) {
      console.log(`[embeddings] Cache hit: ${merchant}`);

      // Update usage count (fire and forget)
      supabase
        .from("merchant_embeddings_cache")
        .update({
          usage_count: supabase.sql`usage_count + 1`,
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_name", normalized)
        .then(() => {})
        .catch((err) =>
          console.warn("[embeddings] Failed to update cache usage:", err),
        );

      return cached.embedding as number[];
    }

    // Cache miss - generate new embedding
    console.log(`[embeddings] Cache miss: ${merchant} - generating...`);
    const embedding = await generateEmbedding(merchant);

    // Store in cache (fire and forget)
    supabase
      .from("merchant_embeddings_cache")
      .insert({
        merchant_name: normalized,
        embedding,
        usage_count: 1,
      })
      .then(() => console.log(`[embeddings] Cached: ${merchant}`))
      .catch((err) => {
        // Ignore unique constraint violations (race condition)
        if (!err.message?.includes("duplicate key")) {
          console.warn("[embeddings] Failed to cache embedding:", err);
        }
      });

    return embedding;
  } catch (error) {
    console.error("[embeddings] Error getting merchant embedding:", error);
    throw new Error(
      `Failed to get merchant embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Hybrid search parameters
 */
export interface HybridSearchParams {
  /** Search query text */
  query: string;
  /** User ID to filter transactions */
  userId: number;
  /** Category filter (optional) */
  category?: string;
  /** Date range start (optional) */
  dateFrom?: string;
  /** Date range end (optional) */
  dateTo?: string;
  /** Minimum amount filter (optional) */
  minAmount?: number;
  /** Maximum amount filter (optional) */
  maxAmount?: number;
  /** Similarity threshold (0.0 to 1.0, default 0.6) */
  similarityThreshold?: number;
  /** Maximum number of results (default 50) */
  limit?: number;
}

/**
 * Transaction result from hybrid search
 */
export interface TransactionResult {
  id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  description: string | null;
  transaction_date: string;
  similarity: number;
}

/**
 * Search transactions using hybrid SQL + pgvector approach
 *
 * Process:
 * 1. Generate embedding for search query
 * 2. Call Supabase RPC function with embedding + filters
 * 3. Returns results sorted by similarity
 *
 * @param params - Search parameters
 * @returns Array of matching transactions with similarity scores
 */
export async function searchTransactionsHybrid(
  params: HybridSearchParams,
): Promise<TransactionResult[]> {
  const {
    query,
    userId,
    category,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    similarityThreshold = 0.6,
    limit = 50,
  } = params;

  try {
    // Generate embedding for query
    console.log(`[embeddings] Hybrid search for: "${query}"`);
    const queryEmbedding = await generateEmbedding(query);

    // Call RPC function
    const { data, error } = await supabase.rpc("search_transactions_hybrid", {
      p_query_embedding: queryEmbedding,
      p_user_id: userId,
      p_similarity_threshold: similarityThreshold,
      p_category: category || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_min_amount: minAmount || null,
      p_max_amount: maxAmount || null,
      p_limit: limit,
    });

    if (error) {
      console.error("[embeddings] Hybrid search error:", error);
      throw error;
    }

    console.log(`[embeddings] Found ${data?.length || 0} results`);
    return (data as TransactionResult[]) || [];
  } catch (error) {
    console.error("[embeddings] Error in hybrid search:", error);
    throw new Error(
      `Hybrid search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Simple SQL-first search (no embeddings)
 * Use this for exact matches to avoid embedding generation cost
 *
 * @param params - Search parameters (without query)
 * @returns Array of matching transactions
 */
export async function searchTransactionsSQL(params: {
  userId: number;
  merchant?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
}): Promise<TransactionResult[]> {
  const {
    userId,
    merchant,
    category,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    limit = 50,
  } = params;

  try {
    let query = supabase
      .from("transactions")
      .select(
        "id, amount, currency, merchant, category, description, transaction_date",
      )
      .eq("user_id", userId);

    // Apply filters
    if (merchant) {
      query = query.ilike("merchant", `%${merchant}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (dateFrom) {
      query = query.gte("transaction_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("transaction_date", dateTo);
    }
    if (minAmount !== undefined) {
      query = query.gte("amount", minAmount);
    }
    if (maxAmount !== undefined) {
      query = query.lte("amount", maxAmount);
    }

    query = query.order("transaction_date", { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error("[embeddings] SQL search error:", error);
      throw error;
    }

    console.log(`[embeddings] SQL search found ${data?.length || 0} results`);

    // Add similarity field (1.0 for exact matches)
    return (data || []).map((tx) => ({
      ...tx,
      similarity: 1.0,
    })) as TransactionResult[];
  } catch (error) {
    console.error("[embeddings] Error in SQL search:", error);
    throw new Error(
      `SQL search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
