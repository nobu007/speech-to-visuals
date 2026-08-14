/**
 * Single source for the pipeline quality-gate threshold DEFAULTS.
 *
 * Before this module the same defaults were frozen independently in four
 * files (pipeline/quality-monitor, framework/auto-improvement-engine,
 * framework/recursive-custom-instructions, pipeline/main-pipeline) with two
 * latent hazards:
 *
 *   1. Field-NAME variant: `relationshipAccuracy` (pipeline/quality-monitor)
 *      vs `relationAccuracy` (framework/auto-improvement-engine) — same 0.85
 *      default, different spellings, so same-name greps missed the sibling.
 *   2. memoryUsage UNIT divergence: quality-monitor and
 *      auto-improvement-engine treat the field as MB; recursive-custom-
 *      instructions and main-pipeline treat it as BYTES. Both conventions
 *      are preserved here, but BYTES is DERIVED from MB so the 1024×
 *      relation cannot silently drift (same lesson as the ms/s class).
 *
 * Guard: tests/guards/quality-thresholds-single-source.test.ts fails if any
 * src/ file re-freezes a threshold-field key to a bare default literal.
 */

/** Transcription accuracy gate (0-1). */
export const DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD = 0.85;

/** Scene segmentation F1 gate (0-1). */
export const DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD = 0.75;

/** Entity extraction F1 gate (0-1). */
export const DEFAULT_ENTITY_EXTRACTION_F1_THRESHOLD = 0.80;

/**
 * Relation accuracy gate (0-1). Spelled `relationshipAccuracy` in
 * pipeline/quality-monitor and `relationAccuracy` in the framework —
 * one constant feeds both.
 */
export const DEFAULT_RELATION_ACCURACY_THRESHOLD = 0.85;

/** Max tolerated layout overlap (count; 0 = no overlap allowed). */
export const DEFAULT_LAYOUT_OVERLAP_THRESHOLD = 0;

/** Edge completeness gate (0-1). */
export const DEFAULT_EDGE_COMPLETENESS_THRESHOLD = 0.70;

/** Edge ratio quality gate (actual/expected). */
export const DEFAULT_EDGE_RATIO_QUALITY_THRESHOLD = 0.80;

/** Max total render time (ms). */
export const DEFAULT_RENDER_TIME_THRESHOLD_MS = 30_000;

/** Max memory usage, MB convention — quality-monitor / auto-improvement-engine. */
export const DEFAULT_MEMORY_USAGE_THRESHOLD_MB = 512;

/**
 * Max memory usage, BYTES convention — recursive-custom-instructions /
 * main-pipeline (metrics come from getHeapUsed(), which reports bytes).
 * Derived, never re-typed: keeps the two conventions exactly 1024² apart.
 */
export const DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES =
  DEFAULT_MEMORY_USAGE_THRESHOLD_MB * 1024 * 1024;
