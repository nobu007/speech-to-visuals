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

// Local type for socket with user data
interface TestSocket {
  handshake: { auth: { token: string } };
  data: { user?: { id: string; email: string; role: string } };
}

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
    const socket: TestSocket = { handshake: { auth: { token } }, data: {} };
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

    const socket: TestSocket = { handshake: { auth: { token: forged } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(socket as never, wsNext);
    expect(socket.data.user).toBeUndefined();
    expect(wsNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('a token WITHOUT a sub claim is rejected by both middlewares (claim-requirement parity)', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    // Same-secret verification is not enough when the two paths disagree on
    // REQUIRED claims: auth.ts 401s a verified sub-less token (`!decoded.sub`
    // → INVALID_TOKEN) while the WS middleware used to authenticate it as
    // `id: ''` — one socket, full tier, for a token every REST route rejects.
    const subless = jwt.sign({ email: 'u@example.com' }, requireJwtSecret());

    const restReq = {
      headers: { authorization: `Bearer ${subless}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authMiddleware(restReq, restRes as never, jest.fn());
    expect(restReq.user).toBeUndefined();
    expect(restRes.status).toHaveBeenCalledWith(401);

    const wsSocket: TestSocket = { handshake: { auth: { token: subless } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(wsSocket as never, wsNext);
    expect(wsSocket.data.user).toBeUndefined();
    expect(wsNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('a token with an EMPTY-STRING role claim yields the IDENTICAL user object on both middlewares (falsy-role parity)', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    // Sibling of the falsy-sub boundary, on the ACCEPT path: REQ-405 unified
    // the role default on 'authenticated' and the WS source comment still
    // promises "the two user objects must not disagree" — but the operators
    // had forked (`||` in auth.ts, `??` in websocket-handler.ts), so a
    // signed `role: ''` token authenticated as role 'authenticated' on REST
    // while the socket kept the EMPTY string: the eradicated `''` spelling
    // surviving at the falsy boundary. No legitimate falsy role exists
    // (same reasoning as falsy-sub), so both paths default it.
    const emptyRole = jwt.sign({ sub: 'user-1', email: 'u@example.com', role: '' }, requireJwtSecret());

    const restReq = {
      headers: { authorization: `Bearer ${emptyRole}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const restNext = jest.fn();
    authMiddleware(restReq, restRes as never, restNext);
    expect(restNext).toHaveBeenCalledTimes(1);

    const wsSocket: TestSocket = { handshake: { auth: { token: emptyRole } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(wsSocket as never, wsNext);
    expect(wsNext).toHaveBeenCalledWith();

    expect(restReq.user).toEqual({ id: 'user-1', email: 'u@example.com', role: 'authenticated' });
    expect(wsSocket.data.user).toEqual(restReq.user);
  });

  it('a token with a NON-STRING falsy email claim yields the IDENTICAL user object on both middlewares (falsy-email parity)', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    // Sibling of the falsy-role leg, on the LAST forked field: the operators
    // had forked on email too (`||` in auth.ts, `??` in websocket-handler.ts).
    // The empty-STRING email is operator-insensitive (both spellings fall
    // back to ''), so the divergence lives at NON-string falsy claims — a
    // JWT payload is arbitrary JSON and the `as` cast validates nothing, so
    // a buggy or hostile issuer can mint `email: 0`. REST defaulted that to
    // '' while the socket kept the NUMBER 0: a non-string value inside a
    // field typed `email: string`, and the two user objects disagreed for
    // the SAME verified token.
    const numericEmail = jwt.sign({ sub: 'user-1', email: 0 }, requireJwtSecret());

    const restReq = {
      headers: { authorization: `Bearer ${numericEmail}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const restNext = jest.fn();
    authMiddleware(restReq, restRes as never, restNext);
    expect(restNext).toHaveBeenCalledTimes(1);

    const wsSocket: TestSocket = { handshake: { auth: { token: numericEmail } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(wsSocket as never, wsNext);
    expect(wsNext).toHaveBeenCalledWith();

    expect(restReq.user).toEqual({ id: 'user-1', email: '', role: 'authenticated' });
    expect(wsSocket.data.user).toEqual(restReq.user);
  });

  it('a token with an EMPTY-STRING sub claim is rejected by both middlewares (falsy-sub boundary)', () => {
    setEnv({ JWT_SECRET: 'round-26-cross-path-secret' });
    // `!decoded.sub` is a truthiness check and that is deliberate: unlike the
    // falsy-guard-on-legit-0 bug class, there is NO legitimate falsy sub. An
    // empty-string subject is an anonymous identity — the exact value the WS
    // path used to authenticate as `id: ''`. A "claim is present" refactor
    // (`decoded.sub === undefined`) would pass this token on both paths;
    // this leg is what makes that refactor loud.
    const emptySub = jwt.sign({ sub: '', email: 'u@example.com' }, requireJwtSecret());

    const restReq = {
      headers: { authorization: `Bearer ${emptySub}` },
      user: undefined,
    } as unknown as AuthenticatedRequest;
    const restRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authMiddleware(restReq, restRes as never, jest.fn());
    expect(restReq.user).toBeUndefined();
    expect(restRes.status).toHaveBeenCalledWith(401);

    const wsSocket: TestSocket = { handshake: { auth: { token: emptySub } }, data: {} };
    const wsNext = jest.fn();
    createWsAuthMiddleware()(wsSocket as never, wsNext);
    expect(wsSocket.data.user).toBeUndefined();
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

  it('both verify sites require a sub claim (claim-requirement parity anchor)', () => {
    // Value + operator in one def: the `!decoded.sub` guard must survive in
    // BOTH files, or the behavioral leg above is the only thing standing
    // between a silent re-widening and the parity contract.
    const rest = readSource('src/api/middleware/auth.ts');
    const ws = readSource('src/api/websocket-handler.ts');
    expect(rest).toMatch(/!decoded\s*\|\|\s*!decoded\.sub/);
    expect(ws).toMatch(/!decoded\s*\|\|\s*!decoded\.sub/);
  });

  it('security-env validator resolves through the canonical chain, not a re-typed copy', () => {
    // Moved from config/validate.ts to api/security-env.ts with the core
    // extraction (config layer must stay free of API dependencies).
    const src = readSource('src/api/security-env.ts');
    expect(src).toMatch(/import\s*\{[^}]*getJwtSecretFromEnv[^}]*\}\s*from\s*'\.\/jwt-secret'/);
    expect(src).toMatch(/getJwtSecretFromEnv\(\)/);
    expect(src).not.toMatch(/JWT_SECRET\s*\|\|\s*process\.env\.SUPABASE_JWT_SECRET/);
  });
});
