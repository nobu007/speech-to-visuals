/**
 * Canonical resolution of the JWT signing secret — the SINGLE source of the
 * env fallback order every token check agrees on.
 *
 * Before this module the same resolution was hand-rolled in three places
 * with two shapes: `middleware/auth.ts` (REST authMiddleware) and
 * `websocket-handler.ts` (WS auth) each carried a byte-identical private
 * `getJwtSecret()` that threw on absence, and `config/validate.ts` re-typed
 * the same fallback chain for its production check. All three guard the SAME
 * tokens, so a future edit at any one site (a reordered fallback, an added
 * env name, a changed error message) would make REST and WS verify with
 * different secrets — a token accepted by one path would 401 on the other
 * while the config validator kept blessing the deployment.
 *
 * Import this instead of re-typing the chain:
 *   - `requireJwtSecret()` — throw-on-absence form both auth middlewares use;
 *   - `getJwtSecretFromEnv()` — undefined-on-absence form the production
 *     config validator uses.
 */

import { PipelineConfigError } from '../pipeline/pipeline-errors';

/**
 * Resolve the JWT secret from the environment.
 *
 * @returns the secret, or `undefined` when neither env var is set — the
 *   caller decides whether that is fatal (`requireJwtSecret`) or a
 *   validation finding (`validateSecurityEnv`).
 */
export function getJwtSecretFromEnv(): string | undefined {
  return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
}

/**
 * Resolve the JWT secret or fail loudly — the shared contract of the REST
 * and WS auth middlewares. Throwing the canonical `PipelineConfigError`
 * keeps both paths' failure identical (same field, same message), so a
 * misconfigured deployment cannot present as a path-specific token bug.
 *
 * @returns the secret
 */
export function requireJwtSecret(): string {
  const secret = getJwtSecretFromEnv();
  if (!secret) {
    throw new PipelineConfigError(
      'jwtSecret',
      'JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required',
    );
  }
  return secret;
}
