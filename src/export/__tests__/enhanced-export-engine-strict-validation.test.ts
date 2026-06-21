/**
 * Integration Test: EnhancedExportEngine + ExportContentValidator (strict mode)
 *
 * Verifies that the ExportContentValidator is correctly wired into the
 * EnhancedExportEngine pipeline via prepareExport(), and that strict mode
 * (EXPORT_STRICT_VALIDATION=true) blocks exports containing high-severity
 * injection patterns.
 *
 * This complements the unit-level validator tests by exercising the actual
 * engine integration point where validation occurs in production code.
 *
 * Flow tested:
 *   exportVideo(sceneData, config)
 *     → prepareExport(job)
 *       → validateExportPayload(job.sceneData, strict=true)
 *         → if high-severity findings: throw FormatValidationError
 *         → engine returns { success: false, error: ... }
 */

import {
  EnhancedExportEngine,
  type ExportConfiguration,
} from '../enhanced-export-engine';

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.EXPORT_STRICT_VALIDATION;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function createConfig(overrides: Partial<ExportConfiguration> = {}): ExportConfiguration {
  return {
    format: 'mp4',
    quality: baseQuality,
    settings: baseSettings,
    ...overrides,
  };
}

function makeCleanSceneData() {
  return {
    scenes: [
      { id: 's1', duration: 2, type: 'intro', label: 'Start' },
      { id: 's2', duration: 3, type: 'content', label: 'Process' },
      { id: 's3', duration: 1, type: 'outro', label: 'End' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests: Non-strict mode (default) — injection detected but export proceeds
// ---------------------------------------------------------------------------

describe('EnhancedExportEngine + Validator (non-strict mode)', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    delete process.env.EXPORT_STRICT_VALIDATION;
    engine = new EnhancedExportEngine(2);
  });

  test('script tag in scene data: export succeeds (non-strict)', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<script>alert(1)</script>';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });

  test('javascript: protocol in scene data: export succeeds (non-strict)', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[1] as Record<string, unknown>).label = 'javascript:alert(1)';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });

  test('clean scene data: export succeeds normally', async () => {
    const result = await engine.exportVideo(makeCleanSceneData(), createConfig());
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Strict mode — high-severity injection blocks export
// ---------------------------------------------------------------------------

describe('EnhancedExportEngine + Validator (strict mode)', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    process.env.EXPORT_STRICT_VALIDATION = 'true';
    engine = new EnhancedExportEngine(2);
  });

  afterEach(() => {
    delete process.env.EXPORT_STRICT_VALIDATION;
  });

  test('<script> tag in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<script>alert(1)</script>';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/injection/i);
  });

  test('<iframe> tag in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<iframe src="javascript:alert(1)">';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/injection/i);
  });

  test('javascript: protocol in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[1] as Record<string, unknown>).label = 'javascript:alert(document.cookie)';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/injection/i);
  });

  test('<svg onload=...> in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<svg onload=alert(1)>';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/injection/i);
  });

  test('CSS expression() in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = 'width: expression(alert(1))';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('-moz-binding in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '-moz-binding: url(evil.xml)';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('css-url-javascript in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).style = 'background: url(javascript:alert(1))';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('<embed> tag in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<embed src="data:text/html,evil">';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('<object> tag in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<object data="evil.swf">';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('<base> tag in scene data blocks export', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<base href="//evil.com">';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('clean scene data passes in strict mode', async () => {
    const result = await engine.exportVideo(makeCleanSceneData(), createConfig());
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Strict mode — medium severity does NOT block export
// ---------------------------------------------------------------------------

describe('EnhancedExportEngine + Validator (strict mode, medium severity)', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    process.env.EXPORT_STRICT_VALIDATION = 'true';
    engine = new EnhancedExportEngine(2);
  });

  afterEach(() => {
    delete process.env.EXPORT_STRICT_VALIDATION;
  });

  test('event handler (onclick=) does NOT block in strict mode', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = 'text onclick=alert(1)';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });

  test('<meta> tag does NOT block in strict mode', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<meta http-equiv="refresh">';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });

  test('@import url(...) does NOT block in strict mode', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).style = '@import url("https://evil.com/exfil.css")';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });

  test('safe special characters do NOT block in strict mode', async () => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = 'Check if (x > 0) & (y < 10)';

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Strict mode — injection at various depths in scene data
// ---------------------------------------------------------------------------

describe('EnhancedExportEngine + Validator (strict mode, deep injection)', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    process.env.EXPORT_STRICT_VALIDATION = 'true';
    engine = new EnhancedExportEngine(2);
  });

  afterEach(() => {
    delete process.env.EXPORT_STRICT_VALIDATION;
  });

  test('injection in nested scene metadata blocks export', async () => {
    const sceneData = {
      scenes: [
        {
          id: 's1',
          duration: 2,
          meta: { custom: { description: '<script>alert(1)</script>' } },
        },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('injection in array element of scene data blocks export', async () => {
    const sceneData = {
      scenes: [
        {
          id: 's1',
          duration: 2,
          tags: ['safe', 'javascript:alert(1)', 'also-safe'],
        },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });

  test('injection in top-level field blocks export', async () => {
    const sceneData = {
      title: '<script>alert(document.cookie)</script>',
      scenes: [
        { id: 's1', duration: 2, label: 'safe' },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Format-specific strict mode behavior
// ---------------------------------------------------------------------------

describe('EnhancedExportEngine + Validator (strict mode, all formats)', () => {
  let engine: EnhancedExportEngine;

  beforeEach(() => {
    process.env.EXPORT_STRICT_VALIDATION = 'true';
    engine = new EnhancedExportEngine(2);
  });

  afterEach(() => {
    delete process.env.EXPORT_STRICT_VALIDATION;
  });

  const formats: ExportConfiguration['format'][] = [
    'mp4', 'webm', 'gif', 'svg-animated',
  ];

  test.each(formats)('strict mode blocks injection for format: %s', async (format) => {
    const sceneData = makeCleanSceneData();
    (sceneData.scenes[0] as Record<string, unknown>).label = '<script>alert(1)</script>';

    const result = await engine.exportVideo(sceneData, createConfig({ format }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/injection/i);
  });
});
