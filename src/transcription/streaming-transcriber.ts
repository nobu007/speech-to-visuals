/**
 * 🎯 Iteration 45: Real-Time Streaming Transcription Enhancement
 * Implements progressive audio processing with live feedback
 * Following custom instructions methodology for iterative improvement
 */

import { TranscriptionSegment, TranscriptionResult, TranscriptionConfig } from './types';

export interface StreamingTranscriptionConfig extends TranscriptionConfig {
  chunkSizeMs?: number; // Audio chunk size in milliseconds
  overlapMs?: number;   // Overlap between chunks for continuity
  minConfidence?: number; // Minimum confidence for segment acceptance
  enableLiveUpdate?: boolean; // Enable real-time UI updates
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

  constructor(config: StreamingTranscriptionConfig = {}) {
    this.config = {
      chunkSizeMs: 3000,        // 3 second chunks
      overlapMs: 500,           // 0.5 second overlap
      minConfidence: 0.7,       // 70% minimum confidence
      enableLiveUpdate: true,   // Real-time updates enabled
      ...config
    };

    // Initialize Web Speech API if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
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
      console.log('🎤 Streaming transcription started');
      this.isStreaming = true;
    };

    this.recognition.onend = () => {
      console.log('🔇 Streaming transcription ended');
      this.isStreaming = false;
    };

