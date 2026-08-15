/**
 * Round 26 single-source guard: JWT secret resolution chain.
 *
 * Before this module the env fallback chain resolving the JWT signing secret
 * was hand-rolled in THREE production sites with TWO shapes:
 *
 *   - src/api/middleware/auth.ts (REST authMiddleware) and
 *     src/api/websocket-handler.ts (WS auth) each carried a byte-identical
 *     private `getJwtSecret()` (chain + throw PipelineConfigError);
 *   - src/config/validate.ts re-typed the same chain for its production
 *     security check.
 *
 * All three guard the SAME tokens: if any one site's chain drifted (a
 * reordered fallback, an added env name), REST and WS would verify with
 * DIFFERENT secrets — a token accepted by one path would 401 on the other
 * while validateSecurityEnv kept blessing the deployment. Classic
 * invariant-split on a security chokepoint.
 *
 * This file pins (a) the canonical chain semantics against the historic
 * inline chain replicated here as the oracle (env-combo truth table +
 * falsy-empty-string edge, zero delta), (b) `requireJwtSecret`'s throw
 * contract (same error class / field / message both middlewares always
 * threw), (c) cross-path behavioral identity — a token minted with the
 * canonical secret verifies through BOTH real middlewares — and (d) source
 * anchors that all three migrated sites delegate to the canonical module.
 * The discovery sweep ("no src file re-types the chain or redeclares a local
 * resolver") lives in tests/guards/frozen-literal-rules.ts, rule
 * 'jwt secret resolution single-sourced in api/jwt-secret (round 26)'.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import { getJwtSecretFromEnv, requireJwtSecret } from '@/api/jwt-secret';
import { authMiddleware } from '@/api/middleware/auth';
import { createWsAuthMiddleware } from '@/api/websocket-handler';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '@/api/middleware/auth';

// ---------------------------------------------------------------------------
// Env fixture: both vars saved/restored around every test
// ---------------------------------------------------------------------------

const ENV_KEYS = ['JWT_SECRET', 'SUPABASE_JWT_SECRET'] as const;
const savedEnv: Record<string, string | undefined> = {};

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>): void {
  for (const key of ENV_KEYS) {
    if (key in overrides) process.env[key] = overrides[key];
    else delete process.env[key];
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// (a) Chain semantics vs the historic inline chain (zero-delta oracle)
// ---------------------------------------------------------------------------

/** The pre-round-26 inline chain, replicated verbatim as the oracle. */
function historicInlineChain(): string | undefined {
  return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || undefined;
}

