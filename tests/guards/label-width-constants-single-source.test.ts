/**
 * Structural guard: label-width constants have ONE source (round 10 sweep).
 *
 * `src/visualization/layout-utils.ts` exports DEFAULT_CHAR_WIDTH (8) and
 * DEFAULT_LABEL_PADDING (20) — the label-driven node-width estimate
 * `label.length * 8 + 20` clamped to [baseWidth, baseWidth * 2]. Before this
 * round, the identical formula+constants were hand-rolled in six strategies
 * (Tree/Flowchart/Network/Timeline/ConceptMap/Comparison) beside the shared
 * `calculateNodeWidth` util, and BaseLayoutEngine + DagreLayoutStrategy froze
 * their own DEFAULT_CHAR_WIDTH/DEFAULT_PADDING locals. A retune of the px
 * estimate would have silently left 8 sites behind.
 *
 * This file pins VALUES, CONSUMER WIRING, and BEHAVIOR. The "no src/
 * visualization file freezes charWidth 8 / padding 20" discovery sweep (const
 * local / DEFAULT_* alias / `?? 8` sibling shapes) lives in the shared
 * registry — tests/guards/frozen-literal-registry.test.ts, rule 'label-width
 * constants …'. Intentionally NOT swept (different concepts): the util's
 * omitted-field padding default `?? 16` (pinned by layout-bug-fixes.test.ts —
 * callers that omit padding get tighter packing by design), smart-label-sizer
 * `charWidthFactor: 8` (font-scaled sizer), advanced-layouts
 * `text.length * 8 + 40` (different formula/padding).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  calculateNodeWidth,
  DEFAULT_CHAR_WIDTH,
  DEFAULT_LABEL_PADDING,
} from '@/visualization/layout-utils';

/** Every consumer that sizes nodes from the label must wire the constants. */
const DELEGATING_CONSUMERS = [
  'src/visualization/base/BaseLayoutEngine.ts',
  'src/visualization/strategies/DagreLayoutStrategy.ts',
  'src/visualization/strategies/TreeLayoutStrategy.ts',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts',
  'src/visualization/strategies/NetworkLayoutStrategy.ts',
  'src/visualization/strategies/TimelineLayoutStrategy.ts',
  'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
  'src/visualization/strategies/ComparisonLayoutStrategy.ts',
];

describe('label-width constants single source (round 10)', () => {
  it('canonical module exports 8 charWidth / 20 padding', () => {
    expect(DEFAULT_CHAR_WIDTH).toBe(8);
    expect(DEFAULT_LABEL_PADDING).toBe(20);
  });

  it.each(DELEGATING_CONSUMERS)('%s wires the canonical constants', (file) => {
    expect(readSource(file)).toMatch(/DEFAULT_CHAR_WIDTH/);
    expect(readSource(file)).toMatch(/DEFAULT_LABEL_PADDING/);
  });

  it('widen/cap behavior is unchanged by the delegation (8px/char, +20, clamp [base, 2*base])', () => {
    const cfg = { nodeWidth: 120, nodeHeight: 60, charWidth: DEFAULT_CHAR_WIDTH, padding: DEFAULT_LABEL_PADDING };
    // short label: 1*8+20 = 28 → floor at base
    expect(calculateNodeWidth({ id: 'a', label: 'x' } as never, cfg)).toBe(120);
    // 10 chars: 10*8+20 = 100 → still floor at base
    expect(calculateNodeWidth({ id: 'a', label: '0123456789' } as never, cfg)).toBe(120);
    // 20 chars: 20*8+20 = 180 → widened (between base and 2*base)
    expect(calculateNodeWidth({ id: 'a', label: '01234567890123456789' } as never, cfg)).toBe(180);
    // 40 chars: 40*8+20 = 340 → capped at 2*base
    expect(calculateNodeWidth({ id: 'a', label: '0'.repeat(40) } as never, cfg)).toBe(240);
  });
});
