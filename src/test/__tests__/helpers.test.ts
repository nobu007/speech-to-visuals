/**
 * Tests for src/test/helpers.ts
 */

import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createTestEnv,
  suppressConsole,
  waitMs,
} from '../helpers';

// ---------------------------------------------------------------------------
// createMockRequest
// ---------------------------------------------------------------------------
describe('createMockRequest', () => {
  test('returns an object with default body, params, query, headers', () => {
    const req = createMockRequest();
    expect(req.body).toEqual({});
    expect(req.params).toEqual({});
    expect(req.query).toEqual({});
    expect(req.headers).toEqual({});
  });

  test('applies overrides on top of defaults', () => {
    const req = createMockRequest({
      body: { message: 'hello' },
      params: { id: '42' },
    });
    expect(req.body).toEqual({ message: 'hello' });
    expect(req.params).toEqual({ id: '42' });
    // defaults still present for non-overridden fields
    expect(req.query).toEqual({});
    expect(req.headers).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// createMockResponse
// ---------------------------------------------------------------------------
describe('createMockResponse', () => {
  test('status is a jest fn that returns this for chaining', () => {
    const res = createMockResponse();
    expect(res.status).toBeDefined();
    expect(typeof res.status).toBe('function');
    const result = res.status!(400);
    expect(result).toBe(res);
  });

  test('json is a jest fn that returns this for chaining', () => {
    const res = createMockResponse();
    expect(res.json).toBeDefined();
    const result = res.json!({ ok: true });
    expect(result).toBe(res);
  });

  test('send is a jest fn that returns this for chaining', () => {
    const res = createMockResponse();
    expect(res.send).toBeDefined();
    const result = res.send!('body');
    expect(result).toBe(res);
  });

  test('setHeader is a jest fn that returns this for chaining', () => {
    const res = createMockResponse();
    expect(res.setHeader).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setHeaderFn = res.setHeader as unknown as (...args: unknown[]) => unknown;
    const result = setHeaderFn('Content-Type', 'application/json');
    expect(result).toBe(res);
  });
});

// ---------------------------------------------------------------------------
// createMockNext
// ---------------------------------------------------------------------------
describe('createMockNext', () => {
  test('returns a jest fn', () => {
    const next = createMockNext();
    expect(typeof next).toBe('function');
    next();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// waitMs
// ---------------------------------------------------------------------------
describe('waitMs', () => {
  test('resolves after the specified delay', async () => {
    const start = Date.now();
    await waitMs(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow minor timer drift
  });
});

// ---------------------------------------------------------------------------
// createTestEnv
// ---------------------------------------------------------------------------
describe('createTestEnv', () => {
  test('sets env vars and restore returns them to original state', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const restore = createTestEnv({ MY_TEST_VAR: '123' });

    expect(process.env.MY_TEST_VAR).toBe('123');

    restore();

    expect(process.env.MY_TEST_VAR).toBeUndefined();
    // NODE_ENV should be unchanged after restore
    expect(process.env.NODE_ENV).toBe(originalNodeEnv);
  });
});

// ---------------------------------------------------------------------------
// suppressConsole
// ---------------------------------------------------------------------------
describe('suppressConsole', () => {
  test('replaces console methods with jest fns and restores them', () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const restore = suppressConsole();

    expect(console.log).not.toBe(originalLog);
    expect(console.warn).not.toBe(originalWarn);
    expect(console.error).not.toBe(originalError);

    // calling console.log should not throw (it's a jest fn)
    console.log('suppressed');
    expect(console.log).toHaveBeenCalledWith('suppressed');

    restore();

    expect(console.log).toBe(originalLog);
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
  });
});
