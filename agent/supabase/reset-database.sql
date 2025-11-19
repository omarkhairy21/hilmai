-- ============================================================================
-- HilmAI Agent V2 - Database Reset Script
-- ============================================================================
-- WARNING: This script will DELETE ALL DATA and drop all tables/functions.
-- Only run this in development or when you want to completely reset the database.
-- After running this, you must run schema.sql to recreate the database.
-- ============================================================================
-- This script follows the reverse order of schema.sql:
-- 1. Drop triggers (depend on functions)
-- 2. Drop RLS policies (depend on functions)
-- 3. Drop functions (depend on tables)
-- 4. Drop tables (depend on each other)
-- 5. Drop extensions (optional)
-- ============================================================================

-- ============================================================================
-- PART 1: DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS set_transaction_display_id ON transactions;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_merchant_cache_updated_at ON merchant_embeddings_cache;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_subscription_usage_updated_at ON subscription_usage;
DROP TRIGGER IF EXISTS update_webhook_updates_updated_at ON webhook_updates;
DROP TRIGGER IF EXISTS update_activation_codes_updated_at ON activation_codes;

-- ============================================================================
-- PART 2: DROP RLS POLICIES
-- ============================================================================

-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Backend service can manage all users" ON users;

-- Transactions table policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Backend service can access all transactions" ON transactions;

-- Merchant embeddings cache policies
DROP POLICY IF EXISTS "Anyone can read merchant cache" ON merchant_embeddings_cache;
DROP POLICY IF EXISTS "Backend service can insert merchant cache" ON merchant_embeddings_cache;
DROP POLICY IF EXISTS "Backend service can update merchant cache" ON merchant_embeddings_cache;
DROP POLICY IF EXISTS "Backend service can delete merchant cache" ON merchant_embeddings_cache;

-- Subscription usage table policies
DROP POLICY IF EXISTS "Users can view own usage" ON subscription_usage;
DROP POLICY IF EXISTS "Backend service can manage all usage" ON subscription_usage;

-- Webhook updates table policies
DROP POLICY IF EXISTS "Backend service can manage all webhook updates" ON webhook_updates;

-- Activation codes table policies
DROP POLICY IF EXISTS "Backend service can manage all activation codes" ON activation_codes;

-- ============================================================================
-- PART 3: DROP FUNCTIONS
-- ============================================================================

-- RPC Functions
DROP FUNCTION IF EXISTS search_transactions_hybrid(
  vector(1536),
  BIGINT,
  FLOAT,
  TEXT,
  DATE,
  DATE,
  DECIMAL,
  DECIMAL,
  INTEGER
);

-- Helper Functions
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS get_transaction_id_by_display_id(BIGINT, INT);
DROP FUNCTION IF EXISTS increment_merchant_cache_usage(TEXT);
DROP FUNCTION IF EXISTS increment_usage_tokens(BIGINT, TIMESTAMPTZ, BIGINT);

-- Activation Codes Functions
DROP FUNCTION IF EXISTS get_activation_code_by_session(TEXT);
DROP FUNCTION IF EXISTS get_activation_code_by_code(VARCHAR);
DROP FUNCTION IF EXISTS create_activation_code(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS mark_activation_code_used(VARCHAR);
DROP FUNCTION IF EXISTS activate_subscription_from_code(
  VARCHAR,
  BIGINT,
  BIGINT,
  VARCHAR,
  VARCHAR,
  VARCHAR,
  VARCHAR,
  VARCHAR,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ
);

-- Trigger Functions
DROP FUNCTION IF EXISTS set_next_display_id();
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- PART 4: DROP TABLES (in reverse dependency order)
-- ============================================================================

-- Drop tables that reference other tables first
DROP TABLE IF EXISTS webhook_updates CASCADE;
DROP TABLE IF EXISTS activation_codes CASCADE;
DROP TABLE IF EXISTS subscription_usage CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS merchant_embeddings_cache CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- PART 5: DROP EXTENSIONS (optional)
-- ============================================================================
-- Note: Only drop the extension if you want to completely remove pgvector.
-- If other databases in your Supabase project use pgvector, keep it enabled.
-- Uncomment the line below if you need to drop the vector extension.

-- DROP EXTENSION IF EXISTS vector CASCADE;

-- ============================================================================
-- Reset Complete!
-- ============================================================================
-- Next steps:
-- 1. Run schema.sql to recreate all tables, functions, triggers, and policies
-- 2. Your database is now clean and ready for fresh data
-- ============================================================================
