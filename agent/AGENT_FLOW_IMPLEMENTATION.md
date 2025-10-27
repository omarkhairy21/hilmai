# Agent Flow Revamp – Implementation Plan

## Objective
Deliver a faster, more reliable Telegram assistant that can capture transactions instantly and answer any natural-language finance query (category totals, time spans, comparisons, trends) with <5 s p95 latency. The end state is a modular workflow that parses intent, runs semantic search and SQL aggregations in parallel, composes insightful responses with source citations, and logs everything asynchronously for observability—all while keeping user trust through accurate numbers and resilient fallbacks.

## 1. Intent Parser Layer (Week 1) — ✅ Completed
**Goal:** normalize every message into actionable intent objects without rewriting downstream tools.  
**What shipped**
- Implemented `src/lib/intent-types.ts` plus `src/lib/query-intent.ts` with chrono-node rules, regex heuristics, and an OpenAI fallback that caches to libSQL (`intent-cache.ts`, `libsql-client.ts`).
- Added explicit handling for “till now/so far” phrasing so open-ended spans don’t clamp to a single timestamp.
- Created `src/__tests__/query-intent.test.ts` to lock down transaction vs. insight routing and date parsing edge cases.
**Next**
- Expand fixtures for receipts/voice intents once those surfaces are wired into the parser.

## 2. Tooling Enhancements (Week 1–2) — ✅ Completed
**Goal:** extend existing search/save tools rather than rewriting from scratch.  
**What shipped**
- `search-transactions-tool.ts` now accepts optional start/end dates, merchant, and category filters. Dates are enforced inside Supabase queries while Pinecone relies on normalized metadata (`save-transaction-tool.ts` now stores `normalizedDate`, lower-cased merchant/category).
- Added `aggregation-tool.ts` that calls new Supabase RPCs (`supabase/schema.sql`) for totals, averages, counts, comparisons, and trends, with libSQL caching via `context-cache.ts`.
- Created a shared context cache to memoize user profile lookups + aggregates for a few minutes, reducing DB pressure.
**Next**
- None – tooling is ready for first deploy once production data flows in.

## 3. Parallel Workflow Refactor (Week 2) — ✅ Completed
**Goal:** restructure current workflow using Mastra’s `parallel` node, not a full rewrite.  
**What shipped**
- `telegram-routing-workflow.ts` runs `intentParser` → `routeIntent`, then fans out to `semanticSearch`, `aggregateMetrics`, and `contextFetch` in parallel before handing everything to the composer step.
- Transaction intents still short-circuit to the extractor agent for low latency.
- Each branch has localized fallbacks (e.g., semantic search failure no longer blocks aggregate responses).
**Next**
- Evaluate routing-agent pattern later; current explicit branching is stable enough for beta.

## 4. Composer Agent & Response Layer (Week 2–3) — ✅ Completed (MVP)
**Goal:** centralize response formatting while keeping tooling modular.  
**What shipped**
- Added `insight-composer-agent.ts` using `gpt-4o` to ingest `{intent, diagnostics, semanticResults, aggregates, context}` and craft friendly answers with follow-up nudges.
- Added guardrails inside the composer step so missing tool output results in honest fallbacks instead of fabricated numbers.
- Logging hooks capture diagnostic info (rules fired, cache hits) for observability.
**Next**
- Still need the async post-processing queue for Langfuse-side logging and analytics enrichment.

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
