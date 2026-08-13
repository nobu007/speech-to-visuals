/**
 * Finiteness contract for PipelineMetricsCollector ingestion chokepoint.
 *
 * recordStageDuration(durationMs) feeds the per-stage `sumMs` accumulator and
 * the `samples` buffer that the snapshot derives aggregates from:
 *   • sumMs / count        → avgMs            (getSnapshot)
 *   • [...samples].sort    → computePercentiles p50/p95/p99 (getSnapshot)
 *   • durationMs bounds    → minMs / maxMs
 *
 * A single non-finite sample (NaN / ±Infinity) is sticky through +, /, sort
 * and Math.round, so it contaminates every published stage aggregate that the
 * monitoring dashboard / Prometheus exporter (`pipeline_stage_duration_ms`)
 * consume. Same leak class as the recordRequest guard (http-metrics-collector)
 * and the RealTimePerformanceMonitor ingestion guard — the sibling chokepoints
 * in this same monitoring module, each already covered by a
 * `*-finite-aggregate.test.ts`. This file closes the CLOSED-SET: it is the
 * missing registration for the pipeline collector, whose
 * `sanitizeFinite(durationMs, 0)` guard (see specs/pipeline-metrics-nan-leak-fix/)
 * previously had NO behavior-locking test. Verified by feeding NaN / ±∞ at
 * ingestion and asserting finite aggregate OUTPUT, plus that the Prometheus
 * publish path renders no `NaN` token.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { PipelineMetricsCollector } from '../pipeline-metrics-collector';
import { exportPrometheusMetrics } from '../prometheus-exporter';
import { HttpMetricsCollector } from '../http-metrics-collector';

describe('PipelineMetricsCollector — non-finite ingestion must not leak into aggregates', () => {
  let collector: PipelineMetricsCollector;

  beforeEach(() => {
    collector = new PipelineMetricsCollector();
  });

  const stageOf = (snap: ReturnType<PipelineMetricsCollector['getSnapshot']>) =>
    snap.stages.find(s => s.stage === 'leak')!;

  it('keeps avgMs finite when a durationMs sample is NaN', () => {
    collector.recordStageDuration('leak', 10);
    collector.recordStageDuration('leak', NaN); // poisoned sample
    collector.recordStageDuration('leak', 30);

    const stage = stageOf(collector.getSnapshot());
    expect(Number.isFinite(stage.avgMs)).toBe(true);
    expect(stage.avgMs).toBeGreaterThan(0);
  });

  it('keeps avgMs finite when a durationMs sample is +Infinity', () => {
    collector.recordStageDuration('leak', 10);
    collector.recordStageDuration('leak', Infinity);

    const stage = stageOf(collector.getSnapshot());
    expect(Number.isFinite(stage.avgMs)).toBe(true);
  });

  it('keeps avgMs finite when a durationMs sample is -Infinity', () => {
    collector.recordStageDuration('leak', 10);
    collector.recordStageDuration('leak', -Infinity);

    const stage = stageOf(collector.getSnapshot());
    expect(Number.isFinite(stage.avgMs)).toBe(true);
  });

  it('keeps p50/p95/p99 percentiles finite when a sample is NaN', () => {
    for (let i = 1; i <= 20; i++) {
      collector.recordStageDuration('leak', i === 10 ? NaN : i * 10);
    }

    const stage = stageOf(collector.getSnapshot());
    expect(Number.isFinite(stage.percentiles.p50)).toBe(true);
    expect(Number.isFinite(stage.percentiles.p95)).toBe(true);
    expect(Number.isFinite(stage.percentiles.p99)).toBe(true);
  });

  it('keeps minMs/maxMs finite when a durationMs sample is ±Infinity', () => {
    collector.recordStageDuration('leak', 10);
    collector.recordStageDuration('leak', Infinity);
    collector.recordStageDuration('leak', -Infinity);

    const stage = stageOf(collector.getSnapshot());
    expect(Number.isFinite(stage.minMs)).toBe(true);
    expect(Number.isFinite(stage.maxMs)).toBe(true);
    expect(Number.isFinite(stage.sumMs)).toBe(true);
  });

  // --- Publish path: the Prometheus exposition must never render a `NaN` token ---

  it('renders no NaN token in the Prometheus publish path after poisoned ingestion', () => {
    collector.recordStageDuration('leak', 10);
    collector.recordStageDuration('leak', NaN);
    collector.recordStageDuration('leak', Infinity);

    const output = exportPrometheusMetrics({
      // Empty HTTP snapshot keeps the output deterministic (only pipeline
      // metrics are emitted); the export/security singletons are empty in a
      // fresh test environment.
      snapshot: new HttpMetricsCollector().getSnapshot(),
      pipelineSnapshot: collector.getSnapshot(),
    });

    expect(output).toContain('pipeline_stage_duration_ms');
    expect(output).not.toMatch(/NaN/);
  });
});
