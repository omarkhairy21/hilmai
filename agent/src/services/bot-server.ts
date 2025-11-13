/**
 * Bot Server Configuration
 *
 * Provides environment-based bot initialization:
 * - Production: Webhook-based updates (scalable, stateless)
 * - Development: Long polling (convenient for local testing)
 *
 * SECURITY NOTE: Webhook requests from Telegram must be validated
 * using the secret token to prevent spoofing
 */

import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';
import { config } from '../lib/config';
import { createBot, createBotWebhookCallback, type BotOptions } from '../bot';

/**
 * Determine which bot mode to use based on environment
 *
 * @param mastra - Mastra instance
 * @returns Bot mode: 'webhook' for production, 'polling' for development
 */
export function getBotMode(mastra: Mastra): 'webhook' | 'polling' {
  const logger = mastra.getLogger();

  // Explicit webhook flag takes precedence
  if (config.telegram.useWebhook) {
    if (!config.telegram.webhookUrl) {
      logger.warn('bot-server:webhook_enabled_but_no_url', {
        message:
          'TELEGRAM_USE_WEBHOOK=true but TELEGRAM_WEBHOOK_URL not set. Falling back to polling.',
      });
      return 'polling';
    }
    return 'webhook';
  }

  // Polling flag for development
  if (config.telegram.polling) {
    return 'polling';
  }

  // Default: polling in dev, webhook in prod (if URL provided)
  if (config.app.nodeEnv === 'production' && config.telegram.webhookUrl) {
    return 'webhook';
  }

  // Production without webhook URL: require explicit configuration
  if (config.app.nodeEnv === 'production') {
    logger.warn('bot-server:production_without_webhook', {
      message:
        'Running in production without webhook. Set TELEGRAM_USE_WEBHOOK=true and TELEGRAM_WEBHOOK_URL.',
    });
  }

  return 'polling';
}

/**
 * Create bot with environment-appropriate configuration
 *
 * @param mastra - Mastra instance
 * @returns Configured Bot instance
 *
 * @example
 * const bot = createConfiguredBot(mastra);
 *
 * if (getBotMode(mastra) === 'polling') {
 *   await bot.start(); // Start polling
 * }
 * // For webhook mode, integrate with your web server
 */
export function createConfiguredBot(mastra: Mastra) {
  const logger = mastra.getLogger();
  const mode = getBotMode(mastra);

  logger.info('bot-server:creating_bot', {
    mode,
    webhookUrl: config.telegram.webhookUrl ? '[REDACTED]' : undefined,
  });

  // Create bot with webhook options if in webhook mode
  const options: BotOptions | undefined =
    mode === 'webhook' && config.telegram.webhookUrl
      ? {
          webhook: {
            url: config.telegram.webhookUrl,
            secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
          },
        }
      : undefined;

  return createBot(mastra, options);
}

/**
 * Get webhook callback handler for integration with Mastra server
 *
 * This handler can be mounted on Mastra's API route configuration.
 * It validates the Telegram webhook secret token and delegates to
 * the bot webhook handler.
 *
 * @param mastra - Mastra instance
 * @returns Async function for handling webhook requests with Hono context
 *
 * @example
 * // In mastra/index.ts
 * import { getWebhookHandler } from '../services/bot-server';
 *
 * const apiRoutes = [
 *   registerApiRoute('/telegram/webhook', {
 *     method: 'POST',
 *     handler: getWebhookHandler(mastra),
 *   }),
 * ];
 */
export function getWebhookHandler(mastra: Mastra): (c: Context) => Promise<Response> {
  const botHandler = createBotWebhookCallback(mastra);
  const logger = mastra.getLogger();

  // Return Hono-compatible middleware
  return async (c: Context) => {
    try {
      // Verify secret token if configured
      if (process.env.TELEGRAM_WEBHOOK_SECRET) {
        const headerSecret = c.req.header('x-telegram-bot-api-secret-token');
        if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
          logger.warn('bot-server:webhook_invalid_secret', {
            ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
          });
          return c.json({ error: 'Unauthorized' }, 401);
        }
      }

      // Delegate to bot webhook handler
      return await botHandler(c);
    } catch (error) {
      logger.error('bot-server:webhook_error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
  };
}

/**
 * Validate webhook configuration
 *
 * Call this during startup to ensure webhook setup is correct
 *
 * @param mastra - Mastra instance
 * @throws Error if configuration is invalid
 */
export function validateWebhookConfig(mastra: Mastra): void {
  const logger = mastra.getLogger();
  const mode = getBotMode(mastra);

  if (mode === 'webhook') {
    if (!config.telegram.webhookUrl) {
      throw new Error(
        'Webhook mode enabled but TELEGRAM_WEBHOOK_URL not set. ' +
          'Set TELEGRAM_WEBHOOK_URL to your bot endpoint (e.g., https://yourdomain.com/telegram/webhook)'
      );
    }

    // Validate URL format
    try {
      const url = new URL(config.telegram.webhookUrl);
      if (!url.protocol.startsWith('https')) {
        logger.warn('bot-server:webhook_not_https', {
          url: config.telegram.webhookUrl,
          message: 'Telegram requires HTTPS for webhooks',
        });
      }
    } catch {
      throw new Error(`Invalid TELEGRAM_WEBHOOK_URL: ${config.telegram.webhookUrl}`);
    }

    logger.info('bot-server:webhook_config_valid', {
      url: config.telegram.webhookUrl.replace(/https:\/\/.*/, 'https://[REDACTED]'),
    });
  }
}
