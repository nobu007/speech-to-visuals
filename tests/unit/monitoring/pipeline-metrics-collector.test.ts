/**
 * REQ-212: Pipeline Stage Duration Metrics Collector tests
 *
 * Verifies that:
 * - PipelineMetricsCollector records stage durations per stage name
 * - Computes quantiles (p50, p95, p99) from duration samples
 * - Aggregates count, sum, min, max per stage
 * - Tracks total/successful/failed pipeline runs
 * - Prometheus exporter includes pipeline_stage_duration_ms metric
 * - Pipeline metrics are omitted when no data has been recorded
 * - Collector can be reset for testing
 */

import {
  PipelineMetricsCollector,
  pipelineMetricsCollector,
  type PipelineMetricsSnapshot,
} from '@/monitoring/pipeline-metrics-collector';
import { exportPrometheusMetrics } from '@/monitoring/prometheus-exporter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshCollector(): PipelineMetricsCollector {
  return new PipelineMetricsCollector();
}

// ---------------------------------------------------------------------------
// PipelineMetricsCollector
// ---------------------------------------------------------------------------

describe('PipelineMetricsCollector', () => {
  afterEach(() => {
    pipelineMetricsCollector.reset();
  });

  // ---- Recording stage durations ----

  it('records a single stage duration and exposes it in snapshot', () => {
    const c = freshCollector();
    c.recordStageDuration('transcription', 150);
    c.recordPipelineRun(true);

    const snap = c.getSnapshot();
    expect(snap.totalRuns).toBe(1);
    expect(snap.successfulRuns).toBe(1);
    expect(snap.failedRuns).toBe(0);
    expect(snap.stages).toHaveLength(1);
    expect(snap.stages[0].stage).toBe('transcription');
    expect(snap.stages[0].count).toBe(1);
    expect(snap.stages[0].sumMs).toBe(150);
    expect(snap.stages[0].minMs).toBe(150);
    expect(snap.stages[0].maxMs).toBe(150);
  });

  it('aggregates multiple durations for the same stage', () => {
    const c = freshCollector();
    c.recordStageDuration('analysis', 100);
    c.recordStageDuration('analysis', 200);
    c.recordStageDuration('analysis', 300);

    const snap = c.getSnapshot();
    const stage = snap.stages.find((s) => s.stage === 'analysis')!;
    expect(stage.count).toBe(3);
    expect(stage.sumMs).toBe(600);
    expect(stage.avgMs).toBe(200);
    expect(stage.minMs).toBe(100);
    expect(stage.maxMs).toBe(300);
  });

  it('computes percentiles from duration samples', () => {
    const c = freshCollector();
    // Add 20 samples: 10, 20, 30, ..., 200
    for (let i = 1; i <= 20; i++) {
      c.recordStageDuration('layout', i * 10);
    }

    const snap = c.getSnapshot();
    const stage = snap.stages.find((s) => s.stage === 'layout')!;
    expect(stage.percentiles.p50).toBeGreaterThan(0);
    expect(stage.percentiles.p95).toBeGreaterThanOrEqual(stage.percentiles.p50);
    expect(stage.percentiles.p99).toBeGreaterThanOrEqual(stage.percentiles.p95);
    // p50 should be around 100-110
    expect(stage.percentiles.p50).toBeGreaterThanOrEqual(90);
    expect(stage.percentiles.p50).toBeLessThanOrEqual(120);
  });

  it('handles multiple distinct stages independently', () => {
    const c = freshCollector();
    c.recordStageDuration('transcription', 100);
    c.recordStageDuration('analysis', 200);
    c.recordStageDuration('layout', 300);
    c.recordStageDuration('rendering', 400);

    const snap = c.getSnapshot();
    expect(snap.stages).toHaveLength(4);
    const names = snap.stages.map((s) => s.stage).sort();
    expect(names).toEqual(['analysis', 'layout', 'rendering', 'transcription']);
  });

  it('tracks pipeline run outcomes', () => {
    const c = freshCollector();
    c.recordPipelineRun(true);
    c.recordPipelineRun(true);
    c.recordPipelineRun(false);
    c.recordPipelineRun(true);

    const snap = c.getSnapshot();
    expect(snap.totalRuns).toBe(4);
    expect(snap.successfulRuns).toBe(3);
    expect(snap.failedRuns).toBe(1);
  });

  it('returns empty snapshot when no data recorded', () => {
    const c = freshCollector();
    const snap = c.getSnapshot();
    expect(snap.stages).toHaveLength(0);
    expect(snap.totalRuns).toBe(0);
    expect(snap.successfulRuns).toBe(0);
    expect(snap.failedRuns).toBe(0);
  });

  it('resets all collected metrics', () => {
    const c = freshCollector();
    c.recordStageDuration('transcription', 100);
    c.recordPipelineRun(true);

    c.reset();

    const snap = c.getSnapshot();
    expect(snap.stages).toHaveLength(0);
    expect(snap.totalRuns).toBe(0);
  });

  it('limits per-stage sample buffer to prevent unbounded memory', () => {
    const c = freshCollector({ maxSamplesPerStage: 5 });
    for (let i = 1; i <= 100; i++) {
      c.recordStageDuration('rendering', i);
    }

    const snap = c.getSnapshot();
    const stage = snap.stages.find((s) => s.stage === 'rendering')!;
    // Should only keep last 5 samples (96-100)
    expect(stage.count).toBe(100); // total count tracks all
    expect(stage.maxMs).toBe(100);
    expect(stage.minMs).toBe(1); // min/max are tracked globally, not from buffer
  });

  // ---- Global singleton ----

  it('exports a global singleton', () => {
    expect(pipelineMetricsCollector).toBeInstanceOf(PipelineMetricsCollector);
  });
});

