/**
 * Pipeline Health Score Unit Tests
 *
 * Tests for pipeline-health-score.ts:
 *   - scoreBottlenecks: maps bottleneck severity to numeric scores
 *   - scoreRegressions: maps regression severity to numeric scores
 *   - scoreCost: maps cost regression to numeric scores
 *   - scoreToGrade: maps 0–100 to grade categories
 *   - generateRecommendations: produces actionable recommendations
 *   - computePipelineHealth: full end-to-end health report
 */

import {
  scoreBottlenecks,
  scoreRegressions,
  scoreCost,
  scoreToGrade,
  generateRecommendations,
  computePipelineHealth,
  HealthGrade,
} from '@/pipeline/pipeline-health-score';
import { BottleneckReport, BottleneckInfo } from '@/pipeline/bottleneck-detector';
import { RegressionReport, RegressionResult } from '@/pipeline/performance-regression-detector';
import { CostEfficiencyResult } from '@/pipeline/cost-efficiency-metrics';

// ── Helpers ────────────────────────────────────────────────────

function makeBottleneckInfo(overrides: Partial<BottleneckInfo> = {}): BottleneckInfo {
  return {
    stageName: 'test-stage',
    durationMs: 1000,
    percentOfTotal: 0.5,
    severity: 'none',
    message: 'ok',
    ...overrides,
  };
}

function makeBottleneckReport(overrides: Partial<BottleneckReport> = {}): BottleneckReport {
  return {
    timestamp: Date.now(),
    stages: [],
    worstBottleneck: null,
    hasBottleneck: false,
    summary: 'No bottleneck',
    ...overrides,
  };
}

function makeRegressionResult(overrides: Partial<RegressionResult> = {}): RegressionResult {
  return {
    stage: 'test-stage',
    baselineMs: 1000,
    actualMs: 1000,
    regressionPercent: 0,
    isRegression: false,
    severity: 'none',
    ...overrides,
  };
}

function makeRegressionReport(overrides: Partial<RegressionReport> = {}): RegressionReport {
  return {
    timestamp: Date.now(),
    results: [],
    hasRegression: false,
    worstStage: null,
    summary: 'All stages within baseline',
    ...overrides,
  };
}

function makeCostComparison(overrides: Partial<CostEfficiencyResult> = {}): CostEfficiencyResult {
  return {
    costPerVideo: 0.03,
    baselineCostPerVideo: 0.03,
    tokensPerAnalysis: 2000,
    baselineTokensPerAnalysis: 2000,
    costRegression: false,
    tokenRegression: false,
    summary: 'within baseline',
    ...overrides,
  };
}

// ── scoreBottlenecks ──────────────────────────────────────────

describe('scoreBottlenecks', () => {
  it('returns 100 when no stages exist', () => {
    const report = makeBottleneckReport({ stages: [] });
    expect(scoreBottlenecks(report)).toBe(100);
  });

  it('returns 100 when all stages are severity none', () => {
    const stages = [
      makeBottleneckInfo({ severity: 'none', percentOfTotal: 0.2 }),
      makeBottleneckInfo({ severity: 'none', percentOfTotal: 0.3 }),
    ];
    const report = makeBottleneckReport({ stages });
    expect(scoreBottlenecks(report)).toBe(100);
  });

  it('returns 60 for a single warning bottleneck', () => {
    const stages = [makeBottleneckInfo({ severity: 'warning' })];
    const report = makeBottleneckReport({ stages });
    expect(scoreBottlenecks(report)).toBe(60);
  });

  it('returns 20 for a single critical bottleneck', () => {
    const stages = [makeBottleneckInfo({ severity: 'critical' })];
    const report = makeBottleneckReport({ stages });
    expect(scoreBottlenecks(report)).toBe(20);
  });

  it('averages scores for mixed severities', () => {
    const stages = [
      makeBottleneckInfo({ severity: 'none' }),     // 100
      makeBottleneckInfo({ severity: 'warning' }),   // 60
    ];
    const report = makeBottleneckReport({ stages });
    expect(scoreBottlenecks(report)).toBe(80);
  });
});

