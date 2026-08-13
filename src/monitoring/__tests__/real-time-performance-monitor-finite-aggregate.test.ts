/**
 * Finiteness contract for RealTimePerformanceMonitor ingestion chokepoints.
 *
 * recordMetric / recordRequest are the ingestion boundary for external timing
 * values (processingTime, llmResponseTime, …). Those values flow verbatim into
 * aggregates that feed the monitoring dashboard (PerformanceSnapshot), the
 * Prometheus exporter, and the deployment-readiness / health-status gate:
 *   • counters.totalProcessingTime → avgProcessingTime (getSnapshot)
 *   • performanceHistory.*        → percentileCeil p95/p99 (getSnapshot)
 *                                 → reduce() trend averages (analyzeTrends)
 *
 * A single non-finite sample (NaN / ±Infinity) at ingestion contaminates EVERY
 * downstream aggregate (NaN is sticky through +, /, Math.round, sort). This is
 * the same leak class the recordStageDuration guard closed in
 * pipeline-metrics-collector.ts — verified here the same way: feed NaN / ±∞ at
 * the ingestion chokepoint and assert finite aggregate OUTPUT.
 */
import { RealTimePerformanceMonitor } from '../real-time-performance-monitor';

jest.mock('@/utils/memory-usage', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 100 * 1024 * 1024,
    heapTotal: 200 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    rss: 150 * 1024 * 1024,
  })),
}));

describe('RealTimePerformanceMonitor — non-finite ingestion must not leak into aggregates', () => {
  let monitor: RealTimePerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new RealTimePerformanceMonitor();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('recordRequest(processingTime) → getSnapshot aggregates', () => {
    it('keeps avgProcessingTime finite when processingTime is NaN', () => {
      monitor.recordRequest(true, 100);
      monitor.recordRequest(true, NaN); // poisoned sample
      monitor.recordRequest(true, 200);

      const { pipeline } = monitor.getSnapshot();
      expect(Number.isFinite(pipeline.avgProcessingTime)).toBe(true);
      expect(pipeline.avgProcessingTime).toBeGreaterThan(0);
    });

    it('keeps avgProcessingTime finite when processingTime is +Infinity', () => {
      monitor.recordRequest(true, 100);
      monitor.recordRequest(true, Infinity);

      const { pipeline } = monitor.getSnapshot();
      expect(Number.isFinite(pipeline.avgProcessingTime)).toBe(true);
    });

    it('keeps p95/p99 percentiles finite when a processingTime sample is NaN', () => {
      for (let i = 1; i <= 20; i++) {
        monitor.recordRequest(true, i === 10 ? NaN : i * 100);
      }

      const { pipeline } = monitor.getSnapshot();
      expect(Number.isFinite(pipeline.p95ProcessingTime)).toBe(true);
      expect(Number.isFinite(pipeline.p99ProcessingTime)).toBe(true);
    });
  });

  describe('recordMetric(value) → percentile / trend aggregates', () => {
    it('keeps percentile output finite when a raw metric value is ±Infinity', () => {
      monitor.recordMetric('processingTime', 100, 'ms');
      monitor.recordMetric('processingTime', -Infinity, 'ms');
      monitor.recordMetric('processingTime', 200, 'ms');
      monitor.recordMetric('processingTime', Infinity, 'ms');

      const { pipeline } = monitor.getSnapshot();
      expect(Number.isFinite(pipeline.p95ProcessingTime)).toBe(true);
      expect(Number.isFinite(pipeline.p99ProcessingTime)).toBe(true);
    });

    it('keeps trend averages + predictions finite when a sample is NaN', () => {
      // analyzeTrends requires >= 10 samples per metric.
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('processingTime', i === 7 ? NaN : 100 + i, 'ms');
      }

      const trends = monitor.analyzeTrends();
      const pt = trends.find(t => t.metric === 'processingTime');
      expect(pt).toBeDefined();
      // changePercent, slope and the 3 horizon predictions must all stay finite.
      expect(Number.isFinite(pt!.changePercent)).toBe(true);
      expect(Number.isFinite(pt!.prediction.next5min)).toBe(true);
      expect(Number.isFinite(pt!.prediction.next15min)).toBe(true);
      expect(Number.isFinite(pt!.prediction.next1hour)).toBe(true);
    });
  });
});
