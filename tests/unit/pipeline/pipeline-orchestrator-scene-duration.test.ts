/**
 * Regression: prepareSingleScene must derive durationMs from endMs - startMs
 * even when the segment starts at 0ms.
 *
 * The guard previously used truthiness (`segment.endMs && segment.startMs`),
 * which short-circuits to the 5000ms fallback whenever `startMs === 0`. The
 * first scene of any audio starts at 0ms, so its duration silently became 5000
 * whenever the real duration differed — desyncing the video from the audio.
 * The existing fixtures masked this because their first segment happened to
 * use endMs === 5000 (coincident with the fallback).
 */
import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import type { SceneGraph } from '@/types/diagram';

type PrepArgs = [unknown, number, unknown[], unknown[]];

function prepare(orchestrator: PipelineOrchestrator, segment: Record<string, unknown>, index = 0): SceneGraph {
  // prepareSingleScene is private; access it for a focused unit test.
  return (orchestrator as unknown as {
    prepareSingleScene: (...args: PrepArgs) => SceneGraph;
  }).prepareSingleScene(
    { segment, analysis: { type: 'flow', nodes: [], edges: [] }, layout: undefined },
    index,
    [segment],
    [{ type: 'flow', nodes: [], edges: [] }],
  );
}

describe('PipelineOrchestrator.prepareSingleScene durationMs', () => {
  it('uses endMs - startMs when the segment starts at 0ms', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { startMs: 0, endMs: 6000, summary: 's', keyphrases: [] });

    // Old truthiness guard (`endMs && startMs`) yielded 5000 here.
    expect(scene.durationMs).toBe(6000);
    expect(scene.startMs).toBe(0);
  });

  it('uses endMs - startMs for a normal mid-audio segment', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { startMs: 2000, endMs: 6000, summary: 's', keyphrases: [] }, 1);

    expect(scene.durationMs).toBe(4000);
  });

  it('falls back to 5000ms only when timing is absent', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { summary: 's', keyphrases: [] });

    expect(scene.durationMs).toBe(5000);
  });
});
