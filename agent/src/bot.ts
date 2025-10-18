import TelegramBot from 'node-telegram-bot-api';
import { mastra } from './mastra/index.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Create bot instance
export const bot = new TelegramBot(token, { polling: true });

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `Welcome to Hilm.ai! 🤖\n\nI'm your personal financial assistant. I can help you:\n\n` +
    `💰 Track expenses\n` +
    `📊 Analyze spending patterns\n` +
    `💡 Get financial insights\n\n` +
    `Try sending me a transaction like: "Spent $50 on groceries at Walmart"`
  );
});

// Handle /help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `📚 How to use Hilm.ai:\n\n` +
    `• Send transaction text: "Bought coffee for $5"\n` +
    `• Send a receipt photo (coming soon)\n` +
    `• Send voice message (coming soon)\n` +
    `• Ask questions about your spending\n\n` +
    `Commands:\n` +
    `/start - Start the bot\n` +
    `/help - Show this help message`
  );
});

// Handle text messages
bot.on('message', async (msg, metadata) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const fromUser = msg.from;
  console.log('fromUser', fromUser);
  const messageType = metadata?.type;

  // Ignore commands
  if (!text || text.startsWith('/')) {
    return;
  }

  try {
    // Send typing indicator
    await bot.sendChatAction(chatId, 'typing');

    // Use the transaction extractor agent
    const agent = await mastra.getAgent('transactionExtractor');

    if (!agent) {
      await bot.sendMessage(chatId, 'Agent not found. Please check configuration.');
      return;
    }

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    const result = await agent.generate(
      `${text}\n\n[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]`,
      {
        onStepFinish: (step) => {
          console.log('Step finished:', step);
        },
        resourceId: chatId.toString(),
      }
    );

    // Send response
    await bot.sendMessage(
      chatId,
      `✅ Transaction recorded!\n\n${result.text}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error processing message:', error);
    await bot.sendMessage(
      chatId,
      `❌ Sorry, I encountered an error processing your message. Please try again.`
    );
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Hilm.ai Telegram bot is running...');
