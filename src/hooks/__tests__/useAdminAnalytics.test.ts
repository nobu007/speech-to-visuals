/**
 * @jest-environment jsdom
 */

/**
 * useAdminAnalytics hook tests
 *
 * Verifies the React hook correctly polls HealthCheckService, ProductionMonitor,
 * and RealTimePerformanceMonitor, providing reactive state for the admin dashboard.
 */

import { renderHook, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock fns are declared at MODULE scope so individual tests can configure return
// values directly. jest.mock is a no-op under the ESM preset and jest.requireMock
// is a CommonJS-only API, so we register factories via unstable_mockModule that
// close over these named fns and resolve the SUT through a dynamic import.
const mockedGetCachedHealth = jest.fn(() => null);
const mockedGetUptime = jest.fn(() => 0);

const mockProdMetrics = {
  totalRequests: 10,
  successfulRequests: 8,
  failedRequests: 2,
  averageProcessingTime: 15000,
  p95ProcessingTime: 30000,
  p99ProcessingTime: 45000,
  errorsByType: new Map([['timeout', 2]]),
  componentMetrics: {
    transcription: { requests: 10, successes: 9, failures: 1, averageLatency: 5000, p95Latency: 8000, errors: [] },
    analysis: { requests: 10, successes: 8, failures: 2, averageLatency: 8000, p95Latency: 15000, errors: [] },
    visualization: { requests: 10, successes: 10, failures: 0, averageLatency: 2000, p95Latency: 4000, errors: [] },
    rendering: { requests: 10, successes: 9, failures: 1, averageLatency: 10000, p95Latency: 20000, errors: [] },
  },
};
const mockHealthResult = {
  timestamp: new Date('2026-06-25T10:00:00Z'),
  status: 'healthy',
  components: {
    transcription: { name: 'transcription', status: 'healthy', metrics: { successRate: 0.9, averageLatency: 5000, errorRate: 0.1 } },
    analysis: { name: 'analysis', status: 'degraded', metrics: { successRate: 0.8, averageLatency: 8000, errorRate: 0.2 } },
    visualization: { name: 'visualization', status: 'healthy', metrics: { successRate: 1.0, averageLatency: 2000, errorRate: 0 } },
    rendering: { name: 'rendering', status: 'healthy', metrics: { successRate: 0.9, averageLatency: 10000, errorRate: 0.1 } },
  },
  alerts: [],
  recommendations: ['System healthy. Continue monitoring for trends.'],
};
const mockGetProductionMonitor = jest.fn(() => ({
  getMetrics: jest.fn(() => mockProdMetrics),
  performHealthCheck: jest.fn(() => mockHealthResult),
}));

const mockedGetSnapshot = jest.fn(() => ({
  timestamp: Date.now(),
  pipeline: { totalRequests: 10, successRate: 0.8, avgProcessingTime: 15000, p95ProcessingTime: 30000, p99ProcessingTime: 45000, activeRequests: 1 },
  llm: { totalRequests: 5, flashUsagePercent: 80, proUsagePercent: 20, avgFlashResponseTime: 2000, avgProResponseTime: 5000, cacheHitRate: 0.6, estimatedCostSavings: 50 },
  system: { cpuUsagePercent: 25, memoryUsageMB: 200, memoryUsagePercent: 40, heapUsedMB: 100, heapTotalMB: 200 },
  errors: { totalErrors: 2, errorRate: 0.2, recentErrors: [], recoverySuccessRate: 0.5 },
  quality: { transcriptionAccuracy: 0.92, layoutOverlapRate: 0, avgSceneQuality: 0.88 },
}));
const mockAnalyzeTrends = jest.fn(() => [
  { metric: 'processingTime', trend: 'improving', changePercent: -5.2 },
  { metric: 'errorRate', trend: 'stable', changePercent: 0.1 },
]);

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('@/monitoring/health-check-service', () => ({
  __esModule: true,
  healthCheckService: { getCachedHealth: mockedGetCachedHealth, getUptime: mockedGetUptime },
  // Mirror the real export so the SUT's `import { HEALTH_CHECK_INTERVAL_MS }`
  // resolves under the ESM mock. The producer↔consumer coupling itself is
  // enforced structurally in health-check-interval-coupling.test.ts.
  HEALTH_CHECK_INTERVAL_MS: 10_000,
}));

jest.unstable_mockModule('@/monitoring/production-monitor', () => ({
  __esModule: true,
  getProductionMonitor: mockGetProductionMonitor,
}));

jest.unstable_mockModule('@/monitoring/real-time-performance-monitor', () => ({
  __esModule: true,
  realTimeMonitor: { getSnapshot: mockedGetSnapshot, analyzeTrends: mockAnalyzeTrends },
}));

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  __esModule: true,
  logger,
}));

const { useAdminAnalytics } = await import('../useAdminAnalytics');
const { HEALTH_CHECK_INTERVAL_MS } = await import('@/monitoring/health-check-service');

