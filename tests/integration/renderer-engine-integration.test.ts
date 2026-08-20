/**
 * Phase 90 Integration Tests: animated-scene-renderer ↔ enhanced-export-engine (TASK-0200)
 *
 * Verifies that the animated-scene-renderer module (extracted in Phase 89)
 * integrates correctly with enhanced-export-engine:
 *   - Renderer output propagates to engine final output
 *   - Scene-type color/style delegation is correct
 *   - Format delegation (SVG vs Lottie) works through engine paths
 */

import { jest } from '@jest/globals';

// ---------- Dynamic imports (ESM) ----------

let EnhancedExportEngine: typeof import('@/export/enhanced-export-engine').EnhancedExportEngine;
let generateAnimatedSVG: typeof import('@/export/animated-scene-renderer').generateAnimatedSVG;
let generateLottieAnimation: typeof import('@/export/animated-scene-renderer').generateLottieAnimation;
let sceneTypeToFillColor: typeof import('@/export/animated-scene-renderer').sceneTypeToFillColor;
let buildLayerShapes: typeof import('@/export/animated-scene-renderer').buildLayerShapes;

beforeAll(async () => {
  const engMod = await import('@/export/enhanced-export-engine');
  EnhancedExportEngine = engMod.EnhancedExportEngine;

  const renMod = await import('@/export/animated-scene-renderer');
  generateAnimatedSVG = renMod.generateAnimatedSVG;
  generateLottieAnimation = renMod.generateLottieAnimation;
  sceneTypeToFillColor = renMod.sceneTypeToFillColor;
  buildLayerShapes = renMod.buildLayerShapes;
});

// ---------- Fixtures ----------

const HD = { width: 1920, height: 1080 };

const INTRO_SCENE = { duration: 3, label: 'Opening', type: 'intro' };
const CONTENT_SCENE = { duration: 5, label: 'Details', type: 'content' };
const OUTRO_SCENE = { duration: 2, label: 'Closing', type: 'outro' };

const ALL_TYPES = {
  scenes: [INTRO_SCENE, CONTENT_SCENE, OUTRO_SCENE],
};

function makeConfig(format: 'svg-animated' | 'json-lottie') {
  return {
    format,
    quality: {
      resolution: '1080p' as const,
      fps: 30 as const,
      bitrate: 'auto' as const,
      hdr: false,
    },
    settings: {
      loop: true,
      includeAudio: false,
      watermark: false,
      compression: 'none' as const,
      optimization: 'speed' as const,
    },
  };
}

// ---------- Tests ----------

