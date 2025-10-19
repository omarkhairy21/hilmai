# hilm.ai - Complete Implementation Plan

## Overview
This document outlines all phases needed to implement the remaining features for the hilm.ai Telegram bot using Mastra.ai framework.

**Current Status:** ✅ Text/Receipt/Voice transaction extraction | ✅ RAG & Semantic Search | ✅ Query Agent

**Goal:** Implement budget tracking and workflows.

---

## Phase 1: Receipt OCR (GPT-4o Vision) ✅ COMPLETED

### Overview
Enable users to snap photos of receipts and automatically extract transaction details using GPT-4o Vision API.

### Status: ✅ COMPLETED
**Completion Date:** 2025-10-19
**Details:** See [PHASE_1_COMPLETED.md](./PHASE_1_COMPLETED.md)

### Tasks
- [x] Create `src/lib/openai.ts` - centralized OpenAI client configuration
- [x] Create `src/mastra/tools/extract-receipt-tool.ts`
- [x] Define input schema (imageUrl, user info)
- [x] Define output schema (amount, merchant, category, items[], confidence)
- [x] Implement GPT-4o Vision API call with receipt extraction prompt
- [x] Add confidence scoring (0-1 scale)
- [x] Add photo message handler in `src/bot.ts`
- [x] Implement Telegram file download logic
- [x] Get highest resolution photo from message
- [x] Send "📷 Scanning receipt..." loading message
- [x] Agent-based receipt processing (extract + save)
- [x] Handle blurry/unclear images with helpful error messages
- [x] Handle non-receipt images gracefully
- [x] Add retry logic for API failures
- [x] Register tool with transaction-extractor-agent
- [x] Update /help command

### Files Created
- ✅ `agent/src/lib/openai.ts`
- ✅ `agent/src/mastra/tools/extract-receipt-tool.ts`

### Files Modified
- ✅ `agent/src/bot.ts` (added photo handler)
- ✅ `agent/src/mastra/agents/transaction-extractor-agent.ts` (registered tool)

### Dependencies
- OpenAI SDK: ✅ Installed (`npm install openai`)
- Telegram Bot API: ✅ Already installed

### Actual Time Spent
**2-3 hours**

---

## Phase 2: Voice Transcription (Whisper API) ✅ COMPLETED

### Overview
Enable users to send voice messages describing transactions, automatically transcribed using OpenAI Whisper API.

### Status: ✅ COMPLETED
**Completion Date:** 2025-10-19
**Details:** See [PHASE_2_COMPLETED.md](./PHASE_2_COMPLETED.md)

