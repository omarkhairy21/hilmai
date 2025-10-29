import { createWorkflow, createStep } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { searchTransactionsTool } from '../tools/search-transactions-tool';
import { aggregationTool } from '../tools/aggregation-tool';
import { parseIntentTool } from '../tools/parse-intent-tool';
import { validateIntentTool } from '../tools/validate-intent-tool';
import { getCachedContext, setCachedContext } from '../../lib/context-cache';

const db = supabase.schema('public');

const userInfoSchema = z.object({
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
});

const transactionResultSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  merchant: z.string(),
  category: z.string(),
  date: z.string(),
  description: z.string().nullable(),
  similarity: z.number(),
});

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
  }),
  reason: z.string().nullable().optional(),
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
  }),
  question: z.string().nullable().optional(),
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

const diagnosticsSchema = z.object({
  rulesFired: z.array(z.string()),
  usedLLM: z.boolean(),
  cacheHit: z.boolean(),
});

const baseInputSchema = z.object({
  text: z.string(),
  chatId: z.number(),
  userInfo: userInfoSchema,
});

const intentStep = createStep({
  id: 'intentParser',
  inputSchema: baseInputSchema,
  outputSchema: z.object({
    text: z.string(),
    chatId: z.number(),
    userInfo: userInfoSchema,
    intent: intentSchema,
    diagnostics: diagnosticsSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    // Use Mastra tool to parse intent
    const runtimeContext = new RuntimeContext();
    const parseResult = await parseIntentTool.execute?.({
      context: {
        text: inputData.text,
        referenceDate: new Date().toISOString(),
      },
      mastra,
      runtimeContext,
    });

    if (!parseResult) {
      throw new Error('Parse intent tool returned no result');
    }

    // Validate and enhance the intent
    const validateResult = await validateIntentTool.execute?.({
      context: {
        intent: parseResult.intent,
        originalText: inputData.text,
        referenceDate: new Date().toISOString(),
      },
      mastra,
      runtimeContext,
    });

    if (!validateResult) {
      throw new Error('Validate intent tool returned no result');
    }

    const diagnostics = {
      rulesFired: validateResult.enhancements,
      usedLLM: parseResult.diagnostics.usedLLM,
      cacheHit: parseResult.diagnostics.cacheHit,
    };

    return {
      ...inputData,
      intent: validateResult.intent,
      diagnostics,
    };
  },
});

const userProfileSchema = z
  .object({
    id: z.string(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  })
  .nullable();

const routeStep = createStep({
  id: 'routeIntent',
  inputSchema: intentStep.outputSchema,
  outputSchema: z.object({
    text: z.string(),
    chatId: z.number(),
    userInfo: userInfoSchema,
    intent: intentSchema,
    diagnostics: diagnosticsSchema,
    route: z.enum(['transaction', 'insight', 'other', 'blocked']),
    responseText: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    userProfile: userProfileSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    const { intent, chatId, text, userInfo } = inputData;

    if (intent.kind === 'transaction') {
      // Use the parsed intent directly to save the transaction
      // This avoids re-extraction and ensures consistent date handling
      const { saveTransaction } = await import('../../lib/save-transaction.js');

      const entities = intent.entities;
      const saveResult = await saveTransaction({
        amount: entities.amount || 0,
        currency: entities.currency || undefined, // Will default to USD in saveTransaction
        merchant: entities.merchant || undefined, // Will default to 'Unknown' in saveTransaction
        category: entities.category || undefined, // Will default to 'other' in saveTransaction
        description: entities.description || text,
        transactionDate: entities.transactionDate || undefined,
        telegramChatId: chatId,
        telegramUsername: userInfo.username || undefined,
        firstName: userInfo.firstName || undefined,
        lastName: userInfo.lastName || undefined,
      });

      if (!saveResult || !saveResult.success) {
        return {
          ...inputData,
          route: 'transaction' as const,
          responseText: `❌ Failed to save transaction: ${saveResult?.message || 'Unknown error'}`,
          userProfile: null,
        };
      }

      // Format response
      const formattedDate = entities.transactionDate
        ? new Date(entities.transactionDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Today';

      const responseText = `✅ Transaction recorded!

**Amount:** ${entities.amount} ${entities.currency || 'USD'}
**Merchant:** ${entities.merchant || 'Unknown'}
**Category:** ${entities.category || 'Other'}
**Date:** ${formattedDate}
**Status:** Saved ✓`;

      return {
        ...inputData,
        route: 'transaction' as const,
        responseText,
        userProfile: null,
      };
    }

    if (intent.kind === 'insight') {
      const { data: userRecord, error } = await db
        .from('users')
        .select('id, telegram_username, first_name, last_name')
        .eq('telegram_chat_id', chatId)
        .single();

      if (error || !userRecord) {
        return {
          ...inputData,
          route: 'blocked' as const,
          responseText:
            "I couldn't find your profile yet. Please add at least one transaction first by saying something like “Spent $10 on coffee” ☕️",
          userProfile: null,
        };
      }

      return {
        ...inputData,
        route: 'insight' as const,
        userId: userRecord.id,
        userProfile: {
          id: userRecord.id,
          username: userRecord.telegram_username,
          firstName: userRecord.first_name,
          lastName: userRecord.last_name,
        },
      };
    }

    return {
      ...inputData,
      route: 'other' as const,
      responseText:
        `I can help you with:\n\n` +
        `💰 Logging transactions: \"Spent $50 at Target\"\n` +
        `📊 Answering questions: \"How much did I spend on groceries?\"\n` +
        `📷 Receipts and 🎤 voice are supported too!`,
      userProfile: null,
    };
  },
});

const searchOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(transactionResultSchema),
  count: z.number(),
  message: z.string(),
});

const aggregationOutputSchema = z.object({
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
  message: z.string().nullable().optional(),
});

const contextOutputSchema = z.object({
  base: routeStep.outputSchema,
  profile: z
    .object({
      id: z.string(),
      username: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      lastTransactionDate: z.string().nullable(),
      lastMerchant: z.string().nullable(),
      lastAmount: z.number().nullable(),
      preferredCurrency: z.string().nullable(),
    })
    .nullable(),
});

const semanticSearchStep = createStep({
  id: 'semanticSearch',
  inputSchema: routeStep.outputSchema,
  outputSchema: searchOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.route !== 'insight' || inputData.responseText || !inputData.userId) {
      return { success: false, results: [], count: 0, message: 'Search skipped' };
    }

    const filters = inputData.intent.kind === 'insight' ? inputData.intent.filters : {};
    const topK =
      inputData.intent.kind === 'insight' && inputData.intent.queryType === 'list' ? 30 : 12;
    const searchInput = {
      userId: inputData.userId,
      query: inputData.text,
      topK,
      minSimilarity: 0.7,
      startDate: filters.startDate ?? undefined,
      endDate: filters.endDate ?? undefined,
      merchant: filters.merchant ?? undefined,
      category: filters.category ?? undefined,
    };

    const runtimeContext = new RuntimeContext();

    const result =
      (await searchTransactionsTool.execute?.({
        context: searchInput,
        mastra,
        runtimeContext,
      })) ||
      ({ success: false, results: [], count: 0, message: 'Search unavailable' } as z.infer<
        typeof searchOutputSchema
      >);

    return result;
  },
});

