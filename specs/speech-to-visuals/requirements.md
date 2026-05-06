# Speech-to-Visuals 要件定義書


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

## 概要

音声ファイル（MP3/WAV/OGG/M4A）を入力として、Whisper による文字起こし、Gemini LLM による内容分析、図解タイプ自動検出（flow/tree/timeline/matrix/cycle/flowchart/comparison/network/conceptmap/mindmap/general の11種類）、ゼロオーバーラップレイアウト生成、Remotion によるアニメーション動画（1080p 30fps MP4）を自動生成するエンドツーエンドパイプラインシステム。

**実装状況**: Phase 1-25 完了（123/123タスク完了 + ISS-003~009修正）・297ファイル・89,624行・104パッケージ（74 deps+30 devDeps）・型エラー0件・ESLintエラー0件・console.log 0件（CLAUDE.md基準達成）・図解タイプ拡張（5→11種）・SYSTEM_CONSTITUTION V2.2 制定・Web Workers 並列化基盤（エクスポート・レイアウトエンジン対応）・Worker信頼性改善（クラッシュループ防止・Promise漏洩解消・リスナークリーンアップ）・APNG実エンコーダ統合・JWT署名検証修正（jwt.decode→jwt.verify）・セキュリティ・堅牢性修正完了（ISS-003~009: パストラバーサル防止・バッチ入力検証・ジョブストア上限・ブラウザセーフメモリユーティリティ・再試行多様化・配列成長制限）・第134回要件検証（109要件・Phase 25完了・ISS-010~012をPhase 26候補として特定）

**移行元**: `docs/spec/speech-to-visuals/requirements.md`（第20回検証済、2026-04-30）

## 関連文書

- **分析記録**: [interview-record.md](interview-record.md)
- **ユーザストーリー**: [user-stories.md](user-stories.md)
- **受け入れ基準**: [acceptance-criteria.md](acceptance-criteria.md)
- **コンテキストノート**: [note.md](note.md)
- **準備タスク**: [prep.md](prep.md)
- **設計文書**: [architecture.md](architecture.md)

## 機能要件（EARS記法）

**【信頼性レベル凡例】**:

- 🔵 **青信号**: PRD・既存要件定義書・設計文書・既存実装を参考にした確実な要件
- 🟡 **黄信号**: PRD・既存要件定義書・設計文書・既存実装から妥当な推測による要件
- 🔴 **赤信号**: 参照資料にない自動推定による要件

### 通常要件

#### 音声認識・文字起こし ✅実装済

- REQ-001: システムは MP3/WAV/OGG/M4A 形式の音声ファイル（最大50MB）を受け取り、Whisper モデルを用いてタイムスタンプ付きテキストに文字起こししなければならない 🔵 *PIPELINE_FLOW.md Stage 1・README.md より*
- REQ-002: システムは Web Speech API を用いたブラウザベースのリアルタイム文字起こしをサポートしなければならない 🔵 *src/transcription/browser-transcriber.ts・SYSTEM_CORE.md より*
- REQ-003: システムは日本語・英語の自動言語検出を行い、適切な言語モデルを選択しなければならない 🔵 *PIPELINE_FLOW.md・src/analysis/language-detector.ts より*
- REQ-004: システムは文字起こし結果を SRT 形式のキャプションファイルとして出力しなければならない 🔵 *PIPELINE_FLOW.md Stage 1 より*

#### 内容分析・図解検出 ✅実装済

- REQ-005: システムは文字起こしテキストを意味単位のセグメント（3-15秒）に分割しなければならない。セマンティックセグメンテーション（Jaccard係数によるキーワード類似度マージ）およびトピックベースセグメンテーション（コサイン類似度によるトピックベクトルクラスタリング）をサポートし、日本語・英語のトピック遷移パターンを検出すること 🔵 *PIPELINE_FLOW.md Stage 2・src/analysis/scene-segmenter.ts より*
- REQ-006: システムは Gemini LLM（gemini-2.5-flash / gemini-2.5-pro）を用いて内容分析を行い、エンティティ抽出・関係性抽出・図解タイプ検出を実行しなければならない 🔵 *SYSTEM_CORE.md §4.1・src/analysis/gemini-analyzer.ts より*
- REQ-007: システムは図解タイプとして flow/tree/timeline/matrix/cycle の5種類に加え、flowchart/comparison/network/conceptmap/mindmap/general の6種類（計11種類）を検出・判定しなければならない 🔵 *README.md 図解タイプ・src/analysis/diagram-detector.ts・src/types/diagram.ts より*
- REQ-008: システムはコンテンツの複雑さをスコアリングし、スコア20%未満は Flash、20%以上は Pro を自動選択しなければならない 🔵 *PIPELINE_FLOW.md §5.3・src/analysis/complexity-detector.ts より*

#### フォールバック・耐障害性 ✅実装済

- REQ-009: システムは LLM 呼び出し失敗時に3層フォールバック（Primary LLM → Fallback LLM → ルールベース V1）を提供し、常に結果を出力しなければならない 🔵 *SYSTEM_CORE.md §4.2・PIPELINE_FLOW.md §4.1 より*
- REQ-010: システムは LLM API 呼び出し時のレートリミットに対し、ジッタ付き指数バックオフ（最大3回リトライ）を実行しなければならない 🔵 *PIPELINE_FLOW.md §4.2・src/analysis/llm-service.ts より*
- REQ-011: システムはセマンティックキャッシュ（類似度閾値0.9、200エントリ、TTL 120分）により、同一または類似コンテンツの再分析を回避しなければならない 🔵 *PIPELINE_FLOW.md §5.1・src/analysis/llm-cache.ts より*

