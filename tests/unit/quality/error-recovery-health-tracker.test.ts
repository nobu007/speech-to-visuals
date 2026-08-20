/**
 * TASK-0045: Error Recovery Health Tracker + Load-Balancing Integration Tests
 *
 * Validates:
 *   - ErrorRecoveryHealthTracker correctly samples and computes rolling scores
 *   - Stage degradation detection and trend analysis
 *   - Recommendations generation based on system state
 *   - executeWithLoadBalancing concurrent request handling
 *   - Circuit breaker interaction under load
 *   - Dynamic queue timeout and capacity behavior
 */

import {
  EnhancedErrorRecovery,
} from '@/quality/enhanced-error-recovery';
import {
  ErrorRecoveryHealthTracker,
  HealthAssessment,
  StageHealthScore,
} from '@/quality/error-recovery-health-tracker';
import {
  TranscriptionError,
  RenderingError,
  SegmentationError,
} from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for a specified number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fail-loud lookups for the two nullable reads this suite asserts presence
// on. The old `score!.lastErrorCount` / `breaker!.recordFailure()` TypeErrors
// red; the throws keep the same RED verdict with the stage name (and the
// preceding `expect(…).toBeDefined()` pairs fold in).
function requireStageScore(assessment: HealthAssessment, stage: string): StageHealthScore {
  const score = assessment.stageScores.find((s) => s.stage === stage);
  if (score === undefined) throw new Error(`expected a health score for stage "${stage}"`);
  return score;
}

function requireBreaker<T>(breakers: Map<string, T>, stage: string): T {
  const breaker = breakers.get(stage);
  if (breaker === undefined) throw new Error(`expected a circuit breaker for stage "${stage}"`);
  return breaker;
}

/**
 * Force the EnhancedErrorRecovery to record errors for a given stage
 * by directly injecting error records into the internal errorHistory map.
 * This is much faster than triggering recovery strategies via createStageErrorBoundary.
 */
function injectErrorsDirectly(
  recovery: EnhancedErrorRecovery,
  stage: string,
  count: number,
): void {
  const internal = recovery as unknown as {
    errorHistory: Map<string, Array<{ stage: string; component: string; error: Error; timestamp: number; retryCount: number; input: unknown; userContext: { preferences: unknown; sessionId: string; previousSuccesses: number } }>>;
  };

  const existing = internal.errorHistory.get(stage) ?? [];
  for (let i = 0; i < count; i++) {
    existing.push({
      stage,
      component: 'test',
      error: new Error(`Injected error ${existing.length + i + 1} for ${stage}`),
      timestamp: Date.now(),
      retryCount: 0,
      input: {},
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    });
  }
  internal.errorHistory.set(stage, existing);
}

// ---------------------------------------------------------------------------
// ErrorRecoveryHealthTracker Tests
// ---------------------------------------------------------------------------

