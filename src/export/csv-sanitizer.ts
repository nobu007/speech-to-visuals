/**
 * CSV field sanitizer for safe spreadsheet export.
 *
 * Prevents:
 * 1. Formula injection via leading =, +, -, @ chars (CSV injection / OWASP)
 * 2. Newline injection that creates fake rows
 * 3. Embedded delimiter bypass via proper RFC 4180 quoting
 * 4. Double-quote escaping bypass
 *
 * References:
 * - OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
 * - RFC 4180: https://tools.ietf.org/html/rfc4180
 */

/** Characters that trigger formula evaluation in spreadsheet apps */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Sanitize a single CSV cell value against formula injection.
 *
 * If the cell starts with a formula trigger character, prepend a single
 * quote (') to neutralize it. This matches the mitigation recommended by
 * OWASP and used by Google Sheets / Excel for import.
 *
 * Non-string values are converted to their string representation first.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Numbers and booleans are never formula injection vectors — skip the
  // formula prefix check for these types entirely.
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '';
    }
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'symbol') {
    str = value.toString();
  } else if (typeof value === 'function') {
    str = String(value);
  } else {
    try {
      const json = JSON.stringify(value);
      str = json !== undefined ? json : String(value);
    } catch {
      str = String(value);
    }
  }

  // Mitigate formula injection: if the first non-whitespace character is a
  // formula trigger, prefix with a single quote.
  if (str.length > 0) {
    const firstChar = str[0];
    if (FORMULA_PREFIXES.has(firstChar)) {
      str = "'" + str;
    }
    // Also handle cases where leading whitespace is used to bypass detection
    // e.g. "  =cmd|..." — trim and check, but preserve original content
    const trimmed = str.trimStart();
    if (trimmed.length > 0 && FORMULA_PREFIXES.has(trimmed[0]) && firstChar !== "'") {
      str = "'" + str;
    }
  }

  return str;
}

/**
 * Quote and escape a CSV cell value per RFC 4180.
 *
 * Wraps the value in double quotes if it contains:
 * - Comma (delimiter)
 * - Double quote
 * - Newline (\n or \r)
 *
 * Double quotes inside the value are escaped by doubling them ("").
 *
 * @param value - The cell value to quote
 * @param delimiter - The CSV delimiter (default: ',')
 * @returns RFC 4180-compliant quoted cell
 */