describe('useAdminAnalytics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGetCachedHealth.mockReturnValue(null);
    mockedGetUptime.mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns empty snapshot before first poll', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    expect(result.current.snapshot.healthCheck).toBeNull();
    expect(result.current.snapshot.productionMetrics).toBeNull();
    expect(result.current.snapshot.performanceSnapshot).toBeNull();
    expect(result.current.snapshot.trends).toEqual([]);
    expect(result.current.snapshot.uptime).toBe(0);
    expect(result.current.isPolling).toBe(false);
  });

  it('refresh collects data from all monitoring services', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    act(() => {
      result.current.refresh();
    });

    const snap = result.current.snapshot;
    expect(snap.productionMetrics).not.toBeNull();
    expect(snap.productionMetrics!.totalRequests).toBe(10);
    expect(snap.productionMetrics!.successfulRequests).toBe(8);
    expect(snap.productionHealth).not.toBeNull();
    expect(snap.productionHealth!.status).toBe('healthy');
    expect(snap.performanceSnapshot).not.toBeNull();
    expect(snap.performanceSnapshot!.pipeline.totalRequests).toBe(10);
    expect(snap.trends).toHaveLength(2);
    expect(snap.trends[0].metric).toBe('processingTime');
  });

  it('refresh sets healthCheck data when cached health exists', () => {
    const mockHC = {
      status: 'healthy' as const,
      timestamp: 1000000,
      uptime: 5000,
      checks: {},
      metrics: {},
      recommendations: [],
    };
    mockedGetCachedHealth.mockReturnValue(mockHC);
    mockedGetUptime.mockReturnValue(42000);

    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    act(() => {
      result.current.refresh();
    });

    expect(result.current.snapshot.healthCheck).toEqual(mockHC);
    expect(result.current.snapshot.lastCheckedAt).toBe(1000000);
    expect(result.current.snapshot.nextDueAt).toBe(1000000 + HEALTH_CHECK_INTERVAL_MS);
    expect(result.current.snapshot.uptime).toBe(42000);
  });

  it('nextDueAt is null when no health check has been performed', () => {
    mockedGetCachedHealth.mockReturnValue(null);

    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    act(() => {
      result.current.refresh();
    });

    expect(result.current.snapshot.healthCheck).toBeNull();
    expect(result.current.snapshot.lastCheckedAt).toBeNull();
    expect(result.current.snapshot.nextDueAt).toBeNull();
  });

  it('autoStart begins polling immediately', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: true, intervalMs: 5000 }),
    );

    expect(result.current.isPolling).toBe(true);
    // Data should be populated from initial refresh
    expect(result.current.snapshot.productionMetrics).not.toBeNull();

    // Advance time and verify polling continues
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.snapshot.productionMetrics).not.toBeNull();
  });

  it('start and stop control polling', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    expect(result.current.isPolling).toBe(false);

    act(() => {
      result.current.start();
    });
    expect(result.current.isPolling).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isPolling).toBe(false);
  });

  it('start is idempotent', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false, intervalMs: 5000 }),
    );

    act(() => {
      result.current.start();
      result.current.start(); // second call should be a no-op
    });

    expect(result.current.isPolling).toBe(true);
  });

  it('polls at configured interval', () => {
    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false, intervalMs: 3000 }),
    );

    act(() => {
      result.current.start();
    });

    // Verify the interval is set (not crashed after advance)
    act(() => {
      jest.advanceTimersByTime(6000); // 2 intervals
    });

    expect(result.current.snapshot.productionMetrics).not.toBeNull();
  });

  it('cleans up interval on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useAdminAnalytics({ autoStart: true, intervalMs: 5000 }),
    );

    expect(result.current.isPolling).toBe(true);

    unmount();

    // Should not throw after unmount
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });

  it('refresh handles errors gracefully', () => {
    // Temporarily make getProductionMonitor throw
    const getProductionMonitor = mockGetProductionMonitor;
    getProductionMonitor.mockReturnValueOnce({
      getMetrics: jest.fn(() => { throw new Error('DB connection failed'); }),
      performHealthCheck: jest.fn(() => { throw new Error('DB connection failed'); }),
    });

    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    // Should not throw
    act(() => {
      result.current.refresh();
    });

    // Previous snapshot is kept (empty in this case)
    expect(result.current.snapshot.healthCheck).toBeNull();
  });

  it('logs warning when realTimeMonitor.getSnapshot throws', () => {
    mockedGetSnapshot.mockImplementationOnce(() => { throw new Error('monitor crashed'); });

    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    act(() => {
      result.current.refresh();
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[useAdminAnalytics] Performance monitor unavailable'),
      expect.any(Error),
    );
  });

  it('logs warning when snapshot collection throws', () => {
    const getProductionMonitor = mockGetProductionMonitor;
    getProductionMonitor.mockImplementationOnce(() => { throw new Error('collection crashed'); });

    const { result } = renderHook(() =>
      useAdminAnalytics({ autoStart: false }),
    );

    act(() => {
      result.current.refresh();
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[useAdminAnalytics] Snapshot collection failed'),
      expect.any(Error),
    );
  });
});
