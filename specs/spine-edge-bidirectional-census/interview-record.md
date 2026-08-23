# spine edge 双方向 census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

make-run steering（Phase 200 feedback・SPEC_LANDING_ATOMICITY）が指摘した
「spine wiring 修復が sweep commit に分離して land する再発」に対し、運用変更で
なく構造的 guard で封じる要件（REQ-402）の前提を、既存 guard・実 tree・事故
commit の照合によって確定する。

## 分析項目と判断

### A1: 既存 guard の盲点特定

**カテゴリ**: 既存設計確認
**背景**: c818286f~1 の dangling anchor がなぜ GREEN で land できたか。

**判断**: REQ-388 `spine-anchor-contract.ts` は anchor block **単体**の
shape（parent 行の存在・role 導出値の一致）のみを検証し、parent 宣言の**宛先**
（parent 側 registry block の内容・実在）は一切検証しない。role 導出は parent
表記の文字列（`/` 含有）のみを使うため、存在しない wiring も正規 role で通る。
**根拠**: spine-anchor-contract.ts 全読み + 実 tree census（forward 違反 290 件が
既存 guard で検出されないことの実証）。

**信頼性への影響**: REQ-402-001〜003 を 🔵 で確定（盲点の実在が実証済み）。

### A2: children / references の受容規則の確定

**カテゴリ**: 未定義部分詳細化
**背景**: 「parent 側登録あり」の判定に children block のみを要求すべきか。

**判断**: 実在 30 feature anchor の全数観測で、c818286f 修復後の正規形は
children 26 + **references 2**（note→note wiring: guard-harness-fold-census/note.md・
audit-pass-first-census-facet-5/note.md）。references を受容から除外すると
value judge が「双方向 edge を一貫して完成」と評価した修復後状態が偽陽性になる。
よって登録受容は children **または** references とし、双方向性（back-anchor）
の要求は children entry 側に限定する（references は engine schema 上 one-way・
実在 60 entry 中 58 が TASK file 参照で back-anchor を持たない）。

**信頼性への影響**: REQ-402-002/003 を 🔵 に引き上げ（全数観測に基づく）。

### A3: TASK file / root doc の exempt 規則の確定

**カテゴリ**: 影響範囲
**背景**: forward 検査を全 anchor に課すと実在 tree が即 RED になるか。

**判断**: TASK anchor 288 件は全て個別登録なし（登録粒度 = tasks/overview.md）。
全件要求は 288 行の schema 変更であり bounded でないため exempt とし、TASK の
anchor 網羅は REQ-388 `TASK_ANCHOR_MISSING` が既に担保する。bare parent
（`/` なし）は `SYSTEM_CONSTITUTION.md` のみ観測され、top-level root として
exempt（role は feature_root/system_design_root で REQ-388 が検証）。ただし
bare parent 観測集合は exact pin して新規 root を意識的にさせる。

**信頼性への影響**: REQ-402-002 を 🔵 に維持（全数観測）。

### A4: steering 具象 item の phantom 判定

**カテゴリ**: 優先順位
**背景**: Phase 200 feedback の残る 3 item（exact-rational boundary sweep・
impl LOC 3000/3000 圧縮・docker-compose guard 拡張）。

**判断**: いずれも本 repo に実体なし — (a) TASK-0357〜0359 / z-score /
deviation-score / effect-size は grep 0 件（本 repo の TASK は 0284 まで・
品質しきい値は REQ-391〜401 census が既に管轄）、(b) 本 repo 憲法は
90,000 行 / 320 file（3000 行の上限は存在しない）、(c) docker-compose 系
file は repo に存在しない。3 item は他 hub repo 由来の cross-repo 汎用
pointer であり、META-intent（境界 class の census close・guard の視野拡張）のみ
採用し、SPEC_LANDING_ATOMICITY のみ本 repo で実体が確認されたため REQ-402 として
採用した（memory: ai-hub-value-gate-judge / phantom-feedback trap の踏襲）。

**信頼性への影響**: 要件のスコープを SPEC_LANDING_ATOMICITY に集中（🟡→🔵:
grep・憲法読みで実証）。

## 分析結果サマリー

### 確認できた事項

- c818286f~1 で forward 違反 290 件（TASK 288 + feature 2）が存在し既存 guard は不検出
- 修復後の tree は violations 0（children 26 双方向・references 60 one-way・root 2 exempt）
- api-endpoints.md は anchor なしの pure reference holder（契約の義務なし）

### 追加/変更要件

- REQ-402-001〜007（guard 新設・exempt 規則・reverse 検査・marker 構造・
  exact-0・atomic dogfood・MW-066 分離）

### 残課題

- なし（hub 側 doc-spine engine の manifest は auto-gen・gitignored のため
  本 guard は anchor/registry の静的契約に限定 — manifest 依存の検査は
  clean checkout で常時走らないという REQ-388 と同じ制約）

### 信頼性レベル分布

**分析後**: 🔵 6 / 🟡 1（REQ-402-004 marker 構造は現役 file に該当なしの推論）/ 🔴 0

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
