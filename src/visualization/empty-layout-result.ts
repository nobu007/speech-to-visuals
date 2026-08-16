/**
 * Single source for the EMPTY layout result (round 29).
 *
 * Before this module the zero-nodes early return of every layout path was
 * hand-rolled at 12 sites in one shape —
 *   `{ nodes: [], edges: [], canvas: {width: DEFAULT_CANVAS_WIDTH, height:
 *    DEFAULT_CANVAS_HEIGHT}, metrics: {overlapCount: 0, edgeCrossings: 0,
 *    aspectRatio: TARGET_ASPECT_RATIO}}` —
 * and had ALREADY drifted: cycle-strategy re-derived the aspect ratio as
 * `DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT` instead of reading
 * TARGET_ASPECT_RATIO (numerically equal only while TARGET_ASPECT_RATIO stays
 * derived from those two constants — the exact desync shape rounds 4..28 hunt).
 * Two more sites (mindmap/conceptmap single-node early returns) re-froze the
 * metrics triple alone.
 *
 * Why the sites must agree: an empty diagram flows through
 * LayoutEngineV2.layout → the type's strategy → the caller's video-length
 * math. If one path's empty result reported a different canvas or aspect
 * ratio than another, the SAME empty input would produce different reported
 * geometry per diagram type. Guarded by
 * tests/guards/empty-layout-result-single-source.test.ts and registry entry
 * r29 (the frozen triple+canvas combination is banned outside this file).
 *
 * Distinct concepts NOT defined here (do not collapse):
 *   - `calculateCanvasSize([])` in layout-engine-v2 — the canvas measured for
 *     an empty NODE SET during a real layout pass (canvas-only, no metrics).
 *   - LayoutMetrics / LayoutQualityMetrics zero-fills (OverlapResolver,
 *     enhanced-zero-overlap-layout) — different metric types with different
 *     fields, not the strategy result contract.
 *   - qualityTargets in enhanced-zero-overlap-layout — TARGETS (aspirational,
 *     edgeCrossings: -1) not measurements.
 */

import { StrategyLayoutResult, StrategyLayoutMetrics } from './types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, TARGET_ASPECT_RATIO } from './canvas-dimensions';

/**
 * Metrics reported when there is nothing to lay out. Fresh object per call —
 * callers may mutate their result without corrupting shared state.
 */
export function emptyStrategyLayoutMetrics(): StrategyLayoutMetrics {
  return { overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO };
}

/**
 * The result every layout path returns for zero nodes: default canvas, zero
 * measurements, aspect ratio delegated to canvas-dimensions' single source.
 */
export function emptyLayoutResult(): StrategyLayoutResult {
  return {
    nodes: [],
    edges: [],
    canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
    metrics: emptyStrategyLayoutMetrics(),
  };
}