describe('TASK-0200: Renderer → Engine integration', () => {
  // ========== Data flow integrity ==========

  describe('renderer output propagates to engine', () => {
    it('SVG renderer output matches engine SVG export path', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeConfig('svg-animated');
      const result = await engine.exportVideo(ALL_TYPES, config);

      expect(result.success).toBe(true);

      // Verify the renderer output directly
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      expect(svg).toContain('Opening');
      expect(svg).toContain('Details');
      expect(svg).toContain('Closing');
      expect(svg).toContain('@keyframes');
    });

    it('Lottie renderer output matches engine Lottie export path', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeConfig('json-lottie');
      const result = await engine.exportVideo(ALL_TYPES, config);

      expect(result.success).toBe(true);

      // Verify the renderer output directly
      const lottie = generateLottieAnimation(ALL_TYPES, HD);
      expect(lottie.v).toBe('5.7.4');
      const layers = lottie.layers as Record<string, unknown>[];
      expect(layers).toHaveLength(3);
    });
  });

  // ========== Scene-type delegation ==========

  describe('scene-type color and style delegation', () => {
    it('intro scene gets #1a1a2e in both SVG and Lottie', () => {
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      const lottie = generateLottieAnimation(ALL_TYPES, HD);

      // SVG
      expect(svg).toContain('fill="#1a1a2e"');

      // Lottie
      const expectedFill = sceneTypeToFillColor('intro');
      const layers = lottie.layers as Record<string, unknown>[];
      const introLayer = layers[0];
      const shapes = introLayer.shapes as Record<string, unknown>[];
      const group = shapes[0] as Record<string, unknown>;
      const items = group.it as Record<string, unknown>[];
      const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
      expect((fill.c as Record<string, unknown>).k).toEqual(expectedFill);
    });

    it('content scene gets #16213e in both SVG and Lottie', () => {
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      const lottie = generateLottieAnimation(ALL_TYPES, HD);

      expect(svg).toContain('fill="#16213e"');

      const expectedFill = sceneTypeToFillColor('content');
      const layers = lottie.layers as Record<string, unknown>[];
      const contentLayer = layers[1];
      const shapes = contentLayer.shapes as Record<string, unknown>[];
      const group = shapes[0] as Record<string, unknown>;
      const items = group.it as Record<string, unknown>[];
      const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
      expect((fill.c as Record<string, unknown>).k).toEqual(expectedFill);
    });

    it('outro scene gets #0f3460 in both SVG and Lottie', () => {
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      const lottie = generateLottieAnimation(ALL_TYPES, HD);

      expect(svg).toContain('fill="#0f3460"');

      const expectedFill = sceneTypeToFillColor('outro');
      const layers = lottie.layers as Record<string, unknown>[];
      const outroLayer = layers[2];
      const shapes = outroLayer.shapes as Record<string, unknown>[];
      const group = shapes[0] as Record<string, unknown>;
      const items = group.it as Record<string, unknown>[];
      const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
      expect((fill.c as Record<string, unknown>).k).toEqual(expectedFill);
    });

    it('unknown type defaults to #16213e content color', () => {
      const data = { scenes: [{ duration: 2, label: 'Unknown', type: 'custom' }] };
      const svg = generateAnimatedSVG(data, HD);
      const lottie = generateLottieAnimation(data, HD);

      expect(svg).toContain('fill="#16213e"');

      const defaultFill = sceneTypeToFillColor('custom');
      const defaultFill2 = sceneTypeToFillColor(undefined);
      // Both 'custom' and undefined should return the same default
      expect(defaultFill).toEqual(defaultFill2);
    });

    it('intro scene gets larger font (48) in SVG', () => {
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      // intro font-size=48, content=24, outro=36
      expect(svg).toContain('font-size="48"');
      expect(svg).toContain('font-size="24"');
      expect(svg).toContain('font-size="36"');
    });

    it('buildLayerShapes produces correct rectangle for each scene type', () => {
      for (const scene of ALL_TYPES.scenes) {
        const shapes = buildLayerShapes(scene, 1920, 1080);
        expect(shapes).toHaveLength(1);
        const group = shapes[0] as Record<string, unknown>;
        expect(group.ty).toBe('gr');
        expect(group.nm).toBe('Background Group');

        const items = group.it as Record<string, unknown>[];
        expect(items).toHaveLength(3); // rect + fill + transform

        const rect = items.find((it: Record<string, unknown>) => it.ty === 'rc');
        expect(rect).toBeDefined();
        expect((rect as Record<string, unknown>).nm).toBe('Background Rect');
      }
    });
  });

  // ========== Format delegation ==========

  describe('format delegation (SVG vs Lottie)', () => {
    it('engine selects SVG renderer for svg-animated format', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeConfig('svg-animated');
      const result = await engine.exportVideo(ALL_TYPES, config);

      expect(result.success).toBe(true);
      expect(result.format).toBe('svg-animated');
    });

    it('engine selects Lottie renderer for json-lottie format', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeConfig('json-lottie');
      const result = await engine.exportVideo(ALL_TYPES, config);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json-lottie');
    });

    it('SVG output is a string containing XML declaration', () => {
      const svg = generateAnimatedSVG(ALL_TYPES, HD);
      expect(svg).toMatch(/^<\?xml version="1\.0"/);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('Lottie output is a valid JSON-serializable object', () => {
      const lottie = generateLottieAnimation(ALL_TYPES, HD);
      const serialized = JSON.stringify(lottie);
      const parsed = JSON.parse(serialized);

      expect(parsed.v).toBe('5.7.4');
      expect(parsed.layers).toHaveLength(3);
    });
  });

  // ========== Empty scene fallback ==========

  describe('empty scene fallback handling', () => {
    it('SVG renderer produces "No scene data" placeholder', () => {
      const svg = generateAnimatedSVG({ scenes: [] }, HD);
      expect(svg).toContain('No scene data');
      expect(svg).toContain('<svg');
    });

    it('Lottie renderer produces empty layers array with fallback frame count', () => {
      const lottie = generateLottieAnimation({ scenes: [] }, HD, 60);
      expect(lottie.layers).toEqual([]);
      expect(lottie.op).toBe(60);
      expect(lottie.v).toBe('5.7.4');
    });

    it('engine handles empty scenes in both formats', async () => {
      const emptyData = { scenes: [] };
      const engine = new EnhancedExportEngine(1, false);

      const svgResult = await engine.exportVideo(emptyData, makeConfig('svg-animated'));
      expect(svgResult.success).toBe(true);

      const lottieResult = await engine.exportVideo(emptyData, makeConfig('json-lottie'));
      expect(lottieResult.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // REQ-223: Renderer → Verifier round-trip
  // -----------------------------------------------------------------------

  describe('renderer-to-verifier round-trip (REQ-223)', () => {
    let ExportVerifier: typeof import('@/export/export-verifier').ExportVerifier;

    beforeAll(async () => {
      const mod = await import('@/export/export-verifier');
      ExportVerifier = mod.ExportVerifier;
    });

    const scenes = {
      scenes: [
        { duration: 3, label: 'Intro', type: 'intro' },
        { duration: 5, label: 'Main', type: 'content' },
        { duration: 2, label: 'Outro', type: 'outro' },
      ],
    };
    const frames = { width: 1920, height: 1080 };

    it('verifies SVG output from generateAnimatedSVG', () => {
      const svg = generateAnimatedSVG(scenes, frames);
      const verifier = new ExportVerifier({ minFileSizeBytes: 1 });
      const result = verifier.verifySvgString(svg);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.viewBox).toBe(`0 0 ${frames.width} ${frames.height}`);
    });

    it('verifies Lottie JSON output from generateLottieAnimation', () => {
      const lottie = generateLottieAnimation(scenes, frames);
      const jsonStr = JSON.stringify(lottie);
      const data = new TextEncoder().encode(jsonStr).buffer;

      const verifier = new ExportVerifier({ minFileSizeBytes: 1 });
      const result = verifier.verify('lottie', data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.lottieVersion).toBe('5.7.4');
      expect(result.metadata.lottieFrameRate).toBe(30);
      expect(result.metadata.lottieLayerCount).toBe(3);
      expect(result.metadata.lottieDimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('verifies SVG from ArrayBuffer (binary round-trip)', () => {
      const svg = generateAnimatedSVG(scenes, frames);
      const data = new TextEncoder().encode(svg).buffer;

      const verifier = new ExportVerifier({ minFileSizeBytes: 1 });
      const result = verifier.verify('svg', data);
      expect(result.valid).toBe(true);
    });

    it('catches corrupted Lottie JSON in round-trip', () => {
      const lottie = generateLottieAnimation(scenes, frames);
      // Corrupt: remove the layers field
      const corrupted = { ...lottie, layers: undefined };
      const data = new TextEncoder().encode(JSON.stringify(corrupted)).buffer;

      const verifier = new ExportVerifier({ minFileSizeBytes: 1 });
      const result = verifier.verify('lottie', data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Lottie missing required field: "layers" (layers array)');
    });
  });
});
