/**
 * Tests for abort signal listener cleanup in EnhancedExportEngine.
 *
 * EDGE-010: When the retry delay timer wins over abort (i.e., the delay
 * completes normally), the abort listener must be removed from the signal.
 * Before the fix, listeners accumulated across retry attempts.
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

const createConfig = (overrides: Partial<ExportConfiguration> = {}): ExportConfiguration => ({
  format: 'mp4',
  quality: baseQuality,
  settings: baseSettings,
  ...overrides,
});

describe('EDGE-010: Abort signal listener cleanup in retry delay', () => {
  test('retry delay should call removeEventListener when timer wins', async () => {
    const engine = new EnhancedExportEngine(2);

    // Track add/removeEventListener calls on the abort signal
    let addCalls = 0;
    let removeCalls = 0;

    let callCount = 0;
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;
    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        callCount++;
        const job = args[0] as { abortController: AbortController };
        const sig = job.abortController.signal;

        // Wrap addEventListener/removeEventListener to count calls
        const origAdd = sig.addEventListener.bind(sig);
        const origRemove = sig.removeEventListener.bind(sig);
        sig.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
          if (type === 'abort') addCalls++;
          return origAdd(type, listener, options);
        }) as typeof sig.addEventListener;
        sig.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
          if (type === 'abort') removeCalls++;
          return origRemove(type, listener, options);
        }) as typeof sig.removeEventListener;

        if (callCount === 1) {
          throw new Error('Out of memory (OOM)');
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
    // After fix: the timer callback calls removeEventListener, so
    // removeCalls >= 1 when the retry delay completes normally.
    expect(removeCalls).toBeGreaterThanOrEqual(1);
    // addCalls should equal removeCalls (balanced, no leak)
    expect(addCalls - removeCalls).toBeLessThanOrEqual(1); // runStageWithTimeout adds/removes too
  }, 15000);

  test('abort during retry delay should reject and cancel export', async () => {
    const engine = new EnhancedExportEngine(2);

    let callCount = 0;
    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function () {
        callCount++;
        throw new Error('heap out of memory');
      }
    );

    const resultPromise = engine.exportVideo(createSceneData(), createConfig());

    // Wait a tick for the first attempt + retry delay to start
    await new Promise((r) => setTimeout(r, 10));

    // Cancel the export
    const activeExports = (engine as unknown as {
      activeExports: Map<string, { abortController: AbortController }>;
    }).activeExports;

    for (const [, job] of activeExports) {
      job.abortController.abort();
    }

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(callCount).toBeGreaterThanOrEqual(1);
  }, 15000);

  test('successful export after retry should not leave abort listeners on signal', async () => {
    const engine = new EnhancedExportEngine(2);

    let callCount = 0;
    const realEncode = (engine as unknown as { encodeVideo: (...a: unknown[]) => Promise<unknown> }).encodeVideo;

    // Track the signal reference
    let trackedSignal: AbortSignal | null = null;
    let addCount = 0;
    let removeCount = 0;

    jest.spyOn(engine as unknown as Record<string, unknown>, 'encodeVideo').mockImplementation(
      async function (...args: unknown[]) {
        callCount++;
        const job = args[0] as { abortController: AbortController };
        if (!trackedSignal) {
          trackedSignal = job.abortController.signal;
          const origAdd = trackedSignal.addEventListener.bind(trackedSignal);
          const origRemove = trackedSignal.removeEventListener.bind(trackedSignal);
          trackedSignal.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
            if (type === 'abort') addCount++;
            return origAdd(type, listener, options);
          }) as typeof trackedSignal.addEventListener;
          trackedSignal.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
            if (type === 'abort') removeCount++;
            return origRemove(type, listener, options);
          }) as typeof trackedSignal.removeEventListener;
        }

        if (callCount === 1) {
          throw new Error('Worker timed out');
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
    expect(trackedSignal).not.toBeNull();
    // After the export completes, all abort listeners should have been removed.
    // addCount and removeCount should be balanced.
    expect(addCount).toBe(removeCount);
  }, 15000);
});
