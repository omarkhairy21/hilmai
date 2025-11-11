import { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { initializeTelegramApi } from './services/subscription.service';
import { registerAllHandlers } from './handlers';
import { registerBotHealth } from './services/health.service';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
}

/**
 * Create and configure the Telegram bot
 * All handlers are registered via the modular handler system
 */
export function createBot(mastra: Mastra): Bot {
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

  return bot;
}
