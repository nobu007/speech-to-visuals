/**
 * Typed pipeline error classes for structured error handling.
 *
 * Each error carries an ErrorType from the classifier system so that
 * the ErrorClassifier can immediately determine severity, recoverability,
 * and user-friendly messages without relying on fragile regex matching.
 */

import type { ErrorType } from '@/quality/error-classifier';

/**
 * Base class for all pipeline errors.
 * Carries structured metadata for classification, logging, and recovery.
 */
export class PipelineError extends Error {
  public readonly errorType: ErrorType;
  public readonly stage: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    errorType: ErrorType,
    stage: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PipelineError';
    this.errorType = errorType;
    this.stage = stage;
    this.context = context;
  }
}

/**
 * Thrown when audio transcription fails or produces no usable segments.
 * Maps to LLM_API_ERROR (Whisper/Gemini service failure).
 */
export class TranscriptionError extends PipelineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_API_ERROR', 'transcription', context);
    this.name = 'TranscriptionError';
  }
}

/**
 * Thrown when content segmentation produces no segments.
 * Maps to QUALITY_GATE_FAILED (analysis quality threshold).
 */
export class SegmentationError extends PipelineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'QUALITY_GATE_FAILED', 'segmentation', context);
    this.name = 'SegmentationError';
  }
}

/**
 * Thrown when the rendering stage cannot produce output.
 * Maps to RENDERING_ERROR.
 */
export class RenderingError extends PipelineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'RENDERING_ERROR', 'rendering', context);
    this.name = 'RenderingError';
  }
}

/**
 * Thrown when a quality gate validation fails.
 * Maps to QUALITY_GATE_FAILED.
 */
export class QualityGateError extends PipelineError {
  public readonly gateName: string;
  public readonly reason: string;

  constructor(gateName: string, reason: string, context?: Record<string, unknown>) {
    super(
      `Quality gate "${gateName}" failed: ${reason}`,
      'QUALITY_GATE_FAILED',
      'quality_gate',
      { gateName, reason, ...context },
    );
    this.name = 'QualityGateError';
    this.gateName = gateName;
    this.reason = reason;
  }
}

/**
 * Thrown when pipeline configuration is invalid.
 * Maps to FILE_FORMAT_INVALID (input/configuration validation).
 */
export class PipelineConfigError extends PipelineError {
  public readonly parameter: string;

  constructor(parameter: string, message: string, context?: Record<string, unknown>) {
    super(message, 'FILE_FORMAT_INVALID', 'configuration', { parameter, ...context });
    this.name = 'PipelineConfigError';
    this.parameter = parameter;
  }
}

/**
 * Thrown when the pipeline is intentionally aborted because the
 * multi-layer error recovery orchestrator detected critical
 * degradation (too many accumulated errors to continue safely).
 * Maps to QUALITY_GATE_FAILED (system-level quality decision).
 */
export class PipelineAbortError extends PipelineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'QUALITY_GATE_FAILED', 'abort', context);
    this.name = 'PipelineAbortError';
  }
}

/**
 * Thrown when an export operation fails (unsupported format, encoding error).
 * Maps to RENDERING_ERROR (export is part of the rendering pipeline).
 */
export class ExportError extends PipelineError {
  public readonly format: string;

  constructor(message: string, format: string, context?: Record<string, unknown>) {
    super(message, 'RENDERING_ERROR', 'export', { format, ...context });
    this.name = 'ExportError';
    this.format = format;
  }
}

/**
 * Thrown when binary encoding (APNG, GIF, etc.) encounters invalid data.
 * Maps to RENDERING_ERROR.
 */
export class EncodingError extends PipelineError {
  public readonly encoder: string;

  constructor(message: string, encoder: string, context?: Record<string, unknown>) {
    super(message, 'RENDERING_ERROR', 'encoding', { encoder, ...context });
    this.name = 'EncodingError';
    this.encoder = encoder;
  }
}

/**
 * Thrown when an export configuration or preset is invalid.
 * Maps to FILE_FORMAT_INVALID.
 */
export class FormatValidationError extends PipelineError {
  public readonly format: string;

  constructor(message: string, format: string, context?: Record<string, unknown>) {
    super(message, 'FILE_FORMAT_INVALID', 'export_validation', { format, ...context });
    this.name = 'FormatValidationError';
    this.format = format;
  }
}
