/**
 * REQ-212 + REQ-213: Pipeline Stage Duration & Batch Job Lifecycle Metrics Collector
 *
 * Collects per-stage pipeline execution timing data, run outcomes,
 * and batch job lifecycle events for export via the Prometheus metrics endpoint.
 *
 * Metrics exposed:
 * - pipeline_stage_duration_ms (summary with quantiles per stage)
 * - pipeline_runs_total (counter by status: success/failure)
 * - batch_jobs_total (counter by status: created/running/completed/failed/cancelled)
 * - batch_jobs_active (gauge: currently running jobs)
 */

import { computePercentiles } from '@/lib/metrics-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageDurationAggregate {
  stage: string;
  count: number;
  sumMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  percentiles: { p50: number; p95: number; p99: number };
}

export type BatchJobStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BatchJobMetricsSnapshot {
  /** Counter of batch jobs by terminal/intermediate status */
  jobsByStatus: Record<BatchJobStatus, number>;
  /** Currently active (running) batch jobs */
  activeJobs: number;
}

export interface PipelineMetricsSnapshot {
  stages: StageDurationAggregate[];
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  batchJobs: BatchJobMetricsSnapshot;
}

export interface PipelineMetricsConfig {
  /** Max duration samples retained per stage for percentile computation (default: 1000) */
  maxSamplesPerStage: number;
}

const DEFAULT_CONFIG: PipelineMetricsConfig = {
  maxSamplesPerStage: 1000,
};

// ---------------------------------------------------------------------------
// PipelineMetricsCollector
// ---------------------------------------------------------------------------

interface StageData {
  stage: string;
  count: number;
  sumMs: number;
  minMs: number;
  maxMs: number;
  samples: number[];
}

export class PipelineMetricsCollector {
  private stages = new Map<string, StageData>();
  private totalRuns = 0;
  private successfulRuns = 0;
  private failedRuns = 0;
  private readonly config: PipelineMetricsConfig;

  // REQ-213: Batch job lifecycle tracking
  private batchJobCounters: Record<BatchJobStatus, number> = {
    created: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  private activeBatchJobs = 0;

  constructor(config?: Partial<PipelineMetricsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Record a single stage execution duration. */
  recordStageDuration(stage: string, durationMs: number): void {
    let data = this.stages.get(stage);
    if (!data) {
      data = { stage, count: 0, sumMs: 0, minMs: Infinity, maxMs: 0, samples: [] };
      this.stages.set(stage, data);
    }

    data.count++;
    data.sumMs += durationMs;
    if (durationMs < data.minMs) data.minMs = durationMs;
    if (durationMs > data.maxMs) data.maxMs = durationMs;

    data.samples.push(durationMs);
    if (data.samples.length > this.config.maxSamplesPerStage) {
      data.samples = data.samples.slice(-Math.floor(this.config.maxSamplesPerStage / 2));
    }
  }

  /** Record a pipeline run outcome. */
  recordPipelineRun(success: boolean): void {
    this.totalRuns++;
    if (success) {
      this.successfulRuns++;
    } else {
      this.failedRuns++;
    }
  }

  /** REQ-213: Record a batch job lifecycle transition. */
  recordBatchJobTransition(status: BatchJobStatus): void {
    this.batchJobCounters[status]++;
    if (status === 'running') {
      this.activeBatchJobs++;
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      this.activeBatchJobs = Math.max(0, this.activeBatchJobs - 1);
    }
  }

  /** Get a snapshot of all collected metrics. */
  getSnapshot(): PipelineMetricsSnapshot {
    const stages: StageDurationAggregate[] = [];
    for (const [, data] of this.stages) {
      const sorted = [...data.samples].sort((a, b) => a - b);
      stages.push({
        stage: data.stage,
        count: data.count,
        sumMs: data.sumMs,
        avgMs: data.count > 0 ? Math.round(data.sumMs / data.count) : 0,
        minMs: data.minMs === Infinity ? 0 : data.minMs,
        maxMs: data.maxMs,
        percentiles: computePercentiles(sorted),
      });
    }
    const batchJobs: BatchJobMetricsSnapshot = {
      jobsByStatus: { ...this.batchJobCounters },
      activeJobs: this.activeBatchJobs,
    };
    return { stages, totalRuns: this.totalRuns, successfulRuns: this.successfulRuns, failedRuns: this.failedRuns, batchJobs };
  }

  /** Reset all collected metrics. */
  reset(): void {
    this.stages.clear();
    this.totalRuns = 0;
    this.successfulRuns = 0;
    this.failedRuns = 0;
    this.batchJobCounters = { created: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    this.activeBatchJobs = 0;
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const pipelineMetricsCollector = new PipelineMetricsCollector();
