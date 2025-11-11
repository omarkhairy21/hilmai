import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProgressController,
  type ProgressStage,
  type ProgressController,
} from './progress.service';
import { messages } from '../lib/messages';
import type { Api } from 'grammy';

/**
 * Mock objects for testing
 */
interface MockApi {
  editMessageText: ReturnType<typeof vi.fn>;
  deleteMessage: ReturnType<typeof vi.fn>;
}

interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

/**
 * Test suite for ProgressController
 */
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
    // Reset all mocks before each test
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

    // Use the logger mode messages for testing
    stageMessages = messages.processingByMode.logger;
  });

  describe('update()', () => {
    it('should update message with stage text', async () => {
      await progressController.update('start');

      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.start,
        { parse_mode: 'Markdown' }
      );
    });

    it('should log successful update', async () => {
      await progressController.update('categorized');

      expect(mockLogger.info).toHaveBeenCalledWith('progress:update', {
        userId: testData.userId,
        stage: 'categorized',
        messageId: testData.messageId,
      });
    });

    it('should skip if already at same stage', async () => {
      await progressController.update('start');
      mockApi.editMessageText.mockClear();

      // Try to update to same stage again
      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('should skip if workflow is completed', async () => {
      progressController.complete();
      mockApi.editMessageText.mockClear();

      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('should skip if another update is in progress', async () => {
      // Simulate a slow API call
      mockApi.editMessageText.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Start first update
      const firstUpdate = progressController.update('start');

      // Try to update immediately (while first is in progress)
      await progressController.update('categorized');

      // First update should have been called, but second should not
      expect(mockApi.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.start,
        { parse_mode: 'Markdown' }
      );

      await firstUpdate;
    });

    it('should log errors on API failure', async () => {
      const testError = new Error('API failed');
      mockApi.editMessageText.mockRejectedValue(testError);

      await progressController.update('saving');

      expect(mockLogger.debug).toHaveBeenCalledWith('progress:update_failed', {
        userId: testData.userId,
        stage: 'saving',
        error: 'API failed',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockApi.editMessageText.mockRejectedValue('string error');

      await progressController.update('saving');

      expect(mockLogger.debug).toHaveBeenCalledWith('progress:update_failed', {
        userId: testData.userId,
        stage: 'saving',
        error: 'string error',
      });
    });

    it('should transition through multiple stages', async () => {
      const stages: ProgressStage[] = ['start', 'categorized', 'saving', 'finalizing'];

      for (const stage of stages) {
        await progressController.update(stage);
      }

      expect(mockApi.editMessageText).toHaveBeenCalledTimes(stages.length);

      stages.forEach((stage, index) => {
        const call = mockApi.editMessageText.mock.calls[index];
        expect(call[0]).toBe(testData.chatId);
        expect(call[1]).toBe(testData.messageId);
        expect(call[2]).toBe(stageMessages[stage]);
      });
    });
  });

  describe('emit()', () => {
    it('should call update without blocking', async () => {
      // emit() should return immediately
      const emitStart = Date.now();
      progressController.emit('start');
      const emitDuration = Date.now() - emitStart;

      // emit() should be very fast (< 10ms)
      expect(emitDuration).toBeLessThan(10);
    });

    it('should eventually update the message', async () => {
      progressController.emit('categorized');

      // Wait for the async update to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockApi.editMessageText).toHaveBeenCalled();
    });

    it('should ignore emit errors', async () => {
      mockApi.editMessageText.mockRejectedValue(new Error('test error'));

      // Should not throw
      expect(() => {
        progressController.emit('start');
      }).not.toThrow();
    });
  });

  describe('complete()', () => {
    it('should prevent further updates', async () => {
      progressController.complete();

      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('should mark controller as inactive', () => {
      expect(progressController.isActive()).toBe(true);

      progressController.complete();

      expect(progressController.isActive()).toBe(false);
    });
  });

  describe('fail()', () => {
    it('should delete the message', async () => {
      await progressController.fail();

      expect(mockApi.deleteMessage).toHaveBeenCalledWith(testData.chatId, testData.messageId);
    });

    it('should mark controller as inactive', async () => {
      await progressController.fail();

      expect(progressController.isActive()).toBe(false);
    });

    it('should prevent further updates after failure', async () => {
      await progressController.fail();
      mockApi.editMessageText.mockClear();

      await progressController.update('start');

      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('should ignore delete errors', async () => {
      mockApi.deleteMessage.mockRejectedValue(new Error('delete failed'));

      // Should not throw
      await expect(progressController.fail()).resolves.not.toThrow();
    });
  });

  describe('isActive()', () => {
    it('should return true initially', () => {
      expect(progressController.isActive()).toBe(true);
    });

    it('should return false after complete()', () => {
      progressController.complete();
      expect(progressController.isActive()).toBe(false);
    });

    it('should return false after fail()', async () => {
      await progressController.fail();
      expect(progressController.isActive()).toBe(false);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent emit() calls gracefully', async () => {
      const stages: ProgressStage[] = ['start', 'categorized', 'saving', 'finalizing'];

      // Emit all stages concurrently
      stages.forEach((stage) => progressController.emit(stage));

      // Wait for all updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have made some edits (not all will succeed due to lock)
      expect(mockApi.editMessageText.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle update after emit gracefully', async () => {
      progressController.emit('start');

      // Wait a tiny bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // This should either succeed or be skipped
      await progressController.update('categorized');

      // No error should be thrown
      expect(mockApi.editMessageText.mock.calls.length).toBeGreaterThan(0);
    });

    it('should not update after complete even with pending emits', async () => {
      progressController.emit('start');
      progressController.complete();
      progressController.emit('categorized');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only the first emit might succeed, but no more should
      expect(mockApi.editMessageText.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('stage transitions', () => {
    it('should allow valid stage progressions', async () => {
      const stages: ProgressStage[] = ['start', 'categorized', 'saving', 'finalizing'];

      for (const stage of stages) {
        await progressController.update(stage);
      }

      expect(mockApi.editMessageText).toHaveBeenCalledTimes(stages.length);
    });

    it('should allow skipping stages', async () => {
      await progressController.update('start');
      mockApi.editMessageText.mockClear();

      // Jump to finalizing, skipping intermediate stages
      await progressController.update('finalizing');

      expect(mockApi.editMessageText).toHaveBeenCalledOnce();
      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        testData.chatId,
        testData.messageId,
        stageMessages.finalizing,
        { parse_mode: 'Markdown' }
      );
    });

    it('should allow going back to previous stages', async () => {
      await progressController.update('finalizing');
      mockApi.editMessageText.mockClear();

      // Go back to start
      await progressController.update('start');

      expect(mockApi.editMessageText).toHaveBeenCalledOnce();
    });
  });
});
