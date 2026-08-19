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

**実装状況**: Phase 137（コア分割後要件同期）まで進行・src/ 非テスト .ts/.tsx 298ファイル・テストファイル738ファイル・依存パッケージ106件（dependencies+devDependencies・2026-08-19実測・計数コマンドはinterview-record A137）・型エラー0件・ESLintエラー0件・console.log 0件（CLAUDE.md基準達成）・npm audit 0件・図解タイプ完全対応（11種全て専用戦略）・SYSTEM_CONSTITUTION V2.6 制定・Web Workers 並列化基盤・セキュリティ・堅牢性修正完了（ISS-003~045）・PipelineErrorRecoveryOrchestrator E2E統合テスト完了・CI煙テスト完了・PipelineAbortError構造化エラー・ErrorClassifier→orchestrator統合完了・パイプライン型付きエラー完全化・KeyphraseOverlay・CaptionOverlay統合完了・importance-aware視覚階層完了・11図解タイプ専用レイアウト戦略完了・StreamingTranscriber入力堅牢性完了・文字起こしモジュールテストカバレッジ拡充完了・192タスク全完了・テストスイート安定化完了・Phase 112 エラー回復可観測性・未テストモジュールカバレッジ完了・Phase 113 NaN/Type Safetyコンソリデーション完完了（w/h直接アクセス完全排除・diagram-detector/scene-segmenterサニタイゼーションガード・32新規テスト・REQ-263~266）・Phase 114 ルールベースフォールバック品質改善・継続的学習安全性完了（ハードコードテンプレート→テキストベースコンテンツ抽出・continuous-learner destroy()/pearson NaNガード・20新規テスト・REQ-267~269）・Phase 115 テストスイート安定化・Lint完全修正（REQ-270~273・234エラー→0解消・ESM互換性修正・validateAudioFile クラッシュ修正・CJKトークン化テスト・キリル文字混入修正）・Phase 116 Record<UnionType,T>完全性強制・Prometheus export・SecurityMetrics TTL（REQ-274~279・8辞書リテラル Record<DiagramType,T> 置換・11 DiagramType ruleBasedDetection 完全対応・/metrics エンドポイント公開・METRIC_TTL_HOURS 環境変数）・Phase 117 フレームワーク境界型安全性・Constant-desync 解消（REQ-280~284・QualityRecommendation 投影型・overallScore wiring・HEALTH_CHECK single-source・node-dimension default・async-resource-cleanup ESM）・Phase 118~130 構造的ガード強化（REQ-285~297・diagram-type パリティ・fps 伝搬・循環 confidence・overlap 閾値プロデューサ一致・LayoutComplianceResult 伝搬・DIAGRAM_TYPES export・node-dimension 単一ソース化・stageDegraded/cascade イベント伝搬・canvas-dimension 単一ソース化・ExportJobQueue ETA オフバイワン・simple-pipeline 音声形式正典参照・performance SCALARS ガード完結・stale-closure クラス GUARDED-STRUCTURAL）・Phase 131+ AI Hub steering feedback A-D を REQ-298~300 提案として具体化（diagram-type-switch-parity 他同値クラス展開 / storageParser JSON.parse⇔JSON.stringify 非対称監査 / async-setState positive-case fixture）・Phase 132 3レジストリ命名一貫性（REQ-302 ✅・REQ-303 提案）・Phase 133~136 `??` 振る舞い pin TC-304-04・Prometheus status_class/prefix 修正（TC-205-04/TC-206-04/05）・UUID_V4_RE single-source r12（REQ-306）・DIAGRAM_TYPE_TITLES single-source r13（REQ-308）に続き・**stv-core コア分割（PR #7・commits a88c878f~d6651084）**: 共有型・ユーティリティ・設定モジュール群（types/diagram・utils/{logger,guards,sanitize,memory-usage,audio-validation,audio-duration,regex-escape,prometheus-label-escape,report-corruption}・config/{limits,production-config,schema,validate,code-size-audit}・lib/{metrics-utils,safe-array,capped-array,capped-map,unicode-script-ranges}・types/pipeline の20モジュールパス）を外部パッケージ `@stv/core`（github:nobu007/stv-core#v1.0.7）へ移管・プロダクトリポジトリの src/ 直下 src/types・src/config・src/lib ディレクトリは消滅・317ファイルが @stv/core から import（Phase 137 で REQ-310~312 として要件化・出典パス同期）

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
- REQ-007: システムは図解タイプとして flow/tree/timeline/matrix/cycle の5種類に加え、flowchart/comparison/network/conceptmap/mindmap/general の6種類（計11種類）を検出・判定しなければならない 🔵 *README.md 図解タイプ・src/analysis/diagram-detector.ts・@stv/core/types/diagram より*
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
- REQ-037: システムはエラー発生時にユーザーが回復方法を選択できる対話型エラー回復を提供し、REST API エンドポイント（POST /api/v1/errors/register でエラー登録、GET /api/v1/errors/:errorId/options で回復オプション取得、POST /api/v1/errors/:errorId/recover で回復実行）を通じて外部からのプログラム的アクセスを可能にしなければならない。11エラーカテゴリ（file_format/file_size/transcription/analysis/layout/rendering/api/network/memory/timeout/unknown）・4重要度（low/medium/high/critical）・Zod バリデーション付きリクエスト検証を含むこと 🔵 ✅実装済 *src/quality/user-guided-error-recovery.ts・src/api/routes/errors.ts・commit 441eb68・21テスト追加*
- REQ-038: システムは Zod スキーマを用いて環境変数・設定値の起動時バリデーションを実行し、不正設定時は即座にエラーで終了しなければならない 🔵 *@stv/core/config/validate・@stv/core/config/schema より*
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

- REQ-051: システムは図解タイプ（DiagramType）の型ガード関数（isDiagramType）を提供し、実行時に不正な図解タイプ値を検出・排除しなければならない 🔵 *@stv/core/types/diagram より*

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
- REQ-066: システムはブラウザコンテキストで動作するコード（production-config.ts）において process.env へのアクセスを安全にガードし、Vite ビルド時の静的置換に依存しない場合はランタイム参照を避けなければならない ✅実装済 *ISS-012 MEDIUM・@stv/core/config/production-config より*

#### セキュリティ・堅牢性継続改善（Phase 27-30） 🔵実装済

- REQ-067: システムはユーザー入力を正規表現パターンに埋め込む前に特殊文字をエスケープし、ReDoS（Regular Expression Denial of Service）攻撃を防止しなければならない 🔵 *ISS-018 MEDIUM・src/analysis/diagram-detector.ts・src/framework/iteration-logger.ts より*
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
- REQ-090: システムはプロダクションコード内の console.log/console.error/console.warn を構造化ログまたは適切なエラー回復パターンに置換しなければならない 🔵 *@stv/core/utils/logger 構造化ログ基盤・54ファイル90件のconsole呼び出しを置換済・TASK-0136完了*

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
- REQ-102: システムは SYSTEM_CONSTITUTION で定められたコード規模制限（ファイル数・行数）を自動監査し、制限超過時にビルド時に警告を出力しなければならない 🔵 *@stv/core/config/code-size-audit・scripts/code-size-audit.ts・tests/config/code-size-audit.test.ts（27テスト通過）・TASK-0146完了*
- REQ-103: システムは監視REST APIエンドポイントの本番動作検証として、サーバー起動時にルート登録完了をログ出力し、各エンドポイントの統合テストが全て通過することを確認しなければならない 🔵 *src/api/routes/monitoring.ts・src/api/__tests__/server.test.ts・tests/analysis/budget-alert-boundary.test.ts（29テスト通過）・TASK-0147完了*

#### コード規模監査スコープ修正・ドキュメント整合性（Phase 38） ✅完了

- REQ-104: システムはコード規模監査（code-size-audit）の対象を src/ ディレクトリに限定し、テストコード（tests/）、スクリプト（scripts/）、Supabase Edge Functions（supabase/）、設定ファイル等を監査対象外としなければならない。監査結果は src/ 内のプロダクションコードのみをカウントし、SYSTEM_CONSTITUTION V2.4 の制限値と比較すること 🔵 *@stv/core/config/code-size-audit collectMetrics() が SKIP_DIRS で src/ 外も走査している実装より*
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

- REQ-132: システムは `sanitizeFilename()` 関数（`@stv/core/utils/sanitize`）に対して、パストラバーサル（`../`, `..\\`）・ヌルバイト注入（`\\0`）・制御文字（0x00-0x1F, 0x7F）・ディレクトリセパレータ（`/`, `\\`）・先頭ドット（隠しファイル）・空文字列入力・空白のみ入力・Unicode文字列・最大長入力の各エッジケースを検証する専用テストを提供しなければならない 🔵 ✅実装済 *@stv/core/utils/sanitize sanitizeFilename() 実装・ISS-044 パストラバーサル防止要件・11テスト通過*
- REQ-133: システムは集約化されたパイプライン制限定数（`@stv/core/config/limits` RATE_LIMITS・BATCH_LIMITS・SERVER_LIMITS・PIPELINE_LIMITS・SECURITY_LIMITS）が各モジュール（api/routes/pipeline.ts・api/routes/batch.ts・api/server.ts）で正しく参照され、マジックナンバーの漏れがないことを検証するテストを提供しなければならない 🔵 ✅実装済 *@stv/core/config/limits 集約化完了・6テスト通過*
- REQ-134: システムは HealthCheckService の各コンポーネントチェックが依存バックエンド例外時に個別に "degraded" を返すことを検証する専用テストを提供しなければならない。各コンポーネント（checkCacheHealth・checkPipelineHealth・checkLLMHealth・checkErrorRecoveryHealth・checkPerformanceHealth）ごとにバックエンド例外を注入し、他のコンポーネントに影響しないことを確認すること 🔵 ✅実装済 *REQ-131 本番コード堅牢化のテスト補完・6テスト通過*

#### 仕様最適化・テストカバレッジ拡充（Phase 53） ✅完了

- REQ-135: システムは仕様ドキュメント（acceptance-criteria.md・interview-record.md）の完了済みフェーズ（Phase 44~52）の重複セクション（信頼性レベル分布・テストケースサマリー表・実施計画）を簡潔な完了ステータスに集約し、acceptance-criteria.md の全体行数を15%以上削減しなければならない。テストケース定義（TC-xxx-xx）自体は保持し、重複するサマリー情報のみを削除すること 🔵 ✅実装済 *AI Hub iteration feedback: spec doc hotspot files grew 370 lines・Phase 44-52 content = 54.2% of acceptance-criteria.md より・コミット9a390e9で34.8%削減達成*
- REQ-136: システムは React hooks（use-toast.ts: 186行）に対する専用ユニットテスト（トースト状態管理・reducer全パターン・キュー上限・自動非表示・タイマークリーンアップ）を提供しなければならない 🔵 ✅実装済 *src/hooks/use-toast.ts 既存実装・tests/unit/hooks/use-toast.test.ts（256行・22テスト）・コミット7333d26*
- REQ-137: システムは React hooks（useFrameworkPipeline.ts: 385行）に対する専用ユニットテスト（パイプライン実行状態・イテレーション管理・品質メトリクス追跡・エラー回復）を提供しなければならない 🔵 ✅実装済 *src/hooks/useFrameworkPipeline.ts 既存実装・tests/unit/hooks/use-framework-pipeline.test.ts（429行・25テスト）・コミット7333d26*
- REQ-138: システムはコアユーティリティ（logger.ts: ログレベルフィルタリング・構造化プレフィックス、memory-usage.ts: クロスプラットフォームメモリ取得・Node.js/Chrome/フォールバック）に対する専用ユニットテストを提供しなければならない 🔵 ✅実装済 *@stv/core/utils/logger・@stv/core/utils/memory-usage 既存実装・tests/unit/utils/logger.test.ts（166行・13テスト）・tests/unit/utils/memory-usage.test.ts（148行・16テスト）・コミット7333d26*

#### コンポーネント・ユーティリティテスト拡充（Phase 54） ✅完了

- REQ-139: システムは StageIndicator コンポーネントの純粋ヘルパー関数（calcElapsed: 経過時間計算・null開始時の0返却・負値クランプ、formatElapsed: 秒/分/時間フォーマット、STAGE_CONFIG/STATUS_LABEL/STATUS_BADGE_VARIANT: 全ステータスカバー）に対するユニットテストを提供しなければならない 🔵 ✅実装済 *src/components/StageIndicator.tsx 純粋ヘルパー・src/components/__tests__/StageIndicator.test.ts（20テスト）・コミットb492b78*
- REQ-140: システムは AUDIO_LIMITS 設定値（MAX_FILE_SIZE_BYTES: 50MB、DURATION_WARNING_SECONDS: 3600秒）の妥当性検証とas constリテラル型テストを centralized-limits テストスイートに追加しなければならない 🔵 ✅実装済 *@stv/core/config/limits 既存実装・tests/unit/config/centralized-limits.test.ts（4テスト追加・AUDIO_LIMITS as const テスト1テスト追加）・コミットb492b78*
- REQ-141: システムは getAudioDuration 関数（HTMLAudioElement loadedmetadata/error イベント・ObjectURL生成/解放・preload='metadata'設定）に対するブラウザAPIモックテストを提供しなければならない 🔵 ✅実装済 *@stv/core/utils/audio-duration 既存実装・tests/unit/utils/audio-duration.test.ts（5テスト追加・loadedmetadata/error/preload/URL revoke検証）・コミットb492b78*
- REQ-142: システムは validateAudioFile 関数を提供し、File オブジェクトのサイズ上限（EDGE-101: 50MB）・空ファイル検出（EDGE-001）・対応形式検証を一元化し、UI コンポーネントから呼び出し可能にしなければならない 🔵 ✅実装済 *@stv/core/utils/audio-validation（validateAudioFile 関数・AUDIO_LIMITS 参照）・SimplePipelineInterface.tsx 検証統合・tests/unit/utils/audio-validation.test.ts（15テスト）*
- REQ-143: システムは validateAudioDuration 関数を提供し、音声再生時間の下限（EDGE-102: 1秒未満拒否）・長時間警告（EDGE-103: 1時間超過警告）・無効値（NaN/Infinity/負数）検出を一元化し、UI コンポーネントの非同期チェックから呼び出し可能にしなければならない 🔵 ✅実装済 *@stv/core/utils/audio-validation（validateAudioDuration 関数）・SimplePipelineInterface.tsx 非同期検証統合・tests/unit/utils/audio-validation.test.ts（12テスト）*

#### 音声検証完全統合・コンポーネントテスト（Phase 56） ✅完了

- REQ-144: システムは AudioUploader コンポーネントのインライン検証（`audio/*` MIME type チェックのみ）を centralized audio-validation.ts の validateAudioFile() + validateAudioDuration() に置換し、EDGE-001（空ファイル）・EDGE-101（50MB超過）・EDGE-102（1秒未満）・EDGE-103（1時間超過警告）の全検証を適用しなければならない 🔵 ✅実装済 *TASK-0157完了・コミットee4a8bc・src/components/AudioUploader.tsx centralized validation統合済*
- REQ-145: システムは重複する音声制限定数（src/transcription/types.ts の MAX_FILE_SIZE・SUPPORTED_AUDIO_FORMATS と @stv/core/config/limits の AUDIO_LIMITS・@stv/core/utils/audio-validation の形式リスト）を単一出処に統合し、types.ts から AUDIO_LIMITS を再エクスポートして既存インポートの互換性を維持しなければならない 🔵 ✅実装済 *TASK-0156完了・コミット6b5bb09・src/transcription/types.ts 再エクスポート統合済*
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

- REQ-170: システムは monitoring・config・integrations・framework モジュール内の残存する7箇所の raw Error throw を型付きエラークラスに置換しなければならない。対象: performance-dashboard.ts（1箇所: メトリクス平均計算時の空データ検証）、config/env.ts（1箇所: 設定検証失敗）、integrations/supabase/client.ts（1箇所: Supabase接続情報不足）、framework/iteration-manager.ts（1箇所: 不明フェーズ名）、pages/Index.tsx（3箇所: アップロード失敗・文字起こし失敗・シーン生成失敗） 🔵 ✅実装済 *src/monitoring/performance-dashboard.ts・@stv/core/config 側（分割移管・旧 config/env）・src/integrations/supabase/client.ts・src/framework/iteration-manager.ts・src/pages/Index.tsx・7箇所置換完了*
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

#### バッチ処理プログレス正確性（Phase 76） ✅完了

- REQ-196: システムはバッチ処理APIにおいて、重複ファイル検出後のジョブ作成時に progress.total が重複解除後のファイル数ではなく、ユーザーが当初アップロードしたファイル数（originalTotal）を反映しなければならない。重複としてスキップされたファイル数（skippedCount）は progress.completed に事前完了分として加算し、ユーザーが正確な進捗率を確認できることを保証する 🔵 ✅実装済 *src/api/batch-processing-api.ts:226-228・コミット8edf876*

#### パイプラインオーケストレーター入力検証（Phase 76） ✅完了

- REQ-197: システムは PipelineOrchestrator の execute() メソッド開始時に音声ファイルの形式とサイズを検証し、サポート外形式（mp3/wav/ogg/m4a 以外）またはサイズ超過（50MB超過）の入力を AudioValidationError（PipelineError 継承・errorType=FILE_FORMAT_INVALID・stage=audio_validation）で即座に拒否しなければならない。UIレベル（REQ-142/143）・Whisperレベル（REQ-146）に加え、パイプラインレベルでの防御 in depth を提供し、高コストな処理ステージへの不正入力流入を防止すること 🔵 ✅実装済 *src/pipeline/pipeline-orchestrator.ts validateInput()・src/pipeline/pipeline-errors.ts AudioValidationError・コミット3eb6f6d*

#### エラーリカバリ可観測性（Phase 77） ✅完了

- REQ-198: システムは `GET /api/monitoring/error-recovery` エンドポイントにより、エラーリカバリシステムのテレメトリスナップショット（総イベント数・全体成功率・平均/P95リカバリ時間・ステージ別統計・劣化アラート・エラータイプ分布）を外部から取得可能にしなければならない。RecoveryTelemetryAggregator のスライディングウィンドウ（デフォルト5分）に基づく集計結果を返すこと 🔵 ✅実装済 *src/api/routes/monitoring.ts error-recovery endpoint・src/quality/recovery-telemetry-aggregator.ts*
- REQ-199: システムは ErrorRecoveryEventBus の recovery:success・recovery:failure・stage:degraded・cascade:detected イベントをサブスクライブし、RecoveryTelemetryAggregator にてスライディングウィンドウベースのテレメトリ集計を実行しなければならない。ステージ別成功率・平均/P95リカバリ時間・エラータイプ分布・10%以上の成功率低下検知を提供すること 🔵 ✅実装済 *src/quality/recovery-telemetry-aggregator.ts*

