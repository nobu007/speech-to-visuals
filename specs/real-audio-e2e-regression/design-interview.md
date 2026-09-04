# real-audio-e2e-regression 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-03
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

AI Hub 開発方向（D-1〜D-5）のうち未実装の D-4（real-audio E2E regression レポート）/ D-5（評価用音声コーパス）について、requirements.md REQ-422/423（Phase 194・提案ベース）・D-1/D-2 実装（e5853217）・D-3 実装（dda5c055）・現行コードの実測調査に基づき、実装 agent が追加質問なしで着手できる設計を確定する。

## 分析項目と判断

### A1: 対象の確定 — 未実装ギャップは D-4/D-5 のみ

**分析日時**: 2026-09-03
**カテゴリ**: アーキテクチャ
**背景**: D-1〜D-3 の着地状況を確認し、born-DONE（実装済みの後付け文書化）を排除する必要があった。

**判断**: D-1/D-2 は e5853217（PR #96 merged 2026-09-02）、D-3 は dda5c055（PR #99 merged 2026-09-03）で main 到達済み。REQ-421 は ✅実装済・TC-405 は全 `[x]`。残るのは REQ-422/423（提案ベース）+ TC-406-01〜03 / TC-407-01〜02（全 `- [ ]`）のみ。
**根拠**: `git log origin/main`・requirements.md L1052-1054・acceptance-criteria.md L6105-6109・`gh pr view 96/99`（state MERGED）。

**信頼性への影響**:

- 本 feature の全設計項目が「PURPOSE 未達成果（README『音声認識の現状』L40 が自ら挙げる残課題）」に直結し、🔵 に数えられる状態を確立。

---

### A2: 現行 E2E script は測定器として成立していない（差分の実測）

**分析日時**: 2026-09-03
**カテゴリ**: アーキテクチャ
**背景**: REQ-422 が「実質化」と表現する現状の正確な把握。

**判断**: `scripts/test-complete-audio-pipeline.ts`（466 行）は (a) 入力 hardcoded `public/jfk.wav`・argv なし (b) per-stage timing と総処理時間は既に持つ（`Stage.duration` / `totalDuration`・`performance.now()`）が console のみで JSON 出力なし (c) WER・参照文字起こし比較・音声長・RTF は皆無（`RTF|real.time factor` は src/scripts/tests/docs 全域 zero match）(d) exit gate が `qualityScore >= 70` heuristic（transcript 長・scene 数・video サイズの quartile）で、placeholder 経路でも充足し得る。
**根拠**: 当該 script L454-460（cwd 入力・exit）・L69-70（Stage timing）・L353（qualityScore gate）・L381-388（timing breakdown 印刷）。

**信頼性への影響**:

- 「stage timing は作り直さず流用する」設計（architecture コンポーネント構成）を 🔵 根拠付きで確定。exit gate 置換（D4 決定）が破壊的変更ではなく契約の修正であることを根拠付け。

---

### A3: WER/CER・集計は D-2 pure core に単一ソース化

**分析日時**: 2026-09-03
**カテゴリ**: データモデル
**背景**: TC-406-03 が「第二の WER 実装を作らない」を要求。委譲先の実在 export の確認。

**判断**: `scripts/measure-transcription-accuracy.ts` は pure core 10 export（`normalizeText` / `tokenize` / `charSequence` / `levenshtein` / `computeWer` / `computeCer` / `discoverCorpus` / `summarize` / `buildReport` / `parseAccuracyArgv`）を持ち、tests/scripts/measure-transcription-accuracy.test.ts（255 行）が手計算値・micro-average・skip reason 文言を pin 済み。E2E script はこれらを import して使うのみとし、corpus 発見（`discoverCorpus`）も含めて再実装しない。
**根拠**: 同 script L43-314 の export 群・同 test の pin 範囲・recurring bug class「duplicate-formula」。

**信頼性への影響**:

- 委譲設計を 🔵 に確定し、report schema のみ `stv-real-audio-e2e/1` として新設（accuracy の `stv-transcription-accuracy/1` に timing/RTF を詰め込まない）。

---

### A4: ja 測定は CER 主体（WER の whitespace token 前提が ja で不成立）

**分析日時**: 2026-09-03
**カテゴリ**: データモデル
**背景**: 日本語コーパスで WER が何を測るのかを確定する必要があった。

**判断**: D-2 の `computeWer` は `tokenize`（whitespace 分割）前提のため、分かち書きされていない ja 文では参照全体が 1 token になり WER が 0/1 に退化する。`computeCer` は code point 列（surrogate pair 安全・test pin 済み）で ja に適する。report は両 metric を持たせ、QUALITY_METRICS §3.1 記録は en=WER / ja=CER と使い分ける。
**根拠**: `tokenize` 実装（L48）・tests/scripts/measure-transcription-accuracy.test.ts の CER surrogate pair pin（L24-45）。

**信頼性への影響**:

- §3.1 記録規則を含む記録先設計を 🔵 化。REQ-423 (d)「§3.1 を実測値で初めて埋める」の記述形式を確定。

---

### A5: 音声長は WAV header から導出する（doc 記載値との矛盾の実在）

