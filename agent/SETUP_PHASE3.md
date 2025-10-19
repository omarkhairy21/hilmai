# Phase 3 Setup Instructions: RAG & Semantic Search

## Prerequisites
- ✅ Supabase account with existing database
- ✅ OpenAI API key (already configured)
- 🆕 Pinecone account (free tier available)

## Step-by-Step Setup

### 1. Create Pinecone Account & Index

1. **Sign up at [Pinecone](https://www.pinecone.io/)**
   - Use free "Starter" tier (sufficient for development)

2. **Create a new index:**
   - Go to "Indexes" → "Create Index"
   - **Index Name:** `hilm-transactions`
   - **Dimensions:** `3072`
   - **Metric:** `cosine`
   - **Pod Type:** `Starter` (free)
   - Click "Create Index"

3. **Get your API key:**
   - Go to "API Keys" in the Pinecone dashboard
   - Copy your API key

### 2. Run SQL Migration in Supabase

1. **Open Supabase SQL Editor:**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run the migration:**
   - Copy the contents of `add_embeddings.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify the migration:**
   ```sql
   -- Check if pgvector is enabled
   SELECT * FROM pg_extension WHERE extname = 'vector';

   -- Check if embedding column exists
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'transactions' AND column_name = 'embedding';

   -- Check if index exists
   SELECT indexname FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'transactions_embedding_idx';
   ```

### 3. Update Environment Variables

Add the following to your `agent/.env` file:

```bash
# Pinecone Configuration (for RAG & Semantic Search)
PINECONE_API_KEY=your_actual_pinecone_api_key_here
PINECONE_INDEX=hilm-transactions
```

Replace `your_actual_pinecone_api_key_here` with your actual Pinecone API key.

### 4. Verify Installation

Check that all dependencies are installed:

```bash
cd agent
npm list @pinecone-database/pinecone
```

Should show: `@pinecone-database/pinecone@3.x.x`

### 5. Test the Implementation

1. **Start the bot:**
   ```bash
   cd agent
   npm run dev
   ```

2. **Send a test transaction:**
   Send a message to your bot: "Spent $5 on coffee at Starbucks"

3. **Check logs for embedding generation:**
   You should see successful embedding generation and Pinecone upsert in the logs.

4. **Verify in Supabase:**
   ```sql
   SELECT id, merchant, category,
          CASE WHEN embedding IS NOT NULL THEN 'Has Embedding' ELSE 'No Embedding' END as embedding_status
   FROM transactions
   ORDER BY created_at DESC
   LIMIT 5;
   ```

5. **Verify in Pinecone:**
   - Go to Pinecone dashboard
   - Check your `hilm-transactions` index
   - Should show vector count increasing

## Troubleshooting

### Issue: "pgvector extension not found"
**Solution:** Run this in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "Pinecone API key invalid"
**Solution:**
- Check that you copied the API key correctly
- Ensure no extra spaces in `.env` file
- Try regenerating the API key in Pinecone dashboard

### Issue: "Embedding column doesn't exist"
**Solution:** Run the migration:
```sql
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS embedding vector(3072);
```

### Issue: "Dimension mismatch"
**Solution:**
- Ensure Pinecone index has 3072 dimensions
- Delete and recreate index if wrong dimensions were set

## What's Next?

With Phase 3 completed, you can now:

1. ✅ Generate embeddings for all transactions automatically
2. ✅ Store vectors in both Supabase and Pinecone
3. ✅ Perform semantic search (ready for Phase 6)

**Next Phase:** Phase 6 - Query Agent
- Create finance-insights-agent
- Add message classifier
- Enable natural language questions like:
  - "How much did I spend on coffee this month?"
  - "Show me my grocery purchases"
  - "What was my biggest expense?"

## Cost Estimates

- **OpenAI Embeddings:** ~$0.13 per 1M tokens (~$0.0001 per transaction)
- **Pinecone Starter:** FREE (up to 100k vectors)
- **Supabase:** FREE tier (sufficient for development)

## Files Created in Phase 3

- ✅ `add_embeddings.sql` - Database migration
- ✅ `src/lib/pinecone.ts` - Pinecone client
- ✅ `src/mastra/rag/embeddings.ts` - Embedding utilities
- ✅ `src/mastra/tools/search-transactions-tool.ts` - Search tool

## Files Modified in Phase 3

- ✅ `src/mastra/tools/save-transaction-tool.ts` - Now generates embeddings
- ✅ `.env` - Added Pinecone configuration

---

**Questions?** Check [PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md) for detailed technical documentation.
