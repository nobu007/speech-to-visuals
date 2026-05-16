import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../auth';

// jsonwebtoken is mocked via tests/__mocks__/jsonwebtoken.ts
// We configure the mock per-test below.
import * as jwtMock from 'jsonwebtoken';

function createMockRequest(overrides: Partial<{ authorization: string }> = {}): Partial<AuthenticatedRequest> {
  return {
    headers: {
      authorization: overrides.authorization,
    },
  } as Partial<AuthenticatedRequest>;
}

function createMockResponse(): { status: ReturnType<typeof jest.fn>; json: ReturnType<typeof jest.fn> } & Partial<Response> {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as { status: ReturnType<typeof jest.fn>; json: ReturnType<typeof jest.fn> } & Partial<Response>;
}

function createMockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

describe('authMiddleware', () => {
  let res: ReturnType<typeof createMockResponse>;
  let next: NextFunction;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockResponse();
    next = createMockNext();
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret-that-is-long-enough-32ch' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // --- Missing / malformed Authorization header ---

  it('should return 401 when Authorization header is missing', () => {
    const req = createMockRequest();
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    const req = createMockRequest({ authorization: 'Basic dXNlcjpwYXNz' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is empty Bearer', () => {
    const req = createMockRequest({ authorization: 'Bearer ' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    // Empty token — jwt.verify mock will throw (default behavior is no implementation)
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // --- Valid token handling ---

  it('should call next() and populate req.user for a valid token with all fields', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    });

    const req = createMockRequest({ authorization: 'Bearer valid.jwt.token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as AuthenticatedRequest).user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should use default role "authenticated" when token has no role', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      sub: 'user-456',
      email: 'norole@example.com',
    });

    const req = createMockRequest({ authorization: 'Bearer valid.jwt.token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as AuthenticatedRequest).user).toEqual({
      id: 'user-456',
      email: 'norole@example.com',
      role: 'authenticated',
    });
  });

  it('should use empty string email when token has no email', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      sub: 'user-789',
    });

    const req = createMockRequest({ authorization: 'Bearer valid.jwt.token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as AuthenticatedRequest).user).toEqual({
      id: 'user-789',
      email: '',
      role: 'authenticated',
    });
  });

  // --- Invalid token handling ---

  it('should return 401 with TOKEN_ERROR when jwt.verify throws', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const req = createMockRequest({ authorization: 'Bearer not-a-real-token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'TOKEN_ERROR', message: 'Failed to process JWT token' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 with INVALID_TOKEN when decoded token has no sub', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      email: 'nosub@example.com',
    });

    const req = createMockRequest({ authorization: 'Bearer token-without-sub' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid JWT token' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // --- Environment variable handling ---

  it('should return 401 when JWT_SECRET and SUPABASE_JWT_SECRET are both unset', () => {
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;

    const req = createMockRequest({ authorization: 'Bearer sometoken' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    // getJwtSecret() throws inside the try block, caught by catch → 401
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should fall back to SUPABASE_JWT_SECRET when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    process.env.SUPABASE_JWT_SECRET = 'supabase-secret-that-is-long-enough-32';

    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      sub: 'user-sup',
      email: 'sup@example.com',
    });

    const req = createMockRequest({ authorization: 'Bearer sup-token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as AuthenticatedRequest).user?.id).toBe('user-sup');
  });

  // --- AuthenticatedRequest type verification ---

  it('should populate user with id, email, and role string properties', () => {
    (jwtMock.verify as ReturnType<typeof jest.fn>).mockReturnValue({
      sub: 'type-check',
      email: 'type@test.com',
      role: 'editor',
    });

    const req = createMockRequest({ authorization: 'Bearer typed-token' });
    authMiddleware(req as AuthenticatedRequest, res as Response, next);

    const user = (req as AuthenticatedRequest).user!;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.role).toBe('string');
  });
});
