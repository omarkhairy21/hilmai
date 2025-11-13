import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { getUserTimezone } from '../../services/user.service';
import { messages } from '../../lib/messages';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';

/**
 * Register /edit command handler
 * Format: /edit <transaction_id> <changes>
 * Examples:
 *   /edit 18 Date yesterday
 *   /edit 18 Update category to Dining
 *   /edit 18 Change amount to 50 AED
 */
export function registerEditCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('edit', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:edit:received', { userId });

    try {
      // Parse command: /edit <display_id> <changes>
      const args = ctx.match?.trim().split(/\s+/, 2);
      if (!args || args.length < 2) {
        await ctx.reply(messages.edit.invalidUsage(), { parse_mode: 'Markdown' });
        return;
      }

      const displayIdStr = args[0];
      const changes = ctx.match?.substring(displayIdStr.length).trim();

      const displayId = parseInt(displayIdStr, 10);
      if (isNaN(displayId) || displayId <= 0) {
        await ctx.reply(messages.edit.invalidTransactionId(), { parse_mode: 'Markdown' });
        return;
      }

      if (!changes || changes.length === 0) {
        await ctx.reply(messages.edit.missingChanges(), { parse_mode: 'Markdown' });
        return;
      }

      logger.info('command:edit:parsed', { userId, displayId, changesLength: changes.length });

      // Get user context
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
        messageId: ctx.message?.message_id ?? 0,
      };

      // Build context prompt for transaction manager agent
      const contextPrompt = [
        `[Current Date: Today is ${currentDate}, Yesterday was ${yesterdayStr}]`,
        `[User Timezone: ${userTimezone}]`,
        `[User: ${ctx.from?.first_name || 'Unknown'} (@${ctx.from?.username || 'unknown'})]`,
        `[User ID: ${userId}]`,
        `[Message ID: ${ctx.message?.message_id ?? 0}]`,
        `[User Metadata JSON: ${JSON.stringify(userMetadata)}]`,
        `[Message Type: edit_command]`,
        `[Transaction Display ID: ${displayId}]`,
        '',
        `User is editing transaction #${displayId}.`,
        'Apply the requested changes and update the transaction. Respond with the updated transaction details.',
        'Changes requested:',
        changes,
      ].join('\n');

      logger.info('command:edit:building_prompt', {
        userId,
        displayId,
        promptLength: contextPrompt.length,
      });

      // Get transaction manager agent
      const transactionManagerAgent = mastra.getAgent('transactionManager');
      if (!transactionManagerAgent) {
        throw new Error('Transaction manager agent is not registered');
      }

      // Send "Processing..." message
      await ctx.replyWithChatAction('typing');
      const processingMsg = await ctx.reply(messages.edit.processing(), { parse_mode: 'Markdown' });

      try {
        // Call transaction manager agent directly
        const startTime = Date.now();
        const generation = await transactionManagerAgent.generate(contextPrompt, {
          memory: {
            thread: `user-${userId}`,
            resource: userId.toString(),
          },
        });

        const duration = Date.now() - startTime;
        logger.info('command:edit:agent_response', {
          userId,
          displayId,
          duration,
          responseLength: generation.text?.length || 0,
        });

        const response = generation.text ?? '✅ Transaction updated successfully.';

        // Edit the processing message with the final response
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, response, {
          parse_mode: 'Markdown',
        });

        logger.info('command:edit:completed', { userId, displayId });
      } catch (agentError) {
        logger.error('command:edit:agent_error', {
          userId,
          displayId,
          error: agentError instanceof Error ? agentError.message : String(agentError),
        });

        // Delete processing message
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {
          // Ignore delete errors
        });

        throw agentError;
      }
    } catch (error) {
      logger.error('command:edit:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await ctx.reply(messages.errors.generic(), { parse_mode: 'Markdown' });
    }
  });
}
