# Speech-to-Visuals: 音声→図解動画自動生成システム

音声ファイルから自動的に図解とアニメーション動画を生成する完全自動化システムです。

## 主要機能

- **音声認識**: 音声ファイルからテキスト + タイムスタンプ付きセグメントを生成（実装の現状は[音声認識の現状](#音声認識の現状)を参照。実音声に対する認識精度は未測定）
- **図解自動生成**: AI による内容分析と図解タイプ自動検出（測定値・測定方法は [QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) を参照）
- **レイアウト生成**: ゼロオーバーラップを品質ゲートとするレイアウトエンジン
- **動画作成**: Remotion によるアニメーション動画出力（1080p・30fps 設定）
- **リアルタイムUI**: 処理進捗とメトリクスのリアルタイム表示

## 処理フロー

```
音声ファイル (MP3/WAV/OGG/M4A)
  ↓
1. 音声認識 → テキスト + タイムスタンプ（実装の現状は下記「音声認識の現状」を参照）
  ↓
2. シーン分割 → 意味単位でセグメント化
  ↓
3. 図解タイプ判定 → flow/flowchart/tree/timeline/matrix/cycle/comparison/network/conceptmap/mindmap/general
  ↓
4. レイアウト生成 → オーバーラップゼロを品質ゲートとする
  ↓
5. 動画レンダリング (Remotion) → アニメーション付きMP4
  ↓
出力: JSON (図解データ) + MP4 (動画)
```

### 音声認識の現状

「Whisper による高精度文字起こし（精度90-95%）」という旧記載は実装と整合しないため、以下の実態に置き換えました（2026-08 時点）。

- サーバー優先経路 `src/transcription/whisper-transcriber.ts` は、コンパイル済み whisper.cpp バイナリ（`node_modules/whisper-node/lib/whisper.cpp/main`）と ggml モデル（`STV_WHISPER_MODEL` または `models/ggml-<model>.bin`）が**両方存在する場合のみ** whisper-node による実推論を試み、成功時は `placeholder: false`・実測タイムスタンプ付きセグメントを返します（confidence は whisper.cpp 出力に存在しないため未測定のまま）。バイナリ/モデルが無い環境（CI を含む）や推論失敗時は固定文（`generateHighQualityTranscript()`）を返し、結果には `placeholder: true` が開示されます（confidence は `PLACEHOLDER_SEGMENT_CONFIDENCE` の単一ソース）。モデルは `npx whisper-node download` で取得できます。
- 上記の存在ゲートは whisper-node の**モジュール読み込み自体を保護**しています。whisper-node は読み込み時にプロセスの cwd を書き換え、バイナリ未コンパイルなら同期的に `make` を実行して失敗すると `process.exit(1)` します。以前の実装は起動時に無条件でこの import を行っていましたが、現在はゲート通過後のみ遅延読み込みし、読み込み後は cwd を復元します。
- パイプライン `src/transcription/transcriber.ts` は推論を伴わない `placeholder` 結果を「成功」として採用せず、ブラウザ環境では Web Speech API（`src/transcription/browser-transcriber.ts`）へフォールバックします。全経路が失敗するとプレースホルダー（`[Transcription unavailable - placeholder content]`、confidence 0）を返します。サーバー経路はファイルパス文字列入力も受け付けます（Node ではディスクから読み取り）。
- 精度測定ハーネス `scripts/measure-transcription-accuracy.ts`（`npx tsx scripts/measure-transcription-accuracy.ts --corpus <dir>`）は、参照文字起こし（`<name>.txt`）との WER/CER を算出し JSON 証跡を出力します。実推論が一度も走らなかった実行は測定ではないとみなし exit 1 で拒否します（プレースホルダー実行を精度記録に混入させない）。
- そのため実音声に対する文字起こし精度は**未測定**です（評価コーパス `public/audio` が未整備のため実測証跡が無い）。WER ベースの記録値は [QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) §3.1 の `~85%`（目標 >85%）を参照してください（旧 README 記載の「90-95%」とは一致しません）。
- `npm run transcribe`（`public/jfk.wav`）はバイナリ/モデルが無ければ同じ固定文生成経路を通るため、実測には使えません。実測に必要な残課題は、評価コーパスの整備（ライセンス適合の実音声 + 参照文字起こし）と、実推論実行による WER 証跡の QUALITY_METRICS §3.1 記録です。

**処理時間**: Phase 29 実行では総処理 35.62 秒（`public/jfk.wav`・動画生成込み。経時的な測定記録は [QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) §4.2 と [ITERATION_LOG.md](docs/architecture/ITERATION_LOG.md) を参照）
**システムステータス**: Phase 29 実施 - 実音声ファイルによるシステム検証（Phase 29 の測定条件は下記「システム品質」を参照）

## クイックスタート

### Web UI から使用

```sh
# 1. 依存関係のインストール
npm install

# 2. 開発サーバーの起動
npm run dev

# 3. ブラウザでアクセス
http://localhost:8080/simple  (推奨 - Simple Pipeline)
```

### 環境変数（Gemini API）

Gemini を用いた内容分析を有効化するには、環境変数に API キーを設定してください。

```sh
# Linux/macOS (一時)
export GOOGLE_API_KEY="<your-api-key>"

# .env に追記（推奨・鍵は公開しないこと）
GOOGLE_API_KEY="<your-api-key>"
```

CLI からは次のように図解 JSON を生成できます。

```sh
# テキストから図解 JSON を生成（Gemini→ルールベースの順でフォールバック）
npx tsx scripts/generate-diagram-from-text.ts --text "プロセスAの後にBを実行し..."

# またはファイル入力
npx tsx scripts/generate-diagram-from-text.ts ./public/scenes/sample.txt
```

**使用方法**:
1. 音声ファイルをアップロード（MP3/WAV/OGG/M4A, 最大50MB）
2. 「動画を生成する」にチェック
3. 「処理開始」ボタンクリック
4. リアルタイム進捗を確認
5. 結果をダウンロード（JSON + MP4）

### CLI から使用

```sh
# シーンデータから動画生成
npx tsx scripts/render-video.ts scene-data.json output.mp4

# 複数音声ファイルのバッチ処理 (NEW!)
npx tsx scripts/batch-audio-pipeline.ts ./audio-samples ./output

# バッチ処理オプション
npx tsx scripts/batch-audio-pipeline.ts ./audio ./output --parallel --max-parallel 3

# 出力例
# ✅ 動画レンダリング完了!
# 📁 出力先: output.mp4
# 📦 ファイルサイズ: 5.2 MB
```

### LLMベース最小フロー（テキスト→図解→動画）

```sh
# 1) テキストから図解JSONを生成（Gemini→ルールベース）
npm run diagram:from-text -- --text "A→B→C→D の処理フロー"

# 2) 図解JSONをシーンデータに変換（自動レイアウト）
npm run diagram:to-scenes -- public/scenes/diagram.json public/scenes/scene-data.json

# 3) Remotionで動画化（MP4）
npm run render:video -- public/scenes/scene-data.json public/diagram-output.mp4
```

## 技術スタック

### フロントエンド
- **React** + **TypeScript**: UI構築
- **Vite**: 高速ビルドツール
- **Tailwind CSS** + **shadcn-ui**: スタイリング
- **Remotion**: 動画生成

### バックエンド・処理
- **Whisper (whisper-node)**: 音声文字起こし — 現行は推論未実装（[音声認識の現状](#音声認識の現状)参照）
- **Web Speech API**: ブラウザ音声認識（優先経路失敗時のフォールバック）
- **Dagre**: グラフレイアウト生成

## 対応ファイル形式

- **音声**: MP3, WAV, OGG, M4A (最大50MB)
- **出力**: JSON (図解データ), MP4 (動画)

## 図解タイプ (全11種類対応)

正規の型集合は `src/types/diagram.ts` の `DIAGRAM_TYPES` が単一ソースです。

- **flow** (プロセスフロー): プロセス、手順、ワークフロー
- **flowchart** (フローチャート): 条件分岐を含む処理フロー
- **tree** (階層構造): 階層、組織図、分類
- **timeline** (タイムライン): 時系列、歴史、ロードマップ
- **matrix** (比較表): 比較、対比表、評価軸
- **cycle** (循環プロセス): 循環プロセス、繰り返し、フィードバックループ
- **comparison** (比較): 複数項目の並列比較
- **network** (ネットワーク): 要素間の接続・依存関係
- **conceptmap** (コンセプトマップ): 概念間の関係性
- **mindmap** (マインドマップ): 中心テーマからの発想展開
- **general** (一般): 特定レイアウトに限定しない図解

## 開発コマンド

```sh
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npm run type-check

# Remotion Studio
npm run remotion:studio

# テスト派生スクリプト（目的・前提条件は TESTING_GUIDE.md を参照）
npm run test:coverage
npm run test:memory
npm run test:fuzz
npm run test:fuzz:multi-seed
npm run test:mutation

# バッチ処理 (複数音声ファイル一括処理)
npx tsx scripts/batch-audio-pipeline.ts <input-dir> <output-dir> [options]
```

### 主要スクリプト一覧

`package.json` の主要 scripts の目的と前提条件です（テスト派生スクリプトの詳細は [TESTING_GUIDE.md](TESTING_GUIDE.md)、LLM ベース最小フローの `diagram:from-text` / `diagram:to-scenes` / `render:video` は[上記](#llmベース最小フローテキスト図解動画)を参照）。

| コマンド | 目的 | 前提条件・入出力 | 利用場面 |
|---|---|---|---|
| `npm run lint` | ESLint による静的検証 | 入力: ソース一式 / 出力: 違反レポート（CI の `lint` job と同一） | コミット前・CI |
| `npm run preview` | ビルド成果物のローカル配信確認 | `npm run build` 済みであること | 本番ビルドの動作確認 |
| `npm run studio` / `npm run remotion:studio` | Remotion Studio 起動 | 出力: `localhost:3000` 系の対話 UI | 動画コンポジションの調整 |
| `npm run remotion:render` | Remotion コンポジションの直接レンダリング | 入力: コンポジション ID と出力先 / 出力: 動画ファイル | 単体コンポジションの書き出し |
| `npm run remotion:preview` | Remotion プレビューサーバー起動 | 出力: ブラウザプレビュー | レンダリング前の確認 |
| `npm run api:server` | REST API サーバー起動 (`tsx src/api/index.ts`) | 出力: API エンドポイント（`.env` 参照） | API 経由のパイプライン実行 |
| `npm run api:dev` | API サーバーのウォッチモッド起動 | `api:server` と同様 + ホットリロード | API 開発時 |
| `npm run pipeline:run` | 単一音声の E2E パイプライン実行 | 入力: `npx tsx scripts/run-pipeline.ts <audioPath> [--no-video] [--out <dir>]` / 出力: 図解 JSON・動画 | CLI での全段階検証 |
| `npm run pipeline:batch` | `./public/audio` 一括処理（動画なし） | 入力: `public/audio` / 出力: `test-batch-output` | バッチ経路の回帰確認 |
| `npm run pipeline:test:audio` | 実音声ファイルによる E2E 完全テスト (Phase 7) | 音声ファイルのパスを引数指定 / 出力: 各段階の成否とメトリクス | パイプライン健全性の検証 |
| `npm run quality:check` | 品質集計の smoke check | 固定モックを投入する集計経路の確認のみ（実測ではない。[QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) §5.1 参照） | 品質モニタの改動後確認 |
| `npm run validate:llm` | LLM 統合の検証 (Phase 31) | `GOOGLE_API_KEY` 設定 / 出力: LLM 系メトリクス | LLM 経路の改動後確認 |
| `npm run audit:code-size` | コードサイズ監査 (`--ci` 付き) | SYSTEM_CONSTITUTION V2.7 の上限と照合 / 警告は exit 0 | サイズ上限の維持確認 |
| `npm run spine:validate` | docs スパイン manifest の検証 | `specs/_doc_spine.yml`（自動生成・gitignore 済み）があれば検証、不在なら skip | CI (`spine-validate` job) |
| `npm run monitoring:validate` | 監視設定のプリデプロイ検証 | 入力: `deploy/monitoring/` 配下 / 出力: 検証レポート | CI (`monitoring-config-validate` job) |
| `npm run sync:edge` / `npm run verify:edge` | Supabase Edge sanitizer の生成 / ドリフト検出 | 単一ソース `src/analysis/untrusted-json-core.ts` から生成 | git hook・CI (`edge-sanitizer-sync`) |
| `npm run transcribe` | 文字起こし実行 (`public/jfk.wav`) | ⚠️ 現行は固定文生成経路を通る（[音声認識の現状](#音声認識の現状)参照） | 文字起こし配線の確認 |
| `npm run cache:warmup` | セマンティックキャッシュの事前投入 (Phase 43) | 出力: キャッシュエントリ | キャッシュヒット率改善 |

内部専用スクリプト: `phase1:verify`、`test:phase34`〜`test:phase44`、`test:llm-parsing`、`test:multilingual`、`setup:hooks` はフェーズ検証・開発環境向けであり、通常の開発・運用では使いません。参照先スクリプトが歴史上一度も存在しなかった `pipeline:test:e2e`・`test:phase33`・`test:phase43` は 2026-08-18 に削除済み（E2E 検証は `pipeline:test:audio` を使用）。

## ドキュメント

### ユーザーガイド
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - テストガイド

### アーキテクチャドキュメント
- [SYSTEM_CORE.md](docs/architecture/SYSTEM_CORE.md) - コアアーキテクチャ定義
- [PIPELINE_FLOW.md](docs/architecture/PIPELINE_FLOW.md) - 処理パイプライン仕様
- [QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) - 品質評価基準
- [ITERATION_LOG.md](docs/architecture/ITERATION_LOG.md) - 改善履歴と学習事項

## システム品質

### 値の出どころ

- 以下の数値は **Phase 実施時点の自己申告による記録**です。測定方法・測定環境ごとの現在値は [QUALITY_METRICS.md](docs/architecture/QUALITY_METRICS.md) を、Phase ごとの経時記録は [ITERATION_LOG.md](docs/architecture/ITERATION_LOG.md) を参照してください。
- `npm run quality:check` は固定モックを投入する品質集計の smoke check であり（QUALITY_METRICS.md §5.1）、この節のスコアの測定手段ではありません。
- 測定証跡が確認できない値は「記録値（証跡なし）」、実装上測定できない値は「未測定」と明記しています。

### Phase 記録 (Phase 29 実施)

```yaml
全体品質スコア: 100/100 (Phase 29 実行時の品質集計スコア - 記録値)
システム検証スコア: 100/100 (Phase 29 実音声ファイル実行 - 記録値)

モジュール別品質:
  音声認識:     未測定 (Whisper 推論未実装・固定文生成。「音声認識の現状」参照)
  内容分析:     100/100 (記録値 - LLM統合、ゼロ重複) ✨Phase 22-23
  図解生成:     100/100 (記録値 - ゼロオーバーラップ、11種類対応)
  動画生成:     100/100 (記録値 - 1080p 30fps)
  バッチ処理:   100/100 (記録値 - 並列処理対応)
  統一アーキテクチャ: 100/100 (記録値 - LLMService統一) ✨Phase 22-23
  品質フレームワーク: 100/100 (記録値 - 再帰的改善) ✨Phase 27
  ドキュメント: 100/100 (記録値 - 完全体系化)

対応図解タイプ (Phase 10時点は5種類、現在は11種類):
  flow:         ✅ 完全実装 (検出・レイアウト・レンダリング)
  flowchart:    ✅ 完全実装 (検出・レイアウト・レンダリング)
  tree:         ✅ 完全実装 (検出・レイアウト・レンダリング)
  timeline:     ✅ 完全実装 (検出・レイアウト・レンダリング)
  matrix:       ✅ 完全実装 (検出・レイアウト・レンダリング)
  cycle:        ✅ 完全実装 (検出・レイアウト・レンダリング)
  comparison:   ✅ 完全実装 (検出・レイアウト・レンダリング)
  network:      ✅ 完全実装 (検出・レイアウト・レンダリング)
  conceptmap:   ✅ 完全実装 (検出・レイアウト・レンダリング)
  mindmap:      ✅ 完全実装 (検出・レイアウト・レンダリング)
  general:      ✅ 完全実装 (検出・レイアウト・レンダリング)

エンドツーエンドパフォーマンス (Phase 29実音声ファイルテスト・n=1):
  音声ファイル:     344 KB (jfk.wav)
  文字起こし:       1132 文字 (4セグメント) ※固定文生成による値。実音声との一致率は未測定
  シーン数:         4 (tree自動判定、4ノード/3エッジ)
  動画出力:         生成成功 (1080p, 30fps)
  総処理時間:       35.62秒 (動画生成含む)
  品質スコア:       100/100 (EXCELLENT - 記録値)
  成功率:           100% (Phase 29 の単一実行に対する記録)
  メモリ使用量:     82.21 MB (目標512MBの16%)
  レイアウト重複:   0 (ゼロオーバーラップ達成)

バッチ処理パフォーマンス (Phase 8完了):
  処理速度:         32ms/ファイル (動画なし)
  並列処理効率:     150% (2並列で1.5倍高速化)
  バッチ成功率:     100% (3/3ファイル)
  レポート精度:     100% (詳細な処理結果記録)

システム安定性 (Phase 9検証済み):
  エッジケーステスト:   20/21 passed (95%)
  エラーリカバリー:     100% (多層防御戦略)
  Graceful Degradation: 実装済み (空ファイル対応)

ドキュメント体系 (Phase 10完了): ✨NEW!
  SYSTEM_CORE.md:       ✅ Phase 9実績反映
  PIPELINE_FLOW.md:     ✅ バッチ処理・エラーハンドリング追加
  QUALITY_METRICS.md:   ✅ 実測値反映、100/100達成記録
  ITERATION_LOG.md:     ✅ Phase 1-9完全記録

統合状況:
  SimplePipeline統合:         100% (完了)
  Web UI統合:                 100% (完了)
  エンドツーエンド:           100% (実音声ファイルテスト完了)
  プロダクション環境対応:     100% (Phase 7完了)
  バッチ処理システム:         100% (Phase 8完了)
  エッジケース対応:           100% (Phase 9完了)
  ドキュメント体系化:         100% (Phase 10完了)
  LLM統一アーキテクチャ:      100% (Phase 22-23完了) ✨
  再帰的品質改善フレームワーク: 100% (Phase 27完了) ✨
  カスタムインストラクション準拠検証: 100% (Phase 28完了) ✨
  実音声ファイルシステム検証:  100% (Phase 29完了) ✨NEW!
  パフォーマンス最適化:       100% (目標大幅超過)
```

### 開発方針

本プロジェクトは**段階的・再帰的改善**アプローチを採用:
- 小さく作り、確実に動作確認
- 動作→評価→改善→コミットの繰り返し
- 各段階で検証可能な出力
- 処理過程の完全な可視化

## ライセンス

MIT License
