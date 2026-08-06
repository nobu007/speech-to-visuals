/**
 * Cross-cutting (invariant-intersection) fuzz: combined formula + newline +
 * XSS payloads stress the COMPOSITION of two independently-implemented export
 * defenses at once.
 *
 *   A. FORMULA defense — the CSV sanitizer layer neutralizes formula injection:
 *      auditCsvFormulaInjection(buildCsvDocument([[cell]])) === [] for EVERY
 *      cell, even one whose first char is a formula trigger.
 *
 *   B. XSS defense — the content validator layer still detects the XSS vector
 *      in the sanitizer's OWN output: validateExportPayload flags the embedded
 *      <script>/<svg>/javascript: pattern.
 *
 * Single-invariant nets already cover A (csv-sanitizer / csv-crlf-in-quote) and
 * B (export-csv-mutation-fuzz) in isolation. The risk THIS file catches is their
 * INTERFERENCE: a cell that simultaneously starts with a formula trigger AND
 * embeds CRLF AND contains an XSS tag. The defenses are layered, not redundant
 * — the CSV layer must neutralize the formula (A) WITHOUT swallowing the XSS
 * tag, so the validator still has a job to do (B). A regression that, say,
 * made sanitizeCsvCell also strip HTML tags would keep A green but silently
 * break B (the XSS would vanish before the validator saw it); this test pins
 * both together.
 *
 * Reuses the shared fuzz helpers (@tests/helpers/fuzz) — mulberry32 +
 * CSV_FORMULA_TRIGGERS / CSV_NEWLINES / CSV_SAFE_CHARS — instead of
 * re-declaring them, demonstrating the de-duplicated scaffolding.
 */

import { describe, it, expect } from '@jest/globals';
import { auditCsvFormulaInjection, buildCsvDocument } from '../csv-sanitizer';
import { validateExportPayload } from '../export-content-validator';
import {
  mulberry32,
  pick,
  CSV_FORMULA_TRIGGERS,
  CSV_NEWLINES,
  CSV_SAFE_CHARS,
} from '@tests/helpers/fuzz';

/** XSS vectors the content validator is guaranteed to flag, mapped to their
 * detection pattern (see export-csv-mutation-fuzz for the contract). */
const XSS_VECTORS: Array<{ payload: string; pattern: string }> = [
  { payload: '<script>alert(1)</script>', pattern: 'script-tag' },
  { payload: '<img src=x onerror=alert(1)>', pattern: 'img-onerror' },
  { payload: '<svg onload=alert(1)>', pattern: 'svg-onload' },
  { payload: 'javascript:alert(1)', pattern: 'javascript-protocol' },
];

/** A short run of characters known to be inert inside a CSV cell. */
function safeToken(rng: () => number): string {
  const len = 1 + Math.floor(rng() * 6);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CSV_SAFE_CHARS[Math.floor(rng() * CSV_SAFE_CHARS.length)];
  }
  return out;
}

/**
 * Build a single cell that combines all three attack classes at once:
 * a leading formula trigger, an embedded newline (CRLF/LF/CR), and an XSS tag.
 * This is the cross-product payload single-invariant nets rarely generate.
 */
function combinedAttackCell(rng: () => number): {
  cell: string;
  xssPattern: string;
} {
  const trigger = pick(CSV_FORMULA_TRIGGERS, rng);
  const newline = pick(CSV_NEWLINES, rng);
  const xss = pick(XSS_VECTORS, rng);
  const cell =
    trigger + safeToken(rng) + newline + xss.payload + safeToken(rng);
  return { cell, xssPattern: xss.pattern };
}

describe('CSV combined-attack composition fuzz (formula-defense × xss-defense)', () => {
  describe('literal anchor cases', () => {
    it('= + CRLF + <script>: formula neutralized AND xss still detected', () => {
      const cell = '=a\r\n<script>alert(1)</script>b';
      const doc = buildCsvDocument([[cell]]);

      // A: sanitizer neutralized the formula trigger.
      expect(auditCsvFormulaInjection(doc)).toEqual([]);
      // B: the XSS tag survived the CSV layer and is still detected.
      const result = validateExportPayload({ format: 'csv', data: doc });
      expect(result.findings.some((f) => f.pattern === 'script-tag')).toBe(true);
      // The embedded CRLF forced RFC-4180 quoting (the structure-protection
      // mechanism that lets the audit trust quoted cells).
      expect(doc.startsWith('"')).toBe(true);
    });

    it('@ + LF + javascript: protocol: both defenses hold', () => {
      const cell = '@x\njavascript:alert(1)y';
      const doc = buildCsvDocument([[cell]]);
      expect(auditCsvFormulaInjection(doc)).toEqual([]);
      const result = validateExportPayload({ format: 'csv', data: doc });
      expect(
        result.findings.some((f) => f.pattern === 'javascript-protocol'),
      ).toBe(true);
    });
  });

  describe('randomized: every combined-attack cell is formula-safe AND xss-detectable', () => {
    const rng = mulberry32(0xC0FFEE);

    it('400 combined-attack cells: audit===0 AND validator flags the embedded XSS', () => {
      for (let iter = 0; iter < 400; iter++) {
        const { cell, xssPattern } = combinedAttackCell(rng);
        const doc = buildCsvDocument([[cell]]);

        // INVARIANT A — formula injection neutralized by the CSV layer.
        const audit = auditCsvFormulaInjection(doc);
        // INVARIANT B — XSS vector survives the CSV layer and is detected.
        const validation = validateExportPayload({ format: 'csv', data: doc });
        const xssDetected = validation.findings.some(
          (f) => f.pattern === xssPattern,
        );

        if (audit.length !== 0 || !xssDetected) {
          // Fail loudly with the offending payload for diagnosis.
          expect({ cell, doc, auditLength: audit.length, xssDetected }).toEqual({
            cell,
            doc,
            auditLength: 0,
            xssDetected: true,
          });
        }
        expect(audit).toEqual([]);
        expect(xssDetected).toBe(true);
      }
    });

    it('the embedded newline always forces quoting (structure protection engaged)', () => {
      for (let iter = 0; iter < 200; iter++) {
        const { cell } = combinedAttackCell(rng);
        const doc = buildCsvDocument([[cell]]);
        // Every combined cell embeds a newline, so the sanitizer MUST quote it;
        // unquoted, the newline would spawn a phantom row.
        expect(doc.startsWith('"')).toBe(true);
        expect(doc.endsWith('"')).toBe(true);
      }
    });
  });

  describe('multi-row composition: masking+quoting composes across rows', () => {
    const rng = mulberry32(0xBA5EBA11);

    it('a document of N combined-attack rows audits fully clean', () => {
      for (let iter = 0; iter < 100; iter++) {
        const rowCount = 1 + Math.floor(rng() * 5);
        const rows: string[][] = [];
        for (let r = 0; r < rowCount; r++) {
          rows.push([combinedAttackCell(rng).cell]);
        }
        const doc = buildCsvDocument(rows);
        // Every row's combined attack is neutralized — no formula injection
        // anywhere, and no phantom row from embedded newlines shifted a trigger
        // into an unquoted position.
        expect(auditCsvFormulaInjection(doc)).toEqual([]);
      }
    });
  });
});
