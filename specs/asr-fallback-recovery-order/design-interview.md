# asr-fallback-recovery-order 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**分析実施**: step4 既存情報ベースの差分分析と自動統合（kairo-design）

## 分析目的

development_direction D-5（実ASR失敗時のフォールバック順序を error-recovery に接続して検証）を設計するにあたり、現行実装・既存 error-recovery 基盤・既存 test pin の実測を行い、接続単位と契約境界を確定した。

## 分析項目と判断

### A1: 接続単位 — RecoveryStrategyChain vs PipelineErrorRecoveryOrchestrator

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: D-5 の「error-recovery に接続」の接続先として chain と orchestrator の 2 候補が存在する。

**判断**: per-instance の `RecoveryStrategyChain` を `TranscriptionPipeline` 内に構築する。orchestrator 統合は範囲外。
**根拠**: `src/quality/pipeline-error-recovery-orchestrator.ts` は (a) `ErrorRecoveryMonitor`（60s interval timer・:97-100）と run tracker lifecycle を抱え browser bundle への timer 持ち込みと destroy 義務が生じる (b) `createStageErrorBoundary` の maxRetries retry（:224-231）は whisper 実推論を再実行し開示を遅らせる（推論失敗の次善は再試行ではなく下位 engine） (c) pipeline-orchestrator / main-pipeline が既に stage 単位の wrap を持ち二重 retry の风险。一方 chain は trace・stats・event bus emit（:277-283・468-503）を提供し依存は event bus + logger のみ。

**信頼性への影響**:

- 接続設計（SD1）の信頼性レベルを 🔴 → 🔵 に向上（両 module の実読み込みで責務境界を確認）

---

### A2: 現行順序の実測 — inline 実装と test pin のギャップ

**分析日時**: 2026-09-07
**カテゴリ**: データモデル／テスト
**背景**: 「順序が既に守られている」なら本 feature の実ギャップは何かを確定する必要があった。

**判断**: 順序の機能は正しく、4 本の routing test（tests/transcription/transcriber-placeholder-priority.test.ts・placeholder 結果注入 3 leg + Node 非 construct 1 leg）で pin 済み。ギャップは (1) `whisperTranscriber.transcribe()` が **throw** する注入 leg が存在しない（現行は transcriber.ts:164-167 の catch が吸収・trace 残らず） (2) 実行記録（どの step が何 ms で勝ったか・skip）が存在しない (3) error-recovery 基盤への event 送出がゼロ、の 3 点。
**根拠**: transcriber.ts:123-168 の読み込み・当該 test file 全 209 行の読み込み・`grep -rn "RecoveryStrategyChain" src/` の consumer が pipeline-error-recovery-orchestrator.ts と test のみであること。

**信頼性への影響**:

- 本 feature を「順序の修正」ではなく「接続と注入検証」と定義した根拠（AC-D5-2 の throw leg を「ギャップ分のみ」の新規 test とする設計）が 🔵 で確定

---

### A3: minConfidence = 0 固定の必然性（confidence 逆転 trap）

**分析日時**: 2026-09-07
**カテゴリ**: 技術選択
**背景**: chain は `stepResult.confidence >= minConfidence`（recovery-strategy-chain.ts:303）で勝利を判定する。confidence 閾値を品質管理に使えるか検討した。

**判断**: `minConfidence` は 0 固定・設定不可とする。
**根拠**: whisper 実推論の segments は confidence `undefined`（未測定・streaming-real-asr-inference AC-D6-4 と同一契約）のため、step confidence を canonical estimator `meanSegmentConfidence`（src/pipeline/quality-estimators.ts:100・未計測は 0 寄与）で derive すると実推論成功の step confidence は 0 になる。`minConfidence > 0` はこの実結果を reject して下位 engine（Web Speech・placeholder）へ逆転させる — REQ-393 が禁じる「測定を含まない条件での選択」の変種。engine 選択の権威は step 順序と real 判定述語のみが持つべきである。

**信頼性への影響**:

- 制約節（順序権威制約）と AC-D5-4 を 🔵 で追加。step confidence は telemetry 専用という位置づけを明確化

---

### A4: time budget の設定

**分析日時**: 2026-09-07
**カテゴリ**: パフォーマンス
**背景**: chain の default `timeBudgetMs = 30_000`（recovery-strategy-chain.ts:229）が実 whisper 推論と両立するか。

**判断**: `TRANSCRIPTION_RECOVERY_TIME_BUDGET_MS = 120_000`（transcriber.ts 内定数・設定不可）。かつ budget 枯渇で chain が失敗しても pipeline 側が `getFallbackSegments()` を返す二重保証（SD4）を設ける。
**根拠**: whisper.cpp base model の CPU 推論 real-time factor は 1〜2x とされる経験値があり（🟡 実測ではなく経験則）、低速環境では 11s 音声でも 30s 超があり得る。budget 枯渇で optional step が skip（:244-255）された場合でも開示が欠落しないよう、開示の最終保証は chain の外に置く。

