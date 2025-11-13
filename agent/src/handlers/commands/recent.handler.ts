import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { searchTransactionsSQL } from '../../lib/embeddings';
import { messages } from '../../lib/messages';

/**
 * Helper function to get emoji for category
 */
function getCategoryEmoji(category: string): string {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('grocer')) return '🛒';
  if (categoryLower.includes('dining') || categoryLower.includes('food')) return '🍽️';
  if (categoryLower.includes('transport')) return '🚗';
  if (categoryLower.includes('entertainment')) return '🎬';
  if (categoryLower.includes('shopping')) return '🛍️';
  if (categoryLower.includes('bills')) return '💳';
  if (categoryLower.includes('health')) return '🏥';
  if (categoryLower.includes('education')) return '📚';
  return '💰';
}

/**
 * Register /recent command handler
 * View recent transactions with edit/delete buttons
 */
export function registerRecentCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('recent', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:recent', { userId });

    try {
      await ctx.replyWithChatAction('typing');

      // Fetch recent transactions
      const transactions = await searchTransactionsSQL({
        userId,
        limit: 10,
      });

      if (transactions.length === 0) {
        await ctx.reply(messages.recent.empty(), { parse_mode: 'Markdown' });
        return;
      }

      // Format transactions with display IDs
      const transactionLines = transactions.map((tx, index) => {
        const emoji = getCategoryEmoji(tx.category);
        return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [#${tx.display_id}]`;
      });

      const messageText = messages.recent.header() + '\n\n' + transactionLines.join('\n');

      // Generate inline keyboards for each transaction
      // Use display_id (sequential number) in callback data, not UUID
      const keyboard = {
        inline_keyboard: transactions.map((tx) => [
          { text: 'Edit', callback_data: `edit_${tx.display_id}` },
          { text: 'Delete', callback_data: `delete_${tx.display_id}` },
        ]),
      };

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('command:recent:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.recent.fetchFailed(), { parse_mode: 'Markdown' });
    }
  });
}
