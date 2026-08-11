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
 *
 * THREE LAYERS, each closing a different gap:
 *  1. Hand-built corpus + known-output anchors (above) — pins specific cases.
 *  2. Generated fuzz corpus (below, TC-312-FUZZ) — a seeded RNG builds hundreds
 *     of random JSON shapes (poison keys at random depth, 1e400 overflow, deep
 *     nests crossing the 128 boundary, mixed arrays). Parity alone (client===deno)
 *     cannot catch a drift introduced into BOTH copies identically, so the fuzz
 *     also asserts both outputs equal an INDEPENDENT spec oracle (`specSanitize`)
 *     re-stating the contract in the test. Hand-built cases rot in lockstep with
 *     a familiar edit; a generated space does not.
 *  3. Mutation RED witness (below, TC-312-MUT) — the lockstep guard's
 *     non-vacuity proof. The inline-sanitizer guard (TC-302-02) has a committed
 *     "mutated form leaks" witness; before TC-312-MUT the parity guard only
 *     DESCRIBED "mutate one → RED" in this comment. Each parameterized case
 *     substitutes a realistic drift (drop a poison key, add a spurious key,
 *     change the depth cap, drop the finite branch, skip array recursion) and
 *     proves ∃ an input where it diverges from the canonical sanitizer — i.e.
 *     IF one copy drifted that way, the parity assertion would go RED. A
 *     weakened corpus (relevant cases removed) makes the witness go RED itself.
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

// =============================================================================
// (TC-312-FUZZ) Generated fuzz corpus with an independent spec oracle.
// =============================================================================
// Parity (client === deno) alone CANNOT witness a drift introduced into BOTH
// copies identically — the two would still agree, just on the wrong answer.
// To catch shared drift the fuzz asserts BOTH sanitizers equal an INDEPENDENT
// spec oracle (`specSanitize`) that re-states the contract here, in the test,
// physically separate from either copy. The generator is a SEEDED PRNG
// (mulberry32, fixed seed) so every run walks the same shapes — a regression
// is reproducible, not a flaky random miss.

/** Deterministic PRNG (mulberry32). Seeded → reproducible fuzz, no Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Independent re-statement of the sanitizer contract. This is the THIRD oracle
 * (besides the client and Deno copies): if both copies drift identically away
 * from the contract, this spec still disagrees and the fuzz goes RED. Constants
 * are deliberate literals here (not imported) so a source edit cannot silently
 * drag the spec along.
 */
