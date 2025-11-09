import { type Api } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import type { UserMode } from '../lib/user-mode';
import { messages } from '../lib/messages';

/**
 * Progress stages for workflow execution feedback
 */
export type ProgressStage =
  | 'start'
  | 'transcribing'
  | 'extracting'
  | 'categorized'
  | 'currencyConversion'
  | 'saving'
  | 'finalizing';

/**
 * Progress controller interface for managing Telegram message updates
 */
export interface ProgressController {
  update: (stage: ProgressStage) => Promise<void>;
  complete: () => void;
  fail: () => Promise<void>;
  emit: (stage: ProgressStage) => void;
  isActive: () => boolean;
}

/**
 * Stage messages mapping
 */
interface StageMessages {
  start: string;
  transcribing: string;
  extracting: string;
  categorized: string;
  currencyConversion: string;
  saving: string;
  finalizing: string;
}

/**
 * Get mode-specific stage messages
 */
function getModeSpecificMessages(mode: UserMode): StageMessages {
  const modeMessages = messages.processingByMode[mode];
  return {
    start: modeMessages.start,
    transcribing: modeMessages.transcribing,
    extracting: modeMessages.extracting,
    categorized: modeMessages.categorized,
    currencyConversion: modeMessages.currencyConversion,
    saving: modeMessages.saving,
    finalizing: modeMessages.finalizing,
  };
}

/**
 * Creates a progress controller for managing Telegram message updates during workflow execution
 *
 * Key features:
 * - Prevents overlapping editMessageText() calls with isUpdating flag
 * - Stops updating once workflow completes (isCompleted flag)
 * - Skips redundant updates for same stage
 * - Non-blocking emit() for watch callbacks
 * - Uses mode-specific progress messages
 *
 * @param api - Grammy Bot API instance
 * @param chatId - Telegram chat ID
 * @param messageId - Telegram message ID to edit
 * @param mode - User's current mode (logger/chat/query)
 * @param logger - Mastra logger instance
 * @param userId - User ID for logging
 * @returns ProgressController instance
 */
export function createProgressController(
  api: Api,
  chatId: number,
  messageId: number,
  mode: UserMode,
  logger: ReturnType<Mastra['getLogger']>,
  userId: number
): ProgressController {
  const stageMessages = getModeSpecificMessages(mode);
  let currentStage: ProgressStage | null = null;
  let isCompleted = false;
  let isUpdating = false;

  /**
   * Update the progress message with the given stage
   */
  const update = async (stage: ProgressStage): Promise<void> => {
    // Skip if workflow is complete
    if (isCompleted) {
      return;
    }

    // Skip if already at this stage
    if (currentStage === stage) {
      return;
    }

    // Skip if another update is in progress
    if (isUpdating) {
      return;
    }

    isUpdating = true;
    currentStage = stage;
    const messageText = stageMessages[stage];

    try {
      await api.editMessageText(chatId, messageId, messageText, {
        parse_mode: 'Markdown',
      });

      logger.info('progress:update', {
        userId,
        stage,
        messageId,
      });
    } catch (error) {
      logger.debug('progress:update_failed', {
        userId,
        stage,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isUpdating = false;
    }
  };

  /**
   * Mark progress as complete - stops further updates
   */
  const complete = (): void => {
    isCompleted = true;
  };

  /**
   * Mark progress as failed - deletes the progress message
   */
  const fail = async (): Promise<void> => {
    isCompleted = true;
    try {
      await api.deleteMessage(chatId, messageId);
    } catch (error) {
      // Ignore delete errors
    }
  };

  /**
   * Non-blocking emit for watch callbacks
   * Calls update() without blocking the caller
   */
  const emit = (stage: ProgressStage): void => {
    update(stage).catch(() => {
      // Ignore errors in emit
    });
  };

  /**
   * Check if progress controller is still active
   */
  const isActive = (): boolean => !isCompleted;

  return {
    update,
    complete,
    fail,
    emit,
    isActive,
  };
}
