# spine edge 双方向 census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) spine guard series context
>
> - parent: `speech-to-visuals/note.md` (spine guard series)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**目的**: REQ-402（spine edge 双方向 census）の技術的根拠・設計決定・実測観測を整理する。

---

## 実測観測（2026-08-23・c818286f 修復後の tree）

specs 実走査（`parseAnchorBlocks` 相当 + registry marker 解析）の結果:

- .md file 327 / anchor block 318（全て parent 行あり・role census GREEN）
- registry block 7: architecture.md children(19) + references(2) /
  design-interview.md children(7) / api-endpoints.md references(33) /
  requirements.md references(22) / acceptance-criteria.md references(2) /
  note.md references(1)
- feature-level（非 TASK）anchor 30 件の内訳: children 登録 26・references 登録 2
  （guard-harness-fold-census/note.md・audit-pass-first-census-facet-5/note.md の
  note→note wiring）・root exempt 2（architecture.md・design-interview.md →
  `SYSTEM_CONSTITUTION.md`）
- TASK anchor 288 件は全て個別登録なし（登録粒度 = tasks/overview.md）
- api-endpoints.md は anchor なし（pure な reference holder/target）

この観測がそのまま契約の exempt 規則（TASK file・bare parent）と references
one-way 規則の根拠。c818286f~1 では feature-level 2 件
（facet-5 requirements.md・tasks/overview.md）が `PARENT_UNREGISTERED` 状態だった。

## 設計決定

1. **children と references の両方を登録受容とする** — c818286f の修復は
   note 系 wiring に references を使って完了しており（value judge も「双方向 edge
   を一貫して完成」と評価）、children のみ受容だとこの正規形を偽陽性にする。
   代わりに双方向性の要求は children entry 側に置く（`CHILD_BACK_ANCHOR_MISSING`）。
2. **TASK file は forward 検査から exempt** — 実在 288 anchor が全て個別登録なし。
   これを要求すると 288 行の登録が必須になり schema 変更になる（bounded でない）。
   TASK の網羅は REQ-388 の `TASK_ANCHOR_MISSING` が既に担保。
3. **bare parent は exempt・観測集合を exact pin** — `SYSTEM_CONSTITUTION.md` のみ。
   repo root 直下 doc への新規 anchor は意識的な追加として test 側 pin に引っかかる。
4. **anchor 解析は REQ-388 `parseAnchorBlocks` に委譲** — anchor 解析の単一実装
   （invariant-split 回避）。`isTaskFile` も同様に REQ-388 側で export して共有。
5. **marker 件数不一致を違反化** — parser は閉じ marker が無くても末尾まで
   entries を拾うが、block の網羅性は begin/end 件数一致でしか担保できない。
6. **実装は tests/ 配下のみ** — 規模集計（90K 行 / 320 file・実装のみ）の予算外。
   憲法の LOC 議論に触れない bounded な変更。

## 関連

- 先行: REQ-388（anchor role census・Phase 186）・REQ-355/356（mirror 契約）
- 事故: 656a0d58 → c818286f（sweep 分離修復）
- steering: Phase 200 feedback SPEC_LANDING_ATOMICITY
