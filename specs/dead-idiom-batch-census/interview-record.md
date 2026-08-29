# dead-idiom batch census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

make-run steering の投資対効果指示（要件化の前に discovery sweep・zero class
の batch 統合・実違反 class への集中）を family 19 として最初に適用するにあたり、
sweep の実測値と steering 記号の実在性を確認する。

## 分析項目と判断

### A1: steering 具体記号の実在性（phantom 判別）

**分析日時**: 2026-08-25
**カテゴリ**: 影響範囲
**背景**: steering が TASK-0378・`_TOL_MEAN`/`_TOL_*` 許容差・Makefile
test-performance・厳密有理数/Fraction 鎖・sqrt/log 鎖 'irrational' 分類を
点名した。これらは本 repo の成果物か。

**判断**: **全て cross-repo phantom**（他 hub repo 由来の記号）。grep で
`TASK-0378` 0 件・`_TOL_` 0 件・Makefile 不在（npm scripts 運用）・
Fraction/厳密有理数 boundary class は本 repo の census 系列に存在しない。
ただし **meta-intent は実在**し本要件が直接採用: 「要件化の前に discovery
sweep を先走らせ、mixed cluster ゼロの class は軽量 batch guard にまとめる」
（採用）・「同型 gate の 10 個目を増やすより残 site の扱いを確定」（kind
registry の ceiling 明記で対応・REQ-410-008）・「正確性修正が性能回帰を黙っ
て持ち込まない」（本要件の検証は行 scan のみ・< 1s・guard 実行時間を非機能
要件に pin）・「impl が既に exact な箇所への隣接許容の展開」（isNaN 2 site
は semantic 等価の spelling unify として同梱・隠れた許容は残さない）。
**根拠**: `grep -rn "TASK-0378\|_TOL_" specs docs tests src` 0 件・
`ls Makefile` 不在・REQ-409（family 18）は seedless reduce であり
Fraction 系ではない

**信頼性への影響**:

- steering 記号の直接要件化を回避し meta-intent のみ採用 → REQ-410 の
  信頼性は 🔵（実測 331 file / 7 class に直結）
- parallel branch との番号衝突を `git log --all` で事前確認:
  REQ-408/409（family 17/18・TASK-0297〜0300・MW-072/073）は本 branch に
  未 landing → 本要件は **REQ-410 / TASK-0301 / MW-074 / Phase 217** を採番

---

### A2: discovery sweep の計測（要件定義の前提）

**分析日時**: 2026-08-25
**カテゴリ**: 未定義部分詳細化
**背景**: 要件化前に 7 candidate class を production surface で計測する
（steering 指示の sweep-first）。

**判断**: 測定器は guard と同一 regex/predicate（`/tmp/measure.mjs`・
walkProductionSurface と同一 walk: src 296 + @stv/core core-four 35 = 331 file）。
結果: coercing-isnan **2**（src・両方 unify 可能）/ coercing-isfinite 1
（core・typed param）/ unguarded-for-in 1（src・guarded）/ 
unawaited-async-foreach 0 / legacy-indexof-membership 0 / 
loose-equality-nonnullish 0 / bare-hasOwnProperty 0。
手動 grep と測定器の計数は一致（session-215 の manual-vs-guard 食い違い
gotcha は本件では不発・測定器を正本とした）。
**根拠**: 測定ログ（kind毎 file:line 付き・guard の baseline pin と同一値）

**信頼性への影響**:

- 要件の全数記載が実測由来 → REQ-410-002〜004 は 🔵
- ERADICATED 2 key は fix 後の再計測で 0 件を確認済み

---

### A3: batch 形式の採用（spec 構造の差分）

**分析日時**: 2026-08-25
**カテゴリ**: 追加要件
**背景**: family 15/16 は violation ゼロに 6 file spec + 2 phase を投下し、
steering から ROI 低下を指摘された。

**判断**: 本 family は (a) spec を 5 file・1 phase・1 TASK に縮約、
(b) guard を kind registry 形式（class 追加 = 1 entry）とし、(c) 実測違反
2 site のみ src 変更として同梱、(d) MW-074 は 3 mutation で kind 独立性を
検証 — steering の batch 契約の最初の実装例。
**根拠**: steering feedback（REQ-405 採点後）・REQ-407 規約との差分は
tasks/overview.md の形式 note に明記

**信頼性への影響**:

- 新規要件 REQ-410-001（kind registry 契約）を追加（🔵・実装と liveness
  fixture が対応）

---

## 分析結果サマリー

### 確認できた事項

- 7 class の実測（331 file walk・file:line 付き）と steering meta-intent の採用可否
- parallel branch 採番の衝突回避（REQ-410 / TASK-0301 / MW-074 / Phase 217）
- 手動 grep と guard 測定器の計数一致

### 追加/变更要件

- REQ-410（batch census・7 kind・ALLOWED 2 key / ERADICATED 2 key）新設
- src 2 site の `Number.isNaN` unify（semantic 等価・REQ-375 guard 維持）

### 残課題

- `@stv/core` 側 `audio-duration.ts:47` の `Number.isFinite` 化は core 側
  CI の follow-up（in-tree 不可・ALLOWED の CORE-TYPED 判断に明記）
- 跨ぎ行 idiom（行単位 detector の ceiling）は AST pass が必要 — 現存 0 件

### 信頼性レベル分布

**分析前**: 🔵 0 / 🟡 0 / 🔴 0（要件未存在）
**分析後**: 🔵 8（REQ-410-001〜007・TC 群）/ 🟡 1（REQ-410-008 ceiling 明記）

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
- **タスク概要**: [tasks/overview.md](tasks/overview.md)

---

# REQ-411 追加分析（第二回 discovery sweep・2026-08-25）

## A-411-1: steering 第 2〜4 条（TASK-0378 / _TOL_* / Fraction 鎖 / Makefile test-performance）の適用可否

**分析日時**: 2026-08-25
**カテゴリ**: 技術選択
**背景**: make-run steering が TASK-0378・`_TOL_MEAN`/`_TOL_*` 許容差・
Fraction 鎖（ランク和・Friedman ループ）・Makefile `test-performance` の
実行時間上限を改善対象に挙げた。

