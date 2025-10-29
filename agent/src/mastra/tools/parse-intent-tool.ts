import { createTool } from '@mastra/core';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getCachedIntent, cacheIntent } from '../../lib/intent-cache';

// Zod schemas for intent types
const transactionIntentSchema = z.object({
  kind: z.literal('transaction'),
  action: z.enum(['log', 'amend']),
  confidence: z.enum(['high', 'medium', 'low']),
  entities: z.object({
    amount: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    merchant: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    transactionDate: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
  }),
  reason: z.string().optional(),
});

const insightIntentSchema = z.object({
  kind: z.literal('insight'),
  confidence: z.enum(['high', 'medium', 'low']),
  queryType: z.enum(['sum', 'average', 'count', 'trend', 'comparison', 'list']),
  filters: z.object({
    merchant: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    timeframe: z
      .object({
        text: z.string(),
        start: z.string(),
        end: z.string(),
        grain: z.enum(['day', 'week', 'month', 'quarter', 'year', 'custom']),
      })
      .nullable()
      .optional(),
    compareTo: z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        label: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    minAmount: z.number().nullable().optional(),
    maxAmount: z.number().nullable().optional(),
    lastN: z.number().nullable().optional(),
  }),
  followUps: z.array(z.string()).optional(),
  question: z.string().nullable().optional(),
  reason: z.string().optional(),
});

const otherIntentSchema = z.object({
  kind: z.literal('other'),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});

const intentSchema = z.discriminatedUnion('kind', [
  transactionIntentSchema,
  insightIntentSchema,
  otherIntentSchema,
]);

export const parseIntentTool = createTool({
  id: 'parse-intent',
  description:
    'Parse user messages into structured financial intents (transaction, insight, or other). Supports multilingual inputs and natural language variations.',
  inputSchema: z.object({
    text: z.string().describe('The user message to parse'),
    referenceDate: z
      .string()
      .optional()
      .describe('ISO datetime for resolving relative dates (e.g., "yesterday")'),
    userId: z.string().optional().describe('User ID for context (optional)'),
  }),
  outputSchema: z.object({
    intent: intentSchema,
    diagnostics: z.object({
      usedLLM: z.boolean(),
      cacheHit: z.boolean(),
      latencyMs: z.number().optional(),
    }),
  }),
  execute: async ({ context }) => {
    const { text, referenceDate, userId } = context;
    const startTime = Date.now();

    // Handle empty input
    if (!text || text.trim().length === 0) {
      return {
        intent: {
          kind: 'other' as const,
          confidence: 'high' as const,
          reason: 'Empty message',
        },
        diagnostics: {
          usedLLM: false,
          cacheHit: false,
          latencyMs: Date.now() - startTime,
        },
      };
    }

    const normalized = text.trim();

    // Check cache
    const cached = await getCachedIntent(normalized);
    if (cached) {
      return {
        intent: cached,
        diagnostics: {
          usedLLM: true,
          cacheHit: true,
          latencyMs: Date.now() - startTime,
        },
      };
    }

    // Parse reference date
    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const refDateIso = refDate.toISOString();

    try {
      const { text: response } = await generateText({
        model: openai('gpt-4o-mini'),
        temperature: 0.1,
        maxOutputTokens: 1000,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: `REFERENCE_DATETIME: ${refDateIso}\n\nUSER_MESSAGE:\n${text}`,
          },
        ],
      });

      // Parse and validate LLM response
      const cleaned = response
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');
      const parsed = JSON.parse(cleaned);
      const validated = intentSchema.parse(parsed);

      // Cache the result
      await cacheIntent(normalized, validated);

      return {
        intent: validated,
        diagnostics: {
          usedLLM: true,
          cacheHit: false,
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('parse-intent-tool error:', error);

      // Fallback to basic classification
      const fallbackIntent = basicFallback(text);

      return {
        intent: fallbackIntent,
        diagnostics: {
          usedLLM: false,
          cacheHit: false,
          latencyMs: Date.now() - startTime,
        },
      };
    }
  },
});

