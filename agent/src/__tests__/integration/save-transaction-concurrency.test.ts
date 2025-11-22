/**
 * Integration Tests for Concurrent Transaction Saves
 *
 * Tests that multiple transactions can be saved concurrently without
 * duplicate key violations, verifying the advisory lock fix and retry logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
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

import { supabaseService } from '../../lib/supabase';
import { getMerchantEmbedding } from '../../lib/embeddings';
import { getUserDefaultCurrency } from '../../lib/currency';
import { saveTransactionTool } from '../../mastra/tools/save-transaction-tool';

describe('Save Transaction Concurrency Integration Tests', () => {
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

  let transactionCounter = 0;
  let displayIdCounter = new Map<number, number>(); // user_id -> next display_id

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    transactionCounter = 0;
    displayIdCounter.clear();

    // Default mock implementations
    vi.mocked(getMerchantEmbedding).mockResolvedValue(new Array(1536).fill(0.1));
    vi.mocked(getUserDefaultCurrency).mockResolvedValue('AED');

    // Mock users table upsert
    const mockUsersTable = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    // Mock transactions table with realistic concurrent behavior
    const mockTransactionsTable = {
      insert: vi.fn().mockImplementation((payload: any) => {
        const userId = payload.user_id;
        const currentDisplayId = displayIdCounter.get(userId) || 0;
        
        // Simulate advisory lock: increment display_id atomically
        // In real scenario, the lock ensures this is atomic
        const nextDisplayId = currentDisplayId + 1;
        displayIdCounter.set(userId, nextDisplayId);

        // Simulate successful insert with generated transaction ID
        const transactionId = `txn-${++transactionCounter}-${Date.now()}`;
        
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: transactionId },
              error: null,
            }),
          }),
        };
      }),
    };

    vi.mocked(supabaseService.from).mockImplementation((table: string) => {
      if (table === 'users') {
        return mockUsersTable as any;
      }
      if (table === 'transactions') {
        return mockTransactionsTable as any;
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Concurrent transaction saves for same user', () => {
    it('should save 3 transactions concurrently without duplicates', async () => {
      const userId = 123456;
      const transactions = [
        {
          userId,
          amount: 231,
          currency: 'AED',
          merchant: 'Zara',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId,
          amount: 343,
          currency: 'AED',
          merchant: 'Uniqlo',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId,
          amount: 989,
          currency: 'AED',
          merchant: 'H&M',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
      ];

      // Execute all transactions concurrently
      const results = await Promise.all(
        transactions.map((txn) =>
          saveTransactionTool.execute({
            context: txn,
            mastra: mockMastra as any,
            runtimeContext: mockRuntimeContext as any,
          })
        )
      );

      // Verify all succeeded
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.transactionId).toBeDefined();
      });

      // Verify no duplicate errors
      const errorResults = results.filter((r) => !r.success);
      expect(errorResults).toHaveLength(0);

      // Verify all transactions were inserted
      const transactionsTable = vi.mocked(supabaseService.from).mock.results.find(
        (r) => r.value && typeof r.value.insert === 'function'
      )?.value;
      expect(transactionsTable?.insert).toHaveBeenCalledTimes(3);
    });

    it('should save 5 transactions concurrently without duplicates', async () => {
      const userId = 789012;
      const transactions = Array.from({ length: 5 }, (_, i) => ({
        userId,
        amount: 100 + i * 10,
        currency: 'AED',
        merchant: `Merchant ${i + 1}`,
        category: 'Shopping',
        transactionDate: '2025-10-13',
      }));

      const results = await Promise.all(
        transactions.map((txn) =>
          saveTransactionTool.execute({
            context: txn,
            mastra: mockMastra as any,
            runtimeContext: mockRuntimeContext as any,
          })
        )
      );

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.transactionId).toBeDefined();
      });

      // Verify no retry warnings (advisory lock should prevent race conditions)
      const retryWarnings = mockLogger.warn.mock.calls.filter((call) =>
        call[1]?.event === 'retry_attempt'
      );
      expect(retryWarnings.length).toBe(0);
    });

    it('should handle concurrent saves with retry logic when race conditions occur', async () => {
      const userId = 999999;
      let insertCallCount = 0;

      // Simulate race condition: first few attempts fail with duplicate error
      const mockTransactionsTable = {
        insert: vi.fn().mockImplementation(() => {
          insertCallCount++;
          // First 2 attempts fail with duplicate error (simulating race condition)
          if (insertCallCount <= 2) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    message: 'duplicate key value violates unique constraint "unique_user_display_id"',
                  },
                }),
              }),
            };
          }
          // Subsequent attempts succeed
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `txn-${insertCallCount}` },
                error: null,
              }),
            }),
          };
        }),
      };

      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        if (table === 'transactions') {
          return mockTransactionsTable as any;
        }
        return {} as any;
      });

      const transaction = {
        userId,
        amount: 100,
        currency: 'AED',
        merchant: 'Test Merchant',
        category: 'Shopping',
        transactionDate: '2025-10-13',
      };

      const resultPromise = saveTransactionTool.execute({
        context: transaction,
        mastra: mockMastra as any,
        runtimeContext: mockRuntimeContext as any,
      });

      // Advance timers for retry delays
      await vi.advanceTimersByTimeAsync(500);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(mockTransactionsTable.insert).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      // Logger calls now come from transaction service with [transaction-service] prefix
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[transaction-service]',
        expect.objectContaining({
          event: 'retry_attempt',
        })
      );
    });
  });

  describe('Concurrent transaction saves for different users', () => {
    it('should save transactions for different users concurrently', async () => {
      const transactions = [
        {
          userId: 111111,
          amount: 100,
          currency: 'AED',
          merchant: 'Merchant A',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId: 222222,
          amount: 200,
          currency: 'AED',
          merchant: 'Merchant B',
          category: 'Dining',
          transactionDate: '2025-10-13',
        },
        {
          userId: 333333,
          amount: 300,
          currency: 'AED',
          merchant: 'Merchant C',
          category: 'Transport',
          transactionDate: '2025-10-13',
        },
      ];

      const results = await Promise.all(
        transactions.map((txn) =>
          saveTransactionTool.execute({
            context: txn,
            mastra: mockMastra as any,
            runtimeContext: mockRuntimeContext as any,
          })
        )
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.transactionId).toBeDefined();
      });

      // Each user should have their own display_id sequence
      expect(displayIdCounter.get(111111)).toBe(1);
      expect(displayIdCounter.get(222222)).toBe(1);
      expect(displayIdCounter.get(333333)).toBe(1);
    });

    it('should maintain separate display_id sequences per user', async () => {
      const userId1 = 100001;
      const userId2 = 100002;

      // Save 2 transactions for user 1
      const user1Transactions = [
        {
          userId: userId1,
          amount: 100,
          currency: 'AED',
          merchant: 'Merchant 1',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId: userId1,
          amount: 200,
          currency: 'AED',
          merchant: 'Merchant 2',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
      ];

      // Save 1 transaction for user 2
      const user2Transaction = {
        userId: userId2,
        amount: 300,
        currency: 'AED',
        merchant: 'Merchant 3',
        category: 'Shopping',
        transactionDate: '2025-10-13',
      };

      const allTransactions = [...user1Transactions, user2Transaction];
      const results = await Promise.all(
        allTransactions.map((txn) =>
          saveTransactionTool.execute({
            context: txn,
            mastra: mockMastra as any,
            runtimeContext: mockRuntimeContext as any,
          })
        )
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // User 1 should have 2 transactions (display_id: 1, 2)
      expect(displayIdCounter.get(userId1)).toBe(2);
      // User 2 should have 1 transaction (display_id: 1)
      expect(displayIdCounter.get(userId2)).toBe(1);
    });
  });

  describe('Error handling in concurrent scenarios', () => {
    it('should handle mix of successful and failed transactions gracefully', async () => {
      const userId = 555555;
      let callCount = 0;

      const mockTransactionsTable = {
        insert: vi.fn().mockImplementation(() => {
          callCount++;
          // First transaction succeeds, second fails with non-retryable error, third succeeds
          if (callCount === 2) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'connection timeout' },
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `txn-${callCount}` },
                error: null,
              }),
            }),
          };
        }),
      };

      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        if (table === 'transactions') {
          return mockTransactionsTable as any;
        }
        return {} as any;
      });

      const transactions = [
        {
          userId,
          amount: 100,
          currency: 'AED',
          merchant: 'Merchant 1',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId,
          amount: 200,
          currency: 'AED',
          merchant: 'Merchant 2',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
        {
          userId,
          amount: 300,
          currency: 'AED',
          merchant: 'Merchant 3',
          category: 'Shopping',
          transactionDate: '2025-10-13',
        },
      ];

      const results = await Promise.all(
        transactions.map((txn) =>
          saveTransactionTool.execute({
            context: txn,
            mastra: mockMastra as any,
            runtimeContext: mockRuntimeContext as any,
          })
        )
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(results[1].message).toContain('connection timeout');
    });
  });
});