### Tasks
- [x] Create `src/lib/file-utils.ts` for temp file management
- [x] Implement download function for Telegram files
- [x] Implement cleanup function (delete temp files after use)
- [x] Create temp directory if not exists
- [x] Create `src/mastra/tools/transcribe-voice-tool.ts`
- [x] Define input schema (audioFilePath, language)
- [x] Define output schema (text, language, duration)
- [x] Implement Whisper API integration
- [x] Add support for OGG format (Telegram's default)
- [x] Handle multiple languages (auto-detect)
- [x] Add voice message handler in `src/bot.ts`
- [x] Download voice file from Telegram servers to /tmp
- [x] Send "🎤 Processing voice note..." loading message
- [x] Agent-based voice processing (transcribe + extract + save)
- [x] Pass transcribed text to transaction extractor agent
- [x] Clean up temporary files after processing
- [x] Handle transcription failures gracefully
- [x] Duration limit (2 minutes max)
- [x] Register tool with transaction-extractor-agent
- [x] Update /help command

### Files Created
- ✅ `agent/src/lib/file-utils.ts`
- ✅ `agent/src/mastra/tools/transcribe-voice-tool.ts`

### Files Modified
- ✅ `agent/src/bot.ts` (added voice handler)
- ✅ `agent/src/mastra/agents/transaction-extractor-agent.ts` (registered tool)

### Dependencies
- OpenAI SDK: ✅ Already installed (Whisper API)
- Node.js `fs` module: ✅ Built-in
- Node.js `https` module: ✅ Built-in (for file downloads)

### Actual Time Spent
**1-2 hours**

---

## Phase 3: RAG & Semantic Search (Pinecone + Embeddings) ✅ COMPLETED

### Overview
Enable semantic search over transaction history using vector embeddings stored in Pinecone, allowing users to ask natural language questions.

### Status: ✅ COMPLETED
**Completion Date:** 2025-10-19
**Details:** See [PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md)

### Tasks

#### 3.1 Database Setup
- [x] Enable pgvector extension in Supabase
- [x] Add `embedding` column to transactions table (vector(3072))
- [x] Create migration file: `add_embeddings.sql`
- [x] Test pgvector functionality

#### 3.2 Pinecone Setup
- [x] Install `@pinecone-database/pinecone` package
- [x] Create Pinecone account and get API key
- [x] Create index: `hilm-transactions` (dimension: 3072)
- [x] Add Pinecone environment variables to `.env`
- [x] Create `src/lib/pinecone.ts` - centralized Pinecone client

#### 3.3 Embeddings Infrastructure
- [x] Create `src/mastra/rag/embeddings.ts`
- [x] Implement `generateEmbedding(text)` function using OpenAI
- [x] Use `text-embedding-3-large` model (3072 dimensions)
- [x] Add error handling and retry logic

#### 3.4 Update Save Transaction Flow
- [x] Modify `src/mastra/tools/save-transaction-tool.ts`
- [x] Generate embedding text: `${amount} ${currency} at ${merchant} for ${category} on ${date}`
- [x] Call `generateEmbedding()` function
- [x] Save embedding to Supabase transactions table
- [x] Upsert embedding to Pinecone with metadata (user_id, amount, category, merchant, date)
- [x] Handle embedding generation failures

#### 3.5 Semantic Search Tool
- [x] Create `src/mastra/tools/search-transactions-tool.ts`
- [x] Define input schema (userId, query, topK)
- [x] Define output schema (transactions array)
- [x] Generate query embedding
- [x] Search Pinecone with user_id filter
- [x] Fetch full transaction details from Supabase
- [x] Return ranked results

#### 3.6 Testing
- [x] Test embedding generation
- [x] Test Pinecone upsert
- [x] Test semantic search with various queries
- [x] Test filtering by user_id
- [x] Verify results are relevant

### Files Created
- ✅ `agent/src/lib/pinecone.ts`
- ✅ `agent/src/mastra/rag/embeddings.ts`
- ✅ `agent/src/mastra/tools/search-transactions-tool.ts`
- ✅ `agent/add_embeddings.sql`

### Files Modified
- ✅ `agent/src/mastra/tools/save-transaction-tool.ts` (add embedding generation)
- ✅ `agent/.env` (added Pinecone variables)

### Dependencies
✅ **Installed:**
```bash
npm install @pinecone-database/pinecone
```

### Environment Variables
✅ **Added:**
```bash
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=hilm-transactions
```

### Actual Time Spent
**~2 hours**

---

## Phase 4: Budget Tracking

### Overview
Allow users to set budgets by category and track spending against limits with alerts.

### Tasks

#### 4.1 Database Schema
- [ ] Create `budgets` table in schema
- [ ] Add columns: id, user_id, category, limit, period, current_spent, created_at
- [ ] Add indexes on user_id and category
- [ ] Create migration: `supabase/migrations/create_budgets_table.sql`
- [ ] Enable RLS policies for budgets table

#### 4.2 Check Budget Tool
- [ ] Create `src/mastra/tools/check-budget-tool.ts`
- [ ] Define input schema (userId, category)
- [ ] Define output schema (limit, spent, remaining, percentage, status)
- [ ] Query budget from database
- [ ] Calculate current spending for period (daily/weekly/monthly)
- [ ] Calculate percentage and status (on_track/warning/exceeded)
- [ ] Update current_spent in budgets table
- [ ] Return budget status

#### 4.3 Set Budget Tool
- [ ] Create `src/mastra/tools/set-budget-tool.ts`
- [ ] Define input schema (userId, category, limit, period)
- [ ] Validate inputs (limit > 0, valid category, valid period)
- [ ] Upsert budget to database
- [ ] Return confirmation message

#### 4.4 Budget Utilities
- [ ] Create `src/lib/budget-utils.ts`
- [ ] Implement `getStartOfPeriod(period)` function
- [ ] Implement `calculateSpending(userId, category, startDate)` function
- [ ] Implement `getBudgetStatus(percentage)` function

#### 4.5 Integration with Transaction Flow
- [ ] Modify transaction success message in `src/bot.ts`
- [ ] Call check-budget-tool after saving transaction
- [ ] Display budget status with emoji (✅/⚠️/🚨)
- [ ] Show: "$50 / $200 (25%)" format

#### 4.6 Bot Commands
- [ ] Add `/setbudget` command handler
- [ ] Parse category, amount, period from message
- [ ] Call set-budget-tool
- [ ] Add `/budgets` command to view all budgets
- [ ] Add `/budget [category]` to check specific category
- [ ] Add budget command descriptions to `/help`

#### 4.7 Budget Agent (Optional)
- [ ] Create `src/mastra/agents/budget-advisor-agent.ts`
- [ ] Give it check-budget and set-budget tools
- [ ] Add natural language budget setting
- [ ] Example: "Set my groceries budget to $500 per month"

### Files to Create/Modify
**New:**
- `agent/supabase/migrations/create_budgets_table.sql`
- `agent/src/mastra/tools/check-budget-tool.ts`
- `agent/src/mastra/tools/set-budget-tool.ts`
- `agent/src/lib/budget-utils.ts`
- `agent/src/mastra/agents/budget-advisor-agent.ts` (optional)

**Modified:**
- `agent/src/bot.ts` (add budget commands, integrate check-budget into transaction flow)

### Dependencies
- No new packages needed

### Estimated Time
**3-4 hours**

---

## Phase 5: Workflows & Automation

### Overview
Implement scheduled workflows for budget alerts and weekly summaries using Mastra's workflow system.

### Tasks

#### 5.1 Budget Alert Workflow
- [ ] Create `src/mastra/workflows/budget-alert-workflow.ts`
- [ ] Define workflow with schedule trigger (daily at 8 PM)
- [ ] Step 1: Get all users from database
- [ ] Step 2: For each user, check all budgets
- [ ] Step 3: Filter budgets with status 'warning' or 'exceeded'
- [ ] Step 4: Send Telegram alert messages
- [ ] Format message: "⚠️ Budget Alert: Groceries at 85% ($170/$200)"
- [ ] Handle errors gracefully (user might have blocked bot)

#### 5.2 Weekly Summary Workflow
- [ ] Create `src/mastra/workflows/weekly-summary-workflow.ts`
- [ ] Define workflow with schedule trigger (Sunday at 6 PM)
- [ ] Step 1: Get all active users
- [ ] Step 2: Calculate weekly spending by category
- [ ] Step 3: Generate insights (top categories, total spent, vs. last week)
- [ ] Step 4: Format summary message with charts/emojis
- [ ] Step 5: Send to each user via Telegram
- [ ] Example: "📊 Weekly Summary: $450 spent | Top: Groceries $200"

#### 5.3 Workflow Registration
- [ ] Register workflows in `src/mastra/index.ts`
- [ ] Test workflow execution manually
- [ ] Set up cron triggers (if not using Mastra's built-in scheduler)

#### 5.4 Workflow Utilities
- [ ] Create `src/lib/workflow-utils.ts`
- [ ] Implement `getWeeklySpending(userId, startDate, endDate)`
- [ ] Implement `formatCurrency(amount, currency)`
- [ ] Implement `formatBudgetAlert(budget)`
- [ ] Implement `formatWeeklySummary(spending)`

#### 5.5 Testing
- [ ] Test budget alert workflow with mock data
- [ ] Test weekly summary workflow
- [ ] Test error handling (user blocked bot)
- [ ] Verify cron schedule is correct
- [ ] Test timezone handling

### Files to Create/Modify
**New:**
- `agent/src/mastra/workflows/budget-alert-workflow.ts`
- `agent/src/mastra/workflows/weekly-summary-workflow.ts`
- `agent/src/lib/workflow-utils.ts`

**Modified:**
- `agent/src/mastra/index.ts` (register workflows)

### Dependencies
- Mastra workflow system: ✅ Built into @mastra/core
- Cron syntax: ✅ Standard cron format

### Estimated Time
**2-3 hours**

---

## Phase 6: Enhanced Query Agent (Finance Insights) ✅ COMPLETED

### Overview
Create a dedicated agent for answering natural language questions about spending using RAG and conversation context.

### Status: ✅ COMPLETED
**Completion Date:** 2025-10-19
**Details:** See [PHASE_6_COMPLETED.md](./PHASE_6_COMPLETED.md)

### Tasks

#### 6.1 Finance Insights Agent
- [x] Create `src/mastra/agents/finance-insights-agent.ts`
- [x] Define agent name and description
- [x] Write comprehensive instructions
- [x] Register tools: search-transactions-tool
- [x] Configure model: GPT-4o
- [x] Set tool choice to 'auto'

#### 6.2 Query Detection Logic
- [x] Create `src/lib/message-classifier.ts`
- [x] Implement `isTransaction(text)` function
- [x] Check for keywords: spent, paid, bought, purchase, $, etc.
- [x] Implement `isQuery(text)` function
- [x] Check for question words: how much, what, when, where, show me
- [x] Return classification: 'transaction' | 'query' | 'other'

#### 6.3 Update Bot Message Handler
- [x] Modify message handler in `src/bot.ts`
- [x] Call message classifier on incoming text
- [x] If transaction: use transaction-extractor-agent
- [x] If query: use finance-insights-agent
- [x] Pass user context (userId) to agent
- [x] Format agent response with markdown

#### 6.4 Agent Instructions
The finance insights agent should:
- [x] Use semantic search to find relevant transactions
- [x] Analyze transaction data
- [x] Provide specific numbers and insights
- [x] Cite which transactions were referenced
- [x] Offer actionable suggestions
- [x] Use friendly, conversational tone with emojis
- [x] Handle follow-up questions with context

#### 6.5 Example Queries to Support
- [x] "How much did I spend on groceries this month?"
- [x] "Where do I spend the most money?"
- [x] "Show me my coffee purchases"
- [x] "What was my biggest expense last week?"
- [x] "Am I overspending on dining out?"

#### 6.6 Testing
- [x] Test various question types
- [x] Test with different time ranges (today, this week, last month)
- [x] Test category-based queries
- [x] Test merchant-based queries
- [x] Test conversation context (follow-up questions)
- [x] Verify RAG retrieval is accurate

### Files Created
- ✅ `agent/src/mastra/agents/finance-insights-agent.ts`
- ✅ `agent/src/lib/message-classifier.ts`

### Files Modified
- ✅ `agent/src/bot.ts` (added intelligent query routing)
- ✅ `agent/src/mastra/index.ts` (registered finance-insights-agent)

### Dependencies
- ✅ Requires Phase 3 (RAG) - COMPLETED

### Actual Time Spent
**~1 hour**

---

## Summary & Timeline

### Phase Priority Order
1. ✅ **Phase 1: Receipt OCR** (2-3 hrs) - COMPLETED
2. ✅ **Phase 2: Voice Transcription** (1-2 hrs) - COMPLETED
3. ✅ **Phase 3: RAG & Semantic Search** (~2 hrs) - COMPLETED
4. ✅ **Phase 6: Query Agent** (~1 hr) - COMPLETED
5. **Phase 4: Budget Tracking** (3-4 hrs) - High value, moderate complexity - NEXT
6. **Phase 5: Workflows** (2-3 hrs) - Low priority, moderate complexity

### Total Estimated Time
**15-20 hours** (6-8 hours completed, 5-7 hours remaining)

### Progress
- ✅ Phase 1: Receipt OCR - COMPLETED
- ✅ Phase 2: Voice Transcription - COMPLETED
- ✅ Phase 3: RAG & Semantic Search - COMPLETED
- ⏸️ Phase 4: Budget Tracking - PENDING
- ⏸️ Phase 5: Workflows - PENDING
- ✅ Phase 6: Query Agent - COMPLETED

### Recommended Sequence
1. ✅ ~~Start with **Phases 1 & 2** (multi-input methods) - No DB changes, immediate user value~~
2. ✅ ~~**Phase 3** (RAG) - Foundation for intelligent queries~~
3. ✅ ~~**Phase 6** (query agent) - Natural extension of RAG~~
4. **Continue with Phase 4** (budgets) - Core feature, requires DB migration - NEXT
5. Finally **Phase 5** (workflows) - Nice-to-have automation

---

## Database Migrations Summary

### Migration 1: Add Embeddings (Phase 3)
```sql
-- Enable pgvector
-- Add embedding column to transactions
```

### Migration 2: Create Budgets Table (Phase 4)
```sql
-- Create budgets table
-- Add indexes
-- Add RLS policies
```

---

## Environment Variables Checklist

**Currently configured:**
- ✅ `TELEGRAM_BOT_TOKEN` (Phases 1, 2)
- ✅ `OPENAI_API_KEY` (Phases 1, 2, 3, 6)
- ✅ `SUPABASE_URL` (All phases)
- ✅ `SUPABASE_KEY` (All phases)

**To add:**
- [ ] `PINECONE_API_KEY` (Phase 3)
- [ ] `PINECONE_ENVIRONMENT` (Phase 3)
- [ ] `PINECONE_INDEX=hilm-transactions` (Phase 3)

---

## NPM Packages to Install

**Installed:**
- ✅ `openai` (Phase 1) - GPT-4o Vision and Whisper API

**To install:**
- [ ] `@pinecone-database/pinecone` (Phase 3) - Vector database for RAG

All other phases use existing dependencies!

---

## Testing Strategy

### Unit Tests
- [ ] Test each tool individually
- [ ] Test utility functions
- [ ] Test message classifier
- [ ] Test budget calculations

### Integration Tests
- [x] Test full transaction flow (text → extract → save)
- [x] Test receipt OCR flow (photo → extract → save)
- [x] Test voice flow (voice → transcribe → extract → save)
- [ ] Test query flow (question → search → respond)

### End-to-End Tests
- [x] Send real Telegram messages
- [x] Upload real receipts
- [x] Send real voice notes
- [ ] Ask real questions
- [ ] Set real budgets

---

## Success Criteria (All Phases Complete)

### User Experience
- ✅ Users can add transactions via text, voice, or receipt photo (text ✅, receipt ✅, voice ✅)
- ⏸️ Users can ask natural language questions about spending
- ⏸️ Users can set and track budgets
- ⏸️ Users receive automated budget alerts
- ⏸️ Users receive weekly spending summaries

### Technical
- 🟡 All tools working correctly (4/7 tools complete: extract-transaction, save-transaction, extract-receipt, transcribe-voice)
- ⏸️ Database properly structured with embeddings
- ⏸️ RAG retrieval is accurate
- ⏸️ Workflows run on schedule
- ✅ Error handling is robust (for completed features)
- ✅ No orphaned files or resources (temp file cleanup implemented)

### Code Quality
- ✅ TypeScript types are correct (no compilation errors)
- ✅ No linting errors
- ✅ Code follows project conventions
- ✅ Proper error logging
- ✅ Environment variables documented

---

## Notes

- All phases are independent except Phase 6 depends on Phase 3
- Phases 1, 2, 4 can be done in any order
- Database migrations should be tested in dev environment first
- Pinecone has a free tier (good for development/testing)
- Consider rate limiting for OpenAI API calls
- Add proper logging throughout for debugging

---

## Completed Phases

### Phase 1: Receipt OCR ✅
- **Completion Date:** 2025-10-19
- **Time Spent:** 2-3 hours
- **Status:** Fully functional
- **Details:** [PHASE_1_COMPLETED.md](./PHASE_1_COMPLETED.md)

### Phase 2: Voice Transcription ✅
- **Completion Date:** 2025-10-19
- **Time Spent:** 1-2 hours
- **Status:** Fully functional
- **Details:** [PHASE_2_COMPLETED.md](./PHASE_2_COMPLETED.md)

### Phase 3: RAG & Semantic Search ✅
- **Completion Date:** 2025-10-19
- **Time Spent:** ~2 hours
- **Status:** Fully functional
- **Details:** [PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md)

### Phase 6: Query Agent ✅
- **Completion Date:** 2025-10-19
- **Time Spent:** ~1 hour
- **Status:** Fully functional
- **Details:** [PHASE_6_COMPLETED.md](./PHASE_6_COMPLETED.md)

---

## Next Steps

1. ✅ ~~Phase 1: Receipt OCR~~ - COMPLETED
2. ✅ ~~Phase 2: Voice Transcription~~ - COMPLETED
3. ✅ ~~Phase 3: RAG & Semantic Search~~ - COMPLETED
4. ✅ ~~Phase 6: Query Agent~~ - COMPLETED
5. **NEXT:** Phase 4: Budget Tracking (3-4 hours)
   - Create budgets table in database
   - Implement check-budget and set-budget tools
   - Add budget tracking to transaction flow
   - Add /budget commands to bot
6. Phase 5: Workflows (2-3 hours)
   - Budget alert workflow (daily)
   - Weekly summary workflow

---

**Current Progress:** 4/6 phases complete (67% done)
