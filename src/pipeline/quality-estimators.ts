/**
 * Canonical pipeline-quality estimators.
 *
 * Single source of truth for deriving quality signals (transcription accuracy,
 * segmentation F1, entity/relation extraction, and layout-overlap count) from a
 * {@link PipelineResult}. {@link MainPipeline}, {@link FrameworkIntegratedPipeline}
 * AND {@link SimplePipeline} delegate here so the self-improvement framework
 * (`RecursiveCustomInstructionsFramework.evaluateIteration`) and the Phase 27
 * QualityMonitor see honest, identical quality signals regardless of which
 * pipeline path produced the result.
 *
 * Why this module exists: `MainPipeline.buildQualityMetrics` previously read
 * fields that NO producer ever populates — `transcription.accuracy`,
 * `analysis.segmentationScore`, and `layout.overlapCount` read off a layout
 * ARRAY (which has no such property). Every value was therefore `undefined`,
 * silently coerced to the `sanitizeFinite` fallbacks 0.85 / 0.75 / 0. Those
 * fallbacks equal the framework's quality thresholds exactly, so three of four
 * quality gates were permanently "green" and the reported quality score was
 * pinned at ~0.84–0.90 independent of the real run. Computing the metrics here,
 * from the actual {@link PipelineResult}, makes those gates fire on real data.
 */

import { PipelineResult } from './types';
import { countOverlapPairs } from '@/visualization/layout-utils';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '@/visualization/canvas-dimensions';
import { sizeLabel } from '@/visualization/smart-label-sizer';

/**
 * Structural subset of {@link PipelineResult} the estimators actually read.
 *
 * Pipelines that are NOT PipelineResult-shaped (SimplePipeline produces a
 * {@link SceneGraph[]} without `audioUrl`/`stages`) can still delegate to
 * these estimators by supplying exactly the three fields read here — the
 * signatures then honestly document what is consumed instead of demanding a
 * full result nobody has. A full `PipelineResult` remains assignable.
 */
export type PipelineQualitySignals = Pick<PipelineResult, 'success' | 'scenes' | 'duration'>;

/**
 * Estimate transcription accuracy from a pipeline result.
 *
 * A real score needs ground-truth comparison; in its absence we derive a
 * conservative signal from success + scene presence.
 *
 * - failed run → 0 (worst case)
 * - successful run with ≥1 scene → 0.90
 * - successful run with no scenes → 0.50
 */
export function estimateTranscriptionAccuracy(result: PipelineQualitySignals): number {
  if (!result.success) return 0;
  return (result.scenes?.length ?? 0) > 0 ? 0.90 : 0.50;
}

/**
 * Estimate scene-segmentation (F1) quality from scene count + average duration.
 *
 * - failed run / no scenes → 0
 * - base 0.7; +0.15 for 2–10 scenes; +0.15 for 2–15s average scene duration
 * - clamped to [0, 1]
 */
export function estimateSegmentationQuality(result: PipelineQualitySignals): number {
  // `!scenes || scenes.length === 0` is exactly `(scenes?.length ?? 0) === 0`
  // (nullish scenes OR empty array), but narrows `scenes` for the reads below.
  const scenes = result.scenes;
  if (!result.success || !scenes || scenes.length === 0) return 0;

  const sceneCount = scenes.length;
  const avgDuration = result.duration / sceneCount;

  let score = 0.7; // Base score

  // Bonus for good scene count
  if (sceneCount >= 2 && sceneCount <= 10) score += 0.15;

  // Bonus for reasonable scene durations (2-15 seconds)
  if (avgDuration >= 2000 && avgDuration <= 15000) score += 0.15;

  return Math.min(1.0, score);
}

/**
 * Map an average node density to the entity-extraction quality score.
 *
 * SINGLE SOURCE for the density→score scale, consumed by BOTH extraction
 * quality sites: {@link estimateEntityExtractionQuality} (nodes-per-scene
 * over the pipeline's final scenes) and GeminiAnalyzer's detection-time
 * sample (the LLM's node set for the analyzed content, pre-scene-split).
 * Before this extraction the analyzer re-froze its own scale
 * (`nodes.length > 0 ? 0.85 : 0.3`) — a value that equals-or-exceeds the
 * 0.80 entity threshold on every non-empty extraction, so the
 * entityExtractionF1 gate was permanently green there while the pipeline
 * path scored the same signal 0.90/0.70/0.50. One mapping, both sites.
 *
 * - 2–10 → 0.90 (healthy extraction density)
 * - 1 → 0.70 (singleton — below the 0.80 entity threshold on purpose)
 * - otherwise (0 or >10) → 0.50
 *
 * A density of exactly 0 maps to 0.50 here by contract — callers that treat
 * "nothing extracted at all" as a hard 0 must guard `count > 0` BEFORE
 * calling (both current callers do).
 */
