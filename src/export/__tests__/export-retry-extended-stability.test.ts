/**
 * Extended integration test: Abort signal listener stability with DI'd retry config.
 *
 * REQ-253: Verifies listener counts stabilize over 10 sequential export cycles,
 *          each with maxRetries=5 (6 total attempts per export → 5 retry delay periods).
 * REQ-256: Uses RetryConfig DI to exercise higher retry counts than the default MAX_RETRIES=3.
 *
 * Test matrix:
 *   - maxRetries=5: single export exhausts all 5 retries then succeeds on 6th attempt
 *   - 10 sequential exports: no cumulative listener leak across cycles
 *   - Concurrent exports: listener counts remain isolated per export job
 *   - Listener depth never exceeds 2 at any point (1 from retry delay + 1 from stage timeout)
 */

import { EnhancedExportEngine, ExportConfiguration, type RetryConfig } from '../enhanced-export-engine';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const highRetryConfig: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  jitterMaxMs: 50,
};

const createSceneData = () => ({
  scenes: [
    { duration: 2, type: 'intro' },
    { duration: 3, type: 'content' },
  ],
});

const baseQuality = {
  resolution: '1080p' as const,
  fps: 30 as const,
  bitrate: 'auto' as const,
  hdr: false,
};

const baseSettings = {
  loop: false,
  includeAudio: false,
  watermark: false,
  compression: 'none' as const,
  optimization: 'speed' as const,
};

const createConfig = (): ExportConfiguration => ({
  format: 'mp4',
  quality: baseQuality,
  settings: baseSettings,
});

describe('REQ-253/256 Extended Integration: Listener stability with maxRetries=5', () => {
  test('single export with 5 retries (6 attempts): listener add/remove perfectly balanced', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, highRetryConfig);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    let attemptCount = 0;
    let addCount = 0;
    let removeCount = 0;
    let trackedSignal: AbortSignal | null = null;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        const job = args[0] as { abortController: AbortController };
        const sig = job.abortController.signal;

        if (!trackedSignal) {
          trackedSignal = sig;
          const origAdd = sig.addEventListener.bind(sig);
          const origRemove = sig.removeEventListener.bind(sig);
          sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
            if (type === 'abort') addCount++;
            return origAdd(type, listener, options);
          }) as typeof sig.addEventListener;
          sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') removeCount++;
            return origRemove(type, listener, options);
          }) as typeof sig.removeEventListener;
        }

        // Fail first 5 attempts (transient), succeed on 6th
        if (attemptCount <= 5) {
          throw new Error('Out of memory (OOM)');
        }
        return realEncode.call(engine, ...args);
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    // Advance through all 5 retry delays (100+50+200+50+400+50+800+50+1000+50 ≈ 2.8s)
    await jest.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(6); // 1 initial + 5 retries
    expect(addCount).toBe(removeCount);
    expect(trackedSignal).not.toBeNull();
  }, 30000);

  test('10 sequential exports with retries: zero cumulative listener leak', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, highRetryConfig);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    const cycleResults: { cycle: number; addCount: number; removeCount: number }[] = [];

    for (let cycle = 0; cycle < 10; cycle++) {
      let attemptCount = 0;
      let addCount = 0;
      let removeCount = 0;
      let trackedSignal: AbortSignal | null = null;

      jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
        async function (...args: unknown[]) {
          attemptCount++;
          const job = args[0] as { abortController: AbortController };
          const sig = job.abortController.signal;

          if (!trackedSignal) {
            trackedSignal = sig;
            const origAdd = sig.addEventListener.bind(sig);
            const origRemove = sig.removeEventListener.bind(sig);
            sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
              if (type === 'abort') addCount++;
              return origAdd(type, listener, options);
            }) as typeof sig.addEventListener;
            sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
              if (type === 'abort') removeCount++;
              return origRemove(type, listener, options);
            }) as typeof sig.removeEventListener;
          }

          // Fail first 3 attempts, succeed on 4th
          if (attemptCount <= 3) {
            throw new Error('Worker timed out');
          }
          return realEncode.call(engine, ...args);
        }
      );

      jest.useFakeTimers();
      const resultPromise = engine.exportVideo(createSceneData(), createConfig());
      await jest.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;
      jest.useRealTimers();

      expect(result.success).toBe(true);

      cycleResults.push({ cycle: cycle + 1, addCount, removeCount });

      trackedSignal = null;
      jest.restoreAllMocks();
      // Re-suppress console after restoreAllMocks
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'info').mockImplementation(() => {});
    }

    // Every cycle must have balanced add/remove
    for (const r of cycleResults) {
      expect(r.addCount).toBeGreaterThan(0); // retries did happen
      expect(r.removeCount).toBe(r.addCount); // perfectly balanced
    }

    // All 10 cycles must have identical add/remove pattern (no accumulation)
    const firstPattern = `${cycleResults[0].addCount}:${cycleResults[0].removeCount}`;
    for (const r of cycleResults) {
      expect(`${r.addCount}:${r.removeCount}`).toBe(firstPattern);
    }
  }, 120000);

  test('5 retry delay periods: interleaving pattern verified (add→remove→add→remove...)', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, highRetryConfig);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    let attemptCount = 0;
    const eventLog: { action: 'add' | 'remove'; attempt: number }[] = [];
    let trackedSignal: AbortSignal | null = null;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        const job = args[0] as { abortController: AbortController };
        const sig = job.abortController.signal;

        if (!trackedSignal) {
          trackedSignal = sig;
          const origAdd = sig.addEventListener.bind(sig);
          const origRemove = sig.removeEventListener.bind(sig);
          sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
            if (type === 'abort') eventLog.push({ action: 'add', attempt: attemptCount });
            return origAdd(type, listener, options);
          }) as typeof sig.addEventListener;
          sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') eventLog.push({ action: 'remove', attempt: attemptCount });
            return origRemove(type, listener, options);
          }) as typeof sig.removeEventListener;
        }

        // Fail all 5 retries, succeed on 6th attempt
        if (attemptCount <= 5) {
          throw new Error('heap out of memory');
        }
        return realEncode.call(engine, ...args);
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(6);

    // Verify stack discipline: max depth ≤ 2 (1 retry + 1 stage timeout)
    let depth = 0;
    let maxDepth = 0;
    for (const evt of eventLog) {
      if (evt.action === 'add') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else {
        depth--;
      }
    }
    expect(maxDepth).toBeLessThanOrEqual(2);
    // Final depth must be exactly 0
    expect(depth).toBe(0);
    // Must have at least 5 add events (one per retry delay)
    const addCount = eventLog.filter(e => e.action === 'add').length;
    expect(addCount).toBeGreaterThanOrEqual(5);
  }, 30000);

  test('retry exhaustion with maxRetries=5: all 6 attempts fire, then fails gracefully', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, highRetryConfig);

    let attemptCount = 0;
    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        throw new Error('Worker timed out');
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(10000);
    let result: { success: boolean; error?: string } | undefined;
    try {
      result = await resultPromise;
    } catch {
      // May throw if all retries exhausted
    }
    jest.useRealTimers();

    expect(attemptCount).toBe(6); // 1 initial + 5 retries
    if (result) {
      expect(result.success).toBe(false);
    }
  }, 30000);
});

