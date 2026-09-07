/**
 * Unit tests for the canonical layout-defect estimators in quality-estimators.
 *
 * Focus: countNodeOverflow and countDanglingLayoutEdges — the two defect COUNTS
 * added alongside countLayoutOverlaps so the iteration criteria reject a layout
 * that breaks down via overflow or dangling edges even when nothing overlaps.
 * countLayoutOverlaps is covered behaviourally by the cross-invariant fuzz suite;
 * here we assert the bounding-box / endpoint logic directly.
 */
import type { PipelineResult } from '../types';
import {
  countLayoutOverlaps,
  countNodeOverflow,
  countDanglingLayoutEdges,
  estimateLabelReadability,
  estimateTranscriptionAccuracy,
  estimateSegmentationQuality,
  estimateEntityExtractionQuality,
  scoreNodeDensity,
  DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY,
  type PipelineQualitySignals,
} from '../quality-estimators';

/** Build a minimal PipelineResult whose single scene carries only the layout
 *  the estimators read (they are total over the rest). */
function resultWithLayout(scene: { nodes: unknown[]; edges?: unknown[] }): PipelineResult {
  return {
    scenes: [
      {
        type: 'flow' as const,
        nodes: [],
        edges: [],
        layout: { nodes: scene.nodes as never, edges: (scene.edges ?? []) as never },
        startMs: 0,
        durationMs: 1000,
        summary: '',
        keyphrases: [],
      },
    ],
  } as unknown as PipelineResult;
}

describe('countNodeOverflow', () => {
  it('returns 0 when every node is inside the canvas', () => {
    const r = resultWithLayout({
      nodes: [
        { id: 'a', x: 100, y: 100, width: 100, height: 100 },
        { id: 'b', x: 500, y: 500, width: 200, height: 150 }, // 700x650, in bounds
      ],
    });
    expect(countNodeOverflow(r)).toBe(0);
  });

  it('counts a node whose right edge exceeds the canvas width', () => {
    // x=1900 + width=100 = 2000 > DEFAULT_CANVAS_WIDTH (1920).
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 1900, y: 100, width: 100, height: 100 }],
    });
    expect(countNodeOverflow(r)).toBe(1);
  });

  it('counts a node with a negative origin', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: -10, y: 100, width: 100, height: 100 }],
    });
    expect(countNodeOverflow(r)).toBe(1);
  });

  it('counts a node whose bottom edge exceeds the canvas height', () => {
    // y=1050 + height=100 = 1150 > DEFAULT_CANVAS_HEIGHT (1080).
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 100, y: 1050, width: 100, height: 100 }],
    });
    expect(countNodeOverflow(r)).toBe(1);
  });

  it('counts an unpositioned (non-finite) node as overflow', () => {
    const r = resultWithLayout({
      nodes: [
        { id: 'a', x: Number.NaN, y: 100, width: 100, height: 100 },
        { id: 'b', x: 100, y: 100, width: 100, height: 100 },
      ],
    });
    expect(countNodeOverflow(r)).toBe(1);
  });

  it('honors a custom canvas size', () => {
    // Node out of bounds for a 1000x1000 canvas, in bounds for the 1920x1080 default.
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 950, y: 950, width: 100, height: 100 }],
    });
    expect(countNodeOverflow(r, 1000, 1000)).toBe(1);
    expect(countNodeOverflow(r)).toBe(0);
  });

  it('aggregates across scenes and ignores scenes without a layout', () => {
    const r = {
      scenes: [
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          layout: { nodes: [{ id: 'a', x: -1, y: 0, width: 10, height: 10 }] as never, edges: [] as never },
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          // no layout → skipped
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
      ],
    } as unknown as PipelineResult;
    expect(countNodeOverflow(r)).toBe(1);
  });
});

