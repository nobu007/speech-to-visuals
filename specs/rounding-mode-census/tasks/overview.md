# rounding-mode-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**プロジェクト期間**: 2026-08-24 - 2026-08-24（全 phase 完了）
**推定工数**: 3.5h（REQ-404 guard 実装 + ALLOWED 分類 + atomic dogfood landing）+ 1.5h（MW-068 mutation 検証）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-404
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-403 boundary-operator census（比較側の境界 class・family 12）
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 205 | 2026-08-24 | REQ-404 rounding-mode census guard（exact-0 固定）+ 唯一 mixed cluster の ALLOWED 分類 + 本 spec 一式の atomic landing | 1 | 3.5h | ✅完了 |
| Phase 206 | 2026-08-24 | MW-068 mutation 検証（同 commit 同梱規約）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0289 〜 TASK-0290
**次回開始番号**: TASK-0291

## 全体進捗

- [x] Phase 205: REQ-404 rounding-mode census guard + 唯一 mixed cluster の ALLOWED 分類
- [x] Phase 206: MW-068 mutation 検証 + ledger/台帳 pin 更新（同 commit 同梱）

## マイルストーン

- **M1: guard 完走** (Phase 205): real tree 未分類 mixed-rounding site exact-0 + 合成 fixture 6 kind 検出 + `duration * fps` cluster の 2 domain ALLOWED 分類 + 本 spec の atomic dogfood ✅
- **M2: teeth 実証** (Phase 206): MW-068 で 3 独立 mutation（新規 mixed cluster 注入・engine mode flip・renderer mode flip）の RED 実測 ✅

---

## Phase 205: REQ-404 rounding-mode census guard

**目標**: 同一空白正規化引数 cluster 内の Math.round/floor/ceil 混在を census で
exact-0 検証し、境界 class の出力側（off-by-one-frame）を閉じる。
**成果物**: tests/guards/rounding-mode-census.test.ts + three-way family 13 行 + 本 spec 一式

### タスク一覧

- [x] [TASK-0289: rounding-mode census guard 新設 + 唯一 mixed cluster の ALLOWED 分類 + atomic dogfood landing](TASK-0289.md) - 3.5h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 13 登録を含む

---

## Phase 206: MW-068 mutation 検証

**目標**: guard の teeth を実事故 shape で実証（REQ-404-007）。
**成果物**: MW-068 ledger row 3 mutation + PINNED_MIN_ENTRIES 63→64

### タスク一覧

- [x] [TASK-0290: MW-068 mutation 検証 + ledger 更新](TASK-0290.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0289 完了後（guard 実装の確定状態に対する mutation）
