# Free Premium Plan - Internal Testing Access

This document explains how to grant `free_premium` plan access to users for internal testing and feedback collection.

## Overview

The `free_premium` plan tier grants full premium access without Stripe billing. Users with this plan have unlimited access to all premium features without charges.

## Database Migration

Before assigning the plan, ensure you've run the migration.

**See `supabase/MIGRATION_GUIDE.md` for detailed instructions on running migrations in production.**

Quick steps:
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/001_add_free_premium_plan_tier.sql`
3. Copy and paste the SQL into the editor
4. Run the migration
5. Verify it worked (see MIGRATION_GUIDE.md for verification queries)

## Granting Free Premium Access

To grant `free_premium` plan to specific users, run the following SQL in your Supabase SQL editor:

```sql
-- Grant free_premium plan to specific users
-- Replace YOUR_USER_ID_1, YOUR_USER_ID_2, etc. with actual Telegram user IDs
UPDATE users 
SET 
  plan_tier = 'free_premium',
  subscription_status = 'active',
  current_period_end = '2099-12-31'::timestamptz, -- Far future date to prevent expiration
  updated_at = NOW()
WHERE id IN (YOUR_USER_ID_1, YOUR_USER_ID_2, ...);
```

### Example

```sql
-- Grant free_premium to user IDs 123456789 and 987654321
UPDATE users 
SET 
  plan_tier = 'free_premium',
  subscription_status = 'active',
  current_period_end = '2099-12-31'::timestamptz,
  updated_at = NOW()
WHERE id IN (123456789, 987654321);
```

## Revoking Free Premium Access

To revoke `free_premium` access and revert to free status:

```sql
UPDATE users 
SET 
  plan_tier = NULL,
  subscription_status = 'free',
  current_period_end = NULL,
  updated_at = NOW()
WHERE id IN (YOUR_USER_ID_1, YOUR_USER_ID_2, ...);
```

## How It Works

- Users with `plan_tier = 'free_premium'` bypass all Stripe-related checks
- The `hasActiveAccess()` function returns `true` immediately for free premium users
- No Stripe customer ID or subscription ID is required
- Users get unlimited access to all premium features
- The plan can be assigned/revoked via direct database updates

## Notes

- This plan type is intended for internal testing and feedback collection
- Free premium users will not appear in Stripe billing
- The plan does not expire (current_period_end set to far future)
- Consider adding a comment in your code explaining this is for internal testing