describe('countDanglingLayoutEdges', () => {
  it('returns 0 when every edge endpoint is in the node set', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }, { id: 'b', x: 50, y: 0, width: 10, height: 10 }],
      edges: [{ from: 'a', to: 'b', points: [] }],
    });
    expect(countDanglingLayoutEdges(r)).toBe(0);
  });

  it('accepts source/target as an alias for from/to', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }, { id: 'b', x: 50, y: 0, width: 10, height: 10 }],
      edges: [{ source: 'a', target: 'b', points: [] }],
    });
    expect(countDanglingLayoutEdges(r)).toBe(0);
  });

  it('counts an edge whose target is absent from the node set', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }],
      edges: [{ from: 'a', to: 'ghost', points: [] }],
    });
    expect(countDanglingLayoutEdges(r)).toBe(1);
  });

  it('counts an edge whose source is absent from the node set', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }],
      edges: [{ from: 'ghost', to: 'a', points: [] }],
    });
    expect(countDanglingLayoutEdges(r)).toBe(1);
  });

  it('counts both a dangling and a well-formed edge independently', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }, { id: 'b', x: 50, y: 0, width: 10, height: 10 }],
      edges: [
        { from: 'a', to: 'b', points: [] },
        { from: 'a', to: 'ghost', points: [] },
        { from: 'x', to: 'y', points: [] },
      ],
    });
    expect(countDanglingLayoutEdges(r)).toBe(2);
  });

  it('skips edges with non-string endpoints', () => {
    const r = resultWithLayout({
      nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }],
      edges: [{ points: [] }], // no from/to/source/target
    });
    expect(countDanglingLayoutEdges(r)).toBe(0);
  });

  it('skips scenes whose node set is empty', () => {
    const r = resultWithLayout({
      nodes: [],
      edges: [{ from: 'a', to: 'b', points: [] }],
    });
    expect(countDanglingLayoutEdges(r)).toBe(0);
  });
});

describe('countLayoutOverlaps (regression guard)', () => {
  it('still counts overlapping pairs and is unaffected by the new estimators', () => {
    // Two nodes sharing x/y/size overlap; a third far away does not.
    const r = resultWithLayout({
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 100 },
        { id: 'b', x: 10, y: 10, width: 100, height: 100 },
        { id: 'c', x: 1000, y: 1000, width: 100, height: 100 },
      ],
    });
    expect(countLayoutOverlaps(r)).toBe(1);
  });
});

