/**
 * Deep-nesting + sequential regex interaction fuzz tests for parseJsonFromLLMText.
 *
 * Focus: probe scenarios where the sequential regex replacements in Strategy 4
 * may interact in unexpected ways — specifically deeply nested structures (5+ levels),
 * keys that look like JSON values, and multiple simultaneous malformations.
 *
 * Uses a deterministic mulberry32 PRNG for reproducibility.
 * Override seed via FUZZ_SEED env var.
 */

import { parseJsonFromLLMText } from '../../src/analysis/llm-utils';
import { LLMParsingError } from '../../src/analysis/analysis-errors';
import { mulberry32 } from '@tests/helpers/fuzz';

// ---------------------------------------------------------------------------
// Deep nested JSON generators
// ---------------------------------------------------------------------------
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

const SCALAR_VALUES: JSONValue[] = [
  'hello', 42, 3.14, true, false, null, 'world', 0, -1, 1e5,
  'テスト', '図解', 100, -273.15, '', 'a',
];

function randomScalar(rng: () => number): JSONValue {
  return SCALAR_VALUES[Math.floor(rng() * SCALAR_VALUES.length)];
}

/**
 * Generate a deeply nested object with the specified depth.
 * At depth 0, returns a scalar. At depth > 0, returns an object with
 * a mix of nested and scalar values.
 */
function generateDeepNested(
  rng: () => number,
  depth: number,
  breadth: number = 2,
): JSONValue {
  if (depth <= 0) {
    return randomScalar(rng);
  }
  const obj: Record<string, JSONValue> = {};
  const nKeys = 1 + Math.floor(rng() * breadth);
  for (let i = 0; i < nKeys; i++) {
    const key = `d${depth}_k${i}`;
    // ~60% chance to recurse deeper, ~40% chance for scalar
    if (rng() > 0.4) {
      obj[key] = generateDeepNested(rng, depth - 1, breadth);
    } else {
      obj[key] = randomScalar(rng);
    }
  }
  return obj;
}

/**
 * Generate a deeply nested object that mixes objects and arrays at each level.
 * This stresses the sequential regex ordering since arrays and objects
 * use different bracket types.
 */
function generateMixedNested(
  rng: () => number,
  depth: number,
): JSONValue {
  if (depth <= 0) {
    return randomScalar(rng);
  }
  if (rng() > 0.5) {
    // Object branch
    const obj: Record<string, JSONValue> = {};
    const nKeys = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < nKeys; i++) {
      obj[`k${i}`] = generateMixedNested(rng, depth - 1);
    }
    return obj;
  } else {
    // Array branch
    const nElems = 1 + Math.floor(rng() * 3);
    const arr: JSONValue[] = [];
    for (let i = 0; i < nElems; i++) {
      arr.push(generateMixedNested(rng, depth - 1));
    }
    return arr;
  }
}

// ---------------------------------------------------------------------------
// Colon-stripping utilities
// ---------------------------------------------------------------------------

/**
 * Strip all colons after quoted keys in JSON string.
 * Simulates an LLM that consistently omits colons.
 */
function stripAllColons(json: string): string {
  return json
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s+"/g, '"$1 "')
    .replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*(true|false|null|-?\d)/g,
      '"$1 $2',
    )
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*\{/g, '"$1 {')
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*\[/g, '"$1 [');
}

/**
 * Strip colons only at a specific nesting depth.
 * This probes whether the sequential regex replacements can handle
 * partial malformation at various depths.
 */
