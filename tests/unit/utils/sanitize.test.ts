/**
 * REQ-132: sanitizeFilename Unit Tests
 *
 * Validates the filename sanitization utility (src/utils/sanitize.ts)
 * against path traversal, null-byte injection, control characters,
 * and other edge cases.
 */

import { sanitizeFilename } from '../../../src/utils/sanitize';

describe('sanitizeFilename (REQ-132)', () => {
  // =========================================================================
  // Normal filenames pass through unchanged
  // =========================================================================

  describe('normal filenames', () => {
    test('should preserve simple filenames', () => {
      expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
    });

    test('should preserve filenames with hyphens', () => {
      expect(sanitizeFilename('my-audio-file.mp3')).toBe('my-audio-file.mp3');
    });

    test('should preserve filenames with underscores', () => {
      expect(sanitizeFilename('scene_data_01.json')).toBe('scene_data_01.json');
    });

    test('should preserve filenames with spaces (after trim)', () => {
      expect(sanitizeFilename('my file.txt')).toBe('my file.txt');
    });

    test('should preserve unicode filenames', () => {
      expect(sanitizeFilename('図解データ.json')).toBe('図解データ.json');
    });

    test('should preserve emoji filenames', () => {
      expect(sanitizeFilename('🎬video.mp4')).toBe('🎬video.mp4');
    });

    test('should preserve numeric filenames', () => {
      expect(sanitizeFilename('12345')).toBe('12345');
    });
  });

  // =========================================================================
  // Path traversal prevention
  // =========================================================================

  describe('path traversal prevention', () => {
    test('should remove parent directory traversal (..)', () => {
      expect(sanitizeFilename('..')).toBe('unnamed');
    });

    test('should remove ../ prefix', () => {
      expect(sanitizeFilename('../etc/passwd')).toBe('_etc_passwd');
    });

    test('should remove ..\\ prefix', () => {
      // ..→removed, \→_, so "..\windows\system32" → ".._windows_system32" → "_windows_system32"
      expect(sanitizeFilename('..\\windows\\system32')).toBe('_windows_system32');
    });

    test('should remove multiple traversals', () => {
      // ../../etc/passwd → .._.._etc_passwd → __etc_passwd (.. removed, _ from / remain)
      expect(sanitizeFilename('../../etc/passwd')).toBe('__etc_passwd');
    });

    test('should handle traversal in the middle', () => {
      // foo../bar → foo.._bar → foo_bar (.. removed, _ from / remains)
      expect(sanitizeFilename('foo../bar')).toBe('foo_bar');
    });

    test('should handle complex traversal patterns', () => {
      // ..\..\..\etc\shadow → .._.._.._etc_shadow → ___etc_shadow
      expect(sanitizeFilename('..\\..\\..\\etc\\shadow')).toBe('___etc_shadow');
    });
  });

  // =========================================================================
  // Directory separator handling
  // =========================================================================

  describe('directory separator handling', () => {
    test('should replace forward slash with underscore', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    });

    test('should replace backslash with underscore', () => {
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    test('should replace multiple separators', () => {
      expect(sanitizeFilename('a/b\\c/d')).toBe('a_b_c_d');
    });

    test('should handle leading separator', () => {
      expect(sanitizeFilename('/etc/passwd')).toBe('_etc_passwd');
    });
  });

  // =========================================================================
  // Null byte injection
  // =========================================================================

  describe('null byte injection', () => {
    test('should remove null bytes', () => {
      expect(sanitizeFilename('file\x00.txt')).toBe('file.txt');
    });

    test('should remove multiple null bytes', () => {
      expect(sanitizeFilename('f\x00i\x00l\x00e.txt')).toBe('file.txt');
    });

    test('should handle null byte at start', () => {
      expect(sanitizeFilename('\x00file.txt')).toBe('file.txt');
    });

    test('should handle null byte at end', () => {
      expect(sanitizeFilename('file.txt\x00')).toBe('file.txt');
    });
  });

  // =========================================================================
  // Control characters
  // =========================================================================

  describe('control characters', () => {
    test('should remove tab character', () => {
      expect(sanitizeFilename('file\tname.txt')).toBe('filename.txt');
    });

    test('should remove newline character', () => {
      expect(sanitizeFilename('file\nname.txt')).toBe('filename.txt');
    });

    test('should remove carriage return', () => {
      expect(sanitizeFilename('file\rname.txt')).toBe('filename.txt');
    });

    test('should remove DEL character (0x7F)', () => {
      expect(sanitizeFilename('file\x7Fname.txt')).toBe('filename.txt');
    });

    test('should remove mixed control characters', () => {
      expect(sanitizeFilename('\x01\x02\x03file\x10\x11name\x1F.txt')).toBe('filename.txt');
    });
  });

  // =========================================================================
  // Leading dots (hidden files)
  // =========================================================================

  describe('leading dots', () => {
    test('should strip single leading dot', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
    });

    test('should strip multiple leading dots', () => {
      expect(sanitizeFilename('...file')).toBe('file');
    });

    test('should preserve dots in the middle', () => {
      expect(sanitizeFilename('file.name.txt')).toBe('file.name.txt');
    });

    test('should handle dot followed by traversal (..file)', () => {
      // ".." is removed by DOTDOT_PATTERN first, then leading "." stripped
      expect(sanitizeFilename('..file')).toBe('file');
    });
  });

  // =========================================================================
  // Empty / whitespace input
  // =========================================================================

  describe('empty and whitespace input', () => {
    test('should return "unnamed" for empty string', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
    });

    test('should return "unnamed" for whitespace-only string', () => {
      expect(sanitizeFilename('   ')).toBe('unnamed');
    });

    test('should return "unnamed" when all chars are stripped (path traversal)', () => {
      expect(sanitizeFilename('..')).toBe('unnamed');
    });

    test('should return "unnamed" when only dots remain', () => {
      expect(sanitizeFilename('...')).toBe('unnamed');
    });

    test('should return "unnamed" when only control chars given', () => {
      expect(sanitizeFilename('\x01\x02\x03')).toBe('unnamed');
    });
  });

  // =========================================================================
  // Whitespace trimming
  // =========================================================================

  describe('whitespace trimming', () => {
    test('should trim leading whitespace', () => {
      expect(sanitizeFilename('  file.txt')).toBe('file.txt');
    });

    test('should trim trailing whitespace', () => {
      expect(sanitizeFilename('file.txt  ')).toBe('file.txt');
    });

    test('should trim both leading and trailing whitespace', () => {
      expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
    });
  });

  // =========================================================================
  // Mixed attack patterns
  // =========================================================================

  describe('mixed attack patterns', () => {
    test('should handle traversal + null bytes + separators', () => {
      // ..\0/\0etc/passwd → .._etc_passwd → _etc_passwd
      expect(sanitizeFilename('..\x00/\x00etc/passwd')).toBe('_etc_passwd');
    });

    test('should handle hidden file with traversal', () => {
      expect(sanitizeFilename('.../.htaccess')).toBe('_.htaccess');
    });

    test('should handle control chars with separators', () => {
      expect(sanitizeFilename('\x01path/\x02to\x03\\file')).toBe('path_to_file');
    });
  });
});