#### プロダクション観測性強化（Phase 78-79） ✅完了

- REQ-200: システムは全HTTPリクエストに対して相関ID（X-Request-ID）を生成または受信ヘッダーから抽出し、リクエストコンテキストに添付して下流ログ・エラー応答に伝播しなければならない 🔵 ✅実装済 *src/api/middleware/correlation-id.ts*
- REQ-204: システムは全HTTPリクエスト・レスポンスを構造化ログ（メソッド・パス・ステータスコード・応答時間・相関ID）として記録しなければならない。2xx/3xx は info、4xx は warn、5xx は error レベルで出力し、ヘルスチェックエンドポイントはログ対象外とすること 🔵 ✅実装済 *src/api/middleware/request-logger.ts*
- REQ-205: システムはHTTPリクエストメトリクスをメモリ上で収集し、メソッド+パスごとのリクエスト数・レイテンシパーセンタイル（P50/P95/P99）・エラーレート（4xx/5xx）・スローリクエスト検出（デフォルト5000ms閾値）・アクティブリクエスト数を追跡しなければならない。bounded circular buffer（ルートあたり最大1000サンプル）によるメモリ使用量制限を設けること 🔵 ✅実装済 *src/monitoring/http-metrics-collector.ts・Phase 80*
- REQ-206: システムはHTTP メトリクス（リクエスト総数・エラー総数・レイテンシパーセンタイル・アクティブリクエスト数・スローリクエスト数・稼働時間）を Prometheus 互換フォーマット（text/plain version=0.0.4）でエクスポートし、GET /api/v1/monitoring/prometheus エンドポイント経由で外部監視システムがスクレイピング可能にしなければならない。ラベルサニタイズによる注入防止・カスタムプレフィックスサポートを含むこと 🔵 ✅実装済 *src/monitoring/prometheus-exporter.ts・Phase 81*

#### ヘルスチェック・Kubernetes Probe（Phase 82） ✅完了

- REQ-207: システムは GET /api/v1/health/live（liveness probe）と GET /api/v1/health/ready（readiness probe）エンドポイントを提供し、Kubernetesスタイルのヘルスチェックに対応しなければならない。liveness probe はプロセス稼働状態を、readiness probe は全コンポーネント（メモリ・キャッシュ・パイプライン・LLM・エラー回復・パフォーマンス傾向）の健全性確認結果を反映すること 🔵 ✅実装済 *src/api/routes/health.ts・src/monitoring/health-check-service.ts・Phase 82*

#### 監視ダッシュボード・アラート（Phase 83） ✅完了

- REQ-208: システムは Grafana 互換のダッシュボード設定（JSON model）を提供し、GET /api/v1/monitoring/prometheus エンドポイントのメトリクスを可視化して表示してもよい。HTTPレイテンシ分布・エラーレート推移・パイプライン処理成功率・LLMコスト推移・ヘルスステータスの各パネルを含むこと 🔵 ✅実装済 *src/monitoring/grafana-dashboard-model.ts・Phase 83・8パネル（latency/error-rate/success-rate/slow-requests/active-requests/uptime/request-volume/errors-by-route）・27テスト*
- REQ-209: システムは主要メトリクスの閾値ベースのアラートルールを定義してもよい。対象: エラーレート > 5%（critical）・P95レイテンシ > 20秒（warning）・ヘルスチェック連続失敗 ≥ 3回（critical）・LLMコスト超過（warning） 🔵 ✅実装済 *src/monitoring/alert-rules.ts・Phase 83・4アラートルール（HighErrorRate/HighLatencyP95/HealthCheckFailures/LLMBudgetOverage）・Prometheus AlertManager YAML形式出力・24テスト*

#### 監視APIデプロイメント統合（Phase 84） ✅完了

- REQ-210: システムは Grafana ダッシュボード設定を GET /api/v1/monitoring/dashboard エンドポイントで JSON 形式で配信し、CI/CD パイプラインからの自動デプロイを可能にしなければならない 🔵 ✅実装済 *src/monitoring/grafana-dashboard-model.ts exportDashboardJson()・src/api/routes/monitoring.ts dashboard エンドポイント・REQ-208 で定義済モデルより*
- REQ-211: システムは Prometheus アラートルールを GET /api/v1/monitoring/alerts エンドポイントで YAML 形式で配信し、AlertManager への自動適用を可能にしなければならない 🔵 ✅実装済 *src/monitoring/alert-rules.ts exportAlertRulesYaml()・src/api/routes/monitoring.ts alerts エンドポイント・REQ-209 で定義済ルールより*

#### パイプラインオブザーバビリティ拡張（Phase 85） ✅完了

- REQ-212: ✅実装済 システムはパイプライン各ステージ（文字起こし・分析・レイアウト・動画準備・レンダリング）の所要時間をヒストグラムメトリクスとして Prometheus エクスポーターに統合し、GET /api/v1/monitoring/prometheus で pipeline_stage_duration_ms として出力しなければならない 🔵 *src/monitoring/pipeline-metrics-collector.ts・src/monitoring/prometheus-exporter.ts・14テスト*
- REQ-213: システムはバッチジョブのライフサイクル（created/running/completed/failed/cancelled）別の累積カウントとアクティブジョブ数を Prometheus メトリクスとして出力し、バッチ処理の健全性を外部監視可能にしなければならない 🔵 ✅実装済 *src/monitoring/pipeline-metrics-collector.ts recordBatchJobTransition()・src/monitoring/prometheus-exporter.ts batch_jobs_total/batch_jobs_active・REQ-043 バッチAPIより*

#### 監視スタック統合検証（Phase 86） ✅完了

- REQ-214: システムは Prometheus エクスポートエンドポイント（GET /api/v1/monitoring/prometheus）が実際の HTTP リクエストを通じて正しい text/plain v0.0.4 フォーマットで全メトリクスを出力することを検証する統合テストを提供しなければならない 🔵 ✅実装済 *src/monitoring/prometheus-exporter.ts・src/api/routes/monitoring.ts より*
- REQ-215: システムはアラートルールの閾値評価が正しいアラート発火条件を判定することを検証するテストを提供し、HighErrorRate（5%閾値）・HighLatencyP95（20秒閾値）・HealthCheckFailures（3回連続閾値）・LLMBudgetOverage の各ルールについて正常時・閾値境界・閾値超過の3パターンをカバーすること 🔵 ✅実装済 *src/monitoring/alert-rules.ts generateAlertRules()・各ルール閾値定義より*

#### 監視エンドポイントクエリ検証（Phase 87） ✅完了

- REQ-216: システムは GET /api/v1/monitoring/dashboard・/alerts・/trends エンドポイントのクエリパラメータを Zod スキーマ（DashboardQuerySchema・AlertsQuerySchema・TrendsQuerySchema）で検証し、不正値には 400 エラーを返さなければならない。検証項目: dashboard（refreshInterval: 1000-86400000ms）、alerts（severity: info/warning/critical、includeAck: boolean）、trends（period: 1h/6h/24h/7d/30d） 🔵 ✅実装済 *src/api/routes/monitoring.ts Zod safeParse・commit 147261e・107テスト追加*

#### LLM応図解構造検証（Phase 88） ✅完了

- REQ-217: システムは LLM（Gemini）から返却された図解データの構造を検証し、不正なノード（ID欠損・空ID）・重複ノード（同一ID）・自己ループエッジ（from === to）・重複エッジ（同一 from→to ペア）・孤立エッジ（存在しないノードID参照）を自動的にフィルタリングしなければならない。各検証は警告ログを出力し、最初の出現を保持してダウストリームレンダリングエラーを防止すること 🔵 ✅実装済 *src/analysis/gemini-analyzer.ts createEnhancedParser()・commit 5d3053c・5テスト追加*

#### シーン駆動アニメーションエクスポート（Phase 89） ✅完了

- REQ-218: システムはシーンデータに基づいて CSS キーフレームアニメーション付き SVG（svg-animated 形式）を生成し、各シーンタイプ（intro/content/outro）に応じた背景色・フォントサイズ・フェードイン/フェードアウト遷移を適用しなければならない。XML エスケープ・空シーンフォールバックを含むこと。純粋関数として独立テスト可能な animated-scene-renderer モジュールに抽出すること 🔵 ✅実装済 *src/export/animated-scene-renderer.ts generateAnimatedSVG()・commit f405637（モジュール抽出・36テスト）*
- REQ-219: システムはシーンデータに基づいて Lottie 5.7.4 互換 JSON アニメーション（json-lottie 形式）を生成し、シーン別シェイプレイヤー・不透明度キーフレーム・フレームオフセット計算を提供しなければならない。各シーンレイヤーにはシーンタイプ別背景色（intro=#1a1a2e/outro=#0f3460/content=#16213e）の矩形シェイプ（ty=rc, rounded corners）を含み、sceneTypeToFillColor・buildLayerShapes ヘルパーで視覚的形状コンテンツを構築すること。空シーン時にも有効な構造を出力すること。純粋関数として独立テスト可能な animated-scene-renderer モジュールに抽出すること 🔵 ✅実装済 *src/export/animated-scene-renderer.ts generateLottieAnimation()・buildLayerShapes()・commit 214ec76（視覚形状コンテンツ追加）・commit f405637（モジュール抽出・36テスト）*

#### エクスポートパイプライン統合テスト（Phase 90） ✅完了

- REQ-220: システムはエクスポートパイプライン全体（EnhancedExportEngine → animated-scene-renderer → SVG/Lottie 出力）を end-to-end で検証する統合テストを提供しなければならない。シーンデータ入力から出力までのデータフロー一貫性・シーンタイプ別色のフォーマット横断一貫性・空シーンフォールバック・renderer↔engine 結合の正しさを含むこと。ユニットテストでは検出できないモジュール間連携の不具合を捕捉すること 🔵 ✅実装済 *tests/integration/export-pipeline-e2e.test.ts・tests/integration/renderer-engine-integration.test.ts・38テスト（TASK-0199/0200）*

#### シーンレンダラー入力検証（Phase 91） ✅完了

- REQ-221: システムは animated-scene-renderer の公開関数（generateAnimatedSVG・generateLottieAnimation）に対して入力検証を実行し、無効な FrameInfo（width/height の非正数・非有限数・7680超過）は安全なデフォルト値にクランプし、無効なシーン duration（非正数・非有限数・3600秒超過）はデフォルト2秒にフォールバックしなければならない。null/undefined の sceneData に対してもクラッシュせず空シーンフォールバックを出力すること。validateFrameInfo・clampSceneDuration の純粋関数として独立テスト可能にすること 🔵 ✅実装済 *src/export/animated-scene-renderer.ts validateFrameInfo()・clampSceneDuration()・SceneRendererValidationError・29テスト追加*

#### エラーリカバリREST API堅牢化（Phase 92） ✅完了

- REQ-222: システムはエラーリカバリREST API（REQ-037）の入力検証を強化し、POST /register のリクエストボディを RegisterBodySchema（Zod）で検証（errorId: 英数字/ハイフン/アンダースコア/ドットのみ・最大128文字、errorMessage: 最大2000文字）し、GET /:errorId/options・POST /:errorId/recover のパスパラメータ errorId を同形式で検証し、不正値には 400 INVALID_ERROR_ID を返さなければならない。errorMessage に含まれるHTMLタグを sanitizeMessage() で除去し stored XSS を防止し、エラーレジストリが MAX_STORED_ERRORS（1000件）に達した際は最古エントリから10%を退去（LRU eviction）してメモリリークを防止すること 🔵 ✅実装済 *src/api/routes/errors.ts RegisterBodySchema・sanitizeMessage()・isValidErrorId()・storeError() eviction・@stv/core/config/limits ERROR_REGISTRY_LIMITS・commit 71a3a8c・94テスト追加*

#### エクスポート検証拡張（Phase 93） ✅完了

- REQ-223: システムはエクスポート検証（REQ-093）を拡張し、APNG形式についてはPNG署名に加えてacTL（Animation Control）チャンクの存在・フレーム数正値・fcTL（Frame Control）チャンク数との整合性を検証し、Lottie JSON形式については必須ルートフィールド（v・fr・ip・op・w・h・layers）の存在・fr正値・op>ip・w/h正値・layers配列の各要素ty型フィールドを検証しなければならない 🔵 ✅実装済 *src/export/export-verifier.ts verifyApngChunks()・verifyLottie()・readU32BE()・tests/export/export-verifier.test.ts 27テスト追加・tests/integration/renderer-engine-integration.test.ts renderer→verifier round-trip 4テスト追加*
- REQ-224: システムは POST /api/render エンドポイントにエクスポートレート制限（10リクエスト/15分/IP）を適用し、CPU集約的なレンダリング操作を保護しなければならない。また codec パラメータを列挙型（h264/h265/vp9/av1）で検証し、resolution パラメータを WIDTHxHEIGHT 形式（例: 1920x1080）の正規表現で検証し、不正値には 400 VALIDATION_ERROR を返さなければならない 🔵 ✅実装済 *src/api/middleware/rate-limit.ts exportRateLimiter・src/api/routes/pipeline.ts VALID_CODECS・RESOLUTION_REGEX・@stv/core/config/limits RATE_LIMITS.EXPORT・2テスト追加*

#### エクスポートエンジン検証統合（Phase 95） ✅完了

- REQ-225: システムは EnhancedExportEngine のファイナライズ段階（Stage 5）で ExportVerifier を呼び出し、エクスポート結果（ExportResult）に verification フィールドとして検証結果を含めなければならない。ExportFormat から VerificationFormat へのマッピング（mp4→mp4, webm→webm, gif→gif, apng→apng, interactive-html→json, pdf-animated→pdf, svg-animated→svg, json-lottie→lottie）を行い、各フォーマットの検証結果（valid/errors/warnings/metadata）を結果に含めること 🔵 ✅実装済 *src/export/enhanced-export-engine.ts finalizeExport()・mapExportFormatToVerificationFormat()・10テスト追加*

#### エクスポートメトリクス収集（Phase 96） ✅完了

- REQ-226: システムはエクスポートパイプラインのメトリクスを収集し、Prometheus 互換形式で公開しなければならない。収集項目は (1) フォーマット別エクスポート所要時間（パーセンタイル付き）、(2) フォーマット別 × 成功/失敗別のエクスポート件数、(3) フォーマット別エクスポートファイルサイズ（パーセンタイル付き）、(4) ステージ別（preparing/rendering/encoding/finalizing）所要時間（パーセンタイル付き）とする。メモリ使用量を制限するためサンプル系列あたり最大500件を保持し、超過時は古いサンプルを半減させること 🔵 ✅実装済 *src/export/export-metrics-collector.ts ExportMetricsCollector・src/monitoring/prometheus-exporter.ts buildExportDurationMs()・buildExportOperationsTotal()・buildExportFileSizeBytes()・buildExportStageDurationMs()・src/export/enhanced-export-engine.ts stage/per-export instrumentation・17テスト追加*

#### エクスポートリトライとフェイルセーフ（Phase 97） ✅完了

- REQ-227: システムはエクスポートパイプラインのエンコーディング段階（Stage 3）で一時的エラーが発生した場合、指数バックオフリトライを実行しなければならない。リトライ条件は (1) メモリ不足エラー（OOM）、(2) エンコーダータイムアウト、(3) Worker プロセスクラッシュの3種とし、検証エラー・フォーマット不正・データ欠損などの非一時的エラーはリトライ対象外とすること。最大リトライ回数は3回、初期待機時間は1秒、最大待機時間は30秒、ジッター（0〜500ms）を各試行に付加すること。リトライ試行ごとに ExportMetricsCollector へ retry_attempt ラベル付きでイベントを記録し、全リトライ失敗時は最後のエラーを ExportResult.error に格納すること 🔵 ✅実装済 *src/export/enhanced-export-engine.ts encodeVideoWithRetry()・isTransientExportError()・@stv/core/config/limits EXPORT_RETRY_LIMITS・15テスト追加*

#### エクスポートジョブライフサイクル管理（Phase 98） ✅完了

- REQ-228: システムは実行中のエクスポートジョブをキャンセル可能にし、各ステージにタイムアウトを適用しなければならない。(1) キャンセル: EnhancedExportEngine に cancelExport(jobId: string) メソッドを追加し、呼び出し時に該当ジョブの AbortController を abort して Stage 2（rendering）のフレームループと Stage 3（encoding）を中断し、ExportResult.success = false・error = 'Cancelled' で即時返却すること。(2) ステージタイムアウト: 各ステージに設定可能なタイムアウト（preparing: 30s, rendering: 600s, encoding: 300s, finalizing: 60s）を適用し、超過時は自動的にキャンセル扱いとすること。タイムアウト値は @stv/core/config/limits EXPORT_STAGE_TIMEOUTS で集中管理すること 🔵 ✅実装済 *src/export/enhanced-export-engine.ts cancelExport()・runStageWithTimeout()・@stv/core/config/limits EXPORT_STAGE_TIMEOUTS・15テスト追加*

#### エクスポートジョブキューサービス（Phase 99） ✅完了

- REQ-229: システムはエクスポートジョブの優先度ベースキューサービスを提供しなければならない。(1) 優先度スケジューリング: high/normal/low の3段階優先度でジョブをキューイングし、同優先度内ではFIFO順で処理すること。(2) 同時実行制御: 設定可能な最大同時実行数（デフォルト3）をセマフォパターンで管理し、上限到達時はキューで待機させること。(3) キュー位置追跡: 各ジョブのキュー内位置とETA（平均処理時間×前方ジョブ数）をリアルタイムで提供すること。(4) フェアスケジューリング: 設定可能な間隔（デフォルト30秒）で最も古い低優先度ジョブを昇格させ、飽和を防止すること。(5) ExportMetricsCollector統合: queue_size・queue_wait_time_ms・queue_dequeue_count・queue_priority_distribution の4メトリクスを記録すること 🔵 ✅実装済 *src/export/export-job-queue.ts ExportJobQueue・src/export/__tests__/export-job-queue.test.ts（491行・32テスト）・@stv/core/config/limits EXPORT_QUEUE_LIMITS・コミットa949644*

#### エクスポートアーティファクト管理（Phase 100） ✅完了

