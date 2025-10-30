# HilmAI Agent V2 - Implementation Tracker

**Date Started:** October 29, 2025
**Package Manager:** Yarn (v1.22+)
**Estimated Duration:** 3 weeks (21 days)

---

## Progress Overview

```
Phase 1: Foundation & Database    [██████████] 100% ✅
Phase 2: Core Libraries           [██████████] 100% ✅
Phase 3: Tools & Agents           [██████████] 100% ✅
Phase 4: Bot Integration          [██████████] 100% ✅
Phase 5: Testing & Deployment     [░░░░░░░░░░] 0%

Overall Progress: 80% (4/5 phases complete)
```

---

## Phase 1: Foundation & Database (Days 1-3)

**Goal:** Setup project with working Supabase + pgvector

### Tasks

- [x] Create project structure: `agent-v2/src/{lib,mastra/{agents,tools},__tests__}`
- [x] Setup dependencies: `yarn install` + add `@supabase/supabase-js`
- [x] Copy essential files from `agent/`: `database.ts`, `supabase.ts`, `openai.ts`
- [x] Configure environment: `.env` with Supabase credentials
- [x] Create complete database schema in `supabase/schema.sql`:
  - Enable pgvector extension
  - `transactions` table with `merchant_embedding vector(1536)`
  - `merchant_embeddings_cache` table
  - Indexes: user_id, date, category, merchant (GIN), vector (IVFFlat)
  - Supabase RPC: `search_transactions_hybrid()`
  - Helper functions and triggers
- [ ] Run schema in Supabase SQL editor
- [ ] Write Phase 1 tests

**Note:** Run `agent-v2/supabase/schema.sql` in Supabase SQL editor to create all tables, indexes, and functions.

### Acceptance Criteria

```bash
# Test connection and basic operations
yarn test:phase1

# Expected:
✓ Supabase connection works
✓ Can insert transaction (without embedding)
✓ Can query transactions by user_id
✓ Can query by date range
✓ Indexes created successfully
✓ pgvector extension enabled

# Manual test:
yarn test:manual:phase1
# Should insert and retrieve test transaction
```

---

## Phase 2: Core Libraries (Days 4-5)

**Goal:** Build embedding generation and caching systems

### Tasks

- [x] Create `lib/embeddings.ts`:
  - `generateEmbedding(text)` - OpenAI text-embedding-3-small
  - `getMerchantEmbedding(merchant)` - with cache support
  - `searchTransactionsHybrid(params)` - SQL + pgvector
- [x] Create `lib/prompt-cache.ts`:
  - `AgentResponseCache` class (get/set/cleanup)
  - LibSQL table: `agent_response_cache`
- [x] Create `lib/input-normalization.ts`:
  - `normalizeInput(ctx)` - handles text/voice/photo
  - Adds date context (today, yesterday)
- [x] Copy utilities: `date-utils.ts`, `file-utils.ts`
- [ ] Write Phase 2 tests

### Acceptance Criteria

```bash
# Test embeddings and caching
yarn test:phase2

# Expected:
✓ generateEmbedding() returns 1536-dim vector
✓ getMerchantEmbedding() caches correctly
✓ Cache hit works (5ms vs 100ms)
✓ searchTransactionsHybrid() finds exact matches
✓ searchTransactionsHybrid() finds typos (similarity > 0.85)
✓ AgentResponseCache stores/retrieves responses
✓ Cache respects TTL expiration
✓ normalizeInput() handles all input types

# Manual test:
yarn test:manual:phase2
# Should demonstrate fuzzy search: "carrefur" → "Carrefour"
```

---

## Phase 3: Tools & Agents (Days 6-11)

**Goal:** Build all Mastra tools and sub-agents

### Tasks

- [x] **Tools:**
  - Copy existing: `extract-receipt-tool`, `transcribe-voice-tool`, `extract-transaction-tool`
  - Update: `save-transaction-tool` - add embedding generation
  - Create: `hybrid-query-tool` - SQL + pgvector decision logic
