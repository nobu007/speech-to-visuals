import { describe, it, expect } from '@jest/globals';
import { MainPipeline } from '../main-pipeline';
import type { SceneGraph } from '@stv/core/types/diagram';

/**
 * Regression: DiagramDetector.analyze() computes a per-scene detection
 * `confidence` (0-1), but MainPipeline.prepareScenes / prepareScenesEnhanced
 * omitted it when assembling the SceneGraph. Every downstream consumer then
 * read the field via a fallback — video-generator `scene.confidence ?? 0.8`
 * (video-generator.ts) and quality-score `scene.confidence || 0`
 * (quality-score.ts, the "detection quality" component, up to 30 pts) — so the
 * real value was silently replaced by a constant and the FrameworkIntegrated
 * pipeline path always scored as if detection confidence were 0. The sibling
 * SimplePipeline wires the field (simple-pipeline.ts), proving the intent.
 */
function buildLayoutItem(confidence: number) {
  return {
    segment: { startMs: 1000, endMs: 6000, summary: 'seg', keyphrases: ['k'] },
    analysis: { type: 'flow', nodes: [], edges: [], confidence },
    layout: { nodes: [], edges: [] },
  };
}

type PrepScenes = (
  analysisResult: unknown,
  layouts: unknown[],
) => Promise<SceneGraph[]>;

function callPrepareScenes(pipeline: MainPipeline, layouts: unknown[]): Promise<SceneGraph[]> {
  return (pipeline as unknown as { prepareScenes: PrepScenes }).prepareScenes({}, layouts);
}

function callPrepareScenesEnhanced(
  pipeline: MainPipeline,
  layouts: unknown[],
): Promise<SceneGraph[]> {
  return (pipeline as unknown as { prepareScenesEnhanced: PrepScenes }).prepareScenesEnhanced(
    {},
    layouts,
  );
}

describe('MainPipeline scene confidence wiring', () => {
  it('prepareScenes carries the detector confidence onto each scene', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenes(pipeline, [buildLayoutItem(0.42)]);

    expect(scenes).toHaveLength(1);
    expect(scenes[0].confidence).toBe(0.42);
  });

  it('prepareScenesEnhanced carries the detector confidence onto each scene', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenesEnhanced(pipeline, [buildLayoutItem(0.37)]);

    expect(scenes).toHaveLength(1);
    expect(scenes[0].confidence).toBe(0.37);
  });

  it('does not mask a legitimate 0 confidence (detection-breakdown signal)', async () => {
    const pipeline = new MainPipeline({});
    const scenes = await callPrepareScenes(pipeline, [buildLayoutItem(0)]);

    // 0 is a valid "detection broke down" value; consumers use `??`/guard to
    // preserve it rather than coercing to a default.
    expect(scenes[0].confidence).toBe(0);
  });

  it('falls back to undefined (consumer default) when the analysis carries no confidence', async () => {
    const pipeline = new MainPipeline({});
    const layouts = [
      {
        segment: { startMs: 0, endMs: 5000, summary: 's', keyphrases: [] },
        analysis: { type: 'flow', nodes: [], edges: [] },
        layout: { nodes: [], edges: [] },
      },
    ];
    const scenes = await callPrepareScenes(pipeline, layouts);

    expect(scenes[0].confidence).toBeUndefined();
  });
});
