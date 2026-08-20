/**
 * Tests for BottleneckDetector (src/pipeline/bottleneck-detector.ts)
 */

import { classifyBottleneck, detectBottlenecks } from '@/pipeline/bottleneck-detector';
import type { BottleneckInfo, BottleneckReport } from '@/pipeline/bottleneck-detector';
import type { StageTimingRecord } from '@/pipeline/stage-timing-metrics';

/**
 * Fail-loud accessors replacing the old `!` postfixes: a missing worst
 * bottleneck / stage keeps the RED verdict with a diagnosable message
 * instead of surfacing `new undefined()` mid-test.
 */
function requireWorstBottleneck(report: BottleneckReport): BottleneckInfo {
  const worst = report.worstBottleneck;
  if (worst === null) {
    throw new Error('expected report to carry a worstBottleneck');
  }
  return worst;
}

function requireStage(report: BottleneckReport, stageName: string): BottleneckInfo {
  const found = report.stages.find(s => s.stageName === stageName);
  if (found === undefined) {
    throw new Error(`stage '${stageName}' not found in report`);
  }
  return found;
}

describe('classifyBottleneck', () => {
  test('returns "none" for percentages below 40%', () => {
    expect(classifyBottleneck(0)).toBe('none');
    expect(classifyBottleneck(0.1)).toBe('none');
    expect(classifyBottleneck(0.39)).toBe('none');
  });

  test('returns "warning" for 40-59%', () => {
    expect(classifyBottleneck(0.40)).toBe('warning');
    expect(classifyBottleneck(0.50)).toBe('warning');
    expect(classifyBottleneck(0.59)).toBe('warning');
  });

  test('returns "critical" for 60% and above', () => {
    expect(classifyBottleneck(0.60)).toBe('critical');
    expect(classifyBottleneck(0.80)).toBe('critical');
    expect(classifyBottleneck(1.0)).toBe('critical');
  });
});

describe('detectBottlenecks', () => {
  /** Helper to create a StageTimingRecord */
  function stage(name: string, durationMs: number): StageTimingRecord {
    return {
      stageName: name,
      startTime: 0,
      endTime: durationMs,
      durationMs,
      itemsProcessed: 1,
      throughputPerMs: 1 / durationMs,
    };
  }

  test('empty stages produce no bottlenecks', () => {
    const report = detectBottlenecks([]);
    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.stages).toHaveLength(0);
    expect(report.summary).toContain('No bottleneck');
  });

  test('single stage at exactly 40% triggers warning bottleneck', () => {
    const report = detectBottlenecks([
      stage('a', 30),
      stage('b', 40),
      stage('c', 30),
    ]);
    expect(report.hasBottleneck).toBe(true);
    expect(requireWorstBottleneck(report).stageName).toBe('b');
    expect(requireWorstBottleneck(report).severity).toBe('warning');
  });

  test('all stages < 40% produce no bottleneck', () => {
    const report = detectBottlenecks([
      stage('a', 250),
      stage('b', 250),
      stage('c', 250),
      stage('d', 250),
    ]);
    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.stages.every(s => s.severity === 'none')).toBe(true);
  });

  test('single dominant stage triggers critical bottleneck', () => {
    const report = detectBottlenecks([
      stage('slow', 700),
      stage('fast', 200),
      stage('medium', 100),
    ]);
    expect(report.hasBottleneck).toBe(true);
    expect(report.worstBottleneck).not.toBeNull();
    expect(requireWorstBottleneck(report).stageName).toBe('slow');
    expect(requireWorstBottleneck(report).severity).toBe('critical');
    expect(requireWorstBottleneck(report).percentOfTotal).toBeCloseTo(0.7);
  });

  test('stage at 45% triggers warning', () => {
    const report = detectBottlenecks([
      stage('moderate', 450),
      stage('other', 550),
    ]);
    expect(report.hasBottleneck).toBe(true);
    expect(requireStage(report, 'moderate').severity).toBe('warning');
  });

  test('multiple bottlenecks: worstBottleneck is the highest percentage', () => {
    const report = detectBottlenecks([
      stage('critical', 500),
      stage('warning', 300),
      stage('ok', 200),
    ]);
    expect(requireWorstBottleneck(report).stageName).toBe('critical');
    // 500/1000 = 50% → severity 'warning' (not 60%+ which is 'critical')
    expect(requireWorstBottleneck(report).severity).toBe('warning');
  });

  test('stage messages differ between bottleneck and non-bottleneck', () => {
    const report = detectBottlenecks([
      stage('slow', 700),
      stage('fast', 300),
    ]);
    const slowMsg = requireStage(report, 'slow').message;
    const fastMsg = requireStage(report, 'fast').message;
    expect(slowMsg).toContain('BOTTLENECK');
    expect(fastMsg).not.toContain('BOTTLENECK');
  });

  test('summary contains bottleneck info when present', () => {
    const report = detectBottlenecks([
      stage('heavy', 800),
      stage('light', 200),
    ]);
    expect(report.summary).toContain('heavy');
    expect(report.summary).toContain('80.0%');
  });

  test('summary indicates no bottleneck when all stages are fine', () => {
    const report = detectBottlenecks([
      stage('a', 250),
      stage('b', 250),
      stage('c', 250),
      stage('d', 250),
    ]);
    expect(report.summary).toContain('No bottleneck');
  });

  test('timestamp is a valid number', () => {
    const report = detectBottlenecks([stage('a', 100)]);
    expect(typeof report.timestamp).toBe('number');
    expect(report.timestamp).toBeGreaterThan(0);
  });

  test('all stages have percentage values that sum to ~1.0', () => {
    const report = detectBottlenecks([
      stage('a', 100),
      stage('b', 200),
      stage('c', 300),
    ]);
    const totalPct = report.stages.reduce((sum, s) => sum + s.percentOfTotal, 0);
    expect(totalPct).toBeCloseTo(1.0);
  });

  test('handles zero total duration (all durations are 0)', () => {
    const report = detectBottlenecks([
      stage('a', 0),
      stage('b', 0),
    ]);
    expect(report.hasBottleneck).toBe(false);
    expect(report.stages.every(s => s.percentOfTotal === 0)).toBe(true);
  });
});
