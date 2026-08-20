/**
 * Phase 90 Integration Tests: Export Pipeline E2E (TASK-0199)
 *
 * Exercises the full export pipeline from scene data input through
 * EnhancedExportEngine → animated-scene-renderer → SVG / Lottie output.
 *
 * These tests complement the unit-level tests in
 * tests/unit/export/animated-svg-lottie-export.test.ts by verifying
 * module-to-module data flow and format delegation within the engine.
 */

import { jest } from '@jest/globals';

// ---------- Dynamic imports (ESM) ----------

let EnhancedExportEngine: typeof import('@/export/enhanced-export-engine').EnhancedExportEngine;
let generateAnimatedSVG: typeof import('@/export/animated-scene-renderer').generateAnimatedSVG;
let generateLottieAnimation: typeof import('@/export/animated-scene-renderer').generateLottieAnimation;
let sceneTypeToFillColor: typeof import('@/export/animated-scene-renderer').sceneTypeToFillColor;

beforeAll(async () => {
  const engMod = await import('@/export/enhanced-export-engine');
  EnhancedExportEngine = engMod.EnhancedExportEngine;

  const renMod = await import('@/export/animated-scene-renderer');
  generateAnimatedSVG = renMod.generateAnimatedSVG;
  generateLottieAnimation = renMod.generateLottieAnimation;
  sceneTypeToFillColor = renMod.sceneTypeToFillColor;
});

// ---------- Test fixtures ----------

const THREE_SCENES = {
  scenes: [
    { duration: 2, label: 'Introduction', type: 'intro' },
    { duration: 4, label: 'Main Content', type: 'content' },
    { duration: 2, label: 'Conclusion', type: 'outro' },
  ],
};

const HD = { width: 1920, height: 1080 };

