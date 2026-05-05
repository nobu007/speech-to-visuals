/**
 * Unit tests for worker delegation helpers in EnhancedExportEngine
 *
 * Tests processExportViaWorker and buildFramesFromWorkerResult
 * private methods at unit level, including the disposed-flag guard.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { WorkerResponse, ExportWorkerResult } from '../types';

// Mock workers module
jest.mock('../index', () => ({
  WorkerPool: jest.fn(),
  isWorkerAvailable: jest.fn(() => false),
  getOptimalWorkerCount: jest.fn(() => 2),
  processExportPayload: jest.fn(),
}));

jest.mock('../worker-pool', () => ({
  WorkerPool: jest.fn(),
}));

// Mock worker-factories to avoid import.meta issues
jest.mock('../worker-factories', () => ({
  createExportWorkerFactory: jest.fn(() => () => {
    throw new Error('Worker factory should not be called in tests');
  }),
}));

import { EnhancedExportEngine } from '../../export/enhanced-export-engine';

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Create an engine with a mock pool injected by overriding getWorkerPool.
 * This is necessary because getWorkerPool() has lazy initialization
 * that would create a real WorkerPool.
 */
function createEngineWithPool(poolMock: any): EnhancedExportEngine {
  const engine = new EnhancedExportEngine(2, false);
  (engine as any).useWorkers = true;
  (engine as any).getWorkerPool = () => poolMock;
  return engine;
}

function makePoolMock(executeReturn: any): any {
  return {
    execute: jest.fn().mockResolvedValue(executeReturn as never),
    terminate: jest.fn(),
    isTerminated: false,
  };
}

// ---------- processExportViaWorker ----------

describe('processExportViaWorker (private)', () => {
  it.each([
    ['pool is null', null],
    ['worker response has error', { id: 't', type: 'EXPORT_RENDER', error: { code: 'WORKER_ERROR', message: 'fail' } }],
    ['payload is undefined', { id: 't', type: 'EXPORT_RENDER' }],
  ] as const)('returns null when %s', async (_desc, poolResponse) => {
    const poolMock = poolResponse === null ? null : makePoolMock(poolResponse as any);
    const engine = createEngineWithPool(poolMock);
    const result = await (engine as any).processExportViaWorker(createJob(), 30, 10);
    expect(result).toBeNull();
  });

  it('returns null when pool.execute throws', async () => {
    const poolMock = {
      execute: jest.fn().mockRejectedValue(new Error('Worker crashed') as never),
      terminate: jest.fn(),
      isTerminated: false,
    };
    const engine = createEngineWithPool(poolMock);
    const result = await (engine as any).processExportViaWorker(createJob(), 30, 10);
    expect(result).toBeNull();
  });

  it('returns worker result on successful execution', async () => {
    const workerResult: ExportWorkerResult = {
      outputSize: 500000,
      duration: 10,
      warnings: [],
    };
    const poolMock = makePoolMock({
      id: 'test-id',
      type: 'EXPORT_RENDER',
      payload: workerResult,
    } as WorkerResponse<ExportWorkerResult>);
    const engine = createEngineWithPool(poolMock);
    const job = createJob();

    const result = await (engine as any).processExportViaWorker(job, 30, 10);

    expect(result).toEqual(workerResult);
    expect(poolMock.execute).toHaveBeenCalledTimes(1);

    // Verify the message sent to the pool
    const sentMessage = poolMock.execute.mock.calls[0][0];
    expect(sentMessage.type).toBe('EXPORT_RENDER');
    expect(sentMessage.payload).toEqual({
      format: 'mp4',
      data: job.sceneData,
      options: { fps: 30, duration: 10, avgFrameSize: 50000 },
    });
  });

  it('uses correct fps and duration in payload options', async () => {
    const poolMock = makePoolMock({
      id: 'test-id',
      type: 'EXPORT_RENDER',
      payload: { outputSize: 100 },
    } as WorkerResponse);
    const engine = createEngineWithPool(poolMock);
    const job = createJob({ format: 'webm' });

    await (engine as any).processExportViaWorker(job, 60, 5);

    const sentMessage = poolMock.execute.mock.calls[0][0];
    expect(sentMessage.payload.format).toBe('webm');
    expect(sentMessage.payload.options.fps).toBe(60);
    expect(sentMessage.payload.options.duration).toBe(5);
  });

  it('uses job id as message id', async () => {
    const poolMock = makePoolMock({
      id: 'my-custom-id',
      type: 'EXPORT_RENDER',
      payload: {},
    } as WorkerResponse);
    const engine = createEngineWithPool(poolMock);
    const job = createJob();

    await (engine as any).processExportViaWorker(job, 30, 10);

    const sentMessage = poolMock.execute.mock.calls[0][0];
    expect(sentMessage.id).toBe('test-job-001');
  });
});

// ---------- buildFramesFromWorkerResult ----------