#### 図解レイアウト ✅実装済

- REQ-012: システムは検出された図解タイプに応じて最適なレイアウト戦略（Flow/Tree/Timeline/Matrix/Cycle + Flowchart/Comparison/Network/ConceptMap/Dagre/Fallback + GridSnap/ProgressiveForce/SimulatedAnnealing の計21戦略）を自動選択し、ノード配置を計算しなければならない。レイアウト品質評価・最適化パイプラインによる自動改善を含む。反復パラメータ（iteration）を指定して段階的にレイアウトを改善できること 🔵 *src/visualization/strategy-selector.ts・src/visualization/strategies/・src/visualization/layout/strategies/・PIPELINE_FLOW.md Stage 3 より*
- REQ-013: システムは全ノードペアのオーバーラップを検出し、フォースダイレクト法（最大100回反復）でオーバーラップをゼロに解消しなければならない。レイアウト計算時、エッジのsource/targetが既存ノードIDに存在しない場合は当該エッジを除外して計算すること 🔵 *src/visualization/overlap-resolver.ts・src/workers/layout-worker.ts・QUALITY_METRICS.md §3.3 より*
- REQ-014: システムはキャンバスサイズ（1920x1080基準）を自動計算し、全要素をセンタリングして出力しなければならない 🔵 *src/visualization/canvas-calculator.ts・PIPELINE_FLOW.md Stage 3 より*

#### 自動改善フレームワーク 🔵実装済

- REQ-015: システムは処理結果の品質を自動評価し、改善が必要な場合は再処理を実行して品質を向上させなければならない 🔵 *src/framework/auto-improvement-engine.ts・ITERATION_LOG より*
- REQ-016: システムは過去の処理結果から学習し、品質改善パターンを継続的に蓄積しなければならない 🔵 *src/framework/continuous-learner.ts・ITERATION_LOG より*
- REQ-017: システムはフェーズベースの改善サイクルを管理し、現在のフェーズ（Phase 42+）を追跡しなければならない 🔵 *src/framework/iteration-manager.ts より*

#### 品質保証・監視 🔵実装済

- REQ-018: システムは各処理ステージの品質スコアを追跡し、ステージ間の品質ゲートを通過確認しなければならない 🔵 *src/quality/quality-monitor.ts・src/quality/adaptive-quality-gates.ts より*
- REQ-019: システムはコンテンツ複雑度に応じて品質閾値を動的に調整する適応型品質ゲートを提供しなければならない 🔵 *src/quality/adaptive-quality-gates.ts より*
- REQ-020: システムは5%を超える品質低下（リグレッション）を検出し、デプロイをブロックしなければならない 🔵 *src/quality/regression-detector.ts より*
- REQ-021: システムは3層フォールバックに加えて低品質設定での再試行による多層エラー回復を提供し、CircuitBreaker パターンによる障害検知とグレースフルシャットダウン（30秒タイムアウト）をサポートしなければならない 🔵 *src/quality/enhanced-error-recovery.ts より*

#### プロダクション監視 🔵実装済

- REQ-022: システムは全コンポーネントのヘルスチェックを定期実行し、障害を早期検出しなければならない 🔵 *src/monitoring/health-check-service.ts より*
- REQ-023: システムは処理時間・成功率・エラー率のリアルタイムダッシュボードを提供しなければならない 🔵 *src/monitoring/performance-dashboard.ts・src/monitoring/production-monitor.ts より*
- REQ-024: システムはパフォーマンス指標の P50/P95/P99 レイテンシを計測・記録しなければならない 🔵 *src/monitoring/real-time-performance-monitor.ts より*

#### 動画レンダリング・アニメーション ✅実装済

- REQ-025: システムは Remotion 4.0 を用いて図解ノードのフェードイン（0.3秒）・スケールアニメーションを生成しなければならない 🔵 *src/remotion/NodeAnimation.tsx・src/remotion/EdgeAnimation.tsx より*
- REQ-026: システムはエッジの SVG パス描画アニメーション（0.5秒、stroke-dasharray/dashoffset 方式）を生成しなければならない 🔵 *src/remotion/EdgeAnimation.tsx より*
- REQ-027: システムは図解タイプ別（flow/tree/timeline/matrix/cycle）のアニメーション戦略を自動選択し、ノード・エッジのタイミング・シーケンスを制御しなければならない 🔵 *src/remotion/animation-strategies.ts より*
- REQ-028: システムは SRT キャプションファイルをパースし、タイムスタンプをフレーム番号に変換してキャプションオーバーレイを表示しなければならない 🔵 *src/remotion/srt-parser.ts・src/remotion/CaptionOverlay.tsx より*
- REQ-029: システムは SRT キャプションとシーンアニメーションを同期し、±50ms の許容誤差でドリフトを検出しなければならない 🔵 *src/remotion/scene-synchronizer.ts より*
- REQ-030: システムは Remotion renderMedia() API を用いて 720p/1080p/4K 解像度、30/60 FPS、H.264/H.265/VP9 コーデックで動画をレンダリングしなければならない 🔵 *src/remotion/renderer.ts より*

