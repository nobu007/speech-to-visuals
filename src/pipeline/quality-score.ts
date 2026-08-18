/**
 * Canonical pipeline quality score — SINGLE SOURCE.
 *
 * This used to be duplicated verbatim in two places:
 *   - SimplePipeline.calculateQualityScore        (src/pipeline/simple-pipeline.ts)
 *   - BatchProcessingAPI.calculateQualityScore     (src/api/batch-processing-api.ts)
 *
 * Two copies of the same formula silently diverge: edit one and the other
 * keeps the stale weighting, so the batch summary could disagree with the
 * pipeline's own recorded metric. Both callers now delegate here so the score
 * is computed once and consumed canonically everywhere — whether it is the
 * value surfaced on `SimplePipelineResult.qualityScore` (preferred) or the
 * value re-derived as a fallback for older/mocked results.
 *
 * Scale: 0–100.
 *
 *   Component           Max     Formula
 *   ------------------  ------  ----------------------------------------
 *   Transcript length     30    min(len / 100, 1) * 30
 *   Scene confidence      30    average(scene.confidence) * 30   (0–1 in)
 *   Performance           20    max(0, 20 - processingTime/1000)
 *   Video generated       20    flat bonus when videoUrl is present
 */
import type { SceneGraph } from '@stv/core/types/diagram';

export interface QualityScoreInput {
  transcript?: string;
  /** Per-scene detection confidence in 0–1. */
  scenes?: SceneGraph[];
  /** Total processing time in ms. Omitted → performance component skipped. */
  processingTime?: number;
  videoUrl?: string;
}

export function calculatePipelineQualityScore(input: QualityScoreInput): number {
  let score = 0;

  // Transcript quality (max 30): longer transcript (capped at 100 chars) scores higher.
  if (input.transcript) {
    score += Math.min(input.transcript.length / 100, 1) * 30;
  }

  // Scene detection quality (max 30): average per-scene confidence (0–1) scaled up.
  if (input.scenes && input.scenes.length > 0) {
    const avgConfidence =
      input.scenes.reduce((sum, scene) => sum + (scene.confidence || 0), 0) /
      input.scenes.length;
    score += avgConfidence * 30;
  }

  // Performance (max 20): faster processing scores higher; 1 s slower = 1 point less.
  // Guarded on `!== undefined` (not falsy) so a legitimate 0 ms (instant) result
  // earns the full 20 rather than being silently dropped as a falsy-guard bug.
  if (input.processingTime !== undefined) {
    score += Math.max(0, 20 - input.processingTime / 1000);
  }

  // Video generation bonus (flat 20).
  if (input.videoUrl) {
    score += 20;
  }

  return Math.min(score, 100);
}
