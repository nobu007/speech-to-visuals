# boundary-operator-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**プロジェクト期間**: 2026-08-23 - 2026-08-23（全 phase 完了）
**推定工数**: 4h（REQ-403 guard 実装 + 3 cluster 撲滅 + atomic dogfood landing）+ 1.5h（MW-067 mutation 検証）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-403
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: `GOOD_DETECTION_CONFIDENCE_THRESHOLD`（0.6 ペアの value+operator 一元化）
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 203 | 2026-08-23 | REQ-403 boundary strictness census guard（exact-0 固定）+ 3 cluster 撲滅 + 本 spec 一式の atomic landing | 1 | 4h | ✅完了 |
| Phase 204 | 2026-08-23 | MW-067 mutation 検証（同 commit 同梱規約）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0287 〜 TASK-0288
**次回開始番号**: TASK-0289

## 全体進捗

- [x] Phase 203: REQ-403 boundary strictness census guard + 3 site 撲滅
- [x] Phase 204: MW-067 mutation 検証 + ledger/台帳 pin 更新（同 commit 同梱）

## マイルストーン

- **M1: guard 完走** (Phase 203): real tree mixed-strictness cluster exact-0 + 合成 fixture 5 kind 検出 + 3 site 撲滅（boundary-INCLUSIVE 統一）+ 本 spec の atomic dogfood ✅
- **M2: teeth 実証** (Phase 204): MW-067 で 3 独立 mutation（strict revert ×2・新規 mixed cluster 注入）の RED 実測 ✅

---

## Phase 203: REQ-403 boundary strictness census guard

**目標**: 同一 (metric, 正規化 threshold, 方向) cluster 内の strict/inclusive 演算子
混在を census で exact-0 検証し、0.6 正典と同型の境界解釈分裂を撲滅する。
**成果物**: tests/guards/boundary-operator-census.test.ts + src 3 site 修正 + 本 spec 一式

### タスク一覧

- [x] [TASK-0287: boundary strictness census guard 新設 + 3 cluster 撲滅 + atomic dogfood landing](TASK-0287.md) - 4h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 12 登録を含む

---

## Phase 204: MW-067 mutation 検証

**目標**: guard の teeth を実事故 shape で実証（REQ-403-007）。
**成果物**: MW-067 ledger row 3 mutation + PINNED_MIN_ENTRIES 62→63

### タスク一覧

- [x] [TASK-0288: MW-067 mutation 検証 + ledger 更新](TASK-0288.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0287 完了後（guard 実装の確定状態に対する mutation）
