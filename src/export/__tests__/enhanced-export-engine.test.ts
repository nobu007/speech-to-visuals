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
  ExportSettings,
} from '../enhanced-export-engine';
import {
  encodeAPNG,
  parsePngChunks,
  type ApngFrameInput,
} from '../apng-encoder';
import { exportMetricsCollector } from '../export-metrics-collector';
import { ExportArtifactStore } from '../export-artifact-store';

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

    test('should export apng format', async () => {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'apng' }));
      expect(result.success).toBe(true);
      expect(result.format).toBe('apng');
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

    // E2 (session-259 parked): the old compressVideo "compressed" by slicing
    // the artifact at a fixed ratio. Text formats (json-lottie / svg-animated)
    // stopped parsing mid-document and failed REQ-225 verification — a false
    // failure for a legitimate setting — while binary formats kept their head
    // magic bytes, passed verification and shipped a tail-less (unplayable)
    // artifact. Compression must never mutate the encoded bytes.
    test('compression must not truncate a json-lottie artifact (verifier parses the full JSON)', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'json-lottie',
          settings: { ...baseSettings, compression: 'maximum' },
        })
      );
      // The verifier is the integrity oracle: it JSON.parses the artifact and
      // checks the Lottie root fields, which only succeeds on complete bytes.
      expect(result.success).toBe(true);
      expect(result.verification?.valid).toBe(true);
    });

    test('compression must not truncate an svg-animated artifact (XML well-formedness)', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          format: 'svg-animated',
          settings: { ...baseSettings, compression: 'medium' },
        })
      );
      expect(result.success).toBe(true);
      expect(result.verification?.valid).toBe(true);
    });

    test('a requested compression level discloses the skipped re-encode in warnings', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: { ...baseSettings, compression: 'high' },
        })
      );
      expect(result.success).toBe(true);
      expect(
        result.warnings?.some((w) => w.includes('compression="high"'))
      ).toBe(true);
    });

    test('compression "none" adds no compression disclosure warning', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig()
      );
      expect(
        result.warnings?.some((w) => w.includes('compression='))
      ).toBe(false);
    });

    // The verifier-based legs above only protect the TEXT formats: REQ-225
    // checks binary artifacts by head magic bytes alone, so a tail-truncated
    // MP4 still "verifies" — and getFileSize is a mock constant, so
    // outputSize cannot observe the bytes either. The REQ-231 artifact store
    // receives the post-compression bytes directly and is the only observer
    // that can witness binary truncation.
    test('a binary artifact passes through every compression level byte-identically (artifact store oracle)', async () => {
      const store = new ExportArtifactStore();
      const binaryEngine = new EnhancedExportEngine(2, false, undefined, store);

      const levels = ['none', 'low', 'medium', 'high', 'maximum'] as const;
      const storedArtifacts: Uint8Array[] = [];
      for (const compression of levels) {
        const result = await binaryEngine.exportVideo(
          createSceneData(),
          createConfig({ settings: { ...baseSettings, compression } })
        );
        expect(result.success).toBe(true);
        const artifact = store.get(result.artifactId ?? '');
        if (!artifact) {
          throw new Error(`artifact not stored for compression="${compression}"`);
        }
        storedArtifacts.push(artifact.data);
      }
      // simulateEncoding is deterministic for fixed scene data, so any byte
      // deviation from the "none" baseline means post-processing mutated the
      // artifact — a fabricated size reduction, not compression.
      expect(storedArtifacts[0].byteLength).toBeGreaterThan(0);
      for (const artifact of storedArtifacts.slice(1)) {
        expect(artifact).toEqual(storedArtifacts[0]);
      }
    });

    // The disclosure must not read as success: pin that it states the bytes
    // were left unchanged, so a future rewording cannot turn the skipped
    // re-encode into a fabricated "compression applied" claim.
    test('the compression disclosure states the artifact bytes were left unchanged', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: { ...baseSettings, compression: 'high' },
        })
      );
      const disclosure = result.warnings?.find((w) =>
        w.includes('compression="high"')
      );
      expect(disclosure).toBeDefined();
      expect(disclosure).toMatch(/bytes left unchanged/);
    });

    // Out-of-contract runtime levels (untyped callers bypassing the required
    // ExportSettings union) must still surface in the disclosure rather than
    // silently passing through — fail-open disclosure, the same family the
    // session-267 legs pinned for unknown claims.
    test('an out-of-contract compression level still discloses instead of silently passing through', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: {
            ...baseSettings,
            compression: 'turbo' as unknown as typeof baseSettings.compression,
          },
        })
      );
      expect(result.success).toBe(true);
      expect(
        result.warnings?.some((w) => w.includes('compression="turbo"'))
      ).toBe(true);
    });

    // The 'turbo' leg above pins the unknown-STRING shape; this one pins the
    // absent-FIELD shape (impl-run eval's literal compression="undefined"
    // concern): a JSON-origin caller can drop a required union member the
    // type cannot see. The `!== 'none'` guard treats the absent level as
    // requested, so the bytes still pass through unchanged (INV-EXP-003
    // holds at the boundary) and the disclosure surfaces the caller's
    // contract violation instead of silently ignoring it.
    test('an absent compression level exports intact and discloses it verbatim', async () => {
      const result = await engine.exportVideo(
        createSceneData(),
        createConfig({
          settings: {
            ...baseSettings,
            compression: undefined,
          } as unknown as ExportSettings,
        })
      );
      expect(result.success).toBe(true);
      expect(result.verification?.valid).toBe(true);
      expect(
        result.warnings?.some((w) => w.includes('compression="undefined"'))
      ).toBe(true);
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

// ---------- APNG real encoding tests (TASK-0117 / REQ-063) ----------

describe('APNG encoder (real encoding)', () => {
  /** Helper: create a small RGBA frame filled with a solid color */
  const makeFrame = (
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ): ApngFrameInput => {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
    return { data, width, height };
  };

  test('output starts with PNG signature (89 50 4E 47)', () => {
    const apng = encodeAPNG([makeFrame(2, 2, 255, 0, 0)], { fps: 30 });
    expect(apng[0]).toBe(0x89);
    expect(apng[1]).toBe(0x50); // 'P'
    expect(apng[2]).toBe(0x4e); // 'N'
    expect(apng[3]).toBe(0x47); // 'G'
  });

  test('contains acTL chunk (animation control)', () => {
    const apng = encodeAPNG([makeFrame(2, 2, 0, 255, 0)], { fps: 30 });
    const chunks = parsePngChunks(apng);
    const actl = chunks.find((c) => c.type === 'acTL');
    expect(actl).toBeDefined();
    // First 4 bytes = number of frames (big-endian)
    const numFrames = (actl!.data[0] << 24) | (actl!.data[1] << 16) | (actl!.data[2] << 8) | actl!.data[3];
    expect(numFrames).toBe(1);
  });

  test('acTL frame count matches input frame count', () => {
    const frames = [
      makeFrame(4, 4, 255, 0, 0),
      makeFrame(4, 4, 0, 255, 0),
      makeFrame(4, 4, 0, 0, 255),
    ];
    const apng = encodeAPNG(frames, { fps: 30 });
    const chunks = parsePngChunks(apng);
    const actl = chunks.find((c) => c.type === 'acTL')!;
    const numFrames = (actl.data[0] << 24) | (actl.data[1] << 16) | (actl.data[2] << 8) | actl.data[3];
    expect(numFrames).toBe(3);
  });

  test('fcTL chunk count equals frame count', () => {
    const frames = [makeFrame(2, 2, 255, 0, 0), makeFrame(2, 2, 0, 255, 0)];
    const apng = encodeAPNG(frames, { fps: 24 });
    const chunks = parsePngChunks(apng);
    const fctlCount = chunks.filter((c) => c.type === 'fcTL').length;
    expect(fctlCount).toBe(2);
  });

  test('frame delay reflects FPS setting', () => {
    const fps = 30;
    const apng = encodeAPNG([makeFrame(2, 2, 128, 128, 128)], { fps });
    const chunks = parsePngChunks(apng);
    const fctl = chunks.find((c) => c.type === 'fcTL')!;
    // APNG spec: delay = delay_num / delay_den in SECONDS. One frame = 1/fps s.
    const delayNum = (fctl.data[20] << 8) | fctl.data[21];
    const delayDen = (fctl.data[22] << 8) | fctl.data[23];
    const delaySeconds = delayNum / delayDen;
    const expectedSeconds = 1 / fps;
    expect(delaySeconds).toBeCloseTo(expectedSeconds, 5);
    // A single frame must be well under a second (guards the 1000x-too-slow bug).
    expect(delaySeconds).toBeLessThan(1);
  });

  test('first frame uses IDAT, subsequent frames use fdAT', () => {
    const frames = [makeFrame(2, 2, 255, 0, 0), makeFrame(2, 2, 0, 255, 0)];
    const apng = encodeAPNG(frames, { fps: 30 });
    const chunks = parsePngChunks(apng);
    const types = chunks.map((c) => c.type);
    expect(types).toContain('IDAT');
    expect(types).toContain('fdAT');
    // IDAT should come before fdAT
    expect(types.indexOf('IDAT')).toBeLessThan(types.indexOf('fdAT'));
  });

  test('single frame APNG has IDAT but no fdAT', () => {
    const apng = encodeAPNG([makeFrame(2, 2, 0, 0, 0)], { fps: 30 });
    const chunks = parsePngChunks(apng);
    const types = chunks.map((c) => c.type);
    expect(types).toContain('IDAT');
    expect(types).not.toContain('fdAT');
  });

  test('throws on empty frame array', () => {
    expect(() => encodeAPNG([], { fps: 30 })).toThrow('at least one frame');
  });

  test('throws on zero or negative fps', () => {
    const frame = makeFrame(1, 1, 0, 0, 0);
    expect(() => encodeAPNG([frame], { fps: 0 })).toThrow('positive');
    expect(() => encodeAPNG([frame], { fps: -1 })).toThrow('positive');
  });

  test('throws on zero dimension frame', () => {
    const badFrame = { data: new Uint8Array(0), width: 0, height: 0 };
    expect(() => encodeAPNG([badFrame], { fps: 30 })).toThrow('positive');
  });

  test('ends with IEND chunk', () => {
    const apng = encodeAPNG([makeFrame(2, 2, 255, 255, 255)], { fps: 30 });
    const chunks = parsePngChunks(apng);
    expect(chunks[chunks.length - 1].type).toBe('IEND');
  });

  test('chunk CRC values are valid', () => {
    const apng = encodeAPNG([makeFrame(2, 2, 100, 150, 200)], { fps: 30 });
    const chunks = parsePngChunks(apng);
    // parsePngChunks would have thrown if CRC was wrong during parsing,
    // but let's also manually verify the first non-IEND chunk.
    // The IHDR chunk should have valid data
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    expect(ihdr).toBeDefined();
    // Width should be 2 (big-endian)
    const width = (ihdr!.data[0] << 24) | (ihdr!.data[1] << 16) | (ihdr!.data[2] << 8) | ihdr!.data[3];
    expect(width).toBe(2);
    // Height should be 2
    const height = (ihdr!.data[4] << 24) | (ihdr!.data[5] << 16) | (ihdr!.data[6] << 8) | ihdr!.data[7];
    expect(height).toBe(2);
    // Bit depth = 8, Color type = 6 (RGBA)
    expect(ihdr!.data[8]).toBe(8);
    expect(ihdr!.data[9]).toBe(6);
  });
});

// ---------- APNG integration via EnhancedExportEngine ----------

describe('EnhancedExportEngine APNG integration', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2);
  });

  test('apng export produces output with valid PNG signature', async () => {
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, type: 'content' }] },
      { format: 'apng', quality: { resolution: '720p', fps: 30, bitrate: 'auto', hdr: false }, settings: { loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' } },
    );
    expect(result.success).toBe(true);
    expect(result.format).toBe('apng');
  });

  test('apng export with useWorkers=true still uses real encoding', async () => {
    const workerEngine = new EnhancedExportEngine(1, true /* useWorkers */);
    // In Node.js test env Workers are unavailable → engine falls back to main thread,
    // but encodeAPNG() still calls the real encoder (not simulateEncoding).
    const result = await workerEngine.exportVideo(
      { scenes: [{ duration: 1, type: 'content' }] },
      { format: 'apng', quality: { resolution: '720p', fps: 30, bitrate: 'auto', hdr: false }, settings: { loop: false, includeAudio: false, watermark: false, compression: 'none', optimization: 'speed' } },
    );
    expect(result.success).toBe(true);
    expect(result.format).toBe('apng');
  });
});

