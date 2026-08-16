/**
 * Structural guard: the 16:9 layout target aspect ratio has ONE source.
 *
 * `TARGET_ASPECT_RATIO = 16 / 9` was previously re-declared as a local const in
 * 10 layout modules (canvas-calculator, layout-engine-v2, and 8 strategies),
 * under a second name `ASPECT_RATIO` in matrix-strategy, and inlined as a bare
 * `16 / 9` literal in timeline-strategy / overlap-resolver /
 * enhanced-zero-overlap-layout — 14 sites sharing one value with no link.
 * Every copy coincided with 16:9, so a behavioral RED→GREEN was impossible
 * (the latent-coincident desync pattern, same class as REQ-293). Changing one
 * copy would silently leave the others: strategies would grid-pack for one
 * ratio while canvas-calculator pads to another, and the reported
 * `metrics.aspectRatio` would lie about the canvas actually produced.
 *
 * The canonical constant is DERIVED from the default canvas dimensions
 * (1920/1080), so the layout target can never contradict the default canvas.
 *
 * This file pins the DERIVATION/VALUE and CONSUMER IMPORTS. The "no
 * src/visualization module declares or inlines the `16 / 9` literal in any
 * spacing shape" discovery sweep lives in the shared registry since round 8 —
 * tests/guards/frozen-literal-registry.test.ts, rule 'target aspect ratio
 * (16/9) …'. Scope note: the sweep boundary is src/visualization only; the
 * CSS string `aspectRatio: '16/9'` in src/components/InteractiveResultViewer.tsx
 * is a browser style value on a different layer and intentionally out of scope.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  TARGET_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
} from '@/visualization/canvas-dimensions';

/**
 * Files that must consume the canonical constant (all 14 former dup sites).
 *
 * Round 29 split the list by consumption SHAPE: eight strategies no longer
 * name TARGET_ASPECT_RATIO directly — their only direct use was the empty
 * guard / metrics triple, which now lives in empty-layout-result (itself a
 * canvas-dimensions consumer). They consume the canonical constant
 * TRANSITIVELY, so pinning the delegation hop keeps them tied to the source.
 */
const DIRECT_CONSUMERS = [
  'src/visualization/canvas-calculator.ts',
  'src/visualization/layout-engine-v2.ts',
  'src/visualization/overlap-resolver.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/strategies/general-strategy.ts',
  'src/visualization/strategies/matrix-strategy.ts',
];

/** Former dup sites whose aspect-ratio use moved into empty-layout-result. */
const DELEGATING_CONSUMERS = [
  'src/visualization/strategies/flowchart-strategy.ts',
  'src/visualization/strategies/tree-strategy.ts',
  'src/visualization/strategies/conceptmap-strategy.ts',
  'src/visualization/strategies/flow-strategy.ts',
  'src/visualization/strategies/mindmap-strategy.ts',
  'src/visualization/strategies/network-strategy.ts',
  'src/visualization/strategies/comparison-strategy.ts',
  'src/visualization/strategies/timeline-strategy.ts',
  'src/visualization/strategies/cycle-strategy.ts',
];

describe('target-aspect-ratio single source (layout module)', () => {
  it('canonical constant is derived from the default canvas and equals 16:9', () => {
    // Derivation pin: the layout target can never contradict DEFAULT_CANVAS_*.
    expect(TARGET_ASPECT_RATIO).toBe(DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT);
    // Value pin: if this ever changes, every strategy's grid packing and the
    // reported metrics.aspectRatio change with it — one place, consciously.
    expect(TARGET_ASPECT_RATIO).toBeCloseTo(16 / 9, 12);
  });

  it('every direct consumer imports the canonical constant', () => {
    for (const rel of DIRECT_CONSUMERS) {
      const src = readSource(rel);
      expect(src).toContain('TARGET_ASPECT_RATIO');
      expect(src).toMatch(/from ['"](\.\.?\/|@\/visualization\/)canvas-dimensions['"]/);
    }
  });

  it('every delegating consumer stays tied via empty-layout-result (round 29)', () => {
    for (const rel of DELEGATING_CONSUMERS) {
      const src = readSource(rel);
      // The delegation hop: emptyLayoutResult/emptyStrategyLayoutMetrics
      // read TARGET_ASPECT_RATIO from canvas-dimensions on these files'
      // behalf — and must NOT re-freeze the ratio themselves.
      expect(src).toMatch(/from ['"](\.\.?\/|@\/visualization\/)empty-layout-result['"]/);
      expect(src).not.toContain('aspectRatio: DEFAULT_CANVAS_WIDTH');
    }
  });
});