- REQ-230: システムはエクスポート成果物のストレージ管理と自動クリーンアップを提供しなければならない。(1) アーティファクト管理: エクスポート成果物をメタデータ付きで保存し、一意のartifactIdで識別すること。(2) TTLベース自動クリーンアップ: 設定可能なTTL（デフォルト1時間）で期限切れアーティファクトを定期削除すること。ストレージクォータ（デフォルト1GB・1000件）超過時はLRU退去すること。(3) ダウンロードURL生成: 有効期限付き（デフォルト5分）のダウンロードURLを生成すること。(4) 使用量追跡: 総バイト数・アーティファクト数・フォーマット別分布をリアルタイムで提供すること。(5) ExportMetricsCollector統合: artifact_stored_count・artifact_storage_bytes・artifact_expired_count・artifact_download_count の4メトリクスを記録すること 🔵 ✅実装済 *src/export/export-artifact-store.ts・@stv/core/config/limits ARTIFACT_STORE_LIMITS・26テスト・コミットREQ-230*

#### エクスポートアーティファクトパイプライン統合（Phase 101） ✅完了

- REQ-231: システムは EnhancedExportEngine のファイナライズ段階（Stage 5）で ExportArtifactStore.store() を呼び出し、エクスポート完了成果物を自動的にアーティファクトストアに登録しなければならない。store() 呼び出し失敗（クォータ超過等）は警告ログ出力のみとし、ExportResult.success をブロックしないこと 🔵 ✅実装済 *src/export/enhanced-export-engine.ts finalizeExport()・src/export/export-artifact-store.ts store()・TC-231-01/02テスト通過・コミット681c639*
- REQ-232: システムは ProductionExporter のエクスポート完了時にも ExportArtifactStore.store() を呼び出し、プリセットベースのプロダクションエクスポートでもアーティファクト管理を利用可能にしなければならない 🔵 ✅実装済 *src/export/production-exporter.ts・src/export/export-artifact-store.ts・コミット681c639*
- REQ-233: システムは ExportJobQueue のジョブ完了時、ジョブに紐づくエクスポート成果物を ExportArtifactStore に自動保存し、ジョブの metadata に artifactId を記録しなければならない 🔵 ✅実装済 *src/export/export-job-queue.ts・src/export/export-artifact-store.ts・コミット681c639*
- REQ-234: システムはエクスポートアーティファクトのダウンロード API（GET /api/v1/export/artifacts/:artifactId/download）を提供し、URL検証トークンと有効期限をチェックし、正当なリクエストに対して成果物データを返さなければならない 🔵 ✅実装済 *src/export/export-artifact-store.ts generateDownloadUrl()・src/api/routes/export.ts・コミットa628416*

#### エクスポートアーティファクトE2E検証（Phase 102） ✅完了

- REQ-235: システムは ExportArtifactStore に TTL とクォータ制限（ARTIFACT_STORE_LIMITS）を設定した上で、ストレージクォータに達した際に LRU 退去が正しく発火することを検証するエンドツーエンドテストを提供しなければならない。テストは以下を証明すること: (1) クォータ到達前に最も古い未使用アーティファクトが退去される、(2) 退去後の新規保存が成功する、(3) ExportMetricsCollector に artifact_expired_count が記録される 🔵 ✅実装済 *src/export/export-artifact-store.ts evictLRU()・@stv/core/config/limits ARTIFACT_STORE_LIMITS・TC-235-01/02/03テスト通過・コミット5d76c31*
- REQ-236: システムは TTL 期限切れアーティファクトが定期クリーンアップ（CLEANUP_INTERVAL_MS）で正しく削除されることを検証する統合テストを提供しなければならない。タイマー駆動のクリーンアップが発火し、期限切れアーティファクトが getUsage() の統計から除外されることを確認すること 🔵 ✅実装済 *src/export/export-artifact-store.ts cleanup()・startAutoCleanup()・ARTIFACT_STORE_LIMITS.DEFAULT_TTL_MS・コミット5d76c31*
- REQ-237: システムは EnhedExportEngine → ExportArtifactStore → download API の完全なエクスポート成果物ライフサイクル（エクスポート実行→アーティファクト保存→ダウンロードURL生成→取得）を検証するエンドツーエンドテストを提供しなければならない 🔵 ✅実装済 *src/export/enhanced-export-engine.ts・src/export/export-artifact-store.ts・TC-237-01テスト通過・コミット5d76c31*

#### アーティファクト管理REST API（Phase 103） ✅完了

- REQ-238: システムはエクスポートアーティファクト一覧API（GET /api/v1/export/artifacts）を提供し、フォーマットフィルタ・ページネーション（limit/offset、最大200件/ページ）をサポートしなければならない 🔵 ✅実装済 *src/api/routes/export.ts GET /artifacts・TC-238テスト通過・コミットa628416。上限は明示?limit=とデフォルト経路の両方に適用（TC-238-B01）、format検証はプロトタイプ継承キーを拒否（TC-238-E01）*
- REQ-239: システムはエクスポートアーティファクトのメタデータ取得API（GET /api/v1/export/artifacts/:artifactId）と削除API（DELETE /api/v1/export/artifacts/:artifactId）を提供し、UUID v4形式検証と404エラーレスポンスを実装しなければならない 🔵 ✅実装済 *src/api/routes/export.ts GET/DELETE /artifacts/:id・UUID_V4_RE形式検証・TC-239テスト通過・コミットa628416*
- REQ-240: システムはエクスポートアーティファクト使用量統計API（GET /api/v1/export/artifacts/usage）を提供し、アーティファクト数・総バイト数・フォーマット別分布を返さなければならない 🔵 ✅実装済 *src/api/routes/export.ts GET /artifacts/usage・ExportArtifactStore.getUsage()・TC-240テスト通過・コミットa628416*

#### エクスポートバッチジョブREST API（Phase 104） ✅完了

- REQ-241: システムはエクスポートバッチジョブの投入API（POST /api/v1/export/jobs）を提供し、ジョブ優先度（high/normal/low）・フォーマット指定・エクスポートオプションを受け付け、投入されたジョブのjobId・キュー位置・ETAを返さなければならない 🔵 ✅実装済 *src/api/routes/export-jobs.ts POST /jobs・TC-241テスト通過・server.ts登録済*
- REQ-242: システムはエクスポートジョブのステータス取得API（GET /api/v1/export/jobs/:jobId）を提供し、ジョブ状態（queued/running/completed/failed/cancelled）・進捗率・成果物artifactIdを返さなければならない 🔵 ✅実装済 *src/api/routes/export-jobs.ts GET /jobs/:jobId・ExportJobQueue.findJob()・TC-242テスト通過*
- REQ-243: システムはエクスポートジョブのキャンセルAPI（DELETE /api/v1/export/jobs/:jobId）を提供し、実行中ジョブのAbortController経由キャンセルとキュー待機中ジョブのキュー削除を実装しなければならない 🔵 ✅実装済 *src/api/routes/export-jobs.ts DELETE /jobs/:jobId・TC-243テスト通過*

#### エクスポートセキュリティ hardening（Phase 108） ✅実装済

- REQ-244: システムは ExportContentValidator のイベントハンドラ正規表現を名前付き定数配列（EVENT_HANDLER_NAMES）として定義し、RegExp コンストラクタでプログラム的に構築しなければならない。これによりイベント種別の追加・変更が配列要素の追加のみで完結し、コピーペーストミスを防止する 🔵 ✅実装済 *src/export/export-content-validator.ts EVENT_HANDLER_NAMES + EVENT_HANDLER_RE・コミット予定*
- REQ-245: システムは既知の正常なエクスポートペイロード（SceneGraph・JSON）を突然変異させ、各変異がガードを通過するかセキュリティエラーとして検出されることを検証するプロパティベース変異ファジングテストを提供しなければならない。20種類のXSSベクタ × 50イテレーション（合計100変異）で構成し、正規ペイロードの偽陽性ゼロも保証すること 🔵 ✅実装済 *src/export/__tests__/export-mutation-fuzz.test.ts・130テスト・mulberry32決定論PRNG・20 XSSベクタ*
- REQ-246: システムはエクスポートセキュリティガードの拒否メトリクス（SecurityMetricsCollector）を提供し、防御レイヤー（content-validator / strict-mode-block / escape-function）別・重要度（high / medium）別・パターン別のカウンターを追跡し、Prometheus互換テキスト形式で出力できなければならない。これにより多層防御アーキテクチャが観測可能となる 🔵 ✅実装済 *src/export/security-metrics-collector.ts・SecurityMetricsCollector・Prometheus exposition v0.0.4・12テスト*

#### セキュリティファジング CI 拡張（Phase 109） ✅実装済

- REQ-247: システムの変異ファジングテストスイートは CIモード（FUZZ_SEEDS 環境変数）をサポートし、固定決定論シード（mulberry32）に加えて複数のランダムシードでファジングを実行できなければならない。これにより決定論シードが見逃すエッジケースを CI で捕捉する 🔵 ✅実装済 *src/export/__tests__/export-mutation-fuzz.test.ts・FUZZ_SEEDS環境変数・デフォルト3シード・各シード50イテレーション*
- REQ-248: システムは全エクスポート経路（MultiFormatExporter・EnhancedExportEngine）が悪意あるペイロード処理時にSecurityMetricsCollectorへガード拒否メトリクスを送信することを検証する回帰テストを提供しなければならない。これにより将来のコード変更で特定経路がサイレントにガードをバイパスすることを防ぐ 🔵 ✅実装済 *src/export/__tests__/export-guard-metrics-coverage.test.ts・全エクスポート経路のSecurityMetricsCollector統合検証*
- REQ-249: システムは悪意あるペイロードを用いた完全なエクスポート→サニタイズ→ガードメトリクス→ダウンロードパイプラインのE2E統合テストを提供しなければならない。多層防御チェーンが全エクスポートサービス（SVG/JSON/HTML）にわたって保持されることを証明する 🔵 ✅実装済 *src/export/__tests__/export-security-e2e.test.ts・ malicious SceneGraph → validate → sanitize → metrics → download blob*

#### CI品質ゲート・ガードファジング（Phase 110）

- REQ-250: システムのCIパイプラインは red-phase 検証テスト（guard-red-phase-verification）を security-fuzz ジョブに含め、マージ前に全キャナリペイロードがガードによって検出されることを継続的に検証しなければならない。これによりセキュリティガードの回帰が CI で即座に捕捉される 🔵 *src/export/__tests__/guard-red-phase-verification.test.ts・.github/workflows/ci.yml security-fuzz ジョブ・test:fuzz パターン拡張*
- REQ-251: システムはエクスポートガード関数（validateExportPayload・validateSceneGraphForExport・sanitizeFilename・escapeXML・escapePdfString 等）に対する専用ファジングテストを提供し、FUZZ_SEEDS 環境変数によるマルチシード対応を行わなければならない。各ガード関数が多様な悪意入力を確実に検出・サニタイズすることを検証する 🔵 *src/export/__tests__/export-guard-fuzz.test.ts・mulberry32 PRNG・FUZZ_SEEDS対応*
- REQ-252: システムのCI security-fuzz ジョブは build ジョブの成功に依存しなければならない。これによりテストは通過するがビルドが壊れている状態でのマージを防止する 🔵 *.github/workflows/ci.yml security-fuzz ジョブ needs 依存関係*

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
- EDGE-008: ErrorAlertSystem コンポーネントの auto-hide setTimeout は useRef Set で追跡され、useEffect クリーンアップで全て clearTimeout されなければならない。setTimeout を state updater 関数内で呼び出してはならない（React anti-pattern） 🔵 ✅実装済 *src/components/ErrorAlertSystem.tsx・コミットc3254a3・7テスト追加*
- EDGE-009: OverlapResolver の applyStrategyWithTimeout は Promise.race 完了後に clearTimeout を呼び出し、戦略がタイムアウト前に完了した場合でもタイマー参照を解放しなければならない 🔵 ✅実装済 *src/visualization/layout/OverlapResolver.ts・コミットc3254a3・2テスト追加*
- EDGE-010: EnhancedExportEngine の encodeVideoWithRetry リトライ遅延中、タイマーが正常に完了した場合（abort よりタイマーが勝った場合）、AbortSignal から abort リスナーを removeEventListener で削除しなければならない。リスナーを削除しない場合、リトライごとにリスナーが蓄積しメモリリークが発生する 🔵 ✅実装済 *src/export/enhanced-export-engine.ts・src/export/__tests__/export-abort-listener-cleanup.test.ts・3テスト追加*
- EDGE-011: 全プロダクションコードパスの catch ブロックは console.error ではなく構造化 logger.error を使用しなければならない。エラーメッセージフォーマットは `[ERROR] [ComponentName] message` となる（logger がレベルプレフィックスを付与）。console.error が残存している場合、ログレベルフィルタリングがバイパスされる 🔵 ✅実装済 *@stv/core/utils/logger logger.error()・src/optimization/memory-cache.ts・src/analysis/budget-alert.ts・src/monitoring/production-monitoring-excellence.ts・src/quality/error-recovery-event-bus.ts・コミット78efa1b で performance-dashboard.ts・real-time-performance-monitor.ts 修正済*

### 境界値

- EDGE-101: 50MB ギリギリの音声ファイルでも正常に処理できなければならない 🔵 *README.md・PIPELINE_FLOW.md §7.2 より*
- EDGE-102: 非常に短い音声（1秒未満）はエラーとして処理しなければならない 🔵 *PIPELINE_FLOW.md §7.1 Quality Gates より*
- EDGE-103: 1時間を超える音声ファイルは処理前に警告を表示しなければならない 🟡 *PIPELINE_FLOW.md §7.1 Quality Gates から妥当な推測*

### CI・インテグレーション検証ハードening（Phase 111）

- REQ-253: システムはエクスポートリトライパイプラインの統合テストとして、5回以上のリトライサイクルでAbortSignalリスナー数が安定（リークしない）ことを検証しなければならない 🔵 *AI Hub make-runフィードバック・EDGE-010修正の統合検証・src/export/enhanced-export-engine.ts encodeVideoWithRetry より*
- REQ-254: CIワークフロー（.github/workflows/ci.yml）の全ジョブに timeout-minutes を設定し、ELAPSED時間が警告閾値を超えた際にサマリージョブで非ゼロ終了または失敗フラグを設定しなければならない 🔵 *AI Hub make-runフィードバック・_bmad/bmm/workflows/testarch/ci/github-actions-template.yaml参照・.github/workflows/ci.yml現状（timeout-minutes未設定）より*
- REQ-255: ESLintルール（no-console）を src/ ディレクトリに適用し、logger.ts以外のconsole.error使用をCIで検出・ブロックしなければならない 🔵 *AI Hub make-runフィードバック・EDGE-011 console.error→logger.error正規化完了の回帰防止・@stv/core/utils/logger:29が唯一の正当なconsole.error使用より*
- REQ-256: EnhancedExportEngine はリトライ設定（maxRetries等）をコンストラクタまたはオプション経由で外部から指定可能にし、テスト時に5回以上のリトライサイクルを再現できるようにしなければならない 🔵 *AI Hub make-runフィードバック・EXPORT_RETRY_LIMITS.MAX_RETRIES=3のハードコードが高リトライ回数テストを妨げている現状より*
- REQ-257: シーンデュレーション計算修正（actualVideoRenderer.ts）の統合テストとして、既知のタイムスタンプを持つ複数シーンの動画レンダリングで累積デュレーションが正確であることを検証しなければならない 🔵 *AI Hub make-runフィードバック・コミット2ea5a98のactualVideoRenderer.ts修正はユニットテストのみ・統合検証が必要より*

### エラー回復可観測性・未テストモジュールカバレッジ（Phase 112）

- REQ-258: EnhancedErrorRecoveryの5つのリカバリ戦略（intelligent_retry/degraded_quality_fallback/cache_recovery/alternative_algorithm/minimal_viable_output）のcatchブロックが、戦略失敗時にlogger.errorでエラーを記録しなければならない 🔵 *コミット27b38eb silent catch修正の継続・src/quality/enhanced-error-recovery.ts戦略catchブロックより*
- REQ-259: 監視APIルート（monitoring.ts）の全catchブロックが、500エラー送信前にlogger.errorでサーバーエラーを記録しなければならない。400バリデーションエラーは記録しない（クライアントエラーのため） 🔵 *コミット27b38eb silent catch修正のAPI層への拡張・src/api/routes/monitoring.ts sendError()より*
- REQ-260: BatchOperationRecovery（src/quality/batch-operation-recovery.ts, 276行）のユニットテストカバレッジとして、逐次処理・並行処理・リトライ・フォールバック・集計統計・エッジケースを検証しなければならない 🔵 *未テストモジュールgap分析（Phase 110）・AI Hub make-runフィードバックより*
- REQ-261: ErrorRecoveryMonitor（src/quality/error-recovery-monitor.ts, 278行）のユニットテストカバレッジとして、ライフサイクル・サンプリング・アラートレベル計算・リセット・getTrackerを検証しなければならない 🔵 *未テストモジュールgap分析（Phase 110）・AI Hub make-runフィードバックより*
- REQ-262: 監視APIルートのエラーロギングを検証するテストとして、ダッシュボード例外発生時にlogger.errorが呼ばれること・400エラーでは呼ばれないことを検証しなければならない 🔵 *REQ-259修正のテスト検証・src/api/routes/__tests__/monitoring-error-logging.test.tsより*

### NaN/Type Safety コンソリデーション完結（Phase 113） ✅実装済

- REQ-263: システムの品質ゲート（quality-gate.ts）・パイプライン統合（framework-integrated-pipeline.ts）・複合レイアウトエンジン（complex-layout-engine.ts）・フォールバックレイアウト（FallbackLayoutStrategy.ts）・文化適応レイアウト（CulturalLayoutAdapter.ts）の全てが getNodeWidth/getNodeHeight ヘルパーを使用し、直接 .w/.h アクセスを行わないことで NaN 伝播を防止しなければならない 🔵 ✅実装済 *AI Hub make-runフィードバック: w/h fallback consolidation completion・コミット7a8ca46から継続・6ファイルの残存アクセスを移行*
- REQ-264: システムの図解検出器（diagram-detector.ts）のメトリクス追跡・品質評価・信頼度スコアリングが sanitizeFinite/sanitizeDiagramType を使用し、NaN や不正タイプ値の伝播を防止しなければならない。ソートコンパレータ・LLM推奨ボーナス・メトリクス履歴・信頼度閾値テスト・タイプ適切性テストを含む 🔵 ✅実装済 *AI Hub make-runフィードバック: unguarded result.totalScore/type access audit・src/analysis/diagram-detector.ts の5箇所の未ガードアクセスを修正*
- REQ-265: システムのシーン分割器（scene-segmenter.ts）のスコア還元・信頼度平均計算が sanitizeFinite を使用し、NaN値を含むセグメントデータから NaN が伝播しないことを保証しなければならない 🔵 ✅実装済 *AI Hub make-runフィードバック: unguarded result.score access audit・src/analysis/scene-segmenter.ts の3箇所のreduce操作を修正*
- REQ-266: システムは NaN/Type Safety コンソリデーションの完了を検証するテストスイートとして、(1) w/h移行完了性テスト（NaN・Infinity・undefined・null・混合ディメンションのフォールバック検証）、(2) メトリクス・サニタイゼーション検証テスト（ソート安定性・Map安全性・信頼度ブースト計算のNaN耐性）を提供しなければならない 🔵 ✅実装済 *src/visualization/__tests__/wh-migration-completeness.test.ts（17テスト）・src/analysis/__tests__/diagram-detector-metrics-sanitization.test.ts（15テスト）*

