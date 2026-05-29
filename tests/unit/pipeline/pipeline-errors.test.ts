/**
 * Tests for pipeline-errors.ts custom error classes.
 *
 * Verifies that each error class sets the correct name, message,
 * errorType, and stage — so the ErrorClassifier can triage them
 * without relying on regex matching.
 */

import {
  PipelineError,
  TranscriptionError,
  SegmentationError,
  RenderingError,
  QualityGateError,
  PipelineConfigError,
  PipelineAbortError,
} from '@/pipeline/pipeline-errors';

// ---------- PipelineError (base) ----------

describe('PipelineError', () => {
  it('sets name, errorType, and stage', () => {
    const err = new PipelineError('test', 'UNKNOWN', 'general');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('PipelineError');
    expect(err.message).toBe('test');
    expect(err.errorType).toBe('UNKNOWN');
    expect(err.stage).toBe('general');
    expect(err.context).toBeUndefined();
  });

  it('carries optional context', () => {
    const err = new PipelineError('msg', 'UNKNOWN', 's', { key: 'val' });
    expect(err.context).toEqual({ key: 'val' });
  });
});

// ---------- Existing error classes ----------

describe('TranscriptionError', () => {
  it('maps to LLM_API_ERROR in transcription stage', () => {
    const err = new TranscriptionError('whisper failed');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('TranscriptionError');
    expect(err.errorType).toBe('LLM_API_ERROR');
    expect(err.stage).toBe('transcription');
  });
});

describe('SegmentationError', () => {
  it('maps to QUALITY_GATE_FAILED in segmentation stage', () => {
    const err = new SegmentationError('no segments');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('SegmentationError');
    expect(err.errorType).toBe('QUALITY_GATE_FAILED');
    expect(err.stage).toBe('segmentation');
  });
});

describe('RenderingError', () => {
  it('maps to RENDERING_ERROR in rendering stage', () => {
    const err = new RenderingError('no scenes');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('RenderingError');
    expect(err.errorType).toBe('RENDERING_ERROR');
    expect(err.stage).toBe('rendering');
  });

  it('carries structured context for missing entry point', () => {
    const err = new RenderingError('Remotion entry point not found: /src/remotion/index.ts', {
      entryPoint: '/src/remotion/index.ts',
      projectRoot: '/home/user/project',
    });
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.context).toEqual({
      entryPoint: '/src/remotion/index.ts',
      projectRoot: '/home/user/project',
    });
  });
});

describe('QualityGateError', () => {
  it('exposes gateName and reason', () => {
    const err = new QualityGateError('gate1', 'too low');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('QualityGateError');
    expect(err.gateName).toBe('gate1');
    expect(err.reason).toBe('too low');
    expect(err.errorType).toBe('QUALITY_GATE_FAILED');
    expect(err.stage).toBe('quality_gate');
    expect(err.context).toEqual(expect.objectContaining({ gateName: 'gate1', reason: 'too low' }));
  });
});

describe('PipelineConfigError', () => {
  it('exposes parameter name', () => {
    const err = new PipelineConfigError('fps', 'must be positive');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.name).toBe('PipelineConfigError');
    expect(err.parameter).toBe('fps');
    expect(err.errorType).toBe('FILE_FORMAT_INVALID');
    expect(err.stage).toBe('configuration');
  });
});

// ---------- PipelineAbortError (NEW) ----------

describe('PipelineAbortError', () => {
  it('maps to QUALITY_GATE_FAILED in abort stage', () => {
    const err = new PipelineAbortError('critical degradation');
    expect(err).toBeInstanceOf(PipelineError);
    expect(err).toBeInstanceOf(PipelineAbortError);
    expect(err.name).toBe('PipelineAbortError');
    expect(err.message).toBe('critical degradation');
    expect(err.errorType).toBe('QUALITY_GATE_FAILED');
    expect(err.stage).toBe('abort');
  });

  it('carries optional context', () => {
    const err = new PipelineAbortError('degraded', { abortReason: 'too many retries' });
    expect(err.context).toEqual({ abortReason: 'too many retries' });
  });

  it('is distinguishable from QualityGateError', () => {
    const abort = new PipelineAbortError('abort');
    const gate = new QualityGateError('g', 'r');
    expect(abort.name).not.toBe(gate.name);
    expect(abort).toBeInstanceOf(PipelineAbortError);
    expect(gate).not.toBeInstanceOf(PipelineAbortError);
  });
});
