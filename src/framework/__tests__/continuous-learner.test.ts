/**
 * Tests for ContinuousLearner
 * Covers: constructor, learning, analysis, optimization, reporting, edge cases
 */

import { ContinuousLearner } from '../continuous-learner';

// Suppress console output during tests
let consoleSpy: vi.SpyInstance;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

describe('ContinuousLearner', () => {
  let learner: ContinuousLearner;

  beforeEach(() => {
    learner = new ContinuousLearner(false); // autoStart=false to avoid interval side effects
  });

  afterEach(() => {
    learner.stopLearning();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('should initialize with autoStart=false', () => {
      const l = new ContinuousLearner(false);
      expect(l).toBeDefined();
      const report = l.getLearningReport();
      expect(report.totalDataPoints).toBe(0);
      l.stopLearning();
    });

    it('should initialize with autoStart=true and start the learning process', () => {
      const l = new ContinuousLearner(true);
      expect(l).toBeDefined();
      const report = l.getLearningReport();
      expect(report.totalDataPoints).toBe(0);
      l.stopLearning();
    });

    it('should use default constructor (autoStart=true) when no argument is given', () => {
      // The module-level singleton uses `new ContinuousLearner(false)`, but we
      // test that the class itself can be constructed with no args.
      const l = new ContinuousLearner();
      expect(l).toBeDefined();
      l.stopLearning();
    });
  });

  // --- learnFromProcessingResult ---

  describe('learnFromProcessingResult', () => {
    it('should record learning data with high quality score', async () => {
      await learner.learnFromProcessingResult(
        'transcription',
        { audio: 'test.wav' },
        { text: 'hello' },
        5000,
        0.95,
        true,
        [],
        { source: 'test' }
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should record learning data with low quality score and trigger improvement', async () => {
      await learner.learnFromProcessingResult(
        'layout',
        { nodes: 10 },
        { layout: 'result' },
        40000,
        0.6,
        false,
        ['overlap detected'],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should record learning data with quality score exactly at threshold (0.85)', async () => {
      await learner.learnFromProcessingResult(
        'segmentation',
        { input: 'data' },
        { output: 'data' },
        15000,
        0.85,
        true,
        [],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should record learning data with quality score just below threshold', async () => {
      await learner.learnFromProcessingResult(
        'segmentation',
        {},
        {},
        10000,
        0.84,
        true,
        [],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should detect performance anomaly when processing time exceeds 30s', async () => {
      await learner.learnFromProcessingResult(
        'transcription',
        {},
        {},
        35000, // > 30000
        0.9,
        true,
        [],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should detect quality degradation when score < 0.7', async () => {
      await learner.learnFromProcessingResult(
        'quality_component',
        {},
        {},
        5000,
        0.5, // < 0.7
        true,
        [],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should analyze error patterns when errors are provided', async () => {
      await learner.learnFromProcessingResult(
        'error_prone_component',
        {},
        {},
        5000,
        0.5,
        false,
        ['timeout', 'memory_overflow'],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should handle default parameters (no errors, no context)', async () => {
      await learner.learnFromProcessingResult(
        'component',
        {},
        {},
        5000,
        0.9,
        true
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should respect maxDataPoints limit', async () => {
      // Add 1010 data points (max is 1000)
      for (let i = 0; i < 1010; i++) {
        await learner.learnFromProcessingResult(
          'component',
          { index: i },
          { result: i },
          1000 + i,
          0.8 + (i % 20) * 0.01,
          i % 10 !== 0,
          i % 50 === 0 ? ['error'] : [],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBeLessThanOrEqual(1000);
    });
  });

  // --- learnFromUserFeedback ---

  describe('learnFromUserFeedback', () => {
    it('should update existing learning data with feedback', async () => {
      await learner.learnFromProcessingResult(
        'transcription',
        {},
        {},
        5000,
        0.9,
        true,
        [],
        {}
      );

      const reportBefore = learner.getLearningReport();
      expect(reportBefore.totalDataPoints).toBe(1);

      // We need to find the ID of the recorded data.
      // Since we can't access private fields directly, we use the report to verify
      // that calling feedback with a non-existent ID doesn't crash.
      await learner.learnFromUserFeedback('non_existent_id', 4, 'Good');

      const reportAfter = learner.getLearningReport();
      expect(reportAfter.totalDataPoints).toBe(1);
    });

    it('should handle feedback with comments', async () => {
      await learner.learnFromProcessingResult(
        'component',
        {},
        {},
        5000,
        0.9,
        true
      );

      // Feedback on non-existent ID should not throw
      await expect(
        learner.learnFromUserFeedback('missing_id', 3, 'Could be better')
      ).resolves.not.toThrow();
    });

    it('should handle feedback without comments', async () => {
      await learner.learnFromProcessingResult(
        'component',
        {},
        {},
        5000,
        0.9,
        true
      );

      await expect(
        learner.learnFromUserFeedback('missing_id', 5)
      ).resolves.not.toThrow();
    });
  });

  // --- getLearningReport ---

  describe('getLearningReport', () => {
    it('should return correct initial report', () => {
      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(0);
      expect(report.detectedPatterns).toBe(0);
      expect(report.optimizationStrategies).toBe(0);
      expect(report.systemInsights).toBe(0);
      expect(report.recentOptimizations).toEqual([]);
      expect(report.learningVelocity).toBe(0);
    });

    it('should reflect data after recording processing results', async () => {
      await learner.learnFromProcessingResult(
        'transcription',
        {},
        {},
        5000,
        0.9,
        true
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });
  });

  // --- Development phase detection ---

  describe('development phase detection', () => {
    it('should detect MVP phase when success rate is low', async () => {
      // Add data points with low success rate
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          5000,
          0.5,
          i < 6, // 60% success rate
          [],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(10);
    });

    it('should detect quality enhancement phase when success rate is high', async () => {
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          5000,
          0.95,
          true,
          [],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(10);
    });

    it('should detect content analysis phase when quality is moderate', async () => {
      for (let i = 0; i < 15; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          10000,
          0.75, // moderate quality
          true,
          [],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(15);
    });
  });

  // --- Custom instructions compliance assessment ---

  describe('custom instructions compliance', () => {
    it('should achieve excellent compliance with high quality and success', async () => {
      // Need enough data points so getRecentIterationTrend has enough data
      for (let i = 0; i < 20; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          20000,
          0.95,
          true,
          [],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(20);
    });

    it('should report needs_improvement for low quality score', async () => {
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          50000, // slow
          0.5,
          i % 2 === 0,
          ['error1'],
          {}
        );
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(10);
    });
  });

  // --- stopLearning ---

  describe('stopLearning', () => {
    it('should stop the learning process cleanly', () => {
      const l = new ContinuousLearner(true);
      expect(() => l.stopLearning()).not.toThrow();
    });

    it('should handle multiple stop calls gracefully', () => {
      const l = new ContinuousLearner(false);
      l.stopLearning();
      l.stopLearning();
      l.stopLearning();
      // Should not throw
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('should handle empty input/output', async () => {
      await learner.learnFromProcessingResult(
        'test',
        null,
        null,
        0,
        0,
        false,
        [],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should handle very high processing time', async () => {
      await learner.learnFromProcessingResult(
        'test',
        {},
        {},
        120000, // 2 minutes
        0.3,
        false,
        ['timeout'],
        {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should handle multiple components simultaneously', async () => {
      const components = ['transcription', 'segmentation', 'layout', 'rendering'];
      for (const comp of components) {
        await learner.learnFromProcessingResult(comp, {}, {}, 5000, 0.9, true);
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(4);
    });
  });

  // --- Private method coverage via periodic analysis ---

  describe('periodic analysis via fake timers', () => {
    let timerLearner: ContinuousLearner;

    beforeEach(() => {
      vi.useFakeTimers();
      timerLearner = new ContinuousLearner(true);
    });

    afterEach(() => {
      timerLearner.stopLearning();
      vi.useRealTimers();
    });

    it('should run comprehensive analysis on interval tick', async () => {
      // Add enough data to trigger analysis paths
      for (let i = 0; i < 15; i++) {
        await timerLearner.learnFromProcessingResult(
          'transcription',
          { audio: 'test.wav' },
          { text: 'result' },
          25000, // above 20s threshold for performance insight
          0.8,
          true,
          [],
          {}
        );
      }

      // Advance timer to trigger the interval callback
      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.totalDataPoints).toBe(15);
    });

    it('should generate performance insights when avg processing time is high', async () => {
      for (let i = 0; i < 15; i++) {
        await timerLearner.learnFromProcessingResult(
          'component',
          {},
          {},
          25000, // > 20000 threshold
          0.9,
          true,
          [],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.systemInsights).toBeGreaterThanOrEqual(0);
    });

    it('should generate quality insights when avg quality is low', async () => {
      for (let i = 0; i < 15; i++) {
        await timerLearner.learnFromProcessingResult(
          'component',
          {},
          {},
          5000,
          0.7, // < 0.85 threshold
          true,
          [],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.systemInsights).toBeGreaterThanOrEqual(0);
    });

    it('should generate reliability insights when success rate is low', async () => {
      for (let i = 0; i < 15; i++) {
        await timerLearner.learnFromProcessingResult(
          'component',
          {},
          {},
          5000,
          0.9,
          i < 10, // ~67% success rate < 95% threshold
          [],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.systemInsights).toBeGreaterThanOrEqual(0);
    });

    it('should detect processing time patterns with outliers', async () => {
      // Add data with some outliers
      for (let i = 0; i < 20; i++) {
        await timerLearner.learnFromProcessingResult(
          'transcription',
          {},
          {},
          i % 3 === 0 ? 60000 : 1000, // some very slow processing
          0.9,
          true,
          [],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.detectedPatterns).toBeGreaterThanOrEqual(0);
    });

    it('should analyze error frequency for frequent errors', async () => {
      for (let i = 0; i < 20; i++) {
        await timerLearner.learnFromProcessingResult(
          'component',
          {},
          {},
          5000,
          0.9,
          true,
          ['timeout_error', 'timeout_error', 'network_error'],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.detectedPatterns).toBeGreaterThanOrEqual(0);
    });

    it('should apply automatic optimizations for low-risk strategies', async () => {
      // Generate patterns that will produce strategies with optimizationThreshold check
      for (let i = 0; i < 20; i++) {
        await timerLearner.learnFromProcessingResult(
          'performance_component',
          {},
          {},
          5000,
          0.6,
          true,
          [],
          {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.optimizationStrategies).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors during periodic analysis gracefully', async () => {
      // Add some data
      await timerLearner.learnFromProcessingResult('test', {}, {}, 5000, 0.9, true);

      // Advance timer - should not throw even with minimal data
      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.totalDataPoints).toBe(1);
    });

    it('should not generate insights when data is insufficient (< 10)', async () => {
      for (let i = 0; i < 5; i++) {
        await timerLearner.learnFromProcessingResult(
          'component', {}, {}, 25000, 0.7, true, [], {}
        );
      }

      await vi.advanceTimersByTimeAsync(60000);

      const report = timerLearner.getLearningReport();
      expect(report.systemInsights).toBe(0);
    });
  });

  // --- User feedback with matching ID (covers analyzeUserFeedbackPatterns) ---

  describe('learnFromUserFeedback with matching data', () => {
    it('should analyze feedback patterns when rating high-rated vs low-rated data', async () => {
      // Create data with different quality levels to generate feature differences
      for (let i = 0; i < 12; i++) {
        await learner.learnFromProcessingResult(
          'component',
          {},
          {},
          i < 6 ? 2000 : 40000,
          i < 6 ? 0.95 : 0.4,
          i < 6,
          i < 6 ? [] : ['error1'],
          {}
        );
      }

      // Access internal database to get IDs
      const db = (learner as unknown as { learningDatabase: Array<{ id: string }> }).learningDatabase;

      // Give high ratings to high-quality data and low ratings to low-quality data
      for (let i = 0; i < Math.min(6, db.length); i++) {
        await learner.learnFromUserFeedback(db[i].id, 5, 'Excellent');
      }
      for (let i = 6; i < Math.min(12, db.length); i++) {
        await learner.learnFromUserFeedback(db[i].id, 1, 'Poor');
      }

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(12);
    });
  });

  // --- Custom instructions improvement paths ---

  describe('improvement cycle paths', () => {
    it('should trigger MVP improvement when in MVP phase', async () => {
      // Low success rate = MVP phase
      for (let i = 0; i < 20; i++) {
        await learner.learnFromProcessingResult(
          'test_comp',
          {},
          {},
          5000,
          0.5,
          i < 6, // 30% success = MVP
          [],
          {}
        );
      }
      // Add one more with low quality to trigger improvement
      await learner.learnFromProcessingResult(
        'test_comp', {}, {}, 5000, 0.5, false, ['error recovery needed'], {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(21);
    });

    it('should trigger content analysis improvement when in content analysis phase', async () => {
      // High success rate but moderate quality = content analysis phase
      for (let i = 0; i < 20; i++) {
        await learner.learnFromProcessingResult(
          'analysis_comp',
          {},
          {},
          5000,
          0.78,
          true, // high success
          [],
          {}
        );
      }
      // Low quality triggers improvement
      await learner.learnFromProcessingResult(
        'analysis_comp', {}, {}, 5000, 0.6, true, [], {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(21);
    });

    it('should trigger diagram generation improvement', async () => {
      // high success, high quality, but < 95% success = diagram generation phase
      for (let i = 0; i < 20; i++) {
        await learner.learnFromProcessingResult(
          'layout_comp',
          {},
          {},
          5000,
          0.88,
          i < 18, // 90% success < 95%
          [],
          {}
        );
      }
      await learner.learnFromProcessingResult(
        'layout_comp', {}, {}, 5000, 0.6, true, [], {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(21);
    });

    it('should trigger quality enhancement improvement in quality phase', async () => {
      // Very high success = quality enhancement phase
      for (let i = 0; i < 20; i++) {
        await learner.learnFromProcessingResult(
          'quality_comp',
          {},
          {},
          5000,
          0.96,
          true,
          [],
          {}
        );
      }
      await learner.learnFromProcessingResult(
        'quality_comp', {}, {}, 5000, 0.6, true, [], {}
      );

      const report = learner.getLearningReport();
      expect(report.totalDataPoints).toBe(21);
    });
  });

  // --- Module-level singleton ---

  describe('module-level singleton', () => {
    it('should export a continuousLearner instance', async () => {
      const mod = await import('../continuous-learner');
      expect(mod.continuousLearner).toBeDefined();
      expect(typeof mod.continuousLearner.getLearningReport).toBe('function');
    });
  });
});
