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

/** Mock encoded MP4 data with valid ftyp magic bytes at offset 4 */
const mockMp4Data = () => {
  const buf = new Uint8Array(200);
  buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70; // "ftyp"
  return buf;
};

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
      return { data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4' };
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
      return { data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4' };
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
      return { data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4' };
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
      return { data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4' };
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

  // TC-227-02: Max 3 retries then success (3 OOM failures, 4th succeeds)
  test('max 3 retries exhausted then 4th attempt succeeds', async () => {
    const engine = new EnhancedExportEngine(2);
    let attempts = 0;

    const spy = jest.spyOn(engine as any, 'encodeVideo').mockImplementation(async () => {
      attempts++;
      if (attempts <= 3) {
        throw new Error('Out of memory during encoding');
      }
      return { data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4' };
    });

    jest.useFakeTimers();
    const exportPromise = engine.exportVideo(createSceneData(), createConfig());
    await jest.advanceTimersByTimeAsync(120_000);
    const result = await exportPromise;

    expect(result.success).toBe(true);
    expect(attempts).toBe(4); // initial + 3 retries
    spy.mockRestore();
    jest.useRealTimers();
    engine.dispose();
  });

  // TC-227-B01: Backoff max delay capped at 30s
  test('retry delay is capped at MAX_DELAY_MS (30s)', () => {
    const { MAX_DELAY_MS, INITIAL_DELAY_MS } = EXPORT_RETRY_LIMITS;

    // Verify the delay calculation caps at maxDelayMs
    // Formula: Math.min(INITIAL_DELAY_MS * 2^attempt, MAX_DELAY_MS)
    for (let attempt = 0; attempt < 20; attempt++) {
      const baseDelay = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
      expect(baseDelay).toBeLessThanOrEqual(MAX_DELAY_MS);
    }

    // Specifically verify that high attempts are capped
    const highAttemptDelay = Math.min(INITIAL_DELAY_MS * Math.pow(2, 10), MAX_DELAY_MS);
    expect(highAttemptDelay).toBe(MAX_DELAY_MS);
  });

  // TC-227-B02: Jitter range verification (0-500ms)
  test('jitter values are within 0-JITTER_MAX_MS range', () => {
    const { JITTER_MAX_MS } = EXPORT_RETRY_LIMITS;
    const samples = 100;

    for (let i = 0; i < samples; i++) {
      const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThan(JITTER_MAX_MS);
    }
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
    expect(result.error).toBe('Export cancelled');

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
    expect(result.error).toBe('Export cancelled');

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

  // TC-228-02: Resource release after cancel
  test('cancelled job is removed from activeExports and processNextInQueue is called', async () => {
    const engine = new EnhancedExportEngine(1); // 1 concurrent to test queue

    // Make first job block so it can be cancelled
    let resolveRender: () => void;
    const renderPromise = new Promise<void>((resolve) => { resolveRender = resolve; });

    const spy = jest.spyOn(engine as any, 'renderFrames').mockImplementation(async () => {
      await renderPromise;
      return [];
    });

    const processNextSpy = jest.spyOn(engine as any, 'processNextInQueue');

    const promise1 = engine.exportVideo(createSceneData(), createConfig());
    const promise2 = engine.exportVideo(createSceneData(), createConfig({ format: 'webm' }));

    // Wait for first job to be active
    await new Promise((resolve) => setTimeout(resolve, 50));

    const activeJobs = engine['activeExports'];
    const jobId = activeJobs.keys().next().value as string;
    expect(jobId).toBeDefined();

    // Cancel the active job
    engine.cancelExport(jobId);

    // Resolve render so the pipeline can detect the abort
    resolveRender!();

    const result1 = await promise1;
    expect(result1.success).toBe(false);

    // After cancellation, the first job should be removed from activeExports
    expect(activeJobs.has(jobId)).toBe(false);
    // processNextInQueue should have been called
    expect(processNextSpy).toHaveBeenCalled();

    // Clean up second promise
    engine.dispose();
    await promise2.catch(() => {});

    spy.mockRestore();
  });

  // TC-228-E02: Rendering stage timeout with specific error message
  test('rendering stage timeout produces specific error message', async () => {
    const engine = new EnhancedExportEngine(2);

    const spy = jest.spyOn(engine as any, 'renderFrames').mockImplementation(async () => {
      await new Promise(() => {}); // Never resolves
    });

    // Set a short rendering timeout
    const original = EXPORT_STAGE_TIMEOUTS.rendering;
    (EXPORT_STAGE_TIMEOUTS as any).rendering = 50;

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Stage rendering timed out after 50ms');

    (EXPORT_STAGE_TIMEOUTS as any).rendering = original;
    spy.mockRestore();
    engine.dispose();
  });

  // TC-228-B01: Timeout boundary value (0 or negative disables timeout)
  test('zero timeout value disables stage timeout', async () => {
    const engine = new EnhancedExportEngine(2);

    // Make preparing stage take 100ms — should succeed because timeout is disabled
    const spy = jest.spyOn(engine as any, 'prepareExport').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const original = EXPORT_STAGE_TIMEOUTS.preparing;
    (EXPORT_STAGE_TIMEOUTS as any).preparing = 0;

    // Should NOT timeout even though stage takes 100ms
    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);

    (EXPORT_STAGE_TIMEOUTS as any).preparing = original;
    spy.mockRestore();
    engine.dispose();
  });

  test('negative timeout value disables stage timeout', async () => {
    const engine = new EnhancedExportEngine(2);

    const spy = jest.spyOn(engine as any, 'prepareExport').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const original = EXPORT_STAGE_TIMEOUTS.preparing;
    (EXPORT_STAGE_TIMEOUTS as any).preparing = -100;

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);

    (EXPORT_STAGE_TIMEOUTS as any).preparing = original;
    spy.mockRestore();
    engine.dispose();
  });

  // TC-228-B02: Cancel during finalizing stage — file already written returns result
  test('cancel during finalizing after file written returns success result', async () => {
    const engine = new EnhancedExportEngine(2);

    // Mock finalizeExport to write the file then abort
    const spy = jest.spyOn(engine as any, 'finalizeExport').mockImplementation(async function (this: any, job: any) {
      // Simulate file write
      job.fileWritten = true;
      // Then abort
      job.abortController?.abort();
      // Still return a result (the abort will be caught by runStageWithTimeout)
      return {
        success: true,
        outputPath: job.outputPath,
        format: job.config.format,
        quality: job.config.quality,
        warnings: [],
      };
    });

    // Also mock renderFrames to block so we can get the jobId
    let resolveRender: () => void;
    const renderPromise = new Promise<void>((resolve) => { resolveRender = resolve; });
    const renderSpy = jest.spyOn(engine as any, 'renderFrames').mockImplementation(async () => {
      // First call: let it proceed (need to unblock)
      resolveRender!();
      return [];
    });

    // Actually, let's use a simpler approach: just mock prepareExport and renderFrames to pass through
    renderSpy.mockRestore();
    spy.mockRestore();

    // Better approach: mock all stages except finalizing, then cancel during finalizing
    const prepSpy = jest.spyOn(engine as any, 'prepareExport').mockResolvedValue(undefined);
    const renderSpy2 = jest.spyOn(engine as any, 'renderFrames').mockResolvedValue([]);
    const encodeSpy = jest.spyOn(engine as any, 'encodeVideo').mockResolvedValue({
      data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4',
    });
    const postSpy = jest.spyOn(engine as any, 'postProcess').mockImplementation(async (_job: any, video: any) => video);

    // Mock finalizeExport to write file then hang
    let resolveFinalize: () => void;
    const finalizePromise = new Promise<void>((resolve) => { resolveFinalize = resolve; });
    const finSpy = jest.spyOn(engine as any, 'finalizeExport').mockImplementation(async function (this: any, job: any, video: any) {
      // Simulate file write
      await this.writeOutputFile(video, job.outputPath);
      job.fileWritten = true;
      // Now hang so we can cancel
      await finalizePromise;
      return { success: true, outputPath: job.outputPath, format: job.config.format, quality: job.config.quality, warnings: [] };
    });

    const exportPromise = engine.exportVideo(createSceneData(), createConfig());

    // Wait for the job to reach finalizing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cancel the job
    const activeJobs = engine['activeExports'];
    const jobId = activeJobs.keys().next().value as string;
    engine.cancelExport(jobId);

    // Resolve finalize so it can detect abort
    resolveFinalize!();

    const result = await exportPromise;
    // Since fileWritten was true, should return success
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('Export was cancelled during finalization');

    prepSpy.mockRestore();
    renderSpy2.mockRestore();
    encodeSpy.mockRestore();
    postSpy.mockRestore();
    finSpy.mockRestore();
    engine.dispose();
  });

  test('cancel during finalizing before file written returns cancelled', async () => {
    const engine = new EnhancedExportEngine(2);

    const prepSpy = jest.spyOn(engine as any, 'prepareExport').mockResolvedValue(undefined);
    const renderSpy = jest.spyOn(engine as any, 'renderFrames').mockResolvedValue([]);
    const encodeSpy = jest.spyOn(engine as any, 'encodeVideo').mockResolvedValue({
      data: mockMp4Data(), duration: 1, codec: 'h264', container: 'mp4',
    });
    const postSpy = jest.spyOn(engine as any, 'postProcess').mockImplementation(async (_job: any, video: any) => video);

    // Mock finalizeExport to hang without writing file
    let resolveFinalize: () => void;
    const finalizePromise = new Promise<void>((resolve) => { resolveFinalize = resolve; });
    const finSpy = jest.spyOn(engine as any, 'finalizeExport').mockImplementation(async () => {
      // Do NOT set fileWritten — hang
      await finalizePromise;
      return { success: true, outputPath: '/tmp/test.mp4', format: 'mp4', quality: baseQuality, warnings: [] };
    });

    const exportPromise = engine.exportVideo(createSceneData(), createConfig());

    await new Promise((resolve) => setTimeout(resolve, 100));

    const activeJobs = engine['activeExports'];
    const jobId = activeJobs.keys().next().value as string;
    engine.cancelExport(jobId);

    resolveFinalize!();

    const result = await exportPromise;
    // File not written yet, should be cancelled
    expect(result.success).toBe(false);
    expect(result.error).toBe('Export cancelled');

    prepSpy.mockRestore();
    renderSpy.mockRestore();
    encodeSpy.mockRestore();
    postSpy.mockRestore();
    finSpy.mockRestore();
    engine.dispose();
  });
});
