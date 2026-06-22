/**
 * Tests for BatchOptimizer.
 *
 * Verifies parallel chunking, order preservation, error handling,
 * progress callbacks, abort signal support, and failFast behavior.
 */
import { describe, it, expect } from '@jest/globals';
import { BatchOptimizer, batchProcess } from '../batch-optimizer';

describe('BatchOptimizer', () => {
  // --- Basic processing ---

  it('should process items and return results in order', async () => {
    const optimizer = new BatchOptimizer({ concurrency: 2, chunkSize: 10 });
    const items = [1, 2, 3, 4, 5];
    const results = await optimizer.process(items, async (n) => n * 2);

    expect(results.results).toEqual([2, 4, 6, 8, 10]);
    expect(results.errors).toEqual([null, null, null, null, null]);
    expect(results.successCount).toBe(5);
    expect(results.failureCount).toBe(0);
  });

  it('should handle empty input', async () => {
    const optimizer = new BatchOptimizer();
    const results = await optimizer.process([], async () => 1);

    expect(results.results).toEqual([]);
    expect(results.errors).toEqual([]);
    expect(results.successCount).toBe(0);
    expect(results.failureCount).toBe(0);
  });

  it('should handle single item', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 1, concurrency: 1 });
    const results = await optimizer.process([42], async (n) => n);

    expect(results.results).toEqual([42]);
    expect(results.successCount).toBe(1);
  });

  // --- Chunking behavior ---

  it('should process items larger than chunkSize', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 3, concurrency: 2 });
    const items = Array.from({ length: 10 }, (_, i) => i);
    const results = await optimizer.process(items, async (n) => n + 1);

    expect(results.results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(results.successCount).toBe(10);
  });

  it('should handle chunkSize=1 with high concurrency', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 1, concurrency: 5 });
    const items = Array.from({ length: 20 }, (_, i) => i);
    const results = await optimizer.process(items, async (n) => n * 10);

    expect(results.results).toEqual(items.map(n => n * 10));
    expect(results.successCount).toBe(20);
  });

  // --- Error handling ---

  it('should collect errors without failing (default)', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 1, concurrency: 1 });
    const items = [1, 2, 3, 4];
    const results = await optimizer.process(items, async (n) => {
      if (n === 2 || n === 4) throw new Error(`fail-${n}`);
      return n;
    });

    expect(results.results[0]).toBe(1);
    expect(results.results[1]).toBeUndefined();
    expect(results.results[2]).toBe(3);
    expect(results.results[3]).toBeUndefined();
    expect(results.errors[0]).toBeNull();
    expect(results.errors[1]).toBeInstanceOf(Error);
    expect((results.errors[1] as Error).message).toBe('fail-2');
    expect(results.errors[2]).toBeNull();
    expect(results.errors[3]).toBeInstanceOf(Error);
    expect(results.successCount).toBe(2);
    expect(results.failureCount).toBe(2);
  });

  it('should abort on first error when failFast is true', async () => {
    const optimizer = new BatchOptimizer({
      chunkSize: 1,
      concurrency: 1,
      failFast: true,
    });
    const items = [1, 2, 3, 4];
    await expect(
      optimizer.process(items, async (n) => {
        if (n === 2) throw new Error('fatal');
        return n;
      }),
    ).rejects.toThrow('fatal');
  });

  it('should handle non-Error throw values', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 1, concurrency: 1 });
    const results = await optimizer.process([1], async () => {
      throw 'string error';
    });

    expect(results.errors[0]).toBeInstanceOf(Error);
    expect((results.errors[0] as Error).message).toBe('string error');
  });

  // --- Progress callback ---

  it('should call onProgress during processing', async () => {
    const progressCalls: Array<{ completed: number; total: number }> = [];
    const optimizer = new BatchOptimizer({
      chunkSize: 2,
      concurrency: 1,
      onProgress: (completed, total) => {
        progressCalls.push({ completed, total });
      },
    });

    await optimizer.process([1, 2, 3, 4, 5], async (n) => n);

    // Should have at least some progress calls
    expect(progressCalls.length).toBeGreaterThan(0);
    // Last call should have completed === total
    const last = progressCalls[progressCalls.length - 1];
    expect(last.completed).toBe(5);
    expect(last.total).toBe(5);
  });

  // --- Abort signal ---

  it('should respect AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    const optimizer = new BatchOptimizer({
      chunkSize: 1,
      concurrency: 1,
      signal: controller.signal,
    });

    const items = [1, 2, 3];
    const results = await optimizer.process(items, async (n) => {
      await new Promise(r => setTimeout(r, 10));
      return n;
    });

    // With aborted signal, should not process any items
    expect(results.successCount).toBe(0);
  });

  // --- Timing ---

  it('should report totalTimeMs', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 2, concurrency: 2 });
    const results = await optimizer.process([1, 2, 3, 4], async (n) => {
      await new Promise(r => setTimeout(r, 5));
      return n;
    });

    expect(results.totalTimeMs).toBeGreaterThan(0);
  });

  // --- Convenience function ---

  it('should work with batchProcess convenience function', async () => {
    const results = await batchProcess([1, 2, 3], async (n) => n * 3);
    expect(results.results).toEqual([3, 6, 9]);
    expect(results.successCount).toBe(3);
  });

  it('should work with batchProcess and custom options', async () => {
    const results = await batchProcess(
      [1, 2, 3, 4],
      async (n) => n + 100,
      { chunkSize: 2, concurrency: 2 },
    );
    expect(results.results).toEqual([101, 102, 103, 104]);
  });

  // --- Large batch ---

  it('should handle 100 items correctly', async () => {
    const optimizer = new BatchOptimizer({ chunkSize: 10, concurrency: 4 });
    const items = Array.from({ length: 100 }, (_, i) => i);
    const results = await optimizer.process(items, async (n) => n * 2);

    expect(results.successCount).toBe(100);
    expect(results.failureCount).toBe(0);
    expect(results.results).toEqual(items.map(n => n * 2));
  });

  // --- Default options ---

  it('should use default options when none provided', async () => {
    const optimizer = new BatchOptimizer();
    const results = await optimizer.process([1, 2], async (n) => n);
    expect(results.successCount).toBe(2);
  });
});
