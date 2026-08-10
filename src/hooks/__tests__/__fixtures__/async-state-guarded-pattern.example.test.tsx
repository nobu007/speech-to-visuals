/**
 * @jest-environment jsdom
 */
/**
 * async-state-guarded-pattern.example.test.tsx — TC-300-02
 *
 * Developer copy-paste verification for the guarded async-setState pattern
 * shown in `async-state-guarded-pattern.example.tsx`. If a developer copies
 * the hook from that fixture into a feature, these tests must pass — they
 * exercise the observer/raf + ref-mirror + cleanup pattern end-to-end.
 *
 * The tests run under jsdom and use a polyfilled `requestAnimationFrame` so
 * the observer fires deterministically (the default jsdom raf is a no-op).
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

import {
  useRafTickCounter,
  useIntervalPollingCount,
} from './async-state-guarded-pattern.example';

describe('async-state-guarded-pattern — positive-case fixture (REQ-300)', () => {
  let rafCallbacks: Array<(t: number) => void> = [];
  let nextRafId = 1;
  let cancelledRafIds = new Set<number>();

  beforeEach(() => {
    rafCallbacks = [];
    cancelledRafIds = new Set();
    let nextIntervalId = 1;
    const intervalCallbacks = new Map<number, () => void>();

    // Polyfill rAF — record every callback so the test can drive them
    // deterministically. The polyfilled cancelAnimationFrame tracks
    // cancellations so we can assert cleanup fires.
    (globalThis as unknown as {
      requestAnimationFrame: (cb: (t: number) => void) => number;
    }).requestAnimationFrame = (cb: (t: number) => void): number => {
      rafCallbacks.push(cb);
      return nextRafId++;
    };
    (globalThis as unknown as {
      cancelAnimationFrame: (id: number) => void;
    }).cancelAnimationFrame = (id: number): void => {
      cancelledRafIds.add(id);
    };
    (globalThis as unknown as { setInterval: typeof setInterval }).setInterval =
      ((cb: () => void, ms: number): number => {
        const id = nextIntervalId++;
        intervalCallbacks.set(id, cb);
        return id;
      }) as unknown as typeof setInterval;
    (globalThis as unknown as { clearInterval: typeof clearInterval }).clearInterval =
      ((id: number): void => {
        intervalCallbacks.delete(id);
      }) as unknown as typeof clearInterval;

    // Expose interval callbacks for direct driving in tests.
    (
      globalThis as unknown as { __INTERVAL_CBS__: Map<number, () => void> }
    ).__INTERVAL_CBS__ = intervalCallbacks;
  });

  afterEach(() => {
    rafCallbacks = [];
    cancelledRafIds = new Set();
  });

  /**
   * Drive ONE rAF tick: invoke the next-scheduled callback (or the nth if
   * specified). Mirrors what the browser does on each animation frame.
   */
  function tickRaf(n = 1): void {
    for (let i = 0; i < n; i++) {
      const cb = rafCallbacks.shift();
      if (cb) cb(performance.now());
    }
  }

  it('useRafTickCounter: observer fires, ref mirror stays in sync, state tracks', () => {
    const { result } = renderHook(() => useRafTickCounter());

    // Initial state.
    expect(result.current.count).toBe(0);
    expect(result.current.readLatest()).toBe(0);

    // Drive three rAF ticks synchronously.
    act(() => {
      tickRaf(3);
    });

    // After three ticks: count = 3, ref mirror = 3, in sync.
    expect(result.current.count).toBe(3);
    expect(result.current.readLatest()).toBe(3);
  });

  it('useRafTickCounter: cleanup cancels the in-flight raf (no leak)', () => {
    const { result, unmount } = renderHook(() => useRafTickCounter());
    act(() => tickRaf(2));
    expect(result.current.count).toBe(2);

    const rAFsScheduledBefore = rafCallbacks.length;

    unmount();

    // Cleanup must cancel any in-flight raf AND must not leave new rafs
    // scheduled after unmount.
    expect(cancelledRafIds.size).toBeGreaterThan(0);
    expect(rafCallbacks.length).toBe(rAFsScheduledBefore);
  });

  it('useRafTickCounter: readLatest returns the LATEST count, never stale', () => {
    const { result } = renderHook(() => useRafTickCounter());
    act(() => tickRaf(5));
    // After 5 ticks: readLatest MUST equal count. This is the property
    // that breaks for the buggy `setX → await → read X` pattern — the
    // mirror guarantees they stay equal.
    expect(result.current.readLatest()).toBe(result.current.count);
    expect(result.current.readLatest()).toBe(5);
  });

  it('useIntervalPollingCount: fires on each interval, ref mirror tracks', () => {
    const cbs = (
      globalThis as unknown as { __INTERVAL_CBS__: Map<number, () => void> }
    ).__INTERVAL_CBS__;
    const { result } = renderHook(() => useIntervalPollingCount(10));

    // Drive 4 ticks (each interval callback advances count by 1).
    act(() => {
      for (const cb of [...cbs.values()]) cb();
    });

    expect(result.current.count).toBe(1);
    expect(result.current.readLatest()).toBe(1);
  });

  it('useIntervalPollingCount: cleanup calls clearInterval (1:1 register/cleanup)', () => {
    const cbs = (
      globalThis as unknown as { __INTERVAL_CBS__: Map<number, () => void> }
    ).__INTERVAL_CBS__;
    expect(cbs.size).toBe(0);
    const { unmount } = renderHook(() => useIntervalPollingCount(10));
    expect(cbs.size).toBe(1);
    unmount();
    expect(cbs.size).toBe(0);
  });
});
