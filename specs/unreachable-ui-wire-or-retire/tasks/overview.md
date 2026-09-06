# unreachable-ui-wire-or-retire タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**プロジェクト期間**: 2026-09-07 - 2026-09-08（2日）
**推定工数**: 16時間
**総タスク数**: 3件

## 関連文書

- **要件定義書**: [📋 requirements.md](../../speech-to-visuals/requirements.md) REQ-425 / REQ-426（Phase 196・提案ベース `- [ ]`）
- **受け入れ基準**: [✅ acceptance-criteria.md](../../speech-to-visuals/acceptance-criteria.md) TC-409-01〜02 / TC-410-01〜02（未実施）
- **設計文書**: [📐 architecture.md](../architecture.md)（Acceptance criteria: AC-P196-1〜4・裁決 roster 7 件確定済み）
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)
- **分析記録**: [🧠 design-interview.md](../design-interview.md) A1〜A8
- **要件段階分析**: [interview-record.md A157](../../speech-to-visuals/interview-record.md)（2026-09-05 第238回検証・到達可能性全走査）

## 背景

A157（要件段階）の到達可能性全走査で確定した生産 UI の未配線 6 件 + transitively unreachable な ui primitive 1 件（slider）について、kairo-design（PR #118・2026-09-07 merge）が **wire / retire の個別裁決 7 件**（VideoPreview=wire・slider=wire 経由存続・他 5 件=retire・−5 file / −2,060 行）と WIRE 設計（Index complete state の mount JSX 形状まで固定）・RETIRE 参照整理 roster（live code / test / guard の全行列挙）・到達性 guard 設計（純関数 walker + entry set {main.tsx, Root.tsx} + ALLOWED 空 + witness 2 形）を確定した。本 overview はその実装タスク分割である。設計の信頼性サマリーは 🔵 14 / 🟡 1（import 抽出正規表現の edge case のみ実装時判断）/ 🔴 0。

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 09-07 | VideoPreview 結線と page test（TC-410 完結） | 1 | 4h | [TASK-0322](#phase-1-wireビデオプレビューの実体化) |
| Phase 2 | 09-07 - 09-08 | 5 component 削除と live 参照整理（TC-409-01） | 1 | 6h | [TASK-0323](#phase-2-retire機能重複-5-件の削除と参照整理) |
| Phase 3 | 09-08 | 到達性 guard 新設と witness（TC-409-02・Phase 196 完結） | 1 | 6h | [TASK-0324](#phase-3-到達性-guard回帰防止の歯) |

## タスク番号管理

**使用済みタスク番号**: repo 全体で TASK-0001 〜 TASK-0321（2026-09-07 時点・TASK-0314〜0317 は specs/real-audio-e2e-regression/・TASK-0318〜0321 は specs/streaming-real-asr-inference/ に全て main 到達済み）
**本 feature 採番**: TASK-0322 〜 TASK-0324
**次回開始番号**: TASK-0325

## 全体進捗

- [ ] Phase 1: WIRE（ビデオプレビューの実体化）— TASK-0322
- [ ] Phase 2: RETIRE（機能重複 5 件の削除と参照整理）— TASK-0323
- [ ] Phase 3: 到達性 guard（回帰防止の歯）— TASK-0324

## マイルストーン

- **M1: WIRE 完成** (2026-09-07): VideoPreview が Index complete state に mount され page test が立証（TC-410-01 / TC-410-02 Green）
- **M2: RETIRE 完成** (2026-09-08): 5 file / 2,060 行が削除され live 参照が完全整理（TC-409-01 Green・299→294 file / 87,419→約 85,359 行）
- **M3: Phase 196 完結** (2026-09-08): 到達性 guard が green + mutation witness 実証（TC-409-02 Green・TC-409-01〜02 / TC-410-01〜02 全 Green）

---

## Phase 1: WIRE（ビデオプレビューの実体化）

**期間**: 2026-09-07
**目標**: 憲法ホワイトリスト「ビデオプレビュー」の実体実装（VideoPreview）を生産 mount に結線する
**成果物**: Index.tsx complete state の VideoPreview mount + page test + 単一ソース pin + VideoRenderer 死 import 削除

### タスク一覧

- [ ] [TASK-0322: WIRE — VideoPreview の Index complete state 結線と page test（TC-410 完結）](TASK-0322.md) - 4h (TDD) 🔵

### 依存関係

```
（前提なし — Phase 2 と並行可能）
TASK-0322 → TASK-0324（実 tree witness の対象辺を供給）
```

---

## Phase 2: RETIRE（機能重複 5 件の削除と参照整理）

**期間**: 2026-09-07 - 2026-09-08
**目標**: 到達不能 5 component（PipelineProgress・StageIndicator・EnhancedFileUploader・PerformanceMetricsVisualization・InteractiveResultViewer）を削除し、live 参照（src comment・test import・guard roster/witness）を完全整理する
**成果物**: 5 file 削除（−2,060 行）+ 参照整理 roster 全行実行 + grep witness 0 hit

### タスク一覧

- [ ] [TASK-0323: RETIRE — 5 component 削除と live 参照の完全整理（TC-409-01）](TASK-0323.md) - 6h (TDD) 🔵

### 依存関係

```
（前提なし — Phase 1 と並行可能）
TASK-0323 → TASK-0324（ALLOWED roster 空の前提を供給）
```

---

## Phase 3: 到達性 guard（回帰防止の歯）

**期間**: 2026-09-08
**目標**: 全 production component の mount 到達性を app entry からの import graph 走査で機械検証する guard を新設し、新規未配線 component の追加が RED で検出される歯を持たせる — Phase 196 完結
**成果物**: 純関数 walker helper + `tests/guards/component-mount-reachability.test.ts`（ALLOWED 空）+ mutation witness 2 形（MW ledger 記録）

### タスク一覧

- [ ] [TASK-0324: 到達性 guard 新設 — component-mount-reachability test と mutation witness（TC-409-02・Phase 196 完結）](TASK-0324.md) - 6h (TDD) 🔵（import 抽出 edge case のみ 🟡）

### 依存関係

```
TASK-0322 → TASK-0324
TASK-0323 → TASK-0324
（0322 と 0323 は並行可能・0324 は両方完了後）
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 3件
- 🔵 **青信号**: 3件 (100%)（TASK-0324 はタスク全体 🔵・項目単位で 🟡 1件を含む）
- 🟡 **黄信号**: 0件 (0%)
- 🔴 **赤信号**: 0件 (0%)

### 項目単位集計（各 TASK file のサマリー合算）

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装詳細・完了条件 | 24 | 1 | 0 | 25 |
| 単体テスト | 8 | 0 | 0 | 8 |
| 統合テスト | 2 | 0 | 0 | 2 |
| UI/UX 要件 | 4 | 0 | 0 | 4 |
| **合計** | **38** | **1** | **0** | **39** |

**品質評価**: 高品質（設計正本 architecture.md が裁決 7 件の出典付き根拠・mount JSX 形状・参照整理 roster 全行・guard 機構（entry set・ALLOWED 規約・witness 2 形）まで実在コード行番号に接地して固定済みで、タスクはその分割に過ぎない。🟡 1件は設計が意図的に実装時判断として残した import 抽出正規表現の edge case で TASK-0324 の合成 fixture leg で固定する）

## クリティカルパス

```
TASK-0322 ──┐
            ├──→ TASK-0324
TASK-0323 ──┘
```

**クリティカルパス工数**: 16時間（最長 chain = 0323→0324 の 12時間・全体 16時間）
**並行作業可能工数**: 4時間（TASK-0322 は TASK-0323 と並行）

## 外部入力（maintainer 依存 — born-DONE にしない範囲の明示）

なし — 全 task が repo 内完結（whisper binary 等の外部 gate は本 feature に存在しない）。

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0322`
