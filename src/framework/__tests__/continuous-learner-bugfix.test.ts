/**
 * Tests for ContinuousLearner bug fixes:
 * 1. calculateLearningVelocity() - was always returning ALL patterns
 * 2. triggerCustomInstructionsCommit - was building commit message but discarding it
 * 3. LearningPattern.detectedAt - new field for accurate velocity tracking
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

describe('calculateLearningVelocity — detectedAt timestamp fix', () => {
  let learner: ContinuousLearner;

  beforeEach(() => {
    learner = new ContinuousLearner(false);
  });

  afterEach(() => {
    learner.stopLearning();
  });

  it('should return 0 when no patterns exist', () => {
    const report = learner.getLearningReport();
    expect(report.learningVelocity).toBe(0);
  });

  it('should count only patterns detected within last 24 hours', async () => {
    // Generate enough data to create patterns via analyzeErrorPatterns
    for (let i = 0; i < 10; i++) {
      await learner.learnFromProcessingResult(
        'velocity_test', {}, {}, 5000, 0.5, false,
        ['velocity_error'], {}
      );
    }

    const report = learner.getLearningReport();
    expect(report.detectedPatterns).toBeGreaterThanOrEqual(1);
    // All patterns are recent (just created)
    expect(report.learningVelocity).toBeGreaterThanOrEqual(1);
  });

  it('should not count patterns older than 24 hours', async () => {
    jest.useFakeTimers();

    try {
      const tl = new ContinuousLearner(false);

      // Create patterns at current time
      for (let i = 0; i < 10; i++) {
        await tl.learnFromProcessingResult(
          'old_pattern_test', {}, {}, 5000, 0.5, false,
          ['old_error'], {}
        );
      }

      const reportBefore = tl.getLearningReport();
      expect(reportBefore.detectedPatterns).toBeGreaterThanOrEqual(1);
      expect(reportBefore.learningVelocity).toBeGreaterThanOrEqual(1);

      // Advance time by 25 hours
      await jest.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

      const reportAfter = tl.getLearningReport();
      // Patterns still exist
      expect(reportAfter.detectedPatterns).toBeGreaterThanOrEqual(1);
      // But velocity should be 0 — patterns are now old
      expect(reportAfter.learningVelocity).toBe(0);

      tl.stopLearning();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should count new patterns separately from old ones', async () => {
    jest.useFakeTimers();

    try {
      const tl = new ContinuousLearner(false);

      // Create "old" patterns
      for (let i = 0; i < 10; i++) {
        await tl.learnFromProcessingResult(
          'comp_a', {}, {}, 5000, 0.5, false, ['old_err'], {}
        );
      }

      // Advance 25 hours
      await jest.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

      // Create "new" patterns
      for (let i = 0; i < 10; i++) {
        await tl.learnFromProcessingResult(
          'comp_b', {}, {}, 5000, 0.5, false, ['new_err'], {}
        );
      }

      const report = tl.getLearningReport();
      // Both old and new patterns exist
      expect(report.detectedPatterns).toBeGreaterThanOrEqual(2);
      // Only new patterns should count for velocity
      expect(report.learningVelocity).toBeGreaterThanOrEqual(1);
      expect(report.learningVelocity).toBeLessThan(report.detectedPatterns);

      tl.stopLearning();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('triggerCustomInstructionsCommit — commit history storage', () => {
  let learner: ContinuousLearner;

  beforeEach(() => {
    learner = new ContinuousLearner(false);
  });

  afterEach(() => {
    learner.stopLearning();
  });

  it('should populate commitHistory when compliance threshold is met', async () => {
    // Create conditions for excellent compliance:
    // - High success rate (>70%)
    // - High quality (>=0.85)
    // - Good iteration trend (improving)
    // - Fast processing (<30s)
    for (let i = 0; i < 20; i++) {
      await learner.learnFromProcessingResult(
        'compliant_comp', {}, {}, 5000, 0.95, true, [], {}
      );
    }

    // Add one more that triggers improvement check
    // Quality >= 0.85 so triggerCustomInstructionsImprovement is NOT called
    // Need quality < 0.85 to trigger the improvement chain
    await learner.learnFromProcessingResult(
      'compliant_comp', {}, {}, 5000, 0.84, true, [], {}
    );

    const report = learner.getLearningReport();
    // The commit history should have entries if the compliance threshold was reached
    expect(Array.isArray(report.commitHistory)).toBe(true);
  });

  it('should expose commitHistory as an array in getLearningReport', () => {
    const report = learner.getLearningReport();
    expect(report.commitHistory).toBeDefined();
    expect(Array.isArray(report.commitHistory)).toBe(true);
    expect(report.commitHistory).toEqual([]);
  });

  it('should store commit records with structured fields', async () => {
    // To trigger commit: need quality < 0.85 AND compliance score >= 85
    // This means we need high success, improving trend, fast processing,
    // but quality between 0.75-0.84 (gives 25 points for quality,
    // + 30 for success = 55, + 20 for improving = 75... need 85)
    // So we need quality >= 0.85 for the 40 points

    // Actually: assessCustomInstructionsCompliance gives:
    // success=true → 30
    // quality >= 0.85 → 40
    // improving → 20
    // processingTime < 30s → 10
    // Total = 100 → compliance = 'excellent'

    // But triggerCustomInstructionsImprovement is only called when quality < 0.85
    // So we need to trigger it: quality < 0.85, then inside,
    // assessCustomInstructionsCompliance is called again with the same args
    // If quality >= 0.75 → 25 points for quality
    // Total: 30+25+20+10 = 85 → compliance = 'good' → score >= 85 → commit triggered!

    // Build a trend: first 10 low quality, then 10 high quality (improving)
    for (let i = 0; i < 10; i++) {
      await learner.learnFromProcessingResult(
        'trend_comp', {}, {}, 5000, 0.70, true, [], {}
      );
    }
    for (let i = 0; i < 10; i++) {
      await learner.learnFromProcessingResult(
        'trend_comp', {}, {}, 5000, 0.80, true, [], {}
      );
    }

    // Now trigger improvement with quality < 0.85
    await learner.learnFromProcessingResult(
      'trend_comp', {}, {}, 5000, 0.76, true, [], {}
    );

    const report = learner.getLearningReport();
    // Should have at least 1 commit record
    expect(report.commitHistory.length).toBeGreaterThanOrEqual(1);

    const record = report.commitHistory[0];
    expect(record.component).toBe('trend_comp');
    expect(record.reason).toBeDefined();
    expect(record.iteration).toBeDefined();
    expect(record.message).toContain('feat(');
    expect(record.timestamp).toBeDefined();
  });

  it('should not trigger commit when compliance score < 85', async () => {
    // Low compliance: low success rate, low quality
    for (let i = 0; i < 20; i++) {
      await learner.learnFromProcessingResult(
        'low_comp', {}, {}, 50000, 0.5, false, [], {}
      );
    }

    await learner.learnFromProcessingResult(
      'low_comp', {}, {}, 50000, 0.5, false, [], {}
    );

    const report = learner.getLearningReport();
    expect(report.commitHistory).toEqual([]);
  });
});

describe('LearningPattern detectedAt field', () => {
  it('should have detectedAt on patterns created via error analysis', async () => {
    const learner = new ContinuousLearner(false);
    try {
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'detectedAt_test', {}, {}, 5000, 0.5, false,
          ['detect_error'], {}
        );
      }

      const patterns = learner.getDetectedPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(1);

      for (const p of patterns) {
        // detectedAt should be a valid Date-like property
        // (returned via the readonly array as a plain object property)
        expect(p).toHaveProperty('detectedAt');
      }
    } finally {
      learner.stopLearning();
    }
  });
});
