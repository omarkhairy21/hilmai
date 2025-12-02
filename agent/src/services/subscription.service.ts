/**
 * Subscription Service
 *
 * Handles Stripe subscription management, checkout, billing portal, and usage tracking
 */

import Stripe from 'stripe';
import type { Api } from 'grammy';
import type { IMastraLogger } from '@mastra/core/logger';
import { stripe, STRIPE_PRICES, STRIPE_WEBHOOK_SECRET } from '../lib/stripe';
import { supabaseService } from '../lib/supabase';
import { updateUserSubscription, getUserSubscription, createOrGetUser } from './user.service';
import { messages } from '../lib/messages';
import {
  generateActivationCode,
  generateDeepLink,
  extractCodeFromStartParam,
} from '../lib/activation-codes';
import type { Database } from '../lib/database.types';
import {
  validateCodeFormat,
  lookupActivationCode,
  validateCodeStatus,
  getSubscriptionDetails,
  validateSubscriptionStatus,
  activateSubscriptionViaRPC,
} from './subscription-activation';

// Type aliases for activation codes - fully typed
type ActivationCodeRow = Database['public']['Tables']['activation_codes']['Row'];
type ActivationCodeInsert = Database['public']['Tables']['activation_codes']['Insert'];
type ActivationCodeUpdate = Database['public']['Tables']['activation_codes']['Update'];

// Global reference to Telegram API for sending messages
let telegramApi: Api | null = null;
let logger: IMastraLogger | null = null;

/**
 * Initialize Telegram API for sending subscription messages
 */
export function initializeTelegramApi(api: Api): void {
  telegramApi = api;
}

/**
 * Initialize logger for subscription service
 */
export function initializeLogger(loggerInstance: IMastraLogger): void {
  logger = loggerInstance;
}

/**
 * Create a Stripe checkout session for a user
 * @param userId - The user's ID (optional for web checkout)
 * @param planTier - The subscription plan tier ('monthly' or 'annual')
 * @param successUrl - URL to redirect to on successful checkout
 * @param cancelUrl - URL to redirect to on canceled checkout
 * @param includeTrial - Whether to include a 7-day free trial (only for monthly plan, default: false)
 * @param customerEmail - Email for checkout (used when userId not provided)
 */
export async function createCheckoutSession(
  userId: number | undefined,
  planTier: 'monthly' | 'annual',
  successUrl: string,
  cancelUrl: string,
  includeTrial = false,
  customerEmail?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Validate price ID is configured FIRST
    const priceId = planTier === 'monthly' ? STRIPE_PRICES.monthly : STRIPE_PRICES.annual;

    if (!priceId) {
      const errorMsg = `Price ID not configured for ${planTier} plan. Set STRIPE_MONTHLY_PRICE_ID or STRIPE_ANNUAL_PRICE_ID in environment.`;
      if (logger) {
        logger.error('subscription:checkout:missing_price_id', {
          userId,
          planTier,
          error: errorMsg,
        });
      }
      return { url: null, error: errorMsg };
    }

    let customerId: string | undefined;
    const metadata: Record<string, string> = {
      plan_tier: planTier,
    };

    // If userId provided, get or create Stripe customer from user record
    if (userId) {
      const { data: user, error: userError } = await supabaseService
        .from('users')
        .select('stripe_customer_id, telegram_username, first_name, email')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        const errorMsg = 'User not found';
        if (logger) {
          logger.error('subscription:checkout:user_not_found', {
            userId,
            error: userError?.message || errorMsg,
          });
        }
        return { url: null, error: errorMsg };
      }

      customerId = user.stripe_customer_id || undefined;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        try {
          const customerData: Stripe.CustomerCreateParams = {
            metadata: {
              telegram_user_id: userId.toString(),
            },
            name: user.first_name || user.telegram_username || `User ${userId}`,
          };

          // Add email if available
          if (user.email) {
            customerData.email = user.email;
          }

          const customer = await stripe.customers.create(customerData);

          customerId = customer.id;

          // Update user with Stripe customer ID
          const { error: updateError } = await supabaseService
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);

          if (updateError) {
            if (logger) {
              logger.warn('subscription:checkout:failed_to_save_customer_id', {
                userId,
                customerId,
                error: updateError.message,
              });
            }
          } else if (logger) {
            logger.info('subscription:checkout:customer_created', {
              userId,
              customerId,
            });
          }
        } catch (customerError) {
          const errorMsg =
            customerError instanceof Error ? customerError.message : String(customerError);
          if (logger) {
            logger.error('subscription:checkout:customer_creation_failed', {
              userId,
              error: errorMsg,
            });
          }
          return { url: null, error: 'Failed to create Stripe customer' };
        }
      }

      metadata.telegram_user_id = userId.toString();
    }

    // Create checkout session
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata,
    };

    // Only add trial for monthly plan if includeTrial is true
    if (includeTrial && planTier === 'monthly') {
      subscriptionData.trial_period_days = 7; // 7-day trial for monthly plan only
    }

    if (logger) {
      logger.info('subscription:checkout:creating_session', {
        userId,
        customerId,
        planTier,
        priceId,
        includeTrial,
        isWeb: !userId,
      });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      metadata,
    };

    // Add customer ID if available, otherwise use email for guest checkout
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (logger) {
      logger.info('subscription:checkout:session_created', {
        userId,
        sessionId: session.id,
        planTier,
      });
    }

    return { url: session.url, error: null };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error('subscription:checkout:error', {
        userId,
        planTier,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return {
      url: null,
      error: errorMsg,
    };
  }
}

