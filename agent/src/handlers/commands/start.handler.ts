import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { createOrGetUser } from '../../services/user.service';
import { messages } from '../../lib/messages';

/**
 * Register /start command handler
 * Creates/updates user and shows welcome message
 */
export function registerStartCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:start', { userId });

    try {
      // Create or get user record with complete Telegram information
      const { error, created } = await createOrGetUser(userId, {
        telegram_username: ctx.from?.username || null,
        first_name: ctx.from?.first_name || null,
        last_name: ctx.from?.last_name || null,
      });

      if (error) {
        logger.error('command:start:user_error', {
          userId,
          error: error.message,
        });
      } else {
        logger.info(created ? 'command:start:user_created' : 'command:start:user_updated', {
          userId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          // Telemetry: Track user onboarding funnel
          event: created ? 'user_signup' : 'user_return',
          trialStatus: 'active',
          onboardingStep: 'welcome_message',
        });
      }

      // Prompt new users to set their timezone
      if (created) {
        const tzPrompt =
          '🌍 *Please set your timezone* so transactions are logged with the correct date!\n\n' +
          'Use `/timezone` command with one of these formats:\n' +
          '• City name: `/timezone Bangkok` or `/timezone New York`\n' +
          '• GMT offset: `/timezone +7` or `/timezone -5`\n' +
          '• IANA timezone: `/timezone Asia/Bangkok` or `/timezone America/New_York`\n\n' +
          'Examples:\n' +
          '`/timezone Bangkok` → Asia/Bangkok (UTC+7)\n' +
          '`/timezone +7` → UTC+7\n' +
          '`/timezone Asia/Kolkata` → India (UTC+5:30)';

        await ctx.reply(tzPrompt, { parse_mode: 'Markdown' });
      }

      const modeKeyboard = {
        inline_keyboard: [
          [{ text: '💰 Logger Mode', callback_data: 'set_mode_logger' }],
          [{ text: '💬 Chat Mode (Current)', callback_data: 'set_mode_chat' }],
          [{ text: '📊 Query Mode', callback_data: 'set_mode_query' }],
        ],
      };

      const welcomeMessage = messages.start.welcome();

      await ctx.reply(welcomeMessage.text, {
        entities: welcomeMessage.entities,
        reply_markup: modeKeyboard,
      });
    } catch (error) {
      logger.error('command:start:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      await ctx.reply(messages.start.fallback(), { parse_mode: 'Markdown' });
    }
  });
}
