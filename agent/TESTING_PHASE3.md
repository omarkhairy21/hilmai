# Testing Phase 3: RAG & Semantic Search

## Prerequisites Checklist

Before testing, ensure you've completed the setup:

- [ ] Pinecone account created
- [ ] Pinecone index `hilm-transactions` created (3072 dimensions, cosine metric)
- [ ] Pinecone API key added to `.env`
- [ ] SQL migration run in Supabase (`add_embeddings.sql`)
- [ ] pgvector extension enabled
- [ ] Bot dependencies installed (`npm install`)

## Quick Setup Verification

### 1. Check Environment Variables

```bash
cd /Users/omar/Desktop/hilm.ai/agent
cat .env | grep PINECONE
```

Should show:
```
PINECONE_API_KEY=pc-xxxxx...
PINECONE_INDEX=hilm-transactions
```

### 2. Verify Supabase Migration

Run this in Supabase SQL Editor:

```sql
-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check embedding column exists
SELECT column_name, udt_name, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'embedding';

-- Should show: embedding | vector | null
```

### 3. Verify Pinecone Index

```bash
# Test Pinecone connection with Node.js
node -e "
const { Pinecone } = require('@pinecone-database/pinecone');
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
pc.index(process.env.PINECONE_INDEX || 'hilm-transactions')
  .describeIndexStats()
  .then(stats => console.log('✅ Pinecone connected:', stats))
  .catch(err => console.error('❌ Pinecone error:', err.message));
"
```

## Testing Strategy

### Test 1: Embedding Generation (Unit Test)

Create a test file to verify embedding generation works:

```bash
# Create test file
cat > /Users/omar/Desktop/hilm.ai/agent/test-embeddings.ts << 'EOF'
import { generateEmbedding, formatTransactionForEmbedding } from './src/mastra/rag/embeddings.js';

async function testEmbeddings() {
  console.log('🧪 Testing embedding generation...\n');

  // Test 1: Format transaction
  const transaction = {
    amount: 25.50,
    currency: 'USD',
    merchant: 'Starbucks',
    category: 'dining',
    date: '2025-01-15',
    description: 'Morning coffee',
  };

  const formatted = formatTransactionForEmbedding(transaction);
  console.log('✅ Formatted text:', formatted);
  console.log('   Expected: "25.5 USD at Starbucks for dining on 2025-01-15 Morning coffee"\n');

  // Test 2: Generate embedding
  try {
    const embedding = await generateEmbedding(formatted);
    console.log('✅ Embedding generated successfully');
    console.log('   Dimensions:', embedding.length);
    console.log('   Expected: 3072');
    console.log('   First 5 values:', embedding.slice(0, 5));
    console.log('   Type:', typeof embedding[0]);
    console.log('\n🎉 All tests passed!\n');
  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
  }
}

testEmbeddings();
EOF

# Run test
npx tsx --env-file=.env test-embeddings.ts
```

**Expected Output:**
```
🧪 Testing embedding generation...

✅ Formatted text: 25.5 USD at Starbucks for dining on 2025-01-15 Morning coffee
   Expected: "25.5 USD at Starbucks for dining on 2025-01-15 Morning coffee"

✅ Embedding generated successfully
   Dimensions: 3072
   Expected: 3072
   First 5 values: [ 0.0234, -0.0156, 0.0423, -0.0089, 0.0312 ]
   Type: number

🎉 All tests passed!
```

### Test 2: Full Transaction Flow (Integration Test)

Start the bot and send a test transaction:

```bash
# Terminal 1: Start the bot
cd /Users/omar/Desktop/hilm.ai/agent
npm run bot:dev
```

```bash
# Terminal 2: Monitor logs
# Watch for embedding generation messages
```

**Actions in Telegram:**
1. Open your bot in Telegram
2. Send: `Spent $5 on coffee at Starbucks`
3. Wait for bot response

**Check Bot Logs - Should See:**
```
Generating embedding for: "5 USD at Starbucks for dining on 2025-01-15"
✅ Embedding generated (3072 dimensions)
✅ Transaction saved to Supabase with embedding
✅ Embedding upserted to Pinecone
```

### Test 3: Verify Database Storage

After sending a transaction, check Supabase:

```sql
-- Get latest transaction with embedding info
SELECT
  id,
  merchant,
  category,
  amount,
  currency,
  CASE
    WHEN embedding IS NOT NULL THEN '✅ Has embedding'
    ELSE '❌ No embedding'
  END as embedding_status,
  created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
| id | merchant | category | amount | currency | embedding_status | created_at |
|----|----------|----------|--------|----------|------------------|------------|
| uuid-123 | Starbucks | dining | 5.00 | USD | ✅ Has embedding | 2025-01-15... |

### Test 4: Verify Pinecone Storage

Check Pinecone dashboard:
1. Go to https://app.pinecone.io
2. Navigate to your `hilm-transactions` index
3. Check "Vectors" count - should increase after each transaction
4. Click "Query" tab and try a test query

Or programmatically:

```bash
node -e "
const { Pinecone } = require('@pinecone-database/pinecone');
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

(async () => {
  const index = pc.index('hilm-transactions');
  const stats = await index.describeIndexStats();
  console.log('📊 Pinecone Index Stats:');
  console.log('   Total vectors:', stats.totalRecordCount);
  console.log('   Dimensions:', stats.dimension);
  console.log('   Namespaces:', Object.keys(stats.namespaces || {}));
})();
"
```

### Test 5: Semantic Search Tool (Direct Test)

Create a test file to verify search works:

```bash
cat > /Users/omar/Desktop/hilm.ai/agent/test-search.ts << 'EOF'
import { searchTransactionsTool } from './src/mastra/tools/search-transactions-tool.js';

