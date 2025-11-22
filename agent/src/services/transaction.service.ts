/**
 * Transaction Service
 *
 * Handles transaction database operations with retry logic for race conditions.
 * Extracted from save-transaction-tool to improve maintainability.
 */

import { supabaseService } from '../lib/supabase';
import type { Mastra } from '@mastra/core/mastra';

// Logger type - matches what mastra.getLogger() returns
type Logger = ReturnType<Mastra['getLogger']>;

export interface TransactionInsertPayload {
  user_id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  description: string | null;
  transaction_date: string;
  merchant_embedding: number[] | null;
  original_amount: number | null;
  original_currency: string | null;
  converted_amount: number | null;
  conversion_rate: number | null;
  converted_at: string | null;
}

export interface InsertTransactionResult {
  transactionId: string;
  duration: number;
}

/**
 * Check if error is a duplicate key violation for display_id (race condition)
 */
function isDisplayIdDuplicateError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = String(error.message);
    return (
      errorMessage.includes('unique_user_display_id') ||
      errorMessage.includes('duplicate key value violates unique constraint')
    );
  }
  return false;
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Caps at 2000ms (2 seconds)
 */
function calculateBackoffDelay(attempt: number): number {
  return Math.min(100 * Math.pow(2, attempt), 2000);
}

/**
 * Insert transaction into database with retry logic for race conditions
 *
 * Retries up to 7 times on display_id duplicate errors (race conditions)
 * with exponential backoff. Other errors are thrown immediately.
 *
 * @param payload - Transaction data to insert
 * @param logger - Optional logger for retry attempts
 * @returns Transaction ID and insert duration
 * @throws Error if insert fails after all retries or on non-retryable errors
 */
export async function insertTransactionWithRetry(
  payload: TransactionInsertPayload,
  logger?: Logger
): Promise<InsertTransactionResult> {
  const MAX_RETRIES = 7;
  let lastError: unknown = null;
  let data: { id: string } | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { data: insertData, error } = await supabaseService
      .from('transactions')
      .insert(payload)
      .select('id')
      .single();

    if (!error) {
      data = insertData;
      break; // Success, exit retry loop
    }

    lastError = error;

    // Only retry on display_id duplicate errors (race conditions)
    if (!isDisplayIdDuplicateError(error)) {
      // Not a retryable error, throw immediately
      logger?.error('[transaction-service]', {
        event: 'database_error',
        error: error.message,
        userId: payload.user_id,
        attempt,
        retryable: false,
      });
      throw new Error(`Failed to save transaction: ${error.message}`);
    }

    // Log retry attempt
    if (attempt < MAX_RETRIES) {
      const backoffMs = calculateBackoffDelay(attempt);
      logger?.warn('[transaction-service]', {
        event: 'retry_attempt',
        error: error.message,
        userId: payload.user_id,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        backoffMs,
        reason: 'display_id_race_condition',
      });

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } else {
      // Max retries reached
      logger?.error('[transaction-service]', {
        event: 'max_retries_exceeded',
        error: error.message,
        userId: payload.user_id,
        attempts: MAX_RETRIES + 1,
        reason: 'display_id_race_condition',
      });
    }
  }

  // If we exhausted retries, throw the last error
  if (!data && lastError) {
    const errorMessage =
      lastError && typeof lastError === 'object' && 'message' in lastError
        ? String(lastError.message)
        : 'Unknown error';
    throw new Error(
      `Failed to save transaction after ${MAX_RETRIES + 1} attempts due to display_id race condition: ${errorMessage}`
    );
  }

  const duration = Date.now() - startTime;

  if (!data) {
    throw new Error('Transaction insert succeeded but no data returned');
  }

  return {
    transactionId: data.id,
    duration,
  };
}