### ルールベースフォールバック品質改善・継続的学習安全性（Phase 114） ✅実装済

- REQ-267: システムの図解検出器（diagram-detector.ts）のルールベースフォールバックパスは、入力テキストからキーフレーズを抽出し、図解タイプに応じた適切なトポロジー（順次・ハブスポーク・循環・分岐・ペア）でノード・エッジを生成しなければならない。ハードコードされた固定ラベルを使用せず、入力テキストの内容を反映したノードラベルを生成すること。日本語・英語の両方をサポートし、短文・空文字の場合はグレースフルにフォールバックすること 🔵 ✅実装済 *コミット eeb74e8: generateDiagramSpecificContent() の8つのハードコードサブメソッドを generateContentFromText() に統合・src/analysis/diagram-detector.ts・src/analysis/__tests__/diagram-content-generation.test.ts（11テスト）*
- REQ-268: システムの継続的学習モジュール（continuous-learner.ts）は destroy() メソッドを提供し、setInterval タイマーのクリアに加えて全ての内部状態（学習データ・最適化戦略キャッシュ等）を解放しなければならない。destroy() 呼出後はタイマーコールバックが実行されないことを保証すること 🔵 ✅実装済 *コミット 9ec2a09: destroy() メソッド追加・src/framework/continuous-learner.ts・src/framework/__tests__/continuous-learner-safety.test.ts*
- REQ-269: システムの継続的学習モジュール（continuous-learner.ts）のピアソン相関計算は、配列長の不一致を検出して0を返し、NaN・Infinity・undefinedを含む入力から NaN が伝播しないことを保証しなければならない 🔵 ✅実装済 *コミット 9ec2a09: pearson() に xs.length !== ys.length 早期リターン追加・非有限値ガード追加・src/framework/__tests__/continuous-learner-safety.test.ts（9テスト）*

### テストスイート安定化・Lint完全修正（Phase 115） ✅実装済

- REQ-270: プロジェクト全体のESLintエラーを0件にしなければならない。eslint.config.js の設定調整・テストファイル・ソースファイルのlint修正を含む。修正後は `npm run lint` がエラー0件で完了すること 🔵 ✅実装済 *コミット 73b7aea: ESLint 234エラー→0解消・16ファイル修正（eslint.config.js・corruption-recovery-integration・diagram-detector-llm-boundary・multi-format-exporter・config-validator・batch-operation-recovery・streaming-transcriber・sanitize-fuzz・layout-pipeline-deep-integration・monitoring-optimization-mutation・ci-timeout-guard・no-console-regression・pipeline-enhanced-layout-null-item-guard）*
- REQ-271: ESM環境でのテストモックは、非推奨の `jest.unstable_mockModule` ではなく標準の `jest.mock` を使用しなければならない。これによりテストランナーの安定性と保守性を確保すること 🔵 ✅実装済 *コミット 558398d: gemini-analyzer-comprehensive.test.ts・llm-service-comprehensive.test.ts の unstable_mockModule → jest.mock 置換*
- REQ-272: 音声ファイル検証（validateAudioFile）は、File オブジェクトの size プロパティへの安全でないアクセスによりクラッシュしてはならない。また、テスト環境でのFile グローバルの不在に対してグレースフルに処理しなければならない 🔵 ✅実装済 *コミット 3fd2f0e: @stv/core/utils/audio-validation の file.size 安全アクセス修正・tests/unit/async-resource-cleanup.test.ts・tests/unit/framework/continuous-learner-numeric-safety.test.ts のテスト環境修正*
- REQ-273: セマンティック類似度計算（semantic-similarity.ts）は、CJK（中国語・日本語・韓国語）テキストの文字レベルトークン化をサポートし、空文字・単一文字・長文のエッジケースで正しい類似度スコアを返さなければならない。また、コード内に非ASCIIメソッド名（キリル文字等）が混入していてはならない 🔵 ✅実装済 *コミット 137cb82: CJKトークン化エッジケーステスト追加・コミット 9a3cefe: testTypeAppropriateность → testTypeAppropriateness メソッド名修正（キリル文字混入解消）*

### Record<UnionType,T>完全性強制・Prometheus export・SecurityMetrics TTL（Phase 116） ✅実装済

- REQ-274: システムは `Record<string, T>` ではなく `Record<DiagramType, T>` を使用することで、11種の DiagramType バリアント（flow/tree/timeline/matrix/cycle/flowchart/comparison/network/conceptmap/mindmap/general）全てのコンパイル時網羅性を保証しなければならない 🔵 ✅実装済 *コミット 67f95f4, c6d2c42: 8つの辞書リテラル（llm-service.ts, video-generator.ts, intelligent-cache.ts, DiagramPreview.tsx 等）を Record<DiagramType, T> に置換・tests/unit/types/record-completeness.test.ts で実行時検証*
- REQ-275: システムは `Record<string, T>` ではなく `Record<ErrorType, T>` を使用することで、ErrorType 11種全ての辞書キー網羅性を保証しなければならない 🔵 ✅実装済 *コミット f3d0767: error-classifier.ts, pipeline-error-guidance.ts, error-handler.ts の3ファイル*
- REQ-276: システムの図解検出器（diagram-detector.ts）のルールベース検出（ruleBasedDetection）は、flowchart/comparison/network/conceptmap/mindmap/general の6種を含む全11 DiagramType を完全サポートしなければならない 🔵 ✅実装済 *コミット cf87311: 5種のみサポートしていた ruleBasedDetection を11種に拡張・完全性テスト追加*
- REQ-277: システムはエクスポートメトリクス（処理時間・品質スコア・キャッシュヒット率）を Prometheus text exposition 形式で `/metrics` エンドポイントに公開しなければならない 🔵 ✅実装済 *コミット f3d0767: src/export/export-metrics-collector.ts に Prometheus 出力追加*
- REQ-278: セキュリティメトリクスは環境変数 `METRIC_TTL_HOURS`（デフォルト1時間）で自動期限切れとなり、メモリリークを防止しなければならない 🔵 ✅実装済 *コミット 67f95f4: TTL 実装*
- REQ-279: エクスポートコンテンツバリデーター（export-content-validator.ts）は `EXPORT_VALIDATION_MAX_DEPTH` 環境変数で再帰深度を設定可能とし、VideoRenderer/limits の Record 型強制と組み合わせた動的設定を提供しなければならない 🔵 ✅実装済 *コミット 2aa19ec*

### フレームワーク境界型安全性・Constant-desync 解消（Phase 117） ✅実装済

- REQ-280: システムの自動改善エンジン（auto-improvement-engine.ts）は UI 投影型 `QualityRecommendation {name, description}` を境界投影として提供し、`execute` クロージャや内部実装詳細が UI 層にリークしないことを保証しなければならない 🔵 ✅実装済 *コミット 5ece068f: src/framework/auto-improvement-engine.ts に QualityRecommendation + toQualityRecommendations 追加・framework-integrated-pipeline.ts の戻り値型 `unknown` → `QualityAnalysisResult` で型安全化・useFrameworkPipeline.ts の嘘 `as string[]` キャスト廃止・FrameworkDashboard.tsx を `{rec}` → `rec.name`/`rec.description` 描画に変更*
- REQ-281: システムの品質分析（analyzeMetrics）は engine が計算した `metrics.overallScore`（0-100、calculateQualityScore 由来）をレスポンスに含め、ダッシュボードが正しく総合品質スコアを表示できるようにしなければならない 🔵 ✅実装済 *コミット d96dd6c6: analyzeMetrics return に overallScore を追加（return 型明示化を含む）+ RED→GREEN 検証テスト（positive 92 / negative 41 anchors）*
- REQ-282: システムのヘルスチェックポーリング間隔は `HEALTH_CHECK_INTERVAL_MS` として単一ソースから import され、useAdminAnalytics.ts と health-check-service.ts 間のリテラル重複（10000 vs 10_000）による潜在 desync を構造的に防止しなければならない 🔵 ✅実装済 *コミット b5c6b71b: src/monitoring/health-check-service.ts の setInterval(10000) リテラルを import HEALTCHECK に置換*
- REQ-283: システムのレイアウト計算（getNodeWidth/getNodeHeight）は `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT` デフォルトパラメータを単一ソースとし、呼び出し側の `120`/`60` リテラル渡しを排除しなければならない 🔵 ✅実装済 *コミット 5bfeb709: 22呼び出しサイト（layout-auto-optimizer 4 / smart-label-sizer 2 / SimulatedAnnealing 2 / multi-format-exporter 14）から冗長引数を削除・node-dimension-default-coupling.test.ts で構造結合ガード*
- REQ-284: async-resource-cleanup 等の ESM テストモック環境では、`jest.doMock('crypto')` のようなモジュール単位モックが no-op となる制約に対し、決定的な実入力（同一 ArrayBuffer 共有）によってコンポーネントのリアルパス（computeFileHash content-hash 分岐）をトリガーし、テストの意図した不変条件を検証しなければならない 🔵 ✅実装済 *コミット 28fc8476: StubFile に同一 ArrayBuffer を持たせて content-hash 分岐で衝突*

### 品質モニタ diagram-type パリティ（Phase 118） ✅実装済

- REQ-285: システムの品質モニタ（src/quality/quality-monitor.ts）のコンテンツ妥当性スコアリング（assessContentRelevance）は、有効な図解タイプ判定をハードコードされた5種リスト（flow/tree/timeline/matrix/cycle）ではなく、正典ガード `isDiagramType`（@stv/core/types/diagram・11種 DiagramType 単一ソース）に委譲しなければならない。LLM 分析器（content-analyzer.ts / prompt-templates.ts）が主要タイプとして 'flowchart'（'flow' ではなく）を排出し、ルールベース検出が mindmap/comparison 等を排出するため、ハードコードリストは flowchart/comparison/network/conceptmap/mindmap/general の6正典タイプを見逃し、それらのシーンが accuracyScore/overallScore で不当なペナルティ（同一シーンで約0.036点低下・checkDeploymentReadiness ≥0.7 帯への影響）を受けていた。'flow' vs 'flowchart' 名前空間バグ（f178cbf）と同クラス、overlap margin バグ（6923806）と同「correct output への誤ペナルティ」系。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: src/quality/quality-monitor.ts validTypes ハードコード → isDiagramType 委譇・src/quality/__tests__/quality-monitor-diagram-type-parity.test.ts で11タイプ完全パリティ + 非正典タイプ拒否の RED→GREEN 検証（flowchart 0.836→0.872 修正確認）*

### 動画レンダリング fps 伝搬（Phase 119） ✅実装済

- REQ-286: システムの動画生成（`VideoGenerator.options.fps` = 24|30|60）は、要求されたフレームレートを実際のレンダラ（`ActualVideoRenderer`）まで伝搬し、レンダリングされるコンポジションの `fps` および `durationInFrames` に反映しなければならない。従来 `executeRemotionRender`（src/pipeline/video-generator.ts）は `actualVideoRenderer.renderVideo(...)` 呼び出しで `fps` を渡さず、`ActualVideoRenderer.getComposition`（src/pipeline/actual-video-renderer.ts）が `const fps = 30` を固定値としていたため、60fps（高品質プリセット）や24fps（高速プリセット）の要求が暗黙に30fpsでレンダリングされ、`durationInFrames` も常に30fps換算（10s=300フレーム）となって frame↔duration が乖離していた。これは `prepareRenderConfiguration` が `config.fps = this.options.fps || 30` で正しく計算した値を、すぐ次の境界（renderVideo 呼び出し）で破棄する「producer-computes-but-boundary-drops」クラスであり、同一ファイル内の quality 伝搬修正（6937b8b）の直前境界で修正済みのバグの mirror。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: `ActualVideoRenderOptions.fps?` 追加・`video-generator.ts` executeRemotionRender が `fps: this.options.fps || 30` を renderVideo に渡すよう修正・`actualVideoRenderer.ts` getComposition が `resolvedFps = fps ?? 30` で `composition.fps` と `durationInFrames`（min-floor も fps にスケール）を上書き・src/pipeline/__tests__/actual-video-renderer-duration-integration.test.ts に fps honoring（60/24fps・min-floor・後方互換）テスト追加・tests/integration/video-generator-render-quality.test.ts に fps 伝搬テスト追加。ガード検証: 修正無効化で3テストが RED → 復元で GREEN*

### 解析器の循環検出 confidence 反映（Phase 120） ✅実装済

- REQ-287: システムの図解構造抽出器（src/analysis/gemini-analyzer.ts）は、O(V+E) の DFS で検出した循環グラフ情報（`hasCycles`）を抽出品質の confidence に反映しなければならない。従来 `createEnhancedParser` は `hasCycles = this.detectCycles(validEdges, nodeIds)` を計算しながら、兄弟メトリクスである `edgeRatio`（スパース関係性ペナルティ）や `disconnectedNodes`（孤立ノードペナルティ）と異なり一度も消費せず、循環を含む非-'cycle' 図解でも confidence が初期値 0.9 のまま据え置かれていた。これは「producer-computes-but-DROPS」クラス（overallScore wiring d96dd6c6 / recommendations 型投影 5ece068f と同系）であり、JSDoc が「for quality assessment」と明記する意図に対する未配線であった。修正は循環を非-'cycle' タイプでのみ −0.1 ペナルティとし、'cycle' 型は最終ノード→先頭ノードの閉路が意図構造（diagram-content-generation の createCircularEdge）であるため免除する型 aware 設計とする（無条件ペナルティは cycle 型ダイアグラムへの誤罰 = 修正対象と同種の「correct output への誤ペナルティ」となるため）。confidence は recordMetrics（relationshipAccuracy）および戻り値に伝播する。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: src/analysis/gemini-analyzer.ts に `if (hasCycles && mappedType !== 'cycle') confidence -= 0.1;` 追加・src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts の「should detect cycles」stale trap（`>=0.5` のみで base 0.9 常に green）を `<0.9` に修正 + cycle 型免除テスト追加・ガード検証: 修正前は RED（Received: 0.9）→ 修正後 GREEN（39/39）。全 analysis 691 テスト + 型チェック green*

### レイアウト評価 overlap 閾値のプロデューサ一致（Phase 121） ✅実装済

- REQ-288: システムのレイアウト品質評価器（src/visualization/strategies/LayoutEvaluator.ts）は、ノード重なり検出（detectAllOverlaps / countOverlaps）を *視覚的な実重なり*（gap < 0）で判定しなければならず、レイアウト生成のプロデューサ（src/visualization/strategies/OverlapResolver.ts）が保証する「gap ≥ 0」と同じ述語を用いなければならない。従来 detectAllOverlaps の既定バッファは `config.nodeSeparation`（LayoutEngine 既定 50）であり、`nodesOverlap(a,b,50)` は両軸とも gap < 50 のペアを「重なり」とした。しかしプロデューサは `getMinimumSeparationForType`（flow=30/tree=40/timeline=20/matrix=25/cycle=35）で中心距離を `separation + (w1+w2)/2` に分離し、`finalOverlapResolution` が `nodesOverlap(a,b,0)` が偽になるまで反復するため、最大目標 tree=40 でさえ < 50 となり、**解決済みの全合法ペア（gap 20-40px）が偽の重なりとして検出**されていた。これは `calculateLayoutConfidence` の no-overlap 上限（≈0.95）を −0.1/ペアの罰則床へ押し下げ、SceneGraph.confidence → simple-pipeline の layoutQuality/scene confidence（simple-pipeline.ts:286/330）→ video-generator.ts:312 の偽 "Low confidence" 警告へと伝播する「invariant-split」クラス（overlap margin バグ 6923806 / overlap-delegate c34f5f12 と同方向）。修正は checker 既定バッファを 0（実重なり）に変更しプロデューサ定義へ委譲する（明示的 `spacing` 引数は維持）。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: src/visualization/strategies/LayoutEvaluator.ts detectAllOverlaps の `spacing ?? this.config.nodeSeparation` → `spacing ?? 0`・tests/visualization/strategies/layout-evaluator.test.ts に production config（nodeSeparation:50）で 30px gap 合法ペアの overlapCount=0 + confidence ≥0.95、実重なりは検出維持、の RED→GREEN 検証を追加。ガード検証: 修正無効化で2テストが RED（overlapCount 1・confidence 0.8）→ 復元で GREEN（16/16）*

### レイアウト評価コンプライアンス結果の伝搬（Phase 122） ✅実装済

- REQ-289: システムのレイアウト品質評価器（src/visualization/strategies/LayoutEvaluator.ts）の `evaluateLayoutWithCustomInstructions` は、計算した Custom Instructions コンプライアンス結果（zeroOverlaps / fastProcessing / hasValidStructure / withinBounds の4基準・complianceScore・passed）を戻り値として伝搬し、失敗時には呼び出し元がそれを観測できなければならない。従来同メソッドは `Promise<void>` であり、metrics・compliance・complianceScore・passed を計算しながら一切返却・記録・消費せず、LIVE 呼び出し元（src/visualization/layout-engine.ts:182 が全 non-simple レイアウト生成で `await` して結果破棄）においてコンプライアンス違反（重なり・領域外・低速・空レイアウト）が暗黙に埋もれていた。これは「producer-computes-but-DROPS」クラス（hasCycles 8d8a245e / overallScore d96dd6c6 と同系）であり、テスト名「should report failures for overlapping layouts」が意図を示すにもかかわらず本体は `resolves.toBeUndefined()` のみで失敗と成功を区別できなかった。修正は `LayoutComplianceResult`（passed/complianceScore/failures）を返し、layout-engine が `!passed` のとき `this.logger.warn` で失敗基準を表面化する（confidence は calculateLayoutConfidence が既に重なりペナルティを与えるため二重罰則を避け報告のみ）。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: src/visualization/types.ts に LayoutComplianceResult 追加・LayoutEvaluator.evaluateLayoutWithCustomInstructions を void → LayoutComplianceResult 返却に変更・layout-engine.ts が !passed を warn ログ・tests/visualization/strategies/layout-evaluator.test.ts の2テストを toBeUndefined → 戻り値形状検証（clean=passed/score1/failures[]、overlap=score0.5/failures[zeroOverlaps,fastProcessing]）に修正。ガード検証: 旧 void 挙動に戻すと2テストが RED（Cannot read 'passed' of undefined）→ 復元で GREEN（16/16）。可視化48スイート/1149テスト + tsc green*

