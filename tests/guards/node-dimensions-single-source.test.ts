/**
 * Structural guard: default node dimensions have ONE source (round 6 sweep).
 *
 * `src/visualization/node-dimensions.ts` already exports DEFAULT_NODE_WIDTH
 * (120) and DEFAULT_NODE_HEIGHT (60) — the canonical fallback used by
 * getNodeWidth/getNodeHeight. But at the time this guard was written, the same
 * values were independently hardcoded at 22 sites under src/visualization
 * (default LayoutConfig literals, `config.nodeWidth || 120` /
 * `config.nodeHeight || 60` strategy fallbacks, and `const nodeHeight = 60`
 * locals in FallbackLayoutStrategy). Any future retune of the canonical
 * default would silently leave those 22 sites behind — the exact freeze class
 * closed for DEFAULT_FPS / TARGET_ASPECT_RATIO / scene-duration in rounds 4-5.
 *
 * This file pins VALUES and CONSUMER IMPORTS. The "no src/visualization file
 * couples nodeWidth/nodeHeight to a bare default literal" discovery sweep
 * (object literal / local const / `||` fallback sibling shapes) lives in the
 * shared registry since round 8 — tests/guards/frozen-literal-registry.test.ts,
 * rule 'node dimensions (120/60) …'. Intentionally NOT swept (different
 * semantics, left as literals): per-diagram-type tuned dimensions
 * (advanced-layouts tree/timeline 100/50, 140/70; FallbackLayoutStrategy's
 * 140 width and line-47 80 height) and `nodeSeparation: 60` / NODE_SEP.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '@/visualization/node-dimensions';

const CONSUMERS = [
  'src/visualization/layout-engine.ts',
  'src/visualization/complex-layout-engine.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/layout/strategies/LayoutStrategy.ts',
  'src/visualization/strategies/TimelineLayoutStrategy.ts',
  'src/visualization/strategies/TreeLayoutStrategy.ts',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts',
  'src/visualization/strategies/NetworkLayoutStrategy.ts',
  'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
  'src/visualization/strategies/ComparisonLayoutStrategy.ts',
  'src/visualization/strategies/FallbackLayoutStrategy.ts',
];

describe('node-dimension defaults single source (round 6)', () => {
  it('canonical module exports 120 width / 60 height', () => {
    expect(DEFAULT_NODE_WIDTH).toBe(120);
    expect(DEFAULT_NODE_HEIGHT).toBe(60);
  });

  it.each(CONSUMERS)('%s imports the canonical constants', (file) => {
    expect(readSource(file)).toMatch(/DEFAULT_NODE_(WIDTH|HEIGHT)/);
  });
});
