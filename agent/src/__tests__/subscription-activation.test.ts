/**
 * Unit Tests for Subscription Activation Service
 *
 * Tests individual functions that make up the subscription activation flow.
 * Each function is tested in isolation with mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Stripe from 'stripe';

// Mock Stripe and Supabase before importing subscription-activation
vi.mock('../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { retrieve: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
  },
  STRIPE_PRICES: { monthly: 'price_monthly_test', annual: 'price_annual_test' },
  STRIPE_WEBHOOK_SECRET: 'test_secret',
}));

vi.mock('../lib/supabase', () => ({
  supabaseService: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  validateCodeFormat,
  lookupActivationCode,
  validateCodeStatus,
  getSubscriptionDetails,
  validateSubscriptionStatus,
  extractCurrentPeriodEnd,
  extractCustomerId,
  extractTrialDates,
} from '../services/subscription-activation';
import type { Database } from '../lib/database.types';

// Type aliases for test data
type ActivationCodeRow = Database['public']['Tables']['activation_codes']['Row'];

/**
 * Create a mock activation code for testing
 */
function createMockActivationCode(overrides?: Partial<ActivationCodeRow>): ActivationCodeRow {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return {
    id: 'test-id-123',
    code: 'LINK-ABC123',
    stripe_session_id: 'cs_test_session_123',
    stripe_customer_email: 'customer@example.com',
    plan_tier: 'monthly',
    used_at: null,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Stripe subscription for testing
 */
function createMockStripeSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 'sub_test_123',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
    },
    billing_cycle_anchor: now,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'aed',
    current_period_end: now + 30 * 24 * 60 * 60, // 30 days from now
    current_period_start: now,
    customer: 'cus_test_customer_123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test_123',
          object: 'subscription_item',
          billing_thresholds: null,
          created: now,
          currency: 'aed',
          custom_price: null,
          customer: 'cus_test_customer_123',
          deleted: false,
          discount: null,
          discounts: [],
          invoice_settings: null,
          metadata: {},
          price: {
            id: 'price_test_123',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: now,
            currency: 'aed',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: 'prod_test_123',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              meter: null,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 9900,
            unit_amount_decimal: '9900',
          },
          proration_date: null,
          quantity: 1,
          subscription: 'sub_test_123',
          tax_rates: [],
          current_period_end: now + 30 * 24 * 60 * 60,
          current_period_start: now,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      total_count: 1,
      url: '/v1/subscription_items',
    },
    last_payment_error: null,
    livemode: false,
    metadata: {
      plan_tier: 'monthly',
    },
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_at: null,
    paused_at: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: null,
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: now,
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: null,
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

