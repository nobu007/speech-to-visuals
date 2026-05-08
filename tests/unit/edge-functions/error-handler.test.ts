import {
  CORS_HEADERS,
  withCors,
  corsResponse,
  optionsResponse,
  classifyError,
  errorResponse,
  validateRequired,
  createTimeout,
} from '../../../supabase/functions/_shared/error-handler';

// ─── CORS Headers Tests ──────────────────────────────────────────────────────

describe('CORS_HEADERS', () => {
  it('should have Access-Control-Allow-Origin set to *', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should include authorization in allowed headers', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('authorization');
  });
});

describe('withCors', () => {
  it('should merge CORS headers with additional headers', () => {
    const result = withCors({ 'Content-Type': 'application/json' });
    expect(result['Access-Control-Allow-Origin']).toBe('*');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('should return CORS headers when no additional headers', () => {
    const result = withCors();
    expect(result).toEqual(CORS_HEADERS);
  });
});

describe('corsResponse', () => {
  it('should create a JSON response with CORS headers', () => {
    const result = corsResponse({ message: 'ok' });
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.body).toBe(JSON.stringify({ message: 'ok' }));
  });

  it('should accept custom status code', () => {
    const result = corsResponse({ error: 'bad' }, 400);
    expect(result.status).toBe(400);
  });

  it('should merge extra headers', () => {
    const result = corsResponse({}, 200, { 'X-Custom': 'value' });
    expect(result.headers['X-Custom']).toBe('value');
  });
});

describe('optionsResponse', () => {
  it('should return 204 with CORS headers', () => {
    const result = optionsResponse();
    expect(result.status).toBe(204);
    expect(result.body).toBeNull();
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

// ─── Error Classification Tests ──────────────────────────────────────────────

describe('classifyError', () => {
  it('should classify auth errors', () => {
    const authErr = { error: 'Missing header', code: 'AUTH_MISSING_HEADER', status: 401 };
    const { response, status } = classifyError(authErr);
    expect(status).toBe(401);
    expect(response.code).toBe('AUTH_MISSING_HEADER');
    expect(response.error).toBe('Missing header');
  });

  it('should classify timeout errors (AbortError)', () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    const { response, status } = classifyError(abortErr);
    expect(status).toBe(504);
    expect(response.code).toBe('TIMEOUT_ERROR');
  });

  it('should classify timeout errors (message with "timed out")', () => {
    const timeoutErr = new Error('Request timed out after 30000ms');
    const { response, status } = classifyError(timeoutErr);
    expect(status).toBe(504);
    expect(response.code).toBe('TIMEOUT_ERROR');
  });

  it('should classify validation errors ("is required")', () => {
    const valErr = new Error('audioUrl is required');
    const { response, status } = classifyError(valErr);
    expect(status).toBe(400);
    expect(response.code).toBe('VALIDATION_ERROR');
  });

  it('should classify validation errors ("must be")', () => {
    const valErr = new Error('quality must be one of low, medium, high');
    const { response, status } = classifyError(valErr);
    expect(status).toBe(400);
    expect(response.code).toBe('VALIDATION_ERROR');
  });

  it('should classify external API errors', () => {
    const apiErr = new Error('Failed to download audio file');
    const { response, status } = classifyError(apiErr);
    expect(status).toBe(502);
    expect(response.code).toBe('EXTERNAL_API_ERROR');
  });

  it('should classify generic errors as INTERNAL_ERROR', () => {
    const genErr = new Error('Something went wrong');
    const { response, status } = classifyError(genErr);
    expect(status).toBe(500);
    expect(response.code).toBe('INTERNAL_ERROR');
  });

  it('should classify unknown errors as INTERNAL_ERROR', () => {
    const { response, status } = classifyError('string error');
    expect(status).toBe(500);
    expect(response.code).toBe('INTERNAL_ERROR');
    expect(response.error).toBe('An unknown error occurred');
  });

  it('should classify null as INTERNAL_ERROR', () => {
    const { response, status } = classifyError(null);
    expect(status).toBe(500);
    expect(response.code).toBe('INTERNAL_ERROR');
  });

  it('should include details for timeout errors', () => {
    const err = new Error('Request timed out after 5000ms');
    const { response } = classifyError(err);
    expect(response.details).toBe('Request timed out after 5000ms');
  });
});

// ─── errorResponse Tests ─────────────────────────────────────────────────────

describe('errorResponse', () => {
  it('should return a response with CORS headers', () => {
    const result = errorResponse(new Error('test error'));
    expect(result.status).toBe(500);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(result.body);
    expect(body.error).toBe('test error');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('should return 401 for auth errors', () => {
    const authErr = { error: 'Invalid token', code: 'AUTH_INVALID_TOKEN', status: 401 };
    const result = errorResponse(authErr);
    expect(result.status).toBe(401);
  });
});

// ─── validateRequired Tests ──────────────────────────────────────────────────

describe('validateRequired', () => {
  it('should not throw when all fields are present', () => {
    expect(() => validateRequired({ a: 1, b: 'hello' }, ['a', 'b'])).not.toThrow();
  });

  it('should throw when a field is undefined', () => {
    expect(() => validateRequired({ a: 1 }, ['a', 'b'])).toThrow('b is required');
  });

  it('should throw when a field is null', () => {
    expect(() => validateRequired({ a: null }, ['a'])).toThrow('a is required');
  });

  it('should throw when a field is empty string', () => {
    expect(() => validateRequired({ a: '' }, ['a'])).toThrow('a is required');
  });

  it('should throw for the first missing field', () => {
    expect(() => validateRequired({}, ['x', 'y'])).toThrow('x is required');
  });

  it('should not throw for falsy but present values like 0 or false', () => {
    expect(() => validateRequired({ n: 0, b: false }, ['n', 'b'])).not.toThrow();
  });
});

// ─── createTimeout Tests ─────────────────────────────────────────────────────

describe('createTimeout', () => {
  it('should return an AbortSignal and clear function', () => {
    const { signal, clear } = createTimeout(5000);
    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);
    expect(typeof clear).toBe('function');
    clear();
  });

  it('should abort after the specified timeout', async () => {
    jest.useFakeTimers();
    const { signal } = createTimeout(100);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(150);
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });

  it('should not abort after clear is called', async () => {
    jest.useFakeTimers();
    const { signal, clear } = createTimeout(100);
    clear();
    jest.advanceTimersByTime(150);
    expect(signal.aborted).toBe(false);
    jest.useRealTimers();
  });
});
