import { TranscriptionResult, TranscriptionConfig, TranscriptionSegment, TranscriptionMetrics, SUPPORTED_AUDIO_FORMATS, TranscriptionError, type SupportedAudioFormat } from './types';
import { BrowserTranscriber } from './browser-transcriber';
import { WhisperTranscriber, type WhisperConfig } from './whisper-transcriber';
import { Caption } from '@remotion/captions';
import { detectTranscriptionLanguage } from './language-detection';
import { ChainBuilder, RecoveryStrategyChain, type ChainOutcome, type StrategyChain } from '../quality/recovery-strategy-chain';
import { meanSegmentConfidence } from '../pipeline/quality-estimators';
import { logger } from '@stv/core/utils/logger';

/** Recovery-chain step ids — the fallback order as machine-verifiable trace keys. */
const STEP_ID_WHISPER_INFERENCE = 'whisper-inference';
const STEP_ID_WEB_SPEECH_FILE = 'web-speech-file';
const STEP_ID_DISCLOSED_PLACEHOLDER = 'disclosed-placeholder';

/**
 * Wall-clock budget for the whole transcription recovery chain. The chain
 * default (30s) would cut off real whisper.cpp CPU inference mid-run; 120s
 * covers base-model inference while still bounding a stuck backend. If the
 * budget still expires, runWhisperTranscription() discloses placeholder
 * segments itself — disclosure never depends on chain health.
 */
const TRANSCRIPTION_RECOVERY_TIME_BUDGET_MS = 120_000;

/**
 * Single source for "this result is a real, inference-backed transcription":
 * success with at least one segment that was not produced by the no-backend
 * placeholder emitter (README「音声認識の現状」). The recovery chain's first
 * step and downstream consumers (AX-3 quality aggregation) share this ONE
 * judgment — a successful-looking placeholder must never shadow the real
 * browser engine or be reported downstream as measured content.
 */
export function isRealTranscriptionResult(
  result: Pick<TranscriptionResult, 'success' | 'segments' | 'placeholder'>
): boolean {
  return result.success === true && result.segments.length > 0 && result.placeholder !== true;
}

/**
 * Whisper-based transcription service with iterative improvement capabilities
 * Follows the development philosophy of small implementations with clear evaluation
 */
export class TranscriptionPipeline {
  private config: TranscriptionConfig;
  private iteration: number = 1;
  private browserTranscriber?: BrowserTranscriber;
  private whisperTranscriber: WhisperTranscriber;
  private isBrowser: boolean;
  private readonly recoveryChain: RecoveryStrategyChain;
  private lastRecoveryOutcome: ChainOutcome | null = null;
  /** Audio input for the current transcribe() call, read by the chain steps. */
  private audioInput: File | string | null = null;

  constructor(config: Partial<TranscriptionConfig> = {}) {
    this.config = {
      model: 'base',
      outputFormat: 'json',
      combineMs: 200,
      maxRetries: 3,
      chunkSizeMs: 30000, // 30 seconds
      ...config
    };

    // Detect environment
    this.isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    // Initialize browser-compatible transcriber only in browser environment
    if (this.isBrowser) {
      this.browserTranscriber = new BrowserTranscriber();
    } else {
      // Intentionally empty: server environment uses WhisperTranscriber initialized below
    }

    // Initialize enhanced Whisper transcriber
    this.whisperTranscriber = new WhisperTranscriber({
      model: this.config.model as 'tiny' | 'base' | 'small' | 'medium' | 'large',
      enableTimestamps: true,
      maxSegmentLength: this.config.chunkSizeMs
    });

    // Per-instance recovery chain (NOT the globalRecoveryChain singleton):
    // keeps per-instance stats isolated from other pipelines/tests while
    // events still flow to the singleton errorRecoveryEventBus (AC-D5-5).
    this.recoveryChain = new RecoveryStrategyChain();
    this.recoveryChain.register('transcription', this.buildRecoveryChain());
  }

