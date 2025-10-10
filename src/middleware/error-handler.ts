/**
 * Error Handling Middleware
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import { Request, Response, NextFunction } from 'express';
import { APIError } from '../types/api';

/**
 * Custom API Error class
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found (404) handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error: APIError = {
    code: 'RESOURCE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json({
    success: false,
    error,
  });
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error for debugging
  console.error('API Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    const error: APIError = {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
      timestamp: new Date().toISOString(),
    };

    res.status(err.statusCode).json({
      success: false,
      error,
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    const error: APIError = {
      code: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      statusCode: 400,
      details: err.message,
      timestamp: new Date().toISOString(),
    };

    res.status(400).json({
      success: false,
      error,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const error: APIError = {
      code: 'AUTH_INVALID_TOKEN',
      message: err.message,
      statusCode: 401,
      timestamp: new Date().toISOString(),
    };

    res.status(401).json({
      success: false,
      error,
    });
    return;
  }

  // Handle unknown errors
  const error: APIError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    statusCode: 500,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  res.status(500).json({
    success: false,
    error,
  });
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
