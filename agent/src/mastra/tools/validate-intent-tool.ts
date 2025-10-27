import { createTool } from '@mastra/core';
import { z } from 'zod';
import * as chrono from 'chrono-node';

// Reuse intent schemas
const transactionIntentSchema = z.object({
  kind: z.literal('transaction'),
  action: z.enum(['log', 'amend']),
  confidence: z.enum(['high', 'medium', 'low']),
  entities: z.object({
    amount: z.number().optional(),
    currency: z.string().optional(),
    merchant: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    transactionDate: z.string().optional(),
    timezone: z.string().optional(),
  }),
  reason: z.string().optional(),
});

const insightIntentSchema = z.object({
  kind: z.literal('insight'),
  confidence: z.enum(['high', 'medium', 'low']),
  queryType: z.enum(['sum', 'average', 'count', 'trend', 'comparison', 'list']),
  filters: z.object({
    merchant: z.string().optional(),
    category: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    timeframe: z
      .object({
        text: z.string(),
        start: z.string(),
        end: z.string(),
        grain: z.enum(['day', 'week', 'month', 'quarter', 'year', 'custom']),
      })
      .optional(),
    compareTo: z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        label: z.string().optional(),
      })
      .optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
    lastN: z.number().optional(),
  }),
  followUps: z.array(z.string()).optional(),
  question: z.string().optional(),
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

