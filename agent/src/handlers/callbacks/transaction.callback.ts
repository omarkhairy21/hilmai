import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { getUserTimezone } from '../../services/user.service';
import { messages } from '../../lib/messages';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';

/**
 * Register transaction callback query handlers
 * Handles: edit_*, delete_*
 */
export function registerTransactionCallbacks(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.callbackQuery(/^(edit_|delete_)/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      logger.warn('callback:no_user_id');
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:received', {
      userId,
      callbackData,
    });

    try {
      // Parse callback data
      const [action, transactionIdStr] = callbackData.split('_');
      const transactionId = parseInt(transactionIdStr, 10);

      if (!transactionId || isNaN(transactionId)) {
        throw new Error(`Invalid transaction ID: ${transactionIdStr}`);
      }

      // Build context prompt for transaction manager agent
      const userTimezone = await getUserTimezone(userId);
      const now = new Date();
      const currentDate = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
      const yesterdayStr = formatInTimeZone(subDays(now, 1), userTimezone, 'yyyy-MM-dd');

      const userMetadata = {
        userId,
        telegramChatId: userId,
        username: ctx.from?.username ?? null,
        firstName: ctx.from?.first_name ?? null,
        lastName: ctx.from?.last_name ?? null,
        messageId: ctx.callbackQuery.message?.message_id ?? 0,
      };

      const contextPrompt = [
        `[Current Date: Today is ${currentDate}, Yesterday was ${yesterdayStr}]`,
        `[User Timezone: ${userTimezone}]`,
        `[User: ${ctx.from?.first_name || 'Unknown'} (@${ctx.from?.username || 'unknown'})]`,
        `[User ID: ${userId}]`,
        `[Message ID: ${ctx.callbackQuery.message?.message_id ?? 0}]`,
        `[User Metadata JSON: ${JSON.stringify(userMetadata)}]`,
        `[Message Type: callback]`,
        '',
        `User clicked "${action}" button for transaction ID ${transactionId}.`,
        action === 'edit'
          ? 'Wait for user to provide new transaction details, then update the transaction.'
          : 'Delete this transaction immediately and confirm the deletion.',
      ].join('\n');

      // Get transaction manager agent
      const transactionManagerAgent = mastra.getAgent('transactionManager');
      if (!transactionManagerAgent) {
        throw new Error('Transaction manager agent is not registered');
      }

      // Acknowledge callback query
      await ctx.answerCallbackQuery();

      // For delete, execute immediately
      if (action === 'delete') {
        const generation = await transactionManagerAgent.generate(contextPrompt, {
          memory: {
            thread: `user-${userId}`,
            resource: userId.toString(),
          },
        });

        const response = generation.text ?? 'Transaction deleted successfully.';

        // Edit the original message to show deletion confirmation
        if (ctx.callbackQuery.message) {
          await ctx.editMessageText(response, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(response, { parse_mode: 'Markdown' });
        }

        logger.info('callback:delete_completed', { userId, transactionId });
      } else {
        // For edit, prompt user for changes
        await ctx.reply(messages.callbacks.editPrompt(transactionId), { parse_mode: 'Markdown' });

        // The transaction manager agent will handle the edit when user responds
        // Transaction ID is included in the prompt message for context
        logger.info('callback:edit_prompted', { userId, transactionId });
      }
    } catch (error) {
      logger.error('callback:error', {
        userId,
        callbackData,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await ctx.answerCallbackQuery(messages.callbacks.error());
      await ctx.reply(messages.callbacks.genericError(), { parse_mode: 'Markdown' });
    }
  });
}