**判断**: **cross-repo contamination で本 repo には適用不能**（前回
Phase 217 と同一の結論を再確認）。
**根拠**: `TASK-0378` 0 件・`_TOL_` 0 件・Makefile 不在（npm scripts 運用）・
統計 Fraction 鎖を担う module なし（`Fraction` の grep hit は
`iteration-manager.ts` / `visualization/types.ts` の無関係 field 名のみ・
Friedman/ランク和 0 件）。正格有理数境界 class 自体が本 repo に存在しない。

**信頼性への影響**:

- steering の適用対象は第 1 条（batch 契約の継続）のみであり、REQ-411 は
  それに従う（影響なし・判断記録のみ）

## A-411-2: 第二回 sweep の候補選定と pin 前棄却

**分析日時**: 2026-08-25
**カテゴリ**: アーキテクチャ（guard 設計）
**背景**: steering 契約「要件化の前に discovery sweep を先走らせ」の
2 回目。候補 11 class を detector 最終形で 331 file に計測した。

**判断**: 9 kind を registry 追加（8 class exact-0・json-clone 1 site は
ALLOWED）。**2 class を pin 前に棄却**: `with` 文と `arguments.callee` は
TS/ESM strict で SyntaxError のため tsc が常時弾き、guard の teeth が
tsc と重複する冗長 pin になる。
**根拠**: `find src + core-four（331 file）` に対する最終 detector での
計測（`/tmp/surface.txt` と同一の file 集合・xargs grep）。tsc baseline 0
運用（Phase 169）により構文混入は CI で即座に FAIL する。

**信頼性への影響**:

- REQ-411-001（9 kind 追加）と REQ-411-003（棄却記録）を追加（🔵）

## A-411-3: json-clone 1 site の ALLOWED 判断（unify 不採用の根拠）

**分析日時**: 2026-08-25
**カテゴリ**: データモデル
**背景**: `src/optimization/adaptive-content-processor.ts:185` の
`JSON.parse(JSON.stringify(baseStrategy)) // Deep copy` が唯一の実測 hit。
structuredClone への unify を検討した。

**判断**: **ALLOWED（src 変更しない）**。
**根拠**: (a) `ProcessingStrategy`（:12）は string/number/enum-literal
のみの JSON-safe 型で round-trip は損失なし、(b) `structuredClone` は
Node 24（v24.11.1）の global に存在するが **jest vm context には存在
しない**（2026-08-25 実測 probe: `typeof structuredClone` が 'undefined'
で fail — ESM vm sandbox が Node global を注入しない）。unify は該当
module の test 実行を即座に破壊する、(c) repo に既存 deep-clone helper
なし。interface が non-JSON field を得た時点の再判断を ALLOWED row の
理由文に明記（stale-row + negative anchor が spelling 変更を RED にし、
同一 commit での roster 更新を強制する）。

**信頼性への影響**:

- REQ-411-002（ALLOWED 判断と再判断条件）を追加（🔵・probe 実測付き）

## 分析結果サマリー（REQ-411 分の追計）

### 確認できた事項

- 11 candidate class の実測（331 file・detector 最終形と同一 regex）
- steering 第 2〜4 条の phantom 再確認（前回判定と不変）
- jest vm context の structuredClone 欠落を実 probe で確認

### 追加/変更要件

- REQ-411-001〜005（9 kind 追加・ALLOWED 1 key・棄却記録・ceiling・MW-075）

### 残課題

- 跨ぎ行 idiom・複行 empty-catch は引き続き AST pass が必要（現存 0 件）
- core 側 `audio-duration.ts:47` の isFinite 化は引き続き core CI 移譲

### 信頼性レベル分布（REQ-411 追計分）

**分析後**: 🔵 5（REQ-411-001〜005）/ 🟡 0

---

# REQ-412（第三回 discovery sweep）分析記録 — 2026-08-25

## A-412-1: 第三回 sweep の候補選定と評決内訳

**背景**: steering 契約（REQ-410 確立・REQ-411 定着）の 3 回目の適用。
sweep #1/#2 が述語・legacy spelling 中心だったのに対し、sweep #3 は
ctor/abort 系 API・bit 演算・radix の 3 系統から 13 candidate を選定。

**手法**: detector 最終形と同一 regex を `walkProductionSurface()`
（331 file・repo src/ 296 + @stv/core core-four 35）に走らせて計測
（comment 行 skip は `isCommentLine` と同一実装・手動 grep と計数一致）。

**評決内訳**:

| 評決 | class | 実測 |
|------|-------|------|
| exact-0 pin | bitwise-truncation（`~~`/`\| 0` のみ）・legacy-push-apply・apply-null-spread・new-function-ctor・deprecated-date-api・debugger-statement・document-write・arraylike-slice-call・constructor-index-access（10 kind 中 9）+ parseint unify 後 | 0 |
| VIOLATION unify | parseint-no-radix | 5（同一 file・同一 shape） |
| ALLOWED roster | from-char-code・proto-key-literal | 5 + 1 |
| pin 前棄却 | Math.pow（`**` と挙動完全一致） | 13 |

**根拠**: `/tmp/sweep3.ts`（tsx で guard helper を直接 import する計測
script）の出力・ProductionDashboard.tsx :156/:170/:187/:320/:359 の
read・fromCharCode 5 site の引数域 read（Uint8Array 要素読み・
`count < 255` loop guard）・untrusted-json-core.ts:38 の blocklist 定義 read。

**信頼性への影響**: REQ-412-001〜005 を追加（🔵・実測と実コード read 付き）。

## A-412-2: Math.pow の pin 前棄却（REQ-411-003 系列の 2 例目）

**背景**: Math.pow は 13 site と sweep #3 最大の cluster。pin すれば
kind 追加 + 13 ALLOWED row が必要。

**判断**: 棄却。`Math.pow(a, b)` と `a ** b` は**挙動完全一致**（負底の
小数指数は両方 NaN・ToNumber は同じ・V8 で両方同等に扱われる）。deprecated
でも legacy でもなく、incident shape（黙判反転・resource 破壊・inject 面）
が一切ない。pin は style 嗜好（`**` 派）を恒久 roster に強制するのみ。

**REQ-411-003 との対比**: 同じ「棄却にも根拠を残す」系列だが理由が違う —
`with`/`arguments.callee` は「tsc が常時弾くので teeth が重複」、
Math.pow は「teeth が無い（挙動差ゼロ）」。両方の棄却理由型を記録した
ことで将来の候補は「tsc 重複型」「挙動等価型」のどちらかで判定できる。