**信頼性への影響**:

- budget 値そのものは 🟡（経験則）。ただし開示保証の二重化により値が外れても安全性に影響しない設計とした

---

### A5: TranscriptionResult 形状不変と observability の出口

**分析日時**: 2026-09-07
**カテゴリ**: データモデル
**背景**: trace・outcome を結果型に乗せるか、別経路で公開するか。

**判断**: `TranscriptionResult` への field 追加はしない。`TranscriptionPipeline` に public getter `getRecoveryOutcome(): ChainOutcome | null`（直近 1 件）を設ける。
**根拠**: barrel（src/transcription/index.ts）経由で 10 ファイル超の test が結果形状に依存し、field 追加は広範な pin 更新を誘発する（重複テスト更新は direction の anti-pattern）。AX-3（品質集計の placeholder 減点）は `fallbackUsed` / `winningStepId` を getter 経由で消費すれば足り、累積 stats は chain の `getStats()` が既に持つ。

**信頼性への影響**:

- 外部契約不変（SD5）を 🔵 で確定。AX-3 への接続点供給という後段価値を明記

---

### A6: 要件採番の未正典化

**分析日時**: 2026-09-07
**カテゴリ**: その他
**背景**: repo の設計は正典 REQ/TC に紐づくのが慣例（streaming-real-asr-inference → REQ-424/TC-408、real-audio-e2e-regression → REQ-422/423/TC-406-407）。

**判断**: 本設計の AC は development_direction D-5 acceptance 文を直接出典とし、REQ-430 / TC-423（次番・正典帯）への採番は requirements phase の後続作业として残す。
**根拠**: 現時点で D-5 接続を要件化する REQ は存在しない（REQ-021/REQ-040 は error-recovery 基盤自体の要件でフォールバック順序の接続・検証は含まない）。requirements.md への追記は行番号 anchor を持つ guard 群の再指向を伴う重作業であり、design run の範囲を超える。

**信頼性への影響**:

- AC の出典は direction 文（auto-generated・日付入り）で 🔵 だが、正典 REQ への恒久紐づけは未達であることを本記録に明示

---

## 分析結果サマリー

### 確認できた事項

- フォールバック順序（Whisper→Web Speech→開示 placeholder）は現行実装で機能し 4 leg で pin 済み（A2）
- `RecoveryStrategyChain` は trace・stats・event emit を持ち、`undefined` return 失敗 model が現行判定と同型（A1）
- `meanSegmentConfidence`（REQ-393 canonical estimator）が step confidence の単一 derive 源として利用可能（A3）
- 全 src 変更は transcriber.ts 1 file に集約可能・新規依存ゼロ（A1・A5）

### 設計方針の決定事項

- 接続単位 = per-instance `RecoveryStrategyChain`（orchestrator は除外）(A1)
- step 構成 = whisper-inference（必須）/ web-speech-file（browser のみ登録・optional）/ disclosed-placeholder（必須）(A2)
- `minConfidence = 0` 固定・confidence は telemetry 専用 (A3)
- budget 120s 定数 + pipeline 側開示の二重保証 (A4)
- `TranscriptionResult` 形状不変・`getRecoveryOutcome()` 新設 (A5)

### 残課題

- REQ-430 / TC-423 への正典採番（requirements phase・guard 再指向を伴う）(A6)
- pipeline 層（pipeline-orchestrator / main-pipeline）での `PipelineErrorRecoveryOrchestrator.executeStage` 統合 — 本 feature の chain 接続と二重 retry にならない境界設計が前提 (A1)
- AX-3（品質集計の placeholder 減点）— `getRecoveryOutcome()` の消費側として後段 feature 化 (A5)
- `getStats()` の累積観測を monitoring/UI に露出する価値の実測評価（現状 consumer なし）(A5)
- step 2（web-speech-file）の confidence が `FINAL_NO_CONFIDENCE_STANDIN = 0.5`（REQ-393 (b)）を含む際の telemetry 解釈の整備

### 信頼性レベル分布

**分析前**:

- 🔵 青信号: 0
- 🟡 黄信号: 0
- 🔴 赤信号: 3（接続単位・budget・observability 出口の未確定 — 分析対象 A1/A4/A5 に対応）

**分析後**（A1〜A6 の 6 項目）:

- 🔵 青信号: 5 (+5)
- 🟡 黄信号: 1（A4 budget 値の経験則根拠）
- 🔴 赤信号: 0 (−3)

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義**: [../speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)（REQ-021/REQ-040・参考）
