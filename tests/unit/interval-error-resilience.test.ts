/**
 * Interval callback error resilience tests.
 *
 * Verifies that setInterval-based monitoring/cleanup timers across
 * export, quality, and optimization modules survive callback errors
 * without crashing the process.  Each test forces the callback to
 * throw on the first tick, then confirms the timer keeps firing on
 * subsequent ticks.
 */

import { MemoryCache } from '@/optimization/memory-cache';
import { ExportJobQueue } from '@/export/export-job-queue';
import { ExportArtifactStore } from '@/export/export-artifact-store';
import { ErrorRecoveryMonitor } from '@/quality/error-recovery-monitor';
import { EnhancedErrorRecovery } from '@/quality/enhanced-error-recovery';
import { errorRecoveryEventBus } from '@/quality/error-recovery-event-bus';

// ---------------------------------------------------------------------------
// MemoryCache
// ---------------------------------------------------------------------------

describe('MemoryCache – interval error resilience', () => {
  let cache: MemoryCache<string>;

  afterEach(() => {
    cache?.destroy();
    jest.useRealTimers();
  });

  test('cleanup timer survives a throwing cleanup() call', () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    cache = new MemoryCache<string>({
      maxSize: 5,
      defaultTtlMs: 60000,
      cleanupIntervalMs: 1000,
    });

    // Force cleanup to throw on the first invocation, then recover.
    const cleanupSpy = jest
      .spyOn(cache, 'cleanup')
      .mockImplementationOnce(() => {
        throw new Error('cleanup boom');
      });

    // First tick — cleanup throws but is caught.
    jest.advanceTimersByTime(1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MemoryCache]'),
      expect.any(Error),
    );

    // Second tick — timer is still alive.
    jest.advanceTimersByTime(1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// ExportJobQueue
// ---------------------------------------------------------------------------

describe('ExportJobQueue – interval error resilience', () => {
  let queue: ExportJobQueue;

  afterEach(() => {
    queue?.stop();
    jest.useRealTimers();
  });

  test('starvation timer survives a throwing preventStarvation() call', () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    queue = new ExportJobQueue({
      maxConcurrent: 1,
      maxQueueSize: 10,
      starvationPreventionInterval: 500,
    });
    queue.start();

    const internal = queue as unknown as { preventStarvation: () => void };
    const starveSpy = jest
      .spyOn(internal, 'preventStarvation')
      .mockImplementationOnce(() => {
        throw new Error('starvation boom');
      });

    // First tick — throws but is caught.
    jest.advanceTimersByTime(500);
    expect(starveSpy).toHaveBeenCalledTimes(1);

    // Second tick — timer still alive.
    jest.advanceTimersByTime(500);
    expect(starveSpy).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// ExportArtifactStore
// ---------------------------------------------------------------------------

describe('ExportArtifactStore – interval error resilience', () => {
  let store: ExportArtifactStore;

  afterEach(() => {
    store?.stop();
    jest.useRealTimers();
  });

  test('cleanup timer survives a throwing cleanupExpired() call', () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    store = new ExportArtifactStore({
      defaultTtlMs: 60000,
      maxStorageBytes: 1024 * 1024,
      maxArtifacts: 100,
      downloadUrlTtlMs: 30000,
      cleanupIntervalMs: 500,
    });
    store.start();

    const internal = store as unknown as { cleanupExpired: () => void };
    const cleanupSpy = jest
      .spyOn(internal, 'cleanupExpired')
      .mockImplementationOnce(() => {
        throw new Error('cleanup boom');
      });

    // First tick — throws but is caught.
    jest.advanceTimersByTime(500);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    // Second tick — timer still alive.
    jest.advanceTimersByTime(500);
    expect(cleanupSpy).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// ErrorRecoveryMonitor
// ---------------------------------------------------------------------------

describe('ErrorRecoveryMonitor – interval error resilience', () => {
  let monitor: ErrorRecoveryMonitor;
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    errorRecoveryEventBus.removeAllListeners();
    errorRecoveryEventBus.clearHistory();
    errorRecoveryEventBus.unmute();
  });

  afterEach(() => {
    monitor?.stop();
    jest.useRealTimers();
  });

  test('sampling timer survives a throwing sample() call', () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    recovery = new EnhancedErrorRecovery();
    monitor = new ErrorRecoveryMonitor(recovery, {
      intervalMs: 500,
      autoStart: false,
    });

    const internal = monitor as unknown as { sample: () => void };
    const sampleSpy = jest
      .spyOn(internal, 'sample')
      .mockImplementationOnce(() => {
        throw new Error('sample boom');
      });

    monitor.start();

    // First scheduled tick (initial sample() is called synchronously in start()).
    // The start() method calls sample() once immediately — that's the first call.
    // The first interval tick is the second call.
    jest.advanceTimersByTime(500);
    expect(sampleSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    // Second interval tick — timer still alive.
    jest.advanceTimersByTime(500);
    expect(sampleSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

    errorSpy.mockRestore();
  });
});