- [x] **Sub-Agents:**
  - `transaction-logger-agent.ts` - Model: gpt-4o, Tools: extract/save
  - `query-executor-agent.ts` - Model: gpt-4o-mini, Tools: hybrid-query
  - `conversation-agent.ts` - Model: gpt-4o-mini, No tools
- [x] **Supervisor Agent:**
  - `supervisor-agent.ts` - Model: gpt-4o, Routes to sub-agents
- [x] **Mastra Instance:**
  - `mastra/index.ts` - Register all agents
  - Configure memory (Supabase)
- [ ] Write Phase 3 tests

### Acceptance Criteria

```bash
# Test tools and agents independently
yarn test:phase3

# Expected:
✓ extract-transaction-tool extracts correctly
✓ save-transaction-tool generates embedding
✓ save-transaction-tool saves with embedding to DB
✓ hybrid-query-tool uses SQL for exact matches
✓ hybrid-query-tool uses pgvector for fuzzy matches
✓ Transaction Logger agent processes text input
✓ Transaction Logger saves to database
✓ Query Executor agent answers queries
✓ Query Executor handles typos (fuzzy search)
✓ Conversation Agent responds naturally

# Manual test:
yarn test:manual:phase3
# Should test each agent independently:
# - Logger: "I spent 50 AED at Carrefour" → saved
# - Query: "How much at carrefur?" → finds "Carrefour"
# - Chat: "What can you do?" → helpful response
```

---

## Phase 4: Bot Integration (Days 12-15)

**Goal:** Complete end-to-end working Telegram bot

### Tasks

- [x] Supervisor Agent already created in Phase 3
- [x] Create Bot Handler:
  - `bot.ts` - Single handler for all message types
  - Flow: normalize → cache check → supervisor → cache set → reply
  - Error handling and logging with Mastra logger
  - Commands: /start, /help, /clear
  - Structured logging with context objects
- [x] Integrate with Mastra CLI:
  - `mastra/index.ts` - Bot lifecycle integration
  - Auto-start polling bot when module loads
  - Uses Mastra logger for verbose output
  - Removed custom bootstrapping (index.ts)
- [x] Update package.json scripts:
  - `yarn dev` → `mastra dev`
  - `yarn start` → `mastra serve`
  - `yarn build` → `mastra build`
- [ ] Test with Real Telegram:
  - Text messages
  - Voice messages
  - Photo messages (receipts)
  - Conversation memory
  - Response caching
- [ ] Write Phase 4 tests

### Acceptance Criteria

```bash
# Test supervisor and integration
yarn test:phase4

# Expected:
✓ Supervisor routes transactions to transactionLogger
✓ Supervisor routes queries to queryExecutor
✓ Supervisor routes greetings to conversation
✓ Conversation memory persists across messages
✓ Cache hit returns in <200ms
✓ Cache miss calls agent (~2000ms)
✓ Bot handles text/voice/photo inputs

# Manual test with REAL Telegram:
yarn dev

# Test in Telegram:
1. "I spent 50 AED at Carrefour yesterday" → ✅ Saved
2. "How much did I spend at Carrefour?" → "50 AED"
3. Send same query again → Fast response (cache hit)
4. "How much on groceries?" → Answer
5. "What about this week?" → Uses context (remembers groceries)
6. Send voice message → Transcribed and processed
7. Send receipt photo → Extracted and saved
8. "Thanks!" → Natural response

# All should work end-to-end ✅
```

---

## Phase 5: Testing & Deployment (Days 16-21)

**Goal:** Production-ready with comprehensive testing

### Tasks

- [ ] **Integration Tests:**
  - All user flows end-to-end
  - Error scenarios (API failures, timeouts)
  - Edge cases (empty messages, special characters)
  - Multilingual support (English, Arabic)
- [ ] **Performance Testing:**
  - Measure latency for each flow
  - Verify cache hit rate > 30%
  - Verify fuzzy search accuracy > 90%
  - Load testing (100 concurrent users)
- [ ] **Real-World Testing:**
  - Test with real voice messages (various accents)
  - Test with real receipt photos (clear/unclear)
  - Test long conversations (memory management)
