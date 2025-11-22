/**
 * User Mode Management for HilmAI
 *
 * Manages user's current operating mode (logger/chat/query)
 * Modes determine which agent handles messages and memory configuration
 */

import { supabaseService } from './supabase';

export type UserMode = 'logger' | 'chat' | 'query';

/**
 * Get user's current mode from database
 * Defaults to 'chat' if user not found or mode not set
 */
export async function getUserMode(userId: number): Promise<UserMode> {
  try {
    const { data, error } = await supabaseService
      .from('users')
      .select('current_mode')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Default to chat mode for new users or errors
      return 'chat';
    }

    const mode = data.current_mode as UserMode;
    // Validate mode
    if (!['logger', 'chat', 'query'].includes(mode)) {
      return 'chat';
    }

    return mode;
  } catch (error) {
    console.error('[user-mode] Error fetching user mode:', error);
    return 'chat'; // Fallback to chat mode on error
  }
}

/**
 * Set user's current mode in database
 * Creates user record if it doesn't exist (upsert)
 *
 * Note: This function only updates the mode. For creating a complete user record
 * with all Telegram information, use the /start command handler in bot.ts
 */
export async function setUserMode(userId: number, mode: UserMode): Promise<void> {
  try {
    // First check if user exists
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // User exists, just update the mode
      const { error } = await supabaseService
        .from('users')
        .update({
          current_mode: mode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[user-mode] Error updating user mode:', error);
        throw error;
      }
    } else {
      // User doesn't exist, create minimal record
      // (Full record should be created by /start command)
      const { error } = await supabaseService.from('users').insert({
        id: userId,
        telegram_chat_id: userId,
        current_mode: mode,
        default_currency: 'AED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[user-mode] Error creating user with mode:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('[user-mode] Error in setUserMode:', error);
    throw error;
  }
}

/**
 * Get human-readable mode description
 */
export function getModeDescription(mode: UserMode): string {
  switch (mode) {
    case 'logger':
      return 'Logger Mode - Fast transaction logging';
    case 'chat':
      return 'Chat Mode - Conversation and help';
    case 'query':
      return 'Query Mode - Ask about your spending';
    default:
      return 'Unknown Mode';
  }
}

/**
 * Get emoji for mode indicator
 */
export function getModeEmoji(mode: UserMode): string {
  switch (mode) {
    case 'logger':
      return '💰';
    case 'chat':
      return '💬';
    case 'query':
      return '📊';
    default:
      return '🤖';
  }
}

/**
 * Validate if a string is a valid mode
 */
export function isValidMode(mode: string): mode is UserMode {
  return ['logger', 'chat', 'query'].includes(mode);
}
