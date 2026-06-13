/**
 * REQ-206: Prometheus Exporter tests
 *
 * Verifies that the exporter correctly:
 * - Converts HttpMetricsSnapshot to Prometheus exposition format
 * - Produces valid HELP/TYPE headers for each metric family
 * - Sanitizes label values with special characters
 * - Handles empty snapshots (no recorded requests)
 * - Includes quantile summaries for latency percentiles
 * - Tracks error counts separately
 * - Reports active requests and uptime as gauges
 * - Exports slow request counts
 */

import {
  exportPrometheusMetrics,
  PROMETHEUS_CONTENT_TYPE,
  type PrometheusExportOptions,
} from '@/monitoring/prometheus-exporter';
import type { HttpMetricsSnapshot } from '@/monitoring/http-metrics-collector';
import type { ExportMetricsSnapshot } from '@/export/export-metrics-collector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<HttpMetricsSnapshot> = {}): HttpMetricsSnapshot {
  return {
    totalRequests: 0,
    totalErrors: 0,
    globalErrorRate: 0,
    activeRequests: 0,
    routes: [],
    slowRequests: [],
    uptime: 12345,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrometheusExporter', () => {
  // ---- Empty snapshot ----

  it('produces valid output for an empty snapshot', () => {
    const output = exportPrometheusMetrics({ snapshot: makeSnapshot() });
    expect(output).toContain('# HELP http_requests_total');
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('# HELP http_errors_total');
    expect(output).toContain('# TYPE http_errors_total counter');
    expect(output).toContain('# HELP http_active_requests');
    expect(output).toContain('# TYPE http_active_requests gauge');
    expect(output).toContain('# HELP process_uptime_ms');
    expect(output).toContain('process_uptime_ms 12345');
  });

  // ---- Request counts ----

  it('exports request counts by method, path and status class', () => {
    const snapshot = makeSnapshot({
      totalRequests: 10,
      routes: [
        {
          method: 'GET',
          path: '/api/v1/test',
          count: 10,
          errorCount: 2,
          errorRate: 0.2,
          avgMs: 55,
          minMs: 10,
          maxMs: 100,
          percentiles: { p50: 50, p95: 90, p99: 100 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // 2xx: 10 - 2 = 8
    expect(output).toMatch(/http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="2xx"\} 8/);
    // 5xx: 2
    expect(output).toMatch(/http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="5xx"\} 2/);
  });

  // ---- Error counts ----

  it('exports error counts only for routes with errors', () => {
    const snapshot = makeSnapshot({
      totalRequests: 5,
      totalErrors: 1,
      routes: [
        {
          method: 'GET',
          path: '/ok',
          count: 4,
          errorCount: 0,
          errorRate: 0,
          avgMs: 10,
          minMs: 5,
          maxMs: 15,
          percentiles: { p50: 10, p95: 15, p99: 15 },
        },
        {
          method: 'POST',
          path: '/fail',
          count: 1,
          errorCount: 1,
          errorRate: 1,
          avgMs: 200,
          minMs: 200,
          maxMs: 200,
          percentiles: { p50: 200, p95: 200, p99: 200 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // /ok route has no errors, should not appear in errors metric
    expect(output).not.toMatch(/http_errors_total\{.*path="\/ok"/);
    // /fail route has errors
    expect(output).toMatch(/http_errors_total\{method="POST",path="\/fail"\} 1/);
  });

  // ---- Latency summaries ----

  it('exports duration summary with quantiles, sum, and count', () => {
    const snapshot = makeSnapshot({
      routes: [
        {
          method: 'GET',
          path: '/api/data',
          count: 100,
          errorCount: 0,
          errorRate: 0,
          avgMs: 42,
          minMs: 5,
          maxMs: 500,
          percentiles: { p50: 38, p95: 120, p99: 350 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/http_request_duration_ms\{method="GET",path="\/api\/data",quantile="0\.5"\} 38/);
    expect(output).toMatch(/http_request_duration_ms\{method="GET",path="\/api\/data",quantile="0\.95"\} 120/);
    expect(output).toMatch(/http_request_duration_ms\{method="GET",path="\/api\/data",quantile="0\.99"\} 350/);
    // sum = avgMs * count = 42 * 100 = 4200
    expect(output).toMatch(/http_request_duration_ms_sum\{method="GET",path="\/api\/data"\} 4200/);
    expect(output).toMatch(/http_request_duration_ms_count\{method="GET",path="\/api\/data"\} 100/);
  });

  // ---- Active requests ----

  it('exports active requests as a gauge', () => {
    const snapshot = makeSnapshot({ activeRequests: 7 });
    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/http_active_requests 7/);
  });

  // ---- Slow requests ----

  it('exports slow request count', () => {
    const snapshot = makeSnapshot({
      slowRequests: [
        { method: 'GET', path: '/slow', durationMs: 6000, statusCode: 200, timestamp: Date.now(), correlationId: 'r1' },
        { method: 'POST', path: '/slower', durationMs: 8000, statusCode: 504, timestamp: Date.now(), correlationId: 'r2' },
      ],
    });
    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/http_slow_requests_total 2/);
  });

  // ---- Uptime ----

  it('exports process uptime', () => {
    const snapshot = makeSnapshot({ uptime: 99_999 });
    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/process_uptime_ms 99999/);
  });

  // ---- Label sanitization ----

  it('sanitizes label values with special characters', () => {
    const snapshot = makeSnapshot({
      routes: [
        {
          method: 'GET',
          path: '/api/v1/users?name=Test "User"',
          count: 1,
          errorCount: 0,
          errorRate: 0,
          avgMs: 10,
          minMs: 10,
          maxMs: 10,
          percentiles: { p50: 10, p95: 10, p99: 10 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // Special characters should be replaced with underscores
    expect(output).toMatch(/path="\/api\/v1\/users_name_Test__User_"/);
  });

  // ---- Multiple routes ----

  it('handles multiple routes correctly', () => {
    const snapshot = makeSnapshot({
      totalRequests: 30,
      totalErrors: 2,
      routes: [
        {
          method: 'GET',
          path: '/api/v1/a',
          count: 20,
          errorCount: 0,
          errorRate: 0,
          avgMs: 15,
          minMs: 5,
          maxMs: 50,
          percentiles: { p50: 12, p95: 40, p99: 50 },
        },
        {
          method: 'POST',
          path: '/api/v1/b',
          count: 10,
          errorCount: 2,
          errorRate: 0.2,
          avgMs: 100,
          minMs: 20,
          maxMs: 500,
          percentiles: { p50: 80, p95: 400, p99: 500 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // Both routes should have duration summaries
    expect(output).toMatch(/http_request_duration_ms_count\{method="GET",path="\/api\/v1\/a"\} 20/);
    expect(output).toMatch(/http_request_duration_ms_count\{method="POST",path="\/api\/v1\/b"\} 10/);
    // Only the error route should appear in errors
    expect(output).toMatch(/http_errors_total\{method="POST",path="\/api\/v1\/b"\} 2/);
    expect(output).not.toMatch(/http_errors_total\{method="GET"/);
  });

  // ---- Metric types ----

  it('uses correct metric types', () => {
    const output = exportPrometheusMetrics({ snapshot: makeSnapshot() });
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('# TYPE http_errors_total counter');
    expect(output).toContain('# TYPE http_request_duration_ms summary');
    expect(output).toContain('# TYPE http_active_requests gauge');
    expect(output).toContain('# TYPE http_slow_requests_total counter');
    expect(output).toContain('# TYPE process_uptime_ms gauge');
  });

  // ---- Content type constant ----

  it('exports correct content type constant', () => {
    expect(PROMETHEUS_CONTENT_TYPE).toBe('text/plain; version=0.0.4; charset=utf-8');
  });

  // ---- Output ends with newline ----

  it('ends output with a newline', () => {
    const output = exportPrometheusMetrics({ snapshot: makeSnapshot() });
    expect(output.endsWith('\n')).toBe(true);
  });

  // ---- No duplicate HELP/TYPE for same metric family ----

  it('does not produce duplicate HELP/TYPE lines for same metric', () => {
    const snapshot = makeSnapshot({
      routes: [
        {
          method: 'GET',
          path: '/a',
          count: 1,
          errorCount: 0,
          errorRate: 0,
          avgMs: 10,
          minMs: 10,
          maxMs: 10,
          percentiles: { p50: 10, p95: 10, p99: 10 },
        },
        {
          method: 'GET',
          path: '/b',
          count: 1,
          errorCount: 0,
          errorRate: 0,
          avgMs: 10,
          minMs: 10,
          maxMs: 10,
          percentiles: { p50: 10, p95: 10, p99: 10 },
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    const helpCount = (output.match(/# HELP http_requests_total/g) || []).length;
    expect(helpCount).toBe(1);
    const typeCount = (output.match(/# TYPE http_requests_total counter/g) || []).length;
    expect(typeCount).toBe(1);
  });

  // ---- REQ-229: Export queue metrics ----

  describe('export queue metrics (REQ-229)', () => {
    function makeExportSnapshot(overrides: Partial<ExportMetricsSnapshot> = {}): ExportMetricsSnapshot {
      return {
        formats: [],
        stages: [],
        totalExports: 0,
        successfulExports: 0,
        failedExports: 0,
        queue: {
          queueSize: 0,
          dequeueCount: 0,
          dequeueByPriority: { high: 0, normal: 0, low: 0 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 0, normal: 0, low: 0 },
        },
        ...overrides,
      };
    }

    it('exports queue size as a gauge', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 5,
          dequeueCount: 3,
          dequeueByPriority: { high: 1, normal: 1, low: 1 },
          avgWaitTimeMs: 200,
          priorityDistribution: { high: 2, normal: 2, low: 1 },
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_size');
      expect(output).toContain('# TYPE export_queue_size gauge');
      expect(output).toMatch(/export_queue_size 5/);
    });

    it('exports dequeue totals by priority as a counter', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 3,
          dequeueCount: 10,
          dequeueByPriority: { high: 4, normal: 5, low: 1 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 1, normal: 1, low: 1 },
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_dequeue_total');
      expect(output).toContain('# TYPE export_queue_dequeue_total counter');
      expect(output).toMatch(/export_queue_dequeue_total\{priority="high"\} 4/);
      expect(output).toMatch(/export_queue_dequeue_total\{priority="normal"\} 5/);
      expect(output).toMatch(/export_queue_dequeue_total\{priority="low"\} 1/);
    });

    it('exports average wait time as a gauge', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 1,
          dequeueCount: 5,
          dequeueByPriority: { high: 0, normal: 5, low: 0 },
          avgWaitTimeMs: 750,
          priorityDistribution: { high: 0, normal: 1, low: 0 },
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_wait_time_ms');
      expect(output).toContain('# TYPE export_queue_wait_time_ms gauge');
      expect(output).toMatch(/export_queue_wait_time_ms 750/);
    });

    it('omits queue metrics when no queue activity', () => {
      const exportSnapshot = makeExportSnapshot();

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).not.toContain('export_queue_size');
      expect(output).not.toContain('export_queue_dequeue_total');
      expect(output).not.toContain('export_queue_wait_time_ms');
    });

    it('omits wait time gauge when avg is zero', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 2,
          dequeueCount: 1,
          dequeueByPriority: { high: 0, normal: 1, low: 0 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 0, normal: 2, low: 0 },
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('export_queue_size');
      expect(output).toContain('export_queue_dequeue_total');
      expect(output).not.toContain('export_queue_wait_time_ms');
    });
  });
});
