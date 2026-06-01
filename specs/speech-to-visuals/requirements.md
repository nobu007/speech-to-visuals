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

**実装状況**: Phase 75 ✅完了・373ソースファイル・231テストファイル・105パッケージ(74 deps+31 devDeps)・109,639行・型エラー0件・ESLintエラー0件・console.log 0件（CLAUDE.md基準達成）・npm audit 0件・図解タイプ完全対応（11種全て専用戦略）・SYSTEM_CONSTITUTION V2.6 制定・Web Workers 並列化基盤・セキュリティ・堅牢性修正完了（ISS-003~045）・PipelineErrorRecoveryOrchestrator E2E統合テスト完了・CI煙テスト完了・PipelineAbortError構造化エラー・ErrorClassifier→orchestrator統合完了・パイプライン型付きエラー完全化・KeyphraseOverlay・CaptionOverlay統合完了・importance-aware視覚階層完了・11図解タイプ専用レイアウト戦略完了・StreamingTranscriber入力堅牢性完了・文字起こしモジュールテストカバレッジ拡充完了・187タスク全完了・テストスイート安定化完了（26+テスト障害解消・ESM互換性修正・エラー型伝播バグ修正）

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

#### セキュリティ・入力検証（Phase 25+） 🔵実装済

- REQ-064: システムはバッチ API の jobId パラメータ（req.params.jobId）を UUID v4 形式で検証し、不正な形式の場合は 400 エラーを返さなければならない。検証はジョブステータス取得（GET /jobs/:jobId）とキャンセル（POST /jobs/:jobId/cancel）の両ルートで実行すること ✅実装済 *ISS-010 HIGH・src/api/routes/batch.ts より*
- REQ-065: システムは適応型品質ゲートの gates 配列に対して上限値（最大50ゲート）を設定し、上限超過時は追加を拒否しなければならない ✅実装済 *ISS-011 MEDIUM・src/quality/adaptive-quality-gates.ts より*
- REQ-066: システムはブラウザコンテキストで動作するコード（production-config.ts）において process.env へのアクセスを安全にガードし、Vite ビルド時の静的置換に依存しない場合はランタイム参照を避けなければならない ✅実装済 *ISS-012 MEDIUM・src/config/production-config.ts より*

#### セキュリティ・堅牢性継続改善（Phase 27-30） 🔵実装済

- REQ-067: システムはユーザー入力を正規表現パターンに埋め込む前に特殊文字をエスケープし、ReDoS（Regular Expression Denial of Service）攻撃を防止しなければならない 🔵 *ISS-018 MEDIUM・src/analysis/diagram-detector.ts・src/utils/iteration-logger.ts より*
- REQ-068: システムはインテリジェントキャッシュのJSON復元時にtry-catchでエラーを捕捉し、破損データをキャッシュミスとして扱いシステムクラッシュを防止しなければならない 🔵 *ISS-019 MEDIUM・src/performance/intelligent-cache.ts より*
- REQ-069: システムはパイプライン状態管理の反復記録配列にエントリ上限（500件）を設定し、スライディングウィンドウでメモリリークを防止しなければならない 🔵 *ISS-020 MEDIUM・src/pipeline/main-pipeline.ts より*
- REQ-070: システムはブラウザコンテキストで動作するコード（complexity-detector, rule-based-analyzer, supabase/client）で process.env へのアクセスを safeEnv() ヘルパーでガードし、ランタイムエラーを防止しなければならない 🔵 *ISS-021~023 MEDIUM・src/analysis/complexity-detector.ts・src/analysis/rule-based-analyzer.ts・src/integrations/supabase/client.ts より*
- REQ-071: システムはパイプライン API（POST /api/render, POST /api/git/commit）のリクエストボディを Zod スキーマで検証し、quality列挙値・scenes上限(200)・outputName長さ(255)・fps範囲(1-120)・message長さ(1000)の制約を適用しなければならない 🔵 *src/api/routes/pipeline.ts より*
- REQ-072: システムは WebSocket join:job/leave:job イベントの jobId を UUID v4 形式で検証し、不正な形式の場合はエラーイベントを返さなければならない 🔵 *ISS-025 HIGH・src/api/websocket-handler.ts より*
- REQ-073: システムはバッチジョブ作成ルートに uploadRateLimiter（15分間20リクエスト）を、パイプライン API ルートに apiRateLimiter（15分間100リクエスト）を適用し、レート制限を強制しなければならない 🔵 *ISS-026/029 MEDIUM・src/api/server.ts より*
- REQ-074: システムはバッチ API の preset パラメータを許可値セット（standard/high-quality/presentation/social-media）で検証し、不正値は400エラーで拒否しなければならない 🔵 *ISS-027 MEDIUM・src/api/routes/batch.ts より*
- REQ-075: システムはバッチ API でカスタムエラークラス（BatchValidationError, JobNotFoundError, JobAlreadyCompletedError, TooManyFilesError）を使用し、適切なHTTPステータスコードでエラーレスポンスを返さなければならない 🔵 *ISS-028 LOW・src/api/batch-processing-api.ts より*
- REQ-076: システムは一意識別子の生成に crypto.randomUUID() を使用し、Math.random() のような予測可能な乱数生成を使用してはならない 🔵 *ISS-031 MEDIUM・6ソースファイルで crypto.randomUUID() 使用 より*
- REQ-077: システムは WebSocket イベントのペイロードを検証し、オブジェクト形式・必須フィールド・最大キー数(20)の制約を適用しなければならない 🔵 *ISS-042 MEDIUM・src/api/websocket-handler.ts より*
- REQ-078: システムはパイプライン API ルート（/api/render, /api/git/commit 等）で JWT 認証を強制し、本番環境では未認証リクエストを拒否し、開発・テスト環境ではバイパスしなければならない 🔵 *ISS-030 HIGH・src/api/server.ts より*

#### 高度図解品質エンハンスメント（Phase 31） ✅完了

- REQ-079: システムは図解レイアウトのビジュアルバランスを定量化するスコアリング機能を提供し、ノード重心偏差・象限バランス比・密度均一性を測定し、スコア0.0~1.0（1.0が最適）で評価しなければならない 🔵 *src/visualization/visual-balance-scorer.ts 実装済・13テスト通過*
- REQ-080: システムはグラフ型図解（flow/flowchart/network/conceptmap）のエッジ交差を検出し、交差数を最小化するヒューリスティクス（スプリング埋め込み・交差数カウント・エッジ再ルーティング）を適用しなければならない 🔵 *src/visualization/edge-crossing-minimizer.ts 実装済・13テスト通過*
- REQ-081: システムはノードラベルのテキスト長に基づいてフォントサイズ・行折り返し・省略表示を自動調整し、ラベルがノード境界をあふれないことを保証しなければならない 🔵 *src/visualization/smart-label-sizer.ts 実装済・13テスト通過*
- REQ-082: システムはバランススコア・交差スコア・あふれスコア・密度スコアを統合したレイアウト品質複合スコア（0.0~1.0）を算出し、パイプライン品質ゲートに統合しなければならない 🔵 *src/visualization/layout-quality-composite.ts 実装済・13テスト通過*
- REQ-083: システムは複合品質スコアが閾値（0.7）を下回る場合、レイアウト戦略の再選択・パラメータ調整・再計算を最大3回まで自動実行し、スコア改善を試みなければならない 🔵 *src/visualization/layout-auto-optimizer.ts 実装済・13テスト通過*

#### 図解品質パイプライン統合（Phase 32） ✅完了

- REQ-084: システムはパイプラインオーケストレーター Stage 3（レイアウト生成）の完了後、LayoutAutoOptimizer を呼び出して複合品質スコアを評価し、スコアが閾値（0.7）を下回る場合は自動最適化を実行しなければならない。最適化結果のスコアをパイプラインメトリクスに記録すること 🔵 *src/pipeline/pipeline-orchestrator.ts:244-254 optimizeLayoutQuality() 実装済*
- REQ-085: システムはパイプラインオーケストレーター Stage 3（レイアウト生成）で SmartLabelSizer を使用してノードラベルのフォントサイズ・折り返し・省略を自動調整し、ラベルあふれを防止しなければならない 🔵 *src/pipeline/pipeline-orchestrator.ts:251-253 applyLabelSizing() 実装済*
- REQ-086: システムは visualization/index.ts から Phase 31 全モジュール（VisualBalanceScorer, EdgeCrossingMinimizer, SmartLabelSizer, LayoutQualityCompositeScorer, LayoutAutoOptimizer）を公開エクスポートしなければならない 🔵 *src/visualization/index.ts:17-22 エクスポート済*
- REQ-087: システムは Phase 31 品質モジュールのパイプライン統合を検証するエンドツーエンドテスト（レイアウト生成→品質スコアリング→自動最適化→ラベルサイジング→レンダリング）を提供しなければならない 🔵 *tests/integration/phase32-quality-pipeline.test.ts 実装済*

#### パイプライン品質監視統合（Phase 33） ✅完了

