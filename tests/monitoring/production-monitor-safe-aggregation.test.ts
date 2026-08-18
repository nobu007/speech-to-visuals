/**
 * production-monitor aggregation — round-19 safeMean + computePercentiles
 * migration oracle (specs/finite-safe-aggregation TASK-0010).
 *
 * The monitoring continent was never triaged by the round-18 sweep (its
 * discovery rule roots are src/analysis|quality|export). Three defects found:
 *
 *   1. updateAggregateMetrics mean was a raw fold over caller-supplied
 *      latencies (recordSuccess is a public API): one NaN made
 *      averageProcessingTime NaN.
 *   2. The p95/p99 were the LAST hand-rolled floor-rank percentile twin —
 *      every other collector delegates to computePercentiles — and the inline
 *      shape had drifted from the canonical one: no index clamp, plus a
 *      `sorted[p95Index] || 0` falsy fallback that coerced a NaN percentile
 *      to a fast-looking 0.
 *   3. The per-component incremental mean divided by `successes` and folded
 *      the raw latency: one non-finite latency poisoned
 *      componentMetrics.averageLatency PERMANENTLY (NaN * n = NaN — the
 *      running mean never recovers, even after later finite samples).
 *
 * Finite inputs are value-identical everywhere (fuzz + exact parity below);
 * non-finite inputs are excluded (D2) instead of poisoning.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computePercentiles, safeMean } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';
import { ProductionMonitor } from '@/monitoring/production-monitor';

const monitorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/monitoring/production-monitor.ts'),
  'utf8',
);

/** Legacy raw-fold mean, replicated. */
const legacyMean = (values: number[]): number =>
  values.reduce((a, b) => a + b, 0) / values.length;

/** Legacy hand-rolled floor-rank percentile with `|| 0`, replicated. */
const legacyFloorRank = (sorted: number[], fraction: number): number =>
  sorted[Math.floor(sorted.length * fraction)] || 0;

/** Canonical floor-rank percentile over an unsorted sample, as migrated. */
const migratedPercentiles = (sample: number[]) => {
  const sorted = sample.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  return computePercentiles(sorted);
};

// ---------------------------------------------------------------------------
// Numeric-delta oracle: finite samples are value-identical
// ---------------------------------------------------------------------------

describe('finite samples: migrated aggregation === legacy expressions', () => {
  test('mean + p95/p99 identical on 300 seeded latency samples (incl. 0 and negatives)', () => {
    const rng = createLayoutRng('round19|production-monitor-parity');
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rng() * 40);
      const sample = Array.from({ length: n }, () => Math.floor(rng() * 90_000) - 500);
      const sorted = [...sample].sort((a, b) => a - b);

      expect(safeMean(sample)).toBe(legacyMean(sample));
      const canonical = computePercentiles(sorted);
      expect(canonical.p95).toBe(legacyFloorRank(sorted, 0.95));
      expect(canonical.p99).toBe(legacyFloorRank(sorted, 0.99));
      // floor(n·f) ≤ n−1 for every fraction < 1, so the canonical clamp the
      // inline form lacked never binds on finite samples.
      expect(migratedPercentiles(sample).p95).toBe(canonical.p95);
    }
  });

  test('empty finite subset: percentiles fall back to 0 like the legacy `|| 0` shape', () => {
    expect(migratedPercentiles([NaN, Infinity]).p95).toBe(0);
    expect(migratedPercentiles([NaN, Infinity]).p99).toBe(0);
    // mean over an all-poisoned window → fallback 0 (legacy: NaN).
    expect(safeMean([NaN, Infinity])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Behavioral oracle through the public API
// ---------------------------------------------------------------------------

describe('ProductionMonitor.recordSuccess aggregation behavior', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  test('finite latencies: exact parity with the legacy formulas', () => {
    const latencies = [1000, 2500, 4000, 6500, 11000, 30000];
    for (const latency of latencies) {
      monitor.recordSuccess('analysis', latency);
    }
    const m = monitor.getMetrics();
    expect(m.averageProcessingTime).toBe(legacyMean(latencies));
    const sorted = [...latencies].sort((a, b) => a - b);
    expect(m.p95ProcessingTime).toBe(legacyFloorRank(sorted, 0.95));
    expect(m.p99ProcessingTime).toBe(legacyFloorRank(sorted, 0.99));
  });

  test('non-finite latency: aggregates stay finite (was NaN mean / sticky NaN component mean)', () => {
    monitor.recordSuccess('analysis', 1000);
    monitor.recordSuccess('analysis', NaN);
    monitor.recordSuccess('analysis', 3000);
    const m = monitor.getMetrics();

    // Legacy: averageProcessingTime = NaN (raw fold); p95/p99 = NaN||0 = 0
    // (a fast-looking p95); component averageLatency = NaN forever after.
    expect(Number.isFinite(m.averageProcessingTime)).toBe(true);
    expect(m.averageProcessingTime).toBe(2000);
    expect(Number.isFinite(m.p95ProcessingTime)).toBe(true);
    expect(Number.isFinite(m.p99ProcessingTime)).toBe(true);
    // The request still counts — exclusion drops the LATENCY, not the request.
    expect(m.componentMetrics.analysis.requests).toBe(3);
    expect(m.componentMetrics.analysis.successes).toBe(3);
    // Incremental mean over the finite latencies only, and it keeps tracking
    // new finite samples afterwards (the sticky-NaN bug is gone).
    expect(m.componentMetrics.analysis.averageLatency).toBe(2000);
    monitor.recordSuccess('analysis', 4000);
    expect(monitor.getMetrics().componentMetrics.analysis.averageLatency).toBe(
      (2000 * 2 + 4000) / 3,
    );
  });

  test('reset(): the per-component latency counts restart with the metrics', () => {
    monitor.recordSuccess('transcription', 999);
    monitor.reset();
    monitor.recordSuccess('transcription', 2000);
    // If the counts survived the reset, this would be 2000/2 = 1000.
    expect(monitor.getMetrics().componentMetrics.transcription.averageLatency).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Source anchor: the hand-rolled twin stays delegated
// ---------------------------------------------------------------------------

describe('source anchor: production-monitor delegates to the canonical helpers', () => {
  test('hand-rolled floor-rank index arithmetic and raw fold are gone', () => {
    expect(monitorSource).not.toMatch(/Math\.floor\(sorted\.length \* 0\.9/);
    expect(monitorSource).not.toMatch(/sorted\[p95Index\] \|\| 0/);
    expect(monitorSource).not.toMatch(
      /processingTimes\.reduce\(\(a, b\) => a \+ b, 0\)/,
    );
    expect(monitorSource).toMatch(/safeMean\(this\.processingTimes\)/);
    expect(monitorSource).toMatch(/computePercentiles\(sorted\)/);
  });
});
