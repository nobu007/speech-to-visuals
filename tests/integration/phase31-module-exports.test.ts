/**
 * TC-086-01: Phase 31 module export verification
 *
 * Verifies that all Phase 31 quality modules are exported
 * from the @/visualization barrel (index.ts).
 */

import { describe, it, expect } from '@jest/globals';
import {
  VisualBalanceScorer,
  EdgeCrossingMinimizer,
  sizeLabel,
  sizeAllLabels,
  LayoutQualityCompositeScorer,
  LayoutAutoOptimizer,
} from '@/visualization';

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
});
