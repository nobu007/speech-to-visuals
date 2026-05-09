/**
 * Phase 36: Parallel Benchmark (REQ-099)
 *
 * Measures the speedup from parallel pipeline execution
 * vs. sequential execution. Reports the ratio and whether
 * the parallel run meets the Phase 36 targets.
 */

import { PerformanceBaseline, DEFAULT_BASELINES } from './performance-baseline';

/** Timing sample for a single execution mode */
export interface ExecutionTiming {
  stage: string;
  durationMs: number;
}

/** Result of a parallel-vs-sequential comparison */
export interface SpeedupResult {
  stage: string;
  sequentialMs: number;
  parallelMs: number;
  speedupFactor: number;
  /** Percentage improvement: ((seq - par) / seq) * 100 */
  improvementPercent: number;
  meetsTarget: boolean;
}

/** Full benchmark report */
export interface ParallelBenchmarkReport {
  timestamp: number;
  results: SpeedupResult[];
  overallSequentialMs: number;
  overallParallelMs: number;
  overallSpeedup: number;
  allTargetsMet: boolean;
}

/**
 * Calculate the speedup factor for a single stage.
 * Returns 1.0 when sequential time is 0 (avoids division by zero).
 */
export function calculateSpeedup(sequentialMs: number, parallelMs: number): number {
  if (sequentialMs === 0) return 1.0;
  return sequentialMs / parallelMs;
}

/**
 * Compare sequential and parallel execution timings for each stage
 * and determine whether parallel meets the Phase 36 target.
 */
export function compareExecutionModes(
  sequential: ExecutionTiming[],
  parallel: ExecutionTiming[],
  baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES,
): SpeedupResult[] {
  const results: SpeedupResult[] = [];

  for (const seq of sequential) {
    const par = parallel.find(p => p.stage === seq.stage);
    const parallelMs = par?.durationMs ?? seq.durationMs; // fallback: treat as sequential
    const speedupFactor = calculateSpeedup(seq.durationMs, parallelMs);
    const improvementPercent = seq.durationMs > 0
      ? ((seq.durationMs - parallelMs) / seq.durationMs) * 100
      : 0;
    const baseline = baselines.find(b => b.stage === seq.stage);
    const meetsTarget = baseline ? parallelMs <= baseline.targetDurationMs : true;

    results.push({
      stage: seq.stage,
      sequentialMs: seq.durationMs,
      parallelMs,
      speedupFactor,
      improvementPercent,
      meetsTarget,
    });
  }

  return results;
}

/**
 * Produce a full parallel benchmark report from sequential and parallel timings.
 */
export function generateParallelReport(
  sequential: ExecutionTiming[],
  parallel: ExecutionTiming[],
  baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES,
): ParallelBenchmarkReport {
  const results = compareExecutionModes(sequential, parallel, baselines);
  const overallSequentialMs = results.reduce((s, r) => s + r.sequentialMs, 0);
  const overallParallelMs = results.reduce((s, r) => s + r.parallelMs, 0);
  const overallSpeedup = calculateSpeedup(overallSequentialMs, overallParallelMs);
  const allTargetsMet = results.every(r => r.meetsTarget);

  return {
    timestamp: Date.now(),
    results,
    overallSequentialMs,
    overallParallelMs,
    overallSpeedup,
    allTargetsMet,
  };
}
