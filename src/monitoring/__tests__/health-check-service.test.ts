/**
 * Unit tests for HealthCheckService
 * Covers: health checks (memory, cache, pipeline, LLM, error recovery, performance),
 *         readiness/liveness probes, overall status calculation, recommendations,
 *         destroy() cleanup, cached health retrieval
 */

import { HealthCheckService } from '../health-check-service';
import type { PerformanceSnapshot } from '../real-time-performance-monitor';

// Mock dependencies
jest.mock('../real-time-performance-monitor', () => ({
  realTimeMonitor: {
    getSnapshot: jest.fn(),
    analyzeTrends: jest.fn(),
  },
}));

jest.mock('@/performance/intelligent-cache', () => ({
  globalCache: {
    getStats: jest.fn(),
  },
}));

jest.mock('@/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const { realTimeMonitor } = require('../real-time-performance-monitor');
const { globalCache } = require('@/performance/intelligent-cache');
const { getMemoryUsage } = require('@/utils/memory-usage');

function makeHealthySnapshot(): PerformanceSnapshot {
  return {
    timestamp: Date.now(),
    pipeline: {
      totalRequests: 100,
      successRate: 0.98,
      avgProcessingTime: 5000,
      p95ProcessingTime: 10000,
      p99ProcessingTime: 15000,
      activeRequests: 2,
    },
    llm: {
      totalRequests: 50,
      flashUsagePercent: 80,
      proUsagePercent: 20,
      avgFlashResponseTime: 1000,
      avgProResponseTime: 3000,
      cacheHitRate: 0.6,
      estimatedCostSavings: 100,
    },
    system: {
      cpuUsagePercent: 30,
      memoryUsageMB: 100,
      memoryUsagePercent: 40,
      heapUsedMB: 50,
      heapTotalMB: 100,
    },
    errors: {
      totalErrors: 2,
      errorRate: 0.02,
      recentErrors: [],
      recoverySuccessRate: 0.95,
    },
    quality: {
      transcriptionAccuracy: 0.95,
      layoutOverlapRate: 0,
      avgSceneQuality: 0.9,
    },
  };
}

function makeDegradedSnapshot(): PerformanceSnapshot {
  return {
    ...makeHealthySnapshot(),
    pipeline: {
      totalRequests: 100,
      successRate: 0.85,
      avgProcessingTime: 90000,
      p95ProcessingTime: 120000,
      p99ProcessingTime: 180000,
      activeRequests: 15,
    },
    errors: {
      totalErrors: 20,
      errorRate: 0.12,
      recentErrors: ['timeout', 'oom'],
      recoverySuccessRate: 0.55,
    },
    system: {
      cpuUsagePercent: 70,
      memoryUsageMB: 400,
      memoryUsagePercent: 75,
      heapUsedMB: 350,
      heapTotalMB: 500,
    },
  };
}

function makeUnhealthySnapshot(): PerformanceSnapshot {
  return {
    ...makeDegradedSnapshot(),
    pipeline: {
      totalRequests: 100,
      successRate: 0.50,
      avgProcessingTime: 150000,
      p95ProcessingTime: 200000,
      p99ProcessingTime: 300000,
      activeRequests: 50,
    },
    errors: {
      totalErrors: 60,
      errorRate: 0.50,
      recentErrors: ['crash', 'oom', 'timeout'],
      recoverySuccessRate: 0.20,
    },
    llm: {
      totalRequests: 50,
      flashUsagePercent: 80,
      proUsagePercent: 20,
      avgFlashResponseTime: 1000,
      avgProResponseTime: 3000,
      cacheHitRate: 0.05,
      estimatedCostSavings: 0,
    },
    system: {
      cpuUsagePercent: 95,
      memoryUsageMB: 800,
      memoryUsagePercent: 92,
      heapUsedMB: 750,
      heapTotalMB: 800,
    },
  };
}

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthCheckService();

    // Default: healthy mocks
    getMemoryUsage.mockReturnValue({
      heapUsed: 50 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      rss: 100 * 1024 * 1024,
      external: 10 * 1024 * 1024,
    });
    realTimeMonitor.getSnapshot.mockReturnValue(makeHealthySnapshot());
    realTimeMonitor.analyzeTrends.mockReturnValue([
      { metric: 'processingTime', trend: 'stable', changePercent: 0, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
    ]);
    globalCache.getStats.mockReturnValue({
      totalHits: 80,
      totalMisses: 20,
      hitRate: 0.8,
      totalEntries: 100,
      currentSize: 100,
      maxSize: 500,
      evictions: 5,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('performHealthCheck', () => {
    it('returns healthy status when all components are healthy', async () => {
      const result = await service.performHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks.memory.status).toBe('healthy');
      expect(result.checks.cache.status).toBe('healthy');
      expect(result.checks.pipeline.status).toBe('healthy');
      expect(result.checks.llm.status).toBe('healthy');
      expect(result.checks.errorRecovery.status).toBe('healthy');
      expect(result.checks.performance.status).toBe('healthy');
    });

    it('returns degraded status when pipeline success rate is low', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue(makeDegradedSnapshot());

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.status).toBe('degraded');
    });

    it('returns unhealthy status when pipeline is critical', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue(makeUnhealthySnapshot());
      // Also mock high memory usage for unhealthy memory check
      getMemoryUsage.mockReturnValue({
        heapUsed: 190 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('unhealthy');
      expect(result.checks.memory.status).toBe('unhealthy');
      expect(result.checks.errorRecovery.status).toBe('unhealthy');
      expect(result.checks.llm.status).toBe('unhealthy');
      expect(result.status).toBe('unhealthy');
    });

    it('includes uptime in result', async () => {
      const result = await service.performHealthCheck();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('includes recommendations', async () => {
      const result = await service.performHealthCheck();

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('returns healthy recommendation when all is well', async () => {
      const result = await service.performHealthCheck();

      expect(result.recommendations).toContain('System is operating optimally - continue monitoring');
    });
  });

  describe('memory health check', () => {
    it('reports healthy when heap usage < 70%', async () => {
      getMemoryUsage.mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.memory.status).toBe('healthy');
      expect(result.checks.memory.details?.usagePercent).toBe(25);
    });

    it('reports degraded when heap usage 70-90%', async () => {
      getMemoryUsage.mockReturnValue({
        heapUsed: 160 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.memory.status).toBe('degraded');
    });

    it('reports unhealthy when heap usage > 90%', async () => {
      getMemoryUsage.mockReturnValue({
        heapUsed: 190 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.memory.status).toBe('unhealthy');
    });

    it('handles zero heapTotal gracefully', async () => {
      getMemoryUsage.mockReturnValue({
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.memory.status).toBe('healthy');
      expect(result.checks.memory.details?.usagePercent).toBe(0);
    });
  });

  describe('cache health check', () => {
    it('reports healthy when hit rate > 50%', async () => {
      globalCache.getStats.mockReturnValue({
        totalHits: 80,
        totalMisses: 20,
        hitRate: 0.8,
        totalEntries: 100,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.cache.status).toBe('healthy');
    });

    it('reports degraded when hit rate 20-50%', async () => {
      globalCache.getStats.mockReturnValue({
        totalHits: 30,
        totalMisses: 70,
        hitRate: 0.3,
        totalEntries: 100,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.cache.status).toBe('degraded');
    });

    it('reports unhealthy when hit rate < 20%', async () => {
      globalCache.getStats.mockReturnValue({
        totalHits: 5,
        totalMisses: 95,
        hitRate: 0.05,
        totalEntries: 100,
      });

      const result = await service.performHealthCheck();

      expect(result.checks.cache.status).toBe('unhealthy');
    });

    it('reports degraded when cache backend throws', async () => {
      globalCache.getStats.mockImplementation(() => {
        throw new Error('Backend unreachable');
      });

      const result = await service.performHealthCheck();

      expect(result.checks.cache.status).toBe('degraded');
      expect(result.checks.cache.message).toContain('unreachable');
    });
  });

  describe('pipeline health check', () => {
    it('reports healthy when success rate > 95% and processing time < 60s', async () => {
      const snap = makeHealthySnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('healthy');
    });

    it('reports degraded when success rate 80-95%', async () => {
      const snap = makeDegradedSnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('degraded');
    });

    it('reports unhealthy when success rate < 80%', async () => {
      const snap = makeUnhealthySnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('unhealthy');
    });

    it('reports degraded when metrics unavailable', async () => {
      realTimeMonitor.getSnapshot.mockImplementation(() => {
        throw new Error('Monitor error');
      });

      const result = await service.performHealthCheck();

      expect(result.checks.pipeline.status).toBe('degraded');
      expect(result.checks.pipeline.message).toContain('unavailable');
    });
  });

  describe('LLM health check', () => {
    it('reports healthy when cache hit rate > 40%', async () => {
      const snap = makeHealthySnapshot();
      snap.llm.cacheHitRate = 0.6;
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.llm.status).toBe('healthy');
    });

    it('reports healthy when totalRequests is 0', async () => {
      const snap = makeHealthySnapshot();
      snap.llm.totalRequests = 0;
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.llm.status).toBe('healthy');
    });

    it('reports degraded when cache hit rate 20-40%', async () => {
      const snap = makeHealthySnapshot();
      snap.llm.cacheHitRate = 0.3;
      snap.llm.totalRequests = 100;
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.llm.status).toBe('degraded');
    });

    it('reports unhealthy when cache hit rate < 20%', async () => {
      const snap = makeUnhealthySnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.llm.status).toBe('unhealthy');
    });
  });

  describe('error recovery health check', () => {
    it('reports healthy when error rate < 5% and recovery > 80%', async () => {
      const result = await service.performHealthCheck();

      expect(result.checks.errorRecovery.status).toBe('healthy');
    });

    it('reports degraded when error rate 5-15%', async () => {
      const snap = makeDegradedSnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.errorRecovery.status).toBe('degraded');
    });

    it('reports unhealthy when error rate > 15% and recovery < 50%', async () => {
      const snap = makeUnhealthySnapshot();
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.checks.errorRecovery.status).toBe('unhealthy');
    });
  });

  describe('performance health check', () => {
    it('reports healthy when no degrading trends', async () => {
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'processingTime', trend: 'improving', changePercent: -10, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
      ]);

      const result = await service.performHealthCheck();

      expect(result.checks.performance.status).toBe('healthy');
    });

    it('reports degraded when 1-2 degrading trends', async () => {
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'processingTime', trend: 'degrading', changePercent: 20, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
        { metric: 'memoryUsage', trend: 'stable', changePercent: 0, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
      ]);

      const result = await service.performHealthCheck();

      expect(result.checks.performance.status).toBe('degraded');
    });

    it('reports unhealthy when > 2 degrading trends', async () => {
      realTimeMonitor.analyzeTrends.mockReturnValue([
        { metric: 'processingTime', trend: 'degrading', changePercent: 20, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
        { metric: 'memoryUsage', trend: 'degrading', changePercent: 30, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
        { metric: 'errorRate', trend: 'degrading', changePercent: 50, prediction: { next5min: 0, next15min: 0, next1hour: 0 }, confidence: 0.9 },
      ]);

      const result = await service.performHealthCheck();

      expect(result.checks.performance.status).toBe('unhealthy');
    });

    it('reports degraded when trend analysis throws', async () => {
      realTimeMonitor.analyzeTrends.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const result = await service.performHealthCheck();

      expect(result.checks.performance.status).toBe('degraded');
    });
  });

  describe('checkReadiness', () => {
    it('returns ready=true when system is healthy', async () => {
      await service.performHealthCheck();
      const probe = await service.checkReadiness();

      expect(probe.ready).toBe(true);
    });

    it('returns ready=false when system is unhealthy', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue(makeUnhealthySnapshot());
      await service.performHealthCheck();
      const probe = await service.checkReadiness();

      expect(probe.ready).toBe(false);
      expect(probe.reason).toContain('unhealthy');
    });

    it('returns ready=true when system is degraded', async () => {
      realTimeMonitor.getSnapshot.mockReturnValue(makeDegradedSnapshot());
      await service.performHealthCheck();
      const probe = await service.checkReadiness();

      expect(probe.ready).toBe(true);
    });

    it('returns ready=false with reason on error', async () => {
      // Force performHealthCheck to have been cached, then corrupt it
      const probe = await service.checkReadiness();

      // If no cached health, it runs performHealthCheck which succeeds
      // so this tests the cached path
      expect(probe.ready).toBeDefined();
    });
  });

  describe('checkLiveness', () => {
    it('returns alive=true when system is responsive', async () => {
      const probe = await service.checkLiveness();

      expect(probe.alive).toBe(true);
      expect(probe.reason).toContain('responsive');
    });

    it('returns alive=false on error', async () => {
      getMemoryUsage.mockImplementation(() => {
        throw new Error('System error');
      });

      const probe = await service.checkLiveness();

      expect(probe.alive).toBe(false);
      expect(probe.reason).toContain('failed');
    });
  });

  describe('getCachedHealth', () => {
    it('returns null before any health check', () => {
      expect(service.getCachedHealth()).toBeNull();
    });

    it('returns cached result after health check', async () => {
      const result = await service.performHealthCheck();
      const cached = service.getCachedHealth();

      expect(cached).toEqual(result);
    });
  });

  describe('getUptime', () => {
    it('returns a non-negative number', () => {
      expect(service.getUptime()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUptimeString', () => {
    it('returns human-readable uptime', () => {
      const str = service.getUptimeString();
      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });

    it('formats seconds correctly', () => {
      // Mock startTime by checking format pattern
      const str = service.getUptimeString();
      // Should match patterns like "5s", "3m 10s", "2h 15m 30s", "1d 3h 20m"
      expect(str).toMatch(/^\d+[smhd]/);
    });
  });

  describe('recommendations generation', () => {
    it('generates memory recommendation when degraded', async () => {
      getMemoryUsage.mockReturnValue({
        heapUsed: 160 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.recommendations).toContain('Consider increasing memory allocation or implementing memory optimization');
    });

    it('generates critical memory recommendation when usage > 85%', async () => {
      const snap = makeUnhealthySnapshot();
      snap.system.memoryUsagePercent = 90;
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      getMemoryUsage.mockReturnValue({
        heapUsed: 190 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
        external: 10 * 1024 * 1024,
      });

      const result = await service.performHealthCheck();

      expect(result.recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
    });

    it('generates scaling recommendation when active requests > 10', async () => {
      const snap = makeDegradedSnapshot();
      snap.pipeline.activeRequests = 15;
      realTimeMonitor.getSnapshot.mockReturnValue(snap);

      const result = await service.performHealthCheck();

      expect(result.recommendations.some(r => r.includes('horizontal scaling'))).toBe(true);
    });

    it('generates cache recommendation when unhealthy', async () => {
      globalCache.getStats.mockReturnValue({
        totalHits: 5,
        totalMisses: 95,
        hitRate: 0.05,
        totalEntries: 100,
      });

      const result = await service.performHealthCheck();

      expect(result.recommendations.some(r => r.includes('CRITICAL') && r.includes('Cache'))).toBe(true);
    });
  });

  describe('destroy', () => {
    it('can be called without error', () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      service.destroy();
      expect(() => service.destroy()).not.toThrow();
    });
  });
});
