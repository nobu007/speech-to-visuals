/**
 * Numeric safety tests for ContinuousLearner edge cases.
 *
 * Verifies that statistical helpers do not produce NaN or Infinity
 * when given empty arrays or zero denominators.
 */

import { jest } from '@jest/globals';

// Mock logger to avoid side effects
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ContinuousLearner } from '../../../src/framework/continuous-learner';

describe('ContinuousLearner numeric safety', () => {
  let learner: any;

  beforeEach(() => {
    learner = new ContinuousLearner(false);
  });

  afterEach(() => {
    learner.stopLearning();
  });

  describe('extractFeatures with empty data', () => {
    it('returns zero-valued features instead of NaN for empty input', () => {
      const features = (learner as any).extractFeatures([]);

      expect(features.get('averageQuality')).toBe(0);
      expect(features.get('averageTime')).toBe(0);
      expect(features.get('successRate')).toBe(0);

      // Ensure no NaN or Infinity leaked through
      for (const value of features.values()) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('returns correct values for non-empty input', () => {
      const mockData = [
        { qualityScore: 0.9, processingTime: 1000, success: true },
        { qualityScore: 0.8, processingTime: 2000, success: false },
      ];
      const features = (learner as any).extractFeatures(mockData);

      expect(features.get('averageQuality')).toBeCloseTo(0.85, 10);
      expect(features.get('averageTime')).toBe(1500);
      expect(features.get('successRate')).toBe(0.5);
    });
  });

  describe('createTimeline with empty data', () => {
    it('returns empty array instead of producing NaN', () => {
      const timeline = (learner as any).createTimeline([], 'hourly');

      expect(timeline).toEqual([]);
    });

    it('returns valid timeline for non-empty data', () => {
      const mockData = [
        { timestamp: new Date('2024-01-01T10:00:00Z'), success: true },
        { timestamp: new Date('2024-01-01T14:00:00Z'), success: false },
      ];
      const timeline = (learner as any).createTimeline(mockData, 'daily');

      expect(timeline).toHaveLength(1);
      expect(timeline[0].successRate).toBe(0.5);
      expect(Number.isFinite(timeline[0].successRate)).toBe(true);
    });
  });

  describe('calculateTrend with edge cases', () => {
    it('returns 0 for empty values array', () => {
      const trend = (learner as any).calculateTrend([]);
      expect(trend).toBe(0);
    });

    it('returns 0 for single-element array', () => {
      const trend = (learner as any).calculateTrend([42]);
      expect(trend).toBe(0);
    });

    it('returns finite value for normal array', () => {
      const trend = (learner as any).calculateTrend([1, 2, 3, 4]);
      expect(Number.isFinite(trend)).toBe(true);
      expect(trend).toBe(2); // avg(3,4) - avg(1,2) = 3.5 - 1.5 = 2
    });
  });

  describe('getRecentIterationTrend with insufficient data', () => {
    it('returns improving=false and trend=0 for empty data', () => {
      const result = (learner as any).getRecentIterationTrend('nonexistent');
      expect(result.improving).toBe(false);
      expect(result.trend).toBe(0);
    });
  });

  describe('analyzeErrorFrequency with empty data', () => {
    it('does not throw or produce NaN with empty learning database', async () => {
      // Should complete without error
      await (learner as any).analyzeErrorFrequency();
    });
  });

  describe('analyzeProcessingTimePatterns with empty data', () => {
    it('does not throw with empty learning database', async () => {
      await (learner as any).analyzeProcessingTimePatterns();
    });
  });

  describe('generateSystemInsights with empty data', () => {
    it('does not throw with insufficient data', async () => {
      await (learner as any).generateSystemInsights();
    });
  });
});
