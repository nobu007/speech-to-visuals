/**
 * Integration contract: the registered composition durationInFrames MUST equal
 * the rendered durationInFrames for the same pipeline scenes.
 *
 * Two independent frame-count paths exist in this codebase, each already tested
 * in isolation:
 *
 *   REGISTRATION path — Root.tsx sets
 *     `<Composition durationInFrames={calculateTotalFrames(scenes)} />`
 *     (src/remotion/Video.tsx). This is the metadata Remotion Studio / preview
 *     uses and what a real `selectComposition` reads from the bundle.
 *
 *   RENDER path — ActualVideoRenderer.getComposition computes its own
 *     durationInFrames from SUM(scene.durationMs) and OVERWRITES the value
 *     returned by `selectComposition` (src/lib/actualVideoRenderer.ts). This is
 *     the duration the actual MP4 render uses.
 *
 * These two paths use *different* code (different sum expressions, different
 * minimum-frame floors, different fallbacks for missing durationMs). For
 * pipeline-realistic scenes they must produce the SAME number, otherwise the
 * rendered video is silently truncated or padded relative to what the
 * composition declares — exactly the time-unit regression class that has bitten
 * this project repeatedly (DiagramVideo ms/s, video-generator durationMs×1000).
 *
 * The existing per-path tests (diagram-video-duration, actualVideoRenderer-
 * duration-integration) prove each path is *individually* correct. They CANNOT
 * catch an *asymmetric* regression — e.g. someone swaps SUM→MAX in only
 * calculateTotalFrames, or reintroduces a /1000 in only getComposition — because
 * each path's own test would be updated alongside. This file feeds the SAME
 * scenes to BOTH paths and asserts equality, closing that gap at the
 * integration layer.
 *
 * It also pins the one INTENTIONAL divergence: a scene with `durationMs: 0`
 * (malformed input the pipeline never emits) is treated as 10 s by the render
 * path's safety fallback but as 0 by the registration path. Asserting that
 * divergence here documents the design decision so it is not silently "fixed".
 */

import { jest } from '@jest/globals';
import type { SceneGraph } from '@/types/diagram';

// ESM mocking: unstable_mockModule + dynamic import (jest-esm-mock-pattern).
jest.unstable_mockModule('@remotion/bundler', () => ({
  bundle: jest.fn().mockResolvedValue('/tmp/mock-bundle'),
}));

jest.unstable_mockModule('@remotion/renderer', () => ({
  // durationInFrames is overwritten by getComposition from scene durations, so
  // the seed value here is irrelevant — the test reads the post-override value.
  selectComposition: jest.fn().mockResolvedValue({
    durationInFrames: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    id: 'SpeechToVisualsVideo',
  }),
  renderMedia: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    promises: {
      access: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue('{}'),
    },
  },
}));

const { calculateTotalFrames, DEFAULT_FPS } = await import('@/remotion/Video');
const { ActualVideoRenderer } = await import('@/lib/actualVideoRenderer');
const { selectComposition } = await import('@remotion/renderer');

const FPS = DEFAULT_FPS; // 30

/** Build a pipeline-shaped scene: flow layout, ms-based start/duration. */
function makeScene(id: string, durationMs: number, startMs: number): SceneGraph {
  return {
    id,
    type: 'flow',
    summary: id,
    startMs,
    durationMs,
    keyphrases: [],
    layout: {
      type: 'flow',
      nodes: [
        { id: `${id}-n1`, label: 'A', x: 100, y: 100, width: 120, height: 60 },
        { id: `${id}-n2`, label: 'B', x: 300, y: 100, width: 120, height: 60 },
      ],
      edges: [{ id: `${id}-e1`, source: `${id}-n1`, target: `${id}-n2` }],
      width: 1920,
      height: 1080,
    },
  } as unknown as SceneGraph;
}

