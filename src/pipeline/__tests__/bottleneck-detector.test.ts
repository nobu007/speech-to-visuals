/**
 * Tests for BottleneckDetector (TASK-0143 / REQ-097)
 * Covers: classifyBottleneck, detectBottlenecks
 */

import {
  classifyBottleneck,
  detectBottlenecks,
  BottleneckSeverity,
} from '../bottleneck-detector';
import { StageTimingRecord } from '../stage-timing-metrics';

// Helper: create a StageTimingRecord
function makeRecord(
  stageName: string,
  durationMs: number,
  itemsProcessed: number = 1,
): StageTimingRecord {
  return {
    stageName,
    startTime: 0,
    endTime: durationMs,
    durationMs,
    itemsProcessed,
    throughputPerMs: durationMs > 0 ? itemsProcessed / durationMs : 0,
    retryAttempts: 0,
  };
}

describe('classifyBottleneck', () => {
  it('returns "critical" for >= 60%', () => {
    expect(classifyBottleneck(0.60)).toBe('critical');
    expect(classifyBottleneck(0.75)).toBe('critical');
    expect(classifyBottleneck(1.0)).toBe('critical');
  });

  it('returns "warning" for >= 40% and < 60%', () => {
    expect(classifyBottleneck(0.40)).toBe('warning');
    expect(classifyBottleneck(0.50)).toBe('warning');
    expect(classifyBottleneck(0.59)).toBe('warning');
  });

  it('returns "none" for < 40%', () => {
    expect(classifyBottleneck(0)).toBe('none');
    expect(classifyBottleneck(0.10)).toBe('none');
    expect(classifyBottleneck(0.39)).toBe('none');
  });

  it('handles edge case: exactly 0%', () => {
    expect(classifyBottleneck(0)).toBe('none');
  });
});

describe('detectBottlenecks', () => {
  it('returns no bottleneck for evenly distributed stages', () => {
    const stages = [
      makeRecord('a', 100),
      makeRecord('b', 100),
      makeRecord('c', 100),
      makeRecord('d', 100),
    ];
    const report = detectBottlenecks(stages);

    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.stages).toHaveLength(4);
    expect(report.summary).toContain('No bottleneck');
  });

  it('detects a critical bottleneck when one stage dominates', () => {
    const stages = [
      makeRecord('transcription', 700),
      makeRecord('analysis', 100),
      makeRecord('layout', 100),
      makeRecord('render', 100),
    ];
    const report = detectBottlenecks(stages);

    expect(report.hasBottleneck).toBe(true);
    expect(report.worstBottleneck).not.toBeNull();
    expect(report.worstBottleneck!.stageName).toBe('transcription');
    expect(report.worstBottleneck!.severity).toBe('critical');
    expect(report.worstBottleneck!.percentOfTotal).toBeCloseTo(0.7, 1);
  });

  it('detects a warning-level bottleneck at exactly 40%', () => {
    const stages = [
      makeRecord('slow', 40),
      makeRecord('fast', 60),
    ];
    const report = detectBottlenecks(stages);

    expect(report.hasBottleneck).toBe(true);
    // 40/(40+60) = 0.40 → warning
    const slowStage = report.stages.find(s => s.stageName === 'slow');
    expect(slowStage!.severity).toBe('warning');
  });

  it('handles empty stages array', () => {
    const report = detectBottlenecks([]);

    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.stages).toHaveLength(0);
    expect(report.totalDurationMs).toBeUndefined(); // not part of BottleneckReport
    expect(report.summary).toContain('No bottleneck');
  });

  it('handles single stage (100% = critical)', () => {
    const stages = [makeRecord('only', 500)];
    const report = detectBottlenecks(stages);

    expect(report.hasBottleneck).toBe(true);
    expect(report.worstBottleneck!.severity).toBe('critical');
    expect(report.worstBottleneck!.percentOfTotal).toBe(1);
  });

  it('handles zero-duration stages without division by zero', () => {
    const stages = [
      makeRecord('a', 0),
      makeRecord('b', 0),
    ];
    const report = detectBottlenecks(stages);

    expect(report.hasBottleneck).toBe(false);
    for (const stage of report.stages) {
      expect(stage.percentOfTotal).toBe(0);
      expect(stage.severity).toBe('none');
    }
  });

  it('selects worst bottleneck by highest percentage when multiple exist', () => {
    const stages = [
      makeRecord('warning-stage', 45),
      makeRecord('critical-stage', 55),
    ];
    const report = detectBottlenecks(stages);

    // 55/100 = 0.55 → warning; 45/100 = 0.45 → warning
    // Neither hits 60% threshold, but 55% is worse
    expect(report.hasBottleneck).toBe(true);
    expect(report.worstBottleneck!.stageName).toBe('critical-stage');
  });

  it('includes correct messages for bottleneck and non-bottleneck stages', () => {
    const stages = [
      makeRecord('dominant', 800),
      makeRecord('minor', 200),
    ];
    const report = detectBottlenecks(stages);

    const dominant = report.stages.find(s => s.stageName === 'dominant')!;
    expect(dominant.message).toContain('BOTTLENECK');
    expect(dominant.message).toContain('CRITICAL');

    const minor = report.stages.find(s => s.stageName === 'minor')!;
    expect(minor.message).not.toContain('BOTTLENECK');
    expect(minor.message).toContain('minor');
  });

  it('includes a timestamp in the report', () => {
    const before = Date.now();
    const report = detectBottlenecks([makeRecord('a', 100)]);
    const after = Date.now();

    expect(report.timestamp).toBeGreaterThanOrEqual(before);
    expect(report.timestamp).toBeLessThanOrEqual(after);
  });

  it('summary contains stage name and severity when bottleneck exists', () => {
    const stages = [makeRecord('problematic', 900), makeRecord('ok', 100)];
    const report = detectBottlenecks(stages);

    expect(report.summary).toContain('problematic');
    expect(report.summary).toContain('critical');
  });
});
