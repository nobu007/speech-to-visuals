/**
 * @jest-environment node
 */
/**
 * untrusted-json-deno-parity.test.ts — TC-312
 *
 * PARITY GUARD between the two intentionally-duplicated untrusted-JSON
 * sanitizers:
 *   - CLIENT:  src/analysis/llm-utils.ts        (sanitizeUntrustedJsonValue / parseUntrustedJson)
 *   - DENO:    supabase/functions/_shared/untrusted-json.ts (same names)
 *
 * WHY DUPLICATED. Edge Functions run under Deno and cannot import the client
 * `src/` tree, so the sanitizer is hand-copied. The two copies must neutralize
 * identical inputs identically — otherwise the Deno trust boundary
 * (request bodies, external API responses parsed in the edge functions) drifts
 * from the client trust boundary and one side re-opens the class the other
 * closed (TC-302: `1e400`→Infinity poisoning + `__proto__`/`constructor`/
 * `prototype` prototype-pollution).
 *
 * WHY THIS TEST. Before TC-312 the lockstep was a COMMENT only ("keep the
 * algorithm in lockstep"). A comment cannot witness drift in
 * `PROTOTYPE_POLLUTION_KEYS`, `MAX_SANITIZE_DEPTH`, or the walk order. This
 * test imports BOTH modules through the jest ESM pipeline and asserts
 * deep-strict-equal output on a shared adversarial corpus, so editing one copy
 * without the other goes RED — the invariant is pinned mechanically, not by
 * prose. This is the parity equivalent of the source-anchor guards in TC-302.
 *
 * RED/GREEN. The Deno module did not exist before this change, so importing it
 * failed (structural RED). After creation it must match the client on every
 * corpus entry (GREEN). The corpus is built so any of these drifts fails:
 *   - removing a key from PROTOTYPE_POLLUTION_KEYS  → poison key survives on one side
 *   - adding a key to the set on one side only       → legitimate key dropped on one side
 *   - changing MAX_SANITIZE_DEPTH                    → depth-129 boundary diverges
 *   - reordering/walking differently                 → unequal output on nested input
 *   - dropping the Number.isFinite branch            → Infinity survives on one side
 */
import { describe, it, expect } from '@jest/globals';
import {
  sanitizeUntrustedJsonValue as clientSanitize,
  parseUntrustedJson as clientParse,
} from '@/analysis/llm-utils';
import {
  sanitizeUntrustedJsonValue as denoSanitize,
  parseUntrustedJson as denoParse,
} from '#supabase/functions/_shared/untrusted-json.ts';

/**
 * Build a deeply-nested object of a given depth along a single key path.
 * Used to probe the MAX_SANITIZE_DEPTH == 128 prune boundary. Note the
 * sanitizer processes the ROOT at depth 0 and recurses with depth+1, so the
 * cap prunes the NODE whose processing-depth exceeds 128 (not the whole tree
 * from the top). `deepestChild` walks back down to read that pruned leaf.
 */
function nestedDepth(depth: number, leaf: unknown = 'leaf'): unknown {
  let value: unknown = leaf;
  for (let i = 0; i < depth; i++) {
    value = { child: value };
  }
  return value;
}

/** Walk a nestedDepth() chain to its terminal value (the pruned leaf or 'leaf'). */
function deepestChild(value: unknown): unknown {
  let cur = value;
  while (
    cur !== null &&
    typeof cur === 'object' &&
    !Array.isArray(cur) &&
    'child' in (cur as Record<string, unknown>)
  ) {
    cur = (cur as { child: unknown }).child;
  }
  return cur;
}

/**
 * Shared adversarial corpus. Each entry is fed to BOTH sanitizers; their
 * outputs must be deep-equal. Entries are chosen to exercise every neutralization
 * branch and the depth cap, so a divergence in any branch surfaces here.
 */
const CORPUS: Array<{ name: string; value: unknown }> = [
  { name: 'legitimate primitive number', value: 42 },
  { name: 'legitimate string', value: 'hello' },
  { name: 'legitimate null', value: null },
  { name: 'legitimate boolean', value: true },
  { name: 'legitimate flat object', value: { a: 1, b: 'x', c: true } },
  { name: 'legitimate flat array', value: [1, 'x', true, null] },
  { name: 'legitimate nested object', value: { a: { b: { c: [1, 2, { d: 3 }] } } } },

  // Numeric overflow vector: JSON.parse('1e400') → Infinity.
  { name: 'Infinity', value: Infinity },
  { name: '-Infinity', value: -Infinity },
  { name: 'NaN (defensive)', value: NaN },
  { name: 'Infinity nested in object', value: { duration: Infinity, start: 0, end: 1e400 } },
  { name: 'Infinity nested in array', value: [1, Infinity, -Infinity, 2] },
  { name: 'Infinity at mixed depth', value: { seg: [{ t: 1, v: Infinity }, { t: 2, v: NaN }] } },

  // Prototype-pollution vector: these become own enumerable properties via
  // JSON.parse, then re-introduce the hazard on later spread/merge.
  { name: '__proto__ at root', value: JSON.parse('{"__proto__":{"polluted":true},"ok":1}') },
  { name: 'constructor at root', value: JSON.parse('{"constructor":{"prototype":{"polluted":true}},"ok":1}') },
  { name: 'prototype at root', value: JSON.parse('{"prototype":{"x":1},"ok":2}') },
  { name: 'all three poison keys at root', value: JSON.parse('{"__proto__":1,"constructor":2,"prototype":3,"keep":4}') },
  { name: '__proto__ nested in array element', value: JSON.parse('[{"__proto__":{"p":1},"a":2}]') },
  {
    name: 'poison keys nested two levels deep',
    value: JSON.parse('{"outer":{"__proto__":{"p":1},"constructor":{"q":2},"inner":{"prototype":3}}}'),
  },
  { name: 'legitimate key named similarly (proto, constructors)', value: { proto: 1, constructors: 2, prototypes: 3 } },

  // Depth-prune boundary: MAX_SANITIZE_DEPTH == 128.
  { name: 'nesting just under cap (depth 127)', value: nestedDepth(127) },
  { name: 'nesting exactly at cap (depth 128)', value: nestedDepth(128) },
  { name: 'nesting one past cap (depth 129 → prune)', value: nestedDepth(129) },
  { name: 'nesting well past cap (depth 200 → prune)', value: nestedDepth(200) },

  // Combined vectors at depth.
  {
    name: 'poison + overflow + depth together',
    value: JSON.parse('{"__proto__":{"x":1},"arr":[1e400,"a",{"constructor":2}],"ok":{"nested":true}}'),
  },
];

