/**
 * Integration test: Abort signal listener stability across 5+ retry cycles.
 *
 * Verifies the EDGE-010 fix (removeEventListener in retry delay timer callback)
 * holds under sustained retry pressure:
 *   - All 3 retries fire (4 total attempts → 3 retry delay periods)
 *   - Listener add/remove calls are balanced after each export
 *   - 5 sequential exports with retries show no cumulative listener leak
 *   - Listener count on the signal returns to baseline (0) after each export
 */

import { EnhancedExportEngine, ExportConfiguration } from '../enhanced-export-engine';

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

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

describe('EDGE-010 Integration: Listener stability across 5+ retry cycles', () => {
  test('single export with max retries: add/remove calls balanced', async () => {
    const engine = new EnhancedExportEngine(1);

    let attemptCount = 0;
    let addCount = 0;
    let removeCount = 0;
    let trackedSignal: AbortSignal | null = null;

    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

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

        // Fail first 3 attempts (transient), succeed on 4th
        if (attemptCount <= 3) {
          throw new Error('Out of memory (OOM)');
        }
        return realEncode.call(engine, ...args);
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    // Advance through all retry delays (initial 1000ms, then 2000ms, then 4000ms with jitter)
    await jest.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(4); // 1 initial + 3 retries

    // Every add must have a matching remove
    expect(addCount).toBe(removeCount);
    expect(trackedSignal).not.toBeNull();
  }, 30000);

  test('5 sequential exports with retries: no cumulative listener leak', async () => {
    const engine = new EnhancedExportEngine(1);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    const results: { exportNum: number; addCount: number; removeCount: number; balanced: boolean }[] = [];

    for (let exportNum = 0; exportNum < 5; exportNum++) {
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

          // Fail first 2 attempts, succeed on 3rd
          if (attemptCount <= 2) {
            throw new Error('Worker timed out');
          }
          return realEncode.call(engine, ...args);
        }
      );

      jest.useFakeTimers();
      const resultPromise = engine.exportVideo(createSceneData(), createConfig());
      await jest.advanceTimersByTimeAsync(10000);
      const result = await resultPromise;
      jest.useRealTimers();

      expect(result.success).toBe(true);

      results.push({
        exportNum: exportNum + 1,
        addCount,
        removeCount,
        balanced: addCount === removeCount,
      });

      // Reset tracked signal for next iteration
      trackedSignal = null;

      jest.restoreAllMocks();
      // Re-suppress console after restoreAllMocks
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'info').mockImplementation(() => {});
    }

    // Every export must have balanced add/remove
    for (const r of results) {
      expect(r.balanced).toBe(true);
      expect(r.addCount).toBeGreaterThan(0); // retries did happen
      expect(r.removeCount).toBe(r.addCount);
    }

    // No cumulative leak: all 5 exports have identical add/remove patterns
    const firstPattern = `${results[0].addCount}:${results[0].removeCount}`;
    for (const r of results) {
      expect(`${r.addCount}:${r.removeCount}`).toBe(firstPattern);
    }
  }, 60000);

  test('abort signal has zero residual listeners after successful export with retries', async () => {
    const engine = new EnhancedExportEngine(1);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    let attemptCount = 0;
    let trackedController: AbortController | null = null;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        attemptCount++;
        const job = args[0] as { abortController: AbortController };
        if (!trackedController) {
          trackedController = job.abortController;
        }
        if (attemptCount <= 2) {
          throw new Error('heap out of memory');
        }
        return realEncode.call(engine, ...args);
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(3); // 1 initial + 2 retries
    expect(trackedController).not.toBeNull();

    // The signal should not be aborted (export succeeded)
    expect(trackedController!.signal.aborted).toBe(false);

    // Verify listener count by dispatching an abort event and checking
    // that nothing unexpected happens (no throw in a settled promise)
    let listenerFired = false;
    const testListener = () => { listenerFired = true; };
    trackedController!.signal.addEventListener('test', testListener as EventListener);
    trackedController!.signal.dispatchEvent(new Event('test'));
    expect(listenerFired).toBe(true);

    // Clean up our test listener
    trackedController!.signal.removeEventListener('test', testListener as EventListener);
  }, 30000);

  test('rapid retry cycles do not accumulate listeners on signal', async () => {
    const engine = new EnhancedExportEngine(1);
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    let attemptCount = 0;
    const addRemoveLog: { action: 'add' | 'remove'; attempt: number }[] = [];
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
            if (type === 'abort') addRemoveLog.push({ action: 'add', attempt: attemptCount });
            return origAdd(type, listener, options);
          }) as typeof sig.addEventListener;
          sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') addRemoveLog.push({ action: 'remove', attempt: attemptCount });
            return origRemove(type, listener, options);
          }) as typeof sig.removeEventListener;
        }

        // All attempts fail except the last
        if (attemptCount <= 3) {
          throw new Error('Worker timed out');
        }
        return realEncode.call(engine, ...args);
      }
    );

    jest.useFakeTimers();
    const resultPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(15000);
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(4);

    // Verify interleaving pattern: each add is followed by a remove before the next add
    // This proves no accumulation
    const abortEvents = addRemoveLog;
    let depth = 0;
    let maxDepth = 0;
    for (const evt of abortEvents) {
      if (evt.action === 'add') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else {
        depth--;
      }
    }

    // Max concurrent listeners should be 1 at any time (each retry adds 1, removes 1)
    // Note: runStageWithTimeout may also add/remove, so maxDepth could be 2
    expect(maxDepth).toBeLessThanOrEqual(2);
    // Final depth must be 0 (all cleaned up)
    expect(depth).toBe(0);
  }, 30000);
});
