# real-audio-e2e-regression コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-03（kairo-tasks step3 生成）
**対象**: REQ-422（real-audio E2E regression・D-4）/ REQ-423（評価用音声コーパス・D-5）— Phase 194・提案ベース未実施

実装 agent が design docs（[architecture.md](architecture.md) / [dataflow.md](dataflow.md) / [design-interview.md](design-interview.md)）を読む前に把握すべき文脈。

## 技術スタック

- TypeScript 5.x strict / Node ESM (`"type": "module"`) / tsx 実行の script 群
- テスト: Jest（`jest.config.cjs`）+ React Testing Library
- 音声認識: `whisper-node` 経由 whisper.cpp — **gate 付き**（binary `node_modules/whisper-node/lib/whisper.cpp/main` + model `STV_WHISPER_MODEL` または `models/ggml-<model>.bin` が存在する時のみ実推論。無ければ placeholder 経路）
- 詳細は AGENTS.md（リポジトリルート）

## 開発ルール・コマンド

- 単体テスト: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs <path>`（NODE_OPTIONS 必須・flag は `--testPathPatterns`）
- 型チェック: `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`（tests は `-p tsconfig.test.json`）
- specs 整合: `npm run specs:anchor:check` / `npm run specs:mirror:check` / `npm run spine:validate`（specs/** を触ったら必ず実行 — commit 前の hard gate）
- worktree で jest を走らせる前に node_modules setup 要（親 checkout から `cp -al` + `npm install --no-save github:nobu007/stv-core#v1.0.7`）
- ESM では `jest.mock` が no-op — `unstable_mockModule` + dynamic import パターン（詳細は `tests/` 既存 helper 参照）

## 関連実装（本 feature の前提）

- **D-1**（e5853217・main 済み）: `src/transcription/whisper-transcriber.ts` — gated real whisper.cpp 推論。`inferenceRan` フラグ・`stageAudioForWhisper`（resampling 無しで生 bytes を渡す → corpus は WAV 16kHz mono に限定する根拠）・`resolveWhisperInferencePaths`
- **D-2**（同上）: `scripts/measure-transcription-accuracy.ts` — pure core として `normalizeText` / `tokenize` / `charSequence` / `levenshtein` / `computeWer` / `computeCer` / `discoverCorpus` / `summarize` / `FileMeasurement` / `parseAccuracyArgv` を export。**WER/CER・集計はここに単一ソース化済み**（第二実装の作成は duplicate-formula 違反・TC-406-03）
- **D-3**（dda5c055・main 済み）: `scripts/measure-diagram-detection-accuracy.ts` + QUALITY_METRICS §8.5 — 測定器 section の前例（§8.6 はこれと同型で作る）
- **要件化の由来**: `specs/speech-to-visuals/tasks/TASK-0313.md`（D-3 実装と同時に D-4/D-5 を REQ-422/423・TC-406/407 として要件化のみ行い実装を本 feature に委譲）

## 設計文書

- [architecture.md](architecture.md) — コンポーネント構成・設計決定 D1〜D7・Acceptance criteria（AC-D4-1〜3 / AC-D5-1〜2）
- [dataflow.md](dataflow.md) — 測定 sequence・fail-loud エラーフロー
- [design-interview.md](design-interview.md) — 分析記録・残課題（jfk ライセンス確定・maintainer 録音）
- 正本: [../speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md) REQ-422/423・[../speech-to-visuals/acceptance-criteria.md](../speech-to-visuals/acceptance-criteria.md) TC-406-01〜03 / TC-407-01〜02（すべて `- [ ]`）

## 注意事項

1. **fail-loud 契約**: placeholder 経路・合成音・gate 閉での run は「測定ではない」— green を出さず非 zero exit（D-2 exit 1・D-3 `summarizeDetection([])` throw と同一契約）。現行 `qualityScore >= 70` gate はこの契約で廃止する。
2. **測定証跡なしの数値更新は禁止**: QUALITY_METRICS §3.1 への実測値記載は committed artifact（`docs/architecture/measurements/transcription-e2e-v1.json`）との同一 PR でのみ行う。
3. **単位は ms**: `durationMs` / `processingTime` は ms。RTF = transcription 段 processingTime ÷ header 由来音声長（無次元）。doc と test で単位を pin すること（×1000 bug class）。
4. **`public/srt/jfk.srt` は参照文字起こしに使わない**（過去 ASR 由来の循環リスク — 設計決定 D6）。jfk 参照は public domain の演説本文から、ja 参照は読み上げ原稿から。
5. **ja 実音声は maintainer 録音が前提**（AI が合成音で代用すると測定が偽物になる）。録音規格: WAV PCM 16kHz mono・60 秒以内・原稿 = 旧 `public/audio/test-audio.txt`。
6. **whisper binary / ggml model は repo に commit しない**。取得手順は §8.6 と CORPUS.md に手順として記載（設計決定 D7）。
7. **npm scripts 定義は変更しない**（`pipeline:test:audio` の指す先は `scripts/test-complete-audio-pipeline.ts` のまま）。`public/jfk.wav` 本体は他 script が参照するため残置し corpus 側へ copy。
8. **TASK-*.md は spine manifest の children/references に登録しない**（anchor block のみ正規形で挿入）。
