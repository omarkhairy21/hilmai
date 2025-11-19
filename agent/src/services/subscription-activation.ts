/**
 * Subscription Activation Service
 *
 * Handles the activation flow for subscriptions from activation codes.
 * Breaks down the complex activateFromActivationCode function into smaller,
 * testable, and composable functions.
 */

import Stripe from 'stripe';
import type { IMastraLogger } from '@mastra/core/logger';
import { stripe } from '../lib/stripe';
import { supabaseService } from '../lib/supabase';
import { isValidActivationCodeFormat } from '../lib/activation-codes';
import type { Database } from '../lib/database.types';

// Type aliases
type ActivationCodeRow = Database['public']['Tables']['activation_codes']['Row'];
type ActivateSubscriptionResult =
  Database['public']['Functions']['activate_subscription_from_code']['Returns'][0];

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Activation code lookup result
 */
export interface CodeLookupResult {
  code: ActivationCodeRow;
  error?: string;
}

/**
 * Subscription details result
 */
export interface SubscriptionDetailsResult {
  subscription: Stripe.Subscription;
  subscriptionId: string;
  error?: string;
}

/**
 * Period end extraction result
 */
export interface PeriodEndResult {
  currentPeriodEnd: string | null;
  error?: string;
}

/**
 * Validate activation code format
 * @param activationCode - The code to validate
 * @returns ValidationResult with error message if invalid
 */
export function validateCodeFormat(activationCode: string): ValidationResult {
  if (!activationCode) {
    return {
      isValid: false,
      error: 'Activation code is required',
    };
  }

  if (!isValidActivationCodeFormat(activationCode)) {
    return {
      isValid: false,
      error: 'Invalid code format. Code should be like: LINK-ABC123',
    };
  }

  return { isValid: true };
}

/**
 * Lookup activation code in database
 * @param activationCode - The code to look up
 * @param logger - Optional logger instance
 * @returns CodeLookupResult with the code or error
 */
export async function lookupActivationCode(
  activationCode: string,
  logger?: IMastraLogger
): Promise<CodeLookupResult> {
  try {
    const { data: codeData, error: fetchError } = await supabaseService
      .from('activation_codes')
      .select('*')
      .eq('code', activationCode)
      .single();

    if (fetchError || !codeData) {
      if (logger) {
        logger.warn('subscription:activation:code_not_found', {
          activationCode,
          error: fetchError?.message,
        });
      }
      return {
        code: {} as ActivationCodeRow,
        error: 'Code not found. Please check and try again.',
      };
    }

    return { code: codeData as ActivationCodeRow };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error('subscription:activation:code_lookup_error', {
        activationCode,
        error: errorMsg,
      });
    }
    return {
      code: {} as ActivationCodeRow,
      error: 'Failed to lookup activation code',
    };
  }
}

/**
 * Validate activation code (expiration, usage status)
 * @param code - The activation code record
 * @param logger - Optional logger instance
 * @returns ValidationResult with error if invalid
 */
export function validateCodeStatus(
  code: ActivationCodeRow,
  logger?: IMastraLogger
): ValidationResult {
  if (new Date(code.expires_at) < new Date()) {
    if (logger) {
      logger.warn('subscription:activation:code_expired', {
        activationCode: code.code,
        expiresAt: code.expires_at,
      });
    }
    return {
      isValid: false,
      error: 'Code has expired. Please purchase a new subscription.',
    };
  }

  if (code.used_at) {
    if (logger) {
      logger.warn('subscription:activation:code_already_used', {
        activationCode: code.code,
        usedAt: code.used_at,
      });
    }
    return {
      isValid: false,
      error: 'Code has already been used.',
    };
  }

  return { isValid: true };
}

/**
 * Retrieve subscription details from Stripe
 * @param stripeSessionId - The Stripe checkout session ID
 * @param logger - Optional logger instance
 * @returns SubscriptionDetailsResult with subscription or error
 */
export async function getSubscriptionDetails(
  stripeSessionId: string,
  logger?: IMastraLogger
): Promise<SubscriptionDetailsResult> {
  try {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (!session || !session.subscription) {
      return {
        subscription: {} as Stripe.Subscription,
        subscriptionId: '',
        error: 'Could not retrieve subscription details. Please contact support.',
      };
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!subscription) {
      return {
        subscription: {} as Stripe.Subscription,
        subscriptionId,
        error: 'Failed to retrieve subscription from Stripe',
      };
    }

    return {
      subscription,
      subscriptionId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error('subscription:activation:stripe_retrieval_failed', {
        stripeSessionId,
        error: errorMsg,
      });
    }
    return {
      subscription: {} as Stripe.Subscription,
      subscriptionId: '',
      error: 'Failed to retrieve subscription details',
    };
  }
}

