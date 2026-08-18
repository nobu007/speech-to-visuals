import { describe, it, expect } from '@jest/globals';
import { buildSceneGraph } from '../scene-graph-builder';
import type { SceneGraph } from '@stv/core/types/diagram';

/**
 * Unit contract for the shared SceneGraph assembler.
 *
 * This helper is the single point that assigns every consumer-required
 * SceneGraph field, so the three pipelines (MainPipeline ×2, SimplePipeline,
 * PipelineOrchestrator) cannot independently diverge on them. The cases below
 * lock the field set, the ms→s time conversion, type sanitization, and the two
 * confidence modes (raw passthrough vs. layout-folded).
 */
function seg(overrides: Record<string, unknown> = {}) {
  return {
    startMs: 1500,
    endMs: 7500,
    text: 'First we set up the experiment.',
    summary: 'Experiment setup',
    keyphrases: ['experiment', 'setup'],
    ...overrides,
  };
}

function analysis(overrides: Record<string, unknown> = {}) {
  return {
    type: 'flow',
    nodes: [{ id: 'n1', label: 'A' }],
    edges: [{ from: 'n1', to: 'n2' }],
    confidence: 0.7,
    ...overrides,
  };
}

describe('buildSceneGraph — field contract', () => {
  it('emits every consumer-required field', () => {
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis(),
      layout: { nodes: [], edges: [] },
      index: 0,
    });

    // The four fields whose OMISSION crashed video-generator
    // (content.substring TypeError, startTime*1000 NaN) must always be present.
    expect(scene.id).toBe('scene-0');
    expect(scene.content).toBe('First we set up the experiment.');
    expect(scene.startTime).toBe(1.5); // 1500 ms → 1.5 s
    expect(scene.endTime).toBe(7.5); // 7500 ms → 7.5 s
    // And the rest of the contract.
    expect(scene.type).toBe('flow');
    expect(scene.summary).toBe('Experiment setup');
    expect(scene.keyphrases).toEqual(['experiment', 'setup']);
    expect(scene.startMs).toBe(1500);
    expect(scene.durationMs).toBe(6000);
    expect(scene.confidence).toBe(0.7);
  });

  it('derives startTime/endTime in SECONDS, not raw ms (×1000 unit guard)', () => {
    // If a future edit assigns raw ms, startTime would be 1500 (not 1.5) and
    // video-generator's `startTime * 1000` would explode to 1 500 000 ms.
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis(),
      layout: {},
      index: 0,
    });
    expect(scene.startTime).toBeLessThan(100);
    expect(scene.endTime).toBeLessThan(100);
  });

  it('produces distinct ids per index', () => {
    const ids = [0, 1, 2].map((index) =>
      buildSceneGraph({ segment: seg(), analysis: analysis(), layout: {}, index }).id,
    );
    expect(ids).toEqual(['scene-0', 'scene-1', 'scene-2']);
  });

  it('sanitizes a non-canonical type to general (delegates to sanitizeDiagramType)', () => {
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ type: 'not-a-real-type' }),
      layout: {},
      index: 0,
    });
    expect(scene.type).toBe('general');
  });
});

describe('buildSceneGraph — defaults for missing segment data', () => {
  it('falls back to empty string for content/summary and [] for keyphrases', () => {
    const scene = buildSceneGraph({
      segment: { startMs: 0, endMs: 1000 }, // no text/summary/keyphrases
      analysis: analysis(),
      layout: {},
      index: 0,
    });
    // Empty string (not undefined) so generateSceneTitle's .substring survives.
    expect(scene.content).toBe('');
    expect(scene.summary).toBe('');
    expect(scene.keyphrases).toEqual([]);
  });

  it('defaults startMs/durationMs to 0 when segment carries no times', () => {
    const scene = buildSceneGraph({
      segment: {},
      analysis: analysis(),
      layout: {},
      index: 3,
    });
    expect(scene.startMs).toBe(0);
    expect(scene.durationMs).toBe(0);
    expect(scene.startTime).toBe(0);
    expect(scene.endTime).toBe(0);
  });

  it('treats a non-array keyphrases value as empty (Array.isArray guard)', () => {
    const scene = buildSceneGraph({
      segment: seg({ keyphrases: 'not-an-array' }),
      analysis: analysis(),
      layout: {},
      index: 0,
    });
    expect(scene.keyphrases).toEqual([]);
  });
});

describe('buildSceneGraph — confidence modes', () => {
  it('passes the detector confidence through raw when layoutConfidence is omitted', () => {
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: 0.42 }),
      layout: {},
      index: 0,
    });
    expect(scene.confidence).toBe(0.42);
  });

  it('preserves a legitimate 0 detector confidence (no masking)', () => {
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: 0 }),
      layout: {},
      index: 0,
    });
    expect(scene.confidence).toBe(0);
  });

  it('returns undefined confidence when the analysis carries none (consumer default path)', () => {
    // MainPipeline / Orchestrator path: must stay undefined so downstream
    // `?? 0.8` (video-generator) keeps its default, NOT 0.
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: { type: 'flow', nodes: [], edges: [] },
      layout: {},
      index: 0,
    });
    expect(scene.confidence).toBeUndefined();
  });

  it('folds layoutConfidence via Math.min when the property is present (SimplePipeline path)', () => {
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: 0.85 }),
      layout: {},
      index: 0,
      layoutConfidence: 0.6,
    });
    expect(scene.confidence).toBe(0.6); // Math.min(0.85, 0.6)
  });

  it('preserves a legit-zero layout confidence via ?? 1 (not || 1)', () => {
    // A layout confidence of exactly 0 is a "layout broke down" signal and
    // must survive Math.min, not be erased to 1.
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: 0.85 }),
      layout: {},
      index: 0,
      layoutConfidence: 0,
    });
    expect(scene.confidence).toBe(0); // Math.min(0.85, 0 ?? 1) = Math.min(0.85, 0)
  });

  it('treats an explicitly-undefined layoutConfidence as a no-op fold (property present)', () => {
    // SimplePipeline always folds; when the layout engine returned no
    // confidence, `undefined ?? 1` makes the fold a no-op → detector value.
    const scene = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: 0.85 }),
      layout: {},
      index: 0,
      layoutConfidence: undefined,
    });
    expect(scene.confidence).toBe(0.85); // Math.min(0.85, undefined ?? 1) = Math.min(0.85, 1)
  });

  it('sanitizes a NaN detector confidence to 0 only when folding', () => {
    // Fold path uses sanitizeFinite; passthrough path preserves NaN as-is
    // (consumers' `|| 0` handles it). Locking both behaviors.
    const folded = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: NaN }),
      layout: {},
      index: 0,
      layoutConfidence: 0.9,
    });
    expect(folded.confidence).toBe(0); // sanitizeFinite(NaN) → 0 → Math.min(0, 0.9)

    const passthrough = buildSceneGraph({
      segment: seg(),
      analysis: analysis({ confidence: NaN }),
      layout: {},
      index: 0,
    }) as SceneGraph;
    expect(Number.isNaN(passthrough.confidence)).toBe(true);
  });
});
