/**
 * Edit Context Service
 * Encapsulates all logic for building the edit command context
 */

import { getUserTimezone } from './user.service';
import { supabaseService } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import type { Context } from 'grammy';

/**
 * Edit context data passed to the transaction manager agent
 */
export interface EditContext {
  userId: number;
  displayId: number;
  transactionId: string; // UUID
  changes: string;
  contextPrompt: string;
}

/**
 * Resolves display_id to internal UUID using RPC function
 * @param userId - Telegram user ID
 * @param displayId - User-friendly sequential transaction ID
 * @returns Transaction UUID or null if not found
 */
async function resolveTransactionId(userId: number, displayId: number): Promise<string | null> {
  const { data: transactionId, error } = await supabaseService.rpc(
    'get_transaction_id_by_display_id',
    { p_user_id: userId, p_display_id: displayId }
  );

  if (error || !transactionId) {
    return null;
  }

  return transactionId as string;
}

/**
 * Gets user timezone and calculates current date and yesterday
 * @param userId - Telegram user ID
 * @returns Object with timezone, currentDate, and yesterdayStr
 */
async function getUserDateContext(userId: number) {
  const userTimezone = await getUserTimezone(userId);
  const now = new Date();
  const currentDate = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  const yesterdayStr = formatInTimeZone(subDays(now, 1), userTimezone, 'yyyy-MM-dd');

  return { userTimezone, currentDate, yesterdayStr };
}

/**
 * Builds user metadata from Grammy context
 * @param ctx - Grammy context
 * @returns User metadata object
 */
function buildUserMetadata(
  ctx: Context,
  userId: number
): {
  userId: number;
  telegramChatId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  messageId: number;
} {
  return {
    userId,
    telegramChatId: userId,
    username: ctx.from?.username ?? null,
    firstName: ctx.from?.first_name ?? null,
    lastName: ctx.from?.last_name ?? null,
    messageId: ctx.message?.message_id ?? 0,
  };
}

/**
 * Builds the context prompt for the transaction manager agent
 * @param params - Prompt building parameters
 * @returns Context prompt string
 */
function buildContextPrompt(params: {
  userTimezone: string;
  currentDate: string;
  yesterdayStr: string;
  firstName: string | null;
  username: string | null;
  userId: number;
  messageId: number;
  userMetadata: ReturnType<typeof buildUserMetadata>;
  displayId: number;
  transactionId: string;
  changes: string;
}): string {
  const {
    userTimezone,
    currentDate,
    yesterdayStr,
    firstName,
    username,
    userId,
    messageId,
    userMetadata,
    displayId,
    transactionId,
    changes,
  } = params;

  return [
    `[Current Date: Today is ${currentDate}, Yesterday was ${yesterdayStr}]`,
    `[User Timezone: ${userTimezone}]`,
    `[User: ${firstName || 'Unknown'} (@${username || 'unknown'})]`,
    `[User ID: ${userId}]`,
    `[Message ID: ${messageId}]`,
    `[User Metadata JSON: ${JSON.stringify(userMetadata)}]`,
    `[Message Type: edit_command]`,
    `[Transaction Display ID: ${displayId}]`,
    `[Transaction ID (UUID): ${transactionId}]`,
    '',
    `User is editing transaction #${displayId}.`,
    'Apply the requested changes and update the transaction. Respond with the updated transaction details.',
    'Changes requested:',
    changes,
  ].join('\n');
}

/**
 * Builds the complete edit context for the transaction manager agent
 *
 * This function encapsulates all the logic needed to:
 * 1. Resolve display_id to internal UUID
 * 2. Get user timezone and date context
 * 3. Build user metadata
 * 4. Build the context prompt
 *
 * @param userId - Telegram user ID
 * @param displayId - User-friendly sequential transaction ID
 * @param changes - Changes requested by the user
 * @param ctx - Grammy context for user info
 * @returns EditContext object or null if transaction not found
 */
export async function buildEditContext(
  userId: number,
  displayId: number,
  changes: string,
  ctx: Context
): Promise<EditContext | null> {
  // Resolve display_id to internal UUID
  const transactionId = await resolveTransactionId(userId, displayId);
  if (!transactionId) {
    return null;
  }

  // Get date context
  const { userTimezone, currentDate, yesterdayStr } = await getUserDateContext(userId);

  // Build user metadata
  const userMetadata = buildUserMetadata(ctx, userId);

  // Build context prompt
  const contextPrompt = buildContextPrompt({
    userTimezone,
    currentDate,
    yesterdayStr,
    firstName: ctx.from?.first_name ?? null,
    username: ctx.from?.username ?? null,
    userId,
    messageId: ctx.message?.message_id ?? 0,
    userMetadata,
    displayId,
    transactionId,
    changes,
  });

  return {
    userId,
    displayId,
    transactionId,
    changes,
    contextPrompt,
  };
}
