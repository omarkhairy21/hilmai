/**
 * Telegram Webhook API Handler
 * 
 * Handles incoming Telegram webhook updates for the bot
 */

import type { Context } from 'hono';
import type { Mastra } from '@mastra/core/mastra';
import { getWebhookHandler } from '../services/bot-server';

export async function handleTelegramWebhook(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();
  
  logger.debug('[api:telegram:webhook]', {
    event: 'telegram_webhook_received',
    contentType: c.req.header('content-type'),
  });
  
  try {
    // Handler will be bound to mastra instance after initialization
    return await getWebhookHandler(mastra)(c);
  } catch (error) {
    logger.error('[api:telegram:webhook]', {
      event: 'telegram_webhook_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
}

