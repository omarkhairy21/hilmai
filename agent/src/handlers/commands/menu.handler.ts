import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';

/**
 * Register /menu command handler
 * Shows inline menu with action buttons
 */
export function registerMenuCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:menu', { userId });

    const menuKeyboard = {
      inline_keyboard: [
        [{ text: '📋 Recent Transactions', callback_data: 'menu_recent_transactions' }],
        [{ text: '💰 Add Transaction', callback_data: 'menu_add_transaction' }],
        [{ text: '📊 View Reports', callback_data: 'menu_reports' }],
        [{ text: '❓ Help', callback_data: 'menu_help' }],
      ],
    };

    const menuMsg = messages.menu.header();

    await ctx.reply(menuMsg.text, {
      entities: menuMsg.entities,
      reply_markup: menuKeyboard,
    });
  });
}