describe('estimateLabelReadability', () => {
  /** Like resultWithLayout but flags the run successful (readability is only
   *  meaningful for a run that produced output). */
  function successfulResult(scene: { nodes: unknown[]; edges?: unknown[] }): PipelineResult {
    return {
      success: true,
      scenes: [
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          layout: { nodes: scene.nodes as never, edges: (scene.edges ?? []) as never },
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
      ],
    } as unknown as PipelineResult;
  }

  it('returns 1.0 when every label fits its node box', () => {
    // Wide/tall boxes, short labels → sizeLabel reports truncated:false for both.
    const r = successfulResult({
      nodes: [
        { id: 'a', label: 'OK', x: 0, y: 0, width: 200, height: 60 },
        { id: 'b', label: '開始', x: 100, y: 0, width: 200, height: 60 },
      ],
    });
    expect(estimateLabelReadability(r)).toBe(1);
  });

  it('returns < 1.0 when a label truncates (the gate this estimator feeds)', () => {
    // Node 'a' fits; node 'b' has a 100-char label in a 40x20 box → sizeLabel
    // cannot fit it even at minFontSize (1 line of ~3 chars) → truncated:true.
    const r = successfulResult({
      nodes: [
        { id: 'a', label: 'OK', x: 0, y: 0, width: 200, height: 60 },
        { id: 'b', label: 'x'.repeat(100), x: 100, y: 0, width: 40, height: 20 },
      ],
    });
    // 1 of 2 readable → 0.5. The ラベル可読性100% criterion requires 1.0, so this
    // layout must FAIL the readability SLO rather than silently pass.
    expect(estimateLabelReadability(r)).toBe(0.5);
  });

  it('returns 0 when every label truncates', () => {
    const r = successfulResult({
      nodes: [{ id: 'a', label: 'x'.repeat(100), x: 0, y: 0, width: 40, height: 20 }],
    });
    expect(estimateLabelReadability(r)).toBe(0);
  });

  it('judges fit purely on label-vs-box (position defects are countNodeOverflow\'s job)', () => {
    // estimateLabelReadability measures ONLY whether the label fits the box —
    // NOT whether the node is positioned on-canvas. An unpositioned (NaN x/y)
    // node with a fitting label reads as readable here; its geometric defect is
    // owned by countNodeOverflow (feeds レイアウト破綻0). Keeping one owner per
    // defect dimension avoids double-counting.
    const r = successfulResult({
      nodes: [
        { id: 'a', label: 'OK', x: Number.NaN, y: 0, width: 200, height: 60 },
        { id: 'b', label: 'OK', x: 100, y: 0, width: 200, height: 60 },
      ],
    });
    expect(estimateLabelReadability(r)).toBe(1);
  });

  it('returns 0 for a failed run', () => {
    const r = {
      success: false,
      scenes: [
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          layout: { nodes: [{ id: 'a', label: 'OK', x: 0, y: 0, width: 200, height: 60 }] as never, edges: [] as never },
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
      ],
    } as unknown as PipelineResult;
    expect(estimateLabelReadability(r)).toBe(0);
  });

  it('returns 0 when there are no positioned nodes (does not pass vacuously)', () => {
    const r = successfulResult({ nodes: [] });
    expect(estimateLabelReadability(r)).toBe(0);
  });

  it('aggregates across scenes and ignores scenes without a layout', () => {
    const r = {
      success: true,
      scenes: [
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          layout: { nodes: [{ id: 'a', label: 'OK', x: 0, y: 0, width: 200, height: 60 }] as never, edges: [] as never },
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
        {
          type: 'flow' as const,
          nodes: [],
          edges: [],
          // no layout → skipped
          startMs: 0,
          durationMs: 1000,
          summary: '',
          keyphrases: [],
        },
      ],
    } as unknown as PipelineResult;
    expect(estimateLabelReadability(r)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Accuracy estimators + shared density scale (Phase 172 / TASK-0258)
//
// estimateTranscriptionAccuracy / estimateSegmentationQuality /
// estimateEntityExtractionQuality gained their first direct pins when
// SimplePipeline started delegating to them (previously only the
// MainPipeline/FrameworkIntegratedPipeline paths exercised them
// indirectly). scoreNodeDensity is the single source for the density→score
// scale consumed by BOTH estimateEntityExtractionQuality and
// GeminiAnalyzer's detection-time sample — these pins make a scale change
// at either consumer visible as a test failure here.
// ---------------------------------------------------------------------------

describe('scoreNodeDensity', () => {
  it('maps healthy density (2–10) to 0.90 at both boundaries', () => {
    expect(scoreNodeDensity(2)).toBe(0.9);
    expect(scoreNodeDensity(10)).toBe(0.9);
    expect(scoreNodeDensity(5)).toBe(0.9);
  });

  it('maps a singleton to 0.70 — below the 0.80 entity threshold on purpose', () => {
    expect(scoreNodeDensity(1)).toBe(0.7);
  });

  it('maps degenerate densities (0, >10) to 0.50', () => {
    expect(scoreNodeDensity(0)).toBe(0.5);
    expect(scoreNodeDensity(11)).toBe(0.5);
    expect(scoreNodeDensity(40)).toBe(0.5);
  });
});

describe('estimateEntityExtractionQuality', () => {
  /** Minimal successful signal source whose scenes carry node arrays. */
  function signalsWithNodes(perSceneNodes: number[]): PipelineQualitySignals {
    return {
      success: true,
      duration: 1000,
      scenes: perSceneNodes.map(count => ({
        type: 'flow' as const,
        nodes: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: `n${i}` })),
        edges: [],
        startMs: 0,
        durationMs: 1000,
        summary: '',
        keyphrases: [],
      })),
    } as unknown as PipelineQualitySignals;
  }

  it('returns 0 for a failed run or a run with no scenes', () => {
    expect(estimateEntityExtractionQuality({ success: false, scenes: [], duration: 0 })).toBe(0);
    expect(estimateEntityExtractionQuality({ success: true, scenes: [], duration: 0 })).toBe(0);
  });

  it('delegates the density scale: 2–10 nodes/scene → 0.90', () => {
    expect(estimateEntityExtractionQuality(signalsWithNodes([5]))).toBe(0.9);
  });

  it('delegates the density scale: singleton scene → 0.70', () => {
    expect(estimateEntityExtractionQuality(signalsWithNodes([1]))).toBe(0.7);
  });

  it('delegates the density scale: over-dense scene → 0.50', () => {
    expect(estimateEntityExtractionQuality(signalsWithNodes([15]))).toBe(0.5);
  });
});

describe('estimateTranscriptionAccuracy', () => {
  it('returns 0 for a failed run', () => {
    expect(estimateTranscriptionAccuracy({ success: false, scenes: [], duration: 0 })).toBe(0);
  });

  it('returns 0.90 for a successful run with ≥1 scene', () => {
    expect(
      estimateTranscriptionAccuracy({
        success: true,
        duration: 1000,
        scenes: [{ type: 'flow', nodes: [], edges: [], startMs: 0, durationMs: 1000, summary: '', keyphrases: [] }],
      } as unknown as PipelineQualitySignals),
    ).toBe(0.9);
  });

  it('returns 0.50 for a successful run with no scenes', () => {
    expect(estimateTranscriptionAccuracy({ success: true, scenes: [], duration: 0 })).toBe(0.5);
  });

  it('returns 0.90 for a run with scenes but NO recovery context (pre-chain callers unchanged)', () => {
    // The context parameter is optional: callers that have no recovery chain
    // (or run before any transcribe()) must see the historical values.
    expect(
      estimateTranscriptionAccuracy({ success: true, scenes: [], duration: 0 }, undefined),
    ).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// REQ-430 (AX-3 / D-3): disclosed-placeholder penalty — TC-423-01/02/03 unit
// legs. A run whose transcription recovery chain terminated at the
// disclosed-placeholder step is nominally successful (the terminal step always
// succeeds, scenes exist), so the structural proxy alone would keep returning
// 0.90 — above the 0.85 learner/monitor gate band, letting an all-engines-dead
// run pass quality aggregation green. The penalty is applied HERE (single
// source) from a context flag whose derivation is single-sourced in
// transcriber.ts (endedAtDisclosedPlaceholder — the same authority as the
// isFallback read at the transcribe() site).
// ---------------------------------------------------------------------------
describe('estimateTranscriptionAccuracy — REQ-430 disclosed-placeholder penalty', () => {
  const signalsWithScene = {
    success: true,
    scenes: [
      { type: 'flow' as const, nodes: [], edges: [], startMs: 0, durationMs: 5000, summary: '', keyphrases: [] },
    ],
    duration: 5000,
  } as unknown as PipelineQualitySignals;

  it('TC-423-01: penalizes a placeholder-terminated run to the named constant even with scenes present', () => {
    expect(
      estimateTranscriptionAccuracy(signalsWithScene, { endedAtDisclosedPlaceholder: true }),
    ).toBe(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY);
  });

  it('TC-423-02: the penalty constant sits BELOW the 0.85 improvement/blocker threshold band (fail-closed)', () => {
    expect(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY).toBeLessThan(0.85);
    expect(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY).toBeGreaterThan(0);
  });

  it('TC-423-03: a real-engine terminal outcome leaves the success value untouched', () => {
    expect(
      estimateTranscriptionAccuracy(signalsWithScene, { endedAtDisclosedPlaceholder: false }),
    ).toBe(0.9);
  });

  it('a failed run stays 0 even when a (stale) placeholder context is supplied — failure dominates', () => {
    expect(
      estimateTranscriptionAccuracy({ success: false, scenes: [], duration: 0 }, { endedAtDisclosedPlaceholder: true }),
    ).toBe(0);
  });
});

describe('estimateSegmentationQuality', () => {
  /** Signal source with `count` scenes of `durationMs` each. */
  function signalsWithScenes(count: number, durationMs: number): PipelineQualitySignals {
    return {
      success: true,
      duration: count * durationMs,
      scenes: Array.from({ length: count }, (_, i) => ({
        type: 'flow' as const,
        nodes: [],
        edges: [],
        startMs: i * durationMs,
        durationMs,
        summary: '',
        keyphrases: [],
      })),
    } as unknown as PipelineQualitySignals;
  }

  it('returns 0 for a failed run or a run with no scenes', () => {
    expect(estimateSegmentationQuality({ success: false, scenes: [], duration: 0 })).toBe(0);
    expect(estimateSegmentationQuality({ success: true, scenes: [], duration: 0 })).toBe(0);
  });

  it('scores the full 1.0 for 2–10 scenes with 2–15s average duration', () => {
    expect(estimateSegmentationQuality(signalsWithScenes(2, 2000))).toBe(1);
  });

  it('keeps the 0.7 base when both bonuses miss (11 scenes, 1s average)', () => {
    expect(estimateSegmentationQuality(signalsWithScenes(11, 1000))).toBe(0.7);
  });
});
