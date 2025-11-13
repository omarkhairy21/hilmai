/**
 * Billing API Handlers
 *
 * Handles Stripe checkout and billing portal session creation
 */

import type { Context } from 'hono';
import type { Mastra } from '@mastra/core/mastra';
import {
  createCheckoutSession,
  createBillingPortalSession,
} from '../services/subscription.service';

/**
 * Handle checkout session creation
 */
export async function handleCheckout(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();

  try {
    const body = await c.req.json();
    const { userId, planTier, successUrl, cancelUrl, includeTrial } = body;

    logger.info('[api:billing:checkout]', {
      event: 'checkout_request',
      userId,
      planTier,
      includeTrial: includeTrial ?? false,
    });

    if (!userId || !planTier || !successUrl || !cancelUrl) {
      logger.warn('[api:billing:checkout]', {
        event: 'checkout_invalid_request',
        userId,
        planTier,
        missingFields: {
          userId: !userId,
          planTier: !planTier,
          successUrl: !successUrl,
          cancelUrl: !cancelUrl,
        },
      });
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const result = await createCheckoutSession(
      userId,
      planTier,
      successUrl,
      cancelUrl,
      includeTrial ?? false
    );

    if (result.error) {
      logger.error('[api:billing:checkout]', {
        event: 'checkout_failed',
        userId,
        planTier,
        error: result.error,
      });
      return c.json({ error: result.error }, 400);
    }

    logger.info('[api:billing:checkout]', {
      event: 'checkout_success',
      userId,
      planTier,
      hasUrl: !!result.url,
    });

    return c.json({ url: result.url });
  } catch (error) {
    logger.error('[api:billing:checkout]', {
      event: 'checkout_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle billing portal session creation
 */
export async function handleBillingPortal(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();

  try {
    const body = await c.req.json();
    const { userId, returnUrl } = body;

    logger.info('[api:billing:portal]', {
      event: 'portal_request',
      userId,
    });

    if (!userId || !returnUrl) {
      logger.warn('[api:billing:portal]', {
        event: 'portal_invalid_request',
        userId,
        missingFields: {
          userId: !userId,
          returnUrl: !returnUrl,
        },
      });
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const result = await createBillingPortalSession(userId, returnUrl);

    if (result.error) {
      logger.error('[api:billing:portal]', {
        event: 'portal_failed',
        userId,
        error: result.error,
      });
      return c.json({ error: result.error }, 400);
    }

    logger.info('[api:billing:portal]', {
      event: 'portal_success',
      userId,
      hasUrl: !!result.url,
    });

    return c.json({ url: result.url });
  } catch (error) {
    logger.error('[api:billing:portal]', {
      event: 'portal_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
}
