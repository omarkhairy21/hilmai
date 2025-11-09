import { Bot, type Api } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { downloadFile, getTempFilePath } from './lib/file-utils';
import { AgentResponseCache } from './lib/prompt-cache';
import { searchTransactionsSQL } from './lib/embeddings';
import { createOrGetUser } from './services/user.service';
import { createProgressController, type ProgressStage } from './services/progress.service';
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
  getModeInstructions,
  isValidMode,
  type UserMode,
} from './lib/user-mode';
import { messages } from './lib/messages';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
}

/**
 * Runtime context type for progress emitter
 */
type ProgressContext = {
  progressEmitter: (stage: ProgressStage) => void;
};

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
      await ctx.reply(messages.errors.noUser());
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

      const welcomeMessage = messages.start.welcome();

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
      await ctx.reply(messages.start.fallback(), { parse_mode: 'Markdown' });
    }
  });

  // Handle /help command
  bot.command('help', async (ctx) => {
    logger.info('command:help', { userId: ctx.from?.id });

    const helpMsg = messages.help.main();

    await ctx.reply(helpMsg.text, {
      entities: helpMsg.entities,
    });
  });

  // Handle /recent command - quick access to recent transactions
  bot.command('recent', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
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
        await ctx.reply(messages.recent.empty(), { parse_mode: 'Markdown' });
        return;
      }

      // Format transactions with IDs
      const transactionLines = transactions.map((tx, index) => {
        const emoji = getCategoryEmoji(tx.category);
        return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [ID: ${tx.id}]`;
      });

      const messageText = messages.recent.header() + '\n\n' + transactionLines.join('\n');

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
      await ctx.reply(messages.recent.fetchFailed(), { parse_mode: 'Markdown' });
    }
  });

  // Handle /menu command - show inline menu
  bot.command('menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
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

    const menuMsg = messages.menu.header();

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
      await ctx.reply(messages.success.cacheCleared(deleted));
    }
  });

  // Handle /mode command (show mode selection)
  bot.command('mode', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
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

      const modeMessage = messages.mode.current(getModeDescription(currentMode));

      await ctx.reply(modeMessage.text, {
        entities: modeMessage.entities,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error('command:mode:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.fetchModeFailed());
    }
  });

  // Handle /mode_logger command (quick switch to logger mode)
  bot.command('mode_logger', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_logger', { userId });

    try {
      await setUserMode(userId, 'logger');
      const loggerMsg = messages.mode.switchedToLogger();
      await ctx.reply(loggerMsg.text, {
        entities: loggerMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_logger:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });

  // Handle /mode_chat command (quick switch to chat mode)
  bot.command('mode_chat', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_chat', { userId });

    try {
      await setUserMode(userId, 'chat');
      const chatMsg = messages.mode.switchedToChat();
      await ctx.reply(chatMsg.text, {
        entities: chatMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_chat:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });

  // Handle /mode_query command (quick switch to query mode)
  bot.command('mode_query', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info('command:mode_query', { userId });

    try {
      await setUserMode(userId, 'query');
      const queryMsg = messages.mode.switchedToQuery();
      await ctx.reply(queryMsg.text, {
        entities: queryMsg.entities,
      });
    } catch (error) {
      logger.error('command:mode_query:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.modeSwitchFailed());
    }
  });

  // Handle /currency command (set default currency)
  bot.command('currency', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
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
        await ctx.reply(messages.currency.current(currentCurrency), { parse_mode: 'Markdown' });
      } catch (error) {
        logger.error('command:currency:fetch_error', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply(messages.currency.fetchFailed());
      }
      return;
    }

    // Validate and normalize currency code
    const normalized = normalizeCurrency(currencyArg);
    if (!normalized || !isValidCurrency(currencyArg)) {
      await ctx.reply(messages.currency.invalidCode(currencyArg), { parse_mode: 'Markdown' });
      return;
    }

    // Update user's default currency
    try {
      const success = await updateUserDefaultCurrency(userId, normalized);

      if (success) {
        logger.info('command:currency:updated', { userId, currency: normalized });
        await ctx.reply(messages.currency.updateSuccess(normalized), { parse_mode: 'Markdown' });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      logger.error('command:currency:update_error', {
        userId,
        currency: normalized,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.currency.updateFailed(), { parse_mode: 'Markdown' });
    }
  });

  // Main message handler - ultra-simple using message-processing workflow
  bot.on('message', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const userId = ctx.from?.id;
    ctx.message.chat.id;
    if (!userId) {
      logger.warn('message:no_user_id');
      await ctx.reply(messages.errors.noUser());
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

      // Step 2: Send initial "Processing..." message
      const processingMessage = await ctx.reply(messages.processing.start(), {
        parse_mode: 'Markdown',
      });
      processingMessageId = processingMessage.message_id;

      // Step 3: Create progress controller for stage-by-stage updates
      const stageMessages = {
        start: messages.processing.start(),
        categorized: messages.processing.categorized(),
        currencyConversion: messages.processing.currencyConversion(),
        saving: messages.processing.saving(),
        finalizing: messages.processing.finalizing(),
      };

      const progress = createProgressController(
        ctx.api,
        ctx.chat.id,
        processingMessageId,
        stageMessages,
        logger,
        userId
      );

      // Step 4: Set up runtime context with progress emitter
      const runtimeContext = new RuntimeContext<ProgressContext>();
      runtimeContext.set('progressEmitter', progress.emit);

      // Step 5: Run message-processing workflow with progress tracking
      logger.info('message:running_workflow', { userId });

      const workflow = mastra.getWorkflow('message-processing');
      const run = await workflow.createRunAsync();

      /**
       * Watch for step completions and update progress message
       * Stops automatically when workflow completes or fails
       */
      run.watch((event: any) => {
        // Skip if workflow already completed
        if (!progress.isActive()) {
          return;
        }

        const stepId = event?.payload?.currentStep?.id;
        if (!stepId) return;

        // Map workflow step IDs to progress stages
        switch (stepId) {
          case 'determine-input-type':
          case 'transcribe-voice':
          case 'extract-from-photo':
          case 'pass-text':
            progress.emit('start');
            break;

          case 'unwrap-processed-input':
          case 'build-context-prompt':
            progress.emit('categorized');
            break;

          case 'fetch-user-mode':
          case 'check-cache':
            // Keep current stage
            break;

          case 'invoke-logger-agent':
          case 'invoke-query-agent':
          case 'invoke-chat-agent':
            progress.emit('saving');
            break;

          case 'unwrap-agent-response':
          case 'cache-response':
          case 'cleanup-router':
            progress.emit('finalizing');
            break;

          case 'cleanup-files':
            progress.emit('finalizing');
            break;
        }
      }, 'watch');

      // Start workflow with runtime context
      const workflowResult = await run.start({
        inputData: workflowInput,
        runtimeContext,
      });

      // Mark progress as complete immediately to prevent watcher from sending more updates
      progress.complete();

      if (workflowResult.status === 'failed') {
        // Delete processing message and send error
        await progress.fail();
        throw workflowResult.error;
      }

      if (workflowResult.status !== 'success') {
        // Delete processing message and send error
        await progress.fail();
        throw new Error(`Workflow did not complete successfully: ${workflowResult.status}`);
      }

      const { response, metadata, telegramMarkup } = workflowResult.result;

      logger.info('message:workflow_completed', {
        userId,
        inputType: metadata.inputType,
        cached: metadata.cached,
        hasMarkup: Boolean(telegramMarkup),
      });

      // Step 6: Update processing message with final response
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
        await ctx.reply(messages.errors.unsupportedType());
      } else if (errorMessage.includes('transcribe')) {
        await ctx.reply(messages.errors.transcribeFailed());
      } else if (errorMessage.includes('extract')) {
        await ctx.reply(messages.errors.extractFailed());
      } else {
        await ctx.reply(messages.errors.generic());
      }
    }
  });

  // Handle mode switch callback queries
  bot.callbackQuery(/^set_mode_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
      return;
    }

    logger.info('callback:set_mode', { userId, callbackData });

    const modeStr = callbackData.replace('set_mode_', '');

    if (!isValidMode(modeStr)) {
      await ctx.answerCallbackQuery(messages.errors.invalidMode());
      return;
    }

    const mode = modeStr as UserMode;

    try {
      await setUserMode(userId, mode);

      await ctx.answerCallbackQuery(`✅ Switched to ${getModeDescription(mode)}`);

      const changeMsg = messages.mode.changed(getModeInstructions(mode));
      await ctx.editMessageText(changeMsg.text, {
        parse_mode: 'Markdown',
        entities: changeMsg.entities,
      });

      logger.info('callback:set_mode:success', { userId, mode });
    } catch (error) {
      logger.error('callback:set_mode:error', {
        userId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.answerCallbackQuery(messages.errors.modeSwitchFailed());
    }
  });

  // Handle menu callback queries
  bot.callbackQuery(/^menu_/, async (ctx) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery.data;

    if (!userId) {
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
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
          await ctx.editMessageText(messages.recent.empty(), { parse_mode: 'Markdown' });
          return;
        }

        // Format transactions with IDs
        const transactionLines = transactions.map((tx, index) => {
          const emoji = getCategoryEmoji(tx.category);
          return `${index + 1}. ${emoji} ${tx.merchant} - ${tx.amount} ${tx.currency} (${tx.transaction_date}) [ID: ${tx.id}]`;
        });

        const messageText = messages.recent.header() + '\n\n' + transactionLines.join('\n');

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
        await ctx.editMessageText(messages.recent.fetchFailed(), { parse_mode: 'Markdown' });
      }
    } else if (callbackData === 'menu_add_transaction') {
      await ctx.editMessageText(messages.menu.addTransaction(), { parse_mode: 'Markdown' });
    } else if (callbackData === 'menu_reports') {
      await ctx.editMessageText(messages.menu.reports(), { parse_mode: 'Markdown' });
    } else if (callbackData === 'menu_help') {
      await ctx.editMessageText(messages.menu.help(), { parse_mode: 'Markdown' });
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
      await ctx.answerCallbackQuery(messages.callbacks.noUser());
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
        await ctx.reply(messages.callbacks.editPrompt(transactionId), { parse_mode: 'Markdown' });

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

      await ctx.answerCallbackQuery(messages.callbacks.error());
      await ctx.reply(messages.callbacks.genericError(), { parse_mode: 'Markdown' });
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
