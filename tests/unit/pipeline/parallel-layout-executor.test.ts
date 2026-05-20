/**
 * Tests for parallel-layout-executor — TASK-0143 parallel layout execution.
 */

import { describe, it, expect } from '@jest/globals';
import {
  runWithConcurrency,
  executeLayoutsInParallel,
  executeScenePreparationInParallel,
} from '@/pipeline/parallel-layout-executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A simple async task that resolves after a short delay. */
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// runWithConcurrency
// ---------------------------------------------------------------------------

describe('runWithConcurrency', () => {
  it('returns results in the same order as input', async () => {
    const items = [10, 20, 30, 40, 50];
    const results = await runWithConcurrency(items, 2, async (item) => item * 2);
    expect(results).toEqual([20, 40, 60, 80, 100]);
  });

  it('passes correct index to task function', async () => {
    const items = ['a', 'b', 'c'];
    const indices: number[] = [];
    await runWithConcurrency(items, 3, async (_item, index) => {
      indices.push(index);
      return index;
    });
    expect(indices.sort()).toEqual([0, 1, 2]);
  });

  it('handles empty array', async () => {
    const results = await runWithConcurrency<number, number>([], 3, async (n) => n);
    expect(results).toEqual([]);
  });

  it('respects concurrency limit', async () => {
    let activeCount = 0;
    let maxActive = 0;
    const concurrency = 2;
    const items = [1, 2, 3, 4, 5];

    await runWithConcurrency(items, concurrency, async (item) => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await delay(10);
      activeCount--;
      return item;
    });

    expect(maxActive).toBeLessThanOrEqual(concurrency);
  });

  it('handles single item', async () => {
    const results = await runWithConcurrency([42], 3, async (n) => n + 1);
    expect(results).toEqual([43]);
  });

  it('handles concurrency larger than items', async () => {
    const results = await runWithConcurrency([1, 2], 100, async (n) => n * 10);
    expect(results).toEqual([10, 20]);
  });

  it('propagates task errors', async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom');
        return item;
      }),
    ).rejects.toThrow('boom');
  });
});

// ---------------------------------------------------------------------------
// executeLayoutsInParallel
// ---------------------------------------------------------------------------

describe('executeLayoutsInParallel', () => {
  it('returns layout results in order', async () => {
    const diagrams = ['diagram1', 'diagram2', 'diagram3'];
    const results = await executeLayoutsInParallel(
      diagrams,
      async (d, i) => `${d}-layout-${i}`,
    );
    expect(results).toEqual([
      'diagram1-layout-0',
      'diagram2-layout-1',
      'diagram3-layout-2',
    ]);
  });

  it('returns empty array for no diagrams', async () => {
    const results = await executeLayoutsInParallel<string, string>([], async (d) => d);
    expect(results).toEqual([]);
  });

  it('respects maxConcurrency config', async () => {
    let activeCount = 0;
    let maxActive = 0;
    const diagrams = ['a', 'b', 'c', 'd'];

    const results = await executeLayoutsInParallel(
      diagrams,
      async (d) => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await delay(10);
        activeCount--;
        return d.toUpperCase();
      },
      { maxConcurrency: 1, timeoutMs: 5000 },
    );

    expect(maxActive).toBeLessThanOrEqual(1);
    expect(results).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ---------------------------------------------------------------------------
// executeScenePreparationInParallel
// ---------------------------------------------------------------------------

describe('executeScenePreparationInParallel', () => {
  it('returns scene results in order', async () => {
    const layouts = [{ id: 1 }, { id: 2 }];
    const results = await executeScenePreparationInParallel(
      layouts,
      async (layout, i) => ({ sceneId: i, from: layout.id }),
    );
    expect(results).toEqual([
      { sceneId: 0, from: 1 },
      { sceneId: 1, from: 2 },
    ]);
  });

  it('returns empty array for no layouts', async () => {
    const results = await executeScenePreparationInParallel<object, object>(
      [], async (l) => l,
    );
    expect(results).toEqual([]);
  });

  it('respects custom maxConcurrency', async () => {
    let activeCount = 0;
    let maxActive = 0;
    const layouts = [1, 2, 3, 4, 5, 6];

    await executeScenePreparationInParallel(
      layouts,
      async (l) => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await delay(5);
        activeCount--;
        return l * 2;
      },
      2,
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