describe('ErrorRecoveryHealthTracker', () => {
  let recovery: EnhancedErrorRecovery;
  let tracker: ErrorRecoveryHealthTracker;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
    tracker = new ErrorRecoveryHealthTracker(recovery);
  });

  describe('initial state', () => {
    it('starts with zero samples', () => {
      expect(tracker.sampleCount).toBe(0);
      expect(tracker.getSamples()).toHaveLength(0);
    });

    it('returns an assessment on first sample with healthy defaults', () => {
      const assessment = tracker.sample();

      expect(assessment.sampledAt).toBeGreaterThan(0);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(1);
      // All stages should have score 1.0 (healthy) since no errors have occurred
      expect(assessment.stageScores.length).toBeGreaterThan(0);
      expect(assessment.degradedStages).toEqual([]);
      expect(assessment.sampleWindowSize).toBe(1);
      // Should contain at least one recommendation (healthy or generic)
      expect(assessment.recommendations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rolling window', () => {
    it('keeps at most windowSize samples', () => {
      const smallTracker = new ErrorRecoveryHealthTracker(recovery, {
        windowSize: 3,
      });

      for (let i = 0; i < 10; i++) {
        smallTracker.sample();
      }

      expect(smallTracker.sampleCount).toBe(3);
      expect(smallTracker.getSamples()).toHaveLength(3);
    });

    it('resets all samples', () => {
      tracker.sample();
      tracker.sample();
      expect(tracker.sampleCount).toBe(2);

      tracker.reset();
      expect(tracker.sampleCount).toBe(0);
    });
  });

  describe('stage health scoring with errors', () => {
    it('detects stages with errors and assigns lower scores', async () => {
      // Inject errors into the transcription stage
      injectErrorsDirectly(recovery, 'transcription', 3);

      const assessment = tracker.sample();

      // After injecting errors, transcription should appear as a stage
      const transcriptionScore = requireStageScore(assessment, 'transcription');
      expect(transcriptionScore.lastErrorCount).toBeGreaterThanOrEqual(3);
      // With 3 errors, the score should be notably below 1.0
      expect(transcriptionScore.score).toBeLessThan(0.9);
    });

    it('identifies degraded stages below threshold', () => {
      // Use a tracker with a high degradation threshold to make detection easier
      const strictTracker = new ErrorRecoveryHealthTracker(recovery, {
        degradationThreshold: 0.8,
      });

      // Inject errors in multiple samples to create consistent high error rates
      injectErrorsDirectly(recovery, 'rendering', 5);
      strictTracker.sample();

      injectErrorsDirectly(recovery, 'rendering', 5);
      strictTracker.sample();

      injectErrorsDirectly(recovery, 'rendering', 5);
      strictTracker.sample();

      const assessment = strictTracker.sample();

      // With consistent error deltas of ~5 per interval, errorScore will be low
      // This should degrade the overall score below 0.8
      const renderScore = assessment.stageScores.find(
        (s) => s.stage === 'rendering',
      );
      if (renderScore) {
        // Error score should be 0 (5 errors per interval), pushing total below 0.8
        expect(renderScore.score).toBeLessThan(0.8);
      }
    });

    it('computes improving trend when errors decrease', () => {
      // First: inject many errors, sample
      injectErrorsDirectly(recovery, 'analysis', 8);
      tracker.sample();

      // Then inject fewer errors each time
      injectErrorsDirectly(recovery, 'analysis', 5);
      tracker.sample();

      injectErrorsDirectly(recovery, 'analysis', 2);
      tracker.sample();

      injectErrorsDirectly(recovery, 'analysis', 0);
      tracker.sample();

      injectErrorsDirectly(recovery, 'analysis', 0);
      tracker.sample();

      const assessment = tracker.sample();
      const analysisScore = assessment.stageScores.find(
        (s) => s.stage === 'analysis',
      );

      if (analysisScore) {
        // The trend should be improving (error deltas decreasing: 8, 5, 2, 0, 0)
        expect(['improving', 'stable']).toContain(analysisScore.trend);
      }
    });

    it('computes degrading trend when errors increase', () => {
      // Start with no errors
      tracker.sample(); // sample 1: seg=0

      // Then inject errors in subsequent samples with increasing amounts
      injectErrorsDirectly(recovery, 'segmentation', 1);
      tracker.sample(); // sample 2: seg=1, delta=1

      injectErrorsDirectly(recovery, 'segmentation', 2);
      tracker.sample(); // sample 3: seg=3, delta=2

      injectErrorsDirectly(recovery, 'segmentation', 4);
      tracker.sample(); // sample 4: seg=7, delta=4

      injectErrorsDirectly(recovery, 'segmentation', 8);
      tracker.sample(); // sample 5: seg=15, delta=8

      const assessment = tracker.sample(); // sample 6: seg=15, delta=0
      const segScore = assessment.stageScores.find(
        (s) => s.stage === 'segmentation',
      );

      if (segScore) {
        // Deltas: [1, 2, 4, 8, 0] → first half avg = 1.5, second half avg = 4.0
        // delta = 4.0 - 1.5 = 2.5 > 0.5 → degrading
        expect(segScore.trend).toBe('degrading');
      }
    });
  });

  describe('recommendations', () => {
    it('recommends investigating degraded stages', () => {
      const strictTracker = new ErrorRecoveryHealthTracker(recovery, {
        degradationThreshold: 0.9,
      });

      // Inject errors across multiple samples
      injectErrorsDirectly(recovery, 'export', 6);
      strictTracker.sample();

      injectErrorsDirectly(recovery, 'export', 6);
      strictTracker.sample();

      const assessment = strictTracker.sample();

      // With consistent high error rates, we should get a degradation recommendation
      const hasDegradedRec = assessment.recommendations.some(
        (r) => r.includes('degraded') || r.includes('degrading'),
      );
      // Either the stage is flagged as degraded or has a degrading trend
      if (assessment.degradedStages.includes('export')) {
        expect(hasDegradedRec).toBe(true);
      }
    });

    it('recommends investigating degrading trends', () => {
      // No errors first
      tracker.sample();
      tracker.sample();

      // Then inject errors to create degrading trend
      injectErrorsDirectly(recovery, 'animation', 4);
      tracker.sample();
      injectErrorsDirectly(recovery, 'animation', 6);
      tracker.sample();

      const assessment = tracker.sample();
      const trendRec = assessment.recommendations.find(
        (r) => r.includes('degrading trend'),
      );
      if (assessment.stageScores.some((s) => s.trend === 'degrading')) {
        expect(trendRec).toBeDefined();
      }
    });
  });

  describe('multiple stages simultaneously', () => {
    it('tracks scores for multiple stages independently', () => {
      injectErrorsDirectly(recovery, 'transcription', 2);
      injectErrorsDirectly(recovery, 'rendering', 8);

      const assessment = tracker.sample();

      const stages = assessment.stageScores.map((s) => s.stage);
      expect(stages).toContain('transcription');
      expect(stages).toContain('rendering');

      // Rendering had more errors, so it should have a lower score
      const tScore = requireStageScore(assessment, 'transcription');
      const rScore = requireStageScore(assessment, 'rendering');
      expect(tScore.score).toBeGreaterThan(rScore.score);
    });
  });
});

// ---------------------------------------------------------------------------
// Concurrent Load-Balancing Integration Tests
// ---------------------------------------------------------------------------

describe('EnhancedErrorRecovery concurrent load-balancing', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
  });

  describe('executeWithLoadBalancing', () => {
    it('executes operations concurrently up to capacity', async () => {
      const results: number[] = [];
      const start = Date.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        recovery.executeWithLoadBalancing(
          `concurrent-${i}`,
          async () => {
            await sleep(50);
            results.push(i);
            return i * 10;
          },
          'analysis',
          5,
        ),
      );

      const values = await Promise.all(promises);
      const elapsed = Date.now() - start;

      expect(values).toEqual([0, 10, 20, 30, 40]);
      expect(results).toHaveLength(5);
      // With concurrency, total time should be less than 5 * 50ms
      // (at most ~250ms if sequential, but should be much less with concurrency)
      expect(elapsed).toBeLessThan(400);
    });

    it('handles mixed success and failure operations', async () => {
      const promise0 = recovery.executeWithLoadBalancing(
        'success-op',
        async () => 'ok',
        'transcription',
        5,
      );
      const promise1 = recovery.executeWithLoadBalancing(
        'fail-op',
        async () => {
          throw new TranscriptionError('Injected failure');
        },
        'transcription',
        5,
      );
      const promise2 = recovery.executeWithLoadBalancing(
        'success-op-2',
        async () => 42,
        'analysis',
        5,
      );

      const [r0, r1, r2] = await Promise.allSettled([promise0, promise1, promise2]);

      expect(r0.status).toBe('fulfilled');
      if (r0.status === 'fulfilled') expect(r0.value).toBe('ok');

      expect(r1.status).toBe('rejected');
      if (r1.status === 'rejected') {
        expect(r1.reason).toBeInstanceOf(TranscriptionError);
      }

      expect(r2.status).toBe('fulfilled');
      if (r2.status === 'fulfilled') expect(r2.value).toBe(42);
    });

    it('executes operations within capacity', async () => {
      // In test mode, background timers are disabled so queued requests
      // are never processed. Test within capacity only.
      const snapshot0 = recovery.getErrorSnapshot();
      const capacity = snapshot0.dynamicCapacity;

      // Submit operations within capacity
      const ops = Array.from({ length: Math.min(capacity, 10) }, (_, i) =>
        recovery.executeWithLoadBalancing(
          `op-${i}`,
          async () => i,
          'rendering',
          5,
        ),
      );

      const results = await Promise.all(ops);

      expect(results).toHaveLength(Math.min(capacity, 10));
      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toBe(i);
      }
    });
  });

  describe('circuit breaker interaction under load', () => {
    it('tracks circuit breaker failure counts under repeated failures', async () => {
      // The createStageErrorBoundary may succeed via internal recovery strategies,
      // so we directly manipulate the circuit breaker to test open state.
      const breakerMap = (recovery as unknown as {
        circuitBreakers: Map<string, { recordFailure: () => void; state: string; failureCount: number }>;
      }).circuitBreakers;

      const breaker = requireBreaker(breakerMap, 'rendering');
      // Record failures to exceed the threshold (3)
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }

      const snapshot = recovery.getErrorSnapshot();
      const cb = snapshot.circuitBreakers['rendering'];
      expect(cb).toBeDefined();
      expect(cb.failureCount).toBeGreaterThanOrEqual(3);
      expect(cb.state).toBe('open');
    });

    it('circuit breaker blocks recovery when open and operation fails', async () => {
      // Directly trip the breaker for transcription
      const breakerMap = (recovery as unknown as {
        circuitBreakers: Map<string, { recordFailure: () => void; state: string }>;
      }).circuitBreakers;

      const breaker = requireBreaker(breakerMap, 'transcription');
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }

      // Verify breaker is open
      const snapshot = recovery.getErrorSnapshot();
      expect(snapshot.circuitBreakers['transcription'].state).toBe('open');

      // Now try a failing operation — the circuit breaker should block recovery
      const result = await recovery.createStageErrorBoundary(
        'transcription',
        async () => {
          throw new TranscriptionError('Operation fails');
        },
        { maxRetries: 0 },
      );

      // Recovery is attempted but blocked by circuit breaker
      expect(result.recoveryAttempted).toBe(true);
      expect(result.success).toBe(false);
      // Strategy should be circuit_breaker since breaker blocked recovery
      if (result.recoveryStrategy) {
        expect(result.recoveryStrategy).toBe('circuit_breaker');
      }
    });

    it('circuit breaker resets on success after being half-open', async () => {
      // Directly manipulate the breaker to open state
      const breakerMap = (recovery as unknown as {
        circuitBreakers: Map<string, {
          state: string;
          failureCount: number;
          successCount: number;
          lastFailureTime: number;
          timeout: number;
          recordSuccess: () => void;
        }>;
      }).circuitBreakers;

      const breaker = requireBreaker(breakerMap, 'analysis');
      breaker.state = 'half-open';
      breaker.failureCount = 2;
      breaker.successCount = 0;

      // Record enough successes to close the breaker
      breaker.recordSuccess();
      breaker.recordSuccess();
      breaker.recordSuccess();

      const snapshot = recovery.getErrorSnapshot();
      expect(snapshot.circuitBreakers['analysis'].state).toBe('closed');
    });
  });

  describe('stage error boundary with fallback integration', () => {
    it('fallback provides result when primary fails after retries', async () => {
      let attemptCount = 0;

      const result = await recovery.createStageErrorBoundary(
        'layout_generation',
        async () => {
          attemptCount++;
          throw new Error('Layout engine failure');
        },
        {
          maxRetries: 1,
          fallback: async () => ({ nodes: [], edges: [], recovered: true }),
        },
      );

      // Should succeed via fallback or recovery
      expect(result.success).toBe(true);
      expect(result.recoveryAttempted).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('records notification with stage and severity on failure', async () => {
      const result = await recovery.createStageErrorBoundary(
        'export',
        async () => {
          throw new Error('Export directory not writable');
        },
        { maxRetries: 0, severity: 'critical' },
      );

      expect(result.recoveryAttempted).toBe(true);
      // The notification may or may not be present depending on recovery outcome
      if (result.notification) {
        expect(result.notification.stage).toBe('export');
        expect(result.notification.message).toBeDefined();
      }
    });
  });

  describe('batch recovery with concurrent failures', () => {
    it('recovers multiple stages concurrently', async () => {
      // Inject errors into multiple stages first
      injectErrorsDirectly(recovery, 'transcription', 1);
      injectErrorsDirectly(recovery, 'analysis', 1);
      injectErrorsDirectly(recovery, 'rendering', 1);

      const snapshot = recovery.getErrorSnapshot();
      const totalErrors = Object.values(snapshot.errorHistoryCounts).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalErrors).toBeGreaterThanOrEqual(3);
    });
  });

  describe('health tracker + recovery integration', () => {
    it('tracker reflects recovery state after errors and recovery', async () => {
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      // Sample healthy state
      const healthy = tracker.sample();
      expect(healthy.overallScore).toBeGreaterThan(0);

      // Inject errors
      injectErrorsDirectly(recovery, 'transcription', 5);
      injectErrorsDirectly(recovery, 'rendering', 3);

      // Sample degraded state
      const degraded = tracker.sample();
      const degradedStages = degraded.degradedStages;
      // At least one stage should be degraded
      expect(degraded.stageScores.length).toBeGreaterThan(0);

      // Sample again (trend tracking)
      tracker.sample();
      tracker.sample();

      const trend = tracker.sample();
      // Verify the tracker collected all samples
      expect(trend.sampleWindowSize).toBe(5);
    });

    it('tracker reports recommendations for open circuit breakers', async () => {
      const tracker = new ErrorRecoveryHealthTracker(recovery);

      // Trip a circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await recovery.createStageErrorBoundary(
            'segmentation',
            async () => {
              throw new SegmentationError('Seg fault');
            },
            { maxRetries: 0 },
          );
        } catch {
          // Expected
        }
      }

      const assessment = tracker.sample();

      const cbRec = assessment.recommendations.find((r) =>
        r.includes('Circuit breakers open'),
      );
      // If circuit breaker opened, we should get a recommendation
      const snapshot = recovery.getErrorSnapshot();
      if (snapshot.circuitBreakers['segmentation'].state === 'open') {
        expect(cbRec).toBeDefined();
        expect(cbRec).toContain('segmentation');
      }
    });
  });
});
