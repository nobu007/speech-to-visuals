/**
 * llm-service response-time means — wave-2 safeMean migration oracle
 * (specs/finite-safe-aggregation, sweep-20260815.md sites 724/728/732/795-796).
 *
 * Behavior contract:
 * - finite-only histories: output bitwise-identical to the previous inline
 *   `length > 0 ? reduce((a,b)=>a+b,0) / length : 0` (REQ-004);
 * - non-finite contamination: behavior change (D2) — the poisoned sample is
 *   EXCLUDED and the mean stays finite (previously NaN propagated into
 *   `avgResponseTime` / `getAdaptiveTimeout` inputs and every comparison on
 *   them silently evaluated false);
 * - empty history: 0, exactly as the old ternary.
 */

import { LLMService } from '@/analysis/llm-service';

/** Legacy inline mean replicated as the equivalence baseline (site 724-732). */
const legacyMean = (a: number[]): number =>
  a.length > 0 ? a.reduce((x, y) => x + y, 0) / a.length : 0;

function serviceWithHistory(responseTimes: number[]): LLMService {
  const service = new LLMService('test-key');
  // CappedArray keeps the field identity — replaceWith is the sanctioned
  // bulk-reset path (see capped-array.ts), not a reassignment.
  (service as unknown as {
    responseTimeHistory: { replaceWith(items: number[]): unknown };
  }).responseTimeHistory.replaceWith(responseTimes);
  return service;
}

describe('getStats performance.avgResponseTime (site 732)', () => {
  // getStats publishes Math.round(mean); the equivalence baseline rounds the
  // legacy inline form identically.
  const legacyRounded = (history: number[]): number => Math.round(legacyMean(history));

  test.each([
    [[100, 200, 300]],
    [[]],
    [[100.7, -0.5, 1e12, 0.1]],
  ])('finite history %j matches the legacy inline mean (post-round)', (history) => {
    const stats = serviceWithHistory(history).getStats();
    expect(Object.is(stats.performance.avgResponseTime, legacyRounded(history))).toBe(true);
  });

  test('NaN-contaminated history: mean is finite and excludes the poisoned sample', () => {
    // behavior change: legacy inline form returned NaN → Math.round(NaN)=NaN.
    expect(serviceWithHistory([100, NaN, 200]).getStats().performance.avgResponseTime).toBe(150);
  });

  test('Infinity-contaminated history: mean is finite', () => {
    expect(
      Number.isFinite(serviceWithHistory([Infinity, 100, 200]).getStats().performance.avgResponseTime),
    ).toBe(true);
  });
});

describe('calculateTimeSavings (sites 795-796, via modelMetrics means)', () => {
  type ModelMetrics = {
    flashRequests: number;
    flashResponseTimes: { replaceWith(items: number[]): unknown };
    proResponseTimes: { replaceWith(items: number[]): unknown };
  };

  function serviceWithModelMetrics(flash: number[], pro: number[]): string {
    const service = new LLMService('test-key') as unknown as {
      modelMetrics: ModelMetrics;
      calculateTimeSavings(): string;
    };
    service.modelMetrics.flashResponseTimes.replaceWith(flash);
    service.modelMetrics.proResponseTimes.replaceWith(pro);
    (service.modelMetrics as { flashRequests: number }).flashRequests = flash.length;
    return service.calculateTimeSavings();
  }

  test('finite sample: Flash-faster savings string is produced (legacy-equivalent path)', () => {
    // flash avg 100ms vs pro avg 500ms, 2 flash requests → 0.8s saved.
    expect(serviceWithModelMetrics([100, 100], [500, 500])).toBe('0.8s (80.0% reduction)');
  });

  test('NaN-contaminated pro times: savings string stays numeric (was "NaNs (NaN% reduction)")', () => {
    // behavior change: legacy inline mean returned NaN → "NaNs (NaN% reduction)".
    const out = serviceWithModelMetrics([100, 100], [NaN, 500, 500]);
    expect(out).not.toMatch(/NaN/);
    expect(Number.isFinite(parseFloat(out))).toBe(true);
  });
});
