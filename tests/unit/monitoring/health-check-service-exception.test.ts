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
 *
 * Mock strategy: hybrid. realTimeMonitor and globalCache are exported OBJECT
 * instances, so we import the real modules and replace method references on
 * those mutable instances. getMemoryUsage, by contrast, is a named FUNCTION
 * binding on the '@/utils/memory-usage' ESM namespace (frozen), so it is
 * supplied via jest.unstable_mockModule instead of a direct assignment.
 */

import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock data
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

// ---------------------------------------------------------------------------
// Mutable mock functions
// ---------------------------------------------------------------------------

const mockGetSnapshot = jest.fn().mockReturnValue(defaultSnapshot);
const mockAnalyzeTrends = jest.fn().mockReturnValue([]);
const mockOn = jest.fn();
const mockRemoveListener = jest.fn();
const mockGetCacheStats = jest.fn().mockReturnValue(defaultCacheStats);
const mockGetMemoryUsage = jest.fn().mockReturnValue(defaultMemory);

// Convenience aliases
const realTimeMonitor = {
  getSnapshot: mockGetSnapshot,
  analyzeTrends: mockAnalyzeTrends,
  on: mockOn,
  removeListener: mockRemoveListener,
};
const globalCache = { getStats: mockGetCacheStats };
const getMemoryUsage = mockGetMemoryUsage;

// getMemoryUsage is a named FUNCTION binding on the '@/utils/memory-usage' ESM
// namespace, which (unlike realTimeMonitor / globalCache, whose exported object
// instances are mutable) is frozen — a direct `(ns).getMemoryUsage = mock`
// throws "Cannot assign to read only property". Mock the module instead so the
// service's `import { getMemoryUsage }` resolves to our mock. The factory is
// lazy (runs on first import, i.e. during the service import in beforeAll), by
// which point the module-scope jest.fn() above is initialized.
jest.unstable_mockModule('@/utils/memory-usage', () => ({
  __esModule: true,
  getMemoryUsage: mockGetMemoryUsage,
}));

// Lazy-loaded singleton
let healthCheckService: any;

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
  beforeAll(async () => {
    // Import the real modules
    const rtpm = await import('@/monitoring/real-time-performance-monitor');
    const cache = await import('@/performance/intelligent-cache');

    // Override the exported functions with our mocks
    (rtpm as any).realTimeMonitor.getSnapshot = mockGetSnapshot;
    (rtpm as any).realTimeMonitor.analyzeTrends = mockAnalyzeTrends;
    (rtpm as any).realTimeMonitor.on = mockOn;
    (rtpm as any).realTimeMonitor.removeListener = mockRemoveListener;
    (cache as any).globalCache.getStats = mockGetCacheStats;

    // Now import the service
    const mod = await import('@/monitoring/health-check-service');
    healthCheckService = mod.healthCheckService;
  });

  beforeEach(() => {
    resetMocks();
  });

  // =========================================================================
  // checkCacheHealth: globalCache.getStats() throws
  // =========================================================================

  describe('when globalCache.getStats() throws', () => {
    beforeEach(() => {
      globalCache.getStats.mockImplementation(() => {
        throw new Error('cache unavailable');
      });
    });

    it('cache check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.cache.message).toBeTruthy();
    });

    it('overall health check should still succeed', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  // =========================================================================
  // checkPipelineHealth: realTimeMonitor.getSnapshot() throws
  // =========================================================================

  describe('when realTimeMonitor.getSnapshot() throws', () => {
    beforeEach(() => {
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('monitor crashed');
      });
    });

    it('pipeline check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.pipeline.message).toBeTruthy();
    });

    it('LLM check should also return degraded (same backend)', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('degraded');
    });

    it('errorRecovery check should also return degraded', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.errorRecovery.status).toBe('degraded');
    });
  });

  // =========================================================================
  // checkPerformanceHealth: realTimeMonitor.analyzeTrends() throws
  // =========================================================================

  describe('when realTimeMonitor.analyzeTrends() throws', () => {
    beforeEach(() => {
      realTimeMonitor.analyzeTrends.mockImplementation(() => {
        throw new Error('trends failed');
      });
    });

    it('performance check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.performance.status).toBe('degraded');
      expect(result.checks.performance.message).toContain('unavailable');
    });
  });

  // =========================================================================
  // checkMemoryHealth: getMemoryUsage() throws
  // =========================================================================

  describe('when getMemoryUsage() throws', () => {
    beforeEach(() => {
      getMemoryUsage.mockImplementation(() => {
        throw new Error('memory sensor broken');
      });
    });

    it('memory check should return degraded status', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('degraded');
      expect(result.checks.memory.message).toContain('memory sensor broken');
    });
  });

  // =========================================================================
  // Multiple failures
  // =========================================================================

  describe('when multiple dependencies throw', () => {
    beforeEach(() => {
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('snapshot down');
      });
      globalCache.getStats.mockImplementation(() => {
        throw new Error('cache down');
      });
      getMemoryUsage.mockImplementation(() => {
        throw new Error('memory down');
      });
    });

    it('should still return a valid result', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe('degraded');
      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.memory.status).toBe('degraded');
      expect(result.checks.pipeline.status).toBe('degraded');
    });
  });
});
