/**
 * Structural guard: default layout spacing has ONE source.
 *
 * Before this guard, the default spacing values were frozen independently at
 * 20+ sites across two engines, seven strategies, and the layout worker:
 *
 *   - src/visualization/layout-engine.ts        (getDefaultConfig block)
 *   - src/visualization/complex-layout-engine.ts (default config block)
 *   - FlowchartLayoutStrategy.ts (dagre `|| 50/10` fallbacks + defaults)
 *   - NetworkLayoutStrategy.ts (`|| 50` base spacing)
 *   - TimelineLayoutStrategy.ts (`marginX || 50` ×2 + defaults)
 *   - ComparisonLayoutStrategy.ts / TreeLayoutStrategy.ts /
 *     ConceptMapLayoutStrategy.ts (getStrategyDefaults blocks)
 *   - src/workers/layout-worker.ts (`|| 50` nodeSep/rankSep)
 *
 * The "no src/visualization|src/workers site re-freezes 50/10/50/50"
 * discovery sweep lives in the shared registry (tests/guards/
 * frozen-literal-registry.test.ts, rule 'layout spacing defaults (50/10/50/50)
 * single-sourced in layout-spacing'). This file pins VALUES and CONSUMER
 * WIRING.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
  DEFAULT_MARGIN,
} from '@/visualization/layout-spacing';

const CONSUMERS = [
  'src/visualization/layout-engine.ts',
  'src/visualization/complex-layout-engine.ts',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts',
  'src/visualization/strategies/NetworkLayoutStrategy.ts',
  'src/visualization/strategies/TimelineLayoutStrategy.ts',
  'src/visualization/strategies/ComparisonLayoutStrategy.ts',
  'src/visualization/strategies/TreeLayoutStrategy.ts',
  'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
  'src/workers/layout-worker.ts',
];

describe('layout spacing default single source (guard)', () => {
  it('canonical module exports the agreed default values', () => {
    expect({
      DEFAULT_NODE_SEPARATION,
      DEFAULT_EDGE_SEPARATION,
      DEFAULT_RANK_SEPARATION,
      DEFAULT_MARGIN,
    }).toEqual({ DEFAULT_NODE_SEPARATION: 50, DEFAULT_EDGE_SEPARATION: 10, DEFAULT_RANK_SEPARATION: 50, DEFAULT_MARGIN: 50 });
  });

  it('every known default site imports the canonical module', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        importsCanonical:
          src.includes("layout-spacing'") || src.includes('layout-spacing"'),
      }).toEqual({ file: rel, importsCanonical: true });
    }
  });

  it('consumer default sites are built from the canonical constants', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        wired: /DEFAULT_(NODE|EDGE|RANK)_SEPARATION|DEFAULT_MARGIN/.test(src),
      }).toEqual({ file: rel, wired: true });
    }
  });
});
