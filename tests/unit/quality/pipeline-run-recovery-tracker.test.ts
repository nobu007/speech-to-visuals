/**
 * Tests for PipelineRunRecoveryTracker — per-run cross-stage recovery coordinator.
 */

import {
  PipelineRunRecoveryTracker,
  type RecoveryStage,
  type DegradationLevel,
  type RunRecoveryReport,
} from '@/quality/pipeline-run-recovery-tracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} returned undefined`);
  }
  return value;
}

function makeTracker(): PipelineRunRecoveryTracker {
  return new PipelineRunRecoveryTracker();
}

/** Minimal stage outcome for a clean stage (no errors, single attempt). */
function cleanOutcome(overrides?: Partial<{
  attemptCount: number;
  durationMs: number;
}>): {
  attemptCount: number;
  recoveryStrategy?: string;
  fallbackUsed: boolean;
  degraded: boolean;
  durationMs: number;
  error?: Error;
} {
  return {
    attemptCount: overrides?.attemptCount ?? 1,
    fallbackUsed: false,
    degraded: false,
    durationMs: overrides?.durationMs ?? 100,
    ...overrides,
  };
}

/** Stage outcome where recovery was needed but succeeded. */
function recoveredOutcome(strategy = 'intelligent_retry') {
  return {
    attemptCount: 3,
    recoveryStrategy: strategy,
    fallbackUsed: false,
    degraded: false,
    durationMs: 2000,
  };
}

/** Stage outcome where a fallback was used. */
function fallbackOutcome() {
  return {
    attemptCount: 2,
    recoveryStrategy: 'cache_recovery',
    fallbackUsed: true,
    degraded: true,
    durationMs: 1500,
    error: new Error('LLM API error: service unavailable'),
  };
}

