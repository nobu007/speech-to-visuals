/**
 * Integration contract test: the render path must query the SAME composition id
 * that Root.tsx registers.
 *
 * Background — a silent production failure class:
 *   Root.tsx registers exactly one `<Composition id={COMPOSITION_ID}>`
 *   (`'SpeechToVisualsVideo'`, locked by Root.test.tsx). The server-side render
 *   path (ActualVideoRenderer.getComposition → Remotion `selectComposition`)
 *   must query THAT id. Previously the render path hardcoded `'DiagramVideo'`,
 *   which is never registered, so a real `selectComposition` would throw — and
 *   VideoGenerator.executeRemotionRender swallows that error and silently falls
 *   back to mock rendering. Net effect: no real video is ever produced, yet
 *   every unit test passed (selectComposition was always mocked).
 *
 * This test reaches the REAL getComposition via cast (no logic mirror) and pins
 * the contract from the query side. Together with Root.test.tsx (which pins the
 * registration side: `Composition.id === COMPOSITION_ID`), it proves the full
 * loop: queried id === registered id. It also re-asserts the frame-count ↔
 * scene-duration invariant through the real getComposition path, catching
 * time-unit regressions (the DiagramVideo ms/s bug class) at the integration
 * layer — the exact guard the feedback asked for, since a visual render needs
 * the native bundler which is unavailable in this environment.
 */

import { jest } from '@jest/globals';
import type { SceneGraph } from '@stv/core/types/diagram';
import { COMPOSITION_ID } from '@/remotion/composition-id';
import { DEFAULT_FPS } from '@/remotion/scene-synchronizer';

// ESM mocking: unstable_mockModule + dynamic import (see jest-esm-mock-pattern).
jest.unstable_mockModule('@remotion/bundler', () => ({
  bundle: jest.fn<() => Promise<unknown>>().mockResolvedValue('/tmp/mock-bundle'),
}));

jest.unstable_mockModule('@remotion/renderer', () => ({
  selectComposition: jest.fn<() => Promise<unknown>>().mockResolvedValue({
    durationInFrames: 0, // overwritten by getComposition from scene durations
    fps: 30,
    width: 1920,
    height: 1080,
    id: COMPOSITION_ID,
  }),
  renderMedia: jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn<() => unknown>().mockReturnValue(true),
    mkdirSync: jest.fn(),
    promises: {
      access: jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
      writeFile: jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
      readFile: jest.fn<() => Promise<unknown>>().mockResolvedValue('{}'),
    },
  },
}));

const { ActualVideoRenderer } = await import('@/pipeline/actual-video-renderer');
const { selectComposition } = await import('@remotion/renderer') as typeof import('@remotion/renderer');

interface CompositionArg {
  serveUrl: string;
  id: string;
  inputProps: unknown;
}

