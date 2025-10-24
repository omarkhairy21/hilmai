import TelegramBot, { type Message } from 'node-telegram-bot-api';
import { z } from 'zod';
import { downloadFile, deleteFile, getTempFilePath } from './lib/file-utils.js';
import type { Mastra } from '@mastra/core/mastra';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Toggle polling for DX: use polling in dev/local, webhooks in production
const usePolling = process.env.TELEGRAM_POLLING === 'true' || process.env.NODE_ENV !== 'production';

export function createBot(mastra: Mastra): TelegramBot {
  const bot = new TelegramBot(token!, { polling: usePolling });

  // Handle /start command
  bot.onText(/\/start/, async (msg: Message) => {
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
  bot.onText(/\/help/, async (msg: Message) => {
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
  bot.on('message', async (msg: Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands
    if (!text || text.startsWith('/')) {
      return;
    }

    try {
      // Send typing indicator
      await bot.sendChatAction(chatId, 'typing');

      const workflow = mastra.getWorkflow('telegramRouting');
      const run = await workflow.createRunAsync();
      const userInfo = {
        username: msg.from?.username || '',
        firstName: msg.from?.first_name || '',
        lastName: msg.from?.last_name || '',
      };

      const runResult = await run.start({ inputData: { text, chatId, userInfo } });
      console.log('Run Result', runResult);

      const runResultSchema = z.object({
        result: z.object({ responseText: z.string() }).optional(),
        steps: z
          .object({
            route: z.object({ output: z.object({ responseText: z.string() }).optional() }).optional(),
          })
          .partial()
          .optional(),
      });

      const parsed = runResultSchema.safeParse(runResult);
      const responseText = parsed.success
        ? parsed.data.result?.responseText ?? parsed.data.steps?.route?.output?.responseText ?? 'Done.'
        : 'Done.';

      await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error processing message:', error);
      await bot.sendMessage(
        chatId,
        `❌ Sorry, I encountered an error processing your message. Please try again.`
      );
    }
  });

  // Handle photo messages (receipts)
  bot.on('photo', async (msg: Message) => {
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
      const agent = mastra.getAgent('transactionExtractor');

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
        onStepFinish: (step: unknown) => {
          console.log('Step finished:', step);
        },
        resourceId: chatId.toString(),
      });

      // Send response
      await bot.sendMessage(chatId, `✅ Receipt processed!\n\n${result.text}`, {
        parse_mode: 'Markdown',
      });
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
  bot.on('voice', async (msg: Message) => {
    const chatId = msg.chat.id;
    let tempFilePath: string | null = null;

    try {
      // Send processing message
      await bot.sendMessage(chatId, '🎤 Transcribing voice note...');
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

      // Use voice workflow to handle transcription + routing
      const workflow = mastra.getWorkflow('telegramVoice');
      const run = await workflow.createRunAsync();
      const userInfo = {
        username: msg.from?.username || '',
        firstName: msg.from?.first_name || '',
        lastName: msg.from?.last_name || '',
      };

      const runResult = await run.start({ inputData: { chatId, voiceFilePath: tempFilePath, userInfo } });

      // Clean up temp file (no longer needed)
      await deleteFile(tempFilePath);
      tempFilePath = null;

      const voiceRunResultSchema = z.object({
        result: z.object({ responseText: z.string() }).optional(),
        steps: z
          .object({
            classifyAndRoute: z
              .object({ output: z.object({ responseText: z.string() }).optional() })
              .optional(),
          })
          .partial()
          .optional(),
      });

      const parsedVoice = voiceRunResultSchema.safeParse(runResult);
      const responseText = parsedVoice.success
        ? parsedVoice.data.result?.responseText ??
          parsedVoice.data.steps?.classifyAndRoute?.output?.responseText ??
          'Done.'
        : 'Done.';

      await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
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
  bot.on('polling_error', (error: Error) => {
    console.error('Polling error:', error);
  });

  console.log('🤖 Hilm.ai Telegram bot is running...');

  return bot;
}
