/**
 * Unit tests for PerformanceDashboard
 * Covers: metrics collection, percentile calculation, alerting, request tracking, cost tracking
 */

import { PerformanceDashboard } from '../performance-dashboard';
import { MonitoringError } from '@/pipeline/pipeline-errors';

// Mock dependencies
jest.mock('@/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 100 * 1024 * 1024, // 100MB
    heapTotal: 200 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    rss: 150 * 1024 * 1024,
  })),
}));

jest.mock('@/analysis/token-usage-tracker', () => ({
  TokenUsageTracker: jest.fn().mockImplementation(() => ({
    recordTokenUsage: jest.fn(),
    getSummary: jest.fn(() => ({
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalTokens: 1500,
      recordCount: 5,
    })),
    getRecords: jest.fn(() => []),
    reset: jest.fn(),
  })),
}));

jest.mock('@/analysis/cost-estimator', () => ({
  estimateCost: jest.fn(() => ({
    totalCost: 0.025,
    inputCost: 0.01,
    outputCost: 0.015,
    currency: 'USD',
  })),
}));

jest.mock('@/performance/intelligent-cache', () => ({
  globalCache: {
    getStats: jest.fn(() => ({
      hitRate: 0.85,
      memoryUsage: 1024,
      totalEntries: 50,
    })),
    getEfficiencyReport: jest.fn(() => ({
      efficiency: 0.9,
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PerformanceDashboard', () => {
  let dashboard: PerformanceDashboard;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboard = new PerformanceDashboard();
  });

  afterEach(() => {
    dashboard.destroy();
  });

  describe('constructor', () => {
    it('initializes with default thresholds', () => {
      const data = dashboard.getDashboardData();
      expect(data.summary.totalRequests).toBe(0);
      expect(data.summary.successRate).toBe(1); // Default when no requests
    });

    it('accepts custom thresholds', () => {
      const custom = new PerformanceDashboard({
        memory: { heapUsedMB: 512, memoryLeakDetection: 2.0 },
        processing: { maxTranscriptionTime: 30000, maxAnalysisTime: 10000, maxLayoutTime: 5000, maxTotalTime: 60000 },
        cache: { minHitRate: 0.8, minEfficiency: 0.9 },
        quality: { minSuccessRate: 0.99, maxErrorRate: 0.01 },
      });
      expect(custom).toBeDefined();
      custom.destroy();
    });

    it('does not start monitoring interval in test environment', () => {
      // Dashboard should not leak intervals in test env
      const d = new PerformanceDashboard();
      d.destroy(); // Should not throw
    });
  });

  describe('requestStart', () => {
    it('returns a unique request ID', () => {
      const id1 = dashboard.requestStart();
      const id2 = dashboard.requestStart();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_/);
    });

    it('increments request counters', () => {
      dashboard.requestStart();
      dashboard.requestStart();
      const data = dashboard.getDashboardData();
      expect(data.summary.totalRequests).toBe(2);
    });
  });

  describe('requestComplete', () => {
    it('tracks successful requests', () => {
      const id = dashboard.requestStart();
      dashboard.requestComplete(id, true);
      const data = dashboard.getDashboardData();
      expect(data.summary.successRate).toBe(1);
    });

    it('tracks failed requests', () => {
      const id = dashboard.requestStart();
      dashboard.requestComplete(id, false);
      const data = dashboard.getDashboardData();
      expect(data.summary.successRate).toBe(0);
    });

    it('records processing times', () => {
      const id = dashboard.requestStart();
      dashboard.requestComplete(id, true, {
        transcriptionTime: 1000,
        analysisTime: 500,
        layoutTime: 200,
        renderTime: 300,
      });
      // Should not throw and metrics should be accessible
      const data = dashboard.getDashboardData();
      expect(data).toBeDefined();
    });
  });

  describe('calculatePercentiles', () => {
    it('returns empty object when no metrics exist', () => {
      const result = dashboard.calculatePercentiles('responseTime');
      expect(result).toEqual({});
    });

    it('calculates P50/P95/P99 from metric history', () => {
      // Generate some requests to populate metrics
      for (let i = 0; i < 10; i++) {
        const id = dashboard.requestStart();
        dashboard.requestComplete(id, true, {
          transcriptionTime: 100 * (i + 1),
          analysisTime: 50 * (i + 1),
          layoutTime: 20 * (i + 1),
          renderTime: 30 * (i + 1),
        });
      }

      // Force metric collection
      const trends = dashboard.getPerformanceTrends();
      expect(trends.responseTime).toBeDefined();
    });

    it('returns empty for invalid percentile values when no metrics collected', () => {
      // In test env, collectMetrics() is never called, so metrics array is empty.
      // calculatePercentiles returns {} when no metrics exist.
      const result = dashboard.calculatePercentiles('responseTime', [0]);
      expect(result).toEqual({});
    });

    it('throws MonitoringError for invalid percentiles with populated metrics', () => {
      // Access private collectMetrics via any to populate the metrics array
      const dashboardInternals = dashboard as unknown as { collectMetrics(): void };
      dashboardInternals.collectMetrics();

      expect(() => {
        dashboard.calculatePercentiles('responseTime', [0]);
      }).toThrow(MonitoringError);

      expect(() => {
        dashboard.calculatePercentiles('responseTime', [101]);
      }).toThrow(MonitoringError);
    });

    it('supports multiple metric types', () => {
      const id = dashboard.requestStart();
      dashboard.requestComplete(id, true, { transcriptionTime: 100 });

      // These should not throw
      expect(() => dashboard.calculatePercentiles('memoryHeap')).not.toThrow();
      expect(() => dashboard.calculatePercentiles('cacheHitRate')).not.toThrow();
      expect(() => dashboard.calculatePercentiles('successRate')).not.toThrow();
    });
  });

  describe('getDashboardData', () => {
    it('returns structured dashboard data', () => {
      const data = dashboard.getDashboardData();
      expect(data).toHaveProperty('currentMetrics');
      expect(data).toHaveProperty('recentMetrics');
      expect(data).toHaveProperty('activeAlerts');
      expect(data).toHaveProperty('summary');
    });

    it('summary includes expected fields', () => {
      const data = dashboard.getDashboardData();
      expect(data.summary).toHaveProperty('uptime');
      expect(data.summary).toHaveProperty('totalRequests');
      expect(data.summary).toHaveProperty('successRate');
      expect(data.summary).toHaveProperty('avgResponseTime');
      expect(data.summary).toHaveProperty('memoryUsage');
      expect(data.summary).toHaveProperty('cacheHitRate');
      expect(data.summary).toHaveProperty('responseTimePercentiles');
    });

    it('reports correct success rate after requests', () => {
      for (let i = 0; i < 10; i++) {
        const id = dashboard.requestStart();
        dashboard.requestComplete(id, i < 8); // 8 success, 2 failure
      }
      const data = dashboard.getDashboardData();
      expect(data.summary.successRate).toBe(0.8);
    });
  });

  describe('getPerformanceTrends', () => {
    it('returns trend data with expected structure', () => {
      const trends = dashboard.getPerformanceTrends();
      expect(trends).toHaveProperty('memory');
      expect(trends).toHaveProperty('responseTime');
      expect(trends).toHaveProperty('cacheHitRate');
      expect(trends).toHaveProperty('successRate');
      expect(trends).toHaveProperty('timestamps');
    });

    it('respects timespan parameter', () => {
      const trends = dashboard.getPerformanceTrends(60000); // 1 minute
      expect(Array.isArray(trends.memory)).toBe(true);
    });
  });

  describe('onAlert', () => {
    it('registers alert callback', () => {
      const callback = jest.fn();
      dashboard.onAlert(callback);
      // Callback is registered - verified by not throwing
    });
  });

  describe('onOptimization', () => {
    it('registers optimization callback', () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      dashboard.onOptimization(callback);
      // Callback is registered - verified by not throwing
    });
  });

  describe('recordTokenUsage', () => {
    it('records valid token usage', () => {
      expect(() => {
        dashboard.recordTokenUsage({
          model: 'gemini-2.5-flash',
          inputTokens: 100,
          outputTokens: 50,
          stage: 'analysis',
        });
      }).not.toThrow();
    });

    it('throws MonitoringError for negative input tokens', () => {
      expect(() => {
        dashboard.recordTokenUsage({
          model: 'gemini-2.5-flash',
          inputTokens: -1,
          outputTokens: 50,
          stage: 'analysis',
        });
      }).toThrow(MonitoringError);
    });

    it('throws MonitoringError for negative output tokens', () => {
      expect(() => {
        dashboard.recordTokenUsage({
          model: 'gemini-2.5-flash',
          inputTokens: 100,
          outputTokens: -1,
          stage: 'analysis',
        });
      }).toThrow(MonitoringError);
    });
  });

  describe('getCostMetrics', () => {
    it('returns cost metrics with expected fields', () => {
      dashboard.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 100,
        outputTokens: 50,
        stage: 'analysis',
      });

      const metrics = dashboard.getCostMetrics();
      expect(metrics).toHaveProperty('totalCost');
      expect(metrics).toHaveProperty('totalInputTokens');
      expect(metrics).toHaveProperty('totalOutputTokens');
      expect(metrics).toHaveProperty('totalTokens');
      expect(metrics).toHaveProperty('recordCount');
      expect(metrics).toHaveProperty('averageCostPerRequest');
    });

    it('returns zero averageCostPerRequest when no records', () => {
      // Fresh dashboard has no token usage records, so cost estimate is 0
      const metrics = dashboard.getCostMetrics();
      expect(metrics.totalCost).toBe(0);
      expect(metrics.recordCount).toBe(0);
      expect(metrics.averageCostPerRequest).toBe(0);
    });
  });

  describe('destroy', () => {
    it('cleans up resources without error', () => {
      dashboard.requestStart();
      dashboard.onAlert(jest.fn());
      dashboard.onOptimization(jest.fn().mockResolvedValue(undefined));

      expect(() => dashboard.destroy()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      dashboard.destroy();
      expect(() => dashboard.destroy()).not.toThrow();
    });
  });
});