#### パイプライン UI ✅実装済

- REQ-031: システムは SimplePipeline インターフェース（ファイルアップロード→文字起こし→分析→動画生成）を提供し、4段階の進捗表示を行わなければならない 🔵 *src/components/SimplePipelineInterface.tsx・src/components/SimplePipelineStateMachine.ts より*
- REQ-032: システムはドラッグ＆ドロップによる音声ファイルアップロード（MP3/WAV/OGG/M4A、最大50MB バリデーション付き）をサポートしなければならない 🔵 *src/components/EnhancedFileUploader.tsx・src/components/SimplePipelineInterface.tsx より*
- REQ-033: システムはパイプライン処理の進捗表示（アップロード→文字起こし→分析→生成）をリアルタイムで可視化しなければならない 🔵 *src/components/PipelineProgress.tsx・src/components/SimplePipelineInterface.tsx より*
- REQ-034: システムはキーボードショートカット（Ctrl+O ファイル選択、Ctrl+Enter 処理開始、Esc リセット）をサポートしなければならない 🔵 *src/components/SimplePipelineInterface.tsx より*
- REQ-035: システムはパイプライン結果（シーン、トランスクリプト、メトリクス）を表示し、ビデオプレビューを提供しなければならない 🔵 *src/components/VideoPreview.tsx・src/components/SimplePipelineInterface.tsx より*

#### 拡張モジュール ✅実装済

- REQ-036: システムはストリーミング音声文字起こしをサポートし、音声データをチャンク単位で逐次処理してリアルタイムにテキストを出力しなければならない 🔵 *src/transcription/streaming-transcriber.ts より*
- REQ-037: システムはエラー発生時にユーザーが回復方法を選択できる対話型エラー回復を提供しなければならない 🔵 *src/quality/user-guided-error-recovery.ts より*
- REQ-038: システムは Zod スキーマを用いて環境変数・設定値の起動時バリデーションを実行し、不正設定時は即座にエラーで終了しなければならない 🔵 *src/config/validate.ts・src/config/schema.ts より*
- REQ-039: システムは処理結果のメトリクスに基づいてパイプラインパラメータを自動チューニングし、最適な品質・性能バランスを維持しなければならない 🔵 *src/optimization/smart-parameter-tuner.ts・src/optimization/adaptive-content-processor.ts より*

#### エラー分類・品質ゲート 🔵実装済

- REQ-040: システムはエラーを11種類（FILE_FORMAT_INVALID/FILE_SIZE_EXCEEDED/LLM_API_ERROR/LLM_RATE_LIMITED/LLM_TIMEOUT/RENDERING_ERROR/RENDERING_OOM/NETWORK_ERROR/STORAGE_ERROR/QUALITY_GATE_FAILED/UNKNOWN）に分類し、4段階の重大度（low/medium/high/critical）と復旧可能性を判定しなければならない 🔵 *src/quality/error-classifier.ts より*
- REQ-041: システムは5段階パイプライン（文字起こし→分析→レイアウト→レンダリング準備→レンダリング）の各ステージに対して品質ゲート評価を実行し、基準未達の場合はブロックしなければならない 🔵 *src/quality/quality-gate.ts より*
  - ステージ1（文字起こし）: 音声長 ≥ 1.0秒、サンプリングレート ≥ 16000Hz、ノイズレベル < -30dB
  - ステージ2（分析）: エンティティ抽出率 ≥ 80%、関係性完全性 ≥ 70%、スキーマ適合率 = 100%
  - ステージ3（レイアウト）: オーバーラップ = 0、タイムライン連続性 = 1.0、セグメント正規化 = 1.0
  - ステージ4（レンダリング準備）: キャプション同期 ≤ 50ms、レイアウト一貫性 ≥ 0.9
  - ステージ5（レンダリング）: 解像度高さ ≥ 720p、FPS = 30、音声同期 ≤ 50ms

#### パイプラインオーケストレーション 🔵実装済

- REQ-042: システムは5段階パイプライン（文字起こし→内容分析→レイアウト生成→動画準備→動画レンダリング）を統合実行するパイプラインオーケストレーターを提供し、各ステージで品質ゲート評価とフォールバック戦略を実行しなければならない 🔵 *src/pipeline/pipeline-orchestrator.ts より*

#### バッチ処理 REST API 🔵実装済

- REQ-043: システムは REST API（POST /batch/jobs でバッチジョブ作成、GET /batch/jobs/:id でステータス取得、DELETE /batch/jobs/:id でキャンセル）を提供し、セマフォパターンで最大3並列ジョブを制御しなければならない 🔵 *src/api/routes/batch.ts より*

#### Edge Functions 共通基盤 🔵実装済

- REQ-044: システムは Supabase Edge Functions 向けに JWT ベースの共有認証モジュール（Bearer トークン抽出・検証・期限切れ検出）を提供し、全 Edge Function で共通利用しなければならない 🔵 *supabase/functions/_shared/auth.ts より*
- REQ-045: システムは Edge Functions 向けに統一エラーレスポンス（CORS ヘッダー管理・エラー分類・AbortController タイムアウト・必須フィールド検証）を提供しなければならない 🔵 *supabase/functions/_shared/error-handler.ts より*

#### WebSocket リアルタイム通知 🔵実装済

