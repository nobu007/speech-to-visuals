/**
 * Tests for quality-gate.ts
 * Covers: StageQualityGate, QualityGateEvaluator, default gate criteria
 * for all 5 pipeline stages, regression detection, and metrics recording.
 */

import { jest } from '@jest/globals';

const { StageQualityGate, QualityGateEvaluator, createDefaultQualityGates } =
  await import('../quality-gate');
import type {
  QualityGateConfig,
  QualityResult,
  StageEvaluationResult,
} from '../quality-gate';

// ---------------------------------------------------------------------------
// Helper: create a simple pass/fail criterion
// ---------------------------------------------------------------------------
function makeCriterion(name: string, pass: boolean, score = 0.5): QualityGateConfig['criteria'][0] {
  return {
    name,
    threshold: 0.5,
    evaluate: (): QualityResult => ({
      passed: pass,
      score,
      threshold: 0.5,
      details: `${name}: ${pass ? 'passed' : 'failed'}`,
    }),
  };
}

// ===========================================================================
// StageQualityGate
// ===========================================================================

describe('StageQualityGate', () => {
  describe('properties', () => {
    it('should expose stage number', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test Gate',
        criteria: [],
        blockingOnFailure: true,
      });
      expect(gate.stage).toBe(1);
    });

    it('should expose name', () => {
      const gate = new StageQualityGate({
        stage: 2,
        name: 'My Gate',
        criteria: [],
        blockingOnFailure: false,
      });
      expect(gate.name).toBe('My Gate');
    });

    it('should expose blocking flag', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [],
        blockingOnFailure: true,
      });
      expect(gate.blocking).toBe(true);
    });

    it('should expose fallbackAction', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [],
        blockingOnFailure: true,
        fallbackAction: 'retry',
      });
      expect(gate.fallbackAction).toBe('retry');
    });
  });

  describe('evaluate', () => {
    it('should pass when all criteria pass', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [makeCriterion('a', true), makeCriterion('b', true)],
        blockingOnFailure: true,
      });
      const result = gate.evaluate({});
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(true);
    });

    it('should fail when any criterion fails', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [makeCriterion('a', true), makeCriterion('b', false)],
        blockingOnFailure: true,
      });
      const result = gate.evaluate({});
      expect(result.passed).toBe(false);
    });

    it('should include stage number in result', () => {
      const gate = new StageQualityGate({
        stage: 3,
        name: 'Test',
        criteria: [],
        blockingOnFailure: false,
      });
      const result = gate.evaluate({});
      expect(result.stage).toBe(3);
    });

    it('should fail closed with no criteria (REQ-385)', () => {
      // Old behavior pinned `passed: true` — `results.every(...)` on an
      // empty array is vacuously true, so a criteria-less gate passed its
      // stage without evaluating anything (sibling of the REQ-384
      // `stages.every` legs in quality-monitor).
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [],
        blockingOnFailure: false,
      });
      const result = gate.evaluate({});
      expect(result.passed).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].criterionName).toBe('noCriteriaRegistered');
      expect(result.results[0].passed).toBe(false);
    });

    it('should include fallbackAction in result', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [],
        blockingOnFailure: true,
        fallbackAction: 'abort',
      });
      const result = gate.evaluate({});
      expect(result.fallbackAction).toBe('abort');
    });

    it('should propagate criterion details', () => {
      const gate = new StageQualityGate({
        stage: 1,
        name: 'Test',
        criteria: [makeCriterion('detailed', true, 0.9)],
        blockingOnFailure: false,
      });
      const result = gate.evaluate({});
      expect(result.results[0].details).toContain('detailed');
      expect(result.results[0].details).toContain('passed');
      expect(result.results[0].score).toBe(0.9);
    });
  });
});

// ===========================================================================
// QualityGateEvaluator
// ===========================================================================