const aggregationStep = createStep({
  id: 'aggregateMetrics',
  inputSchema: routeStep.outputSchema,
  outputSchema: aggregationOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.route !== 'insight' || inputData.responseText || !inputData.userId) {
      return {
        success: false,
        metric: 'sum',
        total: null,
        average: null,
        count: null,
        message: 'Aggregation skipped',
      };
    }

    const filters = inputData.intent.kind === 'insight' ? inputData.intent.filters : {};
    const metricMap: Record<string, 'sum' | 'average' | 'count' | 'comparison' | 'trend'> = {
      sum: 'sum',
      average: 'average',
      count: 'count',
      comparison: 'comparison',
      trend: 'trend',
      list: 'sum',
    };
    const metric =
      metricMap[inputData.intent.kind === 'insight' ? inputData.intent.queryType : 'sum'];
    const bucket =
      filters.timeframe?.grain && ['day', 'week', 'month'].includes(filters.timeframe.grain)
        ? (filters.timeframe.grain as 'day' | 'week' | 'month')
        : undefined;

    const aggInput = {
      userId: inputData.userId,
      metric,
      startDate: filters.startDate ?? undefined,
      endDate: filters.endDate ?? undefined,
      category: filters.category ?? undefined,
      merchant: filters.merchant ?? undefined,
      bucket,
      compareStartDate: filters.compareTo?.startDate,
      compareEndDate: filters.compareTo?.endDate,
    };

    const runtimeContext = new RuntimeContext();

    const result =
      (await aggregationTool.execute?.({
        context: aggInput,
        mastra,
        runtimeContext,
      })) ||
      ({
        success: false,
        metric,
        total: null,
        average: null,
        count: null,
        message: 'Aggregation unavailable',
      } as z.infer<typeof aggregationOutputSchema>);

    return result;
  },
});

