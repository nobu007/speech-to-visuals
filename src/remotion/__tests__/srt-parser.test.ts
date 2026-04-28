/**
 * Tests for srt-parser.ts
 * SRT format parsing, timestamp conversion, frame mapping, and error handling
 */

import {
  parseSrt,
  parseTimestamp,
  SrtCaption,
  SrtParseError,
} from '../srt-parser';

describe('parseTimestamp', () => {
  describe('valid timestamps', () => {
    it('should parse 00:00:00,000 to 0ms', () => {
      expect(parseTimestamp('00:00:00,000')).toBe(0);
    });

    it('should parse 00:00:01,000 to 1000ms', () => {
      expect(parseTimestamp('00:00:01,000')).toBe(1000);
    });

    it('should parse 00:00:03,500 to 3500ms', () => {
      expect(parseTimestamp('00:00:03,500')).toBe(3500);
    });

    it('should parse 00:01:30,000 to 90000ms', () => {
      expect(parseTimestamp('00:01:30,000')).toBe(90000);
    });

    it('should parse 01:00:00,000 to 3600000ms', () => {
      expect(parseTimestamp('01:00:00,000')).toBe(3600000);
    });

    it('should parse 01:23:45,678 correctly', () => {
      // 1h = 3600000ms, 23m = 1380000ms, 45s = 45000ms, 678ms
      expect(parseTimestamp('01:23:45,678')).toBe(5025678);
    });

    it('should parse timestamps with 3-digit ms', () => {
      expect(parseTimestamp('00:00:00,999')).toBe(999);
    });

    it('should parse timestamps at exactly 1 hour', () => {
      expect(parseTimestamp('01:00:00,000')).toBe(3600000);
    });
  });

  describe('invalid timestamps', () => {
    it('should throw SrtParseError for empty string', () => {
      expect(() => parseTimestamp('')).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for malformed format', () => {
      expect(() => parseTimestamp('invalid')).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for missing milliseconds', () => {
      expect(() => parseTimestamp('00:00:01')).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for dot separator instead of comma', () => {
      expect(() => parseTimestamp('00:00:01.000')).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for partial timestamp', () => {
      expect(() => parseTimestamp('00:01')).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for non-numeric values', () => {
      expect(() => parseTimestamp('ab:cd:ef,ghi')).toThrow(SrtParseError);
    });
  });
});

describe('parseSrt', () => {
  describe('valid SRT content', () => {
    it('should parse a single caption block', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
これは最初のキャプションです`;

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(1);
      expect(captions[0]).toEqual({
        index: 1,
        startMs: 1000,
        endMs: 3000,
        text: 'これは最初のキャプションです',
        startFrame: 30,
        endFrame: 90,
      });
    });

    it('should parse multiple caption blocks', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
First caption

2
00:00:03,500 --> 00:00:06,000
Second caption`;

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(2);
      expect(captions[0].index).toBe(1);
      expect(captions[0].text).toBe('First caption');
      expect(captions[1].index).toBe(2);
      expect(captions[1].text).toBe('Second caption');
    });

    it('should parse captions with multiline text', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
First line
Second line`;

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(1);
      expect(captions[0].text).toBe('First line\nSecond line');
    });

    it('should parse three captions sequentially', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Caption one

2
00:00:03,500 --> 00:00:06,000
Caption two

3
00:00:06,500 --> 00:00:10,000
Caption three`;

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(3);
      expect(captions[2].startMs).toBe(6500);
      expect(captions[2].endMs).toBe(10000);
    });

    it('should handle SRT with trailing newline', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Hello

`;

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(1);
    });

    it('should handle SRT with Windows line endings (CRLF)', () => {
      const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nHello world";

      const captions = parseSrt(srt);
      expect(captions).toHaveLength(1);
      expect(captions[0].text).toBe('Hello world');
    });
  });

  describe('empty or invalid content', () => {
    it('should return empty array for empty string', () => {
      expect(parseSrt('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      expect(parseSrt('   \n\n  ')).toEqual([]);
    });

    it('should throw SrtParseError for invalid timestamp format', () => {
      const srt = `1
invalid --> 00:00:03,000
Hello`;

      expect(() => parseSrt(srt)).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for missing arrow separator', () => {
      const srt = `1
00:00:01,000 00:00:03,000
Hello`;

      expect(() => parseSrt(srt)).toThrow(SrtParseError);
    });

    it('should throw SrtParseError for missing text', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000`;

      expect(() => parseSrt(srt)).toThrow(SrtParseError);
    });

    it('should throw SrtParseError when end time is before start time', () => {
      const srt = `1
00:00:05,000 --> 00:00:01,000
Invalid range`;

      expect(() => parseSrt(srt)).toThrow(SrtParseError);
    });
  });

  describe('frame mapping', () => {
    it('should map start/end to correct frames at 30fps', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Test`;

      const captions = parseSrt(srt, 30);
      expect(captions[0].startFrame).toBe(30);   // 1000ms * 30fps / 1000 = 30
      expect(captions[0].endFrame).toBe(90);     // 3000ms * 30fps / 1000 = 90
    });

    it('should map frames correctly at 24fps', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Test`;

      const captions = parseSrt(srt, 24);
      expect(captions[0].startFrame).toBe(24);   // 1000ms * 24fps / 1000 = 24
      expect(captions[0].endFrame).toBe(72);     // 3000ms * 24fps / 1000 = 72
    });

    it('should map frames at 60fps', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Test`;

      const captions = parseSrt(srt, 60);
      expect(captions[0].startFrame).toBe(60);
      expect(captions[0].endFrame).toBe(180);
    });

    it('should round frame numbers correctly', () => {
      // 33ms at 30fps = 0.99 frames -> rounds to 1
      const srt = `1
00:00:00,033 --> 00:00:00,066
Test`;

      const captions = parseSrt(srt, 30);
      expect(captions[0].startFrame).toBe(1);
      expect(captions[0].endFrame).toBe(2);
    });
  });

  describe('SrtCaption type', () => {
    it('should have all required fields', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Test caption`;

      const captions = parseSrt(srt, 30);
      const caption = captions[0];

      expect(caption).toHaveProperty('index');
      expect(caption).toHaveProperty('startMs');
      expect(caption).toHaveProperty('endMs');
      expect(caption).toHaveProperty('text');
      expect(caption).toHaveProperty('startFrame');
      expect(caption).toHaveProperty('endFrame');
    });
  });
});
