import { Bot, type Context } from 'grammy';
import { Menu } from '@grammyjs/menu';
import { z } from 'zod';
import { downloadFile, deleteFile, getTempFilePath } from './lib/file-utils.js';
import type { Mastra } from '@mastra/core/mastra';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export function createBot(mastra: Mastra): Bot {
  const bot = new Bot(token!);

  // Create financial menu
  const financialMenu = new Menu('financial-menu')
    .text('💰 Set Budget', async (ctx) => {
      await ctx.reply(
        'Please enter your monthly budget amount.\n\nExample: 1000\n\n(Just send the number in your next message)'
      );
    })
    .row()
    .text('📊 List 10 Latest Transactions', async (ctx) => {
      try {
        await ctx.editMessageText('Fetching your latest transactions...');

        // TODO: Replace with actual database query
        // const transactions = await getLatestTransactions(ctx.from?.id, 10);

        // Mock data for now
        const mockTransactions = [
          { merchant: 'Starbucks', amount: 5.5, date: '2025-10-24' },
          { merchant: 'Walmart', amount: 45.0, date: '2025-10-23' },
          { merchant: 'Uber', amount: 12.3, date: '2025-10-22' },
        ];

        const message =
          '📊 *Latest Transactions:*\n\n' +
          mockTransactions
            .map((tx, i) => `${i + 1}. ${tx.merchant} - $${tx.amount} (${tx.date})`)
            .join('\n');

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error fetching transactions:', error);
        await ctx.reply('❌ Failed to fetch transactions. Please try again.');
      }
    })
    .row()
    .text('📈 Budget Overview', async (ctx) => {
      try {
        await ctx.editMessageText('Loading your budget status...');

        // TODO: Replace with actual budget calculation
        // const budgetData = await getBudgetOverview(ctx.from?.id);

        // Mock data for now
        const mockBudget = {
          total: 1000,
          spent: 342.8,
          remaining: 657.2,
          percentageUsed: 34,
        };

        const message =
          '📈 *Budget Overview:*\n\n' +
          `💰 Monthly Budget: $${mockBudget.total}\n` +
          `💸 Spent: $${mockBudget.spent}\n` +
          `✅ Remaining: $${mockBudget.remaining}\n\n` +
          `Progress: ${mockBudget.percentageUsed}% used`;

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error fetching budget:', error);
        await ctx.reply('❌ Failed to fetch budget overview. Please try again.');
      }
    })
    .row()
    .text('➕ Add Transaction', async (ctx) => {
      await ctx.reply(
        '➕ *Add a new transaction:*\n\n' +
          'You can:\n' +
          '• Type it: "Spent $15 on coffee"\n' +
          '• Send a photo of your receipt 📷\n' +
          '• Send a voice message 🎤',
        { parse_mode: 'Markdown' }
      );
    })
    .row()
    .text('❌ Close', (ctx) => ctx.deleteMessage());

  // Register the menu with the bot
  bot.use(financialMenu);

  // Handle /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `Welcome to Hilm.ai! 🤖\n\nI'm your personal financial assistant. I can help you:\n\n` +
        `💰 Track expenses\n` +
        `📊 Analyze spending patterns\n` +
        `💡 Get financial insights\n\n` +
        `Use /menu to see all available actions.`,
      { reply_markup: financialMenu }
    );
  });

  // Handle /menu command
  bot.command('menu', async (ctx) => {
    await ctx.reply('Choose an action:', {
      reply_markup: financialMenu,
    });
  });

  // Handle /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
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
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;

    // Ignore commands
    if (text.startsWith('/')) {
      return;
    }

    try {
      // Send typing indicator
      await ctx.replyWithChatAction('typing');

      const workflow = mastra.getWorkflow('telegramRouting');
      const run = await workflow.createRunAsync();
      const userInfo = {
        username: ctx.from?.username || '',
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
      };

      const runResult = await run.start({ inputData: { text, chatId: ctx.chat.id, userInfo } });
      console.log('Run Result', runResult);

      const runResultSchema = z.object({
        result: z.object({ responseText: z.string() }).optional(),
        steps: z
          .object({
            route: z
              .object({ output: z.object({ responseText: z.string() }).optional() })
              .optional(),
          })
          .partial()
          .optional(),
      });

      const parsed = runResultSchema.safeParse(runResult);
      const responseText = parsed.success
        ? (parsed.data.result?.responseText ??
          parsed.data.steps?.route?.output?.responseText ??
          'Done.')
        : 'Done.';

      await ctx.reply(responseText, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error processing message:', error);
      await ctx.reply(
        `❌ Sorry, I encountered an error processing your message. Please try again.`
      );
    }
  });

  // Handle photo messages (receipts)
  bot.on('message:photo', async (ctx) => {
    try {
      // Send processing message
      await ctx.reply('📷 Scanning receipt...');
      await ctx.replyWithChatAction('typing');

      // Get highest quality photo
      const photos = ctx.message.photo;
      if (!photos || photos.length === 0) {
        await ctx.reply('❌ No photo found. Please try again.');
        return;
      }

      // Get the largest photo (highest resolution)
      const photo = photos[photos.length - 1];
      const fileId = photo.file_id;

      // Get file info and construct URL
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      // Gather user information
      const userInfo = {
        chatId: ctx.chat.id,
        username: ctx.from?.username || '',
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
      };

      // Use the transaction extractor agent with receipt extraction
      const agent = mastra.getAgent('transactionExtractor');

      if (!agent) {
        await ctx.reply('Agent not found. Please check configuration.');
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
        resourceId: ctx.chat.id.toString(),
      });

      // Send response
      await ctx.reply(`✅ Receipt processed!\n\n${result.text}`, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error processing photo:', error);
      await ctx.reply(
        `❌ Sorry, I couldn't process that receipt. Try:\n` +
          `• Better lighting\n` +
          `• Clearer photo\n` +
          `• Or just type the amount!`
      );
    }
  });

  // Handle voice messages
  bot.on('message:voice', async (ctx) => {
    let tempFilePath: string | null = null;

    try {
      // Send processing message
      await ctx.reply('🎤 Transcribing voice note...');
      await ctx.replyWithChatAction('typing');

      // Get voice file info
      const voice = ctx.message.voice;
      if (!voice) {
        await ctx.reply('❌ No voice message found. Please try again.');
        return;
      }

      const fileId = voice.file_id;
      const duration = voice.duration;

      // Check duration (limit to 2 minutes to avoid high costs)
      if (duration > 120) {
        await ctx.reply(
          '⚠️ Voice message is too long (max 2 minutes). Please send a shorter message or type it out!'
        );
        return;
      }

      // Get file info and download
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      // Download to temp file
      tempFilePath = getTempFilePath('voice', 'ogg');
      await downloadFile(fileUrl, tempFilePath);

      // Use voice workflow to handle transcription + routing
      const workflow = mastra.getWorkflow('telegramVoice');
      const run = await workflow.createRunAsync();
      const userInfo = {
        username: ctx.from?.username || '',
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
      };

      const runResult = await run.start({
        inputData: { chatId: ctx.chat.id, voiceFilePath: tempFilePath, userInfo },
      });

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
        ? (parsedVoice.data.result?.responseText ??
          parsedVoice.data.steps?.classifyAndRoute?.output?.responseText ??
          'Done.')
        : 'Done.';

      await ctx.reply(responseText, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error processing voice:', error);

      // Clean up temp file if it exists
      if (tempFilePath) {
        await deleteFile(tempFilePath).catch(() => {});
      }

      await ctx.reply(
        `❌ Sorry, I couldn't process that voice note. Try:\n` +
          `• Recording again in a quiet place\n` +
          `• Speaking more clearly\n` +
          `• Or just type it out!`
      );
    }
  });

  // Error handler
  bot.catch((err) => {
    const error = err.error || err;
    console.error('Bot error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });
  });

  console.log('🤖 Hilm.ai Telegram bot initialized');

  return bot;
}
