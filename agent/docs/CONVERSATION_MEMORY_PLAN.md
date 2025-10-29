# Conversation Memory Implementation Plan

## Problem Statement

Users need to make follow-up queries that reference previous conversation context:

**Conversation Example:**
```
User: "How much did I spend on bills this month?"
Bot: "You spent $450 on bills this month."

User: "How about dining?"  ❌ Currently fails
Expected: "You spent $320 on dining this month."  ✅ Should work
```

**Current Behavior:**
- "How about dining?" is parsed without the timeframe context ("this month")
- Bot doesn't know the user is asking about the same timeframe
- Result: Confusing response or error

**Desired Behavior:**
- Bot remembers the previous query context (category: bills, timeframe: this month)
- "How about dining?" inherits the timeframe automatically
- Natural conversation flow

---

## Current State Analysis

### What We Have ✅

1. **Mastra Agent Memory**
   - Agents support `resourceId` parameter (currently using `chatId`)
   - Mastra tracks conversation history per `resourceId`
   - Agents can access previous messages in the conversation

2. **Context Caching Infrastructure**
   - `lib/context-cache.ts` - LibSQL-based key-value cache
   - TTL support (default 300 seconds = 5 minutes)
   - Used for user profiles and aggregation results

3. **Intent Parsing**
   - `parse-intent-tool.ts` - Parses user queries into structured intents
   - `validate-intent-tool.ts` - Post-processes and fills defaults

### What We Don't Have ❌

1. **Query Context Persistence**
   - No storage of previous insight queries
   - No mechanism to inherit timeframe/filters from previous queries

2. **Follow-Up Detection**
   - No way to detect if a query is a follow-up
   - No detection of partial queries ("how about X?")

3. **Context Merging Logic**
   - No strategy for merging previous context with new query
   - No rules for what to inherit vs. what to override

---

## Architecture Design

### Option 1: Lightweight In-Memory Conversation Context ✅ (Recommended)

**Pros:**
- Simple to implement
- Fast (no database queries)
- Works with existing Mastra agent memory
- Automatic cleanup (TTL-based)

**Cons:**
- Lost on server restart (acceptable for conversational context)
- Limited to single server (fine for MVP)

**How it works:**
```
User Query → Detect Follow-Up → Merge Previous Context → Parse Intent → Save New Context
```

### Option 2: Database-Backed Conversation History

**Pros:**
- Persistent across restarts
- Can analyze conversation patterns
- Multi-server compatible

**Cons:**
- More complex
- Slower (database overhead)
- Requires schema changes

---

## Implementation Plan (Option 1)

### Phase 1: Conversation Context Storage

**File:** `lib/conversation-context.ts`

```typescript
interface ConversationContext {
  userId: string;
  chatId: number;
  lastQuery?: {
    text: string;
    intent: InsightIntent;  // Full parsed intent
    timestamp: string;
    responseGiven: boolean;
  };
  conversationStarted: string;
}

// Store context per chat
export async function saveConversationContext(
  chatId: number,
  query: string,
  intent: InsightIntent
): Promise<void>;

export async function getConversationContext(
  chatId: number
): Promise<ConversationContext | null>;

export async function clearConversationContext(
  chatId: number
): Promise<void>;
```

**Storage:**
- Use existing `context-cache.ts` with key `conversation:${chatId}`
- TTL: 600 seconds (10 minutes) - conversation expires after inactivity

---

### Phase 2: Follow-Up Detection

**File:** `lib/follow-up-detector.ts`

```typescript
interface FollowUpDetection {
  isFollowUp: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  partialQuery?: {
    type: 'category_change' | 'timeframe_change' | 'comparison' | 'elaboration';
    detectedEntity?: string;  // e.g., "dining", "yesterday"
  };
}

export function detectFollowUp(
  currentQuery: string,
  previousContext?: ConversationContext
): FollowUpDetection;
```

**Detection Heuristics:**

1. **Phrase Patterns (High Confidence)**
   - "how about X?"
   - "what about X?"
   - "and X?"
   - "also X"
   - "compared to X"
   - "vs X"

