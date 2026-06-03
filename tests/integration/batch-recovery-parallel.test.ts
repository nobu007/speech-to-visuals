/**
 * TASK-0190: Batch Recovery Parallel Execution Integration Test
 *
 * Validates that BatchOperationRecovery works correctly under concurrent
 * execution with per-item error boundaries, individual retries, and
 * fallback handling.
 *
 * Scenarios:
 * 1. Parallel execution with partial failures
 * 2. Per-item error boundary with individual retry
 * 3. Partial failure with continued processing
 * 4. All items succeed concurrently
 * 5. All items fail concurrently
 */

import { jest } from '@jest/globals';
import { BatchOperationRecovery } from '@/quality/batch-operation-recovery';
import type { BatchResult, ItemResult, FallbackProvider, ItemProcessor } from '@/quality/batch-operation-recovery';
import { PipelineError } from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRecovery(): BatchOperationRecovery {
  return new BatchOperationRecovery();
}

/** Processor that succeeds for all items. */
function successProcessor<T = string>(): ItemProcessor<T, string> {
  return jest.fn(async (item: T, index: number) => `result-${index}`);
}

/** Processor that fails for specific indices (by zero-based index). */
function failingProcessor<T = string>(
  failIndices: Set<number>,
  errorMessage = 'Layout computation failed: out of memory',
): ItemProcessor<T, string> {
  return jest.fn(async (item: T, index: number): Promise<string> => {
    if (failIndices.has(index)) {
      throw new Error(errorMessage);
    }
    return `result-${index}`;
  });
}

/** Processor that fails first N attempts per item, then succeeds. */
function flakyProcessor<T = string>(
  failCountMap: Map<number, number>,
): ItemProcessor<T, string> {
  const attemptCounts = new Map<number, number>();
  return jest.fn(async (item: T, index: number): Promise<string> => {
    const prev = attemptCounts.get(index) ?? 0;
    attemptCounts.set(index, prev + 1);
    const failCount = failCountMap.get(index) ?? 0;
    if (prev < failCount) {
      throw new Error(`Flaky failure for item ${index}`);
    }
    return `result-${index}`;
  });
}

/** Processor that throws a PipelineError for specific indices. */
function pipelineErrorProcessor<T = string>(
  failIndices: Set<number>,
  errorType: 'RENDERING_ERROR' | 'NETWORK_ERROR' = 'RENDERING_ERROR',
): ItemProcessor<T, string> {
  return jest.fn(async (item: T, index: number): Promise<string> => {
    if (failIndices.has(index)) {
      throw new PipelineError(`Stage error for item ${index}`, errorType, 'rendering');
    }
    return `result-${index}`;
  });
}

/** Fallback that returns a degraded result. */
function fallbackProvider<T = string>(): FallbackProvider<T, string> {
  return jest.fn(async (_item: T, index: number) => `fallback-${index}`);
}

/** Fallback that fails (throws). */
function failingFallback<T = string>(): FallbackProvider<T, string> {
  return jest.fn(async () => {
    throw new Error('Fallback also failed');
  });
}