### 図解タイプ正典リストの単一ソース委譲（Phase 123） ✅実装済

- REQ-290: システムの図解タイプ正典リスト `DIAGRAM_TYPES`（@stv/core/types/diagram）は、DiagramType 11種単一ソースとして `export` され、`isDiagramType` と全消費者がこれを共有しなければならない。従来 `DIAGRAM_TYPES` は `const`（非 export）であったため外部から参照できず、図解検出器（src/analysis/diagram-detector.ts:1029 detect()）は11種リテラル `['flow','flowchart',...,'general'] as DiagramType[]` を再字面化していた。`as DiagramType[]` キャストが型チェッカーを無効化するため、DiagramType ユニオンに12種目を追加してもこのスコアリングループは新タイプを暗黙にスキップし（スコア未割当）ドリフトが検出されなかった。これは「hardcoded-constant desync」クラス（HEALTH_CHECK single-source b5c6b71b / node-dimension 5bfeb709 と同系）であり、正典配列が非 export であることが根本原因であった。修正は `DIAGRAM_TYPES` を `readonly DiagramType[]` として export し（isDiagramType は内部で `as readonly string[]` キャストで `.includes` を維持）、diagram-detector を正典への委譲に変更する。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: @stv/core/types/diagram の DIAGRAM_TYPES を export + readonly DiagramType[] 型化・isDiagramType を内部キャスト保持・src/analysis/diagram-detector.ts detect() のリテラル+キャスト → DIAGRAM_TYPES.map 委譲・tests/unit/analysis/diagram-detector-type-parity.test.ts に「全正典タイプを過不足なくスコア付け（primary+alternatives が DIAGRAM_TYPES と完全一致）・非正典タイプの混入拒否」ロックイン検証を追加。検証: diagram-detector 32テスト + tsc green。本修正は潜伏的（現状で値は一致）のため振舞い RED は不可、正典への構造的結合ロックインで将来ドリフトを検出する（b5c6b71b/5bfeb709 と同パターン）*

### ノード寸法デフォルトの単一ソース化（Phase 124） ✅実装済

- REQ-291: ノード寸法デフォルト `DEFAULT_NODE_WIDTH`(120) / `DEFAULT_NODE_HEIGHT`(60) は `src/visualization/node-dimensions.ts` の単一ソース（`getNodeWidth/getNodeHeight` の fallback 既定値でもある）でなければならない。本ライン（main = 5ba95230）では15箇所がこの正典を再字面化していた：(a) 11のレイアウト戦略ファイル（conceptmap/tree/flowchart/timeline/flow/general/mindmap/network/comparison/cycle/matrix-strategy.ts）が `const DEFAULT_NODE_WIDTH = 120` / `const DEFAULT_NODE_HEIGHT = 60` をローカル再宣言して `getNodeWidth` 等と同じモジュールからの import と併存、(b) 4ファイル（layout-auto-optimizer.ts・smart-label-sizer.ts・layout/strategies/SimulatedAnnealingStrategy.ts・export/multi-format-exporter.ts）が `getNodeWidth(node, 120)` / `getNodeHeight(node, 60)` のように正典既定値をインライン fallback として渡していた。いずれも正典値と一致するため振舞いは同一だが、正典を 120→140 に変更してもこれら15箇所は 120 に留まり暗黙のドリフトとなる（「hardcoded-constant desync」クラス・DIAGRAM_TYPES 5ba95230 / HEALTH_CHECK b5c6b71b と同系）。注: 5bfeb709 は別 instruction worktree（…101129-466503）で同系修正＋構造ガードを行ったが main 到達前に途絶しており、本コミットが main への再適用＋戦略11ファイル群（5bfeb709 未処理）の拡張となる。修正は (a) 戦略群のローカル const を削除し正典から import、(b) インライン fallback 引数を削除し正典既定値に委譲（意図的に異なる `getNodeWidth(n,0/1)` は点/幾何用途として保持）。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: 11戦略の import に DEFAULT_NODE_WIDTH/HEIGHT を追加しローカル const を削除・4ファイルの getNodeWidth/Height(_,120/60) → 既定値委譲・src/visualization/__tests__/node-dimension-default-coupling.test.ts に「正典値固定(120/60)・既定パラメータが正典を参照・全本番ファイルが 120/60 インライン fallback または const 再宣言を含まない」構造的ソース結合ガードを追加（正典 node-dimensions.ts のみ例外）。検証: ガード正規表現は旧パターンを捕捉し合法パターン(0/1 fallback・per-type sizing・import名利用)を拒否することを確認・可視化41スイート/730テスト + tsc green。潜伏的のため振舞い RED は不可、構造的結合ロックインで将来ドリフトを検出*

### リカバリテレメトリの stageDegraded/cascade イベント伝搬（Phase 125） ✅実装済

- REQ-292: エラー復旧テレメトリ集約器（src/quality/recovery-telemetry-aggregator.ts）は `stage:degraded` / `cascade:detected` イベントを bounded FIFO（各100/50件）で蓄積するが、`getSnapshot()` はこれらを一切表面化してはならない（現状は破棄）。兄弟の `activeAlerts` は `degradationAlerts: [...this.activeAlerts]` で TelemetrySnapshot に伝搬しており、`reset()` も4配列すべて（records / stageDegradedEvents / cascadeEvents / activeAlerts）を一括クリアするため蓄積意図は明白である。それにもかかわらず stageDegradedEvents / cascadeEvents は push/cap/reset のみで読込ゼロであり、LIVE 消費者である監視API（src/api/routes/monitoring.ts:215 が `getSnapshot()` を呼び `res.json({ data: telemetry })` で返却）に届かない。これは「producer-computes-but-DROPS」クラス（hasCycles 8d8a245e / LayoutEvaluator compliance 307846c6 と同系）であり、ステージ劣化・カスケード伝播の診断データが収集されつつ一切観測不能な状態であった。修正は TelemetrySnapshot に `stageDegradedEvents: StageDegradedEvent[]` / `cascadeEvents: CascadeDetectedEvent[]` を追加し、getSnapshot が `[...this.stageDegradedEvents]` / `[...this.cascadeEvents]` で伝搬する（degradationAlerts と同一パターン・配列は既に上限付きで非有界成長なし）。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: TelemetrySnapshot に2フィールド追加・getSnapshot に伝搬追加・tests/quality/recovery-telemetry-aggregator.test.ts に空スナップショット検証（[]）とシングルトンバス経由のキャプチャ検証を追加。検証: RED→GREEN（旧 getSnapshot に戻すと新テストが cascadeEvents undefined で RED・復元で GREEN）・テレメトリ34テスト + tsc green・TelemetrySnapshot リテラル構築者なしで加算的後方互換*

### キャンバス寸法デフォルトの単一ソース化（Phase 126） ✅実装済

- REQ-293: 図解キャンバス寸法 `DEFAULT_CANVAS_WIDTH`(1920) / `DEFAULT_CANVAS_HEIGHT`(1080) が 13 の可視化モジュール（canvas-calculator, layout-engine-v2, 全11レイアウト戦略）でローカル `const` として個別再宣言されていた。全サイトが同一値だったため振る舞い RED→GREEN は不可能だが、正典との結合は偶然のみで共有バインディングなし — 1箇所変更しても残り12は同期せず暗黙ドリフトする latent-coincident の constant-desync シード（T2-D nodeWidth/Height 94b3e8e8 と同クラスのキャンバス版）。新設した正典 `src/visualization/canvas-dimensions.ts` のみがリテラルを保持し、全13ファイルをインポート化、構造的ソース結合ガードテスト（`__tests__/canvas-dimension-default-coupling.test.ts`）が再宣言を検出する。なお src/remotion/Video.tsx の `DEFAULT_WIDTH/HEIGHT`（動画出力解像度、同1920×1080）は別モジュール境界の別概念として意図的に分離。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: canvas-dimensions.ts 新設 + 13ファイル import 化 + ソース結合ガード。検証: RED→GREEN（13ファイル退避でガード1件失敗→復元で成功）・戦略系42スイート769テスト green・tsc green・振る舞い完全保存*

### サーバーエクスポートキュー設定の単一ソース化（Phase 127） ✅実装済

- REQ-294: 本番サーバー（src/api/server.ts:107）が `new ExportJobQueue({ maxConcurrent: 3, maxQueueSize: 100 }, ...)` とキュー同時実行数/キューサイズをベアリテラル `3`/`100` でハードコードしていた。これらは `EXPORT_QUEUE_LIMITS.MAX_CONCURRENT`/`MAX_QUEUE_SIZE`（@stv/core/config/limits）と偶然一致するが結合なし — 正典を変更しても本番ルートは古いリテラルに留まり、DEFAULT_OPTIONS 経由で正典に従う他全コンシューマとの暗黙ドリフトを生む latent-coincident の constant-desync シード（T2-B）。修正は EXPORT_QUEUE_LIMITS をインポートし同構成で参照。振る舞い RED→GREEN 不可能（同値）のためソース結合ガード（`__tests__/server-queue-config-coupling.test.ts`）がリテラル再インライン化と非インポートを検出する。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: server.ts インポート追加+正典参照化 + ガード。検証: RED→GREEN（server.ts 戻しで3テスト失敗→復元で成功）・export-job-queue+server 5スイート78テスト green・tsc green*

### simple-pipeline 対応音声形式の単一ソース化（Phase 128） ✅実装済

- REQ-295: `SimplePipeline.getCapabilities()`（src/pipeline/simple-pipeline.ts:774）が `supportedFormats: ['mp3','wav','ogg','m4a']` を正典 `SUPPORTED_AUDIO_FORMATS`（@stv/core/config/limits）と一致するが結合なしでハードコード重複していた。新形式追加で正典だけ更新しても simple-pipeline は古いセットを広告し続ける latent-coincident の constant-desync シード（兄弟 whisper-transcriber.ts:413 は正しく `[...SUPPORTED_AUDIO_FORMATS]` を使用）。修正は SUPPORTED_AUDIO_FORMATS をインポートしスプレッド。振る舞い RED→GREEN 不可能（同値）のためソース結合ガード（`__tests__/simple-pipeline-audio-formats-coupling.test.ts`）がリテラル再インライン化と非インポートを検出する。実装とテストを同一コミットに co-locate 🔵 ✅実装済 *本コミット: simple-pipeline.ts インポート+スプレッド化 + ガード。検証: RED→GREEN（戻しで2テスト失敗→復元で成功）・simple-pipeline 2スイート29テスト green・tsc green*

### パターン横展開（Phase 131+ 提案） 🟡未着手

> **NOTE**: 当初 AI Hub steering feedback A〜D のうち「D. timestamp guard mutation-verified CI ピン留め」は REQ-301 として提案していたが、REQ-301 は既に「動画レンダリング設定（解像度/FPS/コーデック）」のオプション要件（REQ-301 既存・🔵）で占有されているため、本Phaseでは REQ-298/299/300 の3件のみを具体化する。「D. timestamp guard」の実装は TC-314（REQ-300 として提案する async-setState positive-case fixture と並行）/ VideoPreview.formatTime の finiteness ガード等の既存 harden 経路で段階的に進める。

- REQ-298: 視覚化モジュールの DiagramType を受ける関数（switch/case または if/else if 連鎖）に対し、`isDiagramType` ガードまたは `DIAGRAM_TYPES` 正典配列への `case X:` カバレッジ検査を「全 DiagramType スイッチパリティ」として構造的テストで固定しなければならない。Phase 125（REQ-292）の flow/flowchart パリティ是正を他 DiagramType 種（'tree'/'timeline'/'matrix'/'cycle'/'mindmap'/'network'/'conceptmap'/'comparison'/'general'）の switch 文にも適用し、新 DiagramType 追加時の暗黙スキップを構造的に防止する 🟡 *AI Hub steering feedback A・diagram-type-switch-parity-guard.test.ts を 11 種全カバーに拡張・REQ-292 兄弟*

- REQ-299: `safe-storage.ts` および設定復元系モジュールにおいて、`JSON.parse` 経由の復元と `JSON.stringify` 経由の保存が非対称となっていないかを静的・動的に監査しなければならない。具体的には (1) 保存時は `isPositiveFiniteNumber` 等のガードを通るが復元時は素のまま `as number` キャストしている非対称、(2) 保存時はキー欠落を許容するが復元時は `undefined` 読み取りを許している非対称、を `storage-parser-asymmetry-guard.test.ts` として検出する。同一型保証のため Record<StorageKey, T> または Zod スキーマでの復元検証を推奨 🟡 *AI Hub steering feedback B・safe-storage.ts / production-config.ts / 復元系フック・REQ-293/295/296 兄弟*

- REQ-300: 非同期ハンドラ内で `useState` の setter を呼び出すコードに対し、stale-closure 防御の positive-case フィクスチャを追加しなければならない。Phase 130（REQ-297）の async-state-stale-closure-guard.test.ts は既知修正ピン中心の「negative guard」だが、本要件は「async ハンドラ内で post-await 呼び出しの setter が最新の state を読む」positive ケース（React の useEvent / functional updater / call-time ref mirror のいずれか）を fixture として固定し、回帰だけでなく「正しい書き方」の標準パターンをテストで残す 🟡 *AI Hub steering feedback C・async-state-stale-closure-guard.test.ts に positive フィクスチャ追加・REQ-297 兄弟*

#### 3レジストリ命名一貫性（Phase 132 提案） 🔵実装済

> **NOTE**: 本セクションは AI Hub `make run` フィードバック（`Continue building on this progress`）の実在性検証結果に基づき、`LOWER_IS_BETTER_*` 名前空間の3レジストリ横断一貫性を具体化する。レジストリ統合（consolidation）は禁止設計（REQ-296/298/299 兄弟エントリの OWN-type アンカー維持）を維持しつつ、命名のみ統一する。検証で実在を確認できた提案のみ採用し、PHANTOM 提案（`supabaseIntakeSanitize.test.ts` / `nonStringTruthy` shared fixtures / `corruptionHelpers.test.ts` 抽出）は `interview-record.md` A132 に分析記録として記載。

- REQ-302: `AutoImprovementEngine.LOWER_IS_BETTER`（src/framework/auto-improvement-engine.ts:147）を `AutoImprovementEngine.LOWER_IS_BETTER_METRICS` にリネームし、3つの極性レジストリ（`LOWER_IS_BETTER_METRICS` / `LOWER_IS_BETTER_QUALITY_METRICS` / `LOWER_IS_BETTER_METRICS`）の grep 一貫性を確保しなければならない。`AutoImprovementEngine.LOWER_IS_BETTER.has(...)` 呼び出し2箇所（:175 / :424）と partition テスト（tests/unit/framework/auto-improvement-polarity-registry.test.ts:58）も同時更新すること。レジストリ統合（consolidation）は行わず、各レジストリは OWN-type（`keyof QualityMetrics` 等）を維持する 🔵 ✅実装済 *AI Hub make-run feedback・commit <hash>・grep 'LOWER_IS_BETTER_METRICS' / 'LOWER_IS_BETTER_QUALITY_METRICS' 単一正規表現で3レジストリ全てがヒットすることを構造的保証・2 suites 54 tests green*

#### Number.isFinite 共通 sanitizer 集約（Phase 132 提案） 🟡提案

- REQ-303: prod コードに残存する value-clamp 系の `Number.isFinite(value)` インラインパターン（55ファイル: src/analysis/ ・src/api/ ・src/quality/ ・src/monitoring/ ・src/pipeline/ ・src/utils/ ・src/transcription/ ・src/visualization/ ・src/export/ ・src/framework/ ・src/remotion/ ・src/config/ ・src/lib/ ・src/components/ など）を `@stv/core/utils/guards` に既に存在する `sanitizeFinite(value, defaultValue)` （REQ-296 兄弟・NaN/±Infinity → defaultValue 単一責任ポイント）に段階的に集約する計画を立てなければならない。`Number.isFinite(x) && x > 0` のような条件分岐ガード（`Number.isFinite` を真理値として使う用法）は本要件の対象外とし、`(typeof value === 'number' && Number.isFinite(value)) ? value : defaultValue` 形の「値を変換する用法」のみを移行対象とする。新設ヘルパー（例: `toFiniteOr(value, fallback)`）が必要な場合は `@stv/core/utils/guards` に追加し、REQ-296 と同じ partition/closed-set テスト方針に従うこと 🟡 *AI Hub make-run feedback・grep -rn 'Number.isFinite' src/ = 55 files（test 除く）・既存 sanitizeFinite/clampFinite/clamp01/safeToLocaleString の対象拡大*

#### Phantom feedback 記録（Phase 132 提案） 🔴記録のみ

> **PHANTOM 記録**: 以下の make-run feedback 項目は実在ファイル/テストの検証で実体が確認できなかったため、実装要件としては不採用とする。`interview-record.md` A132 に詳細記録。  
> 1. `nonStringTruthy` テストケースの shared fixtures + `expect.string()` カスタムマッチャ昇格 — `find . -name '*nonStringTruthy*'` 0 hits  
> 2. `supabaseIntakeSanitize.test.ts` (245行) → `corruptionHelpers.test.ts` 抽出 + `expectCorruptionBlocked(input, expectedOutput)` アサーションラッパ — `find . -name 'supabaseIntakeSanitize*'` / `'*corruptionHelpers*'` 0 hits  
> `supabase/*` 配下の実在ファイルは auth-scaffold (`client.ts` / `auth.ts`) のみで、production-config.ts 同様に process.env ガードの受益はあるが、本 feedback が指す corruption event テストは実在せず、real lever = REQ-302/303 適用。

#### コア分割境界（@stv/core 依存）（Phase 137） ✅実装済

> **NOTE**: 本セクションは stv-core コア分割（PR #7・commits a88c878f~d6651084・2026-08-18 マージ）後の実態を要件化する。分割で src/types・src/config・src/lib ディレクトリと src/utils の大半がプロダクトリポジトリから消滅し、20モジュールパスが外部パッケージ `@stv/core` に移管された。移管マッピングと計数コマンドは interview-record A137 に記録。本要件群と既存REQの出典パス書き換え（17 dead citation 解消）を同一ラウンドで同期した。

