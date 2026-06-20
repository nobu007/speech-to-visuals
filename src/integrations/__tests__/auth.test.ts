import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '@/api/middleware/auth';

// ---------------------------------------------------------------------------
// 1) Auth functions tests (signIn / signOut / signUp / onAuthStateChange)
// ---------------------------------------------------------------------------

const mockSignInWithPassword = jest.fn() as jest.Mock;
const mockSignUp = jest.fn() as jest.Mock;
const mockSignOut = jest.fn() as jest.Mock;
const mockOnAuthStateChange = jest.fn() as jest.Mock;

jest.unstable_mockModule('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
  resetSupabaseClient: jest.fn(),
}));

// Dynamic import after mock setup
const { signIn, signUp, signOut, onAuthStateChange } = await import('@/integrations/supabase/auth');

describe('Auth functions', () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockSignUp.mockReset();
    mockSignOut.mockReset();
    mockOnAuthStateChange.mockReset();
  });

  describe('signIn', () => {
    it('should call signInWithPassword and return auth state', async () => {
      const fakeUser = { id: 'user-1', email: 'test@example.com' };
      const fakeSession = { access_token: 'token-123' };
      mockSignInWithPassword.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await signIn({ email: 'test@example.com', password: 'password123' });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual({
        user: fakeUser,
        session: fakeSession,
        loading: false,
      });
    });

    it('should throw when signInWithPassword returns an error', async () => {
      const authError = new Error('Invalid login credentials');
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      await expect(
        signIn({ email: 'bad@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid login credentials');
    });
  });

  describe('signUp', () => {
    it('should call signUp and return auth state', async () => {
      const fakeUser = { id: 'user-2', email: 'new@example.com' };
      const fakeSession = { access_token: 'token-456' };
      mockSignUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await signUp({ email: 'new@example.com', password: 'password123' });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
      expect(result).toEqual({
        user: fakeUser,
        session: fakeSession,
        loading: false,
      });
    });

    it('should throw when signUp returns an error', async () => {
      const authError = new Error('User already registered');
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      await expect(
        signUp({ email: 'existing@example.com', password: 'password123' })
      ).rejects.toThrow('User already registered');
    });
  });

  describe('signOut', () => {
    it('should call signOut successfully', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await expect(signOut()).resolves.toBeUndefined();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should throw when signOut returns an error', async () => {
      const authError = new Error('Session not found');
      mockSignOut.mockResolvedValue({ error: authError });

      await expect(signOut()).rejects.toThrow('Session not found');
    });
  });

  describe('onAuthStateChange', () => {
    it('should register an auth state change listener', () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });

      const callback = jest.fn();
      const result = onAuthStateChange(callback);

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(callback);
      expect(result.data.subscription).toBe(mockSubscription);
    });
  });
});

// ---------------------------------------------------------------------------
// 2) Auth middleware tests (authMiddleware)
// ---------------------------------------------------------------------------

const { authMiddleware } = await import('@/api/middleware/auth');

describe('authMiddleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  function createMockReqResNext(overrides: { headers?: Record<string, string> } = {}) {
    const req = {
      headers: overrides.headers || {},
    } as unknown as AuthenticatedRequest;

    const resJson = jest.fn();
    const resStatus = jest.fn().mockReturnValue({ json: resJson });
    const res: { status: typeof resStatus; json: typeof resJson } = {
      status: resStatus,
      json: resJson,
    };

    const next = jest.fn();

    return { req, res, resStatus, resJson, next };
  }

  it('should call next() when a valid JWT token is provided', () => {
    const token = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'authenticated' },
      'test-secret',
      { algorithm: 'HS256' }
    );

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'authenticated',
    });
  });

  it('should return 401 when no authorization header is provided', () => {
    const { req, res, resStatus, resJson, next } = createMockReqResNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    const { req, res, resStatus, resJson, next } = createMockReqResNext({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
  });

  it('should return 401 when JWT token is invalid (not verifiable)', () => {
    const { req, res, resStatus, resJson, next } = createMockReqResNext({
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: { code: 'TOKEN_ERROR', message: 'Failed to process JWT token' },
    });
  });

  it('should return 401 when JWT token has no sub claim', () => {
    const token = jwt.sign({ email: 'test@example.com' }, 'test-secret', {
      algorithm: 'HS256',
    });

    const { req, res, resStatus, resJson, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid JWT token' },
    });
  });

  it('should default role to "authenticated" when role claim is missing', () => {
    const token = jwt.sign(
      { sub: 'user-456', email: 'no-role@example.com' },
      'test-secret',
      { algorithm: 'HS256' }
    );

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'user-456',
      email: 'no-role@example.com',
      role: 'authenticated',
    });
  });

  it('should default email to empty string when email claim is missing', () => {
    const token = jwt.sign(
      { sub: 'user-789', role: 'admin' },
      'test-secret',
      { algorithm: 'HS256' }
    );

    const { req, res, next } = createMockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'user-789',
      email: '',
      role: 'admin',
    });
  });
});
