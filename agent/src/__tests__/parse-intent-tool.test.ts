import { describe, it, expect, vi, beforeEach, afterAll, type Mock } from 'vitest';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { parseIntentTool } from '../mastra/tools/parse-intent-tool';
import { validateIntentTool } from '../mastra/tools/validate-intent-tool';
import { generateText } from 'ai';
import * as intentCache from '../lib/intent-cache';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

const generateTextMock = generateText as unknown as Mock;
const getCachedIntentSpy = vi.spyOn(intentCache, 'getCachedIntent');
const cacheIntentSpy = vi.spyOn(intentCache, 'cacheIntent');

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockRejectedValue(new Error('LLM not mocked'));
  getCachedIntentSpy.mockResolvedValue(null);
  cacheIntentSpy.mockResolvedValue();
});

afterAll(() => {
  getCachedIntentSpy.mockRestore();
  cacheIntentSpy.mockRestore();
});

describe('parseIntentTool', () => {
  const runtimeContext = new RuntimeContext();
  const referenceDate = '2025-02-15T12:00:00Z';

  it('returns empty message intent without calling LLM', async () => {
    const result = await parseIntentTool.execute?.({
      context: { text: '', referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result).toMatchObject({
      intent: {
        kind: 'other',
        confidence: 'high',
        reason: 'Empty message',
      },
      diagnostics: {
        usedLLM: false,
        cacheHit: false,
      },
    });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('uses cache when available', async () => {
    const cachedIntent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'high' as const,
      entities: { amount: 45, currency: 'USD' },
    };

    getCachedIntentSpy.mockResolvedValue(cachedIntent);

    const result = await parseIntentTool.execute?.({
      context: { text: 'Spent $45 on coffee', referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result).toMatchObject({
      intent: cachedIntent,
      diagnostics: {
        usedLLM: true,
        cacheHit: true,
      },
    });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('parses transaction intent from LLM', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'transaction',
        action: 'log',
        confidence: 'high',
        entities: {
          amount: 45,
          currency: 'USD',
          merchant: "Trader Joe's",
          category: 'groceries',
          transactionDate: '2025-02-14T00:00:00.000Z',
        },
      }),
    });

    const result = await parseIntentTool.execute?.({
      context: { text: "Spent $45 at Trader Joe's yesterday", referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    if (result?.intent.kind === 'transaction') {
      expect(result.intent.entities.amount).toBe(45);
      expect(result.intent.entities.currency).toBe('USD');
      expect(result.intent.entities.merchant).toBe("Trader Joe's");
      expect(result.intent.entities.category).toBe('groceries');
    }
    expect(result?.diagnostics.usedLLM).toBe(true);
    expect(result?.diagnostics.cacheHit).toBe(false);
    expect(cacheIntentSpy).toHaveBeenCalled();
  });

  it('parses insight intent from LLM', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'insight',
        confidence: 'high',
        queryType: 'sum',
        filters: {
          category: 'groceries',
          timeframe: {
            text: 'last month',
            start: '2025-01-01T00:00:00.000Z',
            end: '2025-01-31T23:59:59.999Z',
            grain: 'month',
          },
        },
        question: 'How much did I spend on groceries last month?',
      }),
    });

    const result = await parseIntentTool.execute?.({
      context: { text: 'How much did I spend on groceries last month?', referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('insight');
    if (result?.intent.kind === 'insight') {
      expect(result.intent.queryType).toBe('sum');
      expect(result.intent.filters.category).toBe('groceries');
      expect(result.intent.filters.timeframe?.grain).toBe('month');
    }
  });

  it('falls back gracefully on LLM error', async () => {
    generateTextMock.mockRejectedValue(new Error('LLM API error'));

    const result = await parseIntentTool.execute?.({
      context: { text: 'Spent $50 on food', referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    expect(result?.intent.confidence).toBe('low');
    expect(result?.diagnostics.usedLLM).toBe(false);
  });

  it('handles multilingual input', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'transaction',
        action: 'log',
        confidence: 'high',
        entities: {
          amount: 20,
          currency: 'AED',
          category: 'dining',
          description: 'قهوة',
        },
      }),
    });

    const result = await parseIntentTool.execute?.({
      context: { text: 'اشتريت قهوة بـ 20 درهم', referenceDate },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    if (result?.intent.kind === 'transaction') {
      expect(result.intent.entities.amount).toBe(20);
      expect(result.intent.entities.currency).toBe('AED');
    }
  });
});

describe('validateIntentTool', () => {
  const runtimeContext = new RuntimeContext();
  const referenceDate = '2025-02-15T12:00:00Z';

  it('fills default currency for transactions', async () => {
    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'high' as const,
      entities: {
        amount: 45,
      },
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'Spent 45 on coffee',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    if (result?.intent.kind === 'transaction') {
      expect(result.intent.entities.currency).toBe('USD');
    }
    expect(result?.enhancements).toContain('default-currency:USD');
  });

  it('extracts amount with regex when LLM misses it', async () => {
    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'medium' as const,
      entities: {},
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'I paid $42.50 for groceries',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    if (result?.intent.kind === 'transaction') {
      expect(result.intent.entities.amount).toBe(42.5);
      expect(result.intent.entities.currency).toBe('USD');
    }
    expect(result?.enhancements).toContain('regex-extracted-amount');
  });

  it('infers category from keywords', async () => {
    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'high' as const,
      entities: {
        amount: 5,
        currency: 'USD',
      },
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'Bought coffee at Starbucks',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('transaction');
    if (result?.intent.kind === 'transaction') {
      expect(result.intent.entities.category).toBe('dining');
    }
    expect(result?.enhancements).toContain('inferred-category:dining');
  });

  it('normalizes date boundaries for insights', async () => {
    const intent = {
      kind: 'insight' as const,
      confidence: 'high' as const,
      queryType: 'sum' as const,
      filters: {
        category: 'groceries',
        timeframe: {
          text: 'this week',
          start: '2025-02-10T15:30:00.000Z',
          end: '2025-02-16T10:00:00.000Z',
          grain: 'week' as const,
        },
      },
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'How much did I spend on groceries this week?',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('insight');
    if (result?.intent.kind === 'insight' && result.intent.filters.timeframe) {
      // Should be normalized to Monday 00:00 - Sunday 23:59
      const startDate = new Date(result.intent.filters.timeframe.start);
      const endDate = new Date(result.intent.filters.timeframe.end);

      expect(startDate.getDay()).toBe(1); // Monday
      expect(startDate.getHours()).toBe(0);
      expect(endDate.getDay()).toBe(0); // Sunday
      expect(endDate.getHours()).toBe(23);
    }
    expect(result?.enhancements).toContain('normalized-week-boundaries');
  });

  it('swaps date range if end < start', async () => {
    const intent = {
      kind: 'insight' as const,
      confidence: 'medium' as const,
      queryType: 'sum' as const,
      filters: {
        startDate: '2025-02-15T00:00:00.000Z',
        endDate: '2025-02-01T00:00:00.000Z',
      },
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'spending between Feb 15 and Feb 1',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('insight');
    if (result?.intent.kind === 'insight') {
      const start = new Date(result.intent.filters.startDate!);
      const end = new Date(result.intent.filters.endDate!);
      expect(start <= end).toBe(true);
    }
    expect(result?.enhancements).toContain('swapped-date-range');
  });

  it('normalizes category names', async () => {
    const intent = {
      kind: 'insight' as const,
      confidence: 'high' as const,
      queryType: 'sum' as const,
      filters: {
        category: 'Food',
      },
    };

    const result = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'How much on food?',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(result?.intent.kind).toBe('insight');
    if (result?.intent.kind === 'insight') {
      expect(result.intent.filters.category).toBe('dining');
    }
  });
});
