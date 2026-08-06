/**
 * Tests for NaN/Infinity input guards in quality-gate.ts
 * Covers: detectRegression with invalid scores, recordStageMetrics with invalid scores
 */

import { QualityGateEvaluator } from '../quality-gate';

describe('QualityGateEvaluator NaN guards', () => {
  let evaluator: InstanceType<typeof QualityGateEvaluator>;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  // -------------------------------------------------------------------------
  // detectRegression NaN guards
  // -------------------------------------------------------------------------

  describe('detectRegression with NaN currentScore', () => {
    it('should return safe defaults when currentScore is NaN', () => {
      evaluator.setBaselineScore('job1', 0.8);
      const result = evaluator.detectRegression('job1', NaN);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.degradationPercent).toBe(0);
      expect(result.currentScore).toBe(0);
    });

    it('should return safe defaults when currentScore is Infinity', () => {
      evaluator.setBaselineScore('job1', 0.8);
      const result = evaluator.detectRegression('job1', Infinity);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.degradationPercent).toBe(0);
      expect(result.currentScore).toBe(0);
    });

    it('should return safe defaults when currentScore is -Infinity', () => {
      evaluator.setBaselineScore('job1', 0.8);
      const result = evaluator.detectRegression('job1', -Infinity);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.degradationPercent).toBe(0);
      expect(result.currentScore).toBe(0);
    });

    it('should preserve previousScore in result when currentScore is NaN', () => {
      evaluator.setBaselineScore('job1', 0.85);
      const result = evaluator.detectRegression('job1', NaN);
      expect(result.previousScore).toBe(0.85);
    });

    it('should still work normally with valid currentScore after NaN call', () => {
      evaluator.setBaselineScore('job1', 100);
      const nanResult = evaluator.detectRegression('job1', NaN);
      expect(nanResult.isRegression).toBe(false);

      const validResult = evaluator.detectRegression('job1', 90);
      expect(validResult.isRegression).toBe(true);
      expect(validResult.degradationPercent).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // recordStageMetrics NaN guards
  // -------------------------------------------------------------------------

  describe('recordStageMetrics with NaN score', () => {
    it('should store 0 when score is NaN', () => {
      evaluator.recordStageMetrics('job1', 1, { score: NaN, passed: true });
      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics[0].score).toBe(0);
    });

    it('should store 0 when score is Infinity', () => {
      evaluator.recordStageMetrics('job1', 1, { score: Infinity, passed: true });
      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics[0].score).toBe(0);
    });

    it('should store 0 when score is -Infinity', () => {
      evaluator.recordStageMetrics('job1', 1, { score: -Infinity, passed: false });
      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics[0].score).toBe(0);
    });

    it('should preserve passed flag even with NaN score', () => {
      evaluator.recordStageMetrics('job1', 1, { score: NaN, passed: false });
      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics[0].passed).toBe(false);
    });

    it('should not corrupt subsequent valid metrics after NaN score', () => {
      evaluator.recordStageMetrics('job1', 1, { score: NaN, passed: true });
      evaluator.recordStageMetrics('job1', 2, { score: 0.9, passed: true });
      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics).toHaveLength(2);
      expect(report.stageMetrics[0].score).toBe(0);
      expect(report.stageMetrics[1].score).toBe(0.9);
    });
  });
});