/** Render-path durationInFrames for the given scenes (via real getComposition). */
async function renderedFrames(renderer: InstanceType<typeof ActualVideoRenderer>, scenes: SceneGraph[]): Promise<number> {
  const getComposition = (renderer as unknown as {
    getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<unknown>;
  }).getComposition;
  try {
    await getComposition('/tmp/mock-bundle', scenes);
  } catch {
    // Remotion internals may throw in the test env; selectComposition is still
    // called and its (overwritten) result recorded before any throw.
  }
  const results = (selectComposition as jest.Mock).mock.results;
  const composition = await results[results.length - 1].value as { durationInFrames: number };
  return composition.durationInFrames;
}

/** Sequential scene set: each scene starts where the previous ended. */
function sequential(durationsMs: number[]): SceneGraph[] {
  let cursor = 0;
  return durationsMs.map((d, i) => {
    const s = makeScene(`s${i}`, d, cursor);
    cursor += d;
    return s;
  });
}

describe('Registered ≡ rendered durationInFrames (cross-path contract)', () => {
  let renderer: InstanceType<typeof ActualVideoRenderer>;

  beforeEach(() => {
    renderer = new ActualVideoRenderer();
    jest.clearAllMocks();
  });

  // Each case is a realistic pipeline output shape: sequential, non-overlapping,
  // per-scene duration within the [3000, 10000] ms clamp the pipeline enforces.
  const cases: Array<{ name: string; scenes: SceneGraph[]; expected: number }> = [
    { name: 'single 5 s scene → 150 frames', scenes: sequential([5000]), expected: 150 },
    { name: 'three scenes 3+5+4 s → 360 frames', scenes: sequential([3000, 5000, 4000]), expected: 360 },
    {
      name: 'five scenes 4+6+8+7+5 s → 900 frames',
      scenes: sequential([4000, 6000, 8000, 7000, 5000]),
      expected: 900,
    },
    {
      name: 'ten 3 s scenes → 900 frames',
      scenes: sequential([3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000]),
      expected: 900,
    },
    { name: 'three max-duration 10 s scenes → 900 frames', scenes: sequential([10000, 10000, 10000]), expected: 900 },
  ];

  for (const tc of cases) {
    it(`${tc.name}: calculateTotalFrames === rendered === ${tc.expected}`, async () => {
      const registered = calculateTotalFrames(tc.scenes, FPS);
      const rendered = await renderedFrames(renderer, tc.scenes);

      // Absolute correctness — guards the symmetric ms/s collapse where both
      // paths would agree but on the WRONG (collapsed) value.
      expect(registered).toBe(tc.expected);
      expect(rendered).toBe(tc.expected);

      // The cross-path agreement itself — guards asymmetric regressions that
      // no isolated per-path test can catch.
      expect(registered).toBe(rendered);
    });
  }

  it('empty scene list: both paths fall back to the 10 s default (300 frames)', async () => {
    const registered = calculateTotalFrames([], FPS);
    const rendered = await renderedFrames(renderer, []);
    // calculateTotalFrames([]) → DEFAULT_FPS * 10 = 300.
    // getComposition([]) → empty-branch default 10000 ms → 300 frames.
    expect(registered).toBe(300);
    expect(rendered).toBe(300);
    expect(registered).toBe(rendered);
  });

  describe('intentional divergence for malformed zero-duration input (pinned, not a bug)', () => {
    // The pipeline NEVER emits durationMs: 0 (it clamps to [3000, 10000] ms).
    // For such malformed input the two paths intentionally differ:
    //   - registration (calculateTotalFrames): 0 contributes 0 ms → 1-frame floor.
    //   - render (getComposition): `durationMs || 10000` treats 0 as missing → 10 s.
    // The render path's safety default is deliberate and covered by
    // actualVideoRenderer-duration-integration.test.ts ("scenes with zero
    // durationMs default to 10000ms"). Pinning the divergence here keeps a
    // future "unification" from silently changing render behaviour without a
    // conscious decision + test update.
    it('durationMs:0 → registered 1 frame, rendered 600 frames (two 10 s defaults)', async () => {
      const scenes = sequential([0, 0]);
      const registered = calculateTotalFrames(scenes, FPS);
      const rendered = await renderedFrames(renderer, scenes);
      expect(registered).toBe(1);
      expect(rendered).toBe(600);
      expect(registered).not.toBe(rendered);
    });
  });
});
