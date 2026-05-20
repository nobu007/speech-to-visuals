/**
 * Tests for QualityGateEvaluator and StageQualityGate (src/quality/quality-gate.ts)
 */

import {
  StageQualityGate,
  QualityGateEvaluator,
  createDefaultQualityGates,
} from '@/quality/quality-gate';
import type { QualityGateConfig } from '@/quality/quality-gate';

describe('StageQualityGate', () => {
  const passCriterion = {
    name: 'alwaysPass',
    threshold: 0.5,
    evaluate: () => ({ passed: true, score: 1.0, threshold: 0.5, details: 'OK' }),
  };
  const failCriterion = {
    name: 'alwaysFail',
    threshold: 0.5,
    evaluate: () => ({ passed: false, score: 0.1, threshold: 0.5, details: 'bad' }),
  };

  test('evaluate passes when all criteria pass', () => {
    const gate = new StageQualityGate({
      stage: 1,
      name: 'test',
      criteria: [passCriterion, passCriterion],
      blockingOnFailure: true,
    });
    const result = gate.evaluate({});
    expect(result.passed).toBe(true);
    expect(result.stage).toBe(1);
    expect(result.results).toHaveLength(2);
    expect(result.blocking).toBe(true);
  });

  test('evaluate fails when any criterion fails', () => {
    const gate = new StageQualityGate({
      stage: 2,
      name: 'test',
      criteria: [passCriterion, failCriterion],
      blockingOnFailure: false,
    });
    const result = gate.evaluate({});
    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.blocking).toBe(false);
  });

  test('exposes config properties', () => {
    const gate = new StageQualityGate({
      stage: 3,
      name: 'my gate',
      criteria: [],
      blockingOnFailure: true,
      fallbackAction: 'retry',
    });
    expect(gate.stage).toBe(3);
    expect(gate.name).toBe('my gate');
    expect(gate.blocking).toBe(true);
    expect(gate.fallbackAction).toBe('retry');
  });

  test('fallbackAction is undefined when not set', () => {
    const gate = new StageQualityGate({
      stage: 1,
      name: 'no fallback',
      criteria: [],
      blockingOnFailure: true,
    });
    expect(gate.fallbackAction).toBeUndefined();
  });

  test('criterion results include name, score, and details', () => {
    const gate = new StageQualityGate({
      stage: 1,
      name: 'test',
      criteria: [passCriterion],
      blockingOnFailure: true,
    });
    const result = gate.evaluate({});
    expect(result.results[0].criterionName).toBe('alwaysPass');
    expect(result.results[0].score).toBe(1.0);
    expect(result.results[0].details).toBe('OK');
  });
});

