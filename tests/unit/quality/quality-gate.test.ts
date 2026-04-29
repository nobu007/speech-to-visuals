/**
 * TASK-0044: Quality Gate and Quality Monitoring Module - Tests
 *
 * Tests per-stage quality criteria evaluation and regression detection.
 * Stages:
 *   1 - Transcription: audio duration, sample rate, noise
 *   2 - Analysis: entity extraction, relation completeness, schema conformance
 *   3 - Layout: zero overlap, timeline continuity, segment normalization
 *   4-5 - Render: caption sync, layout consistency, resolution, fps, audio sync
 */

import {
  QualityGateEvaluator,
  StageQualityGate,
  createDefaultQualityGates,
} from '@/quality/quality-gate';

import type {
  QualityGateConfig,
  QualityCriterion,
  QualityResult,
  RegressionResult,
} from '@/quality/quality-gate';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeTranscriptionInput(overrides: Record<string, any> = {}) {
  return {
    audioDuration: 5.0,        // seconds
    sampleRate: 44100,          // Hz
    noiseLevelDb: -40,          // dB
    segments: [
      { id: 0, start: 0, end: 2.5, text: 'Hello world', confidence: 0.95 },
      { id: 1, start: 2.5, end: 5, text: 'Test segment', confidence: 0.88 },
    ],
    ...overrides,
  };
}

function makeAnalysisInput(overrides: Record<string, any> = {}) {
  return {
    entities: [
      { id: 'e1', name: 'Entity1', type: 'concept' },
      { id: 'e2', name: 'Entity2', type: 'concept' },
      { id: 'e3', name: 'Entity3', type: 'concept' },
      { id: 'e4', name: 'Entity4', type: 'concept' },
      { id: 'e5', name: 'Entity5', type: 'concept' },
    ],
    relations: [
      { from: 'e1', to: 'e2', label: 'relates_to' },
      { from: 'e2', to: 'e3', label: 'causes' },
      { from: 'e3', to: 'e4', label: 'supports' },
    ],
    expectedEntities: 5,
    expectedRelations: 4,
    schemaValid: true,
    ...overrides,
  };
}

function makeLayoutInput(overrides: Record<string, any> = {}) {
  return {
    nodes: [
      { id: 'n1', x: 0, y: 0, w: 120, h: 60 },
      { id: 'n2', x: 200, y: 0, w: 120, h: 60 },
      { id: 'n3', x: 0, y: 200, w: 120, h: 60 },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ],
    segments: [
      { startMs: 0, endMs: 5000, durationMs: 5000 },
      { startMs: 5000, endMs: 10000, durationMs: 5000 },
    ],
    ...overrides,
  };
}

function makeRenderInput(overrides: Record<string, any> = {}) {
  return {
    captionSyncOffsetMs: 30,
    layoutConsistencyScore: 0.95,
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    audioSyncOffsetMs: 40,
    ...overrides,
  };
}

// ===========================================================================
// Stage 1 - Transcription Quality Gates
// ===========================================================================

