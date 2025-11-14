import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';
import { getUserMode, getModeDescription } from '../../lib/user-mode';

const profileSetupKeyboard = {
  inline_keyboard: [
    [
      { text: '💱 Set Currency', callback_data: 'profile_currency_help' },
      { text: '🌍 Set Timezone', callback_data: 'profile_timezone_help' },
    ],
    [
      { text: '⚡ Instant Log', callback_data: 'set_mode_logger' },
      { text: '🧭 Mode Guide', callback_data: 'profile_modes_help' },
    ],
  ],
};

export function registerProfileSetupCallbacks(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.callbackQuery('open_profile_setup', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:profile_setup_open', { userId });
    await ctx.answerCallbackQuery('Let’s personalize HilmAI');

    const profileMessage = messages.start.profileSetup();
    await ctx.reply(profileMessage.text, {
      parse_mode: 'Markdown',
      entities: profileMessage.entities,
      reply_markup: profileSetupKeyboard,
    });
  });

  bot.callbackQuery('profile_currency_help', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:profile_currency_help', { userId });
    await ctx.answerCallbackQuery('Currency tips sent');

    const currencyMessage = messages.start.profileCurrencyHelp();
    await ctx.reply(currencyMessage.text, {
      parse_mode: 'Markdown',
      entities: currencyMessage.entities,
    });
  });

  bot.callbackQuery('profile_timezone_help', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:profile_timezone_help', { userId });
    await ctx.answerCallbackQuery('Timezone tips sent');

    const timezoneMessage = messages.start.profileTimezoneHelp();
    await ctx.reply(timezoneMessage.text, {
      parse_mode: 'Markdown',
      entities: timezoneMessage.entities,
    });
  });

  bot.callbackQuery('profile_modes_help', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:profile_modes_help', { userId });

    try {
      const currentMode = await getUserMode(userId);

      const keyboard = {
        inline_keyboard: [
          [{ text: '💰 Logger Mode', callback_data: 'set_mode_logger' }],
          [{ text: '💬 Chat Mode', callback_data: 'set_mode_chat' }],
          [{ text: '📊 Query Mode', callback_data: 'set_mode_query' }],
        ],
      };

      const modeMessage = messages.mode.current(getModeDescription(currentMode));

      await ctx.answerCallbackQuery('Mode guide opened');

      await ctx.reply(modeMessage.text, {
        entities: modeMessage.entities,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('callback:profile_modes_help:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery(messages.errors.fetchModeFailed());
    }
  });
}

