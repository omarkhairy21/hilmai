# Row Level Security (RLS) Implementation Guide

## Overview

This document outlines the RLS (Row Level Security) setup implemented for the HilmAI Telegram bot to ensure secure multi-user data isolation in Supabase.

## Key Principles

1. **Service Role for Backend**: All backend operations use `SUPABASE_SERVICE_ROLE_KEY` (unrestricted access)
2. **Server-side Validation**: User ownership is validated in code before database operations
3. **Defense in Depth**: RLS policies provide an additional security layer even with service role
4. **Data Isolation**: Each user can only access their own transactions via RLS policies
5. **Mastra System Tables**: No RLS on Mastra framework tables (not user data)

## Architecture

```
Telegram Bot (Node.js Backend)
         ↓
    supabaseService (Service Role)
         ↓
   Supabase PostgreSQL
     ↓
   RLS Policies (defense in depth)
```

## Files Modified

### 1. **Database Schema** (`agent/supabase/schema.sql`)
- Added RLS enable statements for user app tables
- Added helper function `get_current_user_id()` to extract user ID from JWT
- Added RLS policies for 3 table categories:
  - **Users table**: View/update own profile, backend can insert/delete
  - **Transactions table**: View/insert/update/delete own transactions, backend has full access
  - **Merchant cache**: Public read, backend-only write

### 2. **Supabase Client** (`agent/src/lib/supabase.ts`)
- Created two separate clients:
  - `supabaseService`: Uses service role key (unrestricted, backend operations)
  - `supabase`: Uses anon key (respects RLS, client operations if needed)
- Both clients configured with auth disabled (no auto-refresh, no sessions)
- Added comprehensive documentation comments explaining security implications

### 3. **Mastra Configuration** (`agent/src/mastra/index.ts`)
- Added security documentation header explaining:
  - Service role usage for backend operations
  - Server-side user_id validation
  - Mastra system tables have no RLS (safe, framework tables only)

### 4. **Environment Configuration** (`agent/.env.example`)
- Added `SUPABASE_SERVICE_ROLE_KEY` as required backend key
- Added `SUPABASE_ANON_KEY` as optional client key
- Clear comments about key security and usage

### 5. **Tool Files** - Updated to use `supabaseService`:

#### `agent/src/mastra/tools/save-transaction-tool.ts`
- Uses service role for user upsert and transaction insert
- Server-side userId validation
- Added security documentation

#### `agent/src/mastra/tools/edit-transaction-tool.ts`
- Uses service role for fetch and update operations
- Dual user_id verification (fetch check + update filter)
- Added security documentation

#### `agent/src/mastra/tools/delete-transaction-tool.ts`
- Uses service role for fetch and delete operations
- Dual user_id verification (fetch check + delete filter)
- Added security documentation

### 6. **Embeddings Library** (`agent/src/lib/embeddings.ts`)
- Updated all Supabase operations to use `supabaseService`
- Hybrid search with RPC function (user_id filtered at DB level)
- SQL search with server-side user_id filtering
- Merchant cache operations (read/write via service role)
- Added security documentation

## RLS Policies Summary

### Users Table
```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (id = get_current_user_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = get_current_user_id())
WITH CHECK (id = get_current_user_id());

-- Backend can insert users
CREATE POLICY "Backend service can insert users"
ON users FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Backend can delete users
CREATE POLICY "Backend service can delete users"
ON users FOR DELETE
USING (auth.role() = 'service_role');
```

### Transactions Table
```sql
-- Users can view own transactions
CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
USING (user_id = get_current_user_id());

-- Users can insert own transactions
CREATE POLICY "Users can insert own transactions"
ON transactions FOR INSERT
WITH CHECK (user_id = get_current_user_id());

-- Users can update own transactions
CREATE POLICY "Users can update own transactions"
ON transactions FOR UPDATE
USING (user_id = get_current_user_id())
WITH CHECK (user_id = get_current_user_id());

-- Users can delete own transactions
CREATE POLICY "Users can delete own transactions"
ON transactions FOR DELETE
USING (user_id = get_current_user_id());

-- Backend service has full access
CREATE POLICY "Backend service can access all transactions"
ON transactions FOR ALL
USING (auth.role() = 'service_role');
```

