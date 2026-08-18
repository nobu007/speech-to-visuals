/**
 * Tests for NaN/Infinity filtering in PerformanceDashboard.
 *
 * Guards verify that:
 * 1. calculateAvgResponseTime filters out non-finite totalTime values
 * 2. analyzePerformance degradation comparison filters NaN avgResponseTime
 * 3. Alerts still fire correctly when some (but not all) metrics have NaN
 */

jest.mock('@stv/core/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 100 * 1024 * 1024,
    heapTotal: 200 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    rss: 150 * 1024 * 1024,
  })),
}));

jest.mock('@/analysis/token-usage-tracker', () => ({
  TokenUsageTracker: jest.fn().mockImplementation(() => ({
    recordTokenUsage: jest.fn(),
    getSummary: jest.fn(() => ({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      recordCount: 0,
    })),
    getRecords: jest.fn(() => []),
    reset: jest.fn(),
  })),
  type: {},
}));

jest.mock('@/analysis/cost-estimator', () => ({
  estimateCost: jest.fn(() => ({
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
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

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { PerformanceDashboard } from '../performance-dashboard';

describe('PerformanceDashboard NaN/Infinity guards', () => {
  let dashboard: PerformanceDashboard;

  beforeEach(() => {
    dashboard = new PerformanceDashboard();
  });

  afterEach(() => {
    dashboard.destroy();
  });

  /** White-box access to private members */
  function internals(d: PerformanceDashboard) {
    return d as unknown as {
      metrics: Array<{
        timestamp: number;
        throughput: { avgResponseTime: number; requestsPerSecond: number; concurrentRequests: number };
        processing: { transcriptionTime: number; analysisTime: number; layoutTime: number; renderTime: number; totalTime: number };
        memory: { heapUsed: number; heapTotal: number; external: number; rss: number };
        cache: { hitRate: number; efficiency: number; memoryUsage: number; size: number };
        quality: { successRate: number; errorRate: number; accuracyScore: number };
      }>;
      analyzePerformance: () => void;
      calculateAvgResponseTime: () => number;
      alerts: Array<{ category: string; message: string }>;
      createAlert: (level: string, category: string, message: string, metric: string, value: number, threshold: number, rec: string) => void;
    };
  }

  function makeMetric(
    avgResponseTime: number,
    totalTime: number = avgResponseTime,
  ) {
    return {
      timestamp: Date.now(),
      throughput: {
        avgResponseTime,
        requestsPerSecond: 1,
        concurrentRequests: 1,
      },
      processing: {
        transcriptionTime: 0,
        analysisTime: 0,
        layoutTime: 0,
        renderTime: 0,
        totalTime,
      },
      memory: { heapUsed: 100, heapTotal: 200, external: 10, rss: 150 },
      cache: { hitRate: 0.85, efficiency: 0.9, memoryUsage: 1024, size: 50 },
      quality: { successRate: 1, errorRate: 0, accuracyScore: 0.95 },
    };
  }

  // ── calculateAvgResponseTime ───────────────────────────────────

  describe('calculateAvgResponseTime filters non-finite totalTime', () => {
    test('returns 0 when fewer than 5 metrics', () => {
      const i = internals(dashboard);
      for (let n = 0; n < 3; n++) i.metrics.push(makeMetric(100));
      expect(i.calculateAvgResponseTime()).toBe(0);
    });

    test('returns correct average with all valid values', () => {
      const i = internals(dashboard);
      for (let n = 0; n < 5; n++) i.metrics.push(makeMetric(100, 200));
      // totalTime values are all 200
      expect(i.calculateAvgResponseTime()).toBe(200);
    });

    test('NaN totalTime is filtered from calculation', () => {
      const i = internals(dashboard);
      i.metrics.push(makeMetric(100, 100));
      i.metrics.push(makeMetric(100, 200));
      i.metrics.push(makeMetric(100, NaN));
      i.metrics.push(makeMetric(100, 300));
      i.metrics.push(makeMetric(100, 400));
      // Valid: [100, 200, 300, 400] → mean = 250
      expect(i.calculateAvgResponseTime()).toBe(250);
    });

    test('Infinity totalTime is filtered from calculation', () => {
      const i = internals(dashboard);
      i.metrics.push(makeMetric(100, 100));
      i.metrics.push(makeMetric(100, Infinity));
      i.metrics.push(makeMetric(100, 200));
      i.metrics.push(makeMetric(100, 300));
      i.metrics.push(makeMetric(100, 400));
      // Valid: [100, 200, 300, 400] → mean = 250
      expect(i.calculateAvgResponseTime()).toBe(250);
    });

    test('-Infinity totalTime is filtered from calculation', () => {
      const i = internals(dashboard);
      i.metrics.push(makeMetric(100, 100));
      i.metrics.push(makeMetric(100, -Infinity));
      i.metrics.push(makeMetric(100, 200));
      i.metrics.push(makeMetric(100, 300));
      i.metrics.push(makeMetric(100, 400));
      // Valid: [100, 200, 300, 400] → mean = 250
      expect(i.calculateAvgResponseTime()).toBe(250);
    });

    test('returns 0 when ALL totalTime values are NaN', () => {
      const i = internals(dashboard);
      for (let n = 0; n < 5; n++) i.metrics.push(makeMetric(100, NaN));
      expect(i.calculateAvgResponseTime()).toBe(0);
    });
  });

  // ── analyzePerformance degradation analysis ─────────────────────

  describe('analyzePerformance degradation analysis filters NaN avgResponseTime', () => {
    test('does not crash when recent metrics contain NaN avgResponseTime', () => {
      const i = internals(dashboard);
      // Need >= 10 metrics for degradation analysis
      for (let n = 0; n < 10; n++) {
        i.metrics.push(makeMetric(NaN));
      }
      for (let n = 0; n < 10; n++) {
        i.metrics.push(makeMetric(100));
      }
      expect(() => i.analyzePerformance()).not.toThrow();
    });

    test('does not crash when earlier metrics contain NaN avgResponseTime', () => {
      const i = internals(dashboard);
      // Fill with valid data first
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(100));
      // Then add some NaN
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(NaN));
      // Add valid recent data
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(100));
      expect(() => i.analyzePerformance()).not.toThrow();
    });

    test('degradation alert fires correctly when only valid values show degradation', () => {
      const i = internals(dashboard);
      // Earlier: low response times (10 metrics)
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(50));
      // Recent: high response times (10 metrics) — 3x degradation
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(150));
      i.analyzePerformance();
      // Should have created a performance degradation alert
      const perfAlerts = i.alerts.filter(a => a.category === 'performance');
      expect(perfAlerts.length).toBeGreaterThan(0);
    });

    test('degradation alert still fires when some recent metrics have NaN', () => {
      const i = internals(dashboard);
      // Earlier: low response times (10 metrics)
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(50));
      // Recent: mix of NaN and high values (10 metrics)
      for (let n = 0; n < 10; n++) {
        i.metrics.push(makeMetric(n % 3 === 0 ? NaN : 150));
      }
      i.analyzePerformance();
      // Should still fire because valid recent values (150) >> earlier values (50)
      const perfAlerts = i.alerts.filter(a => a.category === 'performance');
      expect(perfAlerts.length).toBeGreaterThan(0);
    });

    test('no degradation alert when ALL recent metrics are NaN', () => {
      const i = internals(dashboard);
      // Earlier: valid low values
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(50));
      // Recent: all NaN
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(NaN));
      i.analyzePerformance();
      // Should NOT fire because no valid recent data to compare
      const perfAlerts = i.alerts.filter(
        a => a.category === 'performance' && a.message.includes('degradation')
      );
      expect(perfAlerts).toHaveLength(0);
    });

    test('no degradation alert when ALL earlier metrics are NaN', () => {
      const i = internals(dashboard);
      // Earlier: all NaN
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(NaN));
      // Recent: valid values
      for (let n = 0; n < 10; n++) i.metrics.push(makeMetric(150));
      i.analyzePerformance();
      // Should NOT fire because no valid earlier baseline
      const perfAlerts = i.alerts.filter(
        a => a.category === 'performance' && a.message.includes('degradation')
      );
      expect(perfAlerts).toHaveLength(0);
    });
  });
});
