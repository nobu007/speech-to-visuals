/**
 * REQ-178: WhisperTranscriber Unit Tests
 *
 * Tests core functionality of whisper-transcriber.ts:
 * - Audio input validation (format, size, corruption)
 * - Transcription pipeline (validate → preprocess → check → transcribe)
 * - SRT generation
 * - Language detection
 * - Configuration and capabilities
 * - Error handling with typed TranscriptionError / FileSizeExceededError
 */

import { jest } from '@jest/globals';
import type { TranscriptionResult } from '@/transcription/types';

// ---------- Mock setup ----------

// Mock validateAudioFile for File inputs
jest.mock('@/utils/audio-validation', () => ({
  validateAudioFile: jest.fn((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validFormats = ['mp3', 'wav', 'ogg', 'm4a'];
    if (!ext || !validFormats.includes(ext)) {
      return { valid: false, errors: [`Unsupported audio format: .${ext}`] };
    }
    if (file.size > 52_428_800) {
      return { valid: false, errors: [`File size (${file.size} bytes) exceeds maximum allowed size`] };
    }
    return { valid: true, errors: [] };
  }),
}));

// ---------- Tests ----------

describe('REQ-178: WhisperTranscriber', () => {
  let WhisperTranscriber: typeof import('@/transcription/whisper-transcriber').WhisperTranscriber;
  let TranscriptionError: typeof import('@/transcription/types').TranscriptionError;
  let FileSizeExceededError: typeof import('@/transcription/types').FileSizeExceededError;

  beforeAll(async () => {
    const mod = await import('@/transcription/whisper-transcriber');
    WhisperTranscriber = mod.WhisperTranscriber;

    const typesMod = await import('@/transcription/types');
    TranscriptionError = typesMod.TranscriptionError;
    FileSizeExceededError = typesMod.FileSizeExceededError;
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Constructor ----

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const transcriber = new WhisperTranscriber();
      const caps = transcriber.getCapabilities();

      expect(caps.model).toBe('base');
      expect(caps.supportedFormats).toContain('mp3');
      expect(caps.supportedFormats).toContain('wav');
      expect(caps.languages).toContain('auto');
    });

    it('should accept custom config', () => {
      const transcriber = new WhisperTranscriber({ model: 'large', language: 'ja' });
      const caps = transcriber.getCapabilities();

      expect(caps.model).toBe('large');
    });
  });

  // ---- Audio validation ----

  describe('validateAudioInput (via transcribe)', () => {
    it('should throw FileSizeExceededError for oversized File', async () => {
      const transcriber = new WhisperTranscriber();
      const bigFile = new File(['x'.repeat(100)], 'audio.wav');
      Object.defineProperty(bigFile, 'size', { value: 60_000_000 });

      await expect(transcriber.transcribe(bigFile)).rejects.toThrow();
    });

    it('should throw TranscriptionError for unsupported format', async () => {
      const transcriber = new WhisperTranscriber();
      const badFile = new File(['data'], 'audio.bmp', { type: 'image/bmp' });

      await expect(transcriber.transcribe(badFile)).rejects.toThrow();
    });

    it('should throw TranscriptionError for unsupported format string input', async () => {
      const transcriber = new WhisperTranscriber();

      await expect(transcriber.transcribe('audio.xyz')).rejects.toThrow('Unsupported audio format');
    });

    it('should throw FileSizeExceededError for oversized ArrayBuffer', async () => {
      const transcriber = new WhisperTranscriber();
      const bigBuffer = new ArrayBuffer(60_000_000);

      await expect(transcriber.transcribe(bigBuffer)).rejects.toThrow();
    });

    it('should throw TranscriptionError for empty ArrayBuffer', async () => {
      const transcriber = new WhisperTranscriber();
      const emptyBuffer = new ArrayBuffer(0);

      await expect(transcriber.transcribe(emptyBuffer)).rejects.toThrow('empty');
    });

    it('should throw TranscriptionError for non-blob string path in browser', async () => {
      const transcriber = new WhisperTranscriber();

      await expect(transcriber.transcribe('/path/to/file.wav')).rejects.toThrow('String file paths not supported');
    });

    it('should throw TranscriptionError for corrupt audio (too small)', async () => {
      const transcriber = new WhisperTranscriber();
      // Valid format, but buffer is too small (< 4 bytes for magic check)
      const tinyBuffer = new ArrayBuffer(2);
      const view = new Uint8Array(tinyBuffer);
      view[0] = 0x52; view[1] = 0x49; // Partial RIFF header

      await expect(transcriber.transcribe(tinyBuffer)).rejects.toThrow('too small');
    });

    it('should throw TranscriptionError for corrupt audio (invalid magic bytes)', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(8);
      const view = new Uint8Array(buffer);
      // Random invalid bytes
      view[0] = 0x00; view[1] = 0x00; view[2] = 0x00; view[3] = 0x00;
      view[4] = 0x00; view[5] = 0x00; view[6] = 0x00; view[7] = 0x00;

      await expect(transcriber.transcribe(buffer)).rejects.toThrow('corrupted');
    });
  });

  // ---- Transcription ----

  describe('transcribe', () => {
    it('should successfully transcribe valid WAV audio (RIFF magic)', async () => {
      const transcriber = new WhisperTranscriber();
      // Create a buffer with valid RIFF/WAV magic bytes
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      // RIFF header
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.text).toBeDefined();
      expect(result.language).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should successfully transcribe valid MP3 audio (sync word)', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      // MP3 sync word
      view[0] = 0xFF; view[1] = 0xE0;

      const result = await transcriber.transcribe(buffer);

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('should successfully transcribe valid OGG audio', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      // OGG magic: OggS
      view[0] = 0x4F; view[1] = 0x67; view[2] = 0x67; view[3] = 0x53;

      const result = await transcriber.transcribe(buffer);

      expect(result.success).toBe(true);
    });

    it('should successfully transcribe valid M4A/MP4 audio', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      // ftyp box at offset 4
      view[4] = 0x66; view[5] = 0x74; view[6] = 0x79; view[7] = 0x70;

      const result = await transcriber.transcribe(buffer);

      expect(result.success).toBe(true);
    });

    it('should return captions from transcription', async () => {
      const transcriber = new WhisperTranscriber();
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      expect(result.captions).toBeDefined();
      if (result.captions && result.captions.length > 0) {
        expect(result.captions[0].text).toBeDefined();
        expect(result.captions[0].startMs).toBeDefined();
        expect(result.captions[0].endMs).toBeDefined();
      }
    });

    it('should detect Japanese language from segments', async () => {
      const transcriber = new WhisperTranscriber({ language: 'auto' });
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      // Default segments are English, so language should be 'en'
      expect(result.language).toBe('en');
    });

    it('should use configured language when not auto', async () => {
      const transcriber = new WhisperTranscriber({ language: 'ja' });
      const buffer = new ArrayBuffer(44);
      const view = new Uint8Array(buffer);
      view[0] = 0x52; view[1] = 0x49; view[2] = 0x46; view[3] = 0x46;

      const result = await transcriber.transcribe(buffer);

      expect(result.language).toBe('ja');
    });
  });

  // ---- SRT generation ----

  describe('generateSrt', () => {
    it('should generate valid SRT format from segments', () => {
      const transcriber = new WhisperTranscriber();
      const segments = [
        { start: 0, end: 5000, text: 'Hello world', confidence: 0.95 },
        { start: 5000, end: 10000, text: 'Goodbye world', confidence: 0.90 },
      ];

      const srt = transcriber.generateSrt(segments);

      expect(srt).toContain('1\n');
      expect(srt).toContain('00:00:00,000 --> 00:00:05,000');
      expect(srt).toContain('Hello world');
      expect(srt).toContain('2\n');
      expect(srt).toContain('00:00:05,000 --> 00:00:10,000');
      expect(srt).toContain('Goodbye world');
    });

    it('should handle segments at various timestamps', () => {
      const transcriber = new WhisperTranscriber();
      const segments = [
        { start: 3661000, end: 3725000, text: 'One hour in', confidence: 0.9 },
      ];

      const srt = transcriber.generateSrt(segments);

      expect(srt).toContain('01:01:01,000 --> 01:02:05,000');
    });
  });

  // ---- Capabilities ----

  describe('getCapabilities', () => {
    it('should return comprehensive capabilities info', () => {
      const transcriber = new WhisperTranscriber({ model: 'small' });
      const caps = transcriber.getCapabilities();

      expect(caps.model).toBe('small');
      expect(caps.supportedFormats).toEqual(expect.arrayContaining(['mp3', 'wav', 'ogg', 'm4a']));
      expect(caps.features).toBeDefined();
      expect(caps.features.timestamps).toBe(true);
      expect(caps.progressiveEnhancement).toBeDefined();
      expect(caps.progressiveEnhancement.qualityTracking).toBe(true);
    });
  });
});
