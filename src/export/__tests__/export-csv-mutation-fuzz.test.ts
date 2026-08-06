/**
 * CSV-format payload mutation fuzzing regression net.
 *
 * Extends the existing mutation fuzz coverage (export-mutation-fuzz.test.ts)
 * with CSV-specific injection vectors and strict-mode throw-path assertions.
 *
 * CSV has unique attack surfaces compared to JSON:
 *   - Formula injection via leading =, +, -, @ chars
 *   - Newline injection to create fake rows
 *   - Quote escaping bypass via double-quote manipulation
 *   - Embedded delimiter injection
 *
 * This test also verifies the strict-mode pipeline: mutated payloads with
 * high-severity patterns MUST cause the validator to return passed=false,
 * which in production throws FormatValidationError.
 */

import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';
import { mulberry32 } from '@tests/helpers/fuzz';

// ---------------------------------------------------------------------------
// Known-good CSV payloads
// ---------------------------------------------------------------------------
function createSafeCsvString(): string {
  return [
    'id,label,type,duration',
    'node-1,Audio Input,input,2.5',
    'node-2,Transcription,process,3.0',
    'node-3,Analysis,process,4.5',
    'node-4,Video Output,output,1.5',
  ].join('\n');
}

function createSafeCsvPayload(): Record<string, unknown> {
  return {
    format: 'csv',
    data: createSafeCsvString(),
    metadata: {
      delimiter: ',',
      quoteChar: '"',
      rowCount: 5,
    },
  };
}

// ---------------------------------------------------------------------------
// CSV-specific mutation vectors
// ---------------------------------------------------------------------------

/** XSS vectors that work inside CSV cell values */
const CSV_XSS_VECTORS: Array<{
  payload: string;
  pattern: string;
  minSeverity: 'high' | 'medium';
}> = [
  { payload: '<script>alert(1)</script>', pattern: 'script-tag', minSeverity: 'high' },
  { payload: '<img src=x onerror=alert(1)>', pattern: 'img-onerror', minSeverity: 'high' },
  { payload: '<svg onload=alert(1)>', pattern: 'svg-onload', minSeverity: 'high' },
  { payload: '<iframe src=//evil.com></iframe>', pattern: 'iframe-tag', minSeverity: 'high' },
  { payload: 'javascript:alert(1)', pattern: 'javascript-protocol', minSeverity: 'high' },
  { payload: '<script/src=//evil.com>', pattern: 'script-tag', minSeverity: 'high' },
  { payload: '<embed src=//evil.com>', pattern: 'embed-tag', minSeverity: 'high' },
  { payload: '<object data=//evil.com>', pattern: 'object-tag', minSeverity: 'high' },
  { payload: '<base href=//evil.com>', pattern: 'base-tag', minSeverity: 'high' },
  { payload: 'expression(alert(1))', pattern: 'css-expression', minSeverity: 'high' },
  { payload: 'vbscript:msgbox(1)', pattern: 'vbscript-protocol', minSeverity: 'high' },
  { payload: '<div onclick=alert(1)>x</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<div onmouseover=alert(1)>x</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<a href="javascript:alert(1)">link</a>', pattern: 'dangerous-href', minSeverity: 'medium' },
  { payload: '<meta http-equiv=refresh>', pattern: 'meta-tag', minSeverity: 'medium' },
  { payload: '@import url(evil.css)', pattern: 'css-import', minSeverity: 'medium' },
];

/**
 * CSV-specific injection vectors that exploit CSV format parsing.
 * These are not XSS but could be used for spreadsheet formula injection
 * or CSV parsing confusion. They should not trigger the XSS-focused
 * validator patterns — verifying no false positives.
 */
const CSV_FORMAT_VECTORS: string[] = [
  '=cmd|"/c calc"!A1',           // Excel formula injection
  '+cmd|"/c calc"!A1',           // LibreOffice formula injection
  '-1+cmd|"/c calc"!A1',         // Hyphen-prefixed formula
  '@SUM(A1:A2)',                  // Lotus 1-2-3 style formula
  'cell\ninjection',              // Newline injection (fake row)
  '"quoted""inner"quote',         // Double-quote escaping
  'a,b,c',                        // Embedded delimiter (no quotes)
  '"a,b,c"',                      // Embedded delimiter (quoted)
  '\t\r\n',                       // Tab + CRLF injection
  '=HYPERLINK("http://evil.com")', // Excel hyperlink formula
];

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/** Insert payload at a random position within a CSV cell value */
function injectIntoCsvCell(
  csvLine: string,
  cellIndex: number,
  payload: string,
  rng: () => number,
): string {
  const cells = csvLine.split(',');
  if (cellIndex >= cells.length) cellIndex = cells.length - 1;
  const cell = cells[cellIndex];
  const pos = Math.floor(rng() * (cell.length + 1));
  cells[cellIndex] = cell.slice(0, pos) + payload + cell.slice(pos);
  return cells.join(',');
}

