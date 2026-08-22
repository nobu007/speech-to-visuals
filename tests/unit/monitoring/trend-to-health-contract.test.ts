/**
 * Trend → health-status end-to-end contract (regression net for 7ae31177).
 *
 * The memoryUsage polarity inversion (7ae31177) was dangerous precisely
 * because the wrong signal flowed all the way through to system health: a
 * rising-memory (leak) trend was classified 'improving', so
 * HealthCheckService.checkPerformanceHealth counted ZERO degrading trends and
 * reported the performance component 'healthy' — a leaking system read as fit.
 * The unit tests of analyzeTrend pin polarity in isolation; this suite locks
 * the FULL contract through the real production wiring:
 *
 *   recordMetric('memoryUsage', <rising>)
 *     → realTimeMonitor.analyzeTrends()
 *     → HealthCheckService.checkPerformanceHealth()
 *     → performance component status + degradingTrends count.
 *
 * Only the non-trend external dependencies are stubbed: getMemoryUsage is an
 * immutable ESM export (must be mocked before import), and globalCache's
 * default state is environment-dependent. analyzeTrends/getSnapshot run against
 * the REAL monitor, so a polarity flip anywhere in the chain fails this test.
 * See [[jest-esm-mock-pattern]].
 */

import { describe, test, expect, beforeEach, beforeAll, jest } from '@jest/globals';

// Healthy memory (~40% heap) so the memory component does not mask the result.
const HEALTHY_MEMORY = {
  rss: 268435456,
  heapTotal: 268435456,
  heapUsed: 107374182, // ~40%
  external: 8388608,
  arrayBuffers: 4194304,
};

const mockGetMemoryUsage = jest.fn(() => ({ ...HEALTHY_MEMORY }));

jest.unstable_mockModule('@stv/core/utils/memory-usage', () => ({
  __esModule: true,
  getMemoryUsage: mockGetMemoryUsage,
}));

// Healthy cache stats so the cache component does not mask the result.
const mockGetCacheStats = jest.fn(() => ({
  maxSize: 500,
  totalHits: 600,
  totalMisses: 400,
  evictions: 10,
}));

let realTimeMonitor: any;
let healthCheckService: any;

beforeAll(async () => {
  const rtpm = await import('@/monitoring/real-time-performance-monitor');
  const cache = await import('@/performance/intelligent-cache');
  // globalCache is an exported OBJECT, so its method properties are mutable
  // (unlike the direct getMemoryUsage export, which needed the module mock
  // above). Override getStats to keep the cache component deterministic.
  (cache as any).globalCache.getStats = mockGetCacheStats;

  realTimeMonitor = rtpm.realTimeMonitor;
  const hcs = await import('@/monitoring/health-check-service');
  healthCheckService = hcs.healthCheckService;
});

beforeEach(() => {
  mockGetMemoryUsage.mockReturnValue({ ...HEALTHY_MEMORY });
  realTimeMonitor.reset();
});

describe('trend → health-status contract (recordMetric → checkPerformanceHealth)', () => {
  test('a rising memoryUsage trend makes the performance component non-healthy', async () => {
    // 40-sample ramp staying under the 512 MB alert threshold; >5% change →
    // not 'stable'. With correct polarity this is 'degrading'.
    for (let i = 0; i < 40; i++) {
      realTimeMonitor.recordMetric('memoryUsage', 100 + i * 10, 'MB');
    }

    const result = await healthCheckService.performHealthCheck();
    const perf = result.checks.performance;

    // Core contract: a memory leak must surface as a DEGRADING performance
    // trend, never be hidden as 'improving'. Under the 7ae31177 inversion
    // degradingTrends was 0 (memoryUsage counted as 'improving').
    expect(perf.details.degradingTrends).toBeGreaterThanOrEqual(1);
    expect(perf.details.trendSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'memoryUsage', trend: 'degrading' }),
      ])
    );
    expect(perf.status).not.toBe('healthy');
    expect(['degraded', 'unhealthy']).toContain(perf.status);
  });

  test('with no trend data the performance component is healthy (control)', async () => {
    // Control: insufficient samples (< 10) → no trends → healthy baseline,
    // proving the previous test fails specifically because of the trend.
    const result = await healthCheckService.performHealthCheck();
    expect(result.checks.performance.details.degradingTrends).toBe(0);
    expect(result.checks.performance.status).toBe('healthy');
  });

  test('the rising-memory signal propagates to overall system status', async () => {
    for (let i = 0; i < 40; i++) {
      realTimeMonitor.recordMetric('memoryUsage', 100 + i * 10, 'MB');
    }

    const result = await healthCheckService.performHealthCheck();
    // One degrading trend (≤2) yields performance 'degraded'; with every other
    // component healthy, overall status must be at least 'degraded' — never
    // 'healthy'. This is the user-facing readout that read falsely healthy.
    expect(result.status).not.toBe('healthy');
  });
});