- REQ-310: システムの共有型・ユーティリティ・設定モジュール（types/diagram・types/pipeline・utils/{logger,guards,sanitize,memory-usage,audio-validation,audio-duration,regex-escape,prometheus-label-escape,report-corruption}・config/{limits,production-config,schema,validate,code-size-audit}・lib/{metrics-utils,safe-array,capped-array,capped-map,unicode-script-ranges}）は外部パッケージ `@stv/core` から import しなければならない。プロダクトリポジトリ（src/）にこれらの重複実装を再設置してはならない 🔵 *package.json `"@stv/core": "github:nobu007/stv-core#v1.0.7"`・`grep -rl "from '@stv/core" src` = 317ファイル・import 先は20モジュールパス（interview-record A137 計数）・split commits a88c878f/5229846c/e2b81954/d6651084*
- REQ-311: `@stv/core` 依存は GitHub タグに pin されなければならない（現行 `github:nobu007/stv-core#v1.0.7`）。ブランチ ref や範囲のような浮動指定を使用してはならない。コアモジュールの変更は stv-core リポジトリ側でのバージョンタグ発行 → 本リポジトリの pin 更新の順で行うこと 🔵 *package.json:86・PR #7 statusCheckRollup 13/14 SUCCESS + deploy SKIPPED（2026-08-18 マージ・gh pr view 7 実測）*
- REQ-312: コア分割境界の回帰（プロダクトリポジトリへのコアモジュール再実装・正典の @stv/core import を逸脱したフォーク）は tests/guards 配下の cross-boundary guard テストが検出しなければならない。ガードは正典モジュールの import 元（`from '@stv/core/...'`）を structural pin する 🔵 *commit 5229846c（cross-boundary guard tests を tests/guards へ park）・tests/guards/clamp01-single-source.test.ts:35 が `from '@stv/core/utils/guards'` を pin する実例・tests/guards/ 配下72ガードテストファイル（2026-08-19 実測）*

#### エビデンス出典・並列CI・規模予算・収束駆動タスク生成（Phase 140） ✅実装済（REQ-326/327）

> **NOTE**: 本セクションは AI Hub `make run` feedback（前回 iteration「VALUABLE」判定に続く steering・2026-08-19）の実在性検証に基づく。feedback が固有名で指した `tests/helpers/foldGuardOracles.ts`・`no-inline-*-display.test.ts`×4・`ActionPlanPanel`・`fold-display-census` はいずれも本リポジトリに存在しない（cross-repo 汚染・grep 実測 0 hits — interview-record A138）。META-intent のみ本リポジトリの実体に映射して採用した: (1) 性能主張のエビデンス出典 → REQ-326 として新規実装、(2) registry からの data-driven テスト生成 → 既に達成済み（tests/guards/frozen-literal-registry.test.ts「次の family はテストファイルではなく registry entry 1件」ヘッダコメントが出典・記録のみ）、(3) 残り fold 数の明記と family 完結検知 → census 側は達成済み（tests/guards/fold-census-families.ts FOLD_SERIES_STATUS converged ratchet + census-pin マーカー）だが**タスク生成側の停止条件が無かった**ため REQ-327 で新設、(4) value-neutral fold を独立 phase にしない価値密度ルール → REQ-327 に統合。
>
> **REQ/TC 番号帯**: REQ-313~322 は acceptance-criteria の TC 帯（TC-313~321 実在・TC-322 は未 merge PR #9 の提案中）と番号が衝突しないよう予約（未使用のまま）。機能要件は REQ-323 から、TC は TC-323 から採番する。

- REQ-323: テストスイートは jest が実際に worker を spawn する設定（maxWorkers 75%・detectOpenHandles を常時設定しない）で実行され、CI の test job は 4 shard の matrix として並列実行されなければならない。各 shard は 600s の jest 予算を in-job で強制し、gate job が shard 失敗を集約する 🔵 ✅実装済 *commit b25ce823・jest.config.cjs:8-13（直列化の根本原因だった detectOpenHandles の除去コメント）・.github/workflows/ci.yml:120-153（matrix shard 1-4・THRESHOLD 強制）・REQ-254 予算体系*
- REQ-324: プロダクションコード（src/）とテストツリー（tsconfig.test.json scope = src+tests+supabase）は strict mode で型検査されなければならない 🔵 ✅実装済 *src 側: commit afcf099c（124 error → 0 で flag 反転）・tsconfig.app.json strict: true。test 側: 2026-08-19 TASK-0224 完了 — 3 override（strict / strictNullChecks / noImplicitAny 各 false）を削除し extends 元の strict を効かせた（tsconfig.test.json）。A138 baseline 188 は CLI shorthand `--strict` が config 内明示 `strictNullChecks: false` を打ち消せない混在モードのアーティファクトであり、反転後の真の開始状態は probe config 実測 **156 error**（188/156 両 [EVIDENCE] 出典・A140）。完了: 反転 config `tsc -p tsconfig.test.json --noEmit` exit=0・フルスイート 739 suites / 23,106 passed / 0 failed（ts-jest が strict で全テストをコンパイル・A140）。commit 688acbed の「650 → 0」は計測コマンドが記録されておらず再現しない（同 commit で 206 error・`--strict` 単体で 28 error・A138 実測 3 点）*
- REQ-325: 実装規模は code-size audit の予算ゲートが CI で強制されなければならない（`npm run audit:code-size --ci`・gate job が `needs.code-size-audit.outputs.budget_exceeded` を参照）。未参照実装ファイルの削除（12 ファイル・86,953 → 84,859 行）は本予算の primitive として扱う 🔵 ✅実装済 *.github/workflows/ci.yml:28-59・tests/regression/ci-timeout-guard.test.ts:190（budget_exceeded 参照の構造 pin）・commit 63160b66（削除後 live import 0 を grep 検証）*
- REQ-326: 要件書・interview-record・tasks overview に記載する数量・性能主張（実行時間・テスト件数・行数・CI 所要時間・エラー数等）には、実行出力に基づく出典を引用しなければならない。出典は (a) `npm run evidence -- [--label=x] <command>` が発行する `[EVIDENCE]` 行（開始/終了タイムスタンプ・exit・elapsed・コマンド全文・commit を含む）、(b) `gh run view` 等の CI 実測値、のいずれかとし、計測条件（対象ツリー・フラグ）が主張から再現可能であること。commit message 内の計測報告のみを出典として要件書に数値を転記してはならない。正典ツールは scripts/collect-evidence.ts（`[EVIDENCE]` 行の形状は TC-323 で pin・spawn 失敗は exit=127 で黙示成功しない） 🔵 ✅実装済 *AI Hub steering・tests/scripts/collect-evidence.test.ts（14 tests・mutation RED 2 種検証済）・package.json scripts.evidence・TC-323*
- REQ-327: single-source / fold family を対象とする phase の新規生成は、census（tests/guards/fold-census-families.ts の FOLD_SERIES_STATUS・specs/guard-harness-fold-census/requirements.md の census-pin マーカー）の残り計測に出典しなければならない。value-neutral 候補が 0（converged=true）の family に対して per-fold phase を新規生成してはならない（当該 series は CLOSED と overview に明示済み）。値が偶然一致しているだけの coincidence twin（value-neutral fold）を独立 phase にしてはならず、値が発散している兄弟 fold と同一 phase に含めることで phase 当たりの価値密度を保つ。僅少価値の per-phase 作業を連続生成せず、発散 family・未到達 backlog へ移行すること 🔵 ✅実装済（運用ルールとして overview Phase 140 に明記） *AI Hub steering・fold-census-families.ts:1-40・guard-harness-fold-census/requirements.md:203-207（census 表 C1~C5）・tasks/overview.md Phase 140*

#### non-null assertion 撲滅・storage parity・mutation witness 台帳（Phase 141） ✅実装済（REQ-328~330）

> **NOTE**: 本セクションは AI Hub steering（Phase 140 VALUABLE 判定への follow-up・2026-08-19/20）の実在性検証に基づく。固有名は再び cross-repo 汚染だった: `fold-display-census` REMAINING-WORK pin（3 rows / 6 sites: MACHINE_ISO_TIMESTAMP ×2・CURRENT_YEAR_RENDER ×1・SIGN_TERNARY_GENERIC ×3）は grep 0 hits（divergence-first 選別ルール自体は Phase 140 REQ-327 として既存・重複不要）、`STORAGE_KEYS`・起点 commit `b86ddeb6` も本リポジトリに存在しない（contamination 6 件目 — interview-record A141）。採用した META-intent 3 件: `!` の census と visualization 置換（REQ-328）・storage reader/writer パリティの機械検証（REQ-329）・mutation witness の盤査可能性（REQ-330）。

- REQ-328: src/visualization のプロダクションコード（`__tests__` 除く）は postfix non-null assertion（`!`）を含んではならない。src 本体（`__tests__`/`__mocks__` 除外）と tests ツリー（`__mocks__` 除外）の `!` 総数は tests/guards/non-null-assertion-census.test.ts の ratchet（93 / 960・2026-08-19 実測開始値）を超えてはならない。新規コードで optional 値に安全が必要な場合は narrowing・typed helper・fail-loud accessor で型検査を実検証として機能させること 🔵 ✅実装済 *src/visualization 67→0（20 ファイル・TASK-0226 の 7 パターン置換）・census guard 4 tests（mutant RED 検証済み・MW-005）・置換後 tests/(visualization|guards) 128 suites/4319 tests + src/visualization/__tests__ 34 suites/658 tests GREEN・tsc tsconfig.app.json exit=0*
- REQ-329: localStorage 系の key リテラルは reader/writer パリティを常時保証しなければならない — 読み込む key は必ずどこかで書き込まれ、書き込む key は必ずどこかで読み込まれる。パリティと key セット（現行 `first-visit`・`tutorial-progress`）は tests/guards/storage-key-parity.test.ts が検証し、非 literal（動的）storage access は corruption event 由来の CorruptionOverlay に限定する。2026-08-19 sweep の実測では LIVE-dead な read は 0 件（永続化 surface は @stv/core/utils/safe-storage のみ） 🔵 ✅実装済 *storage-key-parity.test.ts 4 tests（mutant RED 検証済み・MW-006）・TutorialSystem.tsx:47/54/66/228・CorruptionOverlay.tsx extractStorageKey*
- REQ-330: 要件書・interview-record に「mutation-verified」主張を記載する場合は、specs/speech-to-visuals/mutation-witness-ledger.md に MW エントリ（claim・target・mutation・command・observed=red 数と RED テスト名・[EVIDENCE] 行）を付さなければならない。台帳は tests/guards/mutation-witness-ledger.test.ts が監査し（target ファイル実在・必須フィールド・エントリ数 ratchet ≥6・引用 TC id の含有）、specs 本文と台帳が矛盾した場合は再実行結果を正とする 🔵 ✅実装済 *mutation-witness-ledger.md（MW-001〜006）・ledger guard 14 tests・過去主張 3 件（TC-205-04/TC-214-02/TC-304-04）を 2026-08-19 に再実行で確認（各 [EVIDENCE] 行付き・A141）*

#### non-null assertion 撲滅・pipeline 編（Phase 142） ✅実装済（REQ-331）

> **NOTE**: 本セクションは REQ-328（Phase 141・src/visualization 67→0 + 全ツリー census ratchet）の直接継続。steering bullet 1「src と主要テストパスの残 `!` を census し（TASK-0226 以降に ratchet TASK を追加）」の『TASK-0226 以降』として、残 src 最大バケット src/pipeline（29 件・オーケストレーション核心）を次の対象に選んだ（残分布 2026-08-20 実測: pipeline 29・transcription 17・export 10・他 38）。

- REQ-331: src/pipeline のプロダクションコード（`__tests__` 除く）は postfix non-null assertion（`!`）を含んではならない。src 本体（`__tests__`/`__mocks__` 除外）の `!` 総数 ratchet は Phase 142 実測の **64** に縮小される（93 − 29）。置換は挙動保存でなければならず、パターンは (a) 単一代入 `let` の const capture（pipeline-orchestrator stage4 `preparedScenes` — closure 内 narrowing 失効の回避）、(b) fail-loud accessor（framework-integrated-pipeline `requireIterationManager()` — seed 済みなので throw は到達不能）、(c) get-or-create Map 分岐（main-pipeline stageTimings）、(d) `Number()` による NaN 保存算術（video-generator `endTime! - startTime!` → `Number(endTime) - Number(startTime)`・`startTime! * 1000` → `Number(startTime) * 1000`・orchestrator `startTime! + …`）、(e) 検証器境界の正規化（video-generator `id: scene.id ?? ''` は falsy のまま validateRemotionData の `!scene.id` で同一 ERROR・`from/to/label` の `?? ''`/`|| ''` は label と対称）、(f) guard 前置き narrowing（quality-estimators `!scenes || scenes.length === 0` ≡ `(scenes?.length ?? 0) === 0`・simple-pipeline `success === true`）。census guard は src/pipeline exact-0 pin を追加し、mutation 検証は MW-007 として台帳化すること 🔵 ✅実装済 *src/pipeline 29→0（9 ファイル）・census guard 5 tests（pipeline exact pin 追加・MW-007 mutant RED: pipeline pin + src ratchet 64→65 の 2 failed→revert で 5 passed）・置換後 baseline 38 suites/657 tests → post-edit pipeline+guards+acceptance 201 suites/5479 tests GREEN・tsc tsconfig.app.json exit=0・src 残 64*

#### non-null assertion 撲滅・transcription 編（Phase 143） ✅実装済（REQ-332）

> **NOTE**: 本セクションは REQ-331（Phase 142・src/pipeline 29→0）の直接継続。Phase 142 引継ぎの残 src `!` 分布（2026-08-20 実測: transcription 17・export 10・monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 64）の次点バケット **src/transcription 17 件**（streaming-transcriber 14 行・whisper-transcriber 3 行）を対象に選択。音声認識は README が明記するとおり本システムの入力境界（実装現状は固定文生成）であり、境界モジュールから `!` を排除することで strict mode の実検証範囲を拡大する。

- REQ-332: src/transcription のプロダクションコード（`__tests__` 除く）は postfix non-null assertion（`!`）を含んではならない。src 本体（`__tests__`/`__mocks__` 除外）の `!` 総数 ratchet は Phase 143 実測の **47** に縮小される（64 − 17）。置換は挙動保存でなければならず、パターンは (a) `sanitizeFinite` 委譲（`Number.isFinite(v!) ? v! : k` ≡ `sanitizeFinite(v, k)` — 正典実装は `typeof value === 'number' && Number.isFinite(value) ? value : defaultValue` で値選択述語が完全一致・chunk 品質監視平均・merge 平均・calculateAverageConfidence・whisper validateAndEnhanceSegments/logTranscriptionMetrics の 5 サイト）、(b) `?? Number.NaN` しきい値比較（confidence フィルタ `confidence! >= min` は undefined で `undefined >= x` = false = 除外・NaN も除外・Infinity は受理を全て保存。**0 fallback は非等価** — `minConfidence: 0` は合法値 accept-all であり undefined confidence が 0 >= 0 で受理され挙動が変わる）、(c) const capture（live 配信 segment.confidence は直前計算値をローカル const に捕捉し literal と比較の両方に使用 — optional property 読み戻しの narrowing 喪失の構造解消）、(d) ctor 同型 `!== undefined` guard（updateConfig の旧 `candidate.x!` 検証は `undefined <= 0` = false で明示的 undefined が全検査を pass-through する挙動を保存しつつ constructor 自身の検証形に統一・cross-field 検査は両方 defined の場合のみ比較）、(e) dead assertion 除去（whisper `id: segment.id! ?? index` — `!` の直後の `??` が undefined を処理するため assertion は無意味）。census guard は src/transcription exact-0 pin を追加し、mutation 検証は MW-008 として台帳化すること 🔵 ✅実装済 *src/transcription 17→0（2 ファイル）・census guard 6 tests（transcription exact pin 追加・MW-008 mutant RED: transcription pin + src ratchet 47→48 の 2 failed→revert で 6 passed）・置換前後 transcription|streaming 25 suites/603 tests 同一 GREEN・tsc tsconfig.app.json exit=0・src 残 47*

#### non-null assertion 撲滅・export 編（Phase 144） ✅実装済（REQ-333）

> **NOTE**: 本セクションは REQ-332（Phase 143・src/transcription 17→0）の直接継続。Phase 143 引継ぎの残 src `!` 分布（2026-08-20 実測: export 10・monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 47）の最大バケット **src/export 10 件**（multi-format-exporter 6 行・security-metrics-collector 1 行・production-exporter 1 行・export-job-queue 1 行・enhanced-export-engine 1 行）を対象に選択。エクスポートは XSS 検証・成果物命名・job 生命周期という外部境界を持つモジュールであり、境界から `!` を排除することで strict mode の実検証範囲を拡大する。

- REQ-333: src/export のプロダクションコード（`__tests__` 除く）は postfix non-null assertion（`!`）を含んではならない。src 本体（`__tests__`/`__mocks__` 除外）の `!` 総数 ratchet は Phase 144 実測の **37** に縮小される（47 − 10）。置換は挙動保存でなければならず、パターンは (a) fail-loud accessor `requireSceneId`（filename 4 サイト + SVG `<title>` の 5 サイト — `SceneGraph.id` は wire 型では optional だが正典 producer `buildSceneGraph` は常に `scene-${index}` を書く。id 無し scene は旧コードでは `sanitizeFilename`/`escapeXml` 内の `undefined.replace` TypeError として `export()` の catch から `{success:false}` 化していました — accessor は同一の caught-failure 契約を明示メッセージ付きで保存し `?? ''` fallback（`unnamed.svg` で成功する）は非等価として拒否）、(b) `!== undefined` guard（`ch.codePointAt(0)! > 0xff` — `for…of` は code point 単位で index 0 は常に in-range だが、guard 形は旧 `undefined > 0xff` = false pass-through を保存）、(c) provably-dead definite-assignment 除去（`byCompoundKey!:` — constructor が無条件代入するため strict property-initialization 解析が証明でき `!` は不要）、(d) `Number()` NaN 保存算術 2 サイト（production-exporter `endTime! - startTime!` → `Number(endTime) - Number(startTime)` — `undefined - x` ≡ `Number(undefined) - x` = NaN を safeMean が除外・export-job-queue `startedAt! - enqueuedAt` → `Number(startedAt) - enqueuedAt` — 0 の捏造なし）、(e) truth-telling pass-through 署名（enhanced-export-engine `writeOutputFile`/`getFileSize` の引数と戻り値を `string | undefined` に — REQ-228 の zero/negative timeout テストは `prepareExport` を丸ごと stub して `outputPath` 未設定のまま stage 5 に到達し、旧 `!` はその `undefined` を黙って通していた。fail-loud accessor をまず実装したが同テスト 2 件が RED となり **REFUTED**、fallback `?? ''` や経路再生成も値が変わるため非等価 — 署名が実際の耐性を語る形で解決）。あわせて source-anchor guard（tests/export/production-exporter-safe-aggregation-migration.test.ts）の site-780 肯定 pin を post-Phase-144 形に更新（旧 pin は委譲で陳腐化）。census guard は src/export exact-0 pin を追加し、mutation 検証は MW-009 として台帳化すること 🔵 ✅実装済 *src/export 10→0（5 ファイル）・census guard 7 tests（export exact pin 追加・MW-009 mutant RED: export pin + src ratchet 37→38 の 2 failed→revert で 7 passed）・置換前後 export pattern 73 suites/4144 tests 同一 GREEN（fail-loud accessor 試行は REQ-228 2 件 RED で REFUTED・pass-through 署名で同一 GREEN 回復）・tsc tsconfig.app.json exit=0・src 残 37*

