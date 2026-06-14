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
 * - batch_jobs_total (counter by status: created/running/completed/failed/cancelled)
 * - batch_jobs_active (gauge: currently running batch jobs)
 * - export_duration_ms (summary with quantiles per format)  [REQ-226]
 * - export_operations_total (counter by format × status)    [REQ-226]
 * - export_file_size_bytes (summary with quantiles per format) [REQ-226]
 * - export_stage_duration_ms (summary with quantiles per stage) [REQ-226]
 * - export_queue_size (gauge)                                [REQ-229]
 * - export_queue_dequeue_total (counter by priority)         [REQ-229]
 * - export_queue_wait_time_ms (gauge)                        [REQ-229]
 * - export_queue_dlq_size (gauge)                            [REQ-229]
 * - export_queue_retry_total (counter)                       [REQ-229]
 * - export_queue_dead_letter_total (counter)                 [REQ-229]
 * - export_queue_dlq_replay_total (counter)                  [REQ-229]
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
  type BatchJobMetricsSnapshot,
} from './pipeline-metrics-collector';
import {
  exportMetricsCollector,
  type ExportMetricsSnapshot,
  type ExportFormatMetrics,
  type ExportStageDurationAggregate,
} from '../export/export-metrics-collector';

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
// REQ-213: Batch job metric builders
// ---------------------------------------------------------------------------

function buildBatchJobsTotal(batch: BatchJobMetricsSnapshot): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const [status, count] of Object.entries(batch.jobsByStatus)) {
    if (count > 0) {
      samples.push({ labels: { status }, value: count });
    }
  }
  return {
    name: 'batch_jobs_total',
    help: 'Total batch jobs by lifecycle status',
    type: 'counter',
    samples,
  };
}

function buildBatchJobsActive(batch: BatchJobMetricsSnapshot): PrometheusMetric {
  return {
    name: 'batch_jobs_active',
    help: 'Number of currently active (running) batch jobs',
    type: 'gauge',
    samples: [{ labels: {}, value: batch.activeJobs }],
  };
}

// ---------------------------------------------------------------------------
// REQ-226: Export pipeline metric builders
// ---------------------------------------------------------------------------

function buildExportDurationMs(formats: ExportFormatMetrics[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const f of formats) {
    const labels = { format: f.format };
    for (const [q, val] of [['0.5', f.duration.percentiles.p50], ['0.95', f.duration.percentiles.p95], ['0.99', f.duration.percentiles.p99]] as const) {
      samples.push({ labels: { ...labels, quantile: q }, value: val });
    }
    samples.push({ labels, value: f.duration.sumMs, suffix: '_sum' });
    samples.push({ labels, value: f.duration.count, suffix: '_count' });
  }
  return {
    name: 'export_duration_ms',
    help: 'Export operation duration in milliseconds (summary with quantiles per format)',
    type: 'summary',
    samples,
  };
}

function buildExportOperationsTotal(formats: ExportFormatMetrics[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const f of formats) {
    if (f.successfulExports > 0) {
      samples.push({ labels: { format: f.format, status: 'success' }, value: f.successfulExports });
    }
    if (f.failedExports > 0) {
      samples.push({ labels: { format: f.format, status: 'failure' }, value: f.failedExports });
    }
  }
  return {
    name: 'export_operations_total',
    help: 'Total export operations by format and status',
    type: 'counter',
    samples,
  };
}

function buildExportFileSizeBytes(formats: ExportFormatMetrics[]): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const f of formats) {
    if (f.fileSize.count === 0) continue;
    const labels = { format: f.format };
    for (const [q, val] of [['0.5', f.fileSize.percentiles.p50], ['0.95', f.fileSize.percentiles.p95], ['0.99', f.fileSize.percentiles.p99]] as const) {
      samples.push({ labels: { ...labels, quantile: q }, value: val });
    }
    samples.push({ labels, value: f.fileSize.sum, suffix: '_sum' });
    samples.push({ labels, value: f.fileSize.count, suffix: '_count' });
  }
  return {
    name: 'export_file_size_bytes',
    help: 'Export file size in bytes (summary with quantiles per format)',
    type: 'summary',
    samples,
  };
}

function buildExportStageDurationMs(stages: ExportStageDurationAggregate[]): PrometheusMetric {
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
    name: 'export_stage_duration_ms',
    help: 'Export stage duration in milliseconds (summary with quantiles per stage)',
    type: 'summary',
    samples,
  };
}

// ---------------------------------------------------------------------------
// REQ-229: Export queue metric builders
// ---------------------------------------------------------------------------

