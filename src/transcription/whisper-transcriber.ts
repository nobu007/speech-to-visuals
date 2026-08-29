/**
 * Real Whisper.cpp Integration for High-Quality Transcription
 * Enhanced implementation following custom instructions (段階的改善実装)
 */

import {
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionError,
  FileSizeExceededError,
  SUPPORTED_AUDIO_FORMATS,
  MAX_FILE_SIZE,
} from './types';
import { formatTimestamp } from './srt-generator';
import { detectTranscriptionLanguage } from './language-detection';
import { Caption } from '@remotion/captions';
import { logger } from '@stv/core/utils/logger';
import { sanitizeFinite } from '@stv/core/utils/guards';
import { validateAudioFile } from '@stv/core/utils/audio-validation';

export interface WhisperConfig {
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  temperature?: number;
  maxSegmentLength?: number;
  enableTimestamps?: boolean;
}

/**
 * Confidence stamped on placeholder-path segments (REQ-391). The placeholder
 * pipeline emits fixed text with no ASR behind it, so no confidence is
 * measured; this constant is the disclosed stand-in, pinned to the lower
 * bound of the former `0.95 + Math.random() * 0.05` so no threshold consumer
 * reads an inflated value.
 */
export const PLACEHOLDER_SEGMENT_CONFIDENCE = 0.95;

// ---------------------------------------------------------------------------
// Real whisper.cpp inference wiring (README「音声認識の現状」)
//
// The server path used to be a placeholder emitter: initializeNodeWhisper()
// probed `import('whisper-node')` once and discarded the result, and no code
// ever called the model. The probe was worse than useless — whisper-node's
// module load chdirs the whole process (shell.ts `cd` into lib/whisper.cpp)
// and, when the compiled `main` binary is missing, runs a synchronous `make`
// and then `process.exit(1)` (see tests/__mocks__/whisper-node.ts). The
// wiring below loads the backend LAZILY, strictly behind a compiled-binary +
// ggml-model existence gate, so a process without a whisper install never
// touches the package at all.
// ---------------------------------------------------------------------------

/** One row of whisper-node's parsed output ("HH:MM:SS.mmm" timestamps + text). */
export interface RawWhisperRow {
  start: string;
  end: string;
  speech: string;
}

/** Callable shape of whisper-node's default export (whisper-node.d.ts keeps it `any`). */
export type WhisperBackend = (
  filePath: string,
  options?: {
    modelPath?: string;
    whisperOptions?: { language?: string; word_timestamps?: boolean };
  }
) => Promise<RawWhisperRow[] | null | undefined>;

/** Compiled whisper.cpp `main` + ggml model — both must exist before the backend loads. */
export interface WhisperInferencePaths {
  binaryPath: string;
  modelPath: string;
}

/** Runtime injection: tests fake the backend + paths; production uses the fs probe + lazy import. */
export interface WhisperRuntime {
  backend?: WhisperBackend;
  /** Injected paths are trusted as-is (no existence check). `null` force-disables inference. */
  inferencePaths?: WhisperInferencePaths | null;
}

/**
 * Parse a whisper.cpp timestamp ("HH:MM:SS.mmm"; the hours part is optional)
 * into milliseconds. Returns null for anything else — callers drop the row
 * rather than emit a segment with a fabricated time.
 */
export function parseWhisperTimestampToMs(timestamp: string): number | null {
  if (typeof timestamp !== 'string') return null;
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)$/.exec(timestamp.trim());
  if (!match) return null;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);
  const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
  return Number.isFinite(ms) ? Math.round(ms) : null;
}

/**
 * Convert whisper-node rows into TranscriptionSegments. Returns null unless at
 * least one usable row survives: whisper-node swallows its own errors and
 * resolves `undefined`, and an empty/garbage array is indistinguishable from a
 * failed run — both must fall through to the disclosed placeholder, never be
 * reported as a (zero-segment) real transcription.
 *
 * Surviving segments carry NO confidence: whisper.cpp's default output has
 * none, so `confidence` stays undefined ("unmeasured") instead of being
 * stamped with a dressed-up number.
 */
export function convertWhisperRows(rows: RawWhisperRow[] | null | undefined): TranscriptionSegment[] | null {
  if (!Array.isArray(rows)) return null;
  const segments: TranscriptionSegment[] = [];
  for (const row of rows) {
    const text = typeof row?.speech === 'string' ? row.speech.trim() : '';
    if (!text) continue;
    const start = parseWhisperTimestampToMs(row.start);
    const end = parseWhisperTimestampToMs(row.end);
    if (start === null || end === null || end <= start) continue;
    segments.push({ id: segments.length, start, end, text });
  }
  return segments.length > 0 ? segments : null;
}

/**
 * Walk up from `startDir` to the first ancestor containing a whisper-node
 * whisper.cpp checkout. Walking (instead of trusting cwd) matters because
 * whisper-node chdirs the process at module load — the same defense
 * actual-video-renderer.ts mounts for its project-root lookup.
 */
function findWhisperCppDir(startDir: string, exists: (p: string) => boolean): string | null {
  let current = startDir;
  for (;;) {
    const candidate = `${current}/node_modules/whisper-node/lib/whisper.cpp`;
    if (exists(candidate)) return candidate;
    const parent = current.slice(0, current.lastIndexOf('/'));
    if (!parent || parent === current) return null;
    current = parent;
  }
}

/**
 * Resolve the binary + model pair for real inference, or null when either is
 * missing. Pure over injected `deps` — Node callers pass fs.existsSync /
 * process.cwd() / process.env; tests pass fakes.
 *
 * Model resolution order: STV_WHISPER_MODEL env (explicit .bin file, e.g.
 * fetched via `npx whisper-node download` or @remotion/install-whisper-cpp)
 * → whisper-node's own `models/ggml-<model>.bin` layout.
 */
export function resolveWhisperInferencePaths(
  model: WhisperConfig['model'],
  deps: {
    exists: (p: string) => boolean;
    startDir: string;
    env?: { STV_WHISPER_MODEL?: string };
  }
): WhisperInferencePaths | null {
  const cppDir = findWhisperCppDir(deps.startDir, deps.exists);
  if (!cppDir) return null;
  const binaryPath = `${cppDir}/main`;
  const envModel = deps.env?.STV_WHISPER_MODEL;
  const modelPath = envModel && deps.exists(envModel) ? envModel : `${cppDir}/models/ggml-${model}.bin`;
  if (!deps.exists(binaryPath) || !deps.exists(modelPath)) return null;
  return { binaryPath, modelPath };
}

/**
 * Extract file extension from a File object name or path string
 */
function getAudioFormat(input: File | ArrayBuffer | string): string | null {
  if (input instanceof File) {
    const ext = input.name.split('.').pop()?.toLowerCase() ?? null;
    return ext;
  }
  if (typeof input === 'string') {
    const ext = input.split('.').pop()?.toLowerCase() ?? null;
    return ext;
  }
  return null;
}

/**
 * Enhanced Whisper Transcriber
 * Real implementation with fallback strategies (段階的フォールバック)
 */
export class WhisperTranscriber {
  private config: WhisperConfig;
  private runtime: WhisperRuntime;
  private isWhisperReady: boolean = false;
  private iterationCount: number = 0;

  constructor(config: Partial<WhisperConfig> = {}, runtime: WhisperRuntime = {}) {
    this.config = {
      model: 'base',
      language: 'auto',
      temperature: 0.0,
      maxSegmentLength: 10000, // 10 seconds
      enableTimestamps: true,
      ...config
    };
    this.runtime = runtime;

    // No eager whisper-node probe here. The old constructor kicked off an
    // (un-awaited) `import('whisper-node')` whose module load chdirs the
    // process and falls back to a synchronous `make` + `process.exit(1)`
    // when the compiled binary is absent — a boot-time landmine for the API
    // server. The backend is now loaded lazily inside attemptRealInference(),
    // strictly behind the binary+model existence gate.
  }

  /**
   * Update config after construction. Config values are read LIVE at
   * transcribe-time (language at detection, maxSegmentLength at chunking,
   * model/enableTimestamps in the emitted result), so a plain merge takes
   * effect on the next transcribe() call without re-running the
   * side-effectful initializeWhisper(). Lets the orchestrator push
   * user/auto-tuned transcription config into an instance it built once.
   */
  updateConfig(partial: Partial<WhisperConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Server-path real whisper.cpp inference. Returns the converted segments
   * only when whisper actually produced them; every other outcome (browser
   * environment, gate closed, module unavailable, whisper failure, empty
   * output) returns null and the caller falls through to the disclosed
   * placeholder emitters.
   */
  private async attemptRealInference(audioInput: File | ArrayBuffer | string): Promise<TranscriptionSegment[] | null> {
    if (typeof window !== 'undefined') return null; // browser: the Web Speech engine owns transcription
    const paths = await this.resolveInferencePaths();
    if (!paths) return null;
    const backend = await this.loadBackend();
    if (!backend) return null;
    const staged = await this.stageAudioForWhisper(audioInput);
    try {
      const whisperOptions =
        this.config.language && this.config.language !== 'auto'
          ? { language: this.config.language }
          : undefined;
      const rows = await backend(staged.path, { modelPath: paths.modelPath, whisperOptions });
      return convertWhisperRows(rows);
    } catch (error) {
      logger.warn('[WhisperTranscriber] whisper.cpp inference failed, using disclosed placeholder:', error);
      return null;
    } finally {
      await staged.cleanup();
    }
  }

  /**
   * Resolve the inference gate. Injected paths (tests) are trusted as-is;
   * production probes the filesystem from cwd.
   */
  private async resolveInferencePaths(): Promise<WhisperInferencePaths | null> {
    if (this.runtime.inferencePaths !== undefined) return this.runtime.inferencePaths;
    const fs = await import('fs');
    return resolveWhisperInferencePaths(this.config.model, {
      exists: (p) => fs.existsSync(p),
      startDir: process.cwd(),
      env: process.env,
    });
  }

  /**
   * Load the whisper-node callable. Lazy + cwd-restoring: the package chdirs
   * the process at module load, and under jest it is mapped to an empty stub
   * with no default export — which resolves to null here, keeping the gate
   * closed in test processes.
   */
  private async loadBackend(): Promise<WhisperBackend | null> {
    if (this.runtime.backend !== undefined) return this.runtime.backend;
    const cwd = process.cwd();
    try {
      const mod = (await import('whisper-node')) as { default?: unknown };
      if (typeof mod.default !== 'function') return null;
      this.isWhisperReady = true;
      return mod.default as WhisperBackend;
    } catch {
      return null;
    } finally {
      if (process.cwd() !== cwd) process.chdir(cwd);
    }
  }

  /**
   * Stage the audio where whisper.cpp can read it. whisper-node takes a real
   * file path, so File/ArrayBuffer inputs are written to a temp file (removed
   * after inference); a plain path string is read in place and never deleted.
   */
  private async stageAudioForWhisper(
    audioInput: File | ArrayBuffer | string
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    if (typeof audioInput === 'string') {
      if (!audioInput.startsWith('blob:')) {
        return { path: audioInput, cleanup: async () => {} };
      }
      const response = await fetch(audioInput);
      return this.writeTempAudio(Buffer.from(await response.arrayBuffer()), 'wav');
    }
    const buffer =
      audioInput instanceof File
        ? Buffer.from(await audioInput.arrayBuffer())
        : Buffer.from(audioInput);
    // Preserve the original extension: whisper.cpp reads WAV natively and
    // fails on its own for anything it cannot decode — that failure must be
    // distinguishable from a wrong-format staging artifact.
    const ext = audioInput instanceof File ? (audioInput.name.split('.').pop() ?? 'wav') : 'wav';
    return this.writeTempAudio(buffer, ext);
  }

  private async writeTempAudio(buffer: Buffer, ext: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const fs = await import('fs');
    const os = await import('os');
    const crypto = await import('crypto');
    const path = `${os.tmpdir()}/stv-whisper-${process.pid}-${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path, buffer);
    return {
      path,
      cleanup: async () => {
        try {
          fs.rmSync(path);
        } catch {
          // best-effort temp cleanup
        }
      },
    };
  }

  /**
   * Validate audio input: format, size, corruption check.
   * For File inputs, delegates basic validation to centralized validateAudioFile().
   * For ArrayBuffer/string inputs, performs inline validation.
   */
  private validateAudioInput(audioInput: File | ArrayBuffer | string): void {
    if (audioInput instanceof File) {
      // Delegate to centralized validation (REQ-146)
      const result = validateAudioFile(audioInput);
      if (!result.valid) {
        const msg = result.errors[0];
        if (msg.includes('size') && msg.includes('exceeds')) {
          throw new FileSizeExceededError(msg, audioInput.size, MAX_FILE_SIZE);
        }
        throw new TranscriptionError(msg);
      }
      return;
    }

    // Non-File inputs: inline validation
    const format = getAudioFormat(audioInput);
    if (format && !(SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(format)) {
      throw new TranscriptionError(
        `Unsupported audio format: .${format}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`
      );
    }

    if (audioInput instanceof ArrayBuffer) {
      if (audioInput.byteLength > MAX_FILE_SIZE) {
        throw new FileSizeExceededError(
          `Buffer size (${audioInput.byteLength} bytes) exceeds maximum allowed size (${MAX_FILE_SIZE} bytes)`,
          audioInput.byteLength,
          MAX_FILE_SIZE
        );
      }
      if (audioInput.byteLength === 0) {
        throw new TranscriptionError('Audio buffer is empty (0 bytes)');
      }
    }
  }

  /**
   * Check for corrupted audio data by examining magic bytes
   */
  private checkCorruption(audioBuffer: ArrayBuffer): void {
    if (audioBuffer.byteLength < 4) {
      throw new TranscriptionError('Audio file is too small to be a valid audio file (corrupted)');
    }

    const view = new Uint8Array(audioBuffer, 0, Math.min(12, audioBuffer.byteLength));

    // Check for known audio format magic bytes
    const isMp3 = view[0] === 0xFF && (view[1] & 0xE0) === 0xE0; // MP3 sync word
    const isRiff = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // RIFF (WAV)
    const isOgg = view[0] === 0x4F && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53; // OGG
    const isMp4 = view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70; // ftyp (M4A/MP4)

    if (!isMp3 && !isRiff && !isOgg && !isMp4) {
      throw new TranscriptionError('Audio file appears to be corrupted or is not a valid audio format');
    }
  }

  /**
   * Main transcription method with progressive enhancement
   * 段階的改善を適用した音声認識処理
   */
  async transcribe(audioInput: File | ArrayBuffer | string): Promise<TranscriptionResult> {
    const startTime = performance.now();
    this.iterationCount++;

    // Step 1: Validate input (format, size, corruption)
    this.validateAudioInput(audioInput);

    // Step 2: Run REAL whisper.cpp inference when the server environment has
    // a compiled binary + model (README「音声認識の現状」). attemptRealInference
    // returns null unless whisper actually produced segments — gate closed,
    // module missing, whisper failure and empty output all fall through to the
    // placeholder emitters below.
    const inferred = await this.attemptRealInference(audioInput);
    const inferenceRan = inferred !== null;

    let segments: TranscriptionSegment[];
    if (inferred !== null) {
      segments = inferred;
    } else {
      // Step 2b: Preprocess input to ArrayBuffer + corruption check
      const processedAudio = await this.preprocessAudio(audioInput);
      this.checkCorruption(processedAudio);

      // Neither emitter below runs ASR inference: runRealWhisperTranscription
      // emits fixed sentences via generateHighQualityTranscript() and
      // runEnhancedFallback a hardcoded English block. The result must
      // disclose `placeholder: true` so the pipeline's priority routing
      // cannot mistake the fabricated success for a measured transcription
      // (which kept the browser Web Speech fallback unreachable).
      segments = this.isWhisperReady
        ? await this.runRealWhisperTranscription(processedAudio)
        : await this.runEnhancedFallback(processedAudio);
    }

    // Step 4: Post-process and validate results
    const validatedSegments = await this.validateAndEnhanceSegments(segments);

    // Step 5: Generate Remotion-compatible captions
    const captions = this.generateCaptions(validatedSegments);

    // Determine language (auto-detect or config-specified)
    const language = this.config.language === 'auto'
      ? this.detectLanguageFromSegments(validatedSegments)
      : this.config.language ?? this.detectLanguageFromSegments(validatedSegments);

    const result: TranscriptionResult = {
      text: validatedSegments.map(s => s.text).join(' '),
      segments: validatedSegments,
      language,
      duration: this.calculateDuration(validatedSegments),
      processingTime: performance.now() - startTime,
      success: true,
      placeholder: !inferenceRan,
      captions
    };

    // Step 6: Log metrics for progressive improvement
    this.logTranscriptionMetrics(result);

    return result;
  }

  /**
   * Preprocess audio for optimal transcription
   */
  private async preprocessAudio(audioInput: File | ArrayBuffer | string): Promise<ArrayBuffer> {

    if (audioInput instanceof File) {
      return await audioInput.arrayBuffer();
    } else if (audioInput instanceof ArrayBuffer) {
      return audioInput;
    } else if (typeof audioInput === 'string') {
      if (audioInput.startsWith('blob:')) {
        const response = await fetch(audioInput);
        return await response.arrayBuffer();
      } else if (typeof window === 'undefined') {
        // Server route: a plain filesystem path (batch pipeline, accuracy
        // harness). The pipeline validates readability before calling; in
        // Node the bytes come off disk. The browser bundle has no fs, so the
        // error below stays browser-only.
        const fs = await import('fs');
        const buffer = fs.readFileSync(audioInput);
        return buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer;
      } else {
        throw new TranscriptionError('String file paths not supported in browser environment');
      }
    }

    throw new TranscriptionError('Unsupported audio input format');
  }

  /**
   * Placeholder emitter used when real inference was attempted (backend
   * loaded) but whisper produced nothing — fixed sentences, no ASR behind
   * them, disclosed via `placeholder: true`.
   */
  private async runRealWhisperTranscription(audioBuffer: ArrayBuffer): Promise<TranscriptionSegment[]> {

    const segments: TranscriptionSegment[] = [];
    const duration = 30000;
    const segmentLength = this.config.maxSegmentLength || 10000;

    for (let i = 0; i < duration; i += segmentLength) {
      const segment: TranscriptionSegment = {
        id: segments.length,
        start: i,
        end: Math.min(i + segmentLength, duration),
        text: this.generateHighQualityTranscript(i / segmentLength),
        // Deterministic disclosed placeholder: this path emits fixed
        // placeholder text with no ASR behind it (see README「音声認識の現状」),
        // so there is no measured confidence. The former
        // `0.95 + Math.random() * 0.05` dressed the placeholder up with
        // measurement-like variance — random jitter mimics a real reading
        // (REQ-391). Pinned to the old range's lower bound so no threshold
        // consumer sees an inflated value.
        confidence: PLACEHOLDER_SEGMENT_CONFIDENCE
      };

      segments.push(segment);
    }

    return segments;
  }

  /**
   * Enhanced fallback transcription for when Whisper is unavailable
   */
  private async runEnhancedFallback(audioBuffer: ArrayBuffer): Promise<TranscriptionSegment[]> {

    // REQ-391 sibling unify: this emitter used to freeze its own
    // 0.92/0.89/0.94/0.87 ladder — measurement-looking values with no ASR
    // behind them, the same dressed-up placeholder the random-jitter fix
    // killed in runRealWhisperTranscription. The disclosed single-source
    // constant carries the "placeholder, not a measurement" semantics.
    const enhancedSegments: TranscriptionSegment[] = [
      {
        id: 0,
        start: 0,
        end: 8000,
        text: "Welcome to our organizational structure presentation. The company hierarchy consists of executive leadership at the top, followed by department heads, team managers, and individual contributors.",
        confidence: PLACEHOLDER_SEGMENT_CONFIDENCE
      },
      {
        id: 1,
        start: 8000,
        end: 16000,
        text: "The project timeline spans twelve months, beginning with the research phase in January through March. Development occurs from April to September, followed by testing and quality assurance.",
        confidence: PLACEHOLDER_SEGMENT_CONFIDENCE
      },
      {
        id: 2,
        start: 16000,
        end: 24000,
        text: "The workflow process demonstrates a continuous cycle starting with requirements gathering. After analysis and design, we move to implementation and testing.",
        confidence: PLACEHOLDER_SEGMENT_CONFIDENCE
      },
      {
        id: 3,
        start: 24000,
        end: 32000,
        text: "The network architecture shows data flowing from user interfaces through API gateways to microservices. Information passes through authentication layers and business logic components.",
        confidence: PLACEHOLDER_SEGMENT_CONFIDENCE
      }
    ];

    return enhancedSegments;
  }

  /**
   * Generate high-quality transcript content based on segment index
   */
  private generateHighQualityTranscript(segmentIndex: number): string {
    const transcripts = [
      "The enterprise architecture consists of multiple interconnected layers including presentation, business logic, data access, and infrastructure components.",
      "The software development lifecycle follows a structured approach beginning with requirements analysis and system design.",
      "The data pipeline architecture demonstrates how information flows through various processing stages.",
      "The user experience journey maps the customer interaction points from initial awareness through purchase and ongoing support."
    ];

    return transcripts.length > 0
      ? transcripts[segmentIndex % transcripts.length]
      : '';
  }

  /**
   * Validate and enhance transcription segments
   */
  private async validateAndEnhanceSegments(segments: TranscriptionSegment[]): Promise<TranscriptionSegment[]> {

    return segments.map((segment, index) => ({
      ...segment,
      // `!` before `??` asserted non-undefined and then handled undefined
      // anyway — the plain `??` is the same expression minus the dead
      // assertion. sanitizeFinite(v, 0.8) ≡ Number.isFinite(v) ? v : 0.8.
      id: segment.id ?? index,
      // Real whisper.cpp segments carry NO confidence (its default output has
      // none) — undefined stays undefined ("unmeasured": Caption.confidence
      // renders it as null, metrics count it as 0) instead of being stamped
      // with a dressed-up 0.8. Placeholder emitters set
      // PLACEHOLDER_SEGMENT_CONFIDENCE explicitly and pass the floor unchanged.
      confidence:
        segment.confidence === undefined
          ? undefined
          : Math.max(sanitizeFinite(segment.confidence, 0.8), 0.8),
      text: segment.text.trim().replace(/\s+/g, ' ')
    })).filter(segment =>
      segment.text.length > 0 &&
      segment.end > segment.start
    );
  }

  /**
   * Generate Remotion-compatible captions
   */
  private generateCaptions(segments: TranscriptionSegment[]): Caption[] {

    return segments.map(segment => ({
      text: segment.text,
      startMs: segment.start,
      endMs: segment.end,
      timestampMs: segment.start,
      // REQ-393: null is Caption.confidence's own "unmeasured" value —
      // `?? 0.9` asserted near-certainty no measurement backed.
      confidence: segment.confidence ?? null
    }));
  }

  /**
   * Detect language from transcription segments
   *
   * Delegates to ./language-detection (round 22). The hand-rolled
   * [kana|kanji] class this method used to carry labeled Chinese-only
   * transcripts 'ja' (kanji matches the class) and collapsed es/fr/de to
   * 'en' (no diacritical scoring) — the same concept analysis'
   * detectLanguage already decides with the full classifier.
   */
  private detectLanguageFromSegments(segments: TranscriptionSegment[]): string {
    return detectTranscriptionLanguage(segments);
  }

  /**
   * Generate SRT format string from segments
   */
  generateSrt(segments: TranscriptionSegment[]): string {
    return segments.map((segment, index) => {
      // Use the canonical formatter from ./srt-generator (single source of
      // truth for ms→"HH:MM:SS,mmm"). It clamps negative timestamps to 0 and
      // returns a safe fallback for non-finite values; a private copy here
      // previously drifted and emitted sign-bearing garbage for negatives.
      const startTime = formatTimestamp(segment.start);
      const endTime = formatTimestamp(segment.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}`;
    }).join('\n\n');
  }

  /**
   * Calculate total duration from segments
   */
  private calculateDuration(segments: TranscriptionSegment[]): number {
    if (segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    return Number.isFinite(lastSegment.end) ? lastSegment.end : 0;
  }

  /**
   * Log transcription metrics for progressive improvement
   */
  private logTranscriptionMetrics(result: TranscriptionResult): void {
    if (result.segments.length === 0) return;

    const avgConfidence = result.segments.reduce((sum, s) =>
      sum + sanitizeFinite(s.confidence), 0) / result.segments.length;
  }

  /**
   * Get current capabilities and status
   */
  public getCapabilities() {
    return {
      whisperReady: this.isWhisperReady,
      model: this.config.model,
      supportedFormats: [...SUPPORTED_AUDIO_FORMATS],
      maxDuration: '60 minutes',
      languages: ['auto', 'en', 'ja'],
      features: {
        realTimeTranscription: this.isWhisperReady,
        highAccuracy: this.isWhisperReady,
        speakerDetection: false,
        punctuation: true,
        timestamps: this.config.enableTimestamps
      },
      progressiveEnhancement: {
        iterationCount: this.iterationCount,
        qualityTracking: true,
        enhancementFeatures: [
          'real_whisper_integration',
          'enhanced_fallback_transcription',
          'quality_score_calculation',
          'progressive_metrics_tracking'
        ]
      }
    };
  }
}

// Export singleton instance
export const whisperTranscriber = new WhisperTranscriber();
