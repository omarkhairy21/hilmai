import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { downloadFile, getTempFilePath } from '../../lib/file-utils';
import { hasActiveAccess, getUserTimezone } from '../../services/user.service';
import { createProgressController, type ProgressStage } from '../../services/progress.service';
import { getUserMode, type UserMode } from '../../lib/user-mode';
import { messages } from '../../lib/messages';

/**
 * Runtime context type for progress emitter
 */
type ProgressContext = {
  progressEmitter: (stage: ProgressStage) => void;
};

/**
 * Register the main message handler (text, voice, photo messages)
 * This handler processes all non-command messages through the message-processing workflow
 */
export function registerMessageHandler(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
  }

  // Main message handler - ultra-simple using message-processing workflow
  bot.on('message', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const userId = ctx.from?.id;
    if (!userId) {
      logger.warn('message:no_user_id');
      await ctx.reply(messages.errors.noUser());
      return;
    }

    // Check subscription access
    const hasAccess = await hasActiveAccess(userId);
    if (!hasAccess) {
      logger.info('message:access_denied', {
        userId,
        // Telemetry: Track trial expiration and conversion opportunities
        event: 'access_denied',
        reason: 'trial_expired_or_no_subscription',
        conversionOpportunity: 'subscribe_prompt_shown',
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '💳 Subscribe Now', callback_data: 'subscribe_monthly_notrial' }],
        ],
      };

      await ctx.reply(messages.subscription.accessDenied(), {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
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

      const userTimezone = await getUserTimezone(userId);

      const workflowInput: any = {
        userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        messageId: ctx.message!.message_id,
        timezone: userTimezone,
      };

      // Handle text
      if (ctx.message?.text) {
        const trimmedText = ctx.message.text.trim();
        if (trimmedText.length > 0) {
          workflowInput.messageText = trimmedText;
        }
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

      const hasSupportedInput =
        Boolean(workflowInput.messageText) ||
        Boolean(workflowInput.voiceFilePath) ||
        Boolean(workflowInput.photoFilePath);

      if (!hasSupportedInput) {
        logger.warn('message:unsupported_type', {
          userId,
          messageKeys: Object.keys(ctx.message ?? {}),
        });
        await ctx.reply(messages.errors.unsupportedType());
        return;
      }

      logger.debug('message:workflow_input_prepared', { userId });

      // Step 2: Fetch user mode to show mode-specific progress
      let userMode: UserMode = 'chat'; // default
      try {
        userMode = await getUserMode(userId);
      } catch (error) {
        logger.warn('message:user_mode_fetch_failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Step 3: Send initial mode-specific "Processing..." message
      const processingMessage = await ctx.reply(messages.processingByMode[userMode].start, {
        parse_mode: 'Markdown',
      });
      processingMessageId = processingMessage.message_id;

      // Step 4: Create progress controller with mode-specific messages
      const progress = createProgressController(
        ctx.api,
        ctx.chat.id,
        processingMessageId,
        userMode,
        logger,
        userId
      );

      // Step 5: Set up runtime context with progress emitter
      const runtimeContext = new RuntimeContext<ProgressContext>();
      runtimeContext.set('progressEmitter', progress.emit);

      // Step 6: Run message-processing workflow with progress tracking (with step numbers adjusted)
      logger.info('message:running_workflow', { userId, userMode });

      const workflow = mastra.getWorkflow('message-processing');
      const run = await workflow.createRunAsync();

      /**
       * Watch for step completions and update progress message
       * Progress stages vary by mode and input type:
       * - Logger: Processing input → [Transcribing/Reading receipt] → Categorizing → Converting currency → Saving → Logged
       * - Query: Analyzing query → [Transcribing/Reading image] → Searching → Processing → Generating insights → Results ready
       * - Chat: Processing message → [Transcribing/Reading image] → Understanding context → Preparing response → Thinking → Ready
       */
      run.watchAsync(async (event: any) => {
        // Skip if workflow already completed
        if (!progress.isActive()) {
          return;
        }

        const stepId = event?.payload?.currentStep?.id;
        if (!stepId) return;

        // Map workflow step IDs to progress stages based on user mode
        // Input processing phase - determine type
        if (stepId === 'determine-input-type' || stepId === 'pass-text') {
          progress.emit('start');
          return;
        }

        // Voice transcription phase
        if (stepId === 'transcribe-voice') {
          progress.emit('transcribing');
          return;
        }

        // Photo/receipt extraction phase
        if (stepId === 'extract-from-photo') {
          progress.emit('extracting');
          return;
        }

        // Context building phase (interpretation/searching)
        if (stepId === 'unwrap-processed-input' || stepId === 'build-context-prompt') {
          progress.emit('categorized');
          return;
        }

        // Cache/mode check phase (silent, no update needed)
        if (stepId === 'fetch-user-mode' || stepId === 'check-cache') {
          return;
        }

        // Agent processing phase (main work)
        if (
          stepId === 'invoke-logger-agent' ||
          stepId === 'invoke-query-agent' ||
          stepId === 'invoke-chat-agent'
        ) {
          progress.emit('saving');
          return;
        }

        // Finalization phase
        if (
          stepId === 'unwrap-agent-response' ||
          stepId === 'cache-response' ||
          stepId === 'cleanup-router' ||
          stepId === 'cleanup-files'
        ) {
          progress.emit('finalizing');
          return;
        }
      }, 'watch');

      // Start workflow with runtime context
      const workflowResult = await run.start({
        inputData: workflowInput,
        runtimeContext,
      });

      // Mark progress as complete immediately to prevent watcher from sending more updates
      await progress.complete();

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
        userMode,
        inputType: metadata.inputType,
        cached: metadata.cached,
        hasMarkup: Boolean(telegramMarkup),
        response: JSON.stringify(response, null, 2),
      });

      // Step 7: Update processing message with final response
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
}
