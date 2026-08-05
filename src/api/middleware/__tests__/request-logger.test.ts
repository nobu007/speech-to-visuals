import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../request-logger';
import { logger } from '../../../utils/logger';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface FinishableResponse extends Response {
  __handlers: Record<string, (() => void)[]>;
  statusCode: number;
}

function mockReq(
  opts: { path?: string; method?: string; requestId?: string } = {},
): Request {
  const { path = '/api/v1/render', method = 'GET', requestId } = opts;
  const headers: Record<string, string> = {};
  if (requestId !== undefined) headers['x-request-id'] = requestId;
  return { path, method, headers } as unknown as Request;
}

function mockRes(statusCode = 200): FinishableResponse {
  const handlers: Record<string, (() => void)[]> = {};
  const res = {
    statusCode,
    on(event: string, cb: () => void) {
      (handlers[event] ??= []).push(cb);
      return this;
    },
    emit(event: string) {
      (handlers[event] ?? []).forEach((cb) => cb());
    },
  };
  return res as unknown as FinishableResponse;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('requestLogger middleware', () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  /* ---- Health endpoint skip ---- */

  it('skips /api/v1/health without logging', () => {
    const req = mockReq({ path: '/api/v1/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    res.emit('finish');
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('skips /health without logging', () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    res.emit('finish');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('skips /api/v1/monitoring/health without logging', () => {
    const req = mockReq({ path: '/api/v1/monitoring/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    res.emit('finish');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  /* ---- Status-code based log levels ---- */

  it('logs at info level for 2xx responses', () => {
    const req = mockReq({ method: 'GET', path: '/api/v1/render' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs at info level for 3xx responses', () => {
    const req = mockReq({ method: 'GET', path: '/api/v1/render' });
    const res = mockRes(302);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('logs at warn level for 4xx responses', () => {
    const req = mockReq({ method: 'POST', path: '/api/v1/render' });
    const res = mockRes(404);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs at error level for 5xx responses', () => {
    const req = mockReq({ method: 'POST', path: '/api/v1/render' });
    const res = mockRes(500);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs at error level for 500 boundary (exactly 500)', () => {
    const req = mockReq({ method: 'GET', path: '/api/v1/jobs' });
    const res = mockRes(500);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('logs at warn level for 499 boundary (exactly 499)', () => {
    const req = mockReq({ method: 'GET', path: '/api/v1/jobs' });
    const res = mockRes(499);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  /* ---- Message content ---- */

  it('includes method, path, status, and requestId in the log message', () => {
    const req = mockReq({
      method: 'DELETE',
      path: '/api/v1/jobs/123',
      requestId: 'abc-123',
    });
    const res = mockRes(204);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    const msg = infoSpy.mock.calls[0][0] as string;
    expect(msg).toContain('DELETE');
    expect(msg).toContain('/api/v1/jobs/123');
    expect(msg).toContain('204');
    expect(msg).toContain('rid=abc-123');
  });

  it('uses dash placeholder when x-request-id header is absent', () => {
    const req = mockReq({ method: 'GET', path: '/api/v1/render' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    const msg = infoSpy.mock.calls[0][0] as string;
    expect(msg).toContain('rid=-');
  });

  /* ---- next() call ---- */

  it('calls next() to continue the middleware chain', () => {
    const req = mockReq();
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
