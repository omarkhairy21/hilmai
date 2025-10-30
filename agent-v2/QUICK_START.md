# HilmAI Agent V2 - Quick Start Guide

**Get started with agent-v2 in 5 minutes**

---

## Prerequisites

- [x] Node.js 18+ installed
- [x] Yarn 1.22+ installed
- [x] Supabase account (free tier works)
- [x] Turso account (free tier works)
- [x] OpenAI API key
- [x] Telegram bot token

---

## Step 1: Install Dependencies

```bash
cd agent-v2
yarn install
```

**Expected output:** ✅ Dependencies installed successfully

---

## Step 2: Setup Database

### A. Supabase Setup

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Open your project → SQL Editor
3. Copy contents of `agent-v2/supabase/schema.sql`
4. Paste and click "RUN"

**What this does:**
- Enables pgvector extension
- Creates `transactions` table with vector columns
- Creates `merchant_embeddings_cache` table
- Creates indexes for performance
- Creates `search_transactions_hybrid()` function

**Expected output:** ✅ Success (no errors)

### B. Get Supabase Credentials

1. Project Settings → API
2. Copy:
   - `URL` (e.g., `https://xxx.supabase.co`)
   - `anon/public` key (starts with `eyJ...`)

---

## Step 3: Setup Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit .env with your values:
nano .env  # or use your editor
```

**Required variables:**

```bash
# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz  # From @BotFather

# OpenAI
OPENAI_API_KEY=sk-proj-...  # From platform.openai.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co  # From Step 2B
SUPABASE_KEY=eyJhbG...  # From Step 2B (anon key)

# Turso (LibSQL for caching)
LIBSQL_URL=libsql://xxx.turso.io  # From turso.tech
LIBSQL_AUTH_TOKEN=eyJhbG...  # From Turso dashboard

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

**Get Turso credentials:**
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create hilm-cache

# Get URL
turso db show hilm-cache --url

# Get token
turso db tokens create hilm-cache
```

---

## Step 4: Build

```bash
yarn build
```

**Expected output:**
```
✓ Build successful
✓ You can now deploy the .mastra/output directory
```

---

## Step 5: Verify Installation

### A. Check Structure

```bash
ls -la src/lib/
# Should see: embeddings.ts, prompt-cache.ts, input-normalization.ts, etc.

ls -la src/mastra/agents/
# Should see: supervisor-agent.ts, transaction-logger-agent.ts, etc.

ls -la src/mastra/tools/
# Should see: save-transaction-tool.ts, hybrid-query-tool.ts, etc.
```

### B. Check Database

In Supabase SQL Editor:

```sql
-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Should return 1 row

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
-- Should return: transactions, merchant_embeddings_cache

-- Check RPC function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'search_transactions_hybrid';
-- Should return 1 row
```

---

## Step 6: Test (Coming in Phase 4)

```bash
# Development mode (with hot reload)
yarn dev

# Test in Telegram
# Send: "Hi"
# Send: "I spent 50 AED at Carrefour"
# Send: "How much did I spend?"
```

**Note:** Bot integration is Phase 4 (not yet complete)

---

## What We Have So Far

✅ **Phase 1: Foundation** - Database schema ready
✅ **Phase 2: Core Libraries** - Embeddings, caching, input processing
✅ **Phase 3: Agents & Tools** - 4 agents, 5 tools, supervisor pattern

🚧 **Phase 4: Bot Integration** - In progress
🚧 **Phase 5: Testing** - Coming soon

---

## Project Structure

```
agent-v2/
├── src/
│   ├── lib/                    # Core libraries
│   │   ├── embeddings.ts       # OpenAI + pgvector
│   │   ├── prompt-cache.ts     # Response cache
│   │   └── input-normalization.ts  # Text/voice/photo
│   │
│   └── mastra/
│       ├── agents/             # AI agents
│       │   ├── supervisor-agent.ts
│       │   ├── transaction-logger-agent.ts
│       │   ├── query-executor-agent.ts
│       │   └── conversation-agent.ts
│       │
│       ├── tools/              # Agent tools
│       │   ├── save-transaction-tool.ts
│       │   ├── hybrid-query-tool.ts
│       │   └── ...
│       │
│       └── index.ts            # Mastra config
│
├── supabase/
│   └── schema.sql              # Database setup
│
├── .env                         # Your credentials
└── package.json
```

---

## Common Issues

### Issue: "pgvector extension not found"

**Solution:**
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "OPENAI_API_KEY not found"

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Check content
cat .env | grep OPENAI

# Should show: OPENAI_API_KEY=sk-...
```

### Issue: "Build fails with type errors"

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules .mastra yarn.lock
yarn install
yarn build
```

### Issue: "Supabase connection failed"

**Solution:**
```bash
# Test credentials
curl https://YOUR_SUPABASE_URL/rest/v1/ \
  -H "apikey: YOUR_SUPABASE_KEY"

# Should return API info (not error)
```

---

## Next Steps

1. **Read the docs:**
   - [README.md](./README.md) - Project overview
   - [ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md) - Architecture details
   - [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) - Progress

2. **Understand the flow:**
   - [FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md) - Visual diagrams

3. **Start Phase 4:**
   - Implement bot integration
   - Test with real Telegram messages

---

## Getting Help

- **Project docs:** Check markdown files in `agent-v2/`
- **Main guide:** [CLAUDE.md](../CLAUDE.md)
- **Architecture:** [ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md)

---

## Quick Test Checklist

- [ ] Dependencies installed (`yarn install`)
- [ ] Database schema created (run `schema.sql`)
- [ ] Environment variables set (`.env` file)
- [ ] Build passes (`yarn build`)
- [ ] Supabase tables exist (check in dashboard)
- [ ] pgvector enabled (check with SQL)

**All checked?** ✅ You're ready for Phase 4!

---

**Version:** 1.0
**Last Updated:** October 29, 2025
