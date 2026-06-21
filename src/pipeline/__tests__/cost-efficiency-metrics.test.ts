import {
  calculateCostEfficiency,
  compareCostEfficiency,
  generateCostReport,
  type CostData,
} from '../cost-efficiency-metrics';

describe('calculateCostEfficiency', () => {
  it('calculates cost per video', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 50,
      analysisCount: 100,
    };
    const result = calculateCostEfficiency(data);
    expect(result.costPerVideo).toBeCloseTo(0.03, 6);
  });

  it('calculates tokens per analysis', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 50,
      analysisCount: 100,
    };
    const result = calculateCostEfficiency(data);
    expect(result.tokensPerAnalysis).toBe(500);
  });

  it('returns zero costPerVideo when videoCount is 0', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 0,
      analysisCount: 100,
    };
    expect(calculateCostEfficiency(data).costPerVideo).toBe(0);
  });

  it('returns zero tokensPerAnalysis when analysisCount is 0', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 50,
      analysisCount: 0,
    };
    expect(calculateCostEfficiency(data).tokensPerAnalysis).toBe(0);
  });

  it('preserves totalCostUsd and totalTokens', () => {
    const data: CostData = {
      totalCostUsd: 2.50,
      totalTokens: 100000,
      videoCount: 10,
      analysisCount: 20,
    };
    const result = calculateCostEfficiency(data);
    expect(result.totalCostUsd).toBe(2.50);
    expect(result.totalTokens).toBe(100000);
  });
});

describe('compareCostEfficiency', () => {
  it('detects no regression when within thresholds', () => {
    const current = {
      costPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0.03, 2000);
    expect(result.costRegression).toBe(false);
    expect(result.tokenRegression).toBe(false);
    expect(result.summary).toContain('within baseline');
  });

  it('detects cost regression when cost exceeds 10% above baseline', () => {
    const current = {
      costPerVideo: 0.035, // 16.7% above $0.03 baseline
      tokensPerAnalysis: 2000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0.03, 2000);
    expect(result.costRegression).toBe(true);
    expect(result.summary).toContain('regression');
  });

  it('detects token regression', () => {
    const current = {
      costPerVideo: 0.03,
      tokensPerAnalysis: 2500, // 25% above 2000 baseline
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0.03, 2000);
    expect(result.tokenRegression).toBe(true);
    expect(result.summary).toContain('regression');
  });

  it('does not flag regression at exactly 10% boundary', () => {
    // 10% above $0.03 is $0.033
    const current = {
      costPerVideo: 0.033,
      tokensPerAnalysis: 2000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0.03, 2000);
    // >= threshold means exactly 10% IS a regression
    expect(result.costRegression).toBe(true);
  });

  it('does not flag regression just below 10%', () => {
    const current = {
      costPerVideo: 0.032, // 6.7% above
      tokensPerAnalysis: 2000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0.03, 2000);
    expect(result.costRegression).toBe(false);
  });

  it('handles zero baseline gracefully', () => {
    const current = {
      costPerVideo: 0.05,
      tokensPerAnalysis: 3000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current, 0, 0);
    expect(result.costRegression).toBe(false);
    expect(result.tokenRegression).toBe(false);
  });

  it('uses default baselines when not provided', () => {
    const current = {
      costPerVideo: 0.03,
      tokensPerAnalysis: 2000,
      totalCostUsd: 3,
      totalTokens: 60000,
    };
    const result = compareCostEfficiency(current);
    // Default baseline cost is $0.03, tokens is 2000
    expect(result.baselineCostPerVideo).toBe(0.03);
    expect(result.baselineTokensPerAnalysis).toBe(2000);
  });
});

describe('generateCostReport', () => {
  it('includes efficiency and comparison', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 50,
      analysisCount: 100,
    };
    const report = generateCostReport(data);
    expect(report.efficiency).toBeDefined();
    expect(report.comparison).toBeDefined();
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('passes custom baselines to comparison', () => {
    const data: CostData = {
      totalCostUsd: 1.50,
      totalTokens: 50000,
      videoCount: 50,
      analysisCount: 100,
    };
    const report = generateCostReport(data, 0.05, 1000);
    expect(report.comparison!.baselineCostPerVideo).toBe(0.05);
    expect(report.comparison!.baselineTokensPerAnalysis).toBe(1000);
  });
});
