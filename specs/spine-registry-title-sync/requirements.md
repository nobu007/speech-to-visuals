# spine registry title-sync census（親 index 表題 ↔ 対象 doc H1 一致）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**要件ID**: REQ-406（Phase 209 / TASK-0293・0294・REQ-402 spine edge census の表題面拡張）

## 概要

REQ-402（spine edge 双方向 census）は anchor parent 宣言と parent 側
`spine:children` / `spine:references` 登録の **edge 両端の存在** を強制したが、
登録 **行の表題 text** は検証しなかった。その隙間を実証したのが 90c924db →
47d71cd5 の事故である:

- 90c924db（REQ-404 rounding-mode census の本体 commit）は boundary /
  rounding / spine-edge の各子 spec の H1 を改題して land したが、親
  `speech-to-visuals/architecture.md` children index の表題は**旧表記のまま**
  残した（実測: index `boundary strictness（混在演算子）census …` vs 子 H1
  `boundary strictness census（同一 metric×threshold の strict/inclusive
  演算子混在）…` の drift 2 件・rounding 側も同様）。
- 正規化（表題の同期 + REQ 順への並べ替え）は `chore(make-run): commit 2
  remaining change(s)`（47d71cd5）という**後付け sweep commit** に分離して
  land した — make-run steering が 2 回繰り返し指摘した「子仕様を新規作成・
  改題する commit と同じトランザクションで spine:children index 再生成・
  commit まで完了させる」要求の実体。

make-run のコミット分割単位自体は hub 側 harness の実装であり本 repo の
編集対象外である。本要件は**本 repo で取り得る構造的答案**を提供する:
registry entry の表題が対象 doc の最初の H1 と一致することを exact sweep で
強制する。これにより「子の改題」と「親 index の表題同期」が**同一 tree に
揃わない限り guard は GREEN にならない** = 当該 class の取り残し変更が
sweep commit に漏れ出る経路を、本体 commit の landing 時点で遮断する
（90c924db の tree state は本 guard で RED になったはず — 反実仮想を実測
diff で確認済み）。

実測（Phase 209 discovery・landing 前の現 tree）: registry entry 112 件の
うち表題 drift **0 件**・H1 欠落 **0 件**（confirmed-zero pin）。REQ-406 は
撲滅課題ではなく**既に正規化済みの状態を機械的に固定**し、未来の改題を
同一 commit 同期へ強制する歯を生やす要件である。

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **拡張対象正典**: REQ-402 spine edge 双方向 census（`tests/guards/spine-edge-contract.ts` / `spine-edge-census.test.ts` に本要件の 2 violation kind を追加）
- **先行 guard**: REQ-388 spine anchor role census（anchor block 単体の管轄）・REQ-395 three-way（census family の roster 申告規約 — 本要件は roster 型 census ではないため対象外）
- **事故の一次資料**: 90c924db（drift を抱えた本体 commit）・47d71cd5（sweep 修復 commit）

## 主要機能要件

### 必須機能（Must Have）

- REQ-406-001: システムは `tests/guards/spine-edge-contract.ts` に
  violation kind を 2 件追加すること: (a) `REGISTRY_TITLE_DRIFT` —
  children/references entry の `- [title](link)` 表題が対象 doc の**最初の
  H1 見出し**（`firstHeading`: 行頭 strict な `^#\s+`・前後空白除去・空 H1
  は無しとみなす）と不一致、(b) `REGISTRY_TARGET_H1_MISSING` — 対象 doc が
  H1 を持たず表題 sync が検証不能。対象が存在する entry は全て（children・
  references 両方・TASK file を含む）この検証を受け、検証実施数を report の
  `titleChecked` として計上すること 🔵 *47d71cd5 diff が drift の実形を与え・firstHeading の境界は合成 fixture で検証*
- REQ-406-002: システムは実 specs tree を **表題違反 exact-0** で検証する
  こと（landing 前実測: 112 entry 中 drift 0 / H1 欠落 0 = confirmed-zero
  pin）。併せて `titleChecked` の floor pin（`>= 112`）を設け、検証の
  silent skip（対象読み rot・比較除外の拡大）を計数の落下として検出できる
  こと 🔵 *実測 baseline 112（Phase 209 discovery・本 spec landing で +4）*
- REQ-406-003: システムは合成 fixture で新種の検出 liveness を検証すること:
  (a) 子 doc のみ改題して親 index 表題が旧まま（= 90c924db→47d71cd5 の事故
  shape・修復で GREEN 復帰）、(b) 親 index 側の表題 typo（対象は不変）も
  同一違反、(c) H1 を持たない対象、(d) `firstHeading` の境界 6 例
  （前言後出し・行頭 strict・h2 のみ・空 H1・見出し無し）🔵 *c818286f 系の合成 fixture 手法の踏襲*
- REQ-406-004: 正規形 fixture（`canonicalTree`）の children/references 表題
  を対象 H1 と一致する形に更新し、正規形が表題 sync も含むことを固定する
  こと（`titleChecked` = 2 の assert 同梱）🔵 *既存 6 fixture test が新契約の下でも単一違反kind を保つよう呼び出し側を更新*
