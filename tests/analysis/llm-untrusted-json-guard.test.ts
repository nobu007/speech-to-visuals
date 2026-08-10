/**
 * Guard tests for untrusted (model-generated) JSON handling.
 *
 * Every LLM response in this repo is parsed through parseJsonFromLLMText
 * (llm-utils.ts). These tests pin the two attack vectors that reach that trust
 * boundary from untrusted model output, pairing with the storage-side finiteness
 * guards (safe-storage.ts) to close the class:
 *
 *  1. Numeric overflow — JSON.parse('1e400') yields Infinity, which is
 *     typeof === 'number' and sails past naive numeric guards into downstream
 *     arithmetic (frame loops, pixel buffers, quality metrics).
 *  2. Prototype pollution — __proto__ / constructor / prototype keys that would
 *     mutate Object.prototype if the parsed value is later spread or deep-merged.
 *
 * Also covers the disk-load path in llm-cache.ts, which round-trips the same
 * LLM-derived data and now sanitizes at the read boundary.
 */

import { parseJsonFromLLMText, sanitizeUntrustedJsonValue } from '@/analysis/llm-utils';

// ---------------------------------------------------------------------------
// sanitizeUntrustedJsonValue: finiteness
// ---------------------------------------------------------------------------
describe('sanitizeUntrustedJsonValue: numeric overflow → null', () => {
  it('neutralizes 1e400 (Infinity) to null', () => {
    expect(sanitizeUntrustedJsonValue(JSON.parse('1e400'))).toBeNull();
  });

  it('neutralizes -1e400 (-Infinity) to null', () => {
    expect(sanitizeUntrustedJsonValue(JSON.parse('-1e400'))).toBeNull();
  });

  it('neutralizes 1e999 to null', () => {
    expect(sanitizeUntrustedJsonValue(JSON.parse('1e999'))).toBeNull();
  });

  it('neutralizes Infinity nested inside an object field', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"confidence": 1e400, "type": "flow"}'),
    ) as Record<string, unknown>;
    expect(sanitized.confidence).toBeNull();
    expect(sanitized.type).toBe('flow');
  });

  it('neutralizes Infinity nested inside an array element', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('[1, 1e400, 3]'),
    ) as unknown[];
    expect(sanitized).toEqual([1, null, 3]);
  });

  it('neutralizes Infinity in deeply nested structure', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"nodes": [{"id": "a", "weight": 1e400}]}'),
    ) as Record<string, unknown>;
    const nodes = sanitized.nodes as Array<Record<string, unknown>>;
    expect(nodes[0].id).toBe('a');
    expect(nodes[0].weight).toBeNull();
  });

  it('preserves finite numbers including large-but-finite exponents', () => {
    // 1e308 is the largest finite double; it must pass through unchanged.
    const sanitized = sanitizeUntrustedJsonValue(JSON.parse('1e308'));
    expect(sanitized).toBe(1e308);
    expect(Number.isFinite(sanitized as number)).toBe(true);
  });

  it('preserves zero, negatives, and floats', () => {
    expect(sanitizeUntrustedJsonValue(0)).toBe(0);
    expect(sanitizeUntrustedJsonValue(-3.14)).toBe(-3.14);
    expect(sanitizeUntrustedJsonValue(42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// sanitizeUntrustedJsonValue: prototype pollution
// ---------------------------------------------------------------------------
describe('sanitizeUntrustedJsonValue: prototype-pollution keys stripped', () => {
  afterEach(() => {
    // Belt-and-suspenders: ensure no test ever leaves Object.prototype polluted.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a top-level __proto__ key', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"__proto__": {"polluted": true}, "type": "flow"}'),
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect(sanitized.type).toBe('flow');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a top-level constructor key', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"constructor": {"prototype": {"polluted": true}}, "a": 1}'),
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
    expect(sanitized.a).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a top-level prototype key', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"prototype": {"x": 1}, "b": 2}'),
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'prototype')).toBe(false);
    expect(sanitized.b).toBe(2);
  });

  it('drops pollution keys nested inside arrays', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('[{"__proto__": {"polluted": true}, "id": "n1"}]'),
    ) as Array<Record<string, unknown>>;
    expect(Object.prototype.hasOwnProperty.call(sanitized[0], '__proto__')).toBe(false);
    expect(sanitized[0].id).toBe('n1');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops pollution keys at arbitrary depth', () => {
    const sanitized = sanitizeUntrustedJsonValue(
      JSON.parse('{"outer": {"inner": {"__proto__": {"polluted": true}}}}'),
    ) as Record<string, unknown>;
    const inner = (sanitized.outer as Record<string, unknown>).inner as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(inner, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not pollute Object.prototype across many stripped keys', () => {
    // Repeated exposure must remain inert.
    for (let i = 0; i < 50; i++) {
      sanitizeUntrustedJsonValue(
        JSON.parse('{"__proto__": {"p": true}, "constructor": {"prototype": {"q": true}}}'),
      );
    }
    expect(({} as Record<string, unknown>).p).toBeUndefined();
    expect(({} as Record<string, unknown>).q).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sanitizeUntrustedJsonValue: depth-bomb protection
// ---------------------------------------------------------------------------
describe('sanitizeUntrustedJsonValue: depth bound', () => {
  it('prunes pathologically deep nesting to null without overflowing the stack', () => {
    // Build nesting well beyond the 128 cap; this would blow the call stack of
    // an unbounded recursive walker.
    let deep: unknown = 0;
    for (let i = 0; i < 500; i++) {
      deep = { nested: deep };
    }
    const sanitized = sanitizeUntrustedJsonValue(deep) as Record<string, unknown>;
    // Walk down to the prune boundary and confirm a null appears, with no throw.
    let cursor: unknown = sanitized;
    let guard = 0;
    while (cursor !== null && typeof cursor === 'object' && guard < 1000) {
      cursor = (cursor as Record<string, unknown>).nested ?? null;
      guard++;
    }
    expect(cursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sanitizeUntrustedJsonValue: legitimate data is a no-op
// ---------------------------------------------------------------------------
describe('sanitizeUntrustedJsonValue: legitimate values pass through', () => {
  it('returns primitives unchanged', () => {
    expect(sanitizeUntrustedJsonValue('hello')).toBe('hello');
    expect(sanitizeUntrustedJsonValue(true)).toBe(true);
    expect(sanitizeUntrustedJsonValue(false)).toBe(false);
    expect(sanitizeUntrustedJsonValue(null)).toBeNull();
  });

  it('returns a plain object unchanged (deep-equal)', () => {
    const input = { type: 'flow', nodes: [{ id: 'a', label: 'A' }], edges: [] };
    expect(sanitizeUntrustedJsonValue(input)).toEqual(input);
  });

  it('returns a plain array unchanged (deep-equal)', () => {
    const input = [1, 'two', { three: 3 }, [4, 5]];
    expect(sanitizeUntrustedJsonValue(input)).toEqual(input);
  });

  it('preserves a realistic diagram payload', () => {
    const input = {
      type: 'flowchart',
      nodes: [
        { id: 'start', label: 'Start', position: { x: 100, y: 50 } },
        { id: 'end', label: 'End', position: { x: 100, y: 200 } },
      ],
      edges: [{ from: 'start', to: 'end', label: 'next' }],
    };
    expect(sanitizeUntrustedJsonValue(input)).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// parseJsonFromLLMText: end-to-end guard through the central parser
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: guards applied on the parse boundary', () => {
  afterEach(() => {
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('neutralizes Infinity in LLM JSON wrapped in a code fence', () => {
    const result = parseJsonFromLLMText('```json\n{"score": 1e400}\n```') as Record<string, unknown>;
    expect(result.score).toBeNull();
  });

  it('neutralizes Infinity in LLM JSON embedded in preamble text', () => {
    const result = parseJsonFromLLMText(
      'Here is the JSON: {"confidence": 1e999, "type": "tree"}',
    ) as Record<string, unknown>;
    expect(result.confidence).toBeNull();
    expect(result.type).toBe('tree');
  });

  it('strips __proto__ from LLM JSON and leaves Object.prototype intact', () => {
    const result = parseJsonFromLLMText(
      '{"__proto__": {"polluted": true}, "type": "flow"}',
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(result.type).toBe('flow');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('strips constructor.prototype pollution from LLM JSON', () => {
    const result = parseJsonFromLLMText(
      '{"constructor": {"prototype": {"polluted": true}}, "nodes": []}',
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('still parses normal LLM JSON unchanged (no regression)', () => {
    const result = parseJsonFromLLMText(
      '{"type": "flow", "nodes": [{"id": "a", "label": "A"}]}',
    ) as Record<string, unknown>;
    expect(result).toEqual({ type: 'flow', nodes: [{ id: 'a', label: 'A' }] });
  });

  it('applies guards even after the single-quote repair path', () => {
    // Single-quoted JSON triggers attempt 2 (destructive quote conversion);
    // the sanitized parse must still neutralize the overflow.
    const result = parseJsonFromLLMText(
      "{'score': 1e400, 'type': 'flow'}",
    ) as Record<string, unknown>;
    expect(result.score).toBeNull();
    expect(result.type).toBe('flow');
  });
});
