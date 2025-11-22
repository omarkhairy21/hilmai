-- HilmAI Agent V2 - Supabase Schema
-- This file contains the complete database schema for agent-v2
-- Run this in Supabase SQL editor to set up the database

-- ============================================================================
-- PART 1: EXTENSIONS, TABLE CREATION, AND INDEXES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Extensions
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 1.2 Table Creation
-- ----------------------------------------------------------------------------

-- Users table (Telegram profile + preferences)
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
  subscription_status TEXT CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  trial_messages_used INT DEFAULT 0, -- Tracks API calls in hidden free trial (max 5)
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table with vector embeddings
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Secure UUID primary key (internal use)
  display_id INT NOT NULL, -- Sequential number for user-friendly display (e.g., 1, 2, 3)
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure display_id is unique per user (each user has their own sequence)
  CONSTRAINT unique_user_display_id UNIQUE(user_id, display_id)
);

-- Merchant embeddings cache table
CREATE TABLE IF NOT EXISTS merchant_embeddings_cache (
  id BIGSERIAL PRIMARY KEY,
  merchant_name TEXT UNIQUE NOT NULL,
  embedding vector(1536) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription usage tracking table
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

-- Webhook updates tracking table
CREATE TABLE IF NOT EXISTS webhook_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id BIGINT UNIQUE NOT NULL, -- Telegram's update identifier for deduplication
  payload JSONB NOT NULL, -- Raw Telegram update payload
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  last_error TEXT, -- Last error message if failed
  processed_at TIMESTAMPTZ, -- When processing completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation Codes Table for Stripe Checkout Linking
-- This table bridges Stripe checkout sessions to bot users
-- Allows web users who pay via Stripe to activate their subscription via link code
CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,                    -- Format: LINK-ABC123
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,     -- Stripe checkout session ID
  stripe_customer_email VARCHAR(255),                  -- Customer email from Stripe session
  plan_tier VARCHAR(50),                               -- 'monthly' or 'annual'
  used_at TIMESTAMPTZ NULL,                            -- When code was used for activation
  expires_at TIMESTAMPTZ NOT NULL,                     -- Code expiration time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 1.3 Indexes
-- ----------------------------------------------------------------------------

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_mode ON users(current_mode);

-- Transactions indexes
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

-- Merchant embeddings cache indexes
CREATE INDEX IF NOT EXISTS idx_merchant_cache_name ON merchant_embeddings_cache(merchant_name);
CREATE INDEX IF NOT EXISTS idx_merchant_cache_embedding
ON merchant_embeddings_cache
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- Subscription usage indexes
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_period 
ON subscription_usage(user_id, billing_period_start);

-- Webhook updates indexes
CREATE INDEX IF NOT EXISTS idx_webhook_updates_update_id ON webhook_updates(update_id);
CREATE INDEX IF NOT EXISTS idx_webhook_updates_status ON webhook_updates(status);
CREATE INDEX IF NOT EXISTS idx_webhook_updates_created_at ON webhook_updates(created_at);

-- Activation codes indexes
CREATE INDEX IF NOT EXISTS idx_activation_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_session ON activation_codes(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_activation_expires ON activation_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_activation_used ON activation_codes(used_at);

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Enable RLS on Tables
-- ----------------------------------------------------------------------------

-- Enable RLS on application tables only (user data isolation)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_embeddings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- NOTE: Mastra system tables (mastra_*, etc.) intentionally have NO RLS
-- They are framework system tables, not user data
-- Mastra backend (service role) needs unrestricted access

-- ----------------------------------------------------------------------------
-- 2.2 Helper Function for RLS Policies
-- ----------------------------------------------------------------------------

-- Helper function: Get current user ID from JWT claims
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

-- ----------------------------------------------------------------------------
-- 2.3 Users Table - RLS Policies
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 2.4 Transactions Table - RLS Policies
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 2.5 Merchant Embeddings Cache - RLS Policies
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 2.6 Subscription Usage Table - RLS Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view own usage"
ON subscription_usage FOR SELECT
USING (user_id = get_current_user_id());

CREATE POLICY "Backend service can manage all usage"
ON subscription_usage FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 2.7 Webhook Updates Table - RLS Policies
-- ----------------------------------------------------------------------------

-- Backend service only (no user access needed)
CREATE POLICY "Backend service can manage all webhook updates"
ON webhook_updates FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 2.8 Activation Codes Table - RLS Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Backend service can manage all activation codes"
ON activation_codes FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: TRIGGERS, RPC FUNCTIONS, AND HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Trigger Functions
-- ----------------------------------------------------------------------------

-- Auto-increment display_id per user on transaction insert
-- Uses advisory lock to prevent race conditions when multiple transactions are inserted concurrently
CREATE OR REPLACE FUNCTION set_next_display_id()
RETURNS TRIGGER AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert user_id to a lock key (use user_id directly as it's already BIGINT)
  -- pg_advisory_xact_lock uses a 64-bit integer key
  lock_key := NEW.user_id;
  
  -- Acquire transaction-level advisory lock for this user_id
  -- This ensures atomic display_id calculation even under concurrent load
  -- Lock is automatically released when transaction commits or rolls back
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Get the next display_id for this user (max existing + 1, or 1 if none exist)
  -- This query now runs atomically within the locked transaction
  SELECT COALESCE(MAX(display_id), 0) + 1
  INTO NEW.display_id
  FROM transactions
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.2 Triggers
-- ----------------------------------------------------------------------------

-- Trigger to auto-set display_id before insert
CREATE TRIGGER set_transaction_display_id
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_next_display_id();

-- Triggers to update updated_at timestamp
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

CREATE TRIGGER update_webhook_updates_updated_at
    BEFORE UPDATE ON webhook_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activation_codes_updated_at
    BEFORE UPDATE ON activation_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3.3 RPC Functions
-- ----------------------------------------------------------------------------

-- Hybrid search RPC function
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
  id UUID,
  display_id INT,
  amount DECIMAL,
  currency TEXT,
  merchant TEXT,
  category TEXT,
  description TEXT,
  transaction_date DATE,
  similarity FLOAT,
  original_amount DECIMAL,
  original_currency TEXT,
  converted_amount DECIMAL,
  conversion_rate DECIMAL,
  converted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.display_id,
    t.amount,
    t.currency,
    t.merchant,
    t.category,
    t.description,
    t.transaction_date,
    (1 - (t.merchant_embedding <=> p_query_embedding))::FLOAT as similarity,
    t.original_amount,
    t.original_currency,
    t.converted_amount,
    t.conversion_rate,
    t.converted_at
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

-- ----------------------------------------------------------------------------
-- 3.4 Helper Functions
-- ----------------------------------------------------------------------------

-- Helper function: Get transaction ID (UUID) by display_id and user_id
CREATE OR REPLACE FUNCTION get_transaction_id_by_display_id(
  p_user_id BIGINT,
  p_display_id INT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id
  INTO v_id
  FROM transactions
  WHERE user_id = p_user_id AND display_id = p_display_id
  LIMIT 1;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

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

-- ----------------------------------------------------------------------------
-- 3.5 Activation Codes Functions
-- ----------------------------------------------------------------------------

-- Get activation code by Stripe session ID
CREATE OR REPLACE FUNCTION get_activation_code_by_session(p_session_id TEXT)
RETURNS TABLE (
  id UUID,
  code VARCHAR,
  stripe_session_id VARCHAR,
  stripe_customer_email VARCHAR,
  plan_tier VARCHAR,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.code,
    ac.stripe_session_id,
    ac.stripe_customer_email,
    ac.plan_tier,
    ac.used_at,
    ac.expires_at,
    ac.created_at
  FROM activation_codes ac
  WHERE ac.stripe_session_id = p_session_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get activation code by code
CREATE OR REPLACE FUNCTION get_activation_code_by_code(p_code VARCHAR)
RETURNS TABLE (
  id UUID,
  code VARCHAR,
  stripe_session_id VARCHAR,
  stripe_customer_email VARCHAR,
  plan_tier VARCHAR,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.code,
    ac.stripe_session_id,
    ac.stripe_customer_email,
    ac.plan_tier,
    ac.used_at,
    ac.expires_at,
    ac.created_at
  FROM activation_codes ac
  WHERE ac.code = p_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create activation code
CREATE OR REPLACE FUNCTION create_activation_code(
  p_code VARCHAR,
  p_stripe_session_id VARCHAR,
  p_stripe_customer_email VARCHAR,
  p_plan_tier VARCHAR,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  code VARCHAR
) AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO activation_codes (code, stripe_session_id, stripe_customer_email, plan_tier, expires_at)
  VALUES (p_code, p_stripe_session_id, p_stripe_customer_email, p_plan_tier, p_expires_at)
  RETURNING activation_codes.id INTO v_id;

  RETURN QUERY SELECT activation_codes.id, activation_codes.code FROM activation_codes WHERE activation_codes.id = v_id;
END;
$$ LANGUAGE plpgsql;

-- Mark activation code as used
CREATE OR REPLACE FUNCTION mark_activation_code_used(p_code VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE activation_codes
  SET used_at = NOW(),
      updated_at = NOW()
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- Atomic activation: Create/update user and mark code as used in a single transaction
-- This ensures data consistency and prevents code reuse
CREATE OR REPLACE FUNCTION activate_subscription_from_code(
  p_code VARCHAR,
  p_telegram_user_id BIGINT,
  p_telegram_chat_id BIGINT,
  p_email VARCHAR,
  p_stripe_customer_id VARCHAR,
  p_stripe_subscription_id VARCHAR,
  p_plan_tier VARCHAR,
  p_subscription_status VARCHAR,
  p_trial_started_at TIMESTAMPTZ DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_code_record activation_codes%ROWTYPE;
  v_error_message TEXT;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Step 1: Lock and validate activation code
  SELECT * INTO v_code_record
  FROM activation_codes
  WHERE code = p_code
  FOR UPDATE; -- Lock row to prevent concurrent activation
  
  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Code not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if code is expired
  IF v_code_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Code has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check if code already used
  IF v_code_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Code has already been used'::TEXT;
    RETURN;
  END IF;
  
  -- Step 2: Create or update user (upsert)
  INSERT INTO users (
    id,
    telegram_chat_id,
    email,
    stripe_customer_id,
    stripe_subscription_id,
    plan_tier,
    subscription_status,
    trial_started_at,
    trial_ends_at,
    current_period_end,
    updated_at
  ) VALUES (
    p_telegram_user_id,
    p_telegram_chat_id,
    p_email,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_plan_tier::TEXT,
    p_subscription_status::TEXT,
    p_trial_started_at,
    p_trial_ends_at,
    p_current_period_end,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    telegram_chat_id = EXCLUDED.telegram_chat_id,
    email = EXCLUDED.email,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan_tier = EXCLUDED.plan_tier,
    subscription_status = EXCLUDED.subscription_status,
    trial_started_at = EXCLUDED.trial_started_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
  
  -- Step 3: Mark code as used (atomic with user creation)
  UPDATE activation_codes
  SET used_at = NOW(),
      updated_at = NOW()
  WHERE code = p_code;
  
  -- Success
  RETURN QUERY SELECT TRUE, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback happens automatically
  v_error_message := SQLERRM;
  RETURN QUERY SELECT FALSE, v_error_message;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Done! Schema is ready for agent-v2 with RLS security and subscriptions
-- ============================================================================
