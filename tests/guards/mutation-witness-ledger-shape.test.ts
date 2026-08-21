/**
 * Mutation witness ledger — 4-row template shape guard (Phase 179 / REQ-381 / TC-365-01).
 *
 * Every MW entry re-describes the same mutation/red/restoration facts in a
 * slightly different free-form shape, so each new ratchet task reinvented
 * its own table (make-run steering: "future ratchet tasks don't reinvent the
 * table shape"). REQ-381 fixed the reusable 5-column appendix
 * (`| ID | mutant | RED-count | RED-test-name | restoration |`) that landed
 * with the Phase 175 spec commit (f019d4dd). This guard keeps that contract
 * from rotting:
 *
 *   - the appendix section exists at the END of the ledger under the exact
 *     heading, with the 5-column header row (TC-365-01「末尾に … セクション」),
 *   - `grep -cE '^\| MW-0'` over the ledger file is >= `LEDGER.length`,
 *     where LEDGER is the derived set of entries that MUST carry a template
 *     row — every entry added since the appendix landed (MW-043+). Legacy
 *     MW-001〜042 normalize gradually（free-form narrative 保持・可逆）,
 *     but a NEW entry cannot ship narrative-only: a `## MW-0NN` heading
 *     without its `| MW-NNN |` row turns the per-entry it.each RED —
 *     「新規 MW エントリ追加時に template 1 行が自動 append され（手動記載禁止）」
 *     is enforced as detection, because the RED counts themselves can only
 *     come from the authoring run (a generator cannot invent them),
 *   - every `^\| MW-0` line parses to exactly 5 non-empty cells, and the
 *     parser drops NOTHING (the count the regex sees is the count it.each
 *     sweeps — 件数同期; a malformed row fails shape validation instead of
 *     silently disappearing from the sweep),
 *   - no phantom rows: every row ID maps to a real `## MW-NNN` entry.
 *
 * Companion audit: tests/guards/mutation-witness-ledger.test.ts (REQ-330)
 * keeps the narrative-side fields (target/mutation/command/observed) alive;
 * this file only owns the appendix table shape and the row-presence ratchet.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEDGER_PATH = join(REPO_ROOT, 'specs/speech-to-visuals/mutation-witness-ledger.md');

/** Exact appendix heading required by TC-365-01 / REQ-381. */
const APPENDIX_HEADING = '## 4-row mutant ledger template（再利用可能付録）';

/**
 * Entries at or below this numeric suffix predate the appendix (Phase 175
 * spec commit f019d4dd landed the template; Phase 176's MW-043 was the
 * first entry written under it). They MAY be normalized into 5-column rows
 * gradually while keeping their free-form narrative; entries ABOVE the
 * baseline must carry a row from the day they are added.
 */
const LEGACY_BASELINE = 42;

/**
 * Anti-erasure floor for the appendix body: the legacy-normalization
 * demonstrator set (MW-001 + MW-038〜043) committed with the appendix.
 * Growing the table is always fine; dropping demonstrator rows fails loud.
 */
const PINNED_APPENDIX_ROWS = 7;

interface TemplateRow {
  id: string;
  lineNo: number;
  cells: string[];
}

