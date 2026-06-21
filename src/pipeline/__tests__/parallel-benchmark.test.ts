import {
  calculateSpeedup,
  compareExecutionModes,
  generateParallelReport,
  type ExecutionTiming,
} from '../parallel-benchmark';

describe('calculateSpeedup', () => {
  it('calculates speedup ratio', () => {
    expect(calculateSpeedup(10000, 5000)).toBe(2);
  });

  it('returns 1.0 when sequential is 0', () => {
    expect(calculateSpeedup(0, 0)).toBe(1.0);
  });

  it('returns >1 when parallel is faster', () => {
    expect(calculateSpeedup(8000, 4000)).toBe(2);
  });

  it('returns <1 when parallel is slower', () => {
    expect(calculateSpeedup(4000, 8000)).toBe(0.5);
  });

  it('returns 1.0 when both are equal', () => {
    expect(calculateSpeedup(5000, 5000)).toBe(1);
  });
});

describe('compareExecutionModes', () => {
  const sequential: ExecutionTiming[] = [
    { stage: 'transcription', durationMs: 8000 },
    { stage: 'analysis', durationMs: 10000 },
    { stage: 'layout', durationMs: 4000 },
  ];
  const parallel: ExecutionTiming[] = [
    { stage: 'transcription', durationMs: 8000 },
    { stage: 'analysis', durationMs: 5000 },
    { stage: 'layout', durationMs: 2000 },
  ];

  it('produces SpeedupResult for each sequential stage', () => {
    const results = compareExecutionModes(sequential, parallel);
    expect(results).toHaveLength(3);
  });

  it('calculates correct speedupFactor', () => {
    const results = compareExecutionModes(sequential, parallel);
    const analysis = results.find(r => r.stage === 'analysis');
    expect(analysis!.speedupFactor).toBe(2);
    expect(analysis!.improvementPercent).toBe(50);
  });

  it('uses sequential time as fallback for missing parallel data', () => {
    const partialParallel: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
    ];
    const results = compareExecutionModes(sequential, partialParallel);
    const analysis = results.find(r => r.stage === 'analysis');
    expect(analysis!.parallelMs).toBe(10000);
    expect(analysis!.speedupFactor).toBe(1);
    expect(analysis!.improvementPercent).toBe(0);
  });

  it('checks meetsTarget against baseline targets', () => {
    const results = compareExecutionModes(sequential, parallel);
    const analysis = results.find(r => r.stage === 'analysis');
    // analysis targetDurationMs is 7000, parallel is 5000
    expect(analysis!.meetsTarget).toBe(true);

    const transcription = results.find(r => r.stage === 'transcription');
    // transcription targetDurationMs is 8000, parallel is 8000
    expect(transcription!.meetsTarget).toBe(true);
  });

  it('meetsTarget is false when parallel exceeds target', () => {
    const slowParallel: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis', durationMs: 8000 },
      { stage: 'layout', durationMs: 2000 },
    ];
    const results = compareExecutionModes(sequential, slowParallel);
    const analysis = results.find(r => r.stage === 'analysis');
    // targetDurationMs is 7000, parallel is 8000
    expect(analysis!.meetsTarget).toBe(false);
  });
});

describe('generateParallelReport', () => {
  it('aggregates overall timings', () => {
    const sequential: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 8000 },
      { stage: 'analysis', durationMs: 10000 },
    ];
    const parallel: ExecutionTiming[] = [
      { stage: 'transcription', durationMs: 4000 },
      { stage: 'analysis', durationMs: 5000 },
    ];
    const report = generateParallelReport(sequential, parallel);

    expect(report.overallSequentialMs).toBe(18000);
    expect(report.overallParallelMs).toBe(9000);
    expect(report.overallSpeedup).toBe(2);
  });

  it('sets allTargetsMet correctly', () => {
    const sequential: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 10000 },
    ];
    const fastParallel: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 5000 },
    ];
    const report = generateParallelReport(sequential, fastParallel);
    expect(report.allTargetsMet).toBe(true);
  });

  it('sets allTargetsMet to false when target not met', () => {
    const sequential: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 10000 },
    ];
    const slowParallel: ExecutionTiming[] = [
      { stage: 'analysis', durationMs: 8000 },
    ];
    const report = generateParallelReport(sequential, slowParallel);
    expect(report.allTargetsMet).toBe(false);
  });

  it('sets timestamp', () => {
    const report = generateParallelReport([], []);
    expect(report.timestamp).toBeGreaterThan(0);
  });
});
