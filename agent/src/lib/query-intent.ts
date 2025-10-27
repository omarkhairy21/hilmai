import * as chrono from 'chrono-node';
import { openai as openaiModel } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { cacheIntent, getCachedIntent } from './intent-cache';
import type {
  DateGrain,
  DateRange,
  InsightFilters,
  InsightIntent,
  InsightQueryType,
  IntentConfidence,
  IntentParseResult,
  QueryIntent,
  TransactionIntent,
} from './intent-types';

export interface IntentParserOptions {
  referenceDate?: Date;
  disableLLMFallback?: boolean;
}

interface DetectionResult<T extends QueryIntent> {
  score: number;
  intent: T;
  rules: string[];
}

type ParsedDateResult = {
  start?: { date(): Date };
  end?: { date(): Date };
  text?: string;
};

const transactionVerbs = [
  'spent',
  'pay',
  'paid',
  'bought',
  'purchase',
  'purchased',
  'transfer',
  'tip',
  'charge',
];

const querySignals = [
  'how much',
  'how many',
  'show me',
  'list',
  'display',
  'what did i spend',
  'compare',
  'versus',
  'vs',
  'trend',
  'increase',
  'decrease',
  'summary',
  '?',
];

const metricKeywords: Record<InsightQueryType, string[]> = {
  sum: ['how much', 'total', 'overall', 'spend', 'spent', 'sum'],
  average: ['average', 'avg', 'typical'],
  count: ['how many', 'count', 'number of'],
  trend: ['trend', 'over time', 'trajectory'],
  comparison: ['compare', 'vs', 'versus', 'difference', 'than last'],
  list: ['show', 'list', 'transactions', 'display'],
};

const OPEN_ENDED_REGEX = /\b(?:til|till|until)\s+now\b|\bso far\b|\bto date\b|\bto today\b|\bup to now\b|\bthrough now\b/i;

const categoryKeywords: Record<string, string[]> = {
  groceries: ['grocery', 'groceries', 'supermarket', 'market', 'trader joe', 'whole foods'],
  dining: ['dining', 'restaurant', 'food', 'meal', 'coffee', 'cafe', 'dinner', 'lunch', 'breakfast'],
  transport: ['transport', 'uber', 'lyft', 'taxi', 'bus', 'train', 'gas', 'fuel'],
  shopping: ['shopping', 'retail', 'store', 'mall', 'fashion', 'clothes'],
  bills: ['bill', 'bills', 'utility', 'utilities', 'electric', 'internet', 'rent', 'subscription'],
  entertainment: ['entertainment', 'movie', 'cinema', 'concert', 'streaming', 'netflix'],
  healthcare: ['health', 'doctor', 'pharmacy', 'medicine', 'clinic', 'hospital'],
  education: ['education', 'school', 'course', 'tuition', 'class'],
  travel: ['travel', 'flight', 'hotel', 'airbnb', 'ticket'],
};

const currencySymbolMap: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  'د.إ': 'AED',
  'ر.س': 'SAR',
  '﷼': 'SAR',
  '₤': 'GBP',
};

const currencyKeywordMap: Record<string, string> = {
  usd: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  gbp: 'GBP',
  pound: 'GBP',
  pounds: 'GBP',
  egp: 'EGP',
  egpounds: 'EGP',
  aed: 'AED',
  dirham: 'AED',
  dirhams: 'AED',
  sar: 'SAR',
  riyal: 'SAR',
  riyals: 'SAR',
};

const llmModel = openaiModel('gpt-4o-mini');

export const parseQueryIntent = async (
  message: string,
  options?: IntentParserOptions
): Promise<IntentParseResult> => {
  const normalized = message.trim();
  const diagnostics = {
    rulesFired: [] as string[],
    usedLLM: false,
    cacheHit: false,
  };

  if (!normalized) {
    return {
      intent: {
        kind: 'other',
        confidence: 'high',
        reason: 'Empty message',
      },
      diagnostics,
    };
  }

  const referenceDate = options?.referenceDate ?? new Date();
  const parsedDates = chrono.parse(normalized, referenceDate) as ParsedDateResult[];

  const transactionCandidate = detectTransactionIntent(normalized, parsedDates);
  const insightCandidate = detectInsightIntent(normalized, parsedDates);

  let selected: QueryIntent | null = null;
  let selectedRules: string[] = [];

  if (
    transactionCandidate &&
    (!insightCandidate || transactionCandidate.score >= insightCandidate.score)
  ) {
    selected = transactionCandidate.intent;
    selectedRules = transactionCandidate.rules;
  } else if (insightCandidate) {
    selected = insightCandidate.intent;
    selectedRules = insightCandidate.rules;
  }

  if (!selected) {
    selected = {
      kind: 'other',
      confidence: 'low',
      reason: 'Unable to classify message intent via rules',
    };
  }

  diagnostics.rulesFired.push(...selectedRules);

  if (selected.confidence === 'low' && !options?.disableLLMFallback) {
    const cached = await getCachedIntent(normalized);
    if (cached) {
      diagnostics.cacheHit = true;
      return {
        intent: cached,
        diagnostics,
      };
    }

    if (process.env.OPENAI_API_KEY) {
      const llmIntent = await generateIntentWithLLM(normalized);
      if (llmIntent) {
        diagnostics.usedLLM = true;
        await cacheIntent(normalized, llmIntent);
        return {
          intent: llmIntent,
          diagnostics,
        };
      }
    }
  }

  return {
    intent: selected,
    diagnostics,
  };
};

