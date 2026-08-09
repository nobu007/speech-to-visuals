/**
 * Capacity-backstop regression tests for ContinuousLearner.
 *
 * `commitHistory`, `detectedPatterns` and `optimizationStrategies` are the
 * no-cap siblings of the capped `learningDatabase` (maxDataPoints=1000),
 * `reportHistory` (=20) and `systemInsights` (=10). All three are `.push`ed
 * from learnFromProcessingResult on every pipeline run while ContinuousLearner
 * is a process-lifetime singleton (imported by the API server), so without a
 * backstop they grow unbounded. These tests assert each collection honors its
 * cap and evicts the least-valuable (or oldest) entry.
 */

import { jest } from '@jest/globals';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ContinuousLearner } from '../../../src/framework/continuous-learner';

describe('ContinuousLearner capacity backstops', () => {
  let learner: any;

  beforeEach(() => {
    learner = new ContinuousLearner(false);
  });

  afterEach(() => {
    learner.stopLearning();
  });

  it('caps detectedPatterns at MAX_DETECTED_PATTERNS, keeping the most-validated', () => {
    const MAX = (ContinuousLearner as any).MAX_DETECTED_PATTERNS;
    expect(typeof MAX).toBe('number');

    const makePattern = (name: string, validationCount: number, i: number) => ({
      pattern: name,
      confidence: 0.5,
      applicableComponents: ['comp'],
      improvementSuggestion: 'suggestion',
      expectedGain: 0.1,
      validationCount,
      detectedAt: new Date(i),
    });

    // Insert one high-validationCount pattern that must survive eviction...
    learner.addOrUpdatePattern(makePattern('keeper', 999, 0));
    // ...then enough low-validationCount distinct patterns to overflow the cap.
    for (let i = 1; i <= MAX + 20; i++) {
      learner.addOrUpdatePattern(makePattern(`pat_${i}`, 1, i));
    }

    const patterns = learner.getDetectedPatterns() as { pattern: string; validationCount: number }[];
    expect(patterns.length).toBe(MAX);
    // The most-validated pattern survives; low-validationCount ones are evicted.
    expect(patterns.some(p => p.pattern === 'keeper')).toBe(true);
  });

  it('caps optimizationStrategies at MAX_OPTIMIZATION_STRATEGIES, keeping the highest-priority', () => {
    const MAX = (ContinuousLearner as any).MAX_OPTIMIZATION_STRATEGIES;
    expect(typeof MAX).toBe('number');

    const makeStrategy = (name: string, priority: number) => ({
      name,
      description: 'desc',
      targetComponent: 'comp',
      currentPerformance: 0.5,
      expectedImprovement: 0.1,
      implementationComplexity: 'low' as const,
      riskLevel: 'low' as const,
      priority,
    });

    learner.addOrUpdateStrategy(makeStrategy('keeper', 999));
    for (let i = 1; i <= MAX + 20; i++) {
      learner.addOrUpdateStrategy(makeStrategy(`strat_${i}`, 1));
    }

    const report = learner.getLearningReport();
    expect(report.optimizationStrategies).toBe(MAX);
    // The highest-priority strategy survives in the recent-optimizations view.
    expect(report.recentOptimizations).toContain('keeper');
  });

  it('caps commitHistory at MAX_COMMIT_HISTORY via FIFO eviction (oldest dropped)', async () => {
    const MAX = (ContinuousLearner as any).MAX_COMMIT_HISTORY;
    expect(typeof MAX).toBe('number');

    // commitHistory has no dedup — each trigger appends a record.
    for (let i = 0; i < MAX + 20; i++) {
      await learner.triggerCustomInstructionsCommit(`comp_${i}`, 'reason');
    }

    const report = learner.getLearningReport();
    expect(report.commitHistory.length).toBe(MAX);
    // FIFO: the oldest entries are dropped, the most recent survives.
    expect(report.commitHistory.some((c: any) => c.component === 'comp_0')).toBe(false);
    expect(report.commitHistory.some((c: any) => c.component === `comp_${MAX + 19}`)).toBe(true);
  });
});
