/**
 * Property-based fuzz: CRLF/LF inside RFC-4180 quoted CSV fields.
 *
 * Feedback: "splitCSVRecords の Fuzzテストで QUOTE内に CRLFが含まれるエッジケース
 * (a"\nb") がカバーされているか検証すること". The CSV record parser lives in
 * csv-sanitizer.ts (`parseCsvDocumentWithFlags`, wrapped by the exported
 * `auditCsvFormulaInjection`). Existing coverage is case-based; this file adds
 * a randomized fuzz net that hammers the REAL exported parser (not a mirror)
 * with thousands of CRLF/LF-in-quote constructs.
 *
 * Core invariants verified for every generated document:
 *
 *  1. QUOTING PROTECTS: a formula trigger (= + - @ \t \r) that appears inside a
 *     properly closed quoted field — even after an embedded CRLF/LF — is NEVER
 *     flagged. Quoting is the RFC-4180 protection; the parser must keep the
 *     post-newline content within the same cell rather than treating it as a
 *     new record/cell start.
 *
 *  2. NO PHANTOM ROWS: embedded CRLF/LF inside quotes never splits one logical
 *     record into several. We assert this by counting findings: only genuinely
 *     unquoted malicious cells may be flagged, and they land on the rows we
 *     expect (no off-by-one drift from phantom row insertion).
 *
 *  3. UNQUOTED TRIGGERS STILL CAUGHT: the same fuzz run guarantees unquoted
 *     formula triggers are always detected, so the parser isn't silently
 *     swallowing real injections.
 */

import { auditCsvFormulaInjection, buildCsvDocument } from '../csv-sanitizer';
import { describe, it, expect } from '@jest/globals';
import {
  mulberry32,
  pick,
  CSV_FORMULA_TRIGGERS as FORMULA_TRIGGERS,
  CSV_NEWLINES as NEWLINES,
  CSV_SAFE_CHARS as SAFE_CHARS,
} from '@tests/helpers/fuzz';

function randomSafeToken(rng: () => number): string {
  const len = 1 + Math.floor(rng() * 6);
  let out = '';
  for (let i = 0; i < len; i++) out += SAFE_CHARS[Math.floor(rng() * SAFE_CHARS.length)];
  return out;
}

type CellKind = 'safe' | 'quoted-with-crlf' | 'quoted-with-formula' | 'malicious-unquoted';

interface GeneratedCell {
  raw: string; // exact string to embed in the CSV source
  kind: CellKind;
  expectFlagged: boolean;
}

/** Build one cell of a given kind. */
function makeCell(kind: CellKind, rng: () => number): GeneratedCell {
  switch (kind) {
    case 'safe':
      return { raw: randomSafeToken(rng), kind, expectFlagged: false };
    case 'malicious-unquoted': {
      // Starts with a formula trigger and is NOT quoted → must be flagged.
      const trigger = pick(FORMULA_TRIGGERS.filter((c) => c !== '\r'), rng);
      return { raw: trigger + randomSafeToken(rng), kind, expectFlagged: true };
    }
    case 'quoted-with-crlf': {
      // Quoted field with embedded newline but no formula trigger → safe.
      const nl = pick(NEWLINES, rng);
      const body = randomSafeToken(rng) + nl + randomSafeToken(rng);
      return { raw: '"' + body + '"', kind, expectFlagged: false };
    }
    case 'quoted-with-formula': {
      // Quoted field whose body contains a formula trigger AND an embedded
      // newline after it. Quoting must protect it → never flagged.
      const trigger = pick(FORMULA_TRIGGERS, rng);
      const nl = pick(NEWLINES, rng);
      const body = trigger + randomSafeToken(rng) + nl + trigger + randomSafeToken(rng);
      return { raw: '"' + body + '"', kind, expectFlagged: false };
    }
  }
}

/** Assemble a full CSV document from a grid of generated cells. */
function assembleDocument(grid: GeneratedCell[][]): string {
  return grid.map((row) => row.map((c) => c.raw).join(',')).join('\r\n');
}

