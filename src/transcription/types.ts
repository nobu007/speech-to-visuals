import { Caption } from '@remotion/captions';

export interface TranscriptionSegment {
  id?: number;
  /** Segment start time in MILLISECONDS (matches whisper/browser/transcriber/srt; same unit as TranscriptionResult.duration). */
  start: number;
  /** Segment end time in MILLISECONDS. */
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text?: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
  processingTime?: number;
  success?: boolean;
  /** True when all transcription engines failed and placeholder segments were returned */
  fallback?: boolean;
  error?: string;
  captions?: Caption[]; // Add Remotion captions support
  /** REQ-091: Quality summary from streaming quality monitoring */
  qualitySummary?: import('./streaming-quality-monitor').StreamingQualitySummary;
}

export interface TranscriptionConfig {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  outputFormat?: 'json' | 'srt' | 'vtt';
  combineMs?: number;
  maxRetries?: number;
  chunkSizeMs?: number;
}

export interface TranscriptionMetrics {
  duration: number;
  segmentCount: number;
  avgConfidence: number;
  processingTime: number;
  wordsPerMinute: number;
}

/**
 * REQ-145: Re-export centralized audio constants from @/config/limits
 * so existing imports from this module continue to work unchanged.
 */
import { AUDIO_LIMITS } from '@stv/core/config/limits';
export { AUDIO_LIMITS, SUPPORTED_AUDIO_FORMATS } from '@stv/core/config/limits';
export type { SupportedAudioFormat } from '@stv/core/config/limits';

/**
 * Maximum file size in bytes (50MB) — re-exported from centralized AUDIO_LIMITS.
 * Kept as a standalone constant for backward compatibility with existing imports.
 */
export const MAX_FILE_SIZE = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES;

/**
 * Custom error for transcription failures
 */
export class TranscriptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/**
 * Custom error for files exceeding the size limit
 */
export class FileSizeExceededError extends Error {
  constructor(
    message: string,
    public readonly fileSize: number,
    public readonly maxSize: number
  ) {
    super(message);
    this.name = 'FileSizeExceededError';
  }
}