import { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { downloadFile, getTempFilePath } from './lib/file-utils';
import { AgentResponseCache } from './lib/prompt-cache';
import { searchTransactionsSQL } from './lib/embeddings';
import { supabaseService } from './lib/supabase';
import { createOrGetUser } from './services/user.service';
import { fmt, b } from '@grammyjs/parse-mode';
import {
  getUserDefaultCurrency,
  updateUserDefaultCurrency,
  isValidCurrency,
  normalizeCurrency,
} from './lib/currency';
import {
  getUserMode,
  setUserMode,
  getModeDescription,
  getModeEmoji,
  getModeInstructions,
  isValidMode,
  type UserMode,
} from './lib/user-mode';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
}

export function createBot(mastra: Mastra): Bot {
  const bot = new Bot(token!);
  const logger = mastra.getLogger();

  // Set up bot commands menu (appears in toolbar)
  bot.api
    .setMyCommands([
      {
        command: 'menu',
        description: '📋 Show main menu',
      },
      {
        command: 'start',
        description: '🚀 Start the bot',
      },
      {
        command: 'mode',
        description: '🎯 Switch mode (logger/chat/query)',
      },
      {
        command: 'recent',
        description: '📋 View recent transactions',
      },
      {
        command: 'currency',
        description: '💱 Set default currency',
      },
      {
        command: 'help',
        description: '❓ Get help and instructions',
      },
      {
        command: 'clear',
        description: '🗑️ Clear cached responses',
      },
    ])
    .catch((error) => {
      logger.warn('Failed to set bot commands', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // Handle /start command
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:start', { userId });

    try {
      // Create or get user record with complete Telegram information
      const { error, created } = await createOrGetUser(userId, {
        telegram_username: ctx.from?.username || null,
        first_name: ctx.from?.first_name || null,
        last_name: ctx.from?.last_name || null,
      });

      if (error) {
        logger.error('command:start:user_error', {
          userId,
          error: error.message,
        });
      } else {
        logger.info(created ? 'command:start:user_created' : 'command:start:user_updated', {
          userId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
        });
      }

      const modeKeyboard = {
        inline_keyboard: [
          [{ text: '💰 Logger Mode', callback_data: 'set_mode_logger' }],
          [{ text: '💬 Chat Mode (Current)', callback_data: 'set_mode_chat' }],
          [{ text: '📊 Query Mode', callback_data: 'set_mode_query' }],
        ],
      };

      const welcomeMessage = fmt`Welcome to HilmAI! 🤖

I'm your personal financial assistant with 3 specialized modes:

💰 ${b()}Logger Mode - Fast transaction logging
   Best for: "I spent 50 AED at Carrefour"

💬 ${b()}Chat Mode - General help (default)
   Best for: Questions, onboarding, help

📊 ${b()}Query Mode - Ask about spending
   Best for: "How much on groceries?"

💡 Getting started:
• You're in Chat Mode right now
• Use /mode to switch anytime
• Try /mode_logger for fast logging
• Use /help for detailed instructions`;

      await ctx.reply(welcomeMessage.text, {
        entities: welcomeMessage.entities,
        reply_markup: modeKeyboard,
      });
    } catch (error) {
      logger.error('command:start:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      await ctx.reply(
        `Welcome to HilmAI! 🤖\n\n` +
          `I'm your personal financial assistant.\n\n` +
          `Use /mode to select your mode and get started!`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Handle /help command
  bot.command('help', async (ctx) => {
    logger.info('command:help', { userId: ctx.from?.id });

    const helpMsg = fmt`${b()}HilmAI Commands & Features

${b()}Track Expenses:
• Type: "I spent 50 AED at Starbucks"
• Voice: Send a voice message
• Photo: Send a receipt photo

${b()}Ask Questions:
• "How much did I spend on groceries?"
• "Show my Starbucks spending"
• "Total expenses this month"

${b()}Features:
✅ Fuzzy search (handles typos)
✅ Conversation memory
✅ Multiple languages (English & Arabic)

Just start chatting naturally!`;

    await ctx.reply(helpMsg.text, {
      entities: helpMsg.entities,
    });
  });

  // Handle /recent command - quick access to recent transactions
  bot.command('recent', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:recent', { userId });

    try {
      await ctx.replyWithChatAction('typing');

      // Fetch recent transactions
      const transactions = await searchTransactionsSQL({
        userId,
        limit: 10,
      });

      if (transactions.length === 0) {
        await ctx.reply(
          '📋 *Recent Transactions*\n\n' +
            'No transactions found. Start tracking your expenses!\n\n' +
            'Try saying: "I spent 50 AED at Carrefour"',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Format transactions with IDs
      const transactionLines = transactions.map((tx, index) => {
        const emoji = getCategoryEmoji(tx.category);
        return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [ID: ${tx.id}]`;
      });

      const messageText = '📋 *Recent Transactions*\n\n' + transactionLines.join('\n');

      // Generate inline keyboards for each transaction
      const keyboard = {
        inline_keyboard: transactions.map((tx) => [
          { text: 'Edit', callback_data: `edit_${tx.id}` },
          { text: 'Delete', callback_data: `delete_${tx.id}` },
        ]),
      };

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('command:recent:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply("❌ Sorry, I couldn't fetch your recent transactions. Please try again.", {
        parse_mode: 'Markdown',
      });
    }
  });

  // Handle /menu command - show inline menu
  bot.command('menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:menu', { userId });

    const menuKeyboard = {
      inline_keyboard: [
        [{ text: '📋 Recent Transactions', callback_data: 'menu_recent_transactions' }],
        [{ text: '💰 Add Transaction', callback_data: 'menu_add_transaction' }],
        [{ text: '📊 View Reports', callback_data: 'menu_reports' }],
        [{ text: '❓ Help', callback_data: 'menu_help' }],
      ],
    };

    const menuMsg = fmt`📱 ${b()}HilmAI Menu

Select an option from the menu below:`;

    await ctx.reply(menuMsg.text, {
      entities: menuMsg.entities,
      reply_markup: menuKeyboard,
    });
  });

  // Handle /clear command (clear cache for user)
  bot.command('clear', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const deleted = await AgentResponseCache.clearUser(userId);
      logger.info('command:clear', { userId, deleted });
      await ctx.reply(`✅ Cleared ${deleted} cached responses.`);
    }
  });

  // Handle /mode command (show mode selection)
  bot.command('mode', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:mode', { userId });

    try {
      const currentMode = await getUserMode(userId);

      const keyboard = {
        inline_keyboard: [
          [{ text: '💰 Logger Mode', callback_data: 'set_mode_logger' }],
          [{ text: '💬 Chat Mode', callback_data: 'set_mode_chat' }],
          [{ text: '📊 Query Mode', callback_data: 'set_mode_query' }],
        ],
      };

      const modeMessage = fmt`🎯 ${b()}Current Mode: ${getModeDescription(currentMode)}

Select a mode:

💰 ${b()}Logger Mode
Fast transaction logging (no conversation memory)
Best for: I spent 50 AED at Carrefour

💬 ${b()}Chat Mode
General conversation and help (default)
Best for: Questions, help, onboarding

📊 ${b()}Query Mode
Ask about your spending (minimal memory)
Best for: How much on groceries?

💡 ${b()}Quick switch commands:
/mode_logger - Switch to Logger Mode
/mode_chat - Switch to Chat Mode
/mode_query - Switch to Query Mode`;

      await ctx.reply(modeMessage.text, {
        entities: modeMessage.entities,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('command:mode:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to fetch your current mode. Please try again.');
    }
  });

  // Handle /mode_logger command (quick switch to logger mode)
  bot.command('mode_logger', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:mode_logger', { userId });

    try {
      await setUserMode(userId, 'logger');
      const loggerMsg = fmt`✅ ${b()}Switched to Logger Mode

💰 Fast transaction logging is now active.

${b()}How to use:
• Type: "I spent 50 AED at Carrefour"
• Send a voice message
• Send a receipt photo

Use /mode to switch modes.`;
      await ctx.reply(loggerMsg.text, {
        entities: loggerMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_logger:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to switch mode. Please try again.');
    }
  });

  // Handle /mode_chat command (quick switch to chat mode)
  bot.command('mode_chat', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:mode_chat', { userId });

    try {
      await setUserMode(userId, 'chat');
      const chatMsg = fmt`✅ ${b()}Switched to Chat Mode

💬 General conversation and help is now active.

${b()}I can help you:
• Learn how to use HilmAI
• Answer questions
• Guide you to the right mode

Use /mode to switch modes.`;
      await ctx.reply(chatMsg.text, {
        entities: chatMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_chat:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to switch mode. Please try again.');
    }
  });

  // Handle /mode_query command (quick switch to query mode)
  bot.command('mode_query', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:mode_query', { userId });

    try {
      await setUserMode(userId, 'query');
      const queryMsg = fmt`✅ ${b()}Switched to Query Mode

📊 Ask questions about your spending.

${b()}Examples:
• "How much on groceries?"
• "Show my spending this week"
• "Top 5 expenses this month"

Use /mode to switch modes.`;
      await ctx.reply(queryMsg.text, {
        entities: queryMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_query:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to switch mode. Please try again.');
    }
  });

  // Handle /currency command (set default currency)
  bot.command('currency', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('command:currency', { userId });

    // Get command arguments
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    const currencyArg = args[0]?.trim();

    // If no argument provided, show current default currency
    if (!currencyArg) {
      try {
        const currentCurrency = await getUserDefaultCurrency(userId);
        await ctx.reply(
          `💱 *Your Default Currency*\n\n` +
            `Current: *${currentCurrency}*\n\n` +
            `To change your default currency, use:\n` +
            `/currency <code>\n\n` +
            `Examples:\n` +
            `• /currency AED (UAE Dirham)\n` +
            `• /currency USD (US Dollar)\n` +
            `• /currency EUR (Euro)\n` +
            `• /currency EGP (Egyptian Pound)\n` +
            `• /currency SAR (Saudi Riyal)\n` +
            `• /currency VND (Vietnamese Dong)\n\n` +
            `We support 50+ major currencies worldwide.\n` +
            `All your transactions will be reported in ${currentCurrency}.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        logger.error('command:currency:fetch_error', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply('❌ Failed to fetch your current currency. Please try again.');
      }
      return;
    }

    // Validate and normalize currency code
    const normalized = normalizeCurrency(currencyArg);
    if (!normalized || !isValidCurrency(currencyArg)) {
      await ctx.reply(
        `❌ Invalid currency code: *${currencyArg}*\n\n` +
          `Please use a valid ISO currency code like:\n` +
          `• AED (UAE Dirham)\n` +
          `• USD (US Dollar)\n` +
          `• EUR (Euro)\n` +
          `• GBP (British Pound)\n` +
          `• SAR (Saudi Riyal)\n` +
          `• EGP (Egyptian Pound)\n` +
          `• VND (Vietnamese Dong)\n` +
          `• INR (Indian Rupee)\n\n` +
          `We support 50+ currencies. Use /currency to see your current default.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Update user's default currency
    try {
      const success = await updateUserDefaultCurrency(userId, normalized);

      if (success) {
        logger.info('command:currency:updated', { userId, currency: normalized });
        await ctx.reply(
          `✅ *Default Currency Updated*\n\n` +
            `Your default currency is now: *${normalized}*\n\n` +
            `All your transactions will be reported in ${normalized}. ` +
            `Transactions in other currencies will be automatically converted.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      logger.error('command:currency:update_error', {
        userId,
        currency: normalized,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply('❌ Failed to update your default currency. Please try again.', {
        parse_mode: 'Markdown',
      });
    }
  });

  // Main message handler - ultra-simple using message-processing workflow
  bot.on('message', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const userId = ctx.from?.id;
    ctx.message.chat.id;
    if (!userId) {
      logger.warn('message:no_user_id');
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    logger.info('message:received', {
      userId,
      hasText: Boolean(ctx.message?.text),
      hasVoice: Boolean(ctx.message?.voice),
      hasPhoto: Boolean(ctx.message?.photo),
    });

    let processingMessageId: number | undefined;

    try {
      // Step 1: Prepare workflow input from Grammy context
      logger.info('message:preparing_workflow_input', { userId });

      const workflowInput: any = {
        userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        messageId: ctx.message!.message_id,
      };

      // Handle text
      if (ctx.message?.text) {
        workflowInput.messageText = ctx.message.text;
      }

      // Handle voice
      if (ctx.message?.voice) {
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.api.getFile(fileId);

        if (!file.file_path) {
          throw new Error('Failed to get voice file path');
        }

        const tempFilePath = getTempFilePath('voice', 'ogg');
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        await downloadFile(fileUrl, tempFilePath);
        workflowInput.voiceFilePath = tempFilePath;
      }

      // Handle photo
      if (ctx.message?.photo && ctx.message.photo.length > 0) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = photo.file_id;
        const file = await ctx.api.getFile(fileId);

        if (!file.file_path) {
          throw new Error('Failed to get photo file path');
        }

        const tempFilePath = getTempFilePath('photo', 'jpg');
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        await downloadFile(fileUrl, tempFilePath);
        workflowInput.photoFilePath = tempFilePath;
      }

      logger.debug('message:workflow_input_prepared', { userId });

      // Step 2: Send "Processing..." message for better perceived latency
      const processingMessage = await ctx.reply('⏳ Processing...', {
        parse_mode: 'Markdown',
      });
      processingMessageId = processingMessage.message_id;

      // Step 3: Run message-processing workflow (handles ALL processing)
      logger.info('message:running_workflow', { userId });

      const workflow = mastra.getWorkflow('message-processing');
      const run = await workflow.createRunAsync();
      const workflowResult = await run.start({ inputData: workflowInput });

      if (workflowResult.status === 'failed') {
        // Delete processing message and send error
        await ctx.api.deleteMessage(ctx.chat.id, processingMessageId).catch(() => {
          // Ignore errors if message already deleted or not found
        });
        throw workflowResult.error;
      }

      if (workflowResult.status !== 'success') {
        // Delete processing message and send error
        await ctx.api.deleteMessage(ctx.chat.id, processingMessageId).catch(() => {
          // Ignore errors if message already deleted or not found
        });
        throw new Error(`Workflow did not complete successfully: ${workflowResult.status}`);
      }

      const { response, metadata, telegramMarkup } = workflowResult.result;

      logger.info('message:workflow_completed', {
        userId,
        inputType: metadata.inputType,
        cached: metadata.cached,
        hasMarkup: Boolean(telegramMarkup),
      });

      // Step 4: Update processing message with final response
      const replyOptions: any = { parse_mode: 'Markdown' };
      if (telegramMarkup) {
        replyOptions.reply_markup = telegramMarkup;
      }

      try {
        // Try to edit the processing message with the final response
        await ctx.api.editMessageText(ctx.chat.id, processingMessageId, response, replyOptions);

        logger.info('message:updated', { userId, messageId: processingMessageId });
      } catch (editError) {
        // If editing fails (e.g., message too long or format issue), send new message
        logger.warn('message:edit_failed', {
          userId,
          error: editError instanceof Error ? editError.message : String(editError),
        });

        // Delete processing message
        await ctx.api.deleteMessage(ctx.chat.id, processingMessageId).catch(() => {
          // Ignore errors
        });

        // Send final response as new message
        await ctx.reply(response, replyOptions);
        logger.info('message:sent_new', { userId });
      }
    } catch (error) {
      logger.error('message:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Clean up processing message if it exists
      if (processingMessageId !== undefined) {
        await ctx.api.deleteMessage(ctx.chat.id, processingMessageId).catch(() => {
          // Ignore errors if message already deleted or not found
        });
      }

      // User-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Unsupported message type')) {
        await ctx.reply('❌ Sorry, I can only process text messages, voice messages, and photos.');
      } else if (errorMessage.includes('transcribe')) {
        await ctx.reply(
          '❌ Sorry, I had trouble transcribing your voice message. Please try again.'
        );
      } else if (errorMessage.includes('extract')) {
        await ctx.reply(
          "❌ Sorry, I couldn't read that image clearly. Please try a clearer photo."
        );
      } else {
        await ctx.reply('❌ Sorry, something went wrong. Please try again in a moment.');
      }
    }
  });

  // Handle mode switch callback queries
  bot.callbackQuery(/^set_mode_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery('❌ Unable to identify user.');
      return;
    }

    logger.info('callback:set_mode', { userId, callbackData });

    const modeStr = callbackData.replace('set_mode_', '');

    if (!isValidMode(modeStr)) {
      await ctx.answerCallbackQuery('❌ Invalid mode.');
      return;
    }

    const mode = modeStr as UserMode;

    try {
      await setUserMode(userId, mode);

      await ctx.answerCallbackQuery(`✅ Switched to ${getModeDescription(mode)}`);

      await ctx.editMessageText(`✅ *Mode Changed*\n\n${getModeInstructions(mode)}`, {
        parse_mode: 'Markdown',
      });

      logger.info('callback:set_mode:success', { userId, mode });
    } catch (error) {
      logger.error('callback:set_mode:error', {
        userId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery('❌ Failed to switch mode.');
    }
  });

  // Handle menu callback queries
  bot.callbackQuery(/^menu_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery('❌ Unable to identify user.');
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
          await ctx.editMessageText(
            '📋 *Recent Transactions*\n\n' + 'No transactions found. Start tracking your expenses!',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Format transactions with IDs
        const transactionLines = transactions.map((tx, index) => {
          const emoji = getCategoryEmoji(tx.category);
          return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [ID: ${tx.id}]`;
        });

        const messageText = '📋 *Recent Transactions*\n\n' + transactionLines.join('\n');

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
        await ctx.editMessageText(
          "❌ Sorry, I couldn't fetch your recent transactions. Please try again.",
          { parse_mode: 'Markdown' }
        );
      }
    } else if (callbackData === 'menu_add_transaction') {
      await ctx.editMessageText(
        '💰 *Add Transaction*\n\n' +
          'You can add a transaction by:\n' +
          '• Typing: "I spent 50 AED at Carrefour"\n' +
          '• Sending a voice message\n' +
          '• Sending a receipt photo\n\n' +
          'Just send your transaction details!',
        { parse_mode: 'Markdown' }
      );
    } else if (callbackData === 'menu_reports') {
      await ctx.editMessageText(
        '📊 *View Reports*\n\n' +
          'Ask me questions like:\n' +
          '• "How much did I spend this month?"\n' +
          '• "Show my spending by category"\n' +
          '• "Total expenses this week"\n\n' +
          'What would you like to know?',
        { parse_mode: 'Markdown' }
      );
    } else if (callbackData === 'menu_help') {
      await ctx.editMessageText(
        '*HilmAI Help*\n\n' +
          '*Track Expenses:*\n' +
          '• Type: "I spent 50 AED at Starbucks"\n' +
          '• Voice: Send a voice message\n' +
          '• Photo: Send a receipt photo\n\n' +
          '*Ask Questions:*\n' +
          '• "How much did I spend on groceries?"\n' +
          '• "Show my Starbucks spending"\n' +
          '• "Total expenses this month"\n\n' +
          '*Commands:*\n' +
          '• /menu - Show this menu\n' +
          '• /help - Detailed help\n' +
          '• /start - Welcome message\n\n' +
          'Just start chatting naturally!',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Helper function to get emoji for category
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

  // Handle callback queries (inline keyboard button clicks)
  bot.callbackQuery(/^(edit_|delete_)/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      logger.warn('callback:no_user_id');
      await ctx.answerCallbackQuery('❌ Unable to identify user.');
      return;
    }

    logger.info('callback:received', {
      userId,
      callbackData,
    });

    try {
      // Parse callback data
      const [action, transactionIdStr] = callbackData.split('_');
      const transactionId = parseInt(transactionIdStr, 10);

      if (!transactionId || isNaN(transactionId)) {
        throw new Error(`Invalid transaction ID: ${transactionIdStr}`);
      }

      // Build context prompt for transaction manager agent
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const userMetadata = {
        userId,
        telegramChatId: userId,
        username: ctx.from?.username ?? null,
        firstName: ctx.from?.first_name ?? null,
        lastName: ctx.from?.last_name ?? null,
        messageId: ctx.callbackQuery.message?.message_id ?? 0,
      };

      const contextPrompt = [
        `[Current Date: Today is ${currentDate}, Yesterday was ${yesterdayStr}]`,
        `[User: ${ctx.from?.first_name || 'Unknown'} (@${ctx.from?.username || 'unknown'})]`,
        `[User ID: ${userId}]`,
        `[Message ID: ${ctx.callbackQuery.message?.message_id ?? 0}]`,
        `[User Metadata JSON: ${JSON.stringify(userMetadata)}]`,
        `[Message Type: callback]`,
        '',
        `User clicked "${action}" button for transaction ID ${transactionId}.`,
        action === 'edit'
          ? 'Wait for user to provide new transaction details, then update the transaction.'
          : 'Delete this transaction immediately and confirm the deletion.',
      ].join('\n');

      // Get transaction manager agent
      const transactionManagerAgent = mastra.getAgent('transactionManager');
      if (!transactionManagerAgent) {
        throw new Error('Transaction manager agent is not registered');
      }

      // Acknowledge callback query
      await ctx.answerCallbackQuery();

      // For delete, execute immediately
      if (action === 'delete') {
        const generation = await transactionManagerAgent.generate(contextPrompt, {
          memory: {
            thread: `user-${userId}`,
            resource: userId.toString(),
          },
        });

        const response = generation.text ?? 'Transaction deleted successfully.';

        // Edit the original message to show deletion confirmation
        if (ctx.callbackQuery.message) {
          await ctx.editMessageText(response, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(response, { parse_mode: 'Markdown' });
        }

        logger.info('callback:delete_completed', { userId, transactionId });
      } else {
        // For edit, prompt user for changes
        const promptMessage =
          `Editing transaction **${transactionId}**.\n\n` +
          `What would you like to change?\n\n` +
          `You can update:\n` +
          `• Amount (e.g., "Change amount to 45 AED")\n` +
          `• Merchant (e.g., "Update merchant to Carrefour")\n` +
          `• Category (e.g., "Set category to Groceries")\n` +
          `• Description (e.g., "Add description: Weekly groceries")\n` +
          `• Date (e.g., "Change date to yesterday")\n\n` +
          `Or say "cancel" to cancel.`;

        await ctx.reply(promptMessage, { parse_mode: 'Markdown' });

        // The transaction manager agent will handle the edit when user responds
        // Transaction ID is included in the prompt message for context
        logger.info('callback:edit_prompted', { userId, transactionId });
      }
    } catch (error) {
      logger.error('callback:error', {
        userId,
        callbackData,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await ctx.answerCallbackQuery('❌ An error occurred. Please try again.');
      await ctx.reply('❌ Sorry, something went wrong processing your request. Please try again.', {
        parse_mode: 'Markdown',
      });
    }
  });

  // Error handler for bot-level errors
  bot.catch((err) => {
    logger.error('bot:error', {
      error: err.error instanceof Error ? err.error.message : String(err.error),
      ctx: err.ctx,
    });
  });

  return bot;
}
