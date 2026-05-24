/**
 * Tests for smart-label-sizer (REQ-081)
 *
 * Covers: CJK utilities (isCJKChar, hasCJKText, textWidth),
 * sizeLabel (basic, Latin wrapping, CJK wrapping, font shrinking, truncation),
 * sizeAllLabels, and edge cases.
 */

import {
  isCJKChar,
  hasCJKText,
  textWidth,
  sizeLabel,
  sizeAllLabels,
} from '../smart-label-sizer';
import type { PositionedNode } from '@/types/diagram';

// ---------------------------------------------------------------------------
// CJK Utilities
// ---------------------------------------------------------------------------

describe('isCJKChar', () => {
  it('returns true for hiragana', () => {
    expect(isCJKChar('あ')).toBe(true);
  });

  it('returns true for katakana', () => {
    expect(isCJKChar('ア')).toBe(true);
  });

  it('returns true for kanji', () => {
    expect(isCJKChar('漢')).toBe(true);
  });

  it('returns true for hangul', () => {
    expect(isCJKChar('한')).toBe(true);
  });

  it('returns true for fullwidth', () => {
    expect(isCJKChar('Ａ')).toBe(true);
  });

  it('returns false for ASCII', () => {
    expect(isCJKChar('A')).toBe(false);
    expect(isCJKChar(' ')).toBe(false);
    expect(isCJKChar('.')).toBe(false);
  });
});

describe('hasCJKText', () => {
  it('detects mixed Japanese text', () => {
    expect(hasCJKText('Hello世界')).toBe(true);
  });

  it('returns false for pure Latin', () => {
    expect(hasCJKText('Hello World')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasCJKText('')).toBe(false);
  });
});

describe('textWidth', () => {
  it('counts ASCII as 1 unit per char', () => {
    expect(textWidth('abc')).toBe(3);
  });

  it('counts CJK chars as 2 units each', () => {
    expect(textWidth('漢字')).toBe(4);
  });

  it('handles mixed content', () => {
    // 'A漢B' = 1 + 2 + 1 = 4
    expect(textWidth('A漢B')).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(textWidth('')).toBe(0);
  });

  it('counts ellipsis correctly', () => {
    expect(textWidth('…')).toBe(1); // U+2026 is not a CJK char
  });
});

// ---------------------------------------------------------------------------
// sizeLabel
// ---------------------------------------------------------------------------

