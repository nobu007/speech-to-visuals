# streaming-real-asr-inference 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-04
**関連要件定義**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-424（Phase 195・提案ベース `- [ ]`）
**関連受け入れ基準**: [speech-to-visuals 受け入れ基準](../speech-to-visuals/acceptance-criteria.md) TC-408-01〜04（未実施）
**親設計**: [architecture.md](architecture.md)

**【信頼性レベル凡例】**: 🔵 青信号（既存実装・文書に基づく確実な分析）/ 🟡 黄信号（妥当な推測）/ 🔴 赤信号（参照資料にない自動推定）

---

本記録は kairo-design の分析工程（対象確定 → 実装調査 → 委譲先確認 → 重複確認 → 残課題棚卸し）を設計判断の根拠ごとに残すものである。

## A1: 対象候補の調査と選定 🔵

**信頼性**: 🔵 *AI_HUB_DEVELOPMENT_DIRECTION（mission 文「streaming-transcriber も chunk モック」・D-1〜D-5 の完了状況）と git log / PR 状況の実測より*

方向入力 D-1〜D-5 の状況:

| 項目 | 状況 | 根拠 |
|---|---|---|
| D-1 gated real whisper.cpp 推論 | main 済み | PR #96（REQ-391・whisper-transcriber.ts gate + lazy backend + 開示 placeholder） |
| D-2 WER/CER harness | main 済み | PR #96（scripts/measure-transcription-accuracy.ts・placeholder run は exit 1） |
| D-3 検出精度実測化 | main 済み | PR #99（QUALITY_METRICS §3.2 実測 84.9% へ置換） |
| D-4 real-audio E2E regression | PR #100 で設計・タスク化・TASK-0314 実装済み（open） | specs/real-audio-e2e-regression/（REQ-422・TC-406） |
| D-5 評価コーパス | PR #100 で設計・タスク化（TASK-0315〜0317 残） | 同上（REQ-423・TC-407） |

→ D-4/D-5 は進行中の正本があるため再設計対象外。方向文 mission が「入力段は whisper 実測・streaming-transcriber も chunk モック」と残る未接続経路を自認しており、**streaming file 経路の実ASR化**を次対象として選定した（D-6 と位置づける）。

## A2: 現行実装の実測 — streaming file 経路はシミュレーション 🔵

**信頼性**: 🔵 *src/transcription/streaming-transcriber.ts の直接読みより*

- `transcribeStream`（:147）は `getAudioDuration`（browser `Audio` 要素）→ `createAudioChunks`（秒・`chunkSize - overlap` 刻み）→ chunk ごと `processAudioChunk` のループである。
- `processAudioChunk`（:418）は `// Process chunk (simulate for now)`（:168 を含む comment 群）のとおり実ASRを呼ばず、固定文 `Processed segment ${i+1} from chunk ${start}-${end}s`（:441）と `PLACEHOLDER_CHUNK_CONFIDENCE`（:25・0.75）を返す。10x realtime の `setTimeout`（:224）で時間経過を演出する。
- 結果（:235-246）は `success: true` で `placeholder` flag を持たない。`types.ts:29` の placeholder 契約（D-1 導入）から見ると未開示の偽成功である。
- confidence filter（:178-179）は `?? Number.NaN` で undefined を常に閾値未満扱い（未測定 = reject）。
- `evaluateChunk`（:187-192）へ chunk 平均を流し、monitor 側は非有限値を 0 に変換（streaming-quality-monitor.ts:131）して reject 計上する。
- constructor（:111）と `validateStreamingSupport`（:632-634）は bare `window` 参照 — Node では ReferenceError で構築不能。

## A3: 生産 consumer の実測 🔵

**信頼性**: 🔵 *src/components/StreamingProcessor.tsx と src/pages/Index.tsx の直接読みより*

- `StreamingProcessor.tsx:116` が `new StreamingTranscriber({...})`（`model:'base'` / `chunkSizeMs:3000` / `overlapMs:500` / `minConfidence:0.7` / `enableLiveUpdate:true`）、:207 が `transcribeStream(file, onProgress, onSegment)` を呼ぶ。
- `onSegment` は `processSegmentForDiagram`（scene 生成）へ接続 — **固定文から図解 SceneGraph が作られている**。
- Index.tsx は `useStreamingMode`（default false）の opt-in モード（:23, :175-187 のトグル、:202-210 の条件 render）で、本番 UI の一部として露出している。
- `onQualityAlert` / `getQualitySummary` / `destroy` は未配線（REQ-091 の user-warning leg が未 wiring — A9 残課題）。

## A4: 実委譲先の実在確認 🔵

**信頼性**: 🔵 *browser-transcriber.ts / whisper-transcriber.ts の直接読みより*

- **browser**: `BrowserTranscriber.transcribeWithWebSpeechAPI`（:324）が実在の実 Web Speech file 経路（`URL.createObjectURL` + `Audio` 再生 + `SpeechRecognition`・timestamp は `audio.currentTime * 1000`・confidence 欠落時 `FINAL_NO_CONFIDENCE_STANDIN` :355・onend/onerror 両方で `revokeObjectURL` :374/:379）。ただし private かつ progressive callback を持たない → 共有 engine として抽出する設計（architecture.md shared file engine）。
- **Node**: `whisperTranscriber.transcribe`（:395・D-1）が gate 解決（`resolveWhisperInferencePaths` :148）・lazy backend・staging・row 変換（`convertWhisperRows` :108）まで包括し、`placeholder: !inferenceRan`（:447）を返す。丸ごと委譲するだけで server 経路の実ASRと開示が得られる。

