/**
 * Tests for BatchOperationRecovery: per-item error boundaries for batch pipeline stages.
 *
 * Verifies:
 * - Sequential processing with all items succeeding
 * - Retry behavior with exponential backoff
 * - Fallback provider invocation
 * - Concurrent processing mode
 * - Aggregate statistics computation
 * - Edge cases (empty input, immediate failure)
 */

import { BatchOperationRecovery } from '../batch-operation-recovery';
import type { ItemResult, BatchResult } from '../batch-operation-recovery';

describe('BatchOperationRecovery', () => {
  let recovery: BatchOperationRecovery;

  beforeEach(() => {
    recovery = new BatchOperationRecovery();
  });

  // ---------------------------------------------------------------------------
  // Sequential processing — happy path
  // ---------------------------------------------------------------------------

  describe('process (sequential)', () => {
    test('should process all items successfully when processor never throws', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => item * 2;

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
      });

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.successRate).toBe(1);
      expect(result.stage).toBe('test');
      expect(result.items).toHaveLength(3);
      expect(result.items[0].result).toBe(2);
      expect(result.items[1].result).toBe(4);
      expect(result.items[2].result).toBe(6);
      expect(result.items.every((r) => r.attempts === 1)).toBe(true);
      expect(result.items.every((r) => !r.fallbackUsed)).toBe(true);
    });

    test('should preserve original index ordering', async () => {
      const items = ['a', 'b', 'c'];
      const processor = async (item: string) => item.toUpperCase();

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
      });

      expect(result.items.map((r) => r.index)).toEqual([0, 1, 2]);
      expect(result.items.map((r) => r.result)).toEqual(['A', 'B', 'C']);
    });
  });

  // ---------------------------------------------------------------------------
  // Retry behaviour
  // ---------------------------------------------------------------------------

  describe('retry behaviour', () => {
    test('should retry up to maxRetries times before failing', async () => {
      const items = [1];
      let callCount = 0;
      const processor = async () => {
        callCount++;
        throw new Error('Always fails');
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 2,
        retryDelayMs: 1, // fast for tests
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(callCount).toBe(3); // initial + 2 retries
      expect(result.items[0].attempts).toBe(3);
      expect(result.items[0].success).toBe(false);
      expect(result.items[0].error).toBeDefined();
    });

    test('should succeed on retry after transient failure', async () => {
      const items = [1];
      let callCount = 0;
      const processor = async (item: number) => {
        callCount++;
        if (callCount < 3) throw new Error('Transient');
        return item * 10;
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 3,
        retryDelayMs: 1,
      });

      expect(result.succeeded).toBe(1);
      expect(result.items[0].success).toBe(true);
      expect(result.items[0].result).toBe(10);
      expect(result.items[0].attempts).toBe(3);
      expect(result.items[0].fallbackUsed).toBe(false);
    });

    test('should respect maxRetries=0 (no retries)', async () => {
      const items = [1];
      let callCount = 0;
      const processor = async () => {
        callCount++;
        throw new Error('Immediate fail');
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 0,
      });

      expect(callCount).toBe(1);
      expect(result.items[0].attempts).toBe(1);
      expect(result.items[0].success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback provider
  // ---------------------------------------------------------------------------

  describe('fallback provider', () => {
    test('should use fallback when primary fails after all retries', async () => {
      const items = [1];
      const processor = async () => {
        throw new Error('Primary fails');
      };
      const fallback = async (item: number) => item * 100;

      const result = await recovery.process(items, processor, fallback, {
        stage: 'test',
        maxRetries: 1,
        retryDelayMs: 1,
      });

      expect(result.succeeded).toBe(1);
      expect(result.items[0].success).toBe(true);
      expect(result.items[0].result).toBe(100);
      expect(result.items[0].fallbackUsed).toBe(true);
    });

    test('should mark item as failed when fallback returns undefined', async () => {
      const items = [1];
      const processor = async () => {
        throw new Error('Primary fails');
      };
      const fallback = async () => undefined;

      const result = await recovery.process(items, processor, fallback, {
        stage: 'test',
        maxRetries: 0,
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.items[0].success).toBe(false);
      expect(result.items[0].fallbackUsed).toBe(false);
    });

    test('should mark item as failed when fallback also throws', async () => {
      const items = [1];
      const processor = async () => {
        throw new Error('Primary fails');
      };
      const fallback = async () => {
        throw new Error('Fallback also fails');
      };

      const result = await recovery.process(items, processor, fallback, {
        stage: 'test',
        maxRetries: 0,
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.items[0].success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrent processing
  // ---------------------------------------------------------------------------

  describe('process (concurrent)', () => {
    test('should process items concurrently when concurrent=true', async () => {
      const items = [1, 2, 3, 4];
      const processor = async (item: number) => item * 2;

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        concurrent: true,
        concurrency: 2,
      });

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(4);
      expect(result.items.map((r) => r.result)).toEqual([2, 4, 6, 8]);
    });

    test('should maintain correct index mapping in concurrent mode', async () => {
      const items = ['w', 'x', 'y', 'z'];
      const processor = async (item: string, index: number) => `${index}:${item}`;

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        concurrent: true,
        concurrency: 2,
      });

      expect(result.items[0].result).toBe('0:w');
      expect(result.items[1].result).toBe('1:x');
      expect(result.items[2].result).toBe('2:y');
      expect(result.items[3].result).toBe('3:z');
    });
  });

  // ---------------------------------------------------------------------------
  // Aggregate statistics
  // ---------------------------------------------------------------------------

  describe('aggregate statistics', () => {
    test('should compute successRate correctly for mixed results', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => {
        if (item % 2 === 0) throw new Error('Even fails');
        return item;
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 0,
      });

      expect(result.total).toBe(5);
      expect(result.succeeded).toBe(3); // 1, 3, 5
      expect(result.failed).toBe(2);    // 2, 4
      expect(result.successRate).toBeCloseTo(0.6, 5);
    });

    test('should track durationMs per item', async () => {
      const items = [1, 2];
      const processor = async (item: number) => {
        await new Promise((r) => setTimeout(r, 10));
        return item;
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
      });

      expect(result.items[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(result.items[1].durationMs).toBeGreaterThanOrEqual(0);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('should handle empty input array', async () => {
      const result = await recovery.process(
        [],
        async (item: number) => item,
        undefined,
        { stage: 'test' },
      );

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.successRate).toBe(1); // by convention
      expect(result.items).toEqual([]);
    });

    test('should handle non-Error throw values', async () => {
      const items = [1];
      const processor = async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 0,
      });

      expect(result.failed).toBe(1);
      expect(result.items[0].error).toBeDefined();
    });

    test('should classify errors with the provided stage label', async () => {
      const items = [1];
      const processor = async () => {
        throw new Error('Test error');
      };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'layout_generation',
        maxRetries: 0,
      });

      expect(result.stage).toBe('layout_generation');
      expect(result.items[0].error).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Backoff configuration
  // ---------------------------------------------------------------------------

  describe('backoff configuration', () => {
    test('should use custom backoffMultiplier', async () => {
      const items = [1];
      let timestamps: number[] = [];
      let callCount = 0;
      const start = Date.now();
      const processor = async () => {
        callCount++;
        timestamps.push(Date.now() - start);
        throw new Error('Always fails');
      };

      await recovery.process(items, processor, undefined, {
        stage: 'test',
        maxRetries: 2,
        retryDelayMs: 10,
        backoffMultiplier: 3,
      });

      expect(callCount).toBe(3);
      // Delays should be: 0ms (first), 10ms, 30ms
      // Check that delay between calls 2 and 1 is >= 10ms
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(8);
      // Check that delay between calls 3 and 2 is >= 30ms
      expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(25);
    });
  });
});
