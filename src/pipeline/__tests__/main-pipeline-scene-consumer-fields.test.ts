import { describe, it, expect } from '@jest/globals';
import { MainPipeline } from '../main-pipeline';
import { VideoGenerator } from '../video-generator';
import type { SceneGraph } from '@/types/diagram';

/**
 * Regression: MainPipeline.prepareScenes / prepareScenesEnhanced assembled
 * SceneGraph scenes with only `startMs`/`durationMs` and OMITTED the four
 * fields every downstream consumer reads:
 *
 *   - `id`         video-generator `convertSceneToRemotionFormat` copies it
 *                  verbatim (L258) and validateRemotionData rejects a missing
 *                  id ("Scene N: Missing ID", L301).
 *   - `startTime`  SECONDS. video-generator computes the Remotion scene
 *                  `startMs` as `scene.startTime * 1000` (L259) with NO
 *                  fallback → undefined * 1000 = NaN propagates.
 *   - `endTime`    SECONDS. video-generator derives duration from
 *                  `(scene.endTime - scene.startTime) * 1000` (L236).
 *   - `content`    video-generator sets `transcript: scene.content` (L265) and
 *                  generateSceneTitle does `scene.content.substring(0, 30)`
 *                  (L551) → TypeError: Cannot read properties of undefined
 *                  (reading 'substring'). The scene-build CRASHES for every
 *                  MainPipeline-produced scene.
 *
 * The sibling SimplePipeline emits all four (simple-pipeline.ts: id, startTime,
 * endTime, content), proving the intent — same wrong-field-in-parallel-pipelines
 * class as the prior `summary` / `keyphrases` / `confidence` divergences. The
 * SceneGraph type marks the fields optional (`strict: false`), so the omission
 * compiles cleanly and the failure is runtime-only.
 *
 * This test fixes all four at BOTH scene-build sites and additionally locks the
 * cross-component interaction: a MainPipeline-produced scene must survive
 * video-generator conversion (finite startMs, defined id, no crash).
 */
function buildLayoutItem(overrides: Record<string, unknown> = {}) {
  return {
    segment: {
      startMs: 1500,
      endMs: 7500,
      text: 'First we set up the experiment. Then we compare the two approaches.',
      summary: 'seg summary',
      keyphrases: ['experiment', 'compare'],
    },
    analysis: { type: 'flow', nodes: [], edges: [], confidence: 0.7 },
    layout: { nodes: [], edges: [] },
    ...overrides,
  };
}

type PrepScenes = (
  analysisResult: unknown,
  layouts: unknown[],
) => Promise<SceneGraph[]>;

function callPrepareScenes(
  pipeline: MainPipeline,
  layouts: unknown[],
): Promise<SceneGraph[]> {
  return (
    pipeline as unknown as { prepareScenes: PrepScenes }
  ).prepareScenes({}, layouts);
}

function callPrepareScenesEnhanced(
  pipeline: MainPipeline,
  layouts: unknown[],
): Promise<SceneGraph[]> {
  return (
    pipeline as unknown as { prepareScenesEnhanced: PrepScenes }
  ).prepareScenesEnhanced({}, layouts);
}

describe('MainPipeline scene consumer-required fields (id/startTime/endTime/content)', () => {
  it('prepareScenes carries id, startTime (s), endTime (s), content', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenes(pipeline, [buildLayoutItem()]);

    expect(scenes[0].id).toBe('scene-0');
    expect(scenes[0].startTime).toBe(1.5); // 1500 ms / 1000
    expect(scenes[0].endTime).toBe(7.5); // 7500 ms / 1000
    expect(scenes[0].content).toBe(
      'First we set up the experiment. Then we compare the two approaches.',
    );
  });

  it('prepareScenesEnhanced carries the same four fields', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenesEnhanced(pipeline, [buildLayoutItem()]);

    expect(scenes[0].id).toBe('scene-0');
    expect(scenes[0].startTime).toBe(1.5);
    expect(scenes[0].endTime).toBe(7.5);
    expect(scenes[0].content).toBe(
      'First we set up the experiment. Then we compare the two approaches.',
    );
  });

  it('scene ids are distinct per index', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenes(pipeline, [
      buildLayoutItem(),
      buildLayoutItem(),
      buildLayoutItem(),
    ]);
    expect(scenes.map((s) => s.id)).toEqual(['scene-0', 'scene-1', 'scene-2']);
  });

  it('startTime/endTime are SECONDS, not raw ms (×1000 unit guard)', async () => {
    // If a future edit assigns raw ms, startTime would be 1500 (not 1.5) and
    // video-generator's `startTime * 1000` would explode to 1 500 000 ms.
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenes(pipeline, [buildLayoutItem()]);
    expect(scenes[0].startTime).toBeLessThan(100);
    expect(scenes[0].endTime).toBeLessThan(100);
  });

  it('content falls back to empty string when the segment carries no text', async () => {
    const pipeline = new MainPipeline({});
    const layouts = [
      {
        segment: { startMs: 0, endMs: 1000, summary: 's', keyphrases: [] },
        analysis: { type: 'flow', nodes: [], edges: [] },
        layout: { nodes: [], edges: [] },
      },
    ];
    const scenes = await callPrepareScenes(pipeline, layouts);
    // Empty string (not undefined) so generateSceneTitle's .substring survives.
    expect(scenes[0].content).toBe('');
  });
});

describe('cross-component: MainPipeline scenes survive video-generator conversion', () => {
  /**
   * convertSceneToRemotionFormat is the chokepoint that reads all four fields.
   * Before the fix, a MainPipeline scene crashed here (TypeError on
   * scene.content.substring) and/or produced a NaN startMs. After the fix the
   * scene carries the fields and converts cleanly. This locks the interaction
   * the source-level field assertions above repair.
   */
  type Convert = (scene: SceneGraph, index: number) => {
    id: unknown;
    startMs: number;
    transcript: unknown;
  };

  it('prepareScenes output converts without crash, finite startMs, defined id', async () => {
    const scenes = await callPrepareScenes(new MainPipeline({}), [
      buildLayoutItem(),
      buildLayoutItem(),
    ]);
    const vg = new VideoGenerator({});
    const convert = (vg as unknown as { convertSceneToRemotionFormat: Convert })
      .convertSceneToRemotionFormat.bind(vg);

    scenes.forEach((scene, i) => {
      const out = convert(scene, i); // must not throw
      expect(out.id).toBeDefined();
      expect(Number.isFinite(out.startMs)).toBe(true); // not NaN
      expect(out.transcript).toBe(scene.content);
    });
  });

  it('prepareScenesEnhanced output converts without crash, finite startMs', async () => {
    const scenes = await callPrepareScenesEnhanced(new MainPipeline({}), [
      buildLayoutItem(),
    ]);
    const vg = new VideoGenerator({});
    const convert = (vg as unknown as { convertSceneToRemotionFormat: Convert })
      .convertSceneToRemotionFormat.bind(vg);

    const out = convert(scenes[0], 0);
    expect(out.id).toBeDefined();
    expect(Number.isFinite(out.startMs)).toBe(true);
  });
});
