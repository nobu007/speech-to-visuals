/**
 * REQ-212: Pipeline Stage Duration Metrics Collector
 *
 * Collects per-stage pipeline execution timing data and run outcomes
 * for export via the Prometheus metrics endpoint.
 *
 * Metrics exposed:
 * - pipeline_stage_duration_ms (summary with quantiles per stage)
 * - pipeline_runs_total (counter by status: success/failure)
 */

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

export interface PipelineMetricsSnapshot {
  stages: StageDurationAggregate[];
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

export interface PipelineMetricsConfig {
  /** Max duration samples retained per stage for percentile computation (default: 1000) */
  maxSamplesPerStage: number;
}

const DEFAULT_CONFIG: PipelineMetricsConfig = {
  maxSamplesPerStage: 1000,
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
    return { stages, totalRuns: this.totalRuns, successfulRuns: this.successfulRuns, failedRuns: this.failedRuns };
  }

  /** Reset all collected metrics. */
  reset(): void {
    this.stages.clear();
    this.totalRuns = 0;
    this.successfulRuns = 0;
    this.failedRuns = 0;
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const pipelineMetricsCollector = new PipelineMetricsCollector();
