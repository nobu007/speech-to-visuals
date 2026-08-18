/**
 * Tests for PipelineRunRecoveryTracker — the per-run recovery coordinator.
 *
 * Covers run lifecycle, stage outcome recording, degradation tracking,
 * abort conditions, adaptive strategy recommendations, cross-stage
 * correlation detection, and state snapshot accuracy.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger to suppress console noise
jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the event bus to avoid singleton side-effects between tests
jest.mock('../error-recovery-event-bus', () => ({
  errorRecoveryEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    clear: jest.fn(),
  },
}));

import {
  PipelineRunRecoveryTracker,
  type RunRecoveryReport,
} from '../pipeline-run-recovery-tracker';

describe('PipelineRunRecoveryTracker', () => {
  let tracker: PipelineRunRecoveryTracker;

  beforeEach(() => {
    tracker = new PipelineRunRecoveryTracker();
  });

  // -------------------------------------------------------------------------
  // Run lifecycle
  // -------------------------------------------------------------------------

  describe('startRun', () => {
    it('should activate the tracker with a run ID', () => {
      tracker.startRun('run-001');
      expect(tracker.isActive).toBe(true);
      expect(tracker.currentRunId).toBe('run-001');
    });

    it('should throw if a run is already active', () => {
      tracker.startRun('run-001');
      expect(() => tracker.startRun('run-002')).toThrow(/still active/i);
    });

    it('should accept partial config overrides', () => {
      tracker.startRun('run-001', { maxTotalRetries: 5 });
      // We can observe the effect via shouldAbort threshold
      tracker.recordStageOutcome('transcription', {
        attemptCount: 6, // 5 retries
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.shouldAbort()).toBe(true); // exhausted budget of 5
    });

    it('should reset state from a previous run', () => {
      tracker.startRun('run-001');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: true,
        degraded: true,
        durationMs: 100,
      });
      tracker.finalizeRun(true);

      tracker.startRun('run-002');
      expect(tracker.getCurrentState().totalRetries).toBe(0);
      expect(tracker.getCurrentState().totalFallbacks).toBe(0);
      expect(tracker.getCurrentState().completedStages).toBe(0);
    });
  });

  describe('isActive / currentRunId', () => {
    it('should be inactive before startRun', () => {
      expect(tracker.isActive).toBe(false);
      expect(tracker.currentRunId).toBeNull();
    });

    it('should be active after startRun', () => {
      tracker.startRun('abc');
      expect(tracker.isActive).toBe(true);
      expect(tracker.currentRunId).toBe('abc');
    });

    it('should be inactive after finalizeRun', () => {
      tracker.startRun('abc');
      tracker.finalizeRun(true);
      expect(tracker.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setActiveStage
  // -------------------------------------------------------------------------

  describe('setActiveStage', () => {
    it('should set the active stage', () => {
      tracker.startRun('r1');
      tracker.setActiveStage('analysis');
      expect(tracker.getCurrentState().activeStage).toBe('analysis');
    });

    it('should throw when no run is active', () => {
      expect(() => tracker.setActiveStage('analysis')).toThrow(/No active run/i);
    });
  });

  // -------------------------------------------------------------------------
  // recordStageOutcome
  // -------------------------------------------------------------------------

  describe('recordStageOutcome', () => {
    beforeEach(() => {
      tracker.startRun('r1');
    });

    it('should record stage outcome and increment completed stages', () => {
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 500,
      });
      expect(tracker.getCurrentState().completedStages).toBe(1);
    });

    it('should accumulate total retries (attemptCount - 1)', () => {
      tracker.recordStageOutcome('transcription', {
        attemptCount: 3,
        fallbackUsed: false,
        degraded: false,
        durationMs: 500,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 2,
        fallbackUsed: false,
        degraded: false,
        durationMs: 300,
      });
      expect(tracker.getCurrentState().totalRetries).toBe(3); // (3-1) + (2-1)
    });

    it('should not count negative retries when attemptCount is 0', () => {
      tracker.recordStageOutcome('transcription', {
        attemptCount: 0,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().totalRetries).toBe(0);
    });

    it('should count fallbacks', () => {
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: true,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().totalFallbacks).toBe(1);
    });

    it('should classify errors when provided', () => {
      const err = new Error('Invalid file format');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
        error: err,
      });
      // The classified error should cause the tracker to consider abort
      // because FILE_FORMAT_INVALID is in the default abortOnErrorTypes
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('should throw when no run is active', () => {
      const t = new PipelineRunRecoveryTracker();
      expect(() => t.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      })).toThrow(/No active run/i);
    });
  });

  // -------------------------------------------------------------------------
  // Degradation level
  // -------------------------------------------------------------------------

  describe('getDegradationLevel', () => {
    it('should return nominal when no stages are degraded', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      // Access via getCurrentState since getDegradationLevel is private
      expect(tracker.getCurrentState().degradationLevel).toBe('nominal');
    });

    it('should return degraded when a stage is marked degraded', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('degraded');
    });

    it('should return degraded when fallback is used', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: true,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('degraded');
    });

    it('should return critical when degraded stages >= maxDegradedStages', () => {
      tracker.startRun('r1', { maxDegradedStages: 2 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('critical');
    });

    it('should return critical when retry budget is exhausted', () => {
      tracker.startRun('r1', { maxTotalRetries: 3 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 4, // 3 retries = exhausted
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('critical');
    });

    it('should return critical when abort error type is encountered', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
        error: new Error('unsupported file format'),
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('critical');
    });

    it('should return degraded when retry budget is low (<30% remaining)', () => {
      tracker.startRun('r1', { maxTotalRetries: 10 });
      // Use 8 retries (budget remaining = 2, which is 20% < 30%)
      tracker.recordStageOutcome('transcription', {
        attemptCount: 9, // 8 retries
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.getCurrentState().degradationLevel).toBe('degraded');
    });
  });

  // -------------------------------------------------------------------------
  // shouldAbort
  // -------------------------------------------------------------------------

  describe('shouldAbort', () => {
    it('should return false when inactive', () => {
      expect(tracker.shouldAbort()).toBe(false);
    });

    it('should return false for nominal run', () => {
      tracker.startRun('r1');
      expect(tracker.shouldAbort()).toBe(false);
    });

    it('should return true when retry budget exhausted', () => {
      tracker.startRun('r1', { maxTotalRetries: 2 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 3, // 2 retries = exhausted
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
      });
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('should return true when too many degraded stages', () => {
      tracker.startRun('r1', { maxDegradedStages: 2 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
      });
      tracker.recordStageOutcome('segmentation', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
      });
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('should return true when abort error type is seen', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
        error: new Error('invalid file format'),
      });
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('should NOT abort for non-abort error types', () => {
      tracker.startRun('r1', { abortOnErrorTypes: ['RENDERING_OOM'] });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
        error: new Error('network timeout'),
      });
      expect(tracker.shouldAbort()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getRecommendedStrategy
  // -------------------------------------------------------------------------

  describe('getRecommendedStrategy', () => {
    it('should recommend standard retries for nominal run', () => {
      tracker.startRun('r1');
      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBe(3);
      expect(rec.preferFallback).toBe(false);
      expect(rec.skipQualityGates).toBe(false);
      expect(rec.reason).toMatch(/nominal/i);
    });

    it('should reduce retries under degraded conditions', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: true,
        degraded: true,
        durationMs: 100,
      });
      tracker.recordStageOutcome('segmentation', {
        attemptCount: 1,
        fallbackUsed: true, // second fallback → preferFallback threshold (>1)
        degraded: false,
        durationMs: 100,
      });
      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBeLessThanOrEqual(2);
      expect(rec.preferFallback).toBe(true);
    });

    it('should minimize retries under critical conditions', () => {
      tracker.startRun('r1');
      // Trigger critical by hitting abort error type
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
        error: new Error('unsupported file format'),
      });
      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBeLessThanOrEqual(1);
      expect(rec.preferFallback).toBe(true);
      expect(rec.skipQualityGates).toBe(true);
    });

    it('should reduce retries based on upstream sensitivity', () => {
      tracker.startRun('r1');
      // transcription degraded → downstream stages should get reduced retries
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      // layout_generation is downstream of transcription
      const rec = tracker.getRecommendedStrategy('layout_generation');
      expect(rec.reason).toMatch(/upstream/i);
      // Standard degraded = 2, minus 1 from transcription sensitivity = 1
      expect(rec.maxRetries).toBe(1);
    });

    it('should apply layout_generation upstream with strategyReduction 2', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('layout_generation', {
        attemptCount: 2,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      // animation is downstream of layout_generation with reduction of 2
      const rec = tracker.getRecommendedStrategy('animation');
      expect(rec.maxRetries).toBe(0); // degraded base 2 - reduction 2 = 0
    });

    it('should mention skippable stages under critical', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 100,
        error: new Error('unsupported file format'),
      });
      // export is in default skippableStages
      const rec = tracker.getRecommendedStrategy('export');
      expect(rec.reason).toMatch(/skippable/i);
    });

    it('should not apply adaptive strategies when disabled', () => {
      tracker.startRun('r1', { enableAdaptiveStrategies: false });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      const rec = tracker.getRecommendedStrategy('layout_generation');
      expect(rec.reason).not.toMatch(/upstream/i);
    });

    it('should cap retries at remaining budget', () => {
      tracker.startRun('r1', { maxTotalRetries: 1 });
      // Use the 1 retry
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2, // 1 retry
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBe(0); // budget exhausted
    });

    it('should never return negative maxRetries', () => {
      tracker.startRun('r1');
      // Trigger critical so base is 1, then upstream reduces further
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      tracker.recordStageOutcome('segmentation', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
      });
      // Now critical (3 degraded >= default maxDegradedStages=3)
      const rec = tracker.getRecommendedStrategy('layout_generation');
      expect(rec.maxRetries).toBeGreaterThanOrEqual(0);
    });

    it('should throw when no run is active', () => {
      expect(() => tracker.getRecommendedStrategy('analysis')).toThrow(/No active run/i);
    });
  });

  // -------------------------------------------------------------------------
  // finalizeRun
  // -------------------------------------------------------------------------

  describe('finalizeRun', () => {
    it('should produce a complete report', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: false,
        durationMs: 500,
      });

      const report = tracker.finalizeRun(true);
      expect(report.runId).toBe('r1');
      expect(report.success).toBe(true);
      expect(report.degradationLevel).toBe('nominal');
      expect(report.stages).toHaveLength(1);
      expect(report.stages[0].stage).toBe('transcription');
      expect(report.totalRetries).toBe(0);
      expect(report.totalFallbacks).toBe(0);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.crossStageCorrelations).toEqual([]);
      expect(report.recommendation).toMatch(/nominally/i);
    });

    it('should record degraded stages in report', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2, fallbackUsed: true, degraded: true, durationMs: 100,
      });

      const report = tracker.finalizeRun(false);
      expect(report.degradedStages).toContain('transcription');
      expect(report.totalFallbacks).toBe(1);
      expect(report.degradationLevel).toBe('degraded');
    });

    it('should detect cross-stage correlations', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 2, fallbackUsed: false, degraded: true, durationMs: 100,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 2, fallbackUsed: false, degraded: true, durationMs: 100,
      });

      const report = tracker.finalizeRun(true);
      // transcription → analysis is in UPSTREAM_SENSITIVITY
      expect(report.crossStageCorrelations.length).toBeGreaterThan(0);
      expect(report.crossStageCorrelations[0]).toMatch(/transcription.*analysis|analysis.*transcription/i);
    });

    it('should detect recurring error types across stages', () => {
      tracker.startRun('r1');
      const fmtError = new Error('unsupported file format');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
        error: fmtError,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
        error: new Error('invalid file format'),
      });

      const report = tracker.finalizeRun(true);
      const systemic = report.crossStageCorrelations.find(c => c.includes('recurred'));
      expect(systemic).toBeDefined();
    });

    it('should include fallback warning in recommendation', () => {
      tracker.startRun('r1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: true, degraded: true, durationMs: 100,
      });

      const report = tracker.finalizeRun(true);
      expect(report.recommendation).toMatch(/fallback/i);
    });

    it('should include high retry warning when >70% budget used', () => {
      tracker.startRun('r1', { maxTotalRetries: 10 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 9, // 8 retries = 80% > 70% threshold
        fallbackUsed: false, degraded: true, durationMs: 100,
      });

      const report = tracker.finalizeRun(true);
      expect(report.recommendation).toMatch(/high retry/i);
    });

    it('should include critical warning for critical degradation', () => {
      tracker.startRun('r1', { maxDegradedStages: 1 });
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: false, degraded: true, durationMs: 100,
      });

      const report = tracker.finalizeRun(false);
      expect(report.degradationLevel).toBe('critical');
      expect(report.recommendation).toMatch(/critical/i);
    });

    it('should throw when no run is active', () => {
      expect(() => tracker.finalizeRun(true)).toThrow(/No active run/i);
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentState (snapshot)
  // -------------------------------------------------------------------------

  describe('getCurrentState', () => {
    it('should return default snapshot when inactive', () => {
      const snap = tracker.getCurrentState();
      expect(snap.runId).toBe('');
      expect(snap.degradationLevel).toBe('nominal');
      expect(snap.completedStages).toBe(0);
      expect(snap.totalRetries).toBe(0);
      expect(snap.totalFallbacks).toBe(0);
      expect(snap.shouldAbort).toBe(false);
      expect(snap.activeStage).toBeUndefined();
    });

    it('should reflect current state during active run', () => {
      tracker.startRun('run-active');
      tracker.setActiveStage('analysis');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 3, fallbackUsed: true, degraded: true, durationMs: 200,
      });

      const snap = tracker.getCurrentState();
      expect(snap.runId).toBe('run-active');
      expect(snap.activeStage).toBe('analysis');
      expect(snap.completedStages).toBe(1);
      expect(snap.totalRetries).toBe(2);
      expect(snap.totalFallbacks).toBe(1);
      expect(snap.degradationLevel).toBe('degraded');
    });
  });

  // -------------------------------------------------------------------------
  // State reset after finalizeRun (BUG FIX VERIFICATION)
  // -------------------------------------------------------------------------

  describe('state reset after finalizeRun', () => {
    it('should clear runId after finalizeRun', () => {
      tracker.startRun('run-1');
      tracker.finalizeRun(true);
      // After finalize, getCurrentState should not show stale runId
      const snap = tracker.getCurrentState();
      expect(snap.runId).toBe('');
    });

    it('should clear totalRetries and totalFallbacks after finalizeRun', () => {
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 3, fallbackUsed: true, degraded: true, durationMs: 100,
      });
      tracker.finalizeRun(true);

      const snap = tracker.getCurrentState();
      expect(snap.totalRetries).toBe(0);
      expect(snap.totalFallbacks).toBe(0);
    });

    it('should clear completedStages after finalizeRun', () => {
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 1, fallbackUsed: false, degraded: false, durationMs: 100,
      });
      tracker.finalizeRun(true);

      const snap = tracker.getCurrentState();
      expect(snap.completedStages).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple runs (sequential lifecycle)
  // -------------------------------------------------------------------------

  describe('sequential runs', () => {
    it('should support multiple start→finalize cycles', () => {
      for (let i = 0; i < 3; i++) {
        tracker.startRun(`run-${i}`);
        expect(tracker.isActive).toBe(true);
        tracker.recordStageOutcome('transcription', {
          attemptCount: 1, fallbackUsed: false, degraded: false, durationMs: 100,
        });
        const report = tracker.finalizeRun(true);
        expect(report.runId).toBe(`run-${i}`);
        expect(tracker.isActive).toBe(false);
      }
    });

    it('should not leak state between runs', () => {
      // First run with errors
      tracker.startRun('run-with-issues');
      tracker.recordStageOutcome('transcription', {
        attemptCount: 5, fallbackUsed: true, degraded: true, durationMs: 100,
      });
      tracker.finalizeRun(false);

      // Second run should start clean
      tracker.startRun('clean-run');
      const snap = tracker.getCurrentState();
      expect(snap.totalRetries).toBe(0);
      expect(snap.totalFallbacks).toBe(0);
      expect(snap.completedStages).toBe(0);
      expect(snap.degradationLevel).toBe('nominal');
    });
  });
});
