/**
 * 🎯 Iteration 45: Real-Time Streaming Transcription Enhancement
 * Implements progressive audio processing with live feedback
 * Following custom instructions methodology for iterative improvement
 */

import { TranscriptionSegment, TranscriptionResult, TranscriptionConfig, TranscriptionError } from './types';
import { detectTranscriptionLanguage } from './language-detection';
import { transcribeFileWithWebSpeech } from './web-speech-file-transcription';
import { whisperTranscriber } from './whisper-transcriber';
import { logger } from '@stv/core/utils/logger';
import { sanitizeFinite } from '@stv/core/utils/guards';
import {
  StreamingQualityMonitor,
  StreamingQualitySummary,
  QualityAlert,
  DEFAULT_STREAMING_QUALITY_CONFIG,
} from './streaming-quality-monitor';

/**
 * Confidence stamped on simulated chunk segments (REQ-391). processAudioChunk
 * emits fixed placeholder text with no ASR behind it, so no confidence is
 * measured; this is the disclosed stand-in, pinned to the lower bound of the
 * former `0.75 + Math.random() * 0.2` so no threshold consumer (e.g.
 * minConfidence filtering) reads an inflated value.
 */
export const PLACEHOLDER_CHUNK_CONFIDENCE = 0.75;

export interface StreamingTranscriptionConfig extends TranscriptionConfig {
  chunkSizeMs?: number; // Audio chunk size in milliseconds
  overlapMs?: number;   // Overlap between chunks for continuity
  minConfidence?: number; // Minimum confidence for segment acceptance
  enableLiveUpdate?: boolean; // Enable real-time UI updates
  enableQualityMonitoring?: boolean; // Enable per-chunk quality monitoring (REQ-091)
}

export interface StreamingProgress {
  processedDuration: number;
  totalDuration: number;
  currentSegment: TranscriptionSegment | null;
  segmentCount: number;
  averageConfidence: number;
}

export type StreamingProgressCallback = (progress: StreamingProgress) => void;
export type SegmentCallback = (segment: TranscriptionSegment) => void;
export type StreamingQualityAlertCallback = (alert: QualityAlert) => void;

/**
 * Enhanced streaming transcriber for real-time audio processing
 * Implements chunk-based processing with progressive updates
 */
export class StreamingTranscriber {
  private config: StreamingTranscriptionConfig;
  private recognition: SpeechRecognition | null = null;
  private isStreaming: boolean = false;
  private segments: TranscriptionSegment[] = [];
  private currentChunkStart: number = 0;
  private accumulatedText: string = '';
  private qualityMonitor: StreamingQualityMonitor | null = null;

