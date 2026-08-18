/**
 * enhanced-error-recovery interface-value means + error-recovery-health-tracker
 * avgRecovery — round-19 safeMean migration oracle (specs/finite-safe-aggregation
 * TASK-0010).
 *
 * Sites (sweep-20260815.md declared 355-357/420/471/821 as "wave-5
 * opportunistic" migrations that were never executed; health-tracker 215 was
 * never covered by its r18 exclusion reason, which only lists the internally
 * generated deltas):
 *
 *   355  avgResponseTime    = currentMetrics.reduce(...m.averageResponseTime)/n
 *   356  avgErrorRate       = currentMetrics.reduce(...m.errorRate)/n
 *   357  avgMemoryPressure  = currentMetrics.reduce(...m.memoryPressure)/n
 *   420  requestStats.avgResponseTime = recentMetrics.reduce(...)/n
 *   471  calculateAverageResponseTime: filter(finite && >=0) then reduce/n
 *   821  errorRecoverySpeed block:     filter(finite && >=0) then ternary mean
 *   ht215 avgRecovery = samples.reduce((a,s) => a+s.recoverySuccessRate)/n
 *
 * behavior change (non-finite sample only): the poisoned sample is EXCLUDED
 * (D2) instead of collapsing the mean to NaN. The in-file split this closes:
 * calculateAverageResponseTime and the errorRecoverySpeed block already
 * pre-filtered the SAME loadMetrics.averageResponseTime field, while 355-357
 * and 420 read sibling fields of the same records with a raw fold.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMean } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';
import { EnhancedErrorRecovery } from '@/quality/enhanced-error-recovery';
import { ErrorRecoveryHealthTracker } from '@/quality/error-recovery-health-tracker';

const here = path.dirname(fileURLToPath(import.meta.url));
const recoverySource = readFileSync(
  path.join(here, '../../src/quality/enhanced-error-recovery.ts'),
  'utf8',
);
const trackerSource = readFileSync(
  path.join(here, '../../src/quality/error-recovery-health-tracker.ts'),
  'utf8',
);

/** Legacy raw-fold mean, replicated (sites 355-357, 420, ht215). */
const legacyRawMean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** Legacy valid-entry filter, replicated (sites 471/821 pre-filter). */
const legacyValid = (values: number[]): number[] =>
  values.filter((v) => Number.isFinite(v) && v >= 0);

// ---------------------------------------------------------------------------
// Numeric-delta oracle: finite inputs are value-identical to the legacy folds
// ---------------------------------------------------------------------------

describe('sites 355-357/420: raw means over loadMetrics fields', () => {
  test('finite samples: safeMean(map(field)) === legacy fold (300 seeded cases x 3 fields)', () => {
    const rng = createLayoutRng('round19|loadmetrics-means');
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rng() * 10);
      const averageResponseTime = Array.from({ length: n }, () => 5 + rng() * 8000);
      const errorRate = Array.from({ length: n }, () => rng());
      const memoryPressure = Array.from({ length: n }, () => rng());

      // slice(-5) / slice(-10) only change WHICH entries are averaged, not the
      // formula — compare the formula on the full arrays.
      expect(safeMean(averageResponseTime)).toBe(legacyRawMean(averageResponseTime));
      expect(safeMean(errorRate)).toBe(legacyRawMean(errorRate));
      expect(safeMean(memoryPressure)).toBe(legacyRawMean(memoryPressure));
    }
  });

  test('one poisoned entry: excluded instead of NaN (behavior change)', () => {
    const responseTimes = [1200, NaN, 3000];
    // Legacy adjustDynamicCapacity computed avgResponseTime = NaN here, and
    // NaN then flowed into the capacity health score.
    expect(safeMean(responseTimes)).toBe(2100);
    expect(safeMean([NaN, Infinity, 0.4])).toBe(0.4);
    // All-poisoned → fallback 0 (the legacy shape had no such case: it was NaN).
    expect(safeMean([NaN, Infinity])).toBe(0);
  });
});

