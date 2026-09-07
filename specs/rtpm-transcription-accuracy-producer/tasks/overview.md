# rtpm-transcription-accuracy-producer タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**プロジェクト期間**: 2026-09-07 - 2026-09-08（2日）
**推定工数**: 8時間
**総タスク数**: 1件

## 関連文書

- **設計文書**: [📐 architecture.md](../architecture.md)（Acceptance criteria: AC-RTPM-1〜7・すべて未達 — 実装時に RED→GREEN）
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)（機能1〜3: 減点 0.5 実値化・実推論 0.90 実値化・報告前 null 維持）
- **分析記録**: [🧠 design-interview.md](../design-interview.md) A1〜A6
- **要件定義**: [speech-to-visuals 要件定義書 REQ-431](../../speech-to-visuals/requirements.md)（Phase 302・REQ-430 後段・(a)〜(g)）
- **受け入れ基準**: [speech-to-visuals 受け入れ基準 TC-424-01〜04](../../speech-to-visuals/acceptance-criteria.md)（すべて未実施）

## 背景

Phase 302 の要件化（PR #138・fd4ac8b3・REQ-431 + TC-424-01〜04）と技術設計（PR #139・fbe97e05・AC-RTPM-1〜7）が main 到達済み。現状 pipeline 3 経路は REQ-430（b8660230）以降、品質集計に採用した減点後 transcriptionAccuracy を `recordPipelineQuality` と同一の定義点で計算済みだが、monitor（`RealTimePerformanceMonitor`）への報告は scenes/overlap の 2 値のみで accuracy は破棄され、`getSnapshot().quality.transcriptionAccuracy` は無条件 `null`（real-time-performance-monitor.ts:718）— adaptive Transcription Accuracy gate は METRIC UNAVAILABLE 恒久・`updateAdaptiveThresholds` の学習 round ゼロ・field doc の REQ-368 除外根拠は REQ-430 減点導入で消滅済み。本 overview はこの producer 接続（optional 第 3 引数 + report object + private derivation による REQ-372 と同型の第 2 field 拡張）を実装するタスク分割である。設計の信頼性サマリーは architecture 🔵 16 / 🟡 0 / 🔴 0。`avgSceneQuality` の正典 formula 裁決は REQ-431 (e) で明示的に scope 外。

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 09-07 - 09-08 | producer 接続（monitor 拡張 + 3 経路報告）と実値化検証（AC-RTPM-1〜7 完結） | 1 | 8h | [TASK-0326](#phase-1-producer-接続と実値化検証) |

## タスク番号管理

**使用済みタスク番号**: repo 全体で TASK-0001 〜 TASK-0325（2026-09-07 時点・TASK-0325 は specs/asr-fallback-recovery-order/ で完了・TASK-0323/0324 は specs/unreachable-ui-wire-or-retire/ で未実施）
**本 feature 採番**: TASK-0326
**次回開始番号**: TASK-0327

## 全体進捗

- [ ] Phase 1: producer 接続と実値化検証 — TASK-0326

## マイルストーン

- **M1: REQ-431 接続完結** (2026-09-08): 3 経路の減点後 transcriptionAccuracy が monitor へ報告され、adaptive gate が実値評価・実 round 学習に切り替わる（AC-RTPM-1〜7 全 Green・REQ-373 pin 第三引数化 green・mutation witness 実測済み）

---

## Phase 1: producer 接続と実値化検証

**期間**: 2026-09-07 - 2026-09-08
**目標**: `RealTimePerformanceMonitor.recordPipelineQuality` に optional 第 3 引数 `transcriptionAccuracy` を追加し（finite-or-null ingestion・private derivation）、MainPipeline / SimplePipeline / FrameworkIntegratedPipeline の品質集計 site で計算済みの同一 local を報告する — monitor call site での再計算・第二推定経路なし
**成果物**: src 4 file 変更（real-time-performance-monitor.ts +25・main-pipeline.ts +6・simple-pipeline.ts +6・framework-integrated-pipeline.ts +1・大半は field doc・adaptive-quality-gates.ts は変更なし）+ monitor 契約 7 構造 leg・3 経路減点 leg・gate 連結 leg・REQ-373 pin 第三引数化（test 追加 ~150 行程度）

### タスク一覧

- [ ] [TASK-0326: RTPM transcriptionAccuracy producer の 3 経路接続と実値化検証（AC-RTPM-1〜7）](TASK-0326.md) - 8h (TDD) 🔵

### 依存関係

```
（前提なし — REQ-430 実装 b8660230・本設計 PR #139 fbe97e05 は main 到達済み）
TASK-0326 →（将来の別 REQ）avgSceneQuality 正典 formula 裁決 — producer-less fail-closed の継承側
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 1件
- 🔵 **青信号**: 1件 (100%)
- 🟡 **黄信号**: 0件 (0%)
- 🔴 **赤信号**: 0件 (0%)

### 項目単位集計（TASK file のサマリー合算）

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装詳細・完了条件 | 14 | 0 | 0 | 14 |
| 単体テスト | 3 | 0 | 0 | 3 |
| 統合テスト | 3 | 0 | 0 | 3 |
| **合計** | **20** | **0** | **0** | **20** |

**品質評価**: 高品質（拡張形式・ingestion coercion・derivation gate・3 site の hoist 位置・REQ-373 pin の取り扱い・gate 側変更不要性まで設計正本（PR #139）が実在コード行番号に接地して裁決済みで、本分割はその実装への割り当てに過ぎない）

## クリティカルパス

```
TASK-0326
```

**クリティカルパス工数**: 8時間
**並行作業可能工数**: 0時間（単一 task）

## 外部入力（maintainer 依存 — born-DONE にしない範囲の明示）

なし — 実音声・whisper binary 等の外部 gate なし。減点 context は test で注入し（`endedAtDisclosedPlaceholder` が true を返す状態）、実推論を要しない。

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0326`