export const validateIntentTool = createTool({
  id: 'validate-intent',
  description:
    'Post-process and validate parsed intents. Normalizes dates, fills defaults, and applies business rules.',
  inputSchema: z.object({
    intent: intentSchema,
    originalText: z.string(),
    referenceDate: z.string().optional(),
  }),
  outputSchema: z.object({
    intent: intentSchema,
    enhancements: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { intent, originalText, referenceDate } = context;
    const enhancements: string[] = [];
    const refDate = referenceDate ? new Date(referenceDate) : new Date();

    // Clone intent for modification
    let validated = JSON.parse(JSON.stringify(intent));

    // Validate transaction intents
    if (validated.kind === 'transaction') {
      // Ensure currency defaults to USD
      if (!validated.entities.currency) {
        validated.entities.currency = 'USD';
        enhancements.push('default-currency:USD');
      }

      // Normalize currency to uppercase
      if (validated.entities.currency) {
        validated.entities.currency = validated.entities.currency.toUpperCase();
      }

      // Extract amount with regex if LLM missed it
      if (!validated.entities.amount) {
        const extracted = extractAmountWithRegex(originalText);
        if (extracted) {
          validated.entities.amount = extracted.amount;
          if (extracted.currency) {
            validated.entities.currency = extracted.currency;
          }
          enhancements.push('regex-extracted-amount');
        }
      }

      // Validate amount is positive
      if (validated.entities.amount && validated.entities.amount < 0) {
        validated.entities.amount = Math.abs(validated.entities.amount);
        enhancements.push('abs-amount');
      }

      // Normalize category
      if (validated.entities.category) {
        validated.entities.category = normalizeCategory(validated.entities.category);
      } else {
        // Try to infer category from keywords
        const inferred = inferCategoryFromText(originalText.toLowerCase());
        if (inferred) {
          validated.entities.category = inferred;
          enhancements.push(`inferred-category:${inferred}`);
        }
      }

      // Ensure description exists
      if (!validated.entities.description) {
        validated.entities.description = originalText;
        enhancements.push('default-description');
      }

      // Validate transaction date
      if (validated.entities.transactionDate) {
        const normalized = normalizeDate(validated.entities.transactionDate, refDate);
        if (normalized !== validated.entities.transactionDate) {
          validated.entities.transactionDate = normalized;
          enhancements.push('normalized-transaction-date');
        }
      } else {
        // Try to parse date from text with chrono
        const parsed = chrono.parse(originalText, refDate);
        if (parsed.length > 0 && parsed[0].start) {
          validated.entities.transactionDate = parsed[0].start.date().toISOString();
          enhancements.push('chrono-parsed-date');
        }
      }
    }

    // Validate insight intents
    if (validated.kind === 'insight') {
      // Normalize category
      if (validated.filters.category) {
        validated.filters.category = normalizeCategory(validated.filters.category);
      } else {
        // Try to infer category
        const inferred = inferCategoryFromText(originalText.toLowerCase());
        if (inferred) {
          validated.filters.category = inferred;
          enhancements.push(`inferred-category:${inferred}`);
        }
      }

      // Validate date range
      if (validated.filters.startDate && validated.filters.endDate) {
        const start = new Date(validated.filters.startDate);
        const end = new Date(validated.filters.endDate);

        // Ensure start <= end
        if (start > end) {
          [validated.filters.startDate, validated.filters.endDate] = [
            validated.filters.endDate,
            validated.filters.startDate,
          ];
          enhancements.push('swapped-date-range');
        }

        // Normalize dates
        validated.filters.startDate = normalizeDate(validated.filters.startDate, refDate);
        validated.filters.endDate = normalizeDate(validated.filters.endDate, refDate);
      }

      // Validate timeframe dates
      if (validated.filters.timeframe) {
        const { start, end } = validated.filters.timeframe;
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (startDate > endDate) {
          [validated.filters.timeframe.start, validated.filters.timeframe.end] = [end, start];
          enhancements.push('swapped-timeframe-dates');
        }

        // Normalize boundaries based on grain
        const normalized = normalizeDateBoundaries(
          validated.filters.timeframe.start,
          validated.filters.timeframe.end,
          validated.filters.timeframe.grain
        );
        validated.filters.timeframe.start = normalized.start;
        validated.filters.timeframe.end = normalized.end;
        enhancements.push(`normalized-${validated.filters.timeframe.grain}-boundaries`);
      }

      // Ensure question is set
      if (!validated.question) {
        validated.question = originalText;
        enhancements.push('default-question');
      }

      // Validate amounts
      if (validated.filters.minAmount && validated.filters.maxAmount) {
        if (validated.filters.minAmount > validated.filters.maxAmount) {
          [validated.filters.minAmount, validated.filters.maxAmount] = [
            validated.filters.maxAmount,
            validated.filters.minAmount,
          ];
          enhancements.push('swapped-amount-range');
        }
      }
    }

    return {
      intent: validated,
      enhancements,
    };
  },
});

// Helper functions

function extractAmountWithRegex(text: string): { amount: number; currency?: string } | null {
  // Symbol-based patterns
  const symbolRegex = /([$€£]|د\.?إ|ر\.?س|﷼)\s?([\d.,]+)/i;
  const symbolMatch = text.match(symbolRegex);
  if (symbolMatch) {
    const currencyMap: Record<string, string> = {
      $: 'USD',
      '€': 'EUR',
      '£': 'GBP',
      'د.إ': 'AED',
      'ر.س': 'SAR',
      '﷼': 'SAR',
    };
    return {
      amount: parseFloat(symbolMatch[2].replace(/,/g, '')),
      currency: currencyMap[symbolMatch[1]] || 'USD',
    };
  }

  // Keyword-based patterns
  const keywordRegex = /([\d.,]+)\s?(usd|dollars?|eur|euros?|gbp|pounds?|aed|dirhams?|sar|riyals?)/i;
  const keywordMatch = text.match(keywordRegex);
  if (keywordMatch) {
    const currencyMap: Record<string, string> = {
      usd: 'USD',
      dollar: 'USD',
      dollars: 'USD',
      eur: 'EUR',
      euro: 'EUR',
      euros: 'EUR',
      gbp: 'GBP',
      pound: 'GBP',
      pounds: 'GBP',
      aed: 'AED',
      dirham: 'AED',
      dirhams: 'AED',
      sar: 'SAR',
      riyal: 'SAR',
      riyals: 'SAR',
    };
    const unit = keywordMatch[2].toLowerCase();
    return {
      amount: parseFloat(keywordMatch[1].replace(/,/g, '')),
      currency: currencyMap[unit] || 'USD',
    };
  }

  // Plain number after verb
  const plainRegex = /\b(spent|paid|bought)\s+([\d.,]+)/i;
  const plainMatch = text.match(plainRegex);
  if (plainMatch) {
    return {
      amount: parseFloat(plainMatch[2].replace(/,/g, '')),
      currency: 'USD',
    };
  }

  return null;
}

const categoryKeywords: Record<string, string[]> = {
  groceries: ['grocery', 'groceries', 'supermarket', 'market', 'trader joe', 'whole foods', 'safeway'],
  dining: ['dining', 'restaurant', 'food', 'meal', 'coffee', 'cafe', 'dinner', 'lunch', 'breakfast', 'starbucks'],
  transport: ['transport', 'uber', 'lyft', 'taxi', 'bus', 'train', 'gas', 'fuel', 'parking'],
  shopping: ['shopping', 'retail', 'store', 'mall', 'fashion', 'clothes', 'amazon', 'target'],
  bills: ['bill', 'bills', 'utility', 'utilities', 'electric', 'internet', 'rent', 'subscription'],
  entertainment: ['entertainment', 'movie', 'cinema', 'concert', 'streaming', 'netflix', 'spotify'],
  healthcare: ['health', 'doctor', 'pharmacy', 'medicine', 'clinic', 'hospital', 'dental'],
  education: ['education', 'school', 'course', 'tuition', 'class', 'udemy', 'coursera'],
  travel: ['travel', 'flight', 'hotel', 'airbnb', 'ticket', 'booking'],
};

function inferCategoryFromText(text: string): string | null {
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }
  return null;
}

