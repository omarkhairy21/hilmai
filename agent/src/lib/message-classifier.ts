/**
 * LLM-based Message Classifier
 * Uses OpenAI to classify messages as transaction, query, or other
 * Supports multilingual inputs and better context understanding
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export type MessageType = 'transaction' | 'query' | 'other';

/**
 * Classify a user message using LLM
 */
export async function classifyMessage(text: string): Promise<MessageType> {
  const result = await classifyWithConfidence(text);
  return result.type;
}

/**
 * Check if a message is a transaction (convenience function)
 */
export async function isTransaction(text: string): Promise<boolean> {
  const type = await classifyMessage(text);
  return type === 'transaction';
}

/**
 * Check if a message is a query (convenience function)
 */
export async function isQuery(text: string): Promise<boolean> {
  const type = await classifyMessage(text);
  return type === 'query';
}

/**
 * Get a detailed classification with confidence using LLM
 */
export async function classifyWithConfidence(text: string): Promise<{
  type: MessageType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}> {
  const trimmedText = text.trim();

  // Handle commands separately
  if (trimmedText.startsWith('/')) {
    return {
      type: 'other',
      confidence: 'high',
      reason: 'Bot command',
    };
  }

  // Handle empty messages
  if (!trimmedText) {
    return {
      type: 'other',
      confidence: 'high',
      reason: 'Empty message',
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
   - Examples: "I bought coffee for $5", "Spent 50 AED on groceries", "اشتريت قهوة بـ 20 درهم", "Pagué 100 euros en el supermercado"
   - Indicators: Contains amount + action (bought, spent, paid) OR just amount with merchant
   - Language: Any language (English, Arabic, Spanish, French, etc.)

2. QUERY: User is asking about their spending/transactions
   - Examples: "How much did I spend on coffee?", "Show my groceries", "كم صرفت على القهوة؟", "¿Cuánto gasté en comida?"
   - Indicators: Questions about past spending, requests for analysis/reports/summaries
   - Language: Any language

3. OTHER: Greetings, chitchat, or unclear messages
   - Examples: "Hello", "Thanks", "What can you do?"

Respond in this EXACT JSON format:
{
  "type": "transaction" | "query" | "other",
  "confidence": "high" | "medium" | "low",
  "reason": "brief explanation"
}

IMPORTANT:
- If the message contains an amount/price AND describes a purchase/expense, classify as TRANSACTION
- If the message asks about past spending or requests information, classify as QUERY
- Confidence should be:
  * HIGH: Clear indicators present
  * MEDIUM: Some ambiguity but leaning towards one category
  * LOW: Very unclear or could be multiple categories`,
        },
        {
          role: 'user',
          content: trimmedText,
        },
      ],
      temperature: 0.3,
    });

    // Parse the response
    const cleaned = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const parsed = JSON.parse(cleaned);

    return {
      type: parsed.type as MessageType,
      confidence: parsed.confidence as 'high' | 'medium' | 'low',
      reason: parsed.reason,
    };
  } catch (error) {
    console.error('Error classifying message with LLM:', error);

    // Fallback to simple heuristic
    const lowerText = trimmedText.toLowerCase();
    const hasQuestionMark = trimmedText.includes('?');
    const hasNumber = /\d/.test(trimmedText);
    const hasQuestionWord = /^(how|what|when|where|which|who|why|show|find)/i.test(lowerText);

    if (hasQuestionMark || hasQuestionWord) {
      return {
        type: 'query',
        confidence: 'low',
        reason: 'Fallback: detected question pattern',
      };
    }

    if (hasNumber) {
      return {
        type: 'transaction',
        confidence: 'low',
        reason: 'Fallback: detected number (possible amount)',
      };
    }

    return {
      type: 'other',
      confidence: 'low',
      reason: 'Fallback: no clear indicators',
    };
  }
}
