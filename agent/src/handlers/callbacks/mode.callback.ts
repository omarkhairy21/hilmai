import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import {
  setUserMode,
  getModeDescription,
  getModeInstructions,
  isValidMode,
  type UserMode,
} from '../../lib/user-mode';
import { messages } from '../../lib/messages';

/**
 * Register mode switch callback query handlers
 * Handles: set_mode_logger, set_mode_chat, set_mode_query
 */
export function registerModeCallbacks(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.callbackQuery(/^set_mode_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:set_mode', { userId, callbackData });

    const modeStr = callbackData.replace('set_mode_', '');

    if (!isValidMode(modeStr)) {
      await ctx.answerCallbackQuery(messages.errors.invalidMode());
      return;
    }

    const mode = modeStr as UserMode;

    try {
      await setUserMode(userId, mode);

      await ctx.answerCallbackQuery(`✅ Switched to ${getModeDescription(mode)}`);

      const changeMsg = messages.mode.changed(getModeInstructions(mode));
      await ctx.editMessageText(changeMsg.text, {
        parse_mode: 'Markdown',
        entities: changeMsg.entities,
      });

      logger.info('callback:set_mode:success', {
        userId,
        mode,
        // Telemetry: Track mode switches for UX optimization
        event: 'mode_switched',
        previousMode: 'unknown', // Could be fetched before update
        newMode: mode,
        switchMethod: 'callback',
      });
    } catch (error) {
      logger.error('callback:set_mode:error', {
        userId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery(messages.errors.modeSwitchFailed());
    }
  });
}
