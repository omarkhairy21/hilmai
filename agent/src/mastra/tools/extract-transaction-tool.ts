import { createTool } from '@mastra/core';
import { z } from 'zod';

export const extractTransactionTool = createTool({
  id: 'extract-transaction',
  description: 'Extract transaction details from natural language text',
  inputSchema: z.object({
    text: z.string().describe('Natural language text describing a transaction'),
  }),
  outputSchema: z.object({
    amount: z.number().describe('Transaction amount in USD'),
    merchant: z.string().describe('Merchant or vendor name'),
    category: z.string().describe('Spending category (e.g., groceries, dining, transport)'),
    date: z.string().optional().describe('Transaction date if mentioned'),
    description: z.string().optional().describe('Additional transaction details'),
  }),
  execute: async ({ context }) => {
    const { text } = context;

    // In a real implementation, this would use NLP/LLM to extract details
    // For now, we'll return a basic structure
    // The agent will actually do the extraction using its LLM capabilities

    return {
      amount: 0,
      merchant: 'Unknown',
      category: 'Uncategorized',
      description: text,
    };
  },
});