describe('buildFramesFromWorkerResult (private)', () => {
  it.each([
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
    ['1440p', 2560, 1440],
    ['4k', 3840, 2160],
  ] as const)('creates frames with correct dimensions for %s', (res, w, h) => {
    const engine = new EnhancedExportEngine(2, false);
    const quality = { resolution: res as any, fps: 30 as const, bitrate: 'auto' as const, hdr: false };

    const frames = (engine as any).buildFramesFromWorkerResult(1, 30, quality, {});

    expect(frames[0].width).toBe(w);
    expect(frames[0].height).toBe(h);
    expect(frames[0].data.length).toBe(w * h * 4);
    engine.dispose();
  });

  it('creates correct number of frames', () => {
    const engine = new EnhancedExportEngine(2, false);
    const quality = { resolution: '1080p' as const, fps: 30 as const, bitrate: 'auto' as const, hdr: false };

    const frames = (engine as any).buildFramesFromWorkerResult(10, 30, quality, {});

    expect(frames).toHaveLength(10);
    engine.dispose();
  });

  it('returns empty array for zero totalFrames', () => {
    const engine = new EnhancedExportEngine(2, false);
    const quality = { resolution: '1080p' as const, fps: 30 as const, bitrate: 'auto' as const, hdr: false };

    const frames = (engine as any).buildFramesFromWorkerResult(0, 30, quality, {});

    expect(frames).toHaveLength(0);
    engine.dispose();
  });

  it.each([
    [30, [0, 1 / 30, 2 / 30]],
    [60, [0, 1 / 60, 2 / 60]],
  ] as const)('assigns correct timestamps at %d fps', (fps, expected) => {
    const engine = new EnhancedExportEngine(2, false);
    const quality = { resolution: '1080p' as const, fps: fps as any, bitrate: 'auto' as const, hdr: false };

    const frames = (engine as any).buildFramesFromWorkerResult(3, fps, quality, {});

    expected.forEach((ts, i) => {
      expect(frames[i].timestamp).toBeCloseTo(ts);
    });
    engine.dispose();
  });

  it('each frame has Uint8Array data buffer', () => {
    const engine = new EnhancedExportEngine(2, false);
    const quality = { resolution: '1080p' as const, fps: 30 as const, bitrate: 'auto' as const, hdr: false };

    const frames = (engine as any).buildFramesFromWorkerResult(3, 30, quality, {});

    for (const frame of frames) {
      expect(frame.data).toBeInstanceOf(Uint8Array);
    }
    engine.dispose();
  });
});

// ---------- Disposed-flag guard (Export Engine) ----------

describe('Export engine disposed-flag guard', () => {
  it('getWorkerPool returns null after dispose', () => {
    const engine = new EnhancedExportEngine(2, false);
    (engine as any).useWorkers = true;
    engine.dispose();

    expect((engine as any).getWorkerPool()).toBeNull();
  });

  it('isWorkerEnabled returns false after dispose', () => {
    const engine = new EnhancedExportEngine(2, false);
    (engine as any).useWorkers = true;
    engine.dispose();

    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('processExportViaWorker returns null on disposed engine', async () => {
    const engine = new EnhancedExportEngine(2, false);
    (engine as any).useWorkers = true;
    engine.dispose();

    const result = await (engine as any).processExportViaWorker(createJob(), 30, 10);
    expect(result).toBeNull();
  });

  it('export still succeeds after dispose (main-thread fallback)', async () => {
    const engine = new EnhancedExportEngine(2, false);
    engine.dispose();

    const result = await engine.exportVideo(
      { scenes: [{ duration: 2 }] },
      {
        format: 'mp4',
        quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
        settings: { loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' },
      },
    );

    expect(result.success).toBe(true);
  });
});

// ---------- Smoke test: dispose then reuse ----------

describe('Export engine dispose-then-reuse smoke test', () => {
  it('dispose followed by export falls back cleanly', async () => {
    const engine = new EnhancedExportEngine(2, true); // useWorkers=true

    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);

    const result = await engine.exportVideo(
      { scenes: [{ duration: 1 }] },
      {
        format: 'mp4',
        quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
        settings: { loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' },
      },
    );

    expect(result.success).toBe(true);
    expect(result.format).toBe('mp4');
  });

  it('double dispose then export still works', async () => {
    const engine = new EnhancedExportEngine(2, true);
    engine.dispose();
    engine.dispose();
    engine.dispose();

    const result = await engine.exportVideo(
      { scenes: [{ duration: 1 }] },
      {
        format: 'webm',
        quality: { resolution: '720p', fps: 24, bitrate: 'auto', hdr: false },
        settings: { loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' },
      },
    );

    expect(result.success).toBe(true);
    expect(result.format).toBe('webm');
  });
});

// ---------- Helpers ----------

function createJob(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'test-job-001',
    sceneData: { scenes: [{ duration: 2, type: 'intro' }] },
    config: {
      format: (overrides.format as string) || 'mp4',
      quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
      settings: { duration: 10, loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' },
    },
    status: 'preparing',
    progress: 0,
    startTime: new Date(),
    ...overrides,
  };
}
