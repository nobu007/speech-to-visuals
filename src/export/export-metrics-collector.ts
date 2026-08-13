/**
 * REQ-226: Export Pipeline Metrics Collector (Phase 96)
 *
 * Collects per-format export timing, success/failure counts,
 * file-size distribution, and export-stage durations for Prometheus
 * exposition via the existing monitoring endpoint.
 *
 * Metrics exposed:
 * - export_duration_ms      (summary with quantiles per format)
 * - export_operations_total (counter by format × status)
 * - export_file_size_bytes  (summary with quantiles per format)
 * - export_stage_duration_ms(summary with quantiles per stage)
 */

import { computePercentiles } from '@/lib/metrics-utils';
import type { JobPriority } from './export-job-queue';

// Re-export so existing type-only consumers can keep importing JobPriority from
// this module's public surface without re-deriving the union. The single source
// of truth lives in export-job-queue.ts (see job-priority-canon.test.ts).
export type { JobPriority };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat =
  | 'mp4'
  | 'webm'
  | 'gif'
  | 'apng'
  | 'interactive-html'
  | 'pdf-animated'
  | 'svg-animated'
  | 'json-lottie';

export type ExportStage = 'preparing' | 'rendering' | 'encoding' | 'finalizing';
export type ExportStatus = 'success' | 'failure';

export interface ExportStageDurationAggregate {
  stage: ExportStage;
  count: number;
  sumMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  percentiles: { p50: number; p95: number; p99: number };
}

export interface ExportFormatMetrics {
  /** Format identifier */
  format: ExportFormat;
  /** Total exports attempted */
  totalExports: number;
  /** Successful exports */
  successfulExports: number;
  /** Failed exports */
  failedExports: number;
  /** Duration aggregates in ms */
  duration: ExportStageDurationAggregate;
  /** File-size aggregates in bytes */
  fileSize: {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    percentiles: { p50: number; p95: number; p99: number };
  };
}

export interface ExportMetricsSnapshot {
  /** Per-format metrics */
  formats: ExportFormatMetrics[];
  /** Per-stage duration aggregates (across all formats) */
  stages: ExportStageDurationAggregate[];
  /** Total exports across all formats */
  totalExports: number;
  /** Total successful exports */
  successfulExports: number;
  /** Total failed exports */
  failedExports: number;
  /** Queue metrics (REQ-229) */
  queue: QueueMetricsSnapshot;
}

export interface ExportMetricsConfig {
  /** Max duration samples retained per format/stage for percentile computation (default: 500) */
  maxSamplesPerSeries: number;
}

export interface QueueMetricsSnapshot {
  /** Current queue size */
  queueSize: number;
  /** Total dequeues */
  dequeueCount: number;
  /** Per-priority dequeue counts */
  dequeueByPriority: Record<JobPriority, number>;
  /** Average queue wait time in ms */
  avgWaitTimeMs: number;
  /** Priority distribution at last snapshot */
  priorityDistribution: Record<JobPriority, number>;
  /** Current dead letter queue size */
  dlqSize: number;
  /** Total retry attempts across all jobs */
  totalRetries: number;
  /** Total jobs moved to dead letter queue */
  totalDeadLettered: number;
  /** Total jobs replayed from dead letter queue */
  totalReplayed: number;
}

const DEFAULT_CONFIG: ExportMetricsConfig = {
  maxSamplesPerSeries: 500,
};

interface SampleSeries {
  count: number;
  sum: number;
  min: number;
  max: number;
  samples: number[];
}

function createSeries(): SampleSeries {
  return { count: 0, sum: 0, min: Infinity, max: 0, samples: [] };
}

function recordSample(series: SampleSeries, value: number, maxSamples: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  series.count++;
  series.sum += value;
  if (value < series.min) series.min = value;
  if (value > series.max) series.max = value;
  series.samples.push(value);
  if (series.samples.length > maxSamples) {
    series.samples = series.samples.slice(-Math.floor(maxSamples / 2));
  }
}

function seriesToAggregate(
  label: string,
  series: SampleSeries,
): ExportStageDurationAggregate {
  const sorted = [...series.samples].sort((a, b) => a - b);
  return {
    stage: label as ExportStage,
    count: series.count,
    sumMs: series.sum,
    avgMs: series.count > 0 ? Math.round(series.sum / series.count) : 0,
    minMs: series.min === Infinity ? 0 : series.min,
    maxMs: series.max,
    percentiles: computePercentiles(sorted),
  };
}

