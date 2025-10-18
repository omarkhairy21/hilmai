# Supabase Setup Guide

This guide will help you set up Supabase for storing transactions.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Project name:** hilm-ai
   - **Database password:** (create a strong password)
   - **Region:** Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be provisioned (~2 minutes)

## 2. Get API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → Add to `.env` as `SUPABASE_URL`
   - **anon/public key** → Add to `.env` as `SUPABASE_ANON_KEY`

Update your `.env` file:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Create Database Tables

### Option A: Using SQL Editor (Recommended)

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run" or press `Cmd/Ctrl + Enter`

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

## 4. Verify Tables Created

1. Go to **Table Editor** in Supabase dashboard
2. You should see two tables:
   - **users** - Stores Telegram user information
   - **transactions** - Stores transaction records

## 5. Test the Setup

Run the bot and send a transaction:
```bash
npm run bot:dev
```

Send a message in Telegram:
```
I spent $50 on groceries at Walmart
```

Check Supabase:
1. Go to **Table Editor** → **transactions**
2. You should see your transaction record

## Database Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Transactions Table
```sql
transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  telegram_chat_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## Security Notes

- The `anon` key is safe to use in client applications
- Row Level Security (RLS) is enabled on both tables
- Current policies allow all operations (update these for production)
- For production, implement proper authentication and row-level policies

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env` has both `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Restart the bot after updating `.env`

### Tables not created
- Run the schema.sql file in SQL Editor
- Check for error messages in the SQL Editor output

### Transactions not saving
- Check Supabase logs in **Database** → **Logs**
- Verify RLS policies are set correctly
- Check bot console for error messages

## Next Steps

After setup is complete:
1. Test transaction saving
2. View transactions in Supabase Table Editor
3. Implement query features (spending summaries, etc.)
4. Add more advanced features (budgets, analytics, etc.)
