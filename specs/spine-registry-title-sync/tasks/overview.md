# spine-registry-title-sync タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**プロジェクト期間**: 2026-08-25 - 2026-08-25（全 phase 完了）
**推定工数**: 3h（REQ-406 violation kind 2 件 + fixture 更新 + confirmed-zero census + atomic dogfood landing）+ 1.5h（MW-070 mutation 検証）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-406
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **拡張対象正典**: REQ-402 spine edge 双方向 census（tests/guards/spine-edge-contract.ts / spine-edge-census.test.ts）
- **事故の一次資料**: 90c924db（drift 2 件を抱えた本体 commit）・47d71cd5（`chore(make-run): commit 2 remaining change(s)` sweep 修復）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 209 | 2026-08-25 | REQ-406 title-sync violation 2 kind + firstHeading + titleChecked 計数 + confirmed-zero census + 本 spec 一式の atomic landing | 1 | 3h | ✅完了 |
| Phase 210 | 2026-08-25 | MW-070 mutation 検証（同 commit 同梱規約）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0293 〜 TASK-0294
**次回開始番号**: TASK-0295

## 全体進捗

- [x] Phase 209: REQ-406 title-sync violation 2 kind + confirmed-zero census + atomic landing
- [x] Phase 210: MW-070 mutation 検証 + ledger/台帳 pin 更新（同 commit 同梱）

## マイルストーン

- **M1: guard 完走** (Phase 209): 実 tree 表題違反 exact-0（112 entry baseline・titleChecked floor pin）+ 事故 shape fixture 双方向の検出 + 本 spec の atomic dogfood（parent 側 4 登録の同 commit 同梱）✅
- **M2: teeth 実証** (Phase 210): MW-070 で 3 独立 mutation（子 H1 改題 / 親 index 表題 typo / H1 除去）の RED 実測 ✅

---

## Phase 209: REQ-406 title-sync violation + confirmed-zero census

**目標**: registry entry 表題 ↔ 対象 doc H1 の一致を exact sweep で強制し、
子の改題と親 index 同期が同一 commit に揃わない landing を RED にする。
**成果物**: tests/guards/spine-edge-contract.ts + spine-edge-census.test.ts + 本 spec 一式

### タスク一覧

- [x] [TASK-0293: title-sync violation 2 kind 新設 + confirmed-zero census + atomic dogfood landing](TASK-0293.md) - 3h (TDD) 🔵 ✅完了

### 依存関係

- REQ-402 の `auditSpineEdges` / `parseSpineRegistries` 実装に直接拡張
- REQ-388 `parseAnchorBlocks` は不変（anchor block 単体は REQ-388 管轄）
- 既存 6 violation kind の fixture test が新契約（表題一致）の下でも単一kind を保つよう呼び出し側を更新

---

## Phase 210: MW-070 mutation 検証

**目標**: guard の teeth を実事故 shape で実証（REQ-406-006）。
**成果物**: MW-070 ledger row 3 mutation + PINNED_MIN_ENTRIES 65→66

### タスク一覧

- [x] [TASK-0294: MW-070 mutation 検証 + ledger 更新](TASK-0294.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0293 完了後（guard 実装の確定状態に対する mutation）
