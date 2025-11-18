import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { createOrGetUser } from '../../services/user.service';
import { activateFromActivationCode } from '../../services/subscription.service';
import { extractCodeFromStartParam } from '../../lib/activation-codes';
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
      // Check if this is an activation deep link (e.g., /start LINK-ABC123)
      const startParam = ctx.match?.toString().trim();

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

      // Define onboarding UI (used for both activation and normal flow)
      const onboardingKeyboard = {
        inline_keyboard: [
          [{ text: '⚡ Instant Log', callback_data: 'set_mode_logger' }],
          [{ text: '🛠 Set Up Profile', callback_data: 'open_profile_setup' }],
        ],
      };

      const welcomeMessage = messages.start.welcome();

      // Handle activation code if present in start parameter
      if (startParam) {
        const activationCode = extractCodeFromStartParam(startParam);
        if (activationCode) {
          logger.info('command:start:activation_code_detected', {
            userId,
            code: activationCode,
          });

          const activationResult = await activateFromActivationCode(activationCode, userId);

          if (activationResult.success) {
            // Send subscription confirmation message
            await ctx.reply(activationResult.message, { parse_mode: 'HTML' });
          } else {
            // If activation failed, show error message
            await ctx.reply(activationResult.message, { parse_mode: 'HTML' });
          }
        }
      }

      // Show welcome message with onboarding buttons (for both activation and normal flow)
      await ctx.reply(welcomeMessage.text, {
        entities: welcomeMessage.entities,
        reply_markup: onboardingKeyboard,
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