  constructor(config: StreamingTranscriptionConfig = {}) {
    // Validate chunkSizeMs
    if (config.chunkSizeMs !== undefined) {
      if (config.chunkSizeMs <= 0 || config.chunkSizeMs > 60000) {
        throw new TranscriptionError(
          `chunkSizeMs must be > 0 and <= 60000, got ${config.chunkSizeMs}`
        );
      }
    }

    // Validate minConfidence
    if (config.minConfidence !== undefined) {
      if (config.minConfidence < 0 || config.minConfidence > 1) {
        throw new TranscriptionError(
          `minConfidence must be between 0 and 1, got ${config.minConfidence}`
        );
      }
    }

    // Validate overlapMs
    const effectiveChunkSize = config.chunkSizeMs ?? 3000;
    if (config.overlapMs !== undefined) {
      if (config.overlapMs < 0) {
        throw new TranscriptionError(
          `overlapMs must be >= 0, got ${config.overlapMs}`
        );
      }
      if (config.overlapMs >= effectiveChunkSize) {
        throw new TranscriptionError(
          `overlapMs (${config.overlapMs}) must be less than chunkSizeMs (${effectiveChunkSize})`
        );
      }
    }

    this.config = {
      chunkSizeMs: 3000,        // 3 second chunks
      overlapMs: 500,           // 0.5 second overlap
      minConfidence: 0.7,       // 70% minimum confidence
      enableLiveUpdate: true,   // Real-time updates enabled
      enableQualityMonitoring: true, // REQ-091: quality monitoring on by default
      ...config
    };

    // Initialize quality monitor if enabled
    if (this.config.enableQualityMonitoring !== false) {
      this.qualityMonitor = new StreamingQualityMonitor({
        minChunkConfidence: this.config.minConfidence ?? DEFAULT_STREAMING_QUALITY_CONFIG.minChunkConfidence,
      });
    }

    // Initialize Web Speech API if available. typeof-guard keeps the class
    // constructible in Node (TASK-0319 SD6), where transcribeStream routes
    // to the whisper engine instead of this live-mic instance.
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  /**
   * Configure speech recognition for streaming
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'ja-JP'; // Japanese support

    this.recognition.onstart = () => {
      this.isStreaming = true;
    };

    this.recognition.onend = () => {
      this.isStreaming = false;
    };

    this.recognition.onerror = (event) => {
      logger.error('[StreamingTranscriber] Speech recognition error:', event.error);
      this.isStreaming = false;
    };
  }

  /**
   * Start streaming transcription from audio file (TASK-0319 / REQ-424).
   *
   * Environment routing (specs/streaming-real-asr-inference/dataflow.md):
   *   経路1 browser + File + Web Speech constructors → the shared file engine
   *          (transcribeFileWithWebSpeech, TASK-0318) with real per-final
   *          onSegment/onProgress events only — no synthetic stagger (SD3)
   *   経路2 Node → whisperTranscriber.transcribe delegation; a disclosed
   *          placeholder run (whisper gate closed) falls through to 経路3
   *   経路3 no ASR ran → disclosed placeholder: fixed sentences over the
   *          chunk plan with PLACEHOLDER_CHUNK_CONFIDENCE and
   *          result.placeholder === true (TC-408-03)
   */
  async transcribeStream(
    audioFile: string | File,
    onProgress?: StreamingProgressCallback,
    onSegment?: SegmentCallback
  ): Promise<TranscriptionResult> {
    const startTime = performance.now();

    // Duration is probed at most once per run and shared by the routes that
    // need it (経路1's progress denominator, 経路3's chunk-count disclosure).
    // A probe failure never blocks routing — 経路3 just discloses an empty
    // segment plan (dataflow.md error flow: no ASR ran, so the honest result
    // is a disclosed placeholder, never a rejected transcription).
    let probedDurationSec: number | null = null;
    const probeDuration = async (): Promise<number> => {
      if (probedDurationSec === null) {
        try {
          probedDurationSec = await this.getAudioDuration(audioFile);
        } catch (error) {
          logger.warn('[StreamingTranscriber] Audio duration probe failed, disclosing empty placeholder plan:', error);
          probedDurationSec = 0;
        }
      }
      return probedDurationSec;
    };

    // 経路1: browser + File + Web Speech constructors → shared file engine
    if (
      typeof window !== 'undefined' &&
      typeof File !== 'undefined' &&
      audioFile instanceof File &&
      this.isFileEngineAvailable()
    ) {
      const engineResult = await this.transcribeStreamViaWebSpeech(
        audioFile,
        onProgress,
        onSegment,
        probeDuration,
        startTime,
      );
      if (engineResult !== null) {
        return engineResult;
      }
      // Engine errored with zero finals → 経路3 fallback below
    }

    // 経路2: Node → whisperTranscriber delegation
    if (typeof window === 'undefined') {
      try {
        const whisperResult = await whisperTranscriber.transcribe(audioFile);
        if (whisperResult.placeholder !== true) {
          return this.buildDelegatedResult(whisperResult, onProgress, startTime);
        }
        // Whisper gate closed (its own disclosed placeholder) — streaming must
        // not adopt whisper's fixed sentences; fall through to 経路3
      } catch (error) {
        // whisper throw (e.g. undecodable input / missing file) is a
        // gate-closed outcome here, not a rejected transcription — fall
        // through to the disclosed placeholder (dataflow.md error flow).
        logger.warn('[StreamingTranscriber] Whisper transcription failed, using disclosed placeholder:', error);
      }
    }

    // 経路3: disclosed placeholder
    return this.buildPlaceholderResult(audioFile, onProgress, onSegment, probeDuration, startTime);
  }

  /**
   * Web Speech file engine reachable? The engine resolves the constructors
   * from globalThis itself; this check only decides ROUTING (経路1 vs 経路3).
   */
  private isFileEngineAvailable(): boolean {
    const globals = globalThis as Record<string, unknown>;
    return Boolean(globals.SpeechRecognition || globals.webkitSpeechRecognition);
  }

  /**
   * 経路1: delegate to the shared Web Speech file engine (TASK-0318) and
   * forward its real final-result events — one onSegment + one onProgress
   * PER final result, no synthetic completion stagger (SD3).
   *
   * Returns null when the run errored with zero finals (engine onerror never
   * throws by contract) or the engine itself rejected — both are 経路3
   * fallbacks, not rejected transcriptions.
   */
  private async transcribeStreamViaWebSpeech(
    audioFile: File,
    onProgress: StreamingProgressCallback | undefined,
    onSegment: SegmentCallback | undefined,
    probeDuration: () => Promise<number>,
    startTime: number
  ): Promise<TranscriptionResult | null> {
    const totalDurationMs = (await probeDuration()) * 1000;
    const segments: TranscriptionSegment[] = [];
    let errored = false;

    try {
      const finalSegments = await transcribeFileWithWebSpeech(audioFile, {
        onFinalSegment: (segment) => {
          segments.push(segment);
          if (onSegment) {
            try {
              onSegment(segment);
            } catch (cbError) {
              logger.warn('[StreamingTranscriber] onSegment callback error:', cbError);
            }
          }
          if (onProgress) {
            try {
              const progress: StreamingProgress = {
                processedDuration: segment.end,
                totalDuration: totalDurationMs,
                currentSegment: segment,
                segmentCount: segments.length,
                averageConfidence: this.calculateAverageConfidence(segments),
              };
              onProgress(progress);
            } catch (cbError) {
              logger.warn('[StreamingTranscriber] onProgress callback error:', cbError);
            }
          }
        },
        onError: () => {
          errored = true;
        },
      });
      // The engine's return value is the authoritative utterance list (a
      // caller may omit hooks); adopt it for the result.
      segments.length = 0;
      segments.push(...finalSegments);
      if (errored && segments.length === 0) return null;
    } catch (error) {
      logger.warn('[StreamingTranscriber] Web Speech file engine failed, using disclosed placeholder:', error);
      return null;
    }

    // Engine utterances are adopted AS-IS: adjacent utterances are distinct
    // real results, not duplicates to merge away (merge stays a 経路3 tool).
    const result: TranscriptionResult = {
      segments,
      text: segments.map(s => s.text).join(' '),
      duration: totalDurationMs,
      // Content-derived (round 22): delegates to the shared detector like
      // the other TranscriptionResult producers.
      language: detectTranscriptionLanguage(segments),
      processingTime: performance.now() - startTime,
      success: true,
      placeholder: false,
      qualitySummary: this.qualityMonitor?.getSummary(),
    };
    return result;
  }

  /**
   * 経路2 result: adopt the delegated transcription's segments as-is and
   * emit exactly ONE completion onProgress — single-shot inference had no
   * incremental events to forward.
   */
  private buildDelegatedResult(
    delegated: TranscriptionResult,
    onProgress: StreamingProgressCallback | undefined,
    startTime: number
  ): TranscriptionResult {
    const segments = delegated.segments;
    if (onProgress) {
      try {
        const progress: StreamingProgress = {
          processedDuration: delegated.duration,
          totalDuration: delegated.duration,
          currentSegment: segments[segments.length - 1] ?? null,
          segmentCount: segments.length,
          averageConfidence: this.calculateAverageConfidence(segments),
        };
        onProgress(progress);
      } catch (cbError) {
        logger.warn('[StreamingTranscriber] onProgress callback error:', cbError);
      }
    }
    return {
      segments,
      text: segments.map(s => s.text).join(' '),
      duration: delegated.duration,
      language: delegated.language,
      processingTime: performance.now() - startTime,
      success: true,
      placeholder: false,
      qualitySummary: this.qualityMonitor?.getSummary(),
    };
  }

  /**
   * 経路3 result: the disclosed placeholder. No ASR ran, so the run reports
   * fixed sentences over the chunk plan with PLACEHOLDER_CHUNK_CONFIDENCE
   * and placeholder: true — never a bare success dressed up as a
   * measurement (TC-408-03).
   */
  private async buildPlaceholderResult(
    audioFile: string | File,
    onProgress: StreamingProgressCallback | undefined,
    onSegment: SegmentCallback | undefined,
    probeDuration: () => Promise<number>,
    startTime: number
  ): Promise<TranscriptionResult> {
    const audioDuration = await probeDuration();
    const chunks = this.createAudioChunks(audioDuration);
    const allSegments: TranscriptionSegment[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {

        const chunkSegments = await this.processAudioChunk(chunk, audioFile);

        // Add segments with confidence filtering
        // minConfidence can legitimately be 0 (accept all); use ?? so only
        // undefined falls back to the 0.7 default, not an explicit 0.
        // `?? NaN` on the segment side for the same reason: an undefined or
        // NaN confidence must stay BELOW the threshold (`undefined >= x` was
        // always false); a 0 fallback would flip the minConfidence: 0 case
        // from filtered to accepted.
        const validSegments = chunkSegments.filter(
          segment => (segment.confidence ?? Number.NaN) >= (this.config.minConfidence ?? 0.7)
        );

        // Collect segments BEFORE quality monitoring so that a quality
        // monitor failure cannot destroy transcription results
        allSegments.push(...validSegments);

        // REQ-091: Record per-chunk quality with StreamingQualityMonitor
        if (this.qualityMonitor) {
          const chunkAvgConfidence = chunkSegments.length > 0
            ? chunkSegments.reduce((s, seg) => s + sanitizeFinite(seg.confidence), 0) / chunkSegments.length
            : 0;
          this.qualityMonitor.evaluateChunk(i, chunkAvgConfidence);
        }

        // Real-time segment callback (per-segment guard ensures one
        // failing callback does not skip remaining segments)
        if (onSegment && validSegments.length > 0) {
          for (const segment of validSegments) {
            try {
              onSegment(segment);
            } catch (cbError) {
              logger.warn('[StreamingTranscriber] onSegment callback error:', cbError);
            }
          }
        }

      } catch (chunkError) {
        logger.warn(`[StreamingTranscriber] Chunk ${i + 1} processing failed, continuing:`, chunkError);
        // Continue with next chunk instead of failing completely
      }
    }

    // Merge overlapping segments
    const mergedSegments = this.mergeOverlappingSegments(allSegments);

    // One completion progress event for the whole placeholder plan (no
    // per-chunk stagger — the chunks were never really processed)
    if (onProgress) {
      try {
        const progress: StreamingProgress = {
          processedDuration: audioDuration * 1000,
          totalDuration: audioDuration * 1000,
          currentSegment: mergedSegments[mergedSegments.length - 1] ?? null,
          segmentCount: mergedSegments.length,
          averageConfidence: this.calculateAverageConfidence(mergedSegments),
        };
        onProgress(progress);
      } catch (cbError) {
        logger.warn('[StreamingTranscriber] onProgress callback error:', cbError);
      }
    }

    const result: TranscriptionResult = {
      segments: mergedSegments,
      text: mergedSegments.map(s => s.text).join(' '),
      duration: audioDuration * 1000,
      // Content-derived (round 22): was a hardcoded 'ja', which labeled this
      // path's own English chunk-mock output as Japanese. Delegates to the
      // shared detector like the other TranscriptionResult producers.
      language: detectTranscriptionLanguage(mergedSegments),
      processingTime: performance.now() - startTime,
      success: true,
      placeholder: true,
      qualitySummary: this.qualityMonitor?.getSummary(),
    };

    return result;
  }

  /**
   * Start live microphone transcription
   */
  async startLiveTranscription(
    onSegment?: SegmentCallback,
    onProgress?: StreamingProgressCallback
  ): Promise<void> {
    if (!this.recognition) {
      throw new TranscriptionError('Speech recognition not supported in this browser');
    }

    if (this.isStreaming) {
      logger.warn('[StreamingTranscriber] Live transcription already running');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new TranscriptionError('Recognition not available'));

      let interimTranscript = '';
      let finalTranscript = '';
      // Origin for recording-relative timestamps. performance.now() is measured
      // from page load, so subtracting this base keeps the first spoken segment
      // near 0ms instead of offset by however long the page had been open.
      const recordingStartTime = performance.now();
      let segmentStartTime = recordingStartTime;

      this.recognition.onresult = (event) => {
        interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const alt = event.results[i]?.[0];
          if (!alt) continue;
          const transcript = alt.transcript;
          const confidence = alt.confidence;

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';

            // Create segment for completed phrase — timestamps in MILLISECONDS,
            // recording-relative (see TranscriptionSegment contract).
            // The confidence is captured in a const because the literal types it
            // optional (TranscriptionSegment.confidence?): reading it back for
            // the threshold compare would need a non-null assertion, while the
            // local const is the exact number just computed.
            // REQ-393: a missing/non-positive confidence falls back to the
            // module's own named placeholder chunk confidence, not a bare
            // 0.8 — one disclosed constant for every "chunk had no usable
            // confidence" path in this file.
            const segmentConfidence = Number.isFinite(confidence) && confidence > 0
              ? confidence
              : PLACEHOLDER_CHUNK_CONFIDENCE;
            const segment: TranscriptionSegment = {
              start: segmentStartTime - recordingStartTime,
              end: performance.now() - recordingStartTime,
              text: transcript.trim(),
              confidence: segmentConfidence,
              speaker: 'unknown'
            };

            if (segmentConfidence >= (this.config.minConfidence ?? 0.7)) {
              this.segments.push(segment);
              this.accumulatedText += segment.text + ' ';

              if (onSegment) {
                try {
                  onSegment(segment);
                } catch (cbError) {
                  logger.warn('[StreamingTranscriber] onSegment callback error in live transcription:', cbError);
                }
              }
            }

            segmentStartTime = performance.now();
          } else {
            interimTranscript += transcript;
          }
        }

        // Progress update for live transcription
        if (onProgress) {
          try {
            const progress: StreamingProgress = {
              processedDuration: performance.now() - segmentStartTime,
              totalDuration: -1, // Unknown for live
              currentSegment: interimTranscript ? {
                start: segmentStartTime - recordingStartTime,
                end: performance.now() - recordingStartTime,
                text: interimTranscript,
                confidence: 0.5, // Interim confidence
                speaker: 'unknown'
              } : null,
              segmentCount: this.segments.length,
              averageConfidence: this.calculateAverageConfidence(this.segments)
            };
            onProgress(progress);
          } catch (cbError) {
            logger.warn('[StreamingTranscriber] onProgress callback error in live transcription:', cbError);
          }
        }
      };

