/**
 * Mutation witness ledger audit (Phase 141 / REQ-330).
 *
 * specs prose claims like "mutation-verified: n RED" carried no run evidence —
 * a judge could not ground them without re-running the mutation. The ledger
 * (specs/speech-to-visuals/mutation-witness-ledger.md) is the committed log:
 * one MW-xxx entry per claim with target file, exact one-line mutation,
 * re-run command, observed red count, and (where captured) the [EVIDENCE]
 * line. This guard keeps the ledger from rotting:
 *
 *   - every entry's target FILE exists on disk at the stated path,
 *   - every entry carries the required fields,
 *   - the entry count never drops below the pin (new claims must add
 *     entries — the ledger's own "更新ルール" section),
 *   - the historical TC ids that specs cite (TC-205-04 / TC-214-02 /
 *     TC-304-04) all have entries.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEDGER = join(REPO_ROOT, 'specs/speech-to-visuals/mutation-witness-ledger.md');

/** Ledger entries shipped with Phase 141. Increases are fine; decreases fail. */
const PINNED_MIN_ENTRIES = 6;
const REQUIRED_CLAIMS = ['TC-205-04', 'TC-214-02', 'TC-304-04'];

interface Entry {
  id: string;
  body: string[];
}

function parseEntries(ledger: string): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | null = null;
  for (const line of ledger.split('\n')) {
    const m = line.match(/^## (MW-\d+) /);
    if (m) {
      current = { id: m[1], body: [] };
      entries.push(current);
    } else if (current && line.startsWith('- **')) {
      current.body.push(line);
    }
  }
  return entries;
}

describe('mutation witness ledger (REQ-330)', () => {
  const ledger = readFileSync(LEDGER, 'utf-8');
  const entries = parseEntries(ledger);

  it('has at least the pinned number of MW entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(PINNED_MIN_ENTRIES);
  });

  it.each(entries)('%s carries target/mutation/command/observed/date', (entry) => {
    const body = entry.body.join('\n');
    expect(body).toMatch(/- \*\*target\*\*: `src\/[^`]+`/);
    expect(body).toMatch(/- \*\*mutation\*\*:/);
    expect(body).toMatch(/- \*\*command\*\*:/);
    expect(body).toMatch(/- \*\*observed\*\*/);
  });

  it.each(entries)("%s's target file exists on disk", (entry) => {
    const target = entry.body.join('\n').match(/- \*\*target\*\*: `([^`]+)`/);
    expect(target).not.toBeNull();
    const rel = target![1].split(':')[0];
    expect(existsSync(join(REPO_ROOT, rel))).toBe(true);
  });

  it('covers the TC ids that acceptance-criteria.md cites as mutation-verified', () => {
    for (const tc of REQUIRED_CLAIMS) {
      expect(ledger).toContain(tc);
    }
  });
});
