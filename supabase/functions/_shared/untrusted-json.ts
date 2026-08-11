/**
 * Untrusted-JSON sanitizer for Supabase Edge Functions (Deno runtime).
 *
 * ⚠️  INTENTIONAL DUPLICATE of `src/analysis/llm-utils.ts`
 * (`sanitizeUntrustedJsonValue` / `parseUntrustedJson`).
 *
 * Edge Functions run under Deno and CANNOT import the client `src/` tree (no
 * shared bundler, different module resolution, `https://` imports). The two
 * copies must therefore be kept in LOCKSTEP by hand: identical
 * `PROTOTYPE_POLLUTION_KEYS`, identical `MAX_SANITIZE_DEPTH`, identical walk
 * order. This is exactly the "comment-reliant invariant" the client already
 * documents — see the long rationale in `src/analysis/llm-utils.ts`.
 *
 * The lockstep is NOT left to comments alone: the parity test
 * `tests/guards/untrusted-json-deno-parity.test.ts` imports BOTH modules and
 * asserts byte-identical output on a shared adversarial corpus (poison keys at
 * every nesting depth, `1e400` overflow, depth-prune boundary). Any silent
 * drift in the key set, depth cap, or walk logic fails that test, so editing
 * one copy without the other is caught mechanically.
 *
 * If you change the algorithm here, change `src/analysis/llm-utils.ts` too (or
 * the parity test goes red). The client-side companion additionally exposes
 * `parseJsonFromLLMText` (markdown-fence stripping + repair); that text-mode
 * helper is NOT needed on the edge (functions receive structured JSON only),
 * so it is deliberately not duplicated here.
 *
 * ─── REMOVAL PATH (this duplicate is intentional, but not permanent) ────────
 * The goal is ONE source of truth, not two hand-kept copies. The removal route,
 * in priority order:
 *
 *   1. PREFERRED — publish the sanitizer to a version-pinned Deno module URL
 *      (jsr.io or a tagged deno.land/x release) and import it here via
 *      `https://`, while the client builds the SAME module from a local package
 *      alias. The parity test then guards ONE external module instead of two
 *      in-repo copies that can rot together. Land this once CI can resolve the
 *      network import (or a vendored mirror) in the test pipeline.
 *
 *   2. UNAVAILABLE-NETWORK FALLBACK (current state) — keep the two copies but
 *      make the lockstep guard bite hard:
 *        • TC-312 parity corpus (hand-built + known-output anchors).
 *        • TC-312-FUZZ: a SEEDED generated corpus asserting client === Deno
 *          === an independent spec oracle, so a drift introduced into BOTH
 *          copies identically (which parity alone cannot see) is still caught.
 *        • TC-312-MUT: a mutation RED witness proving each realistic drift
 *          (drop a poison key, add a spurious key, change the depth cap, drop
 *          the finite branch, skip array recursion) would make the two outputs
 *          diverge — i.e. the lockstep guard is non-vacuous, not comment-only.
 *
 * When path 1 becomes feasible, DELETE this file, point the edge functions at
 * the import URL, and the parity test stays green (it then compares the client
 * build against the same published module). Do NOT delete the test with the
 * copy — it is the witness that the removal did not silently change behavior.
 */

/**
 * Keys that are never legitimate in client/API-produced JSON but are reachable
 * attack surface whenever the parsed object is later spread, deep-merged, or
 * walked by a generic assigner. Keeping one as an own property (e.g.
 * `{"__proto__": {...}}`) can mutate Object.prototype downstream. Dropped
 * unconditionally at the parse boundary.
 */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Maximum nesting depth the sanitizer will walk before pruning a branch.
 * Edge-function payloads are shallow; 128 is far beyond any legitimate payload
 * yet bounds the recursion so a pathologically deep (but parseable) body cannot
 * overflow the stack inside the sanitizer itself.
 */
const MAX_SANITIZE_DEPTH = 128;

/**
 * Sanitize a value parsed from untrusted (client- or API-generated) JSON.
 *
 * Neutralizes two vectors at the trust boundary:
 *  1. Numeric overflow — `JSON.parse('1e400')` yields `Infinity`, which sails
 *     past `typeof x === 'number'` guards and poisons downstream arithmetic.
 *     Non-finite numbers are replaced with `null`.
 *  2. Prototype pollution — `__proto__` / `constructor` / `prototype` keys are
 *     dropped from every object.
 *
 * Legitimate JSON is returned unchanged.
 */
export function sanitizeUntrustedJsonValue(value: unknown, depth = 0): unknown {
  // Depth guard: prune deeply nested branches to a safe value rather than risk
  // stack exhaustion inside this recursive walk.
  if (depth > MAX_SANITIZE_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      out[i] = sanitizeUntrustedJsonValue(value[i], depth + 1);
    }
    return out;
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Object.keys returns own enumerable string keys only — never the inherited
    // prototype chain — so reading `source[key]` here touches no polluted state.
    for (const key of Object.keys(source)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        continue;
      }
      out[key] = sanitizeUntrustedJsonValue(source[key], depth + 1);
    }
    return out;
  }

  // Neutralize Infinity / -Infinity (and NaN, which cannot originate from
  // JSON.parse but is covered defensively) to null.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

/**
 * Parse a JSON string received across a trust boundary — an incoming request
 * body or an external API response — and neutralize the two vectors handled by
 * `sanitizeUntrustedJsonValue` (numeric overflow `1e400` → Infinity, and
 * `__proto__`/`constructor`/`prototype` keys) in a single step.
 *
 * No-op on legitimate JSON. Throws `SyntaxError` on invalid JSON exactly as
 * `JSON.parse` does, so callers' existing parse-failure handling is preserved.
 */
export function parseUntrustedJson(text: string): unknown {
  return sanitizeUntrustedJsonValue(JSON.parse(text));
}
