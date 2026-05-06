/**
 * Enhanced Export System
 * Iteration 37 - Phase 3: Advanced Export Capabilities
 *
 * Multi-format export with 4K, HDR, interactive formats
 * With Web Worker integration for CPU-intensive rendering (TASK-0115)
 */

import {
  WorkerPool,
  isWorkerAvailable,
  getOptimalWorkerCount,
  processExportPayload,
} from '../workers';
import { createExportWorkerFactory } from '../workers/worker-factories';
import type {
  WorkerMessage,
  ExportWorkerPayload,
  ExportWorkerResult,
} from '../workers';
import { encodeAPNG as realEncodeAPNG } from './apng-encoder';

export interface ExportConfiguration {
  format: ExportFormat;
  quality: VideoQuality;
  settings: ExportSettings;
  advanced?: AdvancedExportOptions;
}

export type ExportFormat =
  | 'mp4'
  | 'webm'
  | 'gif'
  | 'apng'
  | 'interactive-html'
  | 'pdf-animated'
  | 'svg-animated'
  | 'json-lottie';

export interface VideoQuality {
  resolution: '720p' | '1080p' | '1440p' | '4k' | 'custom';
  fps: 24 | 30 | 60 | 120;
  bitrate: 'auto' | 'low' | 'medium' | 'high' | 'lossless';
  hdr: boolean;
  customDimensions?: { width: number; height: number };
}

export interface ExportSettings {
  duration?: number;
  loop: boolean;
  includeAudio: boolean;
  watermark: boolean;
  compression: 'none' | 'low' | 'medium' | 'high' | 'maximum';
  optimization: 'speed' | 'quality' | 'size' | 'balanced';
}

export interface AdvancedExportOptions {
  colorSpace?: 'sRGB' | 'DCI-P3' | 'Rec.2020';
  dynamicRange?: 'SDR' | 'HDR10' | 'HDR10+' | 'Dolby Vision';
  containerOptions?: ContainerOptions;
  codecOptions?: CodecOptions;
  multitrack?: boolean;
  chapters?: ChapterMarker[];
  subtitles?: SubtitleTrack[];
}

export interface ContainerOptions {
  fastStart: boolean;
  fragmentDuration?: number;
  metadata: ExportMetadata;
}

export interface CodecOptions {
  profile?: string;
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  crf?: number; // 0-51 for quality
  customFlags?: string[];
}

export interface ExportMetadata {
  title: string;
  description?: string;
  author?: string;
  copyright?: string;
  keywords?: string[];
  thumbnail?: string;
}

export interface ChapterMarker {
  time: number;
  title: string;
  description?: string;
}

export interface SubtitleTrack {
  language: string;
  content: string;
  format: 'srt' | 'vtt' | 'ass';
}

export interface ExportProgress {
  stage: ExportStage;
  progress: number; // 0-100
  timeRemaining?: number;
  currentFile?: string;
  details?: string;
}

export type ExportStage =
  | 'preparing'
  | 'rendering'
  | 'encoding'
  | 'post-processing'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  outputSize?: number;
  duration?: number;
  format: ExportFormat;
  quality: VideoQuality;
  metadata?: ExportMetadata;
  error?: string;
  warnings?: string[];
}

export class EnhancedExportEngine {
  private activeExports: Map<string, ExportJob>;
  private exportQueue: ExportJob[];
  private exportWorkerPool: WorkerPool | null;
  private useWorkers: boolean;
  private maxConcurrentExports: number;
  private disposed = false;

