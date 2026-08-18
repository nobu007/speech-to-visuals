/**
 * Phase 36: Cost Efficiency Metrics (REQ-099)
 *
 * Tracks cost efficiency of LLM operations:
 *   - $ per video (total cost / video count)
 *   - tokens per analysis (total tokens / analysis count)
 *
 * Detects cost regressions when per-unit cost exceeds
 * a configurable threshold above the baseline.
 */

import { percentChange } from '@stv/core/lib/metrics-utils';

/** Raw cost data for a single run */
export interface CostData {
  totalCostUsd: number;
  totalTokens: number;
  videoCount: number;
  analysisCount: number;
}

/** Computed cost efficiency metrics */
export interface CostEfficiency {
  costPerVideo: number;
  tokensPerAnalysis: number;
  totalCostUsd: number;
  totalTokens: number;
}

/** Result of comparing current efficiency against a baseline */
export interface CostEfficiencyResult {
  costPerVideo: number;
  baselineCostPerVideo: number;
  tokensPerAnalysis: number;
  baselineTokensPerAnalysis: number;
  costRegression: boolean;
  tokenRegression: boolean;
  summary: string;
}

/** Full cost benchmark report */
export interface CostBenchmarkReport {
  timestamp: number;
  efficiency: CostEfficiency;
  comparison: CostEfficiencyResult | null;
}

const DEFAULT_BASELINE_COST_PER_VIDEO = 0.03;       // $0.03/video
const DEFAULT_BASELINE_TOKENS_PER_ANALYSIS = 2000;   // 2000 tokens/analysis
const COST_REGRESSION_THRESHOLD_PERCENT = 10;         // 10% above baseline = regression

/**
 * Calculate cost efficiency metrics from raw cost data.
 */
export function calculateCostEfficiency(data: CostData): CostEfficiency {
  return {
    costPerVideo: data.videoCount > 0 ? data.totalCostUsd / data.videoCount : 0,
    tokensPerAnalysis: data.analysisCount > 0 ? data.totalTokens / data.analysisCount : 0,
    totalCostUsd: data.totalCostUsd,
    totalTokens: data.totalTokens,
  };
}

/**
 * Compare current efficiency against baselines and detect cost regressions.
 */
export function compareCostEfficiency(
  current: CostEfficiency,
  baselineCostPerVideo: number = DEFAULT_BASELINE_COST_PER_VIDEO,
  baselineTokensPerAnalysis: number = DEFAULT_BASELINE_TOKENS_PER_ANALYSIS,
): CostEfficiencyResult {
  const costRegression = baselineCostPerVideo > 0
    ? percentChange(current.costPerVideo, baselineCostPerVideo) >= COST_REGRESSION_THRESHOLD_PERCENT
    : false;
  const tokenRegression = baselineTokensPerAnalysis > 0
    ? percentChange(current.tokensPerAnalysis, baselineTokensPerAnalysis) >= COST_REGRESSION_THRESHOLD_PERCENT
    : false;

  let summary: string;
  if (!costRegression && !tokenRegression) {
    summary = 'Cost efficiency within baseline thresholds.';
  } else {
    const parts: string[] = [];
    if (costRegression) parts.push(`$${current.costPerVideo.toFixed(4)}/video exceeds baseline $${baselineCostPerVideo.toFixed(4)}`);
    if (tokenRegression) parts.push(`${current.tokensPerAnalysis.toFixed(0)} tokens/analysis exceeds baseline ${baselineTokensPerAnalysis}`);
    summary = `Cost regression detected: ${parts.join('; ')}`;
  }

  return {
    costPerVideo: current.costPerVideo,
    baselineCostPerVideo,
    tokensPerAnalysis: current.tokensPerAnalysis,
    baselineTokensPerAnalysis,
    costRegression,
    tokenRegression,
    summary,
  };
}

/**
 * Generate a full cost benchmark report from raw cost data.
 */
export function generateCostReport(
  data: CostData,
  baselineCostPerVideo?: number,
  baselineTokensPerAnalysis?: number,
): CostBenchmarkReport {
  const efficiency = calculateCostEfficiency(data);
  const comparison = compareCostEfficiency(efficiency, baselineCostPerVideo, baselineTokensPerAnalysis);
  return { timestamp: Date.now(), efficiency, comparison };
}
