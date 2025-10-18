import { createTool } from '@mastra/core';
import { z } from 'zod';
import { supabase } from '../../lib/supabase.js';

// Type-safe wrapper for Supabase operations
const db = supabase.schema('public');

export const saveTransactionTool = createTool({
  id: 'save-transaction',
  description: 'Save a transaction to the database after extracting details',
  inputSchema: z.object({
    amount: z.number().describe('Transaction amount in USD'),
    merchant: z.string().describe('Merchant or vendor name'),
    category: z.string().describe('Spending category (groceries, dining, transport, shopping, bills, entertainment, healthcare, education, other)'),
    description: z.string().optional().describe('Additional transaction details'),
    transactionDate: z.string().optional().describe('Transaction date in ISO format'),
    telegramChatId: z.number().describe('Telegram chat ID of the user'),
    telegramUsername: z.string().optional().describe('Telegram username'),
    firstName: z.string().optional().describe('User first name'),
    lastName: z.string().optional().describe('User last name'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactionId: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const {
      amount,
      merchant,
      category,
      description,
      transactionDate,
      telegramChatId,
      telegramUsername,
      firstName,
      lastName
    } = context;

    try {
      // First, ensure user exists
      const { data: userData, error: userError } = await db
        .from('users')
        .select('id')
        .eq('telegram_chat_id', telegramChatId)
        .single();

      let userId: string;

      if (userError || !userData) {
        // Create user if doesn't exist
        const { data: newUser, error: createUserError } = await db
          .from('users')
          .insert({
            telegram_chat_id: telegramChatId,
            telegram_username: telegramUsername || null,
            first_name: firstName || null,
            last_name: lastName || null,
          })
          .select('id')
          .single();

        if (createUserError || !newUser) {
          throw new Error(`Failed to create user: ${createUserError?.message}`);
        }

        userId = newUser.id;
      } else {
        userId = userData.id;

        // Update user info if provided
        if (telegramUsername || firstName || lastName) {
          const updateData: any = {};
          if (telegramUsername) updateData.telegram_username = telegramUsername;
          if (firstName) updateData.first_name = firstName;
          if (lastName) updateData.last_name = lastName;

          await db.from('users').update(updateData).eq('id', userId);
        }
      }

      // Insert transaction
      const { data, error } = await db
        .from('transactions')
        .insert({
          user_id: userId,
          telegram_chat_id: telegramChatId,
          amount,
          merchant,
          category,
          description: description || null,
          transaction_date: transactionDate || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to save transaction: ${error.message}`);
      }

      return {
        success: true,
        transactionId: data.id,
        message: `Transaction saved successfully! ID: ${data.id}`,
      };
    } catch (error) {
      console.error('Error saving transaction:', error);
      return {
        success: false,
        message: `Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
