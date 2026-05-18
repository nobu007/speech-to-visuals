/**
 * TASK-0155: Stage Timing Metrics Unit Tests
 *
 * Tests for stage-timing-metrics.ts (REQ-097):
 *   - createTimingRecord: timing record creation with throughput calculation
 *   - aggregateTimingReport: multi-stage report aggregation
 *   - timeStage: async stage wrapper with automatic timing
 */

import {
  createTimingRecord,
  aggregateTimingReport,
  timeStage,
  StageTimingRecord,
} from '@/pipeline/stage-timing-metrics';

// ---------- createTimingRecord ----------

describe('createTimingRecord', () => {
  it('creates a record with correct duration and throughput', () => {
    const record = createTimingRecord('transcription', 100, 200, 50);
    expect(record.stageName).toBe('transcription');
    expect(record.startTime).toBe(100);
    expect(record.endTime).toBe(200);
    expect(record.durationMs).toBe(100);
    expect(record.itemsProcessed).toBe(50);
    expect(record.throughputPerMs).toBeCloseTo(0.5);
  });

  it('returns zero throughput when duration is zero', () => {
    const record = createTimingRecord('analysis', 100, 100, 50);
    expect(record.durationMs).toBe(0);
    expect(record.throughputPerMs).toBe(0);
  });

  it('handles zero items processed', () => {
    const record = createTimingRecord('layout', 0, 1000, 0);
    expect(record.itemsProcessed).toBe(0);
    expect(record.throughputPerMs).toBe(0);
  });
});

// ---------- aggregateTimingReport ----------

describe('aggregateTimingReport', () => {
  it('aggregates empty array into zero totals', () => {
    const report = aggregateTimingReport([]);
    expect(report.stages).toEqual([]);
    expect(report.totalDurationMs).toBe(0);
    expect(report.totalItemsProcessed).toBe(0);
    expect(report.overallThroughputPerMs).toBe(0);
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('aggregates a single stage correctly', () => {
    const stage = createTimingRecord('transcription', 0, 500, 100);
    const report = aggregateTimingReport([stage]);
    expect(report.totalDurationMs).toBe(500);
    expect(report.totalItemsProcessed).toBe(100);
    expect(report.overallThroughputPerMs).toBeCloseTo(0.2);
  });

  it('aggregates multiple stages with correct totals', () => {
    const stages: StageTimingRecord[] = [
      { stageName: 'transcription', startTime: 0, endTime: 100, durationMs: 100, itemsProcessed: 10, throughputPerMs: 0.1 },
      { stageName: 'analysis', startTime: 100, endTime: 400, durationMs: 300, itemsProcessed: 5, throughputPerMs: 0.0167 },
      { stageName: 'layout', startTime: 400, endTime: 600, durationMs: 200, itemsProcessed: 3, throughputPerMs: 0.015 },
    ];
    const report = aggregateTimingReport(stages);
    expect(report.stages).toHaveLength(3);
    expect(report.totalDurationMs).toBe(600);
    expect(report.totalItemsProcessed).toBe(18);
    expect(report.overallThroughputPerMs).toBeCloseTo(18 / 600);
  });
});

// ---------- timeStage ----------

describe('timeStage', () => {
  it('wraps async function and records timing', async () => {
    const result = await timeStage('test-stage', 42, async () => 'done');
    expect(result.result).toBe('done');
    expect(result.timing.stageName).toBe('test-stage');
    expect(result.timing.itemsProcessed).toBe(42);
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.startTime).toBeLessThanOrEqual(result.timing.endTime);
  });

  it('measures actual elapsed time for slow function', async () => {
    const result = await timeStage('slow-stage', 1, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'slow-done';
    });
    expect(result.result).toBe('slow-done');
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(40);
  });

  it('propagates errors from the stage function', async () => {
    await expect(
      timeStage('error-stage', 0, async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');
  });
});