/** Parse `## MW-NNN` entry headings (same shape the REQ-330 audit parses). */
function parseEntryIds(ledger: string): string[] {
  const ids: string[] = [];
  for (const line of ledger.split('\n')) {
    const m = line.match(/^## (MW-\d{3}) /);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/**
 * Parse every `^\| MW-0` line — the exact line set `grep -cE '^\| MW-0'`
 * counts. The parser never filters, so rows.length mirrors the grep count
 * one-to-one（件数同期）: shape violations surface in the it.each below
 * rather than shrinking the sweep.
 */
function parseTemplateRows(lines: string[]): TemplateRow[] {
  const rows: TemplateRow[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || !line.startsWith('| MW-0')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.push({ id: cells[0] ?? '(unparsable)', lineNo: i, cells });
  }
  return rows;
}

function numericSuffix(id: string): number {
  const m = id.match(/^MW-(\d{3})$/);
  return m === null ? Number.NaN : Number.parseInt(m[1], 10);
}

describe('mutation witness ledger template shape (REQ-381 / TC-365-01)', () => {
  const lines = readFileSync(LEDGER_PATH, 'utf-8').split('\n');
  const entryIds = parseEntryIds(lines.join('\n'));
  const rows = parseTemplateRows(lines);
  /** Entries that MUST carry a template row: everything after the appendix landed. */
  const LEDGER = entryIds.filter((id) => numericSuffix(id) > LEGACY_BASELINE);
  const appendixHeadingIndex = lines.indexOf(APPENDIX_HEADING);
  const sectionHeadingIndexes = lines
    .map((line, i) => (line.startsWith('## ') ? i : -1))
    .filter((i) => i >= 0);
  // `Array.prototype.at` is outside the tests tsconfig lib target (ES2020) —
  // plain index read instead (`?? -1` keeps it defined for the empty case).
  const lastHeadingIndex = sectionHeadingIndexes[sectionHeadingIndexes.length - 1] ?? -1;
  const appendixRows = rows.filter(
    (row) => appendixHeadingIndex >= 0 && row.lineNo > appendixHeadingIndex,
  );

  it('anti-vacuity: ledger has entries and template rows to sweep', () => {
    expect(entryIds.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('appendix section sits at the END of the ledger under the exact heading', () => {
    expect(appendixHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(appendixHeadingIndex).toBe(lastHeadingIndex);
  });

  it('appendix header row declares the 5 columns ID/mutant/RED-count/RED-test-name/restoration', () => {
    const afterHeading = lines.slice(appendixHeadingIndex + 1);
    const header = afterHeading.find((line) => line.startsWith('| ID |'));
    expect(header).toMatch(/^\| ID \| mutant \| RED-count \| RED-test-name[^|]*\| restoration \|$/);
  });

  it('appendix table body keeps the legacy-normalization demonstrator rows', () => {
    expect(appendixRows.length).toBeGreaterThanOrEqual(PINNED_APPENDIX_ROWS);
  });

  it('grep -cE "^\\| MW-0" count >= LEDGER.length (REQ-381 aggregate floor)', () => {
    // Criterion-literal leg: the file carries at least as many template
    // rows as the contract requires. The per-entry legs below are the
    // precise teeth — this aggregate floor exists so the criterion's own
    // command stays machine-checked verbatim.
    expect(rows.length).toBeGreaterThanOrEqual(LEDGER.length);
  });

  it.each(LEDGER)('%s (post-appendix entry) carries its template row', (id) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      // 手動記載禁止: a new MW entry cannot ship narrative-only. Append
      // `| <id> | <mutant> | <redCount> | <received> | <restoration> |`
      // (appendix table or entry tail — both placements are contract-legal).
      throw new Error(`${id} has no template row — append one before committing`);
    }
    expect(row.cells).toHaveLength(5);
  });

  it.each(rows.map((row) => [row.id, row] as const))(
    '%s row has exactly 5 non-empty cells',
    (_id, row) => {
      expect(row.cells).toHaveLength(5);
      expect(row.cells[0]).toMatch(/^MW-\d{3}$/);
      for (const cell of row.cells) {
        expect(cell.length).toBeGreaterThan(0);
      }
    },
  );

  it('no phantom rows: every row ID maps to a real ## MW-NNN entry', () => {
    for (const row of rows) {
      expect(entryIds).toContain(row.id);
    }
  });

  it('LEDGER derivation is non-vacuous (post-appendix entries exist and are real)', () => {
    expect(LEDGER.length).toBeGreaterThan(0);
    for (const id of LEDGER) {
      expect(entryIds).toContain(id);
    }
  });
});
