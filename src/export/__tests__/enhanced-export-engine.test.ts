/**
 * Tests for EnhancedExportEngine
 * Covers: export formats, HDR, watermark, compression, optimization, validation, queue
 */

import {
  EnhancedExportEngine,
  ExportQualityValidator,
  ExportConfiguration,
  ExportFormat,
  ExportResult,
} from '../enhanced-export-engine';

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
    { duration: 1, type: 'outro' },
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

describe('EnhancedExportEngine', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2);
  });

  // --- Export Format Support ---

  describe('export formats', () => {
    test('should export MP4 format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'mp4' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('mp4');
    });

    test('should export WebM format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'webm' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('webm');
    });

    test('should export GIF format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'gif' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('gif');
    });

    test('should export interactive-html format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'interactive-html' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('interactive-html');
    });

    test('should export pdf-animated format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'pdf-animated' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf-animated');
    });

    test('should export svg-animated format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'svg-animated' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('svg-animated');
    });

    test('should export json-lottie format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'json-lottie' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('json-lottie');
    });

    test('should reject apng format as unsupported', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'apng' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });
  });

  // --- HDR Support ---

  describe('HDR output', () => {
    test('should export with HDR enabled (HEVC codec)', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'mp4',
          quality: { ...baseQuality, hdr: true },
        })
      );
      expect(result.success).toBe(true);
    });

    test('should export with HDR disabled (H264 codec)', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'mp4',
          quality: { ...baseQuality, hdr: false },
        })
      );
      expect(result.success).toBe(true);
    });

    test('should support advanced dynamic range options', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'mp4',
          advanced: { dynamicRange: 'HDR10' },
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // --- Watermark ---

  describe('watermark', () => {
    test('should apply watermark when enabled', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: { ...baseSettings, watermark: true },
        })
      );
      expect(result.success).toBe(true);
    });

    test('should skip watermark when disabled', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: { ...baseSettings, watermark: false },
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // --- Compression Levels ---

  describe('compression levels', () => {
    const compressionLevels = ['none', 'low', 'medium', 'high', 'maximum'] as const;

    compressionLevels.forEach((level) => {
      test(`should support compression level: ${level}`, async () => {
        const result = await engine.exportVideo(
          createSceneData(),
          createConfig({
            settings: { ...baseSettings, compression: level },
          })
        );
        expect(result.success).toBe(true);
      });
    });
  });

  // --- Optimization Priority ---

  describe('optimization priority', () => {
    const priorities = ['speed', 'balanced', 'quality', 'size'] as const;

    priorities.forEach((priority) => {
      test(`should support optimization priority: ${priority}`, async () => {
        const result = await engine.exportVideo(
          createSceneData(),
          createConfig({
            settings: { ...baseSettings, optimization: priority },
          })
        );
        expect(result.success).toBe(true);
      });
    });
  });

  // --- Configuration Validation ---

  describe('validation', () => {
    test('should reject invalid configuration (missing format)', async () => {
      const config = { quality: baseQuality, settings: baseSettings, format: undefined as unknown as ExportFormat };
      const result = await engine.exportVideo(createSceneData(), config);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject 4K GIF (unsupported combination)', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'gif',
          quality: { ...baseQuality, resolution: '4k' },
        })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('4K resolution not supported for GIF');
    });

    test('should reject invalid scene data', async () => {
      const result = await engine.exportVideo({}, createConfig());
      expect(result.success).toBe(false);
    });
  });

  // --- Progress Callback ---

  describe('progress callback', () => {
    test('should call onProgress callback during export', async () => {
      const progressCalls: number[] = [];
      const onProgress = jest.fn((p) => progressCalls.push(p.progress));

      await engine.exportVideo(createSceneData(), createConfig(), onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1]).toBe(100);
    });
  });

  // --- Advanced Options ---

  describe('advanced options', () => {
    test('should export with chapters', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          advanced: {
            chapters: [
              { time: 0, title: 'Intro' },
              { time: 5, title: 'Content' },
            ],
          },
        })
      );
      expect(result.success).toBe(true);
    });

    test('should export with subtitles', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          advanced: {
            subtitles: [
              { language: 'ja', content: 'テスト字幕', format: 'srt' },
            ],
          },
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // --- Resolution Support ---

  describe('resolutions', () => {
    const resolutions = ['720p', '1080p', '1440p', '4k'] as const;

    resolutions.forEach((res) => {
      test(`should support ${res} resolution`, async () => {
        const result = await engine.exportVideo(
          createSceneData(),
          createConfig({
            quality: { ...baseQuality, resolution: res },
          })
        );
        expect(result.success).toBe(true);
      });
    });
  });

  // --- FPS Support ---

  describe('frame rates', () => {
    test('should support different frame rates', async () => {
      const fpsValues = [24, 30, 60] as const;
      for (const fps of fpsValues) {
        const result = await engine.exportVideo(
          createSceneData(),
          createConfig({ quality: { ...baseQuality, fps } })
        );
        expect(result.success).toBe(true);
      }
    });
  });

  // --- Export Queue ---

  describe('concurrent export queue', () => {
    test('should handle max concurrent exports', async () => {
      const smallEngine = new EnhancedExportEngine(1);
      const results = await Promise.all([
        smallEngine.exportVideo(createSceneData(), createConfig()),
        smallEngine.exportVideo(createSceneData(), createConfig({ format: 'webm' })),
      ]);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});

describe('ExportQualityValidator', () => {
  describe('validateExportResult', () => {
    test('should return true for successful result with output', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 1024,
        format: 'mp4',
        quality: baseQuality,
      };
      expect(ExportQualityValidator.validateExportResult(result)).toBe(true);
    });

    test('should return false for failed result', () => {
      const result: ExportResult = {
        success: false,
        format: 'mp4',
        quality: baseQuality,
        error: 'test error',
        warnings: [],
      };
      expect(ExportQualityValidator.validateExportResult(result)).toBe(false);
    });
  });

  describe('calculateExportScore', () => {
    test('should return 0 for failed result', () => {
      const result: ExportResult = {
        success: false,
        format: 'mp4',
        quality: baseQuality,
        error: 'failed',
        warnings: [],
      };
      expect(ExportQualityValidator.calculateExportScore(result, createConfig())).toBe(0);
    });

    test('should return positive score for successful result', () => {
      const result: ExportResult = {
        success: true,
        outputPath: '/tmp/test.mp4',
        outputSize: 500000,
        duration: 10,
        format: 'mp4',
        quality: baseQuality,
      };
      const score = ExportQualityValidator.calculateExportScore(result, createConfig());
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
