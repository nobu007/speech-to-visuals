import { jest } from '@jest/globals';
import {
  validateAudioFile,
  validateAudioDuration,
  MIN_AUDIO_DURATION_SECONDS,
} from '@stv/core/utils/audio-validation';
import { AUDIO_LIMITS } from '@stv/core/config/limits';

// ---------------------------------------------------------------------------
// validateAudioFile
// ---------------------------------------------------------------------------

describe('validateAudioFile', () => {
  // --- Valid cases ---

  it('accepts a valid MP3 file under size limit', () => {
    const file = new File([new ArrayBuffer(1024)], 'speech.mp3', { type: 'audio/mpeg' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a valid WAV file', () => {
    const file = new File([new ArrayBuffer(2048)], 'audio.wav', { type: 'audio/wav' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts a valid OGG file', () => {
    const file = new File([new ArrayBuffer(512)], 'sound.ogg', { type: 'audio/ogg' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts a valid M4A file', () => {
    const file = new File([new ArrayBuffer(512)], 'recording.m4a', { type: 'audio/mp4' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts audio/webm MIME type', () => {
    const file = new File([new ArrayBuffer(512)], 'voice.webm', { type: 'audio/webm' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts any audio/* MIME type even with non-standard extension', () => {
    const file = new File([new ArrayBuffer(512)], 'data.bin', { type: 'audio/x-custom' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  // --- Empty file (EDGE-001 partial) ---

  it('rejects an empty file (0 bytes)', () => {
    const file = new File([], 'empty.mp3', { type: 'audio/mpeg' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('empty')]),
    );
  });

  // --- File size limit (EDGE-101) ---

  it('rejects file exceeding 50MB limit', () => {
    const oversized = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES + 1;
    const file = new File(
      ['mock audio content'],
      'huge.mp3',
      { type: 'audio/mpeg' },
    );
    // Manually set size since we can't allocate 50MB+
    Object.defineProperty(file, 'size', { value: oversized, configurable: true });

    const result = validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('exceeds maximum')]),
    );
  });

  it('accepts file exactly at 50MB limit', () => {
    const exactSize = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES;
    const file = new File([], 'exact.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: exactSize, configurable: true });

    const result = validateAudioFile(file);
    expect(result.errors).not.toEqual(
      expect.arrayContaining([expect.stringContaining('exceeds maximum')]),
    );
  });

  // --- Unsupported format ---

  it('rejects non-audio file type with non-audio extension', () => {
    const file = new File([new ArrayBuffer(100)], 'doc.txt', { type: 'text/plain' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Unsupported audio file')]),
    );
  });

  it('accepts file with valid extension even if MIME type is empty', () => {
    const file = new File([new ArrayBuffer(100)], 'clip.mp3', { type: '' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  // --- Multiple errors ---

  it('reports both empty and wrong type errors', () => {
    const file = new File([], 'doc.pdf', { type: 'application/pdf' });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('empty'),
        expect.stringContaining('Unsupported'),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// validateAudioDuration
// ---------------------------------------------------------------------------

describe('validateAudioDuration', () => {
  // --- Valid durations ---

  it('accepts normal duration (30 seconds)', () => {
    const result = validateAudioDuration(30);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('accepts exactly 1 second (boundary)', () => {
    const result = validateAudioDuration(1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts long audio without warning under 1 hour', () => {
    const result = validateAudioDuration(3599);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  // --- EDGE-102: Sub-1s rejection ---

  it('rejects audio shorter than 1 second (EDGE-102)', () => {
    const result = validateAudioDuration(0.5);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('below minimum')]),
    );
  });

  it('rejects zero duration', () => {
    const result = validateAudioDuration(0);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('below minimum');
  });

  it('rejects very short audio (0.01 seconds)', () => {
    const result = validateAudioDuration(0.01);
    expect(result.valid).toBe(false);
  });

  // --- EDGE-103: Duration warning ---

  it('warns for audio exceeding 1 hour (EDGE-103)', () => {
    const result = validateAudioDuration(3601);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('exceeds recommended maximum')]),
    );
  });

  it('does not warn for exactly 1 hour (boundary)', () => {
    const result = validateAudioDuration(3600);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns for very long audio (7200 seconds = 2 hours)', () => {
    const result = validateAudioDuration(7200);
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toContain('120min');
  });

  // --- Invalid durations ---

  it('rejects negative duration', () => {
    const result = validateAudioDuration(-5);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid audio duration')]),
    );
  });

  it('rejects Infinity duration', () => {
    const result = validateAudioDuration(Infinity);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid audio duration')]),
    );
  });

  it('rejects NaN duration', () => {
    const result = validateAudioDuration(NaN);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid audio duration')]),
    );
  });
});

// ---------------------------------------------------------------------------
// Constants validation
// ---------------------------------------------------------------------------

describe('audio validation constants', () => {
  it('MIN_AUDIO_DURATION_SECONDS is 1', () => {
    expect(MIN_AUDIO_DURATION_SECONDS).toBe(1);
  });

  it('AUDIO_LIMITS.MAX_FILE_SIZE_BYTES is 50MB', () => {
    expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('AUDIO_LIMITS.DURATION_WARNING_SECONDS is 3600 (1 hour)', () => {
    expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBe(3600);
  });
});
