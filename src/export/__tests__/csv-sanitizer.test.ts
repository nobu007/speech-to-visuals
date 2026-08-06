/**
 * Property-based fuzz tests for csv-sanitizer module.
 *
 * Verifies:
 * 1. Formula injection prevention (=, +, -, @ prefixes neutralized)
 * 2. RFC 4180 quoting correctness (delimiters, quotes, newlines)
 * 3. Round-trip safety: sanitized output never starts with a formula trigger
 * 4. No crash on degenerate inputs (null, undefined, objects, binary)
 * 5. CSV audit catches unescaped formula vectors in raw CSV strings
 *
 * References:
 * - OWASP CSV Injection mitigation
 * - RFC 4180 quoting rules
 */

import {
  sanitizeCsvCell,
  quoteCsvField,
  buildCsvRow,
  buildCsvDocument,
  auditCsvFormulaInjection,
} from '../csv-sanitizer';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('sanitizeCsvCell', () => {
  describe('formula injection prevention', () => {
    it('neutralizes = prefix', () => {
      expect(sanitizeCsvCell('=cmd|"/c calc"!A1')).toBe("'=cmd|\"/c calc\"!A1");
    });

    it('neutralizes + prefix', () => {
      expect(sanitizeCsvCell('+cmd|"/c calc"!A1')).toBe("'+cmd|\"/c calc\"!A1");
    });

    it('neutralizes - prefix', () => {
      expect(sanitizeCsvCell('-1+cmd|"/c calc"!A1')).toBe("'-1+cmd|\"/c calc\"!A1");
    });

    it('neutralizes @ prefix', () => {
      expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    });

    it('neutralizes tab prefix', () => {
      expect(sanitizeCsvCell('\t=cmd')).toBe("'\t=cmd");
    });

    it('neutralizes CR prefix', () => {
      expect(sanitizeCsvCell('\r=cmd')).toBe("'\r=cmd");
    });

    it('does NOT modify safe string values', () => {
      expect(sanitizeCsvCell('Hello World')).toBe('Hello World');
      expect(sanitizeCsvCell('123.45')).toBe('123.45');
      expect(sanitizeCsvCell('normal "quoted" value')).toBe('normal "quoted" value');
    });

    it('does NOT modify leading whitespace without trigger', () => {
      expect(sanitizeCsvCell('  Hello')).toBe('  Hello');
      expect(sanitizeCsvCell('  (parens)')).toBe('  (parens)');
    });

    it('neutralizes whitespace-bypassed formula injection', () => {
      const result = sanitizeCsvCell('  =cmd');
      expect(result.startsWith("'")).toBe(true);
    });

    it('handles empty string', () => {
      expect(sanitizeCsvCell('')).toBe('');
    });
  });

  describe('non-string types', () => {
    it('converts finite numbers to string', () => {
      expect(sanitizeCsvCell(42)).toBe('42');
      expect(sanitizeCsvCell(3.14)).toBe('3.14');
      expect(sanitizeCsvCell(0)).toBe('0');
      expect(sanitizeCsvCell(-1)).toBe('-1'); // negative numbers are not formula injection
    });

    it('returns empty for NaN', () => {
      expect(sanitizeCsvCell(NaN)).toBe('');
    });

    it('returns empty for Infinity', () => {
      expect(sanitizeCsvCell(Infinity)).toBe('');
      expect(sanitizeCsvCell(-Infinity)).toBe('');
    });

    it('converts booleans', () => {
      expect(sanitizeCsvCell(true)).toBe('true');
      expect(sanitizeCsvCell(false)).toBe('false');
    });

    it('returns empty for null and undefined', () => {
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
    });

    it('JSON-stringifies objects', () => {
      expect(sanitizeCsvCell({ a: 1 })).toBe('{"a":1}');
      expect(sanitizeCsvCell([1, 2, 3])).toBe('[1,2,3]');
    });
  });
});

