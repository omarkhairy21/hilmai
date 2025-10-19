import TelegramBot from 'node-telegram-bot-api';
import { mastra } from './mastra/index.js';
import { downloadFile, deleteFile, getTempFilePath } from './lib/file-utils.js';

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
    `• Send a receipt photo 📷\n` +
    `• Send a voice message 🎤\n` +
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

// Handle photo messages (receipts)
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Send processing message
    await bot.sendMessage(chatId, '📷 Scanning receipt...');
    await bot.sendChatAction(chatId, 'typing');

    // Get highest quality photo
    const photos = msg.photo;
    if (!photos || photos.length === 0) {
      await bot.sendMessage(chatId, '❌ No photo found. Please try again.');
      return;
    }

    // Get the largest photo (highest resolution)
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;

    // Get file info and construct URL
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    // Use the transaction extractor agent with receipt extraction
    const agent = await mastra.getAgent('transactionExtractor');

    if (!agent) {
      await bot.sendMessage(chatId, 'Agent not found. Please check configuration.');
      return;
    }

    // Create a prompt for the agent to extract and save the receipt
    const prompt = `Extract transaction details from this receipt image and save it to the database.

Image URL: ${fileUrl}

[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]

Use the extract-receipt tool to analyze this receipt image, then save the transaction using the save-transaction tool.`;

    const result = await agent.generate(prompt, {
      onStepFinish: (step) => {
        console.log('Step finished:', step);
      },
      resourceId: chatId.toString(),
    });

    // Send response
    await bot.sendMessage(
      chatId,
      `✅ Receipt processed!\n\n${result.text}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error processing photo:', error);
    await bot.sendMessage(
      chatId,
      `❌ Sorry, I couldn't process that receipt. Try:\n` +
      `• Better lighting\n` +
      `• Clearer photo\n` +
      `• Or just type the amount!`
    );
  }
});

// Handle voice messages
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  let tempFilePath: string | null = null;

  try {
    // Send processing message
    await bot.sendMessage(chatId, '🎤 Processing voice note...');
    await bot.sendChatAction(chatId, 'typing');

    // Get voice file info
    const voice = msg.voice;
    if (!voice) {
      await bot.sendMessage(chatId, '❌ No voice message found. Please try again.');
      return;
    }

    const fileId = voice.file_id;
    const duration = voice.duration;

    // Check duration (limit to 2 minutes to avoid high costs)
    if (duration > 120) {
      await bot.sendMessage(
        chatId,
        '⚠️ Voice message is too long (max 2 minutes). Please send a shorter message or type it out!'
      );
      return;
    }

    // Get file info and download
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Download to temp file
    tempFilePath = getTempFilePath('voice', 'ogg');
    await downloadFile(fileUrl, tempFilePath);

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    // Use the transaction extractor agent with voice file
    const agent = mastra.getAgent('transactionExtractor');

    if (!agent) {
      await bot.sendMessage(chatId, 'Agent not found. Please check configuration.');
      // Clean up temp file
      await deleteFile(tempFilePath);
      return;
    }

    // Create a prompt for the agent to transcribe and extract the transaction
    const prompt = `Transcribe this voice message and extract the transaction details, then save it to the database.

Voice file path: ${tempFilePath}

[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]

Use the transcribe-voice tool to convert the audio to text, then extract the transaction details and save using the save-transaction tool.`;

    const result = await agent.generate(prompt, {
      onStepFinish: (step) => {
        console.log('Step finished:', step);
      },
      resourceId: chatId.toString(),
    });

    // Clean up temp file
    await deleteFile(tempFilePath);
    tempFilePath = null;

    // Send response
    await bot.sendMessage(
      chatId,
      `✅ Voice message processed!\n\n${result.text}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error processing voice:', error);

    // Clean up temp file if it exists
    if (tempFilePath) {
      await deleteFile(tempFilePath).catch(() => {});
    }

    await bot.sendMessage(
      chatId,
      `❌ Sorry, I couldn't process that voice note. Try:\n` +
      `• Recording again in a quiet place\n` +
      `• Speaking more clearly\n` +
      `• Or just type it out!`
    );
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Hilm.ai Telegram bot is running...');