**分析日時**: 2026-09-03
**カテゴリ**: 技術選択
**背景**: RTF 分母（音声長）の信頼できる供給源の決定。

**判断**: repo 内に音声長導出 helper は存在しない。doc の記載値は信頼できない実例として `docs/architecture/LLM_INTEGRATION_REPORT.md` L28 は jfk.wav を「344 KB, 32 seconds」と記すが、352,078 byte ÷ (16,000 Hz × 2 byte) ≒ 11.0 秒となり相互矛盾する。header の `byteRate` と `data` chunk size からの導出（`dataSize / byteRate × 1000` ms）だけが検証可能な単一ソースになる。
**根拠**: byte 計算・RIFF 仕様・`stageAudioForWhisper` が resampling しない実装（whisper.cpp が WAV を native decode）。

**信頼性への影響**:

- `src/transcription/wav-duration.ts`（pure・bytes 入力）の新設と、test の手計算 pin（例: 16kHz/16bit/mono の data 320,000 byte → 10,000 ms）を 🔵 で確定。`transcriptEndMs` 交差検証 field を 🟡 で付帯。

---

### A6: RTF の定義は §3.1 Processing Speed に整合させる

**分析日時**: 2026-09-03
**カテゴリ**: パフォーマンス
**背景**: REQ-422 の「RTF（処理時間 ÷ 音声長）」の分子をどの処理時間にするか。

**判断**: QUALITY_METRICS §3.1 は Processing Speed を Time(process)/Time(audio)（transcription stage の指標）と定義し、Current に出典不明の `2.0x` を置いている。E2E report は `transcriptionRtf`（transcription 段 processingTime ÷ audioDurationMs）と `totalProcessingMs`（全 stage 合計）を分離し、§3.1 の 2.0x は `transcriptionRtf` 実測で置換する。総時間を分子にすると分析・layout・render が混入し §3.1 の指標定義と衝突する。
**根拠**: QUALITY_METRICS §3.1 行（L53-62）・REQ-422 (c)「stage 別 timing」要件（分離記録そのものが要件）。

**信頼性への影響**:

- D2 設計決定を 🔵 化し、§3.1 Processing Speed 行の実測置換（出典なし 2.0x の廃棄）を設計に組み込み。

---

### A7: fail-loud 契約の継承（D-2/D-3 との同型性）

**分析日時**: 2026-09-03
**カテゴリ**: セキュリティ（測定の完全性）
**背景**: 「placeholder run は測定ではない」契約を E2E 経路でも守る形の確定。

**判断**: D-2 は all-placeholder run で exit 1（stderr「a placeholder run is NOT a measurement; nothing to record in QUALITY_METRICS §3.1」）・D-3 は `summarizeDetection([])` throw。E2E は corpus 空・全 placeholder・非有限測定値の 3 条件で exit 1 とし、`qualityScore >= 70` heuristic gate を廃止する。video render 失敗は現行どおり非 fatal（report 記録のみ）。
**根拠**: scripts/measure-transcription-accuracy.ts L406-411・REQ-422 (a)・REQ-421 D-3 の fail-loud 記述。

**信頼性への影響**:

- D4 設計決定を 🔵 化。TC-406-02 の検証内容（実音声なし run の非 zero exit pin）が設計と 1:1 で対応。

---

### A8: ライセンス・出典設計（repo に LICENSE file 無しの実測から）

**分析日時**: 2026-09-03
**カテゴリ**: セキュリティ
**背景**: REQ-423 (b)「無断音声の commit 禁止」を実際の権利処理手順に落とす必要があった。

**判断**: repo に LICENSE file が無いため、corpus は `public/audio/CORPUS.md` による per-file 開示で運用する。v1 は (a) en: `public/jfk.wav` の copy（1961 就任演説・米連邦政府著作物 = Public Domain と整理し、出典と根拠を CORPUS.md に記載）(b) ja: maintainer 自身の読み上げ録音（原稿 = 現 `test-audio.txt`・録音者が著作権者として CC0 1.0 提供を宣言）— 権利確認が人的確認事項として残るため 🟡。拡張候補（LibriSpeech = CC BY 4.0 attribution 必須・Mozilla Common Voice = CC0）は CORPUS.md 行を追加する形式でのみ受け入れる。
**根拠**: REQ-423 (a)(b)・`ls LICENSE*` 実測（不在）・jfk.wav が whisper.cpp 系 sample として流通する実績。

**信頼性への影響**:

- 権利まわりを 🔵（構造: per-file 開示が gate）と 🟡（個別ライセンス確定）に分離。残課題に人的確認事項として明記。

---

### A9: 実測値を test pin しない（D-3 からの戦略分岐）

**分析日時**: 2026-09-03
**カテゴリ**: テスト
**背景**: D-3 は baseline exact pin（28/33 = 84.85%）で detector drift を封じた。同一戦略の適否。

