/**
 * REQ-218 / REQ-219 / REQ-221: Animated SVG & Lottie Export + Input Validation
 *
 * Tests the pure functions in animated-scene-renderer.ts:
 *   - generateAnimatedSVG: SVG XML structure, CSS keyframes, XML escaping
 *   - generateLottieAnimation: Lottie 5.7.4 JSON, layers, opacity keyframes
 *   - validateFrameInfo, clampSceneDuration: input validation (REQ-221)
 *   - escapeXml, formatSceneSubtitle: shared helpers
 *
 * These are now independently testable without the full export pipeline.
 */

import {
  generateAnimatedSVG,
  generateLottieAnimation,
  escapeXml,
  formatSceneSubtitle,
  sceneTypeToFillColor,
  buildLayerShapes,
  validateFrameInfo,
  clampSceneDuration,
  sceneDurationSeconds,
  SceneRendererValidationError,
} from '@/export/animated-scene-renderer';
import type { SceneDataset, FrameInfo } from '@/export/animated-scene-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HD: FrameInfo = { width: 1920, height: 1080 };
const CUSTOM: FrameInfo = { width: 800, height: 600 };

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets and quotes', () => {
    expect(escapeXml('<tag "attr">')).toBe('&lt;tag &quot;attr&quot;&gt;');
  });

  it('leaves safe text untouched', () => {
    expect(escapeXml('Hello World')).toBe('Hello World');
  });
});

// ---------------------------------------------------------------------------
// formatSceneSubtitle
// ---------------------------------------------------------------------------

describe('formatSceneSubtitle', () => {
  it('formats seconds-only duration', () => {
    expect(formatSceneSubtitle({ duration: 5 })).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatSceneSubtitle({ duration: 125 })).toBe('2m 5s');
  });

  it('defaults to 2s when no duration', () => {
    expect(formatSceneSubtitle({})).toBe('2s');
  });
});

// ---------------------------------------------------------------------------
// REQ-218: Animated SVG
// ---------------------------------------------------------------------------

describe('REQ-218: generateAnimatedSVG', () => {
  it('produces valid SVG XML with xml declaration', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 2, label: 'Test', type: 'intro' }] },
      HD,
    );

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
  });

  it('renders "No scene data" fallback for empty scenes', () => {
    const svg = generateAnimatedSVG({ scenes: [] }, HD);

    expect(svg).toContain('No scene data');
    expect(svg).toContain('viewBox="0 0 1920 1080"');
  });

  it('renders fallback when scenes is undefined', () => {
    const svg = generateAnimatedSVG({}, HD);

    expect(svg).toContain('No scene data');
  });

  it('includes CSS @keyframes for each scene', () => {
    const svg = generateAnimatedSVG(
      {
        scenes: [
          { duration: 3, label: 'Scene A', type: 'flow' },
          { duration: 2, label: 'Scene B', type: 'tree' },
        ],
      },
      HD,
    );

    expect(svg).toContain('@keyframes s0');
    expect(svg).toContain('@keyframes s1');
  });

  it('escapes XML-special characters in scene labels', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 2, label: 'A <B> & "C"', type: 'flow' }] },
      HD,
    );

    expect(svg).not.toContain('A <B>');
    expect(svg).toContain('A &lt;B&gt; &amp; &quot;C&quot;');
  });

  it('uses scene-type-specific background colors', () => {
    const svg = generateAnimatedSVG(
      {
        scenes: [
          { duration: 2, label: 'Intro', type: 'intro' },
          { duration: 2, label: 'Main', type: 'flow' },
          { duration: 2, label: 'Outro', type: 'outro' },
        ],
      },
      HD,
    );

    expect(svg).toContain('#1a1a2e'); // intro bg
    expect(svg).toContain('#16213e'); // flow (default) bg
    expect(svg).toContain('#0f3460'); // outro bg
  });

  it('uses scene-type-specific font sizes', () => {
    const svg = generateAnimatedSVG(
      {
        scenes: [
          { duration: 2, label: 'Intro', type: 'intro' },
          { duration: 2, label: 'Outro', type: 'outro' },
          { duration: 2, label: 'Default', type: 'flow' },
        ],
      },
      HD,
    );

    expect(svg).toContain('font-size="48"'); // intro
    expect(svg).toContain('font-size="36"'); // outro
    expect(svg).toContain('font-size="24"'); // flow (default)
  });

  it('sets total animation duration equal to sum of scene durations', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 3, label: 'A' }, { duration: 5, label: 'B' }] },
      HD,
    );

    expect(svg).toMatch(/animation:s0 8s/);
    expect(svg).toMatch(/animation:s1 8s/);
  });

  it('defaults scene duration to 2 when undefined', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ label: 'NoDur' }, { label: 'Also' }] },
      HD,
    );

    // 2 scenes × 2s default = 4s total
    expect(svg).toMatch(/animation:s0 4s/);
  });

  it('uses scene label over type over fallback for text', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 1, label: 'MyLabel', type: 'flow' }] },
      HD,
    );

    expect(svg).toContain('>MyLabel<');
  });

  it('falls back to type when label is missing', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 1, type: 'flow' }] },
      HD,
    );

    expect(svg).toContain('>flow<');
  });

  it('falls back to "Scene N" when both label and type are missing', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 1 }] },
      HD,
    );

    expect(svg).toContain('>Scene 1<');
  });

  it('respects custom frame dimensions', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 2, label: 'Custom' }] },
      CUSTOM,
    );

    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('viewBox="0 0 800 600"');
  });
});

