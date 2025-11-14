/**
 * Webhook Service
 *
 * Handles storage and tracking of incoming Telegram webhook updates
 * for monitoring and future retry mechanism implementation
 */

import { supabaseService } from '../lib/supabase';

export type WebhookUpdateStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Store incoming webhook update in database
 *
 * @param updateId - Telegram's update_id from the webhook payload
 * @param payload - Raw Telegram update payload (JSON)
 * @returns Promise resolving to true if stored successfully, false otherwise
 */
export async function storeWebhookUpdate(
  updateId: number,
  payload: unknown
): Promise<boolean> {
  try {
    const { error } = await supabaseService
      .from('webhook_updates')
      .insert({
        update_id: updateId,
        payload: payload as any,
        status: 'pending',
      });

    if (error) {
      // If duplicate update_id, that's okay - just log and return false
      if (error.code === '23505') {
        // Unique constraint violation (duplicate update_id)
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    // Log error but don't throw - we don't want to block webhook processing
    console.error('[webhook-service] Failed to store webhook update', {
      updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if update_id already exists (duplicate detection)
 *
 * @param updateId - Telegram's update_id
 * @returns Promise resolving to true if duplicate exists, false otherwise
 */
export async function isDuplicateUpdate(updateId: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseService
      .from('webhook_updates')
      .select('id')
      .eq('update_id', updateId)
      .limit(1)
      .single();

    if (error) {
      // If no rows found, that's fine - not a duplicate
      if (error.code === 'PGRST116') {
        return false;
      }
      throw error;
    }

    return !!data;
  } catch (error) {
    // On error, assume not duplicate to allow processing
    console.error('[webhook-service] Failed to check duplicate update', {
      updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Mark webhook update as processing
 *
 * @param updateId - Telegram's update_id
 * @returns Promise resolving to true if updated successfully
 */
export async function markAsProcessing(updateId: number): Promise<boolean> {
  try {
    const { error } = await supabaseService
      .from('webhook_updates')
      .update({ status: 'processing' })
      .eq('update_id', updateId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[webhook-service] Failed to mark as processing', {
      updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Mark webhook update as completed
 *
 * @param updateId - Telegram's update_id
 * @returns Promise resolving to true if updated successfully
 */
export async function markAsCompleted(updateId: number): Promise<boolean> {
  try {
    const { error } = await supabaseService
      .from('webhook_updates')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('update_id', updateId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[webhook-service] Failed to mark as completed', {
      updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Mark webhook update as failed with error message
 *
 * @param updateId - Telegram's update_id
 * @param error - Error message or Error object
 * @returns Promise resolving to true if updated successfully
 */
export async function markAsFailed(updateId: number, error: string | Error): Promise<boolean> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const { error: dbError } = await supabaseService
      .from('webhook_updates')
      .update({
        status: 'failed',
        last_error: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('update_id', updateId);

    if (dbError) {
      throw dbError;
    }

    return true;
  } catch (dbError) {
    console.error('[webhook-service] Failed to mark as failed', {
      updateId,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    return false;
  }
}

