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

  // -----------------------------------------------------------------------
  // CRLF inside quoted fields (RFC 4180 §2.6 / §2.7)
  // Ensures the parser does not treat embedded CRLF as record separators.
  // -----------------------------------------------------------------------
  describe('CRLF inside quoted fields', () => {
    it('auditCsvFormulaInjection parser handles CRLF inside quotes', () => {
      // Manually craft a CSV with CRLF inside a quoted field.
      // The CRLF must NOT split the record — it is part of the cell value.
      const malicious = 'safe,"a\r\nb"\r\n=evil,normal\r\n';
      const findings = auditCsvFormulaInjection(malicious);
      // Only =evil on the second real row should be flagged
      expect(findings.length).toBe(1);
      expect(findings[0].row).toBe(1); // second physical row after CRLF-in-quote
      expect(findings[0].value).toContain('=evil');
    });

    it('buildCsvDocument + auditCsvFormulaInjection round-trip preserves CRLF in quotes', () => {
      // Cell value containing CRLF
      const csv = buildCsvDocument([['header', 'multiline'], ['safe', 'line1\r\nline2']]);
      // Audit should find no formula injection in the sanitized output
      const findings = auditCsvFormulaInjection(csv);
      expect(findings).toHaveLength(0);
      // The output should contain the CRLF inside the quoted field
      expect(csv).toContain('"line1\r\nline2"');
    });

    it('multiple CRLF sequences inside a single quoted field', () => {
      const csv = buildCsvDocument([['=cmd', 'a\r\nb\r\nc', 'normal']]);
      const findings = auditCsvFormulaInjection(csv);
      expect(findings).toHaveLength(0);
      // Verify the quoted field has embedded CRLFs preserved
      // sanitizeCsvCell adds ' prefix only for formula triggers; 'a\r\nb\r\nc' does not start with a trigger
      expect(csv).toContain('"a\r\nb\r\nc"');
    });

    it('CRLF inside quotes does not create false positive formula detection', () => {
      // A quoted field with CRLF followed by a formula-like char on the next "line"
      // The parser should NOT treat the post-CRLF content as a new cell start.
      const malicious = '"hello\r\n=cmd"\r\nnormal';
      const findings = auditCsvFormulaInjection(malicious);
      // =cmd is inside the quoted field → should NOT be flagged
      expect(findings).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Mid-field (malformed) opening quote + embedded CRLF.
    // Covers the literal edge case from review feedback: `a"\nb"` — a quote
    // that opens AFTER non-quote content, with a newline before it closes.
    // This is a distinct parser branch from the start-quote cases above
    // (wasQuoted flips true mid-cell), and the newline must still NOT act as
    // a record separator. Verified by checking that a formula on the next
    // physical line lands on the expected row index (no spurious extra row).
    // -----------------------------------------------------------------------
    it('mid-field quote + CRLF `a"\\r\\nb"` stays one record (LF mid-quote)', () => {
      // `a"\nb"`: quote opens after `a`, newline before close.
      const malicious = 'a"\nb"\n=evil,normal';
      const findings = auditCsvFormulaInjection(malicious);
      // Only =evil on the second real record is flagged — the embedded LF did
      // not split `a"\nb"` into two records.
      expect(findings).toHaveLength(1);
      expect(findings[0].row).toBe(1);
      expect(findings[0].value).toContain('=evil');
    });

    it('mid-field quote + CRLF `a"\\r\\nb"` stays one record (CRLF mid-quote)', () => {
      const malicious = 'a"\r\nb"\r\n=evil,normal';
      const findings = auditCsvFormulaInjection(malicious);
      expect(findings).toHaveLength(1);
      expect(findings[0].row).toBe(1);
      expect(findings[0].value).toContain('=evil');
    });

    it('mid-field quote content with CRLF is treated as a single quoted cell', () => {
      // The mid-opened quote makes wasQuoted=true for the whole cell, so even
      // a formula trigger inside it must NOT be flagged (quoting protects it).
      const malicious = 'x"=cmd\r\ninjected"\r\nsafe';
      const findings = auditCsvFormulaInjection(malicious);
      expect(findings).toHaveLength(0);
    });

    it('mid-field quote does not inflate the record count across multiple rows', () => {
      // Two genuine records, each with a mid-quote CRLF field. The audit must
      // see exactly 2 records (one formula finding per real malicious row),
      // proving neither embedded CRLF created an extra phantom row.
      const malicious = 'a"\r\nb"\r\n=evil1\r\nc"\r\nd"\r\n=evil2';
      const findings = auditCsvFormulaInjection(malicious);
      expect(findings).toHaveLength(2);
      const rows = findings.map((f) => f.row).sort((a, b) => a - b);
      // Findings on the two real rows (index 1 and 3), not on phantom rows.
      expect(rows).toEqual([1, 3]);
    });
  });

  // -----------------------------------------------------------------------
  // Whitespace formula triggers (\t, \r).
  // Regression: trimStart() in auditCsvFormulaInjection stripped \t/\r, which
  // ARE formula triggers, so tab/CR-prefixed cells bypassed the audit even
  // though sanitizeCsvCell() neutralizes them. The auditor must agree with the
  // sanitizer and flag unquoted tab-prefixed cells.
  // -----------------------------------------------------------------------
  describe('whitespace formula triggers (\t, \r) are detected', () => {
    it('unquoted tab-prefixed cell is flagged (was silently missed)', () => {
      const findings = auditCsvFormulaInjection('\tcmd');
      expect(findings).toHaveLength(1);
      expect(findings[0].trigger).toBe('\t');
    });

    it('unquoted tab-prefixed cell after a quoted-CRLF cell is flagged', () => {
      // Cross-cell parser-state interaction: the quoted-CRLF cell must not
      // "absorb" the following unquoted tab cell.
      const findings = auditCsvFormulaInjection('"a\nb",\tcmd');
      expect(findings).toHaveLength(1);
      expect(findings[0].col).toBe(1);
      expect(findings[0].trigger).toBe('\t');
    });

    it('audit agrees with sanitizer: sanitized tab-prefixed cell is clean', () => {
      // sanitizeCsvCell neutralizes \tcmd -> '\tcmd ; audit must find nothing.
      const csv = buildCsvDocument([['\tcmd', 'normal']]);
      expect(auditCsvFormulaInjection(csv)).toHaveLength(0);
    });

    it('space-then-tab-then-eq bypass is still caught via trimmed check', () => {
      // " \t=cmd": rawFirst is ' ' (not a trigger) but trimmedFirst is '='.
      const findings = auditCsvFormulaInjection(' \t=cmd');
      expect(findings).toHaveLength(1);
    });
  });
});