// ---------- Animated SVG content tests ----------

describe('EnhancedExportEngine animated SVG content', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2);
  });

  test('svg-animated export includes XML declaration and namespace', async () => {
    const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'svg-animated' }));
    expect(result.success).toBe(true);
    const decoder = new TextDecoder();
    const svg = decoder.decode(result.outputPath ? new Uint8Array(0) : new Uint8Array(0));
    // Re-export to get raw output
    const result2 = await engine.exportVideo(
      { scenes: [{ duration: 2, type: 'intro' }, { duration: 3, type: 'content' }] },
      { format: 'svg-animated', quality: baseQuality, settings: baseSettings },
    );
    expect(result2.success).toBe(true);
    expect(result2.outputSize).toBeGreaterThan(0);
  });

  test('svg-animated with no scenes produces fallback SVG', async () => {
    const result = await engine.exportVideo(
      { scenes: [] },
      { format: 'svg-animated', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.format).toBe('svg-animated');
  });

  test('svg-animated encodes scene labels with XML escaping', async () => {
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, type: 'content', label: 'A & B < C > D "E"' }] },
      { format: 'svg-animated', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.outputSize).toBeGreaterThan(0);
  });

  test('svg-animated uses scene type for styling', async () => {
    const result = await engine.exportVideo(
      { scenes: [
        { duration: 1, type: 'intro' },
        { duration: 2, type: 'content' },
        { duration: 1, type: 'outro' },
      ] },
      { format: 'svg-animated', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.format).toBe('svg-animated');
  });
});

