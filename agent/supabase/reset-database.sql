-- ============================================================================
-- HilmAI Agent V2 - Database Reset Script
-- ============================================================================
-- WARNING: This script will DELETE ALL DATA and drop all tables/functions.
-- Only run this in development or when you want to completely reset the database.
-- After running this, you must run schema.sql to recreate the database.
-- ============================================================================

-- Step 1: Drop all triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_merchant_cache_updated_at ON merchant_embeddings_cache;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_subscription_usage_updated_at ON subscription_usage;
DROP TRIGGER IF EXISTS set_transaction_display_id ON transactions;
DROP TRIGGER IF EXISTS update_webhook_updates_updated_at ON webhook_updates;

-- Step 2: Drop all RLS policies
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

-- Step 3: Drop all functions
-- ============================================================================

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

DROP FUNCTION IF EXISTS increment_merchant_cache_usage(TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS set_next_display_id();
DROP FUNCTION IF EXISTS get_transaction_id_by_display_id(BIGINT, INT);
DROP FUNCTION IF EXISTS increment_usage_tokens(BIGINT, TIMESTAMPTZ, BIGINT);

-- Step 4: Drop all tables (in reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS webhook_updates CASCADE;
DROP TABLE IF EXISTS subscription_usage CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS merchant_embeddings_cache CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Step 5: Drop the vector extension (optional - uncomment if needed)
-- ============================================================================
-- Note: Only drop the extension if you want to completely remove pgvector.
-- If other databases in your Supabase project use pgvector, keep it enabled.

-- DROP EXTENSION IF EXISTS vector CASCADE;

-- ============================================================================
-- Reset Complete!
-- ============================================================================
-- Next steps:
-- 1. Run schema.sql to recreate all tables, functions, and policies
-- 2. Your database is now clean and ready for fresh data
-- ============================================================================

