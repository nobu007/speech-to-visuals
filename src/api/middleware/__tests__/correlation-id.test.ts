import type { Request, Response, NextFunction } from 'express';
import { correlationId } from '../correlation-id';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; sentHeaders: Record<string, string> } {
  const sentHeaders: Record<string, string> = {};
  const res = {
    statusCode: 200,
    sentHeaders,
    setHeader: jest.fn((name: string, value: string) => {
      sentHeaders[name] = value;
    }),
    once: jest.fn(),
  };
  return res as unknown as Response & { statusCode: number; sentHeaders: Record<string, string> };
}

describe('correlationId middleware', () => {
  it('generates a UUID when no X-Request-ID header is present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(next).toHaveBeenCalled();
    const setHeaderCalls = (res.setHeader as jest.Mock).mock.calls;
    expect(setHeaderCalls.length).toBeGreaterThan(0);
    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toBeDefined();
    // UUID format: 8-4-4-4-12 hex chars
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('uses incoming X-Request-ID when provided', () => {
    const req = mockReq({ 'x-request-id': 'my-correlation-id' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(res.sentHeaders['X-Request-ID']).toBe('my-correlation-id');
    expect(req.headers['x-request-id']).toBe('my-correlation-id');
  });

  it('rejects empty X-Request-ID and generates new UUID', () => {
    const req = mockReq({ 'x-request-id': '' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('rejects X-Request-ID longer than 128 chars and generates new UUID', () => {
    const longId = 'a'.repeat(129);
    const req = mockReq({ 'x-request-id': longId });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).not.toBe(longId);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('accepts X-Request-ID of exactly 128 chars', () => {
    const exactId = 'a'.repeat(128);
    const req = mockReq({ 'x-request-id': exactId });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(res.sentHeaders['X-Request-ID']).toBe(exactId);
  });

  it('stores correlation ID on request headers for downstream access', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(req.headers['x-request-id']).toBe(res.sentHeaders['X-Request-ID']);
  });
});