**信頼性への影響**: REQ-412-005 に棄却根拠を明記（🔵）。

## A-412-3: fromCharCode 5 site の ALLOWED 判断（byte-domain の実証）

**背景**: `String.fromCharCode` は ToUint16 を適用するため code point
> 0xFFFF は黙って wrap する（`fromCharCode(65536) === '\0'`）。
`fromCodePoint` との差は実際の incident shape（サロゲート対の破損）。

**判断**: 5 site すべて ALLOWED（byte-domain）:

- `apng-encoder.ts:275` — PNG chunk type を `apng[pos+4..7]`（Uint8Array
  要素 = 0..255）から構築
- `export-verifier.ts:198` — GIF version `view[3..5]`（同上）
- `export-verifier.ts:363` — PNG chunk type `view[offset+4..7]`（同上）
- `intelligent-cache.ts:153/:163` — RLE marker `fromCharCode(255)` 固定値 +
  `count` は `count < 255` loop guard で 1..255 に上限

0..255 では fromCharCode は fromCodePoint と厳密に等価（サロゲート領域に
到達しない）。**teeth は生存**: 新規 site が code point > 0xFFFF を渡すと
unrostered RED として判断を強制される。`fromCodePoint` への置換も可
（stale-row で同一 commit の roster 更新を強制）。

**proto-key-literal 1 site**: hit は `PROTOTYPE_POLLUTION_KEYS` blocklist
自身（防御が照合する string data）で object-literal key ではない。surface
上の他の 4 出現は全て comment 行（discovery skip 済みを計測 script で確認）。

**信頼性への影響**: REQ-412-003/004 を追加（🔵・引数域 read 付き）。

## 分析結果サマリー（REQ-412 分の追計）

### 確認できた事項

- 13 candidate class の実測（331 file・detector 最終形と同一 regex）
- parseint-no-radix 5 site が同一 file・同一 shape の VIOLATION cluster
  であること（decimal 入力で等価・hex prefix で黙変換）
- fromCharCode 5 site の引数域が全て 0..255 に bounded であること
- Math.pow と `**` の挙動完全一致

### 追加/変更要件

- REQ-412-001〜005（12 kind 追加・unify 5 site・ALLOWED 2 kind・棄却記録・MW-076）

### 残課題

- `>> 0` / `<< 0` truncation 綴りは bitwise-truncation kind の死角
  （現行 surface で該当なし・REQ-410-008 (f) に明記）
- 跨ぎ行 idiom は引き続き AST pass が必要（sweep #1 からの持ち越し）

### 信頼性レベル分布（REQ-412 追計分）

**分析後**: 🔵 5（REQ-412-001〜005）/ 🟡 0

## A-413-1: 第四回 discovery sweep の候補選定と計測（2026-08-25）

**背景**: REQ-410〜412 で主要な dead idiom は採掘済み。sweep #4 は
「JS/TS の legacy・危険イディオムの残り領域」を対象に候補を立て、
src 単独 grep と core-four grep の両方で計測した（coercing-isfinite
の前例 — core 側だけに site がある class を取りこぼさない）。

**計測結果（10 candidate）**:

| candidate | src | core | 備考 |
|-----------|-----|------|------|
| `new Number/String/Boolean(` | 0 | 0 | wrapper box 化（`new Number(1) === 1` は false） |
| `arguments[` | 0 | 0 | param alias・非配列 |
| 完全 literal `new RegExp('…')` | 0 | 0 | `'\\b'` vs `'\b'` typo class |
| `.split(sep).join(repl)` | 0（prod）| 0 | test 2 件は off-walk |
| `label: for (` | 0 | 0 | pre-extract-function 制御フロー |
| 裸 `encodeURI(` | 0 | 0 | query 値の `&=?#` 未 escape |
| 行頭 `var ` | 2 | 0 | 両方 `declare global` 内 |
| `.map(async` | 2 | — | 棄却 (a) |
| `new Array(n)` / `Array(n)` | 7+ | — | 棄却 (b) |
| `Math.max(...xs)` 系 | 22 | 3 | 棄却 (c) |

**判断**: 上位 7 class を kind 化。`var` 2 site は
browser-transcriber.ts:449 の `declare global {` block 内であることを
実コード読みで確認し AMBIENT-SYNTAX ALLOWED とした。

**信頼性への影響**: REQ-413-001/002 を追加（🔵）。

## A-413-2: pin 前棄却 3 class の根拠（REQ-413-003）

- **`.map(async …)`（2 src site）**: enhanced-error-recovery.ts:1414 と
  main-pipeline.ts:732 はどちらも返り値の promise 配列を await する正規
  形（`Promise.allSettled` / `layoutPromises`）。可否は**消費側**で決まる
  ため行 detector には見えず、pin は全 future site を誤検出する純 noise。
  drop 形の `.forEach(async` は unawaited-async-forEach kind が既に管轄。
- **`new Array(n)`（7 src site）**: untrusted-json-core / parallel-layout-
  executor / batch-operation-recovery / enhanced-error-recovery /
  batch-optimizer / timeline-strategy はすべて sized-assign または
  `.fill` 済みで、hole を read する経路なし。multi-arg `new Array(a, b)`
  （array literal の意味論）は 0 件。
- **`Math.max(...xs)` 系（25 site）**: 全 site の被 spread 配列は segment
  group・node 座標・level key 等の入力有界 collection で、spread-arg
  限界（~65k）より桁違いに小さい。ただし 25 site への per-site 有界性
  prose は confirmed-clean class に full family 相当の投資を強いる
  （steering の忌避する形状）— **無限界入力 site が出現した時点で再計測**
  を guard header に明記して棚上げ。

**REQ-412-005 との対比**: 棄却理由型の 3 例目 — 「tsc 重複型」
（REQ-411-003）・「挙動等価型」（REQ-412-005）に続き「**検出不可能型**」
（消費側判定）と「**投資不釣合型**」（clean class に full-family prose）。

**信頼性への影響**: REQ-413-003 を追加（🔵・全 site read 根拠付き）。

## 分析結果サマリー（REQ-413 分の追計）

### 確認できた事項

