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
  generateActivationCodeForSession,
} from '../services/subscription.service';

/**
 * Handle checkout session creation
 */
export async function handleCheckout(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();

  try {
    const body = await c.req.json();
    const { userId, planTier, successUrl, cancelUrl, includeTrial, customerEmail } = body;

    logger.info('[api:billing:checkout]', {
      event: 'checkout_request',
      userId,
      planTier,
      includeTrial: includeTrial ?? false,
    });

    // userId is optional for web checkout (user not logged in yet)
    if (!planTier || !successUrl || !cancelUrl) {
      logger.warn('[api:billing:checkout]', {
        event: 'checkout_invalid_request',
        userId,
        planTier,
        missingFields: {
          planTier: !planTier,
          successUrl: !successUrl,
          cancelUrl: !cancelUrl,
        },
      });
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Add session ID placeholder to success URL so Stripe will include it
    const successUrlWithPlaceholder = `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

    const result = await createCheckoutSession(
      userId,
      planTier,
      successUrlWithPlaceholder,
      cancelUrl,
      includeTrial ?? false,
      customerEmail
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

/**
 * Handle activation code generation for Stripe checkout sessions
 * Called by web after user completes Stripe payment
 */
export async function handleActivationCode(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();

  try {
    const body = await c.req.json();
    const { sessionId } = body;

    logger.info('[api:billing:activation-code]', {
      event: 'activation_code_request',
      sessionId,
    });

    if (!sessionId) {
      logger.warn('[api:billing:activation-code]', {
        event: 'activation_code_invalid_request',
        missingFields: { sessionId: !sessionId },
      });
      return c.json({ error: 'Missing sessionId' }, 400);
    }

    const result = await generateActivationCodeForSession(sessionId);

    if (result.error) {
      logger.error('[api:billing:activation-code]', {
        event: 'activation_code_failed',
        sessionId,
        error: result.error,
      });
      return c.json({ error: result.error }, 400);
    }

    logger.info('[api:billing:activation-code]', {
      event: 'activation_code_success',
      sessionId,
      hasCode: !!result.linkCode,
    });

    return c.json({
      linkCode: result.linkCode,
      deepLink: result.deepLink,
    });
  } catch (error) {
    logger.error('[api:billing:activation-code]', {
      event: 'activation_code_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
}
