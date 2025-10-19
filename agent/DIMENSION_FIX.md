# Dimension Mismatch Fix

## The Error

```
PineconeBadRequestError: Vector dimension 3072 does not match the dimension of the index 1024
```

## Root Cause

Your Pinecone index was created with **1024 dimensions**, but our code was generating embeddings with **3072 dimensions** using OpenAI's `text-embedding-3-large` model.

## The Fix ✅

Updated `src/mastra/rag/embeddings.ts` to specify dimensions:

```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text.trim(),
  encoding_format: 'float',
  dimensions: 1024, // Match your Pinecone index
});
```

## Why This Works

OpenAI's `text-embedding-3-large` model is **flexible** - it can generate embeddings of different sizes:
- Default: 3072 dimensions (highest quality)
- Custom: 1024, 1536, 2048, etc. (smaller, faster, cheaper)

By specifying `dimensions: 1024`, we match your Pinecone index.

## Two Approaches: Direct Pinecone vs Mastra RAG

### Current Approach: Direct Pinecone (What We're Using)

**Pros:**
- ✅ Full control over embedding generation
- ✅ Custom tools (search-transactions-tool)
- ✅ Flexible metadata structure
- ✅ Works with any vector DB

**Cons:**
- ❌ More manual setup
- ❌ We manage Pinecone client ourselves

**Code:**
```typescript
// We directly use Pinecone
import { getTransactionsIndex } from '../../lib/pinecone.js';

const index = getTransactionsIndex();
await index.upsert([{
  id: transactionId,
  values: embedding,
  metadata: {...}
}]);
```

### Alternative: Mastra Built-in RAG (Optional)

Mastra has a built-in RAG system that can handle embeddings and vector storage for you.

**To enable it**, uncomment the RAG config in `src/mastra/index.ts`:

```typescript
export const mastra = new Mastra({
  // ... other config

  rag: {
    vectorStore: {
      provider: 'pinecone',
      config: {
        apiKey: process.env.PINECONE_API_KEY || '',
        indexName: process.env.PINECONE_INDEX || 'hilm-transactions',
      },
    },
    embeddings: {
      provider: 'openai',
      model: 'text-embedding-3-large',
      dimensions: 1024,
    },
  },
});
```

**Then you could use:**
```typescript
// Mastra's built-in RAG methods
await mastra.rag.embed('transaction text');
await mastra.rag.search('query text');
```

**Why we're NOT using it:**
- Our custom tools give us more control
- We need specific metadata structure
- Direct Pinecone access is more flexible
- Can easily switch vector DBs if needed

## Dimension Recommendations

### For Production

**Option 1: 1024 dimensions** (Current)
- ✅ Faster search
- ✅ Lower storage costs
- ✅ Still very good quality
- ❌ Slightly lower accuracy

**Option 2: 1536 dimensions** (Balanced)
- ✅ Better quality than 1024
- ✅ Still faster than 3072
- ⚖️ Medium cost/performance

**Option 3: 3072 dimensions** (Maximum Quality)
- ✅ Best search quality
- ❌ Slower search
- ❌ Higher costs
- ❌ May be overkill for transactions

**Recommendation:** Stick with **1024** for MVP, upgrade if search quality issues arise.

## How to Change Dimensions Later

If you want to switch to different dimensions:

### 1. Delete Pinecone Index
```bash
# In Pinecone dashboard, delete hilm-transactions index
```

### 2. Create New Index
```bash
# Create with new dimension (e.g., 1536)
Dimensions: 1536
```

### 3. Update Code
```typescript
// In src/mastra/rag/embeddings.ts
dimensions: 1536, // Updated
```

### 4. Re-embed Existing Transactions
```typescript
// You'd need to backfill - run a script to:
// 1. Fetch all transactions from Supabase
// 2. Generate new embeddings (1536 dims)
// 3. Upsert to new Pinecone index
```

## Testing the Fix

```bash
# Start bot
npm run bot:dev

# Send transaction
"Spent $5 on coffee at Starbucks"

# Check logs - should see:
✅ Embedding stored in Pinecone for transaction abc-123

# NOT:
❌ Vector dimension 3072 does not match...
```

## Cost Comparison

### 1024 dimensions
- Storage: ~4KB per vector
- Cost: Lower
- Quality: Good (90-95% of max)

### 3072 dimensions
- Storage: ~12KB per vector
- Cost: 3x higher storage
- Quality: Maximum (100%)

### For 10,000 transactions:
- 1024 dims: ~40MB
- 3072 dims: ~120MB

**Verdict:** 1024 is plenty for transaction search!

## Summary

✅ **Fixed:** Updated embeddings to use 1024 dimensions
✅ **Matches:** Your Pinecone index configuration
✅ **Quality:** Still excellent for transaction search
✅ **Cost:** Optimized for production

**No Pinecone index changes needed** - your 1024-dim index is perfect!
