/**
 * Edge-case tests for cost-estimator.ts
 *
 * Covers paths not exercised by token-usage-cost-monitoring.test.ts:
 *  1. Zero-token inputs/outputs
 *  2. Very large token counts
 *  3. estimateCost with empty records
 *  4. estimateCost with single record
 *  5. All stages populated simultaneously
 *  6. Mixed Flash/Pro records in single estimateCost call
 *  7. Flash vs Pro model branching
 *  8. Floating-point precision with many records
 *  9. CostBreakdown field independence (inputCost != outputCost)
 */

import { calculateModelCost, estimateCost, CostEstimationError } from '@/analysis/cost-estimator';
import type { TokenUsageRecord } from '@/analysis/token-usage-tracker';

// Helper to build a record
function makeRecord(overrides: Partial<TokenUsageRecord> & { model: TokenUsageRecord['model']; stage: TokenUsageRecord['stage'] }): TokenUsageRecord {
  return {
    requestId: `test_${Math.random().toString(36).slice(2)}`,
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateModelCost edge cases
// ---------------------------------------------------------------------------
describe('calculateModelCost: edge cases', () => {
  it('returns zero cost for zero tokens', () => {
    const cost = calculateModelCost('gemini-2.5-flash', 0, 0);
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBe(0);
  });

  it('returns zero input cost when inputTokens is 0', () => {
    const cost = calculateModelCost('gemini-2.5-flash', 0, 1000);
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBeGreaterThan(0);
    expect(cost.totalCost).toBe(cost.outputCost);
  });

  it('returns zero output cost when outputTokens is 0', () => {
    const cost = calculateModelCost('gemini-2.5-pro', 1000, 0);
    expect(cost.inputCost).toBeGreaterThan(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBe(cost.inputCost);
  });

  it('handles very large token counts (1 billion)', () => {
    const cost = calculateModelCost('gemini-2.5-flash', 1_000_000_000, 1_000_000_000);
    // 1B / 1M = 1000 → inputCost = 1000 * 0.075 = 75, outputCost = 1000 * 0.30 = 300
    expect(cost.inputCost).toBeCloseTo(75, 2);
    expect(cost.outputCost).toBeCloseTo(300, 2);
    expect(cost.totalCost).toBeCloseTo(375, 2);
  });

  it('handles single-token inputs (sub-microcent precision)', () => {
    const cost = calculateModelCost('gemini-2.5-flash', 1, 1);
    expect(cost.inputCost).toBeCloseTo(0.075 / 1_000_000, 12);
    expect(cost.outputCost).toBeCloseTo(0.30 / 1_000_000, 12);
    expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
  });

  it('Pro is more expensive than Flash for same tokens', () => {
    const flash = calculateModelCost('gemini-2.5-flash', 10_000, 10_000);
    const pro = calculateModelCost('gemini-2.5-pro', 10_000, 10_000);
    expect(pro.totalCost).toBeGreaterThan(flash.totalCost);
    expect(pro.inputCost).toBeGreaterThan(flash.inputCost);
    expect(pro.outputCost).toBeGreaterThan(flash.outputCost);
  });

  it('returns breakdown where totalCost = inputCost + outputCost', () => {
    const cost = calculateModelCost('gemini-2.5-pro', 5432, 1098);
    expect(cost.totalCost).toBeCloseTo(cost.inputCost + cost.outputCost, 12);
  });

  it('throws on negative inputTokens', () => {
    expect(() => calculateModelCost('gemini-2.5-flash', -1, 0))
      .toThrow(CostEstimationError);
  });

  it('throws on negative outputTokens', () => {
    expect(() => calculateModelCost('gemini-2.5-flash', 0, -1))
      .toThrow(CostEstimationError);
  });

  it('throws on NaN inputTokens', () => {
    expect(() => calculateModelCost('gemini-2.5-flash', NaN, 0))
      .toThrow(CostEstimationError);
  });

  it('throws on Infinity outputTokens', () => {
    expect(() => calculateModelCost('gemini-2.5-flash', 0, Infinity))
      .toThrow(CostEstimationError);
  });
});

// ---------------------------------------------------------------------------
// estimateCost edge cases
// ---------------------------------------------------------------------------
describe('estimateCost: edge cases', () => {
  it('returns all zeros for empty records array', () => {
    const result = estimateCost([]);
    expect(result.flashCost).toBe(0);
    expect(result.proCost).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.costByStage.analysis).toBe(0);
    expect(result.costByStage.fallback).toBe(0);
    expect(result.costByStage['cache-warmup']).toBe(0);
  });

  it('handles single Flash record correctly', () => {
    const records = [makeRecord({ model: 'gemini-2.5-flash', inputTokens: 10_000, outputTokens: 2_000, stage: 'analysis' })];
    const result = estimateCost(records);

    expect(result.flashCost).toBeCloseTo(0.00135, 8);
    expect(result.proCost).toBe(0);
    expect(result.totalCost).toBe(result.flashCost);
    expect(result.costByStage.analysis).toBeCloseTo(0.00135, 8);
    expect(result.costByStage.fallback).toBe(0);
    expect(result.costByStage['cache-warmup']).toBe(0);
  });

  it('handles single Pro record correctly', () => {
    const records = [makeRecord({ model: 'gemini-2.5-pro', inputTokens: 1_000, outputTokens: 500, stage: 'fallback' })];
    const result = estimateCost(records);

    expect(result.flashCost).toBe(0);
    expect(result.proCost).toBeCloseTo(0.00375, 8);
    expect(result.totalCost).toBe(result.proCost);
    expect(result.costByStage.fallback).toBeCloseTo(0.00375, 8);
  });

  it('sums Flash costs across multiple Flash records', () => {
    const records = [
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 10_000, outputTokens: 0, stage: 'analysis' }),
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 20_000, outputTokens: 0, stage: 'analysis' }),
    ];
    const result = estimateCost(records);

    // 10K input Flash = 0.00075, 20K input Flash = 0.0015
    expect(result.flashCost).toBeCloseTo(0.00075 + 0.0015, 8);
    expect(result.proCost).toBe(0);
    expect(result.totalCost).toBe(result.flashCost);
  });

  it('sums Pro costs across multiple Pro records', () => {
    const records = [
      makeRecord({ model: 'gemini-2.5-pro', inputTokens: 0, outputTokens: 1_000, stage: 'fallback' }),
      makeRecord({ model: 'gemini-2.5-pro', inputTokens: 0, outputTokens: 2_000, stage: 'fallback' }),
    ];
    const result = estimateCost(records);

    // 1K output Pro = 0.005, 2K output Pro = 0.01
    expect(result.proCost).toBeCloseTo(0.005 + 0.01, 8);
    expect(result.flashCost).toBe(0);
    expect(result.totalCost).toBe(result.proCost);
  });

  it('populates all three stages simultaneously', () => {
    const records = [
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 0, stage: 'analysis' }),
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 0, outputTokens: 1_000_000, stage: 'fallback' }),
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 1_000_000, stage: 'cache-warmup' }),
    ];
    const result = estimateCost(records);

    expect(result.costByStage.analysis).toBeCloseTo(0.075, 4); // 1M input * $0.075/M
    expect(result.costByStage.fallback).toBeCloseTo(0.30, 4);  // 1M output * $0.30/M
    expect(result.costByStage['cache-warmup']).toBeCloseTo(0.375, 4); // 1M input + 1M output
    expect(result.totalCost).toBeCloseTo(0.075 + 0.30 + 0.375, 4);
  });

  it('accumulates costs within the same stage', () => {
    const records = [
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 0, stage: 'analysis' }),
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 0, stage: 'analysis' }),
    ];
    const result = estimateCost(records);

    expect(result.costByStage.analysis).toBeCloseTo(0.15, 4); // 2 * 0.075
    expect(result.costByStage.fallback).toBe(0);
  });

  it('separates Flash and Pro costs correctly', () => {
    const records = [
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 0, stage: 'analysis' }),
      makeRecord({ model: 'gemini-2.5-pro', inputTokens: 1_000_000, outputTokens: 0, stage: 'analysis' }),
    ];
    const result = estimateCost(records);

    expect(result.flashCost).toBeCloseTo(0.075, 4);
    expect(result.proCost).toBeCloseTo(1.25, 4);
    expect(result.totalCost).toBeCloseTo(0.075 + 1.25, 4);
    expect(result.costByStage.analysis).toBeCloseTo(0.075 + 1.25, 4);
  });

  it('maintains precision with many small records', () => {
    // 100 records of 10 tokens each = 1000 total tokens
    const records = Array.from({ length: 100 }, () =>
      makeRecord({ model: 'gemini-2.5-flash', inputTokens: 10, outputTokens: 10, stage: 'analysis' })
    );
    const result = estimateCost(records);

    // 100 * (10/1M * 0.075 + 10/1M * 0.30) = 100 * (0.00000075 + 0.000003) = 100 * 0.00000375 = 0.000375
    expect(result.totalCost).toBeCloseTo(0.000375, 8);
  });

  it('throws on non-array input', () => {
    expect(() => estimateCost(null as unknown as TokenUsageRecord[]))
      .toThrow(CostEstimationError);
  });
});
