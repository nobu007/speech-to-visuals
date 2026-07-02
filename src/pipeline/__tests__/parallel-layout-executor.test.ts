/**
 * Tests for parallel-layout-executor.ts (REQ-097)
 *
 * Covers: runWithConcurrency, executeLayoutsInParallel (incl. timeout
 * enforcement fix), and executeScenePreparationInParallel.
 */
import {
  runWithConcurrency,
  executeLayoutsInParallel,
  executeScenePreparationInParallel,
} from '../parallel-layout-executor';

// ─── helpers ───────────────────────────────────────────

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Track concurrent invocations to verify the concurrency cap. */
function makeConcurrencyTracker() {
  let active = 0;
  let peak = 0;
  return {
    run: async <T>(fn: () => Promise<T>): Promise<T> => {
      active++;
      peak = Math.max(peak, active);
      try {
        return await fn();
      } finally {
        active--;
      }
    },
    peak: () => peak,
  };
}

// ─── runWithConcurrency ────────────────────────────────

describe('runWithConcurrency', () => {
  it('preserves input order in results', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, 2, async (n) => {
      await delay(10 - n); // earlier items finish later
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('returns empty array for empty input', async () => {
    const results = await runWithConcurrency([], 3, async (x) => x);
    expect(results).toEqual([]);
  });

  it('respects maxConcurrency limit', async () => {
    const tracker = makeConcurrencyTracker();
    const items = Array.from({ length: 10 }, (_, i) => i);
    await runWithConcurrency(items, 3, (n) =>
      tracker.run(() => delay(20).then(() => n)),
    );
    expect(tracker.peak()).toBeLessThanOrEqual(3);
  });

  it('handles maxConcurrency > items.length', async () => {
    const results = await runWithConcurrency([1, 2], 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });

  it('handles maxConcurrency = 1 (sequential)', async () => {
    const tracker = makeConcurrencyTracker();
    const items = Array.from({ length: 5 }, (_, i) => i);
    await runWithConcurrency(items, 1, (n) =>
      tracker.run(() => delay(5).then(() => n)),
    );
    expect(tracker.peak()).toBe(1);
  });

  it('propagates task errors', async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });

  it('handles single-item array', async () => {
    const results = await runWithConcurrency([42], 3, async (n) => n);
    expect(results).toEqual([42]);
  });
});

// ─── executeLayoutsInParallel ──────────────────────────

describe('executeLayoutsInParallel', () => {
  it('returns empty array for empty diagrams', async () => {
    const results = await executeLayoutsInParallel([], async (d) => d);
    expect(results).toEqual([]);
  });

  it('processes diagrams and preserves order', async () => {
    const diagrams = ['a', 'b', 'c'];
    const results = await executeLayoutsInParallel(
      diagrams,
      async (d) => d.toUpperCase(),
      { maxConcurrency: 2, timeoutMs: 5000 },
    );
    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('uses default config when none provided', async () => {
    const results = await executeLayoutsInParallel([1, 2], async (n) => n * 2);
    expect(results).toEqual([2, 4]);
  });

  it('respects custom maxConcurrency', async () => {
    const tracker = makeConcurrencyTracker();
    const items = Array.from({ length: 8 }, (_, i) => i);
    await executeLayoutsInParallel(
      items,
      (n) => tracker.run(() => delay(10).then(() => n)),
      { maxConcurrency: 2, timeoutMs: 5000 },
    );
    expect(tracker.peak()).toBeLessThanOrEqual(2);
  });

  // ─── Timeout enforcement (the fix) ──────────────────

  it('rejects when a layout exceeds timeoutMs', async () => {
    const slowFn = async (_n: number) => {
      await delay(500);
      return 'done';
    };
    await expect(
      executeLayoutsInParallel([1], slowFn, {
        maxConcurrency: 1,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/timed out after 50ms/);
  });

  it('does not timeout when layouts complete within timeoutMs', async () => {
    const fastFn = async (n: number) => {
      await delay(5);
      return n;
    };
    const results = await executeLayoutsInParallel([1, 2, 3], fastFn, {
      maxConcurrency: 3,
      timeoutMs: 1000,
    });
    expect(results).toEqual([1, 2, 3]);
  });

  it('includes item index in timeout error message', async () => {
    await expect(
      executeLayoutsInParallel(
        ['x'],
        async () => {
          await delay(500);
          return 'never';
        },
        { maxConcurrency: 1, timeoutMs: 30 },
      ),
    ).rejects.toThrow(/layout:0/);
  });

  it('completes remaining fast items even if one is slow (race behaviour)', async () => {
    // With concurrency > 1, fast items complete before the slow one times out
    const items = [1, 2, 3];
    const fn = async (n: number) => {
      if (n === 2) {
        await delay(300);
        return n;
      }
      await delay(5);
      return n;
    };
    // Overall rejection expected (item 2 times out), but items 1 and 3 succeed
    await expect(
      executeLayoutsInParallel(items, fn, {
        maxConcurrency: 3,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/timed out/);
  });

  // ─── Retry integration ──────────────────────────────

  it('retries transient failures when retryOptions provided', async () => {
    let attempts = 0;
    const flakyFn = async (n: number) => {
      attempts++;
      if (attempts <= 2) throw new Error('LLM_TIMEOUT: transient');
      return n * 100;
    };

    const results = await executeLayoutsInParallel([1], flakyFn, {
      maxConcurrency: 1,
      timeoutMs: 5000,
      retryOptions: { maxRetries: 3, baseDelayMs: 1 },
    });

    expect(results).toEqual([100]);
    expect(attempts).toBe(3);
  });

  it('does not retry when retryOptions omitted', async () => {
    let attempts = 0;
    await expect(
      executeLayoutsInParallel(
        [1],
        async (n) => {
          attempts++;
          if (attempts === 1) throw new Error('NETWORK_ERROR: failed');
          return n;
        },
        { maxConcurrency: 1, timeoutMs: 5000 },
      ),
    ).rejects.toThrow('NETWORK_ERROR');
    expect(attempts).toBe(1);
  });
});

// ─── executeScenePreparationInParallel ─────────────────

describe('executeScenePreparationInParallel', () => {
  it('returns empty array for empty layouts', async () => {
    const results = await executeScenePreparationInParallel([], async (l) => l);
    expect(results).toEqual([]);
  });

  it('processes layouts in order', async () => {
    const layouts = [
      { scene: 1 },
      { scene: 2 },
      { scene: 3 },
    ];
    const results = await executeScenePreparationInParallel(
      layouts,
      async (l) => ({ ...l, ready: true }),
      2,
    );
    expect(results).toEqual([
      { scene: 1, ready: true },
      { scene: 2, ready: true },
      { scene: 3, ready: true },
    ]);
  });

  it('uses default maxConcurrency of 4', async () => {
    const tracker = makeConcurrencyTracker();
    const items = Array.from({ length: 10 }, (_, i) => i);
    await executeScenePreparationInParallel(items, (n) =>
      tracker.run(() => delay(10).then(() => n)),
    );
    expect(tracker.peak()).toBeLessThanOrEqual(4);
  });

  it('propagates errors', async () => {
    await expect(
      executeScenePreparationInParallel(
        [1, 2, 3],
        async (n) => {
          if (n === 2) throw new Error('scene failed');
          return n;
        },
        2,
      ),
    ).rejects.toThrow('scene failed');
  });

  it('retries with retryOptions', async () => {
    let calls = 0;
    const fn = async (n: number) => {
      calls++;
      if (calls <= 1) throw new Error('LLM_RATE_LIMITED: 429');
      return n;
    };

    const results = await executeScenePreparationInParallel([42], fn, 1, {
      maxRetries: 2,
      baseDelayMs: 1,
    });
    expect(results).toEqual([42]);
    expect(calls).toBe(2);
  });
});