// ── scoreRegressions ──────────────────────────────────────────

describe('scoreRegressions', () => {
  it('returns 100 when no results exist', () => {
    const report = makeRegressionReport({ results: [] });
    expect(scoreRegressions(report)).toBe(100);
  });

  it('returns 100 when no regressions detected', () => {
    const results = [
      makeRegressionResult({ severity: 'none' }),
      makeRegressionResult({ severity: 'none' }),
    ];
    const report = makeRegressionReport({ results });
    expect(scoreRegressions(report)).toBe(100);
  });

  it('returns 50 for a single warning regression', () => {
    const results = [makeRegressionResult({ severity: 'warning' })];
    const report = makeRegressionReport({ results });
    expect(scoreRegressions(report)).toBe(50);
  });

  it('returns 15 for a single critical regression', () => {
    const results = [makeRegressionResult({ severity: 'critical' })];
    const report = makeRegressionReport({ results });
    expect(scoreRegressions(report)).toBe(15);
  });

  it('averages scores for mixed severities', () => {
    const results = [
      makeRegressionResult({ severity: 'none' }),     // 100
      makeRegressionResult({ severity: 'critical' }), // 15
    ];
    const report = makeRegressionReport({ results });
    expect(scoreRegressions(report)).toBeCloseTo(57.5);
  });
});

// ── scoreCost ─────────────────────────────────────────────────

describe('scoreCost', () => {
  it('returns 100 when comparison is null', () => {
    expect(scoreCost(null)).toBe(100);
  });

  it('returns 100 when no regressions', () => {
    const comparison = makeCostComparison();
    expect(scoreCost(comparison)).toBe(100);
  });

  it('returns 40 when only cost regression', () => {
    const comparison = makeCostComparison({ costRegression: true, tokenRegression: false });
    expect(scoreCost(comparison)).toBe(40);
  });

  it('returns 40 when only token regression', () => {
    const comparison = makeCostComparison({ costRegression: false, tokenRegression: true });
    expect(scoreCost(comparison)).toBe(40);
  });

  it('returns 15 when both cost and token regression', () => {
    const comparison = makeCostComparison({ costRegression: true, tokenRegression: true });
    expect(scoreCost(comparison)).toBe(15);
  });
});

// ── scoreToGrade ──────────────────────────────────────────────

describe('scoreToGrade', () => {
  it('maps boundary values correctly', () => {
    expect(scoreToGrade(100)).toBe('excellent');
    expect(scoreToGrade(90)).toBe('excellent');
    expect(scoreToGrade(89)).toBe('good');
    expect(scoreToGrade(75)).toBe('good');
    expect(scoreToGrade(74)).toBe('fair');
    expect(scoreToGrade(55)).toBe('fair');
    expect(scoreToGrade(54)).toBe('poor');
    expect(scoreToGrade(35)).toBe('poor');
    expect(scoreToGrade(34)).toBe('critical');
    expect(scoreToGrade(0)).toBe('critical');
  });
});

// ── generateRecommendations ───────────────────────────────────

