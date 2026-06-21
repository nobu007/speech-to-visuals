import type { Request, Response } from 'express';
import { requestTimeout } from '../timeout';

function mockRes(): Response & {
  _status: number;
  _body: unknown;
  _headersSent: boolean;
  _listeners: Record<string, (() => void)[]>;
} {
  const internal = {
    _status: 200,
    _body: null as unknown,
    _headersSent: false,
    _listeners: {} as Record<string, (() => void)[]>,
  };
  const res = {
    get statusCode() { return internal._status; },
    set statusCode(v: number) { internal._status = v; },
    get headersSent() { return internal._headersSent; },
    set headersSent(v: boolean) { internal._headersSent = v; },
    status: jest.fn(function (this: typeof res, code: number) {
      internal._status = code;
      internal._headersSent = true;
      return this;
    }),
    json: jest.fn(function (this: typeof res, body: unknown) {
      internal._body = body;
      return this;
    }),
    once: jest.fn((event: string, cb: () => void) => {
      if (!internal._listeners[event]) internal._listeners[event] = [];
      internal._listeners[event].push(cb);
    }),
  };
  return res as unknown as Response & typeof internal;
}

describe('requestTimeout middleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls next() immediately', () => {
    const middleware = requestTimeout(5000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sends 504 when timeout fires', () => {
    const middleware = requestTimeout(1000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);
    jest.advanceTimersByTime(1001);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'REQUEST_TIMEOUT',
          message: expect.stringContaining('1000ms'),
        }),
      }),
    );
  });

  it('does not send 504 if headers already sent', () => {
    const middleware = requestTimeout(1000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);
    // Simulate response already sent
    res.headersSent = true;
    jest.advanceTimersByTime(1001);

    expect(res.status).not.toHaveBeenCalled();
  });

  it('clears timer on finish event', () => {
    const middleware = requestTimeout(5000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    // Trigger finish event (simulates normal response completion)
    const finishListeners = (res.once as jest.Mock).mock.calls
      .filter(([event]: [string]) => event === 'finish')
      .map(([, cb]: [string, () => void]) => cb);
    expect(finishListeners.length).toBe(1);
    finishListeners[0]();

    // Timer should be cleared - advancing time should not trigger 504
    jest.advanceTimersByTime(5001);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('clears timer on close event', () => {
    const middleware = requestTimeout(5000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    // Trigger close event
    const closeListeners = (res.once as jest.Mock).mock.calls
      .filter(([event]: [string]) => event === 'close')
      .map(([, cb]: [string, () => void]) => cb);
    expect(closeListeners.length).toBe(1);
    closeListeners[0]();

    jest.advanceTimersByTime(5001);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('registers both finish and close listeners', () => {
    const middleware = requestTimeout(5000);
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    const calls = (res.once as jest.Mock).mock.calls;
    const events = calls.map(([event]: [string]) => event);
    expect(events).toContain('finish');
    expect(events).toContain('close');
  });
});
