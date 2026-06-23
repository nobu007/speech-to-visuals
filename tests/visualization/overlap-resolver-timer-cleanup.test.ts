/**
 * Tests for OverlapResolver timer cleanup in applyWithTimeout.
 *
 * Bug: setTimeout used in Promise.race was never cleared when the strategy
 * completed before the timeout, leaking the timer reference and keeping
 * the reject callback alive unnecessarily.
 *
 * Fix: .finally(() => clearTimeout(timer)) ensures the timer is always
 * cleaned up regardless of whether the strategy or timeout wins.
 */
import { OverlapResolver } from '@/visualization/layout/OverlapResolver';

describe('OverlapResolver timer cleanup', () => {
  let originalSetTimeout: typeof setTimeout;
  let originalClearTimeout: typeof clearTimeout;
  let activeTimers: Set<ReturnType<typeof setTimeout>>;
  let clearedTimers: ReturnType<typeof setTimeout>[];

  beforeEach(() => {
    activeTimers = new Set();
    clearedTimers = [];
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;

    global.setTimeout = ((cb: (...args: unknown[]) => void, delay?: number) => {
      const id = originalSetTimeout(cb, delay);
      activeTimers.add(id);
      return id;
    }) as typeof setTimeout;

    global.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      activeTimers.delete(id);
      clearedTimers.push(id);
      originalClearTimeout(id);
    }) as typeof clearTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  it('should clear the timeout timer when strategy completes first', async () => {
    const resolver = new OverlapResolver(1);
    // Use a fast strategy that resolves immediately
    const fastStrategy = {
      name: 'fast',
      apply: async () => ({
        nodes: [{ id: 'n1', label: 'N1', x: 0, y: 0, width: 100, height: 50 }],
        edges: [],
        width: 800,
        height: 600,
      }),
    };

    // Call applyStrategyWithTimeout via the public resolve method or directly
    await (resolver as unknown as {
      applyStrategyWithTimeout: (
        strategy: typeof fastStrategy,
        nodes: unknown[],
        edges: unknown[],
        config: unknown,
        existingLayout?: unknown,
      ) => Promise<unknown>;
    }).applyStrategyWithTimeout(fastStrategy, [], [], {});

    // Give .finally() a microtask to run
    await new Promise(resolve => originalSetTimeout(resolve, 10));

    expect(clearedTimers.length).toBeGreaterThanOrEqual(1);
  });

  it('should clear the timeout timer when strategy rejects', async () => {
    const resolver = new OverlapResolver(1);
    const failingStrategy = {
      name: 'failing',
      apply: async () => {
        throw new Error('Strategy failed');
      },
    };

    await expect(
      (resolver as unknown as {
        applyStrategyWithTimeout: (
          strategy: typeof failingStrategy,
          nodes: unknown[],
          edges: unknown[],
          config: unknown,
          existingLayout?: unknown,
        ) => Promise<unknown>;
      }).applyStrategyWithTimeout(failingStrategy, [], [], {}),
    ).rejects.toThrow('Strategy failed');

    // Give .finally() a microtask to run
    await new Promise(resolve => originalSetTimeout(resolve, 10));

    expect(clearedTimers.length).toBeGreaterThanOrEqual(1);
  });
});
