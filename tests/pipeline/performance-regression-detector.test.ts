/**
 * TASK-0145: Performance Regression Benchmark Tests
 *
 * Unit tests covering:
 *   1. Baseline comparison accuracy
 *   2. Regression severity classification
 *   3. Parallel speedup measurement
 *   4. Cost efficiency metric calculation
 *   5. JSON report generation
 */

import {
  compareWithBaseline,
  classifyRegression,
  detectPerformanceRegressions,
  RegressionResult,
  RegressionReport,
} from '@/pipeline/performance-regression-detector';
import {
  PerformanceBaseline,
  StageMeasurement,
  DEFAULT_BASELINES,
  getBaseline,
  isWithinBaseline,
  aggregateBenchmark,
} from '@/pipeline/performance-baseline';
import {
  calculateSpeedup,
  compareExecutionModes,
  generateParallelReport,
  ExecutionTiming,
} from '@/pipeline/parallel-benchmark';
import {
  calculateCostEfficiency,
  compareCostEfficiency,
  generateCostReport,
  CostData,
} from '@/pipeline/cost-efficiency-metrics';

// ── Test Case 1: Baseline comparison is accurate ──────────────────────

describe('TASK-0145: Baseline comparison accuracy', () => {
  test('transcription 9500ms vs 8000ms baseline → 18.75% regression detected', () => {
    const measurement: StageMeasurement = {
      stage: 'transcription',
      durationMs: 9500,
      memoryMB: 40,
      timestamp: Date.now(),
    };
    const result = compareWithBaseline(measurement);
    // (9500 - 8000) / 8000 * 100 = 18.75%
    expect(result.regressionPercent).toBeCloseTo(18.75, 1);
    expect(result.isRegression).toBe(true);
    expect(result.severity).toBe('warning');
  });

  test('measurement within baseline → no regression', () => {
    const measurement: StageMeasurement = {
      stage: 'layout',
      durationMs: 3500,
      memoryMB: 80,
      timestamp: Date.now(),
    };
    const result = compareWithBaseline(measurement);
    expect(result.isRegression).toBe(false);
    expect(result.severity).toBe('none');
  });

  test('unknown stage → passes by default', () => {
    const measurement: StageMeasurement = {
      stage: 'nonexistent',
      durationMs: 99999,
      memoryMB: 500,
      timestamp: Date.now(),
    };
    const result = compareWithBaseline(measurement);
    expect(result.isRegression).toBe(false);
    expect(result.baselineMs).toBe(0);
  });

  test('isWithinBaseline rejects on memory exceed', () => {
    const measurement: StageMeasurement = {
      stage: 'rendering',
      durationMs: 2000,
      memoryMB: 250, // exceeds 200 MB baseline
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(measurement)).toBe(false);
  });
});

// ── Test Case 2: Regression severity classification ───────────────────

describe('TASK-0145: Regression severity classification', () => {
  test('< 10% → none', () => {
    expect(classifyRegression(5)).toBe('none');
    expect(classifyRegression(9.9)).toBe('none');
  });

  test('10% ≤ x < 25% → warning', () => {
    expect(classifyRegression(10)).toBe('warning');
    expect(classifyRegression(15)).toBe('warning');
    expect(classifyRegression(24.9)).toBe('warning');
  });

  test('>= 25% → critical', () => {
    expect(classifyRegression(25)).toBe('critical');
    expect(classifyRegression(50)).toBe('critical');
  });
});

// ── Test Case 3: Parallel speedup measurement ────────────────────────

describe('TASK-0145: Parallel speedup measurement', () => {
  test('sequential 12000ms, parallel 5000ms → 2.4x speedup', () => {
    const factor = calculateSpeedup(12000, 5000);
    expect(factor).toBeCloseTo(2.4, 1);
  });

  test('sequential 0ms → returns 1.0 (no division by zero)', () => {
    expect(calculateSpeedup(0, 1000)).toBe(1.0);
  });

  test('compareExecutionModes produces correct results', () => {
    const sequential: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis',      durationMs: 10000 },
      { stage: 'layout',        durationMs: 4000 },
    ];
    const parallel: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis',      durationMs: 6000 },
      { stage: 'layout',        durationMs: 2000 },
    ];
    const results = compareExecutionModes(sequential, parallel);
    expect(results).toHaveLength(3);
    // analysis: 10000/6000 = 1.667x
    expect(results[1].speedupFactor).toBeCloseTo(1.667, 1);
    // layout meets target (2000 ≤ 2000)
    expect(results[2].meetsTarget).toBe(true);
  });

  test('generateParallelReport aggregates correctly', () => {
    const sequential: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis',      durationMs: 10000 },
    ];
    const parallel: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis',      durationMs: 5000 },
    ];
    const report = generateParallelReport(sequential, parallel);
    expect(report.overallSequentialMs).toBe(18000);
    expect(report.overallParallelMs).toBe(13000);
    expect(report.overallSpeedup).toBeCloseTo(18000 / 13000, 2);
  });
});

