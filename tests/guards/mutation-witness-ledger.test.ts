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
 *   - no entry names a `node_modules/**` path in its target/mutation fields
 *     (Phase 178: a hand-patched dependency is invisible to fresh installs,
 *     so any GREEN evidence taken in that state is ungrounded — R5),
 *   - the historical TC ids that specs cite (TC-205-04 / TC-214-02 /
 *     TC-304-04) all have entries.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEDGER = join(REPO_ROOT, 'specs/speech-to-visuals/mutation-witness-ledger.md');

/** Ledger entries shipped with Phase 141 (6) + Phase 142 (MW-007) + Phase 143 (MW-008) + Phase 144 (MW-009) + Phase 145 (MW-010) + Phase 146 (MW-011) + Phase 147 (MW-012, MW-013) + Phase 148 (MW-014) + Phase 149 (MW-015) + Phase 150 (MW-016) + Phase 151 (MW-017) + Phase 152 (MW-018) + Phase 153 (MW-019) + Phase 154 (MW-020) + Phase 155 (MW-021) + Phase 156 (MW-022) + Phase 157 (MW-023) + Phase 161 backfill (MW-024 Phase 158, MW-025 Phase 159, MW-026 Phase 160, MW-027 Phase 161) + Phase 162 (MW-028, MW-029, MW-030) + Phase 163 (MW-031) + Phase 164 (MW-032) + Phase 165 (MW-033) + Phase 166 (MW-034) + Phase 167 (MW-035) + Phase 168 (MW-036) + Phase 169 (MW-037) + Phase 170 (MW-038) + Phase 171 (MW-039) + Phase 172 (MW-040) + Phase 173 (MW-041) + Phase 174 (MW-042) + Phase 176 (MW-043) + Phase 177 (MW-044) + Phase 179 (MW-045) + Phase 180 (MW-046) + Phase 181 (MW-047) + Phase 182 (MW-048) + Phase 183 (MW-049) + Phase 184 (MW-050) + Phase 185 (MW-051) + Phase 186 (MW-052) + Phase 187 (MW-053) + Phase 188 (MW-054) + Phase 189 (MW-055) + Phase 190 (MW-056) + Phase 191 (MW-057) + Phase 192 (MW-058) + Phase 193 (MW-059) + Phase 196 (MW-060, MW-061 — REQ-396/397 facet-5 census guards, verification split from the guard commit) + Phase 201/202 (MW-066 — REQ-402 spine edge bidirectional census) + Phase 204 (MW-067 — REQ-403 boundary strictness census, same-commit MW per the Phase 197 rule) + Phase 205/206 (MW-068 — REQ-404 rounding-mode census, same-commit MW) + Phase 207/208 (MW-069 — REQ-405 fallback-default census, same-commit MW) + Phase 209/210 (MW-070 — REQ-406 spine registry title-sync census, same-commit MW) + Phase 211/212 (MW-071 — REQ-407 sort-receiver-mutation census, same-commit MW) + Phase 218 (MW-075 — REQ-411 dead-idiom sweep #2, nine kinds into the same batch registry, same-commit MW) + Phase 220 (MW-077 — REQ-413 dead-idiom sweep #4, seven kinds into the same batch registry, same-commit MW) + Phase 222 (MW-079 — REQ-415 dead-idiom sweep #6, twenty-two kinds into the same batch registry + global.gc five-site unify, same-commit MW) + Phase 224 (MW-080 — REQ-416 dead-idiom sweep #7, seven kinds into the same batch registry, same-commit MW) + Phase 225 (MW-081 — REQ-417 dead-idiom sweep #8, twelve kinds into the same batch registry, same-commit MW) + 2026-08-27 batch-preset matrix (MW-085〜090 — session 278 shipped them without the floor bump; restored here) + INV-CACHE-002 branch gate (MW-091) + 2026-08-28 PR #23 recovery (MW-092 — REQ-419 sweep #10 union: 31 kinds recovered from the stranded PR into main's post-MW-084 registry, 124→155, same-commit MW). + Phase 229 (MW-093 — REQ-420 design-doc source-currency guard for the stv-core split design-canon sync, same-commit MW; renumbered from the stranded PR #40's MW-085 draft after main took 085-092). Increases are fine; decreases fail. */
const PINNED_MIN_ENTRIES = 87;
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
    // Phase 148 (MW-014) widened the target prefix from `src/` to also allow
    // `tests/` — the ratchet-decrease witnesses mutate test files by design.
    // Phase 163 (MW-031) added `specs/` — the mirror-contract witness mutates
    // a specs markdown file (requirements↔architecture drift) by design.
    expect(body).toMatch(/- \*\*target\*\*: `(src|tests|specs)\/[^`]+`/);
    expect(body).toMatch(/- \*\*mutation\*\*:/);
    expect(body).toMatch(/- \*\*command\*\*:/);
    expect(body).toMatch(/- \*\*observed\*\*/);
  });

  it.each(entries)("%s's target file exists on disk", (entry) => {
    const target = entry.body.join('\n').match(/- \*\*target\*\*: `([^`]+)`/);
    if (target === null) {
      throw new Error(`${entry.id} carries no parsable \`- **target**:\` line`);
    }
    const rel = target[1].split(':')[0];
    expect(existsSync(join(REPO_ROOT, rel))).toBe(true);
  });

  it('bans node_modules/** paths in target/mutation fields (Phase 178 policy)', () => {
    // node_modules 手パッチは tracked diff に存在せず、fresh install で消滅する。
    // その state で取った GREEN 証拠は必ず R5（grounding 不成立）になる —
    // MW-044 の `changePercentOrNull` companion 追加が実例（Phase 177 の
    // tsc-0 claim は v1.0.7 に存在しない export への依存だった）。依存先
    // helper の正規化は in-repo vendoring か version bump のみで行うため、
    // 台帳の target/mutation 欄に node_modules パスを記載することを禁止する。
    // （`command` 欄の `node_modules/.bin/tsc` は実行 binary 指定なので対象外）
    for (const entry of entries) {
      for (const line of entry.body) {
        if (!line.startsWith('- **target**:') && !line.startsWith('- **mutation**:')) continue;
        expect(`${entry.id} target/mutation references node_modules: ${line}`).not.toContain(
          'node_modules/',
        );
      }
    }
  });

  it('covers the TC ids that acceptance-criteria.md cites as mutation-verified', () => {
    for (const tc of REQUIRED_CLAIMS) {
      expect(ledger).toContain(tc);
    }
  });
});