- 10 candidate class の実測（src + core-four・331 file）
- var 2 site が `declare global`（:449）内の型のみ ambient 宣言であること
- `.map(async` 2 site が両方 await される正規形であること
- `Math.max(...xs)` 25 site の被 spread 配列がすべて入力有界であること

### 追加/変更要件

- REQ-413-001〜004（7 kind 追加・var ALLOWED 2 key・棄却 3 class 記録・MW-077）

### 残課題

- escaped-quote を含む完全 literal `new RegExp` は detector の死角
  （REQ-410-008 (g) に明記・現行 0 件）
- 跨ぎ行 idiom は引き続き AST pass が必要（sweep #1 からの持ち越し）

### 信頼性レベル分布（REQ-413 追計分）

**分析後**: 🔵 4（REQ-413-001〜004）/ 🟡 0

## A-414-1: 第五回 discovery sweep の候補選定と計測（2026-08-25）

**背景**: REQ-410〜413 で構文・API の legacy 領域を採掘済み。sweep #5 は
「比較演算の恒偽形・legacy spelling 系・実行環境破壊系・locale 決定論
系」を対象に候補を立て、前回同様 src 単独 grep と core-four grep の
両方で計測した（console-debug-log / tolocalestring-bare は core 側のみ
に site があった — 両方計測の価値の再実証）。

**計測結果（17 candidate）**:

| candidate | src | core | 備考 |
|-----------|-----|------|------|
| `x === NaN` 双方向 | 0 | 0 | 恒偽比較（Object.is が NaN-safe 形） |
| `~xs.indexOf(y)` 系 | 0 | 0 | bitwise-trick membership |
| `throw '…'` / `` throw `…` `` | 0（prod）| 0 | test fixture 4 件は off-walk |
| `.lastIndexOf(x) === s.length - 1` | 0 | 0 | pre-endsWith |
| `new Date().getTime()/.valueOf()` | 0 | 0 | pre-Date.now（getHours は正規 API で class 外） |
| `+new Date`（unary） | 0 | 0 | binary 連結 `'…' + new Date()` は lookbehind で除外 |
| `x + ''` | 0 | 0 | legacy string coercion |
| `.keyCode` / `.which` | 0 | 0 | deprecated event member |
| `.caller` / `.callee` | 0 | 0 | strict-mode 禁止 member |
| `document.all` | 0 | 0 | IE 検出 idiom |
| `Array.prototype.X.call(`（slice 以外） | 0 | 0 | arraylike-slice-call の一般形 |
| `console.log/debug(` | 0 | 1 | core logger 自身 |
| `process.exit(` | 1 | 0 | api/index gracefulShutdown |
| `.toLocaleString()`（引数なし） | 0 | 1 | core safeToLocaleString 内 |
| `.charCodeAt(` | 15 | 0 | 棄却 (a) |
| `if (x = y)` 系 | 15 | — | 棄却 (b) |
| `.charAt(` | 0（prod）| 0 | 棄却 (c) |

**判断**: 11 class を exact-0 kind 化、3 class を各 1 site の ALLOWED
roster 化。ALLOWED 3 site の文脈はすべて実コード読みで確認
（logger :20 の level gate は隣接行・api/index :64 は全 service 停止 log
の後の epilogue・guards :114 は typeof+Number.isFinite gate 内）。

**信頼性への影響**: REQ-414-001/002 を追加（🔵）。

## A-414-2: pin 前棄却 3 class の根拠（REQ-414-003）

- **`.charCodeAt(`（15 src site・core 0）**: 計測全 site が code-unit-domain
  正利用 — language-detector の kana range 判定は BMP（:73/:103/:120）・
  security-admin の constant-time compare は code unit を要求（:61）・
  layout-rng の hash は code unit 加算（:21）・apng-encoder /
  export-verifier / intelligent-cache の chunk-type・header・RLE marker
  byte は ASCII/255 域（:60-63/:274/:189-191）・multi-format-exporter の
  octal/hex escape は Latin-1/BMP（:790/:844/:719）。
  codePointAt との差は astral plane でのみ出るため、現状 site に fix は
  ゼロ。15 row の per-site prose は full family 相当の投資（Math.max
  前例）— **astral-plane text math site 出現時点で再計測**を guard header
  に明記して棚上げ。
- **`if (x = y)` 系（15 hit）**: 計測 hit 全てが condition paren 内の
  arrow（`.some(kp => …)` 等・diagram-detector :384 等）か正典
  `while ((match = RE.exec(text)) !== null)` loop（scene-segmenter :385
  等）。行 regex は arrow-fat `=>` と assignment `=` を paren depth なし
  には区別できず、区別なし pin は全 arrow 内部表現を誤検出する純 noise。
  REQ-413 `.map(async)` と同じ「消費側/構文脈で可否が決まる」検出不可能型。
- **`.charAt()`（production 0 site）**: bracket access と挙動等価
  （in-range は同一値・out-of-range は '' vs undefined の falsy 差のみ）。
  実測 0 件かつ incident shape なし — Math.pow と同じ挙動等価型。
  style 嗜好の ratchet は guard の「load-bearing, not style」契約を希釈
  するため採らない。

**REQ-413-003 との対比**: 棄却理由型の再利用 — 「投資不釣合型」
（charCodeAt・Math.max と同型）・「検出不可能型」（arrow/構文脈・
`.map(async)` と同型）・「挙動等価型」（charAt・Math.pow と同型）。
3 理由型すべてに 2 例目が揃い、sweep #6 以降の棄却判断はこの分類に
帰着可能になった。

**信頼性への影響**: REQ-414-003 を追加（🔵・全 site read 根拠付き）。

## 分析結果サマリー（REQ-414 分の追計）

### 確認できた事項

- 17 candidate class の実測（src + core-four・331 file）
- console-debug-log / tolocalestring-bare が core 側のみの site であること
  （両側計測の必要性を再実証）
- ALLOWED 3 site の文脈（level gate 隣接・shutdown log → exit 順序・
  finite branch 共存）が実コード読みで確認できたこと
- charCodeAt 15 site 全てが code-unit-domain 正利用であること

### 追加/変更要件

- REQ-414-001〜004（14 kind 追加・3 site ALLOWED・棄却 3 class 記録・MW-078）

### 残課題

