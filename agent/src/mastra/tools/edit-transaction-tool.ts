/**
 * Edit Transaction Tool for HilmAI Agent V2
 *
 * Updates transaction fields in Supabase
 * Regenerates merchant embedding if merchant name changes
 *
 * SECURITY:
 * - Uses supabaseService (service role) for unrestricted backend access
 * - Dual user_id verification: fetch check + update filter
 * - RLS policies provide defense in depth
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabaseService } from '../../lib/supabase';
import { getMerchantEmbedding } from '../../lib/embeddings';

export const editTransactionTool = createTool({
  id: 'edit-transaction',
  description: 'Edit an existing transaction by updating its fields',
  inputSchema: z.object({
    transactionId: z.string().describe('Transaction ID (UUID) to edit'),
    userId: z.number().describe('Telegram user ID (for security verification)'),
    amount: z.number().optional().describe('New transaction amount'),
    currency: z.string().optional().describe('New currency code (e.g., AED, USD, SAR)'),
    merchant: z.string().optional().describe('New merchant or vendor name'),
    category: z.string().optional().describe('New transaction category'),
    description: z.string().optional().describe('New transaction description or notes'),
    transactionDate: z.string().optional().describe('New transaction date in YYYY-MM-DD format'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    updatedFields: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    const {
      transactionId,
      userId,
      amount,
      currency,
      merchant,
      category,
      description,
      transactionDate,
    } = context;

    console.log(`[edit-transaction] Editing transaction ${transactionId} for user ${userId}`);

    try {
      // Step 1: Verify transaction belongs to user (security check)
      const { data: existingTransaction, error: fetchError } = await supabaseService
        .from('transactions')
        .select('user_id, merchant')
        .eq('id', transactionId)
        .single();

      if (fetchError || !existingTransaction) {
        throw new Error(`Transaction not found: ${fetchError?.message || 'Unknown error'}`);
      }

      if (existingTransaction.user_id !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to this user');
      }

      // Step 2: Build update payload
      const updatePayload: Record<string, unknown> = {};

      if (amount !== undefined) {
        updatePayload.amount = amount;
      }
      if (currency !== undefined) {
        updatePayload.currency = currency;
      }
      if (category !== undefined) {
        updatePayload.category = category;
      }
      if (description !== undefined) {
        updatePayload.description = description || null;
      }
      if (transactionDate !== undefined) {
        updatePayload.transaction_date = transactionDate;
      }

      // Step 3: Handle merchant change (regenerate embedding)
      const merchantChanged = merchant !== undefined && merchant !== existingTransaction.merchant;
      if (merchantChanged) {
        updatePayload.merchant = merchant;
        const merchantEmbedding = await getMerchantEmbedding(merchant);
        updatePayload.merchant_embedding = merchantEmbedding;
        console.log(
          `[edit-transaction] Regenerated merchant embedding (${merchantEmbedding.length} dimensions)`
        );
      }

      // Step 4: Update transaction using service role
      const { data, error } = await supabaseService
        .from('transactions')
        .update(updatePayload)
        .eq('id', transactionId)
        .eq('user_id', userId) // Extra security: ensure user_id matches
        .select()
        .single();

      if (error) {
        console.error('[edit-transaction] Database error:', error);
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      const updatedFields = Object.keys(updatePayload).filter(
        (key) => key !== 'merchant_embedding'
      );
      console.log(
        `[edit-transaction] ✅ Updated transaction ${transactionId}. Fields: ${updatedFields.join(', ')}`
      );

      return {
        success: true,
        message: `Transaction updated successfully. Updated fields: ${updatedFields.join(', ')}`,
        updatedFields,
      };
    } catch (error) {
      console.error('[edit-transaction] Error:', error);

      return {
        success: false,
        message: `Failed to edit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