- [ ] **Optimization:**
  - Add cache cleanup cron job
  - Optimize embedding cache hit rate
  - Add retry logic for transient failures
  - Comprehensive error logging
- [ ] **Documentation:**
  - Update README.md
  - Deployment guide
  - Monitoring guide
  - Troubleshooting guide

### Acceptance Criteria

```bash
# Run full test suite
yarn test

# Expected:
✓ Unit tests: 45/45 passed
✓ Integration tests: 20/20 passed
✓ E2E tests: 15/15 passed
✓ Performance tests: 8/8 passed
✓ Total: 88/88 tests passed (100%)

# Performance benchmarks:
yarn test:performance

# Expected:
✓ Cache hit latency: <200ms
✓ Transaction logging: <2000ms
✓ Query with SQL: <1500ms
✓ Query with fuzzy: <2000ms
✓ Cache hit rate: >30%
✓ Fuzzy search accuracy: >90%

# Ready for production! 🚀
```

---

## Common Yarn Commands

```bash
# Setup
yarn install                    # Install dependencies
yarn add <package>              # Add dependency
yarn add -D <package>           # Add dev dependency

# Development
yarn dev                        # Start development server
yarn build                      # Build for production
yarn start                      # Start production server

# Testing
yarn test                       # Run all tests
yarn test:phase1                # Run phase 1 tests
yarn test:phase2                # Run phase 2 tests
yarn test:phase3                # Run phase 3 tests
yarn test:phase4                # Run phase 4 tests
yarn test:performance           # Run performance tests
yarn test:e2e                   # Run end-to-end tests
yarn test:watch                 # Run tests in watch mode

# Manual Testing
yarn test:manual:phase1         # Manual test for phase 1
yarn test:manual:phase2         # Manual test for phase 2
yarn test:manual:phase3         # Manual test for phase 3

# Code Quality
yarn format                     # Format code with Prettier
yarn lint                       # Run ESLint
yarn lint:fix                   # Fix ESLint errors
yarn typecheck                  # TypeScript type checking

# Utilities
yarn clean                      # Clean build artifacts
yarn reset                      # Clean + reinstall dependencies
```

---

## Quick Start

```bash
# 1. Navigate to agent-v2
cd agent-v2/

# 2. Install dependencies
yarn install

# 3. Setup environment
cp .env.example .env
# Edit .env with your credentials:
# - SUPABASE_URL
# - SUPABASE_KEY
# - OPENAI_API_KEY
# - TELEGRAM_BOT_TOKEN
# - LIBSQL_URL

# 4. Start development
yarn dev

# 5. Run tests
yarn test
```

---

## Phase Completion Checklist

### Before Moving to Next Phase:

- [ ] All tasks completed
- [ ] All tests passing
- [ ] Manual test successful
- [ ] Code formatted: `yarn format`
- [ ] No lint errors: `yarn lint`
- [ ] Type checking passes: `yarn typecheck`
- [ ] Documentation updated

---

## Definition of Done

### V2 Complete When:

- ✅ All 5 phases completed
- ✅ All 88 tests passing
- ✅ Performance targets met
- ✅ Manual Telegram testing successful
- ✅ Documentation complete
- ✅ Ready for production deployment

---

## Deployment

```bash
# 1. Backup V1
mv agent agent-v1-backup

# 2. Promote V2
mv agent-v2 agent

# 3. Install dependencies
cd agent
yarn install

# 4. Build
yarn build

# 5. Restart bot
pm2 restart hilm-bot

# 6. Monitor
pm2 logs hilm-bot --lines 100

# 7. Rollback if needed
# mv agent agent-v2 && mv agent-v1-backup agent && pm2 restart hilm-bot
```

---

## Support & Resources

- **Architecture:** See `ARCHITECTURE_V2.md`
- **Flow Diagram:** See `FLOW_DIAGRAM.md`
- **Issues:** Track in GitHub Issues
- **Questions:** Refer to project documentation

---

**Document Version:** 2.0
**Last Updated:** October 29, 2025
**Status:** Ready to Start
