/**
 * Tests for prometheus-exporter.ts (REQ-206 + REQ-212 + REQ-226 + REQ-229)
 *
 * Verifies Prometheus exposition format generation including:
 * - HTTP metrics (request totals, errors, duration, active requests, slow requests, uptime)
 * - Pipeline metrics (stage duration, runs total)
 * - Batch job metrics (total by status, active)
 * - Export metrics (duration, operations, file size, stage duration)
 * - Export queue metrics (size, dequeue, wait time, DLQ, retry, replay)
 * - Label sanitization
 * - Prefix support
 * - Prometheus format validity
 */
import { describe, it, expect } from '@jest/globals';
import {
  exportPrometheusMetrics,
  PROMETHEUS_CONTENT_TYPE,
  type PrometheusExportOptions,
} from '../prometheus-exporter';
import type { HttpMetricsSnapshot } from '../http-metrics-collector';
import type { PipelineMetricsSnapshot } from '../pipeline-metrics-collector';
import type { ExportMetricsSnapshot } from '../../export/export-metrics-collector';

// --- Test data factories ---

function makeHttpSnapshot(overrides?: Partial<HttpMetricsSnapshot>): HttpMetricsSnapshot {
  return {
    activeRequests: 5,
    slowRequests: [],
    uptime: 60000,
    totalRequests: 100,
    routes: [
      {
        method: 'GET',
        path: '/api/v1/health',
        count: 80,
        errorCount: 2,
        avgMs: 50,
        minMs: 10,
        maxMs: 200,
        percentiles: { p50: 40, p95: 150, p99: 190 },
        // 78×200 + 2×404 — both errors are CLIENT errors (4xx)
        statusClassCounts: { '1xx': 0, '2xx': 78, '3xx': 0, '4xx': 2, '5xx': 0 },
      },
      {
        method: 'POST',
        path: '/api/v1/pipeline',
        count: 20,
        errorCount: 3,
        avgMs: 5000,
        minMs: 1000,
        maxMs: 15000,
        percentiles: { p50: 4000, p95: 12000, p99: 14000 },
        statusClassCounts: { '1xx': 0, '2xx': 17, '3xx': 0, '4xx': 0, '5xx': 3 },
      },
    ],
    ...overrides,
  };
}

function makePipelineSnapshot(overrides?: Partial<PipelineMetricsSnapshot>): PipelineMetricsSnapshot {
  return {
    stages: [
      {
        stage: 'transcription',
        count: 10,
        sumMs: 50000,
        percentiles: { p50: 4000, p95: 8000, p99: 9500 },
      },
      {
        stage: 'analysis',
        count: 10,
        sumMs: 30000,
        percentiles: { p50: 2500, p95: 5000, p99: 5500 },
      },
    ],
    totalRuns: 10,
    successfulRuns: 8,
    failedRuns: 2,
    batchJobs: {
      activeJobs: 2,
      jobsByStatus: {
        created: 5,
        running: 2,
        completed: 10,
        failed: 1,
        cancelled: 0,
        'dead-lettered': 0,
      },
    },
    ...overrides,
  };
}

function makeExportSnapshot(overrides?: Partial<ExportMetricsSnapshot>): ExportMetricsSnapshot {
  return {
    formats: [
      {
        format: 'svg',
        successfulExports: 5,
        failedExports: 1,
        duration: {
          count: 6,
          sumMs: 12000,
          percentiles: { p50: 1500, p95: 3000, p99: 3500 },
        },
        fileSize: {
          count: 5,
          sum: 500000,
          min: 50000,
          max: 200000,
          percentiles: { p50: 80000, p95: 180000, p99: 195000 },
        },
      },
    ],
    stages: [
      {
        stage: 'preparing',
        count: 6,
        sumMs: 6000,
        percentiles: { p50: 800, p95: 1500, p99: 1800 },
      },
    ],
    queue: {
      queueSize: 5,
      dequeueCount: 20,
      avgWaitTimeMs: 3000,
      dequeueByPriority: { high: 10, normal: 8, low: 2 },
      dlqSize: 1,
      totalRetries: 3,
      totalDeadLettered: 1,
      totalReplayed: 0,
    },
    ...overrides,
  };
}

