/**
 * Tests for filename sanitization (src/utils/sanitize.ts)
 */

import { sanitizeFilename } from '@/utils/sanitize';

describe('sanitizeFilename', () => {
  test('returns clean filenames unchanged', () => {
    expect(sanitizeFilename('audio.mp3')).toBe('audio.mp3');
    expect(sanitizeFilename('my-file.wav')).toBe('my-file.wav');
    expect(sanitizeFilename('report_2024.pdf')).toBe('report_2024.pdf');
  });

  test('replaces forward slashes with underscore', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
  });

  test('replaces backslashes with underscore', () => {
    expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  test('removes parent directory traversals', () => {
    // ../ → _ (slash replaced), then .. removed → final: ___etc_passwd
    expect(sanitizeFilename('../../../etc/passwd')).toBe('___etc_passwd');
  });

  test('removes null bytes', () => {
    expect(sanitizeFilename('file\x00name.txt')).toBe('filename.txt');
  });

  test('removes control characters', () => {
    expect(sanitizeFilename('file\x01\x02\x03name.txt')).toBe('filename.txt');
  });

  test('removes DEL character (0x7F)', () => {
    expect(sanitizeFilename('file\x7fname.txt')).toBe('filename.txt');
  });

  test('strips leading dots (hidden files)', () => {
    expect(sanitizeFilename('.htaccess')).toBe('htaccess');
    expect(sanitizeFilename('..bashrc')).toBe('bashrc');
  });

  test('trims whitespace', () => {
    expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
  });

  test('returns "unnamed" for empty input', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
  });

  test('returns "unnamed" for input that becomes empty after sanitization', () => {
    expect(sanitizeFilename('...')).toBe('unnamed');
    expect(sanitizeFilename('   ')).toBe('unnamed');
    expect(sanitizeFilename('\x00\x01')).toBe('unnamed');
  });

  test('handles combined attack patterns', () => {
    const result = sanitizeFilename('../../../\x00etc/secret\x7F');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('..');
    expect(result).not.toContain('\x00');
    expect(result).not.toContain('\x7F');
  });

  test('preserves unicode characters', () => {
    expect(sanitizeFilename('音声ファイル.mp3')).toBe('音声ファイル.mp3');
  });

  test('preserves spaces in the middle', () => {
    expect(sanitizeFilename('my audio file.mp3')).toBe('my audio file.mp3');
  });
});
