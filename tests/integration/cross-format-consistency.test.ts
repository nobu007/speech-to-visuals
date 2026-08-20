/**
 * Phase 90 Integration Tests: Export Format Cross-Consistency (TASK-0201)
 *
 * Validates that when the same scene data is exported to multiple formats
 * (SVG and Lottie), the outputs maintain consistency in:
 *   - Scene count and ordering
 *   - Scene labels / layer names
 *   - Scene-type-specific color mappings
 *   - Duration / timing semantics
 *   - Dimension / frame size
 *
 * These tests complement TASK-0199 (E2E pipeline) and TASK-0200
 * (renderer-engine integration) by focusing exclusively on cross-format
 * output parity.
 */

import { jest } from '@jest/globals';

// ---------- Dynamic imports (ESM) ----------

let generateAnimatedSVG: typeof import('@/export/animated-scene-renderer').generateAnimatedSVG;
let generateLottieAnimation: typeof import('@/export/animated-scene-renderer').generateLottieAnimation;
let sceneTypeToFillColor: typeof import('@/export/animated-scene-renderer').sceneTypeToFillColor;

beforeAll(async () => {
  const renMod = await import('@/export/animated-scene-renderer');
  generateAnimatedSVG = renMod.generateAnimatedSVG;
  generateLottieAnimation = renMod.generateLottieAnimation;
  sceneTypeToFillColor = renMod.sceneTypeToFillColor;
});

// ---------- Fixtures ----------

const HD = { width: 1920, height: 1080 };
const SD = { width: 1280, height: 720 };

const THREE_SCENES = {
  scenes: [
    { duration: 2, label: 'Introduction', type: 'intro' },
    { duration: 4, label: 'Main Content', type: 'content' },
    { duration: 2, label: 'Conclusion', type: 'outro' },
  ],
};

const FIVE_SCENES = {
  scenes: [
    { duration: 1, label: 'Start', type: 'intro' },
    { duration: 3, label: 'Step A', type: 'content' },
    { duration: 3, label: 'Step B', type: 'content' },
    { duration: 3, label: 'Step C', type: 'content' },
    { duration: 2, label: 'Finish', type: 'outro' },
  ],
};

const SINGLE_SCENE = {
  scenes: [
    { duration: 5, label: 'Only Scene', type: 'content' },
  ],
};

const MIXED_TYPES = {
  scenes: [
    { duration: 3, label: 'Intro', type: 'intro' },
    { duration: 2, label: 'Unknown', type: 'custom' },
    { duration: 2, label: 'No Type' },
    { duration: 4, label: 'Wrap-up', type: 'outro' },
  ],
};

// ---------- Helper: extract SVG scene labels ----------

function extractSvgLabels(svg: string): string[] {
  const labels: string[] = [];
  // Labels appear inside <text> elements within scene groups
  const textRegex = /font-weight="bold">([^<]+)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(svg)) !== null) {
    labels.push(match[1]);
  }
  return labels;
}

// ---------- Helper: extract Lottie layer names ----------

function extractLottieNames(lottie: Record<string, unknown>): string[] {
  const layers = lottie.layers as Record<string, unknown>[];
  return layers.map((l) => String(l.nm));
}

// ---------- Helper: extract SVG fill colors per scene ----------

function extractSvgColors(svg: string): string[] {
  const colors: string[] = [];
  const fillRegex = /<rect[^>]+fill="([^"]+)"[^>]*rx="8"/g;
  let match: RegExpExecArray | null;
  while ((match = fillRegex.exec(svg)) !== null) {
    colors.push(match[1]);
  }
  return colors;
}

// ---------- Helper: extract Lottie fill colors per layer ----------

function extractLottieColors(lottie: Record<string, unknown>): number[][] {
  const layers = lottie.layers as Record<string, unknown>[];
  return layers.map((layer) => {
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes[0] as Record<string, unknown>;
    const items = group.it as Record<string, unknown>[];
    const fill = items.find((it: Record<string, unknown>) => it.ty === 'fl') as Record<string, unknown>;
    const c = fill.c as Record<string, unknown>;
    return c.k as number[];
  });
}

// ---------- Helper: hex to RGBA (0-1 range) ----------

function hexToRgba(hex: string): number[] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
    1,
  ];
}

// ---------- Tests ----------

