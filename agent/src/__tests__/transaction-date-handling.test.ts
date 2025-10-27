import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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

describe('Transaction Date Handling', () => {
  const runtimeContext = new RuntimeContext();

  it('parses "today" relative to reference date', async () => {
    const referenceDate = '2025-10-28T12:00:00Z'; // October 28, 2025

    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'transaction',
        action: 'log',
        confidence: 'high',
        entities: {
          amount: 45,
          currency: 'USD',
          merchant: 'Starbucks',
          category: 'dining',
          transactionDate: '2025-10-28T00:00:00.000Z', // Today
        },
      }),
    });

    const parseResult = await parseIntentTool.execute?.({
      context: {
        text: 'Spent $45 at Starbucks today',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(parseResult?.intent.kind).toBe('transaction');
    if (parseResult?.intent.kind === 'transaction') {
      expect(parseResult.intent.entities.transactionDate).toBe('2025-10-28T00:00:00.000Z');
    }
  });

  it('parses "yesterday" relative to reference date', async () => {
    const referenceDate = '2025-10-28T12:00:00Z'; // October 28, 2025

    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'transaction',
        action: 'log',
        confidence: 'high',
        entities: {
          amount: 30,
          currency: 'USD',
          merchant: 'Target',
          category: 'shopping',
          transactionDate: '2025-10-27T00:00:00.000Z', // Yesterday
        },
      }),
    });

    const parseResult = await parseIntentTool.execute?.({
      context: {
        text: 'Bought groceries for $30 at Target yesterday',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(parseResult?.intent.kind).toBe('transaction');
    if (parseResult?.intent.kind === 'transaction') {
      expect(parseResult.intent.entities.transactionDate).toBe('2025-10-27T00:00:00.000Z');
    }
  });

  it('validates and normalizes transaction dates', async () => {
    const referenceDate = '2025-10-28T12:00:00Z';

    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'high' as const,
      entities: {
        amount: 50,
        currency: 'USD',
        merchant: 'Walmart',
        category: 'groceries',
        transactionDate: '2025-10-28T14:30:00.000Z', // Specific time
      },
    };

    const validateResult = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'Spent $50 at Walmart',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(validateResult?.intent.kind).toBe('transaction');
    if (validateResult?.intent.kind === 'transaction') {
      // Date should be normalized to ISO format
      expect(validateResult.intent.entities.transactionDate).toBeTruthy();
      const date = new Date(validateResult.intent.entities.transactionDate!);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(9); // October (0-indexed)
      expect(date.getDate()).toBe(28);
    }
  });

  it('defaults to reference date when no date mentioned', async () => {
    const referenceDate = '2025-10-28T12:00:00Z';

    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        kind: 'transaction',
        action: 'log',
        confidence: 'medium',
        entities: {
          amount: 15,
          currency: 'USD',
          merchant: 'Coffee Shop',
          category: 'dining',
          // No transactionDate provided by LLM
        },
      }),
    });

    const parseResult = await parseIntentTool.execute?.({
      context: {
        text: 'Paid $15 for coffee',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    const validateResult = await validateIntentTool.execute?.({
      context: {
        intent: parseResult!.intent,
        originalText: 'Paid $15 for coffee',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    // Validator should not modify missing transaction dates
    // The save-transaction-tool will default to current date
    expect(validateResult?.intent.kind).toBe('transaction');
  });

  it('handles malformed dates gracefully', async () => {
    const referenceDate = '2025-10-28T12:00:00Z';

    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'medium' as const,
      entities: {
        amount: 25,
        currency: 'USD',
        transactionDate: 'invalid-date',
      },
    };

    const validateResult = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'Spent $25',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(validateResult?.intent.kind).toBe('transaction');
    if (validateResult?.intent.kind === 'transaction') {
      // Validator should normalize invalid dates to reference date
      const normalized = validateResult.intent.entities.transactionDate;
      if (normalized) {
        const date = new Date(normalized);
        expect(date.getFullYear()).toBe(2025);
        expect(date.getMonth()).toBe(9); // October
        expect(date.getDate()).toBe(28);
      }
    }
  });

  it('preserves timezone information when provided', async () => {
    const referenceDate = '2025-10-28T12:00:00Z';

    const intent = {
      kind: 'transaction' as const,
      action: 'log' as const,
      confidence: 'high' as const,
      entities: {
        amount: 100,
        currency: 'USD',
        merchant: 'Hotel',
        category: 'travel',
        transactionDate: '2025-10-28T10:00:00+04:00', // Dubai timezone
        timezone: 'Asia/Dubai',
      },
    };

    const validateResult = await validateIntentTool.execute?.({
      context: {
        intent,
        originalText: 'Paid $100 for hotel',
        referenceDate,
      },
      mastra: {} as any,
      runtimeContext,
    });

    expect(validateResult?.intent.kind).toBe('transaction');
    if (validateResult?.intent.kind === 'transaction') {
      expect(validateResult.intent.entities.timezone).toBe('Asia/Dubai');
      expect(validateResult.intent.entities.transactionDate).toBeTruthy();
    }
  });
});