- REQ-088: システムはパイプラインオーケストレーターの各ステージ完了時に QualityMonitor を呼び出し、ステージ別品質スコア（文字起こし精度・分析精度・レイアウト品質・レンダリング品質）を記録しなければならない 🔵 *src/pipeline/pipeline-orchestrator.ts:26,107,147-152,736-790 QualityMonitor統合済・TASK-0134完了*
- REQ-089: システムは Phase 31 品質モジュール（SmartLabelSizer・VisualBalanceScorer・EdgeCrossingMinimizer・LayoutQualityCompositeScorer・LayoutAutoOptimizer）の各コア機能に対する専用ユニットテストファイルを提供しなければならない 🔵 *tests/visualization/visual-balance-scorer.test.ts・edge-crossing-minimizer.test.ts・smart-label-sizer.test.ts・layout-quality-composite.test.ts・layout-auto-optimizer.test.ts（計1,661行）・TASK-0135完了*
- REQ-090: システムはプロダクションコード内の console.log/console.error/console.warn を構造化ログまたは適切なエラー回復パターンに置換しなければならない 🔵 *src/utils/logger.ts 構造化ログ基盤・54ファイル90件のconsole呼び出しを置換済・TASK-0136完了*

#### ストリーミング品質・音声前処理・エクスポート検証（Phase 34） ✅完了

- REQ-091: システムはストリーミング文字起こしパイプライン（StreamingProcessor + streaming-transcriber）において、各チャンクの文字起こし品質を QualityMonitor でリアルタイムに評価し、品質低下検出時にユーザーに警告を表示しなければならない 🔵 *src/transcription/streaming-quality-monitor.ts・src/transcription/streaming-transcriber.ts 実装済・TASK-0137完了・18テスト通過*
- REQ-092: システムは音声ファイルの文字起こし前にオーディオ前処理ステージを実行し、無音区間検出（発話開始/終了の自動検出）・ノイズレベル推定（SN比に基づく品質評価）・音声長バリデーション（1秒未満の拒否・1時間超の警告）を実施しなければならない 🔵 *src/transcription/audio-preprocessor.ts 実装済・TASK-0138完了・24テスト通過*
- REQ-093: システムはエクスポート完了時に出力ファイルの完全性を検証し、バイナリ形式（MP4/WebM/GIF/APNG）はファイルサイズ非ゼロ確認、SVGはXML妥当性検証、PDFはページ数確認を実行し、検証失敗時はエラーを返さなければならない 🔵 *src/export/export-verifier.ts 実装済・TASK-0139完了・26テスト通過*

#### 可視化アルゴリズム正式化・パイプライン品質統合（Phase 35） ✅完了

- REQ-094: システムはフォースダイレクト法によるレイアウトシミュレーションを提供し、Coulomb斥力・Hooke引力・速度減衰・エネルギー収束判定により、ノード重なりを自然に解消するレイアウトを生成しなければならない。ComplexLayoutEngine内の実装を正式なREQとして定義し、専用テストで検証すること 🔵 *src/visualization/complex-layout-engine.ts 既存実装（initializeForceDirectedState, stepForceDirectedSimulation, forceStateToLayout, checkConvergence）・コミット995ee7d・tests/visualization/force-directed-simulation.test.ts 17テスト通過*
- REQ-095: システムは大規模グラフ（100ノード超）のレイアウト計算において、マルチレベルグラフ粗視化（heavy-edge matching）による階層的レイアウト生成を実行し、粗視化レベルでの初期配置から段階的な精緻化（uncoarsen + refine）を行ってスケーラブルなレイアウトを生成しなければならない 🔵 *src/visualization/complex-layout-engine.ts 既存実装（coarsenGraph, coarsenOneLevel, layoutCoarsestLevel, uncoarsenAndRefine）・コミット995ee7d・tests/visualization/graph-coarsening.test.ts 15テスト通過*
- REQ-096: システムは Phase 34 機能（音声前処理・ストリーミング品質監視・エクスポート検証）と Phase 31-33 品質モジュール（ビジュアルバランス・エッジ交差・スマートラベル・複合品質スコア・自動最適化・QualityMonitor統合）のエンドツーエンド連携を検証する統合テストを提供しなければならない 🔵 *tests/integration/phase35-quality-e2e.test.ts 17テスト通過*

#### パフォーマンス最適化・コスト可視化パイプライン（Phase 36） ✅完了

- REQ-097: システムは複数図解コンテンツのレイアウト生成（Stage 3）とシーン準備（Stage 4）を並列実行し、設定可能な同時実行数（maxLayoutConcurrency, maxSceneConcurrency）で制御しなければならない。各ステージのタイミングメトリクスを記録し、全体処理時間の40%以上を占めるステージをボトルネックとして自動検出すること 🔵 *src/pipeline/parallel-layout-executor.ts・src/pipeline/bottleneck-detector.ts・src/pipeline/stage-timing-metrics.ts・TASK-0143完了*
- REQ-098: システムは LLM API 呼び出し（Gemini Flash/Pro）ごとに input/output トークン数を記録し、モデル別価格に基づくコスト推定（$ per request）・ステージ別コスト内訳・予算アラート（閾値超過時警告）を提供しなければならない。コストメトリクスを PerformanceDashboard に統合すること 🔵 *src/analysis/token-usage-tracker.ts・src/analysis/cost-estimator.ts・src/analysis/budget-alert.ts・src/analysis/llm-service.ts・TASK-0144完了*
- REQ-099: システムは各パイプラインステージのタイミングベースラインとメモリ使用量ベースラインを定義し、自動ベンチマークテストで10%以上の性能悪化（リグレッション）を検出しなければならない。並列化効果（逐次 vs 並列の高速化率）とコスト効率（$ per video, tokens per analysis）のメトリクスを追跡し、JSONレポートとして出力すること 🔵 *src/pipeline/performance-baseline.ts・src/pipeline/performance-regression-detector.ts・TASK-0145完了*
- REQ-100: システムは REST API（GET /api/v1/monitoring/metrics でダッシュボードメトリクス、GET /api/v1/monitoring/cost でLLMコスト・トークン・予算メトリクス、GET /api/v1/monitoring/trends でパフォーマンストレンド、GET /api/v1/monitoring/health でヘルスチェック）を提供し、監視データを外部からアクセス可能にしなければならない 🔵 *src/api/routes/monitoring.ts・src/api/server.ts・TASK-0146完了*

#### 監視API本組込み・コード規模監査（Phase 37） ✅完了

- REQ-101_placeholder: （REQ-101~104は条件付き要件で使用済み。Phase 37新規要件は REQ-102~ を使用予定）
- REQ-102: システムは SYSTEM_CONSTITUTION で定められたコード規模制限（ファイル数・行数）を自動監査し、制限超過時にビルド時に警告を出力しなければならない 🔵 *src/config/code-size-audit.ts・scripts/code-size-audit.ts・tests/config/code-size-audit.test.ts（27テスト通過）・TASK-0146完了*
- REQ-103: システムは監視REST APIエンドポイントの本番動作検証として、サーバー起動時にルート登録完了をログ出力し、各エンドポイントの統合テストが全て通過することを確認しなければならない 🔵 *src/api/routes/monitoring.ts・src/api/__tests__/server.test.ts・tests/analysis/budget-alert-boundary.test.ts（29テスト通過）・TASK-0147完了*

#### コード規模監査スコープ修正・ドキュメント整合性（Phase 38） ✅完了

- REQ-104: システムはコード規模監査（code-size-audit）の対象を src/ ディレクトリに限定し、テストコード（tests/）、スクリプト（scripts/）、Supabase Edge Functions（supabase/）、設定ファイル等を監査対象外としなければならない。監査結果は src/ 内のプロダクションコードのみをカウントし、SYSTEM_CONSTITUTION V2.4 の制限値と比較すること 🔵 *src/config/code-size-audit.ts collectMetrics() が SKIP_DIRS で src/ 外も走査している実装より*
- REQ-105: システムはコード規模監査スクリプト（npm run audit:code-size）の実行結果が COMPLIANT となることを確認しなければならない。src/ ディレクトリ単位で測定した場合、ファイル数380以下・行数115,000以下であること 🔵 *現状実測値: src/ 353ファイル/104,098行（共にSYSTEM_CONSTITUTION V2.6制限内）・Phase 58完了時点より*
- REQ-106: システムはタスク概要ドキュメント（overview.md）のフェーズステータス・タスク完了状況が git ログと一致することを確認しなければならない 🔵 *overview.md Phase 36 ヘッダー「🔲未着手」に対し実際は完了・TASK-0143~0147 未反映より*

#### テストESM互換性修正・依存脆弱性解消・ドキュメント整合性（Phase 39） ✅完了

