# spine edge 双方向 census（SPEC_LANDING_ATOMICITY 構造化）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**要件ID**: REQ-402（Phase 201 / TASK-0285・0286）

## 概要

656a0d58/bb844a0f が land した facet-5 spec 2 件（requirements.md / tasks/overview.md）は
anchor で `parent: speech-to-visuals/requirements.md` を宣言したが、宣言先の
requirements.md には `spine:children` block が存在しない **片方向 dangling anchor**
だった。既存 guard（REQ-388 `spine-anchor-contract.ts`）は anchor block 単体の
shape（parent 行・role 行）のみを検証するためこの状態を GREEN で通過させ、修復は
c818286f `chore(make-run): commit 5 remaining change(s)` という**後付け sweep commit**
に分離して land した。make-run steering（Phase 200 feedback・SPEC_LANDING_ATOMICITY）:
「spec 本文を land させる commit に anchor parent 宣言と parent 側 children 登録を
同梱させ、sweep commit を残さない運用に変えること」— これは
spine-anchor-contract.ts header が引用する「末端掃込みコミットでanchorスキーマ修正を
雑扱いしないこと」と同型の再発である。

本要件はこの事故 class を**運用ではなく構造で**封じる: anchor parent 宣言 ↔
parent 側 `spine:children` / `spine:references` 登録の**edge 両端**を census で
検証する guard を新設し、parent 側登録を同梱しない spec landing を即 RED にする。

| 検証方向 | violation kind | 実在観測（c818286f 修復後）|
|---------|---------------|--------------------------|
| forward（anchor → parent 側登録）| `PARENT_UNREGISTERED` / `PARENT_DOC_MISSING` | 0 件（feature-level 30 anchor = children 登録 26 + references 登録 2 + root exempt 2）|
| reverse（登録 → 対象の実在・back-anchor）| `REGISTRY_TARGET_MISSING` / `CHILD_BACK_ANCHOR_MISSING` / `REGISTRY_LINK_UNSUPPORTED` | 0 件（children 26 双方向・references 60 は one-way schema）|
| marker 構造 | `REGISTRY_BLOCK_UNCLOSED` | 0 件（7 registry block 全て begin/end 対）|

**信頼性レベル凡例**: 🔵 既存 guard・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行 guard**: REQ-388 spine anchor role census in [speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)
- **事故記録**: c818286f（sweep 修復 commit・本要件の直接動機）

## 主要機能要件

### 必須機能（Must Have）

