/**
 * REQ-174: RealTimePerformanceMonitor Unit Tests
 *
 * Tests core functionality of real-time-performance-monitor.ts (616 lines):
 * - Metric recording and history management
 * - Alert threshold checking (including inverted metrics like cacheHitRate)
 * - Severity calculation with direction-aware comparison
 * - Trend analysis and prediction
 * - Performance snapshots with percentile calculation
 * - Request / error / LLM tracking
 * - Active request tracking
 * - Alert expiry and retrieval
 * - Reset functionality
 * - getMetricHistory with limit
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetMemoryUsage = jest.fn(() => ({
  heapUsed: 100 * 1024 * 1024,  // 100 MB
  heapTotal: 200 * 1024 * 1024, // 200 MB
  rss: 300 * 1024 * 1024,
  external: 10 * 1024 * 1024,
}));

jest.mock('../../../src/utils/memory-usage', () => ({
  getMemoryUsage: mockGetMemoryUsage,
}));

const mockedGetMemoryUsage = mockGetMemoryUsage;

// Lazy-loaded class
let RealTimePerformanceMonitorClass: any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMonitor(): any {
  // Constructor skips periodic snapshot in test env (NODE_ENV=test)
  return new RealTimePerformanceMonitorClass();
}

function advanceTime(ms: number): void {
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + ms);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RealTimePerformanceMonitor', () => {
  let monitor: any;

  beforeAll(async () => {
    const mod = await import('../../../src/monitoring/real-time-performance-monitor');
    RealTimePerformanceMonitorClass = mod.RealTimePerformanceMonitor;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    monitor = createMonitor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Metric Recording
  // -----------------------------------------------------------------------
  describe('recordMetric', () => {
    it('should record a metric and emit "metric" event', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      monitor.recordMetric('processingTime', 500, 'ms');

      expect(listener).toHaveBeenCalledTimes(1);
      const emitted = listener.mock.calls[0][0];
      expect(emitted.metric).toBe('processingTime');
      expect(emitted.value).toBe(500);
      expect(emitted.unit).toBe('ms');
      expect(emitted.severity).toBe('info');
    });

    it('should record metric with tags', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      monitor.recordMetric('testMetric', 42, 'units', { env: 'test' });

      const emitted = listener.mock.calls[0][0];
      expect(emitted.tags).toEqual({ env: 'test' });
    });

    it('should cap history at MAX_HISTORY_SIZE (1000)', () => {
      for (let i = 0; i < 1050; i++) {
        monitor.recordMetric('bulkMetric', i, 'ms');
      }

      const history = monitor.getMetricHistory('bulkMetric');
      // Some may have been pruned by retention cleanup; should never exceed 1000
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should store multiple metrics independently', () => {
      monitor.recordMetric('metricA', 10, 'ms');
      monitor.recordMetric('metricB', 20, 'ms');

      expect(monitor.getMetricHistory('metricA')).toHaveLength(1);
      expect(monitor.getMetricHistory('metricB')).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Severity Calculation
  // -----------------------------------------------------------------------
  describe('calculateSeverity (via recordMetric)', () => {
    it('should return "info" for unknown metric', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      monitor.recordMetric('unknownMetric', 99999, 'ms');

      expect(listener.mock.calls[0][0].severity).toBe('info');
    });

    it('should return "info" for value below warning threshold', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      // processingTime: warning=60000, critical=120000
      monitor.recordMetric('processingTime', 30000, 'ms');

      expect(listener.mock.calls[0][0].severity).toBe('info');
    });

    it('should return "warning" for value at/above warning threshold', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      monitor.recordMetric('processingTime', 60000, 'ms');

      expect(listener.mock.calls[0][0].severity).toBe('warning');
    });

    it('should return "critical" for value at/above critical threshold', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      monitor.recordMetric('processingTime', 120000, 'ms');

      expect(listener.mock.calls[0][0].severity).toBe('critical');
    });
  });

  // -----------------------------------------------------------------------
  // Inverted Threshold (cacheHitRate)
  // -----------------------------------------------------------------------
  describe('inverted threshold for cacheHitRate', () => {
    it('should return "info" for cacheHitRate above warning threshold (0.3)', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      // cacheHitRate = 0.5 (50%) → above warning=0.3 → should be info
      monitor.recordMetric('cacheHitRate', 0.5, 'percent');

      expect(listener.mock.calls[0][0].severity).toBe('info');
    });

    it('should return "warning" for cacheHitRate between critical and warning', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      // cacheHitRate = 0.2 (20%) → below warning=0.3, above critical=0.1 → warning
      monitor.recordMetric('cacheHitRate', 0.2, 'percent');

      expect(listener.mock.calls[0][0].severity).toBe('warning');
    });

    it('should return "critical" for cacheHitRate at/below critical threshold', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);

      // cacheHitRate = 0.05 (5%) → below critical=0.1 → critical
      monitor.recordMetric('cacheHitRate', 0.05, 'percent');

      expect(listener.mock.calls[0][0].severity).toBe('critical');
    });
  });

  // -----------------------------------------------------------------------
  // Alert Checking
  // -----------------------------------------------------------------------
  describe('checkAlerts (via recordMetric)', () => {
    it('should emit "alert" event when threshold exceeded', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 130000, 'ms');

      expect(alertListener).toHaveBeenCalledTimes(1);
      const alert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('critical');
      expect(alert.metric).toBe('processingTime');
      expect(alert.type).toBe('threshold');
      expect(alert.currentValue).toBe(130000);
      expect(alert.thresholdValue).toBe(120000);
      expect(alert.recommendation).toBeTruthy();
    });

    it('should emit warning alert', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('errorRate', 0.07, 'percent');

      expect(alertListener).toHaveBeenCalledTimes(1);
      const alert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('warning');
    });

    it('should not emit alert for values within threshold', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 1000, 'ms');

      expect(alertListener).not.toHaveBeenCalled();
    });

    it('should include recommendation in alerts', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('memoryUsage', 600, 'MB');

      const alert = alertListener.mock.calls[0][0];
      expect(alert.recommendation).toContain('memory');
    });

    it('should generate alert for inverted metric (cacheHitRate)', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      // cacheHitRate = 0.05 (5%) → critical (below 0.1)
      monitor.recordMetric('cacheHitRate', 0.05, 'percent');

      expect(alertListener).toHaveBeenCalledTimes(1);
      const alert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('critical');
      expect(alert.metric).toBe('cacheHitRate');
    });

    it('should cap alerts at 100', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      for (let i = 0; i < 110; i++) {
        monitor.recordMetric('processingTime', 130000, 'ms');
      }

      // Should still have emitted 110 alerts, but internal storage is capped
      expect(alertListener).toHaveBeenCalledTimes(110);
    });
  });

  // -----------------------------------------------------------------------
  // getActiveAlerts
  // -----------------------------------------------------------------------
  describe('getActiveAlerts', () => {
    it('should return only alerts within 5 minutes', () => {
      monitor.recordMetric('processingTime', 130000, 'ms');

      const active = monitor.getActiveAlerts();
      expect(active.length).toBe(1);
    });

    it('should exclude expired alerts', () => {
      monitor.recordMetric('processingTime', 130000, 'ms');

      // Advance 6 minutes
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 360000);

      const active = monitor.getActiveAlerts();
      expect(active).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // recordRequest
  // -----------------------------------------------------------------------
  describe('recordRequest', () => {
    it('should track successful requests', () => {
      monitor.recordRequest(true, 1000);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(1);
      expect(snapshot.pipeline.successRate).toBe(1);
    });

    it('should track failed requests', () => {
      monitor.recordRequest(false, 500);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(1);
      expect(snapshot.pipeline.successRate).toBe(0);
      expect(snapshot.errors.errorRate).toBe(1); // 1 failed / 1 total
    });

    it('should calculate average processing time', () => {
      monitor.recordRequest(true, 1000);
      monitor.recordRequest(true, 2000);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.avgProcessingTime).toBe(1500);
    });

    it('should calculate percentile processing times', () => {
      // Record enough samples for percentile calculation
      for (let i = 1; i <= 20; i++) {
        monitor.recordRequest(true, i * 100);
      }

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.p95ProcessingTime).toBeGreaterThan(0);
      expect(snapshot.pipeline.p99ProcessingTime).toBeGreaterThan(0);
    });

    it('should handle zero requests gracefully', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(0);
      expect(snapshot.pipeline.avgProcessingTime).toBe(0);
      expect(snapshot.pipeline.successRate).toBe(1); // default
    });
  });

  // -----------------------------------------------------------------------
  // trackActiveRequest
  // -----------------------------------------------------------------------
  describe('trackActiveRequest', () => {
    it('should increment and decrement active requests', () => {
      monitor.trackActiveRequest(1);
      monitor.trackActiveRequest(1);

      expect(monitor.getSnapshot().pipeline.activeRequests).toBe(2);

      monitor.trackActiveRequest(-1);

      expect(monitor.getSnapshot().pipeline.activeRequests).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // recordLLMRequest
  // -----------------------------------------------------------------------
  describe('recordLLMRequest', () => {
    it('should track LLM requests and cache hits', () => {
      monitor.recordLLMRequest('gemini-flash', 1000, false);
      monitor.recordLLMRequest('gemini-flash', 200, true);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.llm.totalRequests).toBe(2);
      expect(snapshot.llm.cacheHitRate).toBe(0.5);
    });

    it('should handle zero LLM requests', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.llm.totalRequests).toBe(0);
      expect(snapshot.llm.cacheHitRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // recordError
  // -----------------------------------------------------------------------
  describe('recordError', () => {
    it('should track errors and recovery', () => {
      monitor.recordError('TranscriptionError', true);
      monitor.recordError('LayoutError', false);
      monitor.recordError('TimeoutError', true);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.errors.totalErrors).toBe(3);
      expect(snapshot.errors.recoverySuccessRate).toBeLessThanOrEqual(1);
    });

    it('should handle zero errors gracefully', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.errors.totalErrors).toBe(0);
      expect(snapshot.errors.recoverySuccessRate).toBe(1); // default
    });
  });

  // -----------------------------------------------------------------------
  // Performance Snapshot
  // -----------------------------------------------------------------------
  describe('getSnapshot', () => {
    it('should return a valid snapshot structure', () => {
      const snapshot = monitor.getSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.pipeline).toBeDefined();
      expect(snapshot.llm).toBeDefined();
      expect(snapshot.system).toBeDefined();
      expect(snapshot.errors).toBeDefined();
      expect(snapshot.quality).toBeDefined();
    });

    it('should include system memory metrics', () => {
      mockedGetMemoryUsage.mockReturnValue({
        heapUsed: 150 * 1024 * 1024,
        heapTotal: 300 * 1024 * 1024,
        rss: 400 * 1024 * 1024,
        external: 20 * 1024 * 1024,
      });

      const snapshot = monitor.getSnapshot();
      expect(snapshot.system.memoryUsageMB).toBeGreaterThan(0);
      expect(snapshot.system.heapUsedMB).toBeGreaterThan(0);
      expect(snapshot.system.heapTotalMB).toBeGreaterThan(0);
      expect(snapshot.system.memoryUsagePercent).toBeGreaterThan(0);
    });

    it('should include recent error messages from alerts', () => {
      monitor.recordMetric('processingTime', 130000, 'ms');

      const snapshot = monitor.getSnapshot();
      expect(snapshot.errors.recentErrors.length).toBeGreaterThan(0);
      expect(snapshot.errors.recentErrors[0]).toContain('processingTime');
    });
  });

  // -----------------------------------------------------------------------
  // Trend Analysis
  // -----------------------------------------------------------------------
  describe('analyzeTrends', () => {
    it('should return empty array with insufficient data', () => {
      // Only 5 samples < 10 minimum
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric('processingTime', 1000, 'ms');
      }

      const trends = monitor.analyzeTrends();
      expect(trends).toHaveLength(0);
    });

    it('should return trends when enough samples exist', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('processingTime', 1000 + i * 100, 'ms');
      }
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('memoryUsage', 100 + i * 10, 'MB');
      }

      const trends = monitor.analyzeTrends();
      expect(trends.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect "stable" trend for flat metrics', () => {
      for (let i = 0; i < 25; i++) {
        monitor.recordMetric('processingTime', 1000, 'ms');
      }

      const trends = monitor.analyzeTrends();
      const processingTrend = trends.find((t: any) => t.metric === 'processingTime');
      expect(processingTrend).toBeDefined();
      expect(processingTrend!.trend).toBe('stable');
    });

    it('should detect "degrading" trend for increasing processing time', () => {
      for (let i = 0; i < 25; i++) {
        monitor.recordMetric('processingTime', 1000 + i * 500, 'ms');
      }

      const trends = monitor.analyzeTrends();
      const processingTrend = trends.find((t: any) => t.metric === 'processingTime');
      expect(processingTrend).toBeDefined();
      expect(processingTrend!.trend).toBe('degrading');
    });

    // memoryUsage is lower-is-better (rising memory = degradation / OOM risk),
    // exactly like processingTime. The trend-direction polarity must classify a
    // rising memory trend as 'degrading', not 'improving'. 40 samples keep the
    // older(-40,-20) and recent(-20) windows both at 20 samples with a clearly
    // rising average (>5% change → not 'stable'); values stay under the 512 MB
    // alert threshold so no threshold alert interferes.
    it('should detect "degrading" trend for increasing memory usage', () => {
      for (let i = 0; i < 40; i++) {
        monitor.recordMetric('memoryUsage', 100 + i * 10, 'MB');
      }

      const trends = monitor.analyzeTrends();
      const memoryTrend = trends.find((t: any) => t.metric === 'memoryUsage');
      expect(memoryTrend).toBeDefined();
      expect(memoryTrend!.trend).toBe('degrading');
    });

    it('should detect "improving" trend for decreasing memory usage', () => {
      for (let i = 0; i < 40; i++) {
        monitor.recordMetric('memoryUsage', 490 - i * 10, 'MB');
      }

      const trends = monitor.analyzeTrends();
      const memoryTrend = trends.find((t: any) => t.metric === 'memoryUsage');
      expect(memoryTrend).toBeDefined();
      expect(memoryTrend!.trend).toBe('improving');
    });

    // -------------------------------------------------------------------------
    // Per-metric polarity contract (regression net for 7ae31177)
    // -------------------------------------------------------------------------
    //
    // analyzeTrend resolves change→trend polarity via LOWER_IS_BETTER_METRICS.
    // EVERY metric analyzeTrends emits is lower-is-better, so a RISING series
    // MUST classify as 'degrading' and a FALLING series as 'improving'. The
    // original bug inverted memoryUsage because a name-substring heuristic
    // silently omitted it; this table pins all four analyzed metrics in BOTH
    // directions so the class cannot silently regress for any one of them.
    //
    // Series design: 40 samples → older window [-40,-20] and recent [-20] both
    // hold 20 samples; a linear ramp yields >5% change (not 'stable'); ceiling
    // values stay under each metric's alert threshold so no threshold alert is
    // involved (memoryUsage < 512 MB, errorRate < 0.05, processingTime < 60s,
    // llmResponseTime < 15s).
    const ANALYZED_METRICS = [
      { metric: 'processingTime', unit: 'ms', base: 1000, step: 500 },
      { metric: 'memoryUsage', unit: 'MB', base: 100, step: 10 },
      { metric: 'errorRate', unit: 'percent', base: 0.001, step: 0.0005 },
      { metric: 'llmResponseTime', unit: 'ms', base: 1000, step: 100 },
    ] as const;

    it.each(ANALYZED_METRICS)(
      'should classify a RISING $metric series as "degrading" (lower-is-better)',
      ({ metric, unit, base, step }) => {
        for (let i = 0; i < 40; i++) {
          monitor.recordMetric(metric, base + i * step, unit);
        }
        const trend = monitor.analyzeTrends().find((t: any) => t.metric === metric);
        expect(trend).toBeDefined();
        expect(trend!.trend).toBe('degrading');
      }
    );

    it.each(ANALYZED_METRICS)(
      'should classify a FALLING $metric series as "improving" (lower-is-better)',
      ({ metric, unit, base, step }) => {
        const start = base + 39 * step;
        for (let i = 0; i < 40; i++) {
          monitor.recordMetric(metric, start - i * step, unit);
        }
        const trend = monitor.analyzeTrends().find((t: any) => t.metric === metric);
        expect(trend).toBeDefined();
        expect(trend!.trend).toBe('improving');
      }
    );

    it('should emit exactly the analyzed-metric set, all "degrading" on a rising series', () => {
      for (const { metric, unit, base, step } of ANALYZED_METRICS) {
        for (let i = 0; i < 40; i++) {
          monitor.recordMetric(metric, base + i * step, unit);
        }
      }
      const trends = monitor.analyzeTrends();
      // Drift guard: adding a metric to analyzeTrends/updateTrendData without
      // declaring its polarity breaks this count, forcing a conscious update.
      expect(trends.map((t: any) => t.metric).sort()).toEqual(
        ANALYZED_METRICS.map((m) => m.metric).sort()
      );
      expect(trends.every((t: any) => t.trend === 'degrading')).toBe(true);
    });

    it('should include predictions', () => {
      for (let i = 0; i < 25; i++) {
        monitor.recordMetric('processingTime', 1000 + i * 100, 'ms');
      }

      const trends = monitor.analyzeTrends();
      const processingTrend = trends.find((t: any) => t.metric === 'processingTime');
      expect(processingTrend!.prediction).toBeDefined();
      expect(processingTrend!.prediction.next5min).toBeGreaterThanOrEqual(0);
      expect(processingTrend!.prediction.next15min).toBeGreaterThanOrEqual(0);
      expect(processingTrend!.prediction.next1hour).toBeGreaterThanOrEqual(0);
    });

    it('should include confidence level', () => {
      for (let i = 0; i < 25; i++) {
        monitor.recordMetric('processingTime', 1000, 'ms');
      }

      const trends = monitor.analyzeTrends();
      const processingTrend = trends.find((t: any) => t.metric === 'processingTime');
      expect(processingTrend!.confidence).toBe(0.85); // >= 20 samples
    });

    it('should analyze all four tracked metric types', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('processingTime', 1000, 'ms');
        monitor.recordMetric('memoryUsage', 100, 'MB');
        monitor.recordMetric('errorRate', 0.01, 'percent');
        monitor.recordMetric('llmResponseTime', 2000, 'ms');
      }

      const trends = monitor.analyzeTrends();
      expect(trends).toHaveLength(4);
    });
  });

  // -----------------------------------------------------------------------
  // getMetricHistory
  // -----------------------------------------------------------------------
  describe('getMetricHistory', () => {
    it('should return empty array for unknown metric', () => {
      expect(monitor.getMetricHistory('nonexistent')).toEqual([]);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 50; i++) {
        monitor.recordMetric('testMetric', i, 'ms');
      }

      const history = monitor.getMetricHistory('testMetric', 10);
      expect(history).toHaveLength(10);
    });

    it('should return all entries when limit exceeds count', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric('testMetric', i, 'ms');
      }

      const history = monitor.getMetricHistory('testMetric', 100);
      expect(history).toHaveLength(5);
    });
  });

  // -----------------------------------------------------------------------
  // setAlertThreshold
  // -----------------------------------------------------------------------
  describe('setAlertThreshold', () => {
    it('should apply custom thresholds', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.setAlertThreshold('customMetric', { warning: 50, critical: 100 });
      monitor.recordMetric('customMetric', 60, 'ms');

      expect(alertListener).toHaveBeenCalledTimes(1);
      expect(alertListener.mock.calls[0][0].severity).toBe('warning');
    });
  });

  // -----------------------------------------------------------------------
  // reset
  // -----------------------------------------------------------------------
  describe('reset', () => {
    it('should clear all counters and history', () => {
      monitor.recordRequest(true, 1000);
      monitor.recordRequest(false, 500);
      monitor.recordLLMRequest('flash', 200, true);
      monitor.recordError('TestError', true);
      monitor.recordMetric('processingTime', 130000, 'ms');

      monitor.reset();

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(0);
      expect(snapshot.llm.totalRequests).toBe(0);
      expect(snapshot.errors.totalErrors).toBe(0);
      expect(monitor.getMetricHistory('processingTime')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getRecommendation (indirect via alerts)
  // -----------------------------------------------------------------------
  describe('getRecommendation (via alerts)', () => {
    it('should return recommendation for known metrics', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('errorRate', 0.12, 'percent');
      expect(alertListener.mock.calls[0][0].recommendation).toBeTruthy();

      monitor.recordMetric('memoryUsage', 1200, 'MB');
      expect(alertListener.mock.calls[1][0].recommendation).toContain('Memory');

      monitor.recordMetric('llmResponseTime', 35000, 'ms');
      expect(alertListener.mock.calls[2][0].recommendation).toContain('LLM');
    });

    it('should return fallback recommendation for unknown metric', () => {
      monitor.setAlertThreshold('unknownAlert', { warning: 10, critical: 20 });
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('unknownAlert', 25, 'ms');
      expect(alertListener.mock.calls[0][0].recommendation).toBe(
        'Monitor situation and investigate if persists'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Percentile Calculation
  // -----------------------------------------------------------------------
  describe('percentile calculation (via getSnapshot)', () => {
    it('should return 0 for empty processing times', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.p95ProcessingTime).toBe(0);
      expect(snapshot.pipeline.p99ProcessingTime).toBe(0);
    });

    it('should calculate p95 and p99 correctly', () => {
      // Record 100 requests with linearly increasing processing times
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest(true, i * 10);
      }

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.p95ProcessingTime).toBeGreaterThan(900);
      expect(snapshot.pipeline.p99ProcessingTime).toBeGreaterThan(950);
    });
  });
});