- 跨ぎ行 idiom は引き続き AST pass が必要（sweep #1 からの持ち越し）
- unary-plus-date は `=`/`(`/`return` 直後形のみ（`y || +new Date` は
  死角 — REQ-410-008 (h) に明記・現行 0 件）

### 信頼性レベル分布（REQ-414 追計分）

**分析後**: 🔵 4（REQ-414-001〜004）/ 🟡 0

## A-415-1: 第六回 discovery sweep の候補選定と計測（2026-08-25）

**背景**: REQ-410〜414 で legacy 構文・比較恒偽形・API 系を採掘済み。
sweep #6 は「browser/Node 移植性・CJS/ESM 綴り・非同期 dialog・
locale・legacy HTML API」面を対象に候補を立て、detector 最終形 regex
を確定してから src + core-four 両方で再計測した（detector 改善の
たびに再計測 — minified-boolean-literal は前置演算子文脈 class +
行頭形に改善、blocking-dialog は `window.` 修飾形式を取り込み、
useragent-sniffing は `userAgentData` 除外 lookahead を追加）。

**計測結果（23 candidate）**:

| candidate | src | core | 備考 |
|-----------|-----|------|------|
| `.trimLeft/Right(` | 0 | 0 | trimStart/End が正規形 |
| `RegExp.$1` 系 static | 0 | 0 | legacy match capture |
| `throw {` | 0 | 0 | throw は Error 系のみ |
| `throw null` | 0 | 0 | 同上 |
| `javascript:` URL | 0 | 0 | test は off-walk |
| `alert/confirm/prompt(` | 1 | 0 | ALLOWED（confirm gate） |
| `XMLHttpRequest` | 0 | 0 | fetch 世代 |
| `= !0` / `!1` minified 真偽 | 0 | 0 | tsc が生成しない綴り |
| `require(` | 0 | 0 | ESM 統一 |
| `module.exports` / `exports.x=` | 0 | 0 | 同上 |
| `__dirname` / `__filename` | 0 | 0 | 同上 |
| `global.` | 5 | 0 | **unify**（globalThis.gc） |
| `document.cookie` | 0 | 0 | storage helper 経由 |
| `navigator.userAgent` 参照 | 3 | 0 | ALLOWED（report-only ×3） |
| `.localeCompare(x)`（引数 1 つ） | 0 | 0 | locale は明示指定 |
| `new Intl.X()`（引数なし） | 0 | 0 | 同上 |
| `.innerHTML =` | 0 | 0 | React は setInnerHTML helper / dangerouslySetInnerHTML |
| `window.event` | 0 | 0 | DOM 2 世代以降不存在 |
| `.returnValue =`（event） | 0 | 0 | preventDefault 世代 |
| `.anchor()/.bold()` 等 HTML 生成 | 0 | 0 | string HTML method |
| `__defineGetter__` 系 | 0 | 0 | defineProperty 世代 |
| `.toLocaleUpperCase()`（引数なし） | 0 | 0 | locale 明示指定 |
| `.substring(` | 23 | — | 棄却（投資不釣合型 3 例目） |

**判断**: 19 class を exact-0 kind 化、`global.` 5 site を
`globalThis.gc` へ unify（batch 形式初の VIOLATION cluster 同梱 —
REQ-412 parseint-no-radix と同型）、2 class 計 4 site を ALLOWED
roster 化。ALLOWED 4 site の文脈はすべて実コード読みで確認
（GuardMetricsDashboard :90 は reset 前の confirm gate・
production-error-handler :271/:461 は telemetry 文脈 object への
field 代入・browser-transcriber :257 は browser 名 diagnostics で
能力判定は直前の feature detection）。

**信頼性への影響**: REQ-415-001/002 を追加（🔵）。

## A-415-2: `global.gc` 5 site unify の等価性根拠（REQ-415-002）

**計測**: `(?<![.\w$])global\s*\.` の 5 site / 6 出現は全て gc 呼び出し
— performance-dashboard :419-420（`if (global.gc)` + `global.gc()`）・
main-pipeline :1428-1429（`typeof global !== 'undefined' && global.gc`
guard + `global.gc()`）・enhanced-error-recovery :284
（`if (global.gc) global.gc();`）。

**等価性**: Node では `global === globalThis`（同一 object・
`--expose-gc` の gc は globalThis 直下に露出）、browser/ESM bundle では
`global` は未定義（bundlers の shim 有無は構成依存）で `globalThis` のみ
ES2020 標準。よって (a) Node 実行下は完全同一挙動、(b) browser では
`global.gc` の unguarded 評価は ReferenceError（潜在 crash）だが
`globalThis.gc` は feature-miss の falsy、(c) main-pipeline の
`typeof global !== 'undefined'` guard は `global` 綴りが原因の
workaround で `globalThis` では不要。semantic 等価の綴り統一として
3 file を同一 shape に整え、anchor + count pin（3 file 合計 6 出現）で
部分 revert を検出（MW-079 (b) で 3 面 RED を実測）。

**信頼性への影響**: REQ-415-002 を追加（🔵・仕様ベース等価性 +
unify 後 walk 再計測 exact-0）。

## A-415-3: pin 前棄却 legacy-substring の根拠（REQ-415-003）

- **`.substring(`（23 src site）**: class 本義の incident shape は
  `substring(indexA, indexB)` の**引数 swap**（legacy 仕様: indexA >
  indexB で引数を交換する — slice と異なる non-monotonic 挙動）。
  計測全 23 site は (i) `substring(0, N)` 形の 0-start 切り詰め
  （truncate 系 — swap 不可能）か (ii) `Math.min/Math.max` 正規化
  済み span（swap が発生しない引数順に明示的に並べた形）。到達可能
  な bug 形が存在せず、fix ゼロの 23 row per-site prose は
  charCodeAt・Math.max(...xs) と同型の投資不釣合 — **swap 可能形
  出現時点で再計測**を guard header に明記して棚上げ（投資不釣合型
  3 例目）。

**信頼性への影響**: REQ-415-003 を追加（🔵・全 23 site 分類根拠付き）。

## 分析結果サマリー（REQ-415 分の追計）

### 確認できた事項

- 23 candidate class の実測（src + core-four・331 file・detector 最終形
  regex で再計測）
