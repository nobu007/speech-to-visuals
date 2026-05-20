/**
 * Tests for audio-validation utilities (src/utils/audio-validation.ts)
 */

import {
  validateAudioFile,
  validateAudioDuration,
  validateAudioFileMetadata,
  MIN_AUDIO_DURATION_SECONDS,
} from '@/utils/audio-validation';

// Mock File for Node.js environment
class MockFile {
  name: string;
  size: number;
  type: string;
  constructor(bits: BlobPart[], name: string, opts?: { type?: string }) {
    this.name = name;
    this.size = bits.reduce((acc: number, b: unknown) => acc + (typeof b === 'string' ? b.length : 0), 0);
    this.type = opts?.type ?? '';
  }
}

// ── validateAudioFile ────────────────────────────────────────────────

describe('validateAudioFile', () => {
  test('accepts valid MP3 file', () => {
    const file = new MockFile(['data'], 'speech.mp3', { type: 'audio/mpeg' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts valid WAV file', () => {
    const file = new MockFile(['data'], 'audio.wav', { type: 'audio/wav' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
  });

  test('accepts valid OGG file', () => {
    const file = new MockFile(['data'], 'audio.ogg', { type: 'audio/ogg' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
  });

  test('accepts valid M4A file', () => {
    const file = new MockFile(['data'], 'audio.m4a', { type: 'audio/mp4' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
  });

  test('accepts WebM file by extension', () => {
    const file = new MockFile(['data'], 'audio.webm', { type: 'audio/webm' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
  });

  test('rejects empty file (0 bytes)', () => {
    const file = new MockFile([], 'empty.mp3', { type: 'audio/mpeg' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
  });

  test('rejects file exceeding max size', () => {
    // MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 = 52428800
    const largeData = new Array(51 * 1024 * 1024).fill('x').join('');
    const file = new MockFile([largeData], 'big.mp3', { type: 'audio/mpeg' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  test('rejects unsupported file type', () => {
    const file = new MockFile(['data'], 'file.exe', { type: 'application/x-msdownload' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsupported'))).toBe(true);
  });

  test('accepts file with audio/* MIME type even without exact match', () => {
    const file = new MockFile(['data'], 'audio.mp3', { type: 'audio/custom' });
    const result = validateAudioFile(file as unknown as File);
    expect(result.valid).toBe(true);
  });
});

// ── validateAudioDuration ────────────────────────────────────────────

describe('validateAudioDuration', () => {
  test('accepts valid duration', () => {
    const result = validateAudioDuration(5.0);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects duration below minimum', () => {
    const result = validateAudioDuration(0.5);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
  });

  test('rejects negative duration', () => {
    const result = validateAudioDuration(-1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid'))).toBe(true);
  });

  test('rejects NaN duration', () => {
    const result = validateAudioDuration(NaN);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid'))).toBe(true);
  });

  test('rejects Infinity duration', () => {
    const result = validateAudioDuration(Infinity);
    expect(result.valid).toBe(false);
  });

  test('accepts duration at minimum boundary', () => {
    const result = validateAudioDuration(MIN_AUDIO_DURATION_SECONDS);
    expect(result.valid).toBe(true);
  });

  test('warns for long audio (> 3600s)', () => {
    const result = validateAudioDuration(4000);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('exceeds recommended'))).toBe(true);
  });

  test('no warning for audio under 3600s', () => {
    const result = validateAudioDuration(3000);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── validateAudioFileMetadata ────────────────────────────────────────

describe('validateAudioFileMetadata', () => {
  test('accepts valid metadata', () => {
    const result = validateAudioFileMetadata({ name: 'speech.mp3', size: 1024 });
    expect(result.valid).toBe(true);
  });

  test('accepts metadata without size (server-side)', () => {
    const result = validateAudioFileMetadata({ name: 'audio.wav' });
    expect(result.valid).toBe(true);
  });

  test('rejects unsupported extension', () => {
    const result = validateAudioFileMetadata({ name: 'video.avi', size: 1024 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsupported'))).toBe(true);
  });

  test('rejects file with no extension', () => {
    const result = validateAudioFileMetadata({ name: 'noextension' });
    expect(result.valid).toBe(false);
  });

  test('rejects empty file (size = 0)', () => {
    const result = validateAudioFileMetadata({ name: 'empty.mp3', size: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
  });

  test('rejects oversized file', () => {
    const result = validateAudioFileMetadata({ name: 'big.mp3', size: 60 * 1024 * 1024 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  test('accepts all supported formats', () => {
    for (const ext of ['mp3', 'wav', 'ogg', 'm4a']) {
      const result = validateAudioFileMetadata({ name: `audio.${ext}` });
      expect(result.valid).toBe(true);
    }
  });

  test('extension check is case-insensitive', () => {
    const result = validateAudioFileMetadata({ name: 'audio.MP3' });
    expect(result.valid).toBe(true);
  });
});