- REQ-107: システムはテストファイル内の `jest.resetModules()`、`jest.clearModules()`、`jest.restoreAllMocks()` の呼び出しがESM（ECMAScript Modules）環境で `ReferenceError: jest is not defined` エラーを発生しないようにしなければならない。`@jest/globals` からの明示的インポートまたは `beforeAll`/`afterAll` ベースの代替パターンに置換すること 🔵 *TASK-0151完了: 31テストファイルのjest.mock→unstable_mockModule変換・全193スイート/4,346テスト通過確認*
- REQ-108: システムは `npm audit` で報告される脆弱性（fast-uri path traversal HIGH・ip-address XSS MODERATE）を解消し、脆弱性0件を維持しなければならない 🔵 *TASK-0152完了: npm audit 0脆弱性確認*
- REQ-109: システムはアーキテクチャ文書（architecture.md）の受け入れ基準が全て完了（[x]）であり、品質評価が最新フェーズの検証結果を反映していることを確認しなければならない 🔵 *TASK-0153完了: 全8受け入れ基準[x]・品質評価第148回検証反映済*

#### テストCJSモックESM互換性修正（Phase 39 追加） ✅完了

- REQ-110: システムはCJSパッケージ（jsonwebtoken等）のESMモックテストにおいて、`jest.unstable_mockModule` の代わりに `__mocks__/` ディレクトリベースの手動モックを使用し、`import * as` パターンでインポートされたCJSモジュールのモックがテスト間で正しく持続することを保証しなければならない 🔵 *tests/__mocks__/jsonwebtoken.ts 作成・tests/unit/api/websocket-handler.test.ts 24テスト全通過*

#### API認証ミドルウェア品質・信頼性（Phase 40）

- REQ-111: システムは authMiddleware を Express パイプライン内で動作させる統合テストを提供し、HTTP レスポンス形状（ステータスコード・JSON ボディ・Content-Type ヘッダー）・CORS ヘッダー伝播・レート制限ミドルウェアとの相互作用・実際の HTTP リクエスト/レスポンスサイクルを検証しなければならない 🔵 *TASK-0154（ユニットテスト11件）の上に構築・src/api/middleware/auth.ts・src/api/server.ts より*
- REQ-112: システムは jsonwebtoken 手動モック（tests/__mocks__/jsonwebtoken.ts）と auth.ts が使用する JWT インターフェース（verify・sign・decode）の整合性を自動検証し、auth.ts の変更時にモックの不一致を検出する仕組みを提供しなければならない 🔵 *tests/__mocks__/jsonwebtoken.ts の verify/sign/export と auth.ts の jwt.verify 使用箇所の対応確認・TASK-0154の補完要件*

#### キャッシュウォームアップ障害耐性テスト（Phase 45）

- REQ-113: システムは監視ヘルスエンドポイント（GET /api/v1/monitoring/health）のテストにおいて、ウォームアップ失敗時（status: 'failed'）のヘルスレスポンス形状を検証しなければならない。ウォームアップ失敗は非致命的であり、ヘルスステータス全体に影響を与えない（fire-and-forget）ことを確認すること 🔵 *src/api/startup-warmup.ts .catch() フロー・src/api/routes/monitoring.ts cacheWarmup フィールド・既存 startup-warmup.test.ts の失敗テストケースより*
- REQ-114: システムはキャッシュバックエンドが到達不能（network error, timeout, DNS failure）な状況でのウォームアップ実行時、triggerStartupWarmup() が例外を伝播せず安全に失敗し、getWarmupStatus() が {status: 'failed', error: string} を返すことを検証する統合テストを提供しなければならない 🔵 *src/api/startup-warmup.ts fire-and-forget 設計・既存 startup-warmup.test.ts test('status becomes failed when warmup throws') より*
- REQ-115: システムはウォームアップ状態の全遷移（pending → completed / pending → failed / pending → skipped）における監視ヘルスエンドポイントのレスポンス内容（status・cacheWarmup.status・cacheWarmup.error）を検証するテストを提供しなければならない 🔵 *src/api/routes/monitoring.ts health エンドポイント cacheWarmup フィールド・startup-warmup.ts WarmupStatusInfo 型より*

#### キャッシュバックエンド到達不能エンドツーエンドテスト（Phase 46）

- REQ-116: システムは実際の CacheWarmupManager + LLMCache パイプラインにおいて、リゾルバ（キャッシュバックエンド/LLM）が到達不能な場合のウォームアップ失敗経路を検証する統合テストを提供しなければならない。全パターン失敗（ECONNREFUSED・ENOTFOUND・ETIMEDOUT・EPIPE）、部分失敗、非Error例外、失敗後リカバリを網羅すること 🔵 *src/optimization/cache-warmup.ts warmup() try-catch・tests/unit/optimization/cache-warmup.test.ts 既存パターンより*
- REQ-117: システムは実際の CacheWarmupManager を triggerStartupWarmup に接続し、リゾルバ失敗時のヘルスエンドポイントレスポンス（cacheWarmup.status・patternsProcessed）を検証するエンドツーエンド統合テストを提供しなければならない 🔵 *src/api/startup-warmup.ts triggerStartupWarmup() → src/api/routes/monitoring.ts health エンドポイントの接続より*
- REQ-118: システムはウォームアップ失敗に伴うカスケード障害（getCacheWarmupStats 例外・複数回トリガー・高速状態遷移）に対するヘルスエンドポイントの安定性を検証するテストを提供しなければならない 🔵 *src/api/startup-warmup.ts .then() 内 getCacheWarmupStats() 呼び出し・health エンドポイントの全フィールド定義より*

#### ウォームアップゼロ成功耐性テスト（Phase 47）

- REQ-119: システムはウォームアップ完了時に全パターンが失敗（ゼロ成功）した場合でも、ステータスが 'completed' となりヘルスエンドポイントが200を返すことを検証するテストを提供しなければならない 🔵 *src/optimization/cache-warmup.ts warmup() 個別パターン失敗はfailureCountに記録・全体完了は阻害しない設計より*
- REQ-120: システムはウォームアップ状態遷移中に複数の同時ヘルスリクエストが発行された場合でも、全リクエストが一貫したレスポンスを返すことを検証するテストを提供しなければならない 🔵 *src/api/routes/monitoring.ts health エンドポイント・getWarmupStatus() スナップショット取得より*
- REQ-121: システムはゼロ成功ウォームアップ完了後のリトライが成功した場合、統計が正しく累積されることを検証するテストを提供しなければならない 🔵 *src/optimization/cache-warmup.ts getWarmupStats() 累積統計・resetWarmupStatus() リセット動作より*

#### HealthCheckService本番ヘルスチェック単体テスト（Phase 48）

- REQ-122: システムは HealthCheckService の包括的ヘルスチェック（メモリ・キャッシュ・パイプライン・LLM・エラー復旧・パフォーマンス傾向の6コンポーネント）が正しいステータス判定（healthy/degraded/unhealthy）を行うことを検証する単体テストを提供しなければならない。各コンポーネントの境界値（メモリ70%/90%・キャッシュヒット率0.2/0.5・パイプライン成功率0.80/0.95）を網羅すること 🔵 *src/monitoring/health-check-service.ts checkMemoryHealth/checkCacheHealth/checkPipelineHealth/checkLLMHealth/checkErrorRecoveryHealth/checkPerformanceHealth 境界値定義より*
- REQ-123: システムは HealthCheckService の Kubernetes スタイル readiness/liveness プローブが正常時は ready=true/alive=true を返し、システム異常時は ready=false を返すことを検証するテストを提供しなければならない 🔵 *src/monitoring/health-check-service.ts checkReadiness/checkLiveness メソッドより*
- REQ-124: システムは HealthCheckService の推奨事項生成が各コンポーネントの健全性状態に応じた適切な推奨（メモリ最適化・キャッシュ戦略見直し・CRITICAL通知）を生成することを検証するテストを提供しなければならない 🔵 *src/monitoring/health-check-service.ts generateRecommendations メソッド・各コンポーネント判定ロジックより*

#### 監視ヘルスエンドポイント縮退ステータステスト（Phase 49）

- REQ-125: システムは監視ヘルスエンドポイント（GET /api/v1/monitoring/health）において、パイプライン成功率が0.95未満の場合、ウォームアップ状態に関わらずステータス "degraded" を報告しなければならない 🔵 *src/api/routes/monitoring.ts health エンドポイント successRate 判定・tests/integration/monitoring-health-degraded.test.ts より*
- REQ-126: システムは監視ヘルスエンドポイントにおいて、ウォームアップ状態遷移中にアクティブなアラートが存在する場合、アラート情報とウォームアップ状態を同時に報告しなければならない 🔵 *src/api/routes/monitoring.ts health エンドポイント alerts フィールド・tests/integration/monitoring-health-degraded.test.ts より*
- REQ-127: システムは監視ヘルスエンドポイントにおいて、successRate の境界値（0.95）でのステータス遷移（healthy ↔ degraded）が正確であることを検証しなければならない 🔵 *src/monitoring/performance-dashboard.ts successRate 計算・tests/integration/monitoring-health-degraded.test.ts より*

#### デフォルトウォームアップパターン障害耐性テスト（Phase 50）