describe('QualityGateEvaluator - Stage 1 (Transcription)', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('passes when audio duration >= 1s', () => {
    const input = makeTranscriptionInput({ audioDuration: 5.0 });
    const result = evaluator.evaluateStage(1, input);
    const durationResult = result.results.find(
      (r) => r.criterionName === 'audioDuration'
    );
    expect(durationResult).toBeDefined();
    expect(durationResult!.passed).toBe(true);
    expect(durationResult!.score).toBeGreaterThanOrEqual(1.0);
  });

  test('fails when audio duration < 1s', () => {
    const input = makeTranscriptionInput({ audioDuration: 0.5 });
    const result = evaluator.evaluateStage(1, input);
    const durationResult = result.results.find(
      (r) => r.criterionName === 'audioDuration'
    );
    expect(durationResult).toBeDefined();
    expect(durationResult!.passed).toBe(false);
  });

  test('passes when sample rate >= 16kHz', () => {
    const input = makeTranscriptionInput({ sampleRate: 44100 });
    const result = evaluator.evaluateStage(1, input);
    const srResult = result.results.find(
      (r) => r.criterionName === 'sampleRate'
    );
    expect(srResult).toBeDefined();
    expect(srResult!.passed).toBe(true);
  });

  test('fails when sample rate < 16kHz', () => {
    const input = makeTranscriptionInput({ sampleRate: 8000 });
    const result = evaluator.evaluateStage(1, input);
    const srResult = result.results.find(
      (r) => r.criterionName === 'sampleRate'
    );
    expect(srResult).toBeDefined();
    expect(srResult!.passed).toBe(false);
  });

  test('passes when noise level < -30dB', () => {
    const input = makeTranscriptionInput({ noiseLevelDb: -40 });
    const result = evaluator.evaluateStage(1, input);
    const noiseResult = result.results.find(
      (r) => r.criterionName === 'noiseLevel'
    );
    expect(noiseResult).toBeDefined();
    expect(noiseResult!.passed).toBe(true);
  });

  test('fails when noise level >= -30dB', () => {
    const input = makeTranscriptionInput({ noiseLevelDb: -20 });
    const result = evaluator.evaluateStage(1, input);
    const noiseResult = result.results.find(
      (r) => r.criterionName === 'noiseLevel'
    );
    expect(noiseResult).toBeDefined();
    expect(noiseResult!.passed).toBe(false);
  });

  test('overall stage passes when all criteria pass', () => {
    const input = makeTranscriptionInput();
    const result = evaluator.evaluateStage(1, input);
    expect(result.passed).toBe(true);
  });

  test('overall stage fails when any criterion fails', () => {
    const input = makeTranscriptionInput({ noiseLevelDb: -10 });
    const result = evaluator.evaluateStage(1, input);
    expect(result.passed).toBe(false);
  });
});

// ===========================================================================
// Stage 2 - Analysis Quality Gates
// ===========================================================================

describe('QualityGateEvaluator - Stage 2 (Analysis)', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('passes when entity extraction rate >= 80%', () => {
    // 5/5 = 100%
    const input = makeAnalysisInput();
    const result = evaluator.evaluateStage(2, input);
    const entityResult = result.results.find(
      (r) => r.criterionName === 'entityExtractionRate'
    );
    expect(entityResult).toBeDefined();
    expect(entityResult!.passed).toBe(true);
  });

  test('fails when entity extraction rate < 80%', () => {
    // 3/5 = 60%
    const input = makeAnalysisInput({
      entities: [
        { id: 'e1', name: 'Entity1', type: 'concept' },
        { id: 'e2', name: 'Entity2', type: 'concept' },
        { id: 'e3', name: 'Entity3', type: 'concept' },
      ],
    });
    const result = evaluator.evaluateStage(2, input);
    const entityResult = result.results.find(
      (r) => r.criterionName === 'entityExtractionRate'
    );
    expect(entityResult).toBeDefined();
    expect(entityResult!.passed).toBe(false);
  });

  test('passes when relation completeness >= 70%', () => {
    // 3/4 = 75%
    const input = makeAnalysisInput();
    const result = evaluator.evaluateStage(2, input);
    const relationResult = result.results.find(
      (r) => r.criterionName === 'relationCompleteness'
    );
    expect(relationResult).toBeDefined();
    expect(relationResult!.passed).toBe(true);
  });

  test('fails when relation completeness < 70%', () => {
    // 1/4 = 25%
    const input = makeAnalysisInput({
      relations: [{ from: 'e1', to: 'e2', label: 'relates_to' }],
    });
    const result = evaluator.evaluateStage(2, input);
    const relationResult = result.results.find(
      (r) => r.criterionName === 'relationCompleteness'
    );
    expect(relationResult).toBeDefined();
    expect(relationResult!.passed).toBe(false);
  });

  test('passes when JSON schema is valid', () => {
    const input = makeAnalysisInput({ schemaValid: true });
    const result = evaluator.evaluateStage(2, input);
    const schemaResult = result.results.find(
      (r) => r.criterionName === 'schemaConformance'
    );
    expect(schemaResult).toBeDefined();
    expect(schemaResult!.passed).toBe(true);
  });

  test('fails when JSON schema is invalid', () => {
    const input = makeAnalysisInput({ schemaValid: false });
    const result = evaluator.evaluateStage(2, input);
    const schemaResult = result.results.find(
      (r) => r.criterionName === 'schemaConformance'
    );
    expect(schemaResult).toBeDefined();
    expect(schemaResult!.passed).toBe(false);
  });

  test('overall stage passes when all criteria pass', () => {
    const input = makeAnalysisInput();
    const result = evaluator.evaluateStage(2, input);
    expect(result.passed).toBe(true);
  });
});

