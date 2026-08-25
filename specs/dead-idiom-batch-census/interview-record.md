# dead-idiom batch census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `detailed`
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
