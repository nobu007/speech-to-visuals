/**
 * Shared Auth Module for Supabase Edge Functions
 *
 * Provides JWT extraction and validation for edge function authentication.
 * Designed to be testable in both Deno (edge functions) and Jest environments.
 *
 * In Deno: uses the Supabase client via createClient
 * In tests: inject a mock supabaseClient
 */

export interface AuthResult {
  userId: string;
  email?: string;
}

export interface AuthError {
  error: string;
  code: string;
  status: number;
}

export interface SupabaseAuthClient {
  auth: {
    getUser(jwt: string): Promise<{ data: { user: { id: string; email?: string } | null }; error: { message: string } | null }>;
  };
}

/**
 * Extract JWT token from request Authorization header.
 * Supports "Bearer <token>" format.
 */
export function extractToken(request: { headers: { get(name: string): string | null } }): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }

  // If no Bearer prefix, treat the whole value as token
  return authHeader.trim() || null;
}

/**
 * Validate a JWT token using the Supabase auth client.
 * Returns user info on success, or throws an error object on failure.
 */
export async function validateToken(
  token: string,
  supabaseClient: SupabaseAuthClient
): Promise<AuthResult> {
  if (!token || token.trim().length === 0) {
    throw {
      error: 'Missing or empty token',
      code: 'AUTH_MISSING_TOKEN',
      status: 401,
    } satisfies AuthError;
  }

  const { data, error } = await supabaseClient.auth.getUser(token);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('expired') || message.includes('jwt expired')) {
      throw {
        error: 'Token has expired',
        code: 'AUTH_TOKEN_EXPIRED',
        status: 401,
      } satisfies AuthError;
    }
    if (message.includes('invalid') || message.includes('jwt')) {
      throw {
        error: 'Invalid token',
        code: 'AUTH_INVALID_TOKEN',
        status: 401,
      } satisfies AuthError;
    }
    throw {
      error: error.message,
      code: 'AUTH_ERROR',
      status: 401,
    } satisfies AuthError;
  }

  if (!data.user) {
    throw {
      error: 'User not found',
      code: 'AUTH_USER_NOT_FOUND',
      status: 401,
    } satisfies AuthError;
  }

  return {
    userId: data.user.id,
    email: data.user.email,
  };
}

/**
 * Authenticate a request: extract and validate the JWT.
 * Convenience function combining extractToken and validateToken.
 */
export async function authenticateRequest(
  request: { headers: { get(name: string): string | null } },
  supabaseClient: SupabaseAuthClient
): Promise<AuthResult> {
  const token = extractToken(request);
  if (!token) {
    throw {
      error: 'Missing authorization header',
      code: 'AUTH_MISSING_HEADER',
      status: 401,
    } satisfies AuthError;
  }
  return validateToken(token, supabaseClient);
}