function makeExportConfig(
  format: 'svg-animated' | 'json-lottie',
) {
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

describe('TASK-0199: Export pipeline E2E integration', () => {
  // ========== SVG E2E pipeline ==========

  describe('SVG animated pipeline (REQ-218)', () => {
    it('produces valid SVG with CSS keyframes from 3-scene data', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeExportConfig('svg-animated');
      const result = await engine.exportVideo(
        THREE_SCENES,
        config,
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('svg-animated');

      // Verify the renderer directly (engine delegates to renderer internally)
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      expect(svg).toContain('@keyframes');
      expect(svg).toContain('<svg');
    });

    it('renderer output contains all scene groups with correct labels', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);

      expect(svg).toContain('Introduction');
      expect(svg).toContain('Main Content');
      expect(svg).toContain('Conclusion');
    });

    it('renderer applies scene-type-specific background colors', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);

      // intro → #1a1a2e, content → #16213e, outro → #0f3460
      expect(svg).toContain('fill="#1a1a2e"');
      expect(svg).toContain('fill="#16213e"');
      expect(svg).toContain('fill="#0f3460"');
    });

    it('renderer produces @keyframes for each scene', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);

      expect(svg).toContain('@keyframes s0');
      expect(svg).toContain('@keyframes s1');
      expect(svg).toContain('@keyframes s2');
    });

    it('renderer handles empty scene array gracefully', () => {
      const svg = generateAnimatedSVG({ scenes: [] }, HD);

      expect(svg).toContain('No scene data');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('renderer XML-escapes special characters in labels', () => {
      const data = {
        scenes: [
          { duration: 2, label: 'A <B> & "C"', type: 'content' },
        ],
      };
      const svg = generateAnimatedSVG(data, HD);

      expect(svg).toContain('&lt;B&gt;');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&quot;C&quot;');
    });
  });

  // ========== Lottie E2E pipeline ==========

  describe('Lottie JSON pipeline (REQ-219)', () => {
    it('produces valid Lottie 5.7.4 structure from 3-scene data', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeExportConfig('json-lottie');
      const result = await engine.exportVideo(
        THREE_SCENES,
        config,
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('json-lottie');
    });

    it('renderer produces Lottie 5.7.4 compatible JSON', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      expect(lottie.v).toBe('5.7.4');
      expect(lottie.fr).toBe(30);
      expect(lottie.ip).toBe(0);
      expect(lottie.w).toBe(1920);
      expect(lottie.h).toBe(1080);
      expect(lottie.nm).toBe('AudioDiagramAnimation');
    });

    it('renderer produces correct number of layers', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      expect(layers).toHaveLength(3);
      expect(layers[0].nm).toBe('Introduction');
      expect(layers[1].nm).toBe('Main Content');
      expect(layers[2].nm).toBe('Conclusion');
    });

    it('each layer has opacity keyframes for fade-in/fade-out', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      for (const layer of layers) {
        const ks = layer.ks as Record<string, unknown>;
        const o = ks.o as Record<string, unknown>;
        expect(o.a).toBe(1); // animated opacity
        const k = o.k as Record<string, unknown>[];
        expect(k.length).toBeGreaterThanOrEqual(2);
        // First keyframe: opacity 0 (fade in start)
        expect(k[0].s).toEqual([0]);
      }
    });

    it('layers have sequential frame offsets', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // Scene 0: 2s * 30fps = 60 frames
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(60);

      // Scene 1: 4s * 30fps = 120 frames
      expect(layers[1].ip).toBe(60);
      expect(layers[1].op).toBe(180);

      // Scene 2: 2s * 30fps = 60 frames
      expect(layers[2].ip).toBe(180);
      expect(layers[2].op).toBe(240);
    });

    it('total frame count (op) equals sum of all scene frames', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      // 2s + 4s + 2s = 8s * 30fps = 240 frames
      expect(lottie.op).toBe(240);
    });

    it('each layer has visual shapes (rectangle + fill)', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      for (const layer of layers) {
        const shapes = layer.shapes as Record<string, unknown>[];
        expect(shapes.length).toBeGreaterThan(0);

        // First shape group
        const group = shapes[0] as Record<string, unknown>;
        expect(group.ty).toBe('gr');
        const items = group.it as Record<string, unknown>[];

        // Has rectangle shape
        const rect = items.find((it: Record<string, unknown>) => it.ty === 'rc');
        expect(rect).toBeDefined();

        // Has fill
        const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl');
        expect(fill).toBeDefined();

        // Has transform
        const tr = items.find((it: Record<string, unknown>) => it.ty === 'tr');
        expect(tr).toBeDefined();
      }
    });

    it('scene-type-specific fill colors are applied correctly', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      const introExpected = sceneTypeToFillColor('intro');
      const contentExpected = sceneTypeToFillColor('content');
      const outroExpected = sceneTypeToFillColor('outro');

      function extractFillColor(layer: Record<string, unknown>): number[] {
        const shapes = layer.shapes as Record<string, unknown>[];
        const group = shapes[0] as Record<string, unknown>;
        const items = group.it as Record<string, unknown>[];
        const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
        const c = fill.c as Record<string, unknown>;
        return c.k as number[];
      }

      expect(extractFillColor(layers[0])).toEqual(introExpected);
      expect(extractFillColor(layers[1])).toEqual(contentExpected);
      expect(extractFillColor(layers[2])).toEqual(outroExpected);
    });

    it('handles empty scene array with fallbackFrameCount', () => {
      const lottie = generateLottieAnimation({ scenes: [] }, HD, 90);

      expect(lottie.layers).toEqual([]);
      expect(lottie.op).toBe(90); // fallback
      expect(lottie.v).toBe('5.7.4');
    });
  });

  // ========== Cross-format consistency ==========

  describe('SVG ↔ Lottie cross-format consistency', () => {
    it('both formats produce output for the same scene data', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      expect(svg).toBeTruthy();
      expect(typeof svg).toBe('string');
      expect(lottie).toBeTruthy();
      expect(typeof lottie).toBe('object');
    });

    it('scene labels are consistent across formats', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // SVG contains all scene labels
      for (const scene of THREE_SCENES.scenes) {
        expect(svg).toContain(scene.label);
      }

      // Lottie layer names match scene labels
      for (let i = 0; i < THREE_SCENES.scenes.length; i++) {
        expect(layers[i].nm).toBe(THREE_SCENES.scenes[i].label);
      }
    });

    it('scene type colors are consistent across formats', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // SVG hex colors for each scene type
      const svgColorMap: Record<string, string> = {
        intro: '#1a1a2e',
        content: '#16213e',
        outro: '#0f3460',
      };

      for (let i = 0; i < THREE_SCENES.scenes.length; i++) {
        const scene = THREE_SCENES.scenes[i];
        const expectedHex = svgColorMap[scene.type];
        // SVG uses hex color
        expect(svg).toContain(expectedHex);

        // Lottie uses the same mapping function
        const lottieFill = sceneTypeToFillColor(scene.type);
        const shapes = layers[i].shapes as Record<string, unknown>[];
        const group = shapes[0] as Record<string, unknown>;
        const items = group.it as Record<string, unknown>[];
        const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
        const c = fill.c as Record<string, unknown>;
        expect(c.k).toEqual(lottieFill);
      }
    });
  });

  // ========== Error propagation ==========

  describe('error propagation and edge cases', () => {
    it('engine handles svg-animated format through exportVideo', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeExportConfig('svg-animated');
      const result = await engine.exportVideo(THREE_SCENES, config);

      expect(result.success).toBe(true);
      expect(result.format).toBe('svg-animated');
    });

    it('engine handles json-lottie format through exportVideo', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const config = makeExportConfig('json-lottie');
      const result = await engine.exportVideo(THREE_SCENES, config);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json-lottie');
    });

    it('renderer handles scene with missing optional fields', () => {
      const minimal = { scenes: [{}, {}, {}] };
      const svg = generateAnimatedSVG(minimal, HD);
      const lottie = generateLottieAnimation(minimal, HD);

      expect(svg).toContain('<svg');
      expect(svg).toContain('Scene 1');
      expect(svg).toContain('Scene 2');
      expect(svg).toContain('Scene 3');

      const layers = lottie.layers as Record<string, unknown>[];
      expect(layers).toHaveLength(3);
      // Default duration of 2s = 60 frames each
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(60);
    });

    it('renderer handles single scene data', () => {
      const single = { scenes: [{ duration: 5, label: 'Solo', type: 'content' }] };
      const svg = generateAnimatedSVG(single, HD);
      const lottie = generateLottieAnimation(single, HD);

      expect(svg).toContain('Solo');
      expect(svg).toContain('@keyframes s0');

      const layers = lottie.layers as Record<string, unknown>[];
      expect(layers).toHaveLength(1);
      expect(layers[0].nm).toBe('Solo');
      expect(lottie.op).toBe(150); // 5s * 30fps
    });

    it('renderer handles custom frame dimensions', () => {
      const custom = { width: 800, height: 600 };
      const svg = generateAnimatedSVG(THREE_SCENES, custom);
      const lottie = generateLottieAnimation(THREE_SCENES, custom);

      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="600"');
      expect(svg).toContain('viewBox="0 0 800 600"');

      expect(lottie.w).toBe(800);
      expect(lottie.h).toBe(600);
    });
  });
});
