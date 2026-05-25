/**
 * Typed analysis error classes for structured error handling.
 *
 * Mirrors the pipeline-errors.ts pattern so the ErrorClassifier can
 * immediately categorise analysis failures without regex matching.
 */

import type { ErrorType } from '@/quality/error-classifier';

/**
 * Base class for all analysis errors.
 * Carries structured metadata for classification, logging, and recovery.
 */
export class AnalysisError extends Error {
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
    this.name = 'AnalysisError';
    this.errorType = errorType;
    this.stage = stage;
    this.context = context;
  }
}

/**
 * Thrown when JSON extraction from LLM text fails.
 * Covers null/undefined input, wrong type, empty input, and parse failures.
 */
export class LLMParsingError extends AnalysisError {
  public readonly preview?: string;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FILE_FORMAT_INVALID', 'json_parsing', context);
    this.name = 'LLMParsingError';
    if (context?.preview && typeof context.preview === 'string') {
      this.preview = context.preview;
    }
  }
}

/**
 * Thrown when the LLM returns an empty or unusable response.
 */
export class LLMResponseError extends AnalysisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_API_ERROR', 'llm_response', context);
    this.name = 'LLMResponseError';
  }
}

/**
 * Thrown when diagram data structure from LLM is invalid.
 */
export class DiagramStructureError extends AnalysisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FILE_FORMAT_INVALID', 'diagram_validation', context);
    this.name = 'DiagramStructureError';
  }
}

/**
 * Thrown when a language detection dependency is not initialised.
 */
export class AnalyzerInitError extends AnalysisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_API_ERROR', 'analyzer_init', context);
    this.name = 'AnalyzerInitError';
  }
}
