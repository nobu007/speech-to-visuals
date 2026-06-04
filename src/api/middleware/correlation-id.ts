import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const HEADER_NAME = 'x-request-id';
const MAX_ID_LENGTH = 128;

/**
 * REQ-200: Correlation ID middleware
 * Extracts or generates a request correlation ID (X-Request-ID)
 * and propagates it to downstream handlers and the response.
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER_NAME];
  let id: string;

  if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= MAX_ID_LENGTH) {
    id = incoming;
  } else {
    id = randomUUID();
  }

  // Store on request for downstream access
  req.headers[HEADER_NAME] = id;

  // Expose in response
  res.setHeader('X-Request-ID', id);

  next();
}
