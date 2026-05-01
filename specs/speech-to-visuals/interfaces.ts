/**
 * speech-to-visuals 型定義
 *
 * 作成日: 2026-04-27
 * 最終更新: 2026-05-01（第50回検証: Phase 11完了・267ファイル・84タスク完了・型定義変更なし）
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
export type DiagramType =
  | 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle'
  | 'flowchart' | 'comparison' | 'network' | 'conceptmap' | 'mindmap' | 'general';

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
// 高度レイアウト型（TypeScript strictness改善: 07c4196）
// ========================================

/**
 * 座標点
 * 🔵 信頼性: src/visualization/advanced-layouts.ts Point より
 */
export interface Point {
  x: number; // 🔵 X座標
  y: number; // 🔵 Y座標
}

/**
 * ノードアニメーション設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts NodeAnimation より
 */
export interface NodeAnimation {
  entrance: string; // 🔵 入場アニメーション種別
  duration: number; // 🔵 アニメーション時間（ms）
}

/**
 * レイアウト付きノード（NodeDatum拡張）
 * 🔵 信頼性: src/visualization/advanced-layouts.ts LayoutNode より
 */
export interface AdvancedLayoutNode extends NodeDatum {
  x: number; // 🔵 X座標
  y: number; // 🔵 Y座標
  width: number; // 🔵 ノード幅
  height: number; // 🔵 ノード高さ
  shape: 'circle' | 'rectangle' | 'diamond' | 'hexagon'; // 🔵 ノード形状
  borderRadius: number; // 🔵 角丸半径
  gradient: boolean; // 🔵 グラデーション有無
  shadow: boolean; // 🔵 シャドウ有無
  animation: NodeAnimation; // 🔵 アニメーション設定
}

/**
 * レイアウト付きエッジ（EdgeDatum拡張）
 * 🔵 信頼性: src/visualization/advanced-layouts.ts LayoutEdgeDatum より
 */
export interface AdvancedLayoutEdge extends EdgeDatum {
  style: 'solid' | 'dashed' | 'dotted' | 'gradient'; // 🔵 エッジスタイル
  animated: boolean; // 🔵 アニメーション有無
  thickness: number; // 🔵 太さ
  arrowHead: string; // 🔵 矢印種別
  points: Point[]; // 🔵 経路ポイント
}

/**
 * レイアウトキャンバス
 * 🔵 信頼性: src/visualization/advanced-layouts.ts LayoutCanvas より
 */
export interface AdvancedLayoutCanvas {
  width: number; // 🔵 キャンバス幅
  height: number; // 🔵 キャンバス高さ
}

/**
 * 高度レイアウト結果
 * 🔵 信頼性: src/visualization/advanced-layouts.ts AdvancedLayoutOutput より
 */
export interface AdvancedLayoutOutput {
  nodes: AdvancedLayoutNode[]; // 🔵 レイアウト済みノード
  edges: AdvancedLayoutEdge[]; // 🔵 レイアウト済みエッジ
  canvas: AdvancedLayoutCanvas; // 🔵 キャンバスサイズ
  theme: VisualTheme; // 🔵 ビジュアルテーマ
}

/**
 * アニメーション設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts Animations より
 */
export interface Animations {
  nodeEntrance: { duration: number; easing: string }; // 🔵 ノード入場アニメーション
  edgeDrawing: { duration: number; easing: string }; // 🔵 エッジ描画アニメーション
  textFadeIn: { duration: number; delay: number }; // 🔵 テキストフェードイン
}

/**
 * ビジュアルエフェクト設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts VisualEffects より
 */
export interface VisualEffects {
  nodeGlow: boolean; // 🔵 ノードグロー効果
  edgePulse: boolean; // 🔵 エッジパルス効果
  shadowDepth: number; // 🔵 シャドウ深度
  gradientNodes: boolean; // 🔵 グラデーションノード
}

/**
 * トランジション設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts Transitions より
 */
export interface Transitions {
  sceneTransition: string; // 🔵 シーン遷移タイプ
  nodeTransition: string; // 🔵 ノード遷移タイプ
  edgeTransition: string; // 🔵 エッジ遷移タイプ
}

/**
 * インタラクション設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts Interactions より
 */
export interface Interactions {
  nodeHover: boolean; // 🔵 ノードホバー有効
  clickHighlight: boolean; // 🔵 クリックハイライト有効
  zoomableCanvas: boolean; // 🔵 ズーム可能キャンバス
}

/**
 * 総合ビジュアル拡張設定
 * 🔵 信頼性: src/visualization/advanced-layouts.ts VisualEnhancements より
 */
export interface VisualEnhancements {
  theme: VisualTheme; // 🔵 ビジュアルテーマ
  animations: Animations; // 🔵 アニメーション設定
  effects: VisualEffects; // 🔵 エフェクト設定
  transitions: Transitions; // 🔵 トランジション設定
  interactions: Interactions; // 🔵 インタラクション設定
}

/**
 * ビジュアルテーマ
 * 🔵 信頼性: src/visualization/advanced-layouts.ts VisualTheme より
 */
export interface VisualTheme {
  primaryColor: string; // 🔵 プライマリカラー
  secondaryColor: string; // 🔵 セカンダリカラー
  backgroundColor: string; // 🔵 背景色
  textColor: string; // 🔵 テキスト色
  accentColor: string; // 🔵 アクセントカラー
}

// ========================================
// ワークスペース・コラボレーション型
// ========================================

/**
 * ワークスペース
 * 🔵 信頼性: src/types/workspace.ts Workspace より
 */
