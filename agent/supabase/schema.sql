-- HilmAI Agent V2 - Supabase Schema
-- This file contains the complete database schema for agent-v2
-- Run this in Supabase SQL editor to set up the database

-- ============================================================================
-- 1. Enable pgvector extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. Users table (Telegram profile + preferences)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY, -- Telegram user ID
  telegram_chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE, -- User email for subscription management
  default_currency TEXT NOT NULL DEFAULT 'AED',
  current_mode TEXT NOT NULL DEFAULT 'chat' CHECK (current_mode IN ('logger', 'chat', 'query')),
  timezone TEXT,
  metadata JSONB,
  
  -- Subscription fields
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('monthly', 'annual')),
  subscription_status TEXT CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Transactions table with vector embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Transaction data
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,

  -- Currency conversion tracking (for multi-currency support)
  original_amount DECIMAL(10, 2), -- Amount in the currency user specified
  original_currency TEXT, -- The currency user specified (e.g., "VND", "USD")
  converted_amount DECIMAL(10, 2), -- Amount converted to user's default currency
  conversion_rate DECIMAL(10, 6), -- Exchange rate used for conversion
  converted_at TIMESTAMPTZ, -- When conversion was performed

  -- Vector embeddings for fuzzy search
  merchant_embedding vector(1536), -- text-embedding-3-small (1536 dimensions)
  description_embedding vector(1536), -- Optional: for description search

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. Indexes for performance
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_mode ON users(current_mode);

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
-- 5. Merchant embeddings cache table
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
-- 6. Subscription usage tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one row per user per billing period
  UNIQUE(user_id, billing_period_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_period 
ON subscription_usage(user_id, billing_period_start);

-- ============================================================================
-- 7. Hybrid search RPC function
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
-- 8. Helper functions
-- ============================================================================

-- Update merchant cache usage count
CREATE OR REPLACE FUNCTION increment_merchant_cache_usage(p_merchant_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE merchant_embeddings_cache
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE merchant_name = p_merchant_name;
END;
$$ LANGUAGE plpgsql;

-- Increment usage tokens for a billing period
CREATE OR REPLACE FUNCTION increment_usage_tokens(
  p_user_id BIGINT,
  p_period_start TIMESTAMPTZ,
  p_tokens BIGINT
)
RETURNS void AS $$
BEGIN
  UPDATE subscription_usage
  SET total_tokens = total_tokens + p_tokens,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND billing_period_start = p_period_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Trigger to update updated_at timestamp
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

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at
    BEFORE UPDATE ON subscription_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. Row Level Security (RLS) Setup for Telegram Bot
-- ============================================================================

-- Enable RLS on application tables only (user data isolation)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_embeddings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- NOTE: Mastra system tables (mastra_*, etc.) intentionally have NO RLS
-- They are framework system tables, not user data
-- Mastra backend (service role) needs unrestricted access

-- ============================================================================
-- Helper function: Get current user ID from JWT claims
-- ============================================================================
-- NOTE: This function is for future client-side RLS enforcement.
-- When using service_role key (backend operations), this function returns NULL
-- because service_role bypasses RLS and doesn't use JWT claims.
-- Backend operations should validate user_id in application code instead.
--
-- This function will be useful if you implement:
-- - Client-side API access with JWT tokens
-- - Direct anon key access with user authentication
-- - Web dashboard with Supabase Auth integration

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN (auth.jwt() ->> 'user_id')::BIGINT;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Users Table - RLS Policies
-- ============================================================================

CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (id = get_current_user_id());

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = get_current_user_id())
WITH CHECK (id = get_current_user_id());

CREATE POLICY "Backend service can manage all users"
ON users FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Transactions Table - RLS Policies
-- ============================================================================

CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own transactions"
ON transactions FOR INSERT
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own transactions"
ON transactions FOR UPDATE
USING (user_id = get_current_user_id())
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete own transactions"
ON transactions FOR DELETE
USING (user_id = get_current_user_id());

CREATE POLICY "Backend service can access all transactions"
ON transactions FOR ALL
USING (auth.role() = 'service_role');

-- ============================================================================
-- Merchant Embeddings Cache - RLS Policies
-- ============================================================================

-- Public read access (cache is shared reference data)
CREATE POLICY "Anyone can read merchant cache"
ON merchant_embeddings_cache FOR SELECT
USING (true);

-- Backend-only write access
CREATE POLICY "Backend service can insert merchant cache"
ON merchant_embeddings_cache FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Backend service can update merchant cache"
ON merchant_embeddings_cache FOR UPDATE
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Backend service can delete merchant cache"
ON merchant_embeddings_cache FOR DELETE
USING (auth.role() = 'service_role');

-- ============================================================================
-- Subscription Usage Table - RLS Policies
-- ============================================================================

CREATE POLICY "Users can view own usage"
ON subscription_usage FOR SELECT
USING (user_id = get_current_user_id());

CREATE POLICY "Backend service can manage all usage"
ON subscription_usage FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Done! Schema is ready for agent-v2 with RLS security and subscriptions
-- ============================================================================
