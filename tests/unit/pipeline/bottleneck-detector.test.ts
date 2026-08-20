/**
 * TASK-0155: Bottleneck Detector Unit Tests
 *
 * Tests for bottleneck-detector.ts (REQ-097):
 *   - classifyBottleneck: severity classification at threshold boundaries
 *   - detectBottlenecks: full report generation with worst-bottleneck selection
 */

import {
  classifyBottleneck,
  detectBottlenecks,
  BottleneckSeverity,
  BottleneckInfo,
  BottleneckReport,
} from '@/pipeline/bottleneck-detector';
import { StageTimingRecord } from '@/pipeline/stage-timing-metrics';

/**
 * Fail-loud accessor for `report.worstBottleneck` (`BottleneckInfo | null` —
 * non-null exactly when `hasBottleneck`): a null used to surface as
 * `worstBottleneck!.stageName` TypeError, the helper keeps the RED verdict
 * with a diagnosable message.
 */
function requireWorstBottleneck(report: BottleneckReport): BottleneckInfo {
  const worst = report.worstBottleneck;
  if (worst === null) {
    throw new Error('worstBottleneck was null (no bottleneck detected)');
  }
  return worst;
}

// ---------- classifyBottleneck ----------

describe('classifyBottleneck', () => {
  it('returns "none" for low percentage', () => {
    expect(classifyBottleneck(0.10)).toBe('none');
    expect(classifyBottleneck(0.39)).toBe('none');
  });

  it('returns "warning" at exactly 40%', () => {
    expect(classifyBottleneck(0.40)).toBe('warning');
  });

  it('returns "warning" between 40% and 60%', () => {
    expect(classifyBottleneck(0.50)).toBe('warning');
    expect(classifyBottleneck(0.59)).toBe('warning');
  });

  it('returns "critical" at exactly 60%', () => {
    expect(classifyBottleneck(0.60)).toBe('critical');
  });

  it('returns "critical" for very high percentage', () => {
    expect(classifyBottleneck(0.95)).toBe('critical');
    expect(classifyBottleneck(1.0)).toBe('critical');
  });
});

// ---------- detectBottlenecks ----------

describe('detectBottlenecks', () => {
  function makeStage(name: string, durationMs: number): StageTimingRecord {
    return {
      stageName: name,
      startTime: 0,
      endTime: durationMs,
      durationMs,
      itemsProcessed: 1,
      throughputPerMs: durationMs > 0 ? 1 / durationMs : 0,
    };
  }

  it('reports no bottleneck when all stages are balanced', () => {
    const stages = [
      makeStage('transcription', 100),
      makeStage('analysis', 100),
      makeStage('layout', 100),
    ];
    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.summary).toContain('No bottleneck detected');
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('detects a warning bottleneck when one stage exceeds 40%', () => {
    const stages = [
      makeStage('transcription', 500),  // 50%
      makeStage('analysis', 250),        // 25%
      makeStage('layout', 250),          // 25%
    ];
    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    const worst = requireWorstBottleneck(report);
    expect(worst.stageName).toBe('transcription');
    expect(worst.severity).toBe('warning');
    expect(report.stages).toHaveLength(3);
  });

  it('detects a critical bottleneck when one stage exceeds 60%', () => {
    const stages = [
      makeStage('transcription', 800),  // 80%
      makeStage('analysis', 100),        // 10%
      makeStage('layout', 100),          // 10%
    ];
    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    const worst = requireWorstBottleneck(report);
    expect(worst.severity).toBe('critical');
    expect(worst.percentOfTotal).toBeCloseTo(0.8);
    expect(report.summary).toContain('critical');
  });

  it('selects the worst bottleneck among multiple', () => {
    const stages = [
      makeStage('transcription', 450),  // 45% warning
      makeStage('analysis', 400),        // 40% warning
      makeStage('layout', 150),          // 15%
    ];
    const report = detectBottlenecks(stages);
    const worst = requireWorstBottleneck(report);
    expect(worst.stageName).toBe('transcription');
    expect(worst.percentOfTotal).toBeGreaterThan(
      report.stages[1].percentOfTotal,
    );
  });

  it('handles empty stages array', () => {
    const report = detectBottlenecks([]);
    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.stages).toEqual([]);
  });

  it('handles single stage taking 100%', () => {
    const stages = [makeStage('solo', 1000)];
    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    const worst = requireWorstBottleneck(report);
    expect(worst.severity).toBe('critical');
    expect(worst.percentOfTotal).toBe(1);
  });

  it('generates non-bottleneck message for stages under threshold', () => {
    const stages = [makeStage('fast', 100)];
    // Single stage = 100% which is critical, so test with balanced pair
    const balanced = [makeStage('a', 100), makeStage('b', 100)];
    const report = detectBottlenecks(balanced);
    report.stages.forEach(s => {
      if (s.severity === 'none') {
        expect(s.message).toContain(s.stageName);
        expect(s.message).not.toContain('BOTTLENECK');
      }
    });
  });
});