const detectTransactionIntent = (
  message: string,
  parsedDates: ParsedDateResult[]
): DetectionResult<TransactionIntent> | null => {
  const lower = message.toLowerCase();
  const rules: string[] = [];

  const amountInfo = extractAmount(message);
  if (amountInfo) {
    rules.push('transaction:amount');
  }

  const hasVerb = transactionVerbs.some((verb) => lower.includes(verb));
  if (hasVerb) {
    rules.push('transaction:verb');
  }

  const merchant = extractMerchant(message);
  if (merchant) {
    rules.push('transaction:merchant');
  }

  const category = detectCategory(lower);
  if (category) {
    rules.push('transaction:category');
  }

  const dateRange = extractDateRange(parsedDates);
  if (dateRange) {
    rules.push('transaction:date');
  }

  if (!amountInfo && !(hasVerb && merchant)) {
    return null;
  }

  let score = 0;
  if (amountInfo) score += 2;
  if (hasVerb) score += 1.5;
  if (merchant) score += 1;
  if (category) score += 0.5;
  if (dateRange) score += 0.5;

  const confidence = score >= 3.5 ? 'high' : score >= 2 ? 'medium' : 'low';

  const intent: TransactionIntent = {
    kind: 'transaction',
    action: 'log',
    confidence,
    entities: {
      amount: amountInfo?.amount,
      currency: amountInfo?.currency || 'USD',
      merchant: merchant || undefined,
      category: category || undefined,
      transactionDate: dateRange?.start,
      description: message,
    },
  };

  return {
    score,
    intent,
    rules,
  };
};

const normalizeRangeForOpenEnded = (
  lowerMessage: string,
  range?: DateRange
): { range?: DateRange; startDate?: string; endDate?: string } => {
  if (!range) {
    return { range: undefined, startDate: undefined, endDate: undefined };
  }

  if (!OPEN_ENDED_REGEX.test(lowerMessage)) {
    return { range, startDate: range.start, endDate: range.end };
  }

  return {
    range,
    startDate: undefined,
    endDate: range.end,
  };
};

const detectInsightIntent = (
  message: string,
  parsedDates: ParsedDateResult[]
): DetectionResult<InsightIntent> | null => {
  const lower = message.toLowerCase();
  const rules: string[] = [];

  const hasSignal = querySignals.some((signal) => lower.includes(signal));
  if (!hasSignal) {
    return null;
  }

  const queryType = detectQueryType(lower);
  rules.push(`insight:queryType:${queryType}`);

  const dateRange = extractDateRange(parsedDates);
  if (dateRange) {
    rules.push('insight:timeframe');
  }

  const merchant = extractMerchant(message);
  if (merchant) {
    rules.push('insight:merchant');
  }

  const category = detectCategory(lower);
  if (category) {
    rules.push('insight:category');
  }

  let score = 0;
  if (queryType === 'sum' || queryType === 'average') score += 2;
  if (queryType === 'trend' || queryType === 'comparison') score += 2.5;
  if (dateRange) score += 1;
  if (merchant) score += 0.5;
  if (category) score += 0.5;

  const confidence = score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low';

  const normalizedRange = normalizeRangeForOpenEnded(lower, dateRange);

  const filters: InsightFilters = {
    merchant: merchant || undefined,
    category: category || undefined,
    timeframe: normalizedRange.range || undefined,
    ...(normalizedRange.startDate ? { startDate: normalizedRange.startDate } : {}),
    ...(normalizedRange.endDate ? { endDate: normalizedRange.endDate } : {}),
  };

  if ((queryType === 'comparison' || lower.includes('vs') || lower.includes('than last')) && dateRange) {
    filters.compareTo = derivePreviousRange(dateRange);
    rules.push('insight:comparison:auto');
  }

  const intent: InsightIntent = {
    kind: 'insight',
    confidence,
    queryType,
    filters,
    question: message,
    followUps: [],
  };

  return {
    score,
    intent,
    rules,
  };
};

const extractAmount = (message: string) => {
  const symbolRegex = /([$€£]|د\.?إ|ر\.?س|﷼)\s?([\d.,]+)/i;
  const keywordRegex =
    /([\d.,]+)\s?(usd|dollars?|eur|euros?|gbp|pounds?|aed|dirhams?|sar|riyals?|egp)/i;
  const plainRegex = /(?:spent|pay(?:ed)?|paid|bought)\s+([\d.,]+)/i;

  const symbolMatch = message.match(symbolRegex);
  if (symbolMatch) {
    return {
      amount: toNumber(symbolMatch[2]),
      currency: currencySymbolMap[symbolMatch[1]] || 'USD',
    };
  }

  const keywordMatch = message.match(keywordRegex);
  if (keywordMatch) {
    const unit = keywordMatch[2].toLowerCase().replace(/s$/, '');
    return {
      amount: toNumber(keywordMatch[1]),
      currency: currencyKeywordMap[unit] || 'USD',
    };
  }

  const plainMatch = message.match(plainRegex);
  if (plainMatch) {
    return {
      amount: toNumber(plainMatch[1]),
      currency: 'USD',
    };
  }

  return null;
};

