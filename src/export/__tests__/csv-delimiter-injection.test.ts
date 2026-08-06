/**
 * Security tests for CSV sanitizer delimiter injection resistance.
 *
 * Verifies that the CSV sanitizer correctly handles:
 * 1. Alternative delimiters (tab, semicolon, pipe) with formula injection
 * 2. Delimiter smuggling via embedded delimiter characters in cell values
 * 3. NaN-to-empty-string conversion doesn't introduce injection vectors
 * 4. Multi-row documents with mixed delimiter contexts
 *
 * Context: The feedback noted:
 * "csvSanitizer の NaN 空文字化が CSV パーサの区切り文字インジェクションを許さないかのセキュリティ確認"
 */

import {
  sanitizeCsvCell,
  quoteCsvField,
  buildCsvRow,
  buildCsvDocument,
  auditCsvFormulaInjection,
} from '../csv-sanitizer';

import { describe, it, expect } from '@jest/globals';

describe('CSV sanitizer delimiter injection resistance', () => {

  // -----------------------------------------------------------------------
  // Tab-delimited CSV (common in European locales)
  // -----------------------------------------------------------------------
  describe('tab-delimited CSV', () => {
    it('neutralizes formula injection with tab delimiter', () => {
      const row = buildCsvRow(['=cmd|/c calc!A1', 'normal', '+1+1'], '\t');
      // First cell should be neutralized with '
      expect(row.startsWith("'=cmd")).toBe(true);
      // Third cell should be neutralized with '
      expect(row).toContain("'+1+1");
    });

    it('quotes cells containing embedded tabs', () => {
      const row = buildCsvRow(['hello\tworld', 'safe'], '\t');
      // The cell with an embedded tab should be quoted
      expect(row).toContain('"hello\tworld"');
    });

    it('audit detects unescaped formula in tab-delimited CSV', () => {
      // Manually craft a malicious tab-delimited line (no sanitizer)
      const malicious = '=cmd|/c calc!\tnormal\t@SUM(A1:A2)';
      const findings = auditCsvFormulaInjection(malicious, '\t');
      expect(findings.length).toBeGreaterThanOrEqual(2); // =cmd and @SUM
    });

    it('audit passes for sanitized tab-delimited CSV', () => {
      const csv = buildCsvDocument(
        [['=cmd|/c calc!', 'normal', '@SUM(A1:A2)']],
        { delimiter: '\t' },
      );
      const findings = auditCsvFormulaInjection(csv, '\t');
      // All formula triggers should be neutralized
      expect(findings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Semicolon-delimited CSV
  // -----------------------------------------------------------------------
  describe('semicolon-delimited CSV', () => {
    it('neutralizes formula injection with semicolon delimiter', () => {
      const row = buildCsvRow(['=HYPERLINK("http://evil")', 'data', '-1+1'], ';');
      expect(row).toContain("'=HYPERLINK");
      expect(row).toContain("'-1+1");
    });

    it('quotes cells containing embedded semicolons', () => {
      const row = buildCsvRow(['a;b;c', 'normal'], ';');
      expect(row).toContain('"a;b;c"');
    });

    it('audit detects unescaped formula in semicolon-delimited CSV', () => {
      const malicious = '=cmd;normal;-1';
      const findings = auditCsvFormulaInjection(malicious, ';');
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Pipe-delimited CSV
  // -----------------------------------------------------------------------
  describe('pipe-delimited CSV', () => {
    it('neutralizes formula injection with pipe delimiter', () => {
      const row = buildCsvRow(['=1+1', '@admin', '+cmd'], '|');
      expect(row).toContain("'=1+1");
      expect(row).toContain("'@admin");
      expect(row).toContain("'+cmd");
    });

    it('quotes cells containing embedded pipes', () => {
      const row = buildCsvRow(['a|b|c', 'normal'], '|');
      expect(row).toContain('"a|b|c"');
    });
  });

  // -----------------------------------------------------------------------
  // NaN-to-empty-string conversion safety
  // -----------------------------------------------------------------------
  describe('NaN-to-empty-string conversion safety', () => {
    it('NaN produces empty string (not "NaN") that cannot be a formula trigger', () => {
      const result = sanitizeCsvCell(NaN);
      expect(result).toBe('');
      // Empty string is not a formula trigger
      expect(result.length).toBe(0);
    });

    it('Infinity produces empty string', () => {
      expect(sanitizeCsvCell(Infinity)).toBe('');
      expect(sanitizeCsvCell(-Infinity)).toBe('');
    });

    it('null/undefined produce empty string', () => {
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
    });

    it('row with all-NaN values produces safe empty-delimiter row', () => {
      const row = buildCsvRow([NaN, Infinity, -Infinity, null, undefined]);
      // Should be all empty strings joined by commas
      expect(row).toBe(',,,,');
      // Audit should find no formula injection
      const findings = auditCsvFormulaInjection(row);
      expect(findings).toHaveLength(0);
    });

    it('mixed NaN and formula-injection values in one row', () => {
      const row = buildCsvRow([NaN, '=cmd', Infinity, '@evil', -0]);
      // NaN → '', '=cmd' → "'=cmd", Infinity → '', '@evil' → "'@evil", -0 → '0'
      expect(row).toBe(",'=cmd,,'@evil,0");
      const findings = auditCsvFormulaInjection(row);
      expect(findings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-row document with mixed content
  // -----------------------------------------------------------------------
  describe('multi-row document delimiter safety', () => {
    it('multi-row tab-delimited document with formula injection', () => {
      const rows = [
        ['header1', 'header2', 'header3'],
        ['=evil', 'NaN_data', '@admin'],
        ['123', '=2+2', 'normal'],
      ];
      // Replace string 'NaN_data' with actual NaN
      const csv = buildCsvDocument(
        [
          rows[0],
          [rows[1][0], NaN, rows[1][2]],
          rows[2],
        ],
        { delimiter: '\t' },
      );
      const findings = auditCsvFormulaInjection(csv, '\t');
      expect(findings).toHaveLength(0);
    });

    it('document with custom delimiter audit matches standard delimiter audit', () => {
      const semicolonCsv = buildCsvDocument(
        [['=a', 'b', '@c']],
        { delimiter: ';' },
      );
      const commaCsv = buildCsvDocument(
        [['=a', 'b', '@c']],
        { delimiter: ',' },
      );
      // Both should have zero findings after sanitization
      expect(auditCsvFormulaInjection(semicolonCsv, ';')).toHaveLength(0);
      expect(auditCsvFormulaInjection(commaCsv, ',')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge case: delimiter as part of formula payload
  // -----------------------------------------------------------------------
  describe('delimiter as part of formula payload', () => {
    it('formula payload containing delimiter is properly quoted', () => {
      const row = buildCsvRow(['=cmd|/c calc!A1,Z1'], ',');
      // The entire cell should be quoted and prefixed with '
      expect(row).toContain("'=cmd");
      // The embedded comma should not create a new cell (should be within quotes)
      const findings = auditCsvFormulaInjection(row);
      expect(findings).toHaveLength(0);
    });

    it('formula payload containing newline is properly quoted', () => {
      const cell = '=cmd\ninjected';
      const result = quoteCsvField(cell);
      // Should be quoted because of the newline
      expect(result).toContain('"');
      // Should start with ' (formula neutralization)
      expect(result).toContain("'=cmd");
    });
  });
});