2. **Incomplete Queries (Medium Confidence)**
   - Single word: "dining", "groceries"
   - Category only: "coffee"
   - Lacks typical query signals: no "how much", "show me", etc.

3. **Reference to Previous (High Confidence)**
   - "same period"
   - "that month"
   - "as well"

4. **LLM-Based Detection (Optional Enhancement)**
   ```typescript
   // Use LLM to detect follow-ups for ambiguous cases
   const isFollowUp = await detectFollowUpWithLLM(currentQuery, previousQuery);
   ```

---

### Phase 3: Context Merging Strategy

**File:** `lib/context-merger.ts`

```typescript
export function mergeIntentWithContext(
  newIntent: QueryIntent,
  previousIntent: InsightIntent,
  followUpType: 'category_change' | 'timeframe_change' | 'comparison' | 'elaboration'
): InsightIntent;
```

**Merging Rules:**

| User Says | Previous Context | Merged Result |
|-----------|------------------|---------------|
| "how about dining?" | `{category: "bills", timeframe: "this month"}` | `{category: "dining", timeframe: "this month"}` |
| "what about yesterday?" | `{category: "bills", timeframe: "this month"}` | `{category: "bills", timeframe: "yesterday"}` |
| "and groceries?" | `{category: "bills", timeframe: "this month"}` | `{category: "groceries", timeframe: "this month"}` |
| "last week" | `{category: "bills", timeframe: "this month"}` | `{category: "bills", timeframe: "last week"}` |
| "compare to last month" | `{category: "bills", timeframe: "this month"}` | `{category: "bills", timeframe: "this month", compareTo: "last month"}` |

**Override Priority:**
1. ✅ **New entity overrides old** (e.g., new category replaces old category)
2. ✅ **Keep inherited filters** (timeframe, merchant, etc.)
3. ✅ **Explicit beats implicit** (user says "today" → overrides inherited timeframe)

---

### Phase 4: Integration into Workflow

**Update:** `mastra/workflows/telegram-routing-workflow.ts`

**Current Flow:**
```
User Query → Parse Intent → Route → Execute
```

**New Flow:**
```
User Query
    ↓
Get Previous Context (from cache)
    ↓
Detect Follow-Up?
    ↓ Yes
Merge with Previous Intent
    ↓
Parse/Validate Intent
    ↓
Route → Execute
    ↓
Save Current Context (to cache)
```

**New Step: `contextEnrichmentStep`**

```typescript
const contextEnrichmentStep = createStep({
  id: 'contextEnrichment',
  inputSchema: baseInputSchema,
  outputSchema: z.object({
    text: z.string(),
    chatId: z.number(),
    userInfo: userInfoSchema,
    conversationContext: z.any().optional(),
    isFollowUp: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { text, chatId } = inputData;

    // Load previous conversation context
    const previousContext = await getConversationContext(chatId);

    // Detect if this is a follow-up
    const followUpDetection = detectFollowUp(text, previousContext);

    return {
      ...inputData,
      conversationContext: previousContext,
      isFollowUp: followUpDetection.isFollowUp,
      followUpType: followUpDetection.partialQuery?.type,
    };
  },
});
```

**Update `intentStep`:**

```typescript
execute: async ({ inputData, mastra }) => {
  const { text, conversationContext, isFollowUp } = inputData;

  // Parse new intent
  const parseResult = await parseIntentTool.execute(...)

  // If follow-up, merge with previous context
  if (isFollowUp && conversationContext?.lastQuery) {
    const mergedIntent = mergeIntentWithContext(
      parseResult.intent,
      conversationContext.lastQuery.intent,
      inputData.followUpType
    );
    parseResult.intent = mergedIntent;
  }

  // Validate
  const validateResult = await validateIntentTool.execute(...)

  return { ...inputData, intent: validateResult.intent };
}
```

**Add Context Saving After Response:**