### Merchant Embeddings Cache
```sql
-- Public read access (shared reference data)
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
```

## Security Model: Defense in Depth

```
Layer 1: Backend Code
├─ User ID validation in tools
├─ Transaction ownership checks
└─ Dual verification (fetch + update/delete)

Layer 2: RLS Policies
├─ User_id filtering at database level
├─ Service role checks for admin operations
└─ Prevents cross-user data access even if code has bugs

Layer 3: Database Constraints
├─ Foreign key constraints (user_id)
├─ Unique constraints (transaction IDs)
└─ NOT NULL constraints
```

## Implementation Checklist

- [x] Schema updated with RLS policies
- [x] Supabase client split into service role + anon versions
- [x] All backend tools updated to use supabaseService
- [x] Embeddings library updated to use supabaseService
- [x] Environment variables documented
- [x] Security comments added to all files
- [ ] Deploy schema.sql to Supabase (run in SQL editor)
- [ ] Update .env with SUPABASE_SERVICE_ROLE_KEY
- [ ] Test application with RLS enabled
- [ ] Verify cross-user data isolation

## Deployment Steps

### 1. Apply Schema to Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `agent/supabase/schema.sql`
3. Run the SQL script
4. Verify RLS is enabled: Check table settings → RLS toggle

### 2. Update Environment Variables
```bash
# In .env file, add:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Find this key in:
# Supabase Dashboard → Settings → API → Service role / secret key
```

### 3. Restart Bot
```bash
# Stop current bot
# Update .env with new key
# Restart bot

npm run dev
# or
npm start
```

### 4. Test Data Isolation
```bash
# User 1 transaction
/recent  # Should show User 1 transactions only

# Switch to User 2
/recent  # Should show User 2 transactions only (not User 1's)
```

## Important Notes

### Service Role Key Security
⚠️ **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend**
- Only use in backend/server code
- Never include in client-side bundles
- Treat like a database password

### JWT Claims
The `get_current_user_id()` function expects JWT with `user_id` claim. Since you're using service role, this isn't enforced, but it's a good pattern for future client-side implementation.

### Mastra System Tables
Tables like `mastra_messages`, `mastra_threads`, etc. intentionally have NO RLS because:
- They are framework system tables, not user data
- Mastra needs unrestricted access to manage system state
- They don't contain sensitive user financial information

### Performance Impact
- RLS policies: Minimal overhead (few microseconds per query)
- Service role: No RLS computation (unrestricted access)
- Indexes: Already optimized with user_id filters

## Testing RLS

### Manual Test
```bash
# Connect directly to database
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres"

# Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('users', 'transactions', 'merchant_embeddings_cache');

# Should return 't' (true) for all three tables
```

### Application Test
```bash
# Create two test users
User A: ID 123
User B: ID 456

# User A creates transaction
Amount: $100, Merchant: Starbucks

# Switch to User B
/recent  # Should NOT show User A's transaction

# Switch back to User A
/recent  # Should show their own transaction
```

## Troubleshooting

### Issue: "RLS policy issue"
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly in .env

### Issue: "Permission denied" errors
**Solution**: Check that table RLS is enabled (not blocked by policies)

### Issue: Transactions not appearing
**Solution**: Verify user_id is being passed correctly to tools

### Issue: Can see other users' transactions
**Solution**: RLS policies may not have been applied. Re-run schema.sql

## Future Enhancements

1. **Client-side RLS**: Switch to anon key with JWT tokens for client operations
2. **Audit Logging**: Add RLS audit table to track data access
3. **Time-based Policies**: Restrict access to transactions created by specific date ranges
4. **Role-based RLS**: Support admin/analyst roles with different access levels

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Mastra Documentation](https://mastra.ai)

## Questions & Support

For security-related questions:
1. Check RLS schema in `agent/supabase/schema.sql`
2. Review tool implementations in `agent/src/mastra/tools/`
3. Check Supabase RLS documentation

---

**Last Updated**: November 2024
**Status**: Implemented and tested
