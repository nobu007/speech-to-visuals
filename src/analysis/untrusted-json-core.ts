/**
 * Untrusted-JSON sanitizer — single source of truth.
 *
 * Two runtimes need this exact algorithm:
 *   - the client bundle, via `src/analysis/llm-utils.ts` (which re-exports the
 *     symbols below and additionally provides `parseJsonFromLLMText` for
 *     free-form LLM text), and
 *   - the Supabase Edge Functions (Deno), via a GENERATED copy at
 *     `supabase/functions/_shared/untrusted-json.ts` produced by
 *     `scripts/generate-edge-untrusted-json.ts`.
 *
 * Deno cannot import the client `src/` tree (no shared bundler, `https://`
 * module resolution), so the Edge copy must exist as a physical file. Rather
 * than hand-maintaining two copies in lockstep, the Edge file is GENERATED from
 * THIS module, making drift structurally impossible. The sync guard
 * `tests/guards/edge-untrusted-json-sync.test.ts` fails if the committed Edge
 * file ever differs from the generated output; the behavioral parity test
 * `tests/guards/untrusted-json-deno-parity.test.ts` (TC-312) remains as the
 * witness that generation did not change behavior.
 *
 * When CI can resolve network imports, the further collapse is to publish this
 * module to a version-pinned Deno URL (jsr.io / deno.land/x) and import it via
 * `https://` from the Edge function — deleting the generated copy entirely.
 *
 * This module is deliberately dependency-free (only language globals) so the
 * generated Deno copy is valid as-is.
 */

/**
 * Keys that are never legitimate in untrusted (model-, client-, or
 * API-generated) JSON but are reachable attack surface whenever the parsed
 * object is later spread, deep-merged, or walked by a generic assigner.
 * Keeping one of these as an own property (e.g. `{"__proto__": {...}}` or
 * `{"constructor": {...}}`) can mutate Object.prototype downstream. They are
 * dropped unconditionally at the parse boundary — diagram/analysis data has no
 * field by these names.
 */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Maximum nesting depth the sanitizer will walk before pruning a branch.
 * Diagram/analysis JSON is shallow (response → nodes[] → {position:{x,y}} ≈ 4
 * levels); 128 is far beyond any legitimate payload yet bounds the recursion so
 * a pathologically deep (but parseable) payload cannot overflow the stack
 * inside the sanitizer itself.
 */
const MAX_SANITIZE_DEPTH = 128;

/**
 * Sanitize a value parsed from untrusted (model-, client-, or API-generated)
 * JSON.
 *
 * Two attack vectors are neutralized at the trust boundary:
 *
 * 1. Numeric overflow — `JSON.parse('1e400')` yields `Infinity` (typeof ===
 *    'number'), which sails past `typeof x === 'number'` guards and poisons
 *    downstream arithmetic (frame loops, pixel buffers, quality metrics).
 *    Non-finite numbers are replaced with `null`.
 *
 * 2. Prototype pollution — `__proto__` / `constructor` / `prototype` keys are
 *    dropped from every object. (`JSON.parse` itself creates these as own
 *    properties rather than mutating the prototype, but any later spread/merge
 *    of the parsed value re-introduces the hazard; stripping at the boundary is
 *    defense-in-depth with no downside.)
 *
 * The input is otherwise returned unchanged, so legitimate JSON is unaffected.
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
 * Parse a JSON string received across a trust boundary — an HTTP response body
 * from a remote service, an API boundary, a disk file not written by this code
 * — and neutralize the two vectors handled by `sanitizeUntrustedJsonValue`
 * (numeric overflow `1e400` → Infinity, and `__proto__`/`constructor`/
 * `prototype` keys) in a single step.
 *
 * Use this for STRUCTURED JSON from a trust boundary (the response is already
 * valid JSON). The client-side companion `parseJsonFromLLMText` (in
 * `llm-utils.ts`) additionally handles free-form LLM text that needs markdown-
 * fence stripping and repair; it delegates here for the sanitized parse so
 * every external JSON parse site aggregates onto the same chokepoint.
 *
 * No-op on legitimate JSON. Throws `SyntaxError` on invalid JSON exactly as
 * `JSON.parse` does, so callers' existing parse-failure handling is preserved.
 */
export function parseUntrustedJson(text: string): unknown {
  return sanitizeUntrustedJsonValue(JSON.parse(text));
}
