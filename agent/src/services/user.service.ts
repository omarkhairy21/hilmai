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

    // User doesn't exist, create new user with 7-day trial
    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + 7); // 7-day trial

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
        subscription_status: 'trialing',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
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

/**
 * Get user's subscription status
 */
export async function getUserSubscription(userId: number) {
  try {
    const { data, error } = await supabaseService
      .from('users')
      .select(
        'stripe_customer_id, stripe_subscription_id, plan_tier, subscription_status, trial_started_at, trial_ends_at, current_period_end'
      )
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[user.service] Failed to fetch subscription:', error);
    return null;
  }
}

/**
 * Update user's subscription metadata
 */
export async function updateUserSubscription(
  userId: number,
  subscriptionData: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan_tier?: 'monthly' | 'annual';
    subscription_status?:
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'incomplete'
      | 'incomplete_expired'
      | 'unpaid';
    trial_started_at?: string;
    trial_ends_at?: string;
    current_period_end?: string;
  }
): Promise<boolean> {
  try {
    const { error } = await supabaseService
      .from('users')
      .update({
        ...subscriptionData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[user.service] Failed to update subscription:', error);
    return false;
  }
}

/**
 * Check if user has active subscription or trial
 */
export async function hasActiveAccess(userId: number): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return false;
    }

    // Check if in trial and trial hasn't expired
    if (subscription.subscription_status === 'trialing' && subscription.trial_ends_at) {
      const trialEnds = new Date(subscription.trial_ends_at);
      if (trialEnds > new Date()) {
        return true;
      }
    }

    // Check if has active subscription
    if (subscription.subscription_status === 'active' && subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      if (periodEnd > new Date()) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[user.service] Failed to check access:', error);
    return false;
  }
}