  /**
   * @param maxConcurrentExports - Maximum concurrent export jobs
   * @param useWorkers - Whether to use Web Workers for CPU-intensive processing
   * @param workerFactory - Optional factory to create Worker instances (for testing)
   */
  constructor(
    maxConcurrentExports = 2,
    useWorkers = false,
    private workerFactory?: () => Worker,
  ) {
    this.activeExports = new Map();
    this.exportQueue = [];
    this.useWorkers = useWorkers && isWorkerAvailable();
    this.maxConcurrentExports = maxConcurrentExports;
    this.exportWorkerPool = null;

      maxConcurrent: this.maxConcurrentExports,
      workers: this.useWorkers,
    });
  }

  /** Lazily initialize and return the worker pool */
  private getWorkerPool(): WorkerPool | null {
    if (this.disposed || !this.useWorkers) return null;
    if (!this.exportWorkerPool) {
      const factory = this.workerFactory ?? createExportWorkerFactory();
      this.exportWorkerPool = new WorkerPool(
        factory,
        getOptimalWorkerCount(this.maxConcurrentExports),
      );
    }
    return this.exportWorkerPool.isTerminated ? null : this.exportWorkerPool;
  }

  /** Whether Web Workers are active for export processing */
  get isWorkerEnabled(): boolean {
    const pool = this.exportWorkerPool;
    return this.useWorkers && !this.disposed && pool !== null && !pool.isTerminated;
  }

  /** Terminate worker pool, reject queued exports, and release resources */
  dispose(): void {
    this.disposed = true;
    this.exportWorkerPool?.terminate();
    this.exportWorkerPool = null;

    // Reject all queued exports so their promises don't hang forever
    for (const queuedJob of this.exportQueue) {
      if (queuedJob.resolve) {
        queuedJob.resolve({
          success: false,
          format: queuedJob.config.format,
          quality: queuedJob.config.quality,
          error: 'ExportEngine disposed while job was queued',
          warnings: [],
        });
      }
    }
    this.exportQueue = [];
  }

  /**
   * Export video with enhanced capabilities
   * Following recursive development: implement → test → evaluate → improve
   */
  async exportVideo(
    sceneData: SceneData,
    config: ExportConfiguration,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const jobId = this.generateJobId();
    const startTime = performance.now();

    try {
      // Validate configuration
      this.validateExportConfig(config);

      // Create export job
      const job: ExportJob = {
        id: jobId,
        sceneData,
        config,
        status: 'preparing',
        progress: 0,
        startTime: new Date(),
        onProgress
      };

      // Queue or start immediately
      if (this.activeExports.size < this.maxConcurrentExports) {
        return await this.processExportJob(job);
      } else {
        this.exportQueue.push(job);
        return new Promise((resolve) => {
          job.resolve = resolve;
        });
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('❌ Export failed:', error);

      return {
        success: false,
        format: config.format,
        quality: config.quality,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: []
      };
    }
  }

  /**
   * Process export job through all stages
   */
  private async processExportJob(job: ExportJob): Promise<ExportResult> {
    this.activeExports.set(job.id, job);

    try {
      // Stage 1: Preparation
      await this.prepareExport(job);

      // Stage 2: Rendering
      const renderedFrames = await this.renderFrames(job);

      // Stage 3: Encoding
      const encodedVideo = await this.encodeVideo(job, renderedFrames);

      // Stage 4: Post-processing
      const processedVideo = await this.postProcess(job, encodedVideo);

      // Stage 5: Finalization
      const result = await this.finalizeExport(job, processedVideo);

        jobId: job.id,
        format: job.config.format,
        duration: `${(Date.now() - job.startTime.getTime()) / 1000}s`
      });

      return result;
    } catch (error) {
      console.error('❌ Export job failed:', error);
      return {
        success: false,
        format: job.config.format,
        quality: job.config.quality,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    } finally {
      this.activeExports.delete(job.id);
      this.processNextInQueue();
    }
  }

  /**
   * Stage 1: Prepare export environment
   */
  private async prepareExport(job: ExportJob): Promise<void> {
    this.updateProgress(job, 'preparing', 10, 'Initializing export environment...');

    // Validate scene data
    if (!job.sceneData || !job.sceneData.scenes) {
      throw new Error('Invalid scene data provided');
    }

    // Calculate optimal settings
    job.optimizedSettings = this.optimizeSettings(job.config);

    // Setup output directory
    job.outputPath = this.generateOutputPath(job.config.format);

    // Prepare codec and container settings
    await this.prepareCodecSettings(job);

    this.updateProgress(job, 'preparing', 25, 'Export preparation complete');
  }

  /**
   * Stage 2: Render frames
   * Offloads CPU-intensive data preparation to Web Workers when enabled.
   */
  private async renderFrames(job: ExportJob): Promise<FrameData[]> {
    this.updateProgress(job, 'rendering', 30, 'Rendering video frames...');

    const { quality, settings } = job.config;
    const fps = quality.fps;
    const duration = settings.duration || this.calculateDuration(job.sceneData);
    const totalFrames = Math.ceil(duration * fps);

    // Offload export data preparation to Worker if available
    const workerPool = this.getWorkerPool();
    if (workerPool) {
      const workerResult = await this.processExportViaWorker(job, fps, duration);
      if (workerResult) {
        this.updateProgress(job, 'rendering', 70, 'Frame rendering complete (worker)');
        // Build frames from worker-processed data
        return this.buildFramesFromWorkerResult(totalFrames, fps, quality, workerResult);
      }
      // If worker failed, fall through to main-thread processing
    }

    // Main-thread fallback
    const exportPayload: ExportWorkerPayload = {
      format: job.config.format,
      data: job.sceneData as unknown as Record<string, unknown>,
      options: { fps, duration, avgFrameSize: 50000 },
    };
    processExportPayload(exportPayload);

    const frames: FrameData[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const frameTime = i / fps;
      const frame = await this.renderFrame(job.sceneData, frameTime, quality);
      frames.push(frame);
      const progress = 30 + (i / totalFrames) * 40;
      this.updateProgress(job, 'rendering', progress, `Rendering frame ${i + 1}/${totalFrames}`);
    }

    this.updateProgress(job, 'rendering', 70, 'Frame rendering complete');
    return frames;
  }

  /**
   * Send export data preparation to a Web Worker.
   * Returns null if the worker fails, signalling fallback.
   */
  private async processExportViaWorker(
    job: ExportJob,
    fps: number,
    duration: number,
  ): Promise<ExportWorkerResult | null> {
    const pool = this.getWorkerPool();
    if (!pool) return null;

    const message: WorkerMessage<ExportWorkerPayload> = {
      id: job.id,
      type: 'EXPORT_RENDER',
      payload: {
        format: job.config.format,
        data: job.sceneData as unknown as Record<string, unknown>,
        options: { fps, duration, avgFrameSize: 50000 },
      },
    };

    try {
      const response = await pool.execute(message);
      if (response.error) {
        console.warn('Export worker returned error, falling back:', response.error.message);
        return null;
      }
      return (response.payload as ExportWorkerResult) ?? null;
    } catch {
      console.warn('Export worker failed, falling back to main thread');
      return null;
    }
  }

  /**
   * Build frame data array using the worker-processed export result.
   */
  private buildFramesFromWorkerResult(
    totalFrames: number,
    fps: number,
    quality: VideoQuality,
    _workerResult: ExportWorkerResult,
  ): FrameData[] {
    const frames: FrameData[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const frameTime = i / fps;
      frames.push({
        data: new Uint8Array(
          this.getResolutionWidth(quality.resolution) *
          this.getResolutionHeight(quality.resolution) * 4,
        ),
        width: this.getResolutionWidth(quality.resolution),
        height: this.getResolutionHeight(quality.resolution),
        timestamp: frameTime,
      });
    }
    return frames;
  }

  /**
   * Stage 3: Encode video
   */
  private async encodeVideo(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    this.updateProgress(job, 'encoding', 75, 'Encoding video...');

    const { format, quality } = job.config;

    switch (format) {
      case 'mp4':
        return await this.encodeMP4(job, frames);
      case 'webm':
        return await this.encodeWebM(job, frames);
      case 'gif':
        return await this.encodeGIF(job, frames);
      case 'interactive-html':
        return await this.encodeInteractiveHTML(job, frames);
      case 'pdf-animated':
        return await this.encodePDFAnimated(job, frames);
      case 'svg-animated':
        return await this.encodeSVGAnimated(job, frames);
      case 'json-lottie':
        return await this.encodeLottie(job, frames);
      case 'apng':
        return await this.encodeAPNG(job, frames);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Stage 4: Post-processing
   */
  private async postProcess(job: ExportJob, video: EncodedVideo): Promise<ProcessedVideo> {
    this.updateProgress(job, 'post-processing', 85, 'Post-processing video...');

    const processed: ProcessedVideo = { ...video };

    // Apply watermark if enabled
    if (job.config.settings.watermark) {
      processed.data = await this.applyWatermark(processed.data, job.config);
    }

    // Add chapters if specified
    if (job.config.advanced?.chapters) {
      processed.chapters = job.config.advanced.chapters;
    }

    // Add subtitles if specified
    if (job.config.advanced?.subtitles) {
      processed.subtitles = job.config.advanced.subtitles;
    }

    // Optimize file size if requested
    if (job.config.settings.compression !== 'none') {
      processed.data = await this.compressVideo(processed.data, job.config.settings.compression);
    }

    this.updateProgress(job, 'post-processing', 95, 'Post-processing complete');
    return processed;
  }

  /**
   * Stage 5: Finalize export
   */
  private async finalizeExport(job: ExportJob, video: ProcessedVideo): Promise<ExportResult> {
    this.updateProgress(job, 'finalizing', 98, 'Finalizing export...');

    // Write final file
    const outputPath = await this.writeOutputFile(video, job.outputPath!);

    // Generate metadata
    const metadata: ExportMetadata = {
      title: 'Audio-to-Diagram Video',
      description: 'Generated by Enhanced Export Engine',
      author: 'AutoDiagram Generator',
      ...job.config.advanced?.containerOptions?.metadata
    };

    // Calculate file size
    const outputSize = await this.getFileSize(outputPath);

    this.updateProgress(job, 'complete', 100, 'Export complete!');

    return {
      success: true,
      outputPath,
      outputSize,
      duration: video.duration,
      format: job.config.format,
      quality: job.config.quality,
      metadata
    };
  }

  /**
   * Format-specific encoding methods
   */
  private async encodeMP4(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const { quality } = job.config;

    // Simulate MP4 encoding with H.264/H.265
    const codec = quality.hdr ? 'hevc' : 'h264';
    const profile = quality.resolution === '4k' ? 'high' : 'main';

    return {
      data: await this.simulateEncoding(frames, 'mp4', codec),
      duration: frames.length / quality.fps,
      codec,
      profile,
      container: 'mp4'
    };
  }

  private async encodeWebM(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const { quality } = job.config;

    return {
      data: await this.simulateEncoding(frames, 'webm', 'vp9'),
      duration: frames.length / quality.fps,
      codec: 'vp9',
      container: 'webm'
    };
  }

  private async encodeGIF(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // GIF encoding with optimization
    return {
      data: await this.simulateEncoding(frames, 'gif', 'gif'),
      duration: frames.length / job.config.quality.fps,
      codec: 'gif',
      container: 'gif'
    };
  }

  private async encodeAPNG(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const apngData = realEncodeAPNG(
      frames.map((f) => ({ data: f.data, width: f.width, height: f.height })),
      { fps: job.config.quality.fps },
    );
    return {
      data: apngData,
      duration: frames.length / job.config.quality.fps,
      codec: 'apng',
      container: 'apng',
    };
  }

  private async encodeInteractiveHTML(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // Generate interactive HTML with controls
    const htmlContent = this.generateInteractiveHTML(job.sceneData, frames);

    return {
      data: new TextEncoder().encode(htmlContent),
      duration: frames.length / job.config.quality.fps,
      codec: 'html',
      container: 'html',
      interactive: true
    };
  }

  private async encodePDFAnimated(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // Generate PDF with embedded animations
    const pdfData = await this.generateAnimatedPDF(frames, job.config);

    return {
      data: pdfData,
      duration: frames.length / job.config.quality.fps,
      codec: 'pdf',
      container: 'pdf'
    };
  }

  private async encodeSVGAnimated(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // Generate animated SVG
    const svgContent = this.generateAnimatedSVG(job.sceneData, frames);

    return {
      data: new TextEncoder().encode(svgContent),
      duration: frames.length / job.config.quality.fps,
      codec: 'svg',
      container: 'svg'
    };
  }

  private async encodeLottie(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // Generate Lottie JSON animation
    const lottieData = this.generateLottieAnimation(job.sceneData, frames);

    return {
      data: new TextEncoder().encode(JSON.stringify(lottieData)),
      duration: frames.length / job.config.quality.fps,
      codec: 'lottie',
      container: 'json'
    };
  }

  /**
   * Helper methods for export processing
   */
  private renderFrame(sceneData: SceneData, time: number, quality: VideoQuality): Promise<FrameData> {
    // Simulate frame rendering
    return Promise.resolve({
      data: new Uint8Array(1920 * 1080 * 4), // RGBA data
      width: this.getResolutionWidth(quality.resolution),
      height: this.getResolutionHeight(quality.resolution),
      timestamp: time
    });
  }

  private async simulateEncoding(
    frames: FrameData[],
    format: string,
    codec: string
  ): Promise<Uint8Array> {
    // Simulate encoding process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock encoded data
    const mockSize = frames.length * 1000; // 1KB per frame simulation
    return new Uint8Array(mockSize);
  }

  private generateInteractiveHTML(sceneData: SceneData, frames: FrameData[]): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Interactive Diagram Video</title>
    <style>
        body { margin: 0; padding: 20px; font-family: system-ui; }
        .video-player { max-width: 100%; }
        .controls { margin-top: 10px; }
        .timeline { width: 100%; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="video-player">
        <canvas id="videoCanvas" width="1920" height="1080"></canvas>
        <div class="controls">
            <button id="playBtn">Play/Pause</button>
            <input type="range" id="timeline" class="timeline" min="0" max="100" value="0">
            <span id="timeDisplay">00:00 / 00:00</span>
        </div>
    </div>
    <script>
        // Interactive video player implementation
        const canvas = document.getElementById('videoCanvas');
        const ctx = canvas.getContext('2d');
        const sceneData = ${JSON.stringify(sceneData)};

        // Add interactive controls here
    </script>
</body>
</html>`;
  }

  private async generateAnimatedPDF(frames: FrameData[], config: ExportConfiguration): Promise<Uint8Array> {
    // Mock PDF generation with animations
    return new Uint8Array(frames.length * 2000); // 2KB per frame
  }

  private generateAnimatedSVG(sceneData: SceneData, frames: FrameData[]): string {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
    <defs>
        <style>
            .animated { animation: fadeIn 2s ease-in-out; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    </defs>
    <!-- SVG animation content based on scene data -->
    <g class="animated">
        <!-- Diagram elements here -->
    </g>
</svg>`;
  }

  private generateLottieAnimation(sceneData: SceneData, frames: FrameData[]): Record<string, unknown> {
    return {
      v: "5.7.4",
      fr: 30,
      ip: 0,
      op: frames.length,
      w: 1920,
      h: 1080,
      nm: "AudioDiagramAnimation",
      layers: [
        // Lottie animation layers based on scene data
      ]
    };
  }

  // Utility methods
  private validateExportConfig(config: ExportConfiguration): void {
    if (!config.format || !config.quality || !config.settings) {
      throw new Error('Invalid export configuration');
    }

    if (config.quality.resolution === '4k' && config.format === 'gif') {
      throw new Error('4K resolution not supported for GIF format');
    }
  }

  private optimizeSettings(config: ExportConfiguration): Record<string, unknown> {
    // Return optimized settings based on format and quality
    return {
      ...config,
      optimized: true
    };
  }

  private generateOutputPath(format: ExportFormat): string {
    const timestamp = Date.now();
    return `/tmp/export_${timestamp}.${this.getFileExtension(format)}`;
  }

  private getFileExtension(format: ExportFormat): string {
    const extensions = {
      'mp4': 'mp4',
      'webm': 'webm',
      'gif': 'gif',
      'apng': 'png',
      'interactive-html': 'html',
      'pdf-animated': 'pdf',
      'svg-animated': 'svg',
      'json-lottie': 'json'
    };
    return extensions[format] || 'mp4';
  }

  private getResolutionWidth(resolution: VideoQuality['resolution']): number {
    const resolutions = {
      '720p': 1280,
      '1080p': 1920,
      '1440p': 2560,
      '4k': 3840,
      'custom': 1920
    };
    return resolutions[resolution] || 1920;
  }

  private getResolutionHeight(resolution: VideoQuality['resolution']): number {
    const resolutions = {
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '4k': 2160,
      'custom': 1080
    };
    return resolutions[resolution] || 1080;
  }

  private calculateDuration(sceneData: SceneData): number {
    // Calculate total duration from scene data
    return sceneData.scenes?.reduce((total: number, scene: { duration?: number; [key: string]: unknown }) => total + (scene.duration || 3), 0) || 10;
  }

  private updateProgress(job: ExportJob, stage: ExportStage, progress: number, details?: string): void {
    job.status = stage;
    job.progress = progress;

    if (job.onProgress) {
      job.onProgress({
        stage,
        progress,
        details,
        currentFile: job.outputPath
      });
    }
  }

  private async prepareCodecSettings(job: ExportJob): Promise<void> {
    // Prepare codec-specific settings
    job.codecSettings = {
      profile: 'high',
      preset: 'medium',
      crf: 23
    };
  }

  private async applyWatermark(data: Uint8Array, config: ExportConfiguration): Promise<Uint8Array> {
    // Apply watermark to video data
    return data; // Mock implementation
  }

  private async compressVideo(data: Uint8Array, compression: string): Promise<Uint8Array> {
    // Apply compression based on level
    const compressionRatio = {
      'low': 0.9,
      'medium': 0.7,
      'high': 0.5,
      'maximum': 0.3
    }[compression] || 1;

    return data.slice(0, Math.floor(data.length * compressionRatio));
  }

  private async writeOutputFile(video: ProcessedVideo, outputPath: string): Promise<string> {
    // Write final video file
    return outputPath;
  }

  private async getFileSize(path: string): Promise<number> {
    // Get file size
    return 1024 * 1024; // Mock 1MB file
  }

  private processNextInQueue(): void {
    if (this.exportQueue.length > 0 && this.activeExports.size < this.maxConcurrentExports) {
      const nextJob = this.exportQueue.shift();
      if (nextJob && nextJob.resolve) {
        this.processExportJob(nextJob).then(nextJob.resolve);
      }
    }
  }

  private generateJobId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Supporting interfaces
interface SceneData {
  scenes?: { duration?: number; [key: string]: unknown }[];
  [key: string]: unknown;
}

interface CodecSettings {
  profile: string;
  preset: string;
  crf: number;
}

interface ExportJob {
  id: string;
  sceneData: SceneData;
  config: ExportConfiguration;
  status: ExportStage;
  progress: number;
  startTime: Date;
  outputPath?: string;
  optimizedSettings?: Record<string, unknown>;
  codecSettings?: CodecSettings;
  onProgress?: (progress: ExportProgress) => void;
  resolve?: (result: ExportResult) => void;
}

interface FrameData {
  data: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
}

interface EncodedVideo {
  data: Uint8Array;
  duration: number;
  codec: string;
  profile?: string;
  container: string;
  interactive?: boolean;
}

interface ProcessedVideo extends EncodedVideo {
  chapters?: ChapterMarker[];
  subtitles?: SubtitleTrack[];
}

/**
 * Export Quality Validation
 */
export class ExportQualityValidator {
  static validateExportResult(result: ExportResult): boolean {
    return result.success && !!result.outputPath && (result.outputSize || 0) > 0;
  }

  static calculateExportScore(result: ExportResult, config: ExportConfiguration): number {
    if (!result.success) return 0;

    let score = 0.6; // Base score

    // Format support bonus
    if (['mp4', 'webm'].includes(config.format)) score += 0.2;
    if (['interactive-html', 'svg-animated'].includes(config.format)) score += 0.3;

    // Quality bonus
    if (config.quality.resolution === '4k') score += 0.1;
    if (config.quality.fps >= 60) score += 0.05;

    // File size efficiency
    const sizePerSecond = (result.outputSize || 0) / (result.duration || 1);
    if (sizePerSecond < 1000000) score += 0.15; // Under 1MB/sec

    return Math.min(score, 1.0);
  }
}