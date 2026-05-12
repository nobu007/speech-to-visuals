/**
 * TASK-0144: LLM Cost & Token Usage Monitoring Tests (REQ-098)
 *
 * Covers:
 *  1. Token usage recording accuracy
 *  2. Cost estimation correctness (Flash/Pro pricing)
 *  3. Budget alert threshold firing
 *  4. Stage-level cost breakdown
 *  5. Token limit per-request warnings
 *  6. PerformanceDashboard cost metrics integration
 */

import { TokenUsageTracker } from '@/analysis/token-usage-tracker';
import { calculateModelCost, estimateCost } from '@/analysis/cost-estimator';
import { BudgetAlertSystem } from '@/analysis/budget-alert';

// ---------------------------------------------------------------------------
// Test 1: Token usage recording is accurate
// ---------------------------------------------------------------------------
describe('TASK-0144: Token Usage Tracker', () => {
  it('records input/output tokens correctly', () => {
    const tracker = new TokenUsageTracker();

    const record = tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 1500,
      outputTokens: 500,
      stage: 'analysis',
    });

    expect(record.inputTokens).toBe(1500);
    expect(record.outputTokens).toBe(500);
    expect(record.totalTokens).toBe(2000);
    expect(record.model).toBe('gemini-2.5-flash');
    expect(record.stage).toBe('analysis');
    expect(record.timestamp).toBeGreaterThan(0);

    const summary = tracker.getSummary();
    expect(summary.totalInputTokens).toBe(1500);
    expect(summary.totalOutputTokens).toBe(500);
    expect(summary.totalTokens).toBe(2000);
    expect(summary.recordCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Token usage per-request limit warning
  // ---------------------------------------------------------------------------
  it('emits warning when per-request token count exceeds limit', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 4096 });

    tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 3000,
      outputTokens: 2500,
      stage: 'fallback',
    });

    const warnings = tracker.getTokenWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].totalTokens).toBe(5500);
    expect(warnings[0].maxTokens).toBe(4096);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Cost estimation is accurate
// ---------------------------------------------------------------------------
describe('TASK-0144: Cost Estimator', () => {
  it('calculates Flash cost correctly for known token counts', () => {
    // Flash: $0.075/M input, $0.30/M output
    // 10K input => 10000/1M * $0.075 = $0.00075
    // 2K output => 2000/1M * $0.30  = $0.00060
    // Total = $0.00135
    const cost = calculateModelCost('gemini-2.5-flash', 10_000, 2_000);
    expect(cost.inputCost).toBeCloseTo(0.00075, 8);
    expect(cost.outputCost).toBeCloseTo(0.00060, 8);
    expect(cost.totalCost).toBeCloseTo(0.00135, 8);
  });

  it('calculates Pro cost correctly', () => {
    // Pro: $1.25/M input, $5.00/M output
    // 1K input => 1000/1M * $1.25 = $0.00125
    // 500 output => 500/1M * $5.00 = $0.00250
    // Total = $0.00375
    const cost = calculateModelCost('gemini-2.5-pro', 1_000, 500);
    expect(cost.inputCost).toBeCloseTo(0.00125, 8);
    expect(cost.outputCost).toBeCloseTo(0.00250, 8);
    expect(cost.totalCost).toBeCloseTo(0.00375, 8);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Budget alert fires at threshold
// ---------------------------------------------------------------------------
describe('TASK-0144: Budget Alert System', () => {
  it('fires alert when session cost reaches threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // Add cost up to 80% of $1.00 = $0.80
    const alerts = budget.addCost(0.80);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('session');
    expect(alerts[0].percentage).toBeCloseTo(0.8, 4);
    expect(alerts[0].currentCost).toBeCloseTo(0.80, 4);
  });

  it('does not fire alert below threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.50);
    expect(alerts).toHaveLength(0);
  });

  it('invokes registered callback on alert', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const received: BudgetAlertSystem[] = [];
    budget.onAlert((alert) => received.push(alert as never));

    budget.addCost(0.80);
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Stage-level cost breakdown
// ---------------------------------------------------------------------------
describe('TASK-0144: Stage-level cost breakdown', () => {
  it('aggregates costs by stage correctly', () => {
    const tracker = new TokenUsageTracker();

    // analysis: Flash 10K input, 2K output => $0.00135
    tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 10_000,
      outputTokens: 2_000,
      stage: 'analysis',
    });

    // fallback: Pro 500 input, 200 output => $0.001625
    tracker.recordTokenUsage({
      model: 'gemini-2.5-pro',
      inputTokens: 500,
      outputTokens: 200,
      stage: 'fallback',
    });

    // cache-warmup: Flash 1K input, 100 output => $0.000105
    tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 1_000,
      outputTokens: 100,
      stage: 'cache-warmup',
    });

    const estimate = estimateCost(tracker.getRecords());

    expect(estimate.costByStage.analysis).toBeCloseTo(0.00135, 8);
    expect(estimate.costByStage.fallback).toBeCloseTo(0.001625, 8);
    expect(estimate.costByStage['cache-warmup']).toBeCloseTo(0.000105, 8);
    expect(estimate.totalCost).toBeCloseTo(0.00135 + 0.001625 + 0.000105, 8);
  });
});

// ---------------------------------------------------------------------------
// Test 6: PerformanceDashboard cost metrics integration
// ---------------------------------------------------------------------------
describe('TASK-0144: PerformanceDashboard cost metrics', () => {
  // We import PerformanceDashboard which internally uses TokenUsageTracker
  // and cost-estimator. We test the integration through getCostMetrics().
  let PerformanceDashboard: typeof import('@/monitoring/performance-dashboard').PerformanceDashboard;

  beforeAll(() => {
    // Dynamically import to avoid side-effects from global instance
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/monitoring/performance-dashboard');
    PerformanceDashboard = mod.PerformanceDashboard;
  });

  it('returns session total, average, and stage breakdown', () => {
    const dashboard = new PerformanceDashboard();

    // Record 3 API calls
    dashboard.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 10_000, outputTokens: 2_000, stage: 'analysis' });
    dashboard.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 500, outputTokens: 200, stage: 'fallback' });
    dashboard.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 1_000, outputTokens: 100, stage: 'cache-warmup' });

    const metrics = dashboard.getCostMetrics();

    const expectedAnalysis = 0.00135;
    const expectedFallback = 0.001625;
    const expectedCacheWarmup = 0.000105;
    const expectedTotal = expectedAnalysis + expectedFallback + expectedCacheWarmup;

    expect(metrics.recordCount).toBe(3);
    expect(metrics.totalInputTokens).toBe(11_500);
    expect(metrics.totalOutputTokens).toBe(2_300);
    expect(metrics.totalCost).toBeCloseTo(expectedTotal, 8);
    expect(metrics.averageCostPerRequest).toBeCloseTo(expectedTotal / 3, 8);
    expect(metrics.costByStage.analysis).toBeCloseTo(expectedAnalysis, 8);
    expect(metrics.costByStage.fallback).toBeCloseTo(expectedFallback, 8);
    expect(metrics.costByStage['cache-warmup']).toBeCloseTo(expectedCacheWarmup, 8);

    dashboard.destroy();
  });
});
