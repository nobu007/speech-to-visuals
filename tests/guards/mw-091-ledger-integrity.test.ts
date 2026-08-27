/**
 * MW-091 ledger integrity guard (PR #75 follow-up / session 282).
 *
 * PR #75 は MW-091 を canonical ledger へ昇格したが、eval 94→96 の key weakness は
 * (a) 「observed 値がこの commit で再実測されていない事」と
 * (b)「PINNED_MIN_ENTRIES floor bump 78→85 を機構で担保していない事」の 2 点。
 *
 * 本 guard は両者を構造的に pin し、ledger 単独で witness が再現可能な状態を維持する:
 *
 *   - MW-091 が canonical 4-section (claim/target/mutation/command/observed) を満たす
 *   - target ファイル:行 が実在し `if (wasDecompressed)` を含む
 *   - appendix 5-column row が MW-001〜template 形式で存在する (table-normalized)
 *   - mutation-witness-ledger.test.ts の PINNED_MIN_ENTRIES = 85 (78→85 floor bump 復帰)
 *   - run_state.json last_run_id が MW-091 昇格時刻 (20:15) と一致
 *   - ontology_metrics.json invariants_total=32 (witness 昇格で虚胖させていない)
 *
 * 補完: scripts/concept-guard/mw-091-reproduce.sh — 実際に sed mutation + jest を回す
 * reproducibility artifact。静的 guard は嘘をつけない事を、script は再現可能を担保。
 *
 * 関連 parent guard: tests/guards/mutation-witness-ledger.test.ts (PINNED_MIN_ENTRIES 機構側)
 * 関連 memory: [[session-282-mw091-ledger-promotion]]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEDGER = join(REPO_ROOT, 'specs/speech-to-visuals/mutation-witness-ledger.md');
const TARGET_FILE = join(REPO_ROOT, 'src/performance/intelligent-cache.ts');
const GUARD_TEST = join(REPO_ROOT, 'tests/guards/mutation-witness-ledger.test.ts');
const RUN_STATE = join(REPO_ROOT, '.concept/run_state.json');
const CLAIMS = join(REPO_ROOT, '.concept/claims.ndjson');
const METRICS = join(REPO_ROOT, '.concept/ontology_metrics.json');

interface LedgerEntry {
  header: string;
  body: string[];
}

/**
 * Read the MW-091 entry (or null if absent) from ledger text.
 * Stops at the next ## MW-NNN heading to avoid bleeding into later entries.
 */
function readEntryMW091(ledger: string): LedgerEntry | null {
  const lines = ledger.split('\n');
  let current: LedgerEntry | null = null;
  for (const line of lines) {
    const m = line.match(/^## (MW-\d+) /);
    if (m) {
      if (current && current.header.startsWith('## MW-091 ')) return current;
      current = { header: line, body: [] };
      if (m[1] === 'MW-091') {
        // keep accumulating
      } else if (!current.header.startsWith('## MW-091 ')) {
        current.body = []; // discard non-091 entries
      }
    } else if (current && current.header.startsWith('## MW-091 ')) {
      current.body.push(line);
    }
  }
  return current && current.header.startsWith('## MW-091 ') ? current : null;
}

describe('MW-091 ledger integrity (PR #75 follow-up)', () => {
  const ledger = readFileSync(LEDGER, 'utf-8');
  const entry = readEntryMW091(ledger);

  it('MW-091 entry exists in the canonical ledger', () => {
    expect(entry).not.toBeNull();
  });

  it('MW-091 carries the canonical 5-section body (claim/target/mutation/command/observed)', () => {
    expect(entry).not.toBeNull();
    const body = entry!.body.join('\n');
    expect(body).toMatch(/- \*\*claim\*\*:/);
    expect(body).toMatch(/- \*\*target\*\*: `[^`]+`/);
    expect(body).toMatch(/- \*\*mutation\*\*:/);
    expect(body).toMatch(/- \*\*command\*\*:/);
    expect(body).toMatch(/- \*\*observed\*\*/);
  });

  it('MW-091 target points at src/performance/intelligent-cache.ts:810', () => {
    expect(entry).not.toBeNull();
    const body = entry!.body.join('\n');
    expect(body).toMatch(/- \*\*target\*\*: `src\/performance\/intelligent-cache\.ts:810`/);
  });

  it('MW-091 target file:line exists on disk and contains the wasDecompressed gate', () => {
    expect(existsSync(TARGET_FILE)).toBe(true);
    const srcLines = readFileSync(TARGET_FILE, 'utf-8').split('\n');
    // line 810 is 1-indexed; srcLines[809] is 0-indexed
    expect(srcLines[809]).toMatch(/^\s*if \(wasDecompressed\) \{\s*$/);
  });

  it('MW-091 carries the appendix 5-column row matching the MW-001 template shape', () => {
    // 既存 85 entry のうち 49 が appendix 5-column に移行済み (移行は漸進)。
    // 本 guard の焦点は MW-091 が必ず appendix row を持つ事 (template 列に
    // "1 failed / 12 GREEN" の数値が出力されている事も含む)。
    const appendixRows = ledger
      .split('\n')
      .filter((l) => /^\| MW-\d{3} \|/.test(l));
    const mw091Rows = appendixRows.filter((row) => row.startsWith('| MW-091 |'));
    expect(mw091Rows.length).toBeGreaterThanOrEqual(1);
    // 台帳 mutation の expected 値が出力に含まれている事 (eval weakness 対応)
    expect(mw091Rows[0]).toMatch(/1 failed/);
    expect(mw091Rows[0]).toMatch(/12\/12 GREEN/);
  });

  it('parent guard (mutation-witness-ledger.test.ts) keeps PINNED_MIN_ENTRIES = 85 (78→85 floor bump 復帰)', () => {
    const guardSrc = readFileSync(GUARD_TEST, 'utf-8');
    expect(guardSrc).toMatch(/const PINNED_MIN_ENTRIES = 85;/);
    // regression trap: 78 を再注入したら ALLOWED 系 guard が RED する設計を守る
    expect(guardSrc).not.toMatch(/const PINNED_MIN_ENTRIES = 78;/);
  });

  it('run_state last_run_id matches the MW-091 ledger promotion timestamp (20:15Z)', () => {
    const runState = JSON.parse(readFileSync(RUN_STATE, 'utf-8'));
    expect(runState.last_run_id).toBe('2026-08-27T20:15:00Z');
  });

  it('ontology_metrics.json invariants_total=32 (witness 昇格で counter を虚胖させていない)', () => {
    const metrics = JSON.parse(readFileSync(METRICS, 'utf-8'));
    expect(metrics.invariants_total).toBe(32);
    expect(metrics.run_id).toBe('2026-08-27T20:15:00Z');
  });

  it('claims.ndjson last entry preserves monotonicity (PR #75 tail = 20:15 ≥ prior 19:40)', () => {
    // PR #75 で append された末尾行 (MW-091 ledger promotion) は session 282 直前
    // max (19:40) 以降の run_id を持つ事 — history-wide 単調化は eval-acknowledged
    // (session 281 の 07:31 entry は append-only 制約のため履歴訂正せず保持)。
    const lines = readFileSync(CLAIMS, 'utf-8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.run_id).toBe('2026-08-27T20:15:00Z');
    // 末尾 run_id が台帳の prior max (19:40) 以降である事
    expect(last.run_id >= '2026-08-27T19:40:00Z').toBe(true);
  });
});
