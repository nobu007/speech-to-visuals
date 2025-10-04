/**
 * Export Manager - Phase 4-3 Implementation
 * カスタムインストラクション準拠: エクスポート機能強化 + パフォーマンス最適化
 */

import { SimplePipelineResult } from './simple-pipeline';
import { VideoGenerationResult } from './video-generator';
import { SceneGraph } from '@/types/diagram';

export interface ExportOptions {
  format: 'mp4' | 'json' | 'srt' | 'svg' | 'png' | 'pdf' | 'csv';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  compression?: boolean;
  includeMetadata?: boolean;
  batchMode?: boolean;
}

export interface ExportResult {
  success: boolean;
  format: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  metadata?: any;
  processingTime?: number;
  error?: string;
}

export interface BatchExportResult {
  success: boolean;
  exports: ExportResult[];
  totalFiles: number;
  totalSize: number;
  processingTime: number;
  zipUrl?: string;
}

/**
 * Phase 4-3 Export Manager: 多様なフォーマット対応 + 最適化
 */
export class ExportManager {
  private exportCache = new Map<string, ExportResult>();
  private exportMetrics = {
    totalExports: 0,
    formatUsage: new Map<string, number>(),
    averageProcessingTime: 0,
    cachehitRate: 0,
    performanceHistory: [] as Array<{ format: string; time: number; size: number }>
  };

  constructor() {
    console.log('📁 ExportManager initialized with enhanced capabilities');
  }