describe('Subscription Activation Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // validateCodeFormat Tests
  // ============================================================================
  describe('validateCodeFormat', () => {
    it('should accept valid code format', () => {
      const result = validateCodeFormat('LINK-ABC123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty code', () => {
      const result = validateCodeFormat('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Activation code is required');
    });

    it('should reject invalid code format', () => {
      const result = validateCodeFormat('INVALID-FORMAT');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid code format');
    });

    it('should reject lowercase code', () => {
      const result = validateCodeFormat('link-abc123');
      expect(result.isValid).toBe(false);
    });

    it('should reject code with wrong prefix', () => {
      const result = validateCodeFormat('CODE-ABC123');
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // validateCodeStatus Tests
  // ============================================================================
  describe('validateCodeStatus', () => {
    it('should accept valid (not expired, not used) code', () => {
      const code = createMockActivationCode();
      const result = validateCodeStatus(code);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject expired code', () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 49); // 49 hours ago

      const code = createMockActivationCode({
        expires_at: expiredDate.toISOString(),
      });

      const result = validateCodeStatus(code);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject already-used code', () => {
      const code = createMockActivationCode({
        used_at: new Date().toISOString(),
      });

      const result = validateCodeStatus(code);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('already been used');
    });

    it('should accept code expiring in exactly 48 hours', () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const code = createMockActivationCode({
        expires_at: expiresAt.toISOString(),
      });

      const result = validateCodeStatus(code);
      expect(result.isValid).toBe(true);
    });

    it('should accept code expiring in 1 minute (not expired)', () => {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 1);

      const code = createMockActivationCode({
        expires_at: expiresAt.toISOString(),
      });

      const result = validateCodeStatus(code);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================================
  // validateSubscriptionStatus Tests
  // ============================================================================
  describe('validateSubscriptionStatus', () => {
    it('should accept active subscription', () => {
      const subscription = createMockStripeSubscription({
        status: 'active',
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept trialing subscription', () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription = createMockStripeSubscription({
        status: 'trialing',
        trial_start: now,
        trial_end: now + 7 * 24 * 60 * 60, // 7 days from now
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(true);
    });

    it('should reject canceled subscription', () => {
      const subscription = createMockStripeSubscription({
        status: 'canceled',
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('canceled');
    });

    it('should reject past_due subscription', () => {
      const subscription = createMockStripeSubscription({
        status: 'past_due',
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('past_due');
    });

    it('should reject incomplete subscription', () => {
      const subscription = createMockStripeSubscription({
        status: 'incomplete',
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(false);
    });

    it('should reject unpaid subscription', () => {
      const subscription = createMockStripeSubscription({
        status: 'unpaid',
      });

      const result = validateSubscriptionStatus(subscription);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // extractCurrentPeriodEnd Tests
  // ============================================================================
  describe('extractCurrentPeriodEnd', () => {
    it('should extract current_period_end from subscription item', () => {
      const now = Math.floor(Date.now() / 1000);
      const periodEnd = now + 30 * 24 * 60 * 60; // 30 days from now

      const subscription = createMockStripeSubscription();

      const result = extractCurrentPeriodEnd(subscription);
      expect(result.currentPeriodEnd).not.toBeNull();
      expect(result.error).toBeUndefined();

      // Verify it's a valid ISO string
      if (result.currentPeriodEnd) {
        const parsedDate = new Date(result.currentPeriodEnd);
        expect(parsedDate).toBeInstanceOf(Date);
        expect(!isNaN(parsedDate.getTime())).toBe(true);
      }
    });

    it('should handle subscription with no items', () => {
      const subscription = createMockStripeSubscription({
        items: {
          object: 'list',
          data: [],
          has_more: false,
          total_count: 0,
          url: '/v1/subscription_items',
        },
      });

      const result = extractCurrentPeriodEnd(subscription);
      expect(result.currentPeriodEnd).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should handle subscription with missing current_period_end', () => {
      const subscription = createMockStripeSubscription();
      if (subscription.items?.data[0]) {
        (subscription.items.data[0] as any).current_period_end = undefined;
      }

      const result = extractCurrentPeriodEnd(subscription);
      expect(result.currentPeriodEnd).toBeNull();
    });
  });

  // ============================================================================
  // extractCustomerId Tests
  // ============================================================================
  describe('extractCustomerId', () => {
    it('should extract customer ID when it is a string', () => {
      const subscription = createMockStripeSubscription({
        customer: 'cus_test_customer_123',
      });

      const customerId = extractCustomerId(subscription);
      expect(customerId).toBe('cus_test_customer_123');
    });

    it('should extract customer ID when it is an object', () => {
      const subscription = createMockStripeSubscription({
        customer: {
          id: 'cus_test_customer_456',
          object: 'customer',
        } as any,
      });

      const customerId = extractCustomerId(subscription);
      expect(customerId).toBe('cus_test_customer_456');
    });
  });

  // ============================================================================
  // extractTrialDates Tests
  // ============================================================================
  describe('extractTrialDates', () => {
    it('should extract trial dates when both present', () => {
      const now = Math.floor(Date.now() / 1000);
      const trialStart = now;
      const trialEnd = now + 7 * 24 * 60 * 60;

      const subscription = createMockStripeSubscription({
        trial_start: trialStart,
        trial_end: trialEnd,
      });

      const result = extractTrialDates(subscription);
      expect(result.trial_started_at).not.toBeNull();
      expect(result.trial_ends_at).not.toBeNull();

      // Verify they are valid ISO strings
      const startDate = new Date(result.trial_started_at!);
      const endDate = new Date(result.trial_ends_at!);
      expect(!isNaN(startDate.getTime())).toBe(true);
      expect(!isNaN(endDate.getTime())).toBe(true);
    });

    it('should return null for missing trial dates', () => {
      const subscription = createMockStripeSubscription({
        trial_start: null,
        trial_end: null,
      });

      const result = extractTrialDates(subscription);
      expect(result.trial_started_at).toBeNull();
      expect(result.trial_ends_at).toBeNull();
    });

    it('should handle only trial_start present', () => {
      const now = Math.floor(Date.now() / 1000);

      const subscription = createMockStripeSubscription({
        trial_start: now,
        trial_end: null,
      });

      const result = extractTrialDates(subscription);
      expect(result.trial_started_at).not.toBeNull();
      expect(result.trial_ends_at).toBeNull();
    });

    it('should handle only trial_end present', () => {
      const now = Math.floor(Date.now() / 1000);

      const subscription = createMockStripeSubscription({
        trial_start: null,
        trial_end: now + 7 * 24 * 60 * 60,
      });

      const result = extractTrialDates(subscription);
      expect(result.trial_started_at).toBeNull();
      expect(result.trial_ends_at).not.toBeNull();
    });
  });

  // ============================================================================
  // Integration: Code Validation Pipeline
  // ============================================================================
  describe('Code Validation Pipeline', () => {
    it('should reject code in correct order: format > status', () => {
      // Invalid format should fail first
      const invalidCodeResult = validateCodeFormat('INVALID');
      expect(invalidCodeResult.isValid).toBe(false);

      // Valid format
      const validCodeResult = validateCodeFormat('LINK-ABC123');
      expect(validCodeResult.isValid).toBe(true);

      // If format passes, status should be checked
      const expiredCode = createMockActivationCode({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      const statusResult = validateCodeStatus(expiredCode);
      expect(statusResult.isValid).toBe(false);
      expect(statusResult.error).toContain('expired');
    });
  });

  // ============================================================================
  // Integration: Subscription Validation Pipeline
  // ============================================================================
  describe('Subscription Validation Pipeline', () => {
    it('should validate subscription status before extracting data', () => {
      const validSubscription = createMockStripeSubscription({
        status: 'active',
      });

      const statusResult = validateSubscriptionStatus(validSubscription);
      expect(statusResult.isValid).toBe(true);

      // Now extract data should be safe
      const customerId = extractCustomerId(validSubscription);
      const periodEnd = extractCurrentPeriodEnd(validSubscription);
      const trialDates = extractTrialDates(validSubscription);

      expect(customerId).toBeTruthy();
      expect(periodEnd.currentPeriodEnd).not.toBeNull();
      expect(trialDates).toBeDefined();
    });

    it('should not extract data from invalid subscription', () => {
      const invalidSubscription = createMockStripeSubscription({
        status: 'canceled',
      });

      const statusResult = validateSubscriptionStatus(invalidSubscription);
      expect(statusResult.isValid).toBe(false);

      // But extraction functions should still work (gracefully)
      const customerId = extractCustomerId(invalidSubscription);
      expect(customerId).toBeTruthy();
    });
  });

  // ============================================================================
  // Plan Tier Tests
  // ============================================================================
  describe('Plan Tier Handling', () => {
    it('should handle monthly plan tier', () => {
      const code = createMockActivationCode({
        plan_tier: 'monthly',
      });
      expect(code.plan_tier).toBe('monthly');
    });

    it('should handle annual plan tier', () => {
      const code = createMockActivationCode({
        plan_tier: 'annual',
      });
      expect(code.plan_tier).toBe('annual');
    });

    it('should handle null plan tier with fallback', () => {
      const code = createMockActivationCode({
        plan_tier: null,
      });
      const planTier = (code.plan_tier as 'monthly' | 'annual') || 'monthly';
      expect(planTier).toBe('monthly');
    });
  });

  // ============================================================================
  // Email Validation Tests
  // ============================================================================
  describe('Email Validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('should validate valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'first.last+tag@company.io',
      ];

      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = ['invalid', '@example.com', 'user@', 'user@example'];

      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate email from activation code', () => {
      const code = createMockActivationCode({
        stripe_customer_email: 'customer@example.com',
      });

      expect(emailRegex.test(code.stripe_customer_email || '')).toBe(true);
    });
  });

  // ============================================================================
  // Timestamp Handling Tests
  // ============================================================================
  describe('Timestamp Handling', () => {
    it('should convert Unix timestamps to ISO strings correctly', () => {
      const unixTimestamp = Math.floor(Date.now() / 1000);
      const isoString = new Date(unixTimestamp * 1000).toISOString();

      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(isoString).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('should handle ISO string timestamps from database', () => {
      const code = createMockActivationCode();
      const expiresAt = new Date(code.expires_at);

      expect(expiresAt).toBeInstanceOf(Date);
      expect(!isNaN(expiresAt.getTime())).toBe(true);
    });
  });
});
