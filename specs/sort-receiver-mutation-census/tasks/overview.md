# sort-receiver-mutation-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**プロジェクト期間**: 2026-08-25 - 2026-08-25（全 phase 完了）
**推定工数**: 3.5h（REQ-407 guard 実装 + ALLOWED 24 key 分類 + three-way family 16 登録 + atomic dogfood landing）+ 1.5h（MW-071 mutation 検証）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-407
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-405 fallback-default census（値のでっち上げ面）・REQ-403 boundary-operator census・REQ-404 rounding-mode census — family 16 は receiver aliasing 面
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）・REQ-406 title-sync（index 表題一致）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 211 | 2026-08-25 | REQ-407 sort-receiver-mutation census guard（roster exact both-ways）+ reverse/comparator-less exact-0 axis + ALLOWED 24 key 分類 + 本 spec 一式の atomic landing | 1 | 3.5h | ✅完了 |
| Phase 212 | 2026-08-25 | MW-071 mutation 検証（同 commit 同梱規約）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0295 〜 TASK-0296
**次回開始番号**: TASK-0297

## 全体進捗

- [x] Phase 211: REQ-407 sort-receiver-mutation census guard + ALLOWED 24 key 分類 + three-way family 16 登録
- [x] Phase 212: MW-071 mutation 検証 + ledger/台帳 pin 更新（同 commit 同梱）

## マイルストーン

- **M1: guard 完走** (Phase 211): 実 tree in-place 24 site roster 完備（exact both-ways）+ reverse in-place exact-0 + comparator-less exact-0 + 合成 fixture 検出 + 本 spec の atomic dogfood ✅
- **M2: teeth 実証** (Phase 212): MW-071 で 3 独立 mutation（canonical fresh 形の in-place 化・roster receiver rename の二重捕捉・reverse copy 形の in-place 化）の RED 実測 ✅

---

## Phase 211: REQ-407 sort-receiver-mutation census guard

**目標**: 破壊的配列操作の receiver 判別を census で exact both-ways 検証し、
sorted view と shared input 破壊の混同を構造的に遮断する。
**成果物**: tests/guards/sort-receiver-mutation-census.test.ts + three-way family 16 行 + 本 spec 一式

### タスク一覧

- [x] [TASK-0295: sort-receiver-mutation census guard 新設 + ALLOWED 24 key 分類 + three-way family 16 登録 + atomic dogfood landing](TASK-0295.md) - 3.5h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 16 登録を含む
- REQ-402 spine edge census / REQ-406 title-sync（landing atomicity の検証器）

---

## Phase 212: MW-071 mutation 検証

**目標**: guard の teeth を実事故 shape で実証（REQ-407-006）。
**成果物**: MW-071 ledger row 3 mutation + PINNED_MIN_ENTRIES 66→67

### タスク一覧

- [x] [TASK-0296: MW-071 mutation 検証 + ledger 更新](TASK-0296.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0295 完了後（guard 実装の確定状態に対する mutation）
