/**
 * Request timeout middleware.
 *
 * Enforces a maximum duration for each HTTP request. When the timeout
 * fires before the handler finishes, a 504 Gateway Timeout is sent with
 * a structured error payload. Timers are cleaned up automatically when
 * the response completes normally.
 */

import { RequestHandler, Response } from 'express';

export interface TimeoutOptions {
  /** Timeout duration in milliseconds. */
  timeoutMs: number;
}

/**
 * Creates an Express middleware that aborts requests exceeding the
 * configured duration with a 504 Gateway Timeout response.
 */
export function requestTimeout(timeoutMs: number): RequestHandler {
  return (_req, res: Response, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request exceeded timeout of ${timeoutMs}ms`,
          },
        });
      }
    }, timeoutMs);

    const clear = () => clearTimeout(timer);
    res.once('finish', clear);
    res.once('close', clear);

    next();
  };
}
