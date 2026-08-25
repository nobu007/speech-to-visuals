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
  liveness fixture (a)〜(w)）
- 測定 script: `/tmp/measure.mjs`（walk = walkProductionSurface と同一）
- 先行 family: REQ-405（fallback-default）・REQ-407（sort-receiver）/
  REQ-409（reduce-initial-value・parallel branch）

## REQ-412 sweep #3（2026-08-25・Phase 219）

- **計測**: 13 candidate class を detector 最終形と同一 regex で 331 file
  に計測（`parseint-no-radix` の lookbehind `(?<![.\w$])` 追加は
  `Number.parseInt(v, 10)` 誤検出の除外 — fixture 作成時に発見）。
- **評決の内訳**: exact-0 pin 10 kind / VIOLATION unify 1 kind
  （parseint-no-radix 5 site — 同一 file・同一 shape の cluster）/
  ALLOWED 2 kind（from-char-code 5 site byte-domain・proto-key-literal
  1 site sanitizer blocklist）/ pin 前棄却 1 class（Math.pow — `**` と
  挙動完全一致のため style 嗜好の noise のみ）。
- **byte-domain 判定の根拠**: fromCharCode は ToUint16 で code point
  > 0xFFFF を黙って wrap するが、実測 5 site は PNG/APNG/GIF chunk-type・
  version 構築（Uint8Array 要素読み 0..255）と RLE marker
  （`count < 255` guard で上限）で fromCharCode が厳密に等価。
  `fromCodePoint` 置換は可（stale-row で同一 commit の roster 更新を強制）。
- **`>>> 0` の class 外 scoping**: CRC32（apng-encoder）と mulberry32
  （layout-rng）は unsigned coercion として `>>> 0` を**要求**する
  （32-bit unsigned accumulator）。bitwise-truncation kind は `~~` / `| 0`
  のみを管轄 — bit 演算の正当利用を false-positive にしない scoping。

## REQ-413 sweep #4（2026-08-25・Phase 220）

- **計測**: 10 candidate class を detector 最終形と同一 regex で 331 file
  （src + core-four）に計測。src 単独 grep と core 側 grep の両方で実施
  （coercing-isfinite の前例に倣い core も必ず測る）。
- **評決の内訳**: exact-0 pin 6 kind（primitive-wrapper-ctor /
  arguments-index-access / regexp-literal-ctor / split-join-replaceall /
  label-statement / bare-encodeuri）/ ALLOWED 1 kind（var-declaration
  2 site — `declare global {}` 内の型のみ ambient 宣言）/ pin 前棄却
  3 class（`.map(async` は消費側判定で行 detector 不可視・
  `new Array(n)` は hole-read なし・`Math.max(...xs)` 25 site は全
  入力有界）。
- **split-join の off-walk 帰属**: repo hit 2 件は
  `src/export/__tests__/{xml-escape-cross-invariant-fuzz,xss-security}.test.ts`
  の test fixture で walk（`__tests__`/`*.test.*` 除外）の管轄外。
  production surface は 0 — pure ratchet。
- **`declare global` 判定の根拠**: browser-transcriber.ts:449 が
  `declare global {` で :497/:502 の `var X: { prototype; new (): T }`
  は ambient 型宣言（runtime emit ゼロ・DOM-lib 正典形）。
  runtime `var` の新規出現は unrostered RED。