function buildSystemPrompt(): string {
  return `You are Hilm.ai's multilingual financial intent parser. Parse user messages into structured JSON.

OUTPUT FORMAT (JSON only, no prose):
{
  "kind": "transaction" | "insight" | "other",
  "confidence": "high" | "medium" | "low",
  "action": "log" | "amend",                    // transaction only
  "entities": { ... },                          // transaction only
  "queryType": "sum|average|count|...",         // insight only
  "filters": { ... },                           // insight only
  "followUps": ["suggestion1", "suggestion2"],  // insight only
  "question": "original question",              // insight only
  "reason": "brief explanation"
}

---
TRANSACTION INTENTS
Indicators: Spending actions (spent, paid, bought, purchased, اشتريت, pagué)

Rules:
- Extract amount (number only, no symbols)
- Extract currency (ISO 4217: USD, EUR, GBP, AED, SAR, EGP) - default USD
- Extract merchant (business name after "at", "from", "in")
- Infer category from context:
  * groceries: supermarkets, grocery stores, markets
  * dining: restaurants, cafes, coffee, meals
  * transport: uber, taxi, gas, public transit
  * shopping: retail, clothes, fashion
  * bills: utilities, rent, subscriptions
  * entertainment: movies, streaming, concerts
  * healthcare: pharmacy, doctor, clinic
  * education: courses, school, tuition
  * travel: flights, hotels, airbnb
  * other: if unclear
- Parse transactionDate relative to REFERENCE_DATETIME
  * "yesterday" → REFERENCE_DATETIME minus 1 day
  * "last week" → previous week (Monday-Sunday)
  * "today" → REFERENCE_DATETIME date
  * Return ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Set confidence:
  * high: amount + merchant/category present
  * medium: amount present but missing context
  * low: unclear or ambiguous

Examples:
Input: "Spent $45 at Trader Joe's yesterday"
Output: {"kind":"transaction","action":"log","confidence":"high","entities":{"amount":45,"currency":"USD","merchant":"Trader Joe's","category":"groceries","transactionDate":"2025-02-14T00:00:00.000Z"}}

Input: "اشتريت قهوة بـ 20 درهم"
Output: {"kind":"transaction","action":"log","confidence":"high","entities":{"amount":20,"currency":"AED","merchant":null,"category":"dining","description":"قهوة"}}

---
INSIGHT INTENTS
Indicators: Questions about spending (how much, what did I, show me, كم صرفت)

Rules:
- Determine queryType:
  * sum: "how much", "total", "spent"
  * average: "average", "typical"
  * count: "how many", "number of"
  * trend: "over time", "trajectory", "pattern"
  * comparison: "vs", "compared to", "than last"
  * list: "show", "list", "display"
- Extract filters:
  * merchant: specific business name
  * category: from query text
  * timeframe: parse relative to REFERENCE_DATETIME
    - "today" → start/end of current day
    - "yesterday" → previous day
    - "this week" → current Monday-Sunday
    - "last week" → previous Monday-Sunday
    - "this month" → current month (1st to last day)
    - "last month" → previous month
    - "last 7 days" → REFERENCE_DATETIME minus 7 days to now
    - Return: {text, start (ISO), end (ISO), grain: "day|week|month|quarter|year|custom"}
  * compareTo: for comparison queries, derive previous period
  * minAmount/maxAmount: if mentioned
  * lastN: "last 5 transactions" → {lastN: 5}
- Generate followUps: 2-3 helpful suggestions in user's language
- Store original question
- Set confidence:
  * high: clear query type + filters
  * medium: query type clear but filters ambiguous
  * low: unclear intent

Examples:
Input: "How much did I spend on groceries last month?"
Output: {"kind":"insight","confidence":"high","queryType":"sum","filters":{"category":"groceries","timeframe":{"text":"last month","start":"2025-01-01T00:00:00.000Z","end":"2025-01-31T23:59:59.999Z","grain":"month"}},"followUps":["Show top merchants?","Compare to previous month?"],"question":"How much did I spend on groceries last month?"}

Input: "Show my last 10 coffee transactions"
Output: {"kind":"insight","confidence":"high","queryType":"list","filters":{"category":"dining","lastN":10},"question":"Show my last 10 coffee transactions"}

---
OTHER INTENTS
Use for: greetings, commands, unclear messages, chitchat

Examples:
Input: "hello"
Output: {"kind":"other","confidence":"high","reason":"Greeting"}

Input: "/start"
Output: {"kind":"other","confidence":"high","reason":"Bot command"}

---
IMPORTANT:
- Support ALL languages (English, Arabic, Spanish, French, etc.)
- Handle typos gracefully ("yasterday" → yesterday)
- Default to USD if currency unclear
- Default category to "other" if unclear
- Use REFERENCE_DATETIME for all relative dates
- Return ONLY valid JSON (no markdown, no prose)
- If uncertain, prefer "other" kind with clear reason`;
}

function basicFallback(text: string): z.infer<typeof intentSchema> {
  const lower = text.toLowerCase();

  // Check for transaction indicators
  const hasAmount = /\d+/.test(text);
  const hasSpendingVerb = /\b(spent|paid|bought|purchased|pay|اشتريت)\b/i.test(text);

  if (hasAmount && hasSpendingVerb) {
    return {
      kind: 'transaction',
      action: 'log',
      confidence: 'low',
      entities: {
        description: text,
      },
      reason: 'Fallback: detected amount + spending verb',
    };
  }

  // Check for query indicators
  const hasQuestionWord = /^(how|what|show|list|كم|ما)\b/i.test(lower);
  const hasQuestionMark = text.includes('?');

  if (hasQuestionWord || hasQuestionMark) {
    return {
      kind: 'insight',
      confidence: 'low',
      queryType: 'sum',
      filters: {},
      question: text,
      reason: 'Fallback: detected question pattern',
    };
  }

  return {
    kind: 'other',
    confidence: 'low',
    reason: 'Fallback: no clear indicators',
  };
}
