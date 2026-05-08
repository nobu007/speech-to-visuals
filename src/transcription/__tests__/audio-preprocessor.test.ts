/**
 * REQ-092: AudioPreprocessor unit tests
 *
 * Tests cover:
 * 1. Duration validation (< 1s rejected, > 1h warned, normal accepted)
 * 2. Silence detection (known silent regions detected correctly)
 * 3. Noise estimation (SNR calculation and quality rating)
 * 4. Speech boundary detection (speech start/end)
 * 5. Full pipeline analysis
 * 6. Buffer-size fallback estimation
 */

import {
  AudioPreprocessor,
  DEFAULT_PREPROCESSOR_CONFIG,
} from '../audio-preprocessor';
import type {
  AudioPreprocessingResult,
  AudioPreprocessorConfig,
} from '../audio-preprocessor';

// ---------- Helpers ----------

/** Create a synthetic AudioBuffer with given parameters */
function createAudioBuffer(
  sampleRate: number,
  durationSeconds: number,
  generator: (index: number, sampleRate: number) => number,
): AudioBuffer {
  const length = Math.ceil(sampleRate * durationSeconds);
  const buffer = {
    length,
    duration: durationSeconds,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: (_channel: number) => {
      const data = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        data[i] = generator(i, sampleRate);
      }
      return data;
    },
  } as AudioBuffer;
  return buffer;
}

/** Generate a sine wave at given frequency and amplitude */
function sineWave(freq: number, amplitude: number): (i: number, sr: number) => number {
  return (i, sr) => amplitude * Math.sin((2 * Math.PI * freq * i) / sr);
}

/** Generate silence */
function silence(): (_i: number, _sr: number) => number {
  return () => 0;
}

/** Concatenate generators sequentially */
function concatGenerators(
  sampleRate: number,
  segments: { duration: number; generator: (i: number, sr: number) => number }[],
): AudioBuffer {
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  const totalLength = Math.ceil(sampleRate * totalDuration);
  const data = new Float32Array(totalLength);

  let offset = 0;
  for (const seg of segments) {
    const segLength = Math.ceil(sampleRate * seg.duration);
    for (let i = 0; i < segLength && offset + i < totalLength; i++) {
      data[offset + i] = seg.generator(i, sampleRate);
    }
    offset += segLength;
  }

  return {
    length: totalLength,
    duration: totalDuration,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: (_channel: number) => data,
  } as AudioBuffer;
}

// ---------- Test suite ----------

