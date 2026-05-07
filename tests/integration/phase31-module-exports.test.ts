/**
 * TC-086-01: Phase 31 module export verification
 *
 * Verifies that all Phase 31 quality modules are exported
 * from the @/visualization barrel (index.ts).
 */

import {
  VisualBalanceScorer,
  EdgeCrossingMinimizer,
  sizeLabel,
  sizeAllLabels,
  LayoutQualityCompositeScorer,
  LayoutAutoOptimizer,
} from '@/visualization';
import type { LabelSizingConfig, LabelSizingResult } from '@/visualization';

describe('TC-086-01: Phase 31 module exports', () => {
  it('exports VisualBalanceScorer class', () => {
    expect(VisualBalanceScorer).toBeDefined();
    expect(typeof VisualBalanceScorer).toBe('function');
    const instance = new VisualBalanceScorer();
    expect(instance).toBeInstanceOf(VisualBalanceScorer);
  });

  it('exports EdgeCrossingMinimizer class', () => {
    expect(EdgeCrossingMinimizer).toBeDefined();
    expect(typeof EdgeCrossingMinimizer).toBe('function');
    const instance = new EdgeCrossingMinimizer();
    expect(instance).toBeInstanceOf(EdgeCrossingMinimizer);
  });

  it('exports sizeLabel and sizeAllLabels functions', () => {
    expect(sizeLabel).toBeDefined();
    expect(typeof sizeLabel).toBe('function');
    expect(sizeAllLabels).toBeDefined();
    expect(typeof sizeAllLabels).toBe('function');
  });

  it('exports LayoutQualityCompositeScorer class', () => {
    expect(LayoutQualityCompositeScorer).toBeDefined();
    expect(typeof LayoutQualityCompositeScorer).toBe('function');
    const instance = new LayoutQualityCompositeScorer();
    expect(instance).toBeInstanceOf(LayoutQualityCompositeScorer);
  });

  it('exports LayoutAutoOptimizer class', () => {
    expect(LayoutAutoOptimizer).toBeDefined();
    expect(typeof LayoutAutoOptimizer).toBe('function');
    const instance = new LayoutAutoOptimizer();
    expect(instance).toBeInstanceOf(LayoutAutoOptimizer);
  });

  it('all 5 modules are importable from @/visualization', () => {
    // Summary assertion: all exports are present
    const exports = [
      VisualBalanceScorer,
      EdgeCrossingMinimizer,
      sizeLabel,
      sizeAllLabels,
      LayoutQualityCompositeScorer,
      LayoutAutoOptimizer,
    ];
    expect(exports.every(e => e !== undefined)).toBe(true);
  });

  it('exports LabelSizingConfig type and it works with sizeLabel', () => {
    // Verify LabelSizingConfig is importable and exercises sizeLabel
    const config: LabelSizingConfig = {
      defaultFontSize: 12,
      minFontSize: 6,
      maxLines: 2,
      ellipsis: '...',
    };
    const result: LabelSizingResult = sizeLabel('Hello World Test Label', 80, 30, config);
    expect(result.fontSize).toBeGreaterThanOrEqual(config.minFontSize!);
    expect(result.fontSize).toBeLessThanOrEqual(config.defaultFontSize!);
    expect(result.lines.length).toBeLessThanOrEqual(config.maxLines!);
    expect(result.truncated).toBe(true); // text is too long for 80px at 12px font
  });

  it('exports LabelSizingResult type and reflects sizing outcome', () => {
    const result: LabelSizingResult = sizeLabel('Short', 200, 60);
    expect(result.fontSize).toBe(14); // default font size
    expect(result.lines).toEqual(['Short']);
    expect(result.truncated).toBe(false);
  });
});
