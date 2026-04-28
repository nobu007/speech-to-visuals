/**
 * speech-to-visuals 型定義
 *
 * 作成日: 2026-04-27
 * 最終更新: 2026-04-29
 * 関連設計: architecture.md
 *
 * 信頼性レベル:
 * - 🔵 青信号: 要件定義書・設計文書・既存実装を参考にした確実な型定義
 * - 🟡 黄信号: 要件定義書・設計文書・既存実装から妥当な推測による型定義
 * - 🔴 赤信号: 参照資料にない自動推定による型定義
 */

// ========================================
// 図解データモデル
// ========================================

/**
 * 図解タイプ
 * 🔵 信頼性: 要件定義REQ-007・src/types/diagram.ts より
 */
export type DiagramType = 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle';

/**
 * ノードデータ
 * 🔵 信頼性: src/types/diagram.ts NodeDatum・DBスキーマより
 */
export interface NodeDatum {
  id: string; // 🔵 DBスキーマより
  label: string; // 🔵 要件定義より
  meta?: {
    importance?: number; // 🔵 SYSTEM_CORE.md §4.3 より
    category?: string; // 🔵 Gemini 分析結果より
    icon?: string; // 🟡 UI表示用アイコン（実装から推測）
  };
  width?: number; // 🔵 レイアウトエンジンより
  height?: number; // 🔵 レイアウトエンジンより
}

/**
 * エッジデータ
 * 🔵 信頼性: src/types/diagram.ts EdgeDatum・要件定義より
 */
export interface EdgeDatum {
  from: string; // 🔵 要件定義より（ノードID参照）
  to: string; // 🔵 要件定義より（ノードID参照）
  label?: string; // 🔵 要件定義より（関係性ラベル）
  type?: string; // 🟡 エッジ種別（実装から推測）
}

/**
 * 図解レイアウト結果
 * 🔵 信頼性: src/visualization/・ZERO_OVERLAP_DESIGN.md より
 */
export interface DiagramLayout {
  nodes: PositionedNode[]; // 🔵 レイアウトエンジン出力より
  edges: EdgeDatum[]; // 🔵 入力エッジの引き継ぎ
  width: number; // 🔵 キャンバスサイズより
  height: number; // 🔵 キャンバスサイズより
  overlapCount: 0; // 🔵 NFR-302 ゼロオーバーラップ保証
}

/**
 * 位置付きノード
 * 🔵 信頼性: ZERO_OVERLAP_DESIGN.md・src/visualization/ より
 */
export interface PositionedNode extends NodeDatum {
  x: number; // 🔵 レイアウトエンジンより
  y: number; // 🔵 レイアウトエンジンより
}

/**
 * シーングラフ（1セグメントの図解データ）
 * 🔵 信頼性: src/types/diagram.ts SceneGraph・PIPELINE_FLOW.md Stage 2 より
 */
export interface SceneGraph {
  type: DiagramType; // 🔵 要件定義REQ-007より
  nodes: NodeDatum[]; // 🔵 要件定義REQ-006より（エンティティ）
  edges: EdgeDatum[]; // 🔵 要件定義REQ-006より（関係性）
  layout?: DiagramLayout; // 🔵 レイアウト結果
  startMs: number; // 🔵 SRTタイムスタンプより
  durationMs: number; // 🔵 セグメント長より
  summary: string; // 🔵 Gemini 分析結果より
  keyphrases: string[]; // 🔵 Gemini 分析結果より
}

// ========================================
// パイプライン型
// ========================================

/**
 * 処理ステータス
 * 🔵 信頼性: src/types/diagram.ts ProcessingStatus・要件定義NFR-202より
 */
export type ProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error';

/**
 * パイプラインオプション
 * 🔵 信頼性: PIPELINE_FLOW.md §8.2 PipelineOptions・src/pipeline/ より
 */
