/**
 * TASK-0155: Performance Baseline Unit Tests
 *
 * Tests for performance-baseline.ts (REQ-099):
 *   - getBaseline: stage lookup in baseline table
 *   - isWithinBaseline: regression detection against ceilings
 *   - aggregateBenchmark: full benchmark aggregation
 */

import {
  getBaseline,
  isWithinBaseline,
  aggregateBenchmark,
  DEFAULT_BASELINES,
  PerformanceBaseline,
  StageMeasurement,
} from '@/pipeline/performance-baseline';

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} returned undefined`);
  }
  return value;
}

// ---------- getBaseline ----------

describe('getBaseline', () => {
  it('finds a known stage by name', () => {
    const result = requireDefined(getBaseline('transcription'), "getBaseline('transcription')");
    expect(result.stage).toBe('transcription');
    expect(result.maxDurationMs).toBe(8000);
    expect(result.maxMemoryMB).toBe(50);
  });

  it('returns undefined for unknown stage', () => {
    expect(getBaseline('nonexistent')).toBeUndefined();
  });

  it('uses custom baselines when provided', () => {
    const custom: PerformanceBaseline[] = [
      { stage: 'custom', maxDurationMs: 9999, maxMemoryMB: 42, targetDurationMs: 5000 },
    ];
    expect(getBaseline('custom', custom)).toBeDefined();
    expect(requireDefined(getBaseline('custom', custom), "getBaseline('custom', custom)").maxDurationMs).toBe(9999);
    expect(getBaseline('transcription', custom)).toBeUndefined();
  });

  it('all default stages have target <= max', () => {
    DEFAULT_BASELINES.forEach(b => {
      expect(b.targetDurationMs).toBeLessThanOrEqual(b.maxDurationMs);
    });
  });
});

// ---------- isWithinBaseline ----------

describe('isWithinBaseline', () => {
  it('returns true when measurement is within limits', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 5000,
      memoryMB: 30,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });

  it('returns false when duration exceeds baseline', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 9000,
      memoryMB: 30,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(false);
  });

  it('returns false when memory exceeds baseline', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 5000,
      memoryMB: 60,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(false);
  });

  it('returns true for unknown stage (passes by default)', () => {
    const m: StageMeasurement = {
      stage: 'unknown-stage',
      durationMs: 999999,
      memoryMB: 9999,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });

  it('returns true when exactly at the limit', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 8000,
      memoryMB: 50,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });
});

// ---------- aggregateBenchmark ----------

describe('aggregateBenchmark', () => {
  it('returns passed=true when all stages are within limits', () => {
    const stages: StageMeasurement[] = [
      { stage: 'transcription', durationMs: 5000, memoryMB: 30, timestamp: 1 },
      { stage: 'analysis', durationMs: 8000, memoryMB: 60, timestamp: 2 },
    ];
    const result = aggregateBenchmark(stages);
    expect(result.passed).toBe(true);
    expect(result.totalDurationMs).toBe(13000);
    expect(result.totalMemoryMB).toBe(90);
    expect(result.stages).toHaveLength(2);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('returns passed=false when any stage exceeds limits', () => {
    const stages: StageMeasurement[] = [
      { stage: 'transcription', durationMs: 5000, memoryMB: 30, timestamp: 1 },
      { stage: 'analysis', durationMs: 11000, memoryMB: 60, timestamp: 2 }, // exceeds 10000
    ];
    const result = aggregateBenchmark(stages);
    expect(result.passed).toBe(false);
  });

  it('handles empty stages array', () => {
    const result = aggregateBenchmark([]);
    expect(result.passed).toBe(true); // vacuously true
    expect(result.totalDurationMs).toBe(0);
    expect(result.totalMemoryMB).toBe(0);
  });

  it('uses custom baselines when provided', () => {
    const custom: PerformanceBaseline[] = [
      { stage: 'test', maxDurationMs: 100, maxMemoryMB: 10, targetDurationMs: 50 },
    ];
    const stages: StageMeasurement[] = [
      { stage: 'test', durationMs: 200, memoryMB: 5, timestamp: 1 },
    ];
    const result = aggregateBenchmark(stages, custom);
    expect(result.passed).toBe(false);
  });
});
