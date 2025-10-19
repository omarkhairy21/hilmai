/**
 * Quick Test Script for Phase 3: RAG & Semantic Search
 * Run: npx tsx --env-file=.env quick-test.ts
 */

import { generateEmbedding, formatTransactionForEmbedding } from './src/mastra/rag/embeddings.js';
import { Pinecone } from '@pinecone-database/pinecone';

async function runQuickTests() {
  console.log('🧪 Phase 3 Quick Test Suite\n');
  console.log('=' .repeat(50));

  // Test 1: Environment Variables
  console.log('\n📋 Test 1: Environment Variables');
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasPinecone = !!process.env.PINECONE_API_KEY;
  const hasPineconeIndex = !!process.env.PINECONE_INDEX;

  console.log(`   OPENAI_API_KEY: ${hasOpenAI ? '✅ Set' : '❌ Missing'}`);
  console.log(`   PINECONE_API_KEY: ${hasPinecone ? '✅ Set' : '❌ Missing'}`);
  console.log(`   PINECONE_INDEX: ${hasPineconeIndex ? '✅ Set (' + process.env.PINECONE_INDEX + ')' : '❌ Missing'}`);

  if (!hasOpenAI || !hasPinecone || !hasPineconeIndex) {
    console.log('\n❌ Missing environment variables. Please check your .env file.');
    process.exit(1);
  }

  // Test 2: Format Transaction
  console.log('\n📝 Test 2: Format Transaction Text');
  const transaction = {
    amount: 25.50,
    currency: 'USD',
    merchant: 'Starbucks',
    category: 'dining',
    date: '2025-01-15',
    description: 'Morning coffee',
  };

  const formatted = formatTransactionForEmbedding(transaction);
  console.log(`   Input: ${JSON.stringify(transaction)}`);
  console.log(`   Output: "${formatted}"`);
  console.log('   ✅ Formatting works');

  // Test 3: Generate Embedding
  console.log('\n🔢 Test 3: Generate Embedding');
  try {
    const start = Date.now();
    const embedding = await generateEmbedding(formatted);
    const duration = Date.now() - start;

    console.log(`   ✅ Embedding generated in ${duration}ms`);
    console.log(`   Dimensions: ${embedding.length} (expected: 3072)`);
    console.log(`   Type: ${typeof embedding[0]}`);
    console.log(`   Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

    if (embedding.length !== 3072) {
      console.log('   ❌ Wrong dimensions! Expected 3072');
    } else {
      console.log('   ✅ Correct dimensions');
    }
  } catch (error) {
    console.log(`   ❌ Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Test 4: Pinecone Connection
  console.log('\n📡 Test 4: Pinecone Connection');
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const indexName = process.env.PINECONE_INDEX || 'hilm-transactions';
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();

    console.log(`   ✅ Connected to Pinecone index: ${indexName}`);
    console.log(`   Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   Dimension: ${stats.dimension || 'N/A'}`);

    if (stats.dimension !== 3072) {
      console.log(`   ⚠️  Warning: Index dimension is ${stats.dimension}, expected 3072`);
      console.log('   You may need to recreate your Pinecone index with dimension=3072');
    }
  } catch (error) {
    console.log(`   ❌ Pinecone connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('   Please check your PINECONE_API_KEY and index name');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Quick Test Complete!\n');
  console.log('Next steps:');
  console.log('1. Run SQL migration in Supabase (see add_embeddings.sql)');
  console.log('2. Start bot: npm run bot:dev');
  console.log('3. Send test transaction to your Telegram bot');
  console.log('4. Check logs for embedding generation');
  console.log('\nFor detailed testing: See TESTING_PHASE3.md');
}

runQuickTests().catch(console.error);