function normalizeCategory(category: string): string {
  const lower = category.toLowerCase();
  const validCategories = [
    'groceries',
    'dining',
    'transport',
    'shopping',
    'bills',
    'entertainment',
    'healthcare',
    'education',
    'travel',
    'other',
  ];

  if (validCategories.includes(lower)) {
    return lower;
  }

  // Map common variations
  const categoryMap: Record<string, string> = {
    food: 'dining',
    restaurant: 'dining',
    coffee: 'dining',
    uber: 'transport',
    gas: 'transport',
    movie: 'entertainment',
    netflix: 'entertainment',
    rent: 'bills',
    subscription: 'bills',
  };

  return categoryMap[lower] || 'other';
}

function normalizeDate(dateStr: string, referenceDate: Date): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      // Try chrono parsing
      const parsed = chrono.parse(dateStr, referenceDate);
      if (parsed.length > 0 && parsed[0].start) {
        return parsed[0].start.date().toISOString();
      }
      return referenceDate.toISOString();
    }
    return date.toISOString();
  } catch {
    return referenceDate.toISOString();
  }
}

function normalizeDateBoundaries(
  start: string,
  end: string,
  grain: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
): { start: string; end: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (grain === 'day') {
    // Start of day to end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (grain === 'week') {
    // Monday to Sunday
    const startDay = startDate.getDay();
    const mondayOffset = (startDay + 6) % 7;
    startDate.setDate(startDate.getDate() - mondayOffset);
    startDate.setHours(0, 0, 0, 0);

    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (grain === 'month') {
    // First day to last day of month
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    endDate.setMonth(endDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (grain === 'quarter') {
    // First day of quarter to last day of quarter
    const quarterStartMonth = Math.floor(startDate.getMonth() / 3) * 3;
    startDate.setMonth(quarterStartMonth, 1);
    startDate.setHours(0, 0, 0, 0);

    endDate.setMonth(quarterStartMonth + 3, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (grain === 'year') {
    // Jan 1 to Dec 31
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);

    endDate.setMonth(11, 31);
    endDate.setHours(23, 59, 59, 999);
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}
