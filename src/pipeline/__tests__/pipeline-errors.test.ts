import {
  PipelineError,
  TranscriptionError,
  SegmentationError,
  RenderingError,
  QualityGateError,
  PipelineConfigError,
} from '../pipeline-errors';

describe('PipelineError classes', () => {
  describe('PipelineError (base)', () => {
    it('carries errorType and stage', () => {
      const err = new PipelineError('test', 'LLM_API_ERROR', 'transcription');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PipelineError);
      expect(err.message).toBe('test');
      expect(err.errorType).toBe('LLM_API_ERROR');
      expect(err.stage).toBe('transcription');
      expect(err.name).toBe('PipelineError');
    });

    it('carries optional context', () => {
      const err = new PipelineError('msg', 'UNKNOWN', 'pipeline', { key: 'val' });
      expect(err.context).toEqual({ key: 'val' });
    });
  });

  describe('TranscriptionError', () => {
    it('maps to LLM_API_ERROR and transcription stage', () => {
      const err = new TranscriptionError('Transcription failed');
      expect(err).toBeInstanceOf(PipelineError);
      expect(err).toBeInstanceOf(TranscriptionError);
      expect(err.errorType).toBe('LLM_API_ERROR');
      expect(err.stage).toBe('transcription');
      expect(err.message).toBe('Transcription failed');
      expect(err.name).toBe('TranscriptionError');
    });
  });

  describe('SegmentationError', () => {
    it('maps to QUALITY_GATE_FAILED and segmentation stage', () => {
      const err = new SegmentationError('Scene segmentation failed');
      expect(err).toBeInstanceOf(PipelineError);
      expect(err).toBeInstanceOf(SegmentationError);
      expect(err.errorType).toBe('QUALITY_GATE_FAILED');
      expect(err.stage).toBe('segmentation');
      expect(err.name).toBe('SegmentationError');
    });
  });

  describe('RenderingError', () => {
    it('maps to RENDERING_ERROR and rendering stage', () => {
      const err = new RenderingError('No scenes to render');
      expect(err).toBeInstanceOf(PipelineError);
      expect(err).toBeInstanceOf(RenderingError);
      expect(err.errorType).toBe('RENDERING_ERROR');
      expect(err.stage).toBe('rendering');
      expect(err.name).toBe('RenderingError');
    });
  });

  describe('QualityGateError', () => {
    it('carries gate name and reason', () => {
      const err = new QualityGateError('layout-quality', 'score below threshold');
      expect(err).toBeInstanceOf(PipelineError);
      expect(err).toBeInstanceOf(QualityGateError);
      expect(err.errorType).toBe('QUALITY_GATE_FAILED');
      expect(err.gateName).toBe('layout-quality');
      expect(err.reason).toBe('score below threshold');
      expect(err.message).toBe('Quality gate "layout-quality" failed: score below threshold');
      expect(err.name).toBe('QualityGateError');
    });
  });

  describe('PipelineConfigError', () => {
    it('carries parameter name', () => {
      const err = new PipelineConfigError('fps', 'fps must be positive');
      expect(err).toBeInstanceOf(PipelineError);
      expect(err).toBeInstanceOf(PipelineConfigError);
      expect(err.errorType).toBe('FILE_FORMAT_INVALID');
      expect(err.parameter).toBe('fps');
      expect(err.message).toBe('fps must be positive');
      expect(err.name).toBe('PipelineConfigError');
    });
  });
});