export interface PipelineOptions {
  transcription?: {
    model: 'base' | 'small' | 'medium'; // 🔵 PIPELINE_FLOW.md Stage 1 より
    language?: 'en' | 'ja' | 'auto'; // 🔵 要件定義REQ-003より
  };
  analysis?: {
    preferredModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro'; // 🔵 要件定義REQ-008より
    maxRetries?: number; // 🔵 要件定義REQ-010より（デフォルト3）
    timeout?: number; // 🔵 PIPELINE_FLOW.md §4.2 より
  };
  visualization?: {
    theme?: 'light' | 'dark'; // 🟡 UI テーマオプション（実装から推測）
    colorScheme?: string[]; // 🟡 カラーパレット（実装から推測）
  };
  rendering?: {
    fps?: 30 | 60; // 🔵 要件定義REQ-301より
    resolution?: '1080p' | '720p' | '4k'; // 🔵 要件定義REQ-301より
    codec?: 'h264' | 'h265' | 'vp9'; // 🔵 要件定義REQ-301より
  };
}

// ========================================
// LLM サービス型
// ========================================

/**
 * 複雑さ分析結果
 * 🔵 信頼性: src/analysis/complexity-detector.ts・PIPELINE_FLOW.md §5.3 より
 */
export interface ComplexityAnalysis {
  score: number; // 🔵 0-1の複雑さスコア
  recommendedModel: 'gemini-2.5-flash' | 'gemini-2.5-pro'; // 🔵 スコアに基づく推奨モデル
  factors: string[]; // 🔵 複雑さの要因リスト
}

/**
 * LLM リクエスト
 * 🔵 信頼性: SYSTEM_CORE.md §4.1・src/analysis/llm-service.ts より
 */
export interface LLMRequest<T> {
  prompt: string; // 🔵 LLMプロンプト
  context: string; // 🔵 分析コンテキスト
  options?: {
    temperature?: number; // 🔵 生成パラメータ
    maxOutputTokens?: number; // 🔵 出力制限
    forceModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro'; // 🔵 モデル強制指定
    timeout?: number; // 🔵 タイムアウト（ms）
    enableStreaming?: boolean; // 🔵 ストリーミングフラグ
  };
  parseResponse: (raw: string) => T; // 🔵 レスポンスパーサー
}

/**
 * LLM レスポンス
 * 🔵 信頼性: SYSTEM_CORE.md §4.1・src/analysis/llm-service.ts より
 */
export interface LLMResponse<T> {
  success: boolean; // 🔵 成功フラグ
  data?: T; // 🔵 パース済みデータ
  error?: string; // 🔵 エラーメッセージ
  metadata: {
    model: string; // 🔵 使用モデル名
    responseTime: number; // 🔵 レスポンス時間（ms）
    fromCache: boolean; // 🔵 キャッシュヒットフラグ
    complexity?: ComplexityAnalysis; // 🔵 複雑さ分析結果
    retryCount: number; // 🔵 リトライ回数
    fallbackUsed: boolean; // 🔵 フォールバック使用フラグ
  };
}

// ========================================
// キャッシュ型
// ========================================

/**
 * キャッシュエントリ
 * 🔵 信頼性: src/analysis/llm-cache.ts・PIPELINE_FLOW.md §5.1 より
 */
export interface CacheEntry<T> {
  key: string; // 🔵 キャッシュキー
  embedding: number[]; // 🔵 テキスト埋め込みベクトル
  result: T; // 🔵 キャッシュされた分析結果
  timestamp: number; // 🔵 作成タイムスタンプ
  ttl: number; // 🔵 TTL（ms、デフォルト120分）
}

/**
 * キャッシュ統計
 * 🔵 信頼性: QUALITY_METRICS.md §4.2・src/analysis/llm-cache.ts より
 */
export interface CacheStats {
  hitRate: number; // 🔵 キャッシュヒット率
  totalEntries: number; // 🔵 現在のエントリ数
  maxEntries: 200; // 🔵 最大エントリ数
  ttlMinutes: 120; // 🔵 TTL（分）
  similarityThreshold: 0.9; // 🔵 類似度閾値
}

// ========================================
// API 型
// ========================================

/**
 * バッチジョブ
 * 🔵 信頼性: src/api/batch-processing-api.ts・要件定義REQ-201より
 */
export interface BatchJob {
  id: string; // 🔵 ジョブID
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'; // 🔵 ジョブステータス
  files: BatchFile[]; // 🔵 処理対象ファイル
  progress: number; // 🔵 進捗率（0-100）
  eta?: number; // 🔵 推定残り時間（秒）
  qualityScore?: number; // 🔵 品質スコア
  createdAt: Date; // 🔵 作成日時
  updatedAt: Date; // 🔵 更新日時
}

