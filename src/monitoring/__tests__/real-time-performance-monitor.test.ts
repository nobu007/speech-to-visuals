/**
 * Unit tests for RealTimePerformanceMonitor
 * Covers: metrics recording, alert thresholds, trend analysis, percentile calculation,
 *         request/error tracking, snapshot generation
 */

import { RealTimePerformanceMonitor } from '../real-time-performance-monitor';
import type { PerformanceAlert, PerformanceSnapshot, TrendAnalysis } from '../real-time-performance-monitor';

// Mock dependencies
jest.mock('@/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 100 * 1024 * 1024,
    heapTotal: 200 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    rss: 150 * 1024 * 1024,
  })),
}));

describe('RealTimePerformanceMonitor', () => {
  let monitor: RealTimePerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new RealTimePerformanceMonitor();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('recordMetric', () => {
    it('emits metric event', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('processingTime', 1500, 'ms');

      expect(listener).toHaveBeenCalledTimes(1);
      const metric = listener.mock.calls[0][0];
      expect(metric.metric).toBe('processingTime');
      expect(metric.value).toBe(1500);
      expect(metric.unit).toBe('ms');
    });

    it('stores metric history', () => {
      monitor.recordMetric('processingTime', 100, 'ms');
      monitor.recordMetric('processingTime', 200, 'ms');

      const history = monitor.getMetricHistory('processingTime');
      expect(history).toHaveLength(2);
      expect(history[0].value).toBe(100);
      expect(history[1].value).toBe(200);
    });

    it('limits history to MAX_HISTORY_SIZE', () => {
      for (let i = 0; i < 1100; i++) {
        monitor.recordMetric('processingTime', i, 'ms');
      }
      const history = monitor.getMetricHistory('processingTime');
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('respects limit parameter in getMetricHistory', () => {
      for (let i = 0; i < 50; i++) {
        monitor.recordMetric('processingTime', i, 'ms');
      }
      const history = monitor.getMetricHistory('processingTime', 10);
      expect(history).toHaveLength(10);
    });

    it('returns empty array for unknown metric', () => {
      const history = monitor.getMetricHistory('nonexistent');
      expect(history).toEqual([]);
    });

    it('includes tags when provided', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('testMetric', 42, 'units', { env: 'test' });

      expect(listener.mock.calls[0][0].tags).toEqual({ env: 'test' });
    });
  });

  describe('alert thresholds', () => {
    it('emits warning alert for processingTime', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 65000, 'ms'); // > 60000 warning threshold

      expect(alertListener).toHaveBeenCalledTimes(1);
      const alert: PerformanceAlert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('warning');
      expect(alert.metric).toBe('processingTime');
    });

    it('emits critical alert for processingTime', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 130000, 'ms'); // > 120000 critical threshold

      expect(alertListener).toHaveBeenCalledTimes(1);
      const alert: PerformanceAlert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('critical');
    });

    it('emits alert for high errorRate', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('errorRate', 0.08, 'percent'); // > 0.05 warning

      expect(alertListener).toHaveBeenCalled();
    });

    it('handles inverted threshold metrics (cacheHitRate)', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      // cacheHitRate: warning 0.3, critical 0.1 — lower is worse
      monitor.recordMetric('cacheHitRate', 0.2, 'percent'); // < 0.3 warning

      expect(alertListener).toHaveBeenCalled();
      const alert: PerformanceAlert = alertListener.mock.calls[0][0];
      expect(alert.severity).toBe('warning');
    });

    it('does not alert for normal values', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 1000, 'ms'); // Below all thresholds

      expect(alertListener).not.toHaveBeenCalled();
    });

    it('supports custom alert thresholds', () => {
      monitor.setAlertThreshold('customMetric', { warning: 50, critical: 100 });
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('customMetric', 60, 'units');
      expect(alertListener).toHaveBeenCalled();
    });

    it('includes recommendation in alerts', () => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);

      monitor.recordMetric('processingTime', 130000, 'ms');

      const alert: PerformanceAlert = alertListener.mock.calls[0][0];
      expect(alert.recommendation).toBeDefined();
      expect(typeof alert.recommendation).toBe('string');
      expect(alert.recommendation.length).toBeGreaterThan(0);
    });

    it('limits alerts to 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        monitor.recordMetric('processingTime', 130000 + i, 'ms');
      }
      const activeAlerts = monitor.getActiveAlerts();
      // Some alerts may have expired, but we verify it doesn't grow unbounded
      expect(activeAlerts.length).toBeLessThanOrEqual(100);
    });
  });

  describe('severity calculation', () => {
    it('returns info severity for values within thresholds', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('processingTime', 100, 'ms');
      expect(listener.mock.calls[0][0].severity).toBe('info');
    });

    it('returns warning severity for values between warning and critical', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('processingTime', 70000, 'ms');
      expect(listener.mock.calls[0][0].severity).toBe('warning');
    });

    it('returns critical severity for values above critical threshold', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('processingTime', 130000, 'ms');
      expect(listener.mock.calls[0][0].severity).toBe('critical');
    });

    it('returns info for unknown metrics without thresholds', () => {
      const listener = jest.fn();
      monitor.on('metric', listener);
      monitor.recordMetric('unknownMetric', 999, 'x');
      expect(listener.mock.calls[0][0].severity).toBe('info');
    });
  });

  describe('recordRequest', () => {
    it('tracks successful requests', () => {
      monitor.recordRequest(true, 500);
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(1);
      expect(snapshot.pipeline.successRate).toBe(1);
    });

    it('tracks failed requests', () => {
      monitor.recordRequest(false, 500);
      monitor.recordRequest(true, 300);
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(2);
      expect(snapshot.pipeline.successRate).toBe(0.5);
    });

    it('records processing time metrics', () => {
      monitor.recordRequest(true, 1500);
      const history = monitor.getMetricHistory('processingTime');
      expect(history.some(m => m.value === 1500)).toBe(true);
    });
  });

  describe('trackActiveRequest', () => {
    it('increments and decrements active requests', () => {
      monitor.trackActiveRequest(1);
      monitor.trackActiveRequest(1);
      const snap1 = monitor.getSnapshot();
      expect(snap1.pipeline.activeRequests).toBe(2);

      monitor.trackActiveRequest(-1);
      const snap2 = monitor.getSnapshot();
      expect(snap2.pipeline.activeRequests).toBe(1);
    });
  });

  describe('recordLLMRequest', () => {
    it('tracks LLM requests and cache hits', () => {
      monitor.recordLLMRequest('gemini-2.5-flash', 2000, false);
      monitor.recordLLMRequest('gemini-2.5-flash', 100, true);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.llm.totalRequests).toBe(2);
      expect(snapshot.llm.cacheHitRate).toBe(0.5);
    });

    it('records cacheHitRate metric', () => {
      monitor.recordLLMRequest('gemini-2.5-pro', 5000, true);
      const history = monitor.getMetricHistory('cacheHitRate');
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('recordError', () => {
    it('tracks errors and recovery', () => {
      monitor.recordError('transcription', true);
      monitor.recordError('pipeline', false);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.errors.totalErrors).toBe(2);
      expect(snapshot.errors.recoverySuccessRate).toBe(0.5);
    });
  });

  describe('getSnapshot', () => {
    it('returns complete PerformanceSnapshot', () => {
      monitor.recordRequest(true, 500);
      monitor.recordLLMRequest('gemini-2.5-flash', 2000, false);

      const snapshot: PerformanceSnapshot = monitor.getSnapshot();
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('pipeline');
      expect(snapshot).toHaveProperty('llm');
      expect(snapshot).toHaveProperty('system');
      expect(snapshot).toHaveProperty('errors');
      expect(snapshot).toHaveProperty('quality');
      // uptime was previously computed (now - monitoringStartTime) but dropped
      // at the return boundary — assert it now propagates (ms, >= 0).
      expect(snapshot).toHaveProperty('uptime');
      expect(typeof snapshot.uptime).toBe('number');
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });

    it('calculates P95/P99 processing times', () => {
      for (let i = 1; i <= 20; i++) {
        monitor.recordRequest(true, i * 100);
      }

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.p95ProcessingTime).toBeGreaterThan(0);
      expect(snapshot.pipeline.p99ProcessingTime).toBeGreaterThanOrEqual(snapshot.pipeline.p95ProcessingTime);
    });

    it('returns zero percentiles with no data', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.p95ProcessingTime).toBe(0);
      expect(snapshot.pipeline.p99ProcessingTime).toBe(0);
    });

    it('includes system memory metrics', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.system.memoryUsageMB).toBeGreaterThan(0);
      expect(snapshot.system.memoryUsagePercent).toBeGreaterThan(0);
      expect(snapshot.system.memoryUsagePercent).toBeLessThanOrEqual(100);
    });

    it('defaults successRate to 1 with no requests', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.successRate).toBe(1);
    });
  });

  describe('analyzeTrends', () => {
    it('returns empty array with insufficient data', () => {
      const trends = monitor.analyzeTrends();
      expect(trends).toEqual([]);
    });

    it('analyzes trends when enough data exists', () => {
      // Generate 15 data points for processing time
      for (let i = 0; i < 15; i++) {
        monitor.recordRequest(true, 1000 + i * 100);
      }

      const trends: TrendAnalysis[] = monitor.analyzeTrends();
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('metric');
      expect(trends[0]).toHaveProperty('trend');
      expect(trends[0]).toHaveProperty('changePercent');
      expect(trends[0]).toHaveProperty('prediction');
      expect(trends[0]).toHaveProperty('confidence');
    });

    it('trend prediction includes time horizons', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordRequest(true, 1000 + i * 50);
      }

      const trends = monitor.analyzeTrends();
      if (trends.length > 0) {
        expect(trends[0].prediction).toHaveProperty('next5min');
        expect(trends[0].prediction).toHaveProperty('next15min');
        expect(trends[0].prediction).toHaveProperty('next1hour');
      }
    });

    it('trend values are non-negative', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordRequest(true, 1000 + i * 50);
      }

      const trends = monitor.analyzeTrends();
      for (const trend of trends) {
        expect(trend.prediction.next5min).toBeGreaterThanOrEqual(0);
        expect(trend.prediction.next15min).toBeGreaterThanOrEqual(0);
        expect(trend.prediction.next1hour).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getActiveAlerts', () => {
    it('returns empty array when no alerts', () => {
      const alerts = monitor.getActiveAlerts();
      expect(alerts).toEqual([]);
    });

    it('returns alerts within expiry window', () => {
      monitor.recordMetric('processingTime', 130000, 'ms');
      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('resets all counters and history', () => {
      monitor.recordRequest(true, 500);
      monitor.recordLLMRequest('gemini-2.5-flash', 2000, false);
      monitor.recordError('test', true);

      monitor.reset();

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pipeline.totalRequests).toBe(0);
      expect(snapshot.llm.totalRequests).toBe(0);
      expect(snapshot.errors.totalErrors).toBe(0);
    });

    it('clears alert history', () => {
      monitor.recordMetric('processingTime', 130000, 'ms');
      monitor.reset();
      expect(monitor.getActiveAlerts()).toEqual([]);
    });

    it('clears metric history', () => {
      monitor.recordMetric('processingTime', 1000, 'ms');
      monitor.reset();
      expect(monitor.getMetricHistory('processingTime')).toEqual([]);
    });
  });
});
