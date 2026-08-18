/**
 * Structured HTTP request/response logging middleware.
 *
 * Logs every API request with method, path, status code, response duration,
 * and correlation ID. Uses the project logger at appropriate levels:
 *   - info  for 2xx / 3xx
 *   - warn  for 4xx
 *   - error for 5xx
 *
 * Health check endpoints are skipped to reduce log noise.
 */

import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '@stv/core/utils/logger';

const HEADER_NAME = 'x-request-id';

/** Paths whose exact match should be excluded from logging. */
const SKIP_PATHS = new Set([
  '/api/v1/health',
  '/health',
  '/api/v1/monitoring/health',
]);

/**
 * Express middleware that logs structured request/response information.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip health endpoints to reduce noise
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }

  const start = Date.now();
  const requestId = (req.headers[HEADER_NAME] as string | undefined) ?? '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method } = req;
    const { path } = req;
    const { statusCode } = res;

    const message = `${method} ${path} ${statusCode} ${duration}ms rid=${requestId}`;

    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
}