/**
 * バッチファイル
 * 🔵 信頼性: src/api/batch-processing-api.ts より
 */
export interface BatchFile {
  filename: string; // 🔵 ファイル名
  status: ProcessingStatus; // 🔵 処理ステータス
  result?: SceneGraph[]; // 🔵 処理結果
  error?: string; // 🔵 エラーメッセージ
}

/**
 * API レスポンス共通型
 * 🔵 信頼性: src/types/api/index.ts・既存実装パターンより
 */
export interface ApiResponse<T> {
  success: boolean; // 🔵 成功フラグ
  data?: T; // 🔵 レスポンスデータ
  error?: ApiError; // 🔵 エラー情報
}

/**
 * API エラー
 * 🔵 信頼性: PIPELINE_FLOW.md §7.2・src/types/api/ より
 */
export interface ApiError {
  code: string; // 🔵 エラーコード
  message: string; // 🔵 エラーメッセージ
  details?: unknown; // 🔵 エラー詳細
}

// ========================================
// 品質監視型
// ========================================

/**
 * 品質メトリクス
 * 🔵 信頼性: QUALITY_METRICS.md・src/monitoring/ より
 */
export interface QualityMetrics {
  phase: number; // 🔵 フェーズ番号
  timestamp: string; // 🔵 測定日時
  overall: {
    successRate: number; // 🔵 成功率（%、目標≥95）
    processingTime: number; // 🔵 処理時間（秒、目標≤60）
    status: 'PASS' | 'FAIL' | 'WARNING'; // 🔵 総合ステータス
  };
  stages: {
    transcription: StageMetrics; // 🔵 Stage 1 メトリクス
    analysis: StageMetrics; // 🔵 Stage 2 メトリクス
    visualization: StageMetrics; // 🔵 Stage 3 メトリクス
    animation: StageMetrics; // 🔵 Stage 4 メトリクス
    rendering: StageMetrics; // 🔵 Stage 5 メトリクス
  };
  quality: {
    entityF1: number; // 🔵 エンティティF1（目標≥0.80）
    relationshipAccuracy: number; // 🔵 関係性精度（目標≥0.85）
    edgeCompleteness: number; // 🔵 エッジ完全性（目標≥0.80）
  };
}

/**
 * ステージメトリクス
 * 🔵 信頼性: QUALITY_METRICS.md §3 より
 */
export interface StageMetrics {
  success: boolean; // 🔵 成功フラグ
  duration: number; // 🔵 処理時間（ms）
  qualityScore: number; // 🔵 品質スコア
  errors: string[]; // 🔵 エラーリスト
}

// ========================================
// レイアウト戦略型
// ========================================

/**
 * レイアウト戦略インターフェース
 * 🔵 信頼性: ZERO_OVERLAP_DESIGN.md・src/visualization/strategies/ より
 */
export interface LayoutStrategy {
  name: string; // 🔵 戦略名
  apply(nodes: NodeDatum[], edges: EdgeDatum[]): LayoutResult; // 🔵 レイアウト適用
  canEscapeLocalMinimum: boolean; // 🔵 局所最適脱出可能フラグ
  estimateComplexity(nodes: NodeDatum[]): number; // 🔵 計算複雑度推定
}

/**
 * レイアウト結果
 * 🔵 信頼性: src/visualization/・ZERO_OVERLAP_DESIGN.md より
 */
export interface LayoutResult {
  nodes: PositionedNode[]; // 🔵 位置付きノード
  edges: EdgeDatum[]; // 🔵 エッジ
  overlapCount: number; // 🔵 オーバーラップ数（常に0）
  iterations: number; // 🔵 反復回数
  strategy: string; // 🔵 使用戦略名
}

// ========================================
// ワークスペース・コラボレーション型
// ========================================

/**
 * ワークスペース
 * 🔵 信頼性: src/types/workspace.ts より
 */
export interface Workspace {
  id: string; // 🔵 DBスキーマより
  name: string; // 🔵 ワークスペース名
  ownerId: string; // 🔵 所有者ID
  members: WorkspaceMember[]; // 🔵 メンバー一覧
  createdAt: Date; // 🔵 共通パターン
  updatedAt: Date; // 🔵 共通パターン
}

/**
 * ワークスペースメンバー
 * 🔵 信頼性: src/types/workspace.ts より
 */