// --- Tests ---

describe('prometheus-exporter', () => {
  describe('PROMETHEUS_CONTENT_TYPE', () => {
    it('should be a valid Prometheus content type', () => {
      expect(PROMETHEUS_CONTENT_TYPE).toBe('text/plain; version=0.0.4; charset=utf-8');
    });
  });

  describe('exportPrometheusMetrics - HTTP metrics', () => {
    const options: PrometheusExportOptions = {
      snapshot: makeHttpSnapshot(),
      pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
      exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
    };

    it('should include HELP and TYPE comments for each metric', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('# HELP http_requests_total');
      expect(output).toContain('# TYPE http_requests_total counter');
      expect(output).toContain('# HELP http_errors_total');
      expect(output).toContain('# TYPE http_errors_total counter');
      expect(output).toContain('# HELP http_request_duration_ms');
      expect(output).toContain('# TYPE http_request_duration_ms summary');
      expect(output).toContain('# HELP http_active_requests');
      expect(output).toContain('# TYPE http_active_requests gauge');
      expect(output).toContain('# HELP http_slow_requests_total');
      expect(output).toContain('# TYPE http_slow_requests_total counter');
      expect(output).toContain('# HELP process_uptime_ms');
      expect(output).toContain('# TYPE process_uptime_ms gauge');
    });

    it('should export request totals with status_class labels', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('http_requests_total{method="GET",path="/api/v1/health",status_class="2xx"}');
      // The 2 errors on /health are 404s — client errors, class "4xx"
      expect(output).toContain('http_requests_total{method="GET",path="/api/v1/health",status_class="4xx"} 2');
      expect(output).not.toContain('http_requests_total{method="GET",path="/api/v1/health",status_class="5xx"}');
    });

    it('should derive each class from the recorded status-class counts, not total minus errors', () => {
      const output = exportPrometheusMetrics(options);
      // GET /api/v1/health: 78×200 + 2×404 → 2xx=78, 4xx=2 (NOT 2xx=78 via
      // 80-2 with the two errors folded into a fake 5xx bucket)
      expect(output).toMatch(/http_requests_total.*path="\/api\/v1\/health".*status_class="2xx".* 78/);
      expect(output).toMatch(/http_requests_total.*path="\/api\/v1\/health".*status_class="4xx".* 2/);
      // POST /api/v1/pipeline: 17×200 + 3×503 → 5xx=3
      expect(output).toMatch(/http_requests_total.*path="\/api\/v1\/pipeline".*status_class="5xx".* 3/);
    });

    it('should export error totals', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('http_errors_total{method="GET",path="/api/v1/health"} 2');
      expect(output).toContain('http_errors_total{method="POST",path="/api/v1/pipeline"} 3');
    });

    it('should export duration summary with quantiles', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('quantile="0.5"');
      expect(output).toContain('quantile="0.95"');
      expect(output).toContain('quantile="0.99"');
      expect(output).toContain('_sum');
      expect(output).toContain('_count');
    });

    it('should export active requests gauge', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('http_active_requests 5');
    });

    it('should export slow requests counter', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('http_slow_requests_total 0');
    });

    it('should export uptime gauge', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toContain('process_uptime_ms 60000');
    });
  });

  describe('exportPrometheusMetrics - pipeline metrics', () => {
    it('should export pipeline stage durations when stages exist', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).toContain('# HELP pipeline_stage_duration_ms');
      expect(output).toContain('# TYPE pipeline_stage_duration_ms summary');
      expect(output).toContain('stage="transcription"');
      expect(output).toContain('stage="analysis"');
    });

    it('should export pipeline runs total when totalRuns > 0', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).toContain('# HELP pipeline_runs_total');
      expect(output).toContain('pipeline_runs_total{status="success"} 8');
      expect(output).toContain('pipeline_runs_total{status="failure"} 2');
    });

    it('should NOT export pipeline metrics when stages empty and totalRuns 0', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).not.toContain('pipeline_stage_duration_ms');
      expect(output).not.toContain('pipeline_runs_total');
    });
  });

  describe('exportPrometheusMetrics - batch job metrics', () => {
    it('should export batch job totals by status', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).toContain('# HELP batch_jobs_total');
      expect(output).toContain('batch_jobs_total{status="created"} 5');
      expect(output).toContain('batch_jobs_total{status="running"} 2');
      expect(output).toContain('batch_jobs_total{status="completed"} 10');
      expect(output).toContain('batch_jobs_total{status="failed"} 1');
    });

    it('should export batch active jobs gauge', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).toContain('batch_jobs_active 2');
    });

    it('should skip zero-count batch statuses', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output).not.toContain('batch_jobs_total{status="cancelled"}');
      expect(output).not.toContain('batch_jobs_total{status="dead-lettered"}');
    });
  });

  describe('exportPrometheusMetrics - export pipeline metrics (REQ-226)', () => {
    it('should export export duration summary per format', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot(),
      });
      expect(output).toContain('# HELP export_duration_ms');
      expect(output).toContain('# TYPE export_duration_ms summary');
      expect(output).toContain('format="svg"');
    });

    it('should export export operations total by format and status', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot(),
      });
      expect(output).toContain('export_operations_total{format="svg",status="success"} 5');
      expect(output).toContain('export_operations_total{format="svg",status="failure"} 1');
    });

    it('should export file size summary when file sizes exist', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot(),
      });
      expect(output).toContain('# HELP export_file_size_bytes');
      expect(output).toContain('# TYPE export_file_size_bytes summary');
    });

    it('should NOT export file size when count is 0', () => {
      const exportSnap = makeExportSnapshot();
      exportSnap.formats[0].fileSize.count = 0;
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: exportSnap,
      });
      expect(output).not.toContain('export_file_size_bytes');
    });

    it('should export stage duration when stages exist', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot(),
      });
      expect(output).toContain('# HELP export_stage_duration_ms');
      expect(output).toContain('stage="preparing"');
    });
  });

  describe('exportPrometheusMetrics - export queue metrics (REQ-229)', () => {
    it('should export queue size gauge', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [] }),
      });
      expect(output).toContain('export_queue_size 5');
    });

    it('should export dequeue total by priority', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [] }),
      });
      expect(output).toContain('export_queue_dequeue_total{priority="high"} 10');
      expect(output).toContain('export_queue_dequeue_total{priority="normal"} 8');
      expect(output).toContain('export_queue_dequeue_total{priority="low"} 2');
    });

    it('should export wait time gauge when > 0', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [] }),
      });
      expect(output).toContain('export_queue_wait_time_ms 3000');
    });

    it('should export DLQ metrics when DLQ has activity', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [] }),
      });
      expect(output).toContain('export_queue_dlq_size 1');
      expect(output).toContain('export_queue_retry_total 3');
      expect(output).toContain('export_queue_dead_letter_total 1');
    });

    it('should NOT export DLQ metrics when no DLQ activity', () => {
      const exportSnap = makeExportSnapshot({ formats: [], stages: [] });
      exportSnap.queue.dlqSize = 0;
      exportSnap.queue.totalRetries = 0;
      exportSnap.queue.totalDeadLettered = 0;
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: exportSnap,
      });
      expect(output).not.toContain('export_queue_dlq_size');
      expect(output).not.toContain('export_queue_retry_total');
      expect(output).not.toContain('export_queue_dead_letter_total');
    });

    it('should export replay total when replays > 0', () => {
      const exportSnap = makeExportSnapshot({ formats: [], stages: [] });
      exportSnap.queue.totalReplayed = 5;
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: exportSnap,
      });
      expect(output).toContain('export_queue_dlq_replay_total 5');
    });

    it('should NOT export replay total when 0', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [] }),
      });
      expect(output).not.toContain('export_queue_dlq_replay_total');
    });
  });

  describe('exportPrometheusMetrics - edge cases', () => {
    it('should handle empty snapshot with no routes', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [], activeRequests: 0, totalRequests: 0, uptime: 0 }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      // Should still emit basic HTTP metrics (even with 0 values)
      expect(output).toContain('http_active_requests 0');
      expect(output).toContain('process_uptime_ms 0');
      expect(output).toContain('http_slow_requests_total 0');
    });

    it('should NOT emit error samples for routes with zero errors', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({
          routes: [{
            method: 'GET',
            path: '/ok',
            count: 10,
            errorCount: 0,
            avgMs: 10,
            minMs: 5,
            maxMs: 20,
            percentiles: { p50: 8, p95: 18, p99: 20 },
            statusClassCounts: { '1xx': 0, '2xx': 10, '3xx': 0, '4xx': 0, '5xx': 0 },
          }],
        }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      // HELP/TYPE lines are always present, but no data samples should follow
      const errorDataLines = output.split('\n').filter(l =>
        l.startsWith('http_errors_total{') && !l.startsWith('#'),
      );
      expect(errorDataLines).toHaveLength(0);
    });

    it('should end output with newline', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      expect(output.endsWith('\n')).toBe(true);
    });
  });

  describe('exportPrometheusMetrics - format validity', () => {
    it('should produce valid Prometheus text format', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot(),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot(),
      });
      const lines = output.trim().split('\n');
      // Every non-comment, non-empty line should be a valid metric line
      for (const line of lines) {
        if (line.startsWith('#') || line === '') continue;
        // Metric line format: metric_name{labels} value or metric_name value
        expect(line).toMatch(/^\S+/);
        expect(line).toContain(' ');
      }
    });

    it('should have consistent metric names (snake_case)', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot(),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot(),
      });
      // Extract all metric names from TYPE lines
      const typeLines = output.match(/^# TYPE (\S+)/gm) || [];
      for (const typeLine of typeLines) {
        const name = typeLine.replace('# TYPE ', '');
        expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });

    it('should not contain raw newlines in label values (injection prevention)', () => {
      // Simulate a malicious path with embedded newline that could inject fake metric lines
      const maliciousPath = '/api/v1/health\n# HELP fake_metric_total injected';
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({
          routes: [{
            method: 'GET',
            path: maliciousPath,
            count: 1,
            errorCount: 0,
            avgMs: 10,
            minMs: 5,
            maxMs: 20,
            percentiles: { p50: 8, p95: 18, p99: 20 },
            statusClassCounts: { '1xx': 0, '2xx': 1, '3xx': 0, '4xx': 0, '5xx': 0 },
          }],
        }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      // The key assertion: no output line should start with "# HELP fake_metric"
      // (i.e., the embedded newline cannot create a fake HELP line)
      const lines = output.split('\n');
      const fakeHelpLines = lines.filter(l => l.startsWith('# HELP fake_metric'));
      expect(fakeHelpLines).toHaveLength(0);
      // Also verify: no output line should be a fake metric data line
      const fakeDataLines = lines.filter(l => l.startsWith('fake_metric_total'));
      expect(fakeDataLines).toHaveLength(0);
    });

    it('should escape backslashes and double quotes in label values', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({
          routes: [{
            method: 'GET',
            path: '/api/v1/\\test"path',
            count: 1,
            errorCount: 0,
            avgMs: 10,
            minMs: 5,
            maxMs: 20,
            percentiles: { p50: 8, p95: 18, p99: 20 },
            statusClassCounts: { '1xx': 0, '2xx': 1, '3xx': 0, '4xx': 0, '5xx': 0 },
          }],
        }),
        pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0 }),
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 } }),
      });
      // Backslashes and quotes should be escaped per Prometheus spec
      expect(output).toContain('\\\\');
      expect(output).toContain('\\"');
    });
  });

  describe('publish-path finiteness backstop (renderMetric)', () => {
    // Empty snapshots for the non-exercised collectors keep output deterministic.
    const emptyQueue = { queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {}, dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0 };

    it('coerces a non-finite sample value to 0 so exposition never emits NaN/Infinity', () => {
      // A snapshot carrying non-finite percentile/sum values (the exact residue
      // an ingestion-guard MISS would leave) reaches the builder, which pushes
      // them as sample.value. renderMetric must coerce — otherwise the output
      // contains literal `NaN` / `Infinity` tokens (invalid exposition; every
      // NaN alert comparison is false → silent alert disablement).
      const poisoned = makePipelineSnapshot({
        stages: [
          {
            stage: 'rendering',
            count: 1,
            sumMs: Infinity,
            avgMs: NaN,
            minMs: 0,
            maxMs: -Infinity,
            percentiles: { p50: 0, p95: NaN, p99: -Infinity },
          },
        ],
        totalRuns: 1,
        successfulRuns: 1,
        failedRuns: 0,
      });

      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot({ routes: [] }),
        pipelineSnapshot: poisoned,
        exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: emptyQueue }),
      });

      expect(output).toContain('pipeline_stage_duration_ms');
      expect(output).not.toMatch(/NaN/);
      expect(output).not.toMatch(/Infinity/);
      // Coerced _sum (Infinity→0) and p95 (NaN→0) render as 0.
      expect(output).toMatch(/pipeline_stage_duration_ms_sum\{stage="rendering"\} 0/);
      expect(output).toMatch(/pipeline_stage_duration_ms\{stage="rendering",quantile="0.95"\} 0/);
    });

    it('leaves finite sample values untouched (backstop is behavior-preserving for valid data)', () => {
      const output = exportPrometheusMetrics({
        snapshot: makeHttpSnapshot(),
        pipelineSnapshot: makePipelineSnapshot(),
        exportSnapshot: makeExportSnapshot(),
      });
      // A real finite p95 (8000) round-trips unchanged through the backstop.
      expect(output).toMatch(/pipeline_stage_duration_ms\{stage="transcription",quantile="0.95"\} 8000/);
      expect(output).not.toMatch(/NaN/);
      expect(output).not.toMatch(/Infinity/);
    });
  });

  describe('exportPrometheusMetrics - prefix support', () => {
    const emptyQueue = {
      queueSize: 0, dequeueCount: 0, avgWaitTimeMs: 0, dequeueByPriority: {},
      dlqSize: 0, totalRetries: 0, totalDeadLettered: 0, totalReplayed: 0,
    };
    const options: PrometheusExportOptions = {
      snapshot: makeHttpSnapshot(),
      pipelineSnapshot: makePipelineSnapshot({ stages: [], totalRuns: 0, successfulRuns: 0, failedRuns: 0, batchJobs: { activeJobs: 0, jobsByStatus: { created: 0, running: 0, completed: 0, failed: 0, cancelled: 0, 'dead-lettered': 0 } } }),
      exportSnapshot: makeExportSnapshot({ formats: [], stages: [], queue: emptyQueue }),
      prefix: 's2v',
    };

    it('prefixes HELP/TYPE comments and the samples Prometheus scrapes', () => {
      const output = exportPrometheusMetrics(options);
      expect(output).toMatch(/^# HELP s2v_http_requests_total /m);
      expect(output).toMatch(/^# TYPE s2v_http_requests_total counter/m);
      // Sample lines too — previously ONLY the comment lines were rewritten,
      // so every dashboard/alert query with the same prefix matched nothing.
      expect(output).toMatch(/^s2v_http_requests_total\{method="GET",path="\/api\/v1\/health",status_class="2xx"\} 78/m);
      expect(output).toMatch(/^s2v_http_active_requests 5/m);
    });

    it('leaves no unprefixed sample line when a prefix is set', () => {
      const output = exportPrometheusMetrics(options);
      for (const line of output.split('\n')) {
        if (line.startsWith('#') || line.trim() === '') continue;
        expect(line.startsWith('s2v_')).toBe(true);
      }
    });
  });
});