**判断**: D-3 の測定対象（rule-based detector）は offline 決定論で CI 再現可能だった。本測定は (a) whisper.cpp binary / ggml model が CI に存在しない（本 worktree の node_modules にも両 package 不在・gate は閉じた状態）(b) 同一 model でも binary 版数・実行機で RTF が変わり、WER も model file 依存。よって test は構造のみ pin し（schema field・有限性・fail-loud・委譲 import witness・WAV duration 手計算値）、実測数値は「§3.1 記載値 == committed artifact 値」の一致検査 guard で drift を封じる（数値そのものではなく証跡との一致を pin）。
**根拠**: resolveWhisperInferencePaths の gate 仕様（binary + model の両存在が条件）・CI job 構成（whisper provision 手順なし）・D-3 との測定対象の差異。

**信頼性への影響**:

- D5 設計決定を 🔵（分岐の根拠）+ 🟡（一致 guard の実装形状）で確定。machine-dependent な値の pin による偽 RED / 偽 green を構造的に回避。

---

### A10: 既存資産との重複確認（統合判定）

**分析日時**: 2026-09-03
**カテゴリ**: アーキテクチャ
**背景**: 同一責務の既存設計がある場合は新規作成より統合が優先（kairo-design 統合ルール）。

**判断**: (a) `specs/speech-to-visuals/`（system 正本）は要件側でのみ本件を扱い、D-4/D-5 専用の設計 doc は存在しない → 新規 feature dir は重複なし (b) `phase29-system-validation.ts` / `test-phase44-e2e.ts` は jfk.wav を使う旧検証 script であり、REQ-422 の測定 report 責務と重複しない（legacy・移行元として参照のみ）(c) `pipeline:batch` は corpus dir を既定に持つが測定 report を出さないため責務が排他 (d) QUALITY_METRICS §8.2 は現行 timing breakdown を文書化しているのみ → §8.6 新設で置き換えではなく追記。
**根拠**: `rg --files specs` 相当の一覧・各 script の責務確認・package.json scripts。

**信頼性への影響**:

- 統合対象（merge_targets）なし・廃止統合なし、の判定を記録。設計の新規性と重複排除を両立。

## 分析結果サマリー

### 確認できた事項

- D-1/D-2/D-3 は main 到達済み（e5853217 / dda5c055）。未実装は D-4/D-5 のみ。
- 現行 E2E script は timing を持ち・測定（WER/RTF/JSON/fail-loud）を持たない。
- D-2 pure core（10 export・test pin 済み）への委譲で metric の単一ソースが成立する。
- `public/audio` に音声は 0 件（sample-info.json は phantom metadata・test-audio.txt は音声の無い原稿）。
- whisper provision（binary + ggml model）は CI にも worktree にも無く、gate は閉じた状態。

### 設計方針の決定事項

- corpus 規約は D-2 のまま（`<name>.wav` + `<name>.txt`）・WAV 16kHz mono に限定・CORPUS.md で出典/ライセンス/由来を per-file 開示。
- WER/CER/集計/corpus 発見はすべて D-2 pure core へ委譲。report schema は `stv-real-audio-e2e/1` を新設。
- 音声長は WAV header から pure 導出（`readWavDurationMs`）。RTF は transcription 段に固定し総処理時間と分離。
- exit gate は `qualityScore >= 70` から測定契約（corpus 空 / 全 placeholder / 非有限値 → exit 1）へ置換。
- 実測数値は test pin せず、QUALITY_METRICS §3.1 記載値と committed artifact の一致検査で drift を封じる。

### 残課題（実装時の人的確認事項を含む）

- jfk.wav の Public Domain 整理（出典 URL・根拠文面）を CORPUS.md に確定して記載すること 🟡
- maintainer による ja 読み上げ録音の用意（16kHz mono への変換手順を CORPUS.md に残す）と CC0 提供宣言 🟡
- whisper.cpp binary + ggml model の provision 手順（`npx whisper-node download` 等・model 種別）を §8.6 に手順化 🟡
- jfk.txt 参照文字起こしを human-entered で作成すること（`public/srt/jfk.srt` は循環のため使用禁止）
- `SimplePipelineResult.transcript` の常在性確認（空時に segments join へ fallback するかの実装時判断）
- SYSTEM_CONSTITUTION.md L125 の品質テスト行「~85%」が §3.1「未測定」と乖離している（V2.7 改正時の名残）— 本 feature 実測後に憲法実績値表記を同期するかは別REQ として扱う
- §8.2「Detailed timing breakdown by stage」の記述は実質化後の report 形式へ §8.6 新設時に読み替える

### 信頼性レベル分布

**分析前**（要件のみ・設計なし）:

- 🔵 青信号: 0件（REQ-422/423 は要件として 🔵 だが設計項目は未存在）
- 🟡 黄信号: 0件
- 🔴 赤信号: 0件

**分析後**（architecture.md 16件 / dataflow.md 14件 / 本記録 10 分析項目）:

- 🔵 青信号: 32件（設計全体・全ファイル集計で 🔵 過半）
- 🟡 黄信号: 9件（ライセンス確定 2・録音・provision 手順・artifact path・guard 形状・skip 続行・fallback 要否ほか）
- 🔴 赤信号: 0件（参照資料にない自動推定は不使用 — 🟡 はすべて実在実装+確認事項付きの推測）

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義（正本）**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-422 / REQ-423（Phase 194）