/**
 * Create a Stripe billing portal session for a user
 */
export async function createBillingPortalSession(
  userId: number,
  returnUrl: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.stripe_customer_id) {
      const errorMsg = 'No Stripe customer found';
      if (logger) {
        logger.error('subscription:billing_portal:customer_not_found', {
          userId,
          error: userError?.message || errorMsg,
        });
      }
      return { url: null, error: errorMsg };
    }

    if (logger) {
      logger.info('subscription:billing_portal:creating_session', {
        userId,
        customerId: user.stripe_customer_id,
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    if (logger) {
      logger.info('subscription:billing_portal:session_created', {
        userId,
        sessionId: session.id,
      });
    }

    return { url: session.url, error: null };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error('subscription:billing_portal:error', {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return {
      url: null,
      error: errorMsg,
    };
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  body: string | Buffer,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

    console.log('[subscription.service] Webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('[subscription.service] Unhandled event type:', event.type);
    }

    return { success: true };
  } catch (error) {
    console.error('[subscription.service] Webhook error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    };
  }
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  let userId = subscription.metadata.telegram_user_id;
  const planTier = subscription.metadata.plan_tier as 'monthly' | 'annual' | 'free_premium';

  // If no telegram_user_id in metadata, try to find user by Stripe customer
  if (!userId) {
    console.log(
      '[subscription.service] No telegram_user_id in metadata, finding user by customer:',
      subscription.customer
    );
    const foundUserId = await findOrCreateUserFromStripeCustomer(subscription.customer as string);
    if (!foundUserId) {
      console.warn(
        '[subscription.service] Could not find Telegram user for subscription:',
        subscription.id
      );
      // Subscription will be linked when user starts the bot
      return;
    }
    userId = foundUserId.toString();
  }

  const updateData: Parameters<typeof updateUserSubscription>[1] = {
    stripe_subscription_id: subscription.id,
    plan_tier: planTier,
    subscription_status:
      (subscription.status as Database['public']['Tables']['users']['Row']['subscription_status']) ||
      undefined,
  };

  // Add trial period dates if subscription is trialing
  if (subscription.status === 'trialing') {
    if (subscription.trial_start && subscription.trial_start > 0) {
      updateData.trial_started_at = new Date(subscription.trial_start * 1000).toISOString();
    }
    if (subscription.trial_end && subscription.trial_end > 0) {
      updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
    }
  }

  // Add current period end from the first subscription item
  if (subscription.items?.data && subscription.items.data.length > 0) {
    const firstItem = subscription.items.data[0];
    if (firstItem && 'current_period_end' in firstItem && firstItem.current_period_end) {
      updateData.current_period_end = new Date(firstItem.current_period_end * 1000).toISOString();
    }
  }

  const parsedUserId = parseInt(userId, 10);
  await updateUserSubscription(parsedUserId, updateData);

  // Send confirmation message if subscription is now active
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    await sendSubscriptionConfirmationMessage(planTier, parsedUserId);
  }

  console.log('[subscription.service] Updated subscription for user:', userId);
}

/**
 * Handle subscription deleted events
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  let userId = subscription.metadata.telegram_user_id;

  // If no telegram_user_id in metadata, try to find user by Stripe customer
  if (!userId) {
    console.log(
      '[subscription.service] No telegram_user_id in metadata, finding user by customer:',
      subscription.customer
    );
    const foundUserId = await findOrCreateUserFromStripeCustomer(subscription.customer as string);
    if (!foundUserId) {
      console.warn(
        '[subscription.service] Could not find Telegram user for canceled subscription:',
        subscription.id
      );
      return;
    }
    userId = foundUserId.toString();
  }

  await updateUserSubscription(parseInt(userId, 10), {
    subscription_status: 'canceled',
  });

  console.log('[subscription.service] Canceled subscription for user:', userId);
}

/**
 * Handle successful payment events
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.parent?.subscription_details?.subscription) {
    return;
  }

  const subscriptionId =
    typeof invoice.parent.subscription_details.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent.subscription_details.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpdate(subscription);
}

/**
 * Handle failed payment events
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.parent?.subscription_details?.subscription) {
    return;
  }

  const subscriptionId =
    typeof invoice.parent.subscription_details.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent.subscription_details.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.telegram_user_id;

  if (!userId) {
    return;
  }

  await updateUserSubscription(parseInt(userId, 10), {
    subscription_status: 'past_due',
  });

  console.log('[subscription.service] Payment failed for user:', userId);
}

/**
 * Record token usage for a user
 */
export async function recordTokenUsage(userId: number, tokens: number): Promise<void> {
  try {
    // Get user's billing period
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      console.warn('[subscription.service] No subscription found for user:', userId);
      return;
    }

    // Determine billing period
    let periodStart: Date;
    let periodEnd: Date;

    if (subscription.subscription_status === 'trialing' && subscription.trial_ends_at) {
      // During trial, use trial period
      periodStart = subscription.trial_started_at
        ? new Date(subscription.trial_started_at)
        : new Date();
      periodEnd = new Date(subscription.trial_ends_at);
    } else if (subscription.current_period_end) {
      // During active subscription, use current period
      periodEnd = new Date(subscription.current_period_end);
      periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1); // Assume monthly billing
    } else {
      console.warn('[subscription.service] No valid billing period for user:', userId);
      return;
    }

    // Upsert usage record
    const { error } = await supabaseService.from('subscription_usage').upsert(
      {
        user_id: userId,
        billing_period_start: periodStart.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        total_tokens: tokens,
      },
      {
        onConflict: 'user_id,billing_period_start',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      // If upsert fails, try to increment existing record
      const { error: updateError } = await supabaseService.rpc('increment_usage_tokens', {
        p_user_id: userId,
        p_period_start: periodStart.toISOString(),
        p_tokens: tokens,
      });

      if (updateError) {
        console.error('[subscription.service] Failed to record usage:', updateError);
      }
    }
  } catch (error) {
    console.error('[subscription.service] Error recording token usage:', error);
  }
}

/**
 * Link a Stripe customer to a Telegram user by email
 * This is used when a user subscribes via the marketing website
 */
export async function linkStripeCustomerToTelegramUser(
  stripeCustomerId: string,
  email: string
): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    // Find user by email
    const { data: user, error: fetchError } = await supabaseService
      .from('users')
      .select('id, stripe_customer_id')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      console.log('[subscription.service] No user found with email:', email);
      return { success: false, error: 'User not found' };
    }

    // Check if user already has a different Stripe customer
    if (user.stripe_customer_id && user.stripe_customer_id !== stripeCustomerId) {
      console.warn(
        '[subscription.service] User already has different Stripe customer:',
        user.stripe_customer_id
      );
      // Update to new customer ID (user might have created a new account)
    }

    // Link Stripe customer to user
    const { error: updateError } = await supabaseService
      .from('users')
      .update({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[subscription.service] Failed to link customer:', updateError);
      return { success: false, error: 'Failed to link customer' };
    }

    console.log('[subscription.service] Linked customer to user:', user.id);
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('[subscription.service] Error linking customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find or create user from Stripe customer
 * Used for webhook events when user subscribed via website
 */
async function findOrCreateUserFromStripeCustomer(
  stripeCustomerId: string
): Promise<number | null> {
  try {
    // First, try to find existing user by Stripe customer ID
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (existingUser) {
      return existingUser.id;
    }

    // If not found, fetch customer from Stripe to get email
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    if (customer.deleted || !customer.email) {
      console.error('[subscription.service] Invalid Stripe customer:', stripeCustomerId);
      return null;
    }

    // Try to find user by email
    const { data: userByEmail } = await supabaseService
      .from('users')
      .select('id')
      .eq('email', customer.email)
      .single();

    if (userByEmail) {
      // Link the Stripe customer to this user
      await supabaseService
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userByEmail.id);

      return userByEmail.id;
    }

    // User doesn't exist - they subscribed via website before using Telegram
    // Store the subscription info, but return null (they need to start the bot)
    console.log(
      '[subscription.service] User subscribed via website but not in Telegram yet:',
      customer.email
    );
    return null;
  } catch (error) {
    console.error('[subscription.service] Error finding/creating user:', error);
    return null;
  }
}

/**
 * Send subscription confirmation message to user via Telegram
 */
export async function sendSubscriptionConfirmationMessage(
  planTier: string | null,
  userId: number
): Promise<void> {
  if (!telegramApi) {
    console.warn(
      '[subscription.service] Telegram API not initialized, skipping confirmation message for user:',
      userId
    );
    return;
  }

  try {
    const message = messages.subscription.subscriptionConfirmed(planTier);
    await telegramApi.sendMessage(userId, message.text, {
      parse_mode: 'HTML',
      entities: message.entities,
    });
    console.log('[subscription.service] Sent confirmation message to user:', userId);
  } catch (error) {
    console.error(
      '[subscription.service] Failed to send confirmation message to user:',
      userId,
      error
    );
    // Don't throw - message delivery shouldn't block subscription processing
  }
}

/**
 * Get current usage for a user
 */
export async function getCurrentUsage(userId: number): Promise<{ total_tokens: number } | null> {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return null;
    }

    // Determine current billing period start
    let periodStart: Date;

    if (subscription.subscription_status === 'trialing' && subscription.trial_started_at) {
      periodStart = new Date(subscription.trial_started_at);
    } else if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      return null;
    }

    const { data, error } = await supabaseService
      .from('subscription_usage')
      .select('total_tokens')
      .eq('user_id', userId)
      .eq('billing_period_start', periodStart.toISOString())
      .single();

    if (error || !data) {
      return { total_tokens: 0 };
    }

    return data;
  } catch (error) {
    console.error('[subscription.service] Error getting current usage:', error);
    return null;
  }
}

