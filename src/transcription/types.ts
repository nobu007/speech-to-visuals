import { Caption } from '@remotion/captions';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
  processingTime: number;
  success: boolean;
  error?: string;
  captions?: Caption[]; // Add Remotion captions support
}

export interface TranscriptionConfig {
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  outputFormat: 'json' | 'srt' | 'vtt';
  combineMs?: number;
  maxRetries: number;
  chunkSizeMs?: number;
}

export interface TranscriptionMetrics {
  duration: number;
  segmentCount: number;
  avgConfidence: number;
  processingTime: number;
  wordsPerMinute: number;
}