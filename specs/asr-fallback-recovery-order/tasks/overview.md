# asr-fallback-recovery-order タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**プロジェクト期間**: 2026-09-07 - 2026-09-08（2日）
**推定工数**: 6時間
**総タスク数**: 1件

## 関連文書

- **設計文書**: [📐 architecture.md](../architecture.md)（Acceptance criteria: AC-D5-1〜05・すべて未達 `- [ ]`）
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)（機能1〜3・エラーハンドリングフロー）
- **分析記録**: [🧠 design-interview.md](../design-interview.md) A1〜A6
- **要件出典**: development_direction D-5（`.audit/development_direction.yml`）— REQ-430 / TC-423 への正典採番は requirements phase の残課題（A6）
- **参考要件**: [speech-to-visuals 要件定義書](../../speech-to-visuals/requirements.md) REQ-021 / REQ-040（error-recovery 基盤の既存要件）

## 背景

kairo-design（PR #128・2026-09-07 merge）が、development_direction D-5「実ASR失敗時のフォールバック順序（Whisper→Web Speech API→開示付きplaceholder）を error-recovery に接続して検証」の設計正本を確定した。現行 `runWhisperTranscription()`（transcriber.ts:123-168）の inline if/else は順序として正しく 4 leg で pin 済みだが、(1) trace・stats・`errorRecoveryEventBus` への接続がゼロ (2) whisper `transcribe()` が **throw** する経路の注入検証が存在しない (3) 実行順序の機械的 witness（`ChainOutcome.trace`）が無い、の 3 点がギャップである。本 overview はこの接続を実装するタスク分割である。設計の信頼性サマリーは architecture 🔵 14 / 🟡 2 / 🔴 0。後段の AX-3（品質集計の placeholder 減点）は本 feature が提供する `getRecoveryOutcome()` を消費する別 feature であり、本分割には含めない。

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 09-07 - 09-08 | chain 接続（trace・event・getter）と失敗注入検証（AC-D5-1〜05 完結） | 1 | 6h | [TASK-0325](#phase-1-chain-接続と失敗注入検証) |

## タスク番号管理

**使用済みタスク番号**: repo 全体で TASK-0001 〜 TASK-0324（2026-09-07 時点・TASK-0322 は specs/unreachable-ui-wire-or-retire/ で完了・TASK-0323/0324 は同 feature で未実施）
**本 feature 採番**: TASK-0325
**次回開始番号**: TASK-0326

## 全体進捗

- [ ] Phase 1: chain 接続と失敗注入検証 — TASK-0325

## マイルストーン

- **M1: D-5 接続完結** (2026-09-08): フォールバック順序が `RecoveryStrategyChain` step 列として単一ソース化され、trace・event・throw 注入・開示最終保証が test で立証（AC-D5-1〜05 全 Green・既存 4 leg 無修正 green 維持）

---

## Phase 1: chain 接続と失敗注入検証

**期間**: 2026-09-07 - 2026-09-08
**目標**: `TranscriptionPipeline` の ASR フォールバック順序を per-instance `RecoveryStrategyChain` の step 列（whisper-inference → web-speech-file（browser のみ登録）→ disclosed-placeholder）に置換し、外部契約不変のまま error-recovery 基盤（trace・stats・event bus）へ接続する
**成果物**: transcriber.ts 変更（buildRecoveryChain・isRealTranscriptionResult export・getRecoveryOutcome・+70 行程度）+ `tests/transcription/transcriber-recovery-chain.test.ts` 新規（~90 行・ギャップ分のみ）

### タスク一覧

- [ ] [TASK-0325: ASR フォールバック順序の RecoveryStrategyChain 接続と失敗注入検証（AC-D5-1〜05）](TASK-0325.md) - 6h (TDD) 🔵（budget 枯渇注入の具体機構のみ実装時判断）

### 依存関係

```
（前提なし — D-1 実装と D-5 設計は main 到達済み）
TASK-0325 →（後段 feature）AX-3: 品質集計の placeholder 減点 — getRecoveryOutcome() の消費側
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 1件
- 🔵 **青信号**: 1件 (100%)（タスク全体 🔵・項目単位で 🟡 0件 — budget 枯渇注入機構は実装時に 🔵 化する設計上の実装時判断）
- 🟡 **黄信号**: 0件 (0%)
- 🔴 **赤信号**: 0件 (0%)

### 項目単位集計（TASK file のサマリー合算）

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装詳細・完了条件 | 12 | 0 | 0 | 12 |
| 単体テスト | 6 | 0 | 0 | 6 |
| 統合テスト | 2 | 0 | 0 | 2 |
| **合計** | **20** | **0** | **0** | **20** |

**品質評価**: 高品質（step id・minConfidence=0 固定・budget 定数・開示最終保証・getter 仕様・test leg 構成まで設計正本（PR #128）が実在コード行番号に接地して確定済みで、本分割はその実装への割り当てに過ぎない）

## クリティカルパス

```
TASK-0325
```

**クリティカルパス工数**: 6時間
**並行作業可能工数**: 0時間（単一 task）

## 外部入力（maintainer 依存 — born-DONE にしない範囲の明示）

なし — whisper binary 等の外部 gate なし。engine はすべて test で mock し、実推論を要しない（既存 priority test と同一の mock 土台）。

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0325`