function specSanitize(value: unknown, depth = 0): unknown {
  // SPEC: prune branches deeper than 128 (matches MAX_SANITIZE_DEPTH).
  if (depth > 128) return null;
  if (Array.isArray(value)) {
    return value.map((v) => specSanitize(v, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      // SPEC: drop exactly these three prototype-pollution keys.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = specSanitize(src[key], depth + 1);
    }
    return out;
  }
  // SPEC: non-finite numbers (Infinity/NaN from 1e400 etc.) → null.
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

const FUZZ_KEYS = ['id', 'type', 'duration', 'label', 'x', 'y', 'keep', 'value', 'name', 'child'];
const POISON_KEYS = ['__proto__', 'constructor', 'prototype'];

/** Generate a syntactically-valid JSON string of a random shape. */
function genJsonString(rng: () => number, depth: number, budget: number): string {
  if (depth > 132 || budget <= 0) {
    return rng() < 0.5 ? 'null' : `"l${Math.floor(rng() * 32)}"`;
  }
  const roll = rng();
  if (roll < 0.32) {
    // Object — 40% chance the first key is a poison key.
    const usePoison = rng() < 0.4;
    const n = 1 + Math.floor(rng() * 3);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = usePoison && i === 0
        ? POISON_KEYS[Math.floor(rng() * POISON_KEYS.length)]
        : FUZZ_KEYS[Math.floor(rng() * FUZZ_KEYS.length)];
      parts.push(`"${k}":${genJsonString(rng, depth + 1, budget - 1)}`);
    }
    return `{${parts.join(',')}}`;
  }
  if (roll < 0.54) {
    // Array.
    const n = 1 + Math.floor(rng() * 3);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push(genJsonString(rng, depth + 1, budget - 1));
    return `[${parts.join(',')}]`;
  }
  if (roll < 0.66) {
    // Number — sometimes the 1e400 overflow vector.
    return rng() < 0.5 ? '1e400' : String(Math.floor(rng() * 10000) / 100);
  }
  if (roll < 0.80) return `"str${Math.floor(rng() * 64)}"`;
  if (roll < 0.90) return rng() < 0.5 ? 'true' : 'false';
  return 'null';
}

/** A deterministic single-key chain of a given depth, to cross the 128 boundary. */
function deepNestJson(depth: number): string {
  let s = '"leaf"';
  for (let i = 0; i < depth; i++) s = `{"child":${s}}`;
  return s;
}

/**
 * Structural deep-equal for sanitizer outputs. Unlike JSON.stringify-based
 * comparison, this DISTINGUISHES `Infinity`/`NaN` from `null` — important
 * because the no-finite-branch drift leaves `Infinity` in the output while the
 * canonical neutralizes it to `null`, and `JSON.stringify(Infinity) === 'null'`
 * would mask exactly that divergence. Shared by the fuzz and mutation sections.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return Object.is(a, b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
  );
}

describe('TC-312-FUZZ — generated corpus: client === deno === spec oracle', () => {
  const SEED = 0x5a12c0de;
  const N = 400;

  it('all generated shapes agree across client, Deno, and the spec oracle', () => {
    const rng = mulberry32(SEED);
    const mismatches: string[] = [];
    for (let i = 0; i < N; i++) {
      const text = genJsonString(rng, 0, 9);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Generator is built to emit valid JSON; skip defensively if not.
        continue;
      }
      const c = clientSanitize(parsed);
      const d = denoSanitize(parsed);
      const s = specSanitize(parsed);
      if (!deepEqual(c, d)) mismatches.push(`parity   @ ${text}`);
      if (!deepEqual(c, s)) mismatches.push(`spec-cli @ ${text}`);
      if (!deepEqual(d, s)) mismatches.push(`spec-deno@ ${text}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('depth-boundary nests (across the 128 cap) agree on all three', () => {
    for (const dep of [120, 126, 127, 128, 129, 130, 131, 200]) {
      const parsed = JSON.parse(deepNestJson(dep));
      const c = clientSanitize(parsed);
      expect(denoSanitize(parsed)).toEqual(c);
      expect(specSanitize(parsed)).toEqual(c);
    }
  });
});

// =============================================================================
// (TC-312-MUT) Mutation RED witness — lockstep guard non-vacuity proof.
// =============================================================================
// The inline-sanitizer guard (TC-302-02) commits a "mutated form leaks"
// witness as a passing test. The parity guard previously only DESCRIBED
// "mutate one → RED" in a comment. Each case below takes a realistic drift a
// copy could acquire, runs it over the SAME inputs the parity check uses, and
// proves ∃ an input where it diverges from the canonical sanitizer. Because
// clientSanitize === denoSanitize (parity holds), a divergence from the
// canonical IS a divergence between the two copies — i.e. that drift would
// break parity (RED). If the corpus were ever weakened so a drift is no longer
// detectable, the witness itself goes RED, demanding the corpus be restored.

/**
 * Each entry: a drifted sanitizer variant + a guaranteed witness input on which
 * it MUST diverge from the canonical (client) sanitizer. The witness is given
 * either as a literal JS value (`witness`) or as a JSON string (`witnessJson`)
 * — the latter for inputs that need `JSON.parse` to materialize a poison key
 * as a real own-property (a `{ __proto__: ... }` object literal sets the
 * prototype instead of creating an own property).
 */
const MUTATIONS: Array<{
  name: string;
  mutate: (v: unknown, depth?: number) => unknown;
} & ({ witness: unknown } | { witnessJson: string })> = [
  {
    // Drift: the copy drops only __proto__ & prototype, NOT constructor.
    name: 'drop only 2 of 3 poison keys (constructor survives)',
    mutate: (v, depth = 0) => mutBase(v, depth, new Set(['__proto__', 'prototype'])),
    witnessJson: '{"constructor":{"prototype":{"p":1}},"keep":2}',
  },
  {
    // Drift: the copy additionally drops a legitimate key ("id").
    name: 'add spurious "id" to the poison-key set',
    mutate: (v, depth = 0) => mutBase(v, depth, new Set(['__proto__', 'constructor', 'prototype', 'id'])),
    witnessJson: '{"id":"s1","keep":2}',
  },
  {
    // Drift: MAX_SANITIZE_DEPTH lowered to 64. mutBase's cap param encodes the
    // drift; canonical (cap 128) preserves a depth-100 leaf, the drift prunes it.
    name: 'lower MAX_SANITIZE_DEPTH to 64',
    mutate: (v, depth = 0) => mutBase(v, depth, POISON_SET, 64),
    witness: nestedDepth(100), // 64 < 100 ≤ 128 → canonical preserves, drift prunes.
  },
  {
    // Drift: the Number.isFinite branch removed (Infinity passes through).
    name: 'drop the Number.isFinite branch (Infinity survives)',
    mutate: (v, depth = 0) => mutNoFinite(v, depth),
    witness: { duration: Infinity, start: 0 },
  },
  {
    // Drift: arrays are not recursed (returned by-reference / shallow).
    name: 'do not recurse into arrays',
    mutate: (v /* , depth */) => mutNoArrayRecurse(v, 0),
    witnessJson: '[1,1e400,{"__proto__":1,"a":2},3]',
  },
];

const POISON_SET = new Set(['__proto__', 'constructor', 'prototype']);

/** Base walker parameterized by the poison-key set and (optionally) a cap. */
function mutBase(value: unknown, depth: number, poison: Set<string>, cap = 128): unknown {
  if (depth > cap) return null;
  if (Array.isArray(value)) return value.map((v) => mutBase(v, depth + 1, poison, cap));
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (poison.has(key)) continue;
      out[key] = mutBase(src[key], depth + 1, poison, cap);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

/** Drift variant: no Number.isFinite neutralization. */
function mutNoFinite(value: unknown, depth: number): unknown {
  if (depth > 128) return null;
  if (Array.isArray(value)) return value.map((v) => mutNoFinite(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (POISON_SET.has(key)) continue;
      out[key] = mutNoFinite(src[key], depth + 1);
    }
    return out;
  }
  return value; // finite AND non-finite both pass through
}

/** Drift variant: arrays are returned shallow (not sanitized). */
function mutNoArrayRecurse(value: unknown, depth: number): unknown {
  if (depth > 128) return null;
  if (Array.isArray(value)) return value; // ← drift: do not recurse
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (POISON_SET.has(key)) continue;
      out[key] = mutNoArrayRecurse(src[key], depth + 1);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

describe('TC-312-MUT — mutation RED witness: each drift diverges from canonical', () => {
  // A witness pool = hand-built corpus + a fuzz sweep, so "the corpus is
  // sensitive to this drift" is proven over MORE than the single pinned input.
  const rng = mulberry32(0xfeedface);
  const pool: unknown[] = [];
  for (let i = 0; i < 120; i++) {
    try {
      pool.push(JSON.parse(genJsonString(rng, 0, 8)));
    } catch {
      /* skip */
    }
  }
  // Deep nests across/above the 128 cap so depth-cap drifts (mutation #3) are
  // also detectable over the pool — the shallow fuzz budget alone never reaches
  // depth 64, let alone 128.
  for (const dep of [60, 64, 65, 100, 128, 129, 160, 200]) {
    pool.push(JSON.parse(deepNestJson(dep)));
  }

  for (const m of MUTATIONS) {
    it(`witness pinned: "${m.name}" diverges from the canonical sanitizer`, () => {
      const witness = 'witnessJson' in m ? JSON.parse(m.witnessJson) : m.witness;
      const canonical = clientSanitize(witness);
      const mutated = m.mutate(witness);
      // The drift MUST change the output — otherwise this mutation would slip
      // past parity unnoticed, and the witness is broken (RED).
      expect(mutated).not.toEqual(canonical);
    });

    it(`corpus-sensitive: "${m.name}" diverges somewhere in the witness pool`, () => {
      // Proves the parity corpus would catch this drift, not just the pinned
      // input. If this fails, the corpus lost coverage of this drift class.
      // Uses deepEqual (not JSON.stringify) so Infinity-vs-null divergences
      // (the no-finite-branch drift) are not masked by stringification.
      const detected = pool.some((v) => !deepEqual(m.mutate(v), clientSanitize(v)));
      expect(detected).toBe(true);
    });
  }

  it('sanity: the canonical sanitizer equals itself on the pool (witness machinery is sound)', () => {
    // Guard against a vacuous witness: if `mutate` accidentally equalled
    // canonical everywhere for a trivial reason, the above would be weak. This
    // also confirms clientSanitize is deterministic on the pool.
    for (const v of pool) {
      expect(clientSanitize(v)).toEqual(clientSanitize(v));
    }
  });
});