describe('QualityGateEvaluator', () => {
  let evaluator: InstanceType<typeof QualityGateEvaluator>;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  // -------------------------------------------------------------------------
  // Default gate registration
  // -------------------------------------------------------------------------

  describe('default gates', () => {
    it('should register gates for all 5 stages', () => {
      for (let stage = 1; stage <= 5; stage++) {
        const result = evaluator.evaluateStage(stage, {});
        expect(result.stage).toBe(stage);
        // Should not return gateNotFound
        expect(result.results[0].criterionName).not.toBe('gateNotFound');
      }
    });
  });

  // -------------------------------------------------------------------------
  // registerGate
  // -------------------------------------------------------------------------

  describe('registerGate', () => {
    it('should register a custom gate', () => {
      const customConfig: QualityGateConfig = {
        stage: 1,
        name: 'Custom',
        criteria: [makeCriterion('custom', true)],
        blockingOnFailure: false,
      };
      evaluator.registerGate(customConfig);
      const result = evaluator.evaluateStage(1, {});
      expect(result.results[0].criterionName).toBe('custom');
    });

    it('should replace existing gate for same stage', () => {
      evaluator.registerGate({
        stage: 1,
        name: 'Replaced',
        criteria: [makeCriterion('new', true)],
        blockingOnFailure: false,
      });
      const result = evaluator.evaluateStage(1, {});
      expect(result.results[0].criterionName).toBe('new');
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - Stage 1 (Transcription)
  // -------------------------------------------------------------------------

  describe('Stage 1 - Transcription', () => {
    it('should pass with valid audio', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 10,
        sampleRate: 44100,
        noiseLevelDb: -50,
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with short audio', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 0.5,
        sampleRate: 44100,
        noiseLevelDb: -50,
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => r.criterionName === 'audioDuration' && !r.passed)).toBe(true);
    });

    it('should fail with low sample rate', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 10,
        sampleRate: 8000,
        noiseLevelDb: -50,
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => r.criterionName === 'sampleRate' && !r.passed)).toBe(true);
    });

    it('should fail with high noise', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 10,
        sampleRate: 44100,
        noiseLevelDb: -10,
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => r.criterionName === 'noiseLevel' && !r.passed)).toBe(true);
    });

    it('should pass at exact thresholds', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 1.0,
        sampleRate: 16000,
        noiseLevelDb: -31,
      });
      expect(result.passed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - Stage 2 (Analysis)
  // -------------------------------------------------------------------------

  describe('Stage 2 - Analysis', () => {
    it('should pass with sufficient entities and valid schema', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1, 2, 3, 4, 5],
        expectedEntities: 5,
        relations: [1, 2, 3, 4],
        expectedRelations: 5,
        schemaValid: true,
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with insufficient entities', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1],
        expectedEntities: 10,
        relations: [1, 2, 3, 4, 5],
        expectedRelations: 5,
        schemaValid: true,
      });
      expect(result.passed).toBe(false);
    });

    it('should fail with invalid schema', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1, 2, 3],
        expectedEntities: 3,
        relations: [1, 2],
        expectedRelations: 2,
        schemaValid: false,
      });
      expect(result.passed).toBe(false);
    });

    it('should pass when no expected entities/relations specified', () => {
      const result = evaluator.evaluateStage(2, {
        schemaValid: true,
      });
      expect(result.passed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - Stage 3 (Layout)
  // -------------------------------------------------------------------------

  describe('Stage 3 - Layout', () => {
    it('should pass with zero overlaps and continuous timeline', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 200, y: 0, w: 100, h: 50 },
        ],
        segments: [
          { startMs: 0, endMs: 1000, durationMs: 1000 },
          { startMs: 1000, endMs: 2000, durationMs: 1000 },
        ],
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with overlapping nodes', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 50, y: 0, w: 100, h: 50 }, // Overlaps with first
        ],
        segments: [
          { startMs: 0, endMs: 1000, durationMs: 1000 },
        ],
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => r.criterionName === 'zeroOverlap' && !r.passed)).toBe(true);
    });

    it('should fail with timeline gaps', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 200, y: 0, w: 100, h: 50 },
        ],
        segments: [
          { startMs: 0, endMs: 1000, durationMs: 1000 },
          { startMs: 2000, endMs: 3000, durationMs: 1000 }, // Gap!
        ],
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => r.criterionName === 'timelineContinuity' && !r.passed)).toBe(true);
    });

    it('should pass with single segment', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [{ startMs: 0, endMs: 1000, durationMs: 1000 }],
      });
      expect(result.passed).toBe(true);
    });

    it('should pass with empty segments', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [],
      });
      expect(result.passed).toBe(true);
    });

    it('should accept layoutQualityCompositeScore when provided', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [{ startMs: 0, endMs: 1000, durationMs: 1000 }],
        layoutQualityCompositeScore: 0.85,
      });
      const compositeResult = result.results.find(r => r.criterionName === 'layoutQualityComposite');
      expect(compositeResult?.passed).toBe(true);
      expect(compositeResult?.score).toBe(0.85);
    });

    it('should fail layoutQualityComposite below 0.7', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [{ startMs: 0, endMs: 1000, durationMs: 1000 }],
        layoutQualityCompositeScore: 0.5,
      });
      const compositeResult = result.results.find(r => r.criterionName === 'layoutQualityComposite');
      expect(compositeResult?.passed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - Stage 4 (Render Prep)
  // -------------------------------------------------------------------------

  describe('Stage 4 - Render Prep', () => {
    it('should pass with good caption sync and layout consistency', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 10,
        layoutConsistencyScore: 0.95,
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with poor caption sync', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 100,
        layoutConsistencyScore: 0.95,
      });
      expect(result.passed).toBe(false);
    });

    it('should fail with low layout consistency', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 10,
        layoutConsistencyScore: 0.5,
      });
      expect(result.passed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - Stage 5 (Render Final)
  // -------------------------------------------------------------------------

  describe('Stage 5 - Render Final', () => {
    it('should pass with 1080p at 30fps', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        audioSyncOffsetMs: 10,
      });
      expect(result.passed).toBe(true);
    });

    it('should pass with 720p at 30fps', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1280, height: 720 },
        fps: 30,
        audioSyncOffsetMs: 0,
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with low resolution', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 640, height: 480 },
        fps: 30,
        audioSyncOffsetMs: 10,
      });
      expect(result.passed).toBe(false);
    });

    it('should pass with 60fps (>= 30 threshold)', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 60,
        audioSyncOffsetMs: 10,
      });
      expect(result.passed).toBe(true);
    });

    it('should fail with low fps', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 24,
        audioSyncOffsetMs: 10,
      });
      expect(result.passed).toBe(false);
    });

    it('should fail with poor audio sync', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        audioSyncOffsetMs: 200,
      });
      expect(result.passed).toBe(false);
    });

    it('should handle negative audio sync offset (abs)', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        audioSyncOffsetMs: -20,
      });
      expect(result.passed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateStage - unregistered stage
  // -------------------------------------------------------------------------

  describe('unregistered stage', () => {
    it('should return failed result for unknown stage', () => {
      const result = evaluator.evaluateStage(99, {});
      expect(result.passed).toBe(false);
      expect(result.blocking).toBe(true);
      expect(result.results[0].criterionName).toBe('gateNotFound');
    });
  });

  // -------------------------------------------------------------------------
  // Regression detection
  // -------------------------------------------------------------------------

  describe('detectRegression', () => {
    it('should not detect regression without baseline', () => {
      const result = evaluator.detectRegression('job1', 0.8);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.previousScore).toBe(0);
    });

    it('should not detect regression when score improved', () => {
      evaluator.setBaselineScore('job1', 0.8);
      const result = evaluator.detectRegression('job1', 0.9);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(0);
    });

    it('should not detect regression when degradation <= 5%', () => {
      evaluator.setBaselineScore('job1', 100);
      const result = evaluator.detectRegression('job1', 96);
      // 4% degradation, below 5% threshold
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(4);
    });

    it('should detect regression when degradation > 5%', () => {
      evaluator.setBaselineScore('job1', 100);
      const result = evaluator.detectRegression('job1', 90);
      // 10% degradation
      expect(result.isRegression).toBe(true);
      expect(result.shouldBlock).toBe(true);
      expect(result.degradationPercent).toBe(10);
    });

    it('should block on large regression', () => {
      evaluator.setBaselineScore('job1', 0.9);
      const result = evaluator.detectRegression('job1', 0.1);
      expect(result.isRegression).toBe(true);
      expect(result.shouldBlock).toBe(true);
      expect(result.degradationPercent).toBeCloseTo(((0.9 - 0.1) / 0.9) * 100, 1);
    });

    it('should track previous and current scores', () => {
      evaluator.setBaselineScore('job1', 0.85);
      const result = evaluator.detectRegression('job1', 0.75);
      expect(result.previousScore).toBe(0.85);
      expect(result.currentScore).toBe(0.75);
    });

    it('should report 0 degradation for equal scores', () => {
      evaluator.setBaselineScore('job1', 0.8);
      const result = evaluator.detectRegression('job1', 0.8);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Per-stage metrics recording
  // -------------------------------------------------------------------------

  describe('recordStageMetrics', () => {
    it('should record metrics for a job', () => {
      evaluator.recordStageMetrics('job1', 1, { score: 0.9, passed: true });
      const report = evaluator.getQualityReport('job1');
      expect(report.jobId).toBe('job1');
      expect(report.stageMetrics).toHaveLength(1);
      expect(report.stageMetrics[0].stage).toBe(1);
      expect(report.stageMetrics[0].score).toBe(0.9);
      expect(report.stageMetrics[0].passed).toBe(true);
    });

    it('should accumulate metrics across stages', () => {
      evaluator.recordStageMetrics('job1', 1, { score: 0.9, passed: true });
      evaluator.recordStageMetrics('job1', 2, { score: 0.8, passed: true });
      evaluator.recordStageMetrics('job1', 3, { score: 0.7, passed: false });

      const report = evaluator.getQualityReport('job1');
      expect(report.stageMetrics).toHaveLength(3);
      expect(report.stageMetrics[2].passed).toBe(false);
    });

    it('should separate metrics by job', () => {
      evaluator.recordStageMetrics('job1', 1, { score: 0.9, passed: true });
      evaluator.recordStageMetrics('job2', 1, { score: 0.5, passed: false });

      const report1 = evaluator.getQualityReport('job1');
      const report2 = evaluator.getQualityReport('job2');
      expect(report1.stageMetrics).toHaveLength(1);
      expect(report2.stageMetrics).toHaveLength(1);
      expect(report1.stageMetrics[0].score).toBe(0.9);
      expect(report2.stageMetrics[0].score).toBe(0.5);
    });

    it('should return empty metrics for unknown job', () => {
      const report = evaluator.getQualityReport('unknown');
      expect(report.stageMetrics).toHaveLength(0);
    });
  });
});

// ===========================================================================
// createDefaultQualityGates
// ===========================================================================

describe('createDefaultQualityGates', () => {
  it('should return 5 gate configs', () => {
    const gates = createDefaultQualityGates();
    expect(gates).toHaveLength(5);
  });

  it('should have stages 1 through 5', () => {
    const gates = createDefaultQualityGates();
    const stages = gates.map(g => g.stage);
    expect(stages).toEqual([1, 2, 3, 4, 5]);
  });

  it('should have all gates blocking', () => {
    const gates = createDefaultQualityGates();
    for (const gate of gates) {
      expect(gate.blockingOnFailure).toBe(true);
    }
  });

  it('should have appropriate fallback actions', () => {
    const gates = createDefaultQualityGates();
    expect(gates[0].fallbackAction).toBe('retry'); // Transcription
    expect(gates[1].fallbackAction).toBe('retry'); // Analysis
    expect(gates[2].fallbackAction).toBe('abort');  // Layout
    expect(gates[3].fallbackAction).toBe('retry'); // Render prep
    expect(gates[4].fallbackAction).toBe('abort');  // Render final
  });

  it('should have criteria for each gate', () => {
    const gates = createDefaultQualityGates();
    for (const gate of gates) {
      expect(gate.criteria.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty names', () => {
    const gates = createDefaultQualityGates();
    for (const gate of gates) {
      expect(gate.name.length).toBeGreaterThan(0);
    }
  });
});