```typescript
const saveContextStep = createStep({
  id: 'saveContext',
  execute: async ({ inputData }) => {
    const { intent, chatId, text } = inputData;

    if (intent.kind === 'insight') {
      await saveConversationContext(chatId, text, intent);
    }

    return inputData;
  },
});
```

---

### Phase 5: User Feedback & Clarification

**Handle ambiguous follow-ups:**

```typescript
if (followUpDetection.confidence === 'low') {
  // Ask for clarification
  return {
    responseText: `Did you mean "${text}" for the same timeframe (this month)?

Reply "yes" to confirm, or rephrase your question.`
  };
}
```

**Clear context command:**

```
User: "/clear" or "start over"
→ clearConversationContext(chatId)
→ "Context cleared. Starting fresh!"
```

---

## Implementation Steps

### Step 1: Create Conversation Context Module
- [ ] Create `lib/conversation-context.ts`
- [ ] Implement `saveConversationContext()`, `getConversationContext()`
- [ ] Add types for `ConversationContext`
- [ ] Test with context-cache storage

### Step 2: Build Follow-Up Detector
- [ ] Create `lib/follow-up-detector.ts`
- [ ] Implement pattern matching for follow-up phrases
- [ ] Add confidence scoring
- [ ] Test with sample conversations

### Step 3: Implement Context Merger
- [ ] Create `lib/context-merger.ts`
- [ ] Define merging rules (category, timeframe, etc.)
- [ ] Handle edge cases (conflicting filters)
- [ ] Test merge logic

### Step 4: Integrate into Workflow
- [ ] Add `contextEnrichmentStep` to workflow
- [ ] Update `intentStep` to use conversation context
- [ ] Add `saveContextStep` after response
- [ ] Update workflow chain

### Step 5: Testing
- [ ] Unit tests for follow-up detection
- [ ] Unit tests for context merging
- [ ] Integration tests for full conversation flow
- [ ] End-to-end tests with real bot

### Step 6: User Experience
- [ ] Add `/clear` command to reset context
- [ ] Add clarification prompts for ambiguous follow-ups
- [ ] Add visual indicator (e.g., "Following up from your last query...")
- [ ] Documentation for users

---

## Example Conversations

### Scenario 1: Category Follow-Up

```
User: "How much did I spend on bills this month?"
Bot: "You spent $450 on bills this month."

[Context Saved]:
{
  lastQuery: {
    text: "How much did I spend on bills this month?",
    intent: {
      kind: "insight",
      queryType: "sum",
      filters: {
        category: "bills",
        timeframe: { text: "this month", ... }
      }
    }
  }
}

User: "how about dining?"

[Follow-Up Detected]: confidence=high, type=category_change
[Merged Intent]: {
  category: "dining",  ← NEW
  timeframe: { text: "this month", ... }  ← INHERITED
}

Bot: "You spent $320 on dining this month."
```

### Scenario 2: Timeframe Follow-Up

```
User: "Show my bills"
Bot: "You have 12 bills transactions:
- Electric: $150
- Internet: $80
- ..."

User: "from last month"

[Follow-Up Detected]: confidence=high, type=timeframe_change
[Merged Intent]: {
  category: "bills",  ← INHERITED
  timeframe: { text: "last month", ... }  ← NEW
}

Bot: "You had 10 bills transactions last month:
- Electric: $145
- ..."
```

### Scenario 3: Comparison Follow-Up

```
User: "How much on groceries this month?"
Bot: "You spent $600 on groceries this month."

User: "compared to last month"

[Follow-Up Detected]: confidence=high, type=comparison
[Merged Intent]: {
  category: "groceries",  ← INHERITED
  timeframe: { text: "this month", ... },  ← INHERITED
  compareTo: { text: "last month", ... }  ← NEW
}

Bot: "Groceries this month: $600
Groceries last month: $550
Difference: +$50 (+9.1%)"
```

---

## Technical Considerations

### Performance
- **Cache lookup:** ~5-10ms (LibSQL local query)
- **Follow-up detection:** ~1-2ms (regex matching)
- **Context merging:** <1ms (object manipulation)
- **Total overhead:** ~10-15ms per query (acceptable)

