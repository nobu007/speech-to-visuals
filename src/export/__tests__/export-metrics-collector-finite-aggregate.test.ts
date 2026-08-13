/**
 * Finiteness contract for ExportMetricsCollector ingestion chokepoints.
 *
 * ExportMetricsCollector is the FOURTH collector that publishes percentile
 * summaries through the Prometheus exposition path (the other three —
 * HttpMetricsCollector, RealTimePerformanceMonitor, PipelineMetricsCollector —
 * each already have a `*-finite-aggregate.test.ts`). It feeds:
 *   • recordExport(format, status, durationMs, fileSizeBytes?)
 *       → per-format `duration` SampleSeries (sum/count/avg/min/max/percentiles)
 *         and `fileSize` SampleSeries, published as `export_duration_ms` and
 *         `export_file_size_bytes`.
 *   • recordStageDuration(stage, durationMs)
 *       → per-stage SampleSeries, published as `export_stage_duration_ms`.
 *   • recordQueueWaitTimeMs(waitMs)
 *       → waitTimeSeries → `avgWaitTimeMs`, published as `export_queue_wait_time_ms`.
 *   • recordQueueSize / recordDlqSize
 *       → gauges published as `export_queue_size` / `export_dlq_size`.
 *
 * LIVE ingestion: EnhancedExportEngine records `performance.now() - t0` deltas
 * into recordExport / recordStageDuration on every export job — the SAME
 * `Date.now()-Date.now()`-style miscalculation vector the three sibling
 * chokepoints document. A single NaN / ±Infinity sample is sticky through the
 * `+` accumulator, `/count` average and `sort`, so it would contaminate every
 * published format/stage aggregate and render a literal `NaN` token in the
 * `/api/monitoring/metrics` Prometheus output (invalid exposition).
 *
 * The collector guards each ingestion site with a drop-on-non-finite
 * (`!Number.isFinite(value) || value < 0 → return`) — a DIFFERENT strategy from
 * the siblings' coerce-to-0 (`sanitizeFinite(x, 0)`), but equivalent for the
 * leak contract: no non-finite value reaches a published aggregate. This file
 * REGISTERS the collector in the sanitize-finite CLOSED-SET by locking that
 * contract behaviorally: feed NaN / ±∞ at every numeric ingestion point and
 * assert (a) every aggregate in the snapshot stays finite and (b) BOTH publish
 * paths (`exportPrometheusMetrics` via prometheus-exporter AND the collector's
 * own `toPrometheusText`) render no `NaN` token. Without this file, a refactor
 * that drops a `recordSample` guard would pass every existing test.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExportMetricsCollector } from '../export-metrics-collector';
import { exportPrometheusMetrics } from '../../monitoring/prometheus-exporter';
import { HttpMetricsCollector } from '../../monitoring/http-metrics-collector';
import { PipelineMetricsCollector } from '../../monitoring/pipeline-metrics-collector';

describe('ExportMetricsCollector — non-finite ingestion must not leak into aggregates or Prometheus output', () => {
  let collector: ExportMetricsCollector;

  beforeEach(() => {
    collector = new ExportMetricsCollector();
  });

  /** Helper: the single 'mp4' format aggregate from a snapshot. */
  const mp4Of = (snap: ReturnType<ExportMetricsCollector['getSnapshot']>) =>
    snap.formats.find(f => f.format === 'mp4')!;

  // --- recordExport: durationMs ---

  it('drops a poisoned durationMs sample and keeps duration aggregates finite', () => {
    collector.recordExport('mp4', 'success', 10);
    collector.recordExport('mp4', 'success', NaN); // poisoned — entire export dropped
    collector.recordExport('mp4', 'success', 30);

    const f = mp4Of(collector.getSnapshot());
    // The good samples (10, 30) survive; avg = 20, not NaN.
    expect(Number.isFinite(f.duration.avgMs)).toBe(true);
    expect(f.duration.avgMs).toBe(20);
    expect(Number.isFinite(f.duration.sumMs)).toBe(true);
    expect(Number.isFinite(f.duration.minMs)).toBe(true);
    expect(Number.isFinite(f.duration.maxMs)).toBe(true);
    expect(Number.isFinite(f.duration.percentiles.p95)).toBe(true);
  });

  it('drops ±Infinity durationMs samples and keeps duration aggregates finite', () => {
    collector.recordExport('mp4', 'success', 10);
    collector.recordExport('mp4', 'success', Infinity);
    collector.recordExport('mp4', 'success', -Infinity);
    collector.recordExport('mp4', 'success', 30);

    const f = mp4Of(collector.getSnapshot());
    expect(Number.isFinite(f.duration.avgMs)).toBe(true);
    expect(f.duration.avgMs).toBe(20);
    expect(Number.isFinite(f.duration.percentiles.p99)).toBe(true);
  });

  // --- recordExport: fileSizeBytes (durationMs valid, fileSize poisoned) ---

  it('drops a poisoned fileSizeBytes but still counts the export; fileSize aggregates stay finite', () => {
    collector.recordExport('mp4', 'success', 10, 1000);
    collector.recordExport('mp4', 'success', 20, NaN); // fileSize dropped, export counted
    collector.recordExport('mp4', 'success', 30, 3000);

    const f = mp4Of(collector.getSnapshot());
    // Duration counted all three (good durations); fileSize dropped the NaN.
    expect(f.duration.count).toBe(3);
    expect(f.fileSize.count).toBe(2);
    expect(Number.isFinite(f.fileSize.avg)).toBe(true);
    expect(f.fileSize.avg).toBe(2000);
    expect(Number.isFinite(f.fileSize.percentiles.p95)).toBe(true);
  });

  it('drops ±Infinity fileSizeBytes and keeps fileSize aggregates finite', () => {
    collector.recordExport('mp4', 'success', 10, 1000);
    collector.recordExport('mp4', 'success', 20, Infinity);

    const f = mp4Of(collector.getSnapshot());
    expect(Number.isFinite(f.fileSize.sum)).toBe(true);
    expect(Number.isFinite(f.fileSize.max)).toBe(true);
  });

  // --- recordStageDuration ---

  it('drops a poisoned stage duration and keeps stage aggregates finite', () => {
    collector.recordStageDuration('rendering', 50);
    collector.recordStageDuration('rendering', NaN);
    collector.recordStageDuration('rendering', 70);

    const stage = collector.getSnapshot().stages.find(s => s.stage === 'rendering')!;
    expect(Number.isFinite(stage.avgMs)).toBe(true);
    expect(stage.avgMs).toBe(60);
    expect(Number.isFinite(stage.percentiles.p95)).toBe(true);
  });

  it('drops ±Infinity stage durations and keeps stage aggregates finite', () => {
    collector.recordStageDuration('encoding', 40);
    collector.recordStageDuration('encoding', Infinity);
    collector.recordStageDuration('encoding', -Infinity);

    const stage = collector.getSnapshot().stages.find(s => s.stage === 'encoding')!;
    expect(Number.isFinite(stage.avgMs)).toBe(true);
    expect(Number.isFinite(stage.minMs)).toBe(true);
    expect(Number.isFinite(stage.maxMs)).toBe(true);
  });

  // --- recordQueueWaitTimeMs → avgWaitTimeMs gauge ---

  it('drops a poisoned queue wait time and keeps avgWaitTimeMs finite', () => {
    collector.recordQueueDequeue('normal');
    collector.recordQueueWaitTimeMs(100);
    collector.recordQueueWaitTimeMs(NaN);
    collector.recordQueueWaitTimeMs(Infinity);
    collector.recordQueueWaitTimeMs(300);

    const { queue } = collector.getSnapshot();
    expect(Number.isFinite(queue.avgWaitTimeMs)).toBe(true);
    // Good waits (100, 300) → avg 200.
    expect(queue.avgWaitTimeMs).toBe(200);
  });

  // --- recordQueueSize / recordDlqSize gauges (drop-on-non-finite) ---

  it('rejects a non-finite queue size and keeps the previously-recorded finite gauge', () => {
    collector.recordQueueSize(5);
    collector.recordQueueSize(NaN);
    collector.recordQueueSize(Infinity);

    expect(collector.getSnapshot().queue.queueSize).toBe(5);
  });

  it('rejects a non-finite DLQ size and keeps the previously-recorded finite gauge', () => {
    collector.recordDlqSize(2);
    collector.recordDlqSize(NaN);

    expect(collector.getSnapshot().queue.dlqSize).toBe(2);
  });

  // --- recordQueuePriorityDistribution → snapshot.queue.priorityDistribution ---

  it('drops a poisoned priority distribution and keeps the previously-recorded finite distribution', () => {
    collector.recordQueuePriorityDistribution(3, 2, 1);
    collector.recordQueuePriorityDistribution(NaN, 2, 1); // poisoned — whole update dropped
    collector.recordQueuePriorityDistribution(3, Infinity, 1);
    collector.recordQueuePriorityDistribution(3, 2, -1);

    const { priorityDistribution } = collector.getSnapshot().queue;
    // Last VALID distribution (3,2,1) retained; no poisoned update landed.
    expect(priorityDistribution).toEqual({ high: 3, normal: 2, low: 1 });
    expect(Number.isFinite(priorityDistribution.high)).toBe(true);
    expect(Number.isFinite(priorityDistribution.normal)).toBe(true);
    expect(Number.isFinite(priorityDistribution.low)).toBe(true);
  });

  it('keeps the default zero distribution when the first update is poisoned', () => {
    collector.recordQueuePriorityDistribution(NaN, 0, 0);
    collector.recordQueuePriorityDistribution(0, Infinity, 0);

    const { priorityDistribution } = collector.getSnapshot().queue;
    expect(priorityDistribution).toEqual({ high: 0, normal: 0, low: 0 });
  });

  // --- Publish path A: prometheus-exporter.exportPrometheusMetrics ---

  it('renders no NaN token in the exportPrometheusMetrics publish path after poisoned ingestion', () => {
    collector.recordExport('mp4', 'success', 10, 1000);
    collector.recordExport('mp4', 'success', NaN);
    collector.recordExport('mp4', 'success', Infinity);
    // One good stage sample so the stage metric is emitted; the poisoned one is dropped.
    collector.recordStageDuration('rendering', 50);
    collector.recordStageDuration('rendering', NaN);
    collector.recordQueueDequeue('normal');
    collector.recordQueueWaitTimeMs(NaN);
    collector.recordQueueSize(1);

    const output = exportPrometheusMetrics({
      // Empty HTTP + pipeline snapshots keep the output deterministic — only the
      // export metrics are emitted.
      snapshot: new HttpMetricsCollector().getSnapshot(),
      pipelineSnapshot: new PipelineMetricsCollector().getSnapshot(),
      exportSnapshot: collector.getSnapshot(),
    });

    expect(output).toContain('export_duration_ms');
    expect(output).toContain('export_stage_duration_ms');
    expect(output).not.toMatch(/NaN/);
    expect(output).not.toMatch(/Infinity/);
  });

  // --- Publish path B: the collector's own toPrometheusText ---

  it('renders no NaN token in the toPrometheusText publish path after poisoned ingestion', () => {
    collector.recordExport('webm', 'success', 20, 2000);
    collector.recordExport('webm', 'failure', NaN);
    collector.recordStageDuration('encoding', -Infinity);
    collector.recordQueueWaitTimeMs(Infinity);

    const output = collector.toPrometheusText();

    expect(output).toContain('export_duration_ms');
    expect(output).not.toMatch(/NaN/);
    expect(output).not.toMatch(/Infinity/);
  });
});