- REQ-128: システムはデフォルトの多言語ウォームアップパターン（8パターン: EN 5 + JA 3）がキャッシュバックエンド到達不能時に全パターン安全に失敗し、統計情報に failures として記録されることを検証しなければならない 🔵 *src/optimization/cache-warmup.ts DEFAULT_WARMUP_PATTERNS・tests/integration/warmup-default-pattern-resilience.test.ts より*
- REQ-129: システムはデフォルトウォームアップパターンを用いた起動→ヘルスエンドポイントの完全チェーンが、キャッシュ到達不能時でも例外を伝播せず完了することを検証しなければならない 🔵 *src/api/startup-warmup.ts triggerStartupWarmup() → src/api/routes/monitoring.ts health エンドポイント・tests/integration/warmup-default-pattern-resilience.test.ts より*
- REQ-130: システムはウォームアップ統計が複数サイクルにわたって不変性を維持し、リセット操作後に一貫した初期状態に戻ることを検証しなければならない 🔵 *src/optimization/cache-warmup.ts getWarmupStats()・resetWarmupStatus()・tests/integration/warmup-default-pattern-resilience.test.ts より*

#### HealthCheckService本番コード堅牢化（Phase 51）

- REQ-131: システムは HealthCheckService の各コンポーネントチェック（キャッシュ・パイプライン・LLM・エラー復旧・パフォーマンス傾向）が依存バックエンド（globalCache・realTimeMonitor）の例外時に "degraded" ステータスを返し、ヘルスチェック全体がクラッシュしないことを保証しなければならない。各コンポーネントの try-catch による安全な縮退と、performHealthCheck のフォールバックメトリクス構築を含む 🔵 *src/monitoring/health-check-service.ts checkCacheHealth/checkPipelineHealth/checkLLMHealth/checkErrorRecoveryHealth/checkPerformanceHealth try-catch 追加・performHealthCheck フォールバックメトリクスより*

#### ファイル名サニタイズ・テスト検証（Phase 52） ✅完了

- REQ-132: システムは `sanitizeFilename()` 関数（`src/utils/sanitize.ts`）に対して、パストラバーサル（`../`, `..\\`）・ヌルバイト注入（`\\0`）・制御文字（0x00-0x1F, 0x7F）・ディレクトリセパレータ（`/`, `\\`）・先頭ドット（隠しファイル）・空文字列入力・空白のみ入力・Unicode文字列・最大長入力の各エッジケースを検証する専用テストを提供しなければならない 🔵 ✅実装済 *src/utils/sanitize.ts sanitizeFilename() 実装・ISS-044 パストラバーサル防止要件・11テスト通過*
- REQ-133: システムは集約化されたパイプライン制限定数（`src/config/limits.ts` RATE_LIMITS・BATCH_LIMITS・SERVER_LIMITS・PIPELINE_LIMITS・SECURITY_LIMITS）が各モジュール（api/routes/pipeline.ts・api/routes/batch.ts・api/server.ts）で正しく参照され、マジックナンバーの漏れがないことを検証するテストを提供しなければならない 🔵 ✅実装済 *src/config/limits.ts 集約化完了・6テスト通過*
- REQ-134: システムは HealthCheckService の各コンポーネントチェックが依存バックエンド例外時に個別に "degraded" を返すことを検証する専用テストを提供しなければならない。各コンポーネント（checkCacheHealth・checkPipelineHealth・checkLLMHealth・checkErrorRecoveryHealth・checkPerformanceHealth）ごとにバックエンド例外を注入し、他のコンポーネントに影響しないことを確認すること 🔵 ✅実装済 *REQ-131 本番コード堅牢化のテスト補完・6テスト通過*

#### 仕様最適化・テストカバレッジ拡充（Phase 53） ✅完了

- REQ-135: システムは仕様ドキュメント（acceptance-criteria.md・interview-record.md）の完了済みフェーズ（Phase 44~52）の重複セクション（信頼性レベル分布・テストケースサマリー表・実施計画）を簡潔な完了ステータスに集約し、acceptance-criteria.md の全体行数を15%以上削減しなければならない。テストケース定義（TC-xxx-xx）自体は保持し、重複するサマリー情報のみを削除すること 🔵 ✅実装済 *AI Hub iteration feedback: spec doc hotspot files grew 370 lines・Phase 44-52 content = 54.2% of acceptance-criteria.md より・コミット9a390e9で34.8%削減達成*
- REQ-136: システムは React hooks（use-toast.ts: 186行）に対する専用ユニットテスト（トースト状態管理・reducer全パターン・キュー上限・自動非表示・タイマークリーンアップ）を提供しなければならない 🔵 ✅実装済 *src/hooks/use-toast.ts 既存実装・tests/unit/hooks/use-toast.test.ts（256行・22テスト）・コミット7333d26*
- REQ-137: システムは React hooks（useFrameworkPipeline.ts: 385行）に対する専用ユニットテスト（パイプライン実行状態・イテレーション管理・品質メトリクス追跡・エラー回復）を提供しなければならない 🔵 ✅実装済 *src/hooks/useFrameworkPipeline.ts 既存実装・tests/unit/hooks/use-framework-pipeline.test.ts（429行・25テスト）・コミット7333d26*
- REQ-138: システムはコアユーティリティ（logger.ts: ログレベルフィルタリング・構造化プレフィックス、memory-usage.ts: クロスプラットフォームメモリ取得・Node.js/Chrome/フォールバック）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *src/utils/logger.ts・src/utils/memory-usage.ts 既存実装・tests/unit/utils/logger.test.ts（166行・13テスト）・tests/unit/utils/memory-usage.test.ts（148行・16テスト）・コミット7333d26*

#### コンポーネント・ユーティリティテスト拡充（Phase 54） ✅完了

- REQ-139: システムは StageIndicator コンポーネントの純粋ヘルパー関数（calcElapsed: 経過時間計算・null開始時の0返却・負値クランプ、formatElapsed: 秒/分/時間フォーマット、STAGE_CONFIG/STATUS_LABEL/STATUS_BADGE_VARIANT: 全ステータスカバー）に対するユニットテストを提供しなければならない 🔵 ✅実装済 *src/components/StageIndicator.tsx 純粋ヘルパー・src/components/__tests__/StageIndicator.test.ts（20テスト）・コミットb492b78*
- REQ-140: システムは AUDIO_LIMITS 設定値（MAX_FILE_SIZE_BYTES: 50MB、DURATION_WARNING_SECONDS: 3600秒）の妥当性検証とas constリテラル型テストを centralized-limits テストスイートに追加しなければならない 🔵 ✅実装済 *src/config/limits.ts 既存実装・tests/unit/config/centralized-limits.test.ts（4テスト追加・AUDIO_LIMITS as const テスト1テスト追加）・コミットb492b78*
- REQ-141: システムは getAudioDuration 関数（HTMLAudioElement loadedmetadata/error イベント・ObjectURL生成/解放・preload='metadata'設定）に対するブラウザAPIモックテストを提供しなければならない 🔵 ✅実装済 *src/utils/audio-duration.ts 既存実装・tests/unit/utils/audio-duration.test.ts（5テスト追加・loadedmetadata/error/preload/URL revoke検証）・コミットb492b78*
- REQ-142: システムは validateAudioFile 関数を提供し、File オブジェクトのサイズ上限（EDGE-101: 50MB）・空ファイル検出（EDGE-001）・対応形式検証を一元化し、UI コンポーネントから呼び出し可能にしなければならない 🔵 ✅実装済 *src/utils/audio-validation.ts（validateAudioFile 関数・AUDIO_LIMITS 参照）・SimplePipelineInterface.tsx 検証統合・tests/unit/utils/audio-validation.test.ts（15テスト）*
- REQ-143: システムは validateAudioDuration 関数を提供し、音声再生時間の下限（EDGE-102: 1秒未満拒否）・長時間警告（EDGE-103: 1時間超過警告）・無効値（NaN/Infinity/負数）検出を一元化し、UI コンポーネントの非同期チェックから呼び出し可能にしなければならない 🔵 ✅実装済 *src/utils/audio-validation.ts（validateAudioDuration 関数）・SimplePipelineInterface.tsx 非同期検証統合・tests/unit/utils/audio-validation.test.ts（12テスト）*

#### 音声検証完全統合・コンポーネントテスト（Phase 56） ✅完了