  /**
   * Update config after construction and re-sync the inner WhisperTranscriber.
   * The orchestrator builds this pipeline ONCE with fixed defaults; without an
   * update path, a transcription config the caller validated (model/language)
   * never reached transcription — a silent no-op (sibling of the analysis config
   * bug). WhisperTranscriber reads its config live, so forwarding a merge takes
   * effect on the next transcribe() call. Maps TranscriptionConfig fields onto
   * the WhisperConfig shape (chunkSizeMs → maxSegmentLength).
   */
  updateConfig(partial: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...partial };
    const whisperPartial: Partial<WhisperConfig> = {};
    if (partial.model !== undefined) {
      whisperPartial.model = partial.model;
    }
    if (partial.language !== undefined) {
      whisperPartial.language = partial.language;
    }
    if (partial.chunkSizeMs !== undefined) {
      whisperPartial.maxSegmentLength = partial.chunkSizeMs;
    }
    this.whisperTranscriber.updateConfig(whisperPartial);
  }

  /**
   * Main transcription method - handles the complete pipeline
   * @param audioPath Path to audio file
   * @returns Promise<TranscriptionResult>
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const startTime = performance.now();

    try {
      // Step 1: Validate input
      await this.validateAudioFile(audioPath);

      // Step 2: Run Whisper transcription
      const { segments: transcribedSegments, isFallback } = await this.runWhisperTranscription(audioPath);

      // Step 3: Use segments directly (simplified pipeline)
      const finalSegments = transcribedSegments;

      // Step 5: Calculate metrics and evaluate
      const metrics = this.calculateMetrics(finalSegments, startTime);
      const result = await this.createResult(finalSegments, metrics, startTime);
      result.fallback = isFallback;

      // Step 6: Evaluate success and log
      await this.evaluateAndLog(result, metrics);

      // Only mark success=true for real transcription, not fallback placeholders
      if (finalSegments.length > 0 && !isFallback) {
        result.success = true;
      } else {
        result.success = false;
      }

      return result;

    } catch (error) {
      logger.error('[Transcription] Error:', error);
      return {
        segments: [],
        language: 'unknown',
        duration: 0,
        processingTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enhanced transcription executed as the 'transcription' recovery chain.
   * The chain runs the fallback order (whisper-inference → web-speech-file →
   * disclosed-placeholder) and yields trace/stats/errorRecoveryEventBus events
   * for free; throws inside a step are caught by the chain and recorded as a
   * failed step instead of aborting the order. minConfidence stays fixed at 0:
   * real whisper inference segments carry no measured confidence (undefined →
   * step confidence 0), so any threshold would let a lower engine outrank a
   * successful inference — the step order and isRealTranscriptionResult are
   * the only authorities here. Returns segments and whether they came from
   * the disclosed placeholder fallback.
   */
  private async runWhisperTranscription(audioPath: string): Promise<{ segments: TranscriptionSegment[]; isFallback: boolean }> {
    this.audioInput = audioPath;

    const outcome = await this.recoveryChain.execute('transcription', {
      stage: 'transcription',
      timeBudgetMs: TRANSCRIPTION_RECOVERY_TIME_BUDGET_MS,
      minConfidence: 0
    });
    this.lastRecoveryOutcome = outcome;

    if (outcome.success && outcome.winningStepId !== null) {
      const segments = (outcome.result as { segments: TranscriptionSegment[] }).segments;
      return { segments, isFallback: outcome.winningStepId === STEP_ID_DISCLOSED_PLACEHOLDER };
    }

    // Disclosure guarantee (SD4): the chain ended without a winning step
    // (e.g. the time budget expired before even the terminal step ran). The
    // pipeline still discloses placeholder segments — disclosure never
    // depends on chain health.
    logger.warn('[Transcription] Recovery chain ended without a winning step, returning placeholder fallback segments');
    return { segments: this.getFallbackSegments(), isFallback: true };
  }

  /**
   * Single declarative source of the ASR fallback order (D-5): real whisper
   * inference first, browser Web Speech only when the pipeline was
   * constructed in a browser environment (the step is not registered in
   * Node, so the browser engine is never constructed there), and the
   * always-succeeding disclosed placeholder as the terminal step. Step
   * confidence derives from meanSegmentConfidence (REQ-393 canonical
   * estimator — unmeasured segments contribute 0) with no new frozen
   * decimals.
   */
  private buildRecoveryChain(): StrategyChain {
    const builder = ChainBuilder.start('transcription-recovery')
      .then(STEP_ID_WHISPER_INFERENCE, 'Whisper real inference', async () => {
        let audioInput: File | string = this.audioInput ?? '';

        // Convert blob URL to File if needed
        if (typeof audioInput === 'string' && audioInput.startsWith('blob:')) {
          audioInput = await this.blobUrlToFile(audioInput);
        }

        const whisperResult = await this.whisperTranscriber.transcribe(audioInput);
        if (!isRealTranscriptionResult(whisperResult)) {
          return undefined;
        }
        return {
          result: { segments: whisperResult.segments },
          fallbackUsed: false,
          confidence: meanSegmentConfidence(whisperResult.segments)
        };
      });

    if (this.isBrowser && this.browserTranscriber) {
      const browserTranscriber = this.browserTranscriber;
      builder.thenOptional(STEP_ID_WEB_SPEECH_FILE, 'Browser Web Speech API', async () => {
        const input = this.audioInput;
        const audioFile =
          input instanceof File
            ? input
            : typeof input === 'string' && input.startsWith('blob:')
              ? await this.blobUrlToFile(input)
              : undefined;
        if (!audioFile) {
          return undefined;
        }

        const result = await browserTranscriber.transcribeAudioFile(audioFile);
        if (!(result.success && result.segments.length > 0)) {
          return undefined;
        }
        return {
          result: { segments: result.segments },
          fallbackUsed: false,
          confidence: meanSegmentConfidence(result.segments)
        };
      });
    }

    return builder
      .then(STEP_ID_DISCLOSED_PLACEHOLDER, 'Disclosed placeholder fallback', async () => ({
        result: { segments: this.getFallbackSegments() },
        fallbackUsed: true,
        confidence: 0
      }))
      .build();
  }

  /**
   * Outcome of the most recent transcribe() recovery-chain run, or null
   * before the first run. Holds the latest outcome only — cumulative stats
   * live on the chain itself (getStats). AX-3 (quality aggregation) reads
   * fallbackUsed / winningStepId / trace from here.
   */
  getRecoveryOutcome(): ChainOutcome | null {
    return this.lastRecoveryOutcome;
  }

  /**
   * Convert blob URL to File object for processing
   */
  private async blobUrlToFile(blobUrl: string): Promise<File> {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new TranscriptionError(`Failed to fetch blob URL: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type || 'audio/wav';
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'wav';
    return new File([blob], `audio.${ext}`, { type: mimeType });
  }

  /**
   * Fallback placeholder segments when all transcription engines fail.
   * Confidence is set to 0 so downstream quality checks can detect them.
   */
  private getFallbackSegments(): TranscriptionSegment[] {
    return [
      {
        start: 0,
        end: 6000,
        text: "[Transcription unavailable - placeholder content]",
        confidence: 0,
      },
    ];
  }


  private async validateAudioFile(audioPath: string): Promise<void> {
    // Basic validation - in real implementation, check file exists, format, etc.
    if (!audioPath || audioPath.length === 0) {
      throw new TranscriptionError('Invalid audio path provided');
    }

    // Handle blob URLs for browser file uploads
    if (audioPath.startsWith('blob:')) {
      return;
    }

    // Validate file extension against supported audio formats
    const extension = audioPath.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_AUDIO_FORMATS.includes(extension as SupportedAudioFormat)) {
      throw new TranscriptionError(
        `Unsupported audio format: .${extension}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`
      );
    }

    // For file system paths in Node.js, check if the file exists and is readable
    if (!this.isBrowser) {
      try {
        const fs = await import('fs');
        await fs.promises.access(audioPath, fs.constants.R_OK);
      } catch (err) {
        throw new TranscriptionError(`Audio file not found or not readable: ${audioPath} (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  private calculateMetrics(segments: TranscriptionSegment[], startTime: number): TranscriptionMetrics {
    const totalDuration = segments.length > 0
      ? segments[segments.length - 1].end - segments[0].start
      : 0;

    const totalWords = segments.reduce((count, seg) =>
      count + (seg.text.trim() ? seg.text.trim().split(/\s+/).length : 0), 0);

    const avgConfidence = segments.length > 0
      ? segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / segments.length
      : 0;

    return {
      duration: totalDuration,
      segmentCount: segments.length,
      avgConfidence,
      processingTime: performance.now() - startTime,
      wordsPerMinute: totalDuration > 0 ? (totalWords * 60000) / totalDuration : 0
    };
  }

  private async createResult(
    segments: TranscriptionSegment[],
    metrics: TranscriptionMetrics,
    startTime: number
  ): Promise<TranscriptionResult> {
    // Generate Remotion captions from segments
    const captions = await this.generateRemotionCaptions(segments);

    // Phase 33: Auto-detect language from transcribed text
    const detectedLanguage = this.detectLanguageFromSegments(segments);

    return {
      segments,
      language: detectedLanguage,
      duration: metrics.duration,
      processingTime: performance.now() - startTime,
      success: true,
      captions // Add captions to result
    };
  }

  /**
   * Phase 33: Auto-detect language from transcription segments
   * Uses character-based detection from Phase 32 language detector
   *
   * Round 22: the sampling + mapping moved to ./language-detection so every
   * TranscriptionResult producer shares ONE detection contract. This site was
   * already the canonical shape — the move is a pure extraction.
   */
  private detectLanguageFromSegments(segments: TranscriptionSegment[]): string {
    return detectTranscriptionLanguage(segments);
  }

  /**
   * Generate Remotion-compatible captions from transcription segments
   */
  private async generateRemotionCaptions(segments: TranscriptionSegment[]): Promise<Caption[]> {

    const captions: Caption[] = segments.map((segment, index) => ({
      text: segment.text,
      startMs: segment.start,
      endMs: segment.end,
      timestampMs: segment.start,
      // REQ-393: Caption.confidence is `number | null` — null is the type's
      // own "no measurement" representation. The previous `?? 0.9` dressed a
      // missing segment confidence as near-certainty.
      confidence: segment.confidence ?? null
    }));

    return captions;
  }

  /**
   * Evaluation and iterative improvement logic
   */
  private async evaluateAndLog(result: TranscriptionResult, metrics: TranscriptionMetrics): Promise<void> {

    // Success criteria evaluation
    const successCriteria = {
      hasSegments: metrics.segmentCount > 0,
      goodConfidence: metrics.avgConfidence > 0.7,
      reasonableSpeed: metrics.processingTime < 60000, // 1 minute max
      noErrors: result.success
    };

    const success = Object.values(successCriteria).every(v => v);

    if (success) {
      // Intentionally empty: all success criteria met, no action needed
    } else {
      Object.entries(successCriteria).forEach(([key, passed]) => {
        if (!passed) {
          logger.warn(`[Transcription] Success criterion not met: ${key}`);
        }
      });
    }

    // Log iteration results for improvement tracking
    await this.logIteration(result, metrics, success);
  }

  private async logIteration(
    result: TranscriptionResult,
    metrics: TranscriptionMetrics,
    success: boolean
  ): Promise<void> {
    const logEntry = {
      iteration: this.iteration,
      timestamp: new Date().toISOString(),
      success,
      metrics,
      config: this.config
    };

    // In real implementation, this would append to .module/ITERATION_LOG.md
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(): void {
    this.iteration++;
  }
}