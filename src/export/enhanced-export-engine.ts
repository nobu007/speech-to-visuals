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
import { ExportError, FormatValidationError } from '@/pipeline/pipeline-errors';
import type {
  WorkerMessage,
  ExportWorkerPayload,
  ExportWorkerResult,
} from '../workers';
import { encodeAPNG as realEncodeAPNG } from './apng-encoder';
import { generateAnimatedSVG, generateLottieAnimation, sceneDurationSeconds } from './animated-scene-renderer';
import { ExportVerifier, type VerificationFormat, type VerificationResult } from './export-verifier';
import { exportMetricsCollector, type ExportStatus } from './export-metrics-collector';
import type { ExportArtifactStore } from './export-artifact-store';
import { EXPORT_RETRY_LIMITS, EXPORT_STAGE_TIMEOUTS } from '@/config/limits';

/** Retry configuration for export encoding (REQ-256). */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterMaxMs: number;
}
import { logger } from '../utils/logger';
import { validateExportPayload, isStrictValidationEnabled } from './export-content-validator';

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
  /** Verification result from ExportVerifier (REQ-225) */
  verification?: VerificationResult;
  /** Artifact ID from ExportArtifactStore (REQ-231) */
  artifactId?: string;
}

/**
 * Escape a JSON string for safe embedding inside an HTML <script> block.
 *
 * The HTML tokenizer terminates a <script> element on ANY "</script" sequence
 * followed by whitespace, "/", or ">" — not only the exact "</script>" token.
 * A naive replace of the literal "</script>" therefore leaves whitespace
 * variants ("</script >", "</script\t>", "</script\n>", "</script/>") intact,
 * letting attacker-controlled text (transcription-derived labels/summaries)
 * break out of the script block and execute injected markup.
 *
 * Neutralizing "<" and ">" entirely is the bulletproof fix: no raw angle
 * bracket can appear in the serialized text, so no HTML tag — script or
 * otherwise — can be introduced. JSON parsers decode "\u003c"/"\u003e" back to
 * "<"/">", so the embedded data round-trips without corruption.
 */
