/**
 * Real Audio File Optimization Module - Iteration 66 Phase A
 * リアル音声ファイル処理最適化 (段階的改善実装)
 *
 * 機能:
 * - マルチフォーマット対応 (MP3, WAV, M4A, OGG, FLAC, etc.)
 * - ノイズ除去アルゴリズム
 * - 音声品質自動判定
 * - フォーマット変換最適化
 */

export interface AudioFormat {
  extension: string;
  mimeType: string;
  supported: boolean;
  recommendedSampleRate: number;
  recommendedChannels: 'mono' | 'stereo';
}

export interface AudioQualityAssessment {
  overallScore: number; // 0-100
  snr: number; // Signal-to-noise ratio (dB)
  bitrate: number;
  sampleRate: number;
  channels: number;
  duration: number;
  recommendations: string[];
  needsOptimization: boolean;
  estimatedProcessingTime: number; // ms
}

export interface OptimizationResult {
  success: boolean;
  originalFile: File;
  optimizedBlob?: Blob;
  qualityBefore: AudioQualityAssessment;
  qualityAfter?: AudioQualityAssessment;
  processingTime: number;
  improvements: string[];
  error?: string;
}

export class RealAudioOptimizer {
  private supportedFormats: AudioFormat[] = [
    { extension: 'mp3', mimeType: 'audio/mpeg', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'wav', mimeType: 'audio/wav', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'm4a', mimeType: 'audio/mp4', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'ogg', mimeType: 'audio/ogg', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'flac', mimeType: 'audio/flac', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'aac', mimeType: 'audio/aac', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' },
    { extension: 'weba', mimeType: 'audio/webm', supported: true, recommendedSampleRate: 16000, recommendedChannels: 'mono' }
  ];

  private audioContext: AudioContext | null = null;
  private iterationCount: number = 0;

  constructor() {
    this.initializeAudioContext();
  }

  /**
   * Initialize Web Audio API context
   */
  private initializeAudioContext(): void {
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          console.log('✅ Web Audio API context initialized');
        }
      }
    } catch (error) {
      console.warn('⚠️ Web Audio API not available:', error);
    }
  }

  /**
   * Validate if file format is supported
   */
  public validateFormat(file: File): { supported: boolean; format?: AudioFormat; message: string } {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const format = this.supportedFormats.find(f => f.extension === extension);

    if (!format) {
      return {
        supported: false,
        message: `Unsupported format: ${extension}. Supported formats: ${this.supportedFormats.map(f => f.extension).join(', ')}`
      };
    }

    if (!format.supported) {
      return {
        supported: false,
        format,
        message: `Format ${extension} is not currently supported`
      };
    }

    return {
      supported: true,
      format,
      message: `Format ${extension} is supported`
    };
  }

  /**
   * Assess audio quality (Stage 1: Analysis)
   */
  public async assessQuality(file: File): Promise<AudioQualityAssessment> {
    console.log(`🔍 [Iteration ${++this.iterationCount}] Assessing audio quality for: ${file.name}`);
    const startTime = performance.now();

    try {
      if (!this.audioContext) {
        // Fallback assessment without Web Audio API
        return this.fallbackQualityAssessment(file);
      }

      // Read audio file
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Analyze audio characteristics
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration * 1000; // Convert to ms
      const bitrate = (file.size * 8) / audioBuffer.duration; // bits per second

      // Estimate SNR (simplified calculation)
      const snr = this.estimateSNR(audioBuffer);

      // Calculate overall quality score
      const overallScore = this.calculateQualityScore({
        snr,
        bitrate,
        sampleRate,
        channels,
        duration
      });

      // Generate recommendations
      const recommendations: string[] = [];
      let needsOptimization = false;

      if (sampleRate !== 16000) {
        recommendations.push(`Resample from ${sampleRate}Hz to 16000Hz for optimal Whisper performance`);
        needsOptimization = true;
      }

      if (channels > 1) {
        recommendations.push('Convert from stereo to mono to reduce processing time');
        needsOptimization = true;
      }

      if (snr < 15) {
        recommendations.push(`Low SNR (${snr.toFixed(1)}dB) detected - apply noise reduction`);
        needsOptimization = true;
      }

      if (bitrate < 64000) {
        recommendations.push(`Low bitrate (${(bitrate / 1000).toFixed(0)}kbps) may affect transcription quality`);
      }

      if (duration > 1800000) { // 30 minutes
        recommendations.push(`Long audio (${(duration / 60000).toFixed(1)} minutes) - consider chunking for faster processing`);
      }

      const processingTime = performance.now() - startTime;
      const estimatedProcessingTime = this.estimateProcessingTime(duration, needsOptimization);

      const assessment: AudioQualityAssessment = {
        overallScore,
        snr,
        bitrate,
        sampleRate,
        channels,
        duration,
        recommendations,
        needsOptimization,
        estimatedProcessingTime
      };

      console.log(`✅ Quality assessment completed in ${processingTime.toFixed(0)}ms`);
      console.log(`📊 Quality Score: ${overallScore}/100, SNR: ${snr.toFixed(1)}dB`);

      return assessment;

    } catch (error) {
      console.error('❌ Quality assessment failed:', error);
      return this.fallbackQualityAssessment(file);
    }
  }

  /**
   * Fallback quality assessment without Web Audio API
   */
  private fallbackQualityAssessment(file: File): AudioQualityAssessment {
    console.log('🔄 Using fallback quality assessment...');

    // Estimate based on file size and type
    const duration = 180000; // Estimate 3 minutes
    const bitrate = (file.size * 8) / (duration / 1000); // bits per second
    const sampleRate = 44100; // Common default
    const channels = 2; // Assume stereo

    const recommendations: string[] = [
      'Audio analysis limited - Web Audio API unavailable',
      'Recommend using supported browser for detailed analysis',
      'Processing will use default optimization settings'
    ];

    return {
      overallScore: 70, // Conservative estimate
      snr: 15, // Assume reasonable quality
      bitrate,
      sampleRate,
      channels,
      duration,
      recommendations,
      needsOptimization: true,
      estimatedProcessingTime: duration * 0.5 // 50% of audio duration
    };
  }

  /**
   * Estimate Signal-to-Noise Ratio
   */
  private estimateSNR(audioBuffer: AudioBuffer): number {
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleCount = Math.min(channelData.length, 44100 * 10); // Analyze first 10 seconds max

    let sumSquares = 0;
    let maxAmplitude = 0;

    for (let i = 0; i < sampleCount; i++) {
      const sample = Math.abs(channelData[i]);
      sumSquares += sample * sample;
      maxAmplitude = Math.max(maxAmplitude, sample);
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    const noiseFloor = rms * 0.1; // Simplified noise floor estimation

    // Convert to dB
    const signalDb = 20 * Math.log10(maxAmplitude);
    const noiseDb = 20 * Math.log10(noiseFloor);
    const snr = signalDb - noiseDb;

    return Math.max(0, Math.min(snr, 60)); // Clamp between 0-60 dB
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(params: {
    snr: number;
    bitrate: number;
    sampleRate: number;
    channels: number;
    duration: number;
  }): number {
    let score = 0;

    // SNR contribution (40%)
    const snrScore = Math.min(params.snr / 30, 1) * 40; // 30dB is excellent
    score += snrScore;

    // Bitrate contribution (25%)
    const bitrateScore = Math.min(params.bitrate / 192000, 1) * 25; // 192kbps is high quality
    score += bitrateScore;

    // Sample rate contribution (20%)
    const sampleRateScore = Math.min(params.sampleRate / 44100, 1) * 20; // 44.1kHz is CD quality
    score += sampleRateScore;

    // Duration validity (15%)
    const durationScore = (params.duration > 1000 && params.duration < 3600000) ? 15 : 10;
    score += durationScore;

    return Math.round(Math.max(0, Math.min(score, 100)));
  }

  /**
   * Estimate processing time based on audio characteristics
   */
  private estimateProcessingTime(duration: number, needsOptimization: boolean): number {
    const baseTime = duration * 0.3; // 30% of audio duration for base processing
    const optimizationOverhead = needsOptimization ? duration * 0.2 : 0; // +20% if optimization needed
    return Math.round(baseTime + optimizationOverhead);
  }

  /**
   * Optimize audio file (Stage 2: Enhancement)
   */
  public async optimizeAudio(file: File, quality: AudioQualityAssessment): Promise<OptimizationResult> {
    console.log(`🚀 [Iteration ${this.iterationCount}] Starting audio optimization...`);
    const startTime = performance.now();
    const improvements: string[] = [];

    try {
      if (!quality.needsOptimization) {
        console.log('✅ Audio quality is already optimal - no optimization needed');
        return {
          success: true,
          originalFile: file,
          qualityBefore: quality,
          processingTime: performance.now() - startTime,
          improvements: ['Audio quality already optimal']
        };
      }

      if (!this.audioContext) {
        console.warn('⚠️ Web Audio API not available - returning original file');
        return {
          success: false,
          originalFile: file,
          qualityBefore: quality,
          processingTime: performance.now() - startTime,
          improvements: [],
          error: 'Web Audio API not available for optimization'
        };
      }

      // Stage 2.1: Decode audio
      const arrayBuffer = await file.arrayBuffer();
      let audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✅ Audio decoded successfully');

      // Stage 2.2: Resample if needed
      if (quality.sampleRate !== 16000) {
        audioBuffer = await this.resampleAudio(audioBuffer, 16000);
        improvements.push(`Resampled from ${quality.sampleRate}Hz to 16000Hz`);
        console.log('✅ Resampling completed');
      }

      // Stage 2.3: Convert to mono if needed
      if (quality.channels > 1) {
        audioBuffer = this.convertToMono(audioBuffer);
        improvements.push(`Converted from ${quality.channels} channels to mono`);
        console.log('✅ Mono conversion completed');
      }

      // Stage 2.4: Apply noise reduction if needed
      if (quality.snr < 15) {
        audioBuffer = this.applyNoiseReduction(audioBuffer, quality.snr);
        improvements.push(`Applied noise reduction (SNR: ${quality.snr.toFixed(1)}dB)`);
        console.log('✅ Noise reduction completed');
      }

      // Stage 2.5: Normalize volume
      audioBuffer = this.normalizeVolume(audioBuffer);
      improvements.push('Applied volume normalization');
      console.log('✅ Volume normalization completed');

      // Stage 2.6: Export to optimized format (WAV for Whisper)
      const optimizedBlob = await this.exportToWAV(audioBuffer);
      console.log(`✅ Exported to WAV format (${(optimizedBlob.size / 1024).toFixed(1)}KB)`);

      // Stage 2.7: Assess quality after optimization
      const optimizedFile = new File([optimizedBlob], file.name.replace(/\.[^.]+$/, '_optimized.wav'), { type: 'audio/wav' });
      const qualityAfter = await this.assessQuality(optimizedFile);

      const processingTime = performance.now() - startTime;
      console.log(`✅ Optimization completed in ${processingTime.toFixed(0)}ms`);
      console.log(`📊 Quality improvement: ${quality.overallScore} → ${qualityAfter.overallScore}`);

      return {
        success: true,
        originalFile: file,
        optimizedBlob,
        qualityBefore: quality,
        qualityAfter,
        processingTime,
        improvements
      };

    } catch (error) {
      console.error('❌ Audio optimization failed:', error);
      return {
        success: false,
        originalFile: file,
        qualityBefore: quality,
        processingTime: performance.now() - startTime,
        improvements,
        error: error instanceof Error ? error.message : 'Optimization failed'
      };
    }
  }

  /**
   * Resample audio to target sample rate
   */
  private async resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    return await offlineContext.startRendering();
  }

  /**
   * Convert stereo to mono
   */
  private convertToMono(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const monoBuffer = this.audioContext.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const monoData = monoBuffer.getChannelData(0);

    if (audioBuffer.numberOfChannels === 1) {
      monoData.set(audioBuffer.getChannelData(0));
    } else {
      // Average all channels
      for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / audioBuffer.numberOfChannels;
      }
    }

    return monoBuffer;
  }

  /**
   * Apply simple noise reduction
   */
  private applyNoiseReduction(audioBuffer: AudioBuffer, currentSNR: number): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const cleanBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Simple noise gate based on SNR
    const threshold = Math.pow(10, (currentSNR - 40) / 20); // Noise gate threshold

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = cleanBuffer.getChannelData(channel);

      for (let i = 0; i < audioBuffer.length; i++) {
        const sample = inputData[i];
        // Apply noise gate - attenuate samples below threshold
        outputData[i] = Math.abs(sample) > threshold ? sample : sample * 0.1;
      }
    }

    return cleanBuffer;
  }

  /**
   * Normalize audio volume
   */
  private normalizeVolume(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const normalizedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);

      // Find peak amplitude
      let peak = 0;
      for (let i = 0; i < audioBuffer.length; i++) {
        peak = Math.max(peak, Math.abs(inputData[i]));
      }

      // Normalize to 0.8 to prevent clipping
      const targetPeak = 0.8;
      const gain = peak > 0 ? targetPeak / peak : 1;

      for (let i = 0; i < audioBuffer.length; i++) {
        outputData[i] = inputData[i] * gain;
      }
    }

    return normalizedBuffer;
  }

  /**
   * Export AudioBuffer to WAV blob
   */
  private async exportToWAV(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = new Int16Array(audioBuffer.length * numberOfChannels);
    let offset = 0;

    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        // Convert float to 16-bit PCM
        data[offset++] = Math.max(-32768, Math.min(32767, sample * 32768));
      }
    }

    const buffer = new ArrayBuffer(44 + data.length * bytesPerSample);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + data.length * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, data.length * bytesPerSample, true);

    // Write audio data
    const dataOffset = 44;
    for (let i = 0; i < data.length; i++) {
      view.setInt16(dataOffset + i * bytesPerSample, data[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Get optimizer capabilities and status
   */
  public getCapabilities() {
    return {
      webAudioSupported: this.audioContext !== null,
      supportedFormats: this.supportedFormats,
      features: {
        qualityAssessment: true,
        formatConversion: this.audioContext !== null,
        resampling: this.audioContext !== null,
        monoConversion: this.audioContext !== null,
        noiseReduction: this.audioContext !== null,
        volumeNormalization: this.audioContext !== null
      },
      progressiveEnhancement: {
        iterationCount: this.iterationCount,
        fallbackSupport: true,
        realtimeProcessing: this.audioContext !== null
      }
    };
  }
}

// Export singleton instance
export const realAudioOptimizer = new RealAudioOptimizer();
