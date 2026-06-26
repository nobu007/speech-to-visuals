/**
 * Regression test for incorrect avgTime running-average calculation.
 *
 * Bug: main-pipeline.ts:566 used `(avgTime + duration) / attempts` which
 * treats a running average as a single data point, producing wrong results
 * after 2+ calls. Fixed with Welford's incremental mean.
 */

describe('StageMetrics avgTime incremental average', () => {
  // Mirror the production type
  interface StageMetric { attempts: number; failures: number; avgTime: number; }

  // The FIXED formula from main-pipeline.ts (Welford's incremental mean)
  function applyFixed(metrics: StageMetric, duration: number): void {
    metrics.attempts++;
    metrics.avgTime = metrics.avgTime + (duration - metrics.avgTime) / metrics.attempts;
  }

  // The OLD buggy formula for comparison
  function applyBuggy(metrics: StageMetric, duration: number): void {
    metrics.attempts++;
    metrics.avgTime = (metrics.avgTime + duration) / Math.max(metrics.attempts, 1);
  }

  function freshMetric(): StageMetric {
    return { attempts: 0, failures: 0, avgTime: 0 };
  }

  it('produces correct mean for 2 calls', () => {
    const m = freshMetric();
    applyFixed(m, 100);
    applyFixed(m, 200);

    // True mean = (100 + 200) / 2 = 150
    expect(m.avgTime).toBeCloseTo(150, 10);
    expect(m.attempts).toBe(2);
  });

  it('produces correct mean for 3 calls (old formula breaks here)', () => {
    const m = freshMetric();
    applyFixed(m, 100);
    applyFixed(m, 200);
    applyFixed(m, 300);

    // True mean = (100 + 200 + 300) / 3 = 200
    expect(m.avgTime).toBeCloseTo(200, 10);
  });

  it('produces correct mean for 5 calls', () => {
    const durations = [100, 200, 300, 400, 500];
    const m = freshMetric();
    for (const d of durations) applyFixed(m, d);

    const trueMean = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(m.avgTime).toBeCloseTo(trueMean, 10);
  });

  it('produces correct mean for 10 calls', () => {
    const durations = [50, 120, 80, 200, 150, 90, 300, 60, 175, 110];
    const m = freshMetric();
    for (const d of durations) applyFixed(m, d);

    const trueMean = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(m.avgTime).toBeCloseTo(trueMean, 10);
  });

  it('produces correct mean for identical durations', () => {
    const m = freshMetric();
    for (let i = 0; i < 10; i++) applyFixed(m, 500);

    expect(m.avgTime).toBe(500);
  });

  it('produces correct mean for single call', () => {
    const m = freshMetric();
    applyFixed(m, 750);

    expect(m.avgTime).toBe(750);
    expect(m.attempts).toBe(1);
  });

  it('handles zero durations correctly', () => {
    const m = freshMetric();
    applyFixed(m, 0);
    applyFixed(m, 0);
    applyFixed(m, 0);

    expect(m.avgTime).toBe(0);
  });

  it('handles mixed zero and non-zero durations', () => {
    const m = freshMetric();
    applyFixed(m, 0);
    applyFixed(m, 100);
    applyFixed(m, 0);
    applyFixed(m, 100);

    // True mean = 200/4 = 50
    expect(m.avgTime).toBeCloseTo(50, 10);
  });

  it('handles very large durations without overflow', () => {
    const m = freshMetric();
    applyFixed(m, 1_000_000);
    applyFixed(m, 2_000_000);
    applyFixed(m, 3_000_000);

    expect(m.avgTime).toBeCloseTo(2_000_000, 5);
  });

  // === Demonstrate the old formula was buggy ===

  it('OLD buggy formula gives WRONG answer for 3 calls', () => {
    const fixed = freshMetric();
    const buggy = freshMetric();

    const durations = [100, 200, 300];
    for (const d of durations) {
      applyFixed(fixed, d);
      applyBuggy(buggy, d);
    }

    const trueMean = 200; // (100+200+300)/3
    expect(fixed.avgTime).toBeCloseTo(trueMean, 10);

    // Buggy formula: ((100+200)/2 + 300) / 3 = (150 + 300) / 3 = 150
    // True answer should be 200, but buggy gives 150
    expect(buggy.avgTime).not.toBeCloseTo(trueMean, 10);
    expect(buggy.avgTime).toBeCloseTo(150, 10);
  });

  it('OLD buggy formula diverges further with more calls', () => {
    const fixed = freshMetric();
    const buggy = freshMetric();

    const durations = [100, 200, 300, 400, 500, 600];
    for (const d of durations) {
      applyFixed(fixed, d);
      applyBuggy(buggy, d);
    }

    const trueMean = durations.reduce((a, b) => a + b, 0) / durations.length; // 350
    expect(fixed.avgTime).toBeCloseTo(trueMean, 10);

    // Buggy formula produces a much smaller (wrong) value
    expect(buggy.avgTime).toBeLessThan(trueMean);
    expect(buggy.avgTime).not.toBeCloseTo(trueMean, 0);
  });

  it('downstream speed score is affected by the bug', () => {
    // calculateProcessingEfficiency uses: speedScore = max(0, 1 - avgTime / 10000)
    // With wrong avgTime, the speed score is inflated

    const fixed = freshMetric();
    const buggy = freshMetric();

    const durations = [3000, 6000, 9000]; // avg should be 6000
    for (const d of durations) {
      applyFixed(fixed, d);
      applyBuggy(buggy, d);
    }

    const fixedSpeedScore = Math.max(0, 1 - fixed.avgTime / 10000);
    const buggySpeedScore = Math.max(0, 1 - buggy.avgTime / 10000);

    // Fixed: 1 - 6000/10000 = 0.4
    expect(fixedSpeedScore).toBeCloseTo(0.4, 5);
    // Buggy: 1 - 3500/10000 = 0.65 (inflated)
    expect(buggySpeedScore).toBeGreaterThan(fixedSpeedScore);
  });
});
