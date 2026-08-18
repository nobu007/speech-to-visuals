import { describe, it, expect } from '@jest/globals';
import { PipelineOrchestrator } from '../pipeline-orchestrator';
import { VideoGenerator } from '../video-generator';
import type { SceneGraph } from '@stv/core/types/diagram';

/**
 * Regression: PipelineOrchestrator.prepareSingleScene assembled SceneGraph scenes
 * with only `type`/`nodes`/`edges`/`layout`/`startMs`/`durationMs`/`summary`/
 * `keyphrases`/`confidence` and OMITTED the four fields every downstream consumer
 * reads — the same wrong-field-in-parallel-pipelines omission fixed in
 * MainPipeline (a741844f):
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
 *                  Orchestrator-produced scene.
 *
 * Root cause: the three pipelines each built SceneGraph inline, so the
 * Orchestrator site drifted out of sync. Routing all three through the shared
 * buildSceneGraph helper (src/pipeline/scene-graph-builder.ts) makes the
 * omission structurally impossible. This test locks the fix and additionally
 * asserts the cross-component interaction: an Orchestrator-produced scene must
 * survive video-generator conversion (finite startMs, defined id, no crash).
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

type PrepareSingleScene = (
  layoutItem: unknown,
  index: number,
  segments: unknown[],
  diagrams: unknown[],
) => SceneGraph;

function prepareSingleScene(
  orchestrator: PipelineOrchestrator,
  layoutItem: unknown,
  index = 0,
): SceneGraph {
  return (
    orchestrator as unknown as { prepareSingleScene: PrepareSingleScene }
  ).prepareSingleScene(layoutItem, index, [], []);
}

describe('PipelineOrchestrator scene consumer-required fields (id/startTime/endTime/content)', () => {
  it('prepareSingleScene carries id, startTime (s), endTime (s), content', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepareSingleScene(orchestrator, buildLayoutItem());

    expect(scene.id).toBe('scene-0');
    expect(scene.startTime).toBe(1.5); // 1500 ms / 1000
    expect(scene.endTime).toBe(7.5); // 7500 ms / 1000
    expect(scene.content).toBe(
      'First we set up the experiment. Then we compare the two approaches.',
    );
  });

  it('scene ids are distinct per index', () => {
    const orchestrator = new PipelineOrchestrator({});
    const ids = [0, 1, 2].map((index) =>
      prepareSingleScene(orchestrator, buildLayoutItem(), index).id,
    );
    expect(ids).toEqual(['scene-0', 'scene-1', 'scene-2']);
  });

  it('startTime/endTime are SECONDS, not raw ms (×1000 unit guard)', () => {
    // If a future edit assigns raw ms, startTime would be 1500 (not 1.5) and
    // video-generator's `startTime * 1000` would explode to 1 500 000 ms.
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepareSingleScene(orchestrator, buildLayoutItem());
    expect(scene.startTime).toBeLessThan(100);
    expect(scene.endTime).toBeLessThan(100);
  });

  it('content falls back to empty string when the segment carries no text', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepareSingleScene(orchestrator, {
      segment: { startMs: 0, endMs: 1000, summary: 's', keyphrases: [] },
      analysis: { type: 'flow', nodes: [], edges: [] },
      layout: { nodes: [], edges: [] },
    });
    // Empty string (not undefined) so generateSceneTitle's .substring survives.
    expect(scene.content).toBe('');
  });

  it('still carries the pre-existing fields (type/summary/keyphrases/confidence/startMs/durationMs)', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepareSingleScene(orchestrator, buildLayoutItem());
    // Guard against the refactor dropping a field the Orchestrator previously set.
    expect(scene.type).toBe('flow');
    expect(scene.summary).toBe('seg summary');
    expect(scene.keyphrases).toEqual(['experiment', 'compare']);
    expect(scene.confidence).toBe(0.7);
    expect(scene.startMs).toBe(1500);
    expect(scene.durationMs).toBe(6000);
  });
});

describe('cross-component: Orchestrator scenes survive video-generator conversion', () => {
  /**
   * convertSceneToRemotionFormat is the chokepoint that reads all four fields.
   * Before the fix, an Orchestrator scene crashed here (TypeError on
   * scene.content.substring) and/or produced a NaN startMs. After routing through
   * the shared helper the scene carries the fields and converts cleanly.
   */
  type Convert = (scene: SceneGraph, index: number) => {
    id: unknown;
    startMs: number;
    transcript: unknown;
  };

  it('prepareSingleScene output converts without crash, finite startMs, defined id', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scenes = [0, 1].map((index) =>
      prepareSingleScene(orchestrator, buildLayoutItem(), index),
    );
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
});