// ── Test Case 4: Cost efficiency metrics ──────────────────────────────

describe('TASK-0145: Cost efficiency metrics', () => {
  test('$0.03/video, 2000 tokens/analysis → correct efficiency', () => {
    const data: CostData = {
      totalCostUsd: 0.30,
      totalTokens: 20000,
      videoCount: 10,
      analysisCount: 10,
    };
    const efficiency = calculateCostEfficiency(data);
    expect(efficiency.costPerVideo).toBeCloseTo(0.03, 4);
    expect(efficiency.tokensPerAnalysis).toBe(2000);
  });

  test('cost regression detected when >10% above baseline', () => {
    const efficiency = calculateCostEfficiency({
      totalCostUsd: 0.40,
      totalTokens: 20000,
      videoCount: 10,
      analysisCount: 10,
    });
    // $0.04/video vs $0.03 baseline = 33% over → regression
    const result = compareCostEfficiency(efficiency);
    expect(result.costRegression).toBe(true);
  });

  test('no regression when within baseline', () => {
    const efficiency = calculateCostEfficiency({
      totalCostUsd: 0.30,
      totalTokens: 20000,
      videoCount: 10,
      analysisCount: 10,
    });
    const result = compareCostEfficiency(efficiency);
    expect(result.costRegression).toBe(false);
    expect(result.tokenRegression).toBe(false);
  });

  test('generateCostReport produces valid structure', () => {
    const report = generateCostReport({
      totalCostUsd: 0.15,
      totalTokens: 10000,
      videoCount: 5,
      analysisCount: 5,
    });
    expect(report).toHaveProperty('timestamp');
    expect(report.efficiency.costPerVideo).toBeCloseTo(0.03, 4);
    expect(report.comparison).not.toBeNull();
  });
});

// ── Test Case 5: JSON report generation ───────────────────────────────

describe('TASK-0145: JSON report generation', () => {
  test('detectPerformanceRegressions produces valid JSON-serializable report', () => {
    const measurements: StageMeasurement[] = DEFAULT_BASELINES.map(b => ({
      stage: b.stage,
      durationMs: b.maxDurationMs * 0.9, // 90% of max → no regression
      memoryMB: b.maxMemoryMB * 0.8,
      timestamp: Date.now(),
    }));

    const report = detectPerformanceRegressions(measurements);

    // Must be JSON-serializable
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as RegressionReport;
    expect(parsed.hasRegression).toBe(false);
    expect(parsed.results).toHaveLength(DEFAULT_BASELINES.length);
    expect(parsed.worstStage).toBeNull();
    expect(parsed.summary).toContain('within baseline');
  });

  test('report includes all 5 stages', () => {
    const measurements: StageMeasurement[] = DEFAULT_BASELINES.map(b => ({
      stage: b.stage,
      durationMs: b.maxDurationMs * 1.2, // 20% over → regression
      memoryMB: b.maxMemoryMB * 0.5,
      timestamp: Date.now(),
    }));

    const report = detectPerformanceRegressions(measurements);
    expect(report.results).toHaveLength(5);
    expect(report.hasRegression).toBe(true);
    // Worst stage should be one of the stages
    expect(DEFAULT_BASELINES.map(b => b.stage)).toContain(report.worstStage);
  });

  test('aggregateBenchmark produces valid BenchmarkResult', () => {
    const measurements: StageMeasurement[] = DEFAULT_BASELINES.map(b => ({
      stage: b.stage,
      durationMs: b.maxDurationMs * 0.5,
      memoryMB: b.maxMemoryMB * 0.5,
      timestamp: Date.now(),
    }));

    const result = aggregateBenchmark(measurements);
    expect(result.passed).toBe(true);
    expect(result.stages).toHaveLength(5);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.totalMemoryMB).toBeGreaterThan(0);
    // Verifiable as JSON
    const json = JSON.stringify(result);
    expect(JSON.parse(json).passed).toBe(true);
  });
});
