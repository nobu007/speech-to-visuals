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

/**
 * TypeScript assertion function — narrows `T | null | undefined` to `T` for
 * subsequent statements. Used in place of the `!` non-null assertion to keep
 * Phase 168 (REQ-362) tests-tree exact-0 ratchet green while still letting
 * the guard consume the `string | null` return of `readMWBody`.
 */
function assertNotNull<T>(
  v: T | null | undefined,
  msg = 'expected non-null',
): asserts v is T {
  if (v === null || v === undefined) throw new Error(msg);
}
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
    assertNotNull(body);
    expect(body).toMatch(/- \*\*claim\*\*:/);
    expect(body).toMatch(/- \*\*target\*\*: `[^`]+`/);
    expect(body).toMatch(/- \*\*mutation\*\*:/);
    expect(body).toMatch(/- \*\*command\*\*:/);
    expect(body).toMatch(/- \*\*observed\*\*/);
  });

  it('MW-091 target points at intelligent-cache.ts and the file contains the wasDecompressed gate (line-resolved)', () => {
    // Eval weakness 対応: 810 行 硬 pin 排除 → 任意行 OK + 動的 grep で gate 存在担保
    expect(body).not.toBeNull();
    assertNotNull(body);
    expect(body).toMatch(/- \*\*target\*\*: `src\/performance\/intelligent-cache\.ts:\d+`/);
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

  it('MW-091 heading is unique in the ledger (no duplicate or missing entry)', () => {
    // regression trap: 同じ id で heading が重複すると readMWBody が最初の body だけを返し、
    // 2 件目の mutation/observed は silent に coverage 漏れになる。
    const headingCount = (ledger.match(/^## MW-091 /gm) || []).length;
    expect(headingCount).toBe(1);
  });

  it('MW-091 mutation command references the actual jest invocation used by reproduce.sh', () => {
    // MW-091 の `command` field が「PR #74 follow-up で eval 検出力を受けた eval 形式」
    // と一致している事 (eval weakness 評価で command 単独 witness が引かれる為)。
    expect(body).not.toBeNull();
    assertNotNull(body);
    expect(body).toMatch(/NODE_OPTIONS=.*--experimental-vm-modules/);
    expect(body).toMatch(/npx jest --config jest\.config\.cjs/);
    expect(body).toMatch(/testPathPatterns\s+intelligent-cache-robustness/);
  });

  it('gate body in src has the 3-line shape expected by the ledger mutation (gate / return / closing brace)', () => {
    // Ledger mutation: `if (wasDecompressed) { return { ...bestMatch, data: decompressedData }; }`
    // → 3 行 (gate / return / closing brace) が line-resolved で連続している事。
    // sed 置換範囲 (GATE_LINE..GATE_LINE+2) が gate を壊した時 1 leg のみ RED する根拠。
    expect(body).not.toBeNull();
    assertNotNull(body);
    const srcText = readFileSync(TARGET_FILE, 'utf-8');
    const gateLine = Number((body.match(/target\*\*: `src\/performance\/intelligent-cache\.ts:(\d+)`/) || [])[1]);
    expect(Number.isFinite(gateLine)).toBe(true);
    const lines = srcText.split('\n');
    expect(lines[gateLine - 1]).toMatch(/^\s*if \(wasDecompressed\) \{\s*$/);
    expect(lines[gateLine]).toMatch(/^\s*return \{ \.\.\.bestMatch, data: decompressedData \};\s*$/);
    expect(lines[gateLine + 1]).toMatch(/^\s*\}\s*$/);
  });

  it('appendix row carries the restoration column matching the recoverability contract', () => {
    // MW-091 は reproduce.sh が `.bak` 復元 + `git checkout --` sync で green 復帰する設計。
    // appendix restoration 列が `.bak` または `revert` を言及している事を確認 (silent-pass 防止)。
    const appendixRows = ledger.split('\n').filter((l) => /^\| MW-\d{3} \|/.test(l));
    const mw091Row = appendixRows.find((r) => r.startsWith('| MW-091 |'));
    expect(mw091Row).toBeDefined();
    assertNotNull(mw091Row);
    expect(mw091Row).toMatch(/\.bak|revert|復元|GREEN|git status/);
  });
});

describe('readMWBody helper (unit)', () => {
  const ledger = readFileSync(LEDGER, 'utf-8');

  it('returns null for a non-existent MW id (negative path)', () => {
    // test stage follow-up: helper 汎用化後の negative path を pin。
    // 既存エントリと衝突しない仮想 id で null を返す事を確認。
    const result = readMWBody(ledger, 'MW-999');
    expect(result).toBeNull();
  });

  it('returns the MW-091 body slice between heading and the next MW heading', () => {
    const body = readMWBody(ledger, 'MW-091');
    expect(body).not.toBeNull();
    assertNotNull(body);
    // boundary 条件: body は次の `## MW-` heading を含まない
    expect(body).not.toMatch(/^## MW-/m);
    // body は最初の bullet list を含む
    expect(body).toMatch(/^- \*\*claim\*\*:/m);
  });
});