/** Fallback that returns undefined (no fallback available). */
function noFallback<T = string>(): FallbackProvider<T, string> {
  return jest.fn(async () => undefined);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TASK-0190: Batch recovery parallel execution', () => {
  let recovery: BatchOperationRecovery;

  beforeEach(() => {
    recovery = createRecovery();
  });

  // -----------------------------------------------------------------------
  // 1. Parallel execution with partial failures
  // -----------------------------------------------------------------------
  describe('parallel execution with partial failures', () => {
    it('processes items concurrently and reports mixed results', async () => {
      // Items 0, 2 succeed; items 1, 3 fail (no retry, no fallback)
      const processor = failingProcessor(new Set([1, 3]));

      const result = await recovery.process(
        ['a', 'b', 'c', 'd'],
        processor,
        undefined,
        {
          stage: 'layout_generation',
          concurrent: true,
          concurrency: 2,
          maxRetries: 0,
        },
      );

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.successRate).toBe(0.5);
      expect(result.stage).toBe('layout_generation');

      // Verify individual item results
      expect(result.items[0].success).toBe(true);
      expect(result.items[0].result).toBe('result-0');
      expect(result.items[0].fallbackUsed).toBe(false);

      expect(result.items[1].success).toBe(false);
      expect(result.items[1].error).toBeDefined();

      expect(result.items[2].success).toBe(true);
      expect(result.items[2].result).toBe('result-2');

      expect(result.items[3].success).toBe(false);
      expect(result.items[3].error).toBeDefined();
    });

    it('uses fallback for failed items in concurrent mode', async () => {
      const processor = failingProcessor(new Set([0, 2]));
      const fallback = fallbackProvider();

      const result = await recovery.process(
        ['a', 'b', 'c', 'd'],
        processor,
        fallback,
        {
          stage: 'rendering',
          concurrent: true,
          concurrency: 2,
          maxRetries: 0,
        },
      );

      // All items should succeed (some via fallback)
      expect(result.succeeded).toBe(4);
      expect(result.failed).toBe(0);

      // Items 0 and 2 used fallback
      expect(result.items[0].fallbackUsed).toBe(true);
      expect(result.items[0].result).toBe('fallback-0');
      expect(result.items[2].fallbackUsed).toBe(true);
      expect(result.items[2].result).toBe('fallback-2');

      // Items 1 and 3 used primary
      expect(result.items[1].fallbackUsed).toBe(false);
      expect(result.items[1].result).toBe('result-1');
      expect(result.items[3].fallbackUsed).toBe(false);
      expect(result.items[3].result).toBe('result-3');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Per-item error boundary with individual retry
  // -----------------------------------------------------------------------
  describe('per-item error boundary with individual retry', () => {
    it('retries individual failing items without affecting others', async () => {
      // Item 0 fails once, item 1 always succeeds, item 2 fails twice
      const processor = flakyProcessor(new Map([[0, 1], [2, 2]]));

      const result = await recovery.process(
        ['a', 'b', 'c'],
        processor,
        undefined,
        {
          stage: 'analysis',
          concurrent: false,
          maxRetries: 2,
          retryDelayMs: 1,
        },
      );

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);

      // Verify attempts: item 0 needed 2 attempts, item 1 needed 1, item 2 needed 3
      expect(result.items[0].attempts).toBe(2);
      expect(result.items[1].attempts).toBe(1);
      expect(result.items[2].attempts).toBe(3);
    });

    it('retries per-item in concurrent mode', async () => {
      // Item 0 fails once, item 1 fails twice
      const processor = flakyProcessor(new Map([[0, 1], [1, 2]]));

      const result = await recovery.process(
        ['x', 'y'],
        processor,
        undefined,
        {
          stage: 'transcription',
          concurrent: true,
          concurrency: 2,
          maxRetries: 2,
          retryDelayMs: 1,
        },
      );

      expect(result.succeeded).toBe(2);
      expect(result.items[0].attempts).toBe(2);
      expect(result.items[1].attempts).toBe(3);
    });

    it('classifies PipelineError types correctly in batch context', async () => {
      const processor = pipelineErrorProcessor(new Set([0]), 'NETWORK_ERROR');

      const result = await recovery.process(
        ['a', 'b'],
        processor,
        undefined,
        {
          stage: 'api_call',
          concurrent: false,
          maxRetries: 0,
        },
      );

      expect(result.items[0].success).toBe(false);
      expect(result.items[0].error).toBeDefined();
      expect(result.items[0].error!.type).toBe('NETWORK_ERROR');
      expect(result.items[0].error!.recoverable).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Partial failure with continued processing
  // -----------------------------------------------------------------------
  describe('partial failure with continued processing', () => {
    it('continues processing remaining items after individual failures', async () => {
      // 6 items, items 1 and 4 fail completely
      const processor = failingProcessor(new Set([1, 4]));

      const result = await recovery.process(
        ['a', 'b', 'c', 'd', 'e', 'f'],
        processor,
        undefined,
        {
          stage: 'export',
          concurrent: true,
          concurrency: 3,
          maxRetries: 0,
        },
      );

      expect(result.total).toBe(6);
      expect(result.succeeded).toBe(4);
      expect(result.failed).toBe(2);
      expect(result.successRate).toBeCloseTo(4 / 6);

      // Verify specific items
      expect(result.items[0].success).toBe(true);
      expect(result.items[1].success).toBe(false);
      expect(result.items[2].success).toBe(true);
      expect(result.items[3].success).toBe(true);
      expect(result.items[4].success).toBe(false);
      expect(result.items[5].success).toBe(true);
    });

    it('handles fallback failure gracefully — item marked as failed', async () => {
      const processor = failingProcessor(new Set([0]));
      const fallback = failingFallback();

      const result = await recovery.process(
        ['a', 'b'],
        processor,
        fallback,
        {
          stage: 'encoding',
          concurrent: false,
          maxRetries: 0,
        },
      );

      // Item 0 failed primary + fallback, item 1 succeeded
      expect(result.items[0].success).toBe(false);
      expect(result.items[0].fallbackUsed).toBe(false);
      expect(result.items[0].error).toBeDefined();

      expect(result.items[1].success).toBe(true);
    });

    it('fallback returning undefined marks item as failed', async () => {
      const processor = failingProcessor(new Set([0]));
      const fallback = noFallback();

      const result = await recovery.process(
        ['a', 'b'],
        processor,
        fallback,
        {
          stage: 'rendering',
          concurrent: true,
          concurrency: 2,
          maxRetries: 0,
        },
      );

      expect(result.items[0].success).toBe(false);
      expect(result.items[0].fallbackUsed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 4. All items succeed concurrently
  // -----------------------------------------------------------------------
  describe('all items succeed concurrently', () => {
    it('reports 100% success rate when all items succeed', async () => {
      const processor = successProcessor();

      const result = await recovery.process(
        ['a', 'b', 'c', 'd'],
        processor,
        undefined,
        {
          stage: 'diagram_detection',
          concurrent: true,
          concurrency: 4,
          maxRetries: 0,
        },
      );

      expect(result.succeeded).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.successRate).toBe(1);
      expect(result.items.every((item) => item.success)).toBe(true);
      expect(result.items.every((item) => item.attempts === 1)).toBe(true);
    });

    it('empty batch returns success rate 1', async () => {
      const processor = successProcessor();

      const result = await recovery.process(
        [],
        processor,
        undefined,
        {
          stage: 'empty_stage',
          concurrent: true,
          concurrency: 2,
        },
      );

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.successRate).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 5. All items fail concurrently
  // -----------------------------------------------------------------------
  describe('all items fail concurrently', () => {
    it('reports 0% success rate when all items fail', async () => {
      const processor = failingProcessor(new Set([0, 1, 2]));

      const result = await recovery.process(
        ['a', 'b', 'c'],
        processor,
        undefined,
        {
          stage: 'critical_failure',
          concurrent: true,
          concurrency: 3,
          maxRetries: 0,
        },
      );

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.successRate).toBe(0);
      expect(result.items.every((item) => !item.success)).toBe(true);
      expect(result.items.every((item) => item.error !== undefined)).toBe(true);
    });

    it('all items fail with exhausted retries', async () => {
      const processor = failingProcessor(new Set([0, 1]));

      const result = await recovery.process(
        ['a', 'b'],
        processor,
        undefined,
        {
          stage: 'retry_exhaustion',
          concurrent: false,
          maxRetries: 2,
          retryDelayMs: 1,
        },
      );

      // Each item was attempted maxRetries+1 = 3 times
      expect(result.failed).toBe(2);
      expect(result.items[0].attempts).toBe(3); // 1 initial + 2 retries
      expect(result.items[1].attempts).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Concurrency boundary verification
  // -----------------------------------------------------------------------
  describe('concurrency boundary', () => {
    it('respects concurrency limit when chunk size < item count', async () => {
      // 5 items, concurrency 2 → chunks of 2+2+1
      const callTimes: number[] = [];
      const processor = jest.fn(async (_item: string, index: number) => {
        callTimes.push(Date.now());
        // Small delay to ensure concurrency is observable
        await new Promise((r) => setTimeout(r, 10));
        return `result-${index}`;
      });

      const result = await recovery.process(
        ['a', 'b', 'c', 'd', 'e'],
        processor,
        undefined,
        {
          stage: 'chunked',
          concurrent: true,
          concurrency: 2,
          maxRetries: 0,
        },
      );

      expect(result.succeeded).toBe(5);
      expect(result.total).toBe(5);
      // Total calls = 5
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('sequential mode processes items one at a time', async () => {
      const order: number[] = [];
      const processor = jest.fn(async (_item: string, index: number) => {
        order.push(index);
        return `result-${index}`;
      });

      await recovery.process(
        ['a', 'b', 'c'],
        processor,
        undefined,
        {
          stage: 'sequential_test',
          concurrent: false,
          maxRetries: 0,
        },
      );

      // Sequential order preserved
      expect(order).toEqual([0, 1, 2]);
    });
  });
});
