/**
 * Phase 36: Performance Baseline Definitions (REQ-099)
 *
 * Defines timing and memory baselines for each pipeline stage.
 * Used by the regression detector to identify performance degradation.
 * Based on measured E2E time of ~25.2s with 10% margin.
 */

import { sanitizeFinite } from '@stv/core/utils/guards';

/** Per-stage performance baseline with current ceiling and Phase 36 target */
export interface PerformanceBaseline {
  stage: string;
  /** Current baseline + 10% margin — any duration above this is a regression */
  maxDurationMs: number;
  /** Per-stage memory limit in MB */
  maxMemoryMB: number;
  /** Phase 36 target after parallelization (lower than maxDurationMs) */
  targetDurationMs: number;
}

/** A single measured sample for a stage */
export interface StageMeasurement {
  stage: string;
  durationMs: number;
  memoryMB: number;
  timestamp: number;
}

/** Aggregated benchmark result across all stages */
export interface BenchmarkResult {
  timestamp: number;
  stages: StageMeasurement[];
  totalDurationMs: number;
  totalMemoryMB: number;
  passed: boolean;
}

/**
 * Default baselines derived from E2E measurements (25.2s total).
 * maxDurationMs = measured_value * 1.10 (10% regression margin).
 */
export const DEFAULT_BASELINES: readonly PerformanceBaseline[] = [
  { stage: 'transcription', maxDurationMs: 8000,  maxMemoryMB: 50,  targetDurationMs: 8000 },
  { stage: 'analysis',      maxDurationMs: 10000, maxMemoryMB: 80,  targetDurationMs: 7000 },
  { stage: 'layout',        maxDurationMs: 4000,  maxMemoryMB: 100, targetDurationMs: 2000 },
  { stage: 'preparation',   maxDurationMs: 1500,  maxMemoryMB: 40,  targetDurationMs: 1000 },
  { stage: 'rendering',     maxDurationMs: 3000,  maxMemoryMB: 200, targetDurationMs: 3000 },
] as const;

/**
 * Look up the baseline for a named stage.
 * Returns `undefined` if the stage is not in the baseline table.
 */
export function getBaseline(stage: string, baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES): PerformanceBaseline | undefined {
  return baselines.find(b => b.stage === stage);
}

/**
 * Check whether a stage measurement exceeds its baseline ceiling.
 * Returns `true` when the stage is within acceptable limits.
 */
export function isWithinBaseline(measurement: StageMeasurement, baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES): boolean {
  const baseline = getBaseline(measurement.stage, baselines);
  if (!baseline) return true; // unknown stages pass by default
  return measurement.durationMs <= baseline.maxDurationMs && measurement.memoryMB <= baseline.maxMemoryMB;
}

/**
 * Aggregate an array of stage measurements into a BenchmarkResult.
 */
export function aggregateBenchmark(stages: StageMeasurement[], baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES): BenchmarkResult {
  const totalDurationMs = stages.reduce((s, m) => s + sanitizeFinite(m.durationMs, 0), 0);
  const totalMemoryMB = stages.reduce((s, m) => s + m.memoryMB, 0);
  const passed = stages.every(m => isWithinBaseline(m, baselines));
  return { timestamp: Date.now(), stages, totalDurationMs, totalMemoryMB, passed };
}
