/**
 * Subscription Service
 *
 * Handles Stripe subscription management, checkout, billing portal, and usage tracking
 */

import Stripe from 'stripe';
import { stripe, STRIPE_PRICES, STRIPE_WEBHOOK_SECRET } from '../lib/stripe';
import { supabaseService } from '../lib/supabase';
import { updateUserSubscription, getUserSubscription } from './user.service';

/**
 * Create a Stripe checkout session for a user
 */
export async function createCheckoutSession(
  userId: number,
  planTier: 'monthly' | 'annual',
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Get or create Stripe customer
    const { data: user } = await supabaseService
      .from('users')
      .select('stripe_customer_id, telegram_username, first_name, email')
      .eq('id', userId)
      .single();

    if (!user) {
      return { url: null, error: 'User not found' };
    }

    let customerId = user.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
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
      await supabaseService
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Get price ID based on plan tier
    const priceId = planTier === 'monthly' ? STRIPE_PRICES.monthly : STRIPE_PRICES.annual;

    if (!priceId) {
      return { url: null, error: `Price ID not configured for ${planTier} plan` };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 7, // 7-day trial
        metadata: {
          telegram_user_id: userId.toString(),
          plan_tier: planTier,
        },
      },
      metadata: {
        telegram_user_id: userId.toString(),
        plan_tier: planTier,
      },
    });

    return { url: session.url, error: null };
  } catch (error) {
    console.error('[subscription.service] Failed to create checkout session:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
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
    const { data: user } = await supabaseService
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user || !user.stripe_customer_id) {
      return { url: null, error: 'No Stripe customer found' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return { url: session.url, error: null };
  } catch (error) {
    console.error('[subscription.service] Failed to create billing portal session:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to create billing portal session',
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
  const planTier = subscription.metadata.plan_tier as 'monthly' | 'annual';

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
    subscription_status: subscription.status as any,
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

  // Add current period end if it's valid
  if (subscription.current_period_end && subscription.current_period_end > 0) {
    updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }

  await updateUserSubscription(parseInt(userId, 10), updateData);

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
  if (!invoice.subscription) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionUpdate(subscription);
}

/**
 * Handle failed payment events
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
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