describe('CSV CRLF-in-quote parser fuzz (real auditCsvFormulaInjection)', () => {
  describe('literal feedback payloads', () => {
    // Direct guard for the exact edge cases named in the feedback.
    it('`a"\\nb"` (LF mid-quote): no false positive, next-row formula lands on row 1', () => {
      const doc = 'a"\nb"\n=evil,normal';
      const findings = auditCsvFormulaInjection(doc);
      expect(findings).toHaveLength(1);
      expect(findings[0].row).toBe(1);
    });

    it('`a"\\r\\nb"` (CRLF mid-quote): no false positive, next-row formula lands on row 1', () => {
      const doc = 'a"\r\nb"\r\n=evil,normal';
      const findings = auditCsvFormulaInjection(doc);
      expect(findings).toHaveLength(1);
      expect(findings[0].row).toBe(1);
    });

    it('formula trigger after CRLF inside quotes is protected', () => {
      const doc = '"hello\r\n=cmd|/c calc!A1"\r\nsafe';
      expect(auditCsvFormulaInjection(doc)).toHaveLength(0);
    });
  });

  describe('randomized: quoting always protects, unquoted triggers always flagged', () => {
    const rng = mulberry32(424242);

    it('500 random mixed documents: flagged count == malicious-unquoted cell count', () => {
      for (let iter = 0; iter < 500; iter++) {
        const rowCount = 1 + Math.floor(rng() * 6);
        const grid: GeneratedCell[][] = [];
        let expectedFlagged = 0;

        for (let r = 0; r < rowCount; r++) {
          const colCount = 1 + Math.floor(rng() * 4);
          const row: GeneratedCell[] = [];
          for (let c = 0; c < colCount; c++) {
            const roll = rng();
            // ~30% quoted-with-crlf, ~25% quoted-with-formula,
            // ~20% malicious-unquoted, ~25% safe.
            const kind: CellKind =
              roll < 0.3
                ? 'quoted-with-crlf'
                : roll < 0.55
                  ? 'quoted-with-formula'
                  : roll < 0.75
                    ? 'malicious-unquoted'
                    : 'safe';
            const cell = makeCell(kind, rng);
            if (cell.expectFlagged) expectedFlagged++;
            row.push(cell);
          }
          grid.push(row);
        }

        const doc = assembleDocument(grid);
        const findings = auditCsvFormulaInjection(doc);

        // INVARIANT 1 + 3: exactly the unquoted malicious cells are flagged;
        // every quoted (CRLF/formula) cell is protected.
        if (findings.length !== expectedFlagged) {
          // Fail loudly with the offending document for diagnosis.
          expect({ doc, findings, expectedFlagged, actual: findings.length }).toEqual({
            doc,
            findings,
            expectedFlagged,
            actual: expectedFlagged,
          });
        }
        expect(findings.length).toBe(expectedFlagged);
      }
    });

    it('every finding is a malicious-unquoted cell (never a quoted-CRLF cell)', () => {
      // Stronger check on a smaller batch: collect the flagged (row,col) pairs
      // and confirm each maps back to a generated malicious-unquoted cell.
      for (let iter = 0; iter < 200; iter++) {
        const grid: GeneratedCell[][] = [];
        for (let r = 0; r < 3; r++) {
          const row: GeneratedCell[] = [];
          for (let c = 0; c < 3; c++) {
            const roll = rng();
            const kind: CellKind =
              roll < 0.4 ? 'quoted-with-crlf' : roll < 0.7 ? 'quoted-with-formula' : 'malicious-unquoted';
            row.push(makeCell(kind, rng));
          }
          grid.push(row);
        }
        const doc = assembleDocument(grid);
        const findings = auditCsvFormulaInjection(doc);
        for (const f of findings) {
          // Row/col indices must reference a real generated cell, and that
          // cell must be the malicious-unquoted kind.
          const cell = grid[f.row]?.[f.col];
          expect(cell).toBeDefined();
          expect(cell.kind).toBe('malicious-unquoted');
        }
      }
    });
  });

  describe('round-trip: buildCsvDocument output is always audit-clean', () => {
    const rng = mulberry32(98765);

    it('200 documents built with cells containing CRLF/formulas audit to zero findings', () => {
      for (let iter = 0; iter < 200; iter++) {
        // Construct raw cell VALUES (not pre-quoted) that include CRLF and
        // formula triggers, then let buildCsvDocument sanitize+quote them.
        const rowDefs: string[][] = [];
        for (let r = 0; r < 1 + Math.floor(rng() * 5); r++) {
          const cells: string[] = [];
          for (let c = 0; c < 1 + Math.floor(rng() * 4); c++) {
            const nl = pick(NEWLINES, rng);
            const trigger = pick(FORMULA_TRIGGERS, rng);
            const token = randomSafeToken(rng);
            cells.push(`${trigger}${token}${nl}${token}`);
          }
          rowDefs.push(cells);
        }
        const csv = buildCsvDocument(rowDefs);
        const findings = auditCsvFormulaInjection(csv);
        // INVARIANT: the sanitizer's own output must never contain an
        // unneutralized formula trigger at any cell start.
        expect(findings).toHaveLength(0);
      }
    });
  });
});
