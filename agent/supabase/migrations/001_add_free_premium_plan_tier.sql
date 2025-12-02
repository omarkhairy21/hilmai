-- Migration: Add 'free_premium' plan tier option
-- This allows granting premium access without Stripe billing for internal testing

-- Drop existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_tier_check;

-- Add new constraint with 'free_premium' option
ALTER TABLE users ADD CONSTRAINT users_plan_tier_check 
  CHECK (plan_tier IN ('monthly', 'annual', 'free_premium'));