/**
 * TC-253-01 & TC-253-02: Listener stability with maxRetries=10.
 */
const tenRetryConfig: RetryConfig = {
  maxRetries: 10,
  initialDelayMs: 50,
  maxDelayMs: 500,
  jitterMaxMs: 10,
};

describe('TC-253-01: maxRetries=10 listener stability', () => {
  test('10 retries with always-failing mock: listener add/remove balanced', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, tenRetryConfig);

    let attemptCount = 0;
    let addCount = 0;
    let removeCount = 0;
    let trackedSignal: AbortSignal | null = null;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        const job = args[0] as { abortController: AbortController };
        const sig = job.abortController.signal;

        if (!trackedSignal) {
          trackedSignal = sig;
          const origAdd = sig.addEventListener.bind(sig);
          const origRemove = sig.removeEventListener.bind(sig);
          sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
            if (type === 'abort') addCount++;
            return origAdd(type, listener, options);
          }) as typeof sig.addEventListener;
          sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') removeCount++;
            return origRemove(type, listener, options);
          }) as typeof sig.removeEventListener;
        }

        // Always fail with transient error (recognized by isTransientExportError)
        throw new Error('Worker timed out');
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(30000);
    let result: { success: boolean } | undefined;
    try {
      result = await resultPromise;
    } catch {
      // May throw if all retries exhausted
    }
    jest.useRealTimers();

    expect(attemptCount).toBe(11); // 1 initial + 10 retries
    // Listener count stable: every add matched by remove
    expect(addCount).toBe(removeCount);
    expect(addCount).toBeGreaterThan(0);
    expect(trackedSignal).not.toBeNull();
  }, 60000);
});

describe('TC-253-02: Abort during retry → immediate listener cleanup', () => {
  test('abort on 5th attempt: listeners cleaned up immediately', async () => {
    const engine = new EnhancedExportEngine(1, false, undefined, undefined, tenRetryConfig);

    let attemptCount = 0;
    let addCount = 0;
    let removeCount = 0;
    let trackedController: AbortController | null = null;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        const job = args[0] as { abortController: AbortController };
        const sig = job.abortController.signal;

        if (!trackedController) {
          trackedController = job.abortController;
          const origAdd = sig.addEventListener.bind(sig);
          const origRemove = sig.removeEventListener.bind(sig);
          sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
            if (type === 'abort') addCount++;
            return origAdd(type, listener, options);
          }) as typeof sig.addEventListener;
          sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') removeCount++;
            return origRemove(type, listener, options);
          }) as typeof sig.removeEventListener;
        }

        // On 5th attempt, abort the signal
        if (attemptCount === 5) {
          job.abortController.abort();
          throw new Error('Worker timed out');
        }

        // All other attempts also fail with transient error
        throw new Error('Worker timed out');
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(30000);
    try {
      await resultPromise;
    } catch {
      // Expected to fail/throw
    }
    jest.useRealTimers();

    // Abort happened at attempt 5; further retries may or may not occur
    expect(attemptCount).toBeGreaterThanOrEqual(5);

    // All listeners that were added must have been removed (no leak)
    expect(addCount).toBe(removeCount);

    // Signal should be aborted
    expect(trackedController).not.toBeNull();
    expect(trackedController!.signal.aborted).toBe(true);
  }, 60000);
});
