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

    // User doesn't exist, create new user with free status and auto-start trial
    const now = new Date();
    const trialStart = now;
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const { error: createError, data: newUser } = await supabaseService
      .from('users')
      .insert({
        id: userId,
        telegram_chat_id: userId,
        telegram_username: userData.telegram_username || null,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
        current_mode: 'chat', // Default to chat mode
        default_currency: 'USD', // Default currency
        subscription_status: 'free',
        trial_started_at: trialStart.toISOString(), // Start hidden trial automatically
        trial_ends_at: trialEnd.toISOString(),
        trial_messages_used: 0, // Initialize message counter to 0
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
      | 'free'
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

/**
 * Check if user has messages remaining in their hidden free trial
 * Returns { canUse: boolean, remaining: number, isTrialActive: boolean }
 */
export async function checkTrialMessageLimit(userId: number): Promise<{
  canUse: boolean;
  remaining: number;
  isTrialActive: boolean;
  messagesUsed: number;
}> {
  const TRIAL_MESSAGE_LIMIT = 5;

  try {
    const { data: user, error } = await supabaseService
      .from('users')
      .select('subscription_status, trial_started_at, trial_ends_at, trial_messages_used')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('[user.service] Failed to fetch trial status:', error);
      // Default to allowing if we can't check (safer fallback)
      return { canUse: true, remaining: 5, isTrialActive: true, messagesUsed: 0 };
    }

    // Only applies to 'free' status users
    if (user.subscription_status !== 'free') {
      // Non-free users have unlimited access in their plan
      return { canUse: true, remaining: -1, isTrialActive: false, messagesUsed: 0 };
    }

    // Check if trial has expired
    const now = new Date();
    const trialEnded = user.trial_ends_at ? new Date(user.trial_ends_at) < now : false;

    if (trialEnded) {
      return { canUse: false, remaining: 0, isTrialActive: false, messagesUsed: user.trial_messages_used };
    }

    // Trial is active, check message limit
    const messagesUsed = user.trial_messages_used || 0;
    const remaining = Math.max(0, TRIAL_MESSAGE_LIMIT - messagesUsed);
    const canUse = remaining > 0;

    return {
      canUse,
      remaining,
      isTrialActive: true,
      messagesUsed,
    };
  } catch (error) {
    console.error('[user.service] Error checking trial message limit:', error);
    // Default to allowing if we can't check
    return { canUse: true, remaining: 5, isTrialActive: true, messagesUsed: 0 };
  }
}

/**
 * Increment user's trial message counter
 */
export async function incrementTrialMessageCount(userId: number): Promise<boolean> {
  try {
    // First, get current count
    const { data: user, error: fetchError } = await supabaseService
      .from('users')
      .select('trial_messages_used')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      console.error('[user.service] Failed to fetch trial messages:', fetchError);
      return false;
    }

    const currentCount = user.trial_messages_used || 0;
    const newCount = currentCount + 1;

    // Update with new count
    const { error: updateError } = await supabaseService
      .from('users')
      .update({
        trial_messages_used: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[user.service] Failed to increment trial messages:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[user.service] Error incrementing trial message count:', error);
    return false;
  }
}

/**
 * Get user's timezone
 * Returns the timezone or 'UTC' as default
 */
export async function getUserTimezone(userId: number): Promise<string> {
  try {
    const { data, error } = await supabaseService
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn(`[user.service] Failed to fetch timezone for user ${userId}:`, error);
      return 'UTC'; // Default fallback
    }

    // Return stored timezone or UTC as default
    return data?.timezone || 'UTC';
  } catch (error) {
    console.error('[user.service] Failed to get timezone:', error);
    return 'UTC'; // Default fallback
  }
}

/**
 * Update user's timezone
 * Validates timezone against IANA timezone database
 */
export async function updateUserTimezone(userId: number, timezone: string): Promise<boolean> {
  try {
    // Validate timezone using Intl API
    try {
      // This will throw if timezone is invalid
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      console.error(`[user.service] Invalid timezone: ${timezone}`);
      return false;
    }

    const { error } = await supabaseService
      .from('users')
      .update({
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[user.service] Failed to update timezone:', error);
    return false;
  }
}
