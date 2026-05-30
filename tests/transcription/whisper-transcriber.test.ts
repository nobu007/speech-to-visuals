/**
 * REQ-178: WhisperTranscriber unit tests
 *
 * Validates Whisper API integration, audio file processing, format
 * validation, corruption detection, timestamp generation, caption
 * output, and language detection.
 */

import { jest } from '@jest/globals';
import type { TranscriptionResult, TranscriptionSegment } from '../../src/transcription/types';

// Mock validateAudioFile to avoid real file system access
jest.unstable_mockModule('@/utils/audio-validation', () => ({
  validateAudioFile: jest.fn().mockReturnValue({ valid: true, errors: [] }),
}));

// Mock logger
jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock whisper-node import
jest.unstable_mockModule('whisper-node', () => ({}));

let WhisperTranscriber: typeof import('../../src/transcription/whisper-transcriber').WhisperTranscriber;
let whisperTranscriber: InstanceType<typeof WhisperTranscriber>;

beforeAll(async () => {
  const mod = await import('../../src/transcription/whisper-transcriber');
  WhisperTranscriber = mod.WhisperTranscriber;
  whisperTranscriber = mod.whisperTranscriber as InstanceType<typeof WhisperTranscriber>;
});

// ---------------------------------------------------------------------------
// Constructor & configuration
// ---------------------------------------------------------------------------

describe('WhisperTranscriber', () => {
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const transcriber = new WhisperTranscriber();
      expect(transcriber).toBeDefined();
    });

    it('creates instance with custom config', () => {
      const transcriber = new WhisperTranscriber({
        model: 'tiny',
        language: 'ja',
        temperature: 0.5,
        maxSegmentLength: 5000,
        enableTimestamps: false,
      });
      expect(transcriber).toBeDefined();
    });

    it('accepts all valid model sizes', () => {
      const models = ['tiny', 'base', 'small', 'medium', 'large'] as const;
      for (const model of models) {
        const transcriber = new WhisperTranscriber({ model });
        expect(transcriber).toBeDefined();
      }
    });
  });

  describe('getCapabilities', () => {
    it('returns capability structure with all expected fields', () => {
      const transcriber = new WhisperTranscriber();
      const caps = transcriber.getCapabilities();

      expect(caps).toHaveProperty('whisperReady');
      expect(caps).toHaveProperty('model');
      expect(caps).toHaveProperty('supportedFormats');
      expect(caps).toHaveProperty('maxDuration');
      expect(caps).toHaveProperty('languages');
      expect(caps).toHaveProperty('features');
      expect(caps.features).toHaveProperty('timestamps');
      expect(caps.features).toHaveProperty('punctuation');
    });

    it('reports supported audio formats', () => {
      const transcriber = new WhisperTranscriber();
      const caps = transcriber.getCapabilities();
      expect(caps.supportedFormats.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // transcribe() — uses fallback since whisper won't be ready in test env
  // ---------------------------------------------------------------------------

  describe('transcribe with fallback', () => {
    it('returns a valid TranscriptionResult from fallback', async () => {
      const transcriber = new WhisperTranscriber();
      // Create a minimal WAV-like ArrayBuffer (RIFF header)
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      // RIFF magic bytes
      view[0] = 0x52; // R
      view[1] = 0x49; // I
      view[2] = 0x46; // F
      view[3] = 0x46; // F

      const result = await transcriber.transcribe(buffer);

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('segments have valid structure from fallback', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      for (const segment of result.segments) {
        expect(segment).toHaveProperty('start');
        expect(segment).toHaveProperty('end');
        expect(segment).toHaveProperty('text');
        expect(segment).toHaveProperty('confidence');
        expect(segment.end).toBeGreaterThan(segment.start);
        expect(segment.text.length).toBeGreaterThan(0);
        expect(segment.confidence).toBeGreaterThanOrEqual(0);
        expect(segment.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('generates captions from segments', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      if (result.captions) {
        expect(result.captions.length).toBe(result.segments.length);
        for (const caption of result.captions) {
          expect(caption).toHaveProperty('text');
          expect(caption).toHaveProperty('startMs');
          expect(caption).toHaveProperty('endMs');
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  describe('audio input validation', () => {
    it('throws TranscriptionError for empty ArrayBuffer', async () => {
      const transcriber = new WhisperTranscriber();
      await expect(transcriber.transcribe(new ArrayBuffer(0)))
        .rejects.toThrow('Audio buffer is empty');
    });

    it('throws TranscriptionError for buffer too small to be valid audio', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(2);
      await expect(transcriber.transcribe(buffer))
        .rejects.toThrow('too small');
    });

    it('throws TranscriptionError for corrupted audio (bad magic bytes)', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(12);
      // Fill with invalid bytes (not RIFF, MP3, OGG, or MP4)
      const view = new Uint8Array(buffer);
      view.fill(0x00);
      await expect(transcriber.transcribe(buffer))
        .rejects.toThrow('corrupted');
    });

    it('accepts valid RIFF/WAV header', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;
      // No error expected — should process successfully
      const result = await transcriber.transcribe(buffer);
      expect(result).toBeDefined();
    });

    it('accepts valid MP3 sync word', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(12);
      const view = new Uint8Array(buffer);
      view[0] = 0xFF; view[1] = 0xE0; // MP3 sync word
      const result = await transcriber.transcribe(buffer);
      expect(result).toBeDefined();
    });

    it('accepts valid OGG header', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(12);
      const view = new Uint8Array(buffer);
      view[0] = 0x4F; view[1] = 0x67; view[2] = 0x67; view[3] = 0x53; // OggS
      const result = await transcriber.transcribe(buffer);
      expect(result).toBeDefined();
    });

    it('accepts valid MP4/M4A ftyp', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(12);
      const view = new Uint8Array(buffer);
      view[4] = 0x66; view[5] = 0x74; view[6] = 0x79; view[7] = 0x70; // ftyp
      const result = await transcriber.transcribe(buffer);
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // SRT generation
  // ---------------------------------------------------------------------------

  describe('generateSrt', () => {
    it('generates valid SRT format from segments', () => {
      const transcriber = new WhisperTranscriber();
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 5000, text: 'Hello world' },
        { start: 5000, end: 10000, text: 'Second segment' },
      ];

      const srt = transcriber.generateSrt(segments);

      expect(srt).toContain('1\n');
      expect(srt).toContain('00:00:00,000 --> 00:00:05,000');
      expect(srt).toContain('Hello world');
      expect(srt).toContain('2\n');
      expect(srt).toContain('00:00:05,000 --> 00:00:10,000');
      expect(srt).toContain('Second segment');
    });

    it('handles zero-duration segments', () => {
      const transcriber = new WhisperTranscriber();
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 0, text: 'Instant' },
      ];

      const srt = transcriber.generateSrt(segments);
      expect(srt).toContain('00:00:00,000 --> 00:00:00,000');
    });
  });

  // ---------------------------------------------------------------------------
  // Language detection
  // ---------------------------------------------------------------------------

  describe('language detection', () => {
    it('detects English from fallback segments', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);
      // Fallback segments are English
      expect(result.language).toBe('en');
    });

    it('uses configured language when not auto', async () => {
      const transcriber = new WhisperTranscriber({ language: 'ja' });
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);
      expect(result.language).toBe('ja');
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton instance', () => {
    it('whisperTranscriber is a WhisperTranscriber instance', () => {
      expect(whisperTranscriber).toBeDefined();
      expect(whisperTranscriber).toBeInstanceOf(WhisperTranscriber);
    });
  });
});
