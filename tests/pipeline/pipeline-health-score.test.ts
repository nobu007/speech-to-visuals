/**
 * Tests for Pipeline Health Score (src/pipeline/pipeline-health-score.ts)
 *
 * Tests the pure sub-score functions and grade mapping independently.
 */

import {
  scoreBottlenecks,
  scoreRegressions,
  scoreCost,
  scoreToGrade,
  generateRecommendations,
} from '@/pipeline/pipeline-health-score';
import type { BottleneckReport } from '@/pipeline/bottleneck-detector';
import type { RegressionReport } from '@/pipeline/performance-regression-detector';
import type { CostEfficiencyResult } from '@/pipeline/cost-efficiency-metrics';

// ── scoreToGrade ─────────────────────────────────────────────────────

describe('scoreToGrade', () => {
  test('returns "excellent" for scores >= 90', () => {
    expect(scoreToGrade(100)).toBe('excellent');
    expect(scoreToGrade(90)).toBe('excellent');
  });

  test('returns "good" for scores 75-89', () => {
    expect(scoreToGrade(89)).toBe('good');
    expect(scoreToGrade(75)).toBe('good');
  });

  test('returns "fair" for scores 55-74', () => {
    expect(scoreToGrade(74)).toBe('fair');
    expect(scoreToGrade(55)).toBe('fair');
  });

  test('returns "poor" for scores 35-54', () => {
    expect(scoreToGrade(54)).toBe('poor');
    expect(scoreToGrade(35)).toBe('poor');
  });

  test('returns "critical" for scores below 35', () => {
    expect(scoreToGrade(34)).toBe('critical');
    expect(scoreToGrade(0)).toBe('critical');
  });
});

// ── scoreBottlenecks ─────────────────────────────────────────────────

describe('scoreBottlenecks', () => {
  function makeReport(severities: Array<'none' | 'warning' | 'critical'>): BottleneckReport {
    const stageNames = ['transcription', 'analysis', 'layout', 'rendering'];
    return {
      timestamp: Date.now(),
      stages: severities.map((severity, i) => ({
        stageName: stageNames[i] ?? `stage-${i}`,
        durationMs: 100,
        percentOfTotal: 1 / severities.length,
        severity,
        message: '',
      })),
      worstBottleneck: null,
      hasBottleneck: severities.some(s => s !== 'none'),
      summary: '',
    };
  }

  test('returns 100 for empty stages', () => {
    const report = makeReport([]);
    expect(scoreBottlenecks(report)).toBe(100);
  });

  test('returns 100 when all stages are "none"', () => {
    const report = makeReport(['none', 'none', 'none']);
    expect(scoreBottlenecks(report)).toBe(100);
  });

  test('returns 60 when a stage has "warning"', () => {
    const report = makeReport(['warning']);
    expect(scoreBottlenecks(report)).toBe(60);
  });

  test('returns 20 when a stage has "critical"', () => {
    const report = makeReport(['critical']);
    expect(scoreBottlenecks(report)).toBe(20);
  });

  test('averages scores across multiple stages', () => {
    const report = makeReport(['none', 'warning', 'critical']);
    // (100 + 60 + 20) / 3 = 60
    expect(scoreBottlenecks(report)).toBeCloseTo(60);
  });
});

// ── scoreRegressions ─────────────────────────────────────────────────

describe('scoreRegressions', () => {
  function makeRegressionReport(severities: string[]): RegressionReport {
    return {
      timestamp: Date.now(),
      results: severities.map((severity, i) => ({
        stage: `stage-${i}`,
        baselineMs: 100,
        actualMs: 100,
        regressionPercent: 0,
        isRegression: severity !== 'none',
        severity: severity as 'none' | 'warning' | 'critical',
      })),
      hasRegression: severities.some(s => s !== 'none'),
      worstStage: null,
      summary: '',
    };
  }

  test('returns 100 for empty results', () => {
    const report = makeRegressionReport([]);
    expect(scoreRegressions(report)).toBe(100);
  });

  test('returns 100 when all are "none"', () => {
    const report = makeRegressionReport(['none', 'none']);
    expect(scoreRegressions(report)).toBe(100);
  });

  test('returns 50 for "warning" severity', () => {
    const report = makeRegressionReport(['warning']);
    expect(scoreRegressions(report)).toBe(50);
  });

  test('returns 15 for "critical" severity', () => {
    const report = makeRegressionReport(['critical']);
    expect(scoreRegressions(report)).toBe(15);
  });

  test('averages multiple regression results', () => {
    const report = makeRegressionReport(['none', 'warning']);
    // (100 + 50) / 2 = 75
    expect(scoreRegressions(report)).toBeCloseTo(75);
  });
});

