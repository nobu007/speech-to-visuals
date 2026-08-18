import { jest } from '@jest/globals';
import {
  validateAudioFileMetadata,
} from '@stv/core/utils/audio-validation';
import { AUDIO_LIMITS } from '@stv/core/config/limits';

// ---------------------------------------------------------------------------
// validateAudioFileMetadata (REQ-148 — server-side, no File object)
// ---------------------------------------------------------------------------

describe('validateAudioFileMetadata', () => {
  // --- Valid cases ---

  it('accepts a valid MP3 filename', () => {
    const result = validateAudioFileMetadata({ name: 'speech.mp3' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a valid WAV filename with size', () => {
    const result = validateAudioFileMetadata({ name: 'audio.wav', size: 2048 });
    expect(result.valid).toBe(true);
  });

  it('accepts OGG, M4A formats', () => {
    expect(validateAudioFileMetadata({ name: 's.ogg' }).valid).toBe(true);
    expect(validateAudioFileMetadata({ name: 'rec.m4a' }).valid).toBe(true);
  });

  it('accepts uppercase extension', () => {
    const result = validateAudioFileMetadata({ name: 'VOICE.MP3' });
    expect(result.valid).toBe(true);
  });

  it('accepts filename with multiple dots', () => {
    const result = validateAudioFileMetadata({ name: 'my.audio.file.wav' });
    expect(result.valid).toBe(true);
  });

  it('accepts file at exactly 50MB', () => {
    const result = validateAudioFileMetadata({ name: 'big.mp3', size: AUDIO_LIMITS.MAX_FILE_SIZE_BYTES });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('skips size check when size is undefined', () => {
    const result = validateAudioFileMetadata({ name: 'unknown-size.mp3' });
    expect(result.valid).toBe(true);
  });

  // --- Invalid extension ---

  it('rejects non-audio extension', () => {
    const result = validateAudioFileMetadata({ name: 'document.txt' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unsupported audio format');
    expect(result.errors[0]).toContain('txt');
  });

  it('rejects filename with no extension', () => {
    const result = validateAudioFileMetadata({ name: 'noext' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('none');
  });

  it('rejects video extension', () => {
    const result = validateAudioFileMetadata({ name: 'movie.mp4' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unsupported');
  });

  // --- Size errors ---

  it('rejects empty file (0 bytes)', () => {
    const result = validateAudioFileMetadata({ name: 'empty.mp3', size: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('empty')]),
    );
  });

  it('rejects file exceeding 50MB limit', () => {
    const result = validateAudioFileMetadata({
      name: 'huge.mp3',
      size: AUDIO_LIMITS.MAX_FILE_SIZE_BYTES + 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('exceeds maximum')]),
    );
  });

  // --- Non-finite / negative size (mirror validateAudioDuration's guard) ---
  // A file size can be neither non-finite nor negative. JSON.parse('1e400')
  // yields Infinity at the API boundary, so these must be rejected like the
  // duration validator already rejects them.

  it('rejects Infinity size', () => {
    const result = validateAudioFileMetadata({ name: 'inf.mp3', size: Infinity });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid file size')]),
    );
  });

  it('rejects -Infinity size', () => {
    const result = validateAudioFileMetadata({ name: 'ninf.mp3', size: -Infinity });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid file size')]),
    );
  });

  it('rejects NaN size', () => {
    const result = validateAudioFileMetadata({ name: 'nan.mp3', size: NaN });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid file size')]),
    );
  });

  it('rejects negative size', () => {
    const result = validateAudioFileMetadata({ name: 'neg.mp3', size: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid file size')]),
    );
  });

  // --- Combined errors ---

  it('reports both extension and size errors', () => {
    const result = validateAudioFileMetadata({ name: 'doc.pdf', size: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unsupported'),
        expect.stringContaining('empty'),
      ]),
    );
  });

  // --- Warnings ---

  it('returns empty warnings for valid metadata', () => {
    const result = validateAudioFileMetadata({ name: 'ok.mp3', size: 1024 });
    expect(result.warnings).toHaveLength(0);
  });
});
