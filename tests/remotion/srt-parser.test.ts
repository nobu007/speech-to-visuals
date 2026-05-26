import {
  parseTimestamp,
  parseSrt,
  SrtParseError,
} from '@/remotion/srt-parser';

// ---------------------------------------------------------------------------
// parseTimestamp
// ---------------------------------------------------------------------------

describe('parseTimestamp', () => {
  it('parses zero timestamp', () => {
    expect(parseTimestamp('00:00:00,000')).toBe(0);
  });

  it('parses hours', () => {
    expect(parseTimestamp('01:00:00,000')).toBe(3600000);
  });

  it('parses minutes', () => {
    expect(parseTimestamp('00:01:00,000')).toBe(60000);
  });

  it('parses seconds', () => {
    expect(parseTimestamp('00:00:30,000')).toBe(30000);
  });

  it('parses milliseconds', () => {
    expect(parseTimestamp('00:00:00,500')).toBe(500);
  });

  it('parses combined timestamp', () => {
    // 1h 2m 3s 456ms = 3723456ms
    expect(parseTimestamp('01:02:03,456')).toBe(3723456);
  });

  it('trims whitespace before parsing', () => {
    expect(parseTimestamp('  00:00:01,000  ')).toBe(1000);
  });

  it('throws SrtParseError for invalid format', () => {
    expect(() => parseTimestamp('invalid')).toThrow(SrtParseError);
  });

  it('throws SrtParseError for missing milliseconds', () => {
    expect(() => parseTimestamp('00:00:00')).toThrow(SrtParseError);
  });

  it('throws SrtParseError for colon instead of comma', () => {
    expect(() => parseTimestamp('00:00:00.000')).toThrow(SrtParseError);
  });
});

// ---------------------------------------------------------------------------
// parseSrt
// ---------------------------------------------------------------------------

describe('parseSrt', () => {
  it('parses a single caption block', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      'Hello, world!',
    ].join('\n');

    const captions = parseSrt(srt);
    expect(captions).toHaveLength(1);
    expect(captions[0]).toEqual({
      index: 1,
      startMs: 1000,
      endMs: 4000,
      text: 'Hello, world!',
      startFrame: 30,
      endFrame: 120,
    });
  });

  it('parses multiple caption blocks', () => {
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:02,000',
      'First',
      '',
      '2',
      '00:00:02,000 --> 00:00:04,000',
      'Second',
    ].join('\n');

    const captions = parseSrt(srt);
    expect(captions).toHaveLength(2);
    expect(captions[0].text).toBe('First');
    expect(captions[1].text).toBe('Second');
  });

  it('handles multi-line caption text', () => {
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:05,000',
      'Line one',
      'Line two',
    ].join('\n');

    const captions = parseSrt(srt);
    expect(captions[0].text).toBe('Line one\nLine two');
  });

  it('uses custom fps for frame mapping', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      'Test',
    ].join('\n');

    const captions = parseSrt(srt, 60);
    expect(captions[0].startFrame).toBe(60);
    expect(captions[0].endFrame).toBe(120);
  });

  it('handles CRLF line endings', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nTest\r\n';
    const captions = parseSrt(srt);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toBe('Test');
  });

  it('returns empty array for empty content', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('   ')).toEqual([]);
  });

  it('trims whitespace around content', () => {
    const srt = '\n\n1\n00:00:01,000 --> 00:00:02,000\nText\n\n';
    const captions = parseSrt(srt);
    expect(captions).toHaveLength(1);
  });

  it('throws SrtParseError for block with too few lines', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000';
    expect(() => parseSrt(srt)).toThrow(SrtParseError);
  });

  it('throws SrtParseError for non-numeric index', () => {
    const srt = 'abc\n00:00:01,000 --> 00:00:02,000\nText';
    expect(() => parseSrt(srt)).toThrow(SrtParseError);
  });

  it('throws SrtParseError for missing arrow separator', () => {
    const srt = '1\n00:00:01,000 - 00:00:02,000\nText';
    expect(() => parseSrt(srt)).toThrow(SrtParseError);
  });

  it('throws SrtParseError when end time is before start time', () => {
    const srt = '1\n00:00:05,000 --> 00:00:01,000\nText';
    expect(() => parseSrt(srt)).toThrow(SrtParseError);
  });

  it('throws SrtParseError for empty caption text', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n   ';
    expect(() => parseSrt(srt)).toThrow(SrtParseError);
  });

  it('computes frame numbers correctly at default 30fps', () => {
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:01,000',
      'One second',
    ].join('\n');

    const captions = parseSrt(srt);
    expect(captions[0].startFrame).toBe(0);
    expect(captions[0].endFrame).toBe(30);
  });
});