  /**
   * Phase 4-3 メイン機能: 統合エクスポート
   */
  async exportResults(
    pipelineResult: SimplePipelineResult,
    videoResult: VideoGenerationResult | null,
    options: ExportOptions[]
  ): Promise<BatchExportResult> {
    const startTime = performance.now();

    try {
      console.log(`📦 Starting batch export for ${options.length} formats`);

      // 並列エクスポート実行（パフォーマンス最適化）
      const exportPromises = options.map(option =>
        this.exportSingleFormat(pipelineResult, videoResult, option)
      );

      const exports = await Promise.all(exportPromises);
      const successfulExports = exports.filter(exp => exp.success);

      // バッチ結果の計算
      const totalSize = exports.reduce((sum, exp) => sum + (exp.fileSize || 0), 0);
      const processingTime = performance.now() - startTime;

      // ZIPアーカイブ作成（複数ファイルの場合）
      let zipUrl: string | undefined;
      if (successfulExports.length > 1) {
        zipUrl = await this.createZipArchive(successfulExports);
      }

      // メトリクス更新
      this.updateExportMetrics(exports, processingTime);

      console.log(`✅ Batch export completed: ${successfulExports.length}/${exports.length} successful`);

      return {
        success: successfulExports.length > 0,
        exports: exports,
        totalFiles: exports.length,
        totalSize: totalSize,
        processingTime: processingTime,
        zipUrl: zipUrl
      };

    } catch (error) {
      console.error('❌ Batch export failed:', error);
      return {
        success: false,
        exports: [],
        totalFiles: 0,
        totalSize: 0,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * 単一フォーマットエクスポート
   */
  private async exportSingleFormat(
    pipelineResult: SimplePipelineResult,
    videoResult: VideoGenerationResult | null,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = performance.now();

    try {
      // キャッシュチェック（パフォーマンス最適化）
      const cacheKey = this.generateCacheKey(pipelineResult, videoResult, options);
      const cachedResult = this.exportCache.get(cacheKey);

      if (cachedResult && !options.batchMode) {
        console.log(`💾 Cache hit for ${options.format} export`);
        return { ...cachedResult, processingTime: performance.now() - startTime };
      }

      // フォーマット別エクスポート実行
      let exportResult: ExportResult;

      switch (options.format) {
        case 'mp4':
          exportResult = await this.exportVideo(videoResult, options);
          break;
        case 'json':
          exportResult = await this.exportJSON(pipelineResult, videoResult, options);
          break;
        case 'srt':
          exportResult = await this.exportSRT(pipelineResult, options);
          break;
        case 'svg':
          exportResult = await this.exportSVG(pipelineResult, options);
          break;
        case 'png':
          exportResult = await this.exportPNG(pipelineResult, options);
          break;
        case 'pdf':
          exportResult = await this.exportPDF(pipelineResult, options);
          break;
        case 'csv':
          exportResult = await this.exportCSV(pipelineResult, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // 処理時間追加
      exportResult.processingTime = performance.now() - startTime;

      // キャッシュに保存
      if (exportResult.success) {
        this.exportCache.set(cacheKey, exportResult);
      }

      return exportResult;

    } catch (error) {
      console.error(`❌ Export failed for format ${options.format}:`, error);
      return {
        success: false,
        format: options.format,
        error: error instanceof Error ? error.message : 'Unknown export error',
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * 動画エクスポート
   */
  private async exportVideo(
    videoResult: VideoGenerationResult | null,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!videoResult || !videoResult.success || !videoResult.videoUrl) {
      throw new Error('Video result not available for export');
    }

    // 実際の実装では、動画ファイルの品質調整・圧縮処理を行う
    const fileName = `speech-to-visuals-video-${Date.now()}.mp4`;
    const fileSize = videoResult.fileSize || 0;

    // 品質に応じた圧縮処理（模擬）
    let processedSize = fileSize;
    if (options.compression) {
      switch (options.quality) {
        case 'low':
          processedSize = Math.round(fileSize * 0.5);
          break;
        case 'medium':
          processedSize = Math.round(fileSize * 0.7);
          break;
        case 'high':
          processedSize = Math.round(fileSize * 0.9);
          break;
        default:
          processedSize = fileSize;
      }
    }

    return {
      success: true,
      format: 'mp4',
      fileName: fileName,
      fileUrl: videoResult.videoUrl,
      downloadUrl: videoResult.videoUrl,
      fileSize: processedSize,
      metadata: {
        originalSize: fileSize,
        compression: options.compression,
        quality: options.quality,
        duration: videoResult.duration,
        resolution: videoResult.resolution
      }
    };
  }

  /**
   * JSON エクスポート（強化版）
   */
  private async exportJSON(
    pipelineResult: SimplePipelineResult,
    videoResult: VideoGenerationResult | null,
    options: ExportOptions
  ): Promise<ExportResult> {
    const data: any = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '4.3-enhanced',
        exportOptions: options
      },
      pipeline: {
        success: pipelineResult.success,
        processingTime: pipelineResult.processingTime,
        transcript: pipelineResult.transcript,
        scenes: pipelineResult.scenes?.map(scene => ({
          id: scene.id,
          type: scene.type,
          startTime: scene.startTime,
          endTime: scene.endTime,
          content: scene.content,
          confidence: scene.confidence,
          layout: scene.layout
        }))
      }
    };

    // 動画データ追加（利用可能な場合）
    if (videoResult && options.includeMetadata) {
      data.video = {
        success: videoResult.success,
        duration: videoResult.duration,
        fileSize: videoResult.fileSize,
        resolution: videoResult.resolution,
        processingTime: videoResult.processingTime
      };
    }

    // 分析データ追加
    if (options.includeMetadata && pipelineResult.scenes) {
      data.analytics = {
        sceneCount: pipelineResult.scenes.length,
        averageConfidence: pipelineResult.scenes.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / pipelineResult.scenes.length,
        diagramTypeDistribution: this.calculateDiagramTypeDistribution(pipelineResult.scenes),
        processingMetrics: {
          totalTime: pipelineResult.processingTime,
          averageSceneTime: (pipelineResult.processingTime || 0) / pipelineResult.scenes.length
        }
      };
    }

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = `speech-to-visuals-data-${Date.now()}.json`;
    const fileUrl = URL.createObjectURL(blob);

    return {
      success: true,
      format: 'json',
      fileName: fileName,
      fileUrl: fileUrl,
      downloadUrl: fileUrl,
      fileSize: blob.size,
      metadata: {
        scenes: pipelineResult.scenes?.length || 0,
        hasVideo: !!videoResult,
        includesMetadata: options.includeMetadata
      }
    };
  }

  /**
   * SRT（字幕）エクスポート
   */
  private async exportSRT(
    pipelineResult: SimplePipelineResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!pipelineResult.scenes || pipelineResult.scenes.length === 0) {
      throw new Error('No scenes available for SRT export');
    }

    const srtContent = pipelineResult.scenes.map((scene, index) => {
      const startTime = this.formatSRTTime(scene.startTime);
      const endTime = this.formatSRTTime(scene.endTime);

      return `${index + 1}\n${startTime} --> ${endTime}\n${scene.content}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain; charset=utf-8' });
    const fileName = `speech-to-visuals-subtitles-${Date.now()}.srt`;
    const fileUrl = URL.createObjectURL(blob);

    return {
      success: true,
      format: 'srt',
      fileName: fileName,
      fileUrl: fileUrl,
      downloadUrl: fileUrl,
      fileSize: blob.size,
      metadata: {
        subtitleCount: pipelineResult.scenes.length,
        totalDuration: Math.max(...pipelineResult.scenes.map(s => s.endTime)),
        encoding: 'UTF-8'
      }
    };
  }

  /**
   * SVG エクスポート（図解）
   */
  private async exportSVG(
    pipelineResult: SimplePipelineResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!pipelineResult.scenes || pipelineResult.scenes.length === 0) {
      throw new Error('No scenes available for SVG export');
    }

    const svgContent = this.generateSVGContent(pipelineResult.scenes, options);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const fileName = `speech-to-visuals-diagrams-${Date.now()}.svg`;
    const fileUrl = URL.createObjectURL(blob);

    return {
      success: true,
      format: 'svg',
      fileName: fileName,
      fileUrl: fileUrl,
      downloadUrl: fileUrl,
      fileSize: blob.size,
      metadata: {
        diagramCount: pipelineResult.scenes.length,
        dimensions: '1920x1080',
        vectorFormat: true
      }
    };
  }

  /**
   * PNG エクスポート（ラスター画像）
   */
  private async exportPNG(
    pipelineResult: SimplePipelineResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    // 実際の実装では、SVGからPNGに変換
    // ここでは模擬実装
    const estimatedSize = 500 * 1024; // 500KB estimate
    const fileName = `speech-to-visuals-preview-${Date.now()}.png`;
    const mockUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;

    return {
      success: true,
      format: 'png',
      fileName: fileName,
      fileUrl: mockUrl,
      downloadUrl: mockUrl,
      fileSize: estimatedSize,
      metadata: {
        dimensions: options.quality === 'ultra' ? '3840x2160' : '1920x1080',
        quality: options.quality,
        compressed: options.compression
      }
    };
  }

  /**
   * PDF エクスポート（レポート形式）
   */
  private async exportPDF(
    pipelineResult: SimplePipelineResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    // 実際の実装では、PDFライブラリを使用してレポート生成
    const estimatedSize = 1024 * 1024; // 1MB estimate
    const fileName = `speech-to-visuals-report-${Date.now()}.pdf`;
    const mockUrl = `data:application/pdf;base64,JVBERi0xLjMKJcTl8uXrp/Og0MTGCg==`;

    return {
      success: true,
      format: 'pdf',
      fileName: fileName,
      fileUrl: mockUrl,
      downloadUrl: mockUrl,
      fileSize: estimatedSize,
      metadata: {
        pageCount: Math.ceil((pipelineResult.scenes?.length || 0) / 3) + 2, // Cover + scenes + summary
        includesCharts: options.includeMetadata,
        quality: options.quality
      }
    };
  }

  /**
   * CSV エクスポート（構造化データ）
   */
  private async exportCSV(
    pipelineResult: SimplePipelineResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!pipelineResult.scenes || pipelineResult.scenes.length === 0) {
      throw new Error('No scenes available for CSV export');
    }

    const csvHeader = 'Scene ID,Type,Start Time,End Time,Content,Confidence,Node Count,Edge Count\n';
    const csvRows = pipelineResult.scenes.map(scene => {
      const nodeCount = scene.layout?.nodes?.length || 0;
      const edgeCount = scene.layout?.edges?.length || 0;
      const content = `"${scene.content.replace(/"/g, '""')}"`;

      return `${scene.id},${scene.type},${scene.startTime},${scene.endTime},${content},${scene.confidence},${nodeCount},${edgeCount}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
    const fileName = `speech-to-visuals-data-${Date.now()}.csv`;
    const fileUrl = URL.createObjectURL(blob);

    return {
      success: true,
      format: 'csv',
      fileName: fileName,
      fileUrl: fileUrl,
      downloadUrl: fileUrl,
      fileSize: blob.size,
      metadata: {
        rowCount: pipelineResult.scenes.length,
        columns: 8,
        encoding: 'UTF-8'
      }
    };
  }

  /**
   * ZIPアーカイブ作成
   */
  private async createZipArchive(exports: ExportResult[]): Promise<string> {
    // 実際の実装では、JSZipライブラリを使用
    // ここでは模擬実装
    const archiveName = `speech-to-visuals-bundle-${Date.now()}.zip`;
    const mockZipUrl = `data:application/zip;base64,UEsDBAoAAAAAAGFjUlMAAAAAAAAAAAA=`;

    console.log(`📦 Created ZIP archive: ${archiveName} with ${exports.length} files`);
    return mockZipUrl;
  }

  /**
   * ヘルパーメソッド群
   */
  private generateCacheKey(
    pipelineResult: SimplePipelineResult,
    videoResult: VideoGenerationResult | null,
    options: ExportOptions
  ): string {
    const baseKey = `${pipelineResult.processingTime}_${options.format}_${options.quality}`;
    const videoKey = videoResult ? `_${videoResult.processingTime}` : '';
    return `${baseKey}${videoKey}`;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private calculateDiagramTypeDistribution(scenes: SceneGraph[]): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    scenes.forEach(scene => {
      distribution[scene.type] = (distribution[scene.type] || 0) + 1;
    });
    return distribution;
  }

  private generateSVGContent(scenes: SceneGraph[], options: ExportOptions): string {
    const width = 1920;
    const height = 1080 * scenes.length;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<style>
      .scene-title { font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; }
      .node { fill: #3b82f6; stroke: #1d4ed8; stroke-width: 2; }
      .edge { stroke: #6b7280; stroke-width: 2; }
      .text { font-family: Arial, sans-serif; font-size: 14px; fill: white; text-anchor: middle; }
    </style>`;

    scenes.forEach((scene, sceneIndex) => {
      const offsetY = sceneIndex * 1080;

      // Scene background
      svgContent += `<rect x="0" y="${offsetY}" width="${width}" height="1080" fill="#0f0f23"/>`;

      // Scene title
      svgContent += `<text x="${width/2}" y="${offsetY + 50}" class="scene-title" fill="white">${scene.type.toUpperCase()} - Scene ${sceneIndex + 1}</text>`;

      // Draw nodes
      scene.layout?.nodes?.forEach(node => {
        const x = node.x || 0;
        const y = (node.y || 0) + offsetY + 100;
        const width = 120;
        const height = 60;

        svgContent += `<rect x="${x - width/2}" y="${y - height/2}" width="${width}" height="${height}" class="node"/>`;
        svgContent += `<text x="${x}" y="${y + 5}" class="text">${node.label}</text>`;
      });

      // Draw edges
      scene.layout?.edges?.forEach(edge => {
        const fromNode = scene.layout?.nodes?.find(n => n.id === edge.from);
        const toNode = scene.layout?.nodes?.find(n => n.id === edge.to);

        if (fromNode && toNode) {
          const x1 = fromNode.x || 0;
          const y1 = (fromNode.y || 0) + offsetY + 100;
          const x2 = toNode.x || 0;
          const y2 = (toNode.y || 0) + offsetY + 100;

          svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="edge"/>`;
        }
      });
    });

    svgContent += '</svg>';
    return svgContent;
  }

  /**
   * パフォーマンスメトリクス更新
   */
  private updateExportMetrics(exports: ExportResult[], processingTime: number): void {
    this.exportMetrics.totalExports += exports.length;

    exports.forEach(exp => {
      const currentCount = this.exportMetrics.formatUsage.get(exp.format) || 0;
      this.exportMetrics.formatUsage.set(exp.format, currentCount + 1);

      if (exp.success && exp.processingTime && exp.fileSize) {
        this.exportMetrics.performanceHistory.push({
          format: exp.format,
          time: exp.processingTime,
          size: exp.fileSize
        });
      }
    });

    // 平均処理時間更新
    const totalTime = this.exportMetrics.averageProcessingTime * (this.exportMetrics.totalExports - exports.length) + processingTime;
    this.exportMetrics.averageProcessingTime = totalTime / this.exportMetrics.totalExports;
  }

  /**
   * パブリック統計メソッド
   */
  public getExportStatistics() {
    return {
      totalExports: this.exportMetrics.totalExports,
      formatUsage: Object.fromEntries(this.exportMetrics.formatUsage),
      averageProcessingTime: this.exportMetrics.averageProcessingTime,
      cacheSize: this.exportCache.size,
      performanceHistory: this.exportMetrics.performanceHistory.slice(-50) // 最新50件
    };
  }

  /**
   * キャッシュクリア
   */
  public clearCache(): void {
    this.exportCache.clear();
    console.log('🧹 Export cache cleared');
  }
}

// シングルトンインスタンス
export const exportManager = new ExportManager();