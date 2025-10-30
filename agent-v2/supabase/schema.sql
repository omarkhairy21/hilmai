-- HilmAI Agent V2 - Supabase Schema
-- This file contains the complete database schema for agent-v2
-- Run this in Supabase SQL editor to set up the database

-- ============================================================================
-- 1. Enable pgvector extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. Transactions table with vector embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,

  -- Transaction data
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,

  -- Vector embeddings for fuzzy search
  merchant_embedding vector(1536), -- text-embedding-3-small (1536 dimensions)
  description_embedding vector(1536), -- Optional: for description search

  -- Metadata
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Indexes for performance
-- ============================================================================

-- Standard indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions USING gin(to_tsvector('english', merchant));

-- Vector indexes for similarity search (IVFFlat algorithm)
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_embedding
ON transactions
USING ivfflat (merchant_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_transactions_description_embedding
ON transactions
USING ivfflat (description_embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- 4. Merchant embeddings cache table
-- ============================================================================

CREATE TABLE IF NOT EXISTS merchant_embeddings_cache (
  id BIGSERIAL PRIMARY KEY,
  merchant_name TEXT UNIQUE NOT NULL,
  embedding vector(1536) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_merchant_cache_name ON merchant_embeddings_cache(merchant_name);

-- Vector index for merchant cache
CREATE INDEX IF NOT EXISTS idx_merchant_cache_embedding
ON merchant_embeddings_cache
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- ============================================================================
-- 5. Hybrid search RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION search_transactions_hybrid(
  p_query_embedding vector(1536),
  p_user_id BIGINT,
  p_similarity_threshold FLOAT DEFAULT 0.6,
  p_category TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_min_amount DECIMAL DEFAULT NULL,
  p_max_amount DECIMAL DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  amount DECIMAL,
  currency TEXT,
  merchant TEXT,
  category TEXT,
  description TEXT,
  transaction_date DATE,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.amount,
    t.currency,
    t.merchant,
    t.category,
    t.description,
    t.transaction_date,
    (1 - (t.merchant_embedding <=> p_query_embedding))::FLOAT as similarity
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.merchant_embedding IS NOT NULL
    AND (p_category IS NULL OR t.category = p_category)
    AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
    AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (1 - (t.merchant_embedding <=> p_query_embedding)) > p_similarity_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. Helper function: Update merchant cache usage count
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_merchant_cache_usage(p_merchant_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE merchant_embeddings_cache
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE merchant_name = p_merchant_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchant_cache_updated_at
    BEFORE UPDATE ON merchant_embeddings_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done! Schema is ready for agent-v2
-- ============================================================================
