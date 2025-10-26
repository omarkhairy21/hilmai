import { openai } from '../../lib/openai';
import { Telemetry } from '@mastra/core';
import { trace } from '@opentelemetry/api';

/**
 * Generate embedding vector for text using OpenAI's text-embedding-3-large model
 * @param text - The text to embed
 * @returns Promise<number[]> - The embedding vector (3072 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const tracer = trace.getTracer('mastra-tracer');

  return tracer.startActiveSpan('generateEmbedding', async (span) => {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      span.setAttribute('embedding.text', text.substring(0, 100)); // First 100 chars
      span.setAttribute('embedding.text_length', text.length);
      span.setAttribute('embedding.model', 'text-embedding-3-large');

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text.trim(),
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      const embedding = response.data[0].embedding;
      span.setAttribute('embedding.dimensions', embedding.length);
      span.setStatus({ code: 2 }); // OK status

      return embedding;
    } catch (error) {
      span.setStatus({
        code: 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      console.error('Error generating embedding:', error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      span.end();
    }
  });
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
 * Generate embedding with retry logic (internal implementation)
 */
async function _generateEmbeddingWithRetry(text: string, maxRetries = 3): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const embedding = await generateEmbedding(text);
      return embedding;
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

/**
 * Generate embedding with retry logic (traced)
 * @param text - The text to embed
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise<number[]> - The embedding vector
 */
export const generateEmbeddingWithRetry = async (
  text: string,
  maxRetries = 3
): Promise<number[]> => {
  try {
    const telemetry = Telemetry.get();
    const tracedMethod = telemetry.traceMethod(_generateEmbeddingWithRetry, {
      spanName: 'generateEmbeddingWithRetry',
      attributes: {
        'embedding.text_length': text.length.toString(),
        'embedding.max_retries': maxRetries.toString(),
      },
      skipIfNoTelemetry: true,
    });
    return await tracedMethod(text, maxRetries);
  } catch (error) {
    // If telemetry is not initialized, fall back to direct call
    return await _generateEmbeddingWithRetry(text, maxRetries);
  }
};
