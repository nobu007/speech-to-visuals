/**
 * Distinct edge-case tests for the NaN/Infinity rejection guard in
 * EnhancedErrorRecovery.updateResponseTimeMetrics.
 *
 * Each invalid input gets its own test so that a future regression to
 * any single guard is independently caught.
 */
import { EnhancedErrorRecovery } from '../enhanced-error-recovery';

describe('EnhancedErrorRecovery NaN/Infinity rejection in updateResponseTimeMetrics', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(async () => {
    await recovery.shutdown();
  });

  function internals(rec: EnhancedErrorRecovery) {
    return rec as unknown as {
      loadMetrics: Array<{
        averageResponseTime: number;
        responseTimeCount: number;
      }>;
      updateResponseTimeMetrics: (t: number) => void;
      updateLoadMetrics: () => void;
    };
  }

  function setup() {
    const i = internals(recovery);
    i.updateLoadMetrics();
    // Seed with a valid value so we can verify the guard doesn't corrupt existing data
    i.updateResponseTimeMetrics(100);
    return i;
  }

  // ── NaN ──────────────────────────────────────────────────────────

  test('NaN is rejected — average stays at seeded value', () => {
    const i = setup();
    i.updateResponseTimeMetrics(NaN);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(100);
    expect(latest.responseTimeCount).toBe(1); // count not incremented
    expect(Number.isFinite(latest.averageResponseTime)).toBe(true);
  });

  test('NaN does not permanently corrupt the running average', () => {
    const i = setup();
    i.updateResponseTimeMetrics(NaN);
    // Subsequent valid values should still work correctly
    i.updateResponseTimeMetrics(200);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    // Welford with values [100, 200] → avg = 150
    expect(latest.averageResponseTime).toBe(150);
    expect(latest.responseTimeCount).toBe(2);
  });

  // ── Infinity ─────────────────────────────────────────────────────

  test('Infinity is rejected — average stays at seeded value', () => {
    const i = setup();
    i.updateResponseTimeMetrics(Infinity);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(100);
    expect(latest.responseTimeCount).toBe(1);
    expect(Number.isFinite(latest.averageResponseTime)).toBe(true);
  });

  test('Infinity does not corrupt subsequent values', () => {
    const i = setup();
    i.updateResponseTimeMetrics(Infinity);
    i.updateResponseTimeMetrics(300);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    // Welford with values [100, 300] → avg = 200
    expect(latest.averageResponseTime).toBe(200);
    expect(latest.responseTimeCount).toBe(2);
  });

  // ── -Infinity ────────────────────────────────────────────────────

  test('-Infinity is rejected — average stays at seeded value', () => {
    const i = setup();
    i.updateResponseTimeMetrics(-Infinity);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(100);
    expect(latest.responseTimeCount).toBe(1);
    expect(Number.isFinite(latest.averageResponseTime)).toBe(true);
  });

  test('-Infinity does not corrupt subsequent values', () => {
    const i = setup();
    i.updateResponseTimeMetrics(-Infinity);
    i.updateResponseTimeMetrics(200);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(150);
    expect(latest.responseTimeCount).toBe(2);
  });

  // ── Negative values ──────────────────────────────────────────────

  test('negative value is rejected — response time cannot be negative', () => {
    const i = setup();
    i.updateResponseTimeMetrics(-50);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(100);
    expect(latest.responseTimeCount).toBe(1);
  });

  test('-0 is accepted (it is finite and not negative)', () => {
    const i = setup();
    i.updateResponseTimeMetrics(-0);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    // -0 is NOT < 0, so it passes the guard
    expect(latest.responseTimeCount).toBe(2);
    // avg = 100 + (-0 - 100) / 2 = 100 - 50 = 50
    expect(latest.averageResponseTime).toBe(50);
  });

  // ── Mixed sequences ──────────────────────────────────────────────

  test('multiple invalid values in sequence are all rejected', () => {
    const i = setup();
    i.updateResponseTimeMetrics(NaN);
    i.updateResponseTimeMetrics(Infinity);
    i.updateResponseTimeMetrics(-Infinity);
    i.updateResponseTimeMetrics(-1);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.averageResponseTime).toBe(100);
    expect(latest.responseTimeCount).toBe(1);
  });

  test('interleaved valid and invalid values accumulate correctly', () => {
    const i = setup(); // seed: 100, count=1
    i.updateResponseTimeMetrics(NaN);     // rejected
    i.updateResponseTimeMetrics(200);     // accepted → count=2, avg=150
    i.updateResponseTimeMetrics(Infinity);// rejected
    i.updateResponseTimeMetrics(300);     // accepted → count=3, avg=200
    i.updateResponseTimeMetrics(-1);      // rejected

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.responseTimeCount).toBe(3);
    // Welford: [100, 200, 300] → mean = 200
    expect(latest.averageResponseTime).toBe(200);
  });

  // ── Edge: first call to a fresh entry ────────────────────────────

  test('NaN as very first observation on a fresh entry is rejected', () => {
    const i = internals(recovery);
    i.updateLoadMetrics();
    // Don't seed — first observation is NaN
    i.updateResponseTimeMetrics(NaN);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.responseTimeCount).toBe(0);
    expect(latest.averageResponseTime).toBe(0); // default value
  });

  test('Infinity as very first observation on a fresh entry is rejected', () => {
    const i = internals(recovery);
    i.updateLoadMetrics();
    i.updateResponseTimeMetrics(Infinity);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.responseTimeCount).toBe(0);
    expect(latest.averageResponseTime).toBe(0);
  });

  test('-Infinity as very first observation on a fresh entry is rejected', () => {
    const i = internals(recovery);
    i.updateLoadMetrics();
    i.updateResponseTimeMetrics(-Infinity);

    const latest = i.loadMetrics[i.loadMetrics.length - 1];
    expect(latest.responseTimeCount).toBe(0);
    expect(latest.averageResponseTime).toBe(0);
  });
});