- REQ-144: システムは AudioUploader コンポーネントのインライン検証（`audio/*` MIME type チェックのみ）を centralized audio-validation.ts の validateAudioFile() + validateAudioDuration() に置換し、EDGE-001（空ファイル）・EDGE-101（50MB超過）・EDGE-102（1秒未満）・EDGE-103（1時間超過警告）の全検証を適用しなければならない 🔵 ✅実装済 *TASK-0157完了・コミットee4a8bc・src/components/AudioUploader.tsx centralized validation統合済*
- REQ-145: システムは重複する音声制限定数（src/transcription/types.ts の MAX_FILE_SIZE・SUPPORTED_AUDIO_FORMATS と src/config/limits.ts の AUDIO_LIMITS・src/utils/audio-validation.ts の形式リスト）を単一出処に統合し、types.ts から AUDIO_LIMITS を再エクスポートして既存インポートの互換性を維持しなければならない 🔵 ✅実装済 *TASK-0156完了・コミット6b5bb09・src/transcription/types.ts 再エクスポート統合済*
- REQ-146: システムは whisper-transcriber.ts の validateAudioInput() メソッドの基本ファイル検証（形式チェック・サイズチェック）を centralized audio-validation.ts の validateAudioFile() に委譲し、同モジュール固有の高度検証（破損検出 magic byte check）は追加レイヤーとして維持しなければならない 🔵 ✅実装済 *TASK-0158完了・コミットbd8794d・File入力→validateAudioFile()委譲・magic byte check維持*
- REQ-147: システムは AudioUploader コンポーネントに対する専用ユニットテスト（ファイル選択・バリデーションエラー表示・継続警告表示・空ファイルリジェクト・形式チェック・サイズ上限チェック）を提供し、centralized validation 統合後の動作を検証しなければならない 🔵 ✅実装済 *TASK-0159完了・コミットddb4167・36テスト全通過*

#### LLMキャッシュデバウンステスト（Phase 57） ✅完了

- REQ-148: システムは LLMCache のデバウンステスト（scheduleSave の結合・destroy のキャンセル・persist の即時フラッシュ・タイマー間隔精度・clearExpired の再スケジュール）を専用テストファイルで検証し、デバウンス設定（persistDebounceMs > 0）時のタイミング-sensitive な振る舞いの回帰を防止しなければならない 🔵 ✅実装済 *tests/analysis/llm-cache-debounce.test.ts（15テスト）・コミット53ec069 debounce実装に対するテスト補完*

#### パイプラインエラー回復E2E統合テスト（Phase 57 追加） ✅完了

- REQ-149: システムは PipelineOrchestrator と PipelineErrorRecoveryOrchestrator の統合動作を検証するエンドツーエンド統合テストを提供し、以下をカバーしなければならない: (1) ハッピーパスでリカバリレポートが success で生成される、(2) リカバリレポートが実行ステージを追跡する、(3) 品質ゲート失敗時に failure リカバリレポートが生成される、(4) 進捗コールバックが各ステージで発火する、(5) 並列実行で独立したリカバリレポートが生成される、(6) リカバリオーケストレーターが直接検査可能である、(7) ヘルスアセスメントが取得可能である、(8) 一時障害がバウンダリリトライで回復される、(9) デグレード結果が正しく追跡される、(10) ストラテジーチェーンがプライマリ失敗時にデグレード結果を提供する、(11) メトリクスにリトライ試行回数が含まれる、(12) ステージタイミングがパフォーマンス分析のために記録される 🔵 ✅実装済 *tests/integration/pipeline-recovery-e2e.test.ts（12テスト）・コミット feedback-driven: PipelineErrorRecoveryOrchestrator を e2e パイプラインテストに統合*

#### パイプライン品質・構造化エラー（Phase 59） ✅完了

- REQ-150: システムはマルチシーン構築時、各 RawDiagram でオプションの durationMs（デフォルト5000ms）を指定可能とし、各シーンの startMs を前シーンの累積 durationMs から自動計算しなければならない 🔵 ✅実装済 *src/pipeline/smoke-orchestrator.ts buildSingleScene/buildMultiScenes・コミット3951e69*
- REQ-151: システムは各シーンに一意なID（`scene-${startMs}` 形式）を自動付与し、エクスポート時のファイル名が undefined とならないことを保証しなければならない 🔵 ✅実装済 *src/pipeline/smoke-orchestrator.ts SceneGraph.id・コミット931ae7a*
- REQ-152: システムは JSON エクスポート時に SceneGraph の全フィールド（nodes, edges, startMs, durationMs, summary, keyphrases, id, type）を正しくシリアライズしなければならない。旧フィールド（content, startTime, endTime, confidence）はシリアライズ対象外とすること 🔵 ✅実装済 *src/export/multi-format-exporter.ts・コミット931ae7a*
- REQ-153: システムはマルチシーン構築時、キャプションインデックスをシーン間でグローバルに一意に採番し、SRT 形式のインデックス連続性を保証しなければならない 🔵 ✅実装済 *src/pipeline/smoke-orchestrator.ts buildMultiScenes globalIndex・コミット3951e69*
- REQ-154: システムはパイプラインオーケストレーターの中断条件（品質ゲート失敗・リカバリ限界超過）で PipelineAbortError（PipelineError 継承・errorType=QUALITY_GATE_FAILED・stage=abort）をスローし、ErrorClassifier が正確にトリアージできることを保証しなければならない 🔵 ✅実装済 *src/pipeline/pipeline-errors.ts PipelineAbortError・src/pipeline/pipeline-orchestrator.ts 4箇所置換・コミット5d9c1f1*

#### パイプライン統合テスト・型付きエラー完全化（Phase 60） ✅完了

- REQ-155: システムは PipelineAbortError がパイプラインオーケストレーターからスローされた際、ErrorClassifier が正確に errorType=QUALITY_GATE_FAILED として分類し、適切なリカバリ戦略を返すことを検証する統合テストを提供しなければならない 🔵 ✅実装済 *tests/integration/pipeline-typed-errors.test.ts 6テスト・REQ-154 からの継続*
- REQ-156: システムはパイプラインモジュール内の残存する5箇所の raw Error throw（simple-pipeline.ts:1・smoke-orchestrator.ts:3・adaptive-quality-presets.ts:1）を型付きエラークラス（PipelineError・PipelineConfigError・RenderingError・QualityGateError）に置換し、全パイプラインエラーの構造化を完了しなければならない 🔵 ✅実装済 *src/pipeline/simple-pipeline.ts・smoke-orchestrator.ts・adaptive-quality-presets.ts・Phase 59の16箇所と合わせ計21箇所完了*
- REQ-157: システムは PipelineAbortError → ErrorClassifier → リカバリ戦略適用 → リカバリレポート生成の往復（round-trip）バリデーションテストを提供し、型付きエラーがパイプライン実行コンテキスト全体を正しく伝播することを検証しなければならない 🔵 ✅実装済 *tests/integration/pipeline-typed-errors.test.ts 8テスト・全6種の型付きエラーのthrow→classify→verify検証*
- REQ-158: システムは npm audit 脆弱性を0件に維持しなければならない 🔵 ✅実装済 *npm audit 0件確認（2026-05-28時点）・SYSTEM_CONSTITUTION.md メトリクス監視*
- REQ-159: システムはパイプラインオーケストレーターの catch ブロックで ErrorClassifier を呼び出し、キャッチされたエラーを構造化エラーとしてトリアージし、リカバリオーケストレーターに分類結果を渡さなければならない 🔵 ✅実装済 *src/pipeline/pipeline-orchestrator.ts catch ブロック・コミットee06c0e*

#### 品質モジュール型付きエラー移行（Phase 61） ✅完了

- REQ-160: システムは品質モジュール（src/quality/）内の残存する8箇所の raw Error throw を型付きエラークラスに置換し、パイプライン支援モジュール全体のエラー構造化を完了しなければならない。対象: enhanced-error-recovery.ts（3箇所: CircuitBreaker open rejection・キャッシュミス・maxAgeMs検証）、pipeline-run-recovery-tracker.ts（2箇所: アクティブラン衝突・アクティブラン不在）、regression-detector.ts（3箇所: メトリクス未取得・ベースライン未確立・現在値未取得） 🔵 ✅実装済 *src/quality/3ファイル8箇所の型付きエラー置換完了・コミットec84bce*
- REQ-161: システムは品質モジュールの raw Error 置換後、ErrorClassifier が新しい型付きエラーを正確に分類できることを検証する回帰テストを提供しなければならない 🔵 ✅実装済 *tests/integration/analysis-typed-errors.test.ts・tests/analysis-errors.test.ts（205行・回帰テスト込み）*

#### 分析モジュールテストカバレッジ拡充（Phase 62） ✅完了

- REQ-162: システムは diagram-detector.ts（1,406行）のコア機能（図解タイプ検出ロジック・11タイプ判定・キーワードマッチング・スコアリング）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/analysis/diagram-detector.test.ts（305行）*
- REQ-163: システムは scene-segmenter.ts（970行）のコア機能（セマンティックセグメンテーション・Jaccard係数マージ・トピックベースクラスタリング）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/analysis/scene-segmenter.test.ts（205行）*
- REQ-164: システムは language-detector.ts（623行）の言語検出機能（日英判定・スクリプト分析・確信度スコアリング）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/analysis/language-detector.test.ts（211行）*

#### エクスポートモジュール型付きエラー移行（Phase 63） ✅完了

