import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';

/**
 * Register /help command handler
 * Shows help message with bot instructions
 */
export function registerHelpCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('help', async (ctx) => {
    logger.info('command:help', { userId: ctx.from?.id });

    const helpMsg = messages.help.main();

    await ctx.reply(helpMsg.text, {
      entities: helpMsg.entities,
    });
  });
}