describe('sites 471/821: pre-filtered means keep the >=0 validity filter', () => {
  test('finite valid entries: safeMean(valid) === legacy fold over the filter output', () => {
    const rng = createLayoutRng('round19|filtered-means');
    for (let i = 0; i < 300; i++) {
      const raw = Array.from({ length: 1 + Math.floor(rng() * 12) }, () => rng() * 9000);
      const valid = legacyValid(raw);
      if (valid.length === 0) {
        expect(safeMean(valid)).toBe(0); // legacy ternary's else branch
      } else {
        expect(safeMean(valid)).toBe(legacyRawMean(valid));
      }
    }
  });

  test('the negative-rejection semantic survives: -1 entries are still dropped', () => {
    // The `>= 0` filter is a validity rule, NOT finiteness — safeMean must not
    // widen it back open.
    const raw = [100, -50, 300];
    const valid = legacyValid(raw);
    expect(safeMean(valid)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Behavioral oracle: health tracker score stays finite on a poisoned report
// ---------------------------------------------------------------------------

/**
 * Minimal duck-typed EnhancedErrorRecovery exposing only what `sample()`
 * reads. recoverySuccessRate is `report.summary.recoverySuccessRate` — an
 * interface value crossing from the recovery system into the tracker.
 */
function fakeRecovery(recoverySuccessRate: number): EnhancedErrorRecovery {
  return {
    getErrorSnapshot: () => ({
      capturedAt: 1_770_000_000_000,
      resilience: { overallResilience: 0.9 },
      analytics: { errorsByStage: { transcription: 2, rendering: 0 } },
      dynamicCapacity: 10,
      queuedRequestCount: 0,
      circuitBreakers: {},
    }),
    exportErrorReport: () => ({
      summary: { openCircuitBreakers: [], recoverySuccessRate },
    }),
  } as unknown as EnhancedErrorRecovery;
}

describe('health-tracker site 215: avgRecovery over report.summary.recoverySuccessRate', () => {
  test('finite rate: recoveryScore enters the stage score unchanged', () => {
    const tracker = new ErrorRecoveryHealthTracker(fakeRecovery(0.9));
    const assessment = tracker.sample();
    expect(assessment.stageScores.length).toBeGreaterThan(0);
    for (const s of assessment.stageScores) {
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    expect(Number.isFinite(assessment.overallScore)).toBe(true);
  });

  test('poisoned rate: stage scores stay finite (was NaN → false-y gates)', () => {
    const tracker = new ErrorRecoveryHealthTracker(fakeRecovery(NaN));
    const assessment = tracker.sample();
    // Legacy: avgRecovery = NaN → score = NaN * 0.4 + ... = NaN, published via
    // roundTo(NaN) = NaN, and every `score < degradationThreshold` comparison
    // then evaluated false — a degraded stage silently passed as healthy.
    for (const s of assessment.stageScores) {
      expect(Number.isFinite(s.score)).toBe(true);
    }
    expect(Number.isFinite(assessment.overallScore)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source anchors: the legacy expressions stay migrated
// ---------------------------------------------------------------------------

describe('source anchor: legacy folds are gone, safeMean delegates remain', () => {
  test('enhanced-error-recovery.ts', () => {
    expect(recoverySource).not.toMatch(
      /currentMetrics\.reduce\(\(sum, m\) => sum \+ m\.(averageResponseTime|errorRate|memoryPressure), 0\)/,
    );
    expect(recoverySource).not.toMatch(
      /requestStats\.avgResponseTime = recentMetrics\.reduce/,
    );
    expect(recoverySource).not.toMatch(
      /recentMetrics\.reduce\(\(sum, m\) => sum \+ m\.averageResponseTime, 0\)/,
    );
    expect(recoverySource).toMatch(
      /safeMean\(currentMetrics\.map\(\(m\) => m\.averageResponseTime\)\)/,
    );
    expect(recoverySource).toMatch(
      /safeMean\(currentMetrics\.map\(\(m\) => m\.errorRate\)\)/,
    );
    expect(recoverySource).toMatch(
      /safeMean\(currentMetrics\.map\(\(m\) => m\.memoryPressure\)\)/,
    );
    // Sites 420, 471 and 821 all delegate through the same map expression
    // (calculateAverageResponseTime also names its slice `recentMetrics`).
    expect(recoverySource.match(/safeMean\(recentMetrics\.map\(\(m\) => m\.averageResponseTime\)\)/g)?.length).toBe(3);
  });

  test('error-recovery-health-tracker.ts', () => {
    expect(trackerSource).not.toMatch(
      /this\.samples\.reduce\(\(a, s\) => a \+ s\.recoverySuccessRate, 0\)/,
    );
    expect(trackerSource).toMatch(/safeMean\(\s*this\.samples\.map\(\(s\) => s\.recoverySuccessRate\),?\s*\)/);
  });
});
