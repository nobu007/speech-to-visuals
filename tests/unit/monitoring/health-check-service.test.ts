/**
 * REQ-122: HealthCheckService Unit Tests
 *
 * The HealthCheckService (src/monitoring/health-check-service.ts) is a
 * comprehensive production health checker with component-level checks for
 * memory, cache, pipeline, LLM, error recovery, and performance trends.
 *
 * This test suite validates:
 * - Overall health determination logic
 * - Individual component health checks
 * - Kubernetes-style readiness/liveness probes
 * - Recommendation generation
 * - Edge cases (missing data, boundary values)
 *
 * Mock strategy: hybrid. The SUT consumes three dependencies:
 *  - realTimeMonitor / globalCache: EXPORTED OBJECTS — their method properties
 *    are mutable, so we import the real modules and replace the methods.
 *  - getMemoryUsage: a DIRECT ESM namespace function export — immutable under
 *    native ESM, so it is mocked with jest.unstable_mockModule before the SUT
 *    is imported. See [[jest-esm-mock-pattern]].
 */

import { describe, test, expect, beforeEach, beforeAll, jest } from '@jest/globals';

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

const defaultTrends = [
  { metric: 'responseTime', trend: 'stable' as const, changePercent: 2, prediction: { next5min: 500, next15min: 500, next1hour: 500 }, confidence: 0.9 },
  { metric: 'memoryUsage', trend: 'improving' as const, changePercent: -5, prediction: { next5min: 40, next15min: 38, next1hour: 35 }, confidence: 0.85 },
];

const defaultCacheStats = {
  currentSize: 100,
  maxSize: 500,
  totalHits: 600,
  totalMisses: 400,
  hitRate: 0.6,
  totalEntries: 1000,
  evictions: 10,
};

const defaultMemory = {
  rss: 268435456,
  heapTotal: 268435456,
  heapUsed: 107374182, // ~40%
  external: 8388608,
  arrayBuffers: 4194304,
};

// ---------------------------------------------------------------------------
// Mutable mock functions
// ---------------------------------------------------------------------------

const mockGetSnapshot = jest.fn().mockReturnValue(defaultSnapshot);
const mockAnalyzeTrends = jest.fn().mockReturnValue(defaultTrends);
const mockGetCacheStats = jest.fn().mockReturnValue(defaultCacheStats);
const mockGetMemoryUsage = jest.fn().mockReturnValue(defaultMemory);

// Convenience aliases
const realTimeMonitor = { getSnapshot: mockGetSnapshot, analyzeTrends: mockAnalyzeTrends };
const globalCache = { getStats: mockGetCacheStats };
const getMemoryUsage = mockGetMemoryUsage;

