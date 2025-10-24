import { Update } from 'node-telegram-bot-api';
import { bot } from './bot.js';

export async function handleWebhookUpdate(update: Update) {
  await bot.processUpdate(update);
}
