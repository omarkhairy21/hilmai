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
 * Register menu callback query handlers
 * Handles: menu_recent_transactions, menu_add_transaction, menu_reports, menu_help
 */
export function registerMenuCallbacks(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.callbackQuery(/^menu_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:menu', { userId, callbackData });

    await ctx.answerCallbackQuery();

    if (callbackData === 'menu_recent_transactions') {
      try {
        // Fetch recent transactions
        const transactions = await searchTransactionsSQL({
          userId,
          limit: 10,
        });

        if (transactions.length === 0) {
          await ctx.editMessageText(messages.recent.empty(), { parse_mode: 'Markdown' });
          return;
        }

        // Format transactions with IDs
        const transactionLines = transactions.map((tx, index) => {
          const emoji = getCategoryEmoji(tx.category);
          return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [ID: ${tx.id}]`;
        });

        const messageText = messages.recent.header() + '\n\n' + transactionLines.join('\n');

        // Generate inline keyboards for each transaction
        const keyboard = {
          inline_keyboard: transactions.map((tx) => [
            { text: 'Edit', callback_data: `edit_${tx.id}` },
            { text: 'Delete', callback_data: `delete_${tx.id}` },
          ]),
        };

        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (error) {
        logger.error('callback:menu_recent_transactions:error', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.editMessageText(messages.recent.fetchFailed(), { parse_mode: 'Markdown' });
      }
    } else if (callbackData === 'menu_add_transaction') {
      await ctx.editMessageText(messages.menu.addTransaction(), { parse_mode: 'Markdown' });
    } else if (callbackData === 'menu_reports') {
      await ctx.editMessageText(messages.menu.reports(), { parse_mode: 'Markdown' });
    } else if (callbackData === 'menu_help') {
      await ctx.editMessageText(messages.menu.help(), { parse_mode: 'Markdown' });
    }
  });
}
