import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { AgentResponseCache } from '../../lib/prompt-cache';
import { messages } from '../../lib/messages';

/**
 * Register /clear command handler
 * Clear cached responses for user
 */
export function registerClearCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('clear', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const deleted = await AgentResponseCache.clearUser(userId);
      logger.info('command:clear', { userId, deleted });
      await ctx.reply(messages.success.cacheCleared(deleted));
    }
  });
}