// `getMemoryUsage` is a DIRECT ESM namespace export from @/utils/memory-usage,
// so its binding on the module object is immutable (native ESM live bindings).
// You cannot reassign it like a regular object property (which is how
// realTimeMonitor/globalCache below still work — they are exported OBJECTS, so
// their method properties are mutable). Mock the whole module instead, BEFORE
// importing the SUT. See [[jest-esm-mock-pattern]].
jest.unstable_mockModule('@stv/core/utils/memory-usage', () => ({
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
  realTimeMonitor.analyzeTrends.mockReturnValue(defaultTrends);
  globalCache.getStats.mockReturnValue(defaultCacheStats);
  getMemoryUsage.mockReturnValue(defaultMemory);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthCheckService (REQ-122)', () => {
  beforeAll(async () => {
    // Import the real modules. (@/utils/memory-usage is mocked via
    // unstable_mockModule above, so importing it here would just return the
    // mock; we only need the two exported-object modules to mutate.)
    const rtpm = await import('@/monitoring/real-time-performance-monitor');
    const cache = await import('@/performance/intelligent-cache');

    // Override the EXPORTED OBJECTS' methods with our mocks. These are mutable
    // object properties (unlike a direct function export — see note above).
    (rtpm as any).realTimeMonitor.getSnapshot = mockGetSnapshot;
    (rtpm as any).realTimeMonitor.analyzeTrends = mockAnalyzeTrends;
    (cache as any).globalCache.getStats = mockGetCacheStats;

    // Now import the service — it will use the mocked bindings
    const mod = await import('@/monitoring/health-check-service');
    healthCheckService = mod.healthCheckService;
  });

  beforeEach(() => {
    resetMocks();
  });

  // =========================================================================
  // performHealthCheck
  // =========================================================================

  describe('performHealthCheck', () => {
    test('should return a result with correct top-level structure', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test('should include all six component checks', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.checks).toHaveProperty('memory');
      expect(result.checks).toHaveProperty('cache');
      expect(result.checks).toHaveProperty('pipeline');
      expect(result.checks).toHaveProperty('llm');
      expect(result.checks).toHaveProperty('errorRecovery');
      expect(result.checks).toHaveProperty('performance');
    });

    test('each component check should have required fields', async () => {
      const result = await healthCheckService.performHealthCheck();

      for (const [name, check] of Object.entries(result.checks)) {
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('message');
        expect(check).toHaveProperty('latency');
        expect(check).toHaveProperty('lastChecked');
        expect(['healthy', 'degraded', 'unhealthy']).toContain((check as { status: string }).status);
      }
    });

    test('should report healthy when all components are within normal ranges', async () => {
      const result = await healthCheckService.performHealthCheck();

      // With mock data: memory ~40%, cache hit 0.6, pipeline 0.98, errorRate 0.02
      expect(result.status).toBe('healthy');
    });
  });

  // =========================================================================
  // Memory health check
  // =========================================================================

  describe('memory health check', () => {
    test('should report healthy when memory usage < 70%', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.checks.memory.status).toBe('healthy');
      expect(result.checks.memory.message).toContain('healthy');
      expect(result.checks.memory.details).toHaveProperty('heapUsedMB');
      expect(result.checks.memory.details).toHaveProperty('usagePercent');
    });

    test('should report degraded when memory usage is 70-90%', async () => {
      getMemoryUsage.mockReturnValue({
        rss: 536870912,
        heapTotal: 536870912,
        heapUsed: 429496730, // ~80%
        external: 8388608,
        arrayBuffers: 4194304,
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('degraded');
    });

    test('should report unhealthy when memory usage >= 90%', async () => {
      getMemoryUsage.mockReturnValue({
        rss: 536870912,
        heapTotal: 536870912,
        heapUsed: 503316480, // ~94%
        external: 8388608,
        arrayBuffers: 4194304,
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('unhealthy');
    });

    // REQ-347 / TASK-0243 §義務 A — the browser path of
    // @stv/core/utils/memory-usage omits both heapUsed and heapTotal (see
    // tests/unit/utils/memory-usage.test.ts:73 — the mocked "browser
    // unavailable" branch returns `{ heapUsed: 0, heapTotal: 0 }` in
    // tests, but the real cross-process shape carries `undefined`).
    // Before this fix, undefined fed into bytesToMb / heapUsagePercent
    // produced NaN, and `NaN < 70` is `false`, routing every missing
    // field case to the `else` branch and the spurious "Memory usage is
    // critical (NaN.0%)" verdict. Verify the fail-loud degraded shape
    // matches the catch block's contract.
    test('should report degraded with the omit-fields message when heapUsed/heapTotal are missing (REQ-347)', async () => {
      mockGetMemoryUsage.mockReturnValueOnce({
        rss: 0,
        // heapTotal omitted
        // heapUsed omitted
        external: 0,
        arrayBuffers: 0,
      });
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('degraded');
      expect(result.checks.memory.message).toBe(
        'Memory monitoring unavailable: backend omitted heapUsed/heapTotal'
      );
    });

    test('should report degraded with the omit-fields message when only heapUsed is missing (REQ-347)', async () => {
      mockGetMemoryUsage.mockReturnValueOnce({
        rss: 0,
        heapTotal: 536870912,
        // heapUsed omitted
        external: 0,
        arrayBuffers: 0,
      });
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.memory.status).toBe('degraded');
      expect(result.checks.memory.message).toBe(
        'Memory monitoring unavailable: backend omitted heapUsed/heapTotal'
      );
    });
  });

  // =========================================================================
  // Cache health check
  // =========================================================================

  describe('cache health check', () => {
    test('should report healthy when hit rate > 0.5', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.checks.cache.status).toBe('healthy');
      expect(result.checks.cache.details?.hitRate).toBeCloseTo(0.6);
    });

    test('should report degraded when hit rate is 0.2-0.5', async () => {
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats,
        totalHits: 200,
        totalMisses: 600,
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('degraded');
    });

    test('should report unhealthy when hit rate < 0.2', async () => {
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats,
        totalHits: 50,
        totalMisses: 450,
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('unhealthy');
    });

    test('should handle zero hits and misses gracefully', async () => {
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats,
        totalHits: 0,
        totalMisses: 0,
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('unhealthy');
    });

    // MW-023 (REQ-348, Phase 157): backend may return a non-finite hitRate
    // (broken cache producing NaN) or omit hitRate/totalEntries entirely.
    // Before the guard, both paths collapsed `Math.round(NaN * N) = NaN`
    // through `totalHits/(totalHits+totalMisses) || 0` into a fabricated
    // "Cache is ineffective (0% hit rate)" → unhealthy. Now mirrored as
    // `degraded` with the omit-fields-style message so consumers see the
    // real reason instead of a fabricated critical.
    test('should report degraded when stats.hitRate is non-finite (NaN) (REQ-348)', async () => {
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats,
        totalHits: undefined,
        totalMisses: undefined,
        hitRate: Number.NaN,
        totalEntries: 1000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.cache.message).toBe(
        'Cache monitoring unavailable: backend returned non-finite or omitted metrics'
      );
    });

    test('should report degraded when stats.hitRate/totalEntries are omitted (REQ-348)', async () => {
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats,
        totalHits: undefined,
        totalMisses: undefined,
        hitRate: undefined,
        totalEntries: undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.cache.message).toBe(
        'Cache monitoring unavailable: backend returned non-finite or omitted metrics'
      );
    });
  });

  // =========================================================================
  // Pipeline health check
  // =========================================================================

  describe('pipeline health check', () => {
    test('should report healthy when successRate > 0.95 and processing time < 60s', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('healthy');
      expect(result.checks.pipeline.details).toHaveProperty('successRate');
    });

    test('should report degraded when successRate is 0.80-0.95', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.85 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('degraded');
    });

    test('should report unhealthy when successRate < 0.80', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.70 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('unhealthy');
    });

    // MW-024 (REQ-349, Phase 158): the pipeline snapshot reader exposes the
    // same fail-loud contract violation that checkMemoryHealth (REQ-347) and
    // checkCacheHealth (REQ-348) had. `successRate` and `avgProcessingTime`
    // are read straight off the snapshot without a number-ness guard, so a
    // backend that omits either field feeds `undefined` into `> 0.95` / `<
    // 60000` — both predicates return `false`, and the else branch fabricates
    // a "Pipeline is experiencing issues (NaN% success rate)" unhealthy
    // verdict for an UNKNOWN observation window. Mirror the catch block's
    // degraded contract so the upstream dashboard sees the real reason.
    test('should report degraded with the omit-fields message when pipeline.successRate is missing (REQ-349)', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: {
          ...defaultSnapshot.pipeline,
          // successRate omitted by backend (browser-shape fields can be undefined)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          successRate: undefined as any,
        },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.pipeline.message).toBe(
        'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime'
      );
    });

    test('should report degraded when pipeline.avgProcessingTime is non-finite (NaN) (REQ-349)', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: {
          ...defaultSnapshot.pipeline,
          // NaN propagates from the backend when its internal clock trips;
          // `NaN < 60000` is `false`, routing the same fabricated unhealthy.
          avgProcessingTime: Number.NaN,
        },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.pipeline.message).toBe(
        'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime'
      );
    });
  });

  // =========================================================================
  // LLM health check
  // =========================================================================

  describe('LLM health check', () => {
    test('should report healthy when cacheHitRate > 0.4', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('healthy');
    });

    test('should report healthy when totalRequests is 0', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        llm: { ...defaultSnapshot.llm, totalRequests: 0, cacheHitRate: 0 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('healthy');
    });

    test('should report degraded when cacheHitRate is 0.2-0.4', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        llm: { ...defaultSnapshot.llm, cacheHitRate: 0.3 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('degraded');
    });

    test('should report unhealthy when cacheHitRate < 0.2 with requests', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        llm: { ...defaultSnapshot.llm, cacheHitRate: 0.1 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('unhealthy');
    });

    test('should report degraded when llm.cacheHitRate is non-finite (NaN) (REQ-350)', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        llm: { ...defaultSnapshot.llm, cacheHitRate: Number.NaN, totalRequests: 100 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('degraded');
      expect(result.checks.llm.message).toBe(
        'LLM integration unavailable: backend omitted/non-finite cacheHitRate'
      );
    });

    test('should report degraded when llm.cacheHitRate is omitted (REQ-350)', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        llm: { ...defaultSnapshot.llm, cacheHitRate: undefined, totalRequests: 100 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.llm.status).toBe('degraded');
      expect(result.checks.llm.message).toBe(
        'LLM integration unavailable: backend omitted/non-finite cacheHitRate'
      );
    });
  });

  // =========================================================================
  // Error recovery health check
  // =========================================================================

  describe('error recovery health check', () => {
    test('should report healthy when errorRate < 0.05 and recoveryRate > 0.80', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.errorRecovery.status).toBe('healthy');
    });

    test('should report degraded when errorRate is elevated', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        errors: { ...defaultSnapshot.errors, errorRate: 0.10, recoverySuccessRate: 0.7 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.errorRecovery.status).toBe('degraded');
    });

    test('should report unhealthy when errorRate >= 0.15 and recoveryRate <= 0.50', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        errors: { ...defaultSnapshot.errors, errorRate: 0.20, recoverySuccessRate: 0.3 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.errorRecovery.status).toBe('unhealthy');
    });
  });

  // =========================================================================
  // Performance health check
  // =========================================================================

  describe('performance health check', () => {
    test('should report healthy when no degrading trends', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.performance.status).toBe('healthy');
    });

    test('should report degraded when 1-2 degrading trends', async () => {
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'responseTime', trend: 'degrading', changePercent: 20, prediction: { next5min: 600, next15min: 700, next1hour: 800 }, confidence: 0.8 },
        { metric: 'memoryUsage', trend: 'stable', changePercent: 2, prediction: { next5min: 40, next15min: 40, next1hour: 40 }, confidence: 0.9 },
      ]);

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.performance.status).toBe('degraded');
    });

    test('should report unhealthy when 3+ degrading trends', async () => {
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'responseTime', trend: 'degrading', changePercent: 20, prediction: { next5min: 600, next15min: 700, next1hour: 800 }, confidence: 0.8 },
        { metric: 'memoryUsage', trend: 'degrading', changePercent: 30, prediction: { next5min: 60, next15min: 65, next1hour: 70 }, confidence: 0.85 },
        { metric: 'cacheHitRate', trend: 'degrading', changePercent: -15, prediction: { next5min: 0.5, next15min: 0.45, next1hour: 0.4 }, confidence: 0.75 },
      ]);

      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.performance.status).toBe('unhealthy');
    });
  });

  // =========================================================================
  // Overall status calculation
  // =========================================================================

  describe('overall status calculation', () => {
    test('should return unhealthy if any component is unhealthy', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.70 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.status).toBe('unhealthy');
    });

    test('should return degraded if any component is degraded (but none unhealthy)', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.85 },
      });

      const result = await healthCheckService.performHealthCheck();
      expect(result.status).toBe('degraded');
    });

    test('should return healthy when all components are healthy', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.status).toBe('healthy');
    });
  });

  // =========================================================================
  // Readiness probe
  // =========================================================================

  describe('checkReadiness', () => {
    test('should return ready=true when system is healthy', async () => {
      const result = await healthCheckService.checkReadiness();

      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('reason');
      expect(result.ready).toBe(true);
    });

    test('should return ready=false when system is unhealthy', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.70 },
      });

      await healthCheckService.performHealthCheck();
      const result = await healthCheckService.checkReadiness();

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('unhealthy');
    });

    test('should handle errors gracefully', async () => {
      // Force a fresh health check that will throw by making every dependency fail
      getMemoryUsage.mockImplementation(() => {
        throw new Error('memory check failed');
      });
      globalCache.getStats.mockImplementation(() => {
        throw new Error('cache check failed');
      });
      // Also make snapshot throw so performHealthCheck itself fails
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('snapshot failed');
      });

      const result = await healthCheckService.checkReadiness();

      expect(result.ready).toBe(false);
      // Could be "Health check failed" (from try/catch) or cached unhealthy reason
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  // =========================================================================
  // Liveness probe
  // =========================================================================

  describe('checkLiveness', () => {
    test('should return alive=true when system is responsive', async () => {
      const result = await healthCheckService.checkLiveness();

      expect(result).toHaveProperty('alive');
      expect(result).toHaveProperty('reason');
      expect(result.alive).toBe(true);
    });

    test('should return alive=false on error', async () => {
      getMemoryUsage.mockImplementation(() => {
        throw new Error('fatal');
      });

      const result = await healthCheckService.checkLiveness();

      expect(result.alive).toBe(false);
      expect(result.reason).toContain('Liveness check failed');
    });
  });

  // =========================================================================
  // getCachedHealth
  // =========================================================================

  describe('getCachedHealth', () => {
    test('should return last health check result after performHealthCheck', async () => {
      await healthCheckService.performHealthCheck();

      const cached = healthCheckService.getCachedHealth();
      expect(cached).not.toBeNull();
      expect(cached!.status).toBeDefined();
      expect(cached!.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // Uptime tracking
  // =========================================================================

  describe('uptime tracking', () => {
    test('getUptime should return a positive number', () => {
      const uptime = healthCheckService.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    test('getUptimeString should return a human-readable string', () => {
      const uptimeStr = healthCheckService.getUptimeString();
      expect(typeof uptimeStr).toBe('string');
      expect(uptimeStr.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Recommendations
  // =========================================================================

  describe('recommendation generation', () => {
    test('should generate default recommendation when all healthy', async () => {
      const result = await healthCheckService.performHealthCheck();

      expect(result.recommendations).toContain('System is operating optimally - continue monitoring');
    });

    test('should recommend memory optimization when memory is degraded', async () => {
      getMemoryUsage.mockReturnValue({
        rss: 536870912,
        heapTotal: 536870912,
        heapUsed: 429496730,
        external: 8388608,
        arrayBuffers: 4194304,
      });

      const result = await healthCheckService.performHealthCheck();
      const memRecs = result.recommendations.filter((r: string) => r.toLowerCase().includes('memory'));
      expect(memRecs.length).toBeGreaterThan(0);
    });

    test('should include CRITICAL prefix for unhealthy components', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.60 },
      });

      const result = await healthCheckService.performHealthCheck();
      const criticalRecs = result.recommendations.filter((r: string) => r.includes('CRITICAL'));
      expect(criticalRecs.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    test('should handle all components unhealthy', async () => {
      getMemoryUsage.mockReturnValue({
        rss: 536870912,
        heapTotal: 536870912,
        heapUsed: 503316480,
        external: 8388608,
        arrayBuffers: 4194304,
      });
      globalCache.getStats.mockReturnValue({
        ...defaultCacheStats, totalHits: 5, totalMisses: 500,
      });
      realTimeMonitor.getSnapshot.mockReturnValue({
        ...defaultSnapshot,
        pipeline: { ...defaultSnapshot.pipeline, successRate: 0.50 },
        llm: { ...defaultSnapshot.llm, cacheHitRate: 0.05 },
        errors: { ...defaultSnapshot.errors, errorRate: 0.30, recoverySuccessRate: 0.2 },
      });
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'a', trend: 'degrading', changePercent: 10, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.8 },
        { metric: 'b', trend: 'degrading', changePercent: 20, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.8 },
        { metric: 'c', trend: 'degrading', changePercent: 30, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.8 },
      ]);

      const result = await healthCheckService.performHealthCheck();
      expect(result.status).toBe('unhealthy');
    });

    test('should handle snapshot with zero values', async () => {
      const zeroSnapshot = {
        timestamp: Date.now(),
        pipeline: { totalRequests: 0, successRate: 0, avgProcessingTime: 0, p95ProcessingTime: 0, p99ProcessingTime: 0, activeRequests: 0 },
        llm: { totalRequests: 0, flashUsagePercent: 0, proUsagePercent: 0, avgFlashResponseTime: 0, avgProResponseTime: 0, cacheHitRate: 0, estimatedCostSavings: 0 },
        system: { cpuUsagePercent: 0, memoryUsageMB: 0, memoryUsagePercent: 0, heapUsedMB: 0, heapTotalMB: 0 },
        errors: { totalErrors: 0, errorRate: 0, recentErrors: [], recoverySuccessRate: 0 },
        quality: { transcriptionAccuracy: 0, layoutOverlapRate: 0, avgSceneQuality: 0 },
      };
      realTimeMonitor.getSnapshot.mockReturnValue(zeroSnapshot);
      realTimeMonitor.analyzeTrends.mockReturnValue([]);

      const result = await healthCheckService.performHealthCheck();
      expect(result).toBeDefined();
      expect(result.checks).toBeDefined();
    });
  });
});
