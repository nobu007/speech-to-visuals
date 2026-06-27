/**
 * Tests for the running-average bug fix in EnhancedErrorRecovery.
 *
 * Bug: updateResponseTimeMetrics used `(avg + value) / 2` which gives each new
 * observation 50% weight regardless of how many have been seen, causing a
 * geometric decay that over-weights the most recent request.
 *
 * Fix: Welford's incremental mean — avg += (value - avg) / count
 */
import { EnhancedErrorRecovery } from '../enhanced-error-recovery';

describe('EnhancedErrorRecovery running-average fix', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  afterEach(async () => {
    await recovery.shutdown();
  });

  /** Cast to access private members for white-box testing */
  function internals(rec: EnhancedErrorRecovery) {
    return rec as unknown as {
      loadMetrics: Array<{
        averageResponseTime: number;
        responseTimeCount: number;
        timestamp: number;
      }>;
      updateResponseTimeMetrics: (t: number) => void;
      updateLoadMetrics: () => void;
    };
  }

  describe('updateResponseTimeMetrics incremental mean', () => {
    test('single observation sets average to that value', () => {
      const i = internals(recovery);
      i.updateLoadMetrics(); // create a LoadMetrics entry

      i.updateResponseTimeMetrics(100);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBe(100);
      expect(latest.responseTimeCount).toBe(1);
    });

    test('two observations produce correct arithmetic mean', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      i.updateResponseTimeMetrics(100);
      i.updateResponseTimeMetrics(200);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      // Correct mean of [100, 200] = 150
      expect(latest.averageResponseTime).toBe(150);
      expect(latest.responseTimeCount).toBe(2);
    });

    test('five observations produce correct arithmetic mean', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      // Values: 10, 20, 30, 40, 50 → mean = 30
      for (const v of [10, 20, 30, 40, 50]) {
        i.updateResponseTimeMetrics(v);
      }

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBe(30);
      expect(latest.responseTimeCount).toBe(5);
    });

    test('old formula would give different (wrong) result for 5 values', () => {
      // This test documents WHY the fix matters.
      // Old formula: avg = (avg + value) / 2
      // Values: [10, 20, 30, 40, 50]
      let oldAvg = 0;
      for (const v of [10, 20, 30, 40, 50]) {
        oldAvg = (oldAvg + v) / 2;
      }
      // Old formula result: sequential halves
      // (0+10)/2=5, (5+20)/2=12.5, (12.5+30)/2=21.25, (21.25+40)/2=30.625, (30.625+50)/2=40.3125
      expect(oldAvg).not.toBe(30); // Wrong! Should be 30
      expect(oldAvg).toBeCloseTo(40.3125, 4);

      // Now verify our fix produces the correct mean
      const i = internals(recovery);
      i.updateLoadMetrics();
      for (const v of [10, 20, 30, 40, 50]) {
        i.updateResponseTimeMetrics(v);
      }
      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBe(30); // Correct arithmetic mean
    });

    test('each observation gets equal weight (10 values)', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      // 10 identical values → mean should be exactly that value
      for (let n = 0; n < 10; n++) {
        i.updateResponseTimeMetrics(50);
      }
      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBe(50);
      expect(latest.responseTimeCount).toBe(10);
    });

    test('large number of observations stays accurate', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      // 100 values: 1 through 100 → mean = 50.5
      for (let v = 1; v <= 100; v++) {
        i.updateResponseTimeMetrics(v);
      }
      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBeCloseTo(50.5, 5);
      expect(latest.responseTimeCount).toBe(100);
    });

    test('zero response time handled correctly', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      i.updateResponseTimeMetrics(0);
      i.updateResponseTimeMetrics(0);
      i.updateResponseTimeMetrics(100);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.averageResponseTime).toBeCloseTo(33.333, 2);
      expect(latest.responseTimeCount).toBe(3);
    });

    test('no-op when loadMetrics is empty', () => {
      const i = internals(recovery);
      // Don't create any entries
      expect(i.loadMetrics).toHaveLength(0);

      // Should not throw
      i.updateResponseTimeMetrics(100);

      // Still empty — no entry to update
      expect(i.loadMetrics).toHaveLength(0);
    });
  });

  describe('NaN/Infinity rejection in updateResponseTimeMetrics', () => {
    /** Helper: inject a valid value first, then the rejected value, verify no corruption */
    function setupWithValidValue() {
      const i = internals(recovery);
      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(100);
      return i;
    }

    test('NaN is rejected — count stays 1, average stays 100', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(NaN);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBe(100);
    });

    test('Infinity is rejected — count stays 1, average stays 100', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(Infinity);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBe(100);
    });

    test('-Infinity is rejected — count stays 1, average stays 100', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(-Infinity);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBe(100);
    });

    test('negative finite value is rejected — count stays 1, average stays 100', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(-50);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBe(100);
    });

    test('NaN followed by valid value — valid value is accepted normally', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(NaN);   // rejected
      i.updateResponseTimeMetrics(200);   // accepted

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(2);
      // Welford: 100 + (200 - 100) / 2 = 150
      expect(latest.averageResponseTime).toBe(150);
    });

    test('all four bad values in sequence leave state untouched', () => {
      const i = setupWithValidValue();

      i.updateResponseTimeMetrics(NaN);
      i.updateResponseTimeMetrics(Infinity);
      i.updateResponseTimeMetrics(-Infinity);
      i.updateResponseTimeMetrics(-1);

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBe(100);
    });
  });

  describe('getResilienceMetrics downstream finiteness guard', () => {
    /** Extended internals to access getResilienceMetrics dependencies */
    function internalsWithResilience(rec: EnhancedErrorRecovery) {
      return rec as unknown as {
        loadMetrics: Array<{
          averageResponseTime: number;
          responseTimeCount: number;
          timestamp: number;
        }>;
        updateResponseTimeMetrics: (t: number) => void;
        updateLoadMetrics: () => void;
      };
    }

    test('resilience metrics are finite when all loadMetrics are valid', () => {
      const i = internalsWithResilience(recovery);
      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(100);
      i.updateResponseTimeMetrics(200);

      const r = recovery.getResilienceMetrics();
      expect(Number.isFinite(r.errorRecoverySpeed)).toBe(true);
      expect(Number.isFinite(r.overallResilience)).toBe(true);
      expect(r.errorRecoverySpeed).toBeGreaterThanOrEqual(0);
      expect(r.errorRecoverySpeed).toBeLessThanOrEqual(1);
    });

    test('resilience metrics are finite with NaN-corrupted loadMetrics entry', () => {
      const i = internalsWithResilience(recovery);
      i.updateLoadMetrics();
      // Manually inject corrupted data (bypassing the guard)
      i.loadMetrics[0].averageResponseTime = NaN;

      const r = recovery.getResilienceMetrics();
      expect(Number.isFinite(r.errorRecoverySpeed)).toBe(true);
      expect(Number.isFinite(r.overallResilience)).toBe(true);
    });

    test('resilience metrics are finite with Infinity-corrupted loadMetrics entry', () => {
      const i = internalsWithResilience(recovery);
      i.updateLoadMetrics();
      i.loadMetrics[0].averageResponseTime = Infinity;

      const r = recovery.getResilienceMetrics();
      expect(Number.isFinite(r.errorRecoverySpeed)).toBe(true);
      expect(Number.isFinite(r.overallResilience)).toBe(true);
    });

    test('resilience metrics are finite with mixed valid and corrupted entries', () => {
      const i = internalsWithResilience(recovery);
      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(100);  // valid
      i.loadMetrics[0].averageResponseTime = NaN;

      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(200);  // valid in a new entry
      // Now: entry[0] has NaN average, entry[1] has 200

      const r = recovery.getResilienceMetrics();
      expect(Number.isFinite(r.errorRecoverySpeed)).toBe(true);
      expect(Number.isFinite(r.overallResilience)).toBe(true);
      // The NaN entry should be filtered out; avg from entry[1] only
      const details = r.details as { avgResponseTime: number };
      expect(details.avgResponseTime).toBe(200);
    });

    test('all entries corrupted → defaults to 0 response time (recovery speed = 1)', () => {
      const i = internalsWithResilience(recovery);
      i.updateLoadMetrics();
      i.updateLoadMetrics();
      i.loadMetrics[0].averageResponseTime = NaN;
      i.loadMetrics[1].averageResponseTime = Infinity;

      const r = recovery.getResilienceMetrics();
      expect(Number.isFinite(r.errorRecoverySpeed)).toBe(true);
      // No valid metrics → avgResponseTime = 0 → recovery speed = 1.0
      expect(r.errorRecoverySpeed).toBe(1);
    });
  });

  describe('getErrorSnapshot exposes responseTimeCount', () => {
    test('snapshot includes responseTimeCount in loadMetrics', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(42);

      const snapshot = recovery.getErrorSnapshot();
      expect(snapshot.loadMetrics).toHaveLength(1);
      expect(snapshot.loadMetrics[0].responseTimeCount).toBe(1);
      expect(snapshot.loadMetrics[0].averageResponseTime).toBe(42);
    });
  });

  describe('executeWithLoadBalancing integration', () => {
    test('successful operation updates response time metrics', async () => {
      const i = internals(recovery);
      i.updateLoadMetrics(); // Create initial entry

      await recovery.executeWithLoadBalancing(
        'test-req-1',
        async () => 'result',
        'analysis',
        5,
      );

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(1);
      expect(latest.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    test('multiple operations accumulate into correct running average', async () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      // Execute 3 quick operations
      for (let n = 0; n < 3; n++) {
        await recovery.executeWithLoadBalancing(
          `test-req-${n}`,
          async () => n,
          'analysis',
          5,
        );
      }

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      // Each response time is ~0.x ms; verify count tracked correctly
      expect(latest.responseTimeCount).toBe(3);
      // Average should be positive and finite
      expect(latest.averageResponseTime).toBeGreaterThan(0);
      expect(Number.isFinite(latest.averageResponseTime)).toBe(true);
    });

    test('failed operation still records response time', async () => {
      const i = internals(recovery);
      i.updateLoadMetrics();

      await expect(
        recovery.executeWithLoadBalancing(
          'test-fail',
          async () => { throw new Error('boom'); },
          'analysis',
          5,
        ),
      ).rejects.toThrow('boom');

      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      // finally block still runs updateResponseTimeMetrics
      expect(latest.responseTimeCount).toBe(1);
    });
  });

  describe('LoadMetrics entry lifecycle', () => {
    test('updateLoadMetrics creates entry with responseTimeCount=0', () => {
      const i = internals(recovery);

      expect(i.loadMetrics).toHaveLength(0);
      i.updateLoadMetrics();

      expect(i.loadMetrics).toHaveLength(1);
      expect(i.loadMetrics[0].responseTimeCount).toBe(0);
    });

    test('new updateLoadMetrics entry resets count for new period', () => {
      const i = internals(recovery);
      i.updateLoadMetrics();
      i.updateResponseTimeMetrics(100);
      i.updateResponseTimeMetrics(200);
      // count=2, avg=150

      i.updateLoadMetrics(); // new entry
      const latest = i.loadMetrics[i.loadMetrics.length - 1];
      expect(latest.responseTimeCount).toBe(0);

      // First observation in new period should set avg to its value
      i.updateResponseTimeMetrics(300);
      expect(latest.averageResponseTime).toBe(300);
      expect(latest.responseTimeCount).toBe(1);
    });

    test('loadMetrics capped at 200 entries', () => {
      const i = internals(recovery);

      for (let n = 0; n < 250; n++) {
        i.updateLoadMetrics();
      }

      expect(i.loadMetrics.length).toBeLessThanOrEqual(200);
    });
  });
});
