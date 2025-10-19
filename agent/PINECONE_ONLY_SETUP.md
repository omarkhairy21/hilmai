# Pinecone-Only Setup Guide

## Architecture Decision

**We use Pinecone for vector storage only** - no pgvector in Supabase needed!

### Why This Approach?

**Supabase (PostgreSQL):**
- ✅ Stores complete transaction data (amount, merchant, category, date, etc.)
- ✅ Source of truth for all transaction details
- ✅ Fast lookups by ID

**Pinecone:**
- ✅ Stores embeddings (3072-dimensional vectors)
- ✅ Optimized for semantic search
- ✅ Lightweight metadata for filtering
- ✅ Scales to millions of vectors

### Data Flow

```
Transaction Input
     ↓
Generate Embedding (OpenAI)
     ↓
┌────────────────┬────────────────┐
│   Supabase     │   Pinecone     │
│  (Main Data)   │  (Embeddings)  │
├────────────────┼────────────────┤
│ • ID           │ • ID (same)    │
│ • Amount       │ • Embedding    │
│ • Merchant     │ • Metadata:    │
│ • Category     │   - user_id    │
│ • Date         │   - category   │
│ • Description  │   - merchant   │
│ • User ID      │   - date       │
└────────────────┴────────────────┘
```

### Search Flow

```
User Query: "coffee purchases"
     ↓
Generate Query Embedding
     ↓
Search Pinecone (similarity search)
     ↓
Get matching transaction IDs
     ↓
Fetch full details from Supabase
     ↓
Return complete transaction data
```

## Setup Instructions

### 1. Create Pinecone Account

1. Go to [pinecone.io](https://www.pinecone.io/)
2. Sign up (free tier available)
3. Create a new index:
   - **Index Name:** `hilm-transactions`
   - **Dimensions:** `3072`
   - **Metric:** `cosine`
   - **Pod Type:** `Starter` (free)

### 2. Get API Key

1. In Pinecone dashboard, go to "API Keys"
2. Copy your API key

### 3. Update Environment Variables

Add to `/Users/omar/Desktop/hilm.ai/agent/.env`:

```bash
# Pinecone Configuration
PINECONE_API_KEY=pc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PINECONE_INDEX=hilm-transactions
```

### 4. That's It!

No SQL migrations needed! Your Supabase `transactions` table already has all the columns it needs.

## What Gets Stored Where

### Supabase `transactions` Table

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  telegram_chat_id BIGINT,
  amount NUMERIC,
  currency TEXT,
  merchant TEXT,
  category TEXT,
  description TEXT,
  transaction_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**No embedding column needed!**

### Pinecone Index

```typescript
{
  id: "transaction-uuid",
  values: [0.023, -0.015, ...], // 3072 dimensions
  metadata: {
    user_id: "user-uuid",
    telegram_chat_id: 123456789,
    amount: 25.50,
    currency: "USD",
    merchant: "Starbucks",
    category: "dining",
    date: "2025-01-15T10:00:00.000Z",
    description: "Morning coffee"
  }
}
```

## Testing

### Quick Test

```bash
cd /Users/omar/Desktop/hilm.ai/agent
npx tsx --env-file=.env quick-test.ts
```

Should show:
```
✅ Pinecone connection successful
✅ Embedding generation works
Dimension: 3072 ✓
```

### Full Test

1. **Start bot:**
   ```bash
   npm run bot:dev
   ```

2. **Send transaction:**
   "Spent $5 on coffee at Starbucks"

3. **Check logs:**
   ```
   ✅ Embedding stored in Pinecone for transaction abc-123
   ```

4. **Ask question:**
   "How much did I spend on coffee?"

5. **Should work!** 🎉

## Troubleshooting

### "Pinecone connection failed"
- Check `PINECONE_API_KEY` in `.env`
- Ensure no extra spaces around the key
- Verify index name matches exactly: `hilm-transactions`

### "Dimension mismatch"
- Pinecone index must be 3072 dimensions
- Delete and recreate index if wrong

### "No results found"
- Make sure transactions have been saved with embeddings
- Check Pinecone dashboard → Index stats → Vector count

### "Metadata not returned"
- Ensure `includeMetadata: true` in search query (already set in code)

## Performance

- **Embedding generation:** ~200-500ms
- **Pinecone upsert:** ~50-100ms
- **Pinecone search:** ~50-100ms
- **Supabase fetch:** ~20-50ms
- **Total query time:** ~1-2 seconds

## Costs

### Pinecone Free Tier
- ✅ 100,000 vectors
- ✅ 1 index
- ✅ Unlimited queries
- ✅ Perfect for MVP/development

### OpenAI Embeddings
- 💰 $0.00013 per 1K tokens
- ~$0.0001 per transaction
- 10,000 transactions = ~$1

### Supabase
- ✅ Free tier (500MB database)
- ✅ Plenty for transaction storage

## Advantages of This Approach

1. ✅ **Simpler setup** - No pgvector extension needed
2. ✅ **Better performance** - Pinecone optimized for vector search
3. ✅ **Easier scaling** - Pinecone handles millions of vectors
4. ✅ **Separation of concerns** - Transactions in SQL, vectors in Pinecone
5. ✅ **No data duplication** - Embeddings only in one place
6. ✅ **Lower costs** - No extra storage in Supabase

## Migration Notes

If you previously ran `add_embeddings.sql`, you can safely ignore the `embedding` column in Supabase. It won't be used.

To remove it (optional):
```sql
ALTER TABLE transactions DROP COLUMN IF EXISTS embedding;
```

But it's fine to leave it - just won't be populated.

## What Changed

### Before (Dual Storage)
```typescript
// Save to Supabase WITH embedding
await db.from('transactions').insert({
  ...transaction,
  embedding: `[${embedding.join(',')}]`  // ❌ Removed
});

// Also save to Pinecone
await pinecone.upsert([...]);
```

### After (Pinecone Only)
```typescript
// Save to Supabase WITHOUT embedding
await db.from('transactions').insert({
  ...transaction
  // No embedding column ✅
});

// Save embedding to Pinecone only
await pinecone.upsert([{
  id,
  values: embedding,
  metadata: {...}
}]);
```

## Files Modified

1. ✅ `src/mastra/tools/save-transaction-tool.ts` - Removed embedding column
2. ✅ `src/mastra/tools/search-transactions-tool.ts` - Added clarifying comments
3. ✅ `add_embeddings.sql` → Archived (not needed)

## Ready to Use!

Just:
1. ✅ Create Pinecone index
2. ✅ Add API key to `.env`
3. ✅ Start bot
4. ✅ Test with transactions and queries

No database migrations required! 🚀
