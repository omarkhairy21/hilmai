# Database Migration Guide

This guide explains how to run and manage database migrations in production for HilmAI.

## Overview

Migrations are SQL scripts that modify your database schema. They're stored in `supabase/migrations/` and should be run in order.

## Migration Files

- `001_add_free_premium_plan_tier.sql` - Adds 'free_premium' plan tier option

## Running Migrations in Production

### Method 1: Supabase SQL Editor (Recommended for First Time)

This is the safest method for your first production migration:

1. **Backup Your Database** (Important!)
   - Go to Supabase Dashboard → Database → Backups
   - Create a manual backup before running migrations
   - Or use: `pg_dump` if you have direct PostgreSQL access

2. **Open Supabase SQL Editor**
   - Go to Supabase Dashboard → SQL Editor
   - Click "New query"

3. **Run the Migration**
   - Open `supabase/migrations/001_add_free_premium_plan_tier.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)

4. **Verify the Migration**
   ```sql
   -- Check that the constraint was updated
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'users_plan_tier_check';
   
   -- Should show: CHECK (plan_tier IN ('monthly', 'annual', 'free_premium'))
   ```

5. **Test the Migration**
   ```sql
   -- Try inserting a test value (will fail if constraint is wrong)
   -- Don't commit this, just verify it works
   BEGIN;
   UPDATE users SET plan_tier = 'free_premium' WHERE id = -1; -- Non-existent user
   ROLLBACK; -- Rollback the test
   ```

### Method 2: Supabase CLI (Recommended for Future Migrations)

The Supabase CLI provides a more automated and trackable way to run migrations. It's especially useful when you have multiple migrations or want to version control your database changes.

#### Prerequisites

1. **Install Supabase CLI**
   ```bash
   # Using npm
   npm install -g supabase
   
   # Or using Homebrew (Mac)
   brew install supabase/tap/supabase
   
   # Or using Scoop (Windows)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

2. **Verify Installation**
   ```bash
   supabase --version
   # Should show: supabase version X.X.X
   ```

3. **Login to Supabase**
   ```bash
   supabase login
   # This will open your browser to authenticate
   # After login, you'll be authenticated in the CLI
   ```

#### Initial Setup (One-Time)

