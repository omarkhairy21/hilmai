import { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import type { Context as HonoContext } from 'hono';
import { initializeTelegramApi } from './services/subscription.service';
import { registerAllHandlers } from './handlers';
import { registerBotHealth } from './services/health.service';
import { config } from './lib/config';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
}

/**
 * Create and configure the Telegram bot
 * All handlers are registered via the modular handler system
 *
 * @param mastra - Mastra instance for logging and tools
 * @param options - Optional configuration for webhook setup
 */
export interface BotOptions {
  webhook?: {
    url: string;
    secretToken?: string;
  };
}

export function createBot(mastra: Mastra, options?: BotOptions): Bot {
  const bot = new Bot(token!);
  const logger = mastra.getLogger();

  // Initialize Telegram API for subscription messages
  initializeTelegramApi(bot.api);

  // Set up bot commands menu (appears in toolbar)
  bot.api
    .setMyCommands([
      {
        command: 'menu',
        description: '📋 Show main menu',
      },
      {
        command: 'start',
        description: '🚀 Start the bot',
      },
      {
        command: 'subscribe',
        description: '💳 View subscription plans',
      },
      {
        command: 'billing',
        description: '💰 Manage your subscription',
      },
      {
        command: 'mode',
        description: '🎯 Switch mode (logger/chat/query)',
      },
      {
        command: 'recent',
        description: '📋 View recent transactions',
      },
      {
        command: 'currency',
        description: '💱 Set default currency',
      },
      {
        command: 'timezone',
        description: '🌍 Set your timezone',
      },
      {
        command: 'help',
        description: '❓ Get help and instructions',
      },
      {
        command: 'clear',
        description: '🗑️ Clear cached responses',
      },
    ])
    .catch((error) => {
      logger.warn('Failed to set bot commands', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // Register all handlers (commands, callbacks, messages)
  registerAllHandlers(bot, mastra);

  // Register lifecycle telemetry hooks
  registerBotHealth(bot, logger);

  // Error handler for bot-level errors
  bot.catch((err) => {
    logger.error('bot:error', {
      error: err.error instanceof Error ? err.error.message : String(err.error),
      ctx: err.ctx,
    });
  });

  // Register webhook if provided in options
  if (options?.webhook?.url) {
    bot.api
      .setWebhook(options.webhook.url, {
        secret_token: options.webhook.secretToken,
      })
      .then(() => {
        logger.info('bot:webhook_registered', {
          url: options.webhook?.url,
        });
      })
      .catch((error) => {
        logger.error('bot:webhook_registration_failed', {
          url: options.webhook?.url,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  return bot;
}

/**
 * Create webhook callback for use with Hono (Mastra's web framework)
 * Use this for production webhook-based bot deployment
 *
 * @param mastra - Mastra instance for logging and tools
 * @returns Async function that handles Hono context
 *
 * @example
 * import { registerApiRoute } from '@mastra/core/server';
 * const apiRoutes = [
 *   registerApiRoute('/telegram/webhook', {
 *     method: 'POST',
 *     handler: createBotWebhookCallback(mastra),
 *   }),
 * ];
 */
// Cache for bot instance used in webhook mode
let webhookBotInstance: Bot | null = null;

export function createBotWebhookCallback(mastra: Mastra): (c: HonoContext, body?: unknown) => Promise<Response> {
  const logger = mastra.getLogger();

  return async (c: HonoContext, body?: unknown) => {
    try {
      // Initialize bot instance once (lazy initialization)
      if (!webhookBotInstance) {
        webhookBotInstance = createBot(mastra);
        // Initialize bot to fetch bot info from Telegram
        await webhookBotInstance.init();
        logger.info('bot:webhook_bot_initialized');
      }

      // Get the request body if not provided
      const updateBody = body ?? await c.req.json();

      // Process the update through grammy
      await webhookBotInstance.handleUpdate(updateBody);

      return c.json({ ok: true });
    } catch (error) {
      logger.error('bot:webhook_handle_update_error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 200 to prevent Telegram from retrying
      return c.json({ ok: true });
    }
  };
}
