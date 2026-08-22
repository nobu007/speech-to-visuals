# audit-pass-first-census-facet-5 タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [audit-pass-first-census-facet-5 要件定義](requirements.md)
>
> - parent: `audit-pass-first-census-facet-5/requirements.md` (REQ-396/397 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**プロジェクト期間**: 2026-08-23 - （継続中）
**推定工数**: 8〜10h（REQ-396 + REQ-397 paired 実装 + audit-driven 撲滅）
**総タスク数**: 2件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-396/397
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **親 census series**: REQ-391〜395 in [speech-to-visuals/requirements.md](../../speech-to-visuals/requirements.md)
- **直近 predecessor**: [TASK-0277](../../speech-to-visuals/tasks/TASK-0277.md)（REQ-395 three-way guard + ratchet teardown）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 194 | 2026-08-23 | REQ-396 stale-comment-census（confirmed-zero 固定） | 1 | 2h | ⬜ 未着手 |
| Phase 195 | 2026-08-23 | REQ-397 type-narrow-as-any + any-annotate paired（audit-driven 撲滅同梱） | 1 | 6〜8h | ⬜ 未着手 |

## タスク番号管理

**使用済みタスク番号**: TASK-0278 〜 TASK-0279
**次回開始番号**: TASK-0280

## 全体進捗

- [ ] Phase 194: REQ-396 stale-comment-census
- [ ] Phase 195: REQ-397 paired type-narrow-as-any + any-annotate census

## マイルストーン

- **M1: stale-comment guard 完走** (Phase 194 完了): family 5 登録 + confirmed-zero 固定
- **M2: type-system bypass guard 完走** (Phase 195 完了): family 6/7 paired 登録 + audit-driven 撲滅同梱 → confirmed-zero 化

---

## Phase 194: REQ-396 stale-comment-census

**目標**: stale-comment class（confession / disclosure / marker / self-claim）を audit-pass-first pattern で pin
**成果物**: stale-comment-census guard（family 5）+ confirmed-zero 固定

### タスク一覧

- [ ] [TASK-0278: stale-comment-census guard 新設 + family 5 登録](TASK-0278.md) - 2h (TDD) 🔵

### 依存関係

```
（独立 — Phase 195 と並行着手可能）
```

---

## Phase 195: REQ-397 paired type-narrow-as-any + any-annotate census

**目標**: type-system bypass の 2 表現（`as any` cast + `: any` 注釈）を paired 新設で同時 pin、audit-driven 撲滅同梱
**成果物**: type-narrow-as-any-census（F6）+ any-annotate-census（F7）+ ERADICATED 候補全 site `unknown` 移行

### タスク一覧

- [ ] [TASK-0279: type-narrow-as-any + any-annotate paired guard 新設 + family 6/7 登録](TASK-0279.md) - 6〜8h (TDD) 🟡

### 依存関係

```
（Phase 194 と並行着手可能 — ただし three-way guard への family 登録は両 task で同一 file を touch するため serialize）
TASK-0279 は family 6/7 を paired 登録する際 family 5 の存在を前提とする
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 2件
- 🔵 **青信号**: 1件 (50%) — TASK-0278 confirmed-zero 固定が既存観測から確実
- 🟡 **黄信号**: 1件 (50%) — TASK-0279 audit-driven 撲滅同梱が audit 結果次第

### カテゴリ別信頼性

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装ステップ | 16 | 1 | 0 | 17 |
| 検証ステップ | 2 | 0 | 0 | 2 |
| 設計決定 | 5 | 1 | 0 | 6 |

**品質評価**: 高品質（既存 census pattern の直接延長・観測規模が確定）

## クリティカルパス

```
TASK-0278 → （family 5 登録） → （three-way guard 更新 serialize point）
                                                    ↓
TASK-0279 → （family 6/7 paired 登録） → audit-driven 撲滅同梱 → confirmed-zero 化
```

**クリティカルパス工数**: 2 + 6〜8 = 8〜10h（three-way guard 更新 serialize を含む）
**並行作業可能工数**: 2h（TASK-0278 の独立部分）

## 期待される効果

1. **stale-comment class の pin** — confession comment（捏造の隠蔽兆候）の再発を機械的に RED 化。REQ-391/393 手動 audit の滴り撲滅
2. **type-system bypass の 2 表現 pin** — `as any` cast と `: any` 注釈の合法利用（boundary 4 分類）と不正利用（generic / internal）を分離し、後者を `unknown` 移行で fail-closed 化
3. **census family の体系化** — REQ-391〜394（family 1〜4）に REQ-396/397（family 5/6/7）が追加され、audit-pass-first pattern が 7 facet を cover。次世代メンテナーが新規 facet 追加手順を誤らずに済む

## 次のステップ

タスクを実装するには:
- TASK-0278 単独着手: `/tsumiki:kairo-implement TASK-0278`
- TASK-0279 単独着手: `/tsumiki:kairo-implement TASK-0279`
- 両方連続実装: `/tsumiki:kairo-implement`（ID 昇順）
