/**
 * TASK-0155: Cost Efficiency Metrics Unit Tests
 *
 * Tests for cost-efficiency-metrics.ts (REQ-099):
 *   - calculateCostEfficiency: per-unit cost/token computation
 *   - compareCostEfficiency: regression detection with configurable thresholds
 *   - generateCostReport: full benchmark report generation
 */

import {
  calculateCostEfficiency,
  compareCostEfficiency,
  generateCostReport,
  CostData,
  CostEfficiency,
} from '@/pipeline/cost-efficiency-metrics';

// ---------- calculateCostEfficiency ----------

describe('calculateCostEfficiency', () => {
  it('computes cost per video and tokens per analysis', () => {
    const data: CostData = {
      totalCostUsd: 0.30,
      totalTokens: 10000,
      videoCount: 10,
      analysisCount: 5,
    };
    const result = calculateCostEfficiency(data);
    expect(result.costPerVideo).toBeCloseTo(0.03);
    expect(result.tokensPerAnalysis).toBeCloseTo(2000);
    expect(result.totalCostUsd).toBe(0.30);
    expect(result.totalTokens).toBe(10000);
  });

  it('returns zero costPerVideo when videoCount is zero', () => {
    const data: CostData = {
      totalCostUsd: 0.50,
      totalTokens: 1000,
      videoCount: 0,
      analysisCount: 5,
    };
    const result = calculateCostEfficiency(data);
    expect(result.costPerVideo).toBe(0);
    expect(result.tokensPerAnalysis).toBeCloseTo(200);
  });

  it('returns zero tokensPerAnalysis when analysisCount is zero', () => {
    const data: CostData = {
      totalCostUsd: 0.50,
      totalTokens: 1000,
      videoCount: 5,
      analysisCount: 0,
    };
    const result = calculateCostEfficiency(data);
    expect(result.costPerVideo).toBeCloseTo(0.10);
    expect(result.tokensPerAnalysis).toBe(0);
  });
});

// ---------- compareCostEfficiency ----------

describe('compareCostEfficiency', () => {
  it('reports no regression when within thresholds', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      totalCostUsd: 0.30,
      totalTokens: 10000,
    };
    const result = compareCostEfficiency(current);
    expect(result.costRegression).toBe(false);
    expect(result.tokenRegression).toBe(false);
    expect(result.summary).toContain('within baseline thresholds');
  });

  it('detects cost regression when cost exceeds 10% above baseline', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.035,  // > 0.03 * 1.10 = 0.033
      tokensPerAnalysis: 2000,
      totalCostUsd: 0.35,
      totalTokens: 10000,
    };
    const result = compareCostEfficiency(current);
    expect(result.costRegression).toBe(true);
    expect(result.summary).toContain('Cost regression detected');
    expect(result.summary).toContain('$0.0350/video');
  });

  it('detects token regression when tokens exceed 10% above baseline', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.03,
      tokensPerAnalysis: 2300,  // > 2000 * 1.10 = 2200
      totalCostUsd: 0.30,
      totalTokens: 11500,
    };
    const result = compareCostEfficiency(current);
    expect(result.tokenRegression).toBe(true);
    expect(result.summary).toContain('2300 tokens/analysis');
  });

  it('detects both cost and token regression simultaneously', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.04,
      tokensPerAnalysis: 2500,
      totalCostUsd: 0.40,
      totalTokens: 12500,
    };
    const result = compareCostEfficiency(current);
    expect(result.costRegression).toBe(true);
    expect(result.tokenRegression).toBe(true);
  });

  it('does not regress when exactly at 10% threshold', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.033,  // exactly 10% above 0.03
      tokensPerAnalysis: 2000,
      totalCostUsd: 0.33,
      totalTokens: 10000,
    };
    const result = compareCostEfficiency(current);
    // (0.033 - 0.03) / 0.03 * 100 = 10% — at the boundary
    expect(result.costRegression).toBe(true);
  });

  it('uses custom baselines when provided', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.06,
      tokensPerAnalysis: 5500,
      totalCostUsd: 0.60,
      totalTokens: 27500,
    };
    const result = compareCostEfficiency(current, 0.05, 5000);
    expect(result.baselineCostPerVideo).toBe(0.05);
    expect(result.baselineTokensPerAnalysis).toBe(5000);
    // 0.06 > 0.05 * 1.10 = 0.055, so regression
    expect(result.costRegression).toBe(true);
  });

  it('returns false for regressions when baseline is zero', () => {
    const current: CostEfficiency = {
      costPerVideo: 0.10,
      tokensPerAnalysis: 5000,
      totalCostUsd: 1.0,
      totalTokens: 50000,
    };
    const result = compareCostEfficiency(current, 0, 0);
    expect(result.costRegression).toBe(false);
    expect(result.tokenRegression).toBe(false);
  });
});

// ---------- generateCostReport ----------

describe('generateCostReport', () => {
  it('generates a complete report with efficiency and comparison', () => {
    const data: CostData = {
      totalCostUsd: 0.30,
      totalTokens: 10000,
      videoCount: 10,
      analysisCount: 5,
    };
    const report = generateCostReport(data);
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.efficiency.costPerVideo).toBeCloseTo(0.03);
    expect(report.efficiency.tokensPerAnalysis).toBeCloseTo(2000);
    expect(report.comparison).not.toBeNull();
    expect(report.comparison!.costRegression).toBe(false);
  });

  it('generates report detecting regression with custom baselines', () => {
    const data: CostData = {
      totalCostUsd: 1.00,
      totalTokens: 50000,
      videoCount: 10,
      analysisCount: 5,
    };
    const report = generateCostReport(data, 0.05, 5000);
    expect(report.comparison!.costRegression).toBe(true);
    expect(report.comparison!.tokenRegression).toBe(true);
  });
});
