import { Update } from 'node-telegram-bot-api';

export async function handleWebhookUpdate(update: Update) {
  const { bot } = await import('./bot.js');
  await bot.processUpdate(update);
}