// ---------------------------------------------------------------------------
// Per-format data holder
// ---------------------------------------------------------------------------

interface FormatData {
  format: ExportFormat;
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  duration: SampleSeries;
  fileSize: SampleSeries;
}

// ---------------------------------------------------------------------------
// ExportMetricsCollector
// ---------------------------------------------------------------------------

export class ExportMetricsCollector {
  private formats = new Map<ExportFormat, FormatData>();
  private stages = new Map<ExportStage, SampleSeries>();
  private readonly config: ExportMetricsConfig;

  // Queue metrics (REQ-229)
  private queueSize = 0;
  private dequeueCount = 0;
  private dequeueByPriority: Record<JobPriority, number> = { high: 0, normal: 0, low: 0 };
  private waitTimeSeries = createSeries();
  private priorityDistribution: Record<JobPriority, number> = { high: 0, normal: 0, low: 0 };

  // DLQ and retry metrics
  private dlqSize = 0;
  private totalRetries = 0;
  private totalDeadLettered = 0;
  private totalReplayed = 0;

  constructor(config?: Partial<ExportMetricsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- Recording methods --------------------------------------------------

  /** Record a completed export operation with timing and file size. */
  recordExport(
    format: ExportFormat,
    status: ExportStatus,
    durationMs: number,
    fileSizeBytes?: number,
  ): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;

    let data = this.formats.get(format);
    if (!data) {
      data = {
        format,
        totalExports: 0,
        successfulExports: 0,
        failedExports: 0,
        duration: createSeries(),
        fileSize: createSeries(),
      };
      this.formats.set(format, data);
    }

    data.totalExports++;
    if (status === 'success') {
      data.successfulExports++;
    } else {
      data.failedExports++;
    }

    recordSample(data.duration, durationMs, this.config.maxSamplesPerSeries);

    if (fileSizeBytes !== undefined && status === 'success') {
      recordSample(data.fileSize, fileSizeBytes, this.config.maxSamplesPerSeries);
    }
  }

  /** Record an individual export stage duration (e.g. 'rendering'). */
  recordStageDuration(stage: ExportStage, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;

    let series = this.stages.get(stage);
    if (!series) {
      series = createSeries();
      this.stages.set(stage, series);
    }
    recordSample(series, durationMs, this.config.maxSamplesPerSeries);
  }

  // -- Query methods ------------------------------------------------------

  /** Get a snapshot of all collected export metrics. */
  getSnapshot(): ExportMetricsSnapshot {
    const formats: ExportFormatMetrics[] = [];
    for (const [, data] of this.formats) {
      formats.push({
        format: data.format,
        totalExports: data.totalExports,
        successfulExports: data.successfulExports,
        failedExports: data.failedExports,
        duration: seriesToAggregate(data.format, data.duration),
        fileSize: {
          count: data.fileSize.count,
          sum: data.fileSize.sum,
          avg: data.fileSize.count > 0 ? Math.round(data.fileSize.sum / data.fileSize.count) : 0,
          min: data.fileSize.min === Infinity ? 0 : data.fileSize.min,
          max: data.fileSize.max,
          percentiles: computePercentiles([...data.fileSize.samples].sort((a, b) => a - b)),
        },
      });
    }

    const stages: ExportStageDurationAggregate[] = [];
    for (const [stage, series] of this.stages) {
      stages.push(seriesToAggregate(stage, series));
    }

    let totalExports = 0;
    let successfulExports = 0;
    let failedExports = 0;
    for (const [, data] of this.formats) {
      totalExports += data.totalExports;
      successfulExports += data.successfulExports;
      failedExports += data.failedExports;
    }

    const queue: QueueMetricsSnapshot = {
      queueSize: this.queueSize,
      dequeueCount: this.dequeueCount,
      dequeueByPriority: { ...this.dequeueByPriority },
      avgWaitTimeMs: this.waitTimeSeries.count > 0
        ? Math.round(this.waitTimeSeries.sum / this.waitTimeSeries.count)
        : 0,
      priorityDistribution: { ...this.priorityDistribution },
      dlqSize: this.dlqSize,
      totalRetries: this.totalRetries,
      totalDeadLettered: this.totalDeadLettered,
      totalReplayed: this.totalReplayed,
    };

    return { formats, stages, totalExports, successfulExports, failedExports, queue };
  }