/**
 * Validate subscription status
 * @param subscription - The Stripe subscription
 * @param logger - Optional logger instance
 * @returns ValidationResult with error if subscription status is invalid
 */
export function validateSubscriptionStatus(
  subscription: Stripe.Subscription,
  logger?: IMastraLogger
): ValidationResult {
  const validStatuses = ['active', 'trialing'];

  if (!validStatuses.includes(subscription.status)) {
    if (logger) {
      logger.warn('subscription:activation:invalid_subscription_status', {
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
      });
    }
    return {
      isValid: false,
      error: `Subscription is ${subscription.status}. Please contact support.`,
    };
  }

  return { isValid: true };
}

/**
 * Extract current period end from subscription
 * @param subscription - The Stripe subscription
 * @returns PeriodEndResult with the period end date or error
 */
export function extractCurrentPeriodEnd(subscription: Stripe.Subscription): PeriodEndResult {
  try {
    let currentPeriodEnd: string | null = null;

    if (subscription.items?.data && subscription.items.data.length > 0) {
      const firstItem = subscription.items.data[0];
      if (
        firstItem &&
        'current_period_end' in firstItem &&
        typeof firstItem.current_period_end === 'number'
      ) {
        currentPeriodEnd = new Date(firstItem.current_period_end * 1000).toISOString();
      }
    }

    return { currentPeriodEnd };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      currentPeriodEnd: null,
      error: `Failed to extract period end: ${errorMsg}`,
    };
  }
}

/**
 * Extract subscription customer ID
 * @param subscription - The Stripe subscription
 * @returns The customer ID as a string
 */
export function extractCustomerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}

/**
 * Extract trial dates from subscription
 * @param subscription - The Stripe subscription
 * @returns Object with trial_started_at and trial_ends_at
 */
export function extractTrialDates(subscription: Stripe.Subscription): {
  trial_started_at: string | null;
  trial_ends_at: string | null;
} {
  return {
    trial_started_at: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_ends_at: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  };
}

/**
 * Activate subscription using RPC function
 * @param activationCode - The activation code
 * @param telegramUserId - The Telegram user ID
 * @param codeRecord - The activation code record
 * @param subscription - The Stripe subscription
 * @param planTier - The plan tier (monthly or annual)
 * @param logger - Optional logger instance
 * @returns RPC activation result or error
 */
export async function activateSubscriptionViaRPC(
  activationCode: string,
  telegramUserId: number,
  codeRecord: ActivationCodeRow,
  subscription: Stripe.Subscription,
  planTier: 'monthly' | 'annual',
  logger?: IMastraLogger
): Promise<{ result?: ActivateSubscriptionResult; error?: string }> {
  try {
    const stripeCustomerId = extractCustomerId(subscription);
    const subscriptionStatus =
      subscription.status as Database['public']['Tables']['users']['Row']['subscription_status'];
    const { currentPeriodEnd } = extractCurrentPeriodEnd(subscription);
    const { trial_started_at, trial_ends_at } = extractTrialDates(subscription);

    if (logger) {
      logger.info('subscription:activation:starting_atomic_activation', {
        telegramUserId,
        activationCode,
        subscriptionId: subscription.id,
        planTier,
      });
    }

    const { data: rpcResult, error: rpcError } = await supabaseService.rpc(
      'activate_subscription_from_code',
      {
        p_code: activationCode,
        p_telegram_user_id: telegramUserId,
        p_telegram_chat_id: telegramUserId,
        p_email: codeRecord.stripe_customer_email || '',
        p_stripe_customer_id: stripeCustomerId,
        p_stripe_subscription_id: subscription.id,
        p_plan_tier: planTier,
        p_subscription_status: subscriptionStatus || 'active',
        p_trial_started_at: trial_started_at,
        p_trial_ends_at: trial_ends_at,
        p_current_period_end: currentPeriodEnd,
      }
    );

    if (rpcError || !rpcResult || rpcResult.length === 0) {
      const errorMsg = rpcError?.message || 'Unknown error during activation';
      if (logger) {
        logger.error('subscription:activation:rpc_failed', {
          telegramUserId,
          activationCode,
          error: errorMsg,
          rpcError,
        });
      }
      return { error: 'Failed to activate subscription. Please try again.' };
    }

    const result: ActivateSubscriptionResult = rpcResult[0];

    if (!result.success) {
      if (logger) {
        logger.error('subscription:activation:rpc_returned_failure', {
          telegramUserId,
          activationCode,
          errorMessage: result.error_message,
        });
      }
      return { error: result.error_message || 'Failed to activate subscription.' };
    }

    return { result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error('subscription:activation:rpc_exception', {
        telegramUserId,
        activationCode,
        error: errorMsg,
      });
    }
    return { error: 'Failed to activate subscription. Please try again.' };
  }
}
