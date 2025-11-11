import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProgressController,
  type ProgressStage,
  type ProgressController,
} from './progress.service';
import { messages } from '../lib/messages';
import type { Api } from 'grammy';

type MockApi = {
  editMessageText: ReturnType<typeof vi.fn>;
  deleteMessage: ReturnType<typeof vi.fn>;
};

type MockLogger = {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

describe('ProgressController', () => {
  let mockApi: MockApi;
  let mockLogger: MockLogger;
  let progressController: ProgressController;
  let stageMessages: Record<ProgressStage, string>;

  const testData = {
    chatId: 123,
    messageId: 456,
    userId: 789,
  };

  beforeEach(() => {
    mockApi = {
      editMessageText: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
    };

    progressController = createProgressController(
      mockApi as unknown as Api,
      testData.chatId,
      testData.messageId,
      'logger',
      mockLogger as unknown as ReturnType<any>,
      testData.userId
    );

    stageMessages = messages.processingByMode.logger;
  });

  describe('update()', () => {
    it('updates message with stage text', async () => {
      await progressController.update('start');

      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.start,
        { parse_mode: 'Markdown' }
      );
    });

    it('logs successful updates', async () => {
      await progressController.update('categorized');

      expect(mockLogger.info).toHaveBeenCalledWith('progress:update', {
        userId: testData.userId,
        stage: 'categorized',
        messageId: testData.messageId,
      });
    });

    it('skips duplicate stages', async () => {
      await progressController.update('start');
      mockApi.editMessageText.mockClear();

      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('skips updates after completion', async () => {
      await progressController.complete();
      mockApi.editMessageText.mockClear();

      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('queues updates sequentially', async () => {
      const callOrder: string[] = [];
      mockApi.editMessageText.mockImplementation(async (_chatId, _messageId, text) => {
        callOrder.push(text as string);
        if (text === stageMessages.start) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      });

      const first = progressController.update('start');
      const second = progressController.update('categorized');

      await Promise.all([first, second]);

      expect(callOrder).toEqual([stageMessages.start, stageMessages.categorized]);
    });

    it('logs errors when edit fails', async () => {
      const testError = new Error('API failed');
      mockApi.editMessageText.mockRejectedValue(testError);

      await progressController.update('saving');

      expect(mockLogger.debug).toHaveBeenCalledWith('progress:update_failed', {
        userId: testData.userId,
        stage: 'saving',
        error: 'API failed',
      });
    });
  });

  describe('emit()', () => {
    it('returns immediately', () => {
      const start = Date.now();
      progressController.emit('start');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('eventually edits the message', async () => {
      progressController.emit('categorized');

      await progressController.waitForIdle();

      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.categorized,
        { parse_mode: 'Markdown' }
      );
    });

    it('swallows edit errors', async () => {
      mockApi.editMessageText.mockRejectedValue(new Error('boom'));

      expect(() => progressController.emit('start')).not.toThrow();
      await progressController.waitForIdle();
    });
  });

  describe('waitForIdle()', () => {
    it('resolves after queued updates', async () => {
      progressController.emit('saving');
      progressController.emit('finalizing');

      await progressController.waitForIdle();

      expect(mockApi.editMessageText).toHaveBeenCalledTimes(2);
    });
  });

  describe('complete()', () => {
    it('prevents further updates', async () => {
      await progressController.complete();
      mockApi.editMessageText.mockClear();

      await progressController.update('start');
      progressController.emit('saving');
      await progressController.waitForIdle();

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('waits for pending updates before resolving', async () => {
      let resolveUpdate: (() => void) | undefined;
      mockApi.editMessageText.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      progressController.emit('finalizing');
      await Promise.resolve();

      const completePromise = progressController.complete();
      expect(progressController.isActive()).toBe(false);
      expect(mockApi.editMessageText).toHaveBeenCalledTimes(1);

      resolveUpdate?.();
      await completePromise;

      mockApi.editMessageText.mockClear();
      progressController.emit('saving');
      await progressController.waitForIdle();

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('fail()', () => {
    it('deletes the progress message', async () => {
      await progressController.fail();

      expect(mockApi.deleteMessage).toHaveBeenCalledWith(testData.chatId, testData.messageId);
    });

    it('waits for pending updates before deleting', async () => {
      let resolveUpdate: (() => void) | undefined;
      mockApi.editMessageText.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      progressController.emit('saving');

      const failPromise = progressController.fail();
      expect(mockApi.deleteMessage).not.toHaveBeenCalled();

      resolveUpdate?.();
      await failPromise;

      expect(mockApi.deleteMessage).toHaveBeenCalledWith(testData.chatId, testData.messageId);
    });

    it('ignores delete errors', async () => {
      mockApi.deleteMessage.mockRejectedValue(new Error('cannot delete'));

      await expect(progressController.fail()).resolves.not.toThrow();
    });
  });

  describe('isActive()', () => {
    it('is true before completion', () => {
      expect(progressController.isActive()).toBe(true);
    });

    it('is false after completion', async () => {
      await progressController.complete();

      expect(progressController.isActive()).toBe(false);
    });

    it('is false after failure', async () => {
      await progressController.fail();

      expect(progressController.isActive()).toBe(false);
    });
  });

  describe('concurrency handling', () => {
    it('processes rapid emits in order', async () => {
      const order: string[] = [];
      mockApi.editMessageText.mockImplementation(async (_chatId, _messageId, text) => {
        order.push(text as string);
      });

      ['start', 'categorized', 'saving', 'finalizing'].forEach((stage) => {
        progressController.emit(stage as ProgressStage);
      });

      await progressController.waitForIdle();

      expect(order).toEqual([
        stageMessages.start,
        stageMessages.categorized,
        stageMessages.saving,
        stageMessages.finalizing,
      ]);
    });

    it('ignores emits after completion', async () => {
      progressController.emit('start');
      await progressController.waitForIdle();
      mockApi.editMessageText.mockClear();

      await progressController.complete();
      progressController.emit('categorized');
      await progressController.waitForIdle();

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('stage transitions', () => {
    it('supports forward progression', async () => {
      const stages: ProgressStage[] = ['start', 'categorized', 'saving', 'finalizing'];

      for (const stage of stages) {
        await progressController.update(stage);
      }

      expect(mockApi.editMessageText).toHaveBeenCalledTimes(stages.length);
    });

    it('supports skipping stages', async () => {
      await progressController.update('start');
      mockApi.editMessageText.mockClear();

      await progressController.update('finalizing');

      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.finalizing,
        { parse_mode: 'Markdown' }
      );
    });

    it('supports moving backwards', async () => {
      await progressController.update('finalizing');
      mockApi.editMessageText.mockClear();

      await progressController.update('start');

      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.start,
        { parse_mode: 'Markdown' }
      );
    });
  });
});