export interface Workspace {
  id: string; // 🔵 DBスキーマより
  name: string; // 🔵 ワークスペース名
  slug: string; // 🔵 URL用スラッグ
  description?: string; // 🔵 ワークスペース説明
  ownerId: string; // 🔵 所有者ID
  members: WorkspaceMember[]; // 🔵 メンバー一覧
  createdAt: Date; // 🔵 共通パターン
  updatedAt: Date; // 🔵 共通パターン
  settings: WorkspaceSettings; // 🔵 ワークスペース設定
  quota: WorkspaceQuota; // 🔵 リソースクォータ
}

/**
 * ワークスペース設定
 * 🔵 信頼性: src/types/workspace.ts WorkspaceSettings より
 */
export interface WorkspaceSettings {
  allowMemberInvites: boolean; // 🔵 メンバー招待許可
  defaultMemberRole: 'editor' | 'viewer'; // 🔵 デフォルトメンバーロール
  requireApprovalForInvites: boolean; // 🔵 招待承認要否
  maxMembers: number; // 🔵 最大メンバー数
  features: {
    realTimeCollaboration: boolean; // 🔵 リアルタイムコラボ機能
    advancedAnalytics: boolean; // 🔵 高度分析機能
    customBranding: boolean; // 🔵 カスタムブランディング
    apiAccess: boolean; // 🔵 APIアクセス機能
  };
}

/**
 * ワークスペースメンバー
 * 🔵 信頼性: src/types/workspace.ts WorkspaceMember より
 */
export interface WorkspaceMember {
  userId: string; // 🔵 ユーザーID
  workspaceId: string; // 🔵 ワークスペースID
  role: Role; // 🔵 ロール
  permissions: string[]; // 🔵 権限リスト
  joinedAt: Date; // 🔵 参加日時
  invitedBy?: string; // 🔵 招待者ID
  status: 'active' | 'invited' | 'suspended'; // 🔵 メンバー状態
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
  monthlyProcessingLimit: number; // 🔵 月間処理制限
  monthlyProcessingUsed: number; // 🔵 月間処理使用量
  storageLimit: number; // 🔵 ストレージ制限（bytes）
  storageUsed: number; // 🔵 ストレージ使用量（bytes）
  concurrentJobsLimit: number; // 🔵 最大並列ジョブ数
  membersLimit: number; // 🔵 最大メンバー数
  resetDate: Date; // 🔵 リセット日
}

/**
 * ワークスペースメンバー詳細
 * 🔵 信頼性: src/types/workspace.ts WorkspaceMemberDetail より
 */
export interface WorkspaceMemberDetail extends WorkspaceMember {
  user: {
    id: string; // 🔵 ユーザーID
    email: string; // 🔵 メールアドレス
    name?: string; // 🔵 表示名
    avatar?: string; // 🔵 アバターURL
  };
  lastActiveAt?: Date; // 🔵 最終アクティブ日時
  activityStats: {
    jobsCreated: number; // 🔵 作成ジョブ数
    videosGenerated: number; // 🔵 生成動画数
    lastJobAt?: Date; // 🔵 最終ジョブ日時
  };
}

/**
 * ワークスペース招待
 * 🔵 信頼性: src/types/workspace.ts WorkspaceInvitation より
 */
export interface WorkspaceInvitation {
  id: string; // 🔵 招待ID
  workspaceId: string; // 🔵 ワークスペースID
  email: string; // 🔵 招待先メール
  role: 'admin' | 'editor' | 'viewer'; // 🔵 招待ロール
  permissions: string[]; // 🔵 権限リスト
  invitedBy: string; // 🔵 招待者ID
  message?: string; // 🔵 招待メッセージ
  status: 'pending' | 'accepted' | 'declined' | 'expired'; // 🔵 招待状態
  createdAt: Date; // 🔵 作成日時
  expiresAt: Date; // 🔵 有効期限
  acceptedAt?: Date; // 🔵 承認日時
}

/**
 * ワークスペースアクティビティ
 * 🔵 信頼性: src/types/workspace.ts WorkspaceActivity より
 */
export interface WorkspaceActivity {
  id: string; // 🔵 アクティビティID
  workspaceId: string; // 🔵 ワークスペースID
  userId: string; // 🔵 実行ユーザーID
  action: WorkspaceActivityAction; // 🔵 アクション種別
  resourceType: 'workspace' | 'member' | 'job' | 'settings' | 'quota'; // 🔵 リソース種別
  resourceId: string; // 🔵 リソースID
  details: Record<string, unknown>; // 🔵 アクション詳細
  timestamp: Date; // 🔵 実行日時
  ipAddress?: string; // 🔵 IPアドレス
  userAgent?: string; // 🔵 ユーザーエージェント
}

/**
 * ワークスペースアクション種別
 * 🔵 信頼性: src/types/workspace.ts WorkspaceActivityAction より
 */
export type WorkspaceActivityAction =
  | 'workspace.created' | 'workspace.updated' | 'workspace.deleted'
  | 'member.invited' | 'member.joined' | 'member.role_changed'
  | 'member.removed' | 'member.suspended'
  | 'settings.updated' | 'quota.exceeded'
  | 'job.created' | 'job.completed' | 'job.failed'; // 🔵 全アクション種別

/**
 * パーミッション定数
 * 🔵 信頼性: src/types/workspace.ts PERMISSIONS より
 */
export const PERMISSIONS = {
  WORKSPACE_VIEW: 'workspace:view',
  WORKSPACE_EDIT: 'workspace:edit',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_SETTINGS: 'workspace:settings',
  MEMBERS_VIEW: 'members:view',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_MANAGE: 'members:manage',
  MEMBERS_REMOVE: 'members:remove',
  JOBS_CREATE: 'jobs:create',
  JOBS_VIEW: 'jobs:view',
  JOBS_VIEW_ALL: 'jobs:view:all',
  JOBS_CANCEL: 'jobs:cancel',
  JOBS_DELETE: 'jobs:delete',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
} as const; // 🔵 パーミッション定数群

/**
 * パーミッションキー型
 * 🔵 信頼性: src/types/workspace.ts PermissionKey より
 */
