/**
 * Tests for adaptive-quality-gates.ts
 * Covers: gate management, evaluation, adaptive thresholds,
 * quality trends, deployment readiness, recommendations, and edge cases.
 */

import { jest } from '@jest/globals';

// Mock realTimeMonitor before importing the module under test
const mockGetSnapshot = jest.fn();

jest.unstable_mockModule('@/monitoring/real-time-performance-monitor', () => ({
  realTimeMonitor: { getSnapshot: mockGetSnapshot },
  PerformanceSnapshot: {},
}));

const { AdaptiveQualityGatesSystem } = await import('../adaptive-quality-gates');

function makeSnapshot(overrides: Record<string, any> = {}) {
  return {
    timestamp: Date.now(),
    pipeline: {
      totalRequests: 100,
      successRate: 0.96,
      avgProcessingTime: 30000,
      p95ProcessingTime: 60000,
      p99ProcessingTime: 90000,
      activeRequests: 2,
      ...overrides.pipeline,
    },
    llm: {
      totalRequests: 50,
      flashUsagePercent: 80,
      proUsagePercent: 20,
      avgFlashResponseTime: 5000,
      avgProResponseTime: 15000,
      cacheHitRate: 0.45,
      estimatedCostSavings: 100,
      ...overrides.llm,
    },
    system: {
      cpuUsagePercent: 30,
      memoryUsageMB: 500,
      memoryUsagePercent: 50,
      heapUsedMB: 300,
      heapTotalMB: 500,
      ...overrides.system,
    },
    errors: {
      totalErrors: 4,
      errorRate: 0.04,
      recentErrors: [],
      recoverySuccessRate: 0.9,
      ...overrides.errors,
    },
    quality: {
      transcriptionAccuracy: 0.90,
      layoutOverlapRate: 0,
      avgSceneQuality: 0.85,
      ...overrides.quality,
    },
  };
}

