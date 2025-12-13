import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { messages } from '../../lib/messages';

/**
 * Register /privacy command handler
 * Shows privacy policy information
 */
export function registerPrivacyCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command('privacy', async (ctx) => {
    logger.info('command:privacy', { userId: ctx.from?.id });

    const privacyMsg = messages.privacy.main();

    await ctx.reply(privacyMsg.text, {
      entities: privacyMsg.entities,
    });
  });
}

