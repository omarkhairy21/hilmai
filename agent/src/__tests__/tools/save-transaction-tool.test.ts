/**
 * Unit Tests for Save Transaction Tool Retry Logic
 *
 * Tests the retry mechanism for handling transient duplicate key errors
 * when multiple transactions are saved concurrently.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the tool
vi.mock('../../lib/supabase', () => ({
  supabaseService: {
    from: vi.fn(),
  },
}));

vi.mock('../../lib/embeddings', () => ({
  getMerchantEmbedding: vi.fn(),
}));

vi.mock('../../lib/currency', () => ({
  getUserDefaultCurrency: vi.fn(),
  convertCurrency: vi.fn(),
  normalizeCurrency: vi.fn((currency: string) => currency.toUpperCase()),
}));

vi.mock('../../services/transaction.service', () => ({
  insertTransactionWithRetry: vi.fn(),
}));

import { supabaseService } from '../../lib/supabase';
import { getMerchantEmbedding } from '../../lib/embeddings';
import { getUserDefaultCurrency } from '../../lib/currency';
import { insertTransactionWithRetry } from '../../services/transaction.service';
import { saveTransactionTool } from '../../mastra/tools/save-transaction-tool';

describe('Save Transaction Tool - Retry Logic', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockMastra = {
    getLogger: () => mockLogger,
  };

  const mockRuntimeContext = {
    get: vi.fn(),
  };

  const baseContext = {
    userId: 123456,
    amount: 100,
    currency: 'AED',
    merchant: 'Test Merchant',
    category: 'Shopping',
    transactionDate: '2025-01-15',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock implementations
    vi.mocked(getMerchantEmbedding).mockResolvedValue(new Array(1536).fill(0.1));
    vi.mocked(getUserDefaultCurrency).mockResolvedValue('AED');
    vi.mocked(insertTransactionWithRetry).mockResolvedValue({
      transactionId: 'test-transaction-id',
      duration: 50,
    });

    // Mock users table upsert
    const mockUsersTable = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabaseService.from).mockImplementation((table: string) => {
      if (table === 'users') {
        return mockUsersTable as any;
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Transaction insertion via service', () => {
    it('should succeed when service returns transaction ID', async () => {
      vi.mocked(insertTransactionWithRetry).mockResolvedValue({
        transactionId: 'test-transaction-id',
        duration: 50,
      });

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test-transaction-id');
      expect(insertTransactionWithRetry).toHaveBeenCalledTimes(1);
      expect(insertTransactionWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: baseContext.userId,
          amount: baseContext.amount,
          merchant: baseContext.merchant,
          category: baseContext.category,
        }),
        mockLogger
      );
    });

    it('should handle service retry logic correctly', async () => {
      // Service handles retries internally, so we just verify it's called and succeeds
      vi.mocked(insertTransactionWithRetry).mockResolvedValue({
        transactionId: 'test-transaction-id-after-retry',
        duration: 350,
      });

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test-transaction-id-after-retry');
      expect(insertTransactionWithRetry).toHaveBeenCalledTimes(1);
    });

    it('should propagate service errors correctly', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('duplicate key value violates unique constraint "unique_user_display_id"')
      );

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(false);
      // Error message is converted to user-friendly format for display_id errors
      expect(result.message).toContain('temporary conflict');
    });

    it('should handle max retries exceeded error from service', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('Failed to save transaction after 8 attempts due to display_id race condition: duplicate key')
      );

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(false);
      // Error message is converted to user-friendly format
      expect(result.message).toContain('temporary conflict');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[tool:save-transaction]',
        expect.objectContaining({
          event: 'error',
          errorType: 'race_condition',
        })
      );
    });

    it('should not retry on non-duplicate errors from service', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('Failed to save transaction: connection timeout')
      );

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('connection timeout');
      expect(insertTransactionWithRetry).toHaveBeenCalledTimes(1); // Service handles retries internally
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database connection failed');
    });
  });

  describe('Error message handling', () => {
    it('should provide user-friendly message for race condition errors', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('Failed to save transaction after 8 attempts due to display_id race condition: duplicate key')
      );

      const result = await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('temporary conflict');
    });

    it('should log error type correctly', async () => {
      vi.mocked(insertTransactionWithRetry).mockRejectedValue(
        new Error('Failed to save transaction after 8 attempts due to display_id race condition: duplicate key')
      );

      await saveTransactionTool.execute({
        context: baseContext,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[tool:save-transaction]',
        expect.objectContaining({
          event: 'error',
          errorType: 'race_condition',
        })
      );
    });
  });
});

