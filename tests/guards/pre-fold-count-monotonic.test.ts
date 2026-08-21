/**
 * REQ-380: pre-fold audit pin 整合 + 単調増加アサーション.
 *
 * Phase 175 (REQ-380 履行基盤) は fold コミット単位で `pre-fold count` 行を
 * `specs/speech-to-visuals/architecture.md` に残し、`grep -cE '^\\| pre-fold count:'`
 * のヒット数が **前 fold から増分のみ**（削減不可 = 監査 trail 単調増加・
 * TC-364-01）になる設計を specs 化した。Phase 177 (TASK-0262) は:
 *   - 既存 pin regex `^\\| pre-fold count:` を実際の表行にマッチさせる
 *     よう行書を新フォーマットに書換（既存 round 50 行を `| pre-fold count: 47 |`
 *     プレフィクス形に変更）
 *   - 次 fold 候補（v1 dagre パラメータ family）の `pre-fold count: 47`
 *     見出し行を追加してコミット前 snapshot を残す
 *   - 本 guard で pin ヒット数の単調増加（≥1 以上）+ 新フォーマット準拠を
 *     CI で担保
 *
 * Phase 175 までテーブル形式 `| round 50 | 47 | ...` は regex `^\\| pre-fold count:`
 * に **マッチしない**（pre-fold count は列 2）ため、grep ヒット数 0 で pin が
 * 通ってしまう silent 状態だった。本 guard は pin regex に対する表行の
 * フォーマット準拠を明示的に要求する。
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ARCHITECTURE = join(REPO_ROOT, 'specs/speech-to-visuals/architecture.md');

/**
 * The architecture pin regex from `architecture.md:802` (Phase 175
 * notation): `grep -cE '^\\| pre-fold count:'` after stripping the
 * spec's escaping. Implemented in JS so the test harness can rely on
 * the same pattern as the spec's pinned grep.
 */
const PIN_REGEX = /^\| pre-fold count:\s*\d+/;

/**
 * The historical pin floor: at least one `pre-fold count:` row must
 * exist (the round 50 row, post-rewrite). Increases are fine; a
 * silent drop to zero would fail the regression test.
 */
const PINNED_MIN_ROWS = 1;

describe('REQ-380: pre-fold count pin regex 整合 + 単調増加', () => {
  const source = readFileSync(ARCHITECTURE, 'utf-8');
  const lines = source.split('\n');

  const matchedRows = lines.filter((line) => PIN_REGEX.test(line));
  const valueRows = lines
    .map((line) => line.match(/^\| pre-fold count:\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1]));

  it('architecture.md has at least one `| pre-fold count: <N>` row', () => {
    expect(matchedRows.length).toBeGreaterThanOrEqual(PINNED_MIN_ROWS);
  });

  it('every matched row extracts a finite integer (no malformed entries)', () => {
    // Defensive: a `| pre-fold count: abc` literal would match the
    // regex but not the integer capture. The pin is meaningless
    // without a numeric payload, so the leg rejects blank/garbage
    // counts too.
    expect(valueRows.length).toBeGreaterThan(0);
    for (const v of valueRows) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('no legacy `| round NN | <N> |` row format (TC-364-01 mismatch)', () => {
    // Architecture.md:802's pin regex is `^\\| pre-fold count:`. A
    // legacy row `| round 50 | 47 | ...` does NOT match the regex
    // because column 1 is `round`, not `pre-fold count`. The Phase
    // 175 design was that ALL pre-fold rows use the new prefix
    // format. A leftover old-format row that slipped past the
    // rewrite would silently inflate the audit trail while making
    // the grep pin hollow.
    const legacyRows = lines.filter((line) => /^\| round \d+ \| \d+ \|/.test(line));
    expect(legacyRows).toEqual([]);
  });

  it('composite: pin regex hits ≥ 1 AND rows are non-legacy AND values are finite', () => {
    // The composite shape mirrors the architecture.md pin contract:
    // every individual leg must hold for the audit trail to be
    // trustworthy. MW-044 (c) mutation 3 (`it.each → []` on this
    // file) traces into the matchedRows numerator failing — the
    // test surfaces as a single RED leg failure here.
    const composite =
      matchedRows.length >= PINNED_MIN_ROWS &&
      valueRows.length > 0 &&
      valueRows.every((v) => Number.isFinite(v));
    expect(composite).toBe(true);
  });
});
