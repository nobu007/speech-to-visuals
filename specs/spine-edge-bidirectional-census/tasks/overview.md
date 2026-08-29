# spine-edge-bidirectional-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**プロジェクト期間**: 2026-08-23 - 2026-08-23（全 phase 完了）
**推定工数**: 4h（REQ-402 guard 実装 + atomic dogfood landing）+ 1.5h（mutation 検証分離実施）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-402
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行 guard**: REQ-388 [TASK-0270](../../speech-to-visuals/tasks/TASK-0270.md)（spine anchor role census）
- **事故記録**: c818286f（facet-5 spine wiring の sweep 分離修復）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 201 | 2026-08-23 | REQ-402 spine edge 双方向 census guard（exact-0 固定）+ 本 spec 一式の atomic landing | 1 | 4h | ✅完了 |
| Phase 202 | 2026-08-23 | MW-066 mutation 検証（guard commit から分離実施）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0285 〜 TASK-0286
**次回開始番号**: TASK-0287

## 全体進捗

- [x] Phase 201: REQ-402 spine edge 双方向 census guard
- [x] Phase 202: MW-066 mutation 検証 + ledger/台帳 pin 更新

## マイルストーン

- **M1: guard 完走** (Phase 201): real tree exact-0 + 合成 fixture 6 kind 検出 + 本 spec の atomic dogfood（guard が自 spec の未登録状態を RED → 同 commit 登録で GREEN）✅
- **M2: teeth 実証** (Phase 202): MW-066 で 3 独立 mutation（事故再現・登録削除・phantom 登録）の RED 実測 ✅

---

## Phase 201: REQ-402 spine edge 双方向 census guard

**目標**: anchor parent 宣言 ↔ parent 側 spine:children / spine:references 登録の
edge 両端を census で検証し、parent 側登録を同梱しない spec landing を RED 化する
（SPEC_LANDING_ATOMICITY の構造化）。
**成果物**: tests/guards/spine-edge-contract.ts + spine-edge-census.test.ts + 本 spec 一式

### タスク一覧

- [x] [TASK-0285: spine edge census guard 新設 + atomic dogfood landing](TASK-0285.md) - 4h (TDD) 🔵 ✅完了

### 依存関係

- REQ-388 の `parseAnchorBlocks` / `isTaskFile`（export 化）に依存

---

## Phase 202: MW-066 mutation 検証（分離実施）

**目標**: guard の teeth を実事故 shape で実証（REQ-402-007）。
**成果物**: MW-066 ledger row 3 mutation + PINNED_MIN_ENTRIES 61→62

### タスク一覧

- [x] [TASK-0286: MW-066 mutation 検証 + ledger 更新](TASK-0286.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0285 完了後（guard 実装の確定状態に対する mutation）
