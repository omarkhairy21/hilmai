import { createTool } from '@mastra/core';
import { z } from 'zod';
import { saveTransaction } from '../../lib/save-transaction';

/**
 * Mastra tool wrapper for saveTransaction function.
 * This allows the transactionExtractor agent to save transactions.
 */
export const saveTransactionTool = createTool({
  id: 'save-transaction',
  description: 'Save a transaction to the database after extracting details',
  inputSchema: z.object({
    amount: z.number().describe('Transaction amount'),
    currency: z.string().default('USD').describe('Currency code (USD, EUR, GBP, AED, SAR, etc.)'),
    merchant: z.string().describe('Merchant or vendor name'),
    category: z
      .string()
      .describe(
        'Spending category (groceries, dining, transport, shopping, bills, entertainment, healthcare, education, other)'
      ),
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
    return saveTransaction(context);
  },
});