describe('generateRecommendations', () => {
  it('returns empty array when everything is healthy', () => {
    const bn = makeBottleneckReport();
    const rr = makeRegressionReport();
    const cc = makeCostComparison();

    const recs = generateRecommendations(bn, rr, cc);
    expect(recs).toEqual([]);
  });

  it('generates bottleneck recommendation for worst bottleneck', () => {
    const bn = makeBottleneckReport({
      worstBottleneck: makeBottleneckInfo({
        stageName: 'analysis',
        percentOfTotal: 0.65,
        severity: 'critical',
      }),
    });
    const rr = makeRegressionReport();
    const cc = makeCostComparison();

    const recs = generateRecommendations(bn, rr, cc);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs[0].category).toBe('bottleneck');
    expect(recs[0].priority).toBe('high');
    expect(recs[0].message).toContain('analysis');
  });

  it('generates regression recommendation for regressed stage', () => {
    const bn = makeBottleneckReport();
    const rr = makeRegressionReport({
      results: [makeRegressionResult({
        stage: 'layout',
        isRegression: true,
        severity: 'warning',
        regressionPercent: 15,
      })],
    });
    const cc = makeCostComparison();

    const recs = generateRecommendations(bn, rr, cc);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs[0].category).toBe('performance');
    expect(recs[0].priority).toBe('medium');
    expect(recs[0].message).toContain('layout');
  });

  it('generates cost recommendation for cost regression', () => {
    const bn = makeBottleneckReport();
    const rr = makeRegressionReport();
    const cc = makeCostComparison({
      costRegression: true,
      costPerVideo: 0.04,
      baselineCostPerVideo: 0.03,
    });

    const recs = generateRecommendations(bn, rr, cc);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    const costRec = recs.find(r => r.category === 'cost');
    expect(costRec).toBeDefined();
    expect(costRec!.priority).toBe('high');
    expect(costRec!.message).toContain('Cost per video');
  });

  it('generates token recommendation for token regression', () => {
    const bn = makeBottleneckReport();
    const rr = makeRegressionReport();
    const cc = makeCostComparison({
      tokenRegression: true,
      tokensPerAnalysis: 2500,
      baselineTokensPerAnalysis: 2000,
    });

    const recs = generateRecommendations(bn, rr, cc);
    const tokenRec = recs.find(r => r.category === 'cost' && r.message.includes('Token'));
    expect(tokenRec).toBeDefined();
    expect(tokenRec!.priority).toBe('medium');
  });

  it('generates multiple recommendations when multiple issues exist', () => {
    const bn = makeBottleneckReport({
      worstBottleneck: makeBottleneckInfo({
        stageName: 'rendering',
        severity: 'warning',
        percentOfTotal: 0.5,
      }),
    });
    const rr = makeRegressionReport({
      results: [makeRegressionResult({
        stage: 'transcription',
        isRegression: true,
        severity: 'critical',
        regressionPercent: 30,
      })],
    });
    const cc = makeCostComparison({ costRegression: true, costPerVideo: 0.05, baselineCostPerVideo: 0.03 });

    const recs = generateRecommendations(bn, rr, cc);
    expect(recs.length).toBeGreaterThanOrEqual(3);
  });
});

// ── computePipelineHealth (integration) ───────────────────────