- `global.gc` 5 site / 3 file が batch 形式初の VIOLATION cluster で
  あったこと（portability 面で unify 価値あり）
- ALLOWED 4 site の文脈（confirm gate・UA report-only ×3）が実コード
  読みで確認できたこと
- legacy-substring 23 site 全てが swap 不可能形であること

### 追加/変更要件

- REQ-415-001〜004（22 kind 追加・5 site unify・4 site ALLOWED・棄却
  1 class 記録・MW-079）

### 残課題

- 跨ぎ行 idiom は引き続き AST pass が必要（sweep #1 からの持ち越し）
- minified-boolean-literal の行頭形は template literal 内 `!0` を
  拾う可能性（現行 0 件 — 文字列内 hit 時に detector 精密化）

### 信頼性レベル分布（REQ-415 追計分）

**分析後**: 🔵 4（REQ-415-001〜004）/ 🟡 0

## A-416-1: 第七回 sweep の候補選定と計測（2026-08-26）

- **候補生成**: 従来どおり MDN legacy/deprecated 面と JSDoc/ESLint
  (`no-async-promise-executor`・`no-delete-var` 等) の rule 群から
  10 candidate を抽出。registry 71 kind との重複は full registry 読み
  で除外済み（getYear・keyCode・document.write 系は REQ-415 で取得
  済み）。atob/btoa は REQ-415 の escape/unescape と同系列の codec 面。
- **計測面の自己修正**: 初回計測が 278 file で過去 sweep の 331 file
  と不一致。原因は走査 script の repo src filter が `/\.ts$/` で
  `.tsx` 53 file を落としていたこと。canonical `walkProductionFiles`
  の `/\.(ts|tsx)$/` に照合して再計測（detector の見落としは exact-0
  false-pin に直結するため、走査面の一致を sweep の前提条件とした）。
- **計測結果**: 7 class exact-0（async-promise-executor /
  array-delete-hole / instanceof-primitive-wrapper / atob-btoa /
  inner-html-op-assign / insert-adjacent-html /
  sparse-array-ctor-literal）。`.length = 0` 10 site・`.splice(…)`
  27 site・finally 内 return 0（finally block 13）は評決棄却へ。

**信頼性への影響**: REQ-416-001 を追加（🔵・331 file 実測 + 走査面
canonical 一致の明示）。

## A-416-2: inner-html-op-assign を既存 kind の拡張ではなく新 entry にした理由（REQ-416-001）

`inner-html-assignment`（REQ-415・`\.innerHTML\s*=`）は compound
代入 `+=` を検出しない。`.innerHTML +=` は（XSS 面で）`=` 再代入より
危険な accumulated-injection 形だが、既存 kind の detect regex を
`=`→`=`? に緩めると検出域が広がり、REQ-415 時点の ALLOWED 判断
（`innerHTML =` site の文脈根拠）を暗黙に再評判したのと同じ意味論に
なる。よって (a) 既存 kind は不変、(b) compound 形は別 kind として
登録（class 追加 = 1 entry の契約どおり）、(c) fixture (aa5) で
`=` 形が inner-html-assignment に帰着することを負例で分離固定。
実測は両 kind とも 0 site。

**信頼性への影響**: REQ-416-001 に kind 分離根拠を追記（🔵・
registry 変更の意味論保存を契約で強制）。

## A-416-3: pin 前棄却 3 class の根拠（REQ-416-003）

- **`.length = 0`（10 site）**: 全 site が CappedArray 系の意図的
  drain（clear() 実装を含む）。正しい clear 慣用そのもので incident
  なし — 10 row の per-site prose は投資不釣合（4 例目）。
- **`.splice(…)`（27 site）**: 全 site が queue primitive（優先度
  挿入・dequeue・DLQ purge）として正当。receiver-mutation 概念は
  family 16（REQ-407）で正典化済みで重複（5 例目）。
- **`return` in `finally`（finally 13 site・return 0）**: 行 detector
  では block-scope が不可視（naive regex は finally block 終了後の
  return まで偽陽性 — audio-preprocessor.ts で実測）。brace-depth
  scan まで書くと「AST が要る」判定と同コスト。加えて **site 母集団
  ≠ incident 母集団**: finally 行 detector の site 母集団は「全
  finally block」（13 site すべて cleanup-only の正当形）で、incident
  （finally 内 return）は 0 — pin は今後の正当な try/finally 追加の
  たびに roster 行を課す逆薬剤になる。検出不可能型 2 例目 + 母集団
  不一致の初例として成文化。

**信頼性への影響**: REQ-416-003 を追加（🔵・全 site 読み + 母集団
不一致軸の追加）。

## 分析結果サマリー（REQ-416 分の追計）

### 確認できた事項

- 10 candidate class の実測（331 file・走査面を canonical
  `walkProductionFiles` と一致させてから評決）
- 7 class exact-0 pin と ALLOWED 18 / ERADICATED 12 不変の確認
- 棄却 3 class の全 site（10 + 27 + 13）実コード読み
- MW-080 で 4 kind の独立 RED（kind 帰着を offender list で確認）

### 追加/変更要件

- REQ-416-001〜004（7 kind 追加・3 class 棄却記録・MW-080・
  src 変更ゼロ）

### 残課題

- 変数長 `new Array(n)` は sparse 保証がないため literal 形のみ pin
  （変数形出現時に再計測）
- finally 内 return・`.splice` aliasing の incident 実出現時に
  AST pass の投資判断を重新評価

### 信頼性レベル分布（REQ-416 追計分）

**分析後**: 🔵 4（REQ-416-001〜004）/ 🟡 0

## A-417-1: 第八回 sweep の候補選定と計測（2026-08-26）

- **候補生成**: MDN legacy/deprecated 面・ESLint rule 群
  (`no-eq-null` 系 promise swallow・React 18 removal list)・React 18
  StrictMode 削除 API から 16 candidate を抽出。registry 78 kind との
  重複は full registry 読みで除外済み。テーマ別の内訳: JS 標準の死んだ
  API 面 4（Date.parse / decodeURI / dead UA field / instanceof Object）・
  React 18 削除面 3（legacy root trio / unsafe lifecycle /
  dangerouslySetInnerHTML）・sink/injection 面 3（postMessage '*' /
  createElement('script') / →innerHTML 系は既存 kind）・sibling 形 2
  （bare `Array(n)` は sparse-array-ctor の call 形・console
  info/warn/error は console-debug-log の非 debug 形）・swallow 面 1
  （`.catch(() => {})` は empty-catch の promise 形）。
