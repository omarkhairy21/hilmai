/**
 * Save Transaction Tool for HilmAI Agent V2
 *
 * Saves transaction to Supabase with merchant embedding generation
 * Uses embedding cache to reduce API calls
 *
 * SECURITY:
 * - Uses supabaseService (service role) for unrestricted backend access
 * - Server-side user_id validation (validates userId parameter)
 * - RLS policies provide defense in depth even with service role
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabaseService } from '../../lib/supabase';
import { getMerchantEmbedding } from '../../lib/embeddings';
import { getUserDefaultCurrency, convertCurrency, normalizeCurrency } from '../../lib/currency';

export const saveTransactionTool = createTool({
  id: 'save-transaction',
  description: 'Save a transaction to the database with merchant embedding for fuzzy search',
  inputSchema: z.object({
    userId: z.number().describe('Telegram user ID'),
    amount: z.number().describe('Transaction amount'),
    currency: z.string().default('AED').describe('Currency code (e.g., AED, USD, SAR)'),
    merchant: z.string().describe('Merchant or vendor name'),
    category: z.string().describe('Transaction category (e.g., Groceries, Dining, Transport)'),
    description: z.string().optional().describe('Optional transaction description or notes'),
    transactionDate: z.string().describe('Transaction date in YYYY-MM-DD format'),
    telegramChatId: z.number().optional().describe('Telegram chat ID'),
    telegramUsername: z.string().optional().describe('Telegram username'),
    firstName: z.string().optional().describe('User first name'),
    lastName: z.string().nullable().optional().describe('User last name'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactionId: z.number().optional(),
    message: z.string(),
  }),
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    const toolStartTime = Date.now();

    // Get progress emitter from runtime context if available
    const progressEmitter = runtimeContext?.get('progressEmitter') as 
      ((stage: 'start' | 'categorized' | 'currencyConversion' | 'saving' | 'finalizing') => void) | undefined;

    const {
      userId,
      amount,
      currency,
      merchant,
      category,
      description,
      transactionDate,
      telegramChatId,
      telegramUsername,
      firstName,
      lastName,
    } = context;

    logger?.info('[tool:save-transaction]', {
      event: 'start',
      userId,
      amount,
      currency,
      merchant,
      category,
      transactionDate,
    });

    try {
      if (!userId || Number.isNaN(userId)) {
        throw new Error(
          'Invalid or missing userId when saving transaction. Ensure the caller forwards the Telegram chat id.'
        );
      }

      if (!merchant || merchant.trim().length === 0) {
        throw new Error('Merchant name is required to save a transaction.');
      }

      if (!transactionDate) {
        throw new Error('Transaction date is required to save a transaction.');
      }

      // Step 0: Ensure user exists before writing the transaction
      const userPayload: {
        id: number;
        telegram_chat_id: number | null;
        telegram_username?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      } = {
        id: userId,
        telegram_chat_id: telegramChatId ?? userId,
      };

      if (telegramUsername !== undefined) {
        userPayload.telegram_username = telegramUsername;
      }
      if (firstName !== undefined) {
        userPayload.first_name = firstName;
      }
      if (lastName !== undefined) {
        userPayload.last_name = lastName;
      }

      // Step 1: Generate merchant embedding and upsert user in parallel
      const embeddingStart = Date.now();
      const [merchantEmbedding, userUpsertResult] = await Promise.all([
        getMerchantEmbedding(merchant),
        supabaseService.from('users').upsert([userPayload]),
      ]);

      const embeddingDuration = Date.now() - embeddingStart;
      logger?.info('[tool:performance]', {
        operation: 'embedding_and_user_upsert',
        duration: embeddingDuration,
        userId,
        merchant,
      });

      if (userUpsertResult.error) {
        logger?.error('[tool:save-transaction]', {
          event: 'user_upsert_failed',
          error: userUpsertResult.error.message,
          userId,
        });
        throw new Error(
          `Failed to sync user profile before saving transaction: ${userUpsertResult.error.message}`
        );
      }

      logger?.debug('[tool:save-transaction]', {
        event: 'embedding_generated',
        dimensions: merchantEmbedding.length,
        userId,
      });

      // Step 2: Get user's default currency and perform conversion if needed
      const conversionStart = Date.now();
      const userDefaultCurrency = await getUserDefaultCurrency(userId);
      const normalizedCurrency = normalizeCurrency(currency) || currency.toUpperCase();

      let finalAmount = amount;
      let originalAmount: number | null = null;
      let originalCurrency: string | null = null;
      let convertedAmount: number | null = null;
      let conversionRate: number | null = null;
      let convertedAt: string | null = null;

      // Perform currency conversion if transaction currency differs from user's default
      if (normalizedCurrency !== userDefaultCurrency) {
        // Emit currency conversion progress
        progressEmitter?.('currencyConversion');

        logger?.info('[tool:save-transaction]', {
          event: 'currency_conversion_needed',
          from: normalizedCurrency,
          to: userDefaultCurrency,
          amount,
          userId,
        });

        try {
          const conversion = await convertCurrency(amount, normalizedCurrency, userDefaultCurrency);

          // Store original values
          originalAmount = amount;
          originalCurrency = normalizedCurrency;

          // Store converted values
          convertedAmount = conversion.convertedAmount;
          conversionRate = conversion.rate;
          convertedAt = new Date().toISOString();

          // Use converted amount as the primary amount for reporting
          finalAmount = conversion.convertedAmount;

          const conversionDuration = Date.now() - conversionStart;
          logger?.info('[tool:performance]', {
            operation: 'currency_conversion',
            duration: conversionDuration,
            from: normalizedCurrency,
            to: userDefaultCurrency,
            originalAmount: amount,
            convertedAmount: conversion.convertedAmount,
            rate: conversion.rate,
            userId,
          });
        } catch (conversionError) {
          // Log conversion error but don't fail - use original currency
          logger?.warn('[tool:save-transaction]', {
            event: 'currency_conversion_failed',
            error:
              conversionError instanceof Error ? conversionError.message : String(conversionError),
            from: normalizedCurrency,
            to: userDefaultCurrency,
            userId,
          });

          // Fallback: use original amount and currency without conversion
          finalAmount = amount;
        }
      } else {
        logger?.debug('[tool:save-transaction]', {
          event: 'no_conversion_needed',
          currency: normalizedCurrency,
          userId,
        });
      }

      // Step 3: Insert transaction into Supabase using service role
      // Emit saving progress
      progressEmitter?.('saving');

      const dbInsertStart = Date.now();
      const { data, error } = await supabaseService
        .from('transactions')
        .insert({
          user_id: userId,
          amount: finalAmount, // Primary amount in user's default currency
          currency: userDefaultCurrency, // Store user's default currency as the main currency
          merchant,
          category,
          description: description || null,
          transaction_date: transactionDate,
          merchant_embedding: merchantEmbedding,
          // Currency conversion tracking
          original_amount: originalAmount,
          original_currency: originalCurrency,
          converted_amount: convertedAmount,
          conversion_rate: conversionRate,
          converted_at: convertedAt,
        })
        .select('id')
        .single();

      const dbInsertDuration = Date.now() - dbInsertStart;
      logger?.info('[tool:performance]', {
        operation: 'database_insert',
        duration: dbInsertDuration,
        userId,
      });

      if (error) {
        logger?.error('[tool:save-transaction]', {
          event: 'database_error',
          error: error.message,
          userId,
        });
        throw new Error(`Failed to save transaction: ${error.message}`);
      }

      const transactionId = data?.id;

      const totalDuration = Date.now() - toolStartTime;
      logger?.info('[tool:performance]', {
        operation: 'save_transaction_complete',
        duration: totalDuration,
        userId,
        transactionId,
      });

      logger?.info('[tool:save-transaction]', {
        event: 'success',
        transactionId,
        userId,
        finalAmount,
        finalCurrency: userDefaultCurrency,
        wasConverted: originalAmount !== null,
      });

      // Build success message with conversion info if applicable
      let successMessage = `Transaction saved successfully (ID: ${transactionId})`;
      if (originalAmount && originalCurrency) {
        successMessage += `. Converted ${originalAmount} ${originalCurrency} to ${finalAmount} ${userDefaultCurrency}`;
      }

      return {
        success: true,
        transactionId,
        message: successMessage,
      };
    } catch (error) {
      const errorDuration = Date.now() - toolStartTime;
      logger?.error('[tool:save-transaction]', {
        event: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: errorDuration,
        userId,
      });

      return {
        success: false,
        message: `Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
