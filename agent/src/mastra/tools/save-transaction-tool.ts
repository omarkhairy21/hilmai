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
  execute: async ({ context }) => {
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

    console.log(
      `[save-transaction] Saving transaction for user ${userId}: ${amount} ${currency} at ${merchant} on ${transactionDate}`
    );
    console.log(
      `[save-transaction] User metadata: userId=${userId}, telegramChatId=${telegramChatId}, username=${telegramUsername}, firstName=${firstName}, lastName=${lastName}`
    );

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
      const [merchantEmbedding, userUpsertResult] = await Promise.all([
        getMerchantEmbedding(merchant),
        supabaseService.from('users').upsert([userPayload]),
      ]);

      if (userUpsertResult.error) {
        console.error('[save-transaction] Failed to upsert user:', userUpsertResult.error);
        throw new Error(
          `Failed to sync user profile before saving transaction: ${userUpsertResult.error.message}`
        );
      }

      console.log(
        `[save-transaction] Generated embedding (${merchantEmbedding.length} dimensions)`
      );

      // Step 2: Insert transaction into Supabase using service role
      const { data, error } = await supabaseService
        .from('transactions')
        .insert({
          user_id: userId,
          amount,
          currency,
          merchant,
          category,
          description: description || null,
          transaction_date: transactionDate,
          merchant_embedding: merchantEmbedding,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[save-transaction] Database error:', error);
        throw new Error(`Failed to save transaction: ${error.message}`);
      }

      const transactionId = data?.id;
      console.log(`[save-transaction] ✅ Saved transaction ID: ${transactionId}`);

      return {
        success: true,
        transactionId,
        message: `Transaction saved successfully (ID: ${transactionId})`,
      };
    } catch (error) {
      console.error('[save-transaction] Error:', error);

      return {
        success: false,
        message: `Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
