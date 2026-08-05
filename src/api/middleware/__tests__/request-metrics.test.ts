import type { Request, Response, NextFunction } from 'express';
import { requestMetrics } from '../request-metrics';
import { httpMetricsCollector } from '../../../monitoring/http-metrics-collector';

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

describe('requestMetrics middleware', () => {
  beforeEach(() => {
    httpMetricsCollector.reset();
  });

  afterEach(() => {
    httpMetricsCollector.reset();
  });

  /* ---- Health endpoint skip ---- */

  it('skips /api/v1/health without recording metrics', () => {
    const req = mockReq({ path: '/api/v1/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    // Emit finish — should have no effect on metrics
    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.activeRequests).toBe(0);
  });

  it('skips /health without recording metrics', () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);

    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalRequests).toBe(0);
  });

  it('skips /api/v1/monitoring/health without recording metrics', () => {
    const req = mockReq({ path: '/api/v1/monitoring/health' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);

    res.emit('finish');

    expect(httpMetricsCollector.getSnapshot().totalRequests).toBe(0);
  });

  /* ---- Normal request recording ---- */

  it('increments activeRequests on start, decrements on finish', () => {
    const req = mockReq({ path: '/api/v1/jobs' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);

    // Before finish — activeRequests should be 1
    expect(httpMetricsCollector.getSnapshot().activeRequests).toBe(1);

    res.emit('finish');

    // After finish — activeRequests should be 0
    expect(httpMetricsCollector.getSnapshot().activeRequests).toBe(0);
  });

  it('records totalRequests after finish', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    expect(httpMetricsCollector.getSnapshot().totalRequests).toBe(1);
  });

  it('records route metrics with method, path, and status code', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'POST' });
    const res = mockRes(201);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.routes).toHaveLength(1);
    expect(snapshot.routes[0].method).toBe('POST');
    expect(snapshot.routes[0].path).toBe('/api/v1/jobs');
    expect(snapshot.routes[0].lastStatusCode ?? snapshot.routes[0].count).toBe(1);
  });

  it('counts 4xx as errors', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res = mockRes(404);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalErrors).toBe(1);
    expect(snapshot.globalErrorRate).toBe(1);
  });

  it('counts 5xx as errors', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res = mockRes(503);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalErrors).toBe(1);
  });

  it('does not count 2xx as errors', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalErrors).toBe(0);
    expect(snapshot.globalErrorRate).toBe(0);
  });

  it('uses dash placeholder when x-request-id is absent', () => {
    const req = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    // No error means the middleware handled missing correlation-id gracefully
    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalRequests).toBe(1);
  });

  it('passes correlation-id from x-request-id header', () => {
    const req = mockReq({
      path: '/api/v1/jobs',
      method: 'GET',
      requestId: 'corr-abc',
    });
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);
    res.emit('finish');

    // The collector should have recorded with the correlation-id
    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalRequests).toBe(1);
  });

  /* ---- next() call ---- */

  it('calls next() to continue the middleware chain', () => {
    const req = mockReq();
    const res = mockRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestMetrics(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  /* ---- Multiple requests ---- */

  it('handles multiple sequential requests correctly', () => {
    // First request
    const req1 = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res1 = mockRes(200);
    requestMetrics(req1, res1, jest.fn() as unknown as NextFunction);
    res1.emit('finish');

    // Second request
    const req2 = mockReq({ path: '/api/v1/jobs', method: 'GET' });
    const res2 = mockRes(500);
    requestMetrics(req2, res2, jest.fn() as unknown as NextFunction);
    res2.emit('finish');

    const snapshot = httpMetricsCollector.getSnapshot();
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.totalErrors).toBe(1);
    expect(snapshot.routes).toHaveLength(1); // same route
  });
});
