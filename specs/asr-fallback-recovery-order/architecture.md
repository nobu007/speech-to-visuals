# asr-fallback-recovery-order アーキテクチャ設計


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07（kairo-design・D-5 [fix/A]）
**要件出典**: [development_direction D-5](../../../../speech-to-visuals/.audit/development_direction.yml)「実ASR失敗時のフォールバック順序（Whisper→Web Speech API→開示付きplaceholder）を error-recovery に接続して検証」・AX-3 系（REQ-430 / TC-423 の正典採番は requirements phase の残課題 — 本設計の AC は D-5 acceptance 文を直接出典とする）
**分析記録**: [design-interview.md](design-interview.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・既存設計文書・既存実装を参考にした確実な設計
- 🟡 **黄信号**: 要件定義書・既存設計文書・既存実装から妥当な推測による設計
- 🔴 **赤信号**: 参照資料にない自動推定による設計

---

## システム概要 🔵

**信頼性**: 🔵 *development_direction D-5 acceptance 文・transcriber.ts:123-168（現行 inline 優先 routing）・tests/transcription/transcriber-placeholder-priority.test.ts（4 leg pin）より*

`TranscriptionPipeline`（src/transcription/transcriber.ts）の ASR フォールバック順序 **Whisper 実推論 → Web Speech API（browser）→ 開示付き placeholder** は、D-1（e5853217）と placeholder-priority 修正の結果として**機能としては正しく動作し、4 本の routing test で pin 済み**である。しかし実装は `runWhisperTranscription()` 内の inline if/else に埋め込まれており、repo が持つ error-recovery 基盤（Phase 57 群・`src/quality/recovery-strategy-chain.ts` ほか）に**一切接続されていない**:

1. **telemetry 欠如**: どの engine が勝ったか・何 ms 掛かったか・fallback が使われたかが `logger.warn` のみ。`RecoveryStrategyChain` が持つ trace / stats / `errorRecoveryEventBus`（`recovery:attempt` / `recovery:success` / `recovery:failure`）に何も流れない。
2. **throw 注入未検証**: 既存 4 leg は engine の**結果 object**（placeholder result / success:false）を注入するもので、`whisperTranscriber.transcribe()` が **throw する**経路（staging・fs・backend 読み込み失敗）の順序保持は検証されていない（現行 catch leg transcriber.ts:164-167 が吸収）。
3. **順序の機械的検証不能**: 「順序が守られている」ことの根拠が mocking spy の call count のみで、step 列・skip・budget を含む実行記録（ChainOutcome.trace）が存在しない。

本設計はこの順序を `RecoveryStrategyChain` の step 列として表現し直し、**外部契約（`transcribe()` signature・`TranscriptionResult` 型・既存 4 leg の挙動）を一切変えずに** error-recovery 基盤への接続（trace・stats・event）と失敗注入検証を成立させる。AX-3（品質集計の placeholder 減点）は本 feature の成果物（`getRecoveryOutcome()`）を消費する後段 feature であり、本 feature では接続点の提供までを範囲とする。

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *src/quality/recovery-strategy-chain.ts（ChainBuilder・ChainStep・ChainOutcome）・src/quality/pipeline-error-recovery-orchestrator.ts の責務分割より*

- **パターン**: 既存 error-recovery 基盤への委譲（strategy chain）。`TranscriptionPipeline` が per-instance の `RecoveryStrategyChain` を構築し、`runWhisperTranscription()` の engine 選択を chain 実行に置換する。新規 module・新規依存はゼロ（`src/quality/recovery-strategy-chain.ts` は repo 内既存）。
- **選択理由**: `ChainStep.execute()` が `undefined` return を失敗信号とする逐次実行 model は、現行の「engine 結果が real 判定を満たさなければ次へ」semantics と同型。step 列 = フォールバック順序の**単一の宣言的表現**になり、trace が順序の機械検証 witness になる。

## コンポーネント構成

### TranscriptionPipeline（変更・唯一の src 変更対象）🔵

**信頼性**: 🔵 *transcriber.ts 現行実装・recovery-strategy-chain.ts public API より*

```
TranscriptionPipeline
├── buildRecoveryChain(): StrategyChain          # 新設・private
│   ├── step 1 "whisper-inference"     (必須)    # whisperTranscriber.transcribe → real 判定
│   ├── step 2 "web-speech-file"       (browser 環境のみ登録・optional)
│   └── step 3 "disclosed-placeholder" (必須)    # 常に成功・fallbackUsed:true・confidence 0
├── runWhisperTranscription()                     # chain.execute('transcription', …) へ置換
│   └── outcome.success === false の場合も getFallbackSegments() を返す（開示の最終保証）
├── getRecoveryOutcome(): ChainOutcome | null     # 新設・public readonly（直近 transcribe の outcome）
└── （既存）transcribe() / updateConfig() / getFallbackSegments() — 不変
```

- step 1（`whisper-inference`）: 現行 Priority 1（transcriber.ts:135-148）と同一判定 — export した述語 `isRealTranscriptionResult(result)`（`success === true && segments.length > 0 && placeholder !== true`・単一ソース化）を満たすとき `{ result: { segments }, fallbackUsed: false, confidence: meanSegmentConfidence(segments) }`、満たさないとき `undefined`。throw は chain が catch して failure step として trace する（recovery-strategy-chain.ts:336-352）。
- step 2（`web-speech-file`）: 現行 Priority 2（transcriber.ts:150-158）と同一 — browser 環境かつ `blob:`/`File` 入力のとき `browserTranscriber.transcribeAudioFile(File)`。**Node 環境では step を登録しない**（既存 pin「browser engine を construct しない」を維持）。`optional: true`（budget 枯渇時に skip 可能 — 最終開示は step 3 が担うため安全）。
- step 3（`disclosed-placeholder`）: 現行 Priority 3（transcriber.ts:160-162）— `getFallbackSegments()`（confidence 0・開示文）を `{ fallbackUsed: true, confidence: 0 }` で返す。`optional: false`。
- step confidence はすべて `meanSegmentConfidence`（src/pipeline/quality-estimators.ts:100・REQ-393 canonical estimator・未計測 segment は 0 寄与の fail-closed）から derive し、新規の凍結小数を設けない。

### 既存 error-recovery 基盤（変更なし・消費側）🔵

**信頼性**: 🔵 *recovery-strategy-chain.ts 実装（eventRecoverySuccessNotification :468・eventRecoveryFailureNotification :487・recordStats :430）より*

- `RecoveryStrategyChain.execute()` は step ごとに `recovery:attempt`、成否で `recovery:success` / `recovery:failure` を `errorRecoveryEventBus` へ emit する（stage: `'transcription'`）。本設計はこれを**無償で得る** — event bus の consumer（WebSocket 配信等）は追加不要・既存のまま。
- per-instance chain（`new RecoveryStrategyChain()`）とし `globalRecoveryChain` singleton は使わない（test 間 stats 污染の回避。event は singleton bus へ流れるため observability は失われない）。

### 除外: PipelineErrorRecoveryOrchestrator 統合 🔵

**信頼性**: 🔵 *pipeline-error-recovery-orchestrator.ts（ErrorRecoveryMonitor interval 60s :97-100・createStageErrorBoundary retry :224-231）・pipeline-orchestrator.ts の既存 stage wrap より*

`PipelineErrorRecoveryOrchestrator.executeStage('transcription', …)` への統合は本 feature の範囲外とする。理由: (a) orchestrator は `ErrorRecoveryMonitor`（60s interval timer）と run tracker lifecycle を抱え、browser bundle への timer 持ち込みと destroy 義務が生じる (b) `createStageErrorBoundary` の maxRetries retry は whisper 実推論を再実行し開示を遅らせるだけ（推論失敗の次善は再試行ではなく下位 engine） (c) pipeline-orchestrator / main-pipeline が既に stage 単位の wrap を持つため二重 retry の风险。pipeline 層での統合は design-interview 残課題に記録する。

## システム構成図

```mermaid
graph TB
    subgraph TranscriptionPipeline
        TP[transcribe / runWhisperTranscription]
        CH[RecoveryStrategyChain 'transcription']
        TP -->|"chain.execute()"| CH
    end

    subgraph chain steps（= フォールバック順序）
        S1["1. whisper-inference（必須）"]
        S2["2. web-speech-file（browser のみ登録・optional）"]
        S3["3. disclosed-placeholder（必須）"]
        S1 --> S2 --> S3
    end
    CH --> S1
    S1 -->|real 判定 NG / throw| S2
    S2 -->|失敗 / skip| S3

    EB[errorRecoveryEventBus]
    CH -->|"recovery:attempt / success / failure"| EB
    GO[getRecoveryOutcome - 直近 ChainOutcome]

    S1 --> WHISPER[WhisperTranscriber.transcribe]
    S2 --> WS[BrowserTranscriber.transcribeAudioFile]
    S3 --> FP[getFallbackSegments - confidence 0]
```

**信頼性**: 🔵 *現行 transcriber.ts の呼び出し関係・recovery-strategy-chain.ts の実行 model より*

## ディレクトリ構造 🔵

**信頼性**: 🔵 *既存プロジェクト構造より（本 feature の変更対象は src 1 file + test 1 file のみ）*

```
src/transcription/transcriber.ts        # 変更: buildRecoveryChain・isRealTranscriptionResult export・getRecoveryOutcome
tests/transcription/
├── transcriber-placeholder-priority.test.ts   # 既存 4 leg・無変更 green を維持（外部契約 pin）
└── transcriber-recovery-chain.test.ts         # 新規: 失敗注入・trace 順序・event witness（ギャップ分のみ）
```

## 非機能要件の実現方法

### パフォーマンス 🟡

**信頼性**: 🟡 *whisper.cpp base model の CPU 推論 real-time factor は一般に 1〜2x とされる経験値からの推測・実測 jfk.wav（11s）の所要は環境依存*

- **time budget**: chain default 30s は実 whisper 推論を切り捨て得るため、`TRANSCRIPTION_RECOVERY_TIME_BUDGET_MS = 120_000`（transcriber.ts 内定数）を指定する。budget 枯渇で step 3 が実行されなくても pipeline 側の開示保証（SD4）が発動し、開示なしの失敗は構造的に起きない。
- **追跡**: `ChainOutcome.totalDurationMs`・per-step `durationMs` が実測を与え、AX-3 の品質集計に再利用できる。

### セキュリティ・堅牢性 🔵

**信頼性**: 🔵 *types.ts:29-31（placeholder / fallback flag 契約）・REQ-391（placeholder confidence 単一ソース）・D-5 acceptance 文（confidence 0 開示）より*

- **開示の最終保証**: chain outcome が `success: false`（budget 枯渇・全 step 失敗）でも `runWhisperTranscription()` は `getFallbackSegments()`（confidence 0）を返す。開示を chain の健全性に命運させない。
- **confidence 契約の層分離維持**: engine 内部 placeholder（`PLACEHOLDER_SEGMENT_CONFIDENCE = 0.95`・whisper-transcriber.ts:36）と pipeline 最終開示 placeholder（confidence 0）の 2 層構造は現行のまま。step confidence は telemetry 専用で、公開する測定値ではない。

### スケーラビリティ 🟡

**信頼性**: 🟡 *recovery-strategy-chain.ts getStats（:377-409）の既存機能からの推測*

- per-instance stats（`getStats('transcription-recovery')`）により「どの step が実際に勝っているか」の累積観測が可能。engine 選択への feedback（例: whisper gate が閉じている環境の検知）は将来課題。

## 技術的制約

### 契約不変制約 🔵

**信頼性**: 🔵 *tests/transcription/transcriber-placeholder-priority.test.ts（4 leg）・src/transcription/index.ts barrel・10 ファイル超の test 依存（streaming-real-asr-inference note.md 事項 8 と同根）より*

- `transcribe(audioPath)` signature・`TranscriptionResult` 型・`result.fallback` / `result.success` semantics・`updateConfig()` は不変。`TranscriptionResult` への field 追加はしない（形状 pin を持つ既存 test 群を壊さない）。
- 既存 4 leg priority test は**無修正で green を維持**することが完了条件の一部。

### 順序権威制約（minConfidence = 0 固定）🔵

**信頼性**: 🔵 *recovery-strategy-chain.ts:303（`confidence >= fullConfig.minConfidence` で勝利判定）・whisper 実推論 segments の confidence undefined 契約（streaming-real-asr-inference AC-D6-4 と同一根拠）より*

- chain の `minConfidence` は **0 固定・設定不可**とする。whisper 実推論の segments は confidence `undefined`（未測定）のため `meanSegmentConfidence` は 0 を返し、`minConfidence > 0` は**実推論成功を reject して下位 engine へ逆転させる**（REQ-393 が禁じる「測定を含まない条件での選択」の変種）。engine 選択の権威は chain の step 順序と real 判定述語のみが持つ。

### 規模制約 🔵

**信頼性**: 🔵 *development_direction AX-4（320 files / 90,000 行・CI-fatal）より*

- src 変更は `transcriber.ts` 1 file のみ（新規 src file なし・見立て +70 行程度）。test 1 file 新規（~90 行）。`npm run audit:code-size` green を維持する。

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **分析記録**: [design-interview.md](design-interview.md)
- **要件出典**: development_direction D-5（`.audit/development_direction.yml`・hub 生成）・[speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-021/REQ-040（error-recovery 基盤の既存要件・参考）

## Acceptance criteria

**信頼性**: 🔵 *development_direction D-5 acceptance 文（「推論失敗を注入したテストでフォールバック順序が守られ、最終placeholderは confidence 0 で開示されることが既存テストスイートで検証される（新規テストはこのギャップ分のみ）」）との対応関係より*

- [x] **AC-D5-1**（D-5）: フォールバック順序が `RecoveryStrategyChain` の step 列（whisper-inference → web-speech-file → disclosed-placeholder・browser 環境のみ step 2 注册）として単一ソースで表現され、実行順序が `ChainOutcome.trace` で機械検証可能であること。検証（履行時）: trace の attempted step id 列を環境別に pin する test が RED→GREEN
- [x] **AC-D5-2**（D-5）: whisper 推論の**throw 注入**と placeholder 結果注入の両方で次 step へ移行すること、Node 環境では web-speech step が登録されず browser engine が construct されないこと。検証（履行時）: throw 注入 leg（既存 4 leg に存在しないギャップ分）が RED→GREEN・既存「browser engine 非 construct」leg が無変更 green
- [x] **AC-D5-3**（D-5）: 全 engine 失敗時に terminal 開示 step が勝利し（`winningStepId === 'disclosed-placeholder'`・`fallbackUsed === true`・`confidence === 0`）、結果が `fallback: true`・`success: false`・`segments[0].confidence === 0` で開示されること。chain が budget 枯渇等で失敗しても pipeline 側の開示 placeholder が返ること。検証（履行時）: 全滅注入 leg + 開示最終保証 leg が RED→GREEN
- [x] **AC-D5-4**（D-5・順序権威）: `minConfidence` が 0 固定であること — 実測 confidence を持たない（undefined）whisper 実推論結果が confidence 値によって下位 engine に逆転されないこと。検証（履行時）: whisper real（confidence undefined → step confidence 0）で whisper が勝つことを pin する test が RED→GREEN
- [x] **AC-D5-5**（D-5・error-recovery 接続）: step 実行が `errorRecoveryEventBus` へ `stage: 'transcription'` で `recovery:attempt` / `recovery:success` / `recovery:failure` を emit し、`getRecoveryOutcome()` が直近 `transcribe()` の `ChainOutcome` を返すこと。検証（履行時）: event 順序 witness + getter pin の test が RED→GREEN

## 信頼性レベルサマリー

- 🔵 青信号: 14件 (88%)
- 🟡 黄信号: 2件 (12%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質（対象が既存実装・既存 error-recovery 基盤・既存 test pin に強く束ねられており、新規推定は budget 根拠と将来 stats 利用の 2 点のみ）
