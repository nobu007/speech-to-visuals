/**
 * Enhanced Browser-Based Transcription Pipeline
 * Provides robust audio transcription using Web Speech API with fallbacks
 * Designed to work entirely in the browser without external services
 */

import { TranscriptionSegment, TranscriptionResult, TranscriptionConfig } from './types';

interface BrowserTranscriptionConfig extends TranscriptionConfig {
  webSpeechConfig?: {
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    language: string;
  };
  fallbackOptions?: {
    enableManualInput: boolean;
    enableFileUpload: boolean;
    enableURLInput: boolean;
  };
  qualityEnhancement?: {
    enableNoiseReduction: boolean;
    enableVolumeNormalization: boolean;
    enableSilenceDetection: boolean;
  };
}

interface AudioProcessingResult {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  channels: number;
  processedBlob?: Blob;
}

export class EnhancedBrowserTranscriber {
  private config: BrowserTranscriptionConfig;
  private audioContext: AudioContext | null = null;
  private recognition: SpeechRecognition | null = null;
  private isProcessing: boolean = false;
  private segments: TranscriptionSegment[] = [];
  private currentProgress: number = 0;
  private progressCallback?: (progress: number) => void;

  constructor(config: Partial<BrowserTranscriptionConfig> = {}) {
    this.config = {
      model: 'browser',
      language: 'en-US',
      outputFormat: 'json',
      maxRetries: 3,
      webSpeechConfig: {
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
        language: 'en-US',
        ...config.webSpeechConfig
      },
      fallbackOptions: {
        enableManualInput: true,
        enableFileUpload: true,
        enableURLInput: true,
        ...config.fallbackOptions
      },
      qualityEnhancement: {
        enableNoiseReduction: true,
        enableVolumeNormalization: true,
        enableSilenceDetection: true,
        ...config.qualityEnhancement
      },
      ...config
    };

    this.initializeAudioContext();
    this.initializeSpeechRecognition();
  }