/** Inject a payload into a random cell in a random data row of the CSV */
function mutateCsvRow(
  csv: string,
  payload: string,
  rng: () => number,
): { mutated: string; rowIdx: number; cellIdx: number } {
  const lines = csv.split('\n');
  // Skip header (line 0), pick a random data row
  const rowIdx = 1 + Math.floor(rng() * (lines.length - 1));
  const cells = lines[rowIdx].split(',');
  const cellIdx = Math.floor(rng() * cells.length);
  lines[rowIdx] = injectIntoCsvCell(lines[rowIdx], cellIdx, payload, rng);
  return { mutated: lines.join('\n'), rowIdx, cellIdx };
}

/** Replace a random field in a generic object with an XSS payload */
function mutateJsonField(
  obj: Record<string, unknown>,
  payload: string,
  rng: () => number,
): { mutated: Record<string, unknown>; fieldPath: string } {
  const cloned = JSON.parse(JSON.stringify(obj));
  const stringPaths = findStringPaths(cloned);
  if (stringPaths.length === 0) {
    return { mutated: cloned, fieldPath: '<none>' };
  }
  const target = stringPaths[Math.floor(rng() * stringPaths.length)];
  const original = getNestedValue(cloned, target) as string;
  setNestedValue(cloned, target, original + payload);
  return { mutated: cloned, fieldPath: target };
}

function findStringPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];
  if (typeof obj === 'string') {
    paths.push(prefix);
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      paths.push(...findStringPaths(obj[i], `${prefix}[${i}]`));
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      paths.push(...findStringPaths(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return paths;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setNestedValue(obj: unknown, path: string, value: unknown): void {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  (cur as Record<string, unknown>)[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SEED = 98765;
const FUZZ_ITERATIONS = 30;

describe('CSV-format mutation fuzzing regression net', () => {
  describe('CSV cell injection with XSS vectors', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const vectorIdx = i % CSV_XSS_VECTORS.length;
      const vector = CSV_XSS_VECTORS[vectorIdx];

      it(`CSV mutation #${i}: "${vector.pattern}" injected into cell → detected`, () => {
        const rng = mulberry32(SEED + i);
        const csv = createSafeCsvString();
        const { mutated } = mutateCsvRow(csv, vector.payload, rng);

        const result = validateExportPayload({ format: 'csv', data: mutated });

        expect(result.findings.length).toBeGreaterThan(0);
        expect(
          result.findings.some((f) => f.pattern === vector.pattern),
        ).toBe(true);
      });
    }
  });

  describe('CSV cell injection blocks in strict mode', () => {
    for (const vector of CSV_XSS_VECTORS.filter((v) => v.minSeverity === 'high')) {
      it(`strict mode must block "${vector.pattern}" in CSV cell`, () => {
        const rng = mulberry32(SEED + 500);
        const csv = createSafeCsvString();
        const { mutated } = mutateCsvRow(csv, vector.payload, rng);

        const result = validateExportPayload(
          { format: 'csv', data: mutated },
          'csv-strict-test',
          { strict: true },
        );

        expect(result.passed).toBe(false);
        expect(
          result.findings.some((f) => f.severity === 'high'),
        ).toBe(true);
      });
    }
  });

  describe('CSV format-specific vectors (no false positives)', () => {
    for (const payload of CSV_FORMAT_VECTORS) {
      it(`CSV format vector does NOT false-positive: "${payload.slice(0, 40)}"`, () => {
        const result = validateExportPayload({ format: 'csv', data: payload });

        // CSV format injection (formula, newline, delimiter) is NOT XSS.
        // The validator should not flag these as security findings.
        // (They may be sanitized at the CSV-escaping layer, not the XSS validator.)
        const hasHigh = result.findings.some((f) => f.severity === 'high');
        expect(hasHigh).toBe(false);
      });
    }
  });

  describe('CSV payload wrapped in SceneGraph', () => {
    it('XSS in CSV data within node.meta is detected', () => {
      const scene: SceneGraph = {
        type: 'flow',
        nodes: [
          {
            id: 'node-1',
            label: 'Start',
            meta: { csvData: createSafeCsvString() },
          },
        ],
        edges: [],
        summary: 'CSV export',
      };
      // Inject XSS into the CSV data inside meta
      scene.nodes[0].meta!.csvData = createSafeCsvString().replace(
        'node-1',
        '<script>alert(1)</script>',
      );

      const result = validateSceneGraphForExport(scene);
      expect(
        result.findings.some((f) => f.pattern === 'script-tag'),
      ).toBe(true);
      expect(result.findings.some((f) => f.field.includes('meta'))).toBe(true);
    });

    it('Multiple XSS vectors in different CSV cells are all detected', () => {
      const csv = [
        'id,label,type',
        `<script>alert(1)</script>,safe,input`,
        `safe,<iframe src=//evil.com>,process`,
        `safe,safe,javascript:alert(1)`,
      ].join('\n');

      const result = validateExportPayload({ format: 'csv', data: csv });
      const patterns = new Set(result.findings.map((f) => f.pattern));
      expect(patterns.has('script-tag')).toBe(true);
      expect(patterns.has('iframe-tag')).toBe(true);
      expect(patterns.has('javascript-protocol')).toBe(true);
    });
  });

  describe('Safe CSV payloads must NOT trigger findings', () => {
    it('clean CSV data should have zero findings', () => {
      const payload = createSafeCsvPayload();
      const result = validateExportPayload(payload, 'safe-csv');
      expect(result.findings).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('CSV with special but safe characters should not false-positive', () => {
      const csv = [
        'id,description,value',
        '1,"Contains (parentheses) and > brackets",100',
        '2,"Has & ampersand and \\"quotes\\"",200',
        '3,"Path: /api/v1/data?key=val",300',
      ].join('\n');

      const result = validateExportPayload({ format: 'csv', data: csv });
      expect(result.findings).toHaveLength(0);
    });

    it('CSV with legitimate HTML entities should not false-positive', () => {
      const csv = 'id,label\n1,&lt;safe&gt;\n2,&amp;entity';
      const result = validateExportPayload({ format: 'csv', data: csv });
      expect(result.findings.some((f) => f.severity === 'high')).toBe(false);
    });
  });

  describe('Combined CSV + JSON mutation (cross-format regression)', () => {
    const COMBINED_VECTORS = [
      { payload: '<script>alert(1)</script>', pattern: 'script-tag' },
      { payload: '<svg/onload=alert(1)>', pattern: 'svg-onload' },
      { payload: 'javascript:alert(1)', pattern: 'javascript-protocol' },
      { payload: '<iframe/src=//evil.com>', pattern: 'iframe-tag' },
      { payload: '<base href=//evil.com>', pattern: 'base-tag' },
    ];

    for (let i = 0; i < COMBINED_VECTORS.length; i++) {
      const vector = COMBINED_VECTORS[i];

      it(`CSV→JSON cross-format: "${vector.pattern}" in CSV then JSON → both detected`, () => {
        // Inject into CSV
        const rng = mulberry32(SEED + i + 2000);
        const csv = createSafeCsvString();
        const { mutated: csvMutated } = mutateCsvRow(csv, vector.payload, rng);
        const csvResult = validateExportPayload({ format: 'csv', data: csvMutated });
        expect(csvResult.findings.some((f) => f.pattern === vector.pattern)).toBe(true);

        // Inject same vector into JSON
        const jsonPayload = createSafeCsvPayload();
        const { mutated: jsonMutated } = mutateJsonField(jsonPayload, vector.payload, rng);
        const jsonResult = validateExportPayload(jsonMutated);
        expect(jsonResult.findings.some((f) => f.pattern === vector.pattern)).toBe(true);
      });
    }
  });

  describe('Property: every mutation either passes or is detected (no silent bypass)', () => {
    // This is the core property-based assertion: for ANY mutation applied to a
    // known-good payload, the validator MUST either:
    //   (a) detect the injected pattern (findings.length > 0), OR
    //   (b) the mutation was a format-only vector that doesn't contain XSS patterns
    //
    // This invariant catches regressions: if a code change weakens detection,
    // a previously-caught mutation will silently pass through.

    const ALL_VECTORS = [
      ...CSV_XSS_VECTORS.map((v) => ({ ...v, type: 'xss' as const })),
      ...CSV_FORMAT_VECTORS.map((v) => ({ payload: v, type: 'format' as const })),
    ];

    for (let i = 0; i < ALL_VECTORS.length; i++) {
      const vec = ALL_VECTORS[i];
      it(`mutation invariant #${i}: ${vec.type} vector handled correctly`, () => {
        const rng = mulberry32(SEED + i + 3000);
        const csv = createSafeCsvString();
        const { mutated } = mutateCsvRow(csv, vec.payload, rng);
        const result = validateExportPayload({ format: 'csv', data: mutated });

        if (vec.type === 'xss') {
          // XSS vector MUST be detected
          expect(result.findings.length).toBeGreaterThan(0);
        }
        // Format-only vectors: either no findings (safe) or findings from
        // accidental pattern match — both are acceptable. The key invariant
        // is that the validator never crashes and always returns a result.
        expect(result).toBeDefined();
        expect(Array.isArray(result.findings)).toBe(true);
        expect(typeof result.passed).toBe('boolean');
      });
    }
  });

  describe('Destructive CSV mutations must not crash', () => {
    it('empty CSV data should not crash', () => {
      expect(() => validateExportPayload({ format: 'csv', data: '' })).not.toThrow();
    });

    it('malformed CSV should not crash', () => {
      const malformed = ',,,\n,,,\n,';
      expect(() => validateExportPayload({ format: 'csv', data: malformed })).not.toThrow();
    });

    it('very long CSV should not crash or hang', () => {
      const rows = ['id,label'];
      for (let i = 0; i < 1000; i++) {
        rows.push(`${i},Row ${i} data`);
      }
      const csv = rows.join('\n');
      const start = Date.now();
      const result = validateExportPayload({ format: 'csv', data: csv });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
      expect(result.findings).toHaveLength(0);
    });

    it('CSV with binary-like content should not crash', () => {
      const binaryLike = 'id,data\n1,' + String.fromCharCode(0, 1, 2, 3, 255, 254);
      expect(() => validateExportPayload({ format: 'csv', data: binaryLike })).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Multi-Seed CI Fuzzing Mode for CSV mutation tests
//
// When FUZZ_SEEDS env var is set (e.g., in CI), additional fuzzing iterations
// run with random seeds to expand the CSV fuzzing surface beyond the fixed
// deterministic seed. This catches edge cases the fixed seed misses.
//
// Local dev (FUZZ_SEEDS unset): only fixed-seed iterations run (fast).
// CI (FUZZ_SEEDS=3): 3 additional random seeds × iterations each.
// ---------------------------------------------------------------------------
const CSV_CI_SEED_COUNT = (() => {
  const raw = process.env.FUZZ_SEEDS;
  if (raw === undefined) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(10, n));
})();

if (CSV_CI_SEED_COUNT > 0) {
  describe('CSV Multi-Seed CI Fuzzing Mode', () => {
    const ciSeeds: number[] = [];
    for (let i = 0; i < CSV_CI_SEED_COUNT; i++) {
      const [sec, nano] = process.hrtime();
      ciSeeds.push((sec * 1000000 + nano + i * 0x9E3779B9) >>> 0);
    }

    for (let seedIdx = 0; seedIdx < ciSeeds.length; seedIdx++) {
      const ciSeed = ciSeeds[seedIdx];

      describe(`CSV CI random seed #${seedIdx} (0x${ciSeed.toString(16)})`, () => {
        const ciIterations = Math.max(10, Math.floor(FUZZ_ITERATIONS / 2));

        for (let i = 0; i < ciIterations; i++) {
          const vectorIdx = i % CSV_XSS_VECTORS.length;
          const vector = CSV_XSS_VECTORS[vectorIdx];

          it(`CSV CI fuzz seed#${seedIdx} iter#${i}: "${vector.pattern}" → detected`, () => {
            const rng = mulberry32(ciSeed + i);
            const csv = createSafeCsvString();
            const { mutated } = mutateCsvRow(csv, vector.payload, rng);

            const result = validateExportPayload({ format: 'csv', data: mutated });

            expect(result.findings.length).toBeGreaterThan(0);
            expect(
              result.findings.some((f) => f.pattern === vector.pattern),
            ).toBe(true);
          });
        }
      });
    }
  });
}