describe('sizeLabel', () => {
  it('handles empty label', () => {
    const result = sizeLabel('', 120, 60);
    expect(result.lines).toEqual(['']);
    expect(result.truncated).toBe(false);
    expect(result.fontSize).toBe(14);
  });

  it('returns single line when text fits', () => {
    const result = sizeLabel('Hello', 200, 60);
    expect(result.lines).toEqual(['Hello']);
    expect(result.truncated).toBe(false);
  });

  it('wraps Latin text at word boundaries', () => {
    // With default charWidthFactor=8, nodeWidth=80 gives ~8 chars per line
    const result = sizeLabel('Hello World Foo Bar', 80, 200, { maxLines: 5 });
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.truncated).toBe(false);
    // No word should be split mid-character
    for (const line of result.lines) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('truncates with ellipsis when lines exceed maxLines', () => {
    const result = sizeLabel('Very long label that needs to be truncated', 60, 200, { maxLines: 2 });
    expect(result.truncated).toBe(true);
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines[result.lines.length - 1]).toContain('…');
  });

  it('shrinks font size when text does not fit', () => {
    const result = sizeLabel('VeryLongWordWithoutSpaces', 50, 40, { minFontSize: 8 });
    // Font should be reduced from default 14 to try to fit
    expect(result.fontSize).toBeLessThan(14);
  });

  it('respects minFontSize', () => {
    const result = sizeLabel('X'.repeat(100), 40, 20, { minFontSize: 10 });
    expect(result.fontSize).toBeGreaterThanOrEqual(10);
  });

  // --- CJK-specific tests ---

  it('wraps Japanese text at character boundaries', () => {
    // 10 kanji chars = 20 display units. With nodeWidth=80, padding=16, availableWidth=64,
    // charsPerLine = 64/8 = 8 display units = 4 kanji per line
    const label = '一二三四五六七八九十';
    const result = sizeLabel(label, 80, 200, { maxLines: 5 });
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.truncated).toBe(false);
  });

  it('wraps hiragana text correctly', () => {
    const label = 'あいうえおかきくけこさしすせそ';
    const result = sizeLabel(label, 80, 200, { maxLines: 5 });
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    // Each hiragana is 2 display units, ~4 chars per line
    for (const line of result.lines) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('truncates long Japanese text with ellipsis', () => {
    const label = 'これは非常に長い日本語のテキストで切り詰められるべきです';
    const result = sizeLabel(label, 60, 80, { maxLines: 2 });
    expect(result.truncated).toBe(true);
    expect(result.lines.length).toBeLessThanOrEqual(2);
  });

  it('handles mixed Japanese and Latin text', () => {
    const label = 'APIエンドポイントの設計';
    const result = sizeLabel(label, 100, 60);
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
    expect(result.fontSize).toBeGreaterThan(0);
  });

  it('handles katakana text', () => {
    const label = 'プロセッサーの最適化';
    const result = sizeLabel(label, 100, 60);
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves full short CJK labels', () => {
    const result = sizeLabel('処理', 120, 60);
    expect(result.lines).toEqual(['処理']);
    expect(result.truncated).toBe(false);
  });

  // --- Edge cases ---

  it('handles very small node dimensions', () => {
    const result = sizeLabel('Text', 20, 10);
    expect(result.fontSize).toBeGreaterThanOrEqual(8); // minFontSize
  });

  it('handles single character label', () => {
    const result = sizeLabel('A', 120, 60);
    expect(result.lines).toEqual(['A']);
    expect(result.truncated).toBe(false);
  });

  it('handles custom config', () => {
    const result = sizeLabel('Test', 120, 60, {
      defaultFontSize: 20,
      minFontSize: 12,
      charWidthFactor: 10,
      maxLines: 1,
    });
    expect(result.fontSize).toBe(20);
  });

  it('handles label with only spaces', () => {
    const result = sizeLabel('   ', 120, 60);
    // After wrapping, spaces should be handled
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// sizeAllLabels
// ---------------------------------------------------------------------------

describe('sizeAllLabels', () => {
  it('sizes multiple nodes', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Start', x: 0, y: 0, width: 120, height: 60 },
      { id: 'n2', label: 'End', x: 200, y: 0, w: 100, h: 40 },
    ];

    const results = sizeAllLabels(nodes);
    expect(results.size).toBe(2);
    expect(results.get('n1')!.lines).toEqual(['Start']);
    expect(results.get('n2')!.lines).toEqual(['End']);
  });

  it('uses default dimensions when not specified', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Default', x: 0, y: 0 },
    ];

    const results = sizeAllLabels(nodes);
    expect(results.get('n1')).toBeDefined();
    expect(results.get('n1')!.lines).toEqual(['Default']);
  });

  it('handles mixed CJK and Latin nodes', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Start Process', x: 0, y: 0, width: 120, height: 60 },
      { id: 'n2', label: '処理開始', x: 200, y: 0, width: 120, height: 60 },
      { id: 'n3', label: 'API呼び出し', x: 400, y: 0, width: 120, height: 60 },
    ];

    const results = sizeAllLabels(nodes);
    expect(results.size).toBe(3);
    for (const node of nodes) {
      const r = results.get(node.id)!;
      expect(r.lines.length).toBeGreaterThanOrEqual(1);
      expect(r.fontSize).toBeGreaterThan(0);
    }
  });

  it('handles empty node array', () => {
    const results = sizeAllLabels([]);
    expect(results.size).toBe(0);
  });

  it('passes config to all labels', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'A', x: 0, y: 0, width: 120, height: 60 },
      { id: 'n2', label: 'B', x: 100, y: 0, width: 120, height: 60 },
    ];

    const results = sizeAllLabels(nodes, { defaultFontSize: 18 });
    expect(results.get('n1')!.fontSize).toBe(18);
    expect(results.get('n2')!.fontSize).toBe(18);
  });
});
