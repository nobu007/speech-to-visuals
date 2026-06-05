/**
 * REQ-206 + REQ-212: Prometheus-Compatible Metrics Exporter
 *
 * Converts HttpMetricsCollector and PipelineMetricsCollector data into
 * Prometheus exposition format for external monitoring systems.
 *
 * Exposed metrics:
 * - http_requests_total (counter by method, path, status_class)
 * - http_request_duration_ms (summary with quantiles per route)
 * - http_errors_total (counter by method, path)
 * - http_active_requests (gauge)
 * - http_slow_requests_total (counter)
 * - process_uptime_ms (gauge)
 * - pipeline_stage_duration_ms (summary with quantiles per pipeline stage)
 * - pipeline_runs_total (counter by status: success/failure)
 */

import {
  httpMetricsCollector,
  type HttpMetricsSnapshot,
  type RouteMetricsSnapshot,
} from './http-metrics-collector';
import {
  pipelineMetricsCollector,
  type PipelineMetricsSnapshot,
  type StageDurationAggregate,
} from './pipeline-metrics-collector';

// ---------------------------------------------------------------------------
// Prometheus types
// ---------------------------------------------------------------------------

export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'summary' | 'histogram';
  samples: Array<{
    labels: Record<string, string>;
    value: number;
    suffix?: string; // e.g. '_sum', '_count' for summaries
  }>;
}

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

/** Prometheus label values must be strings; sanitize to prevent injection. */
function sanitizeLabelValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_/.\\-]/g, '_').slice(0, 200);
}

/** Convert a path like /api/v1/monitoring/health to api_v1_monitoring_health. */
function pathToMetricSuffix(path: string): string {
  return path
    .replace(/^\/+/, '')
    .replace(/\/+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_$/, '')
    || 'root';
}

