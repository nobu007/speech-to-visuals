/**
 * Phase 36: Performance Regression Detector (REQ-099)
 *
 * Compares measured stage durations against baselines and detects
 * regressions (>= 10% degradation). Classifies severity and
 * produces a JSON-serializable report.
 */

import { PerformanceBaseline, StageMeasurement, DEFAULT_BASELINES } from './performance-baseline';

/** Result of comparing one stage's actual timing against its baseline */
export interface RegressionResult {
  stage: string;
  baselineMs: number;
  actualMs: number;
  regressionPercent: number;
  isRegression: boolean;
  severity: 'none' | 'warning' | 'critical';
}

/** Full regression report for all measured stages */
export interface RegressionReport {
  timestamp: number;
  results: RegressionResult[];
  hasRegression: boolean;
  worstStage: string | null;
  summary: string;
}

const REGRESSION_THRESHOLD_PERCENT = 10; // 10% degradation triggers detection
const CRITICAL_THRESHOLD_PERCENT = 25;   // 25% degradation is critical

/**
 * Compare an actual measurement against the baseline and return a RegressionResult.
 */
export function compareWithBaseline(
  measurement: StageMeasurement,
  baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES,
): RegressionResult {
  const baseline = baselines.find(b => b.stage === measurement.stage);
  const baselineMs = baseline?.maxDurationMs ?? 0;

  if (baselineMs === 0) {
    return {
      stage: measurement.stage,
      baselineMs: 0,
      actualMs: measurement.durationMs,
      regressionPercent: 0,
      isRegression: false,
      severity: 'none',
    };
  }

  const regressionPercent = ((measurement.durationMs - baselineMs) / baselineMs) * 100;
  const isRegression = regressionPercent >= REGRESSION_THRESHOLD_PERCENT;
  const severity = classifyRegression(regressionPercent);

  return { stage: measurement.stage, baselineMs, actualMs: measurement.durationMs, regressionPercent, isRegression, severity };
}

/**
 * Classify the severity of a regression based on the percentage degradation.
 * - < 10%  → none
 * - 10–25% → warning
 * - >= 25% → critical
 */
export function classifyRegression(regressionPercent: number): 'none' | 'warning' | 'critical' {
  if (regressionPercent >= CRITICAL_THRESHOLD_PERCENT) return 'critical';
  if (regressionPercent >= REGRESSION_THRESHOLD_PERCENT) return 'warning';
  return 'none';
}

/**
 * Run regression detection across an array of stage measurements
 * and produce a full report.
 */
export function detectPerformanceRegressions(
  measurements: StageMeasurement[],
  baselines: readonly PerformanceBaseline[] = DEFAULT_BASELINES,
): RegressionReport {
  const results = measurements.map(m => compareWithBaseline(m, baselines));
  const hasRegression = results.some(r => r.isRegression);
  const worst = results
    .filter(r => r.isRegression)
    .sort((a, b) => b.regressionPercent - a.regressionPercent)[0];

  let summary: string;
  if (!hasRegression) {
    summary = 'All stages within baseline thresholds.';
  } else {
    const count = results.filter(r => r.isRegression).length;
    summary = `${count} stage(s) exceeded baseline by >= ${REGRESSION_THRESHOLD_PERCENT}%. Worst: ${worst!.stage} at ${worst!.regressionPercent.toFixed(1)}%.`;
  }

  return {
    timestamp: Date.now(),
    results,
    hasRegression,
    worstStage: worst?.stage ?? null,
    summary,
  };
}