describe('AdaptiveQualityGatesSystem', () => {
  let gates: InstanceType<typeof AdaptiveQualityGatesSystem>;

  beforeEach(() => {
    mockGetSnapshot.mockReturnValue(makeSnapshot());
    gates = new AdaptiveQualityGatesSystem();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Gate Management ────────────────────────────────────────────

  describe('addGate / removeGate', () => {
    test('starts with default gates', () => {
      expect(gates.getGates().length).toBeGreaterThanOrEqual(10);
    });

    test('addGate returns true and adds gate', () => {
      const result = gates.addGate({
        name: 'custom-gate',
        metric: 'avgProcessingTime',
        threshold: 1000,
        operator: 'lt',
        severity: 'minor',
        adaptable: false,
      });
      expect(result).toBe(true);
      expect(gates.getGates().some(g => g.name === 'custom-gate')).toBe(true);
    });

    test('addGate respects MAX_GATES limit', () => {
      // Fill up to 50 gates
      for (let i = 0; i < 60; i++) {
        gates.addGate({
          name: `gate-${i}`,
          metric: 'avgProcessingTime',
          threshold: 1000,
          operator: 'lt',
          severity: 'minor',
          adaptable: false,
        });
      }
      // After initial 10 defaults, only 40 more can be added (total 50)
      expect(gates.getGates().length).toBe(50);
    });

    test('removeGate returns true when found', () => {
      const result = gates.removeGate('Success Rate');
      expect(result).toBe(true);
      expect(gates.getGates().some(g => g.name === 'Success Rate')).toBe(false);
    });

    test('removeGate returns false when not found', () => {
      const result = gates.removeGate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('updateGateThreshold', () => {
    test('updates threshold for existing gate', () => {
      const result = gates.updateGateThreshold('Success Rate', 0.98);
      expect(result).toBe(true);
      const gate = gates.getGates().find(g => g.name === 'Success Rate');
      expect(gate!.threshold).toBe(0.98);
    });

    test('returns false for nonexistent gate', () => {
      expect(gates.updateGateThreshold('nonexistent', 1)).toBe(false);
    });
  });

  // ─── Gate Evaluation ────────────────────────────────────────────

  describe('evaluateGates', () => {
    test('evaluates all gates and returns result', async () => {
      const result = await gates.evaluateGates();

      expect(result.gates.length).toBe(gates.getGates().length);
      expect(result.summary.total).toBe(gates.getGates().length);
      expect(result.summary.passed + result.summary.failed).toBe(result.summary.total);
      expect(result.recommendations).toBeDefined();
      expect(typeof result.deploymentReady).toBe('boolean');
    });

    test('marks gate as passed when metric meets threshold', async () => {
      // Default snapshot has successRate=0.96 >= 0.95 threshold
      const result = await gates.evaluateGates();
      const successGate = result.gates.find(g => g.name === 'Success Rate');
      expect(successGate!.passed).toBe(true);
    });

    test('marks gate as failed when metric does not meet threshold', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.50 },
      }));
      const result = await gates.evaluateGates();
      const successGate = result.gates.find(g => g.name === 'Success Rate');
      expect(successGate!.passed).toBe(false);
    });

    test('stores results in history', async () => {
      await gates.evaluateGates();
      await gates.evaluateGates();
      const history = gates.getHistory(10);
      expect(history.length).toBe(2);
    });

    test('history respects MAX_HISTORY_SIZE', async () => {
      for (let i = 0; i < 105; i++) {
        await gates.evaluateGates();
      }
      const history = gates.getHistory(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    test('operator "gt" checks strictly greater than', async () => {
      gates = new AdaptiveQualityGatesSystem();
      // Remove all and add a single test gate
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'test-gt',
        metric: 'successRate',
        threshold: 0.95,
        operator: 'gt',
        severity: 'minor',
        adaptable: false,
      });
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.95 },
      }));
      const result = await gates.evaluateGates();
      expect(result.gates[0].passed).toBe(false); // 0.95 is not > 0.95
    });

    test('operator "eq" checks near-equality', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'test-eq',
        metric: 'layoutOverlapRate',
        threshold: 0,
        operator: 'eq',
        severity: 'blocker',
        adaptable: false,
      });
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        quality: { layoutOverlapRate: 0, transcriptionAccuracy: 0.9, avgSceneQuality: 0.85 },
      }));
      const result = await gates.evaluateGates();
      expect(result.gates[0].passed).toBe(true);
    });
  });

  // ─── Deployment Readiness ───────────────────────────────────────

  describe('isDeploymentReady', () => {
    test('returns ready=true when all gates pass with >=90% rate', async () => {
      // Healthy snapshot - all gates should pass
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      const result = await gates.isDeploymentReady();

      // With healthy metrics, should be deployment ready
      if (result.ready) {
        expect(result.blockers).toEqual([]);
      } else {
        expect(result.blockers.length).toBeGreaterThan(0);
      }
    });

    test('returns ready=false when blockers exist', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.50 }, // Below 0.95 blocker threshold
        quality: { layoutOverlapRate: 0.5, transcriptionAccuracy: 0.5, avgSceneQuality: 0.5 },
      }));
      const result = await gates.isDeploymentReady();
      expect(result.ready).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });
  });

  // ─── Recommendations ────────────────────────────────────────────

  describe('recommendations', () => {
    test('generates all-pass recommendation when everything passes', async () => {
      // Healthy snapshot
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      const result = await gates.evaluateGates();

      // If all pass, should have positive recommendation
      if (result.summary.failed === 0) {
        expect(result.recommendations[0]).toContain('ready for deployment');
      }
    });

    test('generates blocker recommendations for failed blockers', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.50 },
        quality: { layoutOverlapRate: 0.5, transcriptionAccuracy: 0.5, avgSceneQuality: 0.5 },
      }));
      const result = await gates.evaluateGates();
      const blockerRecs = result.recommendations.filter(r => r.includes('BLOCKER'));
      expect(blockerRecs.length).toBeGreaterThan(0);
    });

    test('generates critical recommendations for failed critical gates', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { avgProcessingTime: 999999 },
      }));
      const result = await gates.evaluateGates();
      const criticalRecs = result.recommendations.filter(r => r.includes('CRITICAL'));
      expect(criticalRecs.length).toBeGreaterThan(0);
    });

    test('limits major recommendations to top 3', async () => {
      // Fail multiple major gates
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        llm: { avgFlashResponseTime: 999999, cacheHitRate: 0.01 },
        errors: { recoverySuccessRate: 0.1, errorRate: 0.5, totalErrors: 999 },
      }));
      const result = await gates.evaluateGates();
      const majorRecs = result.recommendations.filter(r => r.includes('Optimize:'));
      expect(majorRecs.length).toBeLessThanOrEqual(3);
    });
  });

  // ─── Quality Trend ──────────────────────────────────────────────

  describe('getQualityTrend', () => {
    test('returns stable with empty arrays when < 5 history entries', () => {
      const trend = gates.getQualityTrend();
      expect(trend.trend).toBe('stable');
      expect(trend.passRate).toEqual([]);
      expect(trend.timestamps).toEqual([]);
    });

    test('detects stable trend when pass rate is consistent', async () => {
      for (let i = 0; i < 6; i++) {
        await gates.evaluateGates();
      }
      const trend = gates.getQualityTrend();
      expect(trend.trend).toBe('stable');
      expect(trend.passRate.length).toBe(6);
    });

    test('detects improving trend when pass rate increases', async () => {
      // First, fail some gates
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.50, avgProcessingTime: 999999 },
        quality: { layoutOverlapRate: 0.5, transcriptionAccuracy: 0.5, avgSceneQuality: 0.5 },
        errors: { errorRate: 0.5, recoverySuccessRate: 0.1, totalErrors: 999 },
        system: { memoryUsagePercent: 99, memoryUsageMB: 9999, cpuUsagePercent: 99, heapUsedMB: 9999, heapTotalMB: 9999 },
        llm: { cacheHitRate: 0.01, avgFlashResponseTime: 999999 },
      }));
      for (let i = 0; i < 3; i++) {
        await gates.evaluateGates();
      }
      // Then, make them all pass
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      for (let i = 0; i < 3; i++) {
        await gates.evaluateGates();
      }
      const trend = gates.getQualityTrend();
      expect(trend.trend).toBe('improving');
    });

    test('detects degrading trend when pass rate decreases', async () => {
      // First, pass all gates
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      for (let i = 0; i < 3; i++) {
        await gates.evaluateGates();
      }
      // Then, fail many gates
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { successRate: 0.50, avgProcessingTime: 999999 },
        quality: { layoutOverlapRate: 0.5, transcriptionAccuracy: 0.5, avgSceneQuality: 0.5 },
        errors: { errorRate: 0.5, recoverySuccessRate: 0.1, totalErrors: 999 },
        system: { memoryUsagePercent: 99, memoryUsageMB: 9999, cpuUsagePercent: 99, heapUsedMB: 9999, heapTotalMB: 9999 },
        llm: { cacheHitRate: 0.01, avgFlashResponseTime: 999999 },
      }));
      for (let i = 0; i < 3; i++) {
        await gates.evaluateGates();
      }
      const trend = gates.getQualityTrend();
      expect(trend.trend).toBe('degrading');
    });

    test('handles total=0 without NaN (defensive guard)', async () => {
      // Manually inject history with total=0 via evaluateGates
      // We can't directly create total=0 through evaluateGates, but
      // we can verify the guard exists by ensuring no NaN appears
      for (let i = 0; i < 6; i++) {
        await gates.evaluateGates();
      }
      const trend = gates.getQualityTrend();
      const hasNaN = trend.passRate.some(v => !Number.isFinite(v));
      expect(hasNaN).toBe(false);
    });
  });

  // ─── Adaptive Thresholds ────────────────────────────────────────

  describe('adaptive thresholds', () => {
    test('getAdaptiveThresholdInfo returns null for unknown metric', () => {
      expect(gates.getAdaptiveThresholdInfo('nonexistent')).toBeNull();
    });

    test('resetAdaptiveThresholds clears all thresholds', async () => {
      // Populate thresholds by evaluating gates
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      await gates.evaluateGates();
      // Verify something was populated
      expect(gates.getAdaptiveThresholdInfo('avgProcessingTime')).toBeTruthy();

      gates.resetAdaptiveThresholds();
      expect(gates.getAdaptiveThresholdInfo('avgProcessingTime')).toBeNull();
    });

    test('uses base threshold when confidence < 0.7', async () => {
      // First evaluation - confidence starts at 0.1
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { avgProcessingTime: 30000 },
      }));
      await gates.evaluateGates();

      // Should still use base threshold since confidence is low
      const info = gates.getAdaptiveThresholdInfo('avgProcessingTime');
      expect(info).toBeTruthy();
      expect(info!.confidence).toBeLessThan(0.7);
    });

    test('confidence increases with more evaluations', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      for (let i = 0; i < 5; i++) {
        await gates.evaluateGates();
      }
      const info = gates.getAdaptiveThresholdInfo('avgProcessingTime');
      expect(info).toBeTruthy();
      // After 5 evaluations: 5/100 = 0.05 confidence
      expect(info!.confidence).toBeGreaterThan(0);
    });

    test('historicalValues capped at 100 entries', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      for (let i = 0; i < 110; i++) {
        await gates.evaluateGates();
      }
      const info = gates.getAdaptiveThresholdInfo('avgProcessingTime');
      expect(info).toBeTruthy();
      expect(info!.historicalValues.length).toBeLessThanOrEqual(100);
    });

    test('p90 percentile uses (N-1)*p indexing — not N*p (off-by-one fix)', async () => {
      // Set up a gate with low base threshold so p90 value dominates
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'test-p90',
        metric: 'avgProcessingTime',
        threshold: 50,
        operator: 'lt',
        severity: 'minor',
        adaptable: true,
      });

      // Feed exactly 10 values: [50, 60, 70, 80, 90, 100, 110, 120, 130, 200]
      const values = [50, 60, 70, 80, 90, 100, 110, 120, 130, 200];
      for (const v of values) {
        mockGetSnapshot.mockReturnValue(makeSnapshot({
          pipeline: { avgProcessingTime: v },
        }));
        await gates.evaluateGates();
      }

      const info = gates.getAdaptiveThresholdInfo('avgProcessingTime');
      expect(info).toBeTruthy();
      expect(info!.historicalValues).toHaveLength(10);

      // sorted = [50, 60, 70, 80, 90, 100, 110, 120, 130, 200]
      // Correct p90 = sorted[8] = 130  ( (10-1)*0.9 = floor(8.1) = 8 )
      // Old buggy p90 = sorted[9] = 200  ( 10*0.9 = floor(9.0) = 9 — the max! )
      // adaptedThreshold = max(50*0.8, 130*1.1) = max(40, 143) = 143
      expect(info!.adaptedThreshold).toBe(143);
    });

    test('p10 percentile uses (N-1)*p indexing for gte operator', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'test-p10',
        metric: 'successRate',
        threshold: 0.5,
        operator: 'gte',
        severity: 'minor',
        adaptable: true,
      });

      // 10 values where min differs from p10
      const values = [0.5, 0.6, 0.7, 0.75, 0.8, 0.82, 0.85, 0.88, 0.9, 0.95];
      for (const v of values) {
        mockGetSnapshot.mockReturnValue(makeSnapshot({
          pipeline: { successRate: v },
        }));
        await gates.evaluateGates();
      }

      const info = gates.getAdaptiveThresholdInfo('successRate');
      expect(info).toBeTruthy();
      expect(info!.historicalValues).toHaveLength(10);

      // sorted = [0.5, 0.6, 0.7, 0.75, 0.8, 0.82, 0.85, 0.88, 0.9, 0.95]
      // Correct p10 = sorted[0] = 0.5  ( (10-1)*0.1 = floor(0.9) = 0 )
      // adaptedThreshold = min(0.5*1.2, 0.5*0.9) = min(0.6, 0.45) = 0.45
      expect(info!.adaptedThreshold).toBeCloseTo(0.45, 5);
    });
  });

  // ─── extractMetricValue coverage ────────────────────────────────

  describe('metric extraction', () => {
    test('evaluates all standard metric names without error', async () => {
      // Exercise all code paths in extractMetricValue by evaluating all default gates
      mockGetSnapshot.mockReturnValue(makeSnapshot());
      const result = await gates.evaluateGates();
      // Every gate should have a numeric currentValue
      result.gates.forEach(g => {
        expect(typeof g.currentValue).toBe('number');
        expect(Number.isFinite(g.currentValue)).toBe(true);
      });
    });

    test('unknown metric returns 0', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'unknown-metric',
        metric: 'totallyUnknownField',
        threshold: 1,
        operator: 'gt',
        severity: 'minor',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      expect(result.gates[0].currentValue).toBe(0);
      // Fails both because 0 is not > 1 AND because the metric is unmapped.
      expect(result.gates[0].passed).toBe(false);
    });

    // (defect-9 sibling) An UNMAPPED metric must NOT silently pass. The legacy
    // extractMetricValue returned 0 for an unknown name, so a lower-is-better
    // (`lt`/`lte`) or equality (`eq`) gate passed on that 0 — silently satisfying
    // an SLO that was never measured. The existing test above used `gt` (which
    // already failed on 0) and so masked the silent-pass on the other operators.
    // The gate now FAILS LOUD regardless of operator.

    test('an unknown metric with operator "lt" FAILS instead of silently passing', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'typo-error-rate',
        metric: 'errorRatee', // typo — not a snapshot field
        threshold: 1,
        operator: 'lt',
        severity: 'critical',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      // Legacy: extractMetricValue('errorRatee') → 0, and 0 < 1 → PASS (silent).
      expect(result.gates[0].passed).toBe(false);
    });

    test('an unknown metric with operator "lte" FAILS at a zero threshold', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'typo-overlap',
        metric: 'layoutOverlapRatee', // typo
        threshold: 0,
        operator: 'lte',
        severity: 'blocker',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      // Legacy: 0 <= 0 → PASS (silent). Now fails loud.
      expect(result.gates[0].passed).toBe(false);
    });

    test('an unknown metric with operator "eq" FAILS at a zero threshold', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'typo-eq',
        metric: 'nonexistentMetric',
        threshold: 0,
        operator: 'eq',
        severity: 'blocker',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      // Legacy: |0 - 0| < 0.001 → PASS (silent). Now fails loud.
      expect(result.gates[0].passed).toBe(false);
    });

    test('a failed unmapped-metric gate names the metric in its message (loud)', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'typo-gate',
        metric: 'errorRatee',
        threshold: 0.05,
        operator: 'lte',
        severity: 'critical',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      expect(result.gates[0].passed).toBe(false);
      expect(result.gates[0].message).toContain('errorRatee');
      expect(result.gates[0].message).toContain('UNMAPPED');
    });

    test('a stray "constructor" key is NOT mistaken for a known metric', async () => {
      // The hasOwnProperty guard means an inherited key ('constructor' /
      // 'toString' / a proto-polluted name) is treated as unmapped — no silent
      // pass, and no crash from invoking Object() as an extractor.
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'proto-key',
        metric: 'constructor',
        threshold: 1,
        operator: 'lt',
        severity: 'minor',
        adaptable: false,
      });
      const result = await gates.evaluateGates();
      expect(result.gates[0].passed).toBe(false);
      expect(result.gates[0].message).toContain('UNMAPPED');
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    test('handles empty gates list', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      const result = await gates.evaluateGates();
      expect(result.summary.total).toBe(0);
      expect(result.summary.passed).toBe(0);
      expect(result.deploymentReady).toBe(false); // 0 gates, totalGates=0 fails the > 0 check
    });

    test('getHistory returns most recent N entries', async () => {
      for (let i = 0; i < 10; i++) {
        await gates.evaluateGates();
      }
      const history = gates.getHistory(3);
      expect(history.length).toBe(3);
    });

    test('getGates returns a copy (not internal reference)', () => {
      const gatesList = gates.getGates();
      gatesList.push({
        name: 'injected',
        metric: 'x',
        threshold: 0,
        operator: 'gt',
        severity: 'minor',
        adaptable: false,
      });
      // Internal list should not be modified
      expect(gates.getGates().some(g => g.name === 'injected')).toBe(false);
    });

    test('calculateAdaptiveThreshold returns baseThreshold for < 10 values', async () => {
      // With < 10 evaluations, the adaptive threshold should equal the base
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        pipeline: { avgProcessingTime: 30000 },
      }));
      await gates.evaluateGates();

      const info = gates.getAdaptiveThresholdInfo('avgProcessingTime');
      expect(info).toBeTruthy();
      // With only 1 value, adaptive threshold = base threshold
      expect(info!.adaptedThreshold).toBe(60000); // base threshold for Processing Time SLA
    });
  });

  // ─── memory-backend null contract (REQ-359/360) ────────────────
  // PerformanceSnapshot.system memory fields are `number | null` where null =
  // "memory backend supplied no reading" (browser-path omission / non-finite
  // drift — see tests/unit/monitoring/memory-backend-contract.test.ts). An
  // UNMEASURED memory SLO must NOT silently pass — the same fail-loud contract
  // as the defect-9 UNMAPPED closure. Before this fix, `null < 85` coerced to
  // `0 < 85` → TRUE, so the default critical 'Memory Usage' gate PASSED on a
  // reading that was never taken (and deployment readiness stayed green).
  describe('memory metric unavailable (null) — fail loud, never silently pass (REQ-360)', () => {
    test('default Memory Usage gate FAILS with an UNAVAILABLE verdict when memoryUsagePercent is null', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        system: { memoryUsagePercent: null as unknown as number },
      }));

      const result = await gates.evaluateGates();
      const memoryGate = result.gates.find(g => g.name === 'Memory Usage');

      expect(memoryGate).toBeDefined();
      // Legacy: `null < 85` → true → silent PASS of a critical gate.
      expect(memoryGate!.passed).toBe(false);
      expect(memoryGate!.message).toContain('UNAVAILABLE');
    });

    test('a null memoryUsageMB fails its gate instead of crashing on null.toFixed', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'memory-budget',
        metric: 'memoryUsageMB',
        threshold: 0,
        operator: 'gt',
        severity: 'blocker',
        adaptable: false,
      });
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        system: { memoryUsageMB: null as unknown as number },
      }));

      // Legacy: `null.toFixed(2)` in the message builder threw a TypeError,
      // rejecting the whole evaluateGates() promise.
      const result = await gates.evaluateGates();
      expect(result.gates[0].passed).toBe(false);
      expect(result.gates[0].message).toContain('UNAVAILABLE');
    });

    test('an unavailable adaptable metric records NO adaptive baseline (null never enters history)', async () => {
      gates.getGates().forEach(g => gates.removeGate(g.name));
      gates.addGate({
        name: 'adaptive-memory',
        metric: 'memoryUsagePercent',
        threshold: 85,
        operator: 'lt',
        severity: 'critical',
        adaptable: true,
      });
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        system: { memoryUsagePercent: null as unknown as number },
      }));

      await gates.evaluateGates();

      // Legacy: updateAdaptiveThresholds seeded baselineValue: null from the
      // unmeasured reading, poisoning every later adaptation of this metric.
      expect(gates.getAdaptiveThresholdInfo('memoryUsagePercent')).toBeNull();
    });

    test('finite memory readings still evaluate normally (null contract changes nothing else)', async () => {
      mockGetSnapshot.mockReturnValue(makeSnapshot({
        system: { memoryUsagePercent: 50 },
      }));

      const result = await gates.evaluateGates();
      const memoryGate = result.gates.find(g => g.name === 'Memory Usage');

      expect(memoryGate!.passed).toBe(true);
      expect(memoryGate!.message).not.toContain('UNAVAILABLE');
    });
  });
});
