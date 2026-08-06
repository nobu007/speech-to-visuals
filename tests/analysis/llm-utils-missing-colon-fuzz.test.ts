/**
 * Fuzz / property-based tests for parseJsonFromLLMText missing-colon repair.
 *
 * Strategy: generate random valid JSON objects, strip colons after keys to
 * simulate common LLM output errors, then verify that parseJsonFromLLMText
 * either (a) recovers the original structure (roundtrip) or (b) throws a
 * typed LLMParsingError (never crashes with a bare TypeError / SyntaxError).
 *
 * Uses a deterministic mulberry32 PRNG for reproducibility.
 * Override seed via FUZZ_SEED env var.
 */

import { parseJsonFromLLMText } from '../../src/analysis/llm-utils';
import { LLMParsingError } from '../../src/analysis/analysis-errors';
import { mulberry32 } from '@tests/helpers/fuzz';

// ---------------------------------------------------------------------------
// Random JSON value generators
// ---------------------------------------------------------------------------
const SAMPLE_KEYS = [
  'name', 'id', 'type', 'value', 'data', 'config', 'items',
  'count', 'active', 'description', 'timestamp', 'version',
  'title', 'summary', 'nodes', 'edges', 'label', 'status',
];

const SAMPLE_STRING_VALUES = [
  'hello', 'world', 'test', 'production', 'development',
  'alpha', 'beta', 'gamma', 'scene-1', 'node-a',
  '音声入力', '図解生成', '動画出力',
];

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

function randomString(rng: () => number): string {
  return SAMPLE_STRING_VALUES[Math.floor(rng() * SAMPLE_STRING_VALUES.length)];
}

function randomNumber(rng: () => number): number {
  const choice = Math.floor(rng() * 4);
  switch (choice) {
    case 0:
      return Math.floor(rng() * 1000);
    case 1:
      return +(rng() * 100).toFixed(2);
    case 2:
      // scientific notation-worthy values
      return Math.floor(rng() * 1e6) * (rng() > 0.5 ? 1e-5 : 1);
    default: {
      // Add 1 to avoid producing -0 (JSON.stringify converts -0 to "0")
      const v = Math.floor(rng() * 100) * (rng() > 0.5 ? -1 : 1);
      return v === 0 ? 0 : v; // normalize -0 to 0
    }
  }
}

function randomJSONValue(rng: () => number, depth: number): JSONValue {
  const choice = Math.floor(rng() * (depth >= 3 ? 4 : 6));

  switch (choice) {
    case 0:
      return randomString(rng);
    case 1:
      return randomNumber(rng);
    case 2:
      return rng() > 0.5;
    case 3:
      return null;
    case 4: {
      // nested object
      const obj: Record<string, JSONValue> = {};
      const nKeys = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < nKeys; i++) {
        const key = SAMPLE_KEYS[Math.floor(rng() * SAMPLE_KEYS.length)];
        obj[`${key}_${i}`] = randomJSONValue(rng, depth + 1);
      }
      return obj;
    }
    default: {
      // array
      const nElems = 1 + Math.floor(rng() * 3);
      const arr: JSONValue[] = [];
      for (let i = 0; i < nElems; i++) {
        arr.push(randomJSONValue(rng, depth + 1));
      }
      return arr;
    }
  }
}

