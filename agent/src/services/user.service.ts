import { supabaseService } from '../lib/supabase';

interface UserData {
  telegram_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface CreateOrGetUserResult {
  error: Error | null;
  created: boolean;
  user?: any;
}

/**
 * Creates or gets a user in the database
 * Checks if user exists before creating to avoid duplicate errors
 */
export async function createOrGetUser(
  userId: number,
  userData: UserData
): Promise<CreateOrGetUserResult> {
  try {
    // First, check if user already exists
    const { data: existingUser, error: fetchError } = await supabaseService
      .from('users')
      .select('id, current_mode, default_currency')
      .eq('id', userId)
      .single();

    if (!fetchError && existingUser) {
      // User exists, update with latest info
      const { error: updateError, data: updatedUser } = await supabaseService
        .from('users')
        .update({
          telegram_username: userData.telegram_username || null,
          first_name: userData.first_name || null,
          last_name: userData.last_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        return { error: updateError, created: false };
      }

      return { error: null, created: false, user: updatedUser || existingUser };
    }

    // User doesn't exist, create new user
    const { error: createError, data: newUser } = await supabaseService
      .from('users')
      .insert({
        id: userId,
        telegram_chat_id: userId,
        telegram_username: userData.telegram_username || null,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
        current_mode: 'chat', // Default to chat mode
        default_currency: 'AED', // Default currency
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      return { error: createError, created: false };
    }

    return { error: null, created: true, user: newUser };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      created: false,
    };
  }
}