describe('TASK-0201: Export format cross-consistency', () => {
  // ========== 1. Scene structure consistency ==========

  describe('scene count and ordering', () => {
    it('3-scene data produces 3 SVG groups and 3 Lottie layers', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      // SVG: 3 scene groups (each with animation)
      expect(svg).toContain('@keyframes s0');
      expect(svg).toContain('@keyframes s1');
      expect(svg).toContain('@keyframes s2');
      expect(svg).not.toContain('@keyframes s3');

      // Lottie: 3 layers
      const layers = lottie.layers as Record<string, unknown>[];
      expect(layers).toHaveLength(3);
    });

    it('5-scene data produces matching structure in both formats', () => {
      const svg = generateAnimatedSVG(FIVE_SCENES, HD);
      const lottie = generateLottieAnimation(FIVE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      for (let i = 0; i < 5; i++) {
        expect(svg).toContain(`@keyframes s${i}`);
      }
      expect(svg).not.toContain('@keyframes s5');
      expect(layers).toHaveLength(5);
    });

    it('single scene produces matching 1-scene output in both formats', () => {
      const svg = generateAnimatedSVG(SINGLE_SCENE, HD);
      const lottie = generateLottieAnimation(SINGLE_SCENE, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      expect(svg).toContain('@keyframes s0');
      expect(svg).not.toContain('@keyframes s1');
      expect(layers).toHaveLength(1);
    });

    it('scene labels appear in the same order across formats', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      const svgLabels = extractSvgLabels(svg);
      const lottieNames = extractLottieNames(lottie);

      expect(svgLabels).toEqual(['Introduction', 'Main Content', 'Conclusion']);
      expect(lottieNames).toEqual(['Introduction', 'Main Content', 'Conclusion']);
      expect(svgLabels).toEqual(lottieNames);
    });

    it('5-scene labels are consistent across formats', () => {
      const svg = generateAnimatedSVG(FIVE_SCENES, HD);
      const lottie = generateLottieAnimation(FIVE_SCENES, HD);

      const svgLabels = extractSvgLabels(svg);
      const lottieNames = extractLottieNames(lottie);

      expect(svgLabels).toEqual(['Start', 'Step A', 'Step B', 'Step C', 'Finish']);
      expect(svgLabels).toEqual(lottieNames);
    });
  });

  // ========== 2. Scene-type color cross-consistency ==========

  describe('scene-type color consistency', () => {
    it('intro scene uses same color in SVG hex and Lottie RGBA', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const lottieColors = extractLottieColors(lottie);

      // SVG: #1a1a2e, Lottie: [0.102, 0.102, 0.180, 1]
      const introSvg = '#1a1a2e';
      const introLottie = sceneTypeToFillColor('intro');
      const introLottieFromHex = hexToRgba(introSvg);

      expect(svg).toContain(`fill="${introSvg}"`);
      expect(lottieColors[0]).toEqual(introLottie);

      // Verify hex-to-RGBA conversion matches sceneTypeToFillColor
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(introLottie[i] - introLottieFromHex[i])).toBeLessThan(0.005);
      }
    });

    it('content scene uses same color in SVG hex and Lottie RGBA', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const lottieColors = extractLottieColors(lottie);

      const contentSvg = '#16213e';
      const contentLottie = sceneTypeToFillColor('content');
      const contentLottieFromHex = hexToRgba(contentSvg);

      expect(svg).toContain(`fill="${contentSvg}"`);
      expect(lottieColors[1]).toEqual(contentLottie);

      for (let i = 0; i < 4; i++) {
        expect(Math.abs(contentLottie[i] - contentLottieFromHex[i])).toBeLessThan(0.005);
      }
    });

    it('outro scene uses same color in SVG hex and Lottie RGBA', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const lottieColors = extractLottieColors(lottie);

      const outroSvg = '#0f3460';
      const outroLottie = sceneTypeToFillColor('outro');
      const outroLottieFromHex = hexToRgba(outroSvg);

      expect(svg).toContain(`fill="${outroSvg}"`);
      expect(lottieColors[2]).toEqual(outroLottie);

      for (let i = 0; i < 4; i++) {
        expect(Math.abs(outroLottie[i] - outroLottieFromHex[i])).toBeLessThan(0.005);
      }
    });

    it('all scene types produce consistent colors via sceneTypeToFillColor', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const svgColors = extractSvgColors(svg);

      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const lottieColors = extractLottieColors(lottie);

      const colorMap: Record<string, string> = {
        intro: '#1a1a2e',
        content: '#16213e',
        outro: '#0f3460',
      };

      for (let i = 0; i < THREE_SCENES.scenes.length; i++) {
        const scene = THREE_SCENES.scenes[i];
        const expectedHex = colorMap[scene.type];
        const expectedRgba = sceneTypeToFillColor(scene.type);

        // SVG contains hex color
        expect(svgColors[i]).toBe(expectedHex);

        // Lottie RGBA matches sceneTypeToFillColor
        expect(lottieColors[i]).toEqual(expectedRgba);

        // Hex → RGBA conversion is consistent with sceneTypeToFillColor
        const converted = hexToRgba(expectedHex);
        for (let j = 0; j < 4; j++) {
          expect(Math.abs(expectedRgba[j] - converted[j])).toBeLessThan(0.005);
        }
      }
    });

    it('unknown/missing type defaults to content color in both formats', () => {
      const svg = generateAnimatedSVG(MIXED_TYPES, HD);
      const lottie = generateLottieAnimation(MIXED_TYPES, HD);
      const lottieColors = extractLottieColors(lottie);

      const defaultColor = sceneTypeToFillColor(undefined);
      const contentColor = sceneTypeToFillColor('content');

      // Unknown and missing types should use default
      expect(defaultColor).toEqual(contentColor);

      // Lottie layers 1 (custom type) and 2 (missing type) use default
      expect(lottieColors[1]).toEqual(defaultColor);
      expect(lottieColors[2]).toEqual(defaultColor);

      // SVG also uses content color (#16213e) for those
      expect(svg).toContain('fill="#16213e"');
    });
  });

  // ========== 3. Timing / frame calculation consistency ==========

  describe('timing and frame calculation consistency', () => {
    it('total duration is consistent between SVG animation and Lottie total frames', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      // SVG: total animation time = sum of durations (2+4+2=8s)
      // The SVG animation time appears in style="animation: sN Xs"
      const totalDuration = THREE_SCENES.scenes.reduce(
        (acc, s) => acc + (s.duration ?? 2), 0,
      );
      // Each group uses: animation: sN <totalDuration>s linear infinite
      expect(svg).toContain(`animation:s0 ${totalDuration}s`);
      expect(svg).toContain(`animation:s1 ${totalDuration}s`);
      expect(svg).toContain(`animation:s2 ${totalDuration}s`);

      // Lottie: total frames = sum of (duration * fps)
      const expectedTotalFrames = totalDuration * 30; // 8 * 30 = 240
      expect(lottie.op).toBe(expectedTotalFrames);
    });

    it('each scene duration maps to proportional SVG keyframes and Lottie frames', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // Scene 0: 2s → 60 frames
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(60); // 2 * 30

      // Scene 1: 4s → 120 frames (offset 60)
      expect(layers[1].ip).toBe(60);
      expect(layers[1].op).toBe(180); // 60 + 4*30

      // Scene 2: 2s → 60 frames (offset 180)
      expect(layers[2].ip).toBe(180);
      expect(layers[2].op).toBe(240); // 180 + 2*30
    });

    it('5-scene data produces consistent timing across formats', () => {
      const svg = generateAnimatedSVG(FIVE_SCENES, HD);
      const lottie = generateLottieAnimation(FIVE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      const totalDuration = FIVE_SCENES.scenes.reduce(
        (acc, s) => acc + (s.duration ?? 2), 0,
      ); // 1+3+3+3+2 = 12s

      // SVG total animation duration
      expect(svg).toContain(`animation:s0 ${totalDuration}s`);

      // Lottie total frames = 12 * 30 = 360
      expect(lottie.op).toBe(360);

      // Verify sequential frame offsets
      let expectedIp = 0;
      for (let i = 0; i < 5; i++) {
        const duration = FIVE_SCENES.scenes[i].duration ?? 2;
        const frameCount = duration * 30;
        expect(layers[i].ip).toBe(expectedIp);
        expect(layers[i].op).toBe(expectedIp + frameCount);
        expectedIp += frameCount;
      }
    });

    it('default duration (2s) is applied consistently when omitted', () => {
      const data = {
        scenes: [
          { label: 'A', type: 'content' },
          { label: 'B', type: 'content' },
        ],
      };
      const svg = generateAnimatedSVG(data, HD);
      const lottie = generateLottieAnimation(data, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // Both scenes default to 2s
      const totalDuration = 4; // 2 + 2
      expect(svg).toContain(`animation:s0 ${totalDuration}s`);

      // Lottie: 2 * 30 = 60 frames per scene
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(60);
      expect(layers[1].ip).toBe(60);
      expect(layers[1].op).toBe(120);
      expect(lottie.op).toBe(120);
    });
  });

  // ========== 4. Dimension consistency ==========

  describe('dimension and frame size consistency', () => {
    it('HD (1920x1080) dimensions match across formats', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, HD);
      const lottie = generateLottieAnimation(THREE_SCENES, HD);

      expect(svg).toContain('width="1920"');
      expect(svg).toContain('height="1080"');
      expect(svg).toContain('viewBox="0 0 1920 1080"');

      expect(lottie.w).toBe(1920);
      expect(lottie.h).toBe(1080);
    });

    it('SD (1280x720) dimensions match across formats', () => {
      const svg = generateAnimatedSVG(THREE_SCENES, SD);
      const lottie = generateLottieAnimation(THREE_SCENES, SD);

      expect(svg).toContain('width="1280"');
      expect(svg).toContain('height="720"');
      expect(svg).toContain('viewBox="0 0 1280 720"');

      expect(lottie.w).toBe(1280);
      expect(lottie.h).toBe(720);
    });

    it('custom dimensions (640x480) match across formats', () => {
      const custom = { width: 640, height: 480 };
      const svg = generateAnimatedSVG(THREE_SCENES, custom);
      const lottie = generateLottieAnimation(THREE_SCENES, custom);

      expect(svg).toContain('width="640"');
      expect(svg).toContain('height="480"');
      expect(svg).toContain('viewBox="0 0 640 480"');

      expect(lottie.w).toBe(640);
      expect(lottie.h).toBe(480);
    });

    it('Lottie layers position at center of frame dimensions', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      for (const layer of layers) {
        const ks = layer.ks as Record<string, unknown>;
        const p = ks.p as Record<string, unknown>;
        const pos = p.k as number[];
        // Position at center: [width/2, height/2, 0]
        expect(pos[0]).toBe(HD.width / 2);
        expect(pos[1]).toBe(HD.height / 2);
        expect(pos[2]).toBe(0);
      }
    });

    it('Lottie shape rectangles match frame dimensions', () => {
      const lottie = generateLottieAnimation(THREE_SCENES, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      for (const layer of layers) {
        const shapes = layer.shapes as Record<string, unknown>[];
        const group = shapes[0] as Record<string, unknown>;
        const items = group.it as Record<string, unknown>[];
        const rect = items.find((it: Record<string, unknown>) => it.ty === 'rc') as Record<string, unknown>;
        const size = (rect.s as Record<string, unknown>).k as number[];

        expect(size[0]).toBe(HD.width);
        expect(size[1]).toBe(HD.height);
      }
    });
  });

  // ========== 5. Edge case cross-consistency ==========

  describe('edge case cross-consistency', () => {
    it('empty scenes produce valid output in both formats', () => {
      const empty = { scenes: [] };
      const svg = generateAnimatedSVG(empty, HD);
      const lottie = generateLottieAnimation(empty, HD, 90);

      expect(svg).toContain('<svg');
      expect(svg).toContain('No scene data');
      expect(lottie.layers).toEqual([]);
      expect(lottie.op).toBe(90);
    });

    it('scenes with special characters in labels are consistent', () => {
      const special = {
        scenes: [
          { duration: 2, label: 'A & B < C > "D"', type: 'content' },
          { duration: 3, label: '日本語テスト', type: 'intro' },
        ],
      };

      const svg = generateAnimatedSVG(special, HD);
      const lottie = generateLottieAnimation(special, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      // SVG escapes XML special chars
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&lt;');
      expect(svg).toContain('&gt;');
      expect(svg).toContain('&quot;');

      // Lottie preserves raw labels
      expect(layers[0].nm).toBe('A & B < C > "D"');
      expect(layers[1].nm).toBe('日本語テスト');
    });

    it('very long scene list produces consistent output', () => {
      const longScenes = {
        scenes: Array.from({ length: 20 }, (_, i) => ({
          duration: 1,
          label: `Scene ${i + 1}`,
          type: i === 0 ? 'intro' as const : i === 19 ? 'outro' as const : 'content' as const,
        })),
      };

      const svg = generateAnimatedSVG(longScenes, HD);
      const lottie = generateLottieAnimation(longScenes, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      expect(layers).toHaveLength(20);
      expect(lottie.op).toBe(600); // 20 * 1s * 30fps

      for (let i = 0; i < 20; i++) {
        expect(svg).toContain(`@keyframes s${i}`);
        expect(layers[i].nm).toBe(`Scene ${i + 1}`);
      }
    });

    it('varying durations produce consistent total timing', () => {
      const varied = {
        scenes: [
          { duration: 0.5, label: 'Short', type: 'intro' },
          { duration: 10, label: 'Long', type: 'content' },
          { duration: 1.5, label: 'Medium', type: 'outro' },
        ],
      };

      const svg = generateAnimatedSVG(varied, HD);
      const lottie = generateLottieAnimation(varied, HD);
      const layers = lottie.layers as Record<string, unknown>[];

      const totalDuration = 0.5 + 10 + 1.5; // 12s
      expect(svg).toContain(`animation:s0 ${totalDuration}s`);

      // 0.5 * 30 = 15, 10 * 30 = 300, 1.5 * 30 = 45
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(15);
      expect(layers[1].ip).toBe(15);
      expect(layers[1].op).toBe(315);
      expect(layers[2].ip).toBe(315);
      expect(layers[2].op).toBe(360);
      expect(lottie.op).toBe(360); // 12 * 30
    });
  });
});