#### non-null assertion 撲滅・monitoring 編（Phase 145） ✅実装済（REQ-334）

> **NOTE**: 本セクションは REQ-333（Phase 144・src/export 10→0）の直接継続。Phase 144 引継ぎの残 src `!` 分布（2026-08-20 実測: monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 37）の最大バケット **src/monitoring 7 件**（health-check-service 2 行・performance-dashboard 2 行・real-time-performance-monitor 1 行・production-error-handler 1 行・http-metrics-collector 1 行）を対象に選択。監視モジュールは rss/external といった optional なランタイムメトリックと register/listener マップという内部境界を持つモジュールであり、そこから `!` を排除することで strict mode の実検証範囲を拡大する。

- REQ-334: src/monitoring のプロダクションコード（`__tests__` 除く）は postfix non-null assertion（`!`）を含んではならない。src 本体（`__tests__`/`__mocks__` 除外）の `!` 総数 ratchet は Phase 145 実測の **30** に縮小される（37 − 7）。置換は挙動保存でなければならず、パターンは (a) `?? Number.NaN` で NaN 保存 4 サイト（health-check-service `memoryUsage.rss!`/`external!` と performance-dashboard `external!`/`rss!` — `MemoryMetrics` は rss/external が optional で browser 経路の `getMemoryUsage` は両フィールドを省略する。旧 `!` は `undefined` を `bytesToMb` へ直送し `undefined / (1024 * 1024)` は既に NaN — `?? Number.NaN` は同一 outcome を型で語る形に正典化。dashboard の sum/avg 集計は NaN 吸収で旧来同一。**`?? 0` は「0 MiB の健康に見える偽計測」を捏造するため非等価**）、(b) captured get-or-create 2 サイト（real-time-performance-monitor `has()/set()/get()!` 三段と production-error-handler `onError` の同三段 — 不在分岐が格納する配列と同一 instance を get() から捕捉して返すため事後 presence assertion が不要・onError の unsubscribe 側は既に `get()`−falsy guard の安全形で対称化）、(c) provably-dead definite-assignment 除去（`routes!:` — constructor が `new CappedMap(...)` を無条件代入するため strictPropertyInitialization 解析が証明・Phase 144 `byCompoundKey` と同型）。あわせて source-anchor guard（tests/guards/bytes-to-mb-canon.test.ts）の rss 肯定 pin を旧 `rss!?` 許容形から `?? Number.NaN` 要求形に更新（source 変更と同コミット・site-780 と同一運用）。census guard は src/monitoring exact-0 pin を追加し、mutation 検証は MW-010 として台帳化すること 🔵 ✅実装済 *src/monitoring 7→0（5 ファイル）・census guard 8 tests（monitoring exact pin 追加・MW-010 mutant RED: monitoring pin + src ratchet 30→31 の 2 failed→revert で 8 passed）・monitoring+guards 45 suites/1068 tests GREEN・tsc tsconfig.app.json exit=0・src 残 30*





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
| Phase 76: バッチ処理プログレス正確性・テストスイート検証 | ✅完了 | REQ-196~197 + TASK-0188~0192 | 6/6（バッチprogress.total修正・リトライ配線統合テスト・エラー型伝播E2E・バッチリカバリ並列テスト・ESMモック修正・Phase完了報告） |
| Phase 77: エラーリカバリ可観測性・Phase 76品質修正 | ✅完了 | REQ-198~199 + バグ修正 | 4/4（RecoveryTelemetryAggregator実装・error-recovery API endpoint・Phase 76 TypeScriptバグ修正2件・lint修正2件） |
| Phase 78-79: プロダクション観測性強化 | ✅完了 | REQ-200, REQ-204 | 2/2（相関IDミドルウェア実装・console→logger移行・構造化HTTPリクエスト/レスポンスロギング・テスト178行追加） |
| Phase 80: HTTPリクエストメトリクス収集 | ✅完了 | REQ-205 | 1/1（HttpMetricsCollector・per-route P50/P95/P99・bounded memory・slow request detection・14テスト追加） |
| Phase 81: Prometheus互換メトリクスエクスポート | ✅完了 | REQ-206 | 1/1（PrometheusExporter・text/plain v0.0.4・6メトリクス出力・ラベルサニタイズ・13テスト追加） |
| Phase 82: ヘルスチェックliveness/readiness probe | ✅完了 | REQ-207 | 1/1（HealthCheckService配線・/health/live・/health/ready・8テスト追加） |
| Phase 83: 監視ダッシュボード・アラート | ✅完了 | REQ-208, REQ-209 | 2/2（GrafanaダッシュボードJSON model・Prometheus alert rules YAML・51テスト） |
| Phase 84: 監視APIデプロイメント統合 | ✅完了 | REQ-210, REQ-211 | 2/2（GET /monitoring/dashboard・GET /monitoring/alerts・6テスト追加） |
| Phase 85: パイプラインオブザーバビリティ拡張 | ✅完了 | REQ-212, REQ-213 | 2/2（pipeline_stage_duration_ms完了・batch_jobs_total Prometheus統合完了・PipelineMetricsCollector 14テスト） |
| Phase 86: 監視スタック統合検証 | ✅完了 | REQ-214, REQ-215 | 2/2（Prometheus E2E統合テスト・アラート閾値境界テスト） |
| Phase 87: 監視エンドポイントクエリ検証 | ✅完了 | REQ-216 | 1/1（Zod DashboardQuerySchema・AlertsQuerySchema・TrendsQuerySchema・107テスト追加） |
| Phase 88: LLM応図解構造検証 | ✅完了 | REQ-217 | 1/1（ノードID重複排除・自己ループフィルタ・孤立エッジ検出・5テスト追加） |
| Phase 89: シーン駆動アニメーションエクスポート | ✅完了 | REQ-218, REQ-219 | 2/2（Animated SVG CSS キーフレーム・Lottie 5.7.4 JSON・視覚形状コンテンツ・animated-scene-renderer モジュール抽出・36テスト・28テスト） |
| Phase 90: エクスポートパイプライン統合テスト | ✅完了 | REQ-220 | 1/1（E2E統合テスト・renderer↔engine結合テスト・SVG↔Lottie横断一貫性・38テスト） |
| Phase 91: シーンレンダラー入力検証 | ✅完了 | REQ-221 | 1/1（validateFrameInfo・clampSceneDuration・SceneRendererValidationError・29テスト追加） |
| Phase 92: エラーリカバリREST API堅牢化 | ✅完了 | REQ-222 | 1/1（RegisterBodySchema・errorId形式検証・XSSサニタイズ・レジストリLRU退去・ERROR_REGISTRY_LIMITS・94テスト追加） |
| Phase 93: エクスポート検証拡張 | ✅完了 | REQ-223 | 1/1（APNG acTL/fcTLチャンク検証・Lottie JSON構造検証・renderer→verifier round-trip統合テスト・31テスト追加） |
| Phase 94: エクスポートレート制限・レンダー検証強化 | ✅完了 | REQ-224 | 1/1（exportRateLimiter 10req/15min・codec列挙型検証・resolution正規表現検証・RATE_LIMITS.EXPORT・2テスト追加） |
| Phase 95: エクスポートエンジン検証統合 | ✅完了 | REQ-225 | 1/1（EnhancedExportEngine finalizeExport検証統合・mapExportFormatToVerificationFormat・全8形式検証結果付与・10テスト追加） |
| Phase 96: エクスポートメトリクス収集 | ✅完了 | REQ-226 | 1/1（ExportMetricsCollector・Prometheus 4メトリック統合・EnhancedExportEngine stage/per-export instrumentation・17テスト追加） |
| Phase 97: エクスポートリトライとフェイルセーフ | ✅完了 | REQ-227 | 1/1（encodeVideoWithRetry指数バックオフ・isTransientExportError分類・OOM/timeout/worker crash一時エラー検出・EXPORT_RETRY_LIMITS集中管理・15テスト追加） |
| Phase 98: エクスポートジョブライフサイクル管理 | ✅完了 | REQ-228 | 1/1（cancelExport+AbortController・runStageWithTimeout・EXPORT_STAGE_TIMEOUTS(preparing:30s/rendering:600s/encoding:300s/finalizing:60s)・タイマークリーンアップ・15テスト追加） |
| Phase 99: エクスポートジョブキューサービス | ✅完了 | REQ-229 | 1/1（ExportJobQueue・優先度スケジューリング・同時実行制御・キュー位置追跡・ETA推定・フェアスケジューリング・ExportMetricsCollector統合・32テスト・コミットa949644） |
| Phase 100: エクスポートアーティファクト管理 | ✅完了 | REQ-230 | 1/1（ExportArtifactStore・TTL自動クリーンアップ・LRU退去・ダウンロードURL生成・使用量追跡・ArtifactMetricsSink統合・26テスト） |
| Phase 101: エクスポートアーティファクトパイプライン統合 | ✅完了 | REQ-231~234 | 4/4（EnhancedExportEngine・ProductionExporter・ExportJobQueueのstore統合・ダウンロードAPI・コミット681c639） |
| Phase 102: エクスポートアーティファクトE2E検証 | ✅完了 | REQ-235~237 | 3/3（LRU退去E2E・TTL期限切れ統合テスト・ライフサイクルE2E・コミット5d76c31） |
| Phase 103: アーティファクト管理REST API | ✅完了 | REQ-238~240 | 3/3（list/filter/paginate・getMetadata/delete・usage統計・コミットa628416） |
| Phase 104: エクスポートバッチジョブREST API | ✅完了 | REQ-241~243 | 3/3（POST/GET/DELETE /jobs・ExportJobQueue.findJob()・server.ts統合・20テスト通過） |
| Phase 105: エクスポートジョブライフサイクル統合テスト | ✅完了 | REQ-241~243 | 3/3（create→status→complete HTTP統合テスト・artifact store連携検証・優先度順序HTTP検証・7テスト追加） |
| Phase 108: エクスポートセキュリティ hardening | ✅完了 | REQ-244~246 | 3/3（イベントハンドラ正規表現の名前付き定数配列化・プロパティベース変異ファジング回帰テスト・SecurityMetricsCollector防護拒否メトリクス・130テスト追加） |
| Phase 109: セキュリティファジング CI 拡張 | ✅完了 | REQ-247~249 | 3/3（マルチシードCI ファジングモード・全エクスポート経路ガードメトリクス回帰テスト・E2Eセキュリティパイプライン統合テスト・テスト追加） |
| Phase 110: CI品質ゲート・ガードファジング | ✅完了 | REQ-250~252 | 3/3（red-phase CI統合・guard-fuzz test追加540ケース・security-fuzzビルド依存） |
| Phase 111: CI・インテグレーション検証ハードening | 🔶要件定義 | REQ-253~257 | 0/5（エクスポートリトライ5+サイクル統合テスト・CI timeout-minutes + ELAPSED assertion・ESLint no-console回帰防止・EnhancedExportEngine リトライ設定DI・シーンデュレーション統合検証） |
| Phase 113: NaN/Type Safety コンソリデーション | ✅完了 | REQ-263~266 | 4/4（w/h直接アクセス完全排除・diagram-detector/scene-segmenterサニタイゼーションガード・32新規テスト） |
| Phase 114: ルールベースフォールバック品質改善・継続的学習安全性 | ✅完了 | REQ-267~269 | 3/3（ハードコードテンプレート→テキストベース抽出・continuous-learner destroy()・pearson NaNガード・20新規テスト） |
| Phase 115: テストスイート安定化・Lint完全修正 | ✅完了 | REQ-270~273 | 4/4（ESLint 234エラー→0解消・jest.mock ESM修正・validateAudioFile クラッシュ修正・CJKトークン化テスト追加・キリル文字混入修正） |
| Phase 116: Record<UnionType,T>完全性強制・Prometheus export・SecurityMetrics TTL | ✅完了 | REQ-274~279 | 6/6（Record<DiagramType, T> 完全性・Record<ErrorType, T> 完全性・ruleBasedDetection 11種完全対応・Prometheus export・SecurityMetrics TTL・バリデータ深度設定） |
| Phase 117: フレームワーク境界型安全性・Constant-desync 解消 | ✅完了 | REQ-280~284 | 5/5（recommendations quality 型投影・overallScore wiring 修正・HEALTH_CHECK single-source-of-truth・node-dimension default fallback 単一化・async-resource-cleanup ESM決定化） |
| Phase 118: 品質モニタ diagram-type パリティ | ✅完了 | REQ-285 | 1/1（assessContentRelevance validTypes ハードコード → isDiagramType 委譇・flowchart 等6正典タイプの不当スコアペナルティ解消・11タイプ完全パリティテスト） |
| Phase 119: 動画レンダリング fps 伝搬 | ✅完了 | REQ-286 | 1/1（VideoGenerator.options.fps → ActualVideoRenderer 境界での fps 破棄修正・composition.fps/durationInFrames 反映・frame↔duration 乖離解消・実装+テスト同一コミット co-locate） |
| Phase 120: 解析器循環検出 confidence 反映 | ✅完了 | REQ-287 | 1/1（gemini-analyzer hasCycles producer-computes-but-DROPS 修正・非-cycle 型のみ −0.1 ペナルティ・cycle 型は免除・stale trap テスト修正 + cycle 型免除テスト・実装+テスト同一コミット co-locate） |
| Phase 121: レイアウト評価 overlap 閾値のプロデューサ一致 | ✅完了 | REQ-288 | 1/1（LayoutEvaluator.detectAllOverlaps 既定バッファ nodeSeparation(50) → 0 実重なりに変更・OverlapResolver プロデューサ保証と一致・合法 gap 20-40px ペアの偽重なり検出解消・偽 Low confidence 警告解消・実装+テスト同一コミット co-locate） |
| Phase 122: レイアウト評価コンプライアンス結果の伝搬 | ✅完了 | REQ-289 | 1/1（LayoutEvaluator.evaluateLayoutWithCustomInstructions の producer-computes-but-DROPS 修正・void → LayoutComplianceResult 返却・layout-engine が !passed を warn ログで表面化・テストを toBeUndefined → 戻り値形状検証に修正・実装+テスト同一コミット co-locate） |
| Phase 123: 図解タイプ正典リストの単一ソース委譲 | ✅完了 | REQ-290 | 1/1（DIAGRAM_TYPES を export + readonly DiagramType[] 型化・diagram-detector detect() のリテラル+as DiagramType[] キャスト → 正典委譲・新タイプ追加時の無言スキップ(ドリフト)解消・正典パリティ ロックインテスト追加・実装+テスト同一コミット co-locate） |
| Phase 124: ノード寸法デフォルトの単一ソース化 | ✅完了 | REQ-291 | 1/1（11レイアウト戦略の DEFAULT_NODE_WIDTH/HEIGHT ローカル const 削除 → 正典 import 化・4ファイルの getNodeWidth/Height(_,120/60) インライン fallback → 既定値委譲・15箇所の正典再字面化解消・node-dimension-default-coupling 構造ガード追加・5bfeb709(main未到達)の再適用+戦略群拡張・実装+テスト同一コミット co-locate） |
| Phase 125: 視覚化 flow/flowchart スイッチパリティ | ✅完了 | REQ-292 | 1/1（legacy LayoutEngine → DagreLayoutStrategy + FallbackLayoutStrategy パスが 'flow' のみ扱い 'flowchart' を default（bare-config/grid/random）にフォールスルーしていた問題を 5 サイト（getGraphConfig / fallbackLayout / OverlapResolver ×2 / simple-diagram-detector.explainReasoning）で case 'flowchart': フォールスルーに修正・diagram-type-switch-parity-guard.test.ts 205行 = DiagramType-TYPED-PARAM 関数の switch-CASE パリティ検査・実装+テスト同一コミット co-locate） |
| Phase 126: config-restore 有限性 LAST tail | ✅完了 | REQ-293 | 1/1（export.qualityPresets[].{width,height,fps,quality} 配列内オブジェクトが未ガード → 09z "closed" は scalar-only で時期尚早だった点を修正・isPositiveFiniteNumber + Array.isArray + element shape check 拡張・ProductionDashboard.updateConfig 経由 exporter sceneDuration*fps + width*height 駆動系を保護・RED 21→GREEN 152/8 関連 suites 242/242/guards+safe-storage 41/41・実装+テスト同一コミット co-locate） |
| Phase 127: ExportJobQueue ETA オフバイワン | ✅完了 | REQ-294 | 1/1（getEstimatedWaitTime が自分のジョブのスロットを忘れて head pos0 busy で ETA 0 報告していた問題を position+1-availableSlots に修正・RED 3→GREEN 39 ユニット + 112 ETA/route・新規バグクラス queue/ETA ordering を記録・実装+テスト同一コミット co-locate） |
| Phase 128: config-restore 有限性 monitoring/export/memoryLimit SCALARS | ✅完了 | REQ-295 | 1/1（monitoring.metricsCollectionInterval / monitoring.alertThresholds.{errorRate,responseTime,memoryUsage,queueLength} / export.concurrentExports / performance.memoryLimit を isPositiveFiniteNumber でガード・RED 33→GREEN 130/179/179 no regression/tsc 0・実装+テスト同一コミット co-locate） |
| Phase 129: config-restore 有限性 performance SCALARS | ✅完了 | REQ-296 | 1/1（performance.{maxConcurrentJobs, timeoutMs, maxFileSize} を isPositiveFiniteNumber でガード・並行実行制御と I/O タイムアウトの根拠値を Infinity/負値から保護・RED 19→GREEN 96/139/139 persistence-path/tsc 0・これで safe-storage の全 scalar/array numeric chokepoint 完結・実装+テスト同一コミット co-locate） |
| Phase 130: stale-closure/async-setState クラス GUARDED-STRUCTURAL | ✅完了 | REQ-297 | 1/1（既知修正ピン + 広範囲 async-handler-body sweep → async-state-stale-closure-guard.test.ts・handler-BODY 粒度・JSX 除外・${...} 保持・0 live bugs・4/4+tsc 0・構文契約が薄いバグクラスは構造ガードで「コード形を制約」する方針を確定・実装+テスト同一コミット co-locate） |
| Phase 131+: パターン横展開（提案） | 🟡提案 | REQ-298~300 | 3/3（REQ-298 diagram-type-switch-parity を他 DiagramType 同値クラスへ展開・REQ-299 storageParser JSON.parse⇔JSON.stringify 非対称監査・REQ-300 async-setState positive-case fixture — AI Hub steering feedback A〜C。feedback D「timestamp guard」は REQ-301 codec option 占有のため別経路で段階実装、interview-record A129 参照） |
| Phase 132: 3レジストリ命名一貫性・sanitizer 集約提案 | 🔵+🟡 | REQ-302~303 | 2/2（REQ-302 LOWER_IS_BETTER_METRICS 命名統一 ✅実装済・2 suites 54 tests green・REQ-303 prod Number.isFinite 55ファイルを sanitizeFinite に段階集約 🟡提案。AI Hub make-run feedback の実在性検証結果より実在確認できた提案のみ採用、PHANTOM feedback は interview-record A132 に記録） |
| Phase 133: `??` 振る舞い pin | ✅完了 | TC-304-04 | 1/1（LLM リトライ maxRetries:0 の `??` 振る舞いを TC-304-04 で pin・commit 90666703・interview-record A133。※TC-304-04 は acceptance-criteria.md 側 REQ-304（LLM リトライ既定値）配下 — 本書の REQ-304（モバイルレスポンシブ）とは別物・番号帯の分裂は A137 残課題） |
| Phase 134: Prometheus status_class・prefix 修正 | ✅完了 | REQ-205/206 TC追加 | 2/2（buildRequestTotal の 2xx/5xx 折り込み誤分類を statusClassCounts + statusCodeClass 単一定義で解消・?prefix= のサンプル行無視を renderMetric 構造的適用で解消・TC-205-04/TC-206-04/05 mutation-verified・interview-record A134） |
| Phase 135: UUID_V4_RE single-source r12 | ✅完了 | REQ-306 | 1/1（API 層4サイトの凍結 regex を src/api/uuid-validation.ts 正典へ・registry entry round 12・tests/guards/uuid-validation-single-source.test.ts・interview-record A135） |
| Phase 136: DIAGRAM_TYPE_TITLES single-source r13 | ✅完了 | REQ-308 | 1/1（video-generator と DiagramScene の日本語タイトル map drift（flowchart/general 不一致）を正典 map で解消・registry entry round 13・stale clamp pin 再pin・interview-record A136） |
| Phase 137: コア分割後要件同期 | ✅完了 | REQ-310~312 | 3/3（stv-core 分割（PR #7）で @stv/core 移管後の要件出典同期・17 dead citation 解消・実装状況 stats 再実測・@stv/core 境界を REQ-310~312 として要件化・interview-record A137） |
| Phase 140: エビデンス出典・並列CI・規模予算・収束駆動タスク生成 | ✅実装済 | REQ-323~327 + TC-323 | 5/5（PR #8/#11/#12/#13 の実装済み変更を REQ-323~325 として出典付き要件化・REQ-326 エビデンス runner 実装+TC-323 pin・REQ-327 census 出典の phase 生成停止条件と価値密度ルール・REQ-313~322 は TC 帯として予約・688acbed「650→0」が再現しないことを 3 点の [EVIDENCE] 実測で記録・interview-record A138） |
| Phase 141: non-null assertion 撲滅・storage parity・mutation witness 台帳 | ✅実装済 | REQ-328~330 + TC-324~326 | 3/3（src/visualization の `!` 67→0・全ツリー census ratchet・storage key parity guard・mutation witness 台帳 MW-001〜006 と監査 guard・過去 mutation 主張 3 件を [EVIDENCE] 付き再実行・interview-record A141） |
| Phase 142: non-null assertion 撲滅・pipeline 編 | ✅実装済 | REQ-331 + TC-327 | 1/1（src/pipeline の `!` 29→0・挙動保存 6 パターン（const capture / fail-loud accessor / get-or-create / Number() NaN 保存 / 境界正規化 / guard 前置き narrowing）・census guard に pipeline exact-0 pin・src ratchet 93→64・MW-007 台帳化・interview-record A142） |
| Phase 143: non-null assertion 撲滅・transcription 編 | ✅実装済 | REQ-332 + TC-328 | 1/1（src/transcription の `!` 17→0・挙動保存 5 パターン（sanitizeFinite 委譲 / ?? NaN しきい値 / const capture / ctor 同型 !== undefined guard / dead assertion 除去）・census guard に transcription exact-0 pin・src ratchet 64→47・MW-008 台帳化・interview-record A143） |
| Phase 144: non-null assertion 撲滅・export 編 | ✅実装済 | REQ-333 + TC-329 | 1/1（src/export の `!` 10→0・挙動保存 5 パターン（requireSceneId fail-loud accessor / !== undefined guard / dead definite-assignment 除去 / Number() NaN 保存 ×2 / pass-through 署名 — fail-loud は REQ-228 mock 経路で REFUTED を記録）・census guard に export exact-0 pin・src ratchet 47→37・MW-009 台帳化・source-anchor guard pin 更新・interview-record A144） |
| Phase 145: non-null assertion 撲滅・monitoring 編 | ✅実装済 | REQ-334 + TC-330 | 1/1（src/monitoring の `!` 7→0・挙動保存 3 パターン（?? Number.NaN NaN 保存 ×4 / captured get-or-create ×2 / dead definite-assignment 除去）・census guard に monitoring exact-0 pin・src ratchet 37→30・MW-010 台帳化・bytes-to-mb-canon pin 更新・interview-record A145） |

## 信頼性レベル分布

- 🔵 青信号: 317件 (97.8%)
- 🟡 黄信号: 7件 (2.2%) — NFR-203, REQ-303, EDGE-103, REQ-298, REQ-299, REQ-300, REQ-303 [Phase 132 sanitizeFinite 集約提案]（REQ-324 は src・test 両側とも 🔵 達成済み・test 側は 2026-08-19 TASK-0224 で完了・A140 出典）
- 🔴 赤信号: 0件 (0%)

**品質評価**: ✅ 高品質 - 全要件が既存の設計文書・実測値・実装に基づいている。Phase 115要件追加・REQ-001~273（テストスイート安定化: ESLint 0エラー・jest.mock ESM修正・validateAudioFile クラッシュ修正・CJKトークン化テスト・キリル文字混入修正） / Phase 116 追加・REQ-274~279（Record<UnionType,T>完全性強制・Prometheus export・SecurityMetrics TTL）/ Phase 117 追加・REQ-280~284（フレームワーク境界型安全性・Constant-desync 解消・recommendations overallScore wiring・HEALTH_CHECK single-source-of-truth・node-dimension default・async-resource-cleanup ESM）/ Phase 118 追加・REQ-285（品質モニタ assessContentRelevance の diagram-type ハードコード → isDiagramType 委譇・実装+テスト同一コミット co-locate）/ Phase 119 追加・REQ-286（動画レンダリング VideoGenerator.options.fps → ActualVideoRenderer 境界での fps 破棄修正・composition.fps/durationInFrames 反映・実装+テスト同一コミット co-locate）/ Phase 120 追加・REQ-287（解析器 gemini-analyzer の hasCycles producer-computes-but-DROPS 修正・非-cycle 型のみ循環ペナルティ・cycle 型免除・stale trap テスト修正 + cycle 型免除テスト・実装+テスト同一コミット co-locate）/ Phase 121 追加・REQ-288（レイアウト評価 LayoutEvaluator.detectAllOverlaps の overlap 既定バッファを nodeSeparation(50) → 0 実重なりに変更し OverlapResolver プロデューサ保証と一致・合法 gap 20-40px の偽重なり検出解消・実装+テスト同一コミット co-locate）/ Phase 122 追加・REQ-289（レイアウト評価 LayoutEvaluator.evaluateLayoutWithCustomInstructions の producer-computes-but-DROPS 修正・void → LayoutComplianceResult 返却・layout-engine が !passed を warn ログで表面化・実装+テスト同一コミット co-locate）/ Phase 123 追加・REQ-290（図解タイプ正典リスト DIAGRAM_TYPES を export + readonly DiagramType[] 型化・diagram-detector detect() のリテラル+as DiagramType[] キャスト → 正典委譲・新タイプ追加時の無言スキップ解消・正典パリティ ロックインテスト・実装+テスト同一コミット co-locate） / Phase 124 追加・REQ-291（ノード寸法デフォルト単一ソース化・11戦略 import 化＋4ファイル インライン fallback 委譲・node-dimension-default-coupling 構造ガード・実装+テスト同一コミット co-locate）/ Phase 125 追加・REQ-292（legacy 視覚化 flow/flowchart スイッチパリティ CLOSED・diagram-type-switch-parity-guard 構造ガード・実装+テスト同一コミット co-locate）/ Phase 126 追加・REQ-293（config-restore 有限性 LAST tail CLOSED・export.qualityPresets[].{w,h,fps,q} 配列内オブジェクト・実装+テスト同一コミット co-locate）/ Phase 127 追加・REQ-294（ExportJobQueue ETA オフバイワン・position+1-availableSlots・新規 queue/ETA ordering バグクラス記録・実装+テスト同一コミット co-locate）/ Phase 128 追加・REQ-295（config-restore 有限性 monitoring/export/memoryLimit SCALARS・実装+テスト同一コミット co-locate）/ Phase 129 追加・REQ-296（config-restore 有限性 performance SCALARS・これで safe-storage 全 scalar/array numeric chokepoint 完結・実装+テスト同一コミット co-locate）/ Phase 130 追加・REQ-297（stale-closure/async-setState クラス GUARDED-STRUCTURAL・async-state-stale-closure-guard 構造ガード・構文契約が薄いバグクラスは構造ガードで「コード形を制約」する方針確定・実装+テスト同一コミット co-locate）/ Phase 131+ 追加・REQ-298~300 提案（diagram-type-switch-parity 他同値クラス展開 / storageParser JSON.parse⇔JSON.stringify 非対称監査 / async-setState positive-case fixture — AI Hub steering feedback A〜C。feedback D「timestamp guard」は REQ-301 codec option 占有のため別経路で段階実装、interview-record A129 参照）

## Acceptance criteria

- [x] AC-1: 全30カテゴリの機能要件（音声認識・内容分析・フォールバック・図解レイアウト・自動改善・品質保証・プロダクション監視・動画レンダリング・パイプラインUI・拡張モジュール・エラー分類・パイプラインオーケストレーション・バッチ処理・Edge Functions・WebSocket・最適化・グレースフルシャットダウン・型ガード・追加UI・高度エクスポート・Web Workers並列化・Worker統合テスト・セキュリティ・入力検証・堅牢性継続改善・高度図解品質エンハンスメント・図解品質パイプライン統合・パイプライン品質監視統合・ストリーミング品質・音声前処理・エクスポート検証・可視化アルゴリズム正式化・パイプライン品質統合）が REQ-001 ~ REQ-096 として文書化されている
- [x] AC-2: 全要件が一意の ID（REQ-xxx / NFR-xxx / EDGE-xxx）を持ち、EARS 記法（しなければならない / してもよい）で記述されている
- [x] AC-3: 全要件に信頼性レベル（🔵青信号 / 🟡黄信号 / 🔴赤信号）が付与されている
- [x] AC-4: 全要件がソース文書または実装ファイルに出典をトレースしている
- [x] AC-5: 非機能要件がパフォーマンス（NFR-001~004）・セキュリティ（101~103）・ユーザビリティ（201~203）・信頼性（301~304）・監視性（401~403）・コスト効率（501）の6属性をカバーしている
- [x] AC-6: Edgeケースがエラー処理（EDGE-001~005）と境界値（101~103）の両方をカバーしている
- [x] AC-7: EARS 分類に従い条件付き要件（REQ-101~104）・状態要件（201~203）・オプション要件（301~305）・制約要件（401~405）が文書化されている
- [x] AC-8: 実装進捗サマリーが Phase 1 ~ Phase 137 を網羅し、Phase 115（テストスイート安定化・Lint完全修正・REQ-270~273）, Phase 116（Record<UnionType,T>完全性強制・Prometheus export・SecurityMetrics TTL・REQ-274~279）, Phase 117（フレームワーク境界型安全性・Constant-desync 解消・REQ-280~284）, Phase 118（品質モニタ diagram-type パリティ・REQ-285）, Phase 119（動画レンダリング fps 伝搬・REQ-286）, Phase 120（解析器循環検出 confidence 反映・REQ-287）, Phase 121（レイアウト評価 overlap 閾値のプロデューサ一致・REQ-288）, Phase 122（レイアウト評価コンプライアンス結果の伝搬・REQ-289）, Phase 123（図解タイプ正典リストの単一ソース委譲・REQ-290）, Phase 124（ノード寸法デフォルトの単一ソース化・REQ-291）, Phase 125（視覚化 flow/flowchart スイッチパリティ・REQ-292）, Phase 126（config-restore 有限性 LAST tail・REQ-293）, Phase 127（ExportJobQueue ETA オフバイワン・REQ-294）, Phase 128（config-restore 有限性 monitoring/export/memoryLimit SCALARS・REQ-295）, Phase 129（config-restore 有限性 performance SCALARS・REQ-296）, Phase 130（stale-closure/async-setState クラス GUARDED-STRUCTURAL・REQ-297）, Phase 131+（パターン横展開提案・REQ-298~300）, Phase 132（3レジストリ命名一貫性 + Number.isFinite 共通 sanitizer 集約提案・REQ-302~303）, Phase 133~136（`??` pin TC-304-04・Prometheus status_class/prefix 修正・UUID_V4_RE r12・DIAGRAM_TYPE_TITLES r13 — 詳細は interview-record A133~A136）, Phase 137（コア分割境界要件化・REQ-310~312・出典パス同期）, Phase 140（エビデンス出典 runner・並列CI・規模予算・収束駆動タスク生成・REQ-323~327・REQ-313~322 TC 帯予約・Phase 141（non-null assertion 撲滅・storage parity・mutation witness 台帳・REQ-328~330）・Phase 142（non-null assertion 撲滅 pipeline 編・REQ-331）・Phase 143（non-null assertion 撲滅 transcription 編・REQ-332）・Phase 144（non-null assertion 撲滅 export 編・REQ-333）・Phase 145（non-null assertion 撲滅 monitoring 編・REQ-334）を反映
- [x] AC-9: 全要件が SYSTEM_CONSTITUTION.md の許可カテゴリ（コアパイプライン・パイプライン支援・API/通信・フロントエンドUI・監視/運用）に収まり、禁止カテキュリティに違反していない
- [x] AC-10: 信頼性レベル分布（🔵/🟡/🔴の件数と割合）が文書化され、品質評価が付与されている（Phase 115要件追加・REQ-001~273 / Phase 116・REQ-274~279 / Phase 117・REQ-280~284 / Phase 118・REQ-285 / Phase 119・REQ-286 / Phase 120・REQ-287 / Phase 121・REQ-288 / Phase 122・REQ-289 / Phase 123・REQ-290 / Phase 124・REQ-291 / Phase 125・REQ-292 / Phase 126・REQ-293 / Phase 127・REQ-294 / Phase 128・REQ-295 / Phase 129・REQ-296 / Phase 130・REQ-297 / Phase 131+・REQ-298~300 / Phase 132・REQ-302~303 / Phase 137・REQ-310~312 / Phase 140・REQ-323~327 / Phase 141・REQ-328~330 / Phase 142・REQ-331 / Phase 143・REQ-332 を追加・Phase 144・REQ-333 を追加・Phase 145・REQ-334 を追加・🔵318件/🟡7件/🔴0件）


<!-- spine:references:begin -->
## Spine: external references

- [TASK-0166: 残存モジュール型付きエラー移行（monitoring/config/integrations/framework/pages）](tasks/TASK-0166.md)
- [TASK-0167: 残存モジュール ErrorClassifier 回帰テスト](tasks/TASK-0167.md)
- [TASK-0168: performance-dashboard.ts ユニットテスト](tasks/TASK-0168.md)
- [TASK-0169: production-error-handler.ts ユニットテスト](tasks/TASK-0169.md)
- [TASK-0170: real-time-performance-monitor.ts ユニットテスト](tasks/TASK-0170.md)
- [TASK-0171: 文字起こしモジュール型付きエラー移行](tasks/TASK-0171.md)
- [TASK-0172: 文字起こしモジュール ErrorClassifier 回帰テスト](tasks/TASK-0172.md)
- [TASK-0173: browser-transcriber.ts ユニットテスト](tasks/TASK-0173.md)
- [TASK-0174: whisper-transcriber.ts ユニットテスト](tasks/TASK-0174.md)
- [TASK-0175: streaming-transcriber.ts ユニットテスト](tasks/TASK-0175.md)
- [TASK-0176: 可視化モジュール型付きエラー移行](tasks/TASK-0176.md)
- [TASK-0177: API モジュール型付きエラー移行](tasks/TASK-0177.md)
- [TASK-0178: 可視化モジュールテスト安定化](tasks/TASK-0178.md)
- [TASK-0179: パイプライン・E2Eテスト安定化](tasks/TASK-0179.md)
- [TASK-0180: API・セキュリティテスト安定化](tasks/TASK-0180.md)
- [TASK-0181: モニタリング・品質・UIテスト安定化](tasks/TASK-0181.md)
- [TASK-0182: トランスクリプション・LLM・ベンチマークテスト安定化](tasks/TASK-0182.md)
- [TASK-0183: テストファイルESLint no-explicit-any解消](tasks/TASK-0183.md)
- [TASK-0184: overview.md Phase 65-73完了ステータス更新](tasks/TASK-0184.md)
- [TASK-0185: Jest ESM 互換性修正（--experimental-vm-modules 追加）](tasks/TASK-0185.md)
- [TASK-0186: processWithRetry エラー型伝播バグ修正](tasks/TASK-0186.md)
- [TASK-0187: simple-pipeline テストアサーション修正](tasks/TASK-0187.md)

<!-- spine:references:end -->