### Memory
- **Per conversation:** ~1KB (JSON context)
- **For 1000 active conversations:** ~1MB
- **Auto-cleanup:** 10 min TTL removes stale contexts

### Edge Cases

1. **Multi-turn follow-ups:**
   ```
   User: "bills this month"
   User: "how about dining?"
   User: "and last month?"  ← Applies to "dining" or "bills"?
   ```
   **Solution:** Track last 2-3 queries, use recency priority

2. **Context conflicts:**
   ```
   User: "groceries this month"
   User: "how much yesterday on coffee?"  ← Complete new query
   ```
   **Solution:** Don't treat as follow-up if confidence < medium

3. **User says "no" to clarification:**
   ```
   Bot: "Did you mean dining for this month?"
   User: "no"
   ```
   **Solution:** Clear context, ask user to rephrase

---

## Testing Strategy

### Unit Tests

```typescript
// follow-up-detector.test.ts
it('detects "how about X" as high confidence follow-up', () => {
  const result = detectFollowUp('how about dining?', previousContext);
  expect(result.isFollowUp).toBe(true);
  expect(result.confidence).toBe('high');
});

// context-merger.test.ts
it('merges category change while keeping timeframe', () => {
  const merged = mergeIntentWithContext(newIntent, previousIntent, 'category_change');
  expect(merged.filters.category).toBe('dining');
  expect(merged.filters.timeframe).toEqual(previousIntent.filters.timeframe);
});
```

### Integration Tests

```typescript
// conversation-flow.test.ts
it('handles category follow-up conversation', async () => {
  // First query
  await processQuery('how much on bills this month?', chatId);

  // Follow-up query
  const result = await processQuery('how about dining?', chatId);

  expect(result.intent.filters.category).toBe('dining');
  expect(result.intent.filters.timeframe).toBeDefined();
});
```

### Manual Testing

1. Test with bot in dev mode
2. Run conversation scenarios from examples above
3. Test edge cases (ambiguous queries, conflicts)
4. Test context expiration (wait 10 min)

---

## Rollout Plan

### Phase 1: Core Implementation (Week 1)
- Implement conversation context storage
- Build follow-up detector
- Create context merger
- Unit tests

### Phase 2: Integration (Week 2)
- Integrate into workflow
- Add context saving
- Integration tests
- Bug fixes

### Phase 3: UX Polish (Week 3)
- Add clarification prompts
- Add `/clear` command
- Add visual indicators
- User documentation

### Phase 4: Production (Week 4)
- Deploy to staging
- User testing
- Monitor metrics
- Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Follow-up detection accuracy** | >90% |
| **User satisfaction** | "Follow-ups work naturally" |
| **Latency overhead** | <20ms |
| **False positive rate** | <5% (treating non-follow-ups as follow-ups) |
| **Context usage rate** | >30% of conversations have follow-ups |

---

## Future Enhancements

1. **Multi-Step Memory**
   - Remember last 3-5 queries instead of just 1
   - Allow "go back to bills" after asking about dining

2. **LLM-Based Context Understanding**
   - Use LLM to determine what to inherit
   - Handle complex follow-ups: "how does that compare to groceries?"

3. **Cross-Session Memory**
   - Remember user preferences across sessions
   - "Show my usual categories" remembers frequently queried categories

4. **Conversation Summaries**
   - "What did we talk about?" → Summary of conversation

---

## Questions for Review

1. **TTL Duration:** Is 10 minutes appropriate for conversation context expiry?
2. **Follow-Up Confidence:** Should we always ask for clarification on medium confidence, or auto-merge?
3. **Storage:** Is LibSQL cache sufficient, or should we use Supabase for persistence?
4. **Scope:** Should we implement basic version first (no LLM), then enhance?
5. **Multi-Server:** Do we need to handle distributed context (Redis) or is single-server ok for MVP?

---

**Status:** Ready for Review & Discussion
**Estimated Effort:** 2-3 weeks full implementation
**Priority:** High (Major UX improvement)
