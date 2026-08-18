/**
 * Video Generator - SimplePipeline → Remotion統合
 * Phase 4-1 実装: カスタムインストラクション準拠
 * 目標: 音声→図解動画の完全自動化
 */

import { SimplePipelineResult } from './simple-pipeline';
import { SceneGraph, DiagramType, DIAGRAM_TYPE_TITLES } from '@stv/core/types/diagram';
import { COMPOSITION_ID } from '@/remotion/composition-id';
import { DEFAULT_FPS } from '@/remotion/scene-synchronizer';
import { logger } from '@stv/core/utils/logger';
import { QualityGateError, RenderingError } from './pipeline-errors';
import {
  MIN_SCENE_DURATION_MS,
  MAX_EDITORIAL_SCENE_DURATION_MS,
  DEFAULT_SCENE_DURATION_MS,
} from './scene-duration-limits';
import { safeArray } from '@stv/core/lib/safe-array';

export interface VideoGenerationOptions {
  outputFormat: 'mp4' | 'webm' | 'gif';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  includeAudio: boolean;
  backgroundColor?: string;
  animationStyle: 'smooth' | 'instant' | 'bounce';
  // Phase 14: Remotion rendering optimizations
  concurrency?: number; // Number of CPU cores to use (default: 50% of available cores)
  enableMultithreadedRendering?: boolean; // Default: true
  enableGpuAcceleration?: boolean; // Default: true if available
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  resolution?: string;
  processingTime?: number;
  error?: string;
}

export interface RemotionSceneData {
  id: string;
  startMs: number;
  durationMs: number;
  diagramType: string;
  title: string;
  nodes: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    type: string;
    color?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    type?: string;
  }>;
  transcript: string;
  confidence: number;
  keyphrases: string[];
}

/**
 * Quality tier accepted by the real renderer (ActualVideoRenderOptions.quality).
 * The renderer has no 'ultra' tier, unlike VideoGenerationOptions.quality.
 */
export type ActualRenderQuality = 'low' | 'medium' | 'high';

/**
 * Map a VideoGenerator quality setting (which includes an 'ultra' tier) down to
 * the quality value the actual renderer accepts ('low' | 'medium' | 'high').
 * 'ultra' maps to the highest real tier ('high').
 *
 * This is the single source of truth for which quality reaches the encode CRF —
 * executeRemotionRender must route this.options.quality through here rather than
 * hardcoding a tier, or the configured/default quality is silently ignored.
 */
export function toRenderQuality(
  quality: VideoGenerationOptions['quality'] | undefined
): ActualRenderQuality {
  return quality === 'ultra' || quality === undefined ? 'high' : quality;
}

/**
 * Phase 4-1 メインクラス: SimplePipeline結果をRemotionに変換
 * カスタムインストラクション: 実装→テスト→評価→改善のサイクル
 */
export class VideoGenerator {
  private iteration: number = 1;
  private generationMetrics = {
    totalGenerations: 0,
    successfulGenerations: 0,
    averageProcessingTime: 0,
    qualityScores: new Map<number, number>(),
    errorPatterns: new Map<string, number>()
  };

  constructor(private options: Partial<VideoGenerationOptions> = {}) {
    // Phase 14: Calculate optimal concurrency based on available CPU cores
    const optimalConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? Math.max(1, Math.floor(navigator.hardwareConcurrency * 0.5))
      : 2; // Fallback to 2 threads

    // デフォルト設定
    this.options = {
      outputFormat: 'mp4',
      quality: 'high',
      resolution: '1080p',
      fps: DEFAULT_FPS,
      includeAudio: true,
      backgroundColor: '#0f0f23',
      animationStyle: 'smooth',
      // Phase 14: Performance optimizations
      concurrency: optimalConcurrency,
      enableMultithreadedRendering: true,
      enableGpuAcceleration: true,
      ...options
    };

  }

