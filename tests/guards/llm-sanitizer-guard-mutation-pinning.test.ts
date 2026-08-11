/**
 * @jest-environment node
 */
/**
 * llm-sanitizer-guard-mutation-pinning.test.ts — TC-302
 *
 * Pins the untrusted-JSON sanitizer at its single source of truth
 * `src/analysis/untrusted-json-core.ts` (re-exported by `src/analysis/llm-utils.ts`;
 * `sanitizeUntrustedJsonValue`, consumed by `parseJsonFromLLMText` AND
 * `parseUntrustedJson`) against silent regression.
 *
 * THE BUG CLASS. Model output / API-boundary JSON is untrusted. Two vectors
 * reach the parse boundary:
 *   1. `JSON.parse('1e400')` → `Infinity` (typeof === 'number'), which sails
 *      past `typeof x === 'number'` guards into frame loops, pixel buffers,
 *      and quality metrics.
 *   2. `__proto__` / `constructor` / `prototype` keys, which re-introduce a
 *      prototype-pollution hazard whenever the parsed value is later spread
 *      or deep-merged.
 *
 * The canonical neutralizations are the two branches in
 * `sanitizeUntrustedJsonValue`:
 *   - `if (typeof value === 'number' && !Number.isFinite(value)) return null;`
 *   - `if (PROTOTYPE_POLLUTION_KEYS.has(key)) continue;` where the set is
 *     `new Set(['__proto__', 'constructor', 'prototype'])`.
 *
 * WHY MUTATION PINNING. The behavioral tests in
 * `tests/analysis/llm-untrusted-json-guard.test.ts` (25+ cases) prove the
 * guard WORKS today. But they import the function and exercise it — if a
 * future edit weakens the guard AND the behavioral file is co-edited (or the
 * import is silently redirected), the regression becomes invisible. The
 * source-anchor tests below read the source TEXT and fail on any edit that
 * removes or rewrites the two neutralization branches, independent of the
 * behavioral suite. The mutation-invariant tests then prove the guard's
 * INVARIANT (mutated form leaks; correct form neutralizes), so a weakened
 * guard cannot pass even if the anchor were loosened.
 *
 * This is the structured-JSON trust boundary for the whole repo — every LLM
 * parse (parseJsonFromLLMText) and every API-boundary structured parse
 * (parseUntrustedJson, e.g. src/pages/Index.tsx Supabase responses) funnels
 * through it. Pinning it at the source is the highest-leverage guard witness.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeUntrustedJsonValue } from '@/analysis/llm-utils';

// The sanitizer lives in the dependency-free core module (the single source
// the Supabase Edge copy is generated from); llm-utils.ts only re-exports it.
// Resolve from this test file's own location (not process.cwd()) so a jest ESM
// worker whose cwd is not the repo root still finds the source — the bare
// relative form flaked under --maxWorkers>1.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD_FILE = path.join(REPO_ROOT, 'src/analysis/untrusted-json-core.ts');

// --- (TC-302-01) source anchors: pin the two neutralization branches --------

describe('LLM sanitizer — source anchors pinned (TC-302-01)', () => {
  it('sanitizeUntrustedJsonValue neutralizes non-finite numbers via Number.isFinite', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    // A revert that drops the !Number.isFinite branch (e.g. "typeof === 'number'"
    // alone, or removing the return-null) leaves this anchor unmatched → RED.
    expect(src).toMatch(/typeof value === 'number' && !Number\.isFinite\(value\)/);
    // And the neutralization must return null (not the value, not 0).
    expect(src).toMatch(/!Number\.isFinite\(value\)\)\s*\{\s*return null;\s*\}/);
  });

  it('the prototype-pollution key set contains __proto__, constructor, prototype', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    // All three keys must remain in the Set literal. Dropping any one (e.g. a
    // misguided "constructor is legitimate" edit) → RED.
    expect(src).toMatch(
      /new Set\(\s*\[\s*'__proto__'\s*,\s*'constructor'\s*,\s*'prototype'\s*\]\s*\)/,
    );
  });

  it('the pollution-key drop branch references the set via .has(key)', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    expect(src).toMatch(/PROTOTYPE_POLLUTION_KEYS\.has\(key\)/);
  });

  it('parseUntrustedJson routes JSON.parse through the sanitizer (no bypass)', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    // The API-boundary helper must not parse raw. A future "perf" edit that
    // returns JSON.parse(text) directly leaves this anchor unmatched → RED.
    expect(src).toMatch(/function parseUntrustedJson[\s\S]*?sanitizeUntrustedJsonValue\(JSON\.parse\(text\)\)/);
  });
});

// --- (TC-302-02) mutation invariant: the mutated form leaks, the guard bites -
//
// For each vector we assert (a) the correct guard neutralizes it, and (b) the
// MUTATED form (guard removed) produces the dangerous value. If assertion (b)
// ever flips (mutated form becomes safe), the invariant has been weakened and
// a future regression would slip through — the test fails loudly.

describe('LLM sanitizer — mutation invariant (TC-302-02)', () => {
  it('guard neutralizes 1e400 → null; mutated guard leaks Infinity', () => {
    // Correct: sanitized parse neutralizes overflow.
    expect(sanitizeUntrustedJsonValue(JSON.parse('1e400'))).toBeNull();

    // Mutated (the bug shape): a plain JSON.parse yields Infinity.
    const mutated = JSON.parse('1e400');
    expect(typeof mutated === 'number' && !Number.isFinite(mutated)).toBe(true);
    // And Infinity is truthy, so a downstream `duration || 0` would NOT rescue
    // it — proving why the guard exists at the parse boundary, not later.
    expect(mutated || 0).not.toBe(0);
    expect(Number.isFinite(mutated as number)).toBe(false);
  });

  it('guard strips __proto__; mutated guard leaves it as an own property', () => {
    // Correct: the pollution key is dropped.
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"__proto__": {"polluted": true}, "type": "flow"}'),
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);

    // Mutated: a plain JSON.parse keeps __proto__ as an own enumerable key,
    // which a later spread ({...obj}) would re-introduce onto Object.prototype.
    const mutated = JSON.parse('{"__proto__": {"polluted": true}, "type": "flow"}');
    expect(Object.prototype.hasOwnProperty.call(mutated, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a realistic tampered API response is fully neutralized end-to-end', () => {
    // Shape mirrors the Index.tsx Supabase scene response. A tampered function
    // returns overflow numerics AND a pollution key in one payload.
    const tampered =
      '{"scenes": [{"id": "s1", "durationMs": 1e400}], '
      + '"__proto__": {"polluted": true}, "duration": 1e999}';
    const sanitized = sanitizeUntrustedJsonValue(JSON.parse(tampered)) as Record<string, unknown>;
    const scenes = sanitized.scenes as Array<Record<string, unknown>>;
    expect(scenes[0].id).toBe('s1');
    expect(scenes[0].durationMs).toBeNull();
    expect(sanitized.duration).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
