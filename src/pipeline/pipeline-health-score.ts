/**
 * Pipeline Health Score (REQ-097/REQ-099)
 *
 * Combines bottleneck detection, cost efficiency, and performance regression
 * into a single actionable health score (0–100) with specific recommendations.
 *
 * Scoring weights:
 *   - Performance: 40% (regression status per stage)
 *   - Bottlenecks: 35% (stage time distribution)
 *   - Cost efficiency: 25% (cost/token regression)
 */

import { detectBottlenecks, BottleneckReport, BottleneckSeverity } from './bottleneck-detector';
import { StageTimingRecord } from './stage-timing-metrics';
import {
  calculateCostEfficiency,
  compareCostEfficiency,
  CostData,
  CostEfficiency,
  CostEfficiencyResult,
} from './cost-efficiency-metrics';
import {
  detectPerformanceRegressions,
  RegressionReport,
  type RegressionResult,
} from './performance-regression-detector';
import { StageMeasurement, DEFAULT_BASELINES } from './performance-baseline';

// ── Types ──────────────────────────────────────────────────────

export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface HealthScoreBreakdown {
  /** 0–100, weighted score for performance regression status */
  performanceScore: number;
  /** 0–100, weighted score for bottleneck status */
  bottleneckScore: number;
  /** 0–100, weighted score for cost efficiency */
  costScore: number;
}