// ---------------------------------------------------------------------------
// Pipeline unit bridge: honor durationMs (ms) when duration (s) is absent.
// The pipeline feeds SceneGraph scenes (durationMs in ms, no `duration`) into
// these renderers. Before sceneDurationSeconds, scene.duration was always
// undefined, so every scene collapsed to the 2 s default and the exported
// SVG/Lottie timing was unrelated to the real scene lengths.
// ---------------------------------------------------------------------------

describe('scene duration honors pipeline durationMs (ms)', () => {
  it('sceneDurationSeconds prefers explicit duration (s)', () => {
    expect(sceneDurationSeconds({ duration: 3 })).toBe(3);
    // When both are present, the explicit seconds field wins (no double conversion).
    expect(sceneDurationSeconds({ duration: 3, durationMs: 9000 })).toBe(3);
  });

  it('sceneDurationSeconds converts durationMs (ms) -> seconds', () => {
    expect(sceneDurationSeconds({ durationMs: 5000 })).toBe(5);
    expect(sceneDurationSeconds({ durationMs: 750 })).toBe(0.75);
  });

  it('sceneDurationSeconds ignores non-finite / missing values', () => {
    expect(sceneDurationSeconds({ durationMs: NaN })).toBeUndefined();
    expect(sceneDurationSeconds({ duration: Infinity })).toBeUndefined();
    expect(sceneDurationSeconds({})).toBeUndefined();
  });

  it('SVG total animation duration reflects durationMs', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ durationMs: 5000, label: 'A' }, { durationMs: 10000, label: 'B' }] },
      HD,
    );
    // 5 s + 10 s = 15 s total. Bug (durationMs ignored → 2 s each): 4 s.
    expect(svg).toMatch(/animation:s0 15s/);
    expect(svg).toMatch(/animation:s1 15s/);
    expect(svg).not.toMatch(/animation:s0 4s/);
  });

  it('Lottie layer frame counts reflect durationMs', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ durationMs: 5000, label: 'A' }, { durationMs: 10000, label: 'B' }] },
      HD,
    );
    const layers = lottie.layers as Record<string, unknown>[];
    // 5 s × 30 fps = 150 frames; 10 s × 30 fps = 300 frames; sequential.
    // Bug (2 s each): layer A op=60, layer B ip=60, total op=120.
    expect(layers[0].op).toBe(150);
    expect(layers[1].ip).toBe(150);
    expect(layers[1].op).toBe(450);
    expect(lottie.op).toBe(450);
  });

  it('explicit duration (s) still takes precedence over durationMs', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 3, durationMs: 5000, label: 'A' }] },
      HD,
    );
    const layers = lottie.layers as Record<string, unknown>[];
    // duration=3 wins → 90 frames (not 150 from durationMs).
    expect(layers[0].op).toBe(90);
  });

  it('durationMs below the clamp floor still defaults (no sub-frame scene)', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ durationMs: 0, label: 'Zero' }] },
      HD,
    );
    const layers = lottie.layers as Record<string, unknown>[];
    // 0 ms → 0 s → clampSceneDuration default 2 s → 60 frames.
    expect(layers[0].op).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// REQ-219: Lottie JSON