- **計測面の自己修正（A-416-1 と同一手順）**: 初回 probe script が
  330 file で canonical `walkProductionSurface` の 331 file と不一致
  （`.d.ts` 3 file の扱い違い）。probe を書き直して canonical walker
  を直接 import し 331 file で再計測してから評決。
- **計測結果**: 10 class exact-0・swallowed-rejection 1 site
  （whisper-transcriber:121 — 下記 A-417-2）・console-nondebug-sink
  3 site（logger.ts:25/30/35 — core 所有の logger transport）。
  棄却へ回した 4 class は REQ-417-003 参照。

**信頼性への影響**: REQ-417-001 を追加（🔵・331 file 実測 + 走査面
canonical 一致の再適用）。

## A-417-2: 実測 site 2 class の ALLOWED 判断根拠（REQ-417-001）

- **swallowed-rejection 1 site（whisper-transcriber:121）**:
  `await import('whisper-node').catch(() => null)` は README が
  「whisper-node の読み込み可否を確認するだけで Whisper 推論を
  実行しない」と文書化した dynamic-import 可否 probe。null は捨てる
  ために生成されており（外側 try/catch + logger.warn は別経路の
  error 用）、rejection を握り潰す incident shape と同一の綴りだが
  意図が逆。ALLOWED 1 key（PROBE-DELIBERATE）で文脈を固定し、
  他の `.catch`-to-void は即 RED。
- **console-nondebug-sink 3 site（logger.ts:25/30/35）**: 既存
  ALLOWED の console.debug LOGGER-IMPL row（:20・同一 file）と同型 —
  info/warn/error が logger の level-gated transport そのもの。
  file は @stv/core 所有（rel `src/utils/logger.ts` は package へ
  解決される歴史パス）で in-tree 修正不可。ALLOWED 3 key
  （LOGGER-IMPL）で固定。

**信頼性への影響**: REQ-417-001 に ALLOWED 4 key の文脈根拠を追記
（🔵・実コード読み + README/既存 row との同型性）。

## A-417-3: pin 前棄却 4 class の根拠（REQ-417-003）

- **dom0-handler-assign（6 site）**: 全 site が SpeechRecognition /
  Audio（HTMLMediaElement）の型付き onXxx handler property で
  lib.dom 現行仕様の正形。死んだ慣用ではなく母集団不一致
  （REQ-416 finally 型の 2 例目）。
- **throw-bare-error**: Error() は関数呼び出しでも自動 construct
  （仕様）→ 挙動完全一致・incident なし（`a ** b` 型 2 例目）。
- **void-zero-undefined**: `void 0` は undefined 読みの正統綴り。
  死んだ慣用ではないため対象外。
- **bare postMessage（5 worker site）**: worker postMessage に
  targetOrigin 引数は無く、incident は wildcard 形のみ
  （postmessage-wildcard として pin 済み・重複）。

**信頼性への影響**: REQ-417-003 を追加（🔵・全 site 読み）。

## 分析結果サマリー（REQ-417 分の追計）

### 確認できた事項

- 16 candidate class の実測（331 file・canonical walker 直接使用）
- 12 kind pin（10 exact-0 + ALLOWED 4 site 同梱）と
  ALLOWED 22 / ERADICATED 12 の確認
- 棄却 4 class の全 site 実コード読み
- 既存 fixture 2 件の負例差し替え（y12/z14 — 既存 kind の detect は
  1 行も不変）

### 追加/変更要件

- REQ-417-001〜004（12 kind 追加・4 class 棄却記録・MW-081・
  src 変更ゼロ）

### 残課題

- `postMessage(…, '*')` の行跨ぎ引数（origin が次行）は行 detector
  不可視 — 実出現時に grep -A1 再計測
- `.catch` の複数行/コメント付き noop body は行 detector 不可視
  （empty-catch と同じ制約 — grep -A1 pass で現在 0 確認）

### 信頼性レベル分布（REQ-417 追計分）

**分析後**: 🔵 4（REQ-417-001〜004）/ 🟡 0

## A-418-1: 第九回 sweep の候補選定と計測（2026-08-26）

**分析日時**: 2026-08-26
**カテゴリ**: 技術選定（dead-idiom class の母集団計測）
**背景**: REQ-410 steering batch 契約の 9 回目。未計測の dead-idiom class
群（IE/dead-DOM member・React legacy API・markup sink sibling・言語 dead
慣用・surrogate 分離系）を同一 walk で評決する必要があった。

**判断**: 29 candidate を canonical `walkProductionSurface`（331 file）
直接使用で計測し、26 class を exact-0 pin・1 class（dead-ua-platform）を
ALLOWED 1 site 同梱・1 class（string-char-split）を unify 同梱・1 class
（react-default-props）を pin 前棄却とした。

**根拠**: 計測 log（candidate 29 件の実測 site 数・hit 行 text 付き）。
walk は guard と同一 walker import なので評決母集団と guard 母集団が一致
（A-416-1 手順の維持）。

**信頼性への影響**: REQ-418-001 を追加（🔵・全候補実測）。

## A-418-2: string-char-split unify の等価性根拠（REQ-418-001）

**分析日時**: 2026-08-26
**カテゴリ**: データモデル（分類器の文字反復レベル）
**背景**: `text.split('')` は astral code point（CJK ext-B 漢字・絵文字）
を lone surrogate 半片に分割する。日本語 text pipeline では実害になり得る
lazy hazard として unify を検討した。

**判断**: ratio 計算は全入力で完全等価。classifyChar の range table
（@stv/core unicode-script-ranges: KANA 0x3040-0x31FF・CJK 0x3400-0xFAFF・
English A-Z）は surrogate block 0xD800-0xDFFF と交差しないため、astral
文字は旧綴り（2 半片・両方 Other）も新綴り（1 code point・Other）も
いかなる ratio にも寄与しない。要素数 = code point 数となり、同一 file の
hasKana/scoreLatinLanguage が使う `for (const char of text)` 綴りと整合
（将来 astral CJK-ext range 追加時に loop 再変更が不要）。

