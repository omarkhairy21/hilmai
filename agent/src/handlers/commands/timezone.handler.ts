import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { updateUserTimezone } from '../../services/user.service';
import { messages } from '../../lib/messages';
import {
  parseTimezoneInput,
  getTimezoneConfirmation,
  getTimezoneOptions,
} from '../../lib/timezone-parser';

/**
 * Register /timezone command handler
 * Set user's timezone
 */
export function registerTimezoneCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('timezone', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:timezone', { userId });

    // Get command arguments
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    const userInput = args.join(' ').trim();

    // If no argument provided, show quick options
    if (!userInput) {
      const options = getTimezoneOptions();
      await ctx.reply(options, { parse_mode: 'Markdown' });
      return;
    }

    // Parse user input (city name, GMT offset, or IANA timezone)
    const parsed = parseTimezoneInput(userInput);

    if (!parsed) {
      const invalidMsg = messages.timezone.invalidInput(userInput);
      await ctx.reply(invalidMsg.text, {
        entities: invalidMsg.entities,
      });
      return;
    }

    // Update user's timezone
    try {
      const success = await updateUserTimezone(userId, parsed.timezone);

      if (success) {
        logger.info('command:timezone:updated', {
          userId,
          timezone: parsed.timezone,
          userInput,
        });

        const confirmation = getTimezoneConfirmation(parsed);
        await ctx.reply(confirmation, { parse_mode: 'Markdown' });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      logger.error('command:timezone:update_error', {
        userId,
        userInput,
        timezone: parsed.timezone,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to update timezone. Please try again.', {
        parse_mode: 'Markdown',
      });
    }
  });
}