- REQ-402-001: システムは `tests/guards/spine-edge-contract.ts`（純関数 module）と
  `tests/guards/spine-edge-census.test.ts`（real-tree exact sweep）を新設し、
  specs/** 全 .md の anchor parent 宣言と registry block を単一の census で
  検証すること。anchor block の解析は REQ-388 の `parseAnchorBlocks` に委譲し
  （anchor 解析の単一実装）、TASK file shape 判定 `isTaskFile` を REQ-388 側から
  export して再利用すること 🔵 *実 tree 観測（anchor 318 / registry entry 86）と REQ-388 構成の直接延長*
- REQ-402-002: システムは `/` を含む parent（specs 内 doc）を宣言した
  **TASK file 以外**の specs doc について、parent 側の `spine:children` または
  `spine:references` registry に当該 doc の登録が無い場合 `PARENT_UNREGISTERED`
  として違反判定すること。TASK file（`tasks/TASK-\d+.md`）は登録粒度が
  tasks/overview.md であるため exempt とし（実在 288 TASK anchor が全て個別登録なし
  = engine schema）、parent が `/` を含まない repo root 直下 doc
  （`SYSTEM_CONSTITUTION.md`）は top-level root として exempt すること。
  ただし bare parent の観測集合は `['SYSTEM_CONSTITUTION.md']` に exact pin し、
  新規 root doc が無宣言で増えないことを検証すること 🔵 *c818286f 事故の直接 class・exempt 規則は実在 tree の全数観測から確定*
- REQ-402-003: システムは registry 側（reverse 方向）として、(a) children /
  references entry の対象 doc が specs/ に存在しない場合 `REGISTRY_TARGET_MISSING`、
  (b) children entry の対象が holder を parent として anchor 宣言していない場合
  `CHILD_BACK_ANCHOR_MISSING`、(c) link が specs-relative path でない
  （http / 絶対 / `..` で specs 外）場合 `REGISTRY_LINK_UNSUPPORTED` を違反判定
  すること。references entry は engine schema 上 one-way であり対象側 anchor を
  要求しないこと（実在 60 entry 中 58 が TASK file への one-way reference）🔵 *実在 registry 7 block の全数観測から確定*
- REQ-402-004: システムは `spine:children` / `spine:references` の begin / end
  marker 件数が不一致の file を `REGISTRY_BLOCK_UNCLOSED` として違反判定すること
  （未閉鎖 block は parser から entries が silent drop され covenant の視野外に
  なるため、件数不一致そのものを違反化する）🟡 *silent-drop 経路の堵塞は parser 実装からの推論（現役 file に該当なし）*
- REQ-402-005: guard は real tree に対して **exact-0**（violations 配列の完全一致）
  で検証し、ceiling pin ではなく「全 edge が契約を満たす」ことを担保すること。
  在庫は floor pin（filesChecked / anchorEdges / registryEntries）で回帰検出すること 🔵 *REQ-391〜401 audit-pass-first census pattern の踏襲*

### 基本的な制約

- REQ-402-006: 本 spec 一式（requirements / note / interview-record / tasks/overview /
  TASK-0285・0286）の landing は **atomicity を dogfood すること**: 各 file の
  anchor block と parent 側登録（architecture.md children・design-interview.md
  children・speech-to-visuals/note.md references）を同一 commit に同梱し、
  sweep commit を残さないこと。本 guard が同 commit 内で GREEN になることを
  もって atomicity の実証とすること 🔵 *SPEC_LANDING_ATOMICITY の構造化とその自己適用*
- REQ-402-007: mutation 検証（MW-066）は guard commit から分離した TASK-0286 で
  実施し、(a) c818286f~1 の事故状態（facet-5 requirements.md の re-parent）再現、
  (b) architecture.md children からの登録行削除、(c) registry への phantom 対象
  追加の 3 独立 mutation で RED を実測し、mutation-witness-ledger.md に 5 列
  template 行を記載すること 🔵 *Phase 196（MW-060/061）で確立した分離実施 pattern の踏襲*

## 簡易ユーザーストーリー

### ストーリー1: spec landing の原子性

**私は** AI hub 実行ループ **として**
**新規 spec を land する際に parent 側 spine 登録を忘れた場合**
**guard が即 RED で差し戻すことで**
**後付け sweep commit を発生させずに済む。

**関連要件**: REQ-402-002, REQ-402-006

## 基本的な受け入れ基準

### REQ-402-001〜005: spine edge census guard

**Given（前提条件）**: specs/ に 327+ file・318+ anchor・86+ registry entry が存在する
**When（実行条件）**: `npx jest spine-edge-census` を実行する
**Then（期待結果）**: real-tree exact sweep が violations 0 で GREEN・合成 fixture が 6 violation kind 各 1 件以上を検出する

**テストケース**:

- [x] **TC-402-01**: real tree violations exact-0 + 在庫 floor pin 🔵
- [x] **TC-402-02**: c818286f~1 事故 shape（children block を持たない doc への
  parent 宣言）の合成 fixture が `PARENT_UNREGISTERED` を検出する 🔵
- [x] **TC-402-03**: TASK file exempt / root doc exempt / children と references
  両登録の受容（note→note wiring）の境界 test 🔵
- [x] **TC-402-04**: 6 violation kind の合成 fixture 検出（MW-066 とは別の
  unit-level 検出担保）🔵

### REQ-402-006: atomic landing の dogfood

**Given**: 本 spec 一式が未登録の状態
**When**: guard を実行する
**Then**: `PARENT_UNREGISTERED` で RED → parent 側 3 登録を同 commit で追加すると GREEN

## 最小限の非機能要件

- **性能**: census は specs/ の .md 全走査（数百 file・marker/行 scan のみ）で
  秒単位。guard suite の実行時間を増やさない
- **保守性**: 純関数 module（書き込みなし）・REQ-388 と同じ parser 委譲構成。
  実装は tests/ 配下（規模集計の実装予算外）