- REQ-046: システムは Socket.IO を用いて WebSocket ベースのリアルタイム進捗通知（ジョブ進捗・完了・エラー・ファイルステータス・ステージ進捗・ストリーミングセグメント・エラー回復イベント）を提供し、JWT 認証で接続を保護し、ジョブルーム（join:job/leave:job）による購読管理を行わなければならない 🔵 *src/api/websocket-handler.ts より*

#### 最適化ユーティリティ 🔵実装済

- REQ-047: システムは並列チャンク処理によるバッチ最適化（設定可能な並列度・チャンクサイズ・フェイルファスト・進捗コールバック）を提供し、大量データの効率的な処理をサポートしなければならない 🔵 *src/optimization/batch-optimizer.ts より*
- REQ-048: システムは高コストな計算結果のメモ化キャッシュ（TTL有効期限・タグベース無効化・LRU退行・最大200エントリ）と、汎用LRUメモリキャッシュ（設定可能サイズ・TTL・定期クリーンアップ・ヒット率統計）を提供しなければならない 🔵 *src/optimization/computation-cache.ts・src/optimization/memory-cache.ts より*
- REQ-049: システムは重いモジュールの遅延読み込み（動的インポートキャッシュ・同時ロード重複排除・プリロード・無効化・統計情報）を提供し、初期ロード時間を最適化しなければならない 🔵 *src/optimization/lazy-loader.ts より*

#### グレースフルシャットダウン 🔵実装済

- REQ-050: システムはシャットダウン要求時にアクティブリクエストの完了を待機（最大30秒タイムアウト）し、ヘルスモニタリングの停止・リクエストキューのクリア・サーキットブレーカーのリセットを実行して安全に終了しなければならない 🔵 *src/quality/enhanced-error-recovery.ts shutdown() メソッドより*

#### 型ガード・型安全性 🔵実装済

- REQ-051: システムは図解タイプ（DiagramType）の型ガード関数（isDiagramType）を提供し、実行時に不正な図解タイプ値を検出・排除しなければならない 🔵 *src/types/diagram.ts より*

#### 追加 UI 機能 🔵実装済

- REQ-052: システムはインタラクティブなチュートリアルシステム（マルチステップ・カテゴリ分け・難易度別・進捗追跡・LocalStorage永続化）を提供し、新規ユーザーのオンボーディングをサポートしなければならない 🔵 *src/components/TutorialSystem.tsx より*
- REQ-053: システムは Standard/Streaming の2つのパイプライン実行モードを提供し、ユーザーがモード切替可能なマルチモードパイプラインインターフェースを提供しなければならない 🔵 *src/pages/Index.tsx・src/components/StreamingProcessor.tsx より*
- REQ-054: システムはフレームワークパイプラインの実行状況（イテレーション追跡・品質メトリクス・フェーズ評価・改善推奨可視化）をリアルタイムで表示するダッシュボードを提供しなければならない 🔵 *src/components/FrameworkDashboard.tsx・src/components/FrameworkDashboardPage.tsx より*
- REQ-055: システムはプロダクション設定の管理・監視・最適化を行うダッシュボード（設定編集・パフォーマンスレポート・最適化ステータス）を提供しなければならない 🔵 *src/components/ProductionDashboard.tsx より*
- REQ-056: システムはセマンティックキャッシュのコールドスタートを検出し、代表的なクエリパターン（英語・日本語）によるキャッシュウォームアップ戦略を自動実行し、ウォームアップ前後のヒット率改善を統計追跡しなければならない 🔵 *src/optimization/cache-warmup.ts より*
- REQ-057: システムはパイプライン操作用 REST API エンドポイント（POST /api/render で動画レンダリング、POST /api/git/commit で自動コミット、GET /api/iteration-log でイテレーションログ取得、GET /api/framework/status でフレームワークステータス取得）を提供しなければならない 🔵 *src/hooks/useFrameworkPipeline.ts・src/components/pipeline-interface.tsx・src/components/FrameworkDashboard.tsx より*

#### 高度エクスポート・キャッシュ・改善検出 🔵実装済

- REQ-058: システムは高度なエクスポートエンジンを提供し、Interactive-HTML・Animated-SVG・Animated-PDF・JSON-Lottie・WebM・GIF・APNG 形式での出力と、HDR・ウォーターマーク・5段階圧縮・4段階最適化優先度の設定をサポートしなければならない。dispose時にキュー内の未処理エクスポートジョブのPromiseをエラー結果で解決し、Promiseが永久に保留されないこと 🔵 *src/export/enhanced-export-engine.ts・src/export/production-exporter.ts・src/export/export-ui.tsx より*
- REQ-059: システムはインテリジェントキャッシュ（LRU-Wアルゴリズム・コンテンツフィンガープリント・予測的プリロード・LZ圧縮・ユーティリティスコアリング）を提供し、キャッシュヒット率の最適化を自動実行しなければならない 🔵 *src/performance/intelligent-cache.ts より*
- REQ-060: システムはパイプライン処理結果から改善機会を自律的に検出し、トレンド分析（improving/stable/degrading）・ボトルネック特定・優先度スコアリング・アクション可能な推奨事項（工数見積もり付き）を生成しなければならない 🔵 *src/pipeline/improvement-detector.ts より*

#### Web Workers 並列化 🔵実装済