- REQ-165: システムはエクスポートモジュール（src/export/）内の残存する12箇所の raw Error throw を型付きエラークラス（ExportError・EncodingError・FormatValidationError を pipeline-errors.ts に追加）に置換し、パイプライン全域のエラー構造化を完了しなければならない。対象: apng-encoder.ts（4箇所: チャンクサイズ超過・シーケンス番号オーバーフロー・APNGヘッダー不正・フレームサイズ上限）、enhanced-export-engine.ts（4箇所: サポート外形式・HDR非対応形式・テンプレート不在・設定検証）、multi-format-exporter.ts（3箇所: 形式未対応・SVG検証・HTML検証）、production-exporter.ts（1箇所: プリセット検証） 🔵 ✅実装済 *src/pipeline/pipeline-errors.ts 3クラス追加・src/export/4ファイル12箇所置換完了*
- REQ-166: システムはエクスポートモジュールの raw Error 置換後、ErrorClassifier が新しい型付きエラー（ExportError・EncodingError・FormatValidationError）を正確に分類できることを検証する回帰テストを提供しなければならない 🔵 ✅実装済 *tests/integration/export-typed-errors.test.ts（15テスト）*

#### 書き出しモジュールテストカバレッジ拡充（Phase 64） ✅完了

- REQ-167: システムは enhanced-export-engine.ts（906行）のコア機能（マルチ形式エクスポート・HDR出力・ウォーターマーク・圧縮レベル設定）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/export/enhanced-export-engine.test.ts（360行・42テスト）*
- REQ-168: システムは multi-format-exporter.ts（550行）のコア機能（SVG/PNG/PDF/JSON形式変換・メタデータ付与・バリデーション）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/export/multi-format-exporter.test.ts（310行・39テスト）*
- REQ-169: システムは production-exporter.ts（686行）のコア機能（プロダクションエクスポートパイプライン・プリセット管理・品質検証）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/export/production-exporter.test.ts（275行・37テスト）*

#### 残存モジュール型付きエラー移行（Phase 65） ✅完了

- REQ-170: システムは monitoring・config・integrations・framework モジュール内の残存する7箇所の raw Error throw を型付きエラークラスに置換しなければならない。対象: performance-dashboard.ts（1箇所: メトリクス平均計算時の空データ検証）、config/env.ts（1箇所: 設定検証失敗）、integrations/supabase/client.ts（1箇所: Supabase接続情報不足）、framework/iteration-manager.ts（1箇所: 不明フェーズ名）、pages/Index.tsx（3箇所: アップロード失敗・文字起こし失敗・シーン生成失敗） 🔵 ✅実装済 *src/monitoring/performance-dashboard.ts・src/config/env.ts・src/integrations/supabase/client.ts・src/framework/iteration-manager.ts・src/pages/Index.tsx・7箇所置換完了*
- REQ-171: システムは上記モジュールの raw Error 置換後、ErrorClassifier が新しい型付きエラーを正確に分類できることを検証する回帰テストを提供しなければならない 🔵 ✅実装済 *tests/integration/cross-module-typed-errors.test.ts（12テスト）*

#### モニタリングモジュールテストカバレッジ拡充（Phase 66） ✅完了

- REQ-172: システムは performance-dashboard.ts（681行）のコア機能（メトリクス集計・パーセンタイル計算・ダッシュボードデータ生成）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *src/monitoring/performance-dashboard.ts・Phase 66・パーセンタイル計算+入力検証追加*
- REQ-173: システムは production-error-handler.ts（638行）のコア機能（エラー分類・重要度判定・エラー通知・フォールバック戦略）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/monitoring/production-error-handler.test.ts（705行・69テスト）*
- REQ-174: システムは real-time-performance-monitor.ts（616行）のコア機能（リアルタイムメトリクス収集・P50/P95/P99計算・アラート閾値監視）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/unit/monitoring/real-time-performance-monitor.test.ts（639行・48テスト）・cacheHitRate閾値反転バグ修正*

#### 文字起こしモジュール型付きエラー移行（Phase 67） ✅完了

- REQ-175: システムは transcription モジュール（src/transcription/）内の残存するraw Error throw を型付きエラークラスに置換しなければならない 🔵 ✅実装済 *コミット4704e3fで5ファイル9箇所のTranscriptionError置換完了（browser-transcriber:1・srt-generator:2・whisper-transcriber:2・transcriber:3・streaming-transcriber:1）*
- REQ-176: システムは transcription モジュールの raw Error 置換後、ErrorClassifier が新しい型付きエラーを正確に分類できることを検証する回帰テストを提供しなければならない 🔵 ✅実装済 *tests/integration/transcription-typed-errors.test.ts（254行・17テスト）・TranscriptionError/FileSizeExceededError両方の分類検証完了*

#### 文字起こしモジュールテストカバレッジ拡充（Phase 68） ✅完了

- REQ-177: システムは browser-transcriber.ts のコア機能（Web Speech API統合・リアルタイム認識・ブラウザ互換性チェック）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/transcription/browser-transcriber.test.ts（25テスト）・start/stop/pause/resume・コールバック・互換性検出・ファイル文字起こしフォールバック*
- REQ-178: システムは whisper-transcriber.ts のコア機能（Whisper API連携・音声ファイル処理・タイムスタンプ付き文字起こし）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/transcription/whisper-transcriber.test.ts（20テスト）・フォールバック文字起こし・音声検証・破損検出・SRT生成・言語検出・capabilities*
- REQ-179: システムは streaming-transcriber.ts のコア機能（ストリーミング認識・チャンク処理・エラー回復）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *tests/transcription/streaming-transcriber.test.ts（16テスト）・コンストラクタ検証・品質監視API・設定管理・ライブ文字起こしライフサイクル*

#### 可視化・API モジュール型付きエラー移行（Phase 69） ✅完了

- REQ-180: システムは visualization モジュール（src/visualization/）内の残存するraw Error throw を型付きエラークラスに置換しなければならない 🔵 ✅実装済 *コミット4704e3fで5ファイル9箇所のVisualizationError置換完了（complex-layout-engine:4・OverlapResolver:1・TreeLayoutStrategy:1・base-strategy:1・ILayoutStrategy:1）*
- REQ-181: システムは API モジュール（src/api/）内の残存する3箇所の raw Error throw を既存の型付きエラークラスに置換しなければならない。対象: server.ts（1箇所: セキュリティ設定エラー）、websocket-handler.ts（1箇所: JWT秘密鍵未設定）、middleware/auth.ts（1箇所: JWT秘密鍵未設定） 🔵 ✅実装済 *3ファイル3箇所ともPipelineConfigError置換済・既存コミットで対応完了*

#### 可視化戦略完全化・重要度認識レイアウト（Phase 70） ✅完了

- REQ-182: システムは StrategySelector に11種類全ての図解タイプ（flow/tree/timeline/matrix/cycle/mindmap/network/conceptmap/flowchart/comparison/general）の専用レイアウト戦略を登録し、図解タイプに応じて最適な戦略を自動選択してノード配置を計算しなければならない 🔵 ✅実装済 *src/visualization/strategy-selector.ts 全11タイプ登録・コミットbe1dbb5*
- REQ-183: システムは MindMapStrategy により放射状レイアウトアルゴリズムを提供し、ルートノード選択に重要度スコアを活用し、ブランチ角度配分を接続数に基づいて最適化し、全ノードのオーバーラップゼロを保証しなければならない 🔵 ✅実装済 *src/visualization/strategies/mindmap-strategy.ts・コミット27e4552+b84f9a5*
- REQ-184: システムは NetworkStrategy により確定的フォースダイレクトレイアウトを提供し、円形初期配置（乱数不使用）・3フェーズ収束（計75反復）・重要度ベース中心距離配置により、ネットワーク図のノード配置を計算しなければならない 🔵 ✅実装済 *src/visualization/strategies/network-strategy.ts・コミットbcd30f1+b84f9a5*
- REQ-185: システムは ConceptMapStrategy によりBFSベースの階層型レイアウトを提供し、ルートノードを次数+重要度スコアの複合で選択し、レベル別水平展開・クロスコネクションエッジ保持・重要度ベースノードサイズ調整（0.75-1.5倍）を実行しなければならない 🔵 ✅実装済 *src/visualization/strategies/conceptmap-strategy.ts・コミット7f30cb3*
- REQ-186: システムは FlowchartStrategy によりDagreライブラリベースの上→下階層レイアウトを提供し、プロセスフロー・決定木の図解に最適化された配置を生成しなければならない 🔵 ✅実装済 *src/visualization/strategies/flowchart-strategy.ts・コミットbe1dbb5*
- REQ-187: システムは ComparisonStrategy により2列サイドバイサイドレイアウトを提供し、ノードをバランス調整された左右カラムに分割し、オーバーラップゼロを保証しなければならない 🔵 ✅実装済 *src/visualization/strategies/comparison-strategy.ts・コミットbe1dbb5*
- REQ-188: システムは GeneralStrategy により適応型エッジ認識スパイラルグリッド配置を提供し、接続数の多いノードを中心に、孤立ノードを外周に配置し、汎用図解に最適化された配置を生成しなければならない 🔵 ✅実装済 *src/visualization/strategies/general-strategy.ts・コミットbe1dbb5*
- REQ-189: システムは importance-scaler モジュールにより node.meta.importance（0-1スケール）から視覚プロパティを導出する機能を提供し、getImportance・importanceSizeScale・importanceWeight・scaledDimensions・isHighImportance・isLowImportance・pickHighestImportance の各関数を公開しなければならない。スケール範囲は importance 0→0.75倍、importance 1→1.5倍とすること 🔵 ✅実装済 *src/visualization/importance-scaler.ts・コミットb84f9a5*

