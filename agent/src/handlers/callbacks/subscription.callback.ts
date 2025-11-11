import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import {
  createCheckoutSession,
  createBillingPortalSession,
} from '../../services/subscription.service';
import { messages } from '../../lib/messages';

/**
 * Register subscription callback query handlers
 * Handles: subscribe_monthly_trial, subscribe_monthly_notrial, subscribe_annual, open_billing_portal
 */
export function registerSubscriptionCallbacks(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  // Handle subscription plan selection
  bot.callbackQuery(/^subscribe_(monthly_notrial|monthly_trial|annual)$/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:subscribe', { userId, callbackData });

    // Parse plan tier and trial option
    let planTier: 'monthly' | 'annual' = 'monthly';
    let includeTrial = false;

    if (callbackData === 'subscribe_monthly_trial') {
      planTier = 'monthly';
      includeTrial = true;
    } else if (callbackData === 'subscribe_monthly_notrial') {
      planTier = 'monthly';
      includeTrial = false;
    } else if (callbackData === 'subscribe_annual') {
      planTier = 'annual';
      includeTrial = false; // Annual never has trial
    }

    try {
      // Create checkout session with trial option
      const result = await createCheckoutSession(
        userId,
        planTier,
        `https://t.me/${ctx.me.username}`, // Success URL (back to bot)
        `https://t.me/${ctx.me.username}`, // Cancel URL (back to bot)
        includeTrial
      );

      if (result.error || !result.url) {
        await ctx.answerCallbackQuery(messages.subscription.checkoutError());
        return;
      }

      await ctx.answerCallbackQuery();

      // Send checkout link with appropriate message
      const keyboard = {
        inline_keyboard: [[{ text: '💳 Complete Subscription', url: result.url }]],
      };

      const confirmationMessage = includeTrial
        ? messages.subscription.trialCheckoutMessage()
        : messages.subscription.noTrialCheckoutMessage();

      await ctx.editMessageText(confirmationMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info('callback:subscribe:checkout_created', {
        userId,
        planTier,
        includeTrial,
        // Telemetry: Track subscription funnel
        event: 'checkout_initiated',
        subscriptionType: includeTrial ? 'trial' : 'paid',
        plan: planTier,
        price: planTier === 'monthly' ? 20 : 200,
      });
    } catch (error) {
      logger.error('callback:subscribe:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery(messages.subscription.checkoutError());
    }
  });

  // Handle billing portal callback
  bot.callbackQuery('open_billing_portal', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:billing_portal', { userId });

    try {
      const result = await createBillingPortalSession(
        userId,
        `https://t.me/${ctx.me.username}` // Return URL (back to bot)
      );

      if (result.error || !result.url) {
        await ctx.answerCallbackQuery(messages.subscription.portalError());
        return;
      }

      await ctx.answerCallbackQuery();

      // Send portal link
      const keyboard = {
        inline_keyboard: [[{ text: '💳 Manage Subscription', url: result.url }]],
      };

      await ctx.editMessageText(
        `💳 *Manage Your Subscription*\n\n` +
          `Click the button below to:\n` +
          `• Update payment method\n` +
          `• Change plan\n` +
          `• Cancel subscription\n` +
          `• View invoices`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );

      logger.info('callback:billing_portal:opened', { userId });
    } catch (error) {
      logger.error('callback:billing_portal:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery(messages.subscription.portalError());
    }
  });
}