- REQ-061: システムはCPU集約処理（エクスポートレンダリング・レイアウトノード配置計算）をWeb Workersで並列化し、メインスレッドのブロッキングを防止しなければならない。WorkerPoolによるワーカー再利用・タスクキューイング・異常終了時自動再生成（最大5回クラッシュでスロット除去）・遅延初期化・dispose/再利用ガード・アクティブタスクPromiseのterminate時拒否・キュー済みジョブPromiseのdispose時解決・per-task error listener クリーンアップを実装し、Worker利用不可環境ではメインスレッドにフォールバックすること。isWorkerEnabledはuseWebWorkers設定がfalseの場合はfalseを返すこと。エクスポートパラメータ（FPS/duration）は負値をガード（Math.max）すること 🔵 *src/workers/worker-pool.ts・src/export/enhanced-export-engine.ts・src/visualization/complex-layout-engine.ts・src/workers/export-worker.ts・TASK-0114~0116 より*

#### Worker統合テスト ✅実装済

- REQ-062: システムはWorkerPoolのフル crash→recovery ライフサイクルを検証する統合テストを提供しなければならない。クラッシュ発生→自動再生成→キュー内タスクの再ディスパッチ→正常完了→複数回クラッシュ→スロット除去の全流れをカバーすること ✅ *コミットbc3cf68・tests/integration/worker-pool.test.ts より*
- REQ-063: システムはAPNG形式の実エンコーディングを検証するテストを提供しなければならない。カスタムAPNGエンコーダ（PNGシグネチャ・acTL/fcTL/fdATチャンク・フレーム遅延精度）の包括的テストで検証済 ✅ *src/export/apng-encoder.ts・src/export/__tests__/enhanced-export-engine.test.ts TASK-0117 より*

#### セキュリティ・入力検証（Phase 25+） 🔵実装済 / 📋一部候補

- REQ-064: システムはバッチ API の jobId パラメータ（req.params.jobId）を UUID v4 形式で検証し、不正な形式の場合は 400 エラーを返さなければならない。検証はジョブステータス取得（GET /jobs/:jobId）とキャンセル（POST /jobs/:jobId/cancel）の両ルートで実行すること 📋候補 *ISS-010 HIGH・src/api/routes/batch.ts lines 299, 314・.audit/purpose_driven_plan.yml より*
- REQ-065: システムは適応型品質ゲートの gates 配列に対して上限値（最大50ゲート）を設定し、上限超過時は追加を拒否しなければならない 📋候補 *ISS-011 MEDIUM・src/quality/adaptive-quality-gates.ts line 161・.audit/purpose_driven_plan.yml より*
- REQ-066: システムはブラウザコンテキストで動作するコード（production-config.ts）において process.env へのアクセスを安全にガードし、Vite ビルド時の静的置換に依存しない場合はランタイム参照を避けなければならない 📋候補 *ISS-012 MEDIUM・src/config/production-config.ts lines 80, 284, 291・.audit/purpose_driven_plan.yml より*

### 条件付き要件

- REQ-101: LLM API が利用できない場合、システムはルールベース V1（文分割によるシーケンシャル図解）にフォールバックしなければならない 🔵 *SYSTEM_CORE.md §4.2・PIPELINE_FLOW.md §3 Stage 2 より*
- REQ-102: 音声ファイルが空または破損している場合、システムはエラーメッセージを返し、処理を安全に中止しなければならない 🔵 *PIPELINE_FLOW.md §7.2 Abort Conditions より*
- REQ-103: キャッシュヒット（類似度 > 0.9）があった場合、システムは LLM 呼び出しをスキップし、キャッシュされた結果を返さなければならない 🔵 *PIPELINE_FLOW.md §5.1 より*
- REQ-104: 環境変数 `ANALYSIS_DISABLE_GEMINI` が 1 の場合、システムは強制的にルールベース分析を使用しなければならない 🔵 *PIPELINE_FLOW.md §8.1 より*

### 状態要件

- REQ-201: バッチ処理が進行中の場合、システムは各ジョブの進捗率・ETA・品質スコアをリアルタイムで提供しなければならない 🔵 *src/api/batch-processing-api.ts・README.md バッチ処理セクションより*
- REQ-202: キャッシュがコールドスタート状態の場合、システムはウォームアップ戦略を実行し、キャッシュヒット率の改善を追跡しなければならない 🔵 *src/optimization/cache-warmup.ts・QUALITY_METRICS.md §4.2 より*
- REQ-203: リグレッションが検出された場合、システムは該当変更のデプロイをブロックし、通知を発信しなければならない 🔵 *src/quality/regression-detector.ts より*

### オプション要件

- REQ-301: システムは動画レンダリング時に解像度（1080p/720p/4K）、FPS（30/60）、コーデック（H.264/H.265/VP9）を設定できるようにしてもよい 🔵 *PIPELINE_FLOW.md §8.2 PipelineOptions・src/remotion/renderer.ts より*
- REQ-302: システムは図解データを SVG/PNG/PDF/Interactive-HTML/Animated-SVG/Animated-PDF/JSON-Lottie/WebM/GIF/APNG/MP4 形式でエクスポートしてもよい。HDR出力・ウォーターマーク・圧縮レベル設定（none/low/medium/high/maximum）・最適化優先度（speed/balanced/quality/size）をサポートすること 🔵 *src/export/multi-format-exporter.ts・src/export/enhanced-export-engine.ts・src/export/export-ui.tsx より*
- REQ-303: システムは多言語対応として ES/FR/DE/ZH を追加してもよい 🟡 *QUALITY_METRICS.md §6.2・SYSTEM_CORE.md §9 Phase 44-45 より*
- REQ-304: システムはモバイルデバイス向けにレスポンシブ UI を提供してもよい 🔵 *src/components/SimplePipelineInterface.tsx モバイルレスポンシブ対応・src/components/EnhancedFileUploader.tsx モバイルタッチ操作対応・src/components/__tests__/mobile-responsive.test.ts・TASK-0076 より*
- REQ-305: システムはグローバルエラーアラートシステム（自動非表示・11カテゴリ分類・エラー重大度表示）を提供してもよい 🔵 *src/components/ErrorAlertSystem.tsx・App.tsx より*

