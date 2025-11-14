import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';

// Command handlers
import { registerStartCommand } from './commands/start.handler';
import { registerHelpCommand } from './commands/help.handler';
import { registerMenuCommand } from './commands/menu.handler';
import { registerModeCommands } from './commands/mode.handler';
import { registerCurrencyCommand } from './commands/currency.handler';
import { registerTimezoneCommand } from './commands/timezone.handler';
import { registerRecentCommand } from './commands/recent.handler';
import { registerSubscribeCommand } from './commands/subscribe.handler';
import { registerBillingCommand } from './commands/billing.handler';
import { registerEditCommand } from './commands/edit.handler';
import { registerClearCommand } from './commands/clear.handler';

// Callback handlers
import { registerModeCallbacks } from './callbacks/mode.callback';
import { registerMenuCallbacks } from './callbacks/menu.callback';
import { registerTransactionCallbacks } from './callbacks/transaction.callback';
import { registerSubscriptionCallbacks } from './callbacks/subscription.callback';
import { registerProfileSetupCallbacks } from './callbacks/profile-setup.callback';

// Message handler
import { registerMessageHandler } from './messages/message.handler';

/**
 * Register all bot handlers (commands, callbacks, messages)
 * This is the central point for handler registration
 */
export function registerAllHandlers(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  logger.info('handlers:registration_started');

  // Register command handlers
  registerStartCommand(bot, mastra);
  registerHelpCommand(bot, mastra);
  registerMenuCommand(bot, mastra);
  registerModeCommands(bot, mastra); // /mode, /mode_logger, /mode_chat, /mode_query
  registerCurrencyCommand(bot, mastra);
  registerTimezoneCommand(bot, mastra);
  registerRecentCommand(bot, mastra);
  registerSubscribeCommand(bot, mastra);
  registerBillingCommand(bot, mastra);
  registerEditCommand(bot, mastra); // /edit <transaction_id> <changes>
  registerClearCommand(bot, mastra);

  // Register callback query handlers
  registerModeCallbacks(bot, mastra);
  registerMenuCallbacks(bot, mastra);
  registerTransactionCallbacks(bot, mastra);
  registerSubscriptionCallbacks(bot, mastra);
  registerProfileSetupCallbacks(bot, mastra);

  // Register main message handler (must be last to avoid capturing commands)
  registerMessageHandler(bot, mastra);

  logger.info('handlers:registration_completed');
}
