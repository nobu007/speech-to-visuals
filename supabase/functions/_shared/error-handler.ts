/**
 * Shared Error Handler Module for Supabase Edge Functions
 *
 * Provides unified error response formatting, CORS header management,
 * timeout handling with AbortController, and error classification.
 */

// ─── CORS Headers ────────────────────────────────────────────────────────────

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Merge CORS headers into a headers object.
 */
export function withCors(headers: Record<string, string> = {}): Record<string, string> {
  return { ...CORS_HEADERS, ...headers };
}

/**
 * Create a JSON response with CORS headers.
 */
export function corsResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): {
  body: string;
  status: number;
  headers: Record<string, string>;
} {
  return {
    body: JSON.stringify(body),
    status,
    headers: withCors({ 'Content-Type': 'application/json', ...extraHeaders }),
  };
}

/**
 * Create an OPTIONS preflight response.
 */
export function optionsResponse(): { body: null; status: 204; headers: Record<string, string> } {
  return {
    body: null,
    status: 204,
    headers: CORS_HEADERS,
  };
}

// ─── Error Classification ────────────────────────────────────────────────────

export type ErrorCode =
  | 'AUTH_MISSING_HEADER'
  | 'AUTH_MISSING_TOKEN'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_API_ERROR';

export interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

/**
 * Classify an error and return a standardized error response.
 */
export function classifyError(err: unknown): { response: ErrorResponse; status: number } {
  // AuthError from _shared/auth.ts
  if (isAuthError(err)) {
    return {
      response: {
        error: err.error,
        code: err.code,
      },
      status: err.status,
    };
  }

  // TimeoutError (built-in or AbortError)
  if (isTimeoutError(err)) {
    return {
      response: {
        error: 'Request timed out',
        code: 'TIMEOUT_ERROR',
        details: err instanceof Error ? err.message : undefined,
      },
      status: 504,
    };
  }

  // Validation errors (thrown with a specific pattern)
  if (isValidationError(err)) {
    return {
      response: {
        error: err instanceof Error ? err.message : 'Validation error',
        code: 'VALIDATION_ERROR',
      },
      status: 400,
    };
  }

  // Generic Error
  if (err instanceof Error) {
    // Check for external API errors by convention
    if (err.message.includes('Failed to') || err.message.includes('API')) {
      return {
        response: {
          error: err.message,
          code: 'EXTERNAL_API_ERROR',
        },
        status: 502,
      };
    }

    return {
      response: {
        error: err.message,
        code: 'INTERNAL_ERROR',
      },
      status: 500,
    };
  }

  // Unknown error
  return {
    response: {
      error: 'An unknown error occurred',
      code: 'INTERNAL_ERROR',
    },
    status: 500,
  };
}

/**
 * Create an error response with CORS headers.
 */
export function errorResponse(err: unknown): { body: string; status: number; headers: Record<string, string> } {
  const classified = classifyError(err);
  return corsResponse(classified.response, classified.status);
}

// ─── Timeout Handling ────────────────────────────────────────────────────────

export interface TimeoutController {
  signal: AbortSignal;
  clear(): void;
}

/**
 * Create an AbortController that fires after a specified timeout.
 * Returns both the signal and a clear function to cancel the timeout.
 */
export function createTimeout(ms: number): TimeoutController {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${ms}ms`));
  }, ms);

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    },
  };
}

/**
 * Wrap a fetch call with a timeout signal.
 * Throws a timeout error if the fetch does not complete within the specified duration.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  timeoutMs?: number
): Promise<Response> {
  const ms = timeoutMs ?? (options.timeout ?? 30000);
  const { signal, clear } = createTimeout(ms);

  try {
    // Combine external signal with our timeout signal
    const combinedSignal = options.signal
      ? combineAbortSignals(options.signal, signal)
      : signal;

    // Race between the actual fetch and the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      const onAbort = () => {
        reject(new Error(`Request timed out after ${ms}ms`));
      };
      if (combinedSignal.aborted) {
        onAbort();
      } else {
        combinedSignal.addEventListener('abort', onAbort, { once: true });
      }
    });

    const response = await Promise.race([
      fetch(url, { ...options, signal: combinedSignal }),
      timeoutPromise,
    ]);
    return response;
  } finally {
    clear();
  }
}

/**
 * Combine two AbortSignals: aborts if either fires.
 */
export function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => {
    controller.abort(a.aborted ? a.reason : b.reason);
  };

  if (a.aborted || b.aborted) {
    onAbort();
    return controller.signal;
  }

  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });

  return controller.signal;
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

interface AuthErrorLike {
  error: string;
  code: string;
  status: number;
}

function isAuthError(err: unknown): err is AuthErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    'code' in err &&
    'status' in err &&
    typeof (err as AuthErrorLike).error === 'string' &&
    typeof (err as AuthErrorLike).code === 'string' &&
    typeof (err as AuthErrorLike).status === 'number'
  );
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const message = err.message.toLowerCase();
    return (
      name === 'timeouterror' ||
      name === 'aborterror' ||
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('aborted')
    );
  }
  return false;
}

function isValidationError(err: unknown): boolean {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    return (
      message.includes('is required') ||
      message.includes('must be') ||
      message.includes('invalid ') ||
      message.includes('missing ') ||
      message.includes('expected ') ||
      message.includes('validation')
    );
  }
  return false;
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate that a JSON body contains the specified required fields.
 * Throws a validation error if any field is missing.
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw new Error(`${field} is required`);
    }
  }
}
