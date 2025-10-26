# Agent Flow Revamp – Implementation Plan

## Objective
Deliver a faster, more reliable Telegram assistant that can capture transactions instantly and answer any natural-language finance query (category totals, time spans, comparisons, trends) with <5 s p95 latency. The end state is a modular workflow that parses intent, runs semantic search and SQL aggregations in parallel, composes insightful responses with source citations, and logs everything asynchronously for observability—all while keeping user trust through accurate numbers and resilient fallbacks.

## 1. Intent Parser Layer (Week 1)
**Goal:** normalize every message into actionable intent objects without rewriting downstream tools.  
**Tasks & Tools**
- Implement `src/lib/query-intent.ts` using:
  - Deterministic grammar/rule checks (chrono-node for dates, regex for keywords).
  - Optional LLM fallback via `openai('gpt-4o-mini')` when rules are unsure; cache results in libSQL.
- Define TypeScript types for intents and entities; update workflow to consume them.
- Add Jest/Vitest tests for representative utterances.
**Approach:** refactor—the parser sits in front of the current routing logic, replacing ad-hoc parsing.

## 2. Tooling Enhancements (Week 1–2)
**Goal:** extend existing search/save tools rather than rewriting from scratch.  
**Tasks & Tools**
- **Semantic Search Tool** (`search-transactions-tool.ts`):
  - Add optional `startDate`, `endDate`, `merchant`, `category` filters passed to Pinecone metadata + Supabase fallback.
  - Store normalized timestamps during `save-transaction-tool` upserts.
- **Aggregation Tool** (new file `aggregation-tool.ts`):
  - Use Supabase SQL (RPC or views) for totals, averages, counts, comparisons, trend buckets.
  - Support parameters derived from parser output.
- **Context Fetcher**:
  - Add `context-cache.ts` leveraging libSQL/Redis for user profile + cached aggregates.
**Approach:** refactor existing tools for filters; add new aggregation/context files integrated through existing Mastra tool patterns.

## 3. Parallel Workflow Refactor (Week 2)
**Goal:** restructure current workflow using Mastra’s `parallel` node, not a full rewrite.  
**Tasks & Tools**
- Modify `telegram-routing-workflow.ts`:
  - Step 1: Intent parser node (new module).
  - Step 2a: Transaction capture branch (reuse extractor/save tools) → immediate response.
  - Step 2b: Insight branch enters `parallel` node launching:
    - Semantic search tool call.
    - Aggregation tool call.
    - Context fetch/caching task.
  - Step 3: `Promise.all`-style merge feeding a composer node.
- Ensure fallbacks happen within each branch so a failure doesn’t block others.
- Review Mastra’s “agent networks” pattern (see `routingAgent` example where an agent lists `workflows: { cityWorkflow }`) to decide whether we expose the new parallel workflow behind a routing agent. If the LLM-driven router can decide between transaction capture and insight workflows, we may replace parts of the manual branching with this network approach for better extensibility.
**Approach:** refactor—the workflow file is reorganized but reuses existing agents/tools; adjust architecture after doc review if agent-driven workflow calls offer a latency win.

## 4. Composer Agent & Response Layer (Week 2–3)
**Goal:** centralize response formatting while keeping tooling modular.  
**Tasks & Tools**
- Create `insight-composer-agent.ts` referencing openai (`gpt-4o`) or `gpt-4o-mini` depending on context size.
- The agent ingests structured payload `{intent, semanticResults, aggregates, context}` and outputs response text, citations, and follow-up prompts.
- Add fallback logic: if inputs are incomplete, ask clarifying questions or send interim acknowledgment and edit later.
- Implement asynchronous post-processing queue (BullMQ/Redis or simple background job) that handles Langfuse logging, analytics, and cache updates without blocking replies.
**Approach:** mostly new files but integrated via existing Mastra agent registration.

## 5. Performance & Reliability (Week 3)
**Goal:** optimize the refactored system for speed and robustness.  
**Tasks & Tools**
- Introduce caching layers:
  - LRU (in-memory) for last N semantic queries per user.
  - Redis/libSQL tables for aggregated metrics snapshots (monthly totals, top merchants).
- Tune external calls:
  - Use smaller models for intent parsing, switch Pinecone queries to lower dimensions if possible.
  - Batch Supabase read/writes where feasible.
- Set up circuit breakers/timeouts (e.g., `p-timeout`) for each tool call; gracefully degrade if any branch exceeds thresholds.
- Load test via k6 or artillery hitting the Telegram webhook with scripted scenarios.
**Approach:** refactor + incremental additions; no full rebuild.

## 6. Verification & Rollout (Week 3–4)
**Goal:** validate functionality end-to-end and ship safely.  
**Tasks & Tools**
- Build a regression suite:
  - Transaction capture (text, receipt, voice) scenarios.
  - Insight queries (categories, merchants, time spans, comparisons, trends).
  - Error handling and fallback coverage.
- Update `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, and architecture diagrams to reflect the new flow.
- Rollout plan:
  1. Shadow mode (new workflow runs but responses are hidden/logged).
  2. Beta flag for internal accounts.
  3. Gradual ramp to all users with telemetry alerts.
- Monitor post-launch metrics; set automated rollback triggers if latency or error rate spikes.
**Approach:** refactor-based release; keep old workflow behind a feature flag until the new path proves stable.

## 7. Instrument & Benchmark (Post-Build)
**Goal:** once the new agents/tools land, add deep instrumentation to verify improvements and catch regressions.  
**Tasks & Tools**
- Insert high-resolution timers around each new workflow node using OpenTelemetry spans (`@opentelemetry/api`) + Langfuse annotations.
- Capture structured logs (Pino) with intent metadata, tool timings, cache hits, and response sizes.
- Build dashboards (Langfuse + SigNoz) comparing old vs. new p50/p95 latency and error rates; set alert thresholds.
**Approach:** wrap the refactored workflow with instrumentation after functionality stabilizes so measurements reflect the final architecture.

## Risks & Mitigations
- **Model costs**: mitigate via caching + lightweight classifiers.
- **Inconsistent schemas**: enforce migrations for Pinecone metadata + Supabase views before rollout.
- **Latency regressions**: add circuit breakers; fall back to simplified responses if any branch exceeds timeout.
