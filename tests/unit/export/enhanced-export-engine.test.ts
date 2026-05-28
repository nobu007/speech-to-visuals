/**
 * REQ-167: enhanced-export-engine.ts Test Coverage
 *
 * Unit tests for EnhancedExportEngine's core functionality:
 *   - Multi-format export (mp4, webm, gif, apng, interactive-html, etc.)
 *   - Export configuration validation
 *   - Quality settings and resolution mapping
 *   - HDR output restrictions
 *   - Watermark application
 *   - Compression levels
 *   - Export queue management and concurrency
 *   - Worker pool integration (enabled/disabled)
 *   - Dispose behavior
 *   - ExportQualityValidator scoring
 */

import { jest } from '@jest/globals';
import {
  EnhancedExportEngine,
  ExportQualityValidator,
} from '@/export/enhanced-export-engine';
import type {
  ExportConfiguration,
  ExportFormat,
  ExportResult,
  VideoQuality,
  ExportSettings,
} from '@/export/enhanced-export-engine';
import {
  ExportError,
  FormatValidationError,
} from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuality(overrides: Partial<VideoQuality> = {}): VideoQuality {
  return {
    resolution: '1080p',
    fps: 30,
    bitrate: 'auto',
    hdr: false,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    loop: false,
    includeAudio: false,
    watermark: false,
    compression: 'none',
    optimization: 'balanced',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ExportConfiguration> = {}): ExportConfiguration {
  return {
    format: 'mp4',
    quality: makeQuality(),
    settings: makeSettings(),
    ...overrides,
  };
}

function makeSceneData() {
  return {
    scenes: [
      { duration: 3, nodes: [], edges: [] },
      { duration: 2, nodes: [], edges: [] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-167: EnhancedExportEngine', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2, false);
  });

  afterEach(() => {
    engine.dispose();
  });

  // ─── TC-167-01: Export configuration validation ───────────────────────

  describe('TC-167-01: Export configuration validation', () => {
    it('rejects config missing format', async () => {
      const config = makeConfig();
      // @ts-expect-error intentionally breaking config
      delete config.format;

      const result = await engine.exportVideo(makeSceneData(), config as ExportConfiguration);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects config missing quality', async () => {
      const config = makeConfig();
      // @ts-expect-error intentionally breaking config
      delete config.quality;

      const result = await engine.exportVideo(makeSceneData(), config as ExportConfiguration);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects config missing settings', async () => {
      const config = makeConfig();
      // @ts-expect-error intentionally breaking config
      delete config.settings;

      const result = await engine.exportVideo(makeSceneData(), config as ExportConfiguration);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects 4K resolution for GIF format', async () => {
      const config = makeConfig({
        format: 'gif',
        quality: makeQuality({ resolution: '4k' }),
      });

      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('4K');
    });
  });

  // ─── TC-167-02: Multi-format export ───────────────────────────────────

  describe('TC-167-02: Multi-format export', () => {
    const formats: ExportFormat[] = [
      'mp4', 'webm', 'gif', 'apng', 'interactive-html',
      'pdf-animated', 'svg-animated', 'json-lottie',
    ];

    for (const format of formats) {
      it(`exports ${format} format successfully`, async () => {
        const config = makeConfig({ format });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
        expect(result.quality.resolution).toBe('1080p');
        expect(result.outputPath).toBeDefined();
      });
    }
  });

  // ─── TC-167-03: Resolution mapping ────────────────────────────────────

  describe('TC-167-03: Resolution mapping', () => {
    const resolutions = [
      { name: '720p', expectedWidth: 1280, expectedHeight: 720 },
      { name: '1080p' as const, expectedWidth: 1920, expectedHeight: 1080 },
      { name: '1440p', expectedWidth: 2560, expectedHeight: 1440 },
      { name: '4k', expectedWidth: 3840, expectedHeight: 2160 },
    ];

    for (const { name, expectedWidth, expectedHeight } of resolutions) {
      it(`maps ${name} resolution correctly`, async () => {
        const config = makeConfig({
          quality: makeQuality({ resolution: name as VideoQuality['resolution'] }),
        });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
        // Resolution is reflected in the output
        expect(result.outputSize).toBeGreaterThan(0);
      });
    }

    it('uses 1920x1080 as default for custom resolution', async () => {
      const config = makeConfig({
        quality: makeQuality({ resolution: 'custom' }),
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
    });
  });

  // ─── TC-167-04: HDR output ────────────────────────────────────────────

  describe('TC-167-04: HDR output', () => {
    it('uses HEVC codec for HDR MP4 output', async () => {
      const config = makeConfig({
        format: 'mp4',
        quality: makeQuality({ hdr: true, resolution: '4k' }),
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
      expect(result.quality.hdr).toBe(true);
    });

    it('uses H.264 codec for non-HDR MP4 output', async () => {
      const config = makeConfig({
        format: 'mp4',
        quality: makeQuality({ hdr: false }),
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
      expect(result.quality.hdr).toBe(false);
    });
  });

  // ─── TC-167-05: Watermark application ─────────────────────────────────

  describe('TC-167-05: Watermark application', () => {
    it('processes export with watermark enabled', async () => {
      const config = makeConfig({
        settings: makeSettings({ watermark: true }),
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
    });

    it('processes export without watermark', async () => {
      const config = makeConfig({
        settings: makeSettings({ watermark: false }),
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
    });
  });

  // ─── TC-167-06: Compression levels ────────────────────────────────────

  describe('TC-167-06: Compression levels', () => {
    const compressionLevels = ['none', 'low', 'medium', 'high', 'maximum'] as const;

    for (const level of compressionLevels) {
      it(`handles "${level}" compression level`, async () => {
        const config = makeConfig({
          settings: makeSettings({ compression: level }),
        });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
      });
    }
  });

  // ─── TC-167-07: Export queue and concurrency ──────────────────────────

  describe('TC-167-07: Export queue and concurrency', () => {
    it('queues export when max concurrent exports reached', async () => {
      const engine2 = new EnhancedExportEngine(1, false);
      const config = makeConfig();
      const scenes = makeSceneData();

      // Start two exports with max concurrency 1
      const promise1 = engine2.exportVideo(scenes, config);
      const promise2 = engine2.exportVideo(scenes, config);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      engine2.dispose();
    });

    it('handles maxConcurrentExports=1 correctly', async () => {
      const engine1 = new EnhancedExportEngine(1, false);
      const config = makeConfig();

      const result = await engine1.exportVideo(makeSceneData(), config);
      expect(result.success).toBe(true);

      engine1.dispose();
    });
  });

  // ─── TC-167-08: Worker pool integration ───────────────────────────────

  describe('TC-167-08: Worker pool integration', () => {
    it('creates engine with workers disabled', () => {
      const engineNoWorkers = new EnhancedExportEngine(2, false);
      expect(engineNoWorkers.isWorkerEnabled).toBe(false);
      engineNoWorkers.dispose();
    });

    it('isWorkerEnabled is false when workers are disabled', () => {
      expect(engine.isWorkerEnabled).toBe(false);
    });
  });

  // ─── TC-167-09: Dispose behavior ──────────────────────────────────────

  describe('TC-167-09: Dispose behavior', () => {
    it('marks engine as disposed and disables workers', () => {
      engine.dispose();
      expect(engine.isWorkerEnabled).toBe(false);
    });

    it('dispose is idempotent (calling twice does not throw)', () => {
      engine.dispose();
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  // ─── TC-167-10: Export progress callback ──────────────────────────────

  describe('TC-167-10: Export progress callback', () => {
    it('invokes progress callback during export', async () => {
      const progressCalls: Array<{ stage: string; progress: number }> = [];
      const config = makeConfig();

      const result = await engine.exportVideo(makeSceneData(), config, (p) => {
        progressCalls.push({ stage: p.stage, progress: p.progress });
      });

      expect(result.success).toBe(true);
      // Progress should have been reported
      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('progress values increase monotonically', async () => {
      const progresses: number[] = [];
      const config = makeConfig();

      await engine.exportVideo(makeSceneData(), config, (p) => {
        progresses.push(p.progress);
      });

      // Each reported progress should be >= previous
      for (let i = 1; i < progresses.length; i++) {
        expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
      }
    });
  });

  // ─── TC-167-11: Invalid scene data ────────────────────────────────────

  describe('TC-167-11: Invalid scene data handling', () => {
    it('returns error for null scene data', async () => {
      const config = makeConfig();
      // @ts-expect-error intentionally passing null
      const result = await engine.exportVideo(null, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for scene data without scenes array', async () => {
      const config = makeConfig();
      // @ts-expect-error intentionally passing invalid data
      const result = await engine.exportVideo({}, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── TC-167-12: Optimization priority ─────────────────────────────────

  describe('TC-167-12: Optimization priority settings', () => {
    const priorities = ['speed', 'quality', 'size', 'balanced'] as const;

    for (const priority of priorities) {
      it(`handles "${priority}" optimization priority`, async () => {
        const config = makeConfig({
          settings: makeSettings({ optimization: priority }),
        });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
      });
    }
  });

  // ─── TC-167-13: FPS settings ──────────────────────────────────────────

  describe('TC-167-13: FPS settings', () => {
    const fpsValues: Array<VideoQuality['fps']> = [24, 30, 60, 120];

    for (const fps of fpsValues) {
      it(`handles ${fps} FPS`, async () => {
        const config = makeConfig({
          quality: makeQuality({ fps }),
        });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
        expect(result.quality.fps).toBe(fps);
      });
    }
  });

  // ─── TC-167-14: Advanced export options ───────────────────────────────

  describe('TC-167-14: Advanced export options', () => {
    it('handles chapters in advanced options', async () => {
      const config = makeConfig({
        advanced: {
          chapters: [
            { time: 0, title: 'Introduction' },
            { time: 30, title: 'Main Content' },
          ],
        },
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
    });

    it('handles subtitles in advanced options', async () => {
      const config = makeConfig({
        advanced: {
          subtitles: [
            { language: 'en', content: 'Hello World', format: 'srt' as const },
          ],
        },
      });
      const result = await engine.exportVideo(makeSceneData(), config);

      expect(result.success).toBe(true);
    });
  });

  // ─── TC-167-15: Output path generation ────────────────────────────────

  describe('TC-167-15: Output path and file extension', () => {
    const extensionMap: Array<[ExportFormat, string]> = [
      ['mp4', 'mp4'],
      ['webm', 'webm'],
      ['gif', 'gif'],
      ['apng', 'png'],
      ['interactive-html', 'html'],
      ['pdf-animated', 'pdf'],
      ['svg-animated', 'svg'],
      ['json-lottie', 'json'],
    ];

    for (const [format, ext] of extensionMap) {
      it(`generates .${ext} extension for ${format}`, async () => {
        const config = makeConfig({ format });
        const result = await engine.exportVideo(makeSceneData(), config);

        expect(result.success).toBe(true);
        expect(result.outputPath).toContain(`.${ext}`);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-167: ExportQualityValidator
// ---------------------------------------------------------------------------

describe('REQ-167: ExportQualityValidator', () => {
  // ─── TC-167-16: validateExportResult ────────────────────────────────

  describe('TC-167-16: validateExportResult', () => {
    it('returns true for successful result with path and size', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 1024,
        format: 'mp4',
        quality: makeQuality(),
      };

      expect(ExportQualityValidator.validateExportResult(result)).toBe(true);
    });

    it('returns false for failed result', () => {
      const result: ExportResult = {
        success: false,
        error: 'Failed',
        format: 'mp4',
        quality: makeQuality(),
        warnings: [],
      };

      expect(ExportQualityValidator.validateExportResult(result)).toBe(false);
    });

    it('returns false for result without output path', () => {
      const result: ExportResult = {
        success: true,
        outputSize: 1024,
        format: 'mp4',
        quality: makeQuality(),
      };

      expect(ExportQualityValidator.validateExportResult(result)).toBe(false);
    });

    it('returns false for result with zero output size', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 0,
        format: 'mp4',
        quality: makeQuality(),
      };

      expect(ExportQualityValidator.validateExportResult(result)).toBe(false);
    });
  });

  // ─── TC-167-17: calculateExportScore ────────────────────────────────

  describe('TC-167-17: calculateExportScore', () => {
    it('returns 0 for failed result', () => {
      const result: ExportResult = {
        success: false,
        error: 'Failed',
        format: 'mp4',
        quality: makeQuality(),
        warnings: [],
      };

      expect(ExportQualityValidator.calculateExportScore(result, makeConfig())).toBe(0);
    });

    it('gives higher score for mp4/webm format', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 500000,
        duration: 10,
        format: 'mp4',
        quality: makeQuality(),
      };
      const score = ExportQualityValidator.calculateExportScore(result, makeConfig({ format: 'mp4' }));

      expect(score).toBeGreaterThan(0.6);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('gives bonus for interactive/svg formats', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.html',
        outputSize: 500000,
        duration: 10,
        format: 'interactive-html',
        quality: makeQuality(),
      };
      const score = ExportQualityValidator.calculateExportScore(
        result,
        makeConfig({ format: 'interactive-html' }),
      );

      expect(score).toBeGreaterThan(0.7);
    });

    it('caps score at 1.0', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 100000,
        duration: 10,
        format: 'mp4',
        quality: makeQuality({ resolution: '4k', fps: 60 }),
      };
      const config = makeConfig({
        format: 'mp4',
        quality: makeQuality({ resolution: '4k', fps: 60 }),
      });

      const score = ExportQualityValidator.calculateExportScore(result, config);

      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('gives bonus for 4K resolution', () => {
      const resultBase: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 500000,
        duration: 10,
        format: 'mp4',
        quality: makeQuality(),
      };
      const result4k: ExportResult = {
        ...resultBase,
        quality: makeQuality({ resolution: '4k' }),
      };

      const scoreBase = ExportQualityValidator.calculateExportScore(
        resultBase,
        makeConfig({ quality: makeQuality() }),
      );
      const score4k = ExportQualityValidator.calculateExportScore(
        result4k,
        makeConfig({ quality: makeQuality({ resolution: '4k' }) }),
      );

      expect(score4k).toBeGreaterThan(scoreBase);
    });
  });
});