export function scoreNodeDensity(avgNodesPerScene: number): number {
  if (avgNodesPerScene >= 2 && avgNodesPerScene <= 10) return 0.90;
  if (avgNodesPerScene >= 1 && avgNodesPerScene < 2) return 0.70;
  return 0.50;
}

/**
 * Estimate entity-extraction quality from nodes-per-scene density.
 *
 * - failed run / no scenes → 0
 * - delegates the density→score scale to {@link scoreNodeDensity}
 */
export function estimateEntityExtractionQuality(result: PipelineQualitySignals): number {
  const scenes = result.scenes;
  if (!result.success || !scenes || scenes.length === 0) return 0;

  const scenesWithNodes = scenes.filter(s => (s.nodes || []).length > 0);
  const avgNodesPerScene =
    scenesWithNodes.reduce((sum, s) => sum + (s.nodes || []).length, 0) /
    Math.max(scenesWithNodes.length, 1);

  return scoreNodeDensity(avgNodesPerScene);
}

/**
 * Estimate relation-extraction accuracy from edges-per-scene density.
 *
 * - failed run / no scenes → 0
 * - ≥1 edge/scene → 0.85; otherwise 0.60
 */
export function estimateRelationAccuracy(result: PipelineQualitySignals): number {
  const scenes = result.scenes;
  if (!result.success || !scenes || scenes.length === 0) return 0;

  const scenesWithEdges = scenes.filter(s => (s.edges || []).length > 0);
  const avgEdgesPerScene =
    scenesWithEdges.reduce((sum, s) => sum + (s.edges || []).length, 0) /
    Math.max(scenesWithEdges.length, 1);

  if (avgEdgesPerScene >= 1) return 0.85;
  return 0.60;
}

/**
 * Count overlapping node pairs across all scenes.
 *
 * Delegates to the canonical pairwise scan `countOverlapPairs` (predicate
 * `nodesOverlap`, spacing 0) — the same source of truth used by
 * `OverlapResolver` and the layout quality gate — so this count can NEVER drift
 * from the producer's own overlap definition. Touching nodes (right edge ==
 * left edge) are NOT overlaps.
 */
export function countLayoutOverlaps(result: PipelineQualitySignals): number {
  let totalOverlaps = 0;

  for (const scene of result.scenes || []) {
    if (!scene.layout?.nodes) continue;

    totalOverlaps += countOverlapPairs(scene.layout.nodes, 0);
  }

  return totalOverlaps;
}

/**
 * Count nodes that overflow the canvas bounds across all scenes.
 *
 * A node overflows when any edge of its bounding box falls outside `[0, canvas]`
 * — `x < 0`, `y < 0`, `x + width > canvasWidth`, or `y + height > canvasHeight`
 * — exactly the predicate `scoreLayout` uses internally. A node whose position or
 * dimensions are non-finite (it was never placed, or placement yielded NaN) is
 * also counted: an unpositioned node is the worst kind of overflow.
 *
 * Canvas dimensions default to the single source of truth
 * (`DEFAULT_CANVAS_WIDTH` / `DEFAULT_CANVAS_HEIGHT`) rather than bare 1920/1080
 * literals, so this can never drift from the layout engines' own bounds.
 *
 * This is a defect COUNT (lower is better): the iteration criteria treat
 * `レイアウト破綻0` ("layout breakdowns: 0") as requiring zero overflow in
 * addition to zero overlap, so an off-canvas layout is rejected rather than
 * silently accepted on the overlap count alone.
 */
