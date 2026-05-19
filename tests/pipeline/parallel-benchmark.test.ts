/**
 * Phase 36: Parallel Benchmark Unit Tests (REQ-099)
 *
 * Covers calculateSpeedup, compareExecutionModes, and generateParallelReport
 * with edge cases, baseline matching, and fallback behaviour.
 */

import {
  calculateSpeedup,
  compareExecutionModes,
  generateParallelReport,
  type ExecutionTiming,
} from '@/pipeline/parallel-benchmark';
import type { PerformanceBaseline } from '@/pipeline/performance-baseline';

// ── calculateSpeedup ──────────────────────────────────────────────────

describe('calculateSpeedup', () => {
  it('returns ratio when sequential > parallel', () => {
    expect(calculateSpeedup(1000, 500)).toBeCloseTo(2.0);
  });

  it('returns 1.0 when sequential time is zero (division guard)', () => {
    expect(calculateSpeedup(0, 500)).toBe(1.0);
  });

  it('returns <1 when parallel is slower than sequential', () => {
    expect(calculateSpeedup(500, 1000)).toBeCloseTo(0.5);
  });

  it('returns 1.0 when both are equal', () => {
    expect(calculateSpeedup(800, 800)).toBeCloseTo(1.0);
  });
});

// ── compareExecutionModes ────────────────────────────────────────────

describe('compareExecutionModes', () => {
  const customBaselines: readonly PerformanceBaseline[] = [
    { stage: 'transcription', maxDurationMs: 8000, maxMemoryMB: 50, targetDurationMs: 6000 },
    { stage: 'analysis', maxDurationMs: 10000, maxMemoryMB: 80, targetDurationMs: 7000 },
  ];

  it('matches stages by name and calculates speedup', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis', durationMs: 10000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 4000 },
      { stage: 'analysis', durationMs: 5000 },
    ];

    const results = compareExecutionModes(seq, par, customBaselines);

    expect(results).toHaveLength(2);
    expect(results[0].speedupFactor).toBeCloseTo(2.0);
    expect(results[0].parallelMs).toBe(4000);
    expect(results[1].speedupFactor).toBeCloseTo(2.0);
  });

  it('falls back to sequential timing when parallel stage is missing', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
    ];
    const par: ExecutionTiming[] = [];

    const [result] = compareExecutionModes(seq, par, customBaselines);

    expect(result.parallelMs).toBe(8000); // fallback
    expect(result.speedupFactor).toBeCloseTo(1.0);
    expect(result.improvementPercent).toBeCloseTo(0);
  });

  it('sets meetsTarget=true when parallel ≤ baseline target', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 5000 }, // target is 6000
    ];

    const [result] = compareExecutionModes(seq, par, customBaselines);
    expect(result.meetsTarget).toBe(true);
  });

  it('sets meetsTarget=false when parallel exceeds baseline target', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 10000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 8000 }, // target is 7000
    ];

    const [result] = compareExecutionModes(seq, par, customBaselines);
    expect(result.meetsTarget).toBe(false);
  });

  it('defaults meetsTarget=true for stages without baseline', () => {
    const baselines: readonly PerformanceBaseline[] = []; // empty
    const seq: ExecutionTiming[] = [
      { stage: 'unknown', durationMs: 5000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'unknown', durationMs: 3000 },
    ];

    const [result] = compareExecutionModes(seq, par, baselines);
    expect(result.meetsTarget).toBe(true);
  });

  it('calculates improvementPercent correctly', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 10000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 3000 },
    ];

    const [result] = compareExecutionModes(seq, par, customBaselines);
    // (10000 - 3000) / 10000 * 100 = 70%
    expect(result.improvementPercent).toBeCloseTo(70.0);
  });

  it('handles zero sequential duration (0% improvement)', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 0 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 100 },
    ];

    const [result] = compareExecutionModes(seq, par, customBaselines);
    expect(result.improvementPercent).toBe(0);
    expect(result.speedupFactor).toBe(1.0); // calculateSpeedup(0, 100) = 1.0
  });
});

// ── generateParallelReport ───────────────────────────────────────────

describe('generateParallelReport', () => {
  const customBaselines: readonly PerformanceBaseline[] = [
    { stage: 'transcription', maxDurationMs: 8000, maxMemoryMB: 50, targetDurationMs: 6000 },
    { stage: 'analysis', maxDurationMs: 10000, maxMemoryMB: 80, targetDurationMs: 7000 },
    { stage: 'rendering', maxDurationMs: 3000, maxMemoryMB: 200, targetDurationMs: 3000 },
  ];

  it('aggregates overall times and speedup', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis', durationMs: 10000 },
      { stage: 'rendering', durationMs: 3000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 4000 },
      { stage: 'analysis', durationMs: 5000 },
      { stage: 'rendering', durationMs: 3000 },
    ];

    const report = generateParallelReport(seq, par, customBaselines);

    expect(report.overallSequentialMs).toBe(21000);
    expect(report.overallParallelMs).toBe(12000);
    expect(report.overallSpeedup).toBeCloseTo(1.75);
    expect(report.results).toHaveLength(3);
    expect(typeof report.timestamp).toBe('number');
  });

  it('sets allTargetsMet=true when every stage meets its target', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'rendering', durationMs: 3000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 5000 }, // target 6000 ✓
      { stage: 'rendering', durationMs: 3000 },     // target 3000 ✓
    ];

    const report = generateParallelReport(seq, par, customBaselines);
    expect(report.allTargetsMet).toBe(true);
  });

  it('sets allTargetsMet=false when any stage misses its target', () => {
    const seq: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis', durationMs: 10000 },
    ];
    const par: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 5000 }, // target 6000 ✓
      { stage: 'analysis', durationMs: 8000 },      // target 7000 ✗
    ];

    const report = generateParallelReport(seq, par, customBaselines);
    expect(report.allTargetsMet).toBe(false);
  });

  it('handles empty input arrays', () => {
    const report = generateParallelReport([], [], customBaselines);

    expect(report.results).toHaveLength(0);
    expect(report.overallSequentialMs).toBe(0);
    expect(report.overallParallelMs).toBe(0);
    expect(report.overallSpeedup).toBe(1.0); // calculateSpeedup(0,0)
    expect(report.allTargetsMet).toBe(true);  // [].every() = true
  });
});