export function quoteCsvField(value: unknown, delimiter: string = ','): string {
  const sanitized = sanitizeCsvCell(value);

  const needsQuoting =
    sanitized.includes(delimiter) ||
    sanitized.includes('"') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r');

  if (!needsQuoting) {
    return sanitized;
  }

  // Escape double quotes by doubling them, then wrap in quotes
  return '"' + sanitized.replace(/"/g, '""') + '"';
}

/**
 * Build a complete CSV row from an array of cell values.
 *
 * Each cell is sanitized (formula injection guard) and quoted (RFC 4180
 * escaping) before being joined with the delimiter.
 *
 * @param cells - Array of cell values (will be converted to strings)
 * @param delimiter - Field delimiter (default: ',')
 * @returns A single CSV line string
 */
export function buildCsvRow(cells: unknown[], delimiter: string = ','): string {
  return cells.map((cell) => quoteCsvField(cell, delimiter)).join(delimiter);
}

/**
 * Build a complete CSV document from a 2D array of rows.
 *
 * Applies sanitizeCsvCell + quoteCsvField to every cell, joins cells
 * with the delimiter, and joins rows with \r\n (RFC 4180 line separator).
 *
 * @param rows - 2D array of cell values
 * @param options - Optional configuration
 * @param options.delimiter - Field delimiter (default: ',')
 * @param options.headerRow - If true, first row is treated as header (still sanitized)
 * @returns Complete CSV string with \r\n line endings
 */
export function buildCsvDocument(
  rows: unknown[][],
  options?: { delimiter?: string; headerRow?: boolean },
): string {
  const delimiter = options?.delimiter ?? ',';
  const lines = rows.map((row) => buildCsvRow(row, delimiter));
  return lines.join('\r\n');
}

/**
 * Validate that a CSV string does not contain unescaped formula injection
 * vectors at the start of any cell.
 *
 * This is a post-generation audit function — it checks the final CSV output
 * to ensure no cell (after splitting by delimiter and unquoting) starts with
 * a formula trigger character without being neutralized by a leading quote.
 *
 * @param csv - The complete CSV string to audit
 * @param delimiter - Field delimiter (default: ',')
 * @returns Array of findings with row, column, and offending character
 */
export interface CsvAuditFinding {
  row: number;
  col: number;
  value: string;
  trigger: string;
}

interface ParsedCell {
  value: string;
  wasQuoted: boolean;
}

/**
 * Parse a complete CSV document into rows and cells, respecting RFC 4180
 * quoted fields including multi-line quoted fields (newlines inside quotes).
 * Tracks whether each cell was quoted in the source CSV.
 */
function parseCsvDocumentWithFlags(csv: string, delimiter: string): ParsedCell[][] {
  const rows: ParsedCell[][] = [];
  let currentRow: ParsedCell[] = [];
  let cell = '';
  let wasQuoted = false;
  let inQuotes = false;
  let i = 0;
  const len = csv.length;

  while (i < len) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && csv[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        wasQuoted = true;
        i++;
      } else if (ch === delimiter) {
        currentRow.push({ value: cell, wasQuoted });
        cell = '';
        wasQuoted = false;
        i++;
      } else if (ch === '\r') {
        currentRow.push({ value: cell, wasQuoted });
        cell = '';
        wasQuoted = false;
        rows.push(currentRow);
        currentRow = [];
        if (i + 1 < len && csv[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else if (ch === '\n') {
        currentRow.push({ value: cell, wasQuoted });
        cell = '';
        wasQuoted = false;
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Flush last cell/row if any content remains
  if (cell.length > 0 || wasQuoted || currentRow.length > 0) {
    currentRow.push({ value: cell, wasQuoted });
    rows.push(currentRow);
  }

  return rows;
}

export function auditCsvFormulaInjection(
  csv: string,
  delimiter: string = ',',
): CsvAuditFinding[] {
  const findings: CsvAuditFinding[] = [];
  const rows = parseCsvDocumentWithFlags(csv, delimiter);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const cells = rows[rowIdx];

    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      const { value: cell, wasQuoted } = cells[colIdx];
      // Skip quoted cells — RFC 4180 quoting protects against formula injection
      if (wasQuoted) continue;
      // Skip neutralized cells (they start with ')
      if (cell.startsWith("'")) continue;

      // Detect a formula trigger at the cell start. We must check the RAW
      // first character as well as the first non-whitespace character:
      //   - rawFirst catches \t and \r, which are formula triggers in their
      //     own right but would be stripped by trimStart() (leaving the cell
      //     looking safe). Without this, a tab/CR-prefixed cell bypasses the
      //     audit even though sanitizeCsvCell() neutralizes it — an auditor
      //     vs sanitizer inconsistency.
      //   - trimmedFirst catches the "   =cmd" whitespace-bypass case.
      const rawFirst = cell.length > 0 ? cell[0] : '';
      const trimmed = cell.trimStart();
      const trimmedFirst = trimmed.length > 0 ? trimmed[0] : '';
      let trigger = '';
      if (rawFirst && FORMULA_PREFIXES.has(rawFirst)) trigger = rawFirst;
      else if (trimmedFirst && FORMULA_PREFIXES.has(trimmedFirst)) trigger = trimmedFirst;

      if (trigger) {
        findings.push({
          row: rowIdx,
          col: colIdx,
          value: cell.slice(0, 80),
          trigger,
        });
      }
    }
  }

  return findings;
}