describe('TC-312 — client ↔ Deno untrusted-JSON sanitizer parity', () => {
  it('both modules expose the same function names', () => {
    expect(typeof clientSanitize).toBe('function');
    expect(typeof denoSanitize).toBe('function');
    expect(typeof clientParse).toBe('function');
    expect(typeof denoParse).toBe('function');
  });

  describe('sanitizeUntrustedJsonValue parity over adversarial corpus', () => {
    for (const { name, value } of CORPUS) {
      it(`identical output: ${name}`, () => {
        const clientOut = clientSanitize(value);
        const denoOut = denoSanitize(value);
        expect(denoOut).toEqual(clientOut);
      });
    }
  });

  describe('parseUntrustedJson parity over valid-JSON strings', () => {
    const STRINGS: Array<{ name: string; text: string }> = [
      { name: 'overflow number', text: '{"duration":1e400,"name":"x"}' },
      { name: 'poison key', text: '{"__proto__":{"p":1},"keep":2}' },
      { name: 'array of overflow', text: '[1,1e400,-1e400,0]' },
      { name: 'legitimate nested', text: '{"a":{"b":[1,2,3]}}' },
      { name: 'poison + overflow combined', text: '{"__proto__":1,"x":1e400,"ok":"y"}' },
    ];
    for (const { name, text } of STRINGS) {
      it(`identical parsed output: ${name}`, () => {
        expect(denoParse(text)).toEqual(clientParse(text));
      });
    }

    it('both throw on invalid JSON (same SyntaxError behavior)', () => {
      expect(() => denoParse('{not valid json')).toThrow(SyntaxError);
      expect(() => clientParse('{not valid json')).toThrow(SyntaxError);
    });
  });

  // KNOWN-OUTPUT assertions on BOTH sides — a drift in EITHER direction fails.
  // This is the non-vacuousness proof: the corpus does not merely assert the
  // two agree, it pins what "agree" means.
  describe('known-output anchors (both sides must match the spec, not just each other)', () => {
    it('Infinity → null on both sides', () => {
      expect(clientSanitize(Infinity)).toBeNull();
      expect(denoSanitize(Infinity)).toBeNull();
    });

    it('__proto__ own-property is dropped on both sides', () => {
      const poisoned = JSON.parse('{"__proto__":{"polluted":true},"keep":1}');
      expect(Object.keys(clientSanitize(poisoned) as object)).toEqual(['keep']);
      expect(Object.keys(denoSanitize(poisoned) as object)).toEqual(['keep']);
    });

    it('all three poison keys dropped on both sides', () => {
      const poisoned = JSON.parse('{"__proto__":1,"constructor":2,"prototype":3,"keep":4}');
      expect(Object.keys(clientSanitize(poisoned) as object)).toEqual(['keep']);
      expect(Object.keys(denoSanitize(poisoned) as object)).toEqual(['keep']);
    });

    it('MAX_SANITIZE_DEPTH == 128 boundary: leaf survives at depth 128, pruned at depth 129 (both sides)', () => {
      // Processing-depth 128 is allowed (128 > 128 is false) → leaf preserved.
      expect(deepestChild(clientSanitize(nestedDepth(128)))).toBe('leaf');
      expect(deepestChild(denoSanitize(nestedDepth(128)))).toBe('leaf');
      // Processing-depth 129 exceeds the cap (129 > 128) → leaf pruned to null.
      expect(deepestChild(clientSanitize(nestedDepth(129)))).toBeNull();
      expect(deepestChild(denoSanitize(nestedDepth(129)))).toBeNull();
    });

    it('legitimate value passes through unchanged on both sides', () => {
      const legit = { a: 1, b: 'x', c: [true, null, 2.5] };
      expect(clientSanitize(legit)).toEqual(legit);
      expect(denoSanitize(legit)).toEqual(legit);
    });
  });
});
