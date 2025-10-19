import { createTool } from '@mastra/core';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const classifyMessageTool = createTool({
  id: 'classify-message',
  description:
    'Classify user messages as transaction, query, or other. Supports multilingual inputs (English, Arabic, Spanish, etc.).',
  inputSchema: z.object({
    text: z.string().describe('The user message to classify'),
  }),
  outputSchema: z.object({
    type: z.enum(['transaction', 'query', 'other']).describe('Message classification type'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Classification confidence level'),
    reason: z.string().describe('Brief explanation for the classification'),
  }),
  execute: async ({ context }) => {
    const { text } = context;

    // Handle edge cases
    if (!text || text.trim().length === 0) {
      return {
        type: 'other' as const,
        confidence: 'high' as const,
        reason: 'Empty message',
      };
    }

    if (text.trim().startsWith('/')) {
      return {
        type: 'other' as const,
        confidence: 'high' as const,
        reason: 'Bot command',
      };
    }

    try {
      const { text: response } = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'system',
            content: `You are a message classifier for a financial assistant bot. Classify user messages into one of three categories:

1. TRANSACTION: User is logging an expense/transaction
   - Examples: "I bought coffee for $5", "Spent 50 AED on groceries", "اشتريت قهوة بـ 20 درهم", "Pagué 100 euros"
   - Indicators: Contains amount + action (bought, spent, paid) OR just amount with merchant
   - Any language supported

2. QUERY: User is asking about their spending/transactions
   - Examples: "How much did I spend on coffee?", "Show my groceries", "كم صرفت على القهوة؟"
   - Indicators: Questions about past spending, requests for analysis/reports
   - Any language supported

3. OTHER: Greetings, chitchat, or unclear messages
   - Examples: "Hello", "Thanks", "What can you do?"

Respond in this EXACT JSON format:
{
  "type": "transaction" | "query" | "other",
  "confidence": "high" | "medium" | "low",
  "reason": "brief explanation"
}

Rules:
- If amount/price + purchase action → TRANSACTION
- If asking about past spending → QUERY
- HIGH confidence: clear indicators
- MEDIUM confidence: some ambiguity
- LOW confidence: very unclear`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      });

      // Parse LLM response
      const cleaned = response
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');
      const parsed = JSON.parse(cleaned);

      return {
        type: parsed.type as 'transaction' | 'query' | 'other',
        confidence: parsed.confidence as 'high' | 'medium' | 'low',
        reason: parsed.reason || 'No reason provided',
      };
    } catch (error) {
      console.error('Error in classify-message tool:', error);

      // Fallback heuristic
      const lowerText = text.toLowerCase();
      const hasNumber = /\d/.test(text);
      const hasQuestionMark = text.includes('?');
      const hasQuestionWord = /^(how|what|when|where|which|who|why|show|find|كم|ما|متى|أين)/i.test(
        lowerText
      );

      if (hasQuestionMark || hasQuestionWord) {
        return {
          type: 'query' as const,
          confidence: 'low' as const,
          reason: 'Fallback: detected question pattern',
        };
      }

      if (hasNumber) {
        return {
          type: 'transaction' as const,
          confidence: 'low' as const,
          reason: 'Fallback: detected number (possible amount)',
        };
      }

      return {
        type: 'other' as const,
        confidence: 'low' as const,
        reason: 'Fallback: no clear indicators',
      };
    }
  },
});