/**
 * Generate activation code for a Stripe checkout session
 * This is called after successful payment to create a bridge between web checkout and bot activation
 * @param sessionId - Stripe checkout session ID
 * @returns Activation code and deep link, or error
 */
export async function generateActivationCodeForSession(
  sessionId: string
): Promise<{ linkCode?: string; deepLink?: string; error?: string }> {
  try {
    if (!sessionId) {
      return { error: 'Missing session ID' };
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    // Verify session is completed or payment succeeded
    if (session.status !== 'complete') {
      // Check if payment actually succeeded via payment_status
      if (session.payment_status === 'paid') {
        // Allow this case - payment succeeded even if session status is unexpected
        if (logger) {
          logger.warn('subscription:activation:unexpected_session_status', {
            sessionId,
            status: session.status,
            paymentStatus: session.payment_status,
          });
        }
      } else {
        return {
          error: `Session is not complete. Status: ${session.status}, Payment: ${session.payment_status}`,
        };
      }
    }

    // Get customer email from session
    const customerEmail = session.customer_email || session.customer_details?.email;
    if (!customerEmail) {
      return { error: 'No email found in session' };
    }

    // Basic email validation (defensive programming)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      if (logger) {
        logger.warn('subscription:activation:invalid_email_format', {
          sessionId,
          email: customerEmail,
        });
      }
      return { error: 'Invalid email format in session' };
    }

    // Get plan tier from session metadata
    const planTier = session.metadata?.plan_tier || 'monthly';

    // Check if activation code already exists for this session
    let existingCode: Pick<ActivationCodeRow, 'code' | 'expires_at' | 'used_at'> | null = null;
    try {
      const { data, error } = await supabaseService
        .from('activation_codes')
        .select('code, expires_at, used_at')
        .eq('stripe_session_id', sessionId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

      if (!error && data) {
        existingCode = data;
      } else if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is fine, log other errors
        const errorMsg = error.message || String(error);
        if (logger) {
          logger.warn('subscription:activation:fetch_existing_code_error', {
            sessionId,
            error: errorMsg,
            errorCode: error.code,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (logger) {
        logger.warn('subscription:activation:fetch_existing_code_exception', {
          sessionId,
          error: errorMsg,
        });
      }
    }

    if (existingCode) {
      // If code exists and not expired, return it
      if (!existingCode.used_at && new Date(existingCode.expires_at) > new Date()) {
        const deepLink = generateDeepLink(existingCode.code);
        if (logger) {
          logger.info('subscription:activation:code_reused', {
            sessionId,
            code: existingCode.code,
          });
        }
        return { linkCode: existingCode.code, deepLink };
      } else {
        // Code exists but is expired or used - log for debugging
        if (logger) {
          logger.warn('subscription:activation:existing_code_invalid', {
            sessionId,
            used: !!existingCode.used_at,
            expired: new Date(existingCode.expires_at) <= new Date(),
            expiresAt: existingCode.expires_at,
          });
        }
      }
    }

    // Generate new activation code with retry logic for collision handling
    let linkCode: string | undefined;
    let attempts = 0;
    const maxAttempts = 5;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Code expires in 48 hours

    while (attempts < maxAttempts) {
      try {
        linkCode = generateActivationCode();
        const insertData: ActivationCodeInsert = {
          code: linkCode,
          stripe_session_id: sessionId,
          stripe_customer_email: customerEmail,
          plan_tier: planTier as 'monthly' | 'annual' | 'free_premium' | null,
          expires_at: expiresAt.toISOString(),
        };

        const { error: insertError } = await supabaseService
          .from('activation_codes')
          .insert(insertData);

        if (insertError) {
          // Check if it's a unique constraint violation (code collision)
          if (insertError.code === '23505' && attempts < maxAttempts - 1) {
            attempts++;
            if (logger) {
              logger.warn('subscription:activation:code_collision', {
                sessionId,
                attempt: attempts,
              });
            }
            continue; // Retry with new code
          }

          // Log detailed error for debugging
          const errorDetails = {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          };

          console.error('[subscription.service] Failed to save activation code:', errorDetails);

          if (logger) {
            logger.error('subscription:activation:database_insert_failed', {
              sessionId,
              error: errorDetails,
              attempt: attempts + 1,
            });
          }

          // Check if it's a duplicate session_id (should reuse existing code)
          if (insertError.code === '23505' && insertError.message?.includes('stripe_session_id')) {
            // Session already has a code, try to fetch it
            const { data: existing } = await supabaseService
              .from('activation_codes')
              .select('code, expires_at, used_at')
              .eq('stripe_session_id', sessionId)
              .single();

            if (existing && !existing.used_at && new Date(existing.expires_at) > new Date()) {
              const deepLink = generateDeepLink(existing.code);
              if (logger) {
                logger.info('subscription:activation:code_found_for_session', {
                  sessionId,
                  code: existing.code,
                });
              }
              return { linkCode: existing.code, deepLink };
            }
          }

          return {
            error: `Failed to create activation code: ${insertError.message || 'Database error'}`,
          };
        }

        // Success - break out of retry loop
        break;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;

        if (attempts < maxAttempts - 1) {
          attempts++;
          if (logger) {
            logger.warn('subscription:activation:retry_after_exception', {
              sessionId,
              attempt: attempts,
              error: errorMsg,
            });
          }
          continue;
        }

        console.error('[subscription.service] Error creating activation code:', {
          error: errorMsg,
          stack: errorStack,
          sessionId,
          attempts,
        });

        if (logger) {
          logger.error('subscription:activation:max_retries_exceeded', {
            sessionId,
            error: errorMsg,
            stack: errorStack,
            attempts,
          });
        }

        return {
          error: `Failed to create activation code after ${maxAttempts} attempts: ${errorMsg}`,
        };
      }
    }

    if (!linkCode) {
      return { error: 'Failed to generate unique activation code after multiple attempts' };
    }

    const deepLink = generateDeepLink(linkCode);

    if (logger) {
      logger.info('subscription:activation:code_generated', {
        sessionId,
        linkCode,
        planTier,
      });
    }

    return { linkCode, deepLink };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[subscription.service] Error generating activation code:', errorMsg);
    if (logger) {
      logger.error('subscription:activation:code_generation_failed', {
        sessionId,
        error: errorMsg,
      });
    }
    return { error: errorMsg };
  }
}

/**
 * Activate subscription using activation code
 * Called when user sends the code to the bot
 *
 * This function orchestrates the activation flow by calling smaller, composable functions.
 * This makes it easier to test, maintain, and understand the activation process.
 *
 * @param activationCode - The activation code (e.g., LINK-ABC123)
 * @param telegramUserId - The Telegram user ID activating the subscription
 * @returns Success status and message
 */
export async function activateFromActivationCode(
  activationCode: string,
  telegramUserId: number
): Promise<{ success: boolean; message: string; planTier?: string }> {
  try {
    // Step 1: Validate code format
    const formatValidation = validateCodeFormat(activationCode);
    if (!formatValidation.isValid) {
      return {
        success: false,
        message: formatValidation.error || 'Invalid activation code format',
      };
    }

    // Step 2: Look up activation code in database
    const codeLookup = await lookupActivationCode(activationCode, logger || undefined);
    if (codeLookup.error) {
      return { success: false, message: codeLookup.error };
    }

    // Step 3: Validate code status (expiration, usage)
    const statusValidation = validateCodeStatus(codeLookup.code, logger || undefined);
    if (!statusValidation.isValid) {
      return { success: false, message: statusValidation.error || 'Code validation failed' };
    }

    // Step 4: Retrieve subscription details from Stripe
    const subDetails = await getSubscriptionDetails(
      codeLookup.code.stripe_session_id,
      logger || undefined
    );
    if (subDetails.error) {
      return { success: false, message: subDetails.error };
    }

    // Step 5: Validate subscription status
    const statusCheck = validateSubscriptionStatus(subDetails.subscription, logger || undefined);
    if (!statusCheck.isValid) {
      return { success: false, message: statusCheck.error || 'Subscription validation failed' };
    }

    // Step 6: Determine plan tier
    const planTier = (codeLookup.code.plan_tier as 'monthly' | 'annual' | 'free_premium') || 'monthly';

    // Step 7: Activate subscription via RPC
    const rpcResult = await activateSubscriptionViaRPC(
      activationCode,
      telegramUserId,
      codeLookup.code,
      subDetails.subscription,
      planTier,
      logger || undefined
    );

    if (rpcResult.error) {
      return { success: false, message: rpcResult.error };
    }
    // Step 9: Log success
    if (logger) {
      logger.info('subscription:activation:success', {
        telegramUserId,
        activationCode,
        planTier,
        subscriptionId: subDetails.subscription.id,
        subscriptionStatus: subDetails.subscription.status,
        event: 'subscription_activated',
      });
    }

    return {
      success: true,
      message: `✅ Subscription activated! Your ${planTier} plan is now active.`,
      planTier,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[subscription.service] Error activating from code:', errorMsg);
    if (logger) {
      logger.error('subscription:activation:activation_failed', {
        telegramUserId,
        activationCode,
        error: errorMsg,
      });
    }
    return {
      success: false,
      message: 'An error occurred during activation. Please contact support.',
    };
  }
}