- REQ-406-005: 本 spec 一式（requirements / note / interview-record /
  tasks/overview / TASK-0293・0294）の landing は REQ-402
  SPEC_LANDING_ATOMICITY を dogfood すること: 各 file の anchor block と
  parent 側登録（architecture.md children 2 件・design-interview.md
  children 1 件・speech-to-visuals/note.md references 1 件）を guard・MW・
  ledger と**同一 commit** に同梱し（make-run steering の 2 回繰り返しの
  commit-splitting 指摘への直接回答）、登録前に spine-edge census が
  `PARENT_UNREGISTERED` で RED になることを実測してから登録して GREEN に
  すること（sweep commit 残さず）🔵 *REQ-402-006 / REQ-403〜405-007 の踏襲・本要件は表題面でも同一 commit 同期を強制*
- REQ-406-006: mutation 検証（MW-070）は実 specs tree への 3 独立 mutation —
  (a) 子 doc H1 の改題のみ（事故の再現・`REGISTRY_TITLE_DRIFT`）、(b) 親
  index 側の表題 typo（同種・holder 側編集）、(c) 対象 doc の H1除去
  （`REGISTRY_TARGET_H1_MISSING`）— で RED を実測し、mutation-witness
  ledger に section + appendix 行を記載して PINNED_MIN_ENTRIES を 65→66 に
  上げること 🔵 *Phase 197 で確立した実装+MW+receipt 単一 commit 同梱規約*

### 基本的な制約

- REQ-406-007: 本契約の管轄外を明示すること — (a) `spine:anchor` block 内の
  link 表題（`> **Spine anchor**: [title](link)`）は REQ-388 の管轄（本契約は
  registry block の entry のみ）、(b) children block 内の**並び順**（REQ 順
  等）は人間の規約であり機械契約外、(c) `specs/_doc_spine.yml` manifest から
  の再生成を行う hub 側 doc-spine engine との整合は make-run 側の責務
  （本 guard は再生成結果が H1 から乖離した場合に RED で差し戻す）、
  (d) 表題は H1 **全文一致**（接頭辞省略・要約の省略記法は不可）。
  これらを guard header doc comment に宣言すること 🟡 *契約範囲の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: 改題の取り残し sweep commit の根絶

**私は** spec 閲覧者 **として**
**子 spec が改題されたときに**
**親 index の表題が同一 commit で同期されることで**
**index の link text が常に実 doc の表題を指し、sweep commit が発生しない。

**関連要件**: REQ-406-001・REQ-406-002・REQ-406-005

### ストーリー2: 表題検証の silent skip 検出

**私は** 未来の実装者 **として**
**registry 検証を修正したときに**
**titleChecked 計数が検証対象を見逃していれば RED で差し戻されることで**
**表題 sync の網羅が口約束でなくなる。

**関連要件**: REQ-406-002

## 基本的な受け入れ基準

### REQ-406-001〜004: title-sync violation の検出と固定

**Given（前提条件）**: specs tree に 112+ の registry entry が存在する
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns spine-edge-census` を実行する
**Then（期待結果）**: 実 tree の表題違反 exact-0（drift 0 / H1 欠落 0・titleChecked >= 112）で GREEN・合成 fixture が事故 shape 双方向・H1 欠落・firstHeading 境界を検証する

**テストケース**:

- [x] **TC-406-01**: 実 tree 表題違反 exact-0 + titleChecked floor pin 🔵
- [x] **TC-406-02**: 事故 shape fixture — 子のみ改題 → `REGISTRY_TITLE_DRIFT`・
  親 index 同期で GREEN 復帰（90c924db→47d71cd5 の再現）🔵
- [x] **TC-406-03**: holder 側表題 typo / H1 欠落の各検出 + `firstHeading`
  境界 6 例 🔵
- [x] **TC-406-04**: 正規形 fixture の表題一致（`titleChecked` = 2）と既存
  6 violation kind test の単一kind 保持 🔵

### REQ-406-005: atomic landing の dogfood

**Given**: 本 spec 一式が parent 側登録なしの状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` ×4 で RED → parent 側 4 登録を同 commit で追加すると GREEN（表題は新 doc の H1 と一致 = 本要件自身の dogfood）

### REQ-406-006: MW-070 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（子 H1 改題 / 親 index 表題 typo / H1 除去）を適用する
**Then**: 各 mutation で census が RED（TITLE_DRIFT / TITLE_DRIFT / H1_MISSING）・revert で GREEN 復元

## 最小限の非機能要件

- **性能**: 追加検証は既存 sweep の map 参照 + 行 scan のみ（file 再読みなし）。
  guard suite の実行時間を増やさない
- **保守性**: `firstHeading` は純関数として export し合成 fixture で境界を
  検証。src/ 変更はゼロ（read-only census・spec と guard と ledger のみ）