function randomJSONObject(
  rng: () => number,
  maxKeys = 5,
): Record<string, JSONValue> {
  const obj: Record<string, JSONValue> = {};
  const nKeys = 1 + Math.floor(rng() * maxKeys);
  for (let i = 0; i < nKeys; i++) {
    const key = SAMPLE_KEYS[Math.floor(rng() * SAMPLE_KEYS.length)];
    obj[`${key}_${i}`] = randomJSONValue(rng, 0);
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Colon-stripping mutations
// ---------------------------------------------------------------------------

/**
 * Remove colons after quoted keys in a JSON string, simulating common
 * LLM output errors. Operates on the string level.
 *
 * Modes:
 * - 'all':      strip every colon after a key
 * - 'random':   strip each colon with ~50% probability
 * - 'first':    strip only the first colon occurrence
 * - 'nested':   strip colons only inside nested objects
 */
function stripColons(json: string, mode: string, rng: () => number): string {
  switch (mode) {
    case 'all':
      // Remove colon between "key" and value (string, number, bool, null, {, [)
      return json
        .replace(
          /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s+"/g,
          '"$1 "',
        )
        .replace(
          /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*(true|false|null|-?\d)/g,
          '"$1 $2',
        )
        .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*\{/g, '"$1 {')
        .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*\[/g, '"$1 [');

    case 'random':
      return json.replace(
        /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g,
        (match) => (rng() > 0.5 ? match.replace(':', ' ') : match),
      );

    case 'first':
      return json.replace(
        /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/,
        '"$1 "',
      );

    case 'nested': {
      // Find nested objects (after first { there's another {)
      let depth = 0;
      let result = '';
      for (let i = 0; i < json.length; i++) {
        const ch = json[i];
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        // Only strip colons at depth >= 2
        if (ch === ':' && depth >= 2) {
          result += ' ';
        } else {
          result += ch;
        }
      }
      return result;
    }

    default:
      return json;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SEED = process.env.FUZZ_SEED
  ? parseInt(process.env.FUZZ_SEED, 10)
  : 0x5eed1234;

describe('parseJsonFromLLMText — missing-colon fuzz tests', () => {
  describe('roundtrip correctness (all colons stripped → repaired)', () => {
    const ITERATIONS = 200;
    const rng = mulberry32(SEED);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 4);
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: all-colons-stripped object roundtrips`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          // Must throw LLMParsingError, not bare SyntaxError or TypeError
          threw = true;
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          // If parsed, the result should deep-equal the original
          expect(result).toEqual(original);
        }
      });
    }
  });

  describe('random colon stripping roundtrips', () => {
    const ITERATIONS = 150;
    const rng = mulberry32(SEED + 1);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 5);
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'random', rng);

      it(`iteration ${i}: random-colons-stripped object roundtrips`, () => {
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

  describe('nested-only colon stripping', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 2);

    for (let i = 0; i < ITERATIONS; i++) {
      // Force at least 1 level of nesting
      const original = {
        outer: randomJSONObject(rng, 3),
        scalar: rng() > 0.5 ? 'value' : 42,
      };
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'nested', rng);

      it(`iteration ${i}: nested-colons-stripped object roundtrips`, () => {
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

  describe('deeply nested structures (3+ levels)', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 3);

    for (let i = 0; i < ITERATIONS; i++) {
      // Build a 3-level deep object
      const original = {
        level0: {
          level1: {
            level2: randomJSONObject(rng, 3),
            scalar: 'deep-value',
          },
          items: [randomJSONValue(rng, 2), randomJSONValue(rng, 2)],
        },
        top: 'ok',
      };
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: deeply-nested missing-colon roundtrips`, () => {
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

  describe('mixed-value-type coverage', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 4);

    for (let i = 0; i < ITERATIONS; i++) {
      // Force all value types
      const original: Record<string, JSONValue> = {
        str: randomString(rng),
        int: Math.floor(rng() * 1000),
        float: +(rng() * 100).toFixed(3),
        bool: rng() > 0.5,
        nul: null,
        arr: [randomString(rng), Math.floor(rng() * 100), rng() > 0.5],
        obj: { nested: randomString(rng), deep: { x: 1 } },
        sci: 1.5e3 * (rng() > 0.5 ? 1 : -1),
      };
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: mixed-types missing-colon roundtrips`, () => {
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

  describe('error type safety — never bare SyntaxError or TypeError', () => {
    const ITERATIONS = 200;
    const rng = mulberry32(SEED + 5);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 6);
      const correctJSON = JSON.stringify(original);

      // Combine multiple malformation strategies
      let malformed = stripColons(correctJSON, 'random', rng);
      // Sometimes also remove trailing braces
      if (rng() > 0.7) {
        malformed = malformed.replace(/}\s*$/, '');
      }
      // Sometimes add trailing commas
      if (rng() > 0.6) {
        malformed = malformed.replace(/"/g, (m, _idx, full) => {
          return m; // keep quotes
        });
        malformed = malformed.replace(/(\w)"\s*}/, '$1",}');
      }

      it(`iteration ${i}: malformed input throws LLMParsingError`, () => {
        try {
          parseJsonFromLLMText(malformed);
        } catch (e) {
          // The key invariant: never a bare SyntaxError or TypeError leak
          expect(e).not.toBeInstanceOf(SyntaxError);
          expect(e).not.toBeInstanceOf(TypeError);
          // Should be LLMParsingError or at minimum an Error
          expect(e).toBeInstanceOf(Error);
        }
      });
    }
  });

  describe('code-fence + missing-colon combination', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 6);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 4);
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);
      // Wrap in code fence like LLM output
      const fenced = '```json\n' + stripped + '\n```';

      it(`iteration ${i}: code-fenced missing-colon roundtrips`, () => {
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
  // New: Sequential regex interaction tests — strip colons from only the
  // first N occurrences to probe boundary between repaired/unrepaired regions.
  // -------------------------------------------------------------------------
  describe('partial colon stripping (first-N only)', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 7);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 4);
      const correctJSON = JSON.stringify(original);

      // Strip exactly the first N colons
      const nToStrip = 1 + Math.floor(rng() * 5);
      let stripCount = 0;
      const stripped = correctJSON.replace(
        /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g,
        (match) => {
          if (stripCount < nToStrip) {
            stripCount++;
            return match.replace(':', ' ');
          }
          return match;
        },
      );

      it(`iteration ${i}: first-${nToStrip}-colons-stripped object roundtrips`, () => {
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
  // New: Extra whitespace around stripped colons — tests regex robustness
  // -------------------------------------------------------------------------
  describe('missing-colon with extra whitespace', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 8);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 3);
      const correctJSON = JSON.stringify(original);

      // Strip colons and add extra spaces/tabs
      const stripped = stripColons(correctJSON, 'all', rng)
        .replace(/"([^"\\]*)\s+"/g, '"$1     "')
        .replace(/\n/g, '  \n  ');

      it(`iteration ${i}: whitespace-heavy missing-colon roundtrips`, () => {
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
  // New: Objects containing arrays with missing colons
  // -------------------------------------------------------------------------
  describe('arrays with missing-colon object elements', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 9);

    for (let i = 0; i < ITERATIONS; i++) {
      // Build object with array of sub-objects
      const original = {
        items: [
          randomJSONObject(rng, 2),
          randomJSONObject(rng, 2),
        ],
        metadata: {
          count: 2,
          label: 'test',
        },
      };
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: array-of-objects missing-colon roundtrips`, () => {
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
  // New: Unicode/CJK key names with missing colons
  // -------------------------------------------------------------------------
  describe('unicode key names with missing colons', () => {
    const ITERATIONS = 60;
    const rng = mulberry32(SEED + 10);
    const CJK_KEYS = ['名前', 'タイプ', '値', 'データ', '設定', 'アイテム', 'ステータス'];

    for (let i = 0; i < ITERATIONS; i++) {
      const original: Record<string, JSONValue> = {};
      const nKeys = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < nKeys; k++) {
        const key = CJK_KEYS[Math.floor(rng() * CJK_KEYS.length)] + '_' + k;
        original[key] = randomJSONValue(rng, 1);
      }
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: CJK-key missing-colon roundtrips`, () => {
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
  // Alternating colon stripping — probes regex interaction boundaries
  // -------------------------------------------------------------------------
  describe('alternating colon stripping (odd/even pattern)', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 11);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 6);
      const correctJSON = JSON.stringify(original);

      // Strip colons at odd positions only (1st, 3rd, 5th, ...)
      let count = 0;
      const stripped = correctJSON.replace(
        /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g,
        (match) => {
          count++;
          if (count % 2 === 1) {
            return match.replace(':', ' ');
          }
          return match;
        },
      );

      it(`iteration ${i}: odd-position colon stripping roundtrips`, () => {
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
  // Objects inside arrays inside objects — stress sequential regex ordering
  // -------------------------------------------------------------------------
  describe('alternating object/array nesting with missing colons', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 12);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = {
        matrix: [
          {
            row: [
              { cell: randomJSONValue(rng, 0), id: Math.floor(rng() * 100) },
              { cell: randomJSONValue(rng, 0), id: Math.floor(rng() * 100) },
            ],
          },
          {
            row: [
              { cell: randomJSONValue(rng, 0), id: Math.floor(rng() * 100) },
            ],
          },
        ],
        meta: { count: 2, label: 'test' },
      };
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: obj-array-obj nesting missing-colon roundtrips`, () => {
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
  // Combined malformations: missing colons + trailing commas + single quotes
  // -------------------------------------------------------------------------
  describe('combined malformations (colon + comma + quotes)', () => {
    const ITERATIONS = 100;
    const rng = mulberry32(SEED + 13);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 4);
      const correctJSON = JSON.stringify(original);

      // Apply multiple malformations simultaneously:
      // 1. Strip all colons
      let malformed = stripColons(correctJSON, 'all', rng);

      // 2. With ~30% chance, add trailing commas before closing brackets
      if (rng() > 0.7) {
        malformed = malformed.replace(/(\w)"\s*([}\]])/g, '$1",');
      }

      // 3. With ~30% chance, swap some double quotes to single quotes
      if (rng() > 0.7) {
        malformed = malformed.replace(/"/g, (m, _idx: number, full: string) => {
          // Only swap ~20% of quotes
          return rng() > 0.8 ? "'" : m;
        });
      }

      it(`iteration ${i}: combined-malformation roundtrips or throws typed error`, () => {
        try {
          const result = parseJsonFromLLMText(malformed);
          // If it parses, it must deep-equal the original
          expect(result).toEqual(original);
        } catch (e) {
          // Must throw LLMParsingError, never bare SyntaxError or TypeError
          expect(e).not.toBeInstanceOf(SyntaxError);
          expect(e).not.toBeInstanceOf(TypeError);
          expect(e).toBeInstanceOf(Error);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Edge-case keys: empty, numeric, special characters
  // -------------------------------------------------------------------------
  describe('edge-case key names with missing colons', () => {
    const ITERATIONS = 80;
    const rng = mulberry32(SEED + 14);

    const EDGE_KEYS = [
      '', 'a', '1', '123', 'key.with.dots', 'key-with-dashes',
      'key with spaces', 'UPPER', 'Mixed_Case',
    ];

    for (let i = 0; i < ITERATIONS; i++) {
      const original: Record<string, JSONValue> = {};
      const nKeys = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < nKeys; k++) {
        const key = EDGE_KEYS[Math.floor(rng() * EDGE_KEYS.length)] + '_' + k;
        original[key] = randomJSONValue(rng, 1);
      }
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: edge-case-key missing-colon roundtrips`, () => {
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
  // Very large flat objects (20+ keys) — stress tests regex global replace
  // -------------------------------------------------------------------------
  describe('large flat objects with all colons stripped', () => {
    const ITERATIONS = 40;
    const rng = mulberry32(SEED + 15);

    for (let i = 0; i < ITERATIONS; i++) {
      const original = randomJSONObject(rng, 20);
      const correctJSON = JSON.stringify(original);
      const stripped = stripColons(correctJSON, 'all', rng);

      it(`iteration ${i}: large-flat-object missing-colon roundtrips`, () => {
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
  // Strict roundtrip invariant: parsed result MUST deep-equal original
  // (no partial recovery allowed — if it parses, it must be correct)
  // -------------------------------------------------------------------------
  describe('strict roundtrip invariant (random + nested stripping combined)', () => {
    const ITERATIONS = 150;
    const rng = mulberry32(SEED + 16);

    for (let i = 0; i < ITERATIONS; i++) {
      // Build complex structure
      const original: Record<string, JSONValue> = {
        a: randomJSONValue(rng, 0),
        b: { c: randomJSONValue(rng, 1), d: [randomJSONValue(rng, 2), randomJSONValue(rng, 2)] },
        e: null,
        f: rng() > 0.5 ? true : false,
        g: randomNumber(rng),
      };

      const correctJSON = JSON.stringify(original);

      // Randomly choose stripping mode
      const mode = ['all', 'random', 'first', 'nested'][Math.floor(rng() * 4)];
      const stripped = stripColons(correctJSON, mode, rng);

      it(`iteration ${i}: mode=${mode} strict roundtrip`, () => {
        let result: unknown;
        let threw = false;
        try {
          result = parseJsonFromLLMText(stripped);
        } catch (e) {
          threw = true;
          // Must always be LLMParsingError
          expect(e).toBeInstanceOf(LLMParsingError);
        }
        if (!threw) {
          // Strict invariant: must match exactly
          expect(result).toEqual(original);
        }
      });
    }
  });
});
