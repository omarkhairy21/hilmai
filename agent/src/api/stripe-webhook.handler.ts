/**
 * Stripe Webhook API Handler
 * 
 * Handles incoming Stripe webhook events for subscription management
 */

import type { Context } from 'hono';
import type { Mastra } from '@mastra/core/mastra';
import { handleStripeWebhook as processStripeWebhook } from '../services/subscription.service';

export async function handleStripeWebhook(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();
  
  try {
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    logger.info('[api:stripe:webhook]', {
      event: 'webhook_received',
      hasBody: !!body,
      hasSignature: !!signature,
    });

    if (!signature) {
      logger.warn('[api:stripe:webhook]', {
        event: 'webhook_missing_signature',
      });
      return c.json({ error: 'Missing stripe-signature header' }, 400);
    }

    const result = await processStripeWebhook(body, signature);

    if (!result.success) {
      logger.error('[api:stripe:webhook]', {
        event: 'webhook_processing_failed',
        error: result.error,
      });
      return c.json({ error: result.error }, 400);
    }

    logger.info('[api:stripe:webhook]', {
      event: 'webhook_processed',
    });

    return c.json({ received: true });
  } catch (error) {
    logger.error('[api:stripe:webhook]', {
      event: 'webhook_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
}

