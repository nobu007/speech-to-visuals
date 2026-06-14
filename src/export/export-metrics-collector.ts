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
export type JobPriority = 'high' | 'normal' | 'low';

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
}

const DEFAULT_CONFIG: ExportMetricsConfig = {
  maxSamplesPerSeries: 500,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePercentiles(sorted: number[]): { p50: number; p95: number; p99: number } {
  if (sorted.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const p = (rank: number) => sorted[Math.min(Math.floor(rank), sorted.length - 1)];
  return {
    p50: p(sorted.length * 0.5),
    p95: p(sorted.length * 0.95),
    p99: p(sorted.length * 0.99),
  };
}

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
    };

    return { formats, stages, totalExports, successfulExports, failedExports, queue };
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
    this.priorityDistribution = { high, normal, low };
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
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const exportMetricsCollector = new ExportMetricsCollector();
