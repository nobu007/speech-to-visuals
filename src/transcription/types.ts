import { Caption } from '@remotion/captions';

export interface TranscriptionSegment {
  id?: number;
  start: number;
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
 * Supported audio formats for transcription
 */
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'] as const;
export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

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