#### KeyphraseOverlay・CaptionOverlay 動画統合（Phase 71） ✅完了

- REQ-190: システムは KeyphraseOverlay コンポーネントによりシーンキーワードをアニメーション付きタグとして動画上部に表示し、フェードイン/アウト（各8フレーム）・スタガード描画（各タグ2フレーム遅延）・最大5キーフレーズ表示を実行しなければならない 🔵 ✅実装済 *src/remotion/KeyphraseOverlay.tsx・コミット49462a6*
- REQ-191: システムは Video コンポーネントに KeyphraseOverlay と CaptionOverlay を統合し、captions プロパティ経由でSRTキャプションを下部に、キーフレーズを上部に同時表示し、scenesToKeyphraseScenes マッパーで累積オフセット計算を行わなければならない 🔵 ✅実装済 *src/remotion/Video.tsx・コミット160a34e*
- REQ-192: システムはキーフレーズデータを SceneSegmenter → SceneGraph → RemotionSceneData → KeyphraseOverlay の経路で伝播させ、VideoGenerator.convertSceneToRemotionFormat() で RemotionSceneData.keyphrases フィールドに設定しなければならない 🔵 ✅実装済 *src/pipeline/video-generator.ts・コミット49462a6*

#### 戦略セレクター統合テスト（Phase 72） ✅完了

- REQ-193: システムは StrategySelector の全11図解タイプに対するエンドツーエンド統合テストを提供し、実際の SceneGraph データで全登録戦略のディスパッチが正しく動作することを検証しなければならない 🔵 ✅実装済 *コミット0920f6a・tests/visualization/strategy-selector-integration.test.ts*

#### ストリーミング文字起こし入力堅牢性（Phase 73） ✅完了

- REQ-194: システムは StreamingTranscriber のコンストラクタで設定パラメータを検証し、chunkSizeMs は 0より大きく60000以下、minConfidence は 0以上1以下、overlapMs は 0以上かつchunkSizeMs未満であることを強制し、不正値の場合は TranscriptionError をスローしなければならない 🔵 ✅実装済 *src/transcription/streaming-transcriber.ts・コミット0e10ed1*

#### パイプラインエラー伝播正確性（Phase 75） ✅完了

- REQ-195: システムは processWithRetry がエラーを再スローする際、実際の errorType を ErrorClassifier の分類結果から伝播し、ハードコード値（'UNKNOWN'）を使用してはならない。これにより retryWithBackoff がエラーをリカバリ可能として正しく分類し、適切なリトライを実行できることを保証する 🔵 ✅実装済 *src/pipeline/simple-pipeline.ts・コミットa3b05dd・TASK-0186*

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
- EDGE-006: キャッシュウォームアップ中にネットワークエラー（DNS解決失敗・接続タイムアウト・ECONNREFUSED）が発生した場合、システムはウォームアップを安全に中止し、サーバー起動を継続し、ヘルスエンドポイントに failed ステータスを報告しなければならない 🔵 *src/api/startup-warmup.ts .catch() フロー・monitoring.ts cacheWarmup フィールドより*
- EDGE-007: キャッシュウォームアップが完了する前にヘルスエンドポイントが呼び出された場合（pending 状態）、システムは正常なヘルスレスポンスを返し、cacheWarmup.status を 'pending' として報告しなければならない 🔵 *src/api/startup-warmup.ts 初期状態・monitoring.ts health エンドポイントより*

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
| Phase 26: 入力検証・堅牢性改善 | ✅完了 | ISS-010~012 | 3/3（jobId UUID検証・品質ゲート配列上限・ブラウザセーフ環境変数） |
| Phase 27: ReDoS・ストレージ保護 | ✅完了 | ISS-013~017 | 5/5（ReDoS防止・localStorage保護・CORS設定改善・バッチ入力追加検証・反復回数キャップ） |
| Phase 28: 堅牢性継続改善 | ✅完了 | ISS-018~020 | 3/3（ReDoS拡張・JSON復元堅牢化・メモリリーク防止） |
| Phase 29: バッチセキュリティ | ✅完了 | ISS-021~024 | 4/4（ブラウザセーフenv拡張・正規表現エスケープ） |
| Phase 30: APIセキュリティ包括 | ✅完了 | ISS-025~032/042 | 10/10（Zodスキーマ検証・WebSocket UUID検証・レート制限・プリセット検証・カスタムエラー・暗号セキュアID・substr除去・WSペイロード検証・JWT認証強制） |
| Phase 31: 高度図解品質エンハンスメント | ✅完了 | REQ-079~083 | 5/5（ビジュアルバランススコアリング・エッジ交差検出最小化・スマートラベルサイジング・レイアウト品質複合スコア・品質ベース自動最適化ループ） |
| Phase 32: 図解品質パイプライン統合 | ✅完了 | REQ-084~087 | 4/4（パイプラインオーケストレーター品質最適化統合・スマートラベルパイプライン適用・Phase 31モジュール公開エクスポート・E2E統合テスト） |
| Phase 33: パイプライン品質監視統合 | ✅完了 | REQ-088~090 | 3/3（QualityMonitor統合・可視化モジュール専用テスト5ファイル1,661行・console.log構造化ログ化54ファイル90件置換） |
| Phase 34: ストリーミング品質・音声前処理・エクスポート検証 | ✅完了 | REQ-091~093 | 3/3（ストリーミング品質監視・音声前処理パイプライン・エクスポート完全性検証） |
| Phase 35: 可視化アルゴリズム正式化・パイプライン品質統合 | ✅完了 | REQ-094~096 | 3/3（フォースダイレクトシミュレーション正式化・グラフ粗視化正式化・E2E品質統合テスト） |
| Phase 36: パフォーマンス最適化・コスト可視化パイプライン | ✅完了 | REQ-097~100 | 5/5（パイプライン並列化・LLMコスト監視・パフォーマンスリグレッションベンチマーク・監視REST API・BudgetAlertSystem境界テスト） |
| Phase 37: 監視API本組込み・コード規模監査 | ✅完了 | REQ-102~103 | 2/2（コード規模自動監査CLI・BudgetAlertSystem境界テスト・サーバー配線検証） |
| Phase 38: 監査スコープ修正・ドキュメント整合性 | ✅完了 | REQ-104~106 | 3/3（監査src/スコープ限定・COMPLIANT確認・overview.md整合性） |
| Phase 39: テストESM互換性修正・依存脆弱性解消・ドキュメント整合性 | ✅完了 | REQ-107~109 | 3/3（ESM互換性修正31ファイル・npm audit 0脆弱性・ドキュメント整合性更新） |
| Phase 40: API認証ミドルウェア品質・信頼性 | ✅完了 | REQ-111~112 | 2/2（REQ-111 Express統合テスト9件・REQ-112モック整合性検証3件・本番コード検証完了） |
| Phase 45: キャッシュウォームアップ障害耐性テスト | ✅完了 | REQ-113~115 | 3/3（ウォームアップ失敗モニタリングテスト4件・キャッシュ到達不能統合テスト3件・ウォームアップ状態遷移テスト4件） |
| Phase 46: キャッシュバックエンド到達不能E2Eテスト | ✅完了 | REQ-116~118 | 3/3（CacheWarmupManager実パイプライン障害テスト7件・E2Eウォームアップ失敗ヘルスエンドポイントテスト3件・カスケード障害耐性テスト4件） |
| Phase 47: ウォームアップゼロ成功耐性テスト | ✅完了 | REQ-119~121 | 3/3（ゼロ成功ウォームアップテスト4件・同時ヘルスリクエストテスト3件・リトライ累積テスト3件） |
| Phase 48: HealthCheckService本番ヘルスチェック単体テスト | ✅完了 | REQ-122~124 | 3/3（コンポーネント境界値テスト28件・readiness/livenessプローブテスト5件・推奨事項生成テスト4件・エッジケース3件） |
| Phase 49: 監視ヘルスエンドポイント縮退ステータステスト | ✅完了 | REQ-125~127 | 3/3（縮退ステータス・アクティブアラート・successRate境界値テスト） |
| Phase 50: デフォルトウォームアップパターン障害耐性テスト | ✅完了 | REQ-128~130 | 3/3（多言語デフォルトパターン障害・起動→ヘルスチェーン・統計不変性テスト） |
| Phase 51: HealthCheckService本番コード堅牢化 | ✅完了 | REQ-131 | 1/1（全コンポーネントチェックのtry-catch追加・フォールバックメトリクス・型安全性修正） |
| Phase 52: ファイル名サニタイズ・テスト検証 | ✅完了 | REQ-132~134 | 3/3（sanitizeFilename 11テスト・limits定数 6テスト・HealthCheckService個別例外 6テスト・計23基準オールグリーン） |
| Phase 53: 仕様最適化・テストカバレッジ拡充 | ✅完了 | REQ-135~138 | 4/4（spec doc最適化34.8%削減・use-toast 22テスト・useFrameworkPipeline 25テスト・logger/memory-usage 29テスト・計91テスト追加） |
| Phase 54: コンポーネント・ユーティリティテスト拡充 | ✅完了 | REQ-139~141 | 3/3（StageIndicator helpers 20テスト・AUDIO_LIMITS 5テスト・getAudioDuration mock 5テスト・計30テスト追加） |
| Phase 55: パイプライン音声入力検証統合 | ✅完了 | REQ-142~143 | 2/2（validateAudioFile EDGE-001/EDGE-101 統合・validateAudioDuration EDGE-102/EDGE-103 統合・SimplePipelineInterface 検証統合・27テスト追加） |
| Phase 56: 音声検証完全統合・コンポーネントテスト | ✅完了 | REQ-144~147 | 4/4 |
| Phase 57: LLMキャッシュデバウンステスト | ✅完了 | REQ-148 | 1/1（scheduleSave結合・destroyキャンセル・persist即時フラッシュ・タイマー精度・clearExpired再スケジュール・15テスト追加） |
| Phase 57+: パイプラインエラー回復E2E統合テスト | ✅完了 | REQ-149 | 1/1（PipelineOrchestrator+ErrorRecoveryOrchestrator E2E統合テスト・12テスト追加・リカバリレポート・進捗・並列・ストラテジーチェーン・メトリクス検証） |
| Phase 58: リカバリ検証ループ・CI統合 | ✅完了 | TASK-0162~0165 | 4/4（CI煙テスト・E2Eリカバリ統合テスト・VideoGeneratorタイムアウト修正・ドキュメント更新・全テスト通過確認） |
| Phase 59: パイプライン品質・構造化エラー | ✅完了 | REQ-150~154 | 5/5（可変シーンデュレーション・シーンID生成・JSONエクスポート修正・キャプションインデックス連続性・PipelineAbortError・117テスト追加） |
| Phase 60: パイプライン統合テスト・型付きエラー完全化 | ✅完了 | REQ-155~159 | 5/5（全要件完了・253/253テストグリーン・npm audit 0件） |
| Phase 61: 品質モジュール型付きエラー移行 | ✅完了 | REQ-160~161 | 2/2（品質モジュール8箇所の型付きエラー置換・ErrorClassifier回帰テスト・コミットec84bce） |
| Phase 62: 分析モジュールテストカバレッジ拡充 | ✅完了 | REQ-162~164 | 3/3（diagram-detector 305行・scene-segmenter 205行・language-detector 211行・79テスト通過） |
| Phase 63: エクスポートモジュール型付きエラー移行 | ✅完了 | REQ-165~166 | 2/2（エクスポート4ファイル12箇所の型付きエラー置換・ErrorClassifier回帰テスト15件） |
| Phase 64: エクスポートモジュールテストカバレッジ拡充 | ✅完了 | REQ-167~169 | 3/3（enhanced-export-engine 42テスト・multi-format-exporter 39テスト・production-exporter 37テスト・118テスト全通過） |
| Phase 65: 残存モジュール型付きエラー移行 | ✅完了 | REQ-170~171 | 2/2（7箇所 raw Error 置換・MonitoringError 追加・ErrorClassifier 回帰テスト12件） |
| Phase 66: モニタリングモジュールテストカバレッジ拡充 | ✅完了 | REQ-172~174 | 3/3（performance-dashboard 27テスト・production-error-handler 40テスト・real-time-performance-monitor 39テスト・計106テスト全通過） |
| Phase 67: 文字起こしモジュール型付きエラー移行 | ✅完了 | REQ-175~176 | 2/2（TranscriptionError 9箇所置換・ErrorClassifier回帰テスト17件） |
| Phase 68: 文字起こしモジュールテストカバレッジ拡充 | ✅完了 | REQ-177~179 | 3/3（browser-transcriber 25テスト・whisper-transcriber 20テスト・streaming-transcriber 16テスト） |
| Phase 69: 可視化・API モジュール型付きエラー移行 | ✅完了 | REQ-180~181 | 2/2（VisualizationError 9箇所+API PipelineConfigError 3箇所・全置換完了） |
| Phase 70: 可視化戦略完全化・重要度認識レイアウト | ✅完了 | REQ-182~189 | 8/8（11図解タイプ専用戦略登録完了・importance-scaler モジュール・コミットbe1dbb5~27e4552） |
| Phase 71: KeyphraseOverlay・CaptionOverlay 動画統合 | ✅完了 | REQ-190~192 | 3/3（KeyphraseOverlay・Video統合・パイプライン配線・コミット49462a6~160a34e） |
| Phase 72: 戦略セレクター統合テスト | ✅完了 | REQ-193 | 1/1（strategy-selector E2Eテスト・コミット0920f6a） |
| Phase 73: ストリーミング文字起こし入力堅牢性 | ✅完了 | REQ-194 | 1/1（StreamingTranscriber constructor validation・コミット0e10ed1） |
| Phase 74: サイレントcatchブロックエラーロギング | ✅完了 | — | 8箇所のサイレントcatchブロックにエラーロギング追加（コミット9b7d722） |
| Phase 75: テストスイート安定化・ESM互換性・エラー伝播修正 | ✅完了 | REQ-195 + TASK-0185~0187 | 3/3（Jest ESM互換性修正・processWithRetryエラー型伝播バグ修正・テストアサーション修正・26+テスト障害解消） |

