# HilmAI Agent V2 - Complete Architecture Guide

**Date:** October 29, 2025
**Status:** Implementation Ready
**Version:** 2.0

---

## Executive Summary

This document provides a complete architecture redesign for the HilmAI Telegram bot, addressing critical issues with reliability, consistency, conversation memory, and user experience.

### Key Problems in V1

1. **❌ Inconsistent Input Processing**: 3 separate workflows (text/voice/photo) causing inconsistencies
2. **❌ Missing Conversation Memory**: No context between messages
3. **❌ Date Handling Issues**: "yesterday" fails for voice/photo inputs
4. **❌ Generic Responses**: Robotic responses for non-transaction queries
5. **❌ Complex Query Pipeline**: 3-step RAG pipeline (slow, expensive, fragile)

### V2 Solutions

1. **✅ Unified Input Pipeline**: Single workflow for all input types
2. **✅ Conversation Memory**: Persistent context using Mastra's resourceId
3. **✅ Supervisor Agent Pattern**: Hierarchical delegation with native sub-agents
4. **✅ Hybrid Search**: SQL-first with pgvector fallback for fuzzy matching
5. **✅ Natural Responses**: Context-aware, conversational replies
6. **✅ Supabase pgvector**: Replaces Pinecone (saves $70/month)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Architectural Decisions](#key-architectural-decisions)
3. [Supabase pgvector Integration](#supabase-pgvector-integration)
4. [Intent Parsing Strategy](#intent-parsing-strategy)
5. [Prompt Caching Strategy](#prompt-caching-strategy)
6. [Agent Hierarchy](#agent-hierarchy)
7. [Implementation Plan](#implementation-plan)
8. [Testing Strategy](#testing-strategy)
9. [Migration & Deployment](#migration--deployment)
10. [Cost Analysis](#cost-analysis)

---

## Architecture Overview

### Unified Flow

```
User Message (Text/Voice/Photo)
    ↓
Input Normalization Layer
    ├─ Voice → Transcribe with Whisper
    ├─ Photo → Extract with Vision API
    └─ Text → Pass-through
    ↓
ALL get: Date Context + User Info
    ↓
Supervisor Agent (with conversation memory)
    ↓
┌──────────────────────────────────────────┐
│ Decision: Which sub-agent to call?      │
│                                          │
│ Options:                                 │
│ 1. Transaction Logger Agent              │
│ 2. Query Executor Agent (SQL + pgvector)│
│ 3. Conversation Agent                    │
└──────────────────────────────────────────┘
    ↓
Sub-Agent executes with tools
    ↓
Natural Response to User
```

### V1 vs V2 Comparison

| Feature | V1 (Current) | V2 (Proposed) |
|---------|--------------|---------------|
| **Input handling** | 3 separate handlers | 1 unified handler |
| **Date context** | Text only | All input types |
| **Memory** | None | Persistent per user |
| **Agent pattern** | Flat | Hierarchical (supervisor) |
| **Query method** | RAG (Pinecone) | SQL + pgvector (Supabase) |
| **Responses** | Generic/robotic | Natural/contextual |
| **Sub-agents** | Via tools (wrapper) | Native agent support |
| **Cost** | ~$140/month | ~$97/month |

---

## Key Architectural Decisions

### 1. Development Approach: Fresh Start

**Decision:** Build agent-v2/ from scratch, then replace agent/

**Rationale:**
- Still in dev phase (no production users yet)
- Clean architecture without legacy constraints
- Easy comparison between V1 and V2
- Simple migration: `mv agent agent-old && mv agent-v2 agent`

**Timeline:** 3 weeks development + 1 week testing

---

### 2. Supervisor with Native Sub-Agents

**Discovery:** Mastra Agent supports native sub-agents via `agents: Record<string, Agent>`

**Implementation:**

```typescript
export const supervisorAgent = new Agent({
  name: 'supervisor',
  model: openai('gpt-4o'),

  // ✅ Direct sub-agent access (no wrapper tools needed!)
  agents: {
    transactionLogger: transactionLoggerAgent,
    queryExecutor: queryExecutorAgent,
    conversation: conversationAgent,
  },

  // Optional: Helper tools
  tools: {
    getConversationHistory: getConversationHistoryTool,
  },
});
```

**Benefits:**
- Cleaner code (no wrapper tools)
- Mastra handles delegation internally
- Better error handling
- Supports nested hierarchies

---

### 3. SQL vs Embeddings: Hybrid Approach

#### Phase 1: SQL-First (V2 Launch)

**SQL handles 95% of queries:**

| Query Type | SQL Solution |
|------------|--------------|
| Exact matches | `WHERE merchant = 'Carrefour'` |
| Category filtering | `WHERE category = 'Groceries'` |
| Date ranges | `WHERE transaction_date BETWEEN ...` |
| Aggregations | `SUM()`, `AVG()`, `COUNT()` |
| Sorting | `ORDER BY amount DESC` |
| Complex queries | Joins, subqueries, window functions |

**SQL Improvements to reduce embedding needs:**

```sql
-- Case-insensitive search
WHERE LOWER(merchant) LIKE LOWER('%carrefour%')

-- Full-text search (SQLite FTS5)
CREATE VIRTUAL TABLE transactions_fts USING fts5(merchant, description);
SELECT * FROM transactions_fts WHERE merchant MATCH 'carrefor*';

-- Merchant aliases table
CREATE TABLE merchant_aliases (
  canonical_name TEXT,
  alias TEXT
);
```

#### Phase 2: Add pgvector for Fuzzy Matching (5% edge cases)

**Embeddings needed for:**

| Query Type | Why SQL Fails | Example |
|------------|---------------|---------|
| **Typos** | Exact match fails | "carrefur" → "Carrefour" |
| **Semantic search** | SQL doesn't understand meaning | "Coffee shops" → Starbucks, Costa |
| **Similar merchants** | No similarity measure | "Like Carrefour" → Lulu, Union Coop |

**Hybrid Strategy:**

```typescript
// 1. Try SQL first (fast)
const sqlResults = await executeSql(query);

// 2. If no results or confidence low, try fuzzy
if (sqlResults.length === 0 || needsFuzzyMatch(query)) {
  const fuzzyResults = await searchTransactionsHybrid({ query, userId });
  return fuzzyResults;
}

return sqlResults;
```

---

### 4. Supabase pgvector vs Pinecone

**Decision:** Use Supabase pgvector instead of Pinecone

**Rationale:**

| Feature | Supabase pgvector | Pinecone |
|---------|-------------------|----------|
| **Cost** | $0-25/month | $70/month |
| **Integration** | Same database as transactions | Separate service |
| **Hybrid queries** | SQL + vector in ONE query | Requires multiple calls |
| **Maintenance** | Single database to manage | Two databases |
| **Performance** | Fast for filtered searches | Fast for pure vector search |

**Winner:** Supabase pgvector (saves $70/month + simpler architecture)

---

## Supabase pgvector Integration

### Database Schema

```sql
-- 1. Enable pgvector extension (run once)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Transactions table with embeddings
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,

  -- Transaction data
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,

  -- ✅ Vector embeddings for fuzzy search
  merchant_embedding vector(1536), -- text-embedding-3-small
  description_embedding vector(1536), -- Optional

  -- Metadata
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX idx_user_id ON transactions(user_id);
CREATE INDEX idx_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_category ON transactions(category);
CREATE INDEX idx_merchant ON transactions USING gin(to_tsvector('english', merchant));

-- ✅ Vector index for fast similarity search
CREATE INDEX idx_merchant_embedding ON transactions
USING ivfflat (merchant_embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Merchant embeddings cache (saves API calls)
CREATE TABLE merchant_embeddings_cache (
  id BIGSERIAL PRIMARY KEY,
  merchant_name TEXT UNIQUE NOT NULL,
  embedding vector(1536) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_merchant_cache_embedding ON merchant_embeddings_cache
USING ivfflat (embedding vector_cosine_ops);
```

### Hybrid Search RPC Function

```sql
-- Function: Search with SQL filters + vector similarity
CREATE OR REPLACE FUNCTION search_transactions_hybrid(
  p_query_embedding vector(1536),
  p_user_id BIGINT,
  p_similarity_threshold FLOAT DEFAULT 0.6,
  p_category TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_min_amount DECIMAL DEFAULT NULL,
  p_max_amount DECIMAL DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  amount DECIMAL,
  currency TEXT,
  merchant TEXT,
  category TEXT,
  description TEXT,
  transaction_date DATE,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.amount,
    t.currency,
    t.merchant,
    t.category,
    t.description,
    t.transaction_date,
    (1 - (t.merchant_embedding <=> p_query_embedding))::FLOAT as similarity
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND (p_category IS NULL OR t.category = p_category)
    AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
    AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (1 - (t.merchant_embedding <=> p_query_embedding)) > p_similarity_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Embedding Helper Library

```typescript
// agent-v2/src/lib/embeddings.ts

import { openai } from './openai';
import { supabase } from './supabase';

/**
 * Generate embedding using OpenAI
 * Cost: ~$0.00001 per call (text-embedding-3-small)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
  });

  return response.data[0].embedding;
}

/**
 * Get merchant embedding with caching
 * Reduces API calls by ~80-90%
 */
export async function getMerchantEmbedding(merchant: string): Promise<number[]> {
  const normalized = merchant.trim().toLowerCase();

  // Check cache first
  const { data: cached, error } = await supabase
    .from('merchant_embeddings_cache')
    .select('embedding')
    .eq('merchant_name', normalized)
    .single();

  if (cached && !error) {
    console.log(`[embeddings] Cache hit: ${merchant}`);

    // Update usage count
    await supabase
      .from('merchant_embeddings_cache')
      .update({ usage_count: supabase.sql`usage_count + 1` })
      .eq('merchant_name', normalized);

    return cached.embedding;
  }

  // Generate and cache
  console.log(`[embeddings] Cache miss: ${merchant}`);
  const embedding = await generateEmbedding(merchant);

  await supabase.from('merchant_embeddings_cache').insert({
    merchant_name: normalized,
    embedding,
  });

  return embedding;
}

/**
 * Hybrid search: SQL filters + vector similarity
 */
export async function searchTransactionsHybrid(params: {
  query: string;
  userId: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  similarityThreshold?: number;
  limit?: number;
}) {
  const { query, userId, similarityThreshold = 0.6, ...filters } = params;

  // Generate embedding for query
  const embedding = await generateEmbedding(query);

  // Call RPC function
  const { data, error } = await supabase.rpc('search_transactions_hybrid', {
    p_query_embedding: embedding,
    p_user_id: userId,
    p_similarity_threshold: similarityThreshold,
    p_category: filters.category || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_min_amount: filters.minAmount || null,
    p_max_amount: filters.maxAmount || null,
    p_limit: filters.limit || 50,
  });

  if (error) {
    console.error('[embeddings] Hybrid search error:', error);
    throw error;
  }

  return data;
}
```

---

## Intent Parsing Strategy

### V1 vs V2 Approach

| Aspect | V1 (Current) | V2 (Proposed) |
|--------|--------------|---------------|
| **When** | Pre-processing step (separate tool) | Built into supervisor agent |
| **Caching** | LibSQL intent_cache table | LibSQL agent_response_cache |
| **Output** | Structured intent JSON | Natural agent decision |
| **Flexibility** | Fixed 3 categories | Dynamic routing |
| **Memory** | No conversation context | With full conversation history |

### V2: Intent Detection as Agent Capability

Instead of a separate `parse-intent-tool`, the **supervisor agent analyzes and routes**:

```typescript
// agent-v2/src/mastra/agents/supervisor-agent.ts

export const supervisorAgent = new Agent({
  name: 'supervisor',

  instructions: `You are HilmAI's financial assistant supervisor.

Your job: Analyze user messages and delegate to the right specialist agent.

## Available Sub-Agents

1. **transactionLogger** - Use when user wants to LOG a transaction
   Examples:
   - "I spent 50 AED at Carrefour"
   - Receipt photos
   - Voice: "Bought coffee for 15 dirhams"

2. **queryExecutor** - Use when user ASKS about their finances
   Examples:
   - "How much on groceries?"
   - "Show my spending last week"
   - "Top 5 expenses"

3. **conversation** - Use for EVERYTHING ELSE
   Examples:
   - "How are you?"
   - "Thanks!"
   - "What can you do?"

## Decision Process

1. Check conversation history for context
2. Determine intent from user message
3. Call appropriate sub-agent
4. Format response naturally

## Important Rules

- ALWAYS consider conversation memory
- If ambiguous, ask for clarification
- Use natural, friendly language
- Support both English and Arabic`,

  model: openai('gpt-4o'), // Smart model for routing

  agents: {
    transactionLogger: transactionLoggerAgent,
    queryExecutor: queryExecutorAgent,
    conversation: conversationAgent,
  },
});
```

**Benefits:**
- ✅ No separate intent parsing step
- ✅ Conversation context informs routing
- ✅ More flexible (not limited to 3 intents)
- ✅ Supervisor can clarify ambiguity before delegating

**Trade-off:**
- ⚠️ One extra LLM call (supervisor routing)
- **Mitigation:** OpenAI's automatic prompt caching + response caching

---

## Prompt Caching Strategy

### OpenAI Native Prompt Caching

OpenAI automatically caches:
- System instructions (5-10 minutes)
- Reduces cost by ~50%
- No code changes needed!

### Agent Response Cache

V2 caches **complete agent responses** (not just intents):

```typescript
// agent-v2/src/lib/prompt-cache.ts

import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { getLibsqlClient } from './database';

interface CachedAgentResponse {
  response: string;
  metadata: Record<string, any>;
}

export class AgentResponseCache {
  private static TABLE_NAME = 'agent_response_cache';
  private static CACHE_VERSION = 1;
  private static DEFAULT_TTL = 3600; // 1 hour

  static async ensureTable(client: Client) {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
        cache_key TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        user_id BIGINT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_expires_at
      ON ${this.TABLE_NAME}(expires_at)
    `);
  }

  static generateKey(userId: number, message: string, context?: Record<string, any>): string {
    const normalized = message.trim().toLowerCase();
    const contextStr = context ? JSON.stringify(context) : '';
    const input = `${userId}:${normalized}:${contextStr}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  static async get(
    userId: number,
    message: string,
    context?: Record<string, any>
  ): Promise<CachedAgentResponse | null> {
    const client = getLibsqlClient();
    if (!client) return null;

    try {
      await this.ensureTable(client);
      const key = this.generateKey(userId, message, context);
      const now = Math.floor(Date.now() / 1000);

      const result = await client.execute({
        sql: `
          SELECT response_json, version
          FROM ${this.TABLE_NAME}
          WHERE cache_key = ?
            AND user_id = ?
            AND expires_at > ?
            AND version = ?
        `,
        args: [key, userId, now, this.CACHE_VERSION],
      });

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0] as Record<string, any>;
      return JSON.parse(row.response_json);
    } catch (error) {
      console.warn('[cache] Get failed:', error);
      return null;
    }
  }

  static async set(
    userId: number,
    message: string,
    response: CachedAgentResponse,
    context?: Record<string, any>,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<void> {
    const client = getLibsqlClient();
    if (!client) return;

    try {
      await this.ensureTable(client);
      const key = this.generateKey(userId, message, context);
      const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

      await client.execute({
        sql: `
          INSERT INTO ${this.TABLE_NAME}
            (cache_key, response_json, version, user_id, expires_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at
        `,
        args: [key, JSON.stringify(response), this.CACHE_VERSION, userId, expiresAt],
      });
    } catch (error) {
      console.warn('[cache] Set failed:', error);
    }
  }

  static async cleanup(): Promise<number> {
    const client = getLibsqlClient();
    if (!client) return 0;

    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await client.execute({
        sql: `DELETE FROM ${this.TABLE_NAME} WHERE expires_at <= ?`,
        args: [now],
      });

      return result.rowsAffected;
    } catch (error) {
      console.warn('[cache] Cleanup failed:', error);
      return 0;
    }
  }
}
```

### Cache Usage in Bot

```typescript
// agent-v2/src/bot.ts

bot.on('message', async (ctx) => {
  const userId = ctx.chat.id;
  const input = await normalizeInput(ctx);

  // ✅ Check cache first
  const cached = await AgentResponseCache.get(userId, input.text);
  if (cached) {
    console.log('[bot] Cache hit!');
    await ctx.reply(cached.response, { parse_mode: 'Markdown' });
    return;
  }

  // Call supervisor agent
  const supervisor = mastra.getAgent('supervisor');
  const result = await supervisor.generate(buildPrompt(input), {
    resourceId: userId.toString(), // Enables memory
  });

  // ✅ Cache response (for queries only, not transactions)
  if (!result.text.toLowerCase().includes('saved')) {
    await AgentResponseCache.set(userId, input.text, {
      response: result.text,
      metadata: {},
    });
  }

  await ctx.reply(result.text, { parse_mode: 'Markdown' });
});
```

---

## Agent Hierarchy

### Supervisor Agent (Main Orchestrator)

```typescript
// agent-v2/src/mastra/agents/supervisor-agent.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { transactionLoggerAgent } from './transaction-logger-agent';
import { queryExecutorAgent } from './query-executor-agent';
import { conversationAgent } from './conversation-agent';

export const supervisorAgent = new Agent({
  name: 'supervisor',
  instructions: `[See instructions above]`,
  model: openai('gpt-4o'),

  agents: {
    transactionLogger: transactionLoggerAgent,
    queryExecutor: queryExecutorAgent,
    conversation: conversationAgent,
  },
});
```

### Sub-Agent 1: Transaction Logger

```typescript
// agent-v2/src/mastra/agents/transaction-logger-agent.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { extractReceiptTool } from '../tools/extract-receipt-tool';
import { transcribeVoiceTool } from '../tools/transcribe-voice-tool';
import { extractTransactionTool } from '../tools/extract-transaction-tool';
import { saveTransactionTool } from '../tools/save-transaction-tool';

export const transactionLoggerAgent = new Agent({
  name: 'transactionLogger',

  instructions: `You extract and save financial transactions.

Inputs:
- Text: "I spent 50 AED at Carrefour"
- Photos: Receipt images
- Voice: Transcribed audio

Process:
1. Extract transaction details (amount, merchant, category, date)
2. Use provided date context for "today" and "yesterday"
3. Save to database with user info
4. Confirm with natural response

IMPORTANT:
- Use the date context: [Current Date: Today is YYYY-MM-DD, Yesterday was YYYY-MM-DD]
- If no date mentioned, use today
- Extract currency from text (AED, USD, SAR, etc.)
- Categorize appropriately (Groceries, Dining, Transportation, etc.)`,

  model: openai('gpt-4o'),

  tools: {
    extractReceipt: extractReceiptTool,
    transcribeVoice: transcribeVoiceTool,
    extractTransaction: extractTransactionTool,
    saveTransaction: saveTransactionTool,
  },
});
```

### Sub-Agent 2: Query Executor

```typescript
// agent-v2/src/mastra/agents/query-executor-agent.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { hybridQueryTool } from '../tools/hybrid-query-tool';

export const queryExecutorAgent = new Agent({
  name: 'queryExecutor',

  instructions: `You answer questions about user's spending using hybrid SQL + vector search.

Examples:
- "How much on groceries?" → SQL query with category filter
- "Spending at Carrefour?" → Exact merchant match
- "Spending at carrefur?" (typo) → Fuzzy search with embeddings
- "Coffee shop spending?" → Semantic search for similar merchants

Process:
1. Determine if fuzzy matching needed (typos, vague terms)
2. If exact: Use SQL only (fast)
3. If fuzzy: Use hybrid SQL + pgvector (still fast!)
4. Format response naturally with insights

IMPORTANT:
- Use provided date context for relative dates
- Return specific numbers, not vague answers
- Suggest follow-up questions when appropriate`,

  model: openai('gpt-4o-mini'),

  tools: {
    hybridQuery: hybridQueryTool,
  },
});
```

### Sub-Agent 3: Conversation Agent

```typescript
// agent-v2/src/mastra/agents/conversation-agent.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const conversationAgent = new Agent({
  name: 'conversation',

  instructions: `You handle general conversation and help.

Examples:
- Greetings: "Hi!", "How are you?"
- Thanks: "Thanks!", "Great, thank you"
- Help: "What can you do?", "How do I use this?"
- Clarifications: "I meant groceries"

Style:
- Friendly and natural (not robotic)
- Brief but helpful
- Use emojis sparingly
- Support English and Arabic
- Remember conversation context

Capabilities to mention:
1. 💰 Log transactions (text, voice, photo)
2. 📊 Answer spending questions
3. 📈 Track budgets and insights`,

  model: openai('gpt-4o-mini'),

  // No tools - just natural conversation
});
```

---

## Implementation Plan

### Week 1: Foundation

#### Day 1-2: Setup

```bash
# Create directory structure
mkdir -p agent-v2/src/{lib,mastra/{agents,tools},__tests__}

# Copy essentials from agent/
cp -r agent/src/lib/{database.ts,openai.ts,supabase.ts,file-utils.ts} agent-v2/src/lib/
cp agent/package.json agent-v2/
cp agent/tsconfig.json agent-v2/
cp agent/.env.example agent-v2/

# Install dependencies
cd agent-v2
npm install

# Add new dependencies
npm install @supabase/supabase-js
```

#### Day 3: Supabase Setup

1. **Enable pgvector:**
```sql
-- Run in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **Create schema:**
   - Run transactions table creation
   - Run merchant_embeddings_cache table
   - Run indexes
   - Run RPC function

3. **Test connection:**
```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase.from('transactions').select('*').limit(1);
console.log('Connection test:', error ? 'FAIL' : 'OK');
```

#### Day 4-5: Core Libraries

1. Create `lib/embeddings.ts`
2. Create `lib/prompt-cache.ts`
3. Create `lib/input-normalization.ts`
4. Write unit tests

---

### Week 2: Agents & Tools

#### Day 6-7: Build Tools

```
tools/
├── extract-receipt-tool.ts        # Copy + improve from V1
├── transcribe-voice-tool.ts       # Copy from V1
├── extract-transaction-tool.ts    # Copy from V1
├── save-transaction-tool.ts       # Update with embeddings
└── hybrid-query-tool.ts           # ✅ NEW: SQL + pgvector
```

**save-transaction-tool.ts changes:**
```typescript
// Add embedding generation
const merchantEmbedding = await getMerchantEmbedding(merchant);

await supabase.from('transactions').insert({
  // ... other fields
  merchant_embedding: merchantEmbedding, // ✅ Add this
});
```

#### Day 8-9: Build Sub-Agents

```
agents/
├── transaction-logger-agent.ts    # ✅ NEW
├── query-executor-agent.ts        # ✅ NEW
└── conversation-agent.ts          # ✅ NEW
```

#### Day 10: Build Supervisor

```
agents/
└── supervisor-agent.ts            # ✅ NEW (main orchestrator)
```

---

### Week 3: Integration & Testing

#### Day 11-12: Bot Integration

```typescript
// agent-v2/src/bot.ts

import { Bot } from 'grammy';
import { mastra } from './mastra';
import { normalizeInput } from './lib/input-normalization';
import { AgentResponseCache } from './lib/prompt-cache';

export function createBot(): Bot {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  // ✅ Single handler for ALL message types
  bot.on('message', async (ctx) => {
    try {
      const userId = ctx.chat.id;

      // Step 1: Normalize input
      const input = await normalizeInput(ctx);

      // Step 2: Check cache
      const cached = await AgentResponseCache.get(userId, input.text);
      if (cached) {
        await ctx.reply(cached.response, { parse_mode: 'Markdown' });
        return;
      }

      // Step 3: Build prompt with context
      const prompt = buildContextPrompt(input);

      // Step 4: Call supervisor
      const supervisor = mastra.getAgent('supervisor');
      const result = await supervisor.generate(prompt, {
        resourceId: userId.toString(), // ✅ Enables memory
      });

      // Step 5: Cache if appropriate
      const shouldCache = !result.text.toLowerCase().includes('saved');
      if (shouldCache) {
        await AgentResponseCache.set(userId, input.text, {
          response: result.text,
          metadata: {},
        });
      }

      // Step 6: Reply
      await ctx.reply(result.text, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Error:', error);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  return bot;
}
```

#### Day 13-14: Testing

```typescript
// __tests__/integration.test.ts

describe('Agent V2 Integration', () => {
  it('logs text transaction', async () => {
    const result = await testSupervisor({
      message: 'I spent 50 AED at Carrefour today',
      userId: 123,
    });

    expect(result.text).toContain('50');
    expect(result.text).toContain('Carrefour');

    // Verify saved with embedding
    const tx = await getLatestTransaction(123);
    expect(tx.amount).toBe(50);
    expect(tx.merchant_embedding).toBeDefined();
    expect(tx.merchant_embedding.length).toBe(1536);
  });

  it('handles fuzzy merchant search', async () => {
    await saveTestTransaction({ merchant: 'Carrefour', amount: 50 });

    // Query with typo
    const result = await testSupervisor({
      message: 'How much at carrefur?',
      userId: 123,
    });

    expect(result.text).toContain('50'); // Should find via embedding
  });

  it('maintains conversation context', async () => {
    // First message
    await testSupervisor({
      message: 'How much on groceries?',
      userId: 123,
    });

    // Follow-up (no mention of groceries)
    const result = await testSupervisor({
      message: 'What about this week?',
      userId: 123,
    });

    expect(result.text.toLowerCase()).toContain('groceries');
  });
});
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('textToSqlTool', () => {
  it('generates correct SQL for simple query', async () => {
    const result = await textToSqlTool.execute({
      context: {
        query: 'How much did I spend on groceries?',
        userId: 123,
        currentDate: '2025-10-28',
      },
    });

    expect(result.sql).toContain('SELECT SUM(amount)');
    expect(result.sql).toContain("category = 'Groceries'");
    expect(result.sql).toContain('user_id = 123');
  });
});

describe('normalizeInput', () => {
  it('handles text input', async () => {
    const ctx = mockContext({ text: 'Hello' });
    const result = await normalizeInput(ctx);

    expect(result.text).toBe('Hello');
    expect(result.metadata.inputType).toBe('text');
    expect(result.metadata.currentDate).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Supervisor Agent', () => {
  it('routes to transaction logger', async () => {
    const result = await supervisorAgent.generate(
      'I spent 50 AED at Carrefour\n[Current Date: Today is 2025-10-28]'
    );

    expect(result.text).toContain('50');
    expect(result.text).toContain('Carrefour');

    const tx = await getLatestTransaction(123);
    expect(tx.amount).toBe(50);
  });
});
```

---

## Migration & Deployment

### Pre-Migration Checklist

- [ ] agent-v2 passes all tests
- [ ] Supabase schema deployed
- [ ] pgvector extension enabled
- [ ] Environment variables configured
- [ ] Embeddings library tested

### Migration Day

```bash
# 1. Backup V1
mv agent agent-v1-backup

# 2. Promote V2
mv agent-v2 agent

# 3. Restart bot
pm2 restart hilm-bot

# 4. Monitor logs
pm2 logs hilm-bot --lines 100

# 5. Test with real account

# 6. If issues, rollback
# mv agent agent-v2 && mv agent-v1-backup agent && pm2 restart hilm-bot
```

### Post-Migration (Week 1)

- [ ] Monitor error rates
- [ ] Check response latency
- [ ] Verify embeddings generated
- [ ] Test fuzzy search accuracy
- [ ] Check cache hit rates
- [ ] Review conversation memory

### Cleanup (Week 2)

- [ ] Delete agent-v1-backup
- [ ] Remove unused dependencies
- [ ] Update documentation

---

## Cost Analysis

### OpenAI API

| Operation | Model | Cost/Call | Volume/Month | Total |
|-----------|-------|-----------|--------------|-------|
| Supervisor routing | gpt-4o | $0.005 | 10,000 | $50 |
| Transaction logging | gpt-4o | $0.003 | 3,000 | $9 |
| Query execution | gpt-4o-mini | $0.0001 | 5,000 | $0.50 |
| Conversation | gpt-4o-mini | $0.0001 | 2,000 | $0.20 |
| Embeddings | text-embedding-3-small | $0.00001 | 3,000 | $0.03 |
| **Total** | | | | **~$60/month** |

### Infrastructure

| Service | Plan | Cost |
|---------|------|------|
| Supabase | Pro (with pgvector) | $25/month |
| Turso (LibSQL) | Starter | $0/month |
| Server (if needed) | Digital Ocean | $12/month |
| **Total** | | **$37/month** |

**Grand Total: ~$97/month** (vs $140/month with Pinecone)

**Savings: $43/month (31% reduction)**

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Response time** | < 2s (95th percentile) | Log timestamps |
| **Cache hit rate** | > 30% | Count cache hits/misses |
| **Fuzzy search accuracy** | > 90% | Manual testing |
| **Embedding cost** | < $1/month | OpenAI dashboard |
| **Conversation accuracy** | > 85% | Follow-up questions work |

---

## Directory Structure

```
agent-v2/
├── src/
│   ├── bot.ts                          # Main entry point
│   ├── index.ts                        # Server startup
│   │
│   ├── lib/
│   │   ├── database.ts                 # LibSQL client
│   │   ├── openai.ts                   # OpenAI client
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── file-utils.ts               # File operations
│   │   ├── date-utils.ts               # Date helpers
│   │   ├── input-normalization.ts      # ✅ NEW: Input handler
│   │   ├── embeddings.ts               # ✅ NEW: pgvector helpers
│   │   └── prompt-cache.ts             # ✅ NEW: Response cache
│   │
│   ├── mastra/
│   │   ├── index.ts                    # Mastra instance
│   │   │
│   │   ├── agents/
│   │   │   ├── supervisor-agent.ts             # ✅ Main orchestrator
│   │   │   ├── transaction-logger-agent.ts     # ✅ Logging specialist
│   │   │   ├── query-executor-agent.ts         # ✅ Query specialist
│   │   │   └── conversation-agent.ts           # ✅ Chitchat handler
│   │   │
│   │   └── tools/
│   │       ├── extract-receipt-tool.ts         # Vision OCR
│   │       ├── transcribe-voice-tool.ts        # Whisper
│   │       ├── extract-transaction-tool.ts     # Text parsing
│   │       ├── save-transaction-tool.ts        # DB save with embeddings
│   │       └── hybrid-query-tool.ts            # ✅ NEW: SQL + pgvector
│   │
│   └── __tests__/
│       ├── embeddings.test.ts
│       ├── prompt-cache.test.ts
│       ├── input-normalization.test.ts
│       ├── hybrid-query.test.ts
│       ├── supervisor-agent.test.ts
│       └── integration.test.ts
│
├── docs/
│   └── ARCHITECTURE_V2.md              # This document
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Next Steps

1. ✅ Review this architecture guide
2. ✅ Approve technical decisions
3. ✅ Start Day 1-2 (setup)
4. ✅ Enable pgvector in Supabase
5. ✅ Build week by week
6. ✅ Test thoroughly
7. ✅ Deploy V2

---

## FAQ

### Q: Will this break existing users?

**A:** No production users yet, so safe to replace completely.

---

### Q: Why not gradual rollout?

**A:** Still in dev phase. Once stable in V2, we do a clean switch.

---

### Q: What if Text-to-SQL generates bad queries?

**A:** Safety layers:
1. SQL validation before execution
2. Query timeout (5 seconds max)
3. Result size limits (1000 rows max)
4. Whitelist of allowed commands (no DROP, DELETE)
5. Fallback to error message

---

### Q: Won't supervisor agent add latency?

**A:** Yes, but minimal:
- Supervisor uses gpt-4o-mini (fast)
- Adds ~500ms
- BUT: Removing 3-step RAG saves 2-3s
- **Net result: 2s faster overall**

---

### Q: How does conversation memory work?

**A:** Memory tied to `resourceId` (Telegram chat ID). Mastra automatically:
1. Loads previous conversation
2. Injects into agent context
3. Saves new messages

---

## Conclusion

Agent V2 addresses all critical V1 issues:

1. ✅ **Unified input processing** fixes date handling inconsistencies
2. ✅ **Conversation memory** enables context-aware responses
3. ✅ **Supervisor pattern** improves organization and routing
4. ✅ **Hybrid SQL + pgvector** makes queries faster, cheaper, more accurate
5. ✅ **Natural responses** improves user experience
6. ✅ **Cost savings** of $43/month (31% reduction)

**Ready to implement!**

---

**Document Version:** 2.0
**Last Updated:** October 29, 2025
**Status:** Implementation Ready
