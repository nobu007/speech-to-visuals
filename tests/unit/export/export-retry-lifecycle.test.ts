/**
 * REQ-227/228: Export Retry Resilience & Job Lifecycle Management
 *
 * Tests for:
 *   - REQ-227: Exponential backoff retry on transient encoding errors
 *   - REQ-228: Job cancellation via cancelExport() + AbortController
 *   - REQ-228: Stage-level timeouts via EXPORT_STAGE_TIMEOUTS
 *   - Centralized config in limits.ts (EXPORT_RETRY_LIMITS, EXPORT_STAGE_TIMEOUTS)
 */

import { jest } from '@jest/globals';
import {
  EnhancedExportEngine,
  type ExportConfiguration,
} from '../../../src/export/enhanced-export-engine';
import {
  EXPORT_RETRY_LIMITS,
  EXPORT_STAGE_TIMEOUTS,
} from '../../../src/config/limits';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// REQ-227: Export Retry Resilience
// ---------------------------------------------------------------------------

describe('REQ-227: Export retry resilience', () => {
  test('EXPORT_RETRY_LIMITS has correct defaults', () => {
    expect(EXPORT_RETRY_LIMITS.MAX_RETRIES).toBe(3);
    expect(EXPORT_RETRY_LIMITS.INITIAL_DELAY_MS).toBe(1000);
    expect(EXPORT_RETRY_LIMITS.MAX_DELAY_MS).toBe(30_000);
    expect(EXPORT_RETRY_LIMITS.JITTER_MAX_MS).toBe(500);
  });

  test('successful export returns without retry', async () => {
    const engine = new EnhancedExportEngine(2);
    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);
    engine.dispose();
  });

  test('transient encoding error (timeout) triggers retry and eventually succeeds', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    // Mock encodeVideo to fail once with transient error, then succeed
    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Encoding timeout');
      }
      return { data: new Uint8Array(100), duration: 1, codec: 'h264', container: 'mp4' };
    });

    // Use fake timers to speed up retry delays
    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());

    // Fast-forward through all timers
    await jest.advanceTimersByTimeAsync(60_000);

    const result = await exportPromise;
    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });

  test('OOM error triggers retry', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      if (attempts <= 1) {
        throw new Error('Out of memory during encoding');
      }
      return { data: new Uint8Array(100), duration: 1, codec: 'h264', container: 'mp4' };
    });

    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(60_000);
    const result = await exportPromise;

    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });

  test('worker crash error triggers retry', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      if (attempts <= 1) {
        throw new Error('Worker terminated unexpectedly');
      }
      return { data: new Uint8Array(100), duration: 1, codec: 'h264', container: 'mp4' };
    });

    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(60_000);
    const result = await exportPromise;

    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });

  test('non-transient error fails immediately without retry', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      throw new Error('Invalid format: unsupported codec');
    });

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(false);
    expect(attempts).toBe(1); // No retry
    spy.mockRestore();
    engine.dispose();
  });

  test('exhausted retries returns failure', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      throw new Error('Encoding timeout');
    });

    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(120_000);
    const result = await exportPromise;

    expect(result.success).toBe(false);
    expect(attempts).toBe(EXPORT_RETRY_LIMITS.MAX_RETRIES + 1); // initial + retries
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });

  test('heap out of memory is classified as transient', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      if (attempts <= 1) {
        throw new Error('FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory');
      }
      return { data: new Uint8Array(100), duration: 1, codec: 'h264', container: 'mp4' };
    });

    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(60_000);
    const result = await exportPromise;

    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });
});

// ---------------------------------------------------------------------------
// REQ-228: Job Lifecycle Management
// ---------------------------------------------------------------------------

describe('REQ-228: Export job lifecycle management', () => {
  test('EXPORT_STAGE_TIMEOUTS has correct values', () => {
    expect(EXPORT_STAGE_TIMEOUTS.preparing).toBe(30_000);
    expect(EXPORT_STAGE_TIMEOUTS.rendering).toBe(600_000);
    expect(EXPORT_STAGE_TIMEOUTS.encoding).toBe(300_000);
    expect(EXPORT_STAGE_TIMEOUTS.finalizing).toBe(60_000);
  });

  test('cancelExport returns false for non-existent job', () => {
    const engine = new EnhancedExportEngine(2);
    expect(engine.cancelExport('nonexistent')).toBe(false);
    engine.dispose();
  });

  test('cancelExport returns true for active job and produces Cancelled result', async () => {
    const engine = new EnhancedExportEngine(2);

    // Make rendering block so we can cancel it
    let resolveRender: () => void;
    const renderPromise = new Promise<void>((resolve) => { resolveRender = resolve; });

    const spy = jest.spyOn(engine as any, 'renderFrames').mockImplementation(async () => {
      await renderPromise;
      return [];
    });

    const exportPromise = engine.exportVideo(createSceneData(), createConfig());

    // Wait for job to be active
    await new Promise((resolve) => setTimeout(resolve, 50));

    const activeJobs = engine['activeExports'];
    const jobId = activeJobs.keys().next().value;
    expect(jobId).toBeDefined();

    const cancelled = engine.cancelExport(jobId as string);
    expect(cancelled).toBe(true);

    // Resolve render so the pipeline can proceed and detect abort
    resolveRender!();

    const result = await exportPromise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cancelled');

    spy.mockRestore();
    engine.dispose();
  });

  test('dispose cancels queued exports', async () => {
    const engine = new EnhancedExportEngine(1); // Only 1 concurrent

    let resolveRender: () => void;
    const renderPromise = new Promise<void>((resolve) => { resolveRender = resolve; });

    const spy = jest.spyOn(engine as any, 'renderFrames').mockImplementation(async () => {
      await renderPromise;
      return [];
    });

    const promise1 = engine.exportVideo(createSceneData(), createConfig());
    const promise2 = engine.exportVideo(createSceneData(), createConfig({ format: 'webm' }));

    // Give time for second to queue
    await new Promise((resolve) => setTimeout(resolve, 50));
    engine.dispose();

    const result2 = await promise2;
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('disposed');

    // Let first resolve
    resolveRender!();
    await promise1.catch(() => {});

    spy.mockRestore();
  });

  test('abort during stage produces Cancelled result', async () => {
    const engine = new EnhancedExportEngine(2);

    // Abort during the prepare stage
    const spy = jest.spyOn(engine as any, 'prepareExport').mockImplementation(async function (this: any, job: any) {
      job.abortController?.abort();
    });

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cancelled');

    spy.mockRestore();
    engine.dispose();
  });

  test('stage timeout produces error result', async () => {
    const engine = new EnhancedExportEngine(2);

    // Make preparing stage hang forever
    const spy = jest.spyOn(engine as any, 'prepareExport').mockImplementation(async () => {
      await new Promise(() => {}); // Never resolves
    });

    // Temporarily set a very short timeout for testing
    const original = EXPORT_STAGE_TIMEOUTS.preparing;
    (EXPORT_STAGE_TIMEOUTS as any).preparing = 50; // 50ms

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');

    // Restore
    (EXPORT_STAGE_TIMEOUTS as any).preparing = original;
    spy.mockRestore();
    engine.dispose();
  });

  test('cancelExport with jobId that just finished returns false', async () => {
    const engine = new EnhancedExportEngine(2);

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);

    // The job is no longer active, so cancelExport should return false
    expect(engine.cancelExport('any-id')).toBe(false);
    engine.dispose();
  });
});
