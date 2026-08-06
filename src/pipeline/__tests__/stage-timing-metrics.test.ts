/**
 * Tests for StageTimingMetrics (TASK-0143 / REQ-097)
 * Covers: createTimingRecord, aggregateTimingReport, timeStage
 */

import {
  createTimingRecord,
  aggregateTimingReport,
  timeStage,
  StageTimingRecord,
} from '../stage-timing-metrics';

describe('createTimingRecord', () => {
  it('creates a record with correct duration', () => {
    const record = createTimingRecord('analysis', 1000, 2000, 50);

    expect(record.stageName).toBe('analysis');
    expect(record.startTime).toBe(1000);
    expect(record.endTime).toBe(2000);
    expect(record.durationMs).toBe(1000);
    expect(record.itemsProcessed).toBe(50);
    expect(record.throughputPerMs).toBeCloseTo(0.05, 5);
    expect(record.retryAttempts).toBe(0);
  });

  it('computes throughput as items/durationMs', () => {
    const record = createTimingRecord('stage', 0, 100, 200);

    expect(record.durationMs).toBe(100);
    expect(record.throughputPerMs).toBe(2); // 200/100
  });

  it('sets throughput to 0 when duration is 0', () => {
    const record = createTimingRecord('instant', 500, 500, 10);

    expect(record.durationMs).toBe(0);
    expect(record.throughputPerMs).toBe(0);
  });

  it('handles negative duration (endTime before startTime)', () => {
    const record = createTimingRecord('clock-skew', 2000, 1000, 5);

    // Source clamps negative durations to 0 via Math.max(0, rawDuration)
    expect(record.durationMs).toBe(0);
    expect(record.throughputPerMs).toBe(0); // clamped duration → 0 throughput
  });

  it('accepts custom retryAttempts', () => {
    const record = createTimingRecord('flaky', 0, 500, 1, 3);

    expect(record.retryAttempts).toBe(3);
  });

  it('defaults retryAttempts to 0', () => {
    const record = createTimingRecord('normal', 0, 100, 1);

    expect(record.retryAttempts).toBe(0);
  });

  it('handles zero items processed', () => {
    const record = createTimingRecord('noop', 0, 100, 0);

    expect(record.itemsProcessed).toBe(0);
    expect(record.throughputPerMs).toBe(0);
  });
});

describe('aggregateTimingReport', () => {
  it('aggregates multiple stage records', () => {
    const stages = [
      createTimingRecord('a', 0, 100, 10),
      createTimingRecord('b', 100, 300, 20),
      createTimingRecord('c', 300, 600, 30),
    ];
    const report = aggregateTimingReport(stages);

    expect(report.stages).toHaveLength(3);
    expect(report.totalDurationMs).toBe(600); // 100 + 200 + 300
    expect(report.totalItemsProcessed).toBe(60); // 10 + 20 + 30
  });

  it('computes overall throughput', () => {
    const stages = [
      createTimingRecord('a', 0, 100, 10),
      createTimingRecord('b', 0, 100, 30),
    ];
    const report = aggregateTimingReport(stages);

    // total items = 40, total duration = 200
    expect(report.overallThroughputPerMs).toBeCloseTo(0.2, 5);
  });

  it('handles empty stages array', () => {
    const report = aggregateTimingReport([]);

    expect(report.stages).toHaveLength(0);
    expect(report.totalDurationMs).toBe(0);
    expect(report.totalItemsProcessed).toBe(0);
    expect(report.overallThroughputPerMs).toBe(0);
  });

  it('sets overall throughput to 0 when total duration is 0', () => {
    const stages = [
      createTimingRecord('a', 500, 500, 10),
    ];
    const report = aggregateTimingReport(stages);

    expect(report.totalDurationMs).toBe(0);
    expect(report.overallThroughputPerMs).toBe(0);
  });

  it('includes a timestamp', () => {
    const before = Date.now();
    const report = aggregateTimingReport([createTimingRecord('a', 0, 1, 1)]);
    const after = Date.now();

    expect(report.timestamp).toBeGreaterThanOrEqual(before);
    expect(report.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('timeStage', () => {
  it('wraps an async function and records timing', async () => {
    const result = await timeStage('test-stage', 5, async () => 42);

    expect(result.result).toBe(42);
    expect(result.timing.stageName).toBe('test-stage');
    expect(result.timing.itemsProcessed).toBe(5);
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.retryAttempts).toBe(0);
  });

  it('passes through the return value for objects', async () => {
    const obj = { data: [1, 2, 3] };
    const result = await timeStage('obj-stage', 3, async () => obj);

    expect(result.result).toBe(obj);
  });

  it('propagates errors from the stage function', async () => {
    const error = new Error('stage failed');

    await expect(
      timeStage('failing', 1, async () => { throw error; }),
    ).rejects.toThrow('stage failed');
  });

  it('accepts retryAttempts parameter', async () => {
    const result = await timeStage('retry-stage', 1, async () => 'ok', 2);

    expect(result.timing.retryAttempts).toBe(2);
  });

  it('defaults retryAttempts to 0 when not provided', async () => {
    const result = await timeStage('no-retry', 1, async () => 'ok');

    expect(result.timing.retryAttempts).toBe(0);
  });

  it('records startTime and endTime with endTime >= startTime', async () => {
    const beforeCall = Date.now();
    const result = await timeStage('timing-test', 1, async () => {
      // minimal delay to ensure measurable time
      return 'done';
    });

    expect(result.timing.startTime).toBeGreaterThanOrEqual(beforeCall);
    expect(result.timing.endTime).toBeGreaterThanOrEqual(result.timing.startTime);
  });

  it('handles null return value', async () => {
    const result = await timeStage<null>('null-stage', 0, async () => null);

    expect(result.result).toBeNull();
  });

  it('handles promise resolving to undefined', async () => {
    const result = await timeStage<void>('void-stage', 0, async () => {});

    expect(result.result).toBeUndefined();
    expect(result.timing.itemsProcessed).toBe(0);
  });
});
