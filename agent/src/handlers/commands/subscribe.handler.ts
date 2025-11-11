import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';

/**
 * Register /subscribe command handler
 * Show subscription plans
 */
export function registerSubscribeCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('subscribe', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:subscribe', { userId });

    const keyboard = {
      inline_keyboard: [
        [{ text: '🎁 Free Trial', callback_data: 'subscribe_monthly_trial' }],
        [{ text: '📅 Monthly - $20/mo', callback_data: 'subscribe_monthly_notrial' }],
        [{ text: '📆 Annual - $200/yr', callback_data: 'subscribe_annual' }],
      ],
    };

    await ctx.reply(messages.subscription.plans(), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });
}
