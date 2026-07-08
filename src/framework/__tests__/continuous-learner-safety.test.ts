/**
 * Tests for ContinuousLearner safety fixes (TASK-0211):
 * 1. destroy() method — comprehensive cleanup beyond stopLearning()
 * 2. pearson() NaN guard — non-finite value filtering in correlation calculations
 */

import { ContinuousLearner } from '../continuous-learner';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('destroy() — comprehensive resource cleanup', () => {
  it('should stop the interval timer so no more iterations run', async () => {
    jest.useFakeTimers();
    try {
      const learner = new ContinuousLearner(true);

      await jest.advanceTimersByTimeAsync(60_000);
      const afterFirstCycle = learner.getLearningStatus().iteration;
      expect(afterFirstCycle).toBeGreaterThan(0);

      learner.destroy();

      await jest.advanceTimersByTimeAsync(120_000);
      const afterDestroy = learner.getLearningStatus().iteration;
      expect(afterDestroy).toBe(afterFirstCycle);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should set isRunning to false', () => {
    const learner = new ContinuousLearner(true);
    expect(learner.getLearningStatus().isRunning).toBe(true);

    learner.destroy();

    expect(learner.getLearningStatus().isRunning).toBe(false);
  });

  it('should clear learning database', async () => {
    const learner = new ContinuousLearner(false);
    for (let i = 0; i < 5; i++) {
      await learner.learnFromProcessingResult(
        'test_comp', {}, {}, 1000, 0.8, true, [], {}
      );
    }
    expect(learner.getLearningReport().totalDataPoints).toBeGreaterThanOrEqual(5);

    learner.destroy();

    expect(learner.getLearningReport().totalDataPoints).toBe(0);
  });

  it('should clear detected patterns', async () => {
    const learner = new ContinuousLearner(false);
    for (let i = 0; i < 10; i++) {
      await learner.learnFromProcessingResult(
        'pattern_comp', {}, {}, 5000, 0.5, false, ['test_error'], {}
      );
    }
    expect(learner.getDetectedPatterns().length).toBeGreaterThanOrEqual(1);

    learner.destroy();

    expect(learner.getDetectedPatterns().length).toBe(0);
  });

  it('should be safe to call destroy() multiple times', () => {
    const learner = new ContinuousLearner(true);
    learner.destroy();
    expect(() => learner.destroy()).not.toThrow();
  });

  it('should be safe to call destroy() without startLearningProcess', () => {
    const learner = new ContinuousLearner(false);
    expect(() => learner.destroy()).not.toThrow();
  });

  it('should clear optimization strategies', async () => {
    const learner = new ContinuousLearner(false);
    for (let i = 0; i < 20; i++) {
      await learner.learnFromProcessingResult(
        'opt_test', {}, {}, 50000, 0.3, false, ['perf_error'], {}
      );
    }
    const reportBefore = learner.getLearningReport();
    expect(reportBefore.totalDataPoints).toBeGreaterThanOrEqual(20);

    learner.destroy();

    const reportAfter = learner.getLearningReport();
    expect(reportAfter.optimizationStrategies).toBe(0);
  });
});

describe('pearson() — NaN propagation prevention', () => {
  it('should not produce NaN correlation patterns with NaN quality scores', async () => {
    jest.useFakeTimers();
    try {
      const learner = new ContinuousLearner(false);

      // Inject data with NaN qualityScore
      for (let i = 0; i < 5; i++) {
        await learner.learnFromProcessingResult(
          'nan_corr', { val: i }, { val: i * 2 },
          1000 + i * 500, NaN, true, [], {}
        );
      }

      // Start the learner to trigger comprehensive analysis
      const learner2 = new ContinuousLearner(true);
      // Add same NaN data to learner2
      for (let i = 0; i < 5; i++) {
        await learner2.learnFromProcessingResult(
          'nan_corr', { val: i }, { val: i * 2 },
          1000 + i * 500, NaN, true, [], {}
        );
      }

      await jest.advanceTimersByTimeAsync(60_000);

      // Check that no patterns have NaN confidence
      const patterns = learner2.getDetectedPatterns();
      for (const p of patterns) {
        expect(Number.isFinite(p.confidence)).toBe(true);
      }

      learner2.destroy();
      learner.destroy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should produce finite confidence values with clean numeric data', async () => {
    jest.useFakeTimers();
    try {
      const learner = new ContinuousLearner(true);

      // Inject data with strong positive correlation
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'good_corr', { val: i }, { val: i * 2 },
          1000 + i * 1000, 0.3 + i * 0.07, true, [], {}
        );
      }

      await jest.advanceTimersByTimeAsync(60_000);

      const patterns = learner.getDetectedPatterns();
      for (const p of patterns) {
        expect(Number.isFinite(p.confidence)).toBe(true);
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }

      learner.destroy();
    } finally {
      jest.useRealTimers();
    }
  });
});