export type PermissionKey = keyof typeof PERMISSIONS; // 🔵 パーミッションキー

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 455件 (98%)
 * - 🟡 黄信号: 4件 (2%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質（第43回検証: 全型定義実態照合・253ファイル状態確認済み）
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

// ========================================
// Phase 4 アニメーション・レンダリング型
// ========================================

/**
 * アニメーション戦略タイプ
 * 🔵 信頼性: src/remotion/animation-strategies.ts・要件定義REQ-027 より
 */
export type AnimationStrategyType = 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle';

/**
 * アニメーション戦略設定
 * 🔵 信頼性: src/remotion/animation-strategies.ts より
 */
export interface AnimationStrategy {
  type: AnimationStrategyType; // 🔵 図解タイプ
  nodeAnimation: {
    durationFrames: number; // 🔵 ノードアニメーションフレーム数（0.3秒=9フレーム@30fps）
    staggerFrames: number; // 🔵 ノード間の遅延フレーム数
    startOpacity: number; // 🔵 開始不透明度（0）
    endOpacity: number; // 🔵 終了不透明度（1）
    startScale: number; // 🔵 開始スケール（0.8）
    endScale: number; // 🔵 終了スケール（1.0）
  };
  edgeAnimation: {
    durationFrames: number; // 🔵 エッジアニメーションフレーム数（0.5秒=15フレーム@30fps）
    staggerFrames: number; // 🔵 エッジ間の遅延フレーム数
  };
}

/**
 * SRTキャプションエントリ
 * 🔵 信頼性: src/remotion/srt-parser.ts・要件定義REQ-028 より
 */
export interface CaptionEntry {
  index: number; // 🔵 SRTインデックス
  startMs: number; // 🔵 開始タイムスタンプ（ms）
  endMs: number; // 🔵 終了タイムスタンプ（ms）
  text: string; // 🔵 キャプションテキスト
  startFrame?: number; // 🔵 開始フレーム番号
  endFrame?: number; // 🔵 終了フレーム番号
}

/**
 * SRTパース結果
 * 🔵 信頼性: src/remotion/srt-parser.ts より
 */
export interface ParsedSRT {
  entries: CaptionEntry[]; // 🔵 キャプションエントリ配列
  totalDuration: number; // 🔵 総時間（ms）
  isValid: boolean; // 🔵 SRT整合性検証結果
}

/**
 * レンダリング設定
 * 🔵 信頼性: src/remotion/renderer.ts・要件定義REQ-030・REQ-301 より
 */
export interface RenderingConfig {
  resolution: '720p' | '1080p' | '4k'; // 🔵 出力解像度
  fps: 30 | 60; // 🔵 フレームレート
  codec: 'h264' | 'h265' | 'vp9'; // 🔵 動画コーデック
  outputPath?: string; // 🔵 出力ファイルパス
}

/**
 * レンダリング結果
 * 🔵 信頼性: src/remotion/renderer.ts より
 */
export interface RenderingResult {
  success: boolean; // 🔵 成功フラグ
  outputUrl?: string; // 🔵 出力ファイルURL
  duration?: number; // 🔵 動画時間（秒）
  fileSize?: number; // 🔵 ファイルサイズ（バイト）
  resolution?: string; // 🔵 実際の解像度
  fps?: number; // 🔵 実際のFPS
  codec?: string; // 🔵 実際のコーデック
  estimatedFileSize?: number; // 🔵 推定ファイルサイズ
  error?: string; // 🔵 エラーメッセージ
}

/**
 * シーン同期結果
 * 🔵 信頼性: src/remotion/scene-synchronizer.ts・要件定義REQ-029 より
 */
export interface SceneSyncResult {
  scenes: RemotionSceneData[]; // 🔵 同期済みシーン配列
  captions: CaptionEntry[]; // 🔵 同期済みキャプション配列
  maxDriftMs: number; // 🔵 最大ドリフト（ms、許容±50ms）
  isValid: boolean; // 🔵 同期検証結果
}

// ========================================
// Phase 4 Pipeline UI 型
// ========================================

/**
 * パイプライン進捗ステージ
 * 🔵 信頼性: src/components/PipelineProgress.tsx・要件定義REQ-033 より
 */
export interface PipelineStageProgress {
  stage: 'transcribe' | 'analyze' | 'layout' | 'render'; // 🔵 ステージ名
  status: 'pending' | 'in_progress' | 'completed' | 'error'; // 🔵 ステージ状態
  progress: number; // 🔵 進捗率（0-100）
  elapsedMs?: number; // 🔵 経過時間（ms）
  error?: string; // 🔵 エラーメッセージ
}

/**
 * SimplePipeline 処理結果
 * 🔵 信頼性: src/pipeline/simple-pipeline.ts SimplePipelineResult より
 */
export interface SimplePipelineResult {
  success: boolean; // 🔵 成功フラグ
  audioUrl?: string; // 🔵 音声ファイルURL
  transcript?: string; // 🔵 文字起こしテキスト
  scenes?: SceneGraph[]; // 🔵 生成シーン
  videoUrl?: string; // 🔵 生成動画URL
  error?: string; // 🔵 エラーメッセージ
  processingTime?: number; // 🔵 処理時間（ms）
  [key: string]: unknown; // 🔵 SceneData 互換インデックスシグネチャ（2417691）
}

/**
 * パイプライン結果（UI コンポーネント用）
 * 🔵 信頼性: src/components/SimplePipelineInterface.tsx・要件定義REQ-035 より
 */
export interface PipelineResult {
  scenes: RemotionSceneData[]; // 🔵 生成シーン
  transcript: string; // 🔵 文字起こしテキスト
  srt: ParsedSRT; // 🔵 SRTキャプション
  metrics: QualityMetrics; // 🔵 品質メトリクス
  videoUrl?: string; // 🔵 生成動画URL
}

// ========================================
// 拡張モジュール型（REQ-036~039）
// ========================================

/**
 * ストリーミング文字起こし設定
 * 🔵 信頼性: src/transcription/streaming-transcriber.ts・要件定義REQ-036 より
 */
export interface StreamingTranscriptionConfig {
  chunkSizeMs?: number; // 🔵 チャンクサイズ（デフォルト: 3000ms）
  overlapMs?: number; // 🔵 チャンク間オーバーラップ（デフォルト: 500ms）
  minConfidence?: number; // 🔵 最小信頼度閾値（デフォルト: 0.7）
  enableLiveUpdate?: boolean; // 🔵 リアルタイムUI更新（デフォルト: true）
}

/**
 * ストリーミング進捗
 * 🔵 信頼性: src/transcription/streaming-transcriber.ts より
 */
export interface StreamingProgress {
  processedDuration: number; // 🔵 処理済み時間（ms）
  totalDuration: number; // 🔵 総時間（ms）
  currentSegment: string; // 🔵 現在のセグメントテキスト
  segmentCount: number; // 🔵 処理済みセグメント数
  averageConfidence: number; // 🔵 平均信頼度スコア
}

/**
 * エラーカテゴリ
 * 🔵 信頼性: src/quality/user-guided-error-recovery.ts・要件定義REQ-037 より
 */
export type ErrorCategory =
  | 'file_format' | 'file_size' | 'transcription'
  | 'analysis' | 'layout' | 'rendering'
  | 'api' | 'network' | 'memory' | 'timeout' | 'unknown'; // 🔵 11カテゴリ

/**
 * エラー深刻度
 * 🔵 信頼性: src/quality/user-guided-error-recovery.ts より
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'; // 🔵 4段階

/**
 * 回復戦略
 * 🔵 信頼性: src/quality/user-guided-error-recovery.ts より
 */
export interface RecoveryStrategy {
  id: string; // 🔵 戦略ID
  name: string; // 🔵 戦略名
  description: string; // 🔵 戦略説明
  automated: boolean; // 🔵 自動回復可能フラグ
  steps: string[]; // 🔵 手動回復ステップ
  estimatedTime: number; // 🔵 推定所要時間（秒）
  successRate: number; // 🔵 成功率（0-1）
}

/**
 * エラーガイダンス
 * 🔵 信頼性: src/quality/user-guided-error-recovery.ts より
 */
export interface ErrorGuidance {
  category: ErrorCategory; // 🔵 エラーカテゴリ
  severity: ErrorSeverity; // 🔵 深刻度
  userMessage: string; // 🔵 ユーザー向けメッセージ
  technicalDetails: string; // 🔵 技術的詳細
  recoveryStrategies: RecoveryStrategy[]; // 🔵 回復戦略一覧
  preventionTips: string[]; // 🔵 予防ティップス
  documentationLinks: string[]; // 🔵 関連ドキュメントリンク
}

/**
 * 設定バリデーションエラー
 * 🔵 信頼性: src/config/validate.ts・要件定義REQ-038 より
 */
export interface ConfigValidationError {
  field: string; // 🔵 フィールド名
  message: string; // 🔵 エラーメッセージ
}

/**
 * 設定スキーマ
 * 🔵 信頼性: src/config/schema.ts・要件定義REQ-038 より
 */
export interface ConfigSchema {
  googleApiKey: string; // 🔵 Google API キー（必須）
  supabaseUrl: string; // 🔵 Supabase URL（必須）
  supabaseAnonKey: string; // 🔵 Supabase Anon Key（必須）
  analysisDisableGemini: boolean; // 🔵 Gemini分析無効フラグ
  geminiModelOverride?: string; // 🔵 カスタムモデル指定
  complexityThreshold: number; // 🔵 複雑度閾値 (0-1)
  cacheSize: number; // 🔵 キャッシュサイズ (1-10000)
  cacheTtlMinutes: number; // 🔵 キャッシュTTL (1-10080分)
  similarityThreshold: number; // 🔵 類似度閾値 (0-1)
  port: number; // 🔵 ポート番号 (1024-65535)
  nodeEnv: 'development' | 'production' | 'test'; // 🔵 環境
}

/**
 * コンテンツ特性分析結果
 * 🔵 信頼性: src/optimization/smart-parameter-tuner.ts・要件定義REQ-039 より
 */
export interface ContentCharacteristics {
  speechRate: number; // 🔵 語速（WPM）
  complexity: 'low' | 'medium' | 'high'; // 🔵 コンテンツ複雑度
  domain: 'technical' | 'business' | 'educational' | 'general'; // 🔵 ドメイン分類
  audioQuality: number; // 🔵 音質スコア (0-1)
  keywordDensity: number; // 🔵 キーワード密度
  diagramLikelihood: number; // 🔵 図解可能性 (0-1)
}

/**
 * 最適化パラメータセット
 * 🔵 信頼性: src/optimization/smart-parameter-tuner.ts より
 */
export interface ParameterSet {
  confidenceThreshold: number; // 🔵 信頼度閾値
  segmentMinLength: number; // 🔵 セグメント最小長
  segmentMaxLength: number; // 🔵 セグメント最大長
  keywordWeights: Record<string, number>; // 🔵 キーワード重み
  layoutDensity: number; // 🔵 レイアウト密度
  processingMode: 'fast' | 'balanced' | 'accurate'; // 🔵 処理モード
}

/**
 * 最適化結果
 * 🔵 信頼性: src/optimization/smart-parameter-tuner.ts より
 */
export interface OptimizationResult {
  parameters: ParameterSet; // 🔵 最適化パラメータ
  expectedAccuracy: number; // 🔵 期待精度
  expectedSpeed: number; // 🔵 期待速度
  expectedReliability: number; // 🔵 期待信頼性
  confidence: number; // 🔵 最適化の信頼度
}

/**
 * 処理戦略設定
 * 🔵 信頼性: src/optimization/adaptive-content-processor.ts より
 */
export interface ProcessingStrategy {
  transcriptionConfig: {
    model: 'base' | 'small' | 'medium' | 'large'; // 🔵 Whisperモデル
    combineWindow: number; // 🔵 結合ウィンドウ
    retryCount: number; // 🔵 リトライ回数
  };
  analysisConfig: {
    segmentationMode: 'fixed' | 'adaptive'; // 🔵 セグメンテーションモード
    diagramDetectionSensitivity: number; // 🔵 図解検出感度
    complexityThreshold: number; // 🔵 複雑度閾値
  };
  layoutConfig: {
    algorithm: 'dagre' | 'force' | 'hierarchical'; // 🔵 レイアウトアルゴリズム
    spacing: number; // 🔵 ノード間隔
    iterations: number; // 🔵 反復回数
  };
}

/**
 * 適応処理結果
 * 🔵 信頼性: src/optimization/adaptive-content-processor.ts より
 */
export interface AdaptiveResult {
  strategy: ProcessingStrategy; // 🔵 選択された戦略
  confidence: number; // 🔵 選択信頼度 (0.6-0.95)
  reasoning: string[]; // 🔵 選択理由
  expectedImprovement: number; // 🔵 期待改善率 (%)
}

// ========================================
// Phase 5 エラー分類・品質ゲート・オーケストレーター型（REQ-040~042）
// ========================================

/**
 * エラー分類タイプ（11種類）
 * 🔵 信頼性: src/quality/error-classifier.ts・要件定義REQ-040 より
 */
export type ErrorType =
  | 'FILE_FORMAT_INVALID' | 'FILE_SIZE_EXCEEDED'
  | 'LLM_API_ERROR' | 'LLM_RATE_LIMITED' | 'LLM_TIMEOUT'
  | 'RENDERING_ERROR' | 'RENDERING_OOM'
  | 'NETWORK_ERROR' | 'STORAGE_ERROR'
  | 'QUALITY_GATE_FAILED' | 'UNKNOWN'; // 🔵 11種類のエラータイプ

/**
 * エラー重大度（4段階）
 * 🔵 信頼性: src/quality/error-classifier.ts・要件定義REQ-040 より
 */
export type ErrorSeverityLevel = 'low' | 'medium' | 'high' | 'critical'; // 🔵 4段階

/**
 * 分類済みエラー
 * 🔵 信頼性: src/quality/error-classifier.ts・要件定義REQ-040 より
 */
export interface ClassifiedError {
  type: ErrorType; // 🔵 エラータイプ
  severity: ErrorSeverityLevel; // 🔵 重大度
  stage: string; // 🔵 発生ステージ
  originalError: Error; // 🔵 元のエラーオブジェクト
  userMessage: string; // 🔵 ユーザー向けメッセージ
  recoverable: boolean; // 🔵 復旧可能性
  suggestedAction: string; // 🔵 推奨アクション
}

/**
 * エラー分類コンテキスト
 * 🔵 信頼性: src/quality/error-classifier.ts より
 */
export interface ClassifyContext {
  stage?: string; // 🔵 発生ステージ名
  operation?: string; // 🔵 実行中の操作
  input?: unknown; // 🔵 入力データ
  timestamp?: number; // 🔵 発生時刻
}

/**
 * エラー分類統計
 * 🔵 信頼性: src/quality/error-classifier.ts より
 */
export interface ClassificationStatistics {
  total: number; // 🔵 総分類数
  byType: Record<ErrorType, number>; // 🔵 タイプ別件数
  bySeverity: Record<ErrorSeverityLevel, number>; // 🔵 重大度別件数
  recoveryRate: number; // 🔵 復旧率
}

/**
 * 品質ゲート基準
 * 🔵 信頼性: src/quality/quality-gate.ts・要件定義REQ-041 より
 */
export interface QualityCriterion {
  name: string; // 🔵 基準名
  field: string; // 🔵 評価対象フィールド
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<'; // 🔵 比較演算子
  threshold: number | string | boolean; // 🔵 閾値
  unit?: string; // 🔵 単位
}

/**
 * 品質ゲート設定
 * 🔵 信頼性: src/quality/quality-gate.ts・要件定義REQ-041 より
 */
export interface QualityGateConfig {
  stage: number; // 🔵 ステージ番号 (1-5)
  name: string; // 🔵 ステージ名
  criteria: QualityCriterion[]; // 🔵 品質基準リスト
  blockingOnFailure: boolean; // 🔵 失敗時ブロック有無
  fallbackAction?: 'retry' | 'skip' | 'abort'; // 🔵 フォールバックアクション
}

/**
 * ステージ評価結果
 * 🔵 信頼性: src/quality/quality-gate.ts より
 */
export interface StageEvaluationResult {
  stage: number; // 🔵 ステージ番号
  passed: boolean; // 🔵 通過判定
  results: StageCriterionResult[]; // 🔵 基準別結果
  blocking: boolean; // 🔵 ブロック判定
  fallbackAction?: 'retry' | 'skip' | 'abort'; // 🔵 フォールバックアクション
}

/**
 * 基準評価結果
 * 🔵 信頼性: src/quality/quality-gate.ts より
 */
export interface StageCriterionResult {
  criterion: string; // 🔵 基準名
  passed: boolean; // 🔵 通過判定
  actual: number | string | boolean; // 🔵 実測値
  expected: number | string | boolean; // 🔵 期待値
  unit?: string; // 🔵 単位
}

/**
 * パイプライン進捗
 * 🔵 信頼性: src/pipeline/pipeline-orchestrator.ts・要件定義REQ-042 より
 */
export interface PipelineProgress {
  stage: number; // 🔵 ステージ番号 (1-5)
  stageName: string; // 🔵 ステージ名
  progress: number; // 🔵 進捗率 (0-100)
  status: 'running' | 'completed' | 'failed' | 'fallback'; // 🔵 ステータス
  message?: string; // 🔵 メッセージ
}

/**
 * パイプラインオーケストレーター設定
 * 🔵 信頼性: src/pipeline/pipeline-orchestrator.ts より
 */
export interface PipelineOrchestratorConfig {
  maxRetries?: number; // 🔵 最大リトライ回数
  timeout?: number; // 🔵 タイムアウト (ms)
  enableQualityGates?: boolean; // 🔵 品質ゲート有効化
  enableFallbacks?: boolean; // 🔵 フォールバック有効化
  onProgress?: (progress: PipelineProgress) => void; // 🔵 進捗コールバック
}

/**
 * パイプライン結果
 * 🔵 信頼性: src/pipeline/pipeline-orchestrator.ts より
 */
export interface PipelineOrchestrationResult {
  success: boolean; // 🔵 成功フラグ
  videoUrl?: string; // 🔵 動画URL
  qualityReport: StageEvaluationResult[]; // 🔵 品質レポート
  metrics: QualityMetrics; // 🔵 品質メトリクス
  errors: ClassifiedError[]; // 🔵 発生エラー一覧
  totalDuration: number; // 🔵 総処理時間 (ms)
}

// ========================================
// Phase 5 バッチ API・Edge Functions 型（REQ-043~045）
// ========================================

/**
 * バッチジョブ状態
 * 🔵 信頼性: src/api/routes/batch.ts・要件定義REQ-043 より
 */
export type JobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'; // 🔵 5状態

/**
 * バッチジョブ進捗
 * 🔵 信頼性: src/api/routes/batch.ts より
 */
export interface JobProgress {
  totalFiles: number; // 🔵 総ファイル数
  completedFiles: number; // 🔵 完了ファイル数
  failedFiles: number; // 🔵 失敗ファイル数
  currentFile?: string; // 🔵 現在処理中のファイル
  stageProgress?: number; // 🔵 現在のステージ進捗 (0-100)
  estimatedTimeRemaining?: number; // 🔵 推定残り時間 (秒)
}

/**
 * バッチジョブステータス
 * 🔵 信頼性: src/api/routes/batch.ts・要件定義REQ-043 より
 */
export interface BatchJobStatus {
  jobId: string; // 🔵 UUID ジョブID
  status: JobState; // 🔵 ジョブ状態
  progress: JobProgress; // 🔵 進捗情報
  startedAt?: string; // 🔵 開始日時
  completedAt?: string; // 🔵 完了日時
  preset?: string; // 🔵 品質プリセット
  options?: Record<string, unknown>; // 🔵 オプション設定
}

/**
 * Edge Function 認証結果
 * 🔵 信頼性: supabase/functions/_shared/auth.ts・要件定義REQ-044 より
 */
export interface AuthResult {
  userId: string; // 🔵 ユーザーID
  email?: string; // 🔵 メールアドレス
}

/**
 * Edge Function 認証エラー
 * 🔵 信頼性: supabase/functions/_shared/auth.ts より
 */
export interface AuthError {
  error: string; // 🔵 エラーメッセージ
  code: string; // 🔵 エラーコード (AUTH_MISSING_HEADER/AUTH_MISSING_TOKEN/AUTH_TOKEN_EXPIRED/AUTH_INVALID_TOKEN/AUTH_USER_NOT_FOUND)
  status: number; // 🔵 HTTP ステータスコード
}

/**
 * Edge Function 統一エラーレスポンス
 * 🔵 信頼性: supabase/functions/_shared/error-handler.ts・要件定義REQ-045 より
 */
export interface EdgeErrorResponse {
  error: string; // 🔵 エラーメッセージ
  code: string; // 🔵 エラーコード
  details?: string; // 🔵 エラー詳細
}

/**
 * タイムアウトコントローラー
 * 🔵 信頼性: supabase/functions/_shared/error-handler.ts より
 */
export interface TimeoutController {
  signal: AbortSignal; // 🔵 中断シグナル
  clear(): void; // 🔵 タイムアウト解除
}

// ========================================
// Phase 5 WebSocket 型（REQ-046）
// ========================================

/**
 * 認証済みソケット
 * 🔵 信頼性: src/api/websocket-handler.ts・要件定義REQ-046 より
 */
export interface AuthenticatedSocket {
  id: string; // 🔵 ソケットID
  user: { userId: string; email?: string }; // 🔵 JWT デコード済みユーザー情報
}

/**
 * ジョブ進捗ペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts より
 */
export interface JobProgressPayload {
  jobId: string; // 🔵 ジョブID
  total: number; // 🔵 総ファイル数
  completed: number; // 🔵 完了ファイル数
  failed: number; // 🔵 失敗ファイル数
  percentage: number; // 🔵 進捗率 (0-100)
}

/**
 * ジョブ完了ペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts より
 */
export interface JobCompletePayload {
  jobId: string; // 🔵 ジョブID
  timestamp: string; // 🔵 完了日時
  progress: JobProgressPayload; // 🔵 最終進捗
}

/**
 * ジョブエラーペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts より
 */
export interface JobErrorPayload {
  jobId: string; // 🔵 ジョブID
  error: string; // 🔵 エラーメッセージ
  fileId?: string; // 🔵 ファイルID（オプション）
}

/**
 * ファイルステータス ペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts より
 */
export interface FileStatusPayload {
  jobId: string; // 🔵 ジョブID
  fileId: string; // 🔵 ファイルID
  status: string; // 🔵 ファイルステータス
  qualityScore?: number; // 🔵 品質スコア
}

/**
 * ステージ進捗ペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts より
 */
export interface StageProgressPayload {
  jobId: string; // 🔵 ジョブID
  fileId: string; // 🔵 ファイルID
  stage: string; // 🔵 ステージ名（transcription/visualization等）
  progress: number; // 🔵 進捗率 (0-100)
}

/**
 * ストリーミングセグメントペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts・要件定義REQ-046 より
 */
export interface StreamingSegmentPayload {
  sessionId: string; // 🔵 セッションID
  segment: string; // 🔵 セグメントテキスト
  confidence: number; // 🔵 信頼度スコア
  progress: { processedDuration: number; totalDuration: number }; // 🔵 進捗
}

/**
 * エラー回復ペイロード
 * 🔵 信頼性: src/api/websocket-handler.ts・要件定義REQ-046 より
 */
export interface WsErrorRecoveryPayload {
  errorId: string; // 🔵 エラーID
  category: string; // 🔵 エラーカテゴリ
  severity: string; // 🔵 深刻度
  strategies: Array<{ id: string; name: string; automated: boolean }>; // 🔵 回復戦略
}

// ========================================
// Phase 5 最適化ユーティリティ型（REQ-047~049）
// ========================================

/**
 * バッチ最適化設定
 * 🔵 信頼性: src/optimization/batch-optimizer.ts・要件定義REQ-047 より
 */
export interface BatchOptimizerOptions {
  concurrency: number; // 🔵 最大並列チャンク数（デフォルト: 4）
  chunkSize: number; // 🔵 チャンクサイズ（デフォルト: 50）
  failFast: boolean; // 🔵 フェイルファスト（デフォルト: false）
  onProgress?: (completed: number, total: number) => void; // 🔵 進捗コールバック
}

/**
 * バッチ処理結果
 * 🔵 信頼性: src/optimization/batch-optimizer.ts より
 */
export interface BatchResult<T> {
  results: (T | undefined)[]; // 🔵 結果配列（元の順序）
  errors: (Error | undefined)[]; // 🔵 エラー配列（元の順序）
  stats: {
    total: number; // 🔵 総アイテム数
    succeeded: number; // 🔵 成功数
    failed: number; // 🔵 失敗数
    processingTimeMs: number; // 🔵 処理時間（ms）
  };
}

/**
 * 計算キャッシュ設定
 * 🔵 信頼性: src/optimization/computation-cache.ts・要件定義REQ-048 より
 */
export interface ComputationCacheOptions {
  maxSize?: number; // 🔵 最大エントリ数（デフォルト: 200）
  ttlMs?: number; // 🔵 TTL（デフォルト: 600000ms = 10分）
}

/**
 * キャッシュエントリメタデータ
 * 🔵 信頼性: src/optimization/computation-cache.ts より
 */
export interface CacheEntryMeta {
  createdAt: number; // 🔵 作成日時
  accessCount: number; // 🔵 アクセス回数
  computeTimeMs: number; // 🔵 計算時間（ms）
  tags?: string[]; // 🔵 関連タグ
}

/**
 * 計算キャッシュ統計
 * 🔵 信頼性: src/optimization/computation-cache.ts より
 */
export interface ComputationCacheStats {
  size: number; // 🔵 現在のエントリ数
  hits: number; // 🔵 ヒット数
  misses: number; // 🔵 ミス数
  hitRate: number; // 🔵 ヒット率
  evictions: number; // 🔵 退行数
  totalComputeTimeMs: number; // 🔵 総計算時間
}

/**
 * メモリキャッシュ設定
 * 🔵 信頼性: src/optimization/memory-cache.ts・要件定義REQ-048 より
 */
export interface MemoryCacheOptions {
  maxSize: number; // 🔵 最大エントリ数（デフォルト: 100）
  defaultTtlMs: number; // 🔵 デフォルトTTL（デフォルト: 300000ms = 5分）
  cleanupIntervalMs: number; // 🔵 クリーンアップ間隔（デフォルト: 60000ms = 1分）
}

/**
 * メモリキャッシュ統計
 * 🔵 信頼性: src/optimization/memory-cache.ts より
 */
export interface MemoryCacheStats {
  size: number; // 🔵 現在のエントリ数
  hits: number; // 🔵 ヒット数
  misses: number; // 🔵 ミス数
  hitRate: number; // 🔵 ヒット率
  evictions: number; // 🔵 退行数
}

/**
 * 遅延ロードモジュール
 * 🔵 信頼性: src/optimization/lazy-loader.ts・要件定義REQ-049 より
 */
export interface LazyModule<T> {
  module: T; // 🔵 ロード済みモジュール
  loadTimeMs: number; // 🔵 ロード時間（ms）
}

/**
 * 遅延ローダー統計
 * 🔵 信頼性: src/optimization/lazy-loader.ts より
 */
export interface LazyLoaderStats {
  totalLoads: number; // 🔵 総ロード回数
  cacheHits: number; // 🔵 キャッシュヒット数
  cacheMisses: number; // 🔵 キャッシュミス数
  averageLoadTimeMs: number; // 🔵 平均ロード時間（ms）
  loadedModules: number; // 🔵 ロード済みモジュール数
}

// ========================================
// グレースフルシャットダウン・型安全性（REQ-050~051）
// ========================================

/**
 * シャットダウン状態
 * 🔵 信頼性: src/quality/enhanced-error-recovery.ts shutdown()・要件定義REQ-050 より
 */
export type ShutdownState = 'running' | 'shutting_down' | 'stopped'; // 🔵 シャットダウン状態

/**
 * シャットダウン結果
 * 🔵 信頼性: src/quality/enhanced-error-recovery.ts shutdown()・要件定義REQ-050 より
 */
export interface ShutdownResult {
  state: ShutdownState; // 🔵 最終状態
  activeRequestsCompleted: number; // 🔵 完了したアクティブリクエスト数
  forcedTerminations: number; // 🔵 強制終了したリクエスト数
  shutdownDurationMs: number; // 🔵 シャットダウン所要時間（ms）
  timedOut: boolean; // 🔵 タイムアウトしたかどうか（30秒）
}

/**
 * 型ガード関数: DiagramType の実行時検証
 * 🔵 信頼性: src/types/diagram.ts isDiagramType()・要件定義REQ-051 より
 *
 * 11種類の有効な DiagramType 値を検証する:
 * flow, tree, timeline, matrix, cycle,
 * flowchart, comparison, network, conceptmap, mindmap, general
 */
export function isDiagramType(value: unknown): value is DiagramType { // 🔵 src/types/diagram.ts より
  return typeof value === 'string' && (
    value === 'flow' || value === 'tree' || value === 'timeline' ||
    value === 'matrix' || value === 'cycle' || value === 'flowchart' ||
    value === 'comparison' || value === 'network' || value === 'conceptmap' ||
    value === 'mindmap' || value === 'general'
  );
}

// ========================================
// 追加 UI コンポーネント型（REQ-052~055, REQ-305）
// ========================================

/**
 * チュートリアルカテゴリ
 * 🔵 信頼性: src/components/TutorialSystem.tsx・要件定義REQ-052 より
 */
export type TutorialCategory = 'overview' | 'pipeline' | 'visualization' | 'export'; // 🔵 4カテゴリ

/**
 * チュートリアル難易度
 * 🔵 信頼性: src/components/TutorialSystem.tsx より
 */
export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced'; // 🔵 3段階

/**
 * チュートリアルステップ
 * 🔵 信頼性: src/components/TutorialSystem.tsx・要件定義REQ-052 より
 */
export interface TutorialStep {
  id: string; // 🔵 ステップID
  title: string; // 🔵 ステップタイトル
  description: string; // 🔵 ステップ説明
  category: TutorialCategory; // 🔵 カテゴリ
  difficulty: TutorialDifficulty; // 🔵 難易度
  completed: boolean; // 🔵 完了フラグ
}

/**
 * チュートリアル進捗
 * 🔵 信頼性: src/components/TutorialSystem.tsx より
 */
export interface TutorialProgress {
  completedSteps: string[]; // 🔵 完了済みステップID配列
  isFirstVisit: boolean; // 🔵 初回アクセスフラグ
}

/**
 * ストリーミング処理モード
 * 🔵 信頼性: src/components/StreamingProcessor.tsx・要件定義REQ-053 より
 */
export type ProcessingMode = 'file' | 'live' | 'idle'; // 🔵 3モード

/**
 * ストリーミングステータス
 * 🔵 信頼性: src/components/StreamingProcessor.tsx より
 */
export type StreamingStatus = 'idle' | 'recording' | 'processing' | 'paused' | 'complete' | 'error'; // 🔵 6状態

/**
 * ストリーミング統計
 * 🔵 信頼性: src/components/StreamingProcessor.tsx より
 */
export interface StreamingStatistics {
  segmentCount: number; // 🔵 処理済みセグメント数
  averageConfidence: number; // 🔵 平均信頼度
  processingSpeed: number; // 🔵 処理速度（セグメント/秒）
}

/**
 * フレームワークフェーズ情報
 * 🔵 信頼性: src/components/FrameworkDashboard.tsx・要件定義REQ-054 より
 */
export interface PhaseInfo {
  name: string; // 🔵 フェーズ名
  maxIterations: number; // 🔵 最大イテレーション数
  successCriteria: string; // 🔵 成功基準
  currentIteration: number; // 🔵 現在のイテレーション
  status: 'pending' | 'active' | 'completed' | 'failed'; // 🔵 フェーズ状態
}

/**
 * フレームワークパイプライン設定
 * 🔵 信頼性: src/components/FrameworkDashboardPage.tsx より
 */
export interface FrameworkPipelineConfig {
  enableAutoCommit: boolean; // 🔵 自動コミット（デフォルト: false）
  maxImprovementCycles: number; // 🔵 最大改善サイクル（デフォルト: 5）
  targetQualityScore: number; // 🔵 目標品質スコア（デフォルト: 95）
}

/**
 * プロダクション環境設定
 * 🔵 信頼性: src/components/ProductionDashboard.tsx・要件定義REQ-055 より
 */
export interface ProductionEnvironment {
  apiEndpoint: string; // 🔵 API エンドポイント
  apiKeyConfigured: boolean; // 🔵 API キー設定状態
  optimizationLevel: 'low' | 'medium' | 'high'; // 🔵 最適化レベル
  monitoringEnabled: boolean; // 🔵 監視有無
}

/**
 * パフォーマンスレポート
 * 🔵 信頼性: src/components/ProductionDashboard.tsx より
 */
export interface PerformanceReport {
  averageProcessingTime: number; // 🔵 平均処理時間（ms）
  successRate: number; // 🔵 成功率（%）
  qualityScore: number; // 🔵 品質スコア
  generatedAt: string; // 🔵 レポート生成日時
}

/**
 * エラーアラート
 * 🔵 信頼性: src/components/ErrorAlertSystem.tsx・要件定義REQ-305 より
 */
export interface ErrorAlert {
  id: string; // 🔵 アラートID
  category: ErrorCategory; // 🔵 エラーカテゴリ（11種）
  severity: ErrorSeverity; // 🔵 深刻度（4段階）
  message: string; // 🔵 エラーメッセージ
  timestamp: number; // 🔵 発生時刻
  recoveryAction?: string; // 🔵 回復アクション
  dismissed: boolean; // 🔵 解除フラグ
}

/**
 * エラーアラートメトリクス
 * 🔵 信頼性: src/components/ErrorAlertSystem.tsx より
 */
export interface ErrorAlertMetrics {
  totalAlerts: number; // 🔵 総アラート数
  byCategory: Record<ErrorCategory, number>; // 🔵 カテゴリ別件数
  bySeverity: Record<ErrorSeverity, number>; // 🔵 深刻度別件数
  recoveryRate: number; // 🔵 回復率
}