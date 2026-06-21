import {
  scoreBottlenecks,
  scoreRegressions,
  scoreCost,
  scoreToGrade,
  generateRecommendations,
  type HealthGrade,
} from '../pipeline-health-score';
import type { BottleneckReport, BottleneckSeverity } from '../bottleneck-detector';
import type { RegressionReport } from '../performance-regression-detector';
import type { CostEfficiencyResult } from '../cost-efficiency-metrics';

// Helper to build a minimal BottleneckReport
function makeBottleneckReport(
  stages: { stageName: string; severity: BottleneckSeverity; percentOfTotal: number }[],
): BottleneckReport {
  const worstBottleneck = stages.length > 0 ? stages[0] : undefined;
  return {
    stages,
    worstBottleneck,
    totalDurationMs: 0,
  } as BottleneckReport;
}

// Helper to build a minimal RegressionReport
function makeRegressionReport(
  results: { stage: string; isRegression: boolean; severity: string; regressionPercent: number; baselineMs: number; actualMs: number }[],
): RegressionReport {
  return { results } as unknown as RegressionReport;
}

describe('scoreBottlenecks', () => {
  it('returns 100 for empty report', () => {
    expect(scoreBottlenecks(makeBottleneckReport([]))).toBe(100);
  });

  it('returns 100 when all stages have "none" severity', () => {
    const report = makeBottleneckReport([
      { stageName: 'a', severity: 'none', percentOfTotal: 0.3 },
    ]);
    expect(scoreBottlenecks(report)).toBe(100);
  });

  it('returns 60 for warning severity', () => {
    const report = makeBottleneckReport([
      { stageName: 'a', severity: 'warning', percentOfTotal: 0.3 },
    ]);
    expect(scoreBottlenecks(report)).toBe(60);
  });

  it('returns 20 for critical severity', () => {
    const report = makeBottleneckReport([
      { stageName: 'a', severity: 'critical', percentOfTotal: 0.5 },
    ]);
    expect(scoreBottlenecks(report)).toBe(20);
  });

  it('averages multiple stage scores', () => {
    const report = makeBottleneckReport([
      { stageName: 'a', severity: 'none', percentOfTotal: 0.2 },
      { stageName: 'b', severity: 'critical', percentOfTotal: 0.5 },
    ]);
    // (100 + 20) / 2 = 60
    expect(scoreBottlenecks(report)).toBe(60);
  });
});

describe('scoreRegressions', () => {
  it('returns 100 for empty report', () => {
    expect(scoreRegressions(makeRegressionReport([]))).toBe(100);
  });

  it('returns 100 when no regressions', () => {
    const report = makeRegressionReport([
      { stage: 'a', isRegression: false, severity: 'none', regressionPercent: 0, baselineMs: 100, actualMs: 100 },
    ]);
    expect(scoreRegressions(report)).toBe(100);
  });

  it('returns 50 for warning severity', () => {
    const report = makeRegressionReport([
      { stage: 'a', isRegression: true, severity: 'warning', regressionPercent: 20, baselineMs: 100, actualMs: 120 },
    ]);
    expect(scoreRegressions(report)).toBe(50);
  });

  it('returns 15 for critical severity', () => {
    const report = makeRegressionReport([
      { stage: 'a', isRegression: true, severity: 'critical', regressionPercent: 50, baselineMs: 100, actualMs: 150 },
    ]);
    expect(scoreRegressions(report)).toBe(15);
  });
});

describe('scoreCost', () => {
  it('returns 100 for null comparison', () => {
    expect(scoreCost(null)).toBe(100);
  });

  it('returns 100 when no regressions', () => {
    const comp = { costRegression: false, tokenRegression: false } as CostEfficiencyResult;
    expect(scoreCost(comp)).toBe(100);
  });

  it('returns 40 for cost regression only', () => {
    const comp = { costRegression: true, tokenRegression: false } as CostEfficiencyResult;
    expect(scoreCost(comp)).toBe(40);
  });

  it('returns 40 for token regression only', () => {
    const comp = { costRegression: false, tokenRegression: true } as CostEfficiencyResult;
    expect(scoreCost(comp)).toBe(40);
  });

  it('returns 15 for both regressions', () => {
    const comp = { costRegression: true, tokenRegression: true } as CostEfficiencyResult;
    expect(scoreCost(comp)).toBe(15);
  });
});

describe('scoreToGrade', () => {
  it.each<[number, HealthGrade]>([
    [95, 'excellent'],
    [90, 'excellent'],
    [89, 'good'],
    [75, 'good'],
    [74, 'fair'],
    [55, 'fair'],
    [54, 'poor'],
    [35, 'poor'],
    [34, 'critical'],
    [0, 'critical'],
  ])('maps score %d to %s', (score, expected) => {
    expect(scoreToGrade(score)).toBe(expected);
  });
});

describe('generateRecommendations', () => {
  it('returns empty array for healthy pipeline', () => {
    const recs = generateRecommendations(
      makeBottleneckReport([]),
      makeRegressionReport([]),
      null,
    );
    expect(recs).toHaveLength(0);
  });

  it('generates bottleneck recommendation for critical bottleneck', () => {
    const report = makeBottleneckReport([
      { stageName: 'analysis', severity: 'critical', percentOfTotal: 0.5 },
    ]);
    const recs = generateRecommendations(report, makeRegressionReport([]), null);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe('bottleneck');
    expect(recs[0].priority).toBe('high');
    expect(recs[0].message).toContain('analysis');
  });

  it('generates medium priority for warning bottleneck', () => {
    const report = makeBottleneckReport([
      { stageName: 'layout', severity: 'warning', percentOfTotal: 0.3 },
    ]);
    const recs = generateRecommendations(report, makeRegressionReport([]), null);
    expect(recs[0].priority).toBe('medium');
  });

  it('generates regression recommendations', () => {
    const regReport = makeRegressionReport([
      { stage: 'transcription', isRegression: true, severity: 'critical', regressionPercent: 30, baselineMs: 8000, actualMs: 10400 },
    ]);
    const recs = generateRecommendations(makeBottleneckReport([]), regReport, null);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe('performance');
    expect(recs[0].priority).toBe('high');
    expect(recs[0].message).toContain('transcription');
  });

  it('generates cost regression recommendation', () => {
    const costComp = {
      costRegression: true,
      tokenRegression: false,
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
    } as CostEfficiencyResult;
    const recs = generateRecommendations(makeBottleneckReport([]), makeRegressionReport([]), costComp);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe('cost');
    expect(recs[0].priority).toBe('high');
  });

  it('generates token regression recommendation', () => {
    const costComp = {
      costRegression: false,
      tokenRegression: true,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
    } as CostEfficiencyResult;
    const recs = generateRecommendations(makeBottleneckReport([]), makeRegressionReport([]), costComp);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe('cost');
    expect(recs[0].priority).toBe('medium');
  });

  it('generates multiple recommendations when multiple issues exist', () => {
    const bnReport = makeBottleneckReport([
      { stageName: 'analysis', severity: 'critical', percentOfTotal: 0.5 },
    ]);
    const regReport = makeRegressionReport([
      { stage: 'layout', isRegression: true, severity: 'warning', regressionPercent: 15, baselineMs: 4000, actualMs: 4600 },
    ]);
    const costComp = {
      costRegression: true,
      tokenRegression: true,
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
      summary: 'regression',
    } as CostEfficiencyResult;
    const recs = generateRecommendations(bnReport, regReport, costComp);
    expect(recs.length).toBeGreaterThanOrEqual(3);
  });
});
