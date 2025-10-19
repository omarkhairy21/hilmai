import { openai } from '../../lib/openai.js';

/**
 * Generate embedding vector for text using OpenAI's text-embedding-3-large model
 * @param text - The text to embed
 * @returns Promise<number[]> - The embedding vector (3072 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text.trim(),
      encoding_format: 'float',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Format transaction data into a text string optimized for embedding
 * @param transaction - Transaction details
 * @returns string - Formatted text for embedding
 */
export function formatTransactionForEmbedding(transaction: {
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string;
  description?: string;
}): string {
  const parts = [
    `${transaction.amount} ${transaction.currency}`,
    `at ${transaction.merchant}`,
    `for ${transaction.category}`,
    `on ${transaction.date}`,
  ];

  if (transaction.description) {
    parts.push(transaction.description);
  }

  return parts.join(' ');
}

/**
 * Generate embedding with retry logic
 * @param text - The text to embed
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise<number[]> - The embedding vector
 */
export async function generateEmbeddingWithRetry(text: string, maxRetries = 3): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Embedding generation attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to generate embedding after retries');
}