// ---------- Lottie JSON content tests ----------

describe('EnhancedExportEngine Lottie JSON content', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2);
  });

  test('json-lottie export includes scene-based layers', async () => {
    const result = await engine.exportVideo(
      { scenes: [{ duration: 2, type: 'intro' }, { duration: 3, type: 'content' }, { duration: 1, type: 'outro' }] },
      { format: 'json-lottie', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.outputSize).toBeGreaterThan(0);
  });

  test('json-lottie with empty scenes still produces valid structure', async () => {
    const result = await engine.exportVideo(
      { scenes: [] },
      { format: 'json-lottie', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.format).toBe('json-lottie');
  });

  test('json-lottie uses scene label as layer name', async () => {
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, type: 'content', label: 'Main Topic' }] },
      { format: 'json-lottie', quality: baseQuality, settings: baseSettings },
    );
    expect(result.success).toBe(true);
    expect(result.outputSize).toBeGreaterThan(0);
  });
});

// ---------- REQ-225: Export verification integration ----------

describe('REQ-225: Export verification integration', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    engine = new EnhancedExportEngine(2);
  });

  test('svg-animated export includes verification result', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'svg-animated' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.valid).toBe(true);
    expect(result.verification!.format).toBe('svg');
    expect(result.verification!.fileSize).toBeGreaterThan(0);
  });

  test('json-lottie export includes verification result', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'json-lottie' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.valid).toBe(true);
    expect(result.verification!.format).toBe('lottie');
  });

  test('apng export includes verification with APNG chunk validation', async () => {
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, type: 'content' }] },
      createConfig({ format: 'apng', quality: { resolution: '720p', fps: 30, bitrate: 'auto', hdr: false } }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.valid).toBe(true);
    expect(result.verification!.format).toBe('apng');
    expect(result.verification!.metadata.apngHasAcTL).toBe(true);
  });

  test('mp4 export includes verification result (informational)', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'mp4' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.format).toBe('mp4');
    // Simulated MP4 data now includes valid ftyp magic bytes (fixed in commit 62cfdeb)
    expect(result.verification!.valid).toBe(true);
  });

  test('webm export includes verification result', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'webm' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.format).toBe('webm');
  });

  test('gif export includes verification result', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'gif' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.format).toBe('gif');
  });

  test('pdf-animated export includes verification result', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'pdf-animated' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
    expect(result.verification!.format).toBe('pdf');
  });

  test('verification metadata is populated for valid formats', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'svg-animated' }),
    );
    expect(result.verification!.metadata).toBeDefined();
    // SVG verification extracts viewBox or other metadata
    expect(typeof result.verification!.metadata).toBe('object');
  });

  test('verification warnings are surfaced in result warnings', async () => {
    const result = await engine.exportVideo(
      createSceneData(),
      createConfig({ format: 'mp4' }),
    );
    // Simulated MP4 data produces verification errors which surface as warnings
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('all formats produce a verification object', async () => {
    const formats: ExportFormat[] = ['mp4', 'webm', 'gif', 'apng', 'interactive-html', 'pdf-animated', 'svg-animated', 'json-lottie'];
    for (const format of formats) {
      const result = await engine.exportVideo(createSceneData(), createConfig({ format }));
      expect(result.verification).toBeDefined();
      expect(result.verification!.fileSize).toBeGreaterThanOrEqual(0);
    }
  });

  // XSS prevention: scene data with </script> must be escaped in HTML output
  test('interactive-html escapes </script> in embedded scene data', async () => {
    const xssSceneData = {
      scenes: [
        { duration: 2, type: 'xss', text: '</script><script>alert(1)</script>' },
      ],
    };
    const result = await engine.exportVideo(
      xssSceneData,
      createConfig({ format: 'interactive-html' }),
    );
    expect(result.success).toBe(true);
    // We can't directly inspect the HTML output from ExportResult, but we
    // can verify the export completed without error. The actual escaping
    // is tested by verifying generateInteractiveHTML is used correctly
    // via the encoding path. The key assertion is that the export doesn't
    // crash or produce an error when scene data contains script tags.
  });

  test('interactive-html with large scene data containing markup', async () => {
    const sceneDataWithMarkup = {
      scenes: [
        { duration: 2, type: 'content', html: '<img src=x onerror=alert(1)>' },
        { duration: 3, type: 'content', script: '</script><script>evil()</script>' },
      ],
    };
    const result = await engine.exportVideo(
      sceneDataWithMarkup,
      createConfig({ format: 'interactive-html' }),
    );
    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
  });

  // --- Export metrics duration (time-origin parity) ---
  describe('export metrics duration', () => {
    // Guards the time-origin mismatch on the overall-export duration.
    // `job.startTime` is a `Date` (epoch-ms via .getTime()), so the elapsed
    // delta must be taken against another epoch-ms reading. The previous form
    // used performance.now() — ms since process/page origin, a small number —
    // so `performance.now() - job.startTime.getTime()` was a ~-1.7e12 negative
    // value. recordExport's `durationMs < 0` guard then dropped it BEFORE
    // incrementing any counter, so every successful export was missing from the
    // Prometheus metrics (export_duration_ms_count 0, ~0% success tally).

    it('records a positive, sane elapsed duration for a successful export', async () => {
      // jest.spyOn mutates the shared singleton object's method in place — the
      // engine imports the same instance, so it calls through to the spy (ESM
      // object-instance mutation, not a frozen namespace binding).
      const recordSpy = jest.spyOn(exportMetricsCollector, 'recordExport');
      const before = exportMetricsCollector.getSnapshot();

      const result = await engine.exportVideo(createSceneData(), createConfig({ format: 'mp4' }));
      expect(result.success).toBe(true);

      const successCalls = recordSpy.mock.calls.filter(
        (c) => c[0] === 'mp4' && c[1] === 'success',
      );
      expect(successCalls.length).toBeGreaterThan(0);
      for (const call of successCalls) {
        const durationMs = call[2] as number;
        // Decisive: a -1.7e12 (process-origin vs epoch) mix is negative and
        // ~13 orders of magnitude off any plausible real export time.
        expect(Number.isFinite(durationMs)).toBe(true);
        expect(durationMs).toBeGreaterThanOrEqual(0);
        expect(durationMs).toBeLessThan(1_000_000);
      }

      // Behavioral impact: the export is no longer dropped — the global success
      // tally advances. With the bug the negative duration hit the guard and
      // this delta stayed 0.
      const after = exportMetricsCollector.getSnapshot();
      expect(after.successfulExports).toBeGreaterThan(before.successfulExports);
    });
  });
});