export interface HealthRecommendation {
  category: 'performance' | 'bottleneck' | 'cost';
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface PipelineHealthReport {
  timestamp: number;
  overallScore: number;
  grade: HealthGrade;
  breakdown: HealthScoreBreakdown;
  recommendations: HealthRecommendation[];
  bottleneckReport: BottleneckReport;
  regressionReport: RegressionReport;
  costComparison: CostEfficiencyResult | null;
  summary: string;
}

// ── Scoring constants ──────────────────────────────────────────

const WEIGHT_PERFORMANCE = 0.40;
const WEIGHT_BOTTLENECK = 0.35;
const WEIGHT_COST = 0.25;

const SEVERITY_SCORE_MAP: Record<BottleneckSeverity, number> = {
  none: 100,
  warning: 60,
  critical: 20,
};

const REGRESSION_SEVERITY_SCORE: Record<RegressionResult['severity'], number> = {
  none: 100,
  warning: 50,
  critical: 15,
};

// ── Sub-score functions ────────────────────────────────────────

/**
 * Score the bottleneck status.
 * If there is no bottleneck → 100; warning → 60; critical → 20.
 * When multiple stages are bottlenecked, average their scores.
 */
export function scoreBottlenecks(report: BottleneckReport): number {
  const stages = report.stages ?? [];
  if (stages.length === 0) return 100;

  const scores = stages.map(s => SEVERITY_SCORE_MAP[s.severity]);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Score the performance regression status.
 * Average regression scores across all measured stages.
 */
export function scoreRegressions(report: RegressionReport): number {
  if (report.results.length === 0) return 100;

  const scores = report.results.map(r =>
    REGRESSION_SEVERITY_SCORE[r.severity],
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Score cost efficiency.
 * No regression → 100; cost regression → 40; token regression → 40;
 * both → 15.
 */
export function scoreCost(comparison: CostEfficiencyResult | null): number {
  if (!comparison) return 100;

  if (comparison.costRegression && comparison.tokenRegression) return 15;
  if (comparison.costRegression || comparison.tokenRegression) return 40;
  return 100;
}

// ── Grade mapping ──────────────────────────────────────────────

/**
 * Map a 0–100 numeric score to a human-readable grade.
 */
export function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 35) return 'poor';
  return 'critical';
}

// ── Recommendation engine ──────────────────────────────────────

/**
 * Generate actionable recommendations based on the three sub-reports.
 */
export function generateRecommendations(
  bottleneckReport: BottleneckReport,
  regressionReport: RegressionReport,
  costComparison: CostEfficiencyResult | null,
): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  // Bottleneck recommendations
  if (bottleneckReport.worstBottleneck) {
    const bn = bottleneckReport.worstBottleneck;
    recs.push({
      category: 'bottleneck',
      priority: bn.severity === 'critical' ? 'high' : 'medium',
      message: `${bn.stageName} consumes ${(bn.percentOfTotal * 100).toFixed(1)}% of pipeline time (${bn.severity}). Consider parallelizing or optimizing this stage.`,
    });
  }

  // Regression recommendations
  for (const r of regressionReport.results) {
    if (r.isRegression) {
      recs.push({
        category: 'performance',
        priority: r.severity === 'critical' ? 'high' : 'medium',
        message: `${r.stage} regressed by ${r.regressionPercent.toFixed(1)}% (baseline: ${r.baselineMs}ms, actual: ${r.actualMs}ms).`,
      });
    }
  }

  // Cost recommendations
  if (costComparison) {
    if (costComparison.costRegression) {
      recs.push({
        category: 'cost',
        priority: 'high',
        message: `Cost per video ($${costComparison.costPerVideo.toFixed(4)}) exceeds baseline ($${costComparison.baselineCostPerVideo.toFixed(4)}) by >= 10%. Review LLM prompt sizes and caching.`,
      });
    }
    if (costComparison.tokenRegression) {
      recs.push({
        category: 'cost',
        priority: 'medium',
        message: `Token usage per analysis (${costComparison.tokensPerAnalysis.toFixed(0)}) exceeds baseline (${costComparison.baselineTokensPerAnalysis}). Consider prompt optimization.`,
      });
    }
  }

  return recs;
}

// ── Main entry point ───────────────────────────────────────────

export interface PipelineHealthInput {
  stages: StageTimingRecord[];
  measurements: StageMeasurement[];
  costData: CostData;
  /** Override default cost baselines */
  baselineCostPerVideo?: number;
  /** Override default cost baselines */
  baselineTokensPerAnalysis?: number;
}

/**
 * Produce a unified pipeline health report from raw pipeline data.
 *
 * Combines bottleneck detection, performance regression analysis, and
 * cost efficiency comparison into a single 0–100 health score.
 */
export function computePipelineHealth(input: PipelineHealthInput): PipelineHealthReport {
  const { stages, measurements, costData, baselineCostPerVideo, baselineTokensPerAnalysis } = input;

  // Run sub-analyses
  const bottleneckReport = detectBottlenecks(stages);
  const regressionReport = detectPerformanceRegressions(measurements, DEFAULT_BASELINES);
  const efficiency = calculateCostEfficiency(costData);
  const costComparison = costData.videoCount > 0 || costData.analysisCount > 0
    ? compareCostEfficiency(efficiency, baselineCostPerVideo, baselineTokensPerAnalysis)
    : null;

  // Compute sub-scores
  const performanceScore = scoreRegressions(regressionReport);
  const bottleneckScore = scoreBottlenecks(bottleneckReport);
  const costScore = scoreCost(costComparison);

  // Weighted overall score
  const overallScore = Math.round(
    performanceScore * WEIGHT_PERFORMANCE +
    bottleneckScore * WEIGHT_BOTTLENECK +
    costScore * WEIGHT_COST,
  );

  const grade = scoreToGrade(overallScore);
  const recommendations = generateRecommendations(bottleneckReport, regressionReport, costComparison);

  const summary = recommendations.length === 0
    ? `Pipeline healthy (score: ${overallScore}, grade: ${grade}). No issues detected.`
    : `Pipeline score: ${overallScore} (${grade}). ${recommendations.length} issue(s) found — top: ${recommendations[0].message}`;

  return {
    timestamp: Date.now(),
    overallScore,
    grade,
    breakdown: { performanceScore, bottleneckScore, costScore },
    recommendations,
    bottleneckReport,
    regressionReport,
    costComparison,
    summary,
  };
}
