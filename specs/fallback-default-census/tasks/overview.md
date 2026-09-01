# fallback-default-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**プロジェクト期間**: 2026-08-24 - 2026-08-24（全 phase 完了）
**推定工数**: 4h（REQ-405 guard 実装 + 3 site unify + ALLOWED 32 key 分類 + atomic dogfood landing）+ 1.5h（MW-069 mutation 検証）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-405
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-403 boundary-operator census（比較側）・REQ-404 rounding-mode census（丸め側）— family 14 は欠損時代替値側
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）・scene-duration-limits-single-source（durationMs three-path agreement）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 207 | 2026-08-24 | REQ-405 fallback-default census guard（exact-0 固定）+ real inconsistency 3 site unify + ALLOWED 32 key 分類 + 本 spec 一式の atomic landing | 1 | 4h | ✅完了 |
| Phase 208 | 2026-08-24 | MW-069 mutation 検証（同 commit 同梱規約）| 1 | 1.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0291 〜 TASK-0292
**次回開始番号**: TASK-0293

## 全体進捗

- [x] Phase 207: REQ-405 fallback-default census guard + 3 site unify + ALLOWED 32 key 分類
- [x] Phase 208: MW-069 mutation 検証 + ledger/台帳 pin 更新（同 commit 同梱）

## マイルストーン

- **M1: guard 完走** (Phase 207): real tree 未分類 mixed-cluster site exact-0 + 合成 fixture 検出 + 3 site unify（durationMs 正典化・reason 'unknown' 統一・role 'authenticated' 統一）+ 本 spec の atomic dogfood ✅
- **M2: teeth 実証** (Phase 208): MW-069 で 3 独立 mutation（旧 spelling revert の三重捕捉・新規第 3 literal 注入・ALLOWED site literal flip の stale-row）の RED 実測 ✅

---

## Phase 207: REQ-405 fallback-default census guard

**目標**: 同一 chain への primitive literal fallback 混在を census で
exact-0 検証し、real inconsistency 3 site を unify して欠損時の値
でっち上げ不一致を閉じる。
**成果物**: tests/guards/fallback-default-census.test.ts + src 4 file + three-way family 14 行 + 本 spec 一式

### タスク一覧

- [x] [TASK-0291: fallback-default census guard 新設 + real inconsistency 3 site unify + atomic dogfood landing](TASK-0291.md) - 4h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 14 登録を含む
- `DEFAULT_SCENE_DURATION_MS` 正典（src/pipeline/scene-duration-limits.ts）に依存

---

## Phase 208: MW-069 mutation 検証

**目標**: guard の teeth を実事故 shape で実証（REQ-405-008）。
**成果物**: MW-069 ledger row 3 mutation + PINNED_MIN_ENTRIES 64→65

### タスク一覧

- [x] [TASK-0292: MW-069 mutation 検証 + ledger 更新](TASK-0292.md) - 1.5h 🔵 ✅完了

### 依存関係

- TASK-0291 完了後（guard 実装の確定状態に対する mutation）
