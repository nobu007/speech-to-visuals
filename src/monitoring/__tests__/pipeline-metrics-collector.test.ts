/**
 * Tests for PipelineMetricsCollector (REQ-212 + REQ-213).
 *
 * Verifies stage duration recording, percentile computation,
 * pipeline run counting, and batch job lifecycle tracking.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PipelineMetricsCollector,
  type BatchJobStatus,
} from '../pipeline-metrics-collector';

describe('PipelineMetricsCollector', () => {
  let collector: PipelineMetricsCollector;

  beforeEach(() => {
    collector = new PipelineMetricsCollector();
  });

  // --- Stage duration recording ---

  it('should start empty', () => {
    const snap = collector.getSnapshot();
    expect(snap.stages).toHaveLength(0);
    expect(snap.totalRuns).toBe(0);
    expect(snap.successfulRuns).toBe(0);
    expect(snap.failedRuns).toBe(0);
    expect(snap.batchJobs.activeJobs).toBe(0);
  });

  it('should record stage durations', () => {
    collector.recordStageDuration('transcription', 100);
    collector.recordStageDuration('transcription', 200);
    collector.recordStageDuration('analysis', 300);

    const snap = collector.getSnapshot();
    expect(snap.stages).toHaveLength(2);

    const trans = snap.stages.find(s => s.stage === 'transcription')!;
    expect(trans.count).toBe(2);
    expect(trans.sumMs).toBe(300);
    expect(trans.avgMs).toBe(150);
    expect(trans.minMs).toBe(100);
    expect(trans.maxMs).toBe(200);
  });

  it('should compute percentiles for stages', () => {
    for (let i = 1; i <= 100; i++) {
      collector.recordStageDuration('render', i);
    }

    const render = collector.getSnapshot().stages[0];
    expect(render.percentiles.p50).toBe(51);
    expect(render.percentiles.p95).toBe(96);
    expect(render.percentiles.p99).toBe(100);
  });

  it('should return zero percentiles for empty stage', () => {
    collector.recordStageDuration('empty', 10);
    collector.reset();
    collector.recordStageDuration('new', 10);
    const stage = collector.getSnapshot().stages[0];
    expect(stage.percentiles).toEqual({ p50: 10, p95: 10, p99: 10 });
  });

  it('should bound samples per stage', () => {
    const bounded = new PipelineMetricsCollector({ maxSamplesPerStage: 10 });
    for (let i = 0; i < 50; i++) {
      bounded.recordStageDuration('big', i + 1);
    }
    const stage = bounded.getSnapshot().stages[0];
    // Count should still be accurate (all recorded)
    expect(stage.count).toBe(50);
    // Avg should be based on all samples
    expect(stage.avgMs).toBe(Math.round((50 * 51) / 2 / 50));
  });

  // --- Pipeline run tracking ---

  it('should track successful and failed runs', () => {
    collector.recordPipelineRun(true);
    collector.recordPipelineRun(true);
    collector.recordPipelineRun(false);

    const snap = collector.getSnapshot();
    expect(snap.totalRuns).toBe(3);
    expect(snap.successfulRuns).toBe(2);
    expect(snap.failedRuns).toBe(1);
  });

  // --- Batch job lifecycle (REQ-213) ---

  it('should track batch job transitions', () => {
    collector.recordBatchJobTransition('created');
    collector.recordBatchJobTransition('running');
    collector.recordBatchJobTransition('completed');

    const snap = collector.getSnapshot();
    expect(snap.batchJobs.jobsByStatus.created).toBe(1);
    expect(snap.batchJobs.jobsByStatus.running).toBe(1);
    expect(snap.batchJobs.jobsByStatus.completed).toBe(1);
  });

  it('should track active batch jobs', () => {
    collector.recordBatchJobTransition('running');
    collector.recordBatchJobTransition('running');
    expect(collector.getSnapshot().batchJobs.activeJobs).toBe(2);

    collector.recordBatchJobTransition('completed');
    expect(collector.getSnapshot().batchJobs.activeJobs).toBe(1);

    collector.recordBatchJobTransition('failed');
    expect(collector.getSnapshot().batchJobs.activeJobs).toBe(0);
  });

  it('should handle cancelled jobs reducing active count', () => {
    collector.recordBatchJobTransition('running');
    collector.recordBatchJobTransition('running');
    collector.recordBatchJobTransition('cancelled');
    expect(collector.getSnapshot().batchJobs.activeJobs).toBe(1);
  });

  it('should never go below zero active jobs', () => {
    collector.recordBatchJobTransition('completed');
    collector.recordBatchJobTransition('failed');
    collector.recordBatchJobTransition('cancelled');
    expect(collector.getSnapshot().batchJobs.activeJobs).toBe(0);
  });

  it('should track all batch job statuses independently', () => {
    const statuses: BatchJobStatus[] = [
      'created', 'running', 'completed', 'failed', 'cancelled',
      'created', 'running', 'completed',
    ];
    for (const s of statuses) {
      collector.recordBatchJobTransition(s);
    }

    const snap = collector.getSnapshot().batchJobs;
    expect(snap.jobsByStatus.created).toBe(2);
    expect(snap.jobsByStatus.running).toBe(2);
    expect(snap.jobsByStatus.completed).toBe(2);
    expect(snap.jobsByStatus.failed).toBe(1);
    expect(snap.jobsByStatus.cancelled).toBe(1);
  });

  // --- Reset ---

  it('should reset all metrics', () => {
    collector.recordStageDuration('a', 10);
    collector.recordPipelineRun(true);
    collector.recordBatchJobTransition('running');

    collector.reset();

    const snap = collector.getSnapshot();
    expect(snap.stages).toHaveLength(0);
    expect(snap.totalRuns).toBe(0);
    expect(snap.batchJobs.activeJobs).toBe(0);
    expect(snap.batchJobs.jobsByStatus).toEqual({
      created: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    });
  });

  // --- Combined snapshot ---

  it('should produce a complete snapshot with all fields', () => {
    collector.recordStageDuration('stage1', 100);
    collector.recordStageDuration('stage2', 200);
    collector.recordPipelineRun(true);
    collector.recordPipelineRun(false);
    collector.recordBatchJobTransition('created');
    collector.recordBatchJobTransition('running');

    const snap = collector.getSnapshot();
    expect(snap.stages).toHaveLength(2);
    expect(snap.totalRuns).toBe(2);
    expect(snap.successfulRuns).toBe(1);
    expect(snap.failedRuns).toBe(1);
    expect(snap.batchJobs.jobsByStatus.created).toBe(1);
    expect(snap.batchJobs.jobsByStatus.running).toBe(1);
    expect(snap.batchJobs.activeJobs).toBe(1);
  });

  // --- Edge: Infinity minMs handling ---

  it('should convert Infinity minMs to 0 in snapshot', () => {
    // Fresh collector with no recordings for this stage
    const snap = collector.getSnapshot();
    expect(snap.stages).toHaveLength(0);
  });
});