/** Read the args selectComposition was called with (the render-path query). */
function lastSelectCall(): CompositionArg {
  const calls = (selectComposition as unknown as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as CompositionArg;
}

/** Read the composition object getComposition returned (durationInFrames set). */
async function lastComposition(): Promise<{ durationInFrames: number; id: string }> {
  const results = (selectComposition as unknown as jest.Mock).mock.results;
  return results[results.length - 1].value as Promise<{ durationInFrames: number; id: string }>;
}

function makeScene(id: string, durationMs: number, startMs: number): SceneGraph {
  return {
    id,
    type: 'flow',
    summary: id,
    startMs,
    durationMs,
    keyphrases: [],
    layout: {
      nodes: [
        { id: `${id}-n1`, label: 'A', x: 100, y: 100, width: 120, height: 60 },
        { id: `${id}-n2`, label: 'B', x: 300, y: 100, width: 120, height: 60 },
      ],
      edges: [{ from: `${id}-n1`, to: `${id}-n2` }],
    },
  } as unknown as SceneGraph;
}

describe('Render-path composition-id contract + frame-count invariant', () => {
  let renderer: InstanceType<typeof ActualVideoRenderer>;

  beforeEach(() => {
    renderer = new ActualVideoRenderer();
    jest.clearAllMocks();
  });

  describe('composition id: query side === registered side', () => {
    it('selectComposition is called with the registered COMPOSITION_ID', async () => {
      const getComposition = (renderer as unknown as {
        getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<unknown>;
      }).getComposition;

      try {
        await getComposition('/tmp/mock-bundle', [makeScene('s1', 5000, 0)]);
      } catch {
        // Remotion internals may throw in the test env; the call args are
        // still recorded before the throw.
      }

      expect(selectComposition).toHaveBeenCalled();
      expect(lastSelectCall().id).toBe(COMPOSITION_ID);
    });

    it('COMPOSITION_ID is the registered value (matches Root.test.tsx)', () => {
      // Self-documenting: the contract constant must equal the id Root
      // registers. Root.test.tsx asserts the registration side
      // (`Composition.id === COMPOSITION_ID`); this asserts the constant
      // itself, so the two files together prove query === registration.
      expect(COMPOSITION_ID).toBe('SpeechToVisualsVideo');
    });

    it('the queried id is NOT a stale unregistered name', async () => {
      // Regression guard for the original bug: the render path hardcoded
      // 'DiagramVideo', which no <Composition> registers.
      const getComposition = (renderer as unknown as {
        getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<unknown>;
      }).getComposition;
      try {
        await getComposition('/tmp/mock-bundle', [makeScene('s1', 3000, 0)]);
      } catch {
        // ignored — call args recorded
      }
      expect(lastSelectCall().id).not.toBe('DiagramVideo');
    });
  });

  describe('frame-count matches scene durations through the real getComposition path', () => {
    const getComposition = (renderer: InstanceType<typeof ActualVideoRenderer>) =>
      (renderer as unknown as {
        getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<unknown>;
      }).getComposition;

    it('3 sequential scenes (3s + 5s + 4s = 12s) → 360 frames at 30fps', async () => {
      const scenes = [
        makeScene('intro', 3000, 0),
        makeScene('body', 5000, 3000),
        makeScene('outro', 4000, 8000),
      ];
      try {
        await getComposition(renderer)('/tmp/mock-bundle', scenes);
      } catch {
        // ignored
      }
      const composition = await lastComposition();
      // DERIVED from the scene durations × canonical DEFAULT_FPS (mirrors
      // getComposition's Math.ceil((totalMs / 1000) * resolvedFps); its
      // min-1-second floor is a no-op at these durations). A conscious
      // DEFAULT_FPS retuning updates the pin instead of leaving a stale-RED,
      // while the time-unit collapse (12000 ms treated as 12 s → ~0/1 frames)
      // still REDs. Pre-fix time-unit bug would collapse this toward the
      // 10s/300-frame clamp; the correct value is 360 at 30 fps.
      expect(composition.durationInFrames).toBe(
        Math.ceil(((3000 + 5000 + 4000) / 1000) * DEFAULT_FPS),
      );
    });

    it('single 5s scene → 150 frames (not ~0 from a ms/s confusion)', async () => {
      const scenes = [makeScene('only', 5000, 0)];
      try {
        await getComposition(renderer)('/tmp/mock-bundle', scenes);
      } catch {
        // ignored
      }
      const composition = await lastComposition();
      // DERIVED from the scene duration × canonical DEFAULT_FPS (5000 ms → 150
      // at 30 fps). The classic DiagramVideo time-unit bug treated ms as
      // seconds and produced ~0.15 frames; the exact derived pin REDs on that
      // collapse just as the old 149–150 range did — and follows a conscious
      // DEFAULT_FPS retuning instead of staling.
      expect(composition.durationInFrames).toBe(
        Math.ceil((5000 / 1000) * DEFAULT_FPS),
      );
    });

    it('contract + invariant hold together on one render', async () => {
      const scenes = [makeScene('a', 2000, 0), makeScene('b', 4000, 2000)];
      try {
        await getComposition(renderer)('/tmp/mock-bundle', scenes);
      } catch {
        // ignored
      }
      // Queried the registered id…
      expect(lastSelectCall().id).toBe(COMPOSITION_ID);
      // …and derived the correct frame count from real durations.
      const composition = await lastComposition();
      // DERIVED from the scene durations × canonical DEFAULT_FPS (6000 ms →
      // 180 at 30 fps) — follows a conscious DEFAULT_FPS retuning instead of
      // staling as a bare frame count.
      expect(composition.durationInFrames).toBe(
        Math.ceil(((2000 + 4000) / 1000) * DEFAULT_FPS),
      );
    });
  });
});
