/**
 * Tests for RecursiveCustomInstructionsFramework
 * Covers: executeDevelopmentCycle, prepareNextIteration (improvement propagation),
 *         recovery strategies, evaluateIteration, state management, progress reporting
 */

import { jest } from '@jest/globals';
import { RecursiveCustomInstructionsFramework } from '../recursive-custom-instructions';
import * as loggerModule from '@stv/core/utils/logger';

// Spy on the actual logger methods so ESM module resolution works correctly
const infoSpy = jest.spyOn(loggerModule.logger, 'info');
const errorSpy = jest.spyOn(loggerModule.logger, 'error');
const warnSpy = jest.spyOn(loggerModule.logger, 'warn');
const debugSpy = jest.spyOn(loggerModule.logger, 'debug');

describe('RecursiveCustomInstructionsFramework', () => {
  let framework: RecursiveCustomInstructionsFramework;

  beforeEach(() => {
    infoSpy.mockClear();
    errorSpy.mockClear();
    warnSpy.mockClear();
    debugSpy.mockClear();
    framework = new RecursiveCustomInstructionsFramework({});
  });

  describe('constructor', () => {
    it('initializes with default development cycles', () => {
      const report = framework.generateProgressReport();
      expect(report.framework).toBe('Recursive Custom Instructions');
      expect(report.status).toBe('implementing');
      expect(report.iteration).toBe(1);
    });

    it('accepts custom config', () => {
      const fw = new RecursiveCustomInstructionsFramework({ customKey: 'val' });
      expect(fw.generateProgressReport()).toBeDefined();
    });
  });

  describe('prepareNextIteration — improvement propagation (BUG FIX)', () => {
    it('moves improvements to nextActions', async () => {
      // Populate improvements via recordStageFailure (directly modifies state)
      await framework.recordStageFailure('transcription', new Error('test'), 1000);
      expect(framework.generateProgressReport().improvements.length).toBeGreaterThan(0);

      await framework.prepareNextIteration('test-phase', 2);
      const report = framework.generateProgressReport();
      expect(report.nextActions.length).toBeGreaterThan(0);
    });

    it('logs when improvements are applied', async () => {
      await framework.recordStageFailure('transcription', new Error('test'), 1000);
      await framework.prepareNextIteration('test-phase', 2);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Applied')
      );
    });

    it('does nothing when no improvements exist', async () => {
      await framework.prepareNextIteration('clean-phase', 1);
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('recovery strategies (BUG FIX: were empty stubs)', () => {
    it('handleIterationFailure triggers recovery logging', async () => {
      const error = new Error('Module not found: missing-dep');
      await framework.handleIterationFailure('test-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements.length).toBeGreaterThan(0);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('API failure sets ANALYSIS_DISABLE_GEMINI flag', async () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '';
      const error = new Error('API rate limit exceeded (429)');
      await framework.handleIterationFailure('api-phase', 1, error);
      expect(process.env.ANALYSIS_DISABLE_GEMINI).toBe('1');
    });

    it('logic error triggers rollback (decrements iteration)', async () => {
      await framework.startCycle('logic-test', 3);
      const error = new Error('TypeError: undefined is not a function');
      await framework.handleIterationFailure('logic-test', 3, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Rollback')
      );
    });

    it('performance error triggers optimization warning', async () => {
      const error = new Error('performance timeout exceeded');
      await framework.handleIterationFailure('perf-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Optimize performance')
      );
    });

    it('unknown error categorized as logic triggers rollback', async () => {
      // Errors not matching any pattern default to 'logic' → rollbackAndRefactor
      const error = new Error('something unexpected happened');
      await framework.handleIterationFailure('unknown-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Rollback')
      );
    });

    it('dependency error adds dependency resolution improvement', async () => {
      const error = new Error('Cannot resolve module');
      await framework.handleIterationFailure('dep-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('dependency')
      );
    });
  });

  describe('executeDevelopmentCycle', () => {
    it('runs implementation callback and returns state', async () => {
      const mockImpl = jest.fn().mockResolvedValue('success');
      const state = await framework.executeDevelopmentCycle('test', mockImpl);
      expect(state).toBeDefined();
      expect(mockImpl).toHaveBeenCalled();
    });

    // REQ-390: a cycle whose implementation recorded NO quality measurements
    // must NOT reach `passed` — the commit trigger. The pre-fix checks returned
    // constant fixtures (accuracy 0.9, confidence 0.85, duration 2.5, ...) so
    // overallScore was the constant ~1.0037 and EVERY cycle "passed" and
    // committed regardless of what implementation() actually did — the
    // fabricated always-pass verdict class (REQ-383 documentation leg /
    // REQ-384 commitPhase). Fail-closed: no evidence → iterate, not commit.
    it('REQ-390: does not complete a cycle with no recorded measurements', async () => {
      const mockImpl = jest.fn().mockResolvedValue('success');
      const state = await framework.executeDevelopmentCycle('test', mockImpl);
      expect(state.status).not.toBe('completed');
      expect(state.iteration).toBe(2); // iterated instead of committing
    });

    // REQ-390 pass path: when the implementation callback records real stage
    // measurements (the recordStageSuccess contract MainPipeline drives), the
    // verdict must follow THOSE numbers — here all four modules pass and the
    // cycle completes. Pins that the pass path survives the de-fabrication.
    it('REQ-390: completes a cycle when recorded measurements pass', async () => {
      const mockImpl = jest.fn(async () => {
        await framework.recordStageSuccess('transcription', { accuracy: 0.9, duration: 5000 });
        await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 3000 });
        await framework.recordStageSuccess('layout', { duration: 2000 });
      });
      const state = await framework.executeDevelopmentCycle('内容分析', mockImpl);
      expect(state.status).toBe('completed');
    });

    it('handles implementation error gracefully', async () => {
      const mockImpl = jest.fn().mockRejectedValue(new Error('test error'));
      const state = await framework.executeDevelopmentCycle('fail-test', mockImpl);
      expect(state).toBeDefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('evaluateIteration', () => {
    it('passes when all thresholds met', async () => {
      const goodMetrics = {
        transcriptionAccuracy: 0.9,
        sceneSegmentationF1: 0.8,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(goodMetrics, {});
      expect(result.passed).toBe(true);
      expect(result.shouldAdvancePhase).toBe(true);
      expect(result.shouldCommit).toBe(true);
    });

    it('fails when transcription accuracy below threshold', async () => {
      const badMetrics = {
        transcriptionAccuracy: 0.5,
        sceneSegmentationF1: 0.9,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(badMetrics, {});
      expect(result.passed).toBe(false);
      expect(result.issues).toContainEqual(
        expect.stringContaining('Transcription')
      );
    });

    it('iterates when criteria not met but iterations remain', async () => {
      // Use a known phase so currentPhaseConfig is found
      await framework.startCycle('MVP構築', 1);

      const badMetrics = {
        transcriptionAccuracy: 0.5,
        sceneSegmentationF1: 0.4,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(badMetrics, {});
      expect(result.shouldIterate).toBe(true);
      expect(result.shouldAdvancePhase).toBe(false);
    });
  });

  describe('recordStageSuccess', () => {
    it('updates metrics for transcription stage', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0.92, duration: 1500 });
      const report = framework.generateProgressReport();
      expect(report.metrics.transcriptionAccuracy).toBe(0.92);
    });

    it('updates metrics for analysis stage', async () => {
      await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 2000 });
      const report = framework.generateProgressReport();
      expect(report.metrics.sceneSegmentationF1).toBe(0.88);
    });

    it('updates metrics for layout stage', async () => {
      await framework.recordStageSuccess('layout', { duration: 5000, memoryUsage: 128 });
      const report = framework.generateProgressReport();
      expect(report.metrics.layoutOverlap).toBe(0);
    });

    // Regression: accuracy 0 (complete transcription/analysis failure) is a
    // legitimate value that must be recorded, not masked to the 0.85/0.75
    // default. Previously `||` rewrote 0 → 0.85, letting a 0%-accuracy run
    // pass the quality threshold. Same class as the buildQualityMetrics fix.
    it('preserves accuracy 0 for transcription (not masked to 0.85)', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0, duration: 1500 });
      const report = framework.generateProgressReport();
      expect(report.metrics.transcriptionAccuracy).toBe(0);
    });

    it('preserves accuracy 0 for analysis (not masked to 0.75)', async () => {
      await framework.recordStageSuccess('analysis', { accuracy: 0, duration: 2000 });
      const report = framework.generateProgressReport();
      expect(report.metrics.sceneSegmentationF1).toBe(0);
    });

    // Regression (defect-9 sibling): an ABSENT accuracy — the caller omits the
    // field entirely — must NOT manufacture the 0.85/0.75 quality-threshold value.
    // The `??` guard above only protects an EXPLICIT 0; `?? 0.85`/`?? 0.75` still
    // fell back to exactly the gate bar for an unmeasured stage, so `>= 0.85`/
    // `>= 0.75` silently passed. `?? 0` (fail-loud, matching buildQualityMetrics'
    // sanitizeFinite(_, 0)) puts absent below every threshold. The live caller
    // (main-pipeline executeStageWithFramework) always supplies accuracy today,
    // so this pins the contract against a future caller that omits it.
    it('does not inflate an ABSENT transcription accuracy to the 0.85 threshold', async () => {
      await framework.recordStageSuccess('transcription', { duration: 1500 });
      const report = framework.generateProgressReport();
      expect(report.metrics.transcriptionAccuracy).toBe(0);
    });

    it('does not inflate an ABSENT analysis accuracy to the 0.75 threshold', async () => {
      await framework.recordStageSuccess('analysis', { duration: 2000 });
      const report = framework.generateProgressReport();
      expect(report.metrics.sceneSegmentationF1).toBe(0);
    });
  });

  describe('recordStageFailure', () => {
    it('records failure metrics and improvement', async () => {
      await framework.recordStageFailure('transcription', new Error('whisper failed'), 3000);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Fix transcription')
      );
    });
  });

  describe('recordQualityIssue', () => {
    it('adds quality issue to improvements', async () => {
      await framework.recordQualityIssue('layout', 'overlap', 'Node overlap at (100,200)');
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('layout')
      );
    });
  });

  describe('advanceToPhase', () => {
    it('resets iteration and clears improvements', async () => {
      await framework.recordQualityIssue('test', 'issue', 'test issue');
      await framework.advanceToPhase('new-phase');
      const report = framework.generateProgressReport();
      expect(report.iteration).toBe(1);
      expect(report.improvements).toEqual([]);
    });
  });

  describe('generateProgressReport', () => {
    it('returns a complete report object', () => {
      const report = framework.generateProgressReport();
      expect(report).toHaveProperty('framework');
      expect(report).toHaveProperty('currentPhase');
      expect(report).toHaveProperty('iteration');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('qualityScore');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('improvements');
      expect(report).toHaveProperty('nextActions');
      expect(report).toHaveProperty('timestamp');
    });
  });

  // REQ-390: the Quality Check System must score the RECORDED measurements
  // (currentState.metrics — what recordStageSuccess/recordStageFailure write,
  // the same source evaluateIteration gates on), never constant fixtures.
  // Before the fix all four checkXxxQuality methods returned hardcoded
  // numbers ("Implement ... validation" stubs), so:
  //   - the verdict was the constant passed=true for EVERY cycle (commit
  //     trigger on fabricated evidence — REQ-383/384 class), and
  //   - the transcription fixture carried `duration: 2.5` (SECONDS) which
  //     calculateModuleScore averaged into the 0-1 module mean, yielding the
  //     module score 1.4167 and overallScore ≈ 1.0037 — a "quality fraction"
  //     permanently above 1.0 (ms/s-style unit pollution of a 0-1 scale).
  describe('REQ-390: quality checks score recorded measurements, not fixtures', () => {
    const internals = () =>
      framework as unknown as {
        runQualityChecks: () => Promise<Record<string, { issues: string[] }>>;
        evaluateResults: (t: Record<string, { issues: string[] }>) => Promise<{
          passed: boolean;
          score: number;
        }>;
      };

    async function evaluateRecordedState(): Promise<{ passed: boolean; score: number }> {
      const testResults = await internals().runQualityChecks();
      return internals().evaluateResults(testResults);
    }

    it('verdict follows recorded accuracy (bad recording does not pass)', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0.5, duration: 5000 });
      await framework.recordStageSuccess('analysis', { accuracy: 0.4, duration: 3000 });
      await framework.recordStageSuccess('layout', { duration: 2000 });
      const evaluation = await evaluateRecordedState();
      expect(evaluation.passed).toBe(false);
      expect(evaluation.score).toBeLessThan(0.8);
    });

    it('scores a passing recording exactly (0.25·0.9 + 0.30·0.88 + 0.25·1 + 0.20·1)', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0.9, duration: 5000 });
      await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 3000 });
      await framework.recordStageSuccess('layout', { duration: 2000 });
      const evaluation = await evaluateRecordedState();
      expect(evaluation.score).toBeCloseTo(0.939, 12);
      expect(evaluation.passed).toBe(true);
    });

    it('overallScore never exceeds 1.0 (no non-0-1 field averaged into the mean)', async () => {
      // Fresh state: the worst case for scale honesty used to be the FIXTURE
      // (duration 2.5 → module 1.4167). A derived score over 0-1 legs is
      // bounded by construction; pin the bound for both states.
      const fresh = await evaluateRecordedState();
      expect(fresh.score).toBeLessThanOrEqual(1);
      expect(fresh.score).toBeGreaterThanOrEqual(0);

      await framework.recordStageSuccess('transcription', { accuracy: 0.9, duration: 5000 });
      await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 3000 });
      await framework.recordStageSuccess('layout', { duration: 2000 });
      const recorded = await evaluateRecordedState();
      expect(recorded.score).toBeLessThanOrEqual(1);
    });

    it('scores an unmeasured (fresh) cycle at exactly the fail-closed 0.45', async () => {
      // All-zero recorded state: accuracy legs 0 (fail-loud initial metrics),
      // layout leg 1 (layoutOverlap count 0 = no overlap), integration legs 1
      // (renderTime 0 / memoryUsage 0 are within budget). 0·0.25 + 0·0.30 +
      // 1·0.25 + 1·0.20 = 0.45 < 0.8 → the aggregate verdict fails closed even
      // though two legs read their initial zeros — pinned exactly so any
      // change to that residual is a visible decision, not a silent drift.
      const evaluation = await evaluateRecordedState();
      expect(evaluation.score).toBeCloseTo(0.45, 12);
      expect(evaluation.passed).toBe(false);
    });

    it('surfaces threshold violations as check issues (no constant empty issues)', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0.5, duration: 5000 });
      const testResults = await internals().runQualityChecks();
      expect(
        testResults.transcription.issues.length +
          testResults.analysis.issues.length +
          testResults.visualization.issues.length +
          testResults.integration.issues.length
      ).toBeGreaterThan(0);
    });

    // REQ-390 budget legs: measured renderTime/memoryUsage over threshold
    // score 0.5 (calculateCurrentQualityScore's binary idiom) — recorded LAST
    // so their values survive the later recordStageSuccess overwrites.
    // 0.25·0.9 + 0.30·0.88 + 0.25·1 + 0.20·((0.5+0.5)/2) = 0.839.
    it('scores over-budget renderTime/memoryUsage legs at 0.5 (exact 0.839)', async () => {
      await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 3000 });
      await framework.recordStageSuccess('layout', { duration: 2000 });
      await framework.recordStageSuccess('transcription', {
        accuracy: 0.9,
        duration: 60000, // > 30000ms threshold → timeBudget 0.5
        memoryUsage: 600 * 1024 * 1024, // > 512MB threshold → memoryBudget 0.5
      });
      const testResults = await internals().runQualityChecks();
      expect(testResults.integration.issues.length).toBe(2);
      const evaluation = await internals().evaluateResults(testResults);
      expect(evaluation.score).toBeCloseTo(0.839, 12);
    });
  });
});
