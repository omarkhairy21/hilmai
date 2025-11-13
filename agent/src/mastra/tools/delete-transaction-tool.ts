/**
 * Delete Transaction Tool for HilmAI Agent V2
 *
 * Deletes a transaction from Supabase
 * Includes security check to ensure user owns the transaction
 *
 * SECURITY:
 * - Uses supabaseService (service role) for unrestricted backend access
 * - Dual user_id verification: fetch check + delete filter
 * - RLS policies provide defense in depth
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabaseService } from '../../lib/supabase';

export const deleteTransactionTool = createTool({
  id: 'delete-transaction',
  description: 'Delete a transaction from the database',
  inputSchema: z.object({
    transactionId: z.string().describe('Transaction ID (UUID) to delete'),
    userId: z.number().describe('Telegram user ID (for security verification)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { transactionId, userId } = context;

    console.log(`[delete-transaction] Deleting transaction ${transactionId} for user ${userId}`);

    try {
      // Step 1: Verify transaction belongs to user (security check)
      const { data: existingTransaction, error: fetchError } = await supabaseService
        .from('transactions')
        .select('user_id, amount, currency, merchant, transaction_date')
        .eq('id', transactionId)
        .single();

      if (fetchError || !existingTransaction) {
        throw new Error(`Transaction not found: ${fetchError?.message || 'Unknown error'}`);
      }

      if (existingTransaction.user_id !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to this user');
      }

      // Step 2: Delete transaction using service role
      const { error: deleteError } = await supabaseService
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', userId); // Extra security: ensure user_id matches

      if (deleteError) {
        console.error('[delete-transaction] Database error:', deleteError);
        throw new Error(`Failed to delete transaction: ${deleteError.message}`);
      }

      console.log(`[delete-transaction] ✅ Deleted transaction ${transactionId}`);

      return {
        success: true,
        message: `Transaction deleted successfully: ${existingTransaction.amount} ${existingTransaction.currency} at ${existingTransaction.merchant} on ${existingTransaction.transaction_date}`,
      };
    } catch (error) {
      console.error('[delete-transaction] Error:', error);

      return {
        success: false,
        message: `Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