function stripColonsAtDepth(json: string, targetDepth: number): string {
  let depth = 0;
  let result = '';
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (ch === ':' && depth === targetDepth) {
      result += ' ';
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Strip colons with a given probability, controlled by rng.
 */
function stripColonsRandomly(json: string, prob: number, rng: () => number): string {
  return json.replace(
    /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g,
    (match) => (rng() < prob ? match.replace(':', ' ') : match),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SEED = process.env.FUZZ_SEED
  ? parseInt(process.env.FUZZ_SEED, 10)
  : 0xdee57575;

describe('parseJsonFromLLMText — deep nesting + regex interaction fuzz', () => {
  // -------------------------------------------------------------------------
  // 5-level deep nested objects with ALL colons stripped
  // -------------------------------------------------------------------------
  describe('5-level deep nesting — all colons stripped', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 1);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 5, 2);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: depth-5 all-colons-stripped roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // 7-level deep nested objects — stress sequential regex backtracking
  // -------------------------------------------------------------------------
  describe('7-level deep nesting — all colons stripped', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 2);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 7, 2);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: depth-7 all-colons-stripped roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // 10-level deep nesting — extreme stress on regex interaction
  // -------------------------------------------------------------------------
  describe('10-level deep nesting — all colons stripped', () => {
    const ITERATIONS = 30;
    const rng = mulberry32(SEED + 3);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 10, 1);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: depth-10 all-colons-stripped roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Mixed object/array nesting at depth 5 — different bracket types
  // stress the ordering of the four separate regex replacements
  // -------------------------------------------------------------------------
  describe('mixed obj/array nesting (depth 5) — all colons stripped', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 4);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateMixedNested(rng, 5);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: mixed-nesting depth-5 all-colons-stripped roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Colons stripped only at specific depths — probes regex's ability
  // to repair at one depth without corrupting correctly-formed pairs elsewhere
  // -------------------------------------------------------------------------
  describe('depth-targeted colon stripping', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 5);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 4, 3);
      const correctJSON = JSON.stringify(original);
      const targetDepth = 2 + Math.floor(rng() * 3); // depth 2-4
      const stripped = stripColonsAtDepth(correctJSON, targetDepth);

      it(`iteration ${i}: depth-${targetDepth}-targeted colon stripping roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Variable-probability colon stripping at different depths simultaneously
  // -------------------------------------------------------------------------
  describe('variable-probability colon stripping across depths', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 6);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateMixedNested(rng, 5);
      const correctJSON = JSON.stringify(original);
      const prob = 0.3 + rng() * 0.6; // 30%-90% stripping probability
      const stripped = stripColonsRandomly(correctJSON, prob, rng);

      it(`iteration ${i}: prob=${prob.toFixed(2)} colon stripping roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Deeply nested with adjacent key-value pairs on the same line.
  // When colons are stripped from adjacent pairs, the regex must not
  // accidentally merge values from different pairs.
  // -------------------------------------------------------------------------
  describe('adjacent pairs with stripped colons — no cross-contamination', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 7);

    for (let i = 0; i < ITERATIONS; i++) {
      // Build object with many keys at each level
      const original: Record<string, JSONValue> = {};
      for (let k = 0; k < 5; k++) {
        original[`key_${k}`] = `value_${k}`;
      }
      // Add a nested level
      original.nested = {};
      for (let k = 0; k < 5; k++) {
        (original.nested as Record<string, JSONValue>)[`inner_${k}`] = `inner_val_${k}`;
      }

      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: adjacent-pairs no cross-contamination`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Error-type safety for deeply nested malformed inputs — must never
  // throw bare TypeError or SyntaxError
  // -------------------------------------------------------------------------
  describe('deep nested malformed — error type safety', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 8);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 5, 3);
      let malformed = JSON.stringify(original);

      // Apply random combination of malformations
      const malformations = [
        () => { malformed = stripAllColons(malformed); },
        () => { malformed = stripColonsRandomly(malformed, 0.7, rng); },
        () => {
          // Remove trailing closing braces/brackets
          malformed = malformed.replace(/[}\]]\s*$/, '');
        },
        () => {
          // Add extra trailing commas
          malformed = malformed.replace(/"/g, (m, _idx: number, full: string) => m)
            .replace(/(\w)"(\s*[}\]])/g, '$1",$2');
        },
        () => {
          // Introduce stray single quotes
          malformed = malformed.replace(/"/g, (m) => (rng() > 0.9 ? "'" : m));
        },
      ];

      // Apply 1-3 random malformations
      const nMalform = 1 + Math.floor(rng() * 3);
      for (let m = 0; m < nMalform; m++) {
        const idx = Math.floor(rng() * malformations.length);
        malformations[idx]();
      }

      it(`iteration ${i}: deep+malformed throws typed error`, () => {
        try {
          parseJsonFromLLMText(malformed);
        } catch (e) {
          expect(e).not.toBeInstanceOf(SyntaxError);
          expect(e).not.toBeInstanceOf(TypeError);
          expect(e).toBeInstanceOf(Error);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Keys that look like JSON values — stress regex disambiguation
  // e.g., {"true": "false", "null": 42, "123": "value"}
  // -------------------------------------------------------------------------
  describe('keys resembling JSON literals with missing colons', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 9);
    const TRICKY_KEYS = ['true', 'false', 'null', '123', '0', '-1', '1.5', '1e10'];

    for (let i = 0; i < ITERATIONS; i++) {
      const original: Record<string, JSONValue> = {};
      const nKeys = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < nKeys; k++) {
        const key = TRICKY_KEYS[Math.floor(rng() * TRICKY_KEYS.length)];
        original[`${key}_${k}`] = randomScalar(rng);
      }
      // Add nested object with tricky keys
      original.nested = {};
      for (let k = 0; k < 2; k++) {
        const key = TRICKY_KEYS[Math.floor(rng() * TRICKY_KEYS.length)];
        (original.nested as Record<string, JSONValue>)[key] = randomScalar(rng);
      }

      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: tricky keys with missing colons roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Objects containing escaped quotes in keys/values with missing colons
  // -------------------------------------------------------------------------
  describe('escaped quotes in keys/values with missing colons', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 10);

    for (let i = 0; i < ITERATIONS; i++) {
      const original: Record<string, JSONValue> = {
        'key"with"quotes': 'val"with"quotes',
        'back\\slash': 'for\\ward',
        'tab\there': 'new\nline',
        normal: 'value',
        nested: {
          'inner"quote': 'inner"val',
          deep: 'value',
        },
      };

      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: escaped quotes missing-colon roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Code fence + deep nesting + missing colons — simulates real LLM output
  // -------------------------------------------------------------------------
  describe('code-fenced deep nested with missing colons', () => {
    const ITERATIONS = 50;
    const rng = mulberry32(SEED + 11);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = generateDeepNested(rng, 5, 3);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);
      // Wrap in code fence like LLM output
      const fenced = '```json\n' + stripped + '\n```';

      it(`iteration ${i}: code-fenced deep-nested missing-colon roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(fenced);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Strict roundtrip across all depths and stripping modes combined
  // -------------------------------------------------------------------------
  describe('strict cross-depth roundtrip (comprehensive)', () => {
    const ITERATIONS = 120;
    const rng = mulberry32(SEED + 12);
    const DEPTHS = [3, 4, 5, 6, 7];

    for (let i = 0; i < ITERATIONS; i++) {
      const depth = DEPTHS[Math.floor(rng() * DEPTHS.length)];
      const original = generateMixedNested(rng, depth);
      const correctJSON = JSON.stringify(original);
      const stripped = stripAllColons(correctJSON);

      it(`iteration ${i}: depth=${depth} strict roundtrip`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          expect(result).toEqual(original);
        }
      });
    }
  });
});