// ---------------------------------------------------------------------------

describe('REQ-219: generateLottieAnimation', () => {
  it('produces valid Lottie JSON with version 5.7.4', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'Scene 1' }] },
      HD,
    );

    expect(lottie.v).toBe('5.7.4');
    expect(lottie.nm).toBe('AudioDiagramAnimation');
  });

  it('sets framerate to 30', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'S' }] },
      HD,
    );

    expect(lottie.fr).toBe(30);
  });

  it('creates one shape layer per scene', () => {
    const lottie = generateLottieAnimation(
      {
        scenes: [
          { duration: 2, label: 'First' },
          { duration: 3, label: 'Second' },
          { duration: 1, label: 'Third' },
        ],
      },
      HD,
    );

    const layers = lottie.layers as Record<string, unknown>[];
    expect(layers).toHaveLength(3);
    expect(layers[0].ty).toBe(4);
    expect(layers[0].nm).toBe('First');
    expect(layers[1].nm).toBe('Second');
    expect(layers[2].nm).toBe('Third');
  });

  it('calculates correct frame offsets per layer', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'A' }, { duration: 3, label: 'B' }] },
      HD,
    );

    const layers = lottie.layers as Record<string, unknown>[];

    // Layer 0: 2s × 30fps = 60 frames
    expect(layers[0].ip).toBe(0);
    expect(layers[0].op).toBe(60);
    expect(layers[0].st).toBe(0);

    // Layer 1: starts at frame 60, 3s × 30fps = 90 frames
    expect(layers[1].ip).toBe(60);
    expect(layers[1].op).toBe(150);
    expect(layers[1].st).toBe(60);

    // Total out-point
    expect(lottie.op).toBe(150);
  });

  it('includes opacity keyframes with fade-in/fade-out', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'Fade' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const ks = layer.ks as Record<string, unknown>;
    const opacity = ks.o as Record<string, unknown>;
    const keyframes = opacity.k as Record<string, unknown>[];

    expect(opacity.a).toBe(1); // animated
    expect(keyframes).toHaveLength(4);
    expect(keyframes[0].s).toEqual([0]); // start transparent
    expect(keyframes[1].s).toEqual([100]); // fade in to opaque
  });

  it('outputs correct dimensions', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'Dim' }] },
      HD,
    );

    expect(lottie.w).toBe(1920);
    expect(lottie.h).toBe(1080);
  });

  it('respects custom dimensions', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'C' }] },
      CUSTOM,
    );

    expect(lottie.w).toBe(800);
    expect(lottie.h).toBe(600);
  });

  it('falls back to valid structure with empty scenes', () => {
    const lottie = generateLottieAnimation({ scenes: [] }, HD, 42);

    expect(lottie.layers).toHaveLength(0);
    expect(lottie.v).toBe('5.7.4');
    expect(lottie.op).toBe(42); // fallback frame count
  });

  it('uses 0 out-point for empty scenes without fallback', () => {
    const lottie = generateLottieAnimation({ scenes: [] }, HD);

    expect(lottie.op).toBe(0);
  });

  it('assigns layer indices sequentially', () => {
    const lottie = generateLottieAnimation(
      {
        scenes: [
          { duration: 1, label: 'L0' },
          { duration: 1, label: 'L1' },
          { duration: 1, label: 'L2' },
        ],
      },
      HD,
    );

    const layers = lottie.layers as Record<string, unknown>[];
    expect(layers[0].ind).toBe(0);
    expect(layers[1].ind).toBe(1);
    expect(layers[2].ind).toBe(2);
  });

  it('defaults scene duration to 2s when undefined', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ label: 'NoDur' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    // 2s × 30fps = 60 frames
    expect(layer.op).toBe(60);
  });

  it('uses label over type over fallback for layer name', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'Labeled', type: 'flow' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    expect(layer.nm).toBe('Labeled');
  });

  it('falls back to type when label is missing', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, type: 'tree' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    expect(layer.nm).toBe('tree');
  });

  it('falls back to "Scene N" when both label and type are missing', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1 }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    expect(layer.nm).toBe('Scene 1');
  });

  it('sets position anchor to center of frame', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'Pos' }] },
      CUSTOM,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const ks = layer.ks as Record<string, unknown>;
    const pos = ks.p as Record<string, unknown>;

    expect(pos.a).toBe(0);
    expect(pos.k).toEqual([400, 300, 0]); // 800/2, 600/2
  });

  it('calculates fade-in keyframe at 0.3s into scene', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 5, label: 'Long' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const ks = layer.ks as Record<string, unknown>;
    const opacity = ks.o as Record<string, unknown>;
    const keyframes = opacity.k as Record<string, unknown>[];

    // fade-in end keyframe at 0.3s × 30fps = frame 9
    expect(keyframes[1].t).toBe(9);
  });

  it('calculates fade-out start at 0.3s before scene end', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 5, label: 'Long' }] },
      HD,
    );

    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const ks = layer.ks as Record<string, unknown>;
    const opacity = ks.o as Record<string, unknown>;
    const keyframes = opacity.k as Record<string, unknown>[];

    // total frames = 5 × 30 = 150, fade-out at 150 - 9 = 141
    expect(keyframes[2].t).toBe(141);
  });
});

