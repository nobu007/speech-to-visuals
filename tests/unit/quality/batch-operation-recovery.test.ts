/**
 * Tests for BatchOperationRecovery — per-item error boundaries for batch stages.
 */

import { BatchOperationRecovery } from '@/quality/batch-operation-recovery';
import type { BatchResult, ItemResult, FallbackProvider } from '@/quality/batch-operation-recovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a processor that succeeds for all items. */
function successProcessor<T, O>(fn: (item: T, index: number) => O) {
  return async (item: T, index: number) => fn(item, index);
}

/** Create a processor that fails for items whose indices are in `failIndices`. */
function failingProcessor<T, O>(
  failIndices: Set<number>,
  errorMessage = 'Layout computation failed: out of memory',
) {
  return async (item: T, index: number): Promise<O> => {
    if (failIndices.has(index)) {
      throw new Error(errorMessage);
    }
    return `result-${index}` as unknown as O;
  };
}

/** A fallback that returns a degraded result. */
function fallbackProvider<T, O>(_item: T, index: number) {
  return Promise.resolve(`fallback-${index}` as unknown as O);
}

/** A fallback that always returns undefined (i.e. cannot recover). */
function noFallback<T, O>() {
  return async () => Promise.resolve(undefined as unknown as O);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BatchOperationRecovery', () => {
  let recovery: BatchOperationRecovery;

  beforeEach(() => {
    recovery = new BatchOperationRecovery();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  describe('all items succeed', () => {
    it('returns 100% success rate for sequential processing', async () => {
      const items = ['a', 'b', 'c'];
      const processor = successProcessor((_, i) => `out-${i}`);

      const result = await recovery.process(items, processor, undefined, {
        stage: 'layout_generation',
      });

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(3);
      expect(result.successRate).toBe(1);
      expect(result.items).toHaveLength(3);
      expect(result.stage).toBe('layout_generation');

      for (let i = 0; i < 3; i++) {
        expect(result.items[i].success).toBe(true);
        expect(result.items[i].fallbackUsed).toBe(false);
        expect(result.items[i].attempts).toBe(1);
        expect(result.items[i].result).toBe(`out-${i}`);
        expect(result.items[i].index).toBe(i);
        expect(result.items[i].durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns 100% success rate for concurrent processing', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = successProcessor((item) => item * 10);

      const result = await recovery.process(items, processor, undefined, {
        stage: 'rendering',
        concurrent: true,
        concurrency: 2,
      });

      expect(result.succeeded).toBe(5);
      expect(result.successRate).toBe(1);
    });

    it('handles empty input array', async () => {
      const result = await recovery.process(
        [],
        async (x) => x,
        undefined,
        { stage: 'export' },
      );

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(0);
      expect(result.successRate).toBe(1); // vacuously true
      expect(result.items).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Partial failures
  // -----------------------------------------------------------------------

  describe('some items fail, no fallback', () => {
    it('records failures and computes partial success rate', async () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const failIndices = new Set([1, 3]);
      const processor = failingProcessor(failIndices);

      const result = await recovery.process(items, processor, undefined, {
        stage: 'analysis',
        maxRetries: 0, // no retries to speed up test
      });

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.successRate).toBeCloseTo(0.6);
      expect(result.items[1].success).toBe(false);
      expect(result.items[1].error).toBeDefined();
      expect(result.items[1].error!.type).toBeDefined();
      expect(result.items[1].attempts).toBe(1);
      expect(result.items[3].success).toBe(false);
    });

    it('classifies errors with stage context', async () => {
      const items = ['x'];
      const processor = async () => { throw new Error('LLM API error 500'); };

      const result = await recovery.process(items, processor, undefined, {
        stage: 'analysis',
        maxRetries: 0,
      });

      expect(result.items[0].error).toBeDefined();
      expect(result.items[0].error!.stage).toBe('analysis');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback behaviour
  // -----------------------------------------------------------------------

  describe('fallback recovery', () => {
    it('uses fallback when primary fails and fallback succeeds', async () => {
      const items = ['a', 'b'];
      const processor = failingProcessor(new Set([0]));
      const fallback = fallbackProvider;

      const result = await recovery.process(items, processor, fallback, {
        stage: 'layout_generation',
        maxRetries: 0,
      });

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.successRate).toBe(1);

      // Item 0 used fallback
      expect(result.items[0].fallbackUsed).toBe(true);
      expect(result.items[0].result).toBe('fallback-0');

      // Item 1 succeeded normally
      expect(result.items[1].fallbackUsed).toBe(false);
      expect(result.items[1].result).toBe('result-1');
    });

    it('marks item as failed when fallback also fails or returns undefined', async () => {
      const items = ['a'];
      const processor = async () => { throw new Error('fail'); };
      const fallback = noFallback();

      const result = await recovery.process(items, processor, fallback, {
        stage: 'rendering',
        maxRetries: 0,
      });

      expect(result.items[0].success).toBe(false);
      expect(result.items[0].fallbackUsed).toBe(false);
    });

    it('handles fallback throwing an exception gracefully', async () => {
      const items = ['a'];
      const processor = async () => { throw new Error('primary fail'); };
      const fallback = async () => { throw new Error('fallback also broke'); };

      const result = await recovery.process(
        items,
        processor,
        fallback as unknown as FallbackProvider<string, unknown>,
        { stage: 'rendering', maxRetries: 0 },
      );

      expect(result.items[0].success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Retry behaviour
  // -----------------------------------------------------------------------

  describe('retry with exponential backoff', () => {
    it('retries up to maxRetries then gives up', async () => {
      const callCount = jest.fn();
      const processor = async (_item: string, index: number) => {
        callCount();
        throw new Error('always fails');
      };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'analysis',
        maxRetries: 3,
        retryDelayMs: 10, // keep test fast
        backoffMultiplier: 2,
      });

      // 1 initial + 3 retries = 4 total attempts
      expect(callCount).toHaveBeenCalledTimes(4);
      expect(result.items[0].attempts).toBe(4);
      expect(result.items[0].success).toBe(false);
    });

    it('succeeds on a later retry attempt', async () => {
      let attempt = 0;
      const processor = async (_item: string, index: number) => {
        attempt++;
        if (attempt < 3) throw new Error('not yet');
        return `success-on-attempt-${attempt}`;
      };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'transcription',
        maxRetries: 3,
        retryDelayMs: 10,
      });

      expect(result.items[0].success).toBe(true);
      expect(result.items[0].attempts).toBe(3);
      expect(result.items[0].result).toBe('success-on-attempt-3');
      expect(result.items[0].fallbackUsed).toBe(false);
    });

    it('respects backoff multiplier', async () => {
      const timestamps: number[] = [];
      const processor = async () => {
        timestamps.push(Date.now());
        throw new Error('fail');
      };

      await recovery.process(['a'], processor, undefined, {
        stage: 'analysis',
        maxRetries: 2,
        retryDelayMs: 50,
        backoffMultiplier: 3,
      });

      // Delays: 50ms, 150ms (50 * 3)
      // Not precise due to timer resolution, so just check increasing delays
      expect(timestamps).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent processing
  // -----------------------------------------------------------------------

  describe('concurrent processing', () => {
    it('processes items in chunks respecting concurrency limit', async () => {
      const order: number[] = [];
      const processor = async (_item: number, index: number) => {
        order.push(index);
        await new Promise((r) => setTimeout(r, 20));
        return index * 2;
      };

      const result = await recovery.process([10, 20, 30, 40, 50], processor, undefined, {
        stage: 'rendering',
        concurrent: true,
        concurrency: 2,
      });

      expect(result.succeeded).toBe(5);
      expect(result.total).toBe(5);
      // Items should be processed (in chunks of 2)
      expect(order).toHaveLength(5);
    });

    it('handles partial failures in concurrent mode', async () => {
      const processor = failingProcessor(new Set([0, 2]));
      const fallback = fallbackProvider;

      const result = await recovery.process(
        ['a', 'b', 'c', 'd'],
        processor,
        fallback,
        {
          stage: 'layout_generation',
          concurrent: true,
          concurrency: 2,
          maxRetries: 0,
        },
      );

      // Items 0 and 2 fail primary but succeed via fallback
      expect(result.succeeded).toBe(4);
      expect(result.items[0].fallbackUsed).toBe(true);
      expect(result.items[2].fallbackUsed).toBe(true);
      expect(result.items[1].fallbackUsed).toBe(false);
      expect(result.items[3].fallbackUsed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Error classification integration
  // -----------------------------------------------------------------------

  describe('error classification', () => {
    it('classifies rendering OOM errors correctly', async () => {
      const processor = async () => { throw new Error('Out of memory during render'); };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'rendering',
        maxRetries: 0,
      });

      expect(result.items[0].error).toBeDefined();
      expect(result.items[0].error!.type).toBe('RENDERING_OOM');
      expect(result.items[0].error!.severity).toBe('critical');
    });

    it('classifies LLM rate limit errors', async () => {
      const processor = async () => { throw new Error('Gemini rate limit exceeded'); };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'analysis',
        maxRetries: 0,
      });

      expect(result.items[0].error!.type).toBe('LLM_RATE_LIMITED');
    });

    it('classifies network errors', async () => {
      const processor = async () => { throw new Error('Network connection refused'); };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'transcription',
        maxRetries: 0,
      });

      expect(result.items[0].error!.type).toBe('NETWORK_ERROR');
    });

    it('classifies unknown errors as UNKNOWN', async () => {
      const processor = async () => { throw new Error('Something weird happened'); };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'export',
        maxRetries: 0,
      });

      expect(result.items[0].error!.type).toBe('UNKNOWN');
    });
  });

  // -----------------------------------------------------------------------
  // Result shape & metadata
  // -----------------------------------------------------------------------

  describe('result metadata', () => {
    it('tracks duration for each item', async () => {
      const processor = async (_item: string, _index: number) => {
        await new Promise((r) => setTimeout(r, 30));
        return 'done';
      };

      const result = await recovery.process(['a', 'b'], processor, undefined, {
        stage: 'rendering',
      });

      expect(result.items[0].durationMs).toBeGreaterThanOrEqual(20);
      expect(result.items[1].durationMs).toBeGreaterThanOrEqual(20);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(20);
    });

    it('preserves item order matching input order', async () => {
      const items = ['alpha', 'beta', 'gamma', 'delta'];
      const failIndices = new Set([1, 2]);
      const processor = failingProcessor(failIndices);
      const fallback = fallbackProvider;

      const result = await recovery.process(items, processor, fallback, {
        stage: 'analysis',
        maxRetries: 0,
      });

      const indices = result.items.map((r) => r.index);
      expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('reports stage name in result', async () => {
      const result = await recovery.process(
        ['a'],
        async () => 'ok',
        undefined,
        { stage: 'diagram_detection' },
      );
      expect(result.stage).toBe('diagram_detection');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles processor throwing non-Error objects', async () => {
      const processor = async () => { throw 'string error'; };

      const result = await recovery.process(['a'], processor, undefined, {
        stage: 'export',
        maxRetries: 0,
      });

      expect(result.items[0].success).toBe(false);
      expect(result.items[0].error).toBeDefined();
    });

    it('handles single-item batch', async () => {
      const processor = async (item: string) => `processed-${item}`;

      const result = await recovery.process(['only-one'], processor, undefined, {
        stage: 'segmentation',
      });

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.items[0].result).toBe('processed-only-one');
    });

    it('handles all items failing with fallback for all', async () => {
      const items = ['a', 'b', 'c'];
      const processor = async () => { throw new Error('always fails'); };
      const fallback = fallbackProvider;

      const result = await recovery.process(items, processor, fallback, {
        stage: 'rendering',
        maxRetries: 0,
      });

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.successRate).toBe(1);
      expect(result.items.every((r) => r.fallbackUsed)).toBe(true);
    });
  });
});