// ===========================================================================
// Stage 3 - Layout Quality Gates
// ===========================================================================

describe('QualityGateEvaluator - Stage 3 (Layout)', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('passes when no nodes overlap', () => {
    const input = makeLayoutInput();
    const result = evaluator.evaluateStage(3, input);
    const overlapResult = result.results.find(
      (r) => r.criterionName === 'zeroOverlap'
    );
    expect(overlapResult).toBeDefined();
    expect(overlapResult!.passed).toBe(true);
  });

  test('fails when nodes overlap', () => {
    // n2 overlaps with n1 since both at (0,0)
    const input = makeLayoutInput({
      nodes: [
        { id: 'n1', x: 0, y: 0, w: 120, h: 60 },
        { id: 'n2', x: 50, y: 0, w: 120, h: 60 }, // overlaps n1
      ],
    });
    const result = evaluator.evaluateStage(3, input);
    const overlapResult = result.results.find(
      (r) => r.criterionName === 'zeroOverlap'
    );
    expect(overlapResult).toBeDefined();
    expect(overlapResult!.passed).toBe(false);
  });

  test('passes when timeline has continuity', () => {
    const input = makeLayoutInput();
    const result = evaluator.evaluateStage(3, input);
    const timelineResult = result.results.find(
      (r) => r.criterionName === 'timelineContinuity'
    );
    expect(timelineResult).toBeDefined();
    expect(timelineResult!.passed).toBe(true);
  });

  test('fails when timeline has a gap', () => {
    const input = makeLayoutInput({
      segments: [
        { startMs: 0, endMs: 3000, durationMs: 3000 },
        { startMs: 7000, endMs: 12000, durationMs: 5000 }, // gap between 3s and 7s
      ],
    });
    const result = evaluator.evaluateStage(3, input);
    const timelineResult = result.results.find(
      (r) => r.criterionName === 'timelineContinuity'
    );
    expect(timelineResult).toBeDefined();
    expect(timelineResult!.passed).toBe(false);
  });

  test('passes when segments are normalized', () => {
    const input = makeLayoutInput();
    const result = evaluator.evaluateStage(3, input);
    const normResult = result.results.find(
      (r) => r.criterionName === 'segmentNormalization'
    );
    expect(normResult).toBeDefined();
    expect(normResult!.passed).toBe(true);
  });

  test('fails when segments have zero or negative duration', () => {
    const input = makeLayoutInput({
      segments: [
        { startMs: 0, endMs: 0, durationMs: 0 },
        { startMs: 0, endMs: 5000, durationMs: 5000 },
      ],
    });
    const result = evaluator.evaluateStage(3, input);
    const normResult = result.results.find(
      (r) => r.criterionName === 'segmentNormalization'
    );
    expect(normResult).toBeDefined();
    expect(normResult!.passed).toBe(false);
  });
});

// ===========================================================================
// Stage 4-5 - Render Quality Gates
// ===========================================================================

