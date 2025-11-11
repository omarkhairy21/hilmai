import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import {
  getUserDefaultCurrency,
  updateUserDefaultCurrency,
  isValidCurrency,
  normalizeCurrency,
} from '../../lib/currency';
import { messages } from '../../lib/messages';

/**
 * Register /currency command handler
 * Set or view default currency
 */
export function registerCurrencyCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('currency', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:currency', { userId });

    // Get command arguments
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    const currencyArg = args[0]?.trim();

    // If no argument provided, show current default currency
    if (!currencyArg) {
      try {
        const currentCurrency = await getUserDefaultCurrency(userId);
        await ctx.reply(messages.currency.current(currentCurrency), { parse_mode: 'Markdown' });
      } catch (error) {
        logger.error('command:currency:fetch_error', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply(messages.currency.fetchFailed());
      }
      return;
    }

    // Validate and normalize currency code
    const normalized = normalizeCurrency(currencyArg);
    if (!normalized || !isValidCurrency(currencyArg)) {
      await ctx.reply(messages.currency.invalidCode(currencyArg), { parse_mode: 'Markdown' });
      return;
    }

    // Update user's default currency
    try {
      const success = await updateUserDefaultCurrency(userId, normalized);

      if (success) {
        logger.info('command:currency:updated', { userId, currency: normalized });
        await ctx.reply(messages.currency.updateSuccess(normalized), { parse_mode: 'Markdown' });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      logger.error('command:currency:update_error', {
        userId,
        currency: normalized,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.currency.updateFailed(), { parse_mode: 'Markdown' });
    }
  });
}