### 制約要件

- REQ-401: システムは Node.js 18+、TypeScript 5.8+、React 18.3+ で動作しなければならない 🔵 *SYSTEM_CONSTITUTION.md・package.json より*
- REQ-402: システムの音声ファイル最大サイズは 50MB としなければならない 🔵 *README.md・PIPELINE_FLOW.md §7.2 より*
- REQ-403: システムのメモリ使用量はピーク時 512MB 以下を維持しなければならない 🔵 *QUALITY_METRICS.md §4.2・README.md メモリ82.21MB実績より*
- REQ-404: Gemini API キーは環境変数 `GOOGLE_API_KEY` で管理し、ソースコードにハードコードしてはならない 🔵 *README.md 環境変数セクション・PIPELINE_FLOW.md §8.1 より*
- REQ-405: Supabase のデータベースアクセスは Row Level Security（RLS）で保護しなければならない 🔵 *supabase/migrations/ より*

## 非機能要件

### パフォーマンス

- NFR-001: 1分間の音声に対するエンドツーエンド処理時間は60秒以内でなければならない 🔵 *QUALITY_METRICS.md §2.1（実績25.2秒）より*
- NFR-002: 図解レイアウト計算は1図解あたり2秒以内に完了しなければならない 🔵 *QUALITY_METRICS.md §3.3 より*
- NFR-003: 動画レンダリング速度はリアルタイムの0.5倍以上（37-45 FPS）でなければならない 🔵 *README.md レンダリング速度・QUALITY_METRICS.md §3.5 より*
- NFR-004: LLM API レスポンス時間の P95 は20秒以内でなければならない 🔵 *QUALITY_METRICS.md §3.2.1 より*

### セキュリティ

- NFR-101: API キー・認証情報は環境変数で管理し、ログに出力してはならない 🔵 *PIPELINE_FLOW.md §8.1・CLAUDE.md より*
- NFR-102: Supabase のストレージバケットへの書き込み・削除は認証済みユーザーのみ可能としなければならない 🔵 *supabase/migrations/ RLS ポリシーより*
- NFR-103: バッチ処理 API は Express Rate Limit（express-rate-limit）と Helmet によるセキュリティヘッダーを適用しなければならない 🔵 *package.json 依存関係・src/api/ より*

### ユーザビリティ

- NFR-201: Web UI は音声ファイルのドラッグ＆ドロップアップロードをサポートしなければならない 🔵 *src/components/EnhancedFileUploader.tsx より*
- NFR-202: 処理進捗はリアルタイムで表示し、各ステージ（文字起こし→分析→レイアウト→動画）の状況を可視化しなければならない 🔵 *src/components/SimplePipelineInterface.tsx・README.md より*
- NFR-203: エラー発生時はユーザーに分かりやすいエラーメッセージとリカバリガイダンスを提供しなければならない 🟡 *src/quality/enhanced-error-recovery.ts から妥当な推測*

### 信頼性

- NFR-301: システム全体の成功率は95%以上を維持しなければならない 🔵 *QUALITY_METRICS.md §4.1（実績100%）より*
- NFR-302: レイアウトのオーバーラップ数は常に0でなければならない 🔵 *QUALITY_METRICS.md §3.3・SYSTEM_CORE.md §4.3 より*
- NFR-303: エンティティ抽出の F1 スコアは80%以上を維持しなければならない 🔵 *QUALITY_METRICS.md §3.2（実績85%）より*
- NFR-304: 関係性抽出の精度は85%以上を維持しなければならない 🔵 *QUALITY_METRICS.md §3.2（実績90%）より*

### 監視性

- NFR-401: システムは全コンポーネントのヘルスステータスをリアルタイムで監視し、異常を検知しなければならない 🔵 *src/monitoring/health-check-service.ts より*
- NFR-402: システムはパフォーマンス指標の P50/P95/P99 を計測・記録し、ダッシュボードで可視化しなければならない 🔵 *src/monitoring/real-time-performance-monitor.ts より*
- NFR-403: システムはリグレッション検出時に自動でデプロイブロックと通知を行わなければならない 🔵 *src/quality/regression-detector.ts より*

### コスト効率

- NFR-501: 1動画あたりの API コストは $0.10 以下を維持しなければならない 🔵 *QUALITY_METRICS.md §4.3（実績$0.03）より*

## Edgeケース

### エラー処理

