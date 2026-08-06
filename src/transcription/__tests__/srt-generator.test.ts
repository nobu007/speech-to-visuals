import { generateSrt, formatTimestamp } from '../srt-generator';
import type { TranscriptionSegment } from '../types';

describe('srt-generator', () => {
  // ---------------------------------------------------------------------------
  // テストケース1: SRT形式の正確性テスト
  // 3つのタイムスタンプ付きセグメントからSRT文字列が正しく生成されること
  // ---------------------------------------------------------------------------
  describe('SRT format correctness', () => {
    it('should generate correct SRT string from 3 segments', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 2000, text: 'Hello, world!' },
        { start: 2500, end: 5000, text: 'This is a test.' },
        { start: 5500, end: 8000, text: 'Goodbye.' },
      ];

      const result = generateSrt(segments);

      // Expected SRT output
      const expected = [
        '1',
        '00:00:00,000 --> 00:00:02,000',
        'Hello, world!',
        '',
        '2',
        '00:00:02,500 --> 00:00:05,000',
        'This is a test.',
        '',
        '3',
        '00:00:05,500 --> 00:00:08,000',
        'Goodbye.',
        '',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should include correct block structure (number, timestamp, text, blank line)', () => {
      const segments: TranscriptionSegment[] = [
        { start: 1000, end: 3000, text: 'Test segment' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      // Line 0: segment number
      expect(lines[0]).toBe('1');
      // Line 1: timestamp line with --> separator
      expect(lines[1]).toBe('00:00:01,000 --> 00:00:03,000');
      // Line 2: text
      expect(lines[2]).toBe('Test segment');
      // Line 3: empty line (separator)
      expect(lines[3]).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // テストケース2: タイムスタンプ精度テスト
  // 各種ミリ秒値で正確な HH:MM:SS,mmm 形式
  // ---------------------------------------------------------------------------
  describe('formatTimestamp precision', () => {
    it('should format 0ms correctly', () => {
      expect(formatTimestamp(0)).toBe('00:00:00,000');
    });

    it('should format 500ms correctly', () => {
      expect(formatTimestamp(500)).toBe('00:00:00,500');
    });

    it('should format 1500ms (1.5 seconds) correctly', () => {
      expect(formatTimestamp(1500)).toBe('00:00:01,500');
    });

    it('should format 3600000ms (1 hour) correctly', () => {
      expect(formatTimestamp(3600000)).toBe('01:00:00,000');
    });

    it('should format 86400000ms (24 hours) correctly', () => {
      expect(formatTimestamp(86400000)).toBe('24:00:00,000');
    });

    it('should clamp negative values to 0', () => {
      expect(formatTimestamp(-100)).toBe('00:00:00,000');
    });

    it('should handle values exceeding 24 hours', () => {
      // 25 hours = 90000000ms
      expect(formatTimestamp(90000000)).toBe('25:00:00,000');
    });

    it('should format complex timestamp correctly', () => {
      // 1h 23m 45s 678ms = 3600000 + 23*60000 + 45*1000 + 678
      expect(formatTimestamp(5025678)).toBe('01:23:45,678');
    });

    // --- Floating-point input edge cases (Math.floor on milliseconds) ---
    it('should floor fractional milliseconds (1234.5 → 01:23:45,234 not ,234.5)', () => {
      expect(formatTimestamp(1234.5)).toBe('00:00:01,234');
    });

    it('should floor milliseconds when fractional part is near 1.0 (1999.999)', () => {
      expect(formatTimestamp(1999.999)).toBe('00:00:01,999');
    });

    it('should handle fractional input that crosses the second boundary', () => {
      // 1000.9999 → floor(1000.9999/1000)=1, floor(1000.9999%1000)=0 → 00:00:01,000
      expect(formatTimestamp(1000.9999)).toBe('00:00:01,000');
    });

    // --- Non-finite value handling ---
    it('should return default for NaN', () => {
      expect(formatTimestamp(NaN)).toBe('00:00:00,000');
    });

    it('should return default for Infinity', () => {
      expect(formatTimestamp(Infinity)).toBe('00:00:00,000');
    });

    it('should return default for -Infinity', () => {
      expect(formatTimestamp(-Infinity)).toBe('00:00:00,000');
    });
  });

  // ---------------------------------------------------------------------------
  // テストケース3: エッジケース（0秒開始）
  // ---------------------------------------------------------------------------
  describe('edge case: zero start time', () => {
    it('should handle segments starting at 0ms', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 1500, text: 'Start from zero' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      expect(lines[1]).toBe('00:00:00,000 --> 00:00:01,500');
    });
  });

  // ---------------------------------------------------------------------------
  // テストケース4: エッジケース（極短セグメント）
  // 100msセグメントで正確なタイムスタンプ差
  // ---------------------------------------------------------------------------
  describe('edge case: extremely short segment', () => {
    it('should handle 100ms segment with exact timestamp difference', () => {
      const segments: TranscriptionSegment[] = [
        { start: 5000, end: 5100, text: 'Quick' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      expect(lines[1]).toBe('00:00:05,000 --> 00:00:05,100');
    });

    it('should handle multiple short segments', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 100, text: 'A' },
        { start: 100, end: 200, text: 'B' },
        { start: 200, end: 300, text: 'C' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      expect(lines[1]).toBe('00:00:00,000 --> 00:00:00,100');
      expect(lines[5]).toBe('00:00:00,100 --> 00:00:00,200');
      expect(lines[9]).toBe('00:00:00,200 --> 00:00:00,300');
    });
  });

  // ---------------------------------------------------------------------------
  // テストケース5: エッジケース（極長セグメント）
  // 60秒超セグメントで正しいフォーマット
  // ---------------------------------------------------------------------------
  describe('edge case: extremely long segment', () => {
    it('should handle segment longer than 60 seconds', () => {
      // 120 seconds = 120000ms
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 120000, text: 'Very long segment' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      expect(lines[1]).toBe('00:00:00,000 --> 00:02:00,000');
    });

    it('should handle segment spanning over an hour', () => {
      // Start at 3599000ms (59m 59s), end at 3605000ms (1h 0m 5s)
      const segments: TranscriptionSegment[] = [
        { start: 3599000, end: 3605000, text: 'Crossing the hour boundary' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      expect(lines[1]).toBe('00:59:59,000 --> 01:00:05,000');
    });
  });

  // ---------------------------------------------------------------------------
  // テストケース6: セグメント番号付けテスト
  // 5セグメントで1-5の連番が付与されること
  // ---------------------------------------------------------------------------
  describe('segment numbering', () => {
    it('should number 5 segments with sequential numbers 1-5', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 1000, text: 'First' },
        { start: 1000, end: 2000, text: 'Second' },
        { start: 2000, end: 3000, text: 'Third' },
        { start: 3000, end: 4000, text: 'Fourth' },
        { start: 4000, end: 5000, text: 'Fifth' },
      ];

      const result = generateSrt(segments);
      const lines = result.split('\n');

      // Each block is 4 lines (number, timestamp, text, empty)
      // Extract segment numbers
      expect(lines[0]).toBe('1');  // First block
      expect(lines[4]).toBe('2');  // Second block
      expect(lines[8]).toBe('3');  // Third block
      expect(lines[12]).toBe('4'); // Fourth block
      expect(lines[16]).toBe('5'); // Fifth block
    });
  });

  // ---------------------------------------------------------------------------
  // 追加テスト: 空配列入力
  // ---------------------------------------------------------------------------
  describe('empty input', () => {
    it('should return empty string for empty array', () => {
      expect(generateSrt([])).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // 追加テスト: バリデーション
  // ---------------------------------------------------------------------------
  describe('validation', () => {
    it('should throw for segment where start > end', () => {
      const segments: TranscriptionSegment[] = [
        { start: 5000, end: 1000, text: 'Invalid' },
      ];

      expect(() => generateSrt(segments)).toThrow();
    });

    it('should throw for segment with empty text', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 1000, text: '' },
      ];

      expect(() => generateSrt(segments)).toThrow();
    });

    it('should throw for segment with whitespace-only text', () => {
      const segments: TranscriptionSegment[] = [
        { start: 0, end: 1000, text: '   ' },
      ];

      expect(() => generateSrt(segments)).toThrow();
    });
  });
});