1. **Initialize Supabase in Your Project** (if not already done)
   ```bash
   cd agent
   supabase init
   ```
   
   This creates a `supabase` folder structure (if it doesn't exist) with:
   - `config.toml` - Project configuration
   - `migrations/` - Your migration files (already exists)

2. **Link to Your Production Project**
   ```bash
   # Get your project reference ID from:
   # Supabase Dashboard → Settings → General → Reference ID
   
   supabase link --project-ref your-project-ref-here
   ```
   
   Example:
   ```bash
   supabase link --project-ref abcdefghijklmnop
   ```
   
   This creates a `.supabase` folder with your project configuration.

3. **Verify Connection**
   ```bash
   supabase projects list
   # Should show your linked project
   ```

#### Running Migrations with CLI

1. **Check Migration Status**
   ```bash
   # See which migrations are applied vs pending
   supabase migration list
   ```

2. **Push Migrations to Production**
   ```bash
   # Push all pending migrations
   supabase db push
   
   # Or push a specific migration file
   supabase db push --file migrations/001_add_free_premium_plan_tier.sql
   ```

3. **Verify Migration Applied**
   ```bash
   # Check migration status again
   supabase migration list
   
   # Or verify directly in database
   supabase db remote exec "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_plan_tier_check';"
   ```

#### CLI Workflow for Future Migrations

When you create new migrations in the future:

1. **Create a New Migration File**
   ```bash
   # Generate a new migration file with timestamp
   supabase migration new add_new_feature
   # Creates: migrations/YYYYMMDDHHMMSS_add_new_feature.sql
   ```

2. **Edit the Migration File**
   ```bash
   # Open the generated file and add your SQL
   code supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql
   ```

3. **Test Locally First** (Optional but Recommended)
   ```bash
   # Start local Supabase instance
   supabase start
   
   # Apply migrations locally
   supabase db reset
   
   # Test your changes
   # ...
   
   # Stop local instance when done
   supabase stop
   ```

4. **Push to Production**
   ```bash
   # Push to production
   supabase db push
   ```

#### CLI Advantages

- ✅ **Automatic Tracking**: CLI tracks which migrations have been applied
- ✅ **Version Control**: Migration files are tracked in git
- ✅ **Rollback Support**: Can rollback migrations if needed
- ✅ **Team Collaboration**: Multiple developers can work on migrations
- ✅ **Local Testing**: Test migrations locally before production
- ✅ **Migration History**: See full history of applied migrations

#### CLI Troubleshooting

**Error: "Project not linked"**
```bash
# Re-link your project
supabase link --project-ref your-project-ref
```

**Error: "Migration already applied"**
```bash
# Check migration status
supabase migration list

# If migration shows as applied but you need to re-run:
# You'll need to manually mark it as not applied in Supabase dashboard
# Or use SQL Editor to run it directly
```

**Error: "Authentication failed"**
```bash
# Re-authenticate
supabase login
```

**View Migration History**
```bash
# See all migrations and their status
supabase migration list

# Or check in Supabase dashboard:
# Database → Migrations
```

#### CLI vs SQL Editor Comparison

| Feature | SQL Editor | Supabase CLI |
|---------|-----------|--------------|
| **Ease of Use** | ⭐⭐⭐⭐⭐ Very Easy | ⭐⭐⭐⭐ Easy (after setup) |
| **Migration Tracking** | Manual | Automatic |
| **Version Control** | Manual | Built-in |
| **Rollback** | Manual SQL | `supabase migration repair` |
| **Team Collaboration** | Difficult | Easy |
| **Local Testing** | No | Yes (`supabase start`) |
| **Best For** | One-off changes | Ongoing development |

#### Recommendation

- **First Migration (Now)**: Use SQL Editor (Method 1) - it's simpler and you have direct control
- **Future Migrations**: Consider switching to CLI (Method 2) for better tracking and collaboration

You can mix both methods, but CLI provides better long-term management.

## Migration Tracking

### Current Approach: Manual Tracking

Since you're running migrations manually, track them in a simple way:

1. **Create a Migration Log Table** (Optional but Recommended)
   ```sql
   -- Run this once to create a migration tracking table
   CREATE TABLE IF NOT EXISTS schema_migrations (
     version VARCHAR(255) PRIMARY KEY,
     applied_at TIMESTAMPTZ DEFAULT NOW(),
     description TEXT
   );
   ```

2. **Update After Each Migration**
   ```sql
   -- After running 001_add_free_premium_plan_tier.sql
   INSERT INTO schema_migrations (version, description)
   VALUES ('001_add_free_premium_plan_tier', 'Add free_premium plan tier option')
   ON CONFLICT (version) DO NOTHING;
   ```

3. **Check Applied Migrations**
   ```sql
   SELECT * FROM schema_migrations ORDER BY applied_at;
   ```

### Alternative: Simple Checklist

If you prefer not to create a tracking table, just keep a checklist:

- [x] `001_add_free_premium_plan_tier.sql` - Applied on [DATE]

## Best Practices

### 1. Always Backup First
```bash
# Create a backup before running migrations
# Supabase Dashboard → Database → Backups → Create Backup
```

### 2. Test in Development First
- Run migrations on a development/staging database first
- Verify everything works before running in production

### 3. Run During Low Traffic
- Schedule migrations during off-peak hours
- This migration is safe (just adds a constraint option), but good practice

### 4. Verify After Running
```sql
-- Verify constraint exists
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_plan_tier_check';

-- Verify you can use the new value
SELECT plan_tier FROM users WHERE plan_tier = 'free_premium';
```

### 5. Document Changes
- Update this guide when adding new migrations
- Note any breaking changes or required downtime

## Rollback Strategy

If something goes wrong, here's how to rollback:

### Rollback Migration 001
```sql
-- Revert to original constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_tier_check;
ALTER TABLE users ADD CONSTRAINT users_plan_tier_check 
  CHECK (plan_tier IN ('monthly', 'annual'));

-- Remove any free_premium users (if needed)
UPDATE users 
SET plan_tier = NULL, subscription_status = 'free'
WHERE plan_tier = 'free_premium';
```

### Using Database Backup
1. Go to Supabase Dashboard → Database → Backups
2. Restore from the backup you created before migration
3. **Warning:** This will lose all data created after the backup

## Migration Checklist

Before running a migration in production:

- [ ] Backup database created
- [ ] Migration tested in development/staging
- [ ] Migration file reviewed and understood
- [ ] Team notified (if applicable)
- [ ] Low traffic window scheduled
- [ ] Rollback plan prepared
- [ ] Verification queries ready

After running migration:

- [ ] Migration executed successfully
- [ ] Verification queries passed
- [ ] Application tested (if needed)
- [ ] Migration logged/tracked
- [ ] Team notified of completion

## Current Migrations

| Version | File | Description | Status |
|---------|------|-------------|--------|
| 001 | `001_add_free_premium_plan_tier.sql` | Add 'free_premium' plan tier option | ⏳ Pending |

## Troubleshooting

### Error: "constraint already exists"
```sql
-- The constraint name might be different, check first:
SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass;

-- Then drop the correct constraint:
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_tier_check;
-- Then run the migration again
```

### Error: "relation does not exist"
- Make sure you're connected to the correct database
- Check that the `users` table exists: `SELECT * FROM users LIMIT 1;`

### Error: "permission denied"
- Make sure you're using the service role key or have admin access
- Check your Supabase project permissions

## Next Steps

After running this migration:

1. ✅ Verify constraint was updated
2. ✅ Grant free_premium access to test users (see `FREE_PREMIUM_PLAN.md`)
3. ✅ Test that free_premium users have access
4. ✅ Monitor application logs for any issues

## Questions?

- Check Supabase documentation: https://supabase.com/docs/guides/database
- Review migration file comments for specific details
- Test in development first if unsure