    this.recognition.onerror = (event) => {
      console.error('🚨 Speech recognition error:', event.error);
      this.isStreaming = false;
    };
  }

  /**
   * Start streaming transcription from audio file
   * Processes audio in chunks with real-time feedback
   */
  async transcribeStream(
    audioFile: string | File,
    onProgress?: StreamingProgressCallback,
    onSegment?: SegmentCallback
  ): Promise<TranscriptionResult> {
    try {
      console.log('🚀 Starting streaming transcription...');

      // Load audio for duration calculation
      const audioDuration = await this.getAudioDuration(audioFile);

      // Process audio in chunks
      const chunks = this.createAudioChunks(audioDuration);
      const allSegments: TranscriptionSegment[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          console.log(`📊 Processing chunk ${i + 1}/${chunks.length} (${chunk.start}s - ${chunk.end}s)`);

          // Process chunk (simulate for now)
          const chunkSegments = await this.processAudioChunk(chunk, audioFile);

          // Add segments with confidence filtering
          const validSegments = chunkSegments.filter(
            segment => segment.confidence >= (this.config.minConfidence || 0.7)
          );

          allSegments.push(...validSegments);

          // Real-time progress callback
          if (onProgress) {
            const progress: StreamingProgress = {
              processedDuration: chunk.end * 1000,
              totalDuration: audioDuration * 1000,
              currentSegment: validSegments[validSegments.length - 1] || null,
              segmentCount: allSegments.length,
              averageConfidence: this.calculateAverageConfidence(allSegments)
            };
            onProgress(progress);
          }

          // Real-time segment callback
          if (onSegment && validSegments.length > 0) {
            validSegments.forEach(segment => onSegment(segment));
          }

          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (chunkError) {
          console.warn(`⚠️ Chunk ${i + 1} processing failed, continuing:`, chunkError);
          // Continue with next chunk instead of failing completely
        }
      }

      // Merge overlapping segments
      const mergedSegments = this.mergeOverlappingSegments(allSegments);

      const result: TranscriptionResult = {
        segments: mergedSegments,
        fullText: mergedSegments.map(s => s.text).join(' '),
        duration: audioDuration * 1000,
        confidence: this.calculateAverageConfidence(mergedSegments),
        language: 'ja',
        processingTimeMs: Date.now() - performance.now(),
        metadata: {
          chunkCount: chunks.length,
          totalSegments: mergedSegments.length,
          averageChunkTime: audioDuration / chunks.length,
          processingMethod: 'streaming'
        }
      };

      console.log(`✅ Streaming transcription complete: ${mergedSegments.length} segments`);
      return result;

    } catch (error) {
      console.error('❌ Streaming transcription failed:', error);
      throw new Error(`Streaming transcription failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Start live microphone transcription
   */
  async startLiveTranscription(
    onSegment?: SegmentCallback,
    onProgress?: StreamingProgressCallback
  ): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    if (this.isStreaming) {
      console.warn('⚠️ Live transcription already running');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new Error('Recognition not available'));

      let interimTranscript = '';
      let finalTranscript = '';
      let segmentStartTime = performance.now();

      this.recognition.onresult = (event) => {
        interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';

            // Create segment for completed phrase
            const segment: TranscriptionSegment = {
              start: segmentStartTime / 1000,
              end: performance.now() / 1000,
              text: transcript.trim(),
              confidence: confidence || 0.8,
              speaker: 'unknown'
            };

            if (onSegment && segment.confidence >= (this.config.minConfidence || 0.7)) {
              onSegment(segment);
            }

            segmentStartTime = performance.now();
          } else {
            interimTranscript += transcript;
          }
        }

        // Progress update for live transcription
        if (onProgress) {
          const progress: StreamingProgress = {
            processedDuration: performance.now() - segmentStartTime,
            totalDuration: -1, // Unknown for live
            currentSegment: interimTranscript ? {
              start: segmentStartTime / 1000,
              end: performance.now() / 1000,
              text: interimTranscript,
              confidence: 0.5, // Interim confidence
              speaker: 'unknown'
            } : null,
            segmentCount: this.segments.length,
            averageConfidence: this.calculateAverageConfidence(this.segments)
          };
          onProgress(progress);
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
   * Create audio chunks for processing
   */
  private createAudioChunks(duration: number): Array<{ start: number; end: number }> {
    const chunks: Array<{ start: number; end: number }> = [];
    const chunkSize = (this.config.chunkSizeMs || 3000) / 1000;
    const overlap = (this.config.overlapMs || 500) / 1000;

    let start = 0;
    while (start < duration) {
      const end = Math.min(start + chunkSize, duration);
      chunks.push({ start, end });
      start += chunkSize - overlap; // Move forward with overlap
    }

    return chunks;
  }

  /**
   * Process individual audio chunk
   * Simulates chunk processing - would integrate with actual audio processing
   */
  private async processAudioChunk(
    chunk: { start: number; end: number },
    audioFile: string | File
  ): Promise<TranscriptionSegment[]> {
    // Simulate processing time based on chunk duration
    const chunkDuration = chunk.end - chunk.start;
    await new Promise(resolve => setTimeout(resolve, chunkDuration * 100)); // 10x realtime simulation

    // Generate mock segments for the chunk
    const segmentCount = Math.max(1, Math.floor(chunkDuration / 2)); // One segment per 2 seconds
    const segments: TranscriptionSegment[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const segmentStart = chunk.start + (i * chunkDuration / segmentCount);
      const segmentEnd = chunk.start + ((i + 1) * chunkDuration / segmentCount);

      segments.push({
        start: segmentStart,
        end: segmentEnd,
        text: `Processed segment ${i + 1} from chunk ${chunk.start.toFixed(1)}s-${chunk.end.toFixed(1)}s`,
        confidence: 0.75 + (Math.random() * 0.2), // 75-95% confidence
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

      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };

      audio.onerror = () => {
        reject(new Error('Failed to load audio file'));
      };

      if (typeof audioFile === 'string') {
        audio.src = audioFile;
      } else {
        audio.src = URL.createObjectURL(audioFile);
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

      // Check for overlap
      if (current.start <= lastMerged.end + 0.5) { // 0.5s tolerance
        // Merge segments
        lastMerged.end = Math.max(lastMerged.end, current.end);
        lastMerged.text += ' ' + current.text;
        lastMerged.confidence = (lastMerged.confidence + current.confidence) / 2;
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

    const totalConfidence = segments.reduce((sum, segment) => sum + segment.confidence, 0);
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
   */
  updateConfig(newConfig: Partial<StreamingTranscriptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📝 Streaming transcriber config updated:', this.config);
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
  const webSpeechAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const mediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  const audioContext = 'AudioContext' in window || 'webkitAudioContext' in window;

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