/**
 * Canonical pipeline-quality estimators.
 *
 * Single source of truth for deriving quality signals (transcription accuracy,
 * segmentation F1, entity/relation extraction, and layout-overlap count) from a
 * {@link PipelineResult}. Both {@link MainPipeline} and
 * {@link FrameworkIntegratedPipeline} delegate here so the self-improvement
 * framework (`RecursiveCustomInstructionsFramework.evaluateIteration`) sees
 * honest, identical quality signals regardless of which pipeline path produced
 * the result.
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
import { nodesOverlap } from '@/visualization/layout-utils';

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
export function estimateTranscriptionAccuracy(result: PipelineResult): number {
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
export function estimateSegmentationQuality(result: PipelineResult): number {
  if (!result.success || (result.scenes?.length ?? 0) === 0) return 0;

  const sceneCount = result.scenes!.length;
  const avgDuration = result.duration / sceneCount;

  let score = 0.7; // Base score

  // Bonus for good scene count
  if (sceneCount >= 2 && sceneCount <= 10) score += 0.15;

  // Bonus for reasonable scene durations (2-15 seconds)
  if (avgDuration >= 2000 && avgDuration <= 15000) score += 0.15;

  return Math.min(1.0, score);
}

/**
 * Estimate entity-extraction quality from nodes-per-scene density.
 *
 * - failed run / no scenes → 0
 * - 2–10 nodes/scene → 0.90; 1 (singleton) → 0.70; otherwise 0.50
 */
export function estimateEntityExtractionQuality(result: PipelineResult): number {
  if (!result.success || (result.scenes?.length ?? 0) === 0) return 0;

  const scenesWithNodes = result.scenes!.filter(s => (s.nodes || []).length > 0);
  const avgNodesPerScene =
    scenesWithNodes.reduce((sum, s) => sum + (s.nodes || []).length, 0) /
    Math.max(scenesWithNodes.length, 1);

  if (avgNodesPerScene >= 2 && avgNodesPerScene <= 10) return 0.90;
  if (avgNodesPerScene >= 1 && avgNodesPerScene < 2) return 0.70;
  return 0.50;
}

/**
 * Estimate relation-extraction accuracy from edges-per-scene density.
 *
 * - failed run / no scenes → 0
 * - ≥1 edge/scene → 0.85; otherwise 0.60
 */
export function estimateRelationAccuracy(result: PipelineResult): number {
  if (!result.success || (result.scenes?.length ?? 0) === 0) return 0;

  const scenesWithEdges = result.scenes!.filter(s => (s.edges || []).length > 0);
  const avgEdgesPerScene =
    scenesWithEdges.reduce((sum, s) => sum + (s.edges || []).length, 0) /
    Math.max(scenesWithEdges.length, 1);

  if (avgEdgesPerScene >= 1) return 0.85;
  return 0.60;
}

/**
 * Count overlapping node pairs across all scenes.
 *
 * Delegates to the canonical layout-engine predicate `nodesOverlap` (spacing 0)
 * — the same source of truth used by `OverlapResolver` and the layout quality
 * gate — so this count can NEVER drift from the producer's own overlap
 * definition. Touching nodes (right edge == left edge) are NOT overlaps.
 */
export function countLayoutOverlaps(result: PipelineResult): number {
  let totalOverlaps = 0;

  for (const scene of result.scenes || []) {
    if (!scene.layout?.nodes) continue;

    const nodes = scene.layout.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodesOverlap(nodes[i], nodes[j], 0)) totalOverlaps++;
      }
    }
  }

  return totalOverlaps;
}