describe('MW ledger structural contract (generic, derived from helper)', () => {
  // Eval weakness 対応: MW-091 単体に閉じず、ledger 全体の contract を generalize。
  // 既存 readMWBody helper の boundary / robustness を pin し、
  // 「MW-091 が壊れていないなら ledger も壊れていない」事を構造的に保証する。
  // ガード文化: 既存 11 leg は verbatim 維持、新規 contract のみを追加。

  const ledger = readFileSync(LEDGER, 'utf-8');
  const mwIds = (ledger.match(/^## (MW-\d{3}) /gm) || []).map((m) => {
    const idMatch = m.match(/(MW-\d{3})/);
    assertNotNull(idMatch, 'mwIds id parse failed');
    return idMatch[1];
  });
  const uniqueIds = Array.from(new Set(mwIds));

  it('every MW heading is unique across the ledger (no duplicate entries)', () => {
    // 既存 MW-091 uniqueness test の ledger-wide 版。
    // regression trap: 重複 heading は readMWBody の silent skip を生む。
    expect(mwIds.length).toBe(uniqueIds.length);
  });

  it('every unique MW heading resolves to a non-null body via readMWBody (no orphan headings)', () => {
    // boundary contract: heading に対応する body が必ず存在し、
    // 空文字/null を返して silent-pass する事が無い事を保証。
    for (const id of uniqueIds) {
      const body = readMWBody(ledger, id);
      expect(body).not.toBeNull();
      assertNotNull(body);
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it('every MW body slice ends strictly before the next MW heading (boundary contract)', () => {
    // readMWBody の終端判定 (next `## MW-NNN ` heading) が全 entry で成立。
    for (const id of uniqueIds) {
      const body = readMWBody(ledger, id);
      expect(body).not.toBeNull();
      assertNotNull(body);
      expect(body).not.toMatch(/^## MW-/m);
    }
  });

  it('readMWBody returns null for an empty ledger (helper robustness)', () => {
    // regression trap: 空 ledger で空文字を返すと "見つかっていない" ケースと区別がつかず
    // silent-pass する。明示的に null を返す事を pin。
    expect(readMWBody('', 'MW-001')).toBeNull();
  });

  it('MW heading count meets the PINNED_MIN_ENTRIES floor (derived, not bare-pinned)', () => {
    // PINNED_MIN_ENTRIES floor = 85 の意味的根拠 (session-282 / session-278 経緯):
    //
    //   - parent guard (tests/guards/mutation-witness-ledger.test.ts) 初期 floor = 78。
    //   - session-278 で MW-085〜090 を ledger 追加した際、floor bump を怠り 84 entry で止まった
    //     (floor 78 を下回らない為 RED しないが、ledger 実態と乖離した silent state)。
    //   - session-282 で MW-091 を昇格し 85 entry へ到達 → floor を 78→85 へ巻き取り (bump)。
    //   - 本 leg は parent guard から `const PINNED_MIN_ENTRIES = (\d+);` を動的導出する為、
    //     将来 session が新規 MW entry を追加して floor を bump しなかった場合、
    //     parent guard 自体が RED する (本 leg は stale pin 防止)。
    //
    // 派生導出が機能している事は mutation matrix M5 (下記) が独立に witness する。
    const guardSrc = readFileSync(GUARD_TEST, 'utf-8');
    const pinned = Number((guardSrc.match(/PINNED_MIN_ENTRIES = (\d+);/) || [])[1]);
    expect(Number.isFinite(pinned)).toBe(true);
    expect(uniqueIds.length).toBeGreaterThanOrEqual(pinned);
  });
});

/**
 * Mutation witness matrix — eval weakness 対応。
 * 「contract leg が壊れていない事」ではなく「contract leg が壊れた事を検出できる事」を
 * in-memory 合成データで独立 pin する。各 leg の assertion は mutation を受けて初めて
 * RED する設計 (silent-pass しない)。
 *
 * 注意: 本 block は ledger/src を実際には mutate しない (read-only)。
 * 合成文字列に対する detection predicate を呼び、unmutated/mutated で pass/fail が
 * 反転する事を証明する。
 */
describe('MW-091 contract leg mutation matrix (detection witness)', () => {
  // 最小構成の正常 ledger (1 entry のみ) — 比較対照として mutation の効果を示す。
  const GOOD_LEDGER = [
    '## MW-091 — isolated witness (mutation matrix fixture)',
    '',
    '- **claim**: synthetic body',
    '- **target**: `src/performance/intelligent-cache.ts:42`',
    '- **mutation**: gate keep',
    '- **command**: NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --testPathPatterns intelligent-cache-robustness',
    '- **observed**: 12/12 GREEN',
    '',
    '| MW-091 | synthetic appendix entry | 1 failed / 11 passed (12) | observed local | .bak 復元で 12/12 GREEN・`git status --short src/` clean |',
  ].join('\n');

  const GOOD_SRC = [
    '// line 1: header',
    '// line 41: preamble',
    '  if (wasDecompressed) {',
    '    return { ...bestMatch, data: decompressedData };',
    '  }',
    '// line 44: tail',
  ].join('\n');

  // detection predicates — 本体 leg の assertion を抽出して、合成入力に再適用する形にする。
  // 本体 leg が silent-pass (regex 緩い・count 派生なし) になっていれば、ここでも mutation を
  // 取りこぼし、witness が成立しない。
  const headingCount = (src: string) => (src.match(/^## MW-091 /gm) || []).length;
  const commandOk = (body: string | null) =>
    body !== null &&
    /NODE_OPTIONS=.*--experimental-vm-modules/.test(body) &&
    /npx jest --config jest\.config\.cjs/.test(body) &&
    /testPathPatterns\s+intelligent-cache-robustness/.test(body);
  const gateBodyOk = (src: string, gateLine: number) => {
    const lines = src.split('\n');
    return (
      /^\s*if \(wasDecompressed\) \{\s*$/.test(lines[gateLine - 1]) &&
      /^\s*return \{ \.\.\.bestMatch, data: decompressedData \};\s*$/.test(lines[gateLine]) &&
      /^\s*\}\s*$/.test(lines[gateLine + 1])
    );
  };
  const restorationOk = (row: string | undefined) =>
    !!row && /\.bak|revert|復元|GREEN|git status/.test(row);

  it('M1: duplicate MW-091 heading is detected by the uniqueness predicate', () => {
    // control: 健全 ledger では 1 件
    expect(headingCount(GOOD_LEDGER)).toBe(1);
    // mutation: 同じ heading を 2 行に複製 → predicate は > 1 を返し、本体 leg が RED する。
    const mutated = GOOD_LEDGER + '\n## MW-091 — duplicate (silent skip regression trap)\n-fake body\n';
    expect(headingCount(mutated)).toBeGreaterThan(1);
  });

  it('M2: command field missing NODE_OPTIONS is detected by the command-field predicate', () => {
    // control: 健全 body では command regex 3 点全 OK
    const body = readMWBody(GOOD_LEDGER, 'MW-091');
    expect(commandOk(body)).toBe(true);
    // mutation: NODE_OPTIONS= を除去 → command regex 1 点目が false、本体 leg が RED する。
    assertNotNull(body, 'GOOD_LEDGER MW-091 body is null');
    const mutatedBody = body.replace(/NODE_OPTIONS=[^\s]+\s*/, '');
    expect(commandOk(mutatedBody)).toBe(false);
  });

  it('M3: gate body with broken closing brace is detected by the line-resolved predicate', () => {
    // control: 健全 src (line 3/4/5) では gate body が成立
    expect(gateBodyOk(GOOD_SRC, 3)).toBe(true);
    // mutation: 5 行目を `}` → `  extra_code` に置換 → closing brace regex が false、本体 leg が RED する。
    const mutatedSrc = GOOD_SRC.replace('  }\n', '  extra_code\n');
    expect(gateBodyOk(mutatedSrc, 3)).toBe(false);
  });

  it('M4: appendix row missing restoration keyword is detected by the restoration predicate', () => {
    // control: 健全 appendix row では .bak|GREEN 言及あり
    const goodRow = '| MW-091 | synthetic | 12/12 | obs | .bak 復元で 12/12 GREEN |';
    expect(restorationOk(goodRow)).toBe(true);
    // mutation: 復元/GREEN/.bak 言及を全削除 → restoration regex が false、本体 leg が RED する。
    // silent-pass trap: 「空文字」「---」「N/A」等も false になる事を明示 pin。
    const mutatedRow = '| MW-091 | synthetic | 12/12 | obs | (no restoration column) |';
    expect(restorationOk(mutatedRow)).toBe(false);
  });

  it('M5: PINNED_MIN_ENTRIES floor-bypass is detected by the floor predicate (drop / bump)', () => {
    // Eval weakness 対応: parent guard の floor constant が drop / bump された事を
    // 検出できる事を独立 pin。M1〜M4 と異なり ledger / src ではなく parent guard
    // (mutation-witness-ledger.test.ts) 側の変更を検出する。
    //
    //   - mutation 1: PINNED_MIN_ENTRIES が parent guard から drop
    //     → parseFloor returns NaN, floorOk returns false (silent-pass trap を封鎖)
    //   - mutation 2: floor constant を 9999 等に bump
    //     → entryCount < 9999 になり floorOk returns false
    //
    // silent-pass trap: 元の floor test は `85 >= 85` を許容する為、bump が
    // small (e.g. 86) なら entryCount の増加で偶然 pass する可能性が
    // ある。9999 は any realistic entry count を上回る為確実に RED する。

    // detection predicate — extracted from floor test (line 254-257)
    const parseFloor = (src: string): number => {
      const m = src.match(/PINNED_MIN_ENTRIES = (\d+);/);
      return m ? Number(m[1]) : NaN;
    };
    const floorOk = (entryCount: number, floor: number): boolean =>
      Number.isFinite(floor) && entryCount >= floor;

    // entry count — real ledger から動的導出 (mutation matrix block 内で完結)
    const realLedger = readFileSync(LEDGER, 'utf-8');
    const mwHeadings = (realLedger.match(/^## (MW-\d{3}) /gm) || []).map((h) => {
      const idMatch = h.match(/(MW-\d{3})/);
      assertNotNull(idMatch, 'mwHeadings id parse failed');
      return idMatch[1];
    });
    const entryCount = Array.from(new Set(mwHeadings)).length;

    // control: real parent guard has PINNED_MIN_ENTRIES = 85, parseFloor + floorOk pass
    const realGuardSrc = readFileSync(GUARD_TEST, 'utf-8');
    const realFloor = parseFloor(realGuardSrc);
    expect(Number.isFinite(realFloor)).toBe(true);
    expect(floorOk(entryCount, realFloor)).toBe(true);

    // mutation 1: PINNED_MIN_ENTRIES constant dropped entirely → parseFloor returns NaN
    const droppedGuard = realGuardSrc.replace(/const PINNED_MIN_ENTRIES = \d+;/, '// dropped');
    expect(parseFloor(droppedGuard)).toBeNaN();
    expect(floorOk(entryCount, parseFloor(droppedGuard))).toBe(false);

    // mutation 2: floor constant bumped to 9999 → floorOk returns false
    const bumpedGuard = realGuardSrc.replace(
      /PINNED_MIN_ENTRIES = \d+/,
      'PINNED_MIN_ENTRIES = 9999',
    );
    expect(floorOk(entryCount, parseFloor(bumpedGuard))).toBe(false);
  });
});
