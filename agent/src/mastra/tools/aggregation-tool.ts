import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { getCachedContext, setCachedContext } from '../../lib/context-cache';

const db = supabase.schema('public');

const normalizeDate = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

const buildCacheKey = (input: {
  userId: string;
  metric: string;
  startDate?: string;
  endDate?: string;
  category?: string | null;
  merchant?: string | null;
  bucket?: string | null;
  compareStart?: string | null;
  compareEnd?: string | null;
}) =>
  [
    'agg',
    input.userId,
    input.metric,
    input.startDate || 'all',
    input.endDate || 'all',
    input.category || 'any',
    input.merchant || 'any',
    input.bucket || 'none',
    input.compareStart || 'na',
    input.compareEnd || 'na',
  ].join(':');

const deriveComparisonRange = (start?: string, end?: string) => {
  if (!start || !end) return { compareStart: null, compareEnd: null };
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { compareStart: null, compareEnd: null };
  }
  const duration = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return {
    compareStart: prevStart.toISOString(),
    compareEnd: prevEnd.toISOString(),
  };
};

const getAggregateSummary = async (args: {
  userId: string;
  startDate?: string;
  endDate?: string;
  category?: string | null;
  merchant?: string | null;
}) => {
  const { userId, startDate, endDate, category, merchant } = args;
  const { data, error } = await db.rpc('aggregate_transactions', {
    p_user_id: userId,
    p_start: startDate || null,
    p_end: endDate || null,
    p_category: category || null,
    p_merchant: merchant || null,
  });

  if (error) {
    throw new Error(`aggregate_transactions failed: ${error.message}`);
  }

  const summary = data?.[0];
  return {
    total: summary?.total_amount ? Number(summary.total_amount) : 0,
    average: summary?.average_amount ? Number(summary.average_amount) : 0,
    count: summary?.tx_count ? Number(summary.tx_count) : 0,
  };
};

const getTrend = async (args: {
  userId: string;
  startDate?: string;
  endDate?: string;
  category?: string | null;
  merchant?: string | null;
  bucket: 'day' | 'week' | 'month';
}) => {
  const { userId, startDate, endDate, category, merchant, bucket } = args;
  const { data, error } = await db.rpc('aggregate_transactions_trend', {
    p_user_id: userId,
    p_bucket: bucket,
    p_start: startDate || null,
    p_end: endDate || null,
    p_category: category || null,
    p_merchant: merchant || null,
  });

  if (error) {
    throw new Error(`aggregate_transactions_trend failed: ${error.message}`);
  }

  return (data || []).map((row: {
    bucket_start: string;
    bucket_end: string;
    total_amount: number | null;
    tx_count: number | null;
  }) => ({
    bucketStart: row.bucket_start,
    bucketEnd: row.bucket_end,
    total: Number(row.total_amount || 0),
    count: Number(row.tx_count || 0),
  }));
};

export const aggregationTool = createTool({
  id: 'aggregate-transactions',
  description:
    'Compute totals, averages, counts, comparisons, or trend buckets across a user’s transactions.',
  inputSchema: z.object({
    userId: z.string(),
    metric: z.enum(['sum', 'average', 'count', 'comparison', 'trend']).default('sum'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    category: z.string().optional(),
    merchant: z.string().optional(),
    bucket: z.enum(['day', 'week', 'month']).optional().describe('Required for trend metric'),
    compareStartDate: z.string().optional(),
    compareEndDate: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    metric: z.string(),
    total: z.number().nullable(),
    average: z.number().nullable(),
    count: z.number().nullable(),
    trend: z
      .array(
        z.object({
          bucketStart: z.string(),
          bucketEnd: z.string(),
          total: z.number(),
          count: z.number(),
        })
      )
      .optional(),
    comparison: z
      .object({
        current: z.object({ total: z.number(), count: z.number() }),
        previous: z.object({ total: z.number(), count: z.number() }),
        delta: z.number(),
        deltaPercent: z.number().nullable(),
      })
      .optional(),
    message: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const {
      userId,
      metric,
      startDate,
      endDate,
      category,
      merchant,
      bucket,
      compareStartDate,
      compareEndDate,
    } = context;

    const startDateIso = normalizeDate(startDate);
    const endDateIso = normalizeDate(endDate);
    const categoryFilter = category || null;
    const merchantFilter = merchant || null;

    const cacheKey = buildCacheKey({
      userId,
      metric,
      startDate: startDateIso,
      endDate: endDateIso,
      category: categoryFilter,
      merchant: merchantFilter,
      bucket: bucket || null,
      compareStart: compareStartDate || null,
      compareEnd: compareEndDate || null,
    });

    const cached = await getCachedContext<{
      total: number | null;
      average: number | null;
      count: number | null;
      trend?: { bucketStart: string; bucketEnd: string; total: number; count: number }[];
      comparison?: {
        current: { total: number; count: number };
        previous: { total: number; count: number };
        delta: number;
        deltaPercent: number | null;
      };
    }>(cacheKey);

    if (cached) {
      return {
        success: true,
        metric,
        ...cached,
        message: 'served-from-cache',
      };
    }

    try {
      if (metric === 'trend') {
        const resolvedBucket = bucket || 'week';
        const trend = await getTrend({
          userId,
          startDate: startDateIso,
          endDate: endDateIso,
          category: categoryFilter,
          merchant: merchantFilter,
          bucket: resolvedBucket,
        });

        const payload = { total: null, average: null, count: null, trend };
        await setCachedContext(cacheKey, payload, 120);

        return {
          success: true,
          metric,
          ...payload,
        };
      }

      const summary = await getAggregateSummary({
        userId,
        startDate: startDateIso,
        endDate: endDateIso,
        category: categoryFilter,
        merchant: merchantFilter,
      });

      if (metric === 'comparison') {
        const providedCompareStart = normalizeDate(compareStartDate);
        const providedCompareEnd = normalizeDate(compareEndDate);
        const derived = deriveComparisonRange(startDateIso, endDateIso);
        const compareStart = providedCompareStart || derived.compareStart;
        const compareEnd = providedCompareEnd || derived.compareEnd;

        if (!compareStart || !compareEnd) {
          return {
            success: true,
            metric,
            total: summary.total,
            average: summary.average,
            count: summary.count,
            message: 'Comparison requires a valid baseline range.',
          };
        }

        const previous = await getAggregateSummary({
          userId,
          startDate: compareStart,
          endDate: compareEnd,
          category: categoryFilter,
          merchant: merchantFilter,
        });

        const delta = summary.total - previous.total;
        const deltaPercent =
          previous.total === 0 ? null : Number(((delta / previous.total) * 100).toFixed(2));

        const payload = {
          total: summary.total,
          average: summary.average,
          count: summary.count,
          comparison: {
            current: { total: summary.total, count: summary.count },
            previous: { total: previous.total, count: previous.count },
            delta,
            deltaPercent,
          },
        };

        await setCachedContext(cacheKey, payload, 120);

        return {
          success: true,
          metric,
          ...payload,
        };
      }

      const payload = {
        total: summary.total,
        average: summary.average,
        count: summary.count,
      };

      await setCachedContext(cacheKey, payload, 60);

      return {
        success: true,
        metric,
        ...payload,
      };
    } catch (error) {
      console.error('aggregation-tool error', error);
      return {
        success: false,
        metric,
        total: null,
        average: null,
        count: null,
        message: error instanceof Error ? error.message : 'Unknown aggregation error',
      };
    }
  },
});