  /**
   * Export metrics in Prometheus text exposition format (v0.0.4).
   *
   * Emits:
   * - export_operations_total{format,status} counter
   * - export_duration_ms{format} summary (count, sum, p50, p95, p99)
   * - export_file_size_bytes{format} summary (count, sum, p50, p95, p99)
   * - export_stage_duration_ms{stage} summary (count, sum, p50, p95, p99)
   * - export_queue_size gauge
   * - export_queue_dequeue_total counter
   * - export_queue_wait_time_ms summary
   * - export_dlq_size gauge
   * - export_retries_total counter
   * - export_dead_lettered_total counter
   * - export_replayed_total counter
   */
  toPrometheusText(): string {
    const snap = this.getSnapshot();
    const lines: string[] = [];

    // -- export_operations_total --
    lines.push('# HELP export_operations_total Total export operations by format and status');
    lines.push('# TYPE export_operations_total counter');
    for (const f of snap.formats) {
      lines.push(`export_operations_total{format="${f.format}",status="success"} ${f.successfulExports}`);
      lines.push(`export_operations_total{format="${f.format}",status="failure"} ${f.failedExports}`);
    }

    // -- export_duration_ms --
    lines.push('');
    lines.push('# HELP export_duration_ms Export duration in ms by format');
    lines.push('# TYPE export_duration_ms summary');
    for (const f of snap.formats) {
      lines.push(`export_duration_ms{format="${f.format}",quantile="0.5"} ${f.duration.percentiles.p50}`);
      lines.push(`export_duration_ms{format="${f.format}",quantile="0.95"} ${f.duration.percentiles.p95}`);
      lines.push(`export_duration_ms{format="${f.format}",quantile="0.99"} ${f.duration.percentiles.p99}`);
      lines.push(`export_duration_ms_count{format="${f.format}"} ${f.duration.count}`);
      lines.push(`export_duration_ms_sum{format="${f.format}"} ${f.duration.sumMs}`);
    }

    // -- export_file_size_bytes --
    lines.push('');
    lines.push('# HELP export_file_size_bytes Exported file size in bytes by format');
    lines.push('# TYPE export_file_size_bytes summary');
    for (const f of snap.formats) {
      lines.push(`export_file_size_bytes{format="${f.format}",quantile="0.5"} ${f.fileSize.percentiles.p50}`);
      lines.push(`export_file_size_bytes{format="${f.format}",quantile="0.95"} ${f.fileSize.percentiles.p95}`);
      lines.push(`export_file_size_bytes{format="${f.format}",quantile="0.99"} ${f.fileSize.percentiles.p99}`);
      lines.push(`export_file_size_bytes_count{format="${f.format}"} ${f.fileSize.count}`);
      lines.push(`export_file_size_bytes_sum{format="${f.format}"} ${f.fileSize.sum}`);
    }

    // -- export_stage_duration_ms --
    lines.push('');
    lines.push('# HELP export_stage_duration_ms Export stage duration in ms');
    lines.push('# TYPE export_stage_duration_ms summary');
    for (const s of snap.stages) {
      lines.push(`export_stage_duration_ms{stage="${s.stage}",quantile="0.5"} ${s.percentiles.p50}`);
      lines.push(`export_stage_duration_ms{stage="${s.stage}",quantile="0.95"} ${s.percentiles.p95}`);
      lines.push(`export_stage_duration_ms{stage="${s.stage}",quantile="0.99"} ${s.percentiles.p99}`);
      lines.push(`export_stage_duration_ms_count{stage="${s.stage}"} ${s.count}`);
      lines.push(`export_stage_duration_ms_sum{stage="${s.stage}"} ${s.sumMs}`);
    }

    // -- Queue metrics --
    lines.push('');
    lines.push('# HELP export_queue_size Current export queue size');
    lines.push('# TYPE export_queue_size gauge');
    lines.push(`export_queue_size ${snap.queue.queueSize}`);

    lines.push('');
    lines.push('# HELP export_queue_dequeue_total Total dequeues by priority');
    lines.push('# TYPE export_queue_dequeue_total counter');
    lines.push(`export_queue_dequeue_total{priority="high"} ${snap.queue.dequeueByPriority.high}`);
    lines.push(`export_queue_dequeue_total{priority="normal"} ${snap.queue.dequeueByPriority.normal}`);
    lines.push(`export_queue_dequeue_total{priority="low"} ${snap.queue.dequeueByPriority.low}`);

    lines.push('');
    lines.push('# HELP export_queue_wait_time_ms Queue wait time in ms');
    lines.push('# TYPE export_queue_wait_time_ms gauge');
    lines.push(`export_queue_wait_time_ms ${snap.queue.avgWaitTimeMs}`);

    lines.push('');
    lines.push('# HELP export_dlq_size Current dead letter queue size');
    lines.push('# TYPE export_dlq_size gauge');
    lines.push(`export_dlq_size ${snap.queue.dlqSize}`);

    lines.push('');
    lines.push('# HELP export_retries_total Total retry attempts');
    lines.push('# TYPE export_retries_total counter');
    lines.push(`export_retries_total ${snap.queue.totalRetries}`);

    lines.push('');
    lines.push('# HELP export_dead_lettered_total Total jobs moved to dead letter queue');
    lines.push('# TYPE export_dead_lettered_total counter');
    lines.push(`export_dead_lettered_total ${snap.queue.totalDeadLettered}`);

    lines.push('');
    lines.push('# HELP export_replayed_total Total jobs replayed from dead letter queue');
    lines.push('# TYPE export_replayed_total counter');
    lines.push(`export_replayed_total ${snap.queue.totalReplayed}`);

    return lines.join('\n');
  }

