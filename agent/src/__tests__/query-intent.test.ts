import { describe, expect, it } from 'vitest';
import { parseQueryIntent } from '../lib/query-intent';

const referenceDate = new Date('2025-02-15T12:00:00Z');

describe('parseQueryIntent', () => {
  it('detects transaction intents with amount and merchant', async () => {
    const result = await parseQueryIntent("Spent $45 at Trader Joe's yesterday", {
      referenceDate,
      disableLLMFallback: true,
    });

    if (result.intent.kind !== 'transaction') {
      throw new Error(`expected transaction intent, got ${result.intent.kind}`);
    }
    expect(result.intent.confidence).toBe('high');
    expect(result.intent.entities.amount).toBe(45);
    expect(result.intent.entities.currency).toBe('USD');
    expect(result.intent.entities.merchant?.toLowerCase()).toContain('trader joe');
    expect(result.intent.entities.transactionDate).toBeDefined();
  });

  it('detects insight queries with categories and timeframe', async () => {
    const result = await parseQueryIntent('How much did I spend on groceries last month?', {
      referenceDate,
      disableLLMFallback: true,
    });

    if (result.intent.kind !== 'insight') {
      throw new Error(`expected insight intent, got ${result.intent.kind}`);
    }
    expect(result.intent.confidence).toBe('high');
    expect(result.intent.queryType).toBe('sum');
    expect(result.intent.filters.category).toBe('groceries');
    expect(result.intent.filters.startDate).toBeDefined();
    expect(result.diagnostics.rulesFired).toContain('insight:queryType:sum');
  });

  it('extracts explicit date ranges for insight listings', async () => {
    const result = await parseQueryIntent('Show me my coffee transactions from March 1 to March 15', {
      referenceDate,
      disableLLMFallback: true,
    });

    if (result.intent.kind !== 'insight') {
      throw new Error(`expected insight intent, got ${result.intent.kind}`);
    }
    expect(result.intent.queryType).toBe('list');
    expect(result.intent.filters.category).toBe('dining');
    expect(result.intent.filters.startDate).toBeDefined();
    expect(result.intent.filters.endDate).toBeDefined();
    expect(result.intent.confidence === 'high' || result.intent.confidence === 'medium').toBeTruthy();
  });

  it('treats open-ended timeframe phrases like "till now" as all-history queries', async () => {
    const result = await parseQueryIntent('How much did I spend on groceries till now?', {
      referenceDate,
      disableLLMFallback: true,
    });

    if (result.intent.kind !== 'insight') {
      throw new Error(`expected insight intent, got ${result.intent.kind}`);
    }
    expect(result.intent.filters.category).toBe('groceries');
    expect(result.intent.filters.startDate).toBeUndefined();
    expect(result.intent.filters.endDate).toBeDefined();
  });
});
