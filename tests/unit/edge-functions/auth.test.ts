import {
  extractToken,
  validateToken,
  authenticateRequest,
  AuthResult,
} from '../../../supabase/functions/_shared/auth';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function mockRequest(authHeader: string | null) {
  return {
    headers: {
      get: (name: string): string | null => {
        if (name === 'Authorization') return authHeader;
        return null;
      },
    },
  };
}

function mockSupabaseClient(getUserResult: {
  data: { user: { id: string; email?: string } | null };
  error: { message: string } | null;
}) {
  return {
    auth: {
      getUser: async (_jwt: string) => getUserResult,
    },
  };
}

// ─── extractToken Tests ──────────────────────────────────────────────────────

describe('extractToken', () => {
  it('should extract token from Bearer header', () => {
    const req = mockRequest('Bearer my-jwt-token');
    expect(extractToken(req)).toBe('my-jwt-token');
  });

  it('should return null when no Authorization header', () => {
    const req = mockRequest(null);
    expect(extractToken(req)).toBeNull();
  });

  it('should handle token without Bearer prefix', () => {
    const req = mockRequest('raw-jwt-token');
    expect(extractToken(req)).toBe('raw-jwt-token');
  });

  it('should handle Bearer with extra whitespace', () => {
    const req = mockRequest('Bearer   spaced-token  ');
    expect(extractToken(req)).toBe('spaced-token');
  });

  it('should return null for empty string header', () => {
    const req = mockRequest('');
    expect(extractToken(req)).toBeNull();
  });

  it('should handle Bearer with empty token after trimming', () => {
    const req = mockRequest('Bearer   ');
    expect(extractToken(req)).toBeNull();
  });
});

// ─── validateToken Tests ─────────────────────────────────────────────────────

describe('validateToken', () => {
  it('should return userId on valid token', async () => {
    const client = mockSupabaseClient({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    const result = await validateToken('valid-token', client);
    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('test@example.com');
  });

  it('should throw AUTH_MISSING_TOKEN for empty token', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: null,
    });

    await expect(validateToken('', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_MISSING_TOKEN',
        status: 401,
      })
    );
  });

  it('should throw AUTH_MISSING_TOKEN for whitespace-only token', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: null,
    });

    await expect(validateToken('   ', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_MISSING_TOKEN',
      })
    );
  });

  it('should throw AUTH_TOKEN_EXPIRED for expired token', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: { message: 'JWT expired' },
    });

    await expect(validateToken('expired-token', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_TOKEN_EXPIRED',
        status: 401,
      })
    );
  });

  it('should throw AUTH_INVALID_TOKEN for invalid JWT', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: { message: 'invalid JWT signature' },
    });

    await expect(validateToken('bad-token', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_INVALID_TOKEN',
        status: 401,
      })
    );
  });

  it('should throw AUTH_USER_NOT_FOUND when user is null without error', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: null,
    });

    await expect(validateToken('valid-but-no-user', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_USER_NOT_FOUND',
        status: 401,
      })
    );
  });

  it('should throw AUTH_ERROR for generic auth errors', async () => {
    const client = mockSupabaseClient({
      data: { user: null },
      error: { message: 'something unexpected went wrong' },
    });

    await expect(validateToken('some-token', client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_ERROR',
        status: 401,
      })
    );
  });
});

// ─── authenticateRequest Tests ───────────────────────────────────────────────

describe('authenticateRequest', () => {
  it('should authenticate a valid request', async () => {
    const req = mockRequest('Bearer valid-token');
    const client = mockSupabaseClient({
      data: { user: { id: 'user-456' } },
      error: null,
    });

    const result = await authenticateRequest(req, client);
    expect(result.userId).toBe('user-456');
  });

  it('should throw AUTH_MISSING_HEADER when no auth header', async () => {
    const req = mockRequest(null);
    const client = mockSupabaseClient({
      data: { user: null },
      error: null,
    });

    await expect(authenticateRequest(req, client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_MISSING_HEADER',
        status: 401,
      })
    );
  });

  it('should propagate token validation errors', async () => {
    const req = mockRequest('Bearer expired-token');
    const client = mockSupabaseClient({
      data: { user: null },
      error: { message: 'JWT expired' },
    });

    await expect(authenticateRequest(req, client)).rejects.toEqual(
      expect.objectContaining({
        code: 'AUTH_TOKEN_EXPIRED',
      })
    );
  });
});