## A5: per-chunk 分割推論の技術検討 — 不採用 🔵

**信頼性**: 🔵 *whisper-node の API 形状（per-call callable・model を都度読み込む）と D-4 の RTF 実測方針より*

whisper backend は呼び出しごとに model を読み込む per-call API であるため、3 秒 chunk × N 回の分割推論は model 再読み込み N 回となり RTF が実用性を失う。よって Node 経路は単発 whole-file 推論（SD2）とし、進捗は完了時一括 emit に限る。「実結果を chunk 長で分割して progressive に見せかける合成 stagger」は偽 progress として禁止（SD3）。`chunkSizeMs` / `overlapMs` は v1 で実推論に使う経路を持たない旨を doc 開示して API 互換で残す。

## A6: 重複設計の確認 🔵

**信頼性**: 🔵 *specs/ 配下の grep（`streaming` / `transcribeStream` / `StreamingTranscriber`）と PR #100 の差分確認より*

- streaming 実ASRを設計する正本は既存しない（streaming-transcriber 関連の既存 spec は REQ-179（単体 test 体制）と REQ-091/093（quality monitor・REQ-388 anchor 整備）で、いずれも現行シミュレーションを対象にした test/doc 要求）。
- PR #100（specs/real-audio-e2e-regression/）は batch server 経路の測定が対象で streaming 経路に触れない。REQ/TC 番号（REQ-424 / TC-408 / Phase 195）も衝突しないことを確認済み。

## A7: 姉妹 site の未開示 mock — 残課題として記録 🔵

**信頼性**: 🔵 *browser-transcriber.ts:382-397（空結果→`getEnhancedMockSegments` を `success: true` で resolve）より*

委譲先 mechanism の持ち主である `BrowserTranscriber` 自身にも、Web Speech が利用不可/空結果のときに未開示 mock segments を `success: true` で返すフォールバックが存在する — streaming 経路と同一の偽成功 class の姉妹 site（missed-sibling-site class）。本設計では shared engine に mock を持ち込まず（空は空）、BrowserTranscriber 側の mock 開示は**次サイクル候補として残課題**に列挙する（本 feature は streaming 経路に scope を絞る）。

## A8: 測定 scope の決定 🔵

**信頼性**: 🔵 *D-2 harness の fail-loud 契約と D-4/D-5 設計（実測値は pin せず artifact 一致検査）より*

streaming 経路独自の WER/CER harness は作らない（SD7）。Node 経路は WhisperTranscriber 出力と同一 therefore D-2 harness の対象品質と等価。browser Web Speech 経路の実測は D-5 コーパスを browser で再生する形で将来 D-4 report を拡張するのが筋であり、本 feature の完了条件には含めない。

## A9: UI 開示と REQ-091 wiring 🟡

**信頼性**: 🟡 *現行 UI 実装からは「偽 stats が表示されている」ことまでしか確定できないため（notice 形状は実装時判断）*

- placeholder 経路の notice の UI 形状（badge / note / alert）は実装時に確定する。要件は「placeholder 経路であることがユーザーに区別可能」なことのみ（AC-D6-3）。
- REQ-091 の user-warning leg（`onQualityAlert` / `getQualitySummary` の StreamingProcessor での消費）は未 wiring であるが、本 feature は経路実質化に集中し、alert UI への接続は残課題とする（実経路化により quality monitor に実測値が流れるようになった段階で wiring する価値が生じる順序関係）。

## A10: テスト影響範囲の棚卸し 🔵

**信頼性**: 🔵 *該当 test file の直接読みと grep より*

- `src/transcription/__tests__/streaming-transcriber.test.ts`（REQ-179 の単体 test 群）: simulate 固定文（`Processed segment` / `chunk` 文言 pin）と 0.75 経由の filter 挙動 pin は routing 契約 test へ書き換え。constructor 検証・`updateConfig` 検証・merge/dedup 境界は不変。
- `tests/unit/pipeline/streaming-transcriber.test.ts`: 固定文と language `'en'` pin を置換。
- `tests/transcription/streaming-transcriber.test.ts`（quality monitor 系）: 未測定 semantics の test を追加、捏造 0-reject pin は改廃。
- 新設 `web-speech-file-transcription.test.ts`: progressive callback・空は空・cleanup 両 path の契約 test。
- guard 系: REQ-391 measurement-fixture census の ALLOWED 行（`PLACEHOLDER_CHUNK_CONFIDENCE`）は constant が維持されるため不変。simulate 固定文の pin が census に現れる行は置換時に追従。

## 信頼性レベルサマリー

- 🔵 青信号: 9件（A1〜A8, A10）
- 🟡 黄信号: 1件（A9 — UI notice 形状と REQ-091 wiring の時期）
- 🔴 赤信号: 0件

**品質評価**: 高品質（対象選定の根拠（D-1〜D-5 の完了状況表）・現行シミュレーションの行番号付き証拠・委譲先の実在確認・不採用判断（A5）の技術根拠・残課題の切出しが全て実測に基づく）