export function countNodeOverflow(
  result: PipelineQualitySignals,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
  canvasHeight: number = DEFAULT_CANVAS_HEIGHT,
): number {
  let totalOverflow = 0;

  for (const scene of result.scenes || []) {
    const nodes = scene.layout?.nodes;
    if (!nodes) continue;

    for (const node of nodes) {
      const w = getNodeWidth(node, 0);
      const h = getNodeHeight(node, 0);
      // An unpositioned / NaN box is itself a defect — count it and move on so
      // a downstream nodesOverlap-style comparison never sees NaN geometry.
      if (
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y) ||
        !Number.isFinite(w) ||
        !Number.isFinite(h)
      ) {
        totalOverflow++;
        continue;
      }
      if (node.x < 0 || node.y < 0 || node.x + w > canvasWidth || node.y + h > canvasHeight) {
        totalOverflow++;
      }
    }
  }

  return totalOverflow;
}

/**
 * Count layout edges whose endpoints are absent from the scene's positioned
 * node set — i.e. edges that point at a node the layout never placed.
 *
 * This is the structural "misalignment" between the edge set and the node set:
 * the same hazard dagre exhibited when it auto-created phantom nodes for
 * unknown edge endpoints (TC-307). A dangling edge renders to nowhere (or from
 * nowhere), so it is a real rendering-quality defect even when no two nodes
 * overlap and nothing overflows.
 *
 * Endpoints are read via `from`/`to` with a `source`/`target` fallback, matching
 * the `LayoutEdge` shape. Scenes with no positioned nodes are skipped (there is
 * no node set to misalign against).
 *
 * Defect COUNT (lower is better); `レイアウト破綻0` requires zero of these too.
 */
export function countDanglingLayoutEdges(result: PipelineQualitySignals): number {
  let totalDangling = 0;

  for (const scene of result.scenes || []) {
    const layout = scene.layout;
    const nodes = layout?.nodes;
    const edges = layout?.edges;
    if (!nodes || !edges) continue;

    const nodeIds = new Set(
      nodes.map(n => n.id).filter((id): id is string => typeof id === 'string'),
    );
    if (nodeIds.size === 0) continue;

    for (const edge of edges) {
      const from = edge.from ?? edge.source;
      const to = edge.to ?? edge.target;
      if (typeof from !== 'string' || typeof to !== 'string') continue;
      if (!nodeIds.has(from) || !nodeIds.has(to)) totalDangling++;
    }
  }

  return totalDangling;
}

/**
 * Estimate label readability: the fraction of positioned nodes whose label fits
 * within the node's bounding box WITHOUT truncation.
 *
 * Readability is judged by the SAME predicate the renderer uses to decide
 * wrapping/truncation — {@link sizeLabel} (REQ-081 smart-label-sizer, CJK-aware)
 * — so this estimate can never drift from the producer's own "does it fit"
 * definition (no parallel hardcoded char-width heuristic). A node `sizeLabel`
 * reports as `truncated` — the label did not fit even after shrinking to the
 * minimum font size — is a real rendering-quality defect: the viewer sees an
 * ellipsised label and loses information.
 *
 * Returns a 0-1 fraction (HIGHER is better): readable nodes / total nodes.
 * - failed run → 0
 * - no positioned nodes at all → 0 (a layout with no labels fails the 100% bar
 *   rather than passing it vacuously, so the iteration criterion rejects a
 *   degenerate layout).
 *
 * Scope: this estimator measures ONLY label-vs-box fit. Geometric defects — an
 * unpositioned (NaN x/y) or off-canvas node — are owned by `countNodeOverflow`
 * (which feeds the `レイアウト破綻0` criterion), not re-counted here, so each
 * defect dimension has exactly one owner. Node dimensions resolve to a finite
 * fallback via `getNodeWidth`/`getNodeHeight`, so `sizeLabel` always receives a
 * concrete box.
 *
 * The `ラベル可読性100%` iteration criterion treats this as a higher-is-better
 * percent: a 0-1 value of 1.0 (=100%) is required to pass, so even ONE
 * truncating label fails the gate instead of silently passing via the
 * unmapped-key "any metric present" fallback (the criterion-mapping silent-pass
 * class, defect 7).
 */
export function estimateLabelReadability(result: PipelineQualitySignals): number {
  if (!result.success) return 0;

  let totalNodes = 0;
  let readableNodes = 0;

  for (const scene of result.scenes || []) {
    const nodes = scene.layout?.nodes;
    if (!nodes) continue;

    for (const node of nodes) {
      totalNodes++;
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);
      const label = typeof node.label === 'string' ? node.label : '';
      const { truncated } = sizeLabel(label, w, h);
      if (!truncated) readableNodes++;
    }
  }

  if (totalNodes === 0) return 0;
  return readableNodes / totalNodes;
}