describe('jwt-secret canonical chain (round 26)', () => {
  it.each([
    ['both set → JWT_SECRET wins', { JWT_SECRET: 'primary', SUPABASE_JWT_SECRET: 'fallback' }, 'primary'],
    ['only JWT_SECRET', { JWT_SECRET: 'primary' }, 'primary'],
    ['only SUPABASE_JWT_SECRET', { SUPABASE_JWT_SECRET: 'fallback' }, 'fallback'],
    ['neither set → undefined', {}, undefined],
    ['JWT_SECRET empty string is falsy → falls through', { JWT_SECRET: '', SUPABASE_JWT_SECRET: 'fallback' }, 'fallback'],
  ])('value pin: %s', (_name, env, expected) => {
    setEnv(env);
    expect(getJwtSecretFromEnv()).toBe(expected);
    // Zero delta vs the chain the three sites used to inline.
    expect(getJwtSecretFromEnv()).toBe(historicInlineChain());
  });

  it('fuzz: random values per combo stay identical to the historic chain', () => {
    // Deterministic pseudo-random strings (no Math.random — stable oracle).
    for (let i = 0; i < 25; i++) {
      const primary = `jwt-${i}-secret`;
      const fallback = `supabase-${i}-secret`;
      const combos: Array<Partial<Record<(typeof ENV_KEYS)[number], string>>> = [
        { JWT_SECRET: primary, SUPABASE_JWT_SECRET: fallback },
        { JWT_SECRET: primary },
        { SUPABASE_JWT_SECRET: fallback },
        {},
      ];
      for (const env of combos) {
        setEnv(env);
        expect(getJwtSecretFromEnv()).toBe(historicInlineChain());
      }
    }
  });

  it('requireJwtSecret returns exactly what the chain resolves when set', () => {
    setEnv({ SUPABASE_JWT_SECRET: 'fallback-only' });
    expect(requireJwtSecret()).toBe('fallback-only');
  });

  it('requireJwtSecret throws the canonical PipelineConfigError when unset', () => {
    setEnv({});
    expect(() => requireJwtSecret()).toThrow(PipelineConfigError);
    try {
      requireJwtSecret();
    } catch (err) {
      // Same parameter + message both middlewares historically threw —
      // identical failure on both paths is the contract the canonical module
      // freezes.
      expect(err).toBeInstanceOf(PipelineConfigError);
      const e = err as PipelineConfigError;
      expect({ parameter: e.parameter, message: e.message }).toEqual({
        parameter: 'jwtSecret',
        message: 'JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required',
      });
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Cross-path identity: one secret verifies on BOTH real middlewares
// ---------------------------------------------------------------------------

describe('REST and WS auth resolve the SAME secret (round 26 drift oracle)', () => {
  it('a token minted via requireJwtSecret authenticates through both middlewares', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    const token = jwt.sign({ sub: 'user-1', email: 'u@example.com', role: 'authenticated' }, requireJwtSecret());

    // REST path (real authMiddleware).
    const restReq = {
      headers: { authorization: `Bearer ${token}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const restNext = jest.fn();
    authMiddleware(restReq, restRes as never, restNext);
    expect(restReq.user).toEqual({ id: 'user-1', email: 'u@example.com', role: 'authenticated' });
    expect(restNext).toHaveBeenCalledTimes(1);

    // WS path (real createWsAuthMiddleware).
    const socket = { handshake: { auth: { token } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(socket as never, wsNext);
    expect(socket.data.user).toEqual({ id: 'user-1', email: 'u@example.com', role: 'authenticated' });
    expect(wsNext).toHaveBeenCalledWith();
  });

  it('a token signed with a DIFFERENT secret is rejected by both middlewares', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    const forged = jwt.sign({ sub: 'attacker' }, 'not-the-deployment-secret');

    const restReq = {
      headers: { authorization: `Bearer ${forged}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authMiddleware(restReq, restRes as never, jest.fn());
    expect(restReq.user).toBeUndefined();
    expect(restRes.status).toHaveBeenCalledWith(401);

    const socket = { handshake: { auth: { token: forged } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(socket as never, wsNext);
    expect(socket.data.user).toBeUndefined();
    expect(wsNext).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ---------------------------------------------------------------------------
// (c) Source anchors: every migrated site delegates, none re-freezes
// ---------------------------------------------------------------------------

describe('jwt-secret source anchors (round 26)', () => {
  it('REST middleware imports requireJwtSecret and calls it at the verify site', () => {
    const src = readSource('src/api/middleware/auth.ts');
    expect(src).toMatch(/import\s*\{[^}]*requireJwtSecret[^}]*\}\s*from\s*'..\/jwt-secret'/);
    expect(src).toMatch(/jwt\.verify\(\s*token,\s*requireJwtSecret\(\)\s*\)/);
    // The pre-round-26 local resolver must not come back.
    expect(src).not.toMatch(/function\s+getJwtSecret\s*\(/);
    expect(src).not.toMatch(/JWT_SECRET\s*\|\|\s*process\.env\.SUPABASE_JWT_SECRET/);
  });

  it('WS middleware imports requireJwtSecret and calls it at the verify site', () => {
    const src = readSource('src/api/websocket-handler.ts');
    expect(src).toMatch(/import\s*\{[^}]*requireJwtSecret[^}]*\}\s*from\s*'\.\/jwt-secret'/);
    expect(src).toMatch(/jwt\.verify\(\s*token,\s*requireJwtSecret\(\)\s*\)/);
    expect(src).not.toMatch(/function\s+getJwtSecret\s*\(/);
    expect(src).not.toMatch(/JWT_SECRET\s*\|\|\s*process\.env\.SUPABASE_JWT_SECRET/);
  });

  it('config validator resolves through the canonical chain, not a re-typed copy', () => {
    const src = readSource('src/config/validate.ts');
    expect(src).toMatch(/import\s*\{[^}]*getJwtSecretFromEnv[^}]*\}\s*from\s*'..\/api\/jwt-secret'/);
    expect(src).toMatch(/getJwtSecretFromEnv\(\)/);
    expect(src).not.toMatch(/JWT_SECRET\s*\|\|\s*process\.env\.SUPABASE_JWT_SECRET/);
  });
});