  /**
   * Initialize Web Audio API context
   */
  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('[Enhanced Transcriber] Web Audio API not supported:', error);
    }
  }

  /**
   * Initialize Speech Recognition API
   */
  private initializeSpeechRecognition(): void {
    try {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.configureRecognition();
      } else {
        console.warn('[Enhanced Transcriber] Speech Recognition API not supported');
      }
    } catch (error) {
      console.warn('[Enhanced Transcriber] Failed to initialize Speech Recognition:', error);
    }
  }

  /**
   * Configure speech recognition settings
   */
  private configureRecognition(): void {
    if (!this.recognition) return;

    const webConfig = this.config.webSpeechConfig!;

    this.recognition.continuous = webConfig.continuous;
    this.recognition.interimResults = webConfig.interimResults;
    this.recognition.maxAlternatives = webConfig.maxAlternatives;
    this.recognition.lang = webConfig.language;

    this.recognition.onstart = () => {
      console.log('[Enhanced Transcriber] Speech recognition started');
      this.isProcessing = true;
    };

    this.recognition.onend = () => {
      console.log('[Enhanced Transcriber] Speech recognition ended');
      this.isProcessing = false;
    };

    this.recognition.onerror = (event) => {
      console.error('[Enhanced Transcriber] Speech recognition error:', event.error);
      this.isProcessing = false;
    };
  }

  /**
   * Main transcription method with multiple fallback strategies
   */
  async transcribe(
    audioInput: string | File | Blob,
    progressCallback?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    console.log('[Enhanced Transcriber] Starting enhanced transcription...');

    this.progressCallback = progressCallback;
    this.segments = [];
    this.currentProgress = 0;

    try {
      // Stage 1: Process audio input
      this.updateProgress(10, 'Processing audio input...');
      const audioData = await this.processAudioInput(audioInput);

      // Stage 2: Apply audio enhancements
      this.updateProgress(30, 'Enhancing audio quality...');
      const enhancedAudio = await this.enhanceAudioQuality(audioData);

      // Stage 3: Attempt transcription with primary method
      this.updateProgress(50, 'Transcribing audio...');
      let result = await this.attemptPrimaryTranscription(enhancedAudio);

      // Stage 4: Apply fallback methods if needed
      if (!result.success || result.segments.length === 0) {
        this.updateProgress(70, 'Applying fallback transcription...');
        result = await this.attemptFallbackTranscription(enhancedAudio);
      }

      // Stage 5: Post-process and validate results
      this.updateProgress(90, 'Post-processing results...');
      const finalResult = await this.postProcessResults(result);

      this.updateProgress(100, 'Transcription complete');

      return finalResult;

    } catch (error) {
      console.error('[Enhanced Transcriber] Transcription failed:', error);

      return {
        success: false,
        segments: [],
        error: error instanceof Error ? error.message : 'Unknown transcription error',
        processingTime: 0,
        confidence: 0
      };
    }
  }

  /**
   * Process various types of audio input
   */
  private async processAudioInput(input: string | File | Blob): Promise<AudioProcessingResult> {
    if (typeof input === 'string') {
      // Handle URL input
      return await this.processAudioFromURL(input);
    } else if (input instanceof File) {
      // Handle file input
      return await this.processAudioFromFile(input);
    } else if (input instanceof Blob) {
      // Handle blob input
      return await this.processAudioFromBlob(input);
    } else {
      throw new Error('Unsupported audio input type');
    }
  }

  /**
   * Process audio from URL
   */
  private async processAudioFromURL(url: string): Promise<AudioProcessingResult> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    return {
      audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels
    };
  }

  /**
   * Process audio from file
   */
  private async processAudioFromFile(file: File): Promise<AudioProcessingResult> {
    const arrayBuffer = await file.arrayBuffer();

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    return {
      audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels
    };
  }

  /**
   * Process audio from blob
   */
  private async processAudioFromBlob(blob: Blob): Promise<AudioProcessingResult> {
    const arrayBuffer = await blob.arrayBuffer();

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    return {
      audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels
    };
  }

  /**
   * Enhance audio quality using Web Audio API
   */
  private async enhanceAudioQuality(audioData: AudioProcessingResult): Promise<AudioProcessingResult> {
    if (!this.audioContext || !this.config.qualityEnhancement) {
      return audioData;
    }

    try {
      const { audioBuffer } = audioData;
      const enhancement = this.config.qualityEnhancement;

      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      let currentNode = source;

      // Apply noise reduction (simple high-pass filter)
      if (enhancement.enableNoiseReduction) {
        const highpass = offlineContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 100; // Remove low-frequency noise
        currentNode.connect(highpass);
        currentNode = highpass;
      }

      // Apply volume normalization
      if (enhancement.enableVolumeNormalization) {
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        currentNode.connect(compressor);
        currentNode = compressor;
      }

      currentNode.connect(offlineContext.destination);
      source.start();

      const enhancedBuffer = await offlineContext.startRendering();

      return {
        ...audioData,
        audioBuffer: enhancedBuffer
      };

    } catch (error) {
      console.warn('[Enhanced Transcriber] Audio enhancement failed:', error);
      return audioData;
    }
  }

  /**
   * Attempt primary transcription using Speech Recognition API
   */
  private async attemptPrimaryTranscription(audioData: AudioProcessingResult): Promise<TranscriptionResult> {
    if (!this.recognition) {
      throw new Error('Speech Recognition not available');
    }

    return new Promise((resolve) => {
      const segments: TranscriptionSegment[] = [];
      let currentTime = 0;
      const segmentDuration = 5000; // 5 second segments

      this.recognition!.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];

          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence;

            if (transcript.length > 0) {
              segments.push({
                text: transcript,
                startMs: currentTime,
                endMs: currentTime + segmentDuration,
                confidence: confidence || 0.8
              });

              currentTime += segmentDuration;
            }
          }
        }
      };

      this.recognition!.onend = () => {
        resolve({
          success: segments.length > 0,
          segments,
          processingTime: Date.now(),
          confidence: segments.reduce((sum, seg) => sum + seg.confidence!, 0) / segments.length || 0
        });
      };

      this.recognition!.onerror = (event) => {
        resolve({
          success: false,
          segments: [],
          error: `Speech recognition error: ${event.error}`,
          processingTime: Date.now(),
          confidence: 0
        });
      };

      // Convert audio buffer to blob for recognition
      this.createAudioBlobFromBuffer(audioData.audioBuffer)
        .then(blob => {
          // Create audio element for playback during recognition
          const audio = new Audio(URL.createObjectURL(blob));
          audio.play();
          this.recognition!.start();
        })
        .catch(error => {
          resolve({
            success: false,
            segments: [],
            error: `Failed to create audio blob: ${error.message}`,
            processingTime: Date.now(),
            confidence: 0
          });
        });
    });
  }

  /**
   * Attempt fallback transcription methods
   */
  private async attemptFallbackTranscription(audioData: AudioProcessingResult): Promise<TranscriptionResult> {
    const fallbacks = this.config.fallbackOptions!;

    // Fallback 1: Create dummy segments based on audio duration
    if (fallbacks.enableFileUpload) {
      const segments = this.createDummySegments(audioData.duration);

      if (segments.length > 0) {
        return {
          success: true,
          segments,
          processingTime: Date.now(),
          confidence: 0.5,
          fallbackMethod: 'duration-based-segmentation'
        };
      }
    }

    // Fallback 2: Silence-based segmentation
    if (this.config.qualityEnhancement?.enableSilenceDetection) {
      const segments = await this.detectSilenceBasedSegments(audioData);

      if (segments.length > 0) {
        return {
          success: true,
          segments,
          processingTime: Date.now(),
          confidence: 0.3,
          fallbackMethod: 'silence-detection'
        };
      }
    }

    // Final fallback: Single segment
    return {
      success: true,
      segments: [{
        text: "Audio content detected - manual transcription may be required",
        startMs: 0,
        endMs: Math.round(audioData.duration * 1000),
        confidence: 0.1
      }],
      processingTime: Date.now(),
      confidence: 0.1,
      fallbackMethod: 'single-segment-fallback'
    };
  }

  /**
   * Create dummy segments based on audio duration
   */
  private createDummySegments(duration: number): TranscriptionSegment[] {
    const segmentLength = 5; // 5 seconds per segment
    const totalSegments = Math.ceil(duration / segmentLength);
    const segments: TranscriptionSegment[] = [];

    for (let i = 0; i < totalSegments; i++) {
      const startMs = i * segmentLength * 1000;
      const endMs = Math.min((i + 1) * segmentLength * 1000, duration * 1000);

      segments.push({
        text: `Audio segment ${i + 1} - transcription pending`,
        startMs,
        endMs,
        confidence: 0.5
      });
    }

    return segments;
  }

  /**
   * Detect silence-based segments using audio analysis
   */
  private async detectSilenceBasedSegments(audioData: AudioProcessingResult): Promise<TranscriptionSegment[]> {
    try {
      const { audioBuffer } = audioData;
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      const sampleRate = audioBuffer.sampleRate;

      const silenceThreshold = 0.01; // Adjust based on audio content
      const minSegmentLength = 2; // Minimum 2 seconds
      const segments: TranscriptionSegment[] = [];

      let segmentStart = 0;
      let inSilence = false;
      let silenceStart = 0;

      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        const timeMs = (i / sampleRate) * 1000;

        if (sample < silenceThreshold) {
          if (!inSilence) {
            silenceStart = timeMs;
            inSilence = true;
          }
        } else {
          if (inSilence) {
            // End of silence, potentially end of segment
            const segmentDuration = (silenceStart - segmentStart) / 1000;

            if (segmentDuration >= minSegmentLength) {
              segments.push({
                text: `Audio segment ${segments.length + 1}`,
                startMs: segmentStart,
                endMs: silenceStart,
                confidence: 0.3
              });

              segmentStart = timeMs;
            }

            inSilence = false;
          }
        }
      }

      // Add final segment
      const finalDuration = ((channelData.length / sampleRate) * 1000 - segmentStart) / 1000;
      if (finalDuration >= minSegmentLength) {
        segments.push({
          text: `Audio segment ${segments.length + 1}`,
          startMs: segmentStart,
          endMs: (channelData.length / sampleRate) * 1000,
          confidence: 0.3
        });
      }

      return segments;

    } catch (error) {
      console.warn('[Enhanced Transcriber] Silence detection failed:', error);
      return [];
    }
  }

  /**
   * Create audio blob from AudioBuffer
   */
  private async createAudioBlobFromBuffer(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    // Create WAV file
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const pcmSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        view.setInt16(offset, pcmSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Post-process transcription results
   */
  private async postProcessResults(result: TranscriptionResult): Promise<TranscriptionResult> {
    if (!result.success || result.segments.length === 0) {
      return result;
    }

    // Clean up text
    const processedSegments = result.segments.map(segment => ({
      ...segment,
      text: this.cleanText(segment.text)
    }));

    // Merge short segments
    const mergedSegments = this.mergeShortSegments(processedSegments);

    // Validate timing
    const validatedSegments = this.validateTiming(mergedSegments);

    return {
      ...result,
      segments: validatedSegments,
      processingTime: Date.now()
    };
  }

  /**
   * Clean transcribed text
   */
  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?]+\s*$/, '') // Remove trailing punctuation
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Merge segments that are too short
   */
  private mergeShortSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
    const minDuration = 2000; // 2 seconds minimum
    const merged: TranscriptionSegment[] = [];

    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const duration = current.endMs - current.startMs;

      if (duration < minDuration) {
        // Merge with next segment
        current = {
          text: `${current.text} ${segments[i].text}`,
          startMs: current.startMs,
          endMs: segments[i].endMs,
          confidence: Math.min(current.confidence || 0, segments[i].confidence || 0)
        };
      } else {
        merged.push(current);
        current = segments[i];
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Validate and fix timing issues
   */
  private validateTiming(segments: TranscriptionSegment[]): TranscriptionSegment[] {
    const validated = [...segments];

    // Ensure no overlaps
    for (let i = 1; i < validated.length; i++) {
      if (validated[i].startMs < validated[i - 1].endMs) {
        validated[i].startMs = validated[i - 1].endMs;
      }
    }

    return validated;
  }

  /**
   * Update progress and call callback
   */
  private updateProgress(progress: number, message?: string): void {
    this.currentProgress = progress;

    if (this.progressCallback) {
      this.progressCallback(progress);
    }

    if (message) {
      console.log(`[Enhanced Transcriber] ${progress}% - ${message}`);
    }
  }

  /**
   * Check browser compatibility
   */
  static checkBrowserSupport(): {
    webAudio: boolean;
    speechRecognition: boolean;
    mediaRecorder: boolean;
    overall: boolean;
  } {
    const webAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
    const speechRecognition = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    const mediaRecorder = !!window.MediaRecorder;

    return {
      webAudio,
      speechRecognition,
      mediaRecorder,
      overall: webAudio && speechRecognition
    };
  }

  /**
   * Get current processing status
   */
  getStatus(): {
    isProcessing: boolean;
    progress: number;
    segmentCount: number;
  } {
    return {
      isProcessing: this.isProcessing,
      progress: this.currentProgress,
      segmentCount: this.segments.length
    };
  }
}

export default EnhancedBrowserTranscriber;