// ---------------------------------------------------------------------------
// REQ-219 extended: Lottie shape content (visual shapes in layers)
// ---------------------------------------------------------------------------

describe('REQ-219: Lottie layer shapes', () => {
  it('each layer includes a shapes array', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'S1', type: 'content' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];

    expect(layer.shapes).toBeDefined();
    expect(Array.isArray(layer.shapes)).toBe(true);
    expect((layer.shapes as unknown[]).length).toBeGreaterThan(0);
  });

  it('shapes contain a background group with ty=gr', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'S', type: 'content' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];

    const group = shapes.find((s) => s.ty === 'gr');
    expect(group).toBeDefined();
    expect(group!.nm).toBe('Background Group');
  });

  it('background group contains a rectangle shape (ty=rc)', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'S', type: 'content' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];

    const rect = items.find((it) => it.ty === 'rc');
    expect(rect).toBeDefined();
    expect(rect!.nm).toBe('Background Rect');
  });

  it('rectangle size matches frame dimensions', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'S' }] },
      CUSTOM,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];
    const rect = items.find((it) => it.ty === 'rc')!;

    const size = rect.s as Record<string, unknown>;
    expect(size.k).toEqual([800, 600]);
  });

  it('background fill uses scene-type-specific color for intro', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'Intro', type: 'intro' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];
    const fill = items.find((it) => it.ty === 'fl')!;

    const color = fill.c as Record<string, unknown>;
    expect(color.k).toEqual(sceneTypeToFillColor('intro'));
  });

  it('background fill uses outro color for outro scenes', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'End', type: 'outro' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];
    const fill = items.find((it) => it.ty === 'fl')!;

    const color = fill.c as Record<string, unknown>;
    expect(color.k).toEqual(sceneTypeToFillColor('outro'));
  });

  it('background fill uses default color for content scenes', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'Main', type: 'content' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];
    const fill = items.find((it) => it.ty === 'fl')!;

    const color = fill.c as Record<string, unknown>;
    expect(color.k).toEqual(sceneTypeToFillColor('content'));
  });

  it('background group ends with a transform item (ty=tr)', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'S' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const shapes = layer.shapes as Record<string, unknown>[];
    const group = shapes.find((s) => s.ty === 'gr')!;
    const items = group.it as Record<string, unknown>[];

    const transform = items.find((it) => it.ty === 'tr');
    expect(transform).toBeDefined();
    expect((transform!.o as Record<string, unknown>).k).toBe(100);
  });

  it('all layers in multi-scene animation have shapes', () => {
    const lottie = generateLottieAnimation(
      {
        scenes: [
          { duration: 2, label: 'A', type: 'intro' },
          { duration: 3, label: 'B', type: 'content' },
          { duration: 1, label: 'C', type: 'outro' },
        ],
      },
      HD,
    );
    const layers = lottie.layers as Record<string, unknown>[];

    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.shapes).toBeDefined();
      const shapes = layer.shapes as Record<string, unknown>[];
      expect(shapes.some((s) => s.ty === 'gr')).toBe(true);
    }
  });

  it('layer includes anchor point property (ks.a)', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 1, label: 'S' }] },
      HD,
    );
    const layer = (lottie.layers as Record<string, unknown>[])[0];
    const ks = layer.ks as Record<string, unknown>;

    expect(ks.a).toBeDefined();
    expect((ks.a as Record<string, unknown>).k).toEqual([0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// sceneTypeToFillColor
// ---------------------------------------------------------------------------

describe('sceneTypeToFillColor', () => {
  it('returns intro color for intro type', () => {
    const color = sceneTypeToFillColor('intro');
    expect(color).toHaveLength(4);
    expect(color[3]).toBe(1); // alpha
  });

  it('returns outro color for outro type', () => {
    const color = sceneTypeToFillColor('outro');
    expect(color).toHaveLength(4);
  });

  it('returns default color for undefined type', () => {
    const color = sceneTypeToFillColor(undefined);
    expect(color).toEqual(sceneTypeToFillColor('content'));
  });

  it('all color channels are in 0–1 range', () => {
    for (const type of ['intro', 'outro', 'content', undefined] as (string | undefined)[]) {
      const color = sceneTypeToFillColor(type);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildLayerShapes
// ---------------------------------------------------------------------------

describe('buildLayerShapes', () => {
  it('returns an array with one group', () => {
    const shapes = buildLayerShapes({ duration: 2, type: 'content' }, 800, 600);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].ty).toBe('gr');
  });

  it('group contains rect, fill, and transform items', () => {
    const shapes = buildLayerShapes({ duration: 2 }, 800, 600);
    const items = shapes[0].it as Record<string, unknown>[];

    const types = items.map((it) => it.ty);
    expect(types).toContain('rc');
    expect(types).toContain('fl');
    expect(types).toContain('tr');
  });

  it('rectangle has rounded corners (r=8)', () => {
    const shapes = buildLayerShapes({ duration: 2 }, 800, 600);
    const items = shapes[0].it as Record<string, unknown>[];
    const rect = items.find((it) => it.ty === 'rc')!;

    const roundness = rect.r as Record<string, unknown>;
    expect(roundness.k).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// REQ-221: Input validation
// ---------------------------------------------------------------------------

describe('REQ-221: validateFrameInfo', () => {
  it('returns valid dimensions unchanged', () => {
    expect(validateFrameInfo({ width: 1920, height: 1080 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it('rounds fractional dimensions to integers', () => {
    expect(validateFrameInfo({ width: 1920.7, height: 1080.3 })).toEqual({
      width: 1921,
      height: 1080,
    });
  });

  it('replaces zero width with default (1920)', () => {
    expect(validateFrameInfo({ width: 0, height: 600 })).toEqual({
      width: 1920,
      height: 600,
    });
  });

  it('replaces negative width with default (1920)', () => {
    expect(validateFrameInfo({ width: -100, height: 600 })).toEqual({
      width: 1920,
      height: 600,
    });
  });

  it('replaces NaN width with default (1920)', () => {
    expect(validateFrameInfo({ width: NaN, height: 600 })).toEqual({
      width: 1920,
      height: 600,
    });
  });

  it('replaces Infinity width with default (1920)', () => {
    expect(validateFrameInfo({ width: Infinity, height: 600 })).toEqual({
      width: 1920,
      height: 600,
    });
  });

  it('replaces zero height with default (1080)', () => {
    expect(validateFrameInfo({ width: 800, height: 0 })).toEqual({
      width: 800,
      height: 1080,
    });
  });

  it('clamps width exceeding 7680 (8K) to 7680', () => {
    expect(validateFrameInfo({ width: 10000, height: 1080 })).toEqual({
      width: 7680,
      height: 1080,
    });
  });

  it('clamps height exceeding 7680 to 7680', () => {
    expect(validateFrameInfo({ width: 1920, height: 9999 })).toEqual({
      width: 1920,
      height: 7680,
    });
  });

  it('clamps sub-pixel width (< 1) to 1', () => {
    expect(validateFrameInfo({ width: 0.5, height: 1080 })).toEqual({
      width: 1,
      height: 1080,
    });
  });

  it('handles both dimensions invalid simultaneously', () => {
    expect(validateFrameInfo({ width: -1, height: -1 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});

describe('REQ-221: clampSceneDuration', () => {
  it('returns valid positive duration unchanged', () => {
    expect(clampSceneDuration(5)).toBe(5);
  });

  it('returns 2 for undefined', () => {
    expect(clampSceneDuration(undefined)).toBe(2);
  });

  it('returns 2 for null', () => {
    expect(clampSceneDuration(null)).toBe(2);
  });

  it('returns 2 for zero', () => {
    expect(clampSceneDuration(0)).toBe(2);
  });

  it('returns 2 for negative numbers', () => {
    expect(clampSceneDuration(-10)).toBe(2);
  });

  it('returns 2 for NaN', () => {
    expect(clampSceneDuration(NaN)).toBe(2);
  });

  it('returns 2 for Infinity', () => {
    expect(clampSceneDuration(Infinity)).toBe(2);
  });

  it('returns 2 for non-number values', () => {
    expect(clampSceneDuration('3')).toBe(2);
    expect(clampSceneDuration({})).toBe(2);
    expect(clampSceneDuration(true)).toBe(2);
  });

  it('caps duration at 3600 (1 hour)', () => {
    expect(clampSceneDuration(7200)).toBe(3600);
  });

  it('preserves small fractional durations', () => {
    expect(clampSceneDuration(0.5)).toBe(0.5);
  });

  it('preserves duration exactly at 3600', () => {
    expect(clampSceneDuration(3600)).toBe(3600);
  });
});

describe('REQ-221: SceneRendererValidationError', () => {
  it('has correct name property', () => {
    const err = new SceneRendererValidationError('test', 'field');
    expect(err.name).toBe('SceneRendererValidationError');
  });

  it('exposes field property', () => {
    const err = new SceneRendererValidationError('bad input', 'width');
    expect(err.field).toBe('width');
  });

  it('exposes message', () => {
    const err = new SceneRendererValidationError('bad input', 'width');
    expect(err.message).toBe('bad input');
  });

  it('is an instance of Error', () => {
    const err = new SceneRendererValidationError('test', 'x');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('REQ-221: Integration — invalid inputs produce safe outputs', () => {
  it('SVG handles null-ish sceneData gracefully', () => {
    const svg = generateAnimatedSVG(null as unknown as SceneDataset, { width: 0, height: 0 });
    expect(svg).toContain('No scene data');
    // should use default dimensions since width/height are invalid
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
  });

  it('SVG handles undefined sceneData gracefully', () => {
    const svg = generateAnimatedSVG(undefined as unknown as SceneDataset, { width: -5, height: -5 });
    expect(svg).toContain('No scene data');
    expect(svg).toContain('width="1920"');
  });

  it('Lottie handles null-ish sceneData gracefully', () => {
    const lottie = generateLottieAnimation(null as unknown as SceneDataset, { width: 0, height: 0 });
    expect(lottie.v).toBe('5.7.4');
    expect(lottie.w).toBe(1920);
    expect(lottie.h).toBe(1080);
    expect((lottie.layers as unknown[]).length).toBe(0);
  });

  it('SVG clamps extremely large dimensions to 8K', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ duration: 2, label: 'Big' }] },
      { width: 50000, height: 50000 },
    );
    expect(svg).toContain('width="7680"');
    expect(svg).toContain('height="7680"');
  });

  it('Lottie clamps extremely large dimensions to 8K', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ duration: 2, label: 'Big' }] },
      { width: 50000, height: 50000 },
    );
    expect(lottie.w).toBe(7680);
    expect(lottie.h).toBe(7680);
  });

  it('SVG uses default duration for scenes with invalid duration', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ label: 'A', duration: -5 }, { label: 'B', duration: NaN as unknown as number }] },
      HD,
    );
    // Both default to 2s → total = 4s
    expect(svg).toMatch(/animation:s0 4s/);
    expect(svg).toMatch(/animation:s1 4s/);
  });

  it('Lottie uses default duration for scenes with invalid duration', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ label: 'A', duration: -5 }, { label: 'B', duration: NaN as unknown as number }] },
      HD,
    );
    // Both default to 2s → 60 frames each → total op = 120
    expect(lottie.op).toBe(120);
  });

  it('SVG caps extremely long scene durations at 1 hour', () => {
    const svg = generateAnimatedSVG(
      { scenes: [{ label: 'Long', duration: 99999 }] },
      HD,
    );
    expect(svg).toMatch(/animation:s0 3600s/);
  });

  it('Lottie caps extremely long scene durations at 1 hour', () => {
    const lottie = generateLottieAnimation(
      { scenes: [{ label: 'Long', duration: 99999 }] },
      HD,
    );
    // 3600s × 30fps = 108000 frames
    expect(lottie.op).toBe(108000);
  });
});