      this.recognition.start();

      // Resolve immediately for continuous operation
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Stop live transcription
   */
  stopLiveTranscription(): void {
    if (this.recognition && this.isStreaming) {
      this.recognition.stop();
    }
  }

  /**
   * Destroy the transcriber and release all resources.
   * Removes event listeners, stops recognition, and clears state.
   */
  destroy(): void {
    if (this.recognition) {
      this.stopLiveTranscription();
      this.recognition.onstart = null;
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      this.recognition = null;
    }
    this.isStreaming = false;
    this.segments = [];
    this.accumulatedText = '';
    this.qualityMonitor = null;
  }

  /**
   * Create audio chunks for processing
   */
  private createAudioChunks(duration: number): Array<{ start: number; end: number }> {
    const chunks: Array<{ start: number; end: number }> = [];
    if (!Number.isFinite(duration) || duration <= 0) return chunks;
    const chunkSize = (this.config.chunkSizeMs || 3000) / 1000;
    // overlapMs can legitimately be 0 (no overlap); use ?? so only undefined
    // falls back to the 500ms default, not an explicit 0.
    const overlap = (this.config.overlapMs ?? 500) / 1000;

    let start = 0;
    while (start < duration) {
      const end = Math.min(start + chunkSize, duration);
      chunks.push({ start, end });
      start += chunkSize - overlap; // Move forward with overlap
    }

    return chunks;
  }

