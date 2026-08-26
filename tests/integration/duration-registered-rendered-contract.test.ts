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
 *     returned by `selectComposition` (src/pipeline/actual-video-renderer.ts). This is
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
 * It also pins the INTENTIONAL divergences for malformed input the pipeline
 * never emits: `durationMs: 0` is treated as 5 s (DEFAULT_SCENE_DURATION_MS)
 * by the render path's safety fallback but as 0 by the registration path; and
 * a truthy sub-second scene is floored to 1 s by the render path's
 * minimum-1-second guarantee but not by registration. Asserting those
 * divergences here documents the design decisions so they are not silently
 * "fixed".
 */

import { jest } from '@jest/globals';
import { DEFAULT_SCENE_DURATION_MS } from '@/pipeline/scene-duration-limits';
import type { SceneGraph } from '@stv/core/types/diagram';

// ESM mocking: unstable_mockModule + dynamic import (jest-esm-mock-pattern).
jest.unstable_mockModule('@remotion/bundler', () => ({
  bundle: jest.fn<any>().mockResolvedValue('/tmp/mock-bundle'),
}));

jest.unstable_mockModule('@remotion/renderer', () => ({
  // durationInFrames is overwritten by getComposition from scene durations, so
  // the seed value here is irrelevant — the test reads the post-override value.
  selectComposition: jest.fn<any>().mockResolvedValue({
    durationInFrames: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    id: 'SpeechToVisualsVideo',
  }),
  renderMedia: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn<any>().mockReturnValue(true),
    mkdirSync: jest.fn<any>(),
    promises: {
      access: jest.fn<any>().mockResolvedValue(undefined),
      writeFile: jest.fn<any>().mockResolvedValue(undefined),
      readFile: jest.fn<any>().mockResolvedValue('{}'),
    },
  },
}));

const { calculateTotalFrames, DEFAULT_FPS } = await import('@/remotion/Video');
const { ActualVideoRenderer } = await import('@/pipeline/actual-video-renderer');
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
      // The ONLY case where the shared Math.ceil is observable: every other
      // case is a whole-second multiple, so ceil is a no-op and a one-path
      // ceil→round/floor regression (exactly this file's asymmetric-regression
      // charter) would stay GREEN without this pin. 3667 + 3444 = 7111 ms →
      // 213.33 frames → ceil 214 (round would say 213, floor 213). Both
      // durations sit inside the [3000, 10000] ms clamp, so the shape stays
      // pipeline-realistic.
      name: 'two scenes 3667+3444 ms → 214 frames (ceil of 213.33, not 213)',
      scenes: sequential([3667, 3444]),
      expected: 214,
    },
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
    // getComposition([]) → empty-branch DEFAULT_SCENE_DURATION_MS * 2 = 10000 ms
    // → 300 frames. Two independent formulas that agree only while the canonical
    // default is 5000 — this pin flags a cross-path divergence if it ever drifts.
    expect(registered).toBe(300);
    expect(rendered).toBe(300);
    expect(registered).toBe(rendered);
  });

  describe('intentional divergences for malformed input (pinned, not a bug)', () => {
    // The pipeline NEVER emits durationMs: 0 (it clamps to [3000, 10000] ms).
    // For such malformed input the two paths intentionally differ:
    //   - registration (calculateTotalFrames): 0 contributes 0 ms → 1-frame floor.
    //   - render (getComposition): `durationMs || DEFAULT_SCENE_DURATION_MS`
    //     treats 0 as missing → 5 s per scene (REQ-405 unified the render path
    //     onto the canonical 5000 — it previously invented an ad-hoc 10000,
    //     double the canonical substitute).
    // The render path's safety default is deliberate and single-sourced by
    // tests/guards/scene-duration-limits-single-source.test.ts. Pinning the
    // divergence here keeps a future "unification" from silently changing
    // render behaviour without a conscious decision + test update.
    //
    // The rendered expectation is DERIVED from the canonical constant instead
    // of a bare frame count: the 600→300 stale-pin incident (6a6d0663) was
    // exactly this test hardcoding the frame count of a value the render path
    // later re-sourced. Deriving keeps the pin sensitive to the render-path
    // SUBSTITUTE (any constant other than DEFAULT_SCENE_DURATION_MS REDs)
    // while staying correct through a conscious re-tuning of the constant
    // itself, which its own single-source guard pins.
    it('durationMs:0 → registered 1 frame, rendered two canonical-default scenes', async () => {
      const scenes = sequential([0, 0]);
      const registered = calculateTotalFrames(scenes, FPS);
      const rendered = await renderedFrames(renderer, scenes);
      // 2 × (0 || DEFAULT_SCENE_DURATION_MS) = 10000 ms → 300 frames at 30fps.
      const expectedRendered = (scenes.length * DEFAULT_SCENE_DURATION_MS / 1000) * FPS;
      expect(registered).toBe(1);
      expect(rendered).toBe(expectedRendered);
      expect(registered).not.toBe(rendered);
    });

    it('sub-second scene (500 ms, truthy) → registered 15 frames, rendered floored to 1 s', async () => {
      const scenes = sequential([500]);
      const registered = calculateTotalFrames(scenes, FPS);
      const rendered = await renderedFrames(renderer, scenes);
      // 500 ms is TRUTHY, so the render-path substitute does NOT fire; instead
      // its minimum-1-second floor (Math.max(resolvedFps, ·) in
      // getComposition) pads the composition to 30 frames, while registration's
      // Math.max(1, ·) floor leaves ceil(0.5 s × 30) = 15. The pipeline clamps
      // to ≥ 3000 ms so this divergence is unreachable in production — pinned
      // because the zero-duration pin above would stay GREEN through a future
      // floor "unification" (dropping the render floor to 1 frame); this one
      // would not.
      //
      // Both expectations are DERIVED from FPS (= DEFAULT_FPS), not pinned as
      // bare 15/30: a conscious DEFAULT_FPS retuning updates the pins instead
      // of leaving a stale-RED, while dropping the render floor still REDs
      // (derived 30 vs received 15 at 30 fps) — the derivations mirror the
      // exact per-path formulas, render's including its Math.max floor.
      const expectedRegistered = Math.ceil((500 / 1000) * FPS); // registration has no 1 s floor
      const expectedRendered = Math.max(FPS, Math.ceil((500 / 1000) * FPS)); // render: min-1-second floor
      expect(registered).toBe(expectedRegistered);
      expect(rendered).toBe(expectedRendered);
      expect(registered).not.toBe(rendered);
    });
  });
});
