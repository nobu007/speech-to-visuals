/**
 * REQ-205: HTTP Request Metrics Middleware
 *
 * Collects per-request metrics and feeds them into HttpMetricsCollector.
 * Should be placed early in the middleware chain (after correlation-id).
 *
 * Health check endpoints are excluded from metrics collection.
 */

import { type Request, type Response, type NextFunction } from 'express';
import { httpMetricsCollector } from '../../monitoring/http-metrics-collector';

/** Paths whose exact match should be excluded from metrics. */
const SKIP_PATHS = new Set([
  '/api/v1/health',
  '/health',
  '/api/v1/monitoring/health',
]);

const CORRELATION_HEADER = 'x-request-id';

/**
 * Express middleware that records HTTP request metrics.
 */
export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }

  httpMetricsCollector.startRequest();
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const correlationId = (req.headers[CORRELATION_HEADER] as string | undefined) ?? '-';
    httpMetricsCollector.recordRequest(
      req.method,
      req.path,
      res.statusCode,
      durationMs,
      correlationId,
    );
  });

  next();
}
