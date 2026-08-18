/**
 * Regression: prepareSingleScene must carry the detector's per-scene confidence
 * onto the scene, mirroring MainPipeline.prepareScenes / prepareScenesEnhanced.
 *
 * Without the field, downstream consumers mask the drop: quality-score reads
 * `scene.confidence || 0` (silently zeroing the 30-point "Scene confidence"
 * component) and video-generator reads `scene.confidence ?? 0.8`. This is the
 * same parallel-builder DROPS bug previously fixed in MainPipeline; the guard
 * test prevents the orchestrator sibling from drifting again.
 */
import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import type { SceneGraph } from '@stv/core/types/diagram';

type PrepArgs = [unknown, number, unknown[], unknown[]];

function prepare(
  orchestrator: PipelineOrchestrator,
  analysis: Record<string, unknown>,
  segment: Record<string, unknown> = { startMs: 0, endMs: 5000, summary: 's', keyphrases: [] },
  index = 0,
): SceneGraph {
  return (orchestrator as unknown as {
    prepareSingleScene: (...args: PrepArgs) => SceneGraph;
  }).prepareSingleScene(
    { segment, analysis, layout: undefined },
    index,
    [segment],
    [analysis],
  );
}

describe('PipelineOrchestrator.prepareSingleScene confidence', () => {
  it('wires the detector confidence onto the scene (real value, not masked)', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'flow', nodes: [], edges: [], confidence: 0.42 });

    // `scene.confidence` must equal the real detector value. Without the fix
    // this is `undefined`, which quality-score masks to 0 (`|| 0`) and
    // video-generator masks to 0.8 (`?? 0.8`).
    expect(scene.confidence).toBe(0.42);
  });

  it('keeps a high confidence value untouched', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'tree', nodes: [], edges: [], confidence: 0.95 });

    expect(scene.confidence).toBe(0.95);
  });

  it('falls back to undefined only when the analysis carries no confidence', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'flow', nodes: [], edges: [] });

    expect(scene.confidence).toBeUndefined();
  });
});
