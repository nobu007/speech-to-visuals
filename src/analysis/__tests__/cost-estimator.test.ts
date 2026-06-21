import {
  calculateModelCost,
  estimateCost,
  CostEstimationError,
} from '../cost-estimator';
import type { TokenUsageRecord } from '../token-usage-tracker';

describe('calculateModelCost', () => {
  describe('flash pricing', () => {
    it('calculates cost for flash model', () => {
      const result = calculateModelCost('gemini-2.5-flash', 1_000_000, 1_000_000);
      // $0.075/M input + $0.30/M output
      expect(result.inputCost).toBeCloseTo(0.075, 6);
      expect(result.outputCost).toBeCloseTo(0.30, 6);
      expect(result.totalCost).toBeCloseTo(0.375, 6);
    });

    it('calculates cost for zero tokens', () => {
      const result = calculateModelCost('gemini-2.5-flash', 0, 0);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('calculates cost for small token counts', () => {
      const result = calculateModelCost('gemini-2.5-flash', 1000, 500);
      // 1000/1M * 0.075 = 0.000075
      // 500/1M * 0.30 = 0.00015
      expect(result.inputCost).toBeCloseTo(0.000075, 9);
      expect(result.outputCost).toBeCloseTo(0.00015, 9);
      expect(result.totalCost).toBeCloseTo(0.000225, 9);
    });
  });

  describe('pro pricing', () => {
    it('calculates cost for pro model', () => {
      const result = calculateModelCost('gemini-2.5-pro', 1_000_000, 1_000_000);
      // $1.25/M input + $5.00/M output
      expect(result.inputCost).toBeCloseTo(1.25, 6);
      expect(result.outputCost).toBeCloseTo(5.0, 6);
      expect(result.totalCost).toBeCloseTo(6.25, 6);
    });
  });

  describe('error handling', () => {
    it('throws CostEstimationError for negative inputTokens', () => {
      expect(() => calculateModelCost('gemini-2.5-flash', -1, 100))
        .toThrow(CostEstimationError);
    });

    it('throws CostEstimationError for negative outputTokens', () => {
      expect(() => calculateModelCost('gemini-2.5-flash', 100, -1))
        .toThrow(CostEstimationError);
    });

    it('throws CostEstimationError for NaN inputTokens', () => {
      expect(() => calculateModelCost('gemini-2.5-flash', NaN, 100))
        .toThrow(CostEstimationError);
    });

    it('throws CostEstimationError for Infinity inputTokens', () => {
      expect(() => calculateModelCost('gemini-2.5-flash', Infinity, 100))
        .toThrow(CostEstimationError);
    });

    it('throws CostEstimationError for unknown model', () => {
      expect(() => calculateModelCost('gpt-4' as never, 100, 100))
        .toThrow(CostEstimationError);
    });

    it('includes context in error', () => {
      try {
        calculateModelCost('gemini-2.5-flash', -1, 100);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CostEstimationError);
        expect((e as CostEstimationError).context).toBeDefined();
        expect((e as CostEstimationError).context!.inputTokens).toBe(-1);
      }
    });
  });
});

describe('estimateCost', () => {
  function makeRecord(
    model: TokenUsageRecord['model'],
    inputTokens: number,
    outputTokens: number,
    stage: TokenUsageRecord['stage'],
  ): TokenUsageRecord {
    return {
      requestId: `req_${Math.random()}`,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      timestamp: Date.now(),
      stage,
    };
  }

  it('returns zero costs for empty records', () => {
    const result = estimateCost([]);
    expect(result.flashCost).toBe(0);
    expect(result.proCost).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.costByStage.analysis).toBe(0);
    expect(result.costByStage.fallback).toBe(0);
    expect(result.costByStage['cache-warmup']).toBe(0);
  });

  it('aggregates flash and pro costs separately', () => {
    const records = [
      makeRecord('gemini-2.5-flash', 1_000_000, 500_000, 'analysis'),
      makeRecord('gemini-2.5-pro', 500_000, 200_000, 'fallback'),
    ];
    const result = estimateCost(records);

    // Flash: 1M*0.075/M + 0.5M*0.30/M = 0.075 + 0.15 = 0.225
    expect(result.flashCost).toBeCloseTo(0.225, 6);
    // Pro: 0.5M*1.25/M + 0.2M*5.00/M = 0.625 + 1.0 = 1.625
    expect(result.proCost).toBeCloseTo(1.625, 6);
    expect(result.totalCost).toBeCloseTo(1.85, 6);
  });

  it('groups costs by stage', () => {
    const records = [
      makeRecord('gemini-2.5-flash', 1_000_000, 0, 'analysis'),
      makeRecord('gemini-2.5-flash', 500_000, 0, 'analysis'),
      makeRecord('gemini-2.5-pro', 1_000_000, 0, 'fallback'),
      makeRecord('gemini-2.5-flash', 200_000, 0, 'cache-warmup'),
    ];
    const result = estimateCost(records);

    // analysis: flash 1M*0.075 + 0.5M*0.075 = 0.075 + 0.0375
    expect(result.costByStage.analysis).toBeCloseTo(0.1125, 6);
    // fallback: pro 1M*1.25
    expect(result.costByStage.fallback).toBeCloseTo(1.25, 6);
    // cache-warmup: flash 0.2M*0.075
    expect(result.costByStage['cache-warmup']).toBeCloseTo(0.015, 6);
  });

  it('throws CostEstimationError for non-array input', () => {
    expect(() => estimateCost('not array' as unknown as TokenUsageRecord[]))
      .toThrow(CostEstimationError);
  });

  it('handles multiple records for same model and stage', () => {
    const records = [
      makeRecord('gemini-2.5-flash', 100_000, 50_000, 'analysis'),
      makeRecord('gemini-2.5-flash', 200_000, 100_000, 'analysis'),
    ];
    const result = estimateCost(records);
    // Both records are flash analysis
    // Total input: 300K * 0.075/M = 0.0225
    // Total output: 150K * 0.30/M = 0.045
    expect(result.flashCost).toBeCloseTo(0.0675, 6);
    expect(result.costByStage.analysis).toBeCloseTo(0.0675, 6);
  });
});
