import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import {
  getUserMode,
  setUserMode,
  getModeDescription,
} from '../../lib/user-mode';
import { messages } from '../../lib/messages';

/**
 * Register mode-related command handlers
 * /mode - Show mode selection
 * /mode_logger - Quick switch to logger mode
 * /mode_chat - Quick switch to chat mode
 * /mode_query - Quick switch to query mode
 */
export function registerModeCommands(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  // Handle /mode command (show mode selection)
  bot.command('mode', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode', { userId });

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

      await ctx.reply(modeMessage.text, {
        entities: modeMessage.entities,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('command:mode:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.fetchModeFailed());
    }
  });

  // Handle /mode_logger command (quick switch to logger mode)
  bot.command('mode_logger', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_logger', { userId });

    try {
      await setUserMode(userId, 'logger');
      const loggerMsg = messages.mode.instructions.logger();
      await ctx.reply(loggerMsg.text, {
        entities: loggerMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_logger:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });

  // Handle /mode_chat command (quick switch to chat mode)
  bot.command('mode_chat', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_chat', { userId });

    try {
      await setUserMode(userId, 'chat');
      const chatMsg = messages.mode.instructions.chat();
      await ctx.reply(chatMsg.text, {
        entities: chatMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_chat:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });

  // Handle /mode_query command (quick switch to query mode)
  bot.command('mode_query', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_query', { userId });

    try {
      await setUserMode(userId, 'query');
      const queryMsg = messages.mode.instructions.query();
      await ctx.reply(queryMsg.text, {
        entities: queryMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_query:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });
}
