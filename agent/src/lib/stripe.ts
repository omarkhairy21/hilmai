/**
 * Stripe client configuration
 *
 * Handles Stripe API initialization for subscription management
 */

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is required in .env');
}

/**
 * Stripe client instance
 * Used for creating customers, subscriptions, checkout sessions, and handling webhooks
 */
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

/**
 * Stripe price IDs from environment
 */
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID || '',
  annual: process.env.STRIPE_ANNUAL_PRICE_ID || '',
} as const;

/**
 * Stripe webhook secret for verifying webhook signatures
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Validate that all required Stripe configuration is present
 */
export function validateStripeConfig(): void {
  const missing: string[] = [];

  if (!STRIPE_PRICES.monthly) {
    missing.push('STRIPE_MONTHLY_PRICE_ID');
  }

  if (!STRIPE_PRICES.annual) {
    missing.push('STRIPE_ANNUAL_PRICE_ID');
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    missing.push('STRIPE_WEBHOOK_SECRET');
  }

  if (missing.length > 0) {
    console.warn(
      `[stripe] Missing Stripe configuration: ${missing.join(', ')}. ` +
        'Subscription features will not work properly.'
    );
  }
}

// Validate on import
validateStripeConfig();