function statusCodeClass(code: number): string {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  const pairs = entries.map(([k, v]) => `${k}="${sanitizeLabelValue(v)}"`);
  return `{${pairs.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Metric builders
// ---------------------------------------------------------------------------

function buildRequestTotal(routes: RouteMetricsSnapshot[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const r of routes) {
    const labels = { method: r.method, path: r.path };
    samples.push({
      labels: { ...labels, status_class: '2xx' },
      value: r.count - r.errorCount,
    });
    if (r.errorCount > 0) {
      samples.push({
        labels: { ...labels, status_class: '5xx' },
        value: r.errorCount,
      });
    }
  }
  return { name: 'http_requests_total', help: 'Total HTTP requests by method, path and status class', type: 'counter', samples };
}

function buildErrorsTotal(routes: RouteMetricsSnapshot[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const r of routes) {
    if (r.errorCount > 0) {
      samples.push({ labels: { method: r.method, path: r.path }, value: r.errorCount });
    }
  }
  return { name: 'http_errors_total', help: 'Total HTTP errors (4xx+5xx) by method and path', type: 'counter', samples };
}

function buildDurationSummary(routes: RouteMetricsSnapshot[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const r of routes) {
    const labels = { method: r.method, path: r.path };
    // Quantiles
    for (const [q, val] of [['0.5', r.percentiles.p50], ['0.95', r.percentiles.p95], ['0.99', r.percentiles.p99]] as const) {
      samples.push({ labels: { ...labels, quantile: q }, value: val });
    }
    samples.push({ labels, value: r.avgMs * r.count, suffix: '_sum' });
    samples.push({ labels, value: r.count, suffix: '_count' });
  }
  return { name: 'http_request_duration_ms', help: 'HTTP request duration in milliseconds (summary with quantiles)', type: 'summary', samples };
}

function buildActiveRequests(snapshot: HttpMetricsSnapshot): PrometheusMetric {
  return {
    name: 'http_active_requests',
    help: 'Number of currently active HTTP requests',
    type: 'gauge',
    samples: [{ labels: {}, value: snapshot.activeRequests }],
  };
}

function buildSlowRequests(snapshot: HttpMetricsSnapshot): PrometheusMetric {
  return {
    name: 'http_slow_requests_total',
    help: 'Total number of slow requests recorded (exceeded threshold)',
    type: 'counter',
    samples: [{ labels: {}, value: snapshot.slowRequests.length }],
  };
}

function buildUptime(snapshot: HttpMetricsSnapshot): PrometheusMetric {
  return {
    name: 'process_uptime_ms',
    help: 'Process uptime in milliseconds',
    type: 'gauge',
    samples: [{ labels: {}, value: snapshot.uptime }],
  };
}

// ---------------------------------------------------------------------------
// Format renderer
// ---------------------------------------------------------------------------

function renderMetric(metric: PrometheusMetric): string {
  const lines: string[] = [];
  lines.push(`# HELP ${metric.name} ${metric.help}`);
  lines.push(`# TYPE ${metric.name} ${metric.type}`);

  for (const sample of metric.samples) {
    const suffix = sample.suffix ?? '';
    const labelStr = formatLabels(sample.labels);
    lines.push(`${metric.name}${suffix}${labelStr} ${sample.value}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Pipeline metric builders (REQ-212)
// ---------------------------------------------------------------------------

function buildPipelineStageDuration(stages: StageDurationAggregate[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const s of stages) {
    const labels = { stage: s.stage };
    for (const [q, val] of [['0.5', s.percentiles.p50], ['0.95', s.percentiles.p95], ['0.99', s.percentiles.p99]] as const) {
      samples.push({ labels: { ...labels, quantile: q }, value: val });
    }
    samples.push({ labels, value: s.sumMs, suffix: '_sum' });
    samples.push({ labels, value: s.count, suffix: '_count' });
  }
  return {
    name: 'pipeline_stage_duration_ms',
    help: 'Pipeline stage execution duration in milliseconds (summary with quantiles)',
    type: 'summary',
    samples,
  };
}

function buildPipelineRunsTotal(pipelineSnap: PipelineMetricsSnapshot): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  if (pipelineSnap.successfulRuns > 0) {
    samples.push({ labels: { status: 'success' }, value: pipelineSnap.successfulRuns });
  }
  if (pipelineSnap.failedRuns > 0) {
    samples.push({ labels: { status: 'failure' }, value: pipelineSnap.failedRuns });
  }
  return {
    name: 'pipeline_runs_total',
    help: 'Total pipeline runs by outcome status',
    type: 'counter',
    samples,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PrometheusExportOptions {
  /** Optional custom snapshot instead of live collector data */
  snapshot?: HttpMetricsSnapshot;
  /** Optional custom pipeline snapshot instead of live collector data */
  pipelineSnapshot?: PipelineMetricsSnapshot;
  /** Optional namespace prefix (default: '') */
  prefix?: string;
}

/**
 * Generate Prometheus exposition-format text from HTTP and pipeline metrics.
 *
 * See: https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export function exportPrometheusMetrics(options?: PrometheusExportOptions): string {
  const snapshot = options?.snapshot ?? httpMetricsCollector.getSnapshot();
  const pipelineSnap = options?.pipelineSnapshot ?? pipelineMetricsCollector.getSnapshot();
  const prefix = options?.prefix ?? '';

  const metrics: PrometheusMetric[] = [
    buildRequestTotal(snapshot.routes),
    buildErrorsTotal(snapshot.routes),
    buildDurationSummary(snapshot.routes),
    buildActiveRequests(snapshot),
    buildSlowRequests(snapshot),
    buildUptime(snapshot),
  ];

  // Append pipeline metrics only when data exists
  if (pipelineSnap.stages.length > 0) {
    metrics.push(buildPipelineStageDuration(pipelineSnap.stages));
  }
  if (pipelineSnap.totalRuns > 0) {
    metrics.push(buildPipelineRunsTotal(pipelineSnap));
  }

  const output = metrics.map(renderMetric).join('\n\n');

  if (prefix) {
    return output.replace(/^(# (?:HELP|TYPE) )(\w)/gm, `$1${prefix}${'$2'}`);
  }

  return output + '\n';
}

/** Content type for Prometheus exposition format. */
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';
