/**
 * REQ-359: PerformanceSnapshot system memory fields — null propagation.
 *
 * `realTimeMonitor.getSnapshot()` is the root source named by the Phase-166
 * consolidation: its `system` block previously fed raw `getMemoryUsage()`
 * fields into bytesToMb/heapUsagePercent, so a backend that omits (or
 * non-finitely drifts on) heapUsed/heapTotal produced NaN in FOUR snapshot
 * fields (memoryUsageMB / memoryUsagePercent / heapUsedMB / heapTotalMB).
 * Three HealthCheckService layers each guarded that NaN downstream.
 *
 * With the memory-backend boundary (REQ-358), the contract moves INTO the
 * type: those four fields are `number | null`, where null = "the memory
 * backend supplied no reading" — an EXPLICIT unavailability that consumers
 * must acknowledge, never a NaN that silently FALSE-ifies comparisons and
 * never a fabricated 0 that reads as "healthy" to the 70/90 thresholds.
 *
 * The stv-core backend is mocked with unstable_mockModule so the REAL
 * wrapper + monitor code under it are exercised end-to-end.
 */

import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';

const mockGetMemoryUsage = jest.fn();

jest.unstable_mockModule('@stv/core/utils/memory-usage', () => ({
  __esModule: true,
  getMemoryUsage: mockGetMemoryUsage,
}));

let RealTimePerformanceMonitorClass: any;

beforeAll(async () => {
  const mod = await import('../../../src/monitoring/real-time-performance-monitor');
  RealTimePerformanceMonitorClass = mod.RealTimePerformanceMonitor;
});

beforeEach(() => {
  mockGetMemoryUsage.mockReset();
  jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
});

describe('getSnapshot system memory fields — finite-or-null contract (REQ-359)', () => {
  describe('finite backend reading → finite snapshot fields (baseline preserved)', () => {
    test('100MB/200MB heap → 100.00 MB used, 50.00% usage', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 300 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.memoryUsageMB).toBe(100);
      expect(snapshot.system.heapUsedMB).toBe(100);
      expect(snapshot.system.heapTotalMB).toBe(200);
      expect(snapshot.system.memoryUsagePercent).toBeCloseTo(50, 5);
    });

    test('stv-core zero-fallback ({heapUsed: 0, heapTotal: 0}) stays finite zeros', () => {
      mockGetMemoryUsage.mockReturnValue({ heapUsed: 0, heapTotal: 0 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.memoryUsageMB).toBe(0);
      expect(snapshot.system.heapUsedMB).toBe(0);
      expect(snapshot.system.heapTotalMB).toBe(0);
      expect(snapshot.system.memoryUsagePercent).toBe(0);
    });
  });

  describe('backend omits heap fields → all four memory fields are EXPLICIT null', () => {
    test('REQ-347 browser-path shape: heapUsed/heapTotal omitted wholesale', () => {
      // BEFORE REQ-359 this produced NaN×4 (`NaN < 70` FALSE → spurious
      // "critical"; `NaN > 85` FALSE → suppressed CRITICAL escalation).
      mockGetMemoryUsage.mockReturnValue({ rss: 0, external: 0 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.memoryUsageMB).toBeNull();
      expect(snapshot.system.memoryUsagePercent).toBeNull();
      expect(snapshot.system.heapUsedMB).toBeNull();
      expect(snapshot.system.heapTotalMB).toBeNull();
    });

    test('only heapUsed omitted (NaN would previously leak through 3 of 4 fields)', () => {
      mockGetMemoryUsage.mockReturnValue({ heapTotal: 200 * 1024 * 1024 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.memoryUsageMB).toBeNull();
      expect(snapshot.system.memoryUsagePercent).toBeNull();
      expect(snapshot.system.heapUsedMB).toBeNull();
      // heapTotal itself IS available — only the derived-from-missing fields
      // and the missing field itself go null.
      expect(snapshot.system.heapTotalMB).toBe(200);
    });

    test('non-finite backend (NaN drift) → null, not NaN', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: Number.NaN,
        heapTotal: Number.NaN,
      });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.memoryUsageMB).toBeNull();
      expect(snapshot.system.memoryUsagePercent).toBeNull();
      expect(snapshot.system.heapUsedMB).toBeNull();
      expect(snapshot.system.heapTotalMB).toBeNull();
    });
  });

  describe('non-memory snapshot fields are unaffected by the backend omission', () => {
    test('pipeline/llm/errors fields stay finite when memory is unavailable', () => {
      mockGetMemoryUsage.mockReturnValue({});

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.system.cpuUsagePercent).toBe(0); // hardcoded — no backend
      expect(snapshot.pipeline.successRate).toBe(1);
      expect(snapshot.pipeline.activeRequests).toBe(0);
      expect(snapshot.llm.cacheHitRate).toBe(0);
      expect(snapshot.errors.errorRate).toBe(0);
      expect(Number.isFinite(snapshot.timestamp)).toBe(true);
    });
  });

  describe('producer-less quality / LLM-timing fields — null, never fabricated (REQ-364)', () => {
    /**
     * REQ-364: the `quality` trio and the per-model LLM response times have
     * NO producer ("Populated externally" — nothing ever populated them).
     * The snapshot previously FABRICATED `0.90 / 0 / 0.85` and `0 / 0` —
     * constants that sat exactly at/above the adaptive-gate thresholds
     * (Transcription Accuracy `gte 0.85` blocker, Layout Overlap Rate `eq 0`
     * blocker, LLM Response Time `lt 15000` major), keeping those gates
     * permanently green on unmeasured metrics. The contract: unmeasured =
     * EXPLICIT null, which adaptive-quality-gates fails LOUD (METRIC
     * UNAVAILABLE) — the metric-DEFAULT-coupled-to-GATE-threshold class
     * (memory L3 ledger, hunt-order #1).
     */
    test('quality trio is null — no fabricated 0.90/0/0.85 gate-satisfying constants', () => {
      mockGetMemoryUsage.mockReturnValue({ heapUsed: 100, heapTotal: 200 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.quality.transcriptionAccuracy).toBeNull();
      expect(snapshot.quality.layoutOverlapRate).toBeNull();
      expect(snapshot.quality.avgSceneQuality).toBeNull();
    });

    test('per-model LLM response times are null — no fabricated 0 ms "instant" readings', () => {
      mockGetMemoryUsage.mockReturnValue({ heapUsed: 100, heapTotal: 200 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      expect(snapshot.llm.avgFlashResponseTime).toBeNull();
      expect(snapshot.llm.avgProResponseTime).toBeNull();
    });

    test('display-only llm accumulators stay finite 0 (contract boundary unchanged)', () => {
      mockGetMemoryUsage.mockReturnValue({ heapUsed: 100, heapTotal: 200 });

      const snapshot = new RealTimePerformanceMonitorClass().getSnapshot();

      // flashUsagePercent/proUsagePercent/estimatedCostSavings have no gate —
      // 0 is the honest "nothing recorded yet" for display accumulators, so
      // REQ-364 deliberately does NOT null them (cpuUsagePercent same).
      expect(snapshot.llm.flashUsagePercent).toBe(0);
      expect(snapshot.llm.proUsagePercent).toBe(0);
      expect(snapshot.llm.estimatedCostSavings).toBe(0);
    });
  });
});