describe('QualityGateEvaluator', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('has default gates for stages 1-5', () => {
    const defaults = createDefaultQualityGates();
    expect(defaults).toHaveLength(5);
    expect(defaults.map(g => g.stage)).toEqual([1, 2, 3, 4, 5]);
  });

  // ── Stage 1 (Transcription) ──────────────────────────────────────

  describe('stage 1 - Transcription', () => {
    test('passes with valid audio input', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 10,
        sampleRate: 44100,
        noiseLevelDb: -40,
      });
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    test('fails when audioDuration < 1.0s', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 0.5,
        sampleRate: 44100,
        noiseLevelDb: -40,
      });
      expect(result.passed).toBe(false);
      const durationResult = result.results.find(r => r.criterionName === 'audioDuration');
      expect(durationResult!.passed).toBe(false);
    });

    test('fails when sampleRate < 16000', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 5,
        sampleRate: 8000,
        noiseLevelDb: -40,
      });
      expect(result.passed).toBe(false);
      const rateResult = result.results.find(r => r.criterionName === 'sampleRate');
      expect(rateResult!.passed).toBe(false);
    });

    test('fails when noise level >= -30dB', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 5,
        sampleRate: 44100,
        noiseLevelDb: -20,
      });
      expect(result.passed).toBe(false);
      const noiseResult = result.results.find(r => r.criterionName === 'noiseLevel');
      expect(noiseResult!.passed).toBe(false);
    });
  });

  // ── Stage 2 (Analysis) ───────────────────────────────────────────

  describe('stage 2 - Analysis', () => {
    test('passes with good extraction rates', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1, 2, 3, 4, 5],
        expectedEntities: 5,
        relations: [1, 2, 3, 4],
        expectedRelations: 5,
        schemaValid: true,
      });
      expect(result.passed).toBe(true);
    });

    test('fails when entity extraction rate < 80%', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1],
        expectedEntities: 10,
        relations: [1, 2, 3, 4, 5],
        expectedRelations: 5,
        schemaValid: true,
      });
      expect(result.passed).toBe(false);
    });

    test('passes when expectedEntities is 0 (trivially satisfied)', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [],
        expectedEntities: 0,
        relations: [],
        expectedRelations: 0,
        schemaValid: true,
      });
      expect(result.passed).toBe(true);
    });

    test('fails when schema is invalid', () => {
      const result = evaluator.evaluateStage(2, {
        entities: [1],
        expectedEntities: 1,
        relations: [1],
        expectedRelations: 1,
        schemaValid: false,
      });
      expect(result.passed).toBe(false);
    });
  });

  // ── Stage 3 (Layout) ─────────────────────────────────────────────

  describe('stage 3 - Layout', () => {
    test('passes with non-overlapping nodes', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 200, y: 0, w: 100, h: 50 },
        ],
        segments: [],
      });
      expect(result.passed).toBe(true);
    });

    test('fails with overlapping nodes', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 50, y: 0, w: 100, h: 50 },  // overlaps with first
        ],
        segments: [],
      });
      expect(result.passed).toBe(false);
      const overlapResult = result.results.find(r => r.criterionName === 'zeroOverlap');
      expect(overlapResult!.passed).toBe(false);
    });

    test('timeline continuity passes with continuous segments', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [
          { startMs: 0, endMs: 1000 },
          { startMs: 1000, endMs: 2000 },
        ],
      });
      const continuity = result.results.find(r => r.criterionName === 'timelineContinuity');
      expect(continuity!.passed).toBe(true);
    });

    test('timeline continuity fails with gaps > 100ms', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [{ x: 0, y: 0, w: 100, h: 50 }],
        segments: [
          { startMs: 0, endMs: 500 },
          { startMs: 1000, endMs: 2000 },  // 500ms gap
        ],
      });
      const continuity = result.results.find(r => r.criterionName === 'timelineContinuity');
      expect(continuity!.passed).toBe(false);
    });
  });

  // ── Stage 4 (Render Prep) ────────────────────────────────────────

  describe('stage 4 - Render Prep', () => {
    test('passes with good caption sync and layout consistency', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 20,
        layoutConsistencyScore: 0.95,
      });
      expect(result.passed).toBe(true);
    });

    test('fails when caption sync offset > 50ms', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 80,
        layoutConsistencyScore: 0.95,
      });
      expect(result.passed).toBe(false);
    });

    test('fails when layout consistency < 0.9', () => {
      const result = evaluator.evaluateStage(4, {
        captionSyncOffsetMs: 0,
        layoutConsistencyScore: 0.7,
      });
      expect(result.passed).toBe(false);
    });
  });

  // ── Stage 5 (Render Final) ───────────────────────────────────────

  describe('stage 5 - Render Final', () => {
    test('passes with 1080p30 output', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        audioSyncOffsetMs: 10,
      });
      expect(result.passed).toBe(true);
    });

    test('fails when resolution < 720p', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 640, height: 480 },
        fps: 30,
        audioSyncOffsetMs: 0,
      });
      expect(result.passed).toBe(false);
    });

    test('fails when fps != 30', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 24,
        audioSyncOffsetMs: 0,
      });
      expect(result.passed).toBe(false);
    });

    test('fails when audio sync > 50ms', () => {
      const result = evaluator.evaluateStage(5, {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        audioSyncOffsetMs: 100,
      });
      expect(result.passed).toBe(false);
    });
  });

  // ── Unknown stage ────────────────────────────────────────────────

  describe('unknown stage', () => {
    test('returns failure for unregistered stage', () => {
      const result = evaluator.evaluateStage(99, {});
      expect(result.passed).toBe(false);
      expect(result.results[0].criterionName).toBe('gateNotFound');
      expect(result.blocking).toBe(true);
    });
  });

  // ── registerGate ─────────────────────────────────────────────────

  describe('registerGate', () => {
    test('allows overriding a default gate', () => {
      evaluator.registerGate({
        stage: 1,
        name: 'Custom Gate',
        criteria: [],
        blockingOnFailure: false,
      });
      const result = evaluator.evaluateStage(1, {});
      expect(result.passed).toBe(true); // no criteria = all pass
      expect(result.blocking).toBe(false);
    });
  });

  // ── Regression Detection ─────────────────────────────────────────

  describe('detectRegression', () => {
    test('no regression when no baseline set', () => {
      const result = evaluator.detectRegression('job1', 80);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.previousScore).toBe(0);
    });

    test('no regression when score improves', () => {
      evaluator.setBaselineScore('job1', 80);
      const result = evaluator.detectRegression('job1', 90);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(0);
    });

    test('no regression when score drops <= 5%', () => {
      evaluator.setBaselineScore('job1', 100);
      const result = evaluator.detectRegression('job1', 96);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(4);
    });

    test('regression detected when score drops > 5%', () => {
      evaluator.setBaselineScore('job1', 100);
      const result = evaluator.detectRegression('job1', 90);
      expect(result.isRegression).toBe(true);
      expect(result.shouldBlock).toBe(true);
      expect(result.degradationPercent).toBe(10);
    });
  });

  // ── Stage Metrics Recording ──────────────────────────────────────

  describe('stage metrics', () => {
    test('recordStageMetrics accumulates per-job', () => {
      evaluator.recordStageMetrics('job1', 1, { score: 0.9, passed: true });
      evaluator.recordStageMetrics('job1', 2, { score: 0.8, passed: true });
      const report = evaluator.getQualityReport('job1');
      expect(report.jobId).toBe('job1');
      expect(report.stageMetrics).toHaveLength(2);
      expect(report.stageMetrics[0].stage).toBe(1);
    });

    test('getQualityReport returns empty for unknown job', () => {
      const report = evaluator.getQualityReport('nonexistent');
      expect(report.stageMetrics).toHaveLength(0);
    });
  });
});