  /** Reset all collected metrics. */
  reset(): void {
    this.formats.clear();
    this.stages.clear();
    this.queueSize = 0;
    this.dequeueCount = 0;
    this.dequeueByPriority = { high: 0, normal: 0, low: 0 };
    this.waitTimeSeries = createSeries();
    this.priorityDistribution = { high: 0, normal: 0, low: 0 };
    this.dlqSize = 0;
    this.totalRetries = 0;
    this.totalDeadLettered = 0;
    this.totalReplayed = 0;
  }

  // -- Queue metrics recording (REQ-229) ------------------------------------

  /** Record current queue size. */
  recordQueueSize(size: number): void {
    if (!Number.isFinite(size) || size < 0) return;
    this.queueSize = Math.floor(size);
  }

  /** Record queue wait time in ms for a dequeued job. */
  recordQueueWaitTimeMs(waitMs: number): void {
    recordSample(this.waitTimeSeries, waitMs, this.config.maxSamplesPerSeries);
  }

  /** Record a dequeue event with its priority. */
  recordQueueDequeue(priority: JobPriority): void {
    this.dequeueCount++;
    this.dequeueByPriority[priority]++;
  }

  /** Record the current priority distribution in the queue. */
  recordQueuePriorityDistribution(high: number, normal: number, low: number): void {
    // Closed-set ingestion guard — the sibling queue gauges (recordQueueSize /
    // recordDlqSize) and the sample series (recordSample) all drop a non-finite
    // or negative input. This was the sole UNGUARDED numeric ingestion point in
    // the collector: a poisoned count would publish a non-finite
    // `priorityDistribution` in the snapshot. Drop the WHOLE update (not a
    // partial write, which would leave an inconsistent distribution) so the
    // last valid distribution is retained — the same "keep previously-recorded
    // finite" contract the queue-size / dlq-size gauges lock.
    if (
      !Number.isFinite(high) || !Number.isFinite(normal) || !Number.isFinite(low) ||
      high < 0 || normal < 0 || low < 0
    ) {
      return;
    }
    this.priorityDistribution = {
      high: Math.floor(high),
      normal: Math.floor(normal),
      low: Math.floor(low),
    };
  }

  /** Record current dead letter queue size. */
  recordDlqSize(size: number): void {
    if (!Number.isFinite(size) || size < 0) return;
    this.dlqSize = Math.floor(size);
  }

  /** Record a retry attempt for a failed job. */
  recordRetry(): void {
    this.totalRetries++;
  }

  /** Record a job being moved to the dead letter queue. */
  recordDeadLetter(): void {
    this.totalDeadLettered++;
  }

  /** Record a job being replayed from the dead letter queue. */
  recordReplay(): void {
    this.totalReplayed++;
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const exportMetricsCollector = new ExportMetricsCollector();