export interface WorkspaceMember {
  userId: string; // 🔵 ユーザーID
  role: Role; // 🔵 ロール
  joinedAt: Date; // 🔵 参加日時
}

/**
 * ユーザーロール
 * 🔵 信頼性: src/types/workspace.ts Role より
 */
export type Role = 'owner' | 'admin' | 'editor' | 'viewer'; // 🔵 RBACより

/**
 * ワークスペースクォータ
 * 🔵 信頼性: src/types/workspace.ts WorkspaceQuota より
 */
export interface WorkspaceQuota {
  maxProjects: number; // 🔵 最大プロジェクト数
  maxStorageMb: number; // 🔵 最大ストレージ(MB)
  maxConcurrentJobs: number; // 🔵 最大並列ジョブ数
}

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 108件 (96%)
 * - 🟡 黄信号: 4件 (4%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質
 */

// ========================================
// パイプライン拡張型（Phase 3 追加）
// ========================================

/**
 * 品質プリセット
 * 🔵 信頼性: src/pipeline/adaptive-quality-presets.ts・PIPELINE_FLOW.md §8.2 より
 */
export type QualityPreset = 'fast' | 'balanced' | 'quality' | 'custom';

/**
 * プリセット設定
 * 🔵 信頼性: src/pipeline/adaptive-quality-presets.ts より
 */
export interface PresetConfiguration {
  name: QualityPreset; // 🔵 プリセット名
  description: string; // 🔵 プリセット説明
  targetProcessingTime: number; // 🔵 目標処理時間（秒）
  parameters: {
    transcriptionModel: 'tiny' | 'base' | 'small' | 'medium'; // 🔵 Whisperモデル選択
    videoResolution: '720p' | '1080p' | '4k'; // 🔵 出力解像度
    videoFps: 24 | 30 | 60; // 🔵 出力FPS
    layoutQuality: 'standard' | 'enhanced' | 'zero_overlap'; // 🔵 レイアウト品質
    enableLLMCache: boolean; // 🔵 キャッシュ有無
  };
}

/**
 * 動画生成オプション
 * 🔵 信頼性: src/pipeline/video-generator.ts・要件定義REQ-301 より
 */
export interface VideoGenerationOptions {
  outputFormat: 'mp4' | 'webm' | 'gif'; // 🔵 出力形式
  quality: 'low' | 'medium' | 'high' | 'ultra'; // 🔵 品質レベル
  resolution: '720p' | '1080p' | '4k'; // 🔵 解像度
  fps: 24 | 30 | 60; // 🔵 フレームレート
  includeAudio: boolean; // 🔵 音声トラック統合
  animationStyle: 'smooth' | 'instant' | 'bounce'; // 🔵 アニメーションスタイル
  concurrency?: number; // 🔵 CPU並列数
  enableMultithreadedRendering?: boolean; // 🔵 マルチスレッド
  enableGpuAcceleration?: boolean; // 🔵 GPU アクセラレーション
}

/**
 * 動画生成結果
 * 🔵 信頼性: src/pipeline/video-generator.ts より
 */
export interface VideoGenerationResult {
  success: boolean; // 🔵 成功フラグ
  videoUrl?: string; // 🔵 動画URL
  thumbnailUrl?: string; // 🔵 サムネイルURL
  duration?: number; // 🔵 動画長（秒）
  fileSize?: number; // 🔵 ファイルサイズ（バイト）
  resolution?: string; // 🔵 解像度
  processingTime?: number; // 🔵 処理時間（ms）
  error?: string; // 🔵 エラーメッセージ
}

/**
 * Remotionシーンデータ
 * 🔵 信頼性: src/pipeline/video-generator.ts より
 */
export interface RemotionSceneData {
  id: string; // 🔵 シーンID
  startMs: number; // 🔵 開始時間（ms）
  durationMs: number; // 🔵 継続時間（ms）
  diagramType: string; // 🔵 図解タイプ
  title: string; // 🔵 シーンタイトル
  nodes: Array<{
    id: string; // 🔵 ノードID
    label: string; // 🔵 ノードラベル
    x: number; // 🔵 X座標
    y: number; // 🔵 Y座標
    type: string; // 🔵 ノード種別
    color?: string; // 🔵 ノード色
  }>;
  edges: Array<{
    from: string; // 🔵 開始ノードID
    to: string; // 🔵 終了ノードID
  }>;
}
