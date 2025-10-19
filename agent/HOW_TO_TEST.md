# How to Test Phase 3 Changes

## Quick Start (5 minutes)

### 1. Run Quick Test Script

```bash
cd /Users/omar/Desktop/hilm.ai/agent
npx tsx --env-file=.env quick-test.ts
```

This will verify:
- ✅ Environment variables are set
- ✅ Embedding generation works
- ✅ Pinecone connection works
- ✅ Dimensions are correct (3072)

**Expected output:**
```
🧪 Phase 3 Quick Test Suite
==================================================

📋 Test 1: Environment Variables
   OPENAI_API_KEY: ✅ Set
   PINECONE_API_KEY: ✅ Set
   PINECONE_INDEX: ✅ Set (hilm-transactions)

📝 Test 2: Format Transaction Text
   Output: "25.5 USD at Starbucks for dining on 2025-01-15 Morning coffee"
   ✅ Formatting works

🔢 Test 3: Generate Embedding
   ✅ Embedding generated in 234ms
   Dimensions: 3072 (expected: 3072)
   ✅ Correct dimensions

📡 Test 4: Pinecone Connection
   ✅ Connected to Pinecone index: hilm-transactions
   Total vectors: 0
   Dimension: 3072

🎉 Quick Test Complete!
```

### 2. Setup Pinecone (if not done)

If Test 4 fails, you need to:
1. Go to https://www.pinecone.io/ and sign up
2. Create index: `hilm-transactions`, dimension: `3072`, metric: `cosine`
3. Copy API key
4. Add to `.env`:
   ```bash
   PINECONE_API_KEY=pc-xxxxx
   PINECONE_INDEX=hilm-transactions
   ```

### 3. Run SQL Migration

Copy the contents of `add_embeddings.sql` and run in Supabase SQL Editor:
- Go to your Supabase project → SQL Editor
- Paste the SQL
- Click "Run"

### 4. Test with Real Transaction

Start the bot:
```bash
npm run bot:dev
```

Send a message to your Telegram bot:
```
Spent $5 on coffee at Starbucks
```

**Watch the logs for:**
```
✅ Embedding generated (3072 dimensions)
✅ Transaction saved with embedding
✅ Upserted to Pinecone
```

### 5. Verify in Database

In Supabase SQL Editor:
```sql
SELECT merchant, category, amount,
       CASE WHEN embedding IS NOT NULL THEN 'Has Embedding ✅' ELSE 'No Embedding ❌' END
FROM transactions
ORDER BY created_at DESC
LIMIT 5;
```

## Troubleshooting

### "Pinecone connection failed"
➡️ Check `PINECONE_API_KEY` in `.env`
➡️ Create index at pinecone.io

### "Wrong dimensions"
➡️ Recreate Pinecone index with dimension=3072

### "OpenAI API error"
➡️ Check `OPENAI_API_KEY` is valid
➡️ Check OpenAI account has credits

### "pgvector extension not found"
➡️ Run SQL migration in Supabase

## Full Testing Guide

For comprehensive testing scenarios, see:
- **[TESTING_PHASE3.md](TESTING_PHASE3.md)** - Detailed test cases
- **[SETUP_PHASE3.md](SETUP_PHASE3.md)** - Complete setup guide
- **[PHASE_3_COMPLETED.md](PHASE_3_COMPLETED.md)** - Technical docs

## What's Working Now

✅ **Transaction saving** now generates embeddings automatically
✅ **Embeddings stored** in both Supabase and Pinecone
✅ **Search tool** ready for semantic search (Phase 6)

## Next Phase

Phase 6: Query Agent - Enable natural language questions like:
- "How much did I spend on coffee this month?"
- "Show my grocery purchases"
- "What was my biggest expense?"
