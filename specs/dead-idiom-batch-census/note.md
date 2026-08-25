# dead-idiom batch census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜410 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25 / **要件ID**: REQ-410（family 19・batch 形式）

## 技術的背景

- **測定器 = guard と同一実装**: sweep は guard の regex/predicate を使って
  production surface（src 296 + @stv/core core-four 35 = 331 file）を計測。
  手動 grep と計数一致。
- **7 class の評価軸**（なぜ style でないか）:
  - global `isNaN`/`isFinite` は **coercing 述語**（`isFinite('12') === true`）。
    operand type が拡張された瞬間に verdict が黙って反転する。本 repo の
    NaN-routing incident 系（REQ-375 null 誤平均化など）と同 shape。
  - `.forEach(async …)` は promise を hand-off なしに捨てる（unhandled
    rejection・順序喪失・caller の await が無意味化）。
  - unfiltered `for…in` は prototype chain key を data として読む。
  - `x.indexOf(y) !== -1` 系・nonnullish `==`/`!=`・直呼び `.hasOwnProperty(`
    は legacy spelling（`.includes` / `===` / `Object.hasOwn`）。現存 0 件の
    純 ratchet。
- **unify 2 site の等価性**: `src/remotion/srt-parser.ts:98`（`parseInt(…, 10)`
  返り値は常に number）と `src/pipeline/quality-monitor.ts:637`（REQ-375
  typeof filter 通過後）は `Number.isNaN` 化で挙動等価。typeof guard は
  維持（`Number.isNaN(null)` も false）。
- **@stv/core 側 site**: `src/utils/audio-duration.ts:47`（`formatDuration(seconds:
  number)`）は package 所有のため in-tree 修正不可 → ALLOWED の CORE-TYPED
  判断（core 側 CI へ移譲）。

## 開発ルール（本 family の形式）

- **kind registry 契約**: class 追加は `IDIOM_KINDS` 1 entry のみ
  （steering の batch 指示）。spec 側の kind 表も 1 行追記。
- **roster は 2 block 共通**: ALLOWED（cross-kind・key = `rel:line`）/
  ERADICATED（unify 済み site）。three-way 句 `ALLOWED 2 key` /
  `ERADICATED 2 key` は実測から build。
- **guard は行 scan のみ**（AST なし）— ceiling は guard header と
  REQ-410-008 に明記。

## 関連実装

- guard: `tests/guards/dead-idiom-batch-census.test.ts`（kind registry +
  liveness fixture (a)〜(h)）
- 測定 script: `/tmp/measure.mjs`（walk = walkProductionSurface と同一）
- 先行 family: REQ-405（fallback-default）・REQ-407（sort-receiver）/
  REQ-409（reduce-initial-value・parallel branch）