- EDGE-001: 空の音声ファイルがアップロードされた場合、システムは即座にエラーを返し処理を中止しなければならない 🔵 *PIPELINE_FLOW.md §7.2 Abort Conditions より*
- EDGE-002: 破損した音声ファイルがアップロードされた場合、システムはエラーを検出しユーザーに通知しなければならない 🔵 *PIPELINE_FLOW.md §7.2 より*
- EDGE-003: LLM API がレートリミットを返した場合、システムはジッタ付き指数バックオフで最大3回リトライし、失敗時はフォールバックしなければならない 🔵 *PIPELINE_FLOW.md §4.2 より*
- EDGE-004: Remotion レンダリングが失敗した場合、システムは低品質設定で再試行しなければならない 🔵 *PIPELINE_FLOW.md §4.1 Table・src/remotion/renderer.ts より*
- EDGE-005: 品質スコアが閾値を下回った場合、システムは低品質設定で自動再試行しなければならない 🔵 *src/quality/enhanced-error-recovery.ts より*

### 境界値

- EDGE-101: 50MB ギリギリの音声ファイルでも正常に処理できなければならない 🔵 *README.md・PIPELINE_FLOW.md §7.2 より*
- EDGE-102: 非常に短い音声（1秒未満）はエラーとして処理しなければならない 🔵 *PIPELINE_FLOW.md §7.1 Quality Gates より*
- EDGE-103: 1時間を超える音声ファイルは処理前に警告を表示しなければならない 🟡 *PIPELINE_FLOW.md §7.1 Quality Gates から妥当な推測*

## 実装進捗サマリー

| フェーズ | ステータス | タスク範囲 | 完了率 |
|---------|-----------|-----------|--------|
| Phase 1: 基盤・データ層 | ✅完了 | TASK-0001~0010 | 10/10 |
| Phase 2: AI・処理モジュール | ✅完了 | TASK-0011~0022 | 12/12 |
| Phase 3: レイアウト・可視化 | ✅完了 | TASK-0023~0031 | 9/9 |
| Phase 4: レンダリング・FE | ✅完了 | TASK-0032~0042 | 11/11 |
| Phase 5: 統合・テスト | ✅完了 | TASK-0043~0060 | 18/18 |
| Phase 6: 高度レイアウト・拡張タイプ | ✅完了 | TASK-0061~0066 | 6/6 |
| Phase 7: コード品質改善 | ✅完了 | TASK-0067~0070 | 4/4（ESLint strict型安全性・テストリソースリーク修正） |
| Phase 8: 品質検証・ギャップ解消 | ✅完了 | TASK-0071~0076 | 6/6（キャッシュウォームアップ・セマンティックセグメンテーション・モバイル対応・API統合・受け入れテストスイート） |
| TASK-0076: モバイルレスポンシブUI改善 | ✅完了 | TASK-0076 | 1/1（EnhancedFileUploader・PipelineProgress・StageIndicator・VideoPreviewのモバイル対応・テスト223行追加） |
| Phase 9: テスト安定性改善 | ✅完了 | TASK-0077~0078 | 2/2（200ノードレイアウト性能最適化・テストタイマーリーク解消・1761テスト全通過） |
| 型エラー解消・拡張 | ✅完了 | 44ファイル修正 | 237件→0件・図解11種化・シャットダウン追加 |
| 追加型安全性改善 | ✅完了 | 24ファイル修正 | 160件TypeScript strict型エラー解消（コミットa583a5c） |
| Phase 10: メンテナンス・最適化 | ✅完了 | TASK-0079~0081 | 3/3（依存パッケージ更新・レガシードキュメントクリーンアップ・テストカバレッジ改善） |
| Phase 11: カバレッジ向上・保守 | ✅完了 | TASK-0082~0084 | 3/3（分析・フレームワーク層テスト拡充・可視化・UI・トランスクリプション層テスト追加・overview.md更新） |
| 品質改善: null guards | ✅完了 | enhanced-error-recovery.ts | CircuitBreaker recordFailure()統合・assessInputComplexity null guard追加 |
| テスト追加: AdvancedVisualEngine | ✅完了 | advanced-visual-engine.test.ts | 794行・AdvancedVisualEngine 包括的テスト追加 |
| テスト改善: 型安全性 | ✅完了 | 4テストファイル | unsafe any casts を型安全な代替に置換（auto-improvement-engine, continuous-learner, intelligent-cache, pipeline-quality-monitor） |
| 依存更新: バージョン更新 | ✅完了 | package.json | 27パッケージのバージョン更新 |
| Phase 12: 品質・整合性確認 | ✅完了 | TASK-0085~0088 | 4/4（ESLint 0エラー・全テスト通過・依存更新・overview正確性確認） |
| Phase 13: 品質回復・保守 | ✅完了 | TASK-0089~0093 | 5/5（ESLint 113件修正・TypeScript型エラー8件修正・テストワーカー終了警告解消・依存パッケージ11件メジャーアップデート・overview正確性確認） |
| Phase 14: 既知の問題解消・カバレッジ改善 | ✅完了 | TASK-0094~0097 | 4/4（拡張レイアウトw/hプロパティ統一・エッジfrom/to統一・VideoPreviewテスト885行追加・npm audit脆弱性0件解消・Vite 6アップデート） |
| Phase 15: 品質維持・保守 | ✅完了 | TASK-0098~0101 | 4/4（KNOWN_ISSUESステータス更新・拡張レイアウトテストカバレッジ改善・低カバレッジモジュールテスト拡充・ブランチカバレッジ75%到達） |
| Phase 16: 品質メンテナンス | ✅完了 | TASK-0102~0105 | 4/4（テストワーカー警告完全解消・低ブランチカバレッジモジュールテスト拡充・SYSTEM_CONSTITUTION.md メトリクス更新・overview.md更新） |
| Phase 17: 未追跡要件検証 | ✅完了 | TASK-0106~0108 | 3/3（EnhancedExportEngine検証・IntelligentCache検証・ImprovementDetector検証） |
| Phase 18: ドキュメント整合性・残存品質課題 | ✅完了 | TASK-0109~0110 | 2/2（overview.mdメトリクス最新化・Jest globalTeardown追加・ワーカー警告対応） |
| Phase 19: 品質安定化・型安全性 | ✅完了 | TASK-0111~0113 | 3/3（テスト型エラー44件修正・E2Eベンチマーク安定化・ドキュメント精度改善） |
| Phase 20: Web Workers 並列化 | ✅完了 | TASK-0114~0116 | 3/3（Worker基盤インフラ構築・CPU集約処理のWorker化・統合テストとパフォーマンス検証） |
| Worker信頼性改善 | ✅完了 | dce48c8~4a944fe | 4コミット（クラッシュループ防止・Promise漏洩解消・リスナークリーンアップ・負値パラメータガード・エッジ検証） |
| Phase 21: エクスポート実エンコーディング・要件完了 | ✅完了 | TASK-0117~0118 | 2/2（APNG実エンコーダ統合・要件・ドキュメント整合性更新） |
| Phase 22: ESLint回帰修正 | ✅完了 | TASK-0119 | 1/1（Workerテスト4ファイル48件no-explicit-any解消・全品質基準達成） |
| Phase 23: テスト型エラー修正 | ✅完了 | TASK-0120 | 1/1（テストファイル38件TypeScript型エラー解消・全品質基準達成） |
| Phase 24: 品質維持・コードクリーンアップ | ✅完了 | TASK-0121~0123 | 3/3（console.log 717件削除→0件・コード規模89,624行(90K以下)・メトリクス更新） |
| Phase 25: セキュリティ・堅牢性改善 | ✅完了 | ISS-003~009 | 7/7（パストラバーサル防止・バッチ入力検証・ジョブストア上限・ブラウザセーフメモリユーティリティ・localStorageガード・再試行多様化・配列成長制限・JWT署名検証） |
| Phase 26: 入力検証・堅牢性継続改善 | 📋候補 | ISS-010~012 | 0/3（jobId UUID検証・品質ゲート配列上限・ブラウザセーフ環境変数） |