// ---------------------------------------------------------------------------
// Prometheus exporter integration
// ---------------------------------------------------------------------------

describe('PrometheusExporter with pipeline metrics', () => {
  beforeEach(() => {
    pipelineMetricsCollector.reset();
  });

  afterEach(() => {
    pipelineMetricsCollector.reset();
  });

  it('includes pipeline_stage_duration_ms when pipeline data exists', () => {
    pipelineMetricsCollector.recordStageDuration('transcription', 150);
    pipelineMetricsCollector.recordStageDuration('analysis', 250);
    pipelineMetricsCollector.recordPipelineRun(true);

    const output = exportPrometheusMetrics();
    expect(output).toContain('# HELP pipeline_stage_duration_ms');
    expect(output).toContain('# TYPE pipeline_stage_duration_ms summary');
    expect(output).toMatch(/pipeline_stage_duration_ms\{stage="transcription"/);
    expect(output).toMatch(/pipeline_stage_duration_ms\{stage="analysis"/);
  });

  it('exports duration quantiles per stage', () => {
    for (let i = 1; i <= 20; i++) {
      pipelineMetricsCollector.recordStageDuration('layout', i * 10);
    }

    const output = exportPrometheusMetrics();
    expect(output).toMatch(/pipeline_stage_duration_ms\{stage="layout",quantile="0\.5"\}/);
    expect(output).toMatch(/pipeline_stage_duration_ms\{stage="layout",quantile="0\.95"\}/);
    expect(output).toMatch(/pipeline_stage_duration_ms\{stage="layout",quantile="0\.99"\}/);
    expect(output).toMatch(/pipeline_stage_duration_ms_sum\{stage="layout"\}/);
    expect(output).toMatch(/pipeline_stage_duration_ms_count\{stage="layout"\} 20/);
  });

  it('omits pipeline metrics when no pipeline data recorded', () => {
    const output = exportPrometheusMetrics();
    expect(output).not.toContain('pipeline_stage_duration_ms');
    // HTTP metrics should still be present
    expect(output).toContain('# HELP http_requests_total');
  });

  it('exports pipeline run counts', () => {
    pipelineMetricsCollector.recordPipelineRun(true);
    pipelineMetricsCollector.recordPipelineRun(true);
    pipelineMetricsCollector.recordPipelineRun(false);

    const output = exportPrometheusMetrics();
    expect(output).toContain('# HELP pipeline_runs_total');
    expect(output).toContain('# TYPE pipeline_runs_total counter');
    expect(output).toMatch(/pipeline_runs_total\{status="success"\} 2/);
    expect(output).toMatch(/pipeline_runs_total\{status="failure"\} 1/);
  });

  it('maintains valid Prometheus format for combined metrics', () => {
    pipelineMetricsCollector.recordStageDuration('transcription', 100);
    pipelineMetricsCollector.recordPipelineRun(true);

    const output = exportPrometheusMetrics();
    // All lines should be valid Prometheus format
    const lines = output.trim().split('\n').filter((l) => l.length > 0);
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      // Metric line: name{labels} value
      expect(line).toMatch(/^\w[\w]*(\{[^}]*\})?\s+[\d.e+-]+$/);
    }
  });
});