describe('QualityGateEvaluator - Stage 4-5 (Render)', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('passes when caption sync within +/-50ms', () => {
    const input = makeRenderInput({ captionSyncOffsetMs: 30 });
    const result = evaluator.evaluateStage(4, input);
    const syncResult = result.results.find(
      (r) => r.criterionName === 'captionSync'
    );
    expect(syncResult).toBeDefined();
    expect(syncResult!.passed).toBe(true);
  });

  test('fails when caption sync exceeds +/-50ms', () => {
    const input = makeRenderInput({ captionSyncOffsetMs: 80 });
    const result = evaluator.evaluateStage(4, input);
    const syncResult = result.results.find(
      (r) => r.criterionName === 'captionSync'
    );
    expect(syncResult).toBeDefined();
    expect(syncResult!.passed).toBe(false);
  });

  test('passes when layout consistency is high', () => {
    const input = makeRenderInput({ layoutConsistencyScore: 0.95 });
    const result = evaluator.evaluateStage(4, input);
    const consistencyResult = result.results.find(
      (r) => r.criterionName === 'layoutConsistency'
    );
    expect(consistencyResult).toBeDefined();
    expect(consistencyResult!.passed).toBe(true);
  });

  test('fails when layout consistency is low', () => {
    const input = makeRenderInput({ layoutConsistencyScore: 0.5 });
    const result = evaluator.evaluateStage(4, input);
    const consistencyResult = result.results.find(
      (r) => r.criterionName === 'layoutConsistency'
    );
    expect(consistencyResult).toBeDefined();
    expect(consistencyResult!.passed).toBe(false);
  });

  test('passes when resolution >= 720p', () => {
    const input = makeRenderInput({ resolution: { width: 1920, height: 1080 } });
    const result = evaluator.evaluateStage(5, input);
    const resResult = result.results.find(
      (r) => r.criterionName === 'resolution'
    );
    expect(resResult).toBeDefined();
    expect(resResult!.passed).toBe(true);
  });

  test('fails when resolution < 720p', () => {
    const input = makeRenderInput({ resolution: { width: 640, height: 480 } });
    const result = evaluator.evaluateStage(5, input);
    const resResult = result.results.find(
      (r) => r.criterionName === 'resolution'
    );
    expect(resResult).toBeDefined();
    expect(resResult!.passed).toBe(false);
  });

  test('passes when fps = 30', () => {
    const input = makeRenderInput({ fps: 30 });
    const result = evaluator.evaluateStage(5, input);
    const fpsResult = result.results.find((r) => r.criterionName === 'fps');
    expect(fpsResult).toBeDefined();
    expect(fpsResult!.passed).toBe(true);
  });

  test('fails when fps != 30', () => {
    const input = makeRenderInput({ fps: 24 });
    const result = evaluator.evaluateStage(5, input);
    const fpsResult = result.results.find((r) => r.criterionName === 'fps');
    expect(fpsResult).toBeDefined();
    expect(fpsResult!.passed).toBe(false);
  });

  test('passes when audio sync within +/-50ms', () => {
    const input = makeRenderInput({ audioSyncOffsetMs: 40 });
    const result = evaluator.evaluateStage(5, input);
    const audioResult = result.results.find(
      (r) => r.criterionName === 'audioSync'
    );
    expect(audioResult).toBeDefined();
    expect(audioResult!.passed).toBe(true);
  });

  test('fails when audio sync exceeds +/-50ms', () => {
    const input = makeRenderInput({ audioSyncOffsetMs: 70 });
    const result = evaluator.evaluateStage(5, input);
    const audioResult = result.results.find(
      (r) => r.criterionName === 'audioSync'
    );
    expect(audioResult).toBeDefined();
    expect(audioResult!.passed).toBe(false);
  });
});

// ===========================================================================
// Regression Detection
// ===========================================================================

describe('QualityGateEvaluator - Regression Detection', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  test('detects regression when quality degrades >5%', () => {
    // Set baseline score
    evaluator.setBaselineScore('job-1', 0.90);

    // Current score is 0.80 => 11% degradation
    const result = evaluator.detectRegression('job-1', 0.80);
    expect(result.isRegression).toBe(true);
    expect(result.degradationPercent).toBeGreaterThanOrEqual(10);
    expect(result.shouldBlock).toBe(true);
  });

  test('no regression when quality degrades <=5%', () => {
    evaluator.setBaselineScore('job-2', 0.90);
    const result = evaluator.detectRegression('job-2', 0.87);
    expect(result.isRegression).toBe(false);
    expect(result.shouldBlock).toBe(false);
  });

  test('no regression when quality improves', () => {
    evaluator.setBaselineScore('job-3', 0.80);
    const result = evaluator.detectRegression('job-3', 0.90);
    expect(result.isRegression).toBe(false);
    expect(result.currentScore).toBe(0.90);
    expect(result.previousScore).toBe(0.80);
  });

  test('handles missing baseline gracefully', () => {
    const result = evaluator.detectRegression('unknown-job', 0.80);
    expect(result.isRegression).toBe(false);
    expect(result.previousScore).toBe(0);
    expect(result.currentScore).toBe(0.80);
  });

  test('records per-stage metrics', () => {
    evaluator.recordStageMetrics('job-4', 1, { score: 0.95, passed: true });
    evaluator.recordStageMetrics('job-4', 2, { score: 0.85, passed: true });
    evaluator.recordStageMetrics('job-4', 3, { score: 0.70, passed: false });

    const report = evaluator.getQualityReport('job-4');
    expect(report).toBeDefined();
    expect(report.stageMetrics).toHaveLength(3);
    expect(report.stageMetrics[0].stage).toBe(1);
    expect(report.stageMetrics[2].passed).toBe(false);
  });
});