/** Stage outcome with a fatal error type. */
function fatalOutcome() {
  return {
    attemptCount: 1,
    fallbackUsed: false,
    degraded: true,
    durationMs: 50,
    error: new Error('file format is unsupported'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineRunRecoveryTracker', () => {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('startRun / finalizeRun lifecycle', () => {
    it('starts a run and reports active state', () => {
      const tracker = makeTracker();
      expect(tracker.isActive).toBe(false);
      expect(tracker.currentRunId).toBeNull();

      tracker.startRun('run-1');
      expect(tracker.isActive).toBe(true);
      expect(tracker.currentRunId).toBe('run-1');
    });

    it('throws if startRun is called while a run is active', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      expect(() => tracker.startRun('run-2')).toThrow('still active');
    });

    it('throws if stage methods are called without starting a run', () => {
      const tracker = makeTracker();
      expect(() => tracker.recordStageOutcome('transcription', cleanOutcome())).toThrow('No active run');
      expect(() => tracker.getDegradationLevel()).toThrow('No active run');
      expect(() => tracker.getRecommendedStrategy('analysis')).toThrow('No active run');
    });

    it('finalizes a clean run and returns a report', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', cleanOutcome());
      tracker.recordStageOutcome('segmentation', cleanOutcome());
      tracker.recordStageOutcome('analysis', cleanOutcome());

      const report = tracker.finalizeRun(true);

      expect(report.runId).toBe('run-1');
      expect(report.success).toBe(true);
      expect(report.stages).toHaveLength(3);
      expect(report.degradationLevel).toBe('nominal');
      expect(report.totalRetries).toBe(0);
      expect(report.totalFallbacks).toBe(0);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.crossStageCorrelations).toHaveLength(0);
    });

    it('resets state after finalization allowing a new run', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', cleanOutcome());
      tracker.finalizeRun(true);

      expect(tracker.isActive).toBe(false);

      tracker.startRun('run-2');
      expect(tracker.currentRunId).toBe('run-2');
      tracker.finalizeRun(false);
    });
  });

  // -----------------------------------------------------------------------
  // Degradation tracking
  // -----------------------------------------------------------------------

  describe('getDegradationLevel', () => {
    it('returns nominal when all stages are clean', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', cleanOutcome());
      tracker.recordStageOutcome('analysis', cleanOutcome());

      expect(tracker.getDegradationLevel()).toBe('nominal');
    });

    it('returns degraded when fallbacks were used', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', cleanOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());

      expect(tracker.getDegradationLevel()).toBe('degraded');
    });

    it('returns degraded when retries depleted budget below 30%', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxTotalRetries: 10 });

      // 8 retries used out of 10 = only 20% budget left (budget = 2 < 3)
      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 6 });
      tracker.recordStageOutcome('analysis', { ...cleanOutcome(), attemptCount: 4 });

      expect(tracker.getDegradationLevel()).toBe('degraded');
    });

    it('returns critical when max degraded stages exceeded', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxDegradedStages: 2 });

      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());
      tracker.recordStageOutcome('layout_generation', fallbackOutcome());

      expect(tracker.getDegradationLevel()).toBe('critical');
    });

    it('returns critical when retry budget is exhausted', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxTotalRetries: 3 });

      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 4 });

      expect(tracker.getDegradationLevel()).toBe('critical');
    });
  });

  // -----------------------------------------------------------------------
  // Abort detection
  // -----------------------------------------------------------------------

  describe('shouldAbort', () => {
    it('returns false for a clean run', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', cleanOutcome());

      expect(tracker.shouldAbort()).toBe(false);
    });

    it('returns true on fatal error types', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', fatalOutcome());

      expect(tracker.shouldAbort()).toBe(true);
    });

    it('returns true when retry budget is exhausted', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxTotalRetries: 2 });

      tracker.recordStageOutcome('transcription', { ...recoveredOutcome(), attemptCount: 3 });

      expect(tracker.shouldAbort()).toBe(true);
    });

    it('returns true when too many stages are degraded', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxDegradedStages: 1 });

      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());

      expect(tracker.shouldAbort()).toBe(true);
    });

    it('returns false when no run is active', () => {
      const tracker = makeTracker();
      expect(tracker.shouldAbort()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Adaptive strategy recommendations
  // -----------------------------------------------------------------------

  describe('getRecommendedStrategy', () => {
    it('recommends standard policy under nominal conditions', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', cleanOutcome());

      const rec = tracker.getRecommendedStrategy('analysis');

      expect(rec.maxRetries).toBe(3);
      expect(rec.preferFallback).toBe(false);
      expect(rec.skipQualityGates).toBe(false);
      expect(rec.reason).toContain('Nominal');
    });

    it('reduces retries under degraded conditions', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', fallbackOutcome());

      const rec = tracker.getRecommendedStrategy('analysis');

      expect(rec.maxRetries).toBeLessThanOrEqual(2);
      expect(rec.reason).toContain('Degraded');
    });

    it('minimizes retries and skips gates under critical conditions', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxDegradedStages: 1 });

      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());

      const rec = tracker.getRecommendedStrategy('layout_generation');

      expect(rec.maxRetries).toBeLessThanOrEqual(1);
      expect(rec.preferFallback).toBe(true);
      expect(rec.skipQualityGates).toBe(true);
    });

    it('caps retries to remaining budget', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxTotalRetries: 5 });

      // Use 4 retries
      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 5 });

      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBeLessThanOrEqual(1);
    });

    it('reduces retries based on upstream degradation', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      // Transcription degraded → analysis and downstream should be conservative
      tracker.recordStageOutcome('transcription', fallbackOutcome());

      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBeLessThanOrEqual(1);
      expect(rec.reason).toContain('transcription');
    });

    it('returns zero retries when budget is exhausted', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { maxTotalRetries: 2 });

      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 3 });

      const rec = tracker.getRecommendedStrategy('analysis');
      expect(rec.maxRetries).toBe(0);
    });

    it('disables adaptive strategies when configured', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1', { enableAdaptiveStrategies: false });

      tracker.recordStageOutcome('transcription', fallbackOutcome());

      const rec = tracker.getRecommendedStrategy('analysis');
      // Should not mention upstream reduction
      expect(rec.reason).not.toContain('upstream');
    });
  });

  // -----------------------------------------------------------------------
  // Cross-stage correlation detection
  // -----------------------------------------------------------------------

  describe('cross-stage correlations in report', () => {
    it('detects upstream-downstream correlations', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());

      const report = tracker.finalizeRun(true);

      expect(report.crossStageCorrelations.length).toBeGreaterThanOrEqual(1);
      expect(report.crossStageCorrelations[0]).toContain('transcription');
      expect(report.crossStageCorrelations[0]).toContain('analysis');
    });

    it('detects recurring error types across stages', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      const llmError1 = new Error('LLM API error: internal server error');
      const llmError2 = new Error('LLM API error: service unavailable');

      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        fallbackUsed: true,
        degraded: true,
        durationMs: 1000,
        error: llmError1,
      });
      tracker.recordStageOutcome('analysis', {
        attemptCount: 3,
        fallbackUsed: true,
        degraded: true,
        durationMs: 2000,
        error: llmError2,
      });

      const report = tracker.finalizeRun(false);

      const typeCorrelation = report.crossStageCorrelations.find(
        (c) => c.includes('recurred'),
      );
      expect(typeCorrelation).toBeDefined();
    });

    it('returns empty correlations for clean runs', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');

      tracker.recordStageOutcome('transcription', cleanOutcome());
      tracker.recordStageOutcome('analysis', cleanOutcome());

      const report = tracker.finalizeRun(true);
      expect(report.crossStageCorrelations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Run state snapshot
  // -----------------------------------------------------------------------

  describe('getCurrentState', () => {
    it('returns correct snapshot during an active run', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      tracker.setActiveStage('transcription');
      tracker.recordStageOutcome('transcription', recoveredOutcome());

      const state = tracker.getCurrentState();

      expect(state.runId).toBe('run-1');
      expect(state.completedStages).toBe(1);
      expect(state.totalRetries).toBe(2); // 3 attempts - 1 = 2 retries
      expect(state.totalFallbacks).toBe(0);
      expect(state.activeStage).toBe('transcription');
      expect(state.shouldAbort).toBe(false);
    });

    it('reflects abort state correctly', () => {
      const tracker = makeTracker();
      tracker.startRun('run-1');
      tracker.recordStageOutcome('transcription', fatalOutcome());

      const state = tracker.getCurrentState();
      expect(state.shouldAbort).toBe(true);
      expect(state.degradationLevel).toBe('critical');
    });

    it('returns empty state when no run is active', () => {
      const tracker = makeTracker();
      const state = tracker.getCurrentState();

      expect(state.runId).toBe('');
      expect(state.completedStages).toBe(0);
      expect(state.degradationLevel).toBe('nominal');
    });
  });

  // -----------------------------------------------------------------------
  // Full pipeline scenario
  // -----------------------------------------------------------------------

  describe('full pipeline scenario', () => {
    it('tracks a complete pipeline run with mixed outcomes', () => {
      const tracker = makeTracker();
      tracker.startRun('run-full', {
        maxTotalRetries: 20,
        maxDegradedStages: 3,
      });

      // Stage 1: Transcription - clean
      tracker.setActiveStage('transcription');
      tracker.recordStageOutcome('transcription', cleanOutcome({ durationMs: 800 }));

      // Stage 2: Segmentation - clean
      tracker.setActiveStage('segmentation');
      tracker.recordStageOutcome('segmentation', cleanOutcome({ durationMs: 200 }));

      // Stage 3: Analysis - needed retry
      tracker.setActiveStage('analysis');
      tracker.recordStageOutcome('analysis', recoveredOutcome());

      // Stage 4: Diagram detection - clean
      tracker.setActiveStage('diagram_detection');
      tracker.recordStageOutcome('diagram_detection', cleanOutcome({ durationMs: 500 }));

      // Stage 5: Layout generation - used fallback
      tracker.setActiveStage('layout_generation');
      tracker.recordStageOutcome('layout_generation', {
        ...fallbackOutcome(),
        durationMs: 3000,
      });

      // Stage 6: Rendering - clean
      tracker.setActiveStage('rendering');
      tracker.recordStageOutcome('rendering', cleanOutcome({ durationMs: 5000 }));

      const report = tracker.finalizeRun(true);

      expect(report.success).toBe(true);
      expect(report.stages).toHaveLength(6);
      expect(report.degradationLevel).toBe('degraded');
      expect(report.totalRetries).toBe(3); // 2 from analysis, 1 from layout fallback
      expect(report.totalFallbacks).toBe(1);
      expect(report.degradedStages).toEqual(['layout_generation']);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles critical abort scenario gracefully', () => {
      const tracker = makeTracker();
      tracker.startRun('run-abort', { maxDegradedStages: 2 });

      tracker.recordStageOutcome('transcription', fallbackOutcome());

      expect(tracker.shouldAbort()).toBe(false);

      tracker.recordStageOutcome('analysis', fallbackOutcome());

      expect(tracker.shouldAbort()).toBe(true);

      // Pipeline would abort here, but we still finalize
      const report = tracker.finalizeRun(false);

      expect(report.success).toBe(false);
      expect(report.degradationLevel).toBe('critical');
      expect(report.recommendation).toContain('critical');
    });
  });

  // -----------------------------------------------------------------------
  // Configuration override
  // -----------------------------------------------------------------------

  describe('configuration', () => {
    it('respects custom maxTotalRetries', () => {
      const tracker = makeTracker();
      tracker.startRun('run-cfg', { maxTotalRetries: 5 });

      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 6 });

      // 5 retries used >= maxTotalRetries of 5
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('respects custom abortOnErrorTypes', () => {
      const tracker = makeTracker();
      tracker.startRun('run-cfg', {
        abortOnErrorTypes: ['RENDERING_OOM'],
      });

      // FILE_FORMAT_INVALID would normally abort, but we overrode it
      tracker.recordStageOutcome('transcription', fatalOutcome());
      expect(tracker.shouldAbort()).toBe(false);

      // RENDERING_OOM should now abort
      tracker.recordStageOutcome('rendering', {
        attemptCount: 1,
        fallbackUsed: false,
        degraded: true,
        durationMs: 100,
        error: new Error('out of memory during frame rendering'),
      });
      expect(tracker.shouldAbort()).toBe(true);
    });

    it('respects custom maxDegradedStages', () => {
      const tracker = makeTracker();
      tracker.startRun('run-cfg', { maxDegradedStages: 5 });

      // Three degraded stages, but threshold is 5
      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());
      tracker.recordStageOutcome('layout_generation', fallbackOutcome());

      expect(tracker.shouldAbort()).toBe(false);
      expect(tracker.getDegradationLevel()).toBe('degraded');
    });

    it('resets config to defaults for each new run', () => {
      const tracker = makeTracker();

      tracker.startRun('run-1', { maxTotalRetries: 1 });
      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 2 });
      tracker.finalizeRun(false);

      // New run should use default config (maxTotalRetries=15)
      tracker.startRun('run-2');
      tracker.recordStageOutcome('transcription', { ...cleanOutcome(), attemptCount: 2 });

      expect(tracker.shouldAbort()).toBe(false);
      tracker.finalizeRun(true);
    });
  });

  // -----------------------------------------------------------------------
  // Report generation
  // -----------------------------------------------------------------------

  describe('report generation', () => {
    it('includes correct stage details in report', () => {
      const tracker = makeTracker();
      tracker.startRun('run-report');

      tracker.recordStageOutcome('transcription', {
        attemptCount: 2,
        recoveryStrategy: 'intelligent_retry',
        fallbackUsed: false,
        degraded: false,
        durationMs: 1500,
      });

      const report = tracker.finalizeRun(true);
      const transcriptionRecord = requireDefined(
        report.stages.find((s) => s.stage === 'transcription'),
        'transcription stage record',
      );
      expect(transcriptionRecord.attemptCount).toBe(2);
      expect(transcriptionRecord.recoveryStrategy).toBe('intelligent_retry');
      expect(transcriptionRecord.fallbackUsed).toBe(false);
    });

    it('generates meaningful recommendation for nominal runs', () => {
      const tracker = makeTracker();
      tracker.startRun('run-report');
      tracker.recordStageOutcome('transcription', cleanOutcome());

      const report = tracker.finalizeRun(true);
      expect(report.recommendation).toContain('nominally');
    });

    it('generates meaningful recommendation for degraded runs', () => {
      const tracker = makeTracker();
      tracker.startRun('run-report');
      tracker.recordStageOutcome('transcription', fallbackOutcome());

      const report = tracker.finalizeRun(true);
      expect(report.recommendation).toContain('Degraded stages');
    });

    it('generates meaningful recommendation for critical runs', () => {
      const tracker = makeTracker();
      tracker.startRun('run-report', { maxDegradedStages: 1 });
      tracker.recordStageOutcome('transcription', fallbackOutcome());
      tracker.recordStageOutcome('analysis', fallbackOutcome());

      const report = tracker.finalizeRun(false);
      expect(report.recommendation).toContain('critical');
    });
  });
});