async function testSearch() {
  console.log('🔍 Testing semantic search...\n');

  // First, get a user_id from your database
  // You'll need to replace this with an actual user_id
  const testUserId = 'YOUR_USER_ID_HERE'; // Get this from Supabase

  const result = await searchTransactionsTool.execute({
    context: {
      userId: testUserId,
      query: 'coffee purchases',
      topK: 5,
      minSimilarity: 0.7,
    },
  });

  console.log('Search Results:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success && result.count > 0) {
    console.log('\n✅ Search successful!');
    console.log(`   Found ${result.count} transactions`);
    result.results.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.merchant} - $${tx.amount} (similarity: ${tx.similarity.toFixed(3)})`);
    });
  } else {
    console.log('\n⚠️  No results found');
    console.log('   Make sure you have transactions with embeddings in the database');
  }
}

testSearch();
EOF
```

**To get your user_id:**
```sql
SELECT id, telegram_chat_id, first_name FROM users LIMIT 1;
```

Then run:
```bash
npx tsx --env-file=.env test-search.ts
```

**Expected Output:**
```
🔍 Testing semantic search...

Search Results:
{
  "success": true,
  "results": [
    {
      "id": "uuid-123",
      "amount": 5,
      "currency": "USD",
      "merchant": "Starbucks",
      "category": "dining",
      "date": "2025-01-15T10:00:00.000Z",
      "description": null,
      "similarity": 0.89
    }
  ],
  "count": 1,
  "message": "Found 1 matching transaction."
}

✅ Search successful!
   Found 1 transactions
   1. Starbucks - $5 (similarity: 0.890)
```

## Complete End-to-End Test

### Scenario: Send multiple transactions and search

1. **Send 5 different transactions:**
   - "Spent $5 at Starbucks on coffee"
   - "Paid $50 at Whole Foods for groceries"
   - "Bought $200 laptop at Apple Store"
   - "Spent $15 at McDonald's for lunch"
   - "Paid $3 for coffee at local cafe"

2. **Wait for all to process** (check logs for "✅ Embedding upserted to Pinecone")

3. **Verify in Pinecone:**
   ```bash
   # Should show 5+ vectors
   ```

4. **Test semantic search:**
   - Modify `test-search.ts` with different queries:
     - "coffee purchases" → Should find Starbucks + local cafe
     - "groceries" → Should find Whole Foods
     - "expensive purchases" → Should find laptop
     - "food" → Should find McDonald's, groceries

## Troubleshooting

### Issue: No embedding generated

**Check logs for:**
```
Error generating embedding: ...
```

**Solutions:**
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI API quota
- Test embedding generation with unit test

### Issue: Pinecone upsert fails

**Check logs for:**
```
Failed to store in Pinecone: ...
```

**Solutions:**
- Verify `PINECONE_API_KEY` is correct
- Check index name matches `PINECONE_INDEX` in `.env`
- Verify index dimension is 3072
- Check Pinecone dashboard for quota limits

### Issue: Search returns no results

**Possible causes:**
1. No transactions with embeddings yet
2. User_id filter is too strict
3. Similarity threshold too high

**Solutions:**
```sql
-- Check if transactions have embeddings
SELECT COUNT(*) as total,
       COUNT(embedding) as with_embeddings
FROM transactions;

-- Lower similarity threshold in search
minSimilarity: 0.5  // instead of 0.7
```

### Issue: Search returns irrelevant results

**Solutions:**
- Increase `minSimilarity` to 0.8 or 0.85
- Check if embeddings were generated correctly
- Verify query text is descriptive enough

## Performance Testing

### Measure embedding generation time:

```bash
node -e "
const { generateEmbedding } = require('./dist/mastra/rag/embeddings.js');

(async () => {
  const start = Date.now();
  await generateEmbedding('Test transaction text');
  const duration = Date.now() - start;
  console.log('Embedding generation time:', duration + 'ms');
  console.log('Expected: 200-500ms');
})();
"
```

### Measure search performance:

Add timing to `test-search.ts`:
```typescript
const start = Date.now();
const result = await searchTransactionsTool.execute({...});
const duration = Date.now() - start;
console.log('Search duration:', duration + 'ms');
```

**Expected:** <100ms for typical queries

## Success Criteria

✅ **All tests should pass:**
- [ ] Embedding generation works (3072 dimensions)
- [ ] Transactions saved with embeddings
- [ ] Pinecone receives vectors
- [ ] Search returns relevant results
- [ ] User_id filtering works
- [ ] Similarity scores are reasonable (0.7-1.0 for good matches)

## Next Steps

Once all tests pass:
1. Clean up test files (`rm test-*.ts`)
2. Move to **Phase 6: Query Agent** to enable natural language Q&A
3. Consider backfilling embeddings for existing transactions

## Cleanup After Testing

```bash
# Remove test files
rm /Users/omar/Desktop/hilm.ai/agent/test-embeddings.ts
rm /Users/omar/Desktop/hilm.ai/agent/test-search.ts

# Optional: Clear test data from Pinecone
# (Do this only if you want to start fresh)
```

---

**Questions?** Check [PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md) for more details.
