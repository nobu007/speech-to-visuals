import { Request, Response, NextFunction } from 'express';
import { logger } from '@stv/core/utils/logger';
import { PipelineError } from '../../pipeline/pipeline-errors';
import { pipelineErrorGuidance, type PipelineErrorGuidance } from '../../quality/pipeline-error-guidance';
import type { ErrorType } from '../../quality/error-classifier';
import { safeArray } from '@stv/core/lib/safe-array';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTHENTICATION_ERROR', message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later');
    this.name = 'RateLimitError';
  }
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface PipelineErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    classifiedType: ErrorType;
    recoverable: boolean;
    suggestedAction: string;
    severity: string;
    stage: string;
    strategies?: string[];
    preventionTips?: string[];
  };
}

/** Map PipelineError errorType to an appropriate HTTP status code. */
const ERROR_TYPE_HTTP_STATUS: Record<ErrorType, number> = {
  FILE_FORMAT_INVALID: 400,
  FILE_SIZE_EXCEEDED: 413,
  LLM_API_ERROR: 502,
  LLM_RATE_LIMITED: 429,
  LLM_TIMEOUT: 504,
  RENDERING_ERROR: 500,
  RENDERING_OOM: 500,
  NETWORK_ERROR: 502,
  STORAGE_ERROR: 500,
  QUALITY_GATE_FAILED: 422,
  UNKNOWN: 500,
};

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // PipelineError: use PipelineErrorGuidanceBridge for rich, actionable responses
  if (err instanceof PipelineError) {
    const guidance: PipelineErrorGuidance = pipelineErrorGuidance.provideGuidance(err, err.context);
    const statusCode = ERROR_TYPE_HTTP_STATUS[err.errorType] ?? 500;

    logger.warn(`[PipelineError] ${err.errorType} at stage "${err.stage}": ${err.message}`);

    const response: PipelineErrorResponse = {
      success: false,
      error: {
        code: `PIPELINE_${err.errorType}`,
        message: guidance.userMessage,
        classifiedType: guidance.classifiedType,
        recoverable: guidance.recoverable,
        suggestedAction: guidance.suggestedAction,
        severity: guidance.severity,
        stage: err.stage,
        strategies: safeArray(guidance.recoveryStrategies).map((s) => s.description),
        preventionTips: guidance.preventionTips,
      },
    };
    res.status(statusCode).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details !== undefined) {
      response.error.details = err.details;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown errors
  logger.error('Unhandled error:', err);
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(response);
}