**根拠**: src/analysis/language-detector.ts:73-94（classifyChar 実装）・
node_modules/@stv/core/src/lib/unicode-script-ranges.ts（range 値）・
language-detector test 68/68 GREEN（挙動同一の実測）。

**信頼性への影響**: ERADICATED 1 key 追加（🔵・range 交差の実値確認）。

## A-418-3: pin 前棄却 1 class の根拠（REQ-418-003）

- **react-default-props（1 site）**: `src/remotion/Root.tsx:42` の
  `<Composition defaultProps={defaultVideoProps}>` は Remotion Framework
  自身の prop（calculateMetadata への入力 API）。React 18.3 が function
  component で warn する `Component.defaultProps` とは無関係の同名衝突
  で、site 母集団 ≠ incident 母集団（REQ-417 dom0-handler-assign 型の
  3 例目）。

**信頼性への影響**: REQ-418-003 を追加（🔵・site 実コード読み）。

## 分析結果サマリー（REQ-418 分の追計）

### 確認できた事項

- 29 candidate class の実測（331 file・canonical walker 直接使用）
- 28 kind pin（26 exact-0 + ALLOWED 1 site 同梱 + unify 1 site 同梱）
  と ALLOWED 23 / ERADICATED 13 の確認
- 棄却 1 class の site 実コード読み（Remotion Composition prop の
  同名衝突）
- 既存 fixture 1 件の負例差し替え（(ab3) platform → language —
  既存 kind の detect は 1 行も不変）

### 追加/変更要件

- REQ-418-001〜004（28 kind 追加・1 class 棄却記録・MW-082・
  src 変更は unify 1 site のみ）

### 残課題

- `document.createEvent` 以外の optional-chain 抜け（`window?.execScript`
  等は lookbehind 設計で既に捕捉可・(ac6)/(ac21) で member 形を検証済み）
  の実出現時に grep -A1 再計測

### 信頼性レベル分布（REQ-418 追計分）

**分析後**: 🔵 4（REQ-418-001〜004）/ 🟡 0

## A-419-1: 第十回 sweep の候補選定と計測（2026-08-26）

**分析日時**: 2026-08-26
**カテゴリ**: 技術選定（dead-idiom class の母集団計測）
**背景**: REQ-410 steering batch 契約の 10 回目。未計測の dead-idiom class
群（deprecated/removed Web API・Node legacy 綴り・React legacy API・
非標準 engine 拡張・言語 dead 慣用）を同一 walk で評決する必要があった。

**判断**: 36 candidate を canonical `walkProductionSurface`（331 file）
直接使用で計測し、33 class を exact-0 pin・1 class（localedatestring-bare）
を ALLOWED 4 site 同梱・2 class（inner-text-assign・array-literal-concat）
を pin 前棄却とした。

**根拠**: 計測 log（candidate 36 件の実測 site 数・hit 行 text 付き）。
walk は guard と同一 walker import なので評決母集団と guard 母集団が一致
（A-416-1 手順の維持）。

**信頼性への影響**: REQ-419-001 を追加（🔵・全候補実測）。

## A-419-2: 計測・fixture 工程による detector 初稿 bug の発見（REQ-419-002）

**分析日時**: 2026-08-26
**カテゴリ**: 技術選定（detector の検出域境界）
**背景**: MW-082 は mutation 検証が detector の optional-chain 抜けを発見
した初例だった。本 sweep の計測・fixture 工程も同じ性質の gap を拾うかが
問われた。

**判断**: 計測が偽陽性 2 件（self-ternary-default の keyword consequent
`null ? null :`・event-path-access の識別子末尾 `e`）を、liveness fixture
が検出漏れ 1 件（node-createcipher 初稿 `create(?:De)?Cipher\(` は
`createDecipher` = create + De + 小文字 cipher を拾えない）を発見。
いずれも修正し境界を fixture 両側で固定。

**根拠**: 偽陽性は clean surface（memory-backend.ts:94・
code-size-audit.ts:95）での実 hit として再現・検出漏れは fixture 正例
（createDecipher 行 2 hit 期待 → 1 hit の RED）として再現。偽陽性の
発見経路は計測のみ・検出漏れの発見経路は fixture 正例のみ（clean
surface に陽性がないため計測では原理的に不発）。

**信頼性への影響**: REQ-419-002 を追加（🔵・両方向の再現確認）。

## A-419-3: pin 前棄却 2 class の根拠（REQ-419-003）

- **inner-text-assign（0 src site）**: 書き込み経路の `.innerText =` は
  `.textContent =` と挙動ほぼ一致（innerHTML と違い HTML 解析なし・
  reflow・hidden 要素差は読み取り側の性質で書き込み単独では incident 形を
  持たない）。`a ** b`↔Math.pow・`.charAt()` に続く挙動一致型棄却の
  3 例目。
- **array-literal-concat（0 src site）**: `[].concat(x)` の「x が array
  なら spread される」挙動は ensure-array idiom の本質機能そのもので
  死んだ綴りではない（spread による代替は可読性の好み）。site 母集団 ≠
  incident 母集団の機能本質型初例。

**信頼性への影響**: REQ-419-003 を追加（🔵・綴り域全体の挙動読み）。

## 分析結果サマリー（REQ-419 分の追計）

### 確認できた事項

- 36 candidate class の実測（331 file・canonical walker 直接使用）
- 34 kind pin（33 exact-0 + ALLOWED 4 site 同梱）と ALLOWED 27 /
  ERADICATED 13 の確認
- 棄却 2 class の綴り域全体の挙動読み（挙動一致型 3 例目・
  機能本質型初例）
- detector 初稿 bug 3 件の計測・fixture での再現と修正
  （REQ-419-002 — 偽陽性は計測が・検出漏れは fixture が発見）

### 追加/変更要件

- REQ-419-001〜004（34 kind 追加・2 class 棄却記録・MW-083・src 変更ゼロ）

### 残課題

- innerText 読み取り経路（layout 依存の読み side incident）の実装追加時
  に再分類（書き込み専用 pin の前提が崩れるため）
- `[].concat` 以外の暗黙 spread 系（`Array.prototype.concat.call`）の
  実出現時に grep 再計測

### 信頼性レベル分布（REQ-419 追計分）

**分析後**: 🔵 4（REQ-419-001〜004）/ 🟡 0