function buildExportQueueSize(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_size',
    help: 'Current number of jobs waiting in the export queue',
    type: 'gauge',
    samples: [{ labels: {}, value: queue.queueSize }],
  };
}

function buildExportQueueDequeueTotal(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  const samples: PrometheusMetric['samples'] = [];
  for (const [priority, count] of Object.entries(queue.dequeueByPriority)) {
    if (count > 0) {
      samples.push({ labels: { priority }, value: count });
    }
  }
  return {
    name: 'export_queue_dequeue_total',
    help: 'Total export jobs dequeued by priority',
    type: 'counter',
    samples,
  };
}

function buildExportQueueWaitTimeMs(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_wait_time_ms',
    help: 'Average export job queue wait time in milliseconds',
    type: 'gauge',
    samples: [{ labels: {}, value: queue.avgWaitTimeMs }],
  };
}

function buildExportQueueDlqSize(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_dlq_size',
    help: 'Current number of jobs in the export dead letter queue',
    type: 'gauge',
    samples: [{ labels: {}, value: queue.dlqSize }],
  };
}

function buildExportQueueRetryTotal(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_retry_total',
    help: 'Total number of export job retry attempts',
    type: 'counter',
    samples: [{ labels: {}, value: queue.totalRetries }],
  };
}

function buildExportQueueDeadLetterTotal(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_dead_letter_total',
    help: 'Total number of export jobs moved to the dead letter queue',
    type: 'counter',
    samples: [{ labels: {}, value: queue.totalDeadLettered }],
  };
}

function buildExportQueueReplayTotal(queue: ExportMetricsSnapshot['queue']): PrometheusMetric {
  return {
    name: 'export_queue_dlq_replay_total',
    help: 'Total number of export jobs replayed from the dead letter queue',
    type: 'counter',
    samples: [{ labels: {}, value: queue.totalReplayed }],
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
  /** Optional custom export snapshot instead of live collector data (REQ-226) */
  exportSnapshot?: ExportMetricsSnapshot;
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
  const exportSnap = options?.exportSnapshot ?? exportMetricsCollector.getSnapshot();
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

  // REQ-213: Batch job lifecycle metrics
  const { batchJobs } = pipelineSnap;
  const hasBatchData = Object.values(batchJobs.jobsByStatus).some(v => v > 0);
  if (hasBatchData) {
    metrics.push(buildBatchJobsTotal(batchJobs));
  }
  // Always emit active gauge when any batch job data exists
  if (hasBatchData || batchJobs.activeJobs > 0) {
    metrics.push(buildBatchJobsActive(batchJobs));
  }

  // REQ-226: Export pipeline metrics
  if (exportSnap.formats.length > 0) {
    metrics.push(buildExportDurationMs(exportSnap.formats));
    metrics.push(buildExportOperationsTotal(exportSnap.formats));
    const formatsWithSizes = exportSnap.formats.filter(f => f.fileSize.count > 0);
    if (formatsWithSizes.length > 0) {
      metrics.push(buildExportFileSizeBytes(formatsWithSizes));
    }
  }
  if (exportSnap.stages.length > 0) {
    metrics.push(buildExportStageDurationMs(exportSnap.stages));
  }

  // REQ-229: Export queue metrics
  if (exportSnap.queue.queueSize > 0 || exportSnap.queue.dequeueCount > 0) {
    metrics.push(buildExportQueueSize(exportSnap.queue));
    metrics.push(buildExportQueueDequeueTotal(exportSnap.queue));
    if (exportSnap.queue.avgWaitTimeMs > 0) {
      metrics.push(buildExportQueueWaitTimeMs(exportSnap.queue));
    }
  }

  // DLQ and retry metrics — always emit when any DLQ/retry activity has occurred
  if (exportSnap.queue.dlqSize > 0 || exportSnap.queue.totalRetries > 0 || exportSnap.queue.totalDeadLettered > 0) {
    metrics.push(buildExportQueueDlqSize(exportSnap.queue));
    metrics.push(buildExportQueueRetryTotal(exportSnap.queue));
    metrics.push(buildExportQueueDeadLetterTotal(exportSnap.queue));
  }

  // Replay metric — emit when any DLQ replay has occurred
  if (exportSnap.queue.totalReplayed > 0) {
    metrics.push(buildExportQueueReplayTotal(exportSnap.queue));
  }

  const output = metrics.map(renderMetric).join('\n\n');

  if (prefix) {
    return output.replace(/^(# (?:HELP|TYPE) )(\w)/gm, `$1${prefix}${'$2'}`);
  }

  return output + '\n';
}

/** Content type for Prometheus exposition format. */
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';