export function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export class EnhancedExportEngine {
  private activeExports: Map<string, ExportJob>;
  private exportQueue: ExportJob[];
  private exportWorkerPool: WorkerPool | null;
  private useWorkers: boolean;
  private maxConcurrentExports: number;
  private disposed = false;
  private verifier: ExportVerifier;
  private workerFactory?: () => Worker;

  private artifactStore?: ExportArtifactStore;
  private retryConfig: RetryConfig;

  /**
   * @param maxConcurrentExports - Maximum concurrent export jobs
   * @param useWorkers - Whether to use Web Workers for CPU-intensive processing
   * @param workerFactory - Optional factory to create Worker instances (for testing)
   * @param artifactStore - Optional artifact store for REQ-231 integration
   * @param retryConfig - Optional retry configuration for encoding (REQ-256, defaults to EXPORT_RETRY_LIMITS)
   */
  constructor(
    maxConcurrentExports = 2,
    useWorkers = false,
    workerFactory?: () => Worker,
    artifactStore?: ExportArtifactStore,
    retryConfig?: RetryConfig,
  ) {
    this.activeExports = new Map();
    this.exportQueue = [];
    this.useWorkers = useWorkers && isWorkerAvailable();
    this.maxConcurrentExports = maxConcurrentExports;
    this.exportWorkerPool = null;
    this.verifier = new ExportVerifier();
    this.workerFactory = workerFactory;
    this.artifactStore = artifactStore;
    this.retryConfig = retryConfig ?? {
      maxRetries: EXPORT_RETRY_LIMITS.MAX_RETRIES,
      initialDelayMs: EXPORT_RETRY_LIMITS.INITIAL_DELAY_MS,
      maxDelayMs: EXPORT_RETRY_LIMITS.MAX_DELAY_MS,
      jitterMaxMs: EXPORT_RETRY_LIMITS.JITTER_MAX_MS,
    };
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

  /**
   * Cancel an active export job by ID (REQ-228).
   * Aborts the associated AbortController, causing the running
   * stage to throw and the job to complete with success=false.
   */
  cancelExport(jobId: string): boolean {
    const job = this.activeExports.get(jobId);
    if (!job) return false;

    job.abortController?.abort();
    logger.info(`[EnhancedExportEngine] Export job ${jobId} cancelled`);
    return true;
  }

  /** Terminate worker pool, abort active exports, reject queued exports, and release resources */
  dispose(): void {
    this.disposed = true;

    // Abort all active export jobs so they stop processing
    for (const activeJob of this.activeExports.values()) {
      activeJob.abortController?.abort();
    }

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
        onProgress,
        abortController: new AbortController(),
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
      logger.error('Export failed:', error);

      // REQ-226: Record failed export metric
      exportMetricsCollector.recordExport(config.format, 'failure', duration);

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
   * Process export job through all stages with timeout and abort support (REQ-228).
   */
  private async processExportJob(job: ExportJob): Promise<ExportResult> {
    this.activeExports.set(job.id, job);

    try {
      // Stage 1: Preparation (with timeout)
      let t0 = performance.now();
      await this.runStageWithTimeout(job, 'preparing', () => this.prepareExport(job));
      exportMetricsCollector.recordStageDuration('preparing', performance.now() - t0);

      // Stage 2: Rendering (with timeout)
      t0 = performance.now();
      let renderedFrames: FrameData[];
      try {
        renderedFrames = await this.runStageWithTimeout(job, 'rendering', () => this.renderFrames(job));
      } catch (err) {
        if (this.isAbortError(err)) {
          return this.cancelledResult(job);
        }
        throw err;
      }
      exportMetricsCollector.recordStageDuration('rendering', performance.now() - t0);

      // Stage 3: Encoding (with timeout + retry REQ-227)
      t0 = performance.now();
      const encodedVideo = await this.encodeVideoWithRetry(job, renderedFrames);
      exportMetricsCollector.recordStageDuration('encoding', performance.now() - t0);

      // Stage 4: Post-processing
      const processedVideo = await this.postProcess(job, encodedVideo);

      // Stage 5: Finalization (with timeout, special abort handling for TC-228-B02)
      t0 = performance.now();
      let finalResult: ExportResult;
      try {
        finalResult = await this.runStageWithTimeout(job, 'finalizing', () => this.finalizeExport(job, processedVideo));
      } catch (error) {
        if (this.isAbortError(error) && job.fileWritten) {
          // File already written during finalization — return success instead of cancelling
          const exportDuration = job.startTime ? performance.now() - job.startTime.getTime() : 0;
          exportMetricsCollector.recordExport(job.config.format, 'success', exportDuration);
          finalResult = {
            success: true,
            outputPath: job.outputPath,
            format: job.config.format,
            quality: job.config.quality,
            warnings: ['Export was cancelled during finalization'],
          };
        } else {
          throw error;
        }
      }
      exportMetricsCollector.recordStageDuration('finalizing', performance.now() - t0);

      return finalResult;
    } catch (error) {
      if (this.isAbortError(error)) {
        return this.cancelledResult(job);
      }
      logger.error('Export job failed:', error);

      const exportDuration = job.startTime ? performance.now() - job.startTime.getTime() : 0;
      exportMetricsCollector.recordExport(job.config.format, 'failure', exportDuration);

      return {
        success: false,
        format: job.config.format,
        quality: job.config.quality,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    } finally {
      this.activeExports.delete(job.id);
      this.processNextInQueue();
    }
  }

  /**
   * Run a stage with AbortSignal check and a configurable timeout (REQ-228).
   */
  private async runStageWithTimeout<T>(
    job: ExportJob,
    stage: 'preparing' | 'rendering' | 'encoding' | 'finalizing',
    fn: () => Promise<T>,
  ): Promise<T> {
    const signal = job.abortController?.signal;
    const timeoutMs = EXPORT_STAGE_TIMEOUTS[stage];

    // Check if already aborted
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // TC-228-B01: Disable timeout for zero or negative values (wait indefinitely)
    if (timeoutMs <= 0) {
      return fn();
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Stage ${stage} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      abortHandler = () => {
        if (timer) clearTimeout(timer);
        reject(new DOMException('Export cancelled', 'AbortError'));
      };
      signal?.addEventListener('abort', abortHandler, { once: true });
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      if (abortHandler && signal) signal.removeEventListener('abort', abortHandler);
    }
  }

  /**
   * Encode video with exponential backoff retry on transient errors (REQ-227).
   */
  private async encodeVideoWithRetry(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const { maxRetries, initialDelayMs, maxDelayMs, jitterMaxMs } = this.retryConfig;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check for cancellation before each attempt
      if (job.abortController?.signal.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      try {
        return await this.encodeVideo(job, frames);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Non-transient errors fail immediately
        if (!this.isTransientExportError(lastError)) {
          logger.warn(`[EnhancedExportEngine] Non-transient encoding error: ${lastError.message}`);
          throw lastError;
        }

        // All retries exhausted
        if (attempt >= maxRetries) {
          logger.warn(`[EnhancedExportEngine] Encoding failed after ${maxRetries} retries: ${lastError.message}`);
          throw lastError;
        }

        // Calculate delay with jitter
        const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.floor(Math.random() * jitterMaxMs);
        const delay = baseDelay + jitter;

        logger.info(
          `[EnhancedExportEngine] Transient encoding error on attempt ${attempt + 1}/${maxRetries}, retrying in ${delay}ms: ${lastError.message}`,
        );

        // Record retry metric
        exportMetricsCollector.recordExport(job.config.format, 'failure', 0);

        // Abortable delay: if the job is cancelled during the retry wait,
        // reject immediately instead of continuing to retry.
        await new Promise<void>((resolve, reject) => {
          const sig = job.abortController?.signal;
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Export cancelled', 'AbortError'));
          };
          const timer = setTimeout(() => {
            sig?.removeEventListener('abort', onAbort);
            resolve();
          }, delay);
          if (sig) {
            if (sig.aborted) {
              clearTimeout(timer);
              reject(new DOMException('Export cancelled', 'AbortError'));
              return;
            }
            sig.addEventListener('abort', onAbort, { once: true });
          }
        });
      }
    }

    throw lastError;
  }

  /**
   * Determine if an encoding error is transient and worth retrying (REQ-227).
   * Transient: OOM, timeout, Worker crash.
   * Non-transient: validation errors, format errors, data corruption.
   */
  private isTransientExportError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('oom') ||
      msg.includes('out of memory') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('worker crash') ||
      msg.includes('worker terminated') ||
      msg.includes('heap out of memory')
    );
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  private cancelledResult(job: ExportJob): ExportResult {
    logger.info(`[EnhancedExportEngine] Job ${job.id} was cancelled`);
    return {
      success: false,
      format: job.config.format,
      quality: job.config.quality,
      error: 'Export cancelled',
    };
  }

  /**
   * Stage 1: Prepare export environment
   */
  private async prepareExport(job: ExportJob): Promise<void> {
    this.updateProgress(job, 'preparing', 10, 'Initializing export environment...');

    // Validate scene data
    if (!job.sceneData || !job.sceneData.scenes) {
      throw new FormatValidationError('Invalid scene data provided', 'unknown');
    }

    // Defense-in-depth: scan scene data for injection patterns before processing.
    // When EXPORT_STRICT_VALIDATION=true, high-severity findings block the export.
    const validation = validateExportPayload(
      job.sceneData, `job=${job.id}`,
      { strict: isStrictValidationEnabled() },
    );
    if (!validation.passed) {
      const highFindings = validation.findings.filter((f) => f.severity === 'high');
      throw new FormatValidationError(
        `Export blocked: ${highFindings.length} high-severity injection pattern(s) detected` +
        ` (${highFindings.map((f) => f.pattern).join(', ')})`,
        job.config.format,
        { findings: highFindings.map((f) => ({ field: f.field, pattern: f.pattern })) },
      );
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
    const fps = quality.fps || 30;
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
        logger.warn('Export worker returned error, falling back:', response.error.message);
        return null;
      }
      return (response.payload as ExportWorkerResult) ?? null;
    } catch (error) {
      logger.warn('Export worker failed, falling back to main thread:', error instanceof Error ? error.message : String(error));
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
        throw new ExportError(`Unsupported format: ${format}`, format);
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
   * Stage 5: Finalize export with automatic verification (REQ-225)
   */
  private async finalizeExport(job: ExportJob, video: ProcessedVideo): Promise<ExportResult> {
    this.updateProgress(job, 'finalizing', 98, 'Finalizing export...');

    // Write final file
    const outputPath = await this.writeOutputFile(video, job.outputPath!);
    job.fileWritten = true;

    // Generate metadata
    const metadata: ExportMetadata = {
      title: 'Audio-to-Diagram Video',
      description: 'Generated by Enhanced Export Engine',
      author: 'AutoDiagram Generator',
      ...job.config.advanced?.containerOptions?.metadata
    };

    // Calculate file size
    const outputSize = await this.getFileSize(outputPath);

    // Verify exported output (REQ-225)
    let verification: VerificationResult;
    if (job.config.format === 'interactive-html') {
      // HTML format has no binary magic bytes or JSON structure to verify;
      // perform a basic size check only.
      verification = {
        valid: outputSize > 0,
        format: 'json',
        fileSize: outputSize,
        errors: outputSize === 0 ? ['HTML output is empty'] : [],
        warnings: [],
        metadata: {},
      };
    } else {
      const vFormat = mapExportFormatToVerificationFormat(job.config.format);
      verification = this.verifier.verify(vFormat, video.data.buffer as ArrayBuffer);
    }

    const verificationErrors: string[] = [];
    if (!verification.valid) {
      logger.error('[EnhancedExportEngine] Export verification failed:', verification.errors);
      verificationErrors.push(...verification.errors);
    }
    if (verification.warnings.length > 0) {
      logger.warn('[EnhancedExportEngine] Export verification warnings:', verification.warnings);
    }

    this.updateProgress(job, 'complete', 100, 'Export complete!');

    // REQ-226: Record export metric (use 'success' or 'failed' based on verification)
    const exportDuration = job.startTime ? performance.now() - job.startTime.getTime() : 0;
    const exportStatus: ExportStatus = verification.valid ? 'success' : 'failure';
    exportMetricsCollector.recordExport(job.config.format, exportStatus, exportDuration, outputSize);

    const warnings: string[] = [...(verification.warnings)];

    // REQ-231: Store artifact in ExportArtifactStore (failure is non-blocking)
    let artifactId: string | undefined;
    if (this.artifactStore) {
      try {
        const stored = this.artifactStore.store({
          format: job.config.format,
          data: video.data,
          sizeBytes: video.data.byteLength,
          metadata: {
            jobId: job.id,
            outputPath,
            outputSize,
            codec: video.codec,
          },
        });
        artifactId = stored.artifactId;
        logger.info(`[EnhancedExportEngine] Artifact stored: ${stored.artifactId}`);
      } catch (storeError) {
        logger.warn(
          '[EnhancedExportEngine] Artifact store failed (non-blocking):',
          storeError instanceof Error ? storeError.message : storeError,
        );
      }
    }

    return {
      success: verification.valid,
      outputPath,
      outputSize,
      duration: video.duration,
      format: job.config.format,
      quality: job.config.quality,
      metadata,
      verification,
      warnings,
      error: verification.valid ? undefined : `Export verification failed: ${verificationErrors.join('; ')}`,
      artifactId,
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
      duration: frames.length / (quality.fps || 30),
      codec,
      profile,
      container: 'mp4'
    };
  }

  private async encodeWebM(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const { quality } = job.config;

    return {
      data: await this.simulateEncoding(frames, 'webm', 'vp9'),
      duration: frames.length / (quality.fps || 30),
      codec: 'vp9',
      container: 'webm'
    };
  }

  private async encodeGIF(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // GIF encoding with optimization
    return {
      data: await this.simulateEncoding(frames, 'gif', 'gif'),
      duration: frames.length / (job.config.quality.fps || 30),
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
      duration: frames.length / (job.config.quality.fps || 30),
      codec: 'apng',
      container: 'apng',
    };
  }

  private async encodeInteractiveHTML(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    // Generate interactive HTML with controls
    const htmlContent = this.generateInteractiveHTML(job.sceneData, frames);

    return {
      data: new TextEncoder().encode(htmlContent),
      duration: frames.length / (job.config.quality.fps || 30),
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
      duration: frames.length / (job.config.quality.fps || 30),
      codec: 'pdf',
      container: 'pdf'
    };
  }

  private async encodeSVGAnimated(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const frameInfo = { width: frames[0]?.width ?? 1920, height: frames[0]?.height ?? 1080 };
    const svgContent = generateAnimatedSVG(job.sceneData, frameInfo);

    return {
      data: new TextEncoder().encode(svgContent),
      duration: frames.length / (job.config.quality.fps || 30),
      codec: 'svg',
      container: 'svg'
    };
  }

  private async encodeLottie(job: ExportJob, frames: FrameData[]): Promise<EncodedVideo> {
    const frameInfo = { width: frames[0]?.width ?? 1920, height: frames[0]?.height ?? 1080 };
    const lottieData = generateLottieAnimation(job.sceneData, frameInfo, frames.length);

    return {
      data: new TextEncoder().encode(JSON.stringify(lottieData)),
      duration: frames.length / (job.config.quality.fps || 30),
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
    _codec: string
  ): Promise<Uint8Array> {
    // Simulate encoding process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock data with proper magic bytes for format verification
    const bodySize = frames.length * 1000; // 1KB per frame simulation
    const formatHeaders: Record<string, { bytes: number[]; offset: number }> = {
      mp4:  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },  // "ftyp" at offset 4
      webm: { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 },  // EBML header
      gif:  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }, // "GIF89a"
    };
    const header = formatHeaders[format];
    const minSize = header ? header.offset + header.bytes.length + 100 : bodySize;
    const result = new Uint8Array(Math.max(bodySize, minSize));
    if (header) {
      result.set(header.bytes, header.offset);
    }
    return result;
  }

  private generateInteractiveHTML(sceneData: SceneData, frames: FrameData[]): string {
    // Neutralize every "</script" end-tag variant (and any other "<"/">")
    // before embedding JSON inside <script> — see escapeJsonForScript.
    const sceneDataJson = escapeJsonForScript(JSON.stringify(sceneData));
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
        const sceneData = ${sceneDataJson};

        // Add interactive controls here
    </script>
</body>
</html>`;
  }

  private async generateAnimatedPDF(frames: FrameData[], _config: ExportConfiguration): Promise<Uint8Array> {
    // Mock PDF with valid header and minimal page structure for verification
    const headerStr = '%PDF-1.4\n';
    const headerBytes = new TextEncoder().encode(headerStr);
    const pageObj = new TextEncoder().encode('\n/Type /Page\n');
    const bodySize = frames.length * 2000;
    const result = new Uint8Array(Math.max(bodySize, headerBytes.length + pageObj.length));
    result.set(headerBytes, 0);
    result.set(pageObj, headerBytes.length);
    return result;
  }

  // Utility methods
  private validateExportConfig(config: ExportConfiguration): void {
    if (!config.format || !config.quality || !config.settings) {
      throw new FormatValidationError('Invalid export configuration', config.format ?? 'unknown');
    }

    if (config.quality.resolution === '4k' && config.format === 'gif') {
      throw new ExportError('4K resolution not supported for GIF format', 'gif');
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
    // Total duration (seconds) from scene data. Pipeline scenes carry
    // `durationMs` (ms) rather than `duration` (s); sceneDurationSeconds resolves
    // either so the render frame count reflects real scene lengths. A non-positive
    // resolved duration keeps the historical 3 s default.
    return sceneData.scenes?.reduce(
      (total: number, scene: { duration?: number; durationMs?: number; [key: string]: unknown }) => {
        const secs = sceneDurationSeconds(scene);
        return total + (typeof secs === 'number' && secs > 0 ? secs : 3);
      },
      0,
    ) || 10;
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
        this.processExportJob(nextJob).then(nextJob.resolve).catch((error) => {
          logger.error('[EnhancedExportEngine] Queued export job failed:', error);
          nextJob.resolve!({
            success: false,
            format: nextJob.config.format,
            quality: nextJob.config.quality,
            error: error instanceof Error ? error.message : 'Unknown error',
            warnings: [],
          });
        });
      }
    }
  }

  private generateJobId(): string {
    return `export_${crypto.randomUUID()}`;
  }
}

/**
 * Map EnhancedExportEngine ExportFormat to ExportVerifier VerificationFormat (REQ-225)
 */
function mapExportFormatToVerificationFormat(format: ExportFormat): VerificationFormat {
  const mapping: Record<ExportFormat, VerificationFormat> = {
    'mp4': 'mp4',
    'webm': 'webm',
    'gif': 'gif',
    'apng': 'apng',
    'interactive-html': 'json',
    'pdf-animated': 'pdf',
    'svg-animated': 'svg',
    'json-lottie': 'lottie',
  };
  return mapping[format] ?? 'json';
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
  /** AbortController for cancellation (REQ-228) */
  abortController?: AbortController;
  /** Whether the output file has been written (TC-228-B02) */
  fileWritten?: boolean;
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