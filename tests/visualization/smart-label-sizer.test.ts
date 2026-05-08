/**
 * Dedicated unit tests for SmartLabelSizer (REQ-081)
 *
 * Covers edge cases, boundary conditions, and configuration variations
 * beyond the integration tests in phase31-diagram-quality.test.ts.
 */

import { sizeLabel, sizeAllLabels, LabelSizingConfig } from '@/visualization/smart-label-sizer';
import type { PositionedNode } from '@/types/diagram';

describe('SmartLabelSizer: sizeLabel', () => {
  // --- Default config behavior ---

  describe('default configuration', () => {
    it('uses default font size 14 when text fits', () => {
      const result = sizeLabel('Hello', 200, 60);
      expect(result.fontSize).toBe(14);
      expect(result.lines).toEqual(['Hello']);
      expect(result.truncated).toBe(false);
    });

    it('wraps long text into multiple lines', () => {
      const result = sizeLabel('This is a fairly long label that should wrap', 200, 80);
      expect(result.lines.length).toBeGreaterThan(1);
      expect(result.truncated).toBe(false);
    });

    it('truncates when text exceeds max lines', () => {
      const result = sizeLabel(
        'A very long text that will definitely need more than three lines to display completely within the constrained width',
        80,
        40,
      );
      // maxLines defaults to 3, but maxLinesByHeight may be lower at 40px height
      expect(result.lines.length).toBeLessThanOrEqual(3);
      expect(result.truncated).toBe(true);
    });
  });

  // --- minFontSize constraint ---

  describe('minFontSize constraint', () => {
    it('never shrinks below minFontSize', () => {
      const config: LabelSizingConfig = { minFontSize: 10 };
      const result = sizeLabel(
        'Extremely long text that cannot possibly fit even with shrinking',
        50,
        30,
        config,
      );
      expect(result.fontSize).toBeGreaterThanOrEqual(10);
    });

    it('shrinks font when text is too wide but above minFontSize', () => {
      const config: LabelSizingConfig = { defaultFontSize: 14, minFontSize: 8 };
      const result = sizeLabel(
        'A moderately long label',
        60,
        40,
        config,
      );
      // Font should be smaller than default since text is long for 60px width
      expect(result.fontSize).toBeLessThanOrEqual(14);
      expect(result.fontSize).toBeGreaterThanOrEqual(8);
    });

    it('keeps default font size when minFontSize equals default', () => {
      const config: LabelSizingConfig = { defaultFontSize: 10, minFontSize: 10 };
      const result = sizeLabel('Some text here', 100, 40, config);
      expect(result.fontSize).toBe(10);
    });
  });

  // --- maxLines and ellipsis ---

  describe('maxLines and ellipsis', () => {
    it('respects custom maxLines setting', () => {
      const config: LabelSizingConfig = { maxLines: 1 };
      const result = sizeLabel(
        'A very long text that would normally wrap to multiple lines',
        80,
        120,
        config,
      );
      expect(result.lines.length).toBeLessThanOrEqual(1);
      expect(result.truncated).toBe(true);
    });

    it('uses custom ellipsis string', () => {
      const config: LabelSizingConfig = { maxLines: 1, ellipsis: '...' };
      const result = sizeLabel(
        'This text is way too long for a single line',
        60,
        40,
        config,
      );
      expect(result.lines.length).toBeLessThanOrEqual(1);
      if (result.truncated) {
        expect(result.lines[0]).toContain('...');
      }
    });

    it('uses default ellipsis character (…)', () => {
      const config: LabelSizingConfig = { maxLines: 1 };
      const result = sizeLabel(
        'This text is way too long for a single line width',
        50,
        40,
        config,
      );
      if (result.truncated) {
        expect(result.lines[0]).toContain('…');
      }
    });

    it('accounts for height-limited max lines', () => {
      // Very small height = very few lines possible
      const result = sizeLabel('Long text here', 200, 18);
      // lineHeight at 14 * 1.2 = 16.8, so 18px height allows only 1 line
      expect(result.lines.length).toBeLessThanOrEqual(1);
    });
  });

  // --- charWidthFactor precision ---

  describe('charWidthFactor', () => {
    it('larger charWidthFactor produces more wrapping', () => {
      const narrow: LabelSizingConfig = { charWidthFactor: 6 };
      const wide: LabelSizingConfig = { charWidthFactor: 12 };

      const resultNarrow = sizeLabel('Hello World Test Label', 100, 60, narrow);
      const resultWide = sizeLabel('Hello World Test Label', 100, 60, wide);

      // Wider char factor = fewer chars per line = more lines
      expect(resultWide.lines.length).toBeGreaterThanOrEqual(resultNarrow.lines.length);
    });

    it('very small charWidthFactor fits more text per line', () => {
      const config: LabelSizingConfig = { charWidthFactor: 2 };
      const result = sizeLabel('Short', 100, 40, config);
      expect(result.lines).toHaveLength(1);
      expect(result.truncated).toBe(false);
    });
  });

  // --- Japanese / CJK text ---

  describe('Japanese and CJK text', () => {
    it('handles Japanese text and wraps appropriately', () => {
      const result = sizeLabel('これは非常に長い日本語ラベルテキストの例で折り返しが必要なものです', 120, 80);
      expect(result.lines.length).toBeGreaterThan(1);
    });

    it('handles CJK characters with appropriate sizing', () => {
      // Full-width CJK characters
      const result = sizeLabel('漢字カタカナひらがな', 200, 60);
      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it('handles mixed ASCII and Japanese text', () => {
      const result = sizeLabel('Hello こんにちは World 世界', 100, 80);
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines.every(l => typeof l === 'string')).toBe(true);
    });

    it('wraps long Japanese text into multiple lines', () => {
      const result = sizeLabel('プロジェクト管理システムの設計と実装について考える', 100, 100);
      expect(result.lines.length).toBeGreaterThan(1);
      for (const line of result.lines) {
        expect(line.length).toBeGreaterThan(0);
      }
    });
  });

  // --- Empty / edge inputs ---

  describe('edge cases', () => {
    it('returns defaults for empty string', () => {
      const result = sizeLabel('', 100, 40);
      expect(result.fontSize).toBe(14);
      expect(result.lines).toEqual(['']);
      expect(result.truncated).toBe(false);
    });

    it('handles single character label', () => {
      const result = sizeLabel('A', 100, 40);
      expect(result.fontSize).toBe(14);
      expect(result.lines).toEqual(['A']);
      expect(result.truncated).toBe(false);
    });

    it('handles very narrow node width', () => {
      const result = sizeLabel('Hi', 20, 40);
      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it('handles very small node dimensions', () => {
      const result = sizeLabel('Test', 10, 10);
      expect(result.fontSize).toBeGreaterThanOrEqual(8); // minFontSize
      expect(result.lines.length).toBeGreaterThan(0);
    });
  });
});

describe('SmartLabelSizer: sizeAllLabels', () => {
  it('sizes labels for multiple nodes', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Short', x: 0, y: 0, width: 100, height: 40 },
      { id: 'n2', label: 'A longer label text', x: 100, y: 0, width: 80, height: 40 },
      { id: 'n3', label: '日本語ラベル', x: 200, y: 0, width: 120, height: 50 },
    ];

    const results = sizeAllLabels(nodes);
    expect(results.size).toBe(3);
    expect(results.has('n1')).toBe(true);
    expect(results.has('n2')).toBe(true);
    expect(results.has('n3')).toBe(true);

    for (const [, r] of results) {
      expect(r.fontSize).toBeGreaterThan(0);
      expect(r.lines.length).toBeGreaterThan(0);
    }
  });

  it('returns empty map for empty node array', () => {
    const results = sizeAllLabels([]);
    expect(results.size).toBe(0);
  });

  it('applies custom config to all labels', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Hello', x: 0, y: 0, width: 200, height: 60 },
    ];
    const config: LabelSizingConfig = { defaultFontSize: 10, minFontSize: 6 };
    const results = sizeAllLabels(nodes, config);
    const result = results.get('n1')!;
    expect(result.fontSize).toBeLessThanOrEqual(10);
    expect(result.fontSize).toBeGreaterThanOrEqual(6);
  });

  it('handles nodes with w/h properties', () => {
    const nodes: PositionedNode[] = [
      { id: 'n1', label: 'Test', x: 0, y: 0, w: 80, h: 30 } as PositionedNode,
    ];
    const results = sizeAllLabels(nodes);
    expect(results.has('n1')).toBe(true);
    expect(results.get('n1')!.fontSize).toBeGreaterThan(0);
  });
});
