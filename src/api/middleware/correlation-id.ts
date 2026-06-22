import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const HEADER_NAME = 'x-request-id';
const MAX_ID_LENGTH = 128;

// Reject control characters (including CRLF) to prevent HTTP header injection
const SAFE_ID_PATTERN = /^[\x20-\x7E]+$/;

/**
 * Validate that a correlation ID contains only printable ASCII characters
 * and no CRLF sequences that could enable HTTP response splitting.
 */
function isValidCorrelationId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH &&
    SAFE_ID_PATTERN.test(id)
  );
}

/**
 * REQ-200: Correlation ID middleware
 * Extracts or generates a request correlation ID (X-Request-ID)
 * and propagates it to downstream handlers and the response.
 *
 * Security: Incoming IDs are validated against printable ASCII to prevent
 * CRLF injection / HTTP response splitting attacks.
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER_NAME];
  let id: string;

  if (typeof incoming === 'string' && isValidCorrelationId(incoming)) {
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