## 信頼性レベル分布

- 🔵 青信号: 106件 (97.2%)
- 🟡 黄信号: 3件 (2.8%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: ✅ 高品質 - 全要件が既存の設計文書・実測値・実装に基づいている（第134回kairo-requirements検証確認・Phase 1-25完了・全123タスク完了+ISS-003~009修正・REQ-001~063全要件✅実装済・REQ-064~066📋候補・全品質基準達成・console.log 0件・コード規模89,624行(90K以下)）

**既知の品質課題**: Phase 26候補 - ISS-010(バッチAPI jobId未検証 HIGH)・ISS-011(品質ゲート配列無制限成長 MEDIUM)・ISS-012(ブラウザコード内process.env参照 MEDIUM)

## Acceptance criteria

- [x] AC-1: 全23カテゴリの機能要件（音声認識・内容分析・フォールバック・図解レイアウト・自動改善・品質保証・プロダクション監視・動画レンダリング・パイプラインUI・拡張モジュール・エラー分類・パイプラインオーケストレーション・バッチ処理・Edge Functions・WebSocket・最適化・グレースフルシャットダウン・型ガード・追加UI・高度エクスポート・Web Workers並列化・Worker統合テスト・セキュリティ・入力検証）が REQ-001 ~ REQ-066 として文書化されている
- [x] AC-2: 全要件が一意の ID（REQ-xxx / NFR-xxx / EDGE-xxx）を持ち、EARS 記法（しなければならない / してもよい）で記述されている
- [x] AC-3: 全要件に信頼性レベル（🔵青信号 / 🟡黄信号 / 🔴赤信号）が付与されている
- [x] AC-4: 全要件がソース文書または実装ファイルに出典をトレースしている
- [x] AC-5: 非機能要件がパフォーマンス（NFR-001~004）・セキュリティ（101~103）・ユーザビリティ（201~203）・信頼性（301~304）・監視性（401~403）・コスト効率（501）の6属性をカバーしている
- [x] AC-6: Edgeケースがエラー処理（EDGE-001~005）と境界値（101~103）の両方をカバーしている
- [x] AC-7: EARS 分類に従い条件付き要件（REQ-101~104）・状態要件（201~203）・オプション要件（301~305）・制約要件（401~405）が文書化されている
- [x] AC-8: 実装進捗サマリーが Phase 1 ~ Phase 26 を網羅し、Phase 1-25完了・Phase 26候補の状態である
- [x] AC-9: 全要件が SYSTEM_CONSTITUTION.md の許可カテゴリ（コアパイプライン・パイプライン支援・API/通信・フロントエンドUI・監視/運用）に収まり、禁止カテゴリに違反していない
- [x] AC-10: 信頼性レベル分布（🔵/🟡/🔴の件数と割合）が文書化され、品質評価が付与されている（第134回: 🔵106件/🟡3件/🔴0件）
