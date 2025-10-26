# hilm.ai - Implementation Plan

## Current Status

**Completed Features:**
- ✅ Transaction extraction (text, receipt photos, voice messages)
- ✅ RAG & Semantic Search (Pinecone + embeddings)
- ✅ Query Agent (natural language Q&A)
- ✅ Deployed to production (Coolify)

**Current Issues:**
- ⚠️ Langfuse: Configured but no traces visible
- ⚠️ SigNoz: Deployed, some logs visible, webhook logs missing
- ⚠️ SigNoz dashboard needs configuration

**Remaining Work:**
- Phase 3.5: Fix observability (4-6 hrs)
- Phase 4: Budget tracking (3-4 hrs)
- Phase 5: Workflows & automation (2-3 hrs)

---

## Completed Phases Summary

### Phase 1: Receipt OCR ✅
- GPT-4o Vision for receipt scanning
- Auto-extract amount, merchant, category, items
- See [PHASE_1_COMPLETED.md](./PHASE_1_COMPLETED.md)

### Phase 2: Voice Transcription ✅
- Whisper API for voice-to-text
- Multi-language support
- See [PHASE_2_COMPLETED.md](./PHASE_2_COMPLETED.md)

### Phase 3: RAG & Semantic Search ✅
- Pinecone vector database
- OpenAI embeddings (text-embedding-3-large)
- Semantic transaction search
- See [PHASE_3_COMPLETED.md](./PHASE_3_COMPLETED.md)

### Phase 6: Query Agent ✅
- Natural language spending queries
- Uses RAG for accurate results
- See [PHASE_6_COMPLETED.md](./PHASE_6_COMPLETED.md)

---

## Phase 3.5: Fix Observability 🟡 IN PROGRESS

### Status
- ✅ Bot deployed to production (Coolify)
- ✅ SigNoz deployed and showing some logs
- ⚠️ Langfuse configured but traces not visible
- ⚠️ Webhook logs missing in SigNoz
- ⚠️ Dashboard needs configuration

### Tasks

#### 1. Fix Langfuse Tracing (Priority 1)
- [ ] Verify Langfuse environment variables in production
- [ ] Check Langfuse server logs for incoming requests
- [ ] Add debug logging to Langfuse exporter initialization
- [ ] Test Langfuse connection independently
- [ ] Review Mastra observability configuration in [agent/src/mastra/index.ts](agent/src/mastra/index.ts)

**Possible causes:**
- Environment variables not set correctly
- Network connectivity issues
- Mastra/Langfuse SDK integration problem
- Authentication/API key issues

#### 2. Fix SigNoz Webhook Logs (Priority 2)
- [ ] Add explicit logging to webhook handler
- [ ] Verify webhook handler logs to stdout/stderr
- [ ] Check SigNoz log collection configuration
- [ ] Review SigNoz data sources and pipelines
- [ ] Test webhook endpoint and verify logs generated

**Possible causes:**
- Log level filtering
- Missing instrumentation for webhook handler
- Log collection configuration issue

#### 3. Configure SigNoz Dashboards (Priority 3)
- [ ] Create dashboard for transaction flow monitoring
- [ ] Add metrics for bot performance (response time, error rate)
- [ ] Create webhook monitoring dashboard
- [ ] Set up alerts for critical errors
- [ ] Configure log retention policies
- [ ] Set up trace correlation with logs

### Files to Check
- [agent/src/mastra/index.ts](agent/src/mastra/index.ts) - Langfuse config
- [agent/src/bot.ts](agent/src/bot.ts) - Webhook handler logging
- `agent/.env` - Environment variables

### Time Estimate
**4-6 hours**

---

## Phase 4: Budget Tracking ⏸️ PENDING

### Goal
Allow users to set budgets by category and get alerts when spending limits are reached.

### Tasks

#### Database
- [ ] Create `budgets` table (id, user_id, category, limit, period, current_spent)
- [ ] Migration: `supabase/migrations/create_budgets_table.sql`

#### Tools
- [ ] Create `check-budget-tool.ts` - Calculate spending vs limit
- [ ] Create `set-budget-tool.ts` - Set/update budget limits
- [ ] Create `budget-utils.ts` - Helper functions

#### Bot Integration
- [ ] Add `/setbudget <category> <amount> <period>` command
- [ ] Add `/budgets` command to view all budgets
- [ ] Show budget status after each transaction (e.g., "✅ $50/$200 (25%)")
- [ ] Update `/help` command

#### Optional: Budget Agent
- [ ] Natural language budget setting: "Set my groceries budget to $500 per month"

### Time Estimate
**3-4 hours**

---

## Phase 5: Workflows & Automation ⏸️ PENDING

### Goal
Automated notifications for budget alerts and weekly spending summaries.

### Tasks

#### Budget Alert Workflow
- [ ] Create `budget-alert-workflow.ts`
- [ ] Schedule: Daily at 8 PM
- [ ] Check all user budgets and send alerts for warning/exceeded (⚠️/🚨)

#### Weekly Summary Workflow
- [ ] Create `weekly-summary-workflow.ts`
- [ ] Schedule: Sunday at 6 PM
- [ ] Calculate weekly spending by category
- [ ] Generate insights and send summary message

#### Utilities
- [ ] Create `workflow-utils.ts` - Helper functions for workflows
- [ ] Register workflows in [agent/src/mastra/index.ts](agent/src/mastra/index.ts)

### Time Estimate
**2-3 hours**

---

## Summary

### Work Priority
1. **CURRENT:** Phase 3.5 - Fix observability (4-6 hrs)
   - Debug Langfuse tracing
   - Fix SigNoz webhook logs
   - Configure dashboards

2. **NEXT:** Phase 4 - Budget tracking (3-4 hrs)
3. **LATER:** Phase 5 - Workflows & automation (2-3 hrs)

### Total Time Remaining
**9-13 hours**

### Progress
- ✅ Core features (4 phases) - COMPLETED
- 🟡 Observability - DEPLOYED, needs fixes
- ⏸️ Budget tracking - PENDING
- ⏸️ Automation - PENDING
