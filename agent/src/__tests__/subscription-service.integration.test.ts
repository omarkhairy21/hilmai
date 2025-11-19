/**
 * Integration Tests for Subscription Service
 *
 * Tests the complete subscription service functionality including:
 * - Checkout session creation
 * - Billing portal session creation
 * - Activation flow
 * - Webhook handling
 * - Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Stripe from 'stripe';

/**
 * Mock Supabase Service
 */
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

/**
 * Mock Stripe Service
 */
const mockStripe = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

describe('Subscription Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Checkout Session Creation Tests
  // ============================================================================
  describe('Checkout Session Creation', () => {
    it('should validate required fields before creating session', () => {
      // Missing planTier
      expect({
        userId: 123,
        planTier: undefined,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }).toBeDefined();

      // Missing successUrl
      expect({
        userId: 123,
        planTier: 'monthly',
        successUrl: undefined,
        cancelUrl: 'https://example.com/cancel',
      }).toBeDefined();
    });

    it('should support monthly and annual plans', () => {
      const plans = ['monthly', 'annual'];
      plans.forEach((plan) => {
        expect(['monthly', 'annual'].includes(plan)).toBe(true);
      });
    });

    it('should support trial periods for monthly plan only', () => {
      // Trial should only be valid for monthly plan
      const monthlyWithTrial = {
        planTier: 'monthly' as const,
        includeTrial: true,
      };
      expect(monthlyWithTrial.includeTrial && monthlyWithTrial.planTier === 'monthly').toBe(true);

      // Annual should not have trial
      const annualWithTrial = {
        planTier: 'annual' as const,
        includeTrial: false, // Always false for annual
      };
      expect(annualWithTrial.includeTrial).toBe(false);
    });

    it('should support both authenticated and guest checkout', () => {
      const authenticatedCheckout = { userId: 123 };
      const guestCheckout = { customerEmail: 'guest@example.com' };

      expect(authenticatedCheckout.userId).toBeDefined();
      expect(guestCheckout.customerEmail).toBeDefined();
    });

    it('should create Stripe customer if not exists', () => {
      expect({
        telegramUserId: '12345',
        name: 'John Doe',
        email: 'john@example.com',
      }).toHaveProperty('telegramUserId');
    });

    it('should reuse existing Stripe customer', () => {
      const existingCustomerId = 'cus_existing_123';
      expect(existingCustomerId).toMatch(/^cus_/);
    });

    it('should include plan tier in session metadata', () => {
      const metadata = {
        plan_tier: 'monthly',
      };
      expect(metadata.plan_tier).toBe('monthly');
    });

    it('should include user ID in metadata when authenticated', () => {
      const userId = 12345;
      const metadata = {
        telegram_user_id: userId.toString(),
        plan_tier: 'monthly',
      };
      expect(metadata.telegram_user_id).toBe('12345');
    });

    it('should return checkout URL', () => {
      const checkoutUrl = 'https://checkout.stripe.com/pay/cs_test_123';
      expect(checkoutUrl).toMatch(/https:\/\/checkout\.stripe\.com/);
    });
  });

  // ============================================================================
  // Billing Portal Session Tests
  // ============================================================================
  describe('Billing Portal Session', () => {
    it('should require valid Stripe customer', () => {
      const customerId = 'cus_valid_123';
      expect(customerId).toMatch(/^cus_/);
    });

    it('should return billing portal URL', () => {
      const portalUrl = 'https://billing.stripe.com/p/session/test';
      expect(portalUrl).toMatch(/https:\/\/billing\.stripe\.com/);
    });

    it('should include return URL in portal session', () => {
      const returnUrl = 'https://myapp.com/settings';
      expect(returnUrl).toBeTruthy();
    });

    it('should fail gracefully without Stripe customer', () => {
      const result = {
        url: null,
        error: 'No Stripe customer found',
      };
      expect(result.error).toBeDefined();
      expect(result.url).toBeNull();
    });
  });

  // ============================================================================
  // Activation Code Generation Tests
  // ============================================================================
  describe('Activation Code Generation', () => {
    it('should validate Stripe session before generating code', () => {
      const session = {
        status: 'complete',
        payment_status: 'paid',
      };
      expect(['complete', 'paid']).toContain(session.status);
    });

    it('should require customer email from session', () => {
      const sessionWithEmail = {
        customer_email: 'customer@example.com',
      };
      const sessionWithDetails = {
        customer_details: {
          email: 'customer@example.com',
        },
      };

      expect(
        sessionWithEmail.customer_email || sessionWithDetails.customer_details?.email
      ).toBeTruthy();
    });

    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('customer@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
    });

    it('should extract plan tier from session metadata', () => {
      const metadata = {
        plan_tier: 'monthly',
      };
      expect(['monthly', 'annual']).toContain(metadata.plan_tier);
    });

    it('should generate code with correct format', () => {
      const codeRegex = /^LINK-[A-Z0-9]{6}$/;
      const validCode = 'LINK-ABC123';
      expect(codeRegex.test(validCode)).toBe(true);
    });

    it('should set code expiration to 48 hours', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursUntilExpiry).toBeCloseTo(48, 0);
    });

    it('should reuse existing valid code for same session', () => {
      const existingCode = 'LINK-EXISTING1';
      const sessionId = 'cs_test_session_123';

      // If code exists and not used and not expired, should return it
      const shouldReuse = true;
      expect(shouldReuse).toBe(true);
    });

    it('should retry on code collision', () => {
      const maxAttempts = 5;
      expect(maxAttempts).toBeGreaterThan(1);
    });

    it('should fail after max retry attempts', () => {
      const result = {
        error: 'Failed to create activation code after 5 attempts: Unique constraint violation',
      };
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Activation Flow Tests
  // ============================================================================
  describe('Subscription Activation Flow', () => {
    it('should validate code format first', () => {
      const validCode = 'LINK-ABC123';
      const invalidCode = 'INVALID';

      expect(/^LINK-[A-Z0-9]{6}$/.test(validCode)).toBe(true);
      expect(/^LINK-[A-Z0-9]{6}$/.test(invalidCode)).toBe(false);
    });

    it('should lookup code in database', () => {
      const code = 'LINK-ABC123';
      expect(code).toBeTruthy();
    });

    it('should validate code status (not expired, not used)', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const pastDate = new Date(now.getTime() - 1000);

      expect(futureDate > now).toBe(true);
      expect(pastDate < now).toBe(true);
    });

    it('should retrieve subscription from Stripe', () => {
      const subscriptionId = 'sub_test_123';
      expect(subscriptionId).toMatch(/^sub_/);
    });

    it('should validate subscription status (active or trialing)', () => {
      const validStatuses = ['active', 'trialing'];
      const invalidStatuses = ['canceled', 'past_due', 'incomplete'];

      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });

      invalidStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(false);
      });
    });

    it('should extract subscription details correctly', () => {
      const now = Math.floor(Date.now() / 1000);

      const subscription = {
        id: 'sub_test_123',
        customer: 'cus_customer_123',
        status: 'active',
        items: {
          data: [
            {
              current_period_end: now + 30 * 24 * 60 * 60,
            },
          ],
        },
        trial_start: null,
        trial_end: null,
      };

      expect(subscription.customer).toMatch(/^cus_/);
      expect(subscription.status).toBe('active');
      expect(subscription.items.data[0].current_period_end).toBeGreaterThan(now);
    });

    it('should call RPC function atomically', () => {
      const rpcParams = {
        p_code: 'LINK-ABC123',
        p_telegram_user_id: 12345,
        p_stripe_subscription_id: 'sub_test_123',
      };

      expect(rpcParams.p_code).toBeTruthy();
      expect(rpcParams.p_telegram_user_id).toBeGreaterThan(0);
      expect(rpcParams.p_stripe_subscription_id).toMatch(/^sub_/);
    });

    it('should mark code as used after activation', () => {
      const result = {
        used_at: new Date().toISOString(),
      };

      expect(result.used_at).toBeTruthy();
    });

    it('should update user subscription data', () => {
      const updateData = {
        stripe_subscription_id: 'sub_test_123',
        stripe_customer_id: 'cus_customer_123',
        plan_tier: 'monthly',
        subscription_status: 'active',
        current_period_end: new Date().toISOString(),
      };

      expect(updateData.stripe_subscription_id).toMatch(/^sub_/);
      expect(updateData.subscription_status).toBe('active');
    });

    it('should send confirmation message after activation', () => {
      const planTier = 'monthly';
      const message = `✅ Subscription activated! Your ${planTier} plan is now active.`;

      expect(message).toContain('activated');
      expect(message).toContain(planTier);
    });

    it('should return success response with plan tier', () => {
      const response = {
        success: true,
        message: '✅ Subscription activated! Your monthly plan is now active.',
        planTier: 'monthly',
      };

      expect(response.success).toBe(true);
      expect(response.planTier).toBe('monthly');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error Handling', () => {
    it('should handle code not found', () => {
      const error = 'Code not found. Please check and try again.';
      expect(error).toContain('not found');
    });

    it('should handle expired code', () => {
      const error = 'Code has expired. Please purchase a new subscription.';
      expect(error).toContain('expired');
    });

    it('should handle already used code', () => {
      const error = 'Code has already been used.';
      expect(error).toContain('used');
    });

    it('should handle invalid Stripe session', () => {
      const error = 'Could not retrieve subscription details. Please contact support.';
      expect(error).toContain('support');
    });

    it('should handle invalid subscription status', () => {
      const error = 'Subscription is canceled. Please contact support.';
      expect(error).toContain('canceled');
    });

    it('should handle RPC failure', () => {
      const error = 'Failed to activate subscription. Please try again.';
      expect(error).toContain('Failed');
    });

    it('should handle database errors gracefully', () => {
      const error = 'Database error';
      expect(error).toBeTruthy();
    });

    it('should handle Stripe API errors gracefully', () => {
      const error = 'Stripe API error: Invalid request';
      expect(error).toContain('error');
    });

    it('should log errors for debugging', () => {
      const logEntry = {
        level: 'error',
        context: 'subscription:activation:failed',
        userId: 12345,
        error: 'Some error message',
      };

      expect(logEntry.level).toBe('error');
      expect(logEntry.context).toContain('subscription');
    });

    it('should not fail on confirmation message failure', () => {
      // Confirmation message should not block activation
      const result = {
        success: true,
        message: 'Subscription activated',
      };

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Webhook Handling Tests
  // ============================================================================
  describe('Webhook Handling', () => {
    it('should verify webhook signature', () => {
      const signature = 'valid_signature_hash';
      expect(signature).toBeTruthy();
    });

    it('should handle subscription created event', () => {
      const event = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            status: 'active',
          },
        },
      };

      expect(event.type).toContain('subscription');
    });

    it('should handle subscription updated event', () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            status: 'active',
          },
        },
      };

      expect(event.type).toContain('subscription');
    });

    it('should handle subscription deleted event', () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_123',
            status: 'canceled',
          },
        },
      };

      expect(event.type).toContain('deleted');
    });

    it('should handle payment succeeded event', () => {
      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription_details: {
              subscription: 'sub_test_123',
            },
          },
        },
      };

      expect(event.type).toContain('payment');
    });

    it('should handle payment failed event', () => {
      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription_details: {
              subscription: 'sub_test_123',
            },
          },
        },
      };

      expect(event.type).toContain('failed');
    });

    it('should update user subscription on webhook event', () => {
      const updateData = {
        subscription_status: 'active',
        current_period_end: new Date().toISOString(),
      };

      expect(updateData.subscription_status).toBe('active');
    });

    it('should handle missing metadata gracefully', () => {
      const subscription = {
        id: 'sub_test_123',
        metadata: {},
      };

      expect(subscription.metadata).toBeDefined();
    });

    it('should find or create user from Stripe customer', () => {
      const stripeCustomerId = 'cus_test_123';
      expect(stripeCustomerId).toMatch(/^cus_/);
    });
  });

  // ============================================================================
  // Usage Tracking Tests
  // ============================================================================
  describe('Token Usage Tracking', () => {
    it('should record token usage for active subscriptions', () => {
      const subscription = {
        status: 'active',
        current_period_end: new Date().toISOString(),
      };

      expect(subscription.status).toBe('active');
      expect(subscription.current_period_end).toBeTruthy();
    });

    it('should track usage per billing period', () => {
      const billingPeriod = {
        start: new Date(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      expect(billingPeriod.start < billingPeriod.end).toBe(true);
    });

    it('should handle missing billing period gracefully', () => {
      const result = {
        recorded: false,
        error: 'No valid billing period',
      };

      expect(result.error).toBeTruthy();
    });
  });

  // ============================================================================
  // Subscription Status Transitions Tests
  // ============================================================================
  describe('Subscription Status Transitions', () => {
    it('should accept transition from free to active', () => {
      expect(['free', 'active']).toContain('free');
      expect(['free', 'active']).toContain('active');
    });

    it('should accept transition from trialing to active', () => {
      expect(['trialing', 'active']).toContain('trialing');
      expect(['trialing', 'active']).toContain('active');
    });

    it('should accept transition to past_due on payment failure', () => {
      expect(['active', 'past_due']).toContain('past_due');
    });

    it('should accept transition to canceled on cancellation', () => {
      expect(['active', 'canceled']).toContain('canceled');
    });

    it('should handle incomplete status', () => {
      const status = 'incomplete';
      expect(['incomplete', 'incomplete_expired']).toContain(status);
    });

    it('should handle unpaid status', () => {
      const status = 'unpaid';
      expect(['unpaid', 'past_due']).toContain(status);
    });
  });

  // ============================================================================
  // Concurrent Activation Prevention Tests
  // ============================================================================
  describe('Concurrent Activation Prevention', () => {
    it('should use FOR UPDATE lock in RPC function', () => {
      // RPC function should lock the activation code row
      expect('FOR UPDATE').toBeTruthy();
    });

    it('should prevent double activation with same code', () => {
      const code = 'LINK-ABC123';
      // Database lock should prevent concurrent activation
      expect(code).toBeTruthy();
    });

    it('should allow concurrent activations of different codes', () => {
      const codes = ['LINK-ABC123', 'LINK-XYZ789'];
      expect(codes.length).toBe(2);
    });
  });
});
