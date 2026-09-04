# audit-pass-first-census-facet-5 タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**プロジェクト期間**: 2026-08-23 - 2026-08-23（全 phase 完了）
**推定工数**: 8〜10h（REQ-396 + REQ-397 paired 実装 + audit-driven 撲滅）+ 2h（mutation 検証分離実施）
**総タスク数**: 3件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-396/397
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **親 census series**: REQ-391〜395 in [speech-to-visuals/requirements.md](../../speech-to-visuals/requirements.md)
- **直近 predecessor**: [TASK-0277](../../speech-to-visuals/tasks/TASK-0277.md)（REQ-395 three-way guard + ratchet teardown）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 194 | 2026-08-23 | REQ-396 stale-comment-census（confirmed-zero 固定） | 1 | 2h | ✅完了 (656a0d58) |
| Phase 195 | 2026-08-23 | REQ-397 type-narrow-as-any + any-annotate paired（audit で残件 0 確認 → confirmed-zero 固定） | 1 | 6〜8h | ✅完了 (656a0d58・Phase 194 と paired 単一 commit) |
| Phase 196 | 2026-08-23 | MW-060/061 mutation 検証 + spec 状態確定（guard commit から分離実施） | 1 | 2h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0278 〜 TASK-0280
**次回開始番号**: TASK-0281

## 全体進捗

- [x] Phase 194: REQ-396 stale-comment-census
- [x] Phase 195: REQ-397 paired type-narrow-as-any + any-annotate census
- [x] Phase 196: MW-060/061 mutation 検証 + spec 状態確定

## マイルストーン

- **M1: stale-comment guard 完走** (Phase 194 完了): family 5 登録 + confirmed-zero 固定 ✅
- **M2: type-system bypass guard 完走** (Phase 195 完了): family 6/7 paired 登録 → 手動 audit で production 残件 0 を確認したため撲滅対象なし・confirmed-zero 固定（REQ-397-006 の audit-driven 分離規約に従い Phase 196 で mutation 検証を分離実施）✅
- **M3: mutation 検証による teeth 実証** (Phase 196 完了): MW-060/061 で 3+3 独立 RED 実測・marker anchor filter の FIXME 盲目を発見し `\bfix\b` 厳格化 ✅

---

## Phase 194: REQ-396 stale-comment-census

**目標**: stale-comment class（confession / disclosure / marker / self-claim）を audit-pass-first pattern で pin
**成果物**: stale-comment-census guard（family 5）+ confirmed-zero 固定

### タスク一覧

- [x] [TASK-0278: stale-comment-census guard 新設 + family 5 登録](TASK-0278.md) - 2h (TDD) 🔵 ✅完了（656a0d58）

### 依存関係

```
（独立 — Phase 195 と並行着手可能）
```

---

## Phase 195: REQ-397 paired type-narrow-as-any + any-annotate census

**目標**: type-system bypass の 2 表現（`as any` cast + `: any` 注釈）を paired 新設で同時 pin、audit-driven 撲滅同梱
**成果物**: type-narrow-as-any-census（F6）+ any-annotate-census（F7）— audit の結果 production 残件は whisper-node.d.ts:7 の 1 件（third-party-sdk ALLOWED）のみで撲滅対象なし・両 guard confirmed-zero 固定

### タスク一覧

- [x] [TASK-0279: type-narrow-as-any + any-annotate paired guard 新設 + family 6/7 登録](TASK-0279.md) - 6〜8h (TDD) 🟡 ✅完了（656a0d58・Phase 194 と同一 commit の paired ship・audit で confirmed-zero 確定）

### 依存関係

```
（Phase 194 と並行着手可能 — ただし three-way guard への family 登録は両 task で同一 file を touch するため serialize）
TASK-0279 は family 6/7 を paired 登録する際 family 5 の存在を前提とする
```

---

## Phase 196: MW-060/061 mutation 検証 + spec 状態確定

**目標**: 656a0d58 が「MW-060 / MW-061 mutation verification は次 TASK で実施」と繰り越した分離実施 — 3 guard の teeth を 3+3 独立 mutation で実証し、REQ-395 three-way が検査対象外だった prose 側 drift（26 件→23 key）を訂正、受け入れ基準 checkbox を実測に確定
**成果物**: mutation-witness ledger MW-060/061（narrative + appendix row・監査 pin ≥61）+ stale-comment-census marker anchor filter 厳格化（`fix`→`\bfix\b`・FIXME 部分一致の盲目解消）+ requirements.md 状態確定

### タスク一覧

- [x] [TASK-0280: MW-060/061 mutation 検証 + facet-5 spec 状態確定](TASK-0280.md) - 2h (検証) 🔵 ✅完了

### 依存関係

```
TASK-0278 + TASK-0279（guard 本体）→ TASK-0280（teeth 実証 + 状態確定）
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 3件
- 🔵 **青信号**: 2件 (67%) — TASK-0278 confirmed-zero 固定が既存観測から確実・TASK-0280 は既存 MW 規約の機械的適用
- 🟡 **黄信号**: 1件 (33%) — TASK-0279 audit-driven 撲滅同梱が audit 結果次第 → 結果: confirmed-zero で確定

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
TASK-0279 → （family 6/7 paired 登録） → audit → confirmed-zero 化
                                                    ↓
TASK-0280 → MW-060/061 mutation 検証 → spec 状態確定（完了）
```

**クリティカルパス工数**: 2 + 6〜8 + 2 = 10〜12h（three-way guard 更新 serialize を含む）
**並行作業可能工数**: 2h（TASK-0278 の独立部分）

## 期待される効果

1. **stale-comment class の pin** — confession comment（捏造の隠蔽兆候）の再発を機械的に RED 化。REQ-391/393 手動 audit の滴り撲滅 ✅（MW-060 で teeth 実証）
2. **type-system bypass の 2 表現 pin** — `as any` cast と `: any` 注釈の合法利用（boundary 4 分類）と不正利用（generic / internal）を分離し、後者を `unknown` 移行で fail-closed 化 ✅（MW-061 で teeth 実証・EDGE-202 test-mock 混入 ban 含む）
3. **census family の体系化** — REQ-391〜394（family 1〜4）に REQ-396/397（family 5/6/7）が追加され、audit-pass-first pattern が 7 facet を cover。次世代メンテナーが新規 facet 追加手順を誤らずに済む ✅

## 次のステップ

本 facet は全 phase 完了。次 facet（audit-pass-first 第 6 facet 以降）を計画する場合は requirements.md の REQ-391〜397 series を踏襲し、新規 REQ 番号・TASK-0281 から採番する。
