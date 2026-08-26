import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 26 (JWT secret resolution single-source): the env fallback chain
   * that resolves the JWT signing secret lived in THREE sites with TWO
   * shapes — byte-identical private `getJwtSecret()` twins in
   * middleware/auth.ts (REST) and websocket-handler.ts (WS), plus the same
   * chain re-typed in config/validate.ts's production security check. All
   * three guard the SAME tokens: a drifted chain at one site would make REST
   * and WS verify with different secrets (token accepted by one path 401s
   * on the other) while the validator kept blessing the deployment. Banned
   * shapes: the chain itself (any `JWT_SECRET || …SUPABASE…` re-type), a
   * local `getJwtSecret` redeclaration, and the canonical throw message
   * echoed outside the module.
   *
   * NOT banned (legitimate other shapes, verified round 26): the validator's
   * own finding strings ('JWT_SECRET' field name, '…is required in
   * production' message, length/complexity warnings) — they describe the
   * finding, they do not resolve the secret — and SECURITY_LIMITS'
   * JWT_SECRET_MIN_* keys in config/limits.ts.
   */
  {
    id: 'jwt secret resolution single-sourced in api/jwt-secret (round 26)',
    roots: ['src'],
    exclude: {
      'src/api/jwt-secret.ts': 'the canonical source itself',
    },
    patterns: [
      // The env fallback chain, re-typed anywhere outside the canonical module.
      /JWT_SECRET['"]?\s*\|\|\s*process\.env\.SUPABASE_JWT_SECRET/,
      // A local throw-on-absence resolver coming back.
      /function\s+getJwtSecret\s*\(/,
      // The canonical error message echoed by a non-canonical throw site.
      /'JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required'/,
    ],
    minSweptFiles: 200,
  },

  /**
   * Claim-parity follow-up (INV-SEC-003): `jwt.verify` sites are a census of
   * TWO. The behavioral parity leg in jwt-secret-single-source.test.ts proves
   * the two known middlewares reject the same tokens — but a THIRD verify
   * site (a new route family, a batch-auth helper, a copied edge handler)
   * would mint another auth path nobody taught the parity contract, and
   * until this rule every shape of that site passed silently. This is the
   * missed-sibling-site bug class with teeth: a new site is only legal by
   * extending this census consciously AND adding it to the claim-parity
   * behavioral leg (sub-less token rejected) in the same diff.
   */
  {
    id: 'jwt.verify sites census-pinned to the two claim-parity middlewares (claim-parity follow-up)',
    roots: ['src'],
    exclude: {
      'src/api/middleware/auth.ts':
        'the REST sibling — its `!decoded.sub` guard is source-anchored in jwt-secret-single-source.test.ts',
      'src/api/websocket-handler.ts':
        'the WS sibling — same claim-parity source anchor pins its sub guard',
    },
    patterns: [
      // A token-verification call outside the census is a new auth path the
      // parity contract has never heard of.
      /jwt\.verify\s*\(/,
    ],
    minSweptFiles: 200,
  },
];
