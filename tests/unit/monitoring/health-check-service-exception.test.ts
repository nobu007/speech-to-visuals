/**
 * REQ-134: HealthCheckService Exception / Degraded-Status Fallback Tests
 *
 * Validates that each component check returns "degraded" with a descriptive
 * message when its backing dependency throws, rather than propagating the
 * exception and crashing the overall health check.
 *
 * The existing REQ-122 suite covers normal boundary-value paths; this file
 * focuses exclusively on the try/catch fallback branches added in Phase 51
 * (REQ-131).
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks – must be before importing the system under test
// ---------------------------------------------------------------------------

const defaultSnapshot = {
  timestamp: Date.now(),
  pipeline: {
    totalRequests: 100,
    successRate: 0.98,
    avgProcessingTime: 5000,
    p95ProcessingTime: 8000,
    p99ProcessingTime: 12000,
    activeRequests: 2,
  },
  llm: {
    totalRequests: 50,
    flashUsagePercent: 80,
    proUsagePercent: 20,
    avgFlashResponseTime: 200,
    avgProResponseTime: 1500,
    cacheHitRate: 0.6,
    estimatedCostSavings: 0.5,
  },
  system: {
    cpuUsagePercent: 30,
    memoryUsageMB: 256,
    memoryUsagePercent: 40,
    heapUsedMB: 128,
    heapTotalMB: 256,
  },
  errors: {
    totalErrors: 2,
    errorRate: 0.02,
    recentErrors: ['timeout error'],
    recoverySuccessRate: 0.9,
  },
  quality: {
    transcriptionAccuracy: 0.95,
    layoutOverlapRate: 0.0,
    avgSceneQuality: 0.92,
  },
};

const defaultCacheStats = {
  currentSize: 100,
  maxSize: 500,
  totalHits: 600,
  totalMisses: 400,
  evictions: 10,
};

const defaultMemory = {
  rss: 268435456,
  heapTotal: 268435456,
  heapUsed: 107374182,
  external: 8388608,
  arrayBuffers: 4194304,
};

jest.unstable_mockModule('../../../src/monitoring/real-time-performance-monitor', () => ({
  realTimeMonitor: {
    getSnapshot: jest.fn().mockReturnValue(defaultSnapshot),
    analyzeTrends: jest.fn().mockReturnValue([]),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

jest.unstable_mockModule('../../../src/performance/intelligent-cache', () => ({
  globalCache: {
    getStats: jest.fn().mockReturnValue(defaultCacheStats),
  },
}));

jest.unstable_mockModule('../../../src/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn().mockReturnValue(defaultMemory),
}));

jest.unstable_mockModule('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import singleton after mocks are in place
const { healthCheckService } = await import('../../../src/monitoring/health-check-service');
const { realTimeMonitor } = await import('../../../src/monitoring/real-time-performance-monitor') as { realTimeMonitor: { getSnapshot: jest.Mock; analyzeTrends: jest.Mock; on: jest.Mock; removeListener: jest.Mock } };
const { globalCache } = await import('../../../src/performance/intelligent-cache') as { globalCache: { getStats: jest.Mock } };
const { getMemoryUsage } = await import('../../../src/utils/memory-usage') as { getMemoryUsage: jest.Mock };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  realTimeMonitor.getSnapshot.mockReturnValue(defaultSnapshot);
  realTimeMonitor.analyzeTrends.mockReturnValue([]);
  globalCache.getStats.mockReturnValue(defaultCacheStats);
  getMemoryUsage.mockReturnValue(defaultMemory);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthCheckService – exception fallback (REQ-134)', () => {
  beforeEach(() => {
    resetMocks();
  });

  // =========================================================================
  // checkCacheHealth: globalCache.getStats() throws
  // =========================================================================

  describe('when globalCache.getStats() throws', () => {
    beforeEach(() => {
      globalCache.getStats.mockImplementation(() => {
        throw new Error('Redis connection refused');
      });
    });

    test('cache check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.cache.message).toBe('Cache backend unreachable');
    });

    test('overall health check should still succeed', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result).toHaveProperty('status');
      expect(result.status).not.toBe('unhealthy');
    });
  });

  // =========================================================================
  // checkPipelineHealth: realTimeMonitor.getSnapshot() throws
  // =========================================================================

  describe('when realTimeMonitor.getSnapshot() throws', () => {
    beforeEach(() => {
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('monitor unavailable');
      });
    });

    test('pipeline check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.pipeline.message).toBe('Pipeline metrics unavailable');
    });

    test('LLM check should also return degraded (same backend)', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('degraded');
      expect(result.checks.llm.message).toBe('LLM metrics unavailable');
    });

    test('errorRecovery check should also return degraded', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.errorRecovery.status).toBe('degraded');
      expect(result.checks.errorRecovery.message).toBe('Error recovery metrics unavailable');
    });
  });

  // =========================================================================
  // checkPerformanceHealth: realTimeMonitor.analyzeTrends() throws
  // =========================================================================

  describe('when realTimeMonitor.analyzeTrends() throws', () => {
    beforeEach(() => {
      realTimeMonitor.analyzeTrends.mockImplementation(() => {
        throw new Error('trend analysis failed');
      });
    });

    test('performance check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.performance.status).toBe('degraded');
      expect(result.checks.performance.message).toBe('Performance trend analysis unavailable');
    });
  });

  // =========================================================================
  // performHealthCheck metrics fallback: getSnapshot() throws during metrics
  // =========================================================================

  describe('when getSnapshot() throws during metrics collection', () => {
    beforeEach(() => {
      // getSnapshot is called by pipeline/LLM/errorRecovery checks AND for
      // the final metrics.  Make it throw so we exercise the catch in
      // performHealthCheck's metrics section.
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('monitor crashed');
      });
    });

    test('should use fallback metrics with zero values', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.pipeline.totalRequests).toBe(0);
      expect(result.metrics.system.cpuUsagePercent).toBe(0);
      expect(result.metrics.errors.totalErrors).toBe(0);
    });

    test('should still produce a valid HealthCheckResult', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('recommendations');
    });
  });

  // =========================================================================
  // Multiple backends failing simultaneously
  // =========================================================================

  describe('when multiple backends fail simultaneously', () => {
    beforeEach(() => {
      globalCache.getStats.mockImplementation(() => {
        throw new Error('cache down');
      });
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('monitor down');
      });
      realTimeMonitor.analyzeTrends.mockImplementation(() => {
        throw new Error('trends down');
      });
    });

    test('all dependent checks should report degraded', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.llm.status).toBe('degraded');
      expect(result.checks.errorRecovery.status).toBe('degraded');
      expect(result.checks.performance.status).toBe('degraded');
    });

    test('memory check should still work (no dependency on cache/monitor)', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('healthy');
    });

    test('overall result should use fallback metrics', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.metrics.pipeline.totalRequests).toBe(0);
    });
  });

  // =========================================================================
  // Latency field is always present on fallback
  // =========================================================================

  describe('fallback component check structure', () => {
    test('cache fallback should include latency and lastChecked', async () => {
      globalCache.getStats.mockImplementation(() => {
        throw new Error('boom');
      });
      const result = await healthCheckService.performHealthCheck();
      const cache = result.checks.cache;
      expect(typeof cache.latency).toBe('number');
      expect(typeof cache.lastChecked).toBe('number');
    });

    test('pipeline fallback should include latency and lastChecked', async () => {
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('boom');
      });
      const result = await healthCheckService.performHealthCheck();
      const pipeline = result.checks.pipeline;
      expect(typeof pipeline.latency).toBe('number');
      expect(typeof pipeline.lastChecked).toBe('number');
    });
  });
});
