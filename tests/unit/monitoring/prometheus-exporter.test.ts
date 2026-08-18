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

/** Zeroed per-class counts, so fixtures only state the classes they mean. */
function classes(overrides: Record<string, number> = {}): Record<string, number> {
  return { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, ...overrides };
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
          // 7×200 + 1×301 + 2×404 — the two errors are CLIENT (4xx) errors
          statusClassCounts: classes({ '2xx': 7, '3xx': 1, '4xx': 2 }),
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // Per-class counts come from the recorded breakdown, NOT "count minus errors"
    expect(output).toMatch(/http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="2xx"\} 7/);
    expect(output).toMatch(/http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="3xx"\} 1/);
    expect(output).toMatch(/http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="4xx"\} 2/);
  });

  it('never exports 4xx client errors as status_class="5xx"', () => {
    // A 404-storm on a bad path must not surface as 5xx "server" errors on a
    // Grafana panel or an error-budget alert — the two-bucket
    // (count − errorCount vs errorCount) rendering did exactly that.
    const snapshot = makeSnapshot({
      totalRequests: 1000,
      totalErrors: 1000,
      routes: [
        {
          method: 'GET',
          path: '/api/v1/nonexistent',
          count: 1000,
          errorCount: 1000,
          errorRate: 1,
          avgMs: 5,
          minMs: 1,
          maxMs: 10,
          percentiles: { p50: 5, p95: 8, p99: 10 },
          statusClassCounts: classes({ '4xx': 1000 }),
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/status_class="4xx"\} 1000/);
    expect(output).not.toMatch(/status_class="5xx"/);
  });

  it('does not fold 3xx redirects into the 2xx bucket', () => {
    const snapshot = makeSnapshot({
      totalRequests: 5,
      routes: [
        {
          method: 'GET',
          path: '/redirector',
          count: 5,
          errorCount: 0,
          errorRate: 0,
          avgMs: 10,
          minMs: 5,
          maxMs: 20,
          percentiles: { p50: 10, p95: 20, p99: 20 },
          statusClassCounts: classes({ '2xx': 2, '3xx': 3 }),
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    expect(output).toMatch(/status_class="2xx"\} 2/);
    expect(output).toMatch(/status_class="3xx"\} 3/);
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
          statusClassCounts: classes({ '2xx': 4 }),
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
          statusClassCounts: classes({ '5xx': 1 }),
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
          statusClassCounts: classes({ '2xx': 100 }),
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
          statusClassCounts: classes({ '2xx': 1 }),
        },
      ],
    });

    const output = exportPrometheusMetrics({ snapshot });
    // Double quotes should be escaped per Prometheus spec
    expect(output).toContain('\\"');
    // Should not contain unescaped quotes inside label values
    expect(output).not.toContain('path="/api/v1/users?name=Test "User""');
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
          statusClassCounts: classes({ '2xx': 20 }),
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
          statusClassCounts: classes({ '2xx': 8, '4xx': 2 }),
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
          statusClassCounts: classes({ '2xx': 1 }),
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
          statusClassCounts: classes({ '2xx': 1 }),
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
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
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
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
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
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
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
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
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
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
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

    it('exports DLQ size as a gauge', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 0,
          dequeueCount: 0,
          dequeueByPriority: { high: 0, normal: 0, low: 0 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 0, normal: 0, low: 0 },
          dlqSize: 3,
          totalRetries: 0,
          totalDeadLettered: 0,
          totalReplayed: 0,
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_dlq_size');
      expect(output).toContain('# TYPE export_queue_dlq_size gauge');
      expect(output).toMatch(/export_queue_dlq_size 3/);
    });

    it('exports retry total as a counter', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 0,
          dequeueCount: 0,
          dequeueByPriority: { high: 0, normal: 0, low: 0 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 0, normal: 0, low: 0 },
          dlqSize: 0,
          totalRetries: 7,
          totalDeadLettered: 0,
          totalReplayed: 0,
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_retry_total');
      expect(output).toContain('# TYPE export_queue_retry_total counter');
      expect(output).toMatch(/export_queue_retry_total 7/);
    });

    it('exports dead letter total as a counter', () => {
      const exportSnapshot = makeExportSnapshot({
        queue: {
          queueSize: 0,
          dequeueCount: 0,
          dequeueByPriority: { high: 0, normal: 0, low: 0 },
          avgWaitTimeMs: 0,
          priorityDistribution: { high: 0, normal: 0, low: 0 },
          dlqSize: 0,
          totalRetries: 0,
          totalDeadLettered: 2,
          totalReplayed: 0,
        },
      });

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).toContain('# HELP export_queue_dead_letter_total');
      expect(output).toContain('# TYPE export_queue_dead_letter_total counter');
      expect(output).toMatch(/export_queue_dead_letter_total 2/);
    });

    it('omits DLQ/retry metrics when no DLQ/retry activity', () => {
      const exportSnapshot = makeExportSnapshot();

      const output = exportPrometheusMetrics({
        snapshot: makeSnapshot(),
        exportSnapshot,
      });

      expect(output).not.toContain('export_queue_dlq_size');
      expect(output).not.toContain('export_queue_retry_total');
      expect(output).not.toContain('export_queue_dead_letter_total');
    });
  });

  // ---- Prefix support (metric namespace) ----

  describe('prefix support', () => {
    const snapshot = makeSnapshot({
      totalRequests: 3,
      routes: [
        {
          method: 'GET',
          path: '/api/v1/test',
          count: 3,
          errorCount: 1,
          errorRate: 1 / 3,
          avgMs: 20,
          minMs: 10,
          maxMs: 30,
          percentiles: { p50: 20, p95: 30, p99: 30 },
          statusClassCounts: classes({ '2xx': 2, '5xx': 1 }),
        },
      ],
    });

    it('prefixes sample lines, not just HELP/TYPE comments', () => {
      const output = exportPrometheusMetrics({ snapshot, prefix: 's2v' });
      // The samples Prometheus actually scrapes must carry the prefix —
      // previously only `# HELP`/`# TYPE` comment lines were rewritten, so
      // HELP declared s2v_http_requests_total while the sample line emitted
      // http_requests_total (name mismatch inside one exposition).
      expect(output).toMatch(/^s2v_http_requests_total\{method="GET",path="\/api\/v1\/test",status_class="2xx"\} 2$/m);
      expect(output).toMatch(/^# HELP s2v_http_requests_total /m);
      expect(output).toMatch(/^# TYPE s2v_http_requests_total counter/m);
      expect(output).toMatch(/^s2v_http_active_requests 0$/m);
    });

    it('leaves no unprefixed metric name behind when a prefix is set', () => {
      const output = exportPrometheusMetrics({ snapshot, prefix: 's2v' });
      // Any line that starts a sample with the unprefixed family name means
      // dashboard/alert queries (which DO honor ?prefix=) can never match it.
      for (const line of output.split('\n')) {
        if (line.startsWith('#') || line.trim() === '') continue;
        expect(line.startsWith('s2v_')).toBe(true);
      }
    });

    it('leaves the exposition unprefixed when no prefix is given', () => {
      const output = exportPrometheusMetrics({ snapshot });
      expect(output).toMatch(/^# HELP http_requests_total /m);
      expect(output).not.toContain('s2v_');
    });
  });
});
