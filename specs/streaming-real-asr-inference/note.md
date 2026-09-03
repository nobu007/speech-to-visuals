# streaming-real-asr-inference コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-04（kairo-tasks step3 生成）
**対象**: REQ-424（streaming file 経路の実ASR化と偽成功の開示・D-6）— Phase 195・提案ベース未実施

実装 agent が design docs（[architecture.md](architecture.md) / [dataflow.md](dataflow.md) / [design-interview.md](design-interview.md)）を読む前に把握すべき文脈。

## 技術スタック

- TypeScript 5.x strict / Node ESM (`"type": "module"`)
- テスト: Jest（`jest.config.cjs`）+ React Testing Library（jsdom）
- 音声認識: browser = Web Speech API（`SpeechRecognition`）/ Node = `whisper-node` 経由 whisper.cpp（D-1 gate 付き）
- 詳細は AGENTS.md（リポジトリルート）

## 開発ルール・コマンド

- 単体テスト: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs <path>`（NODE_OPTIONS 必須・flag は `--testPathPatterns`）
- 型チェック: `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`（tests は `-p tsconfig.test.json`）
- specs 整合: `npm run specs:anchor:check` / `npm run specs:mirror:check` / `npm run spine:validate`（specs/** を触ったら必ず実行 — commit 前の hard gate）
- worktree で jest を走らせる前に node_modules setup 要（親 checkout から `cp -al` + `npm install --no-save github:nobu007/stv-core#v1.0.7`）
- ESM では `jest.mock` が no-op — `unstable_mockModule` + dynamic import パターン（詳細は `tests/` 既存 helper 参照）

## 関連実装（本 feature の前提）

- **D-1**（e5853217・main 済み）: `src/transcription/whisper-transcriber.ts` — gated real whisper.cpp 推論。`whisperTranscriber` singleton（:704）の `transcribe()`（:395）が gate 解決（`resolveWhisperInferencePaths` :148）・lazy backend・staging・`convertWhisperRows`（:108・confidence は undefined 契約）まで包括し、`placeholder: !inferenceRan`（:447）を返す。**streaming 側に gate/backend/変換を再実装しない — 丸ごと委譲のみ**
- **placeholder flag 契約**（D-1 導入）: `src/transcription/types.ts:29` — 実測 `false` / 開示 `true`。`TranscriptionPipeline`（transcriber.ts:138-145）は `placeholder !== true` で成功判定する優先 routing の前例
- **Web Speech file mechanism の現行持ち主**: `BrowserTranscriber.transcribeWithWebSpeechAPI`（browser-transcriber.ts:324-391・private）— engine 抽出の素材。`FINAL_NO_CONFIDENCE_STANDIN = 0.5`（:31・REQ-393）
- **偽成功開示の前例**: README「音声認識の現状」+ server 経路の D-1 開示 — streaming も同一の開示方針
- **D-4/D-5**（PR #100・open）: `specs/real-audio-e2e-regression/` — batch server 経路の測定が対象で streaming 経路に触れない。タスク番号 TASK-0314〜0317 を使用済み（本 feature は TASK-0318 から採番）

## 設計文書

- [architecture.md](architecture.md) — コンポーネント構成・設計決定 SD1〜SD7・Acceptance criteria（AC-D6-1〜04）
- [dataflow.md](dataflow.md) — 3 経路の入出力形状・エラーフロー・UI 開示データ
- [design-interview.md](design-interview.md) — 分析記録・残課題（A7 BrowserTranscriber mock 開示・A9 REQ-091 alert wiring・browser 経路 WER 実測）
- 正本: [../speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md) REQ-424・[../speech-to-visuals/acceptance-criteria.md](../speech-to-visuals/acceptance-criteria.md) TC-408-01〜04（すべて `- [ ]`）

## 注意事項

1. **第二実装禁止（duplicate-formula class）**: Web Speech file mechanism（File 再生 + recognition）は `web-speech-file-transcription.ts` に単一ソース化し、`BrowserTranscriber` と `StreamingTranscriber` の両方が消費する。gate 解決・backend 読み込み・row 変換も whisper-transcriber 側の単一ソースに全委譲（SD1・TC-408-02）
2. **`FINAL_NO_CONFIDENCE_STANDIN` の定義位置は動かさない**: census guard（`tests/guards/measurement-statement-literal-census.test.ts` / `score-ladder-census.test.ts`）が `src/transcription/browser-transcriber.ts::FINAL_NO_CONFIDENCE_STANDIN` を pin している。engine は同定数を browser-transcriber.ts から import する（循環 import になるが、engine が定数を callback 内でのみ参照する限り module 評価時 TDZ は発生しない）
3. **合成 stagger 禁止（SD3）**: `setTimeout` による進捗演出・実結果の chunk 長分割は偽 progress。`onProgress` / `onSegment` は Web Speech final result 到達・Node 推論完了という実イベントでのみ発火
4. **未測定 ≠ 低測定値（SD4）**: whisper 由来 segments の `confidence` は `undefined`（未測定）。現行 filter の `?? Number.NaN`（streaming-transcriber.ts:178-179）は未測定を常に reject するため実経路が全滅する — undefined は通過、数値のみ `minConfidence` と比較する書き換えが必須。`StreamingQualityMonitor.evaluateChunk` は実測 confidence を持つ chunk のみで呼ぶ（非有限→0 変換で reject 計上する捏造の廃止）
5. **per-chunk 分割推論はしない（SD2）**: whisper-node backend は呼び出しごとに model を読み込む per-call API。Node 経路は単発 whole-file 推論・進捗は完了時 1 回のみ。`chunkSizeMs` / `overlapMs` は API 互換で残すが実推論に使う経路なしと doc 開示
6. **互換性の不変部**: `transcribeStream(audioFile, onProgress?, onSegment?)` signature・`StreamingProgress` 型・constructor 検証（chunkSizeMs/overlapMs/minConfidence 境界・updateConfig）・`startLiveTranscription` / `stopLiveTranscription` / `destroy`・REQ-091 API（`onQualityAlert` / `getQualitySummary`）は不変。live mic 経路は既に実 Web Speech なので対象外
7. **REQ-091 alert UI wiring は本 feature の対象外**: `onQualityAlert` / `getQualitySummary` の StreamingProcessor での消費は残課題（design-interview A9 — 実測値が monitor に流れるようになった段階で wiring する順序関係）
8. **`src/transcription/index.ts` barrel と広範な test 依存**: `transcribeStream` / `validateStreamingSupport` は barrel export され、10 ファイル超の test が現行挙動を pin している（TASK-0319 の影響範囲リスト参照）。書き換え時は該当 test を一括確認
9. **TASK-*.md は spine manifest の children/references に登録しない**（anchor block のみ正規形で挿入）
