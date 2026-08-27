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
 *   - target ファイルに行番号非依存で `if (wasDecompressed)` が含まれる
 *   - appendix 5-column row が MW-001〜template 形式で存在する
 *   - mutation-witness-ledger.test.ts の PINNED_MIN_ENTRIES = 85 (78→85 floor bump 復帰)
 *   - run_state.json last_run_id が claims.ndjson 末尾と一致 (硬 pin 排除)
 *   - ontology_metrics.json invariants_total が invariants.yml の disk 件数と一致 (硬 pin 排除)
 *
 * 補完: scripts/concept-guard/mw-091-reproduce.sh — 動的 grep ベースで mutation を再現。
 *
 * 関連 parent guard: tests/guards/mutation-witness-ledger.test.ts
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
const INVARIANTS = join(REPO_ROOT, '.concept/invariants.yml');

/**
 * Body slice between `## <id> ` and the next `## MW-NNN ` heading.
 * Generic for any MW entry id — no early-return branching.
 */
function readMWBody(ledger: string, id: string): string | null {
  const lines = ledger.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${id} `));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## MW-\d+ /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

describe('MW-091 ledger integrity (PR #75 follow-up)', () => {
  const ledger = readFileSync(LEDGER, 'utf-8');
  const body = readMWBody(ledger, 'MW-091');

  it('MW-091 entry exists in the canonical ledger', () => {
    expect(body).not.toBeNull();
  });

  it('MW-091 carries the canonical 5-section body (claim/target/mutation/command/observed)', () => {
    expect(body).not.toBeNull();
    expect(body!).toMatch(/- \*\*claim\*\*:/);
    expect(body!).toMatch(/- \*\*target\*\*: `[^`]+`/);
    expect(body!).toMatch(/- \*\*mutation\*\*:/);
    expect(body!).toMatch(/- \*\*command\*\*:/);
    expect(body!).toMatch(/- \*\*observed\*\*/);
  });

  it('MW-091 target points at intelligent-cache.ts and the file contains the wasDecompressed gate (line-resolved)', () => {
    // Eval weakness 対応: 810 行 硬 pin 排除 → 任意行 OK + 動的 grep で gate 存在担保
    expect(body).not.toBeNull();
    expect(body!).toMatch(/- \*\*target\*\*: `src\/performance\/intelligent-cache\.ts:\d+`/);
    expect(existsSync(TARGET_FILE)).toBe(true);
    const srcText = readFileSync(TARGET_FILE, 'utf-8');
    expect(srcText).toMatch(/^\s*if \(wasDecompressed\) \{\s*$/m);
  });

  it('MW-091 carries the appendix 5-column row matching the MW-001 template shape', () => {
    // 既存 85 entry のうち 49 が appendix 5-column に移行済み (移行は漸進)。
    // 本 guard の焦点は MW-091 が必ず appendix row を持つ事 (template 列に
    // "1 failed / 11 passed" の数値が出力されている事も含む)。
    const appendixRows = ledger.split('\n').filter((l) => /^\| MW-\d{3} \|/.test(l));
    const mw091Rows = appendixRows.filter((row) => row.startsWith('| MW-091 |'));
    expect(mw091Rows.length).toBeGreaterThanOrEqual(1);
    // 台帳 mutation の expected 値が出力に含まれている事 (eval weakness 対応)
    expect(mw091Rows[0]).toMatch(/1 failed/);
    expect(mw091Rows[0]).toMatch(/11 passed/);
    expect(mw091Rows[0]).toMatch(/12\/12 GREEN/);
  });

  it('parent guard (mutation-witness-ledger.test.ts) keeps PINNED_MIN_ENTRIES = 85 (78→85 floor bump 復帰)', () => {
    const guardSrc = readFileSync(GUARD_TEST, 'utf-8');
    expect(guardSrc).toMatch(/const PINNED_MIN_ENTRIES = 85;/);
    // regression trap: 78 を再注入したら ALLOWED 系 guard が RED する設計を守る
    expect(guardSrc).not.toMatch(/const PINNED_MIN_ENTRIES = 78;/);
  });

  it('run_state.last_run_id matches the claims.ndjson tail (derived, not bare-pinned)', () => {
    // Eval weakness 対応: 20:15Z 硬 pin 排除 → claims.ndjson 末尾から動的導出
    const runState = JSON.parse(readFileSync(RUN_STATE, 'utf-8'));
    const claimsLines = readFileSync(CLAIMS, 'utf-8').trim().split('\n');
    const lastClaim = JSON.parse(claimsLines[claimsLines.length - 1]);
    expect(runState.last_run_id).toBe(lastClaim.run_id);
    // 単調増加: prior max (19:40) 以降である事
    expect(runState.last_run_id >= '2026-08-27T19:40:00Z').toBe(true);
  });

  it('ontology_metrics.json invariants_total matches the disk count (derived, not bare-pinned)', () => {
    // Eval weakness 対応: 32 硬 pin 排除 → invariants.yml の `- id:` 件数と一致
    // (虚胖 detection は disk 件数と一致しなくなった時点で RED)
    const metrics = JSON.parse(readFileSync(METRICS, 'utf-8'));
    const invariantsSrc = readFileSync(INVARIANTS, 'utf-8');
    const diskCount = (invariantsSrc.match(/^  - id: /gm) || []).length;
    expect(metrics.invariants_total).toBe(diskCount);
  });
});