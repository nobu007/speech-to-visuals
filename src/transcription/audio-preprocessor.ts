/**
 * REQ-092: Audio Preprocessing Pipeline
 *
 * Provides pre-transcription audio analysis:
 * - Silence detection (speech start/end)
 * - Noise level estimation (SNR-based quality assessment)
 * - Audio duration validation (reject <1s, warn >1h)
 *
 * Uses Web Audio API (AudioContext) for analysis in browser environments.
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Quality rating for the audio signal */
export type AudioQualityRating = 'excellent' | 'good' | 'fair' | 'poor';

/** Result of silence region detection */
export interface SilenceRegion {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Duration in seconds */
  duration: number;
}

/** Result of noise level estimation */
export interface NoiseEstimate {
  /** Estimated noise floor in dB (negative value) */
  noiseFloorDb: number;
  /** Estimated signal level in dB (negative value) */
  signalLevelDb: number;
  /** Signal-to-noise ratio in dB */
  snrDb: number;
  /** Human-readable quality rating */
  rating: AudioQualityRating;
}

/** Result of duration validation */
export interface DurationValidation {
  /** Audio duration in seconds */
  durationSeconds: number;
  /** Whether the file passes validation */
  valid: boolean;
  /** Warning messages (e.g. very long audio) */
  warnings: string[];
  /** Error messages (e.g. too short) */
  errors: string[];
}

/** Complete preprocessing result */
export interface AudioPreprocessingResult {
  /** Duration validation outcome */
  duration: DurationValidation;
  /** Detected silence regions */
  silenceRegions: SilenceRegion[];
  /** Noise estimation */
  noise: NoiseEstimate;
  /** Speech start time in seconds (first non-silent region) */
  speechStart: number;
  /** Speech end time in seconds (last non-silent region) */
  speechEnd: number;
  /** Effective speech duration in seconds (excluding silence) */
  effectiveSpeechDuration: number;
  /** Overall recommendation */
  recommendation: 'proceed' | 'proceed_with_caution' | 'reject';
  /** Human-readable messages */
  messages: string[];
}

/** Configuration for preprocessing */
export interface AudioPreprocessorConfig {
  /** RMS threshold for silence detection (0..1, default 0.01) */
  silenceThreshold: number;
  /** Minimum silence duration in seconds to report (default 0.5) */
  minSilenceDuration: number;
  /** Minimum allowed audio duration in seconds (default 1) */
  minDurationSeconds: number;
  /** Duration in seconds above which a warning is issued (default 3600 = 1h) */
  warningDurationSeconds: number;
  /** Analysis window size in samples (default 2048) */
  analysisWindowSize: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PREPROCESSOR_CONFIG: AudioPreprocessorConfig = {
  silenceThreshold: 0.01,
  minSilenceDuration: 0.5,
  minDurationSeconds: 1,
  warningDurationSeconds: 3600,
  analysisWindowSize: 2048,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify SNR into a quality rating.
 */
function classifySnr(snrDb: number): AudioQualityRating {
  if (snrDb >= 30) return 'excellent';
  if (snrDb >= 20) return 'good';
  if (snrDb >= 10) return 'fair';
  return 'poor';
}

/**
 * Compute RMS (root-mean-square) of a Float32Array sample buffer.
 */
function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert a linear amplitude value to decibels.
 * Returns -Infinity for zero/near-zero values.
 */
function toDecibels(amplitude: number): number {
  if (amplitude < 1e-10) return -100;
  return 20 * Math.log10(amplitude);
}

// ---------------------------------------------------------------------------
// AudioPreprocessor
// ---------------------------------------------------------------------------

export class AudioPreprocessor {
  private readonly config: AudioPreprocessorConfig;

  constructor(config: Partial<AudioPreprocessorConfig> = {}) {
    this.config = { ...DEFAULT_PREPROCESSOR_CONFIG, ...config };
  }

  /**
   * Run the full preprocessing pipeline on an audio buffer.
   * @param audioBuffer Decoded AudioBuffer from AudioContext.decodeAudioData()
   */
  analyze(audioBuffer: AudioBuffer): AudioPreprocessingResult {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const durationSeconds = audioBuffer.duration;

    // 1. Duration validation
    const duration = this.validateDuration(durationSeconds);

    // 2. Silence detection
    const silenceRegions = this.detectSilence(channelData, sampleRate);

    // 3. Noise estimation
    const noise = this.estimateNoise(channelData, sampleRate);

    // 4. Compute speech boundaries (silenceRegions fed in so the gap between
    //    the first and last speech window can be subtracted from the span).
    const { speechStart, speechEnd, effectiveSpeechDuration } =
      this.computeSpeechBounds(channelData, sampleRate, durationSeconds, silenceRegions);

    // 5. Build recommendation
    const { recommendation, messages } = this.buildRecommendation(
      duration,
      noise,
      effectiveSpeechDuration,
      silenceRegions.length,
    );

    logger.info('[AudioPreprocessor] Analysis complete', {
      duration: durationSeconds.toFixed(1),
      snr: noise.snrDb.toFixed(1),
      silenceRegions: silenceRegions.length,
      recommendation,
    });

    return {
      duration,
      silenceRegions,
      noise,
      speechStart,
      speechEnd,
      effectiveSpeechDuration,
      recommendation,
      messages,
    };
  }

  /**
   * Analyze raw ArrayBuffer by decoding it with AudioContext.
   * Falls back to synthetic analysis when AudioContext is unavailable.
   */
  async analyzeArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioPreprocessingResult> {
    if (typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext();
      try {
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        return this.analyze(decoded);
      } finally {
        await ctx.close();
      }
    }

    // Fallback: estimate from buffer size
    return this.analyzeFromBufferEstimate(arrayBuffer.byteLength);
  }

  /**
   * Validate audio duration.
   */
  validateDuration(durationSeconds: number): DurationValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Non-finite/negative durations fail loud (mirrors the validateAudioDuration
    // twin in src/utils/audio-validation.ts): every comparison below is false
    // for NaN, which would otherwise manufacture valid=true from absent data.
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      errors.push(`Invalid audio duration: ${durationSeconds}`);
      return { durationSeconds, valid: false, warnings, errors };
    }

    if (durationSeconds < this.config.minDurationSeconds) {
      errors.push(
        `Audio duration ${durationSeconds.toFixed(2)}s is below minimum ${this.config.minDurationSeconds}s`,
      );
    }

    if (durationSeconds > this.config.warningDurationSeconds) {
      warnings.push(
        `Audio duration ${(durationSeconds / 60).toFixed(1)}min exceeds recommended maximum of ${Math.floor(this.config.warningDurationSeconds / 60)}min; transcription may take longer`,
      );
    }

    return {
      durationSeconds,
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Detect silence regions using RMS thresholding.
   */
  detectSilence(channelData: Float32Array, sampleRate: number): SilenceRegion[] {
    const windowSize = this.config.analysisWindowSize;
    const hopSize = Math.floor(windowSize / 2);
    const threshold = this.config.silenceThreshold;
    const minSilenceSamples = Math.ceil(this.config.minSilenceDuration * sampleRate);

    const regions: SilenceRegion[] = [];
    let silenceStart: number | null = null;

    for (let offset = 0; offset < channelData.length; offset += hopSize) {
      const end = Math.min(offset + windowSize, channelData.length);
      const window = channelData.subarray(offset, end);
      const rms = computeRms(window);

      if (rms < threshold) {
        // Silent window
        if (silenceStart === null) {
          silenceStart = offset;
        }
      } else if (silenceStart !== null) {
        // Transition from silent to non-silent
        const silenceEnd = offset;
        if (silenceEnd - silenceStart >= minSilenceSamples) {
          regions.push({
            start: silenceStart / sampleRate,
            end: silenceEnd / sampleRate,
            duration: (silenceEnd - silenceStart) / sampleRate,
          });
        }
        silenceStart = null;
      }
    }

    // Handle trailing silence
    if (silenceStart !== null) {
      const silenceEnd = channelData.length;
      if (silenceEnd - silenceStart >= minSilenceSamples) {
        regions.push({
          start: silenceStart / sampleRate,
          end: silenceEnd / sampleRate,
          duration: (silenceEnd - silenceStart) / sampleRate,
        });
      }
    }

    return regions;
  }

  /**
   * Estimate noise floor and SNR by analyzing the quietest windows.
   */
  estimateNoise(channelData: Float32Array, sampleRate: number): NoiseEstimate {
    const windowSize = this.config.analysisWindowSize;
    const hopSize = Math.floor(windowSize / 2);
    const windowRmsValues: number[] = [];

    for (let offset = 0; offset < channelData.length; offset += hopSize) {
      const end = Math.min(offset + windowSize, channelData.length);
      const window = channelData.subarray(offset, end);
      windowRmsValues.push(computeRms(window));
    }

    if (windowRmsValues.length === 0) {
      return {
        noiseFloorDb: -100,
        signalLevelDb: -100,
        snrDb: 0,
        rating: 'poor',
      };
    }

    // Sort to find the quietest 10% as noise estimate
    const sorted = [...windowRmsValues].sort((a, b) => a - b);
    const noiseIdx = Math.max(1, Math.floor(sorted.length * 0.1));
    const noiseFloor = sorted.slice(0, noiseIdx).reduce((s, v) => s + v, 0) / noiseIdx;

    // Signal level is the loudest 50% average
    const signalIdx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5));
    const signalCount = Math.max(1, sorted.length - signalIdx);
    const signalLevel = sorted.slice(signalIdx).reduce((s, v) => s + v, 0) / signalCount;

    const noiseFloorDb = toDecibels(noiseFloor);
    const signalLevelDb = toDecibels(signalLevel);
    const snrDb = signalLevelDb - noiseFloorDb;

    return {
      noiseFloorDb,
      signalLevelDb,
      snrDb: Math.max(0, snrDb),
      rating: classifySnr(Math.max(0, snrDb)),
    };
  }

  /**
   * Compute speech start/end boundaries.
   *
   * `effectiveSpeechDuration` is the time actually spent speaking, i.e. the
   * span from the first to the last speech window MINUS any silence regions
   * that fall inside that span (per the "excluding silence" contract on
   * AudioPreprocessingResult.effectiveSpeechDuration). Without subtracting
   * those gaps, a recording of "talk 1s, pause 2s, talk 1s" would report ~4s
   * of speech instead of ~2s, skewing downstream recommendations.
   */
  private computeSpeechBounds(
    channelData: Float32Array,
    sampleRate: number,
    totalDuration: number,
    silenceRegions: SilenceRegion[],
  ): { speechStart: number; speechEnd: number; effectiveSpeechDuration: number } {
    const windowSize = this.config.analysisWindowSize;
    const hopSize = Math.floor(windowSize / 2);
    const threshold = this.config.silenceThreshold;

    let speechStart = totalDuration;
    let speechEnd = 0;

    for (let offset = 0; offset < channelData.length; offset += hopSize) {
      const end = Math.min(offset + windowSize, channelData.length);
      const window = channelData.subarray(offset, end);
      const rms = computeRms(window);

      if (rms >= threshold) {
        const time = offset / sampleRate;
        if (time < speechStart) speechStart = time;
        if (time > speechEnd) speechEnd = time;
      }
    }

    // If no speech detected, report zeros
    if (speechStart === totalDuration) {
      speechStart = 0;
      speechEnd = 0;
    }

    const span = speechEnd > speechStart ? speechEnd - speechStart : 0;
    // Subtract the portion of each silence region that overlaps the speech
    // span (clamped to [speechStart, speechEnd]); leading/trailing silence
    // outside the span contributes nothing.
    const silenceWithinSpan = silenceRegions.reduce((sum, region) => {
      const overlap = Math.min(region.end, speechEnd) - Math.max(region.start, speechStart);
      return sum + (overlap > 0 ? overlap : 0);
    }, 0);
    const effectiveSpeechDuration = Math.max(0, span - silenceWithinSpan);

    return { speechStart, speechEnd, effectiveSpeechDuration };
  }

  /**
   * Build a recommendation from the analysis results.
   */
  private buildRecommendation(
    duration: DurationValidation,
    noise: NoiseEstimate,
    effectiveSpeechDuration: number,
    silenceCount: number,
  ): { recommendation: AudioPreprocessingResult['recommendation']; messages: string[] } {
    const messages: string[] = [];

    if (!duration.valid) {
      for (const err of duration.errors) messages.push(err);
      return { recommendation: 'reject', messages };
    }

    if (noise.rating === 'poor') {
      messages.push(`Low SNR (${noise.snrDb.toFixed(1)}dB): transcription accuracy may be degraded`);
    }

    if (effectiveSpeechDuration < 1) {
      messages.push('Very little speech content detected');
    }

    if (silenceCount > 20) {
      messages.push(`High number of silence regions (${silenceCount}): consider trimming`);
    }

    for (const w of duration.warnings) messages.push(w);

    const recommendation =
      messages.length === 0
        ? 'proceed'
        : messages.some(m => m.includes('Low SNR') || m.includes('little speech'))
          ? 'proceed_with_caution'
          : 'proceed';

    return { recommendation, messages };
  }

  /**
   * Estimate preprocessing from buffer size alone (when AudioContext unavailable).
   * Assumes ~128kbps MP3-like encoding as a rough heuristic.
   */
  private analyzeFromBufferEstimate(byteLength: number): AudioPreprocessingResult {
    // Rough estimate: 128kbps = 16000 bytes/second
    const estimatedDuration = byteLength / 16000;
    const duration = this.validateDuration(estimatedDuration);

    return {
      duration,
      silenceRegions: [],
      noise: {
        noiseFloorDb: -60,
        signalLevelDb: -20,
        snrDb: 40,
        rating: 'good',
      },
      speechStart: 0,
      speechEnd: estimatedDuration,
      effectiveSpeechDuration: estimatedDuration,
      recommendation: duration.valid ? 'proceed' : 'reject',
      messages: [
        'Full audio analysis unavailable (no AudioContext); using buffer-size estimates',
        ...duration.errors,
        ...duration.warnings,
      ],
    };
  }
}
