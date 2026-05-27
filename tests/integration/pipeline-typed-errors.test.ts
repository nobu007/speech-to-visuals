/**
 * Phase 60 Integration Tests: Typed Error Propagation & Round-Trip Validation
 *
 * REQ-155: PipelineAbortError → ErrorClassifier integration test
 * REQ-157: Round-trip validation test for typed error propagation
 *
 * Verifies:
 * 1. PipelineAbortError is correctly classified by ErrorClassifier
 *    as QUALITY_GATE_FAILED with proper severity and recoverability
 * 2. All typed pipeline errors propagate correctly through the full
 *    error handling chain: throw → classify → recovery strategy → report
 * 3. Smoke orchestrator typed errors (PipelineConfigError, SegmentationError,
 *    RenderingError) are correctly classified
 */

import { jest } from '@jest/globals';
import type { ClassifiedError } from '@/quality/error-classifier';

// ---------- Imports ----------

let ErrorClassifier: typeof import('@/quality/error-classifier').ErrorClassifier;
let PipelineError: typeof import('@/pipeline/pipeline-errors').PipelineError;
let PipelineAbortError: typeof import('@/pipeline/pipeline-errors').PipelineAbortError;
let PipelineConfigError: typeof import('@/pipeline/pipeline-errors').PipelineConfigError;
let TranscriptionError: typeof import('@/pipeline/pipeline-errors').TranscriptionError;
let SegmentationError: typeof import('@/pipeline/pipeline-errors').SegmentationError;
let RenderingError: typeof import('@/pipeline/pipeline-errors').RenderingError;
let QualityGateError: typeof import('@/pipeline/pipeline-errors').QualityGateError;

beforeAll(async () => {
  const ecMod = await import('@/quality/error-classifier');
  ErrorClassifier = ecMod.ErrorClassifier;

  const peMod = await import('@/pipeline/pipeline-errors');
  PipelineError = peMod.PipelineError;
  PipelineAbortError = peMod.PipelineAbortError;
  PipelineConfigError = peMod.PipelineConfigError;
  TranscriptionError = peMod.TranscriptionError;
  SegmentationError = peMod.SegmentationError;
  RenderingError = peMod.RenderingError;
  QualityGateError = peMod.QualityGateError;
});

// ---------- REQ-155: PipelineAbortError → ErrorClassifier Integration ----------

describe('REQ-155: PipelineAbortError → ErrorClassifier Integration', () => {
  let classifier: InstanceType<typeof ErrorClassifier>;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  it('classifies PipelineAbortError as QUALITY_GATE_FAILED', () => {
    const abortError = new PipelineAbortError(
      'Pipeline aborted: recovery tracker detected critical degradation',
    );

    const classified = classifier.classify(abortError);

    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.stage).toBe('abort');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(abortError);
    expect(classified.userMessage).toContain('quality');
  });

  it('preserves PipelineAbortError context in classification', () => {
    const abortError = new PipelineAbortError(
      'Pipeline aborted: critical degradation',
      { retryBudget: 10, degradedStages: ['transcription', 'analysis'] },
    );

    const classified = classifier.classify(abortError);

    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.originalError).toBe(abortError);
    // Context should be preserved on the original error
    expect((classified.originalError as InstanceType<typeof PipelineAbortError>).context).toEqual({
      retryBudget: 10,
      degradedStages: ['transcription', 'analysis'],
    });
  });

  it('PipelineAbortError classification uses typed errorType over regex rules', () => {
    const abortError = new PipelineAbortError('Critical abort condition');

    const classified = classifier.classify(abortError, {
      stage: 'orchestration',
    });

    // The typed error's own errorType should take precedence over regex matching
    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.stage).toBe('abort');
  });

  it('PipelineAbortError classification is distinct from generic quality gate errors', () => {
    const abortError = new PipelineAbortError('Critical degradation abort');
    const gateError = new QualityGateError(
      'layout-quality',
      'Layout overlap exceeded threshold',
    );

    const abortClassified = classifier.classify(abortError);
    const gateClassified = classifier.classify(gateError);

    // Both are QUALITY_GATE_FAILED type
    expect(abortClassified.type).toBe('QUALITY_GATE_FAILED');
    expect(gateClassified.type).toBe('QUALITY_GATE_FAILED');

    // But different stages
    expect(abortClassified.stage).toBe('abort');
    expect(gateClassified.stage).toBe('quality_gate');

    // Both are recoverable
    expect(abortClassified.recoverable).toBe(true);
    expect(gateClassified.recoverable).toBe(true);
  });

  it('correctly classifies multiple PipelineAbortErrors in batch', () => {
    const errors = [
      new PipelineAbortError('Abort: retry budget exhausted'),
      new PipelineAbortError('Abort: too many degraded stages'),
      new PipelineAbortError('Abort: fatal error type detected'),
    ];

    const classified = classifier.classifyBatch(errors);

    expect(classified).toHaveLength(3);
    for (const c of classified) {
      expect(c.type).toBe('QUALITY_GATE_FAILED');
      expect(c.severity).toBe('high');
      expect(c.recoverable).toBe(true);
    }
  });

  it('updates classification statistics after PipelineAbortError', () => {
    const abortError = new PipelineAbortError('Statistics tracking test');

    classifier.classify(abortError);
    const stats = classifier.getStatistics();

    expect(stats.total).toBe(1);
    expect(stats.byType['QUALITY_GATE_FAILED']).toBe(1);
    expect(stats.mostCommonType).toBe('QUALITY_GATE_FAILED');
  });
});

// ---------- REQ-157: Round-Trip Validation ----------

describe('REQ-157: Round-trip typed error propagation validation', () => {
  let classifier: InstanceType<typeof ErrorClassifier>;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  function classifyThrownError(error: Error): ClassifiedError {
    let classified: ClassifiedError | undefined;
    try {
      throw error;
    } catch (err) {
      if (err instanceof Error) {
        classified = classifier.classify(err);
      }
    }
    expect(classified).toBeDefined();
    return classified!;
  }

  it('PipelineError base class round-trip: throw → catch → classify', () => {
    const original = new PipelineError(
      'Generic pipeline failure',
      'UNKNOWN',
      'pipeline',
    );

    const classified = classifyThrownError(original);

    expect(classified.type).toBe('UNKNOWN');
    expect(classified.stage).toBe('pipeline');
  });

  it('TranscriptionError round-trip: throw → classify → verify errorType', () => {
    const error = new TranscriptionError('Whisper API returned empty result', {
      model: 'whisper-v3',
      duration: 30,
    });

    const classified = classifyThrownError(error);

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.stage).toBe('transcription');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.suggestedAction).toBeDefined();
  });

  it('SegmentationError round-trip: throw → classify → verify QUALITY_GATE_FAILED', () => {
    const error = new SegmentationError('No segments produced from analysis');

    const classified = classifyThrownError(error);

    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.stage).toBe('segmentation');
  });

  it('RenderingError round-trip: throw → classify → verify RENDERING_ERROR', () => {
    const error = new RenderingError('Remotion render failed: output frame mismatch', {
      expectedFrames: 900,
      actualFrames: 870,
    });

    const classified = classifyThrownError(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('rendering');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
  });

  it('PipelineConfigError round-trip: throw → classify → verify FILE_FORMAT_INVALID', () => {
    const error = new PipelineConfigError('rawLlmText', 'Invalid LLM text: no diagram object');

    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('configuration');
  });

  it('QualityGateError round-trip: throw → classify → verify structured metadata', () => {
    const error = new QualityGateError(
      'layout-overlap',
      'Layout overlap detected: 3 element pairs overlap',
    );

    const classified = classifyThrownError(error);

    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.stage).toBe('quality_gate');
    // Verify the gate metadata is preserved
    const originalErr = classified.originalError as InstanceType<typeof QualityGateError>;
    expect(originalErr.gateName).toBe('layout-overlap');
    expect(originalErr.reason).toContain('overlap');
  });

  it('PipelineAbortError full round-trip produces actionable output', () => {
    const abortError = new PipelineAbortError(
      'Pipeline aborted: critical degradation across 3 stages',
    );

    const classified = classifyThrownError(abortError);

    // Verify the complete round-trip produces actionable output
    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.suggestedAction).toBeTruthy();
    expect(typeof classified.suggestedAction).toBe('string');
    expect(classified.userMessage).toBeTruthy();
    expect(typeof classified.userMessage).toBe('string');
  });

  it('mixed raw Error and PipelineAbortError round-trip classifies correctly', () => {
    // TC-157-03: raw Error mixed with typed error still produces valid classification
    const abortError = new PipelineAbortError('Critical abort from quality gate');
    const rawError = new Error('Something unexpected went wrong');

    // Classify PipelineAbortError through throw → catch → classify
    const abortClassified = classifyThrownError(abortError);
    expect(abortClassified.type).toBe('QUALITY_GATE_FAILED');
    expect(abortClassified.stage).toBe('abort');
    expect(abortClassified.severity).toBe('high');
    expect(abortClassified.recoverable).toBe(true);

    // Classify raw Error through throw → catch → classify (fallback to pattern matching)
    const rawClassified = classifyThrownError(rawError);
    expect(rawClassified.type).toBeDefined();
    expect(rawClassified.originalError).toBe(rawError);
    // Raw Error gets pattern-based or UNKNOWN classification
    expect(typeof rawClassified.type).toBe('string');
    expect(rawClassified.severity).toBeDefined();
    expect(rawClassified.recoverable).toBeDefined();

    // Verify independent classification — typed error is not affected by raw Error
    expect(abortClassified.type).toBe('QUALITY_GATE_FAILED');
  });

  it('all typed error classes produce non-UNKNOWN classification', () => {
    const errors = [
      new TranscriptionError('Transcription failed'),
      new SegmentationError('Segmentation failed'),
      new RenderingError('Rendering failed'),
      new QualityGateError('test-gate', 'Failed'),
      new PipelineConfigError('param', 'Invalid config'),
      new PipelineAbortError('Pipeline aborted'),
    ];

    for (const error of errors) {
      const classified = classifier.classify(error);
      // None should be classified as UNKNOWN since all carry explicit errorType
      expect(classified.type).not.toBe('UNKNOWN');
      expect(classified.severity).toBeDefined();
      expect(classified.recoverable).toBeDefined();
      expect(classified.suggestedAction).toBeDefined();
    }
  });
});