// ── scoreCost ────────────────────────────────────────────────────────

describe('scoreCost', () => {
  test('returns 100 when no comparison provided', () => {
    expect(scoreCost(null)).toBe(100);
  });

  test('returns 100 when no regressions detected', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.03,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      baselineTokensPerAnalysis: 2000,
      costRegression: false,
      tokenRegression: false,
      summary: 'No regression',
    };
    expect(scoreCost(comparison)).toBe(100);
  });

  test('returns 40 when cost regression only', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      baselineTokensPerAnalysis: 2000,
      costRegression: true,
      tokenRegression: false,
      summary: 'Cost regression',
    };
    expect(scoreCost(comparison)).toBe(40);
  });

  test('returns 40 when token regression only', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.03,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
      costRegression: false,
      tokenRegression: true,
      summary: 'Token regression',
    };
    expect(scoreCost(comparison)).toBe(40);
  });

  test('returns 15 when both cost and token regressions', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
      costRegression: true,
      tokenRegression: true,
      summary: 'Both regressions',
    };
    expect(scoreCost(comparison)).toBe(15);
  });
});

// ── generateRecommendations ──────────────────────────────────────────

describe('generateRecommendations', () => {
  function makeBottleneckReport(hasWorst: boolean): BottleneckReport {
    return {
      timestamp: Date.now(),
      stages: [],
      worstBottleneck: hasWorst
        ? { stageName: 'analysis', durationMs: 7000, percentOfTotal: 0.65, severity: 'critical' as const, message: '' }
        : null,
      hasBottleneck: hasWorst,
      summary: '',
    };
  }

  function makeRegressionReport(withRegression: boolean): RegressionReport {
    return {
      timestamp: Date.now(),
      results: withRegression
        ? [{
            stage: 'layout',
            baselineMs: 4000,
            actualMs: 6000,
            regressionPercent: 50,
            isRegression: true,
            severity: 'critical' as const,
          }]
        : [],
      hasRegression: withRegression,
      worstStage: withRegression ? 'layout' : null,
      summary: '',
    };
  }

  test('returns empty array when everything is healthy', () => {
    const recs = generateRecommendations(
      makeBottleneckReport(false),
      makeRegressionReport(false),
      null,
    );
    expect(recs).toHaveLength(0);
  });

  test('recommends bottleneck fix for critical bottleneck', () => {
    const recs = generateRecommendations(
      makeBottleneckReport(true),
      makeRegressionReport(false),
      null,
    );
    expect(recs.length).toBeGreaterThanOrEqual(1);
    const bnRec = recs.find(r => r.category === 'bottleneck');
    expect(bnRec).toBeDefined();
    expect(bnRec!.priority).toBe('high');
    expect(bnRec!.message).toContain('analysis');
  });

  test('recommends performance fix for regression', () => {
    const recs = generateRecommendations(
      makeBottleneckReport(false),
      makeRegressionReport(true),
      null,
    );
    const perfRec = recs.find(r => r.category === 'performance');
    expect(perfRec).toBeDefined();
    expect(perfRec!.message).toContain('layout');
  });

  test('recommends cost review for cost regression', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      baselineTokensPerAnalysis: 2000,
      costRegression: true,
      tokenRegression: false,
      summary: '',
    };
    const recs = generateRecommendations(
      makeBottleneckReport(false),
      makeRegressionReport(false),
      comparison,
    );
    const costRec = recs.find(r => r.category === 'cost');
    expect(costRec).toBeDefined();
    expect(costRec!.priority).toBe('high');
  });

  test('recommends token optimization for token regression', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.03,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
      costRegression: false,
      tokenRegression: true,
      summary: '',
    };
    const recs = generateRecommendations(
      makeBottleneckReport(false),
      makeRegressionReport(false),
      comparison,
    );
    const tokenRec = recs.find(r => r.category === 'cost' && r.message.includes('Token'));
    expect(tokenRec).toBeDefined();
    expect(tokenRec!.priority).toBe('medium');
  });

  test('returns multiple recommendations when multiple issues exist', () => {
    const comparison: CostEfficiencyResult = {
      costPerVideo: 0.05,
      baselineCostPerVideo: 0.03,
      tokensPerAnalysis: 3000,
      baselineTokensPerAnalysis: 2000,
      costRegression: true,
      tokenRegression: true,
      summary: '',
    };
    const recs = generateRecommendations(
      makeBottleneckReport(true),
      makeRegressionReport(true),
      comparison,
    );
    expect(recs.length).toBeGreaterThanOrEqual(4);
  });
});