const toNumber = (value: string) => Number(value.replace(/,/g, ''));

const extractMerchant = (message: string) => {
  const merchantRegex = /\b(?:at|from|in|to)\s+([A-Za-z0-9][A-Za-z0-9 &'’.-]{2,40})/i;
  const match = message.match(merchantRegex);
  if (!match) return null;

  const merchant = match[1].trim();
  if (merchant.length < 2) return null;

  // Stop at connectors like "for" or "on"
  return merchant.split(/\b(for|on|because|since)\b/i)[0].trim();
};

const detectCategory = (lower: string) => {
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return null;
};

const extractDateRange = (parsedDates: ParsedDateResult[]): DateRange | undefined => {
  if (!parsedDates || parsedDates.length === 0) {
    return undefined;
  }
  const best = parsedDates[0];
  if (!best.start) {
    return undefined;
  }

  const start = best.start.date();
  const end = best.end?.date() ?? best.start.date();
  const grain = inferGrain(best.text?.toLowerCase() || '');

  return {
    text: best.text ?? '',
    start: start.toISOString(),
    end: end.toISOString(),
    grain,
  };
};

const inferGrain = (text: string): DateGrain => {
  if (text.includes('quarter')) return 'quarter';
  if (text.includes('year')) return 'year';
  if (text.includes('month')) return 'month';
  if (text.includes('week')) return 'week';
  if (text.includes('day') || text.includes('today') || text.includes('yesterday')) return 'day';
  return 'custom';
};

const detectQueryType = (lower: string): InsightQueryType => {
  for (const [type, keywords] of Object.entries(metricKeywords)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return type as InsightQueryType;
    }
  }
  return 'sum';
};

const derivePreviousRange = (range: DateRange) => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const duration = end.getTime() - start.getTime();
  const compareEnd = new Date(start.getTime() - 1);
  const compareStart = new Date(compareEnd.getTime() - duration);

  return {
    startDate: compareStart.toISOString(),
    endDate: compareEnd.toISOString(),
    label: 'previous_period',
  };
};

const generateIntentWithLLM = async (message: string): Promise<QueryIntent | null> => {
  try {
    const { text } = await generateText({
      model: llmModel,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are an intent parser for a finance assistant. Convert the user's message into JSON with this schema:
{
  "kind": "transaction" | "insight" | "other",
  "confidence": "high" | "medium" | "low",
  "action": "log" | "amend" (only for transaction),
  "entities": {
    "amount": number,
    "currency": string,
    "merchant": string,
    "category": string,
    "transactionDate": string
  },
  "queryType": "sum" | "average" | "count" | "trend" | "comparison" | "list",
  "filters": {
    "merchant": string,
    "category": string,
    "startDate": string,
    "endDate": string
  },
  "reason": string
}
Only include relevant fields. Respond with JSON only.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const cleaned = text
      .trim()
      .replace(/```json/gi, '')
      .replace(/```/g, '');
    const parsed = JSON.parse(cleaned);

    if (parsed.kind === 'transaction') {
      const intent: TransactionIntent = {
        kind: 'transaction',
        action: parsed.action === 'amend' ? 'amend' : 'log',
        confidence: sanitizeConfidence(parsed.confidence),
        entities: {
          amount: parsed.entities?.amount ?? undefined,
          currency: parsed.entities?.currency ?? 'USD',
          merchant: parsed.entities?.merchant ?? undefined,
          category: parsed.entities?.category ?? undefined,
          transactionDate: parsed.entities?.transactionDate ?? undefined,
          description: message,
        },
        reason: parsed.reason,
      };
      return intent;
    }

    if (parsed.kind === 'insight') {
      const intent: InsightIntent = {
        kind: 'insight',
        confidence: sanitizeConfidence(parsed.confidence),
        queryType: parsed.queryType ?? 'sum',
        filters: {
          merchant: parsed.filters?.merchant ?? undefined,
          category: parsed.filters?.category ?? undefined,
          startDate: parsed.filters?.startDate ?? undefined,
          endDate: parsed.filters?.endDate ?? undefined,
        },
        question: message,
        followUps: [],
      };
      return intent;
    }

    return {
      kind: 'other',
      confidence: sanitizeConfidence(parsed.confidence),
      reason: parsed.reason || 'LLM fallback classified as other',
    };
  } catch (error) {
    console.error('LLM intent fallback failed', error);
    return null;
  }
};

const sanitizeConfidence = (confidence: unknown): IntentConfidence => {
  if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
    return confidence;
  }
  return 'medium';
};
