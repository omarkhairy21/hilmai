import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { getUserSubscription } from '../../services/user.service';
import { messages } from '../../lib/messages';

/**
 * Register /billing command handler
 * Manage subscription
 */
export function registerBillingCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('billing', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:billing', { userId });

    try {
      const subscription = await getUserSubscription(userId);

      if (!subscription || !subscription.stripe_customer_id) {
        await ctx.reply("You don't have a subscription yet. Use /subscribe to get started.", {
          parse_mode: 'Markdown',
        });
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '💳 Manage Subscription', callback_data: 'open_billing_portal' }],
        ],
      };

      await ctx.reply(
        messages.subscription.billingInfo(
          subscription.subscription_status || 'unknown',
          subscription.plan_tier,
          subscription.current_period_end
        ),
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      logger.error('command:billing:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.generic());
    }
  });
}
