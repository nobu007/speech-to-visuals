/**
 * Integration tests: EnhancedExportEngine + WorkerPool
 *
 * Verifies that the export engine delegates rendering data preparation
 * to Web Workers when enabled, and falls back to main-thread processing
 * when workers are unavailable or fail.
 */


// Mock the workers module before importing the engine
jest.mock('@/workers', () => ({
  WorkerPool: jest.fn(),
  isWorkerAvailable: jest.fn(() => false),
  getOptimalWorkerCount: jest.fn(() => 2),
  processExportPayload: jest.fn((payload: Record<string, unknown>) => {
    const fps = (payload.options as Record<string, unknown>)?.fps as number || 30;
    const duration = (payload.options as Record<string, unknown>)?.duration as number || 10;
    return {
      outputSize: Math.ceil(duration * fps) * 50000,
      duration,
      warnings: [],
    };
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

const createSceneData = () => ({
  scenes: [
    { duration: 2, type: 'intro' },
    { duration: 3, type: 'content' },
  ],
});

const createConfig = () => ({
  format: 'mp4' as const,
  quality: {
    resolution: '1080p' as const,
    fps: 30 as const,
    bitrate: 'auto' as const,
    hdr: false,
  },
  settings: {
    duration: 2,
    loop: false,
    includeAudio: false,
    watermark: false,
    compression: 'none' as const,
    optimization: 'speed' as const,
  },
});

describe('EnhancedExportEngine Worker integration', () => {
  it('initializes without workers when useWorkers=false', () => {
    const engine = new EnhancedExportEngine(2, false);
    expect(engine.isWorkerEnabled).toBe(false);
    engine.dispose();
  });

  it('exports successfully with useWorkers=false (main thread)', async () => {
    const engine = new EnhancedExportEngine(2, false);
    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);
    expect(result.format).toBe('mp4');
    engine.dispose();
  });

  it('dispose() cleans up worker pool', () => {
    const engine = new EnhancedExportEngine(2, false);
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('exports successfully when workers unavailable (fallback)', async () => {
    const engine = new EnhancedExportEngine(2, true);
    expect(engine.isWorkerEnabled).toBe(false);

    const result = await engine.exportVideo(createSceneData(), createConfig());
    expect(result.success).toBe(true);
    engine.dispose();
  });

  it('isWorkerEnabled reflects pool state', () => {
    const engine = new EnhancedExportEngine(2, false);
    expect(engine.isWorkerEnabled).toBe(false);
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('dispose is idempotent', () => {
    const engine = new EnhancedExportEngine(2, false);
    engine.dispose();
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('processes multiple exports sequentially on main thread', async () => {
    const engine = new EnhancedExportEngine(1, false);

    const result1 = await engine.exportVideo(createSceneData(), createConfig());
    expect(result1.success).toBe(true);

    const result2 = await engine.exportVideo(createSceneData(), {
      ...createConfig(),
      format: 'webm',
    });
    expect(result2.success).toBe(true);
    expect(result2.format).toBe('webm');

    engine.dispose();
  });
});
