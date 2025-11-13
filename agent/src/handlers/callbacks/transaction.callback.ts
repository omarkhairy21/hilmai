import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';
import { supabaseService } from '../../lib/supabase';

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
      // Parse callback data: edit_<display_id> or delete_<display_id>
      const [action, displayIdStr] = callbackData.split('_');
      const displayId = parseInt(displayIdStr, 10);

      if (!displayId || isNaN(displayId)) {
        throw new Error(`Invalid display ID: ${displayIdStr}`);
      }

      // Acknowledge callback query
      await ctx.answerCallbackQuery();

      // For delete, execute directly without agent (no reasoning needed)
      if (action === 'delete') {
        try {
          // Delete transaction from database
          const { error: deleteError } = await supabaseService
            .from('transactions')
            .delete()
            .eq('user_id', userId)
            .eq('display_id', displayId);

          if (deleteError) {
            throw deleteError;
          }

          // Show confirmation message
          const confirmationMessage = `✅ *Transaction #${displayId} deleted successfully*`;

          // Edit the original message to show deletion confirmation
          if (ctx.callbackQuery.message) {
            await ctx.editMessageText(confirmationMessage, { parse_mode: 'Markdown' });
          } else {
            await ctx.reply(confirmationMessage, { parse_mode: 'Markdown' });
          }

          logger.info('callback:delete_completed', { userId, displayId });
        } catch (deleteError) {
          logger.error('callback:delete_error', {
            userId,
            displayId,
            error: deleteError instanceof Error ? deleteError.message : String(deleteError),
          });

          const errorMessage = `❌ Failed to delete transaction #${displayId}. Please try again.`;
          if (ctx.callbackQuery.message) {
            await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
          } else {
            await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
          }
        }
      } else {
        // For edit, show user the /edit command with their display_id
        await ctx.reply(messages.callbacks.editPrompt(displayId), { parse_mode: 'Markdown' });

        logger.info('callback:edit_prompted', { userId, displayId });
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