describe('computePipelineHealth', () => {
  it('returns excellent grade for healthy pipeline', () => {
    const report = computePipelineHealth({
      stages: [
        { stageName: 'transcription', startTime: 0, endTime: 2000, durationMs: 2000, itemsProcessed: 1, throughputPerMs: 0.0005 },
        { stageName: 'analysis', startTime: 2000, endTime: 4000, durationMs: 2000, itemsProcessed: 1, throughputPerMs: 0.0005 },
        { stageName: 'layout', startTime: 4000, endTime: 6000, durationMs: 2000, itemsProcessed: 1, throughputPerMs: 0.0005 },
      ],
      measurements: [
        { stage: 'transcription', durationMs: 2000, memoryMB: 30, timestamp: Date.now() },
        { stage: 'analysis', durationMs: 2000, memoryMB: 50, timestamp: Date.now() },
        { stage: 'layout', durationMs: 2000, memoryMB: 40, timestamp: Date.now() },
      ],
      costData: { totalCostUsd: 0.03, totalTokens: 2000, videoCount: 1, analysisCount: 1 },
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.grade).toBe('excellent');
    expect(report.breakdown.performanceScore).toBe(100);
    expect(report.breakdown.bottleneckScore).toBe(100);
    expect(report.breakdown.costScore).toBe(100);
    expect(report.recommendations).toEqual([]);
    expect(report.summary).toContain('Pipeline healthy');
  });

  it('returns poor/critical grade when all dimensions regress', () => {
    // Stage taking >60% → critical bottleneck
    // Duration above baseline → regression
    // Cost above baseline → cost regression
    const report = computePipelineHealth({
      stages: [
        { stageName: 'transcription', startTime: 0, endTime: 15000, durationMs: 15000, itemsProcessed: 1, throughputPerMs: 0.00007 },
        { stageName: 'analysis', startTime: 15000, endTime: 18000, durationMs: 3000, itemsProcessed: 1, throughputPerMs: 0.00033 },
        { stageName: 'layout', startTime: 18000, endTime: 19000, durationMs: 1000, itemsProcessed: 1, throughputPerMs: 0.001 },
      ],
      measurements: [
        // transcription baseline is 8000ms → 15000ms is 87.5% regression → critical
        { stage: 'transcription', durationMs: 15000, memoryMB: 30, timestamp: Date.now() },
        { stage: 'analysis', durationMs: 3000, memoryMB: 50, timestamp: Date.now() },
      ],
      costData: { totalCostUsd: 0.10, totalTokens: 5000, videoCount: 1, analysisCount: 1 },
    });

    expect(report.overallScore).toBeLessThan(55);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(report.breakdown.bottleneckScore).toBeLessThan(100);
  });

  it('weights scores correctly (40/35/25 split)', () => {
    // All scores = 100 → 100
    // Only cost regressed (score=40) → 40*0.25 + 100*0.40 + 100*0.35 = 10+40+35 = 85
    const report = computePipelineHealth({
      stages: [
        { stageName: 'a', startTime: 0, endTime: 300, durationMs: 300, itemsProcessed: 1, throughputPerMs: 0.003 },
        { stageName: 'b', startTime: 300, endTime: 600, durationMs: 300, itemsProcessed: 1, throughputPerMs: 0.003 },
        { stageName: 'c', startTime: 600, endTime: 900, durationMs: 300, itemsProcessed: 1, throughputPerMs: 0.003 },
      ],
      measurements: [
        { stage: 'transcription', durationMs: 2000, memoryMB: 30, timestamp: Date.now() },
      ],
      // costPerVideo = 0.50 > 0.03 * 1.10 = 0.033 → cost regression
      costData: { totalCostUsd: 0.50, totalTokens: 2000, videoCount: 1, analysisCount: 1 },
    });

    // Cost regression detected, so costScore = 40
    // overall = 100*0.40 + 100*0.35 + 40*0.25 = 40+35+10 = 85
    expect(report.breakdown.costScore).toBe(40);
    expect(report.overallScore).toBe(85);
    expect(report.grade).toBe('good');
  });

  it('handles empty stages and measurements gracefully', () => {
    const report = computePipelineHealth({
      stages: [],
      measurements: [],
      costData: { totalCostUsd: 0, totalTokens: 0, videoCount: 0, analysisCount: 0 },
    });

    expect(report.overallScore).toBe(100);
    expect(report.grade).toBe('excellent');
    expect(report.costComparison).toBeNull();
  });

  it('includes all sub-reports in the output', () => {
    const report = computePipelineHealth({
      stages: [
        { stageName: 'a', startTime: 0, endTime: 100, durationMs: 100, itemsProcessed: 1, throughputPerMs: 0.01 },
      ],
      measurements: [
        { stage: 'transcription', durationMs: 2000, memoryMB: 30, timestamp: Date.now() },
      ],
      costData: { totalCostUsd: 0.03, totalTokens: 2000, videoCount: 1, analysisCount: 1 },
    });

    expect(report.bottleneckReport).toBeDefined();
    expect(report.regressionReport).toBeDefined();
    expect(report.costComparison).toBeDefined();
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('uses custom cost baselines when provided', () => {
    const report = computePipelineHealth({
      stages: [
        { stageName: 'a', startTime: 0, endTime: 100, durationMs: 100, itemsProcessed: 1, throughputPerMs: 0.01 },
      ],
      measurements: [],
      costData: { totalCostUsd: 0.50, totalTokens: 6000, videoCount: 1, analysisCount: 1 },
      baselineCostPerVideo: 0.40,
      baselineTokensPerAnalysis: 5000,
    });

    // costPerVideo=0.50, baseline=0.40 → (0.50-0.40)/0.40*100 = 25% > 10% → regression
    expect(report.costComparison!.costRegression).toBe(true);
    expect(report.costComparison!.baselineCostPerVideo).toBe(0.40);
  });
});