## 信頼性レベル分布

- 🔵 青信号: 215件 (97.3%)
- 🟡 黄信号: 3件 (1.4%) — NFR-203, REQ-303, EDGE-103
- 🔴 赤信号: 0件 (0%)

**品質評価**: ✅ 高品質 - 全要件が既存の設計文書・実測値・実装に基づいている。Phase 75完了（REQ-001~195）・テストスイート安定化完了（26+テスト障害解消・ESM互換性・エラー型伝播修正）・11図解タイプ専用戦略完了・KeyphraseOverlay・CaptionOverlay統合完了・importance-aware視覚階層完了・TypeScript型エラー0件・パイプライン型付きエラー完全化・187タスク全完了

## Acceptance criteria

- [x] AC-1: 全30カテゴリの機能要件（音声認識・内容分析・フォールバック・図解レイアウト・自動改善・品質保証・プロダクション監視・動画レンダリング・パイプラインUI・拡張モジュール・エラー分類・パイプラインオーケストレーション・バッチ処理・Edge Functions・WebSocket・最適化・グレースフルシャットダウン・型ガード・追加UI・高度エクスポート・Web Workers並列化・Worker統合テスト・セキュリティ・入力検証・堅牢性継続改善・高度図解品質エンハンスメント・図解品質パイプライン統合・パイプライン品質監視統合・ストリーミング品質・音声前処理・エクスポート検証・可視化アルゴリズム正式化・パイプライン品質統合）が REQ-001 ~ REQ-096 として文書化されている
- [x] AC-2: 全要件が一意の ID（REQ-xxx / NFR-xxx / EDGE-xxx）を持ち、EARS 記法（しなければならない / してもよい）で記述されている
- [x] AC-3: 全要件に信頼性レベル（🔵青信号 / 🟡黄信号 / 🔴赤信号）が付与されている
- [x] AC-4: 全要件がソース文書または実装ファイルに出典をトレースしている
- [x] AC-5: 非機能要件がパフォーマンス（NFR-001~004）・セキュリティ（101~103）・ユーザビリティ（201~203）・信頼性（301~304）・監視性（401~403）・コスト効率（501）の6属性をカバーしている
- [x] AC-6: Edgeケースがエラー処理（EDGE-001~005）と境界値（101~103）の両方をカバーしている
- [x] AC-7: EARS 分類に従い条件付き要件（REQ-101~104）・状態要件（201~203）・オプション要件（301~305）・制約要件（401~405）が文書化されている
- [x] AC-8: 実装進捗サマリーが Phase 1 ~ Phase 75 を網羅し、Phase 75 完了（テストスイート安定化・ESM互換性・エラー伝播修正）を反映
- [x] AC-9: 全要件が SYSTEM_CONSTITUTION.md の許可カテゴリ（コアパイプライン・パイプライン支援・API/通信・フロントエンドUI・監視/運用）に収まり、禁止カテキュリティに違反していない
- [x] AC-10: 信頼性レベル分布（🔵/🟡/🔴の件数と割合）が文書化され、品質評価が付与されている（第176回: 🔵215件/🟡3件/🔴0件 — Phase 75完了・REQ-001~195・231テストファイル・373ソースファイル・105パッケージ）