  /**
   * Process individual audio chunk (経路3 disclosed-placeholder emitter)
   *
   * Fixed placeholder sentences sized by the chunk plan — no ASR behind
   * them. Every segment carries the disclosed PLACEHOLDER_CHUNK_CONFIDENCE
   * and the enclosing run reports placeholder: true (TASK-0319).
   */
  private async processAudioChunk(
    chunk: { start: number; end: number },
    audioFile: string | File
  ): Promise<TranscriptionSegment[]> {
    const chunkDuration = chunk.end - chunk.start;

    // Generate placeholder segments for the chunk
    const segmentCount = Math.max(1, Math.floor(chunkDuration / 2)); // One segment per 2 seconds
    const segments: TranscriptionSegment[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const segmentStart = chunk.start + (i * chunkDuration / segmentCount);
      const segmentEnd = chunk.start + ((i + 1) * chunkDuration / segmentCount);

      // Chunk math above is in seconds, but the TranscriptionSegment contract is
      // MILLISECONDS (whisper/browser/transcriber/srt-generator all agree, and
      // this file's own result.duration is audioDuration*1000). Emit ms so the
      // segments are consistent with duration and every other producer.
      segments.push({
        start: segmentStart * 1000,
        end: segmentEnd * 1000,
        text: `Processed segment ${i + 1} from chunk ${chunk.start.toFixed(1)}s-${chunk.end.toFixed(1)}s`,
        // Deterministic disclosed placeholder: this chunk processor simulates
        // transcription (fixed text above), so no confidence is measured. The
        // former `0.75 + Math.random() * 0.2` faked measurement variance
        // (REQ-391); pinned to the old range's lower bound.
        confidence: PLACEHOLDER_CHUNK_CONFIDENCE,
        speaker: 'unknown'
      });
    }

    return segments;
  }

  /**
   * Get audio duration from file
   */
  private async getAudioDuration(audioFile: string | File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      let objectUrl: string | null = null;

      const cleanup = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      };

      audio.onloadedmetadata = () => {
        cleanup();
        const dur = audio.duration;
        resolve(Number.isFinite(dur) ? dur : 0);
      };

      audio.onerror = () => {
        cleanup();
        reject(new TranscriptionError('Failed to load audio file'));
      };

      if (typeof audioFile === 'string') {
        audio.src = audioFile;
      } else {
        objectUrl = URL.createObjectURL(audioFile);
        audio.src = objectUrl;
      }
    });
  }

  /**
   * Merge overlapping segments to avoid duplication
   */
  private mergeOverlappingSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
    if (segments.length === 0) return [];

    // Sort by start time
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const merged: TranscriptionSegment[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastMerged = merged[merged.length - 1];

      // Check for overlap (segments are in milliseconds → 500ms tolerance)
      if (current.start <= lastMerged.end + 500) {
        // Merge segments
        lastMerged.end = Math.max(lastMerged.end, current.end);
        lastMerged.text += ' ' + current.text;
        lastMerged.confidence = (sanitizeFinite(lastMerged.confidence) +
          sanitizeFinite(current.confidence)) / 2;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Calculate average confidence across segments
   */
  private calculateAverageConfidence(segments: TranscriptionSegment[]): number {
    if (segments.length === 0) return 0;

    const totalConfidence = segments.reduce((sum, segment) =>
      sum + sanitizeFinite(segment.confidence), 0);
    return totalConfidence / segments.length;
  }

  /**
   * Check if streaming is currently active
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Get current configuration
   */
  getConfig(): StreamingTranscriptionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * Validates the merged config with the same rules as the constructor. This is
   * required because createAudioChunks advances by `chunkSize - overlap`; an
   * overlapMs >= chunkSizeMs (or chunkSizeMs <= 0) makes that step non-positive
   * and the chunk loop never terminates.
   */
  updateConfig(newConfig: Partial<StreamingTranscriptionConfig>): void {
    const candidate: StreamingTranscriptionConfig = { ...this.config, ...newConfig };
    // The merged fields can hold explicit `undefined` (a spread override), and
    // the old `candidate.x!` compares let `undefined` pass every check
    // (`undefined <= 0` is false). The `!== undefined` guards below preserve
    // that and mirror the constructor's own validation shape.
    const { chunkSizeMs, minConfidence, overlapMs } = candidate;

    if (chunkSizeMs !== undefined && (chunkSizeMs <= 0 || chunkSizeMs > 60000)) {
      throw new TranscriptionError(
        `chunkSizeMs must be > 0 and <= 60000, got ${chunkSizeMs}`
      );
    }
    if (minConfidence !== undefined && (minConfidence < 0 || minConfidence > 1)) {
      throw new TranscriptionError(
        `minConfidence must be between 0 and 1, got ${minConfidence}`
      );
    }
    if (overlapMs !== undefined && overlapMs < 0) {
      throw new TranscriptionError(`overlapMs must be >= 0, got ${overlapMs}`);
    }
    // Validate against the EFFECTIVE (merged) chunkSizeMs so a combined update
    // such as { chunkSizeMs: 100, overlapMs: 500 } is rejected — otherwise
    // createAudioChunks would loop forever.
    if (overlapMs !== undefined && chunkSizeMs !== undefined && overlapMs >= chunkSizeMs) {
      throw new TranscriptionError(
        `overlapMs (${overlapMs}) must be less than chunkSizeMs (${chunkSizeMs})`
      );
    }

    this.config = candidate;
  }

  // --- REQ-091: Quality Monitoring API ---

  /**
   * Register a callback for quality alerts during streaming.
   *
   * Propagates the unsubscribe from the underlying StreamingQualityMonitor (see
   * `onAlert`). If no session monitor is active the callback is not registered,
   * so a no-op unsubscribe is returned — still safe to call on teardown per the
   * listener-leak contract.
   */
  onQualityAlert(callback: StreamingQualityAlertCallback): () => void {
    if (this.qualityMonitor) {
      return this.qualityMonitor.onAlert(callback);
    }
    return () => {};
  }

  /**
   * Get the quality summary from the last streaming session.
   */
  getQualitySummary(): StreamingQualitySummary | null {
    return this.qualityMonitor?.getSummary() ?? null;
  }

  /**
   * Get the underlying quality monitor (for advanced usage).
   */
  getQualityMonitor(): StreamingQualityMonitor | null {
    return this.qualityMonitor;
  }
}

/**
 * Factory function for creating streaming transcriber instances
 */
export const createStreamingTranscriber = (config?: StreamingTranscriptionConfig): StreamingTranscriber => {
  return new StreamingTranscriber(config);
};

/**
 * Utility function to validate streaming capabilities
 */
export const validateStreamingSupport = (): {
  webSpeechAPI: boolean;
  mediaDevices: boolean;
  audioContext: boolean;
  recommendation: string;
} => {
  // typeof-guards keep the probe Node-safe (TASK-0319 SD6): outside a browser
  // every capability is false and the recommendation says so.
  const hasWindow = typeof window !== 'undefined';
  const webSpeechAPI = hasWindow && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const mediaDevices =
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;
  const audioContext = hasWindow && ('AudioContext' in window || 'webkitAudioContext' in window);

  let recommendation = '';
  if (!webSpeechAPI) {
    recommendation = 'Use Chrome or Edge for best speech recognition support';
  } else if (!mediaDevices) {
    recommendation = 'Microphone access required for live transcription';
  } else if (!audioContext) {
    recommendation = 'Web Audio API needed for advanced audio processing';
  } else {
    recommendation = 'Full streaming support available';
  }

  return {
    webSpeechAPI,
    mediaDevices,
    audioContext,
    recommendation
  };
};