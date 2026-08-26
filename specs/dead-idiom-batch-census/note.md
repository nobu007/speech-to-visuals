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

## REQ-414 sweep #5（2026-08-25・Phase 221）

- **計測**: 17 candidate class を detector 最終形と同一 regex で 331 file
  （src + core-four）に計測（REQ-413 と同じ手順・src 単独 grep と core 側
  grep の両方を実施）。
- **評決の内訳**: exact-0 pin 11 kind（nan-comparison /
  bitwise-not-indexof / throw-string / legacy-endswith /
  legacy-datetime-now / unary-plus-date / concat-empty-coercion /
  deprecated-keycode / caller-callee-access / document-all /
  array-prototype-generic-call）/ ALLOWED 3 kind 各 1 site
  （console-debug-log は core logger :20・process-exit は api/index :64・
  tolocalestring-bare は core guards :114）/ pin 前棄却 3 class
  （charCodeAt は投資不釣合型・assignment-in-condition は検出不可能型・
  charAt は挙動等価型 — REQ-412-005 / REQ-413-003 で確立した 3 理由型の
  それぞれ 2 例目）。
- **core-file ALLOWED の帰属**: ALLOWED 2 key（logger :20・guards :114）
  は @stv/core 側 file。worktree の `src/utils/` に実在しない rel でも
  `readSource` の core-four routing で hit が解決するため roster key は
  `src/...` 形式のまま（coercing-isfinite の前例と同じ扱い）。
- **detector scoping の設計**: (a) unary-plus-date は lookbehind
  `(?<==|\(|return)` で `= +new Date` / `(+new Date` / `return +new Date`
  形のみを捉え、binary 文字列連結（`'at ' + new Date()...`）を除外。
  (b) legacy-datetime-now は getTime/getMilliseconds/valueOf のみを管轄 —
  `getHours()` は timezone 未依存の正当な local-field API（唯一の raw hit
  advanced-layouts.ts:236 は class 外）。(c) tolocalestring-bare は引数
  ゼロ形式のみ（explicit-locale 指定は class 外）。(d) concat-empty-coercion
  は `+ ''` / `+ ""` 形のみ（quote 文字の組み立て `'"'` は誤検出のため
  除外済み・probe で実証）。
- **process-exit の文脈 pin**: api/index.ts:64 は gracefulShutdown の
  epilogue（全 background service 停止 log の後）。negative anchor は
  「log → exit」の順序を正規表現で固定し、library / pipeline / component
  code への process.exit 出現は unrostered RED（MW-078 (c) で
  stale-row + floor の双方向 teeth を実証）。

## REQ-415 sweep #6（2026-08-25・Phase 222）

- **計測**: 23 candidate class を detector 最終形と同一 regex で 331 file
  （src + core-four）に計測。detector 改善（minified-boolean-literal の
  前置演算子文脈 class + 行頭形・blocking-dialog の `window.` 修飾形式
  取り込み・useragent-sniffing の `userAgentData` 除外 lookahead）の
  たびに全候補を再計測し、最終形の hit 数で評決した。
- **評決の内訳**: exact-0 pin 19 kind / **unify 1 kind 5 site**
  （node-global-identifier — batch 形式初の VIOLATION cluster・
  `global.gc` → `globalThis.gc`）/ ALLOWED 2 kind 4 site
  （blocking-dialog は GuardMetricsDashboard :90 の confirm gate・
  useragent-sniffing は production-error-handler :271/:461 と
  browser-transcriber :257 の UA report-only）/ pin 前棄却 1 class
  （legacy-substring 23 site — 投資不釣合型 3 例目）。
- **`global.gc` unify の根拠**: Node では `global === globalThis`・
  browser/ESM では `global` 未定義のため unguarded 2 site は潜在
  ReferenceError。main-pipeline の `typeof global !== 'undefined'` guard
  は `global` 綴りの workaround で `globalThis` では不要 — 3 file を
  同一 shape に統一し anchor + count pin（合計 6 出現）で固定。
  MW-079 (b) で revert が completeness + eradicated-reappear +
  negative anchor の 3 独立面 RED を発火することを実測。
- **blocking-dialog ALLOWED の条件**: confirm が破壊操作（security
  metrics の全 reset）の直前 gate であることを anchor で固定。
  gate 削除は MW-079 (c) で stale-row + floor + anchor の 3 面 RED。
  UI flow 外（pipeline / library / api）の blocking dialog は
  unrostered RED のまま。
- **useragent-sniffing ALLOWED の条件**: 3 site とも UA の**参照**は
  telemetry field / diagnostics 表示で**挙動分岐なし**。能力判定は
  feature detection（`isRecognitionSupported` 等）が担っており、
  UA 値による分岐復活は unrostered RED（negative anchor は
  report-only 形を固定）。
- **legacy-substring 棄却の根拠**: 23 site 全て `substring(0, N)`（0-start
  切り詰め）か Math.min/max 正規化 span で、class 唯一の incident shape
  （indexA > indexB の引数 swap）に到達不能。charCodeAt・Math.max(...xs)
  と同型の投資不釣合 — swap 可能形出現時の再計測を guard header に明示。
- **CJS 綴り 4 kind（esm-require-call / esm-module-exports /
  esm-cjs-global / node-global-identifier）の位置づけ**: 本 repo は
  ESM 統一のため src 側 0 件が期待値。将来の CJS 取り込み（file copy-in・
  vendoring）や bundler 設定変更で混入した場合に最初の 1 file で RED。
  `.ts` 拡張 import（ESM loader 実行）との混同は `require(`/`module.exports`
  の綴り判定で構造的に回避。

## REQ-416 sweep #7（2026-08-26・Phase 224）

- **計測**: 10 candidate class を detector 最終形と同一 regex で 331 file
  （src .ts+.tsx + core-four）に計測。本 sweep は走査面の再確認から
  入った — 初回計測が 278 file で従来 sweep の 331 と不一致だったため
  `walkProductionFiles` の拡張子 filter（`/\.(ts|tsx)$/`）を照合し
  `.tsx` 53 file の取りこぼしを修正してから評決（detector の見落としは
  exact-0 false-pin に直結するため走査面の一致は前提条件）。
- **評決の内訳**: exact-0 pin 7 kind（async-promise-executor /
  array-delete-hole / instanceof-primitive-wrapper / atob-btoa /
  inner-html-op-assign / insert-adjacent-html / sparse-array-ctor）/
  ALLOWED・ERADICATED rosterは不変（18/12）/ pin 前棄却 3 class
  （`.length = 0` 10 site と `.splice(…)` 27 site は投資不釣合型
  4/5 例目・`return` in `finally` は検出不可能型 2 例目）。
- **inner-html-op-assign の位置づけ**: REQ-415 の inner-html-assignment
  （`\.innerHTML\s*=`）は compound 代入 `+=` を検出しない。同 class の
  別 kind として登録し（regex 拡張ではなく新 entry — 既存 kind の
  検出域変更は ALLOWED 判断の意味を変えるため）、fixture (aa5) で
  `=` 形が inner-html-assignment に帰着することも固定。
- **棄却の根拠**: `.length = 0` は全 10 site が instance-owned receiver
  の意図的 drain（CappedArray 自身の clear を含む）で incident なし。
  `.splice` は全 27 site が queue primitive として正当（優先度挿入・
  dequeue・DLQ purge）で receiver-mutation 概念は family 16 で正典化
  済み。`return` in finally は block-scope parse が必要（行 detector
  不可視）に加え、finally 行 detector の site 母集団が「全 finally
  block」（13 site すべて cleanup-only）で incident 母集団と不一致 —
  pin は今後の正当な try/finally 追加に roster 行を課す逆薬剤。
- **再計測条件**: 変数長 `new Array(n)` site 出現時（literal 形のみ
  pin）・`.length = 0` / `.splice` の aliasing incident 実出現時・
  finally 内 return の実出現時（AST pass の投資判断をその時点で）。
