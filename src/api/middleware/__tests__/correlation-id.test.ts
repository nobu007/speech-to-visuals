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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    expect(id).toMatch(UUID_RE);
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
    expect(id).toMatch(UUID_RE);
  });

  it('rejects X-Request-ID longer than 128 chars and generates new UUID', () => {
    const longId = 'a'.repeat(129);
    const req = mockReq({ 'x-request-id': longId });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).not.toBe(longId);
    expect(id).toMatch(UUID_RE);
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

  // ---- Security: CRLF / header injection prevention ----

  it('rejects CRLF injection in X-Request-ID (\r\n)', () => {
    const req = mockReq({ 'x-request-id': 'abc\r\nX-Injected: evil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
    expect(id).not.toContain('\r');
    expect(id).not.toContain('\n');
  });

  it('rejects LF-only injection in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\nSet-Cookie: evil=1' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
    expect(id).not.toContain('\n');
  });

  it('rejects CR-only injection in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\rSet-Cookie: evil=1' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
    expect(id).not.toContain('\r');
  });

  it('rejects null byte in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\x00evil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
    expect(id).not.toContain('\x00');
  });

  it('rejects tab character in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\tevil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
  });

  it('rejects backspace control character in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\x08evil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
  });

  it('rejects DEL (0x7F) character in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\x7Fevil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
  });

  it('rejects raw unicode line separator in X-Request-ID', () => {
    const req = mockReq({ 'x-request-id': 'abc\u2028evil' });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    const id = res.sentHeaders['X-Request-ID'];
    expect(id).toMatch(UUID_RE);
  });

  it('accepts valid printable ASCII characters', () => {
    const validId = 'req-1234_abcd!@#5678';
    const req = mockReq({ 'x-request-id': validId });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(res.sentHeaders['X-Request-ID']).toBe(validId);
  });

  it('accepts UUID format from upstream proxy', () => {
    const upstreamUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = mockReq({ 'x-request-id': upstreamUuid });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(res.sentHeaders['X-Request-ID']).toBe(upstreamUuid);
  });

  it('accepts hex-only correlation ID', () => {
    const hexId = 'abcdef0123456789';
    const req = mockReq({ 'x-request-id': hexId });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    correlationId(req, res, next);

    expect(res.sentHeaders['X-Request-ID']).toBe(hexId);
  });
});