const contextStep = createStep({
  id: 'contextFetch',
  inputSchema: routeStep.outputSchema,
  outputSchema: contextOutputSchema,
  execute: async ({ inputData }) => {
    if (inputData.route !== 'insight' || !inputData.userId) {
      return { base: inputData, profile: null };
    }

    const cacheKey = `user-context:${inputData.userId}`;
    const cached = await getCachedContext<z.infer<typeof contextOutputSchema>['profile']>(cacheKey);
    if (cached) {
      return { base: inputData, profile: cached };
    }

    const { data: lastTx } = await db
      .from('transactions')
      .select('transaction_date, merchant, amount, currency')
      .eq('user_id', inputData.userId)
      .order('transaction_date', { ascending: false })
      .limit(1);

    const latest = lastTx?.[0];
    const profile = {
      id: inputData.userId,
      username: inputData.userProfile?.username ?? null,
      firstName: inputData.userProfile?.firstName ?? null,
      lastName: inputData.userProfile?.lastName ?? null,
      lastTransactionDate: latest?.transaction_date ?? null,
      lastMerchant: latest?.merchant ?? null,
      lastAmount:
        typeof latest?.amount === 'number'
          ? latest.amount
          : latest?.amount
            ? Number(latest.amount)
            : null,
      preferredCurrency: latest?.currency ?? null,
    };

    await setCachedContext(cacheKey, profile, 300);

    return { base: inputData, profile };
  },
});

const composeStep = createStep({
  id: 'composeResponse',
  inputSchema: z.object({
    semanticSearch: searchOutputSchema,
    aggregateMetrics: aggregationOutputSchema,
    contextFetch: contextOutputSchema,
  }),
  outputSchema: z.object({ responseText: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const base = inputData.contextFetch.base;

    if (!base) {
      return { responseText: 'I need a bit more context to help with that request.' };
    }

    if (base.responseText && base.route !== 'insight') {
      return { responseText: base.responseText };
    }

    if (base.route !== 'insight') {
      return {
        responseText:
          base.responseText ||
          `Try logging a transaction like \"Bought coffee for $5\" or ask \"What did I spend on groceries?\"`,
      };
    }

    if (base.responseText) {
      return { responseText: base.responseText };
    }

    const composer = mastra.getAgent('insightComposer');
    const payload = {
      intent: base.intent,
      diagnostics: base.diagnostics,
      semanticResults: inputData.semanticSearch,
      aggregates: inputData.aggregateMetrics,
      context: inputData.contextFetch.profile,
    };

    try {
      const response = await composer.generate(
        `User question: ${base.text}\n\nStructured data:\n${JSON.stringify(payload, null, 2)}`,
        { resourceId: base.chatId.toString() }
      );

      return {
        responseText:
          response.text?.trim() ||
          `Couldn't assemble an insight yet, but I'm still processing your request. Could you rephrase it?`,
      };
    } catch (error) {
      console.error('composer agent failed', error);
      return {
        responseText: `Something went wrong while creating that insight. Please try again or ask for a different timeframe.`,
      };
    }
  },
});

const workflowInputSchema = baseInputSchema;

export const telegramRoutingWorkflow = createWorkflow({
  id: 'telegramRouting',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({ responseText: z.string() }),
})
  .then(intentStep)
  .then(routeStep)
  .parallel([semanticSearchStep, aggregationStep, contextStep])
  .then(composeStep)
  .commit();