// ===========================================================================
// QualityGateConfig with custom criteria
// ===========================================================================

describe('StageQualityGate - Custom Config', () => {
  test('creates gate with custom criteria', () => {
    const config: QualityGateConfig = {
      stage: 1,
      name: 'Custom Transcription Gate',
      criteria: [
        {
          name: 'customCheck',
          threshold: 0.9,
          evaluate: (input: any): QualityResult => ({
            passed: input.confidence >= 0.9,
            score: input.confidence,
            threshold: 0.9,
            details: `Confidence ${input.confidence} vs threshold 0.9`,
          }),
        },
      ],
      blockingOnFailure: true,
      fallbackAction: 'retry',
    };

    const gate = new StageQualityGate(config);
    const result = gate.evaluate({ confidence: 0.95 });
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
  });

  test('respects blockingOnFailure flag', () => {
    const config: QualityGateConfig = {
      stage: 1,
      name: 'Non-blocking Gate',
      criteria: [
        {
          name: 'failingCheck',
          threshold: 0.9,
          evaluate: (): QualityResult => ({
            passed: false,
            score: 0.5,
            threshold: 0.9,
            details: 'Always fails',
          }),
        },
      ],
      blockingOnFailure: false,
    };

    const gate = new StageQualityGate(config);
    const result = gate.evaluate({});
    expect(result.passed).toBe(false);
    expect(result.blocking).toBe(false);
  });

  test('returns fallbackAction when set', () => {
    const config: QualityGateConfig = {
      stage: 2,
      name: 'Gate with Fallback',
      criteria: [
        {
          name: 'check',
          threshold: 1.0,
          evaluate: (): QualityResult => ({
            passed: false,
            score: 0,
            threshold: 1.0,
            details: 'fail',
          }),
        },
      ],
      blockingOnFailure: true,
      fallbackAction: 'skip',
    };

    const gate = new StageQualityGate(config);
    const result = gate.evaluate({});
    expect(result.fallbackAction).toBe('skip');
  });
});

// ===========================================================================
// Default Quality Gates Factory
// ===========================================================================

describe('createDefaultQualityGates', () => {
  test('creates gates for all 5 stages', () => {
    const gates = createDefaultQualityGates();
    expect(gates).toHaveLength(5);
    expect(gates[0].stage).toBe(1);
    expect(gates[1].stage).toBe(2);
    expect(gates[2].stage).toBe(3);
    expect(gates[3].stage).toBe(4);
    expect(gates[4].stage).toBe(5);
  });

  test('each gate has at least one criterion', () => {
    const gates = createDefaultQualityGates();
    for (const gate of gates) {
      expect(gate.criteria.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ===========================================================================
// QualityGateEvaluator full pipeline report
// ===========================================================================

describe('QualityGateEvaluator - Full Pipeline Report', () => {
  test('generates report across all stages', () => {
    const evaluator = new QualityGateEvaluator();

    const transcriptionInput = makeTranscriptionInput();
    const analysisInput = makeAnalysisInput();
    const layoutInput = makeLayoutInput();
    const render4Input = makeRenderInput();
    const render5Input = makeRenderInput();

    const results = [
      evaluator.evaluateStage(1, transcriptionInput),
      evaluator.evaluateStage(2, analysisInput),
      evaluator.evaluateStage(3, layoutInput),
      evaluator.evaluateStage(4, render4Input),
      evaluator.evaluateStage(5, render5Input),
    ];

    // All stages should pass with valid input
    for (const result of results) {
      expect(result.passed).toBe(true);
    }
  });
});