describe('quoteCsvField', () => {
  it('does not quote simple values', () => {
    expect(quoteCsvField('hello')).toBe('hello');
    expect(quoteCsvField('123')).toBe('123');
  });

  it('quotes values containing delimiter', () => {
    expect(quoteCsvField('a,b,c')).toBe('"a,b,c"');
  });

  it('quotes values containing double quotes', () => {
    expect(quoteCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('quotes values containing newlines', () => {
    expect(quoteCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(quoteCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('quotes values containing carriage returns', () => {
    expect(quoteCsvField('col1\rcol2')).toBe('"col1\rcol2"');
  });

  it('handles formula injection + quoting together', () => {
    // = prefix neutralized, then comma triggers quoting
    const result = quoteCsvField('=cmd,a,b');
    expect(result.startsWith('"')).toBe(true);
    expect(result.endsWith('"')).toBe(true);
    expect(result).toContain("'=cmd");
  });

  it('supports custom delimiter', () => {
    expect(quoteCsvField('a;b;c', ';')).toBe('"a;b;c"');
    expect(quoteCsvField('a,b,c', ';')).toBe('a,b,c');
  });
});

describe('buildCsvRow', () => {
  it('builds a simple row', () => {
    expect(buildCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('quotes fields needing quoting', () => {
    expect(buildCsvRow(['safe', 'has,comma', 'safe'])).toBe('safe,"has,comma",safe');
  });

  it('handles mixed types', () => {
    expect(buildCsvRow([1, 'text', true, null])).toBe('1,text,true,');
  });

  it('sanitizes formula injection in each cell', () => {
    const row = buildCsvRow(['=evil', 'safe', '+bad']);
    expect(row).toContain("'=evil");
    expect(row).toContain("'+bad");
    expect(row).toContain('safe');
  });
});

describe('buildCsvDocument', () => {
  it('builds a complete CSV with header', () => {
    const csv = buildCsvDocument([
      ['id', 'name', 'value'],
      [1, 'Alice', 100],
      [2, 'Bob', 200],
    ]);
    expect(csv).toBe('id,name,value\r\n1,Alice,100\r\n2,Bob,200');
  });

  it('uses CRLF line separator', () => {
    const csv = buildCsvDocument([['a'], ['b']]);
    expect(csv).toContain('\r\n');
  });

  it('handles empty rows', () => {
    const csv = buildCsvDocument([[]]);
    expect(csv).toBe('');
  });

  it('handles rows with different lengths', () => {
    const csv = buildCsvDocument([
      ['a', 'b', 'c'],
      ['1', '2'],
      ['x', 'y', 'z', 'w'],
    ]);
    expect(csv).toContain('a,b,c');
    expect(csv).toContain('1,2');
    expect(csv).toContain('x,y,z,w');
  });
});

describe('auditCsvFormulaInjection', () => {
  it('finds no issues in safe CSV', () => {
    const csv = 'id,name\n1,Alice\n2,Bob';
    const findings = auditCsvFormulaInjection(csv);
    expect(findings).toHaveLength(0);
  });

  it('detects = prefix in unquoted cell', () => {
    const csv = 'id,name\n1,=cmd';
    const findings = auditCsvFormulaInjection(csv);
    expect(findings).toHaveLength(1);
    expect(findings[0].row).toBe(1);
    expect(findings[0].trigger).toBe('=');
  });

  it('skips quoted cells', () => {
    const csv = 'id,name\n1,"=cmd"';
    const findings = auditCsvFormulaInjection(csv);
    expect(findings).toHaveLength(0);
  });

  it('skips neutralized cells (leading quote)', () => {
    const csv = "id,name\n1,'=cmd";
    const findings = auditCsvFormulaInjection(csv);
    expect(findings).toHaveLength(0);
  });

  it('detects multiple formula triggers', () => {
    const csv = 'id,formula1,formula2\n1,=cmd,+evil';
    const findings = auditCsvFormulaInjection(csv);
    expect(findings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Property-based fuzz tests
// ---------------------------------------------------------------------------

const SEED = 42;
const ITERATIONS = 50;

/** Generate a random ASCII string of given length */
function randomString(rng: () => number, maxLen: number): string {
  const len = Math.floor(rng() * maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    // Range 32-126 (printable ASCII) + selected special chars
    const code = 32 + Math.floor(rng() * 95);
    s += String.fromCharCode(code);
  }
  return s;
}

/** Generate a random formula injection payload */
function randomFormulaPayload(rng: () => number): string {
  const trigger = FORMULA_TRIGGERS[Math.floor(rng() * FORMULA_TRIGGERS.length)];
  const suffix = randomString(rng, 20);
  const prefix = rng() > 0.5 ? '' : '  '; // sometimes add leading whitespace
  return prefix + trigger + suffix;
}

describe('Property-based: sanitizeCsvCell', () => {
  describe('invariant: sanitized output never starts with a formula trigger', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: formula payload neutralized`, () => {
        const rng = mulberry32(SEED + i);
        const payload = randomFormulaPayload(rng);
        const result = sanitizeCsvCell(payload);

        // Property: after sanitization, the trimmed result must not start with
        // a formula trigger (unless neutralized by leading quote)
        const trimmedResult = result.trimStart();
        if (trimmedResult.length > 0) {
          const startsWithTrigger = FORMULA_TRIGGERS.includes(trimmedResult[0]);
          const isNeutralized = result.startsWith("'");
          expect(isNeutralized || !startsWithTrigger).toBe(true);
        }
      });
    }
  });

  describe('invariant: safe strings are never modified', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: safe string unchanged`, () => {
        const rng = mulberry32(SEED + i + 1000);
        // Generate a string that does NOT start with a formula trigger
        let s: string;
        do {
          s = randomString(rng, 30);
        } while (s.length > 0 && FORMULA_TRIGGERS.includes(s.trimStart()[0]));

        const result = sanitizeCsvCell(s);
        expect(result).toBe(s);
      });
    }
  });

  describe('invariant: never crashes on any input type', () => {
    const degenerateInputs: Array<{ name: string; value: unknown }> = [
      { name: 'null', value: null },
      { name: 'undefined', value: undefined },
      { name: 'NaN', value: NaN },
      { name: 'Infinity', value: Infinity },
      { name: '-Infinity', value: -Infinity },
      { name: 'empty string', value: '' },
      { name: 'very long string', value: 'a'.repeat(100000) },
      { name: 'only whitespace', value: '   \t\r\n  ' },
      { name: 'all formula triggers', value: '=+-@\t\r=+-@\t\r' },
      { name: 'unicode', value: '\u0000\u0001\uFFFF' },
      { name: 'object', value: { toString: () => 'stringified' } },
      { name: 'array', value: [1, [2, [3]]] },
      { name: 'circular-ish object', value: { a: { b: { c: 'd' } } } },
      { name: 'function', value: () => 'fn' },
      { name: 'Symbol', value: Symbol('test') },
      { name: 'BigInt', value: BigInt(123) },
      { name: 'Date', value: new Date('2024-01-01') },
      { name: 'Error', value: new Error('test') },
      { name: 'Map', value: new Map([['k', 'v']]) },
      { name: 'Set', value: new Set([1, 2, 3]) },
    ];

    for (const { name, value } of degenerateInputs) {
      it(`does not crash on ${name}`, () => {
        expect(() => sanitizeCsvCell(value)).not.toThrow();
      });
    }
  });
});

describe('Property-based: quoteCsvField round-trip', () => {
  describe('invariant: quoted output always starts and ends with quote when needed', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: quoting correctness`, () => {
        const rng = mulberry32(SEED + i + 2000);
        const value = randomString(rng, 40);
        const result = quoteCsvField(value);

        const needsQuoting =
          value.includes(',') ||
          value.includes('"') ||
          value.includes('\n') ||
          value.includes('\r');

        if (needsQuoting) {
          expect(result.startsWith('"')).toBe(true);
          expect(result.endsWith('"')).toBe(true);
          // Internal quotes must be doubled
          const inner = result.slice(1, -1);
          expect(inner.includes('"""')).toBe(false); // no triple quotes
          expect((inner.match(/""/g) || []).length).toBe(
            (value.match(/"/g) || []).length,
          );
        } else {
          // May still be modified by formula sanitization, but should not
          // be wrapped in quotes just for quoting reasons
          expect(result.startsWith('"')).toBe(false);
        }
      });
    }
  });
});

describe('Property-based: buildCsvDocument + auditCsvFormulaInjection', () => {
  describe('invariant: CSV built via buildCsvDocument has zero audit findings', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: no formula injection in sanitized CSV`, () => {
        const rng = mulberry32(SEED + i + 3000);

        // Generate rows with random formula injection payloads
        const rows: unknown[][] = [];
        const rowCount = 3 + Math.floor(rng() * 5);
        for (let r = 0; r < rowCount; r++) {
          const colCount = 2 + Math.floor(rng() * 4);
          const row: unknown[] = [];
          for (let c = 0; c < colCount; c++) {
            if (rng() > 0.5) {
              row.push(randomFormulaPayload(rng));
            } else {
              row.push(randomString(rng, 20));
            }
          }
          rows.push(row);
        }

        const csv = buildCsvDocument(rows);
        const findings = auditCsvFormulaInjection(csv);

        // Property: CSV generated through buildCsvDocument must NEVER
        // have unescaped formula injection vectors
        expect(findings).toHaveLength(0);
      });
    }
  });
});

describe('Property-based: delimiter injection prevention', () => {
  it('embedded delimiter is always quoted', () => {
    const rng = mulberry32(SEED + 4000);
    for (let i = 0; i < 20; i++) {
      const payload = 'before' + ',' + randomString(rng, 10);
      const result = quoteCsvField(payload, ',');
      // Must be quoted because it contains a comma
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
    }
  });

  it('custom delimiter embedded in value triggers quoting', () => {
    const rng = mulberry32(SEED + 5000);
    for (let i = 0; i < 20; i++) {
      const payload = 'before' + ';' + randomString(rng, 10);
      const result = quoteCsvField(payload, ';');
      expect(result.startsWith('"')).toBe(true);
    }
  });

  it('newline injection in cell is always quoted', () => {
    const rng = mulberry32(SEED + 6000);
    for (let i = 0; i < 20; i++) {
      const payload = randomString(rng, 10) + '\n' + randomString(rng, 10);
      const result = quoteCsvField(payload);
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// CI Multi-Seed Mode
// ---------------------------------------------------------------------------
const CI_SEED_COUNT = (() => {
  const raw = process.env.FUZZ_SEEDS;
  if (raw === undefined) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(10, n));
})();

if (CI_SEED_COUNT > 0) {
  describe('CSV Sanitizer Multi-Seed CI Fuzzing', () => {
    for (let seedIdx = 0; seedIdx < CI_SEED_COUNT; seedIdx++) {
      const [sec, nano] = process.hrtime();
      const ciSeed = (sec * 1000000 + nano + seedIdx * 0x9e3779b9) >>> 0;

      describe(`CI seed #${seedIdx} (0x${ciSeed.toString(16)})`, () => {
        const ciIters = 20;

        for (let i = 0; i < ciIters; i++) {
          it(`CI fuzz: formula injection neutralized`, () => {
            const rng = mulberry32(ciSeed + i);
            const payload = randomFormulaPayload(rng);
            const result = sanitizeCsvCell(payload);

            const trimmed = result.trimStart();
            if (trimmed.length > 0) {
              const hasTrigger = FORMULA_TRIGGERS.includes(trimmed[0]);
              const isNeutralized = result.startsWith("'");
              expect(isNeutralized || !hasTrigger).toBe(true);
            }
          });

          it(`CI fuzz: buildCsvDocument passes audit`, () => {
            const rng = mulberry32(ciSeed + i + 500);
            const rows: unknown[][] = [];
            for (let r = 0; r < 5; r++) {
              const row: unknown[] = [];
              for (let c = 0; c < 3; c++) {
                row.push(rng() > 0.5 ? randomFormulaPayload(rng) : randomString(rng, 15));
              }
              rows.push(row);
            }
            const csv = buildCsvDocument(rows);
            const findings = auditCsvFormulaInjection(csv);
            expect(findings).toHaveLength(0);
          });
        }
      });
    }
  });
}