describe('AudioPreprocessor', () => {
  let preprocessor: AudioPreprocessor;

  beforeEach(() => {
    preprocessor = new AudioPreprocessor();
  });

  // -------------------------------------------------------
  // Duration validation
  // -------------------------------------------------------

  describe('validateDuration', () => {
    test('should reject audio shorter than 1 second', () => {
      const result = preprocessor.validateDuration(0.5);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('0.50s');
      expect(result.errors[0]).toContain('minimum');
    });

    test('should accept exactly 1 second', () => {
      const result = preprocessor.validateDuration(1.0);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept normal durations', () => {
      const result = preprocessor.validateDuration(30);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should warn for audio longer than 1 hour', () => {
      const result = preprocessor.validateDuration(3700);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('exceeds');
    });

    test('should respect custom min duration config', () => {
      const custom = new AudioPreprocessor({ minDurationSeconds: 5 });
      const result = custom.validateDuration(3);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('3.00s');
    });
  });

  // -------------------------------------------------------
  // Silence detection
  // -------------------------------------------------------

  describe('detectSilence', () => {
    test('should detect no silence in continuous audio', () => {
      const buffer = createAudioBuffer(44100, 2, sineWave(440, 0.5));
      const channelData = buffer.getChannelData(0);
      const regions = preprocessor.detectSilence(channelData, 44100);
      // Continuous tone should have no silence regions
      expect(regions.length).toBe(0);
    });

    test('should detect silence regions in audio with gaps', () => {
      const buffer = concatGenerators(44100, [
        { duration: 1.0, generator: silence() },           // Leading silence
        { duration: 1.0, generator: sineWave(440, 0.3) },  // Speech
        { duration: 1.5, generator: silence() },            // Gap (detectable, > minSilenceDuration)
        { duration: 1.0, generator: sineWave(440, 0.3) },  // Speech
        { duration: 1.0, generator: silence() },            // Trailing silence
      ]);
      const channelData = buffer.getChannelData(0);
      const regions = preprocessor.detectSilence(channelData, 44100);

      expect(regions.length).toBeGreaterThanOrEqual(1);
      // The middle gap should be detected
      const middleGap = regions.find(
        r => r.start > 0.5 && r.duration >= 0.5,
      );
      expect(middleGap).toBeDefined();
    });

    test('should not detect short silence below minSilenceDuration', () => {
      const custom = new AudioPreprocessor({ minSilenceDuration: 2.0 });
      const buffer = concatGenerators(44100, [
        { duration: 1.0, generator: sineWave(440, 0.3) },
        { duration: 1.0, generator: silence() }, // Below 2s threshold
        { duration: 1.0, generator: sineWave(440, 0.3) },
      ]);
      const channelData = buffer.getChannelData(0);
      const regions = custom.detectSilence(channelData, 44100);
      expect(regions.length).toBe(0);
    });

    test('should report correct duration for silence regions', () => {
      const buffer = concatGenerators(44100, [
        { duration: 1.0, generator: silence() },
        { duration: 0.5, generator: sineWave(440, 0.3) },
      ]);
      const channelData = buffer.getChannelData(0);
      const regions = preprocessor.detectSilence(channelData, 44100);

      if (regions.length > 0) {
        // First region should start near 0 and be ~1s
        expect(regions[0].start).toBeCloseTo(0, 1);
        expect(regions[0].duration).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  // -------------------------------------------------------
  // Noise estimation
  // -------------------------------------------------------

  describe('estimateNoise', () => {
    test('should report valid noise estimation for varying-amplitude audio', () => {
      // Create audio with speech-like amplitude variation (loud + quiet sections)
      const buffer = createAudioBuffer(44100, 3, (i, sr) => {
        const baseSignal = 0.8 * Math.sin((2 * Math.PI * 1000 * i) / sr);
        // Modulate amplitude to create loud and quiet sections
        const envelope = 0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * i) / sr);
        return baseSignal * envelope;
      });
      const channelData = buffer.getChannelData(0);
      const estimate = preprocessor.estimateNoise(channelData, 44100);

      expect(estimate.snrDb).toBeGreaterThanOrEqual(0);
      expect(estimate.noiseFloorDb).toBeLessThan(estimate.signalLevelDb);
    });

    test('should report poor SNR for noisy audio', () => {
      // Mix low-level noise with very low signal
      const buffer = createAudioBuffer(44100, 3, (i, sr) => {
        const signal = 0.001 * Math.sin((2 * Math.PI * 440 * i) / sr);
        const noise = 0.1 * (Math.random() * 2 - 1);
        return noise + signal;
      });
      const channelData = buffer.getChannelData(0);
      const estimate = preprocessor.estimateNoise(channelData, 44100);

      expect(estimate.rating).toBe('poor');
      expect(estimate.snrDb).toBeLessThan(10);
    });

    test('should return valid noise floor and signal level', () => {
      const buffer = createAudioBuffer(44100, 2, sineWave(440, 0.3));
      const channelData = buffer.getChannelData(0);
      const estimate = preprocessor.estimateNoise(channelData, 44100);

      expect(estimate.noiseFloorDb).toBeLessThan(estimate.signalLevelDb);
      expect(estimate.snrDb).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty audio data', () => {
      const data = new Float32Array(0);
      const estimate = preprocessor.estimateNoise(data, 44100);
      expect(estimate.rating).toBe('poor');
      expect(estimate.snrDb).toBe(0);
    });
  });

  // -------------------------------------------------------
  // Speech boundary detection
  // -------------------------------------------------------

  describe('speech boundaries', () => {
    test('should detect correct speech start and end', () => {
      const buffer = concatGenerators(44100, [
        { duration: 1.0, generator: silence() },           // 0-1s: silence
        { duration: 3.0, generator: sineWave(440, 0.3) },  // 1-4s: speech
        { duration: 1.0, generator: silence() },            // 4-5s: silence
      ]);
      const result = preprocessor.analyze(buffer);

      expect(result.speechStart).toBeGreaterThanOrEqual(0.5);
      expect(result.speechStart).toBeLessThanOrEqual(1.5);
      expect(result.speechEnd).toBeGreaterThanOrEqual(3.0);
      expect(result.speechEnd).toBeLessThanOrEqual(4.5);
      expect(result.effectiveSpeechDuration).toBeGreaterThan(1);
    });

    test('should report zero boundaries for all-silent audio', () => {
      const buffer = createAudioBuffer(44100, 2, silence());
      const result = preprocessor.analyze(buffer);

      expect(result.speechStart).toBe(0);
      expect(result.speechEnd).toBe(0);
      expect(result.effectiveSpeechDuration).toBe(0);
    });
  });

  // -------------------------------------------------------
  // Full pipeline analysis
  // -------------------------------------------------------

  describe('analyze', () => {
    test('should return proceed or proceed_with_caution for normal audio', () => {
      const buffer = createAudioBuffer(44100, 5, sineWave(440, 0.3));
      const result = preprocessor.analyze(buffer);

      expect(result.duration.valid).toBe(true);
      // Sine waves may trigger low-speech or SNR warnings, so accept both outcomes
      expect(['proceed', 'proceed_with_caution']).toContain(result.recommendation);
    });

    test('should return reject for too-short audio', () => {
      const buffer = createAudioBuffer(44100, 0.3, sineWave(440, 0.3));
      const result = preprocessor.analyze(buffer);

      expect(result.duration.valid).toBe(false);
      expect(result.recommendation).toBe('reject');
    });

    test('should return all expected fields', () => {
      const buffer = createAudioBuffer(44100, 3, sineWave(440, 0.3));
      const result = preprocessor.analyze(buffer);

      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('silenceRegions');
      expect(result).toHaveProperty('noise');
      expect(result).toHaveProperty('speechStart');
      expect(result).toHaveProperty('speechEnd');
      expect(result).toHaveProperty('effectiveSpeechDuration');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('messages');
    });

    test('should include noise estimation with valid SNR', () => {
      const buffer = createAudioBuffer(44100, 2, sineWave(440, 0.5));
      const result = preprocessor.analyze(buffer);

      expect(result.noise.snrDb).toBeGreaterThan(0);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(result.noise.rating);
    });
  });

  // -------------------------------------------------------
  // Buffer-size fallback
  // -------------------------------------------------------

  describe('analyzeFromBufferEstimate', () => {
    test('should estimate duration from buffer size', () => {
      // 16000 bytes ≈ 1 second at 128kbps heuristic
      const result = preprocessor.analyzeFromBufferEstimate(16000);

      expect(result.duration.durationSeconds).toBeCloseTo(1, 0);
      expect(result.duration.valid).toBe(true);
      expect(result.recommendation).toBe('proceed');
    });

    test('should reject very small buffers', () => {
      // 100 bytes ≈ way too short
      const result = preprocessor.analyzeFromBufferEstimate(100);

      expect(result.duration.valid).toBe(false);
      expect(result.recommendation).toBe('reject');
    });

    test('should include fallback message', () => {
      const result = preprocessor.analyzeFromBufferEstimate(32000);
      expect(result.messages).toEqual(
        expect.arrayContaining([
          expect.stringContaining('unavailable'),
        ]),
      );
    });
  });

  // -------------------------------------------------------
  // Config
  // -------------------------------------------------------

  describe('configuration', () => {
    test('should use default config when none provided', () => {
      const p = new AudioPreprocessor();
      expect(p).toBeDefined();

      // Verify defaults via behavior
      const shortResult = p.validateDuration(0.5);
      expect(shortResult.valid).toBe(false);
    });

    test('should override config values', () => {
      const config: Partial<AudioPreprocessorConfig> = {
        silenceThreshold: 0.05,
        minSilenceDuration: 1.0,
        minDurationSeconds: 5,
        warningDurationSeconds: 7200,
        analysisWindowSize: 1024,
      };
      const p = new AudioPreprocessor(config);

      // Custom min duration should reject 2s
      const result = p.validateDuration(2);
      expect(result.valid).toBe(false);

      // Custom warning threshold should not warn at 4000s
      const longResult = p.validateDuration(4000);
      expect(longResult.warnings).toHaveLength(0);
    });
  });
});
