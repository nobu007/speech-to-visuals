import {
  DEFAULT_BASELINES,
  getBaseline,
  isWithinBaseline,
  aggregateBenchmark,
  type StageMeasurement,
} from '../performance-baseline';

describe('DEFAULT_BASELINES', () => {
  it('includes all expected stages', () => {
    const stages = DEFAULT_BASELINES.map(b => b.stage);
    expect(stages).toEqual(
      expect.arrayContaining(['transcription', 'analysis', 'layout', 'preparation', 'rendering']),
    );
  });

  it('has positive maxDurationMs for each stage', () => {
    for (const b of DEFAULT_BASELINES) {
      expect(b.maxDurationMs).toBeGreaterThan(0);
    }
  });

  it('has positive maxMemoryMB for each stage', () => {
    for (const b of DEFAULT_BASELINES) {
      expect(b.maxMemoryMB).toBeGreaterThan(0);
    }
  });

  it('has targetDurationMs <= maxDurationMs for each stage', () => {
    for (const b of DEFAULT_BASELINES) {
      expect(b.targetDurationMs).toBeLessThanOrEqual(b.maxDurationMs);
    }
  });
});

describe('getBaseline', () => {
  it('returns baseline for known stage', () => {
    const result = getBaseline('transcription');
    expect(result).toBeDefined();
    expect(result!.stage).toBe('transcription');
    expect(result!.maxDurationMs).toBe(8000);
  });

  it('returns undefined for unknown stage', () => {
    expect(getBaseline('unknown-stage')).toBeUndefined();
  });

  it('uses custom baselines when provided', () => {
    const custom = [
      { stage: 'custom', maxDurationMs: 5000, maxMemoryMB: 50, targetDurationMs: 3000 },
    ];
    expect(getBaseline('custom', custom)).toBeDefined();
    expect(getBaseline('transcription', custom)).toBeUndefined();
  });
});

describe('isWithinBaseline', () => {
  it('passes when duration and memory are under limits', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 5000,
      memoryMB: 30,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });

  it('fails when duration exceeds limit', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 10000,
      memoryMB: 30,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(false);
  });

  it('fails when memory exceeds limit', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 5000,
      memoryMB: 100,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(false);
  });

  it('passes at exact boundary', () => {
    const m: StageMeasurement = {
      stage: 'transcription',
      durationMs: 8000,
      memoryMB: 50,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });

  it('passes for unknown stages by default', () => {
    const m: StageMeasurement = {
      stage: 'unknown',
      durationMs: 999999,
      memoryMB: 999999,
      timestamp: Date.now(),
    };
    expect(isWithinBaseline(m)).toBe(true);
  });
});

describe('aggregateBenchmark', () => {
  it('sums total duration and memory', () => {
    const stages: StageMeasurement[] = [
      { stage: 'transcription', durationMs: 5000, memoryMB: 30, timestamp: 0 },
      { stage: 'analysis', durationMs: 8000, memoryMB: 60, timestamp: 0 },
    ];
    const result = aggregateBenchmark(stages);
    expect(result.totalDurationMs).toBe(13000);
    expect(result.totalMemoryMB).toBe(90);
  });

  it('passes when all stages within baseline', () => {
    const stages: StageMeasurement[] = [
      { stage: 'transcription', durationMs: 5000, memoryMB: 30, timestamp: 0 },
      { stage: 'analysis', durationMs: 8000, memoryMB: 60, timestamp: 0 },
    ];
    expect(aggregateBenchmark(stages).passed).toBe(true);
  });

  it('fails when any stage exceeds baseline', () => {
    const stages: StageMeasurement[] = [
      { stage: 'transcription', durationMs: 5000, memoryMB: 30, timestamp: 0 },
      { stage: 'analysis', durationMs: 20000, memoryMB: 60, timestamp: 0 },
    ];
    expect(aggregateBenchmark(stages).passed).toBe(false);
  });

  it('handles empty stages array', () => {
    const result = aggregateBenchmark([]);
    expect(result.totalDurationMs).toBe(0);
    expect(result.totalMemoryMB).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('sets timestamp', () => {
    const result = aggregateBenchmark([]);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});