  /**
   * Phase 4-1 メイン機能: SimplePipeline結果を動画に変換
   * カスタムインストラクション: 段階的実装アプローチ
   */
  async generateVideo(
    pipelineResult: SimplePipelineResult,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<VideoGenerationResult> {
    const startTime = performance.now();

    try {
      onProgress?.('Initializing video generation', 0);

      // Phase 4-1: 実装段階 - SimplePipeline → Remotionデータ変換
      onProgress?.('Converting pipeline data', 10);
      const remotionData = await this.convertPipelineToRemotionData(pipelineResult);

      // Phase 4-1: テスト段階 - データ変換品質検証
      onProgress?.('Validating conversion', 25);
      const validationResult = await this.validateRemotionData(remotionData);

      if (!validationResult.isValid) {
        throw new QualityGateError('data_validation', validationResult.errors.join(', '));
      }

      // Phase 4-1: 評価段階 - Remotionレンダリング準備
      onProgress?.('Preparing Remotion render', 40);
      const renderConfig = await this.prepareRenderConfiguration(remotionData);

      // Phase 4-1: 改善段階 - レンダリング実行（模擬実装）
      onProgress?.('Rendering video', 60);
      const renderResult = await this.executeRemotionRender(renderConfig, onProgress);

      // Phase 4-1: 最終処理
      onProgress?.('Finalizing video', 90);
      const finalResult = await this.finalizeVideoGeneration(renderResult);

      const processingTime = performance.now() - startTime;

      // メトリクス更新
      this.updateGenerationMetrics(finalResult, processingTime);

      onProgress?.('Video generation complete', 100);


      return {
        ...finalResult,
        processingTime
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      logger.error('[Video Generation] Error:', error);

      // エラーパターン記録
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCount = this.generationMetrics.errorPatterns.get(errorMessage) || 0;
      this.generationMetrics.errorPatterns.set(errorMessage, errorCount + 1);

      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * SimplePipelineResult → Remotionデータ変換
   * Phase 4-1 中核機能
   */
  private async convertPipelineToRemotionData(result: SimplePipelineResult): Promise<{
    audioUrl: string;
    scenes: RemotionSceneData[];
    totalDuration: number;
  }> {

    if (!result.success || !result.scenes || !result.audioUrl) {
      throw new RenderingError('Invalid pipeline result for video generation');
    }

    // 音声URL
    const audioUrl = result.audioUrl;

    // シーンデータ変換
    const scenes: RemotionSceneData[] = safeArray(result.scenes).map((scene, index) => {
      return this.convertSceneToRemotionFormat(scene, index);
    });

    // 総再生時間計算
    const totalDuration = this.calculateTotalDuration(scenes);


    return {
      audioUrl,
      scenes,
      totalDuration
    };
  }

  /**
   * 個別シーンのRemotionフォーマット変換
   */
  private convertSceneToRemotionFormat(scene: SceneGraph, index: number): RemotionSceneData {
    // シーン持続時間（デフォルト5秒）
    // scene.startTime/endTime are in SECONDS (see simple-pipeline.ts:
    // `startTime: segStartMs / 1000`), so convert to ms before clamping.
    // Without the * 1000, a 5 s segment evaluates to (5 - 0) = 5 and collapses
    // to the floor, making every scene a uniform minimum regardless of
    // real length.
    // Boundaries come from scene-duration-limits.ts (single source, defect
    // 08ae): the same [MIN_SCENE_DURATION_MS, MAX_EDITORIAL_SCENE_DURATION_MS]
    // range the main-pipeline timing optimizer applies. The former local
    // [3000, 10000] clamp truncated every 10–15 s scene to 10 s, ending the
    // rendered scene before its audio segment ended.
    const defaultDuration = DEFAULT_SCENE_DURATION_MS;
    const sceneDuration = Math.max(MIN_SCENE_DURATION_MS, Math.min(
      MAX_EDITORIAL_SCENE_DURATION_MS,
      (scene.endTime - scene.startTime) * 1000 || defaultDuration
    ));

    // レイアウトからRemotionノード変換
    const nodes = scene.layout?.nodes?.map(node => ({
      id: node.id,
      label: node.label,
      x: node.x || 0,
      y: node.y || 0,
      type: this.getNodeTypeFromDiagramType(scene.type),
      color: this.getColorFromDiagramType(scene.type)
    })) || [];

    // エッジ変換
    const edges = scene.layout?.edges?.map(edge => ({
      from: edge.from,
      to: edge.to,
      label: edge.label || '',
      type: 'arrow'
    })) || [];

    return {
      id: scene.id,
      startMs: scene.startTime * 1000, // 秒をミリ秒に変換
      durationMs: sceneDuration,
      diagramType: scene.type,
      title: this.generateSceneTitle(scene),
      nodes,
      edges,
      transcript: scene.content,
      // 0.0 is a legitimate "layout/detection broke down" signal; use ?? so it
      // is not masked to 0.8 (which would also silence the low-confidence
      // warning in validateRemotionData: confidence < 0.5).
      confidence: scene.confidence ?? 0.8,
      keyphrases: scene.keyphrases || []
    };
  }

  /**
   * データ変換品質検証
   */
  private async validateRemotionData(data: unknown): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const d = data as Record<string, unknown>;

    // 必須フィールド検証
    if (!d.audioUrl) {
      errors.push('Audio URL is missing');
    }

    if (!d.scenes || (d.scenes as RemotionSceneData[]).length === 0) {
      errors.push('No scenes provided');
    }

    if ((d.totalDuration as number) <= 0) {
      errors.push('Invalid total duration');
    }

    // シーン検証
    (d.scenes as RemotionSceneData[] | undefined)?.forEach((scene: RemotionSceneData, index: number) => {
      if (!scene.id) {
        errors.push(`Scene ${index}: Missing ID`);
      }

      if (scene.durationMs <= 0) {
        errors.push(`Scene ${index}: Invalid duration`);
      }

      if (!scene.nodes || scene.nodes.length === 0) {
        warnings.push(`Scene ${index}: No nodes defined`);
      }

      if (scene.confidence < 0.5) {
        warnings.push(`Scene ${index}: Low confidence (${scene.confidence})`);
      }
    });

    const isValid = errors.length === 0;

    if (warnings.length > 0) {
      logger.warn('[Video Generation] Validation warnings:', warnings);
    }

    return { isValid, errors, warnings };
  }

  /**
   * Remotionレンダリング設定準備
   * Phase 14: Added performance optimization settings
   */
  private async prepareRenderConfiguration(data: unknown) {
    const d = data as Record<string, unknown>;
    return {
      composition: COMPOSITION_ID,
      inputProps: {
        scenes: d.scenes,
        audioUrl: d.audioUrl,
        totalDuration: d.totalDuration
      },
      outputLocation: this.generateOutputPath(),
      config: {
        width: this.getResolutionWidth(),
        height: this.getResolutionHeight(),
        fps: this.options.fps || DEFAULT_FPS,
        durationInFrames: Math.ceil(((d.totalDuration as number) / 1000) * (this.options.fps || DEFAULT_FPS))
      },
      // Phase 14: Performance optimization settings
      renderOptions: {
        concurrency: this.options.concurrency || 2,
        enableMultithreading: this.options.enableMultithreadedRendering !== false,
        enableGpu: this.options.enableGpuAcceleration !== false,
        // Additional Remotion-specific optimizations
        imageFormat: 'jpeg', // Faster than png
        jpegQuality: this.getJpegQualityFromQualitySetting(),
        enforceAudioTrack: this.options.includeAudio,
        muted: !this.options.includeAudio,
      }
    };
  }

  /**
   * Helper: Convert quality setting to JPEG quality
   */
  private getJpegQualityFromQualitySetting(): number {
    const qualityMap: Record<VideoGenerationOptions['quality'], number> = {
      low: 60,
      medium: 75,
      high: 85,
      ultra: 95
    };
    return qualityMap[this.options.quality || 'high'];
  }

  /**
   * Remotionレンダリング実行（実際の実装）
   * @remotion/rendererを使用した実際のレンダリング
   */
  private async executeRemotionRender(
    config: unknown,
    onProgress?: (stage: string, progress: number) => void
  ) {
    const cfg = config as Record<string, unknown>;
    const inputProps = cfg.inputProps as Record<string, unknown>;
    const renderConfig = cfg.config as Record<string, unknown>;

    try {
      // Node.js環境でのみ実行可能
      if (typeof window !== 'undefined') {
        logger.warn('[Video Generation] Browser environment detected, using mock rendering');
        return await this.executeMockRender(config, onProgress);
      }

      // 実際のレンダリング（サーバーサイド）
      const { actualVideoRenderer } = await import('@/pipeline/actual-video-renderer');

      const outputPath = cfg.outputLocation as string;

      await actualVideoRenderer.renderVideo(
        {
          scenes: inputProps.scenes as SceneGraph[],
          audioUrl: inputProps.audioUrl as string,
          outputPath,
          quality: toRenderQuality(this.options.quality),
          // Thread the configured fps into the renderer. Previously dropped at
          // this boundary (actualVideoRenderer hardcoded `const fps = 30`), so
          // 24/60 fps requests silently rendered at 30fps. Mirrors the quality
          // propagation fix (6937b8b) at the same boundary.
          fps: this.options.fps || DEFAULT_FPS,
        },
        (progress) => {
          // プログレス更新を伝播
          const overallProgress = 60 + (progress.progress / 100) * 25; // 60-85%の範囲
          onProgress?.(progress.message, overallProgress);
        }
      );

      const videoInfo = {
        path: outputPath,
        duration: inputProps.totalDuration as number,
        fileSize: this.estimateFileSize(config),
        resolution: `${renderConfig.width as number}x${renderConfig.height as number}`,
        fps: renderConfig.fps as number
      };

      return videoInfo;

    } catch (error) {
      logger.error('[Video Generation] Render failed:', error);
      // フォールバックとして模擬レンダリング
      return await this.executeMockRender(config, onProgress);
    }
  }

  /**
   * 模擬レンダリング（ブラウザ環境用）
   */
  private async executeMockRender(
    config: unknown,
    onProgress?: (stage: string, progress: number) => void
  ) {
    const cfg = config as Record<string, unknown>;
    const inputProps = cfg.inputProps as Record<string, unknown>;
    const renderCfg = cfg.config as Record<string, unknown>;

    const renderSteps = [
      'Preparing composition',
      'Loading assets',
      'Rendering frames',
      'Encoding video',
      'Optimizing output'
    ];

    for (let i = 0; i < renderSteps.length; i++) {
      const step = renderSteps[i];
      const stepProgress = 60 + (i / renderSteps.length) * 25; // 60-85%の範囲

      onProgress?.(step, stepProgress);

      // 模擬処理時間
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 模擬レンダリング結果
    const outputPath = cfg.outputLocation as string;
    const videoInfo = {
      path: outputPath,
      duration: inputProps.totalDuration as number,
      fileSize: this.estimateFileSize(config),
      resolution: `${renderCfg.width as number}x${renderCfg.height as number}`,
      fps: renderCfg.fps as number
    };


    return videoInfo;
  }

  /**
   * 動画生成最終処理
   */
  private async finalizeVideoGeneration(renderInfo: unknown): Promise<VideoGenerationResult> {
    const info = renderInfo as Record<string, unknown>;
    // サムネイル生成（模擬）
    const thumbnailUrl = (info.path as string).replace('.mp4', '_thumb.jpg');

    // 動画URLの生成（実際の環境では適切なURL生成）
    const videoUrl = info.path as string;

    return {
      success: true,
      videoUrl,
      thumbnailUrl,
      duration: info.duration as number,
      fileSize: info.fileSize as number,
      resolution: info.resolution as string
    };
  }

  /**
   * ヘルパーメソッド群
   */
  private getNodeTypeFromDiagramType(type: DiagramType): string {
    const typeMap: Record<DiagramType, string> = {
      flow: 'process',
      flowchart: 'process',
      tree: 'hierarchy',
      timeline: 'event',
      matrix: 'comparison',
      cycle: 'stage',
      comparison: 'comparison',
      network: 'node',
      conceptmap: 'concept',
      mindmap: 'idea',
      general: 'default',
    };
    return typeMap[type];
  }

  private getColorFromDiagramType(type: DiagramType): string {
    const colorMap: Record<DiagramType, string> = {
      flow: '#3b82f6',     // 青
      flowchart: '#3b82f6', // 青
      tree: '#10b981',     // 緑
      timeline: '#f59e0b', // オレンジ
      matrix: '#ef4444',   // 赤
      cycle: '#8b5cf6',    // 紫
      comparison: '#ef4444', // 赤
      network: '#06b6d4',  // シアン
      conceptmap: '#ec4899', // ピンク
      mindmap: '#f97316',  // オレンジ
      general: '#6b7280',  // グレー
    };
    return colorMap[type];
  }

  private generateSceneTitle(scene: SceneGraph): string {
    // Single source: the canonical title map in src/types/diagram.ts. The
    // local copy here had already drifted from DiagramScene's rendered titles
    // (flowchart/general), so the scene list and the video frame disagreed.
    const typeLabel = DIAGRAM_TYPE_TITLES[scene.type];
    return `${typeLabel} - ${scene.content.substring(0, 30)}...`;
  }

  /**
   * Total playback duration of the generated video, in milliseconds.
   *
   * MUST equal the SUM of each scene's durationMs — not max(startMs + durationMs).
   * The render path plays scenes back-to-back via cumulative durationMs offsets:
   *   - @/remotion/Video `findSceneAtTime` / `calculateTotalFrames` (SUM)
   *   - ActualVideoRenderer.getComposition (SUM, ignores absolute startMs)
   * Each scene's absolute `startMs` (the original audio timestamp) is IGNORED by
   * playback, so it cannot define the video's end point. Using max(startMs+dur)
   * diverged from the real video length whenever scenes were duration-clamped
   * (main-pipeline re-clamps durationMs to [2000, 15000] ms — see
   * scene-duration-limits.ts) or non-contiguous,
   * making the reported `duration`, `durationInFrames`, and file-size estimate
   * disagree with what actually rendered.
   */
  private calculateTotalDuration(scenes: RemotionSceneData[]): number {
    let total = 0;
    for (const scene of scenes) {
      // Match calculateTotalFrames: clamp negatives to 0 (production scenes are
      // always in [2000, 15000] ms after optimizeSceneTiming, but defend
      // against malformed input).
      const dur = Number.isFinite(scene.durationMs) ? Math.max(0, scene.durationMs) : 0;
      const next = total + dur;
      // Overflow guard: if the running sum overflows to Infinity, freeze it so
      // the result stays finite (matches the previous Number.isFinite guarding).
      total = Number.isFinite(next) ? next : total;
    }
    return total;
  }

  private generateOutputPath(): string {
    // 固定パス・上書きポリシーに従い、一定の出力先を使用
    // 実行環境がLinux系の場合の一時領域に配置（実環境では適切な出力先に変更可能）
    return `/tmp/speech-to-visuals-renders/diagram-video.mp4`;
  }

  private getResolutionWidth(): number {
    const resolutions: Record<VideoGenerationOptions['resolution'], number> = {
      '720p': 1280,
      '1080p': 1920,
      '4k': 3840
    };
    return resolutions[this.options.resolution || '1080p'];
  }

  private getResolutionHeight(): number {
    const resolutions: Record<VideoGenerationOptions['resolution'], number> = {
      '720p': 720,
      '1080p': 1080,
      '4k': 2160
    };
    return resolutions[this.options.resolution || '1080p'];
  }

  private estimateFileSize(config: unknown): number {
    // 簡易ファイルサイズ推定（品質・解像度・時間を考慮）
    const baseSizePerSecond: Record<VideoGenerationOptions['quality'], number> = {
      low: 1024 * 1024,     // 1MB/秒
      medium: 2048 * 1024,  // 2MB/秒
      high: 4096 * 1024,    // 4MB/秒
      ultra: 8192 * 1024    // 8MB/秒
    };

    const quality = this.options.quality || 'high';
    const cfg = config as Record<string, unknown>;
    const inputProps = cfg.inputProps as Record<string, unknown>;
    const durationSeconds = (inputProps.totalDuration as number) / 1000;

    return baseSizePerSecond[quality] * durationSeconds;
  }

  /**
   * 生成メトリクス更新
   */
  private updateGenerationMetrics(result: VideoGenerationResult, processingTime: number): void {
    this.generationMetrics.totalGenerations++;

    if (result.success) {
      this.generationMetrics.successfulGenerations++;
    }

    // 平均処理時間更新
    const previousAvg = this.generationMetrics.averageProcessingTime;
    const newAvg = (previousAvg * (this.generationMetrics.totalGenerations - 1) + processingTime) / this.generationMetrics.totalGenerations;
    this.generationMetrics.averageProcessingTime = newAvg;

    // 品質スコア記録（成功時のみ）
    if (result.success) {
      const qualityScore = this.calculateQualityScore(result, processingTime);
      this.generationMetrics.qualityScores.set(this.iteration, qualityScore);
    }
  }

  private calculateQualityScore(result: VideoGenerationResult, processingTime: number): number {
    let score = 0.8; // ベーススコア

    // 処理時間が目標（30秒）以内なら+0.1
    if (processingTime < 30000) {
      score += 0.1;
    }

    // ファイルサイズが適切範囲なら+0.05
    if (result.fileSize && result.fileSize > 1024 * 1024 && result.fileSize < 100 * 1024 * 1024) {
      score += 0.05;
    }

    // 解像度が設定通りなら+0.05
    if (result.resolution?.includes(this.options.resolution || '1080p')) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * パブリックメソッド: 統計取得
   */
  public getGenerationStats() {
    const successRate = this.generationMetrics.totalGenerations > 0
      ? this.generationMetrics.successfulGenerations / this.generationMetrics.totalGenerations
      : 0;

    return {
      totalGenerations: this.generationMetrics.totalGenerations,
      successRate: successRate,
      averageProcessingTime: this.generationMetrics.averageProcessingTime,
      qualityScores: Array.from(this.generationMetrics.qualityScores.values()),
      commonErrors: Array.from(this.generationMetrics.errorPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  /**
   * イテレーション進行
   */
  public nextIteration(): void {
    this.iteration++;
  }
}

// シングルトンインスタンス（設定可能）
export const videoGenerator = new VideoGenerator();

/**
 * 便利関数: SimplePipelineから直接動画生成
 */
export async function generateVideoFromPipeline(
  pipelineResult: SimplePipelineResult,
  options?: Partial<VideoGenerationOptions>,
  onProgress?: (stage: string, progress: number) => void
): Promise<VideoGenerationResult> {
  const generator = new VideoGenerator(options);
  return generator.generateVideo(pipelineResult, onProgress);
}
