/**
 * DagreLayoutStrategy: dangling-edge hardening.
 *
 * Recurring bug class (see commit f178cbf for the enhanced-zero-overlap path):
 * feeding edges whose endpoints are not in the input node set to dagre makes
 * dagre AUTO-CREATE phantom nodes for those endpoints. That corrupts the layout
 * (real nodes get pulled toward phantom positions) and emits edges pointing at
 * non-existent nodes. f178cbf hardened generateFlowchartLayout/generateTreeLayout
 * in enhanced-zero-overlap-layout.ts, but the PRIMARY LayoutEngine path
 * (LayoutEngine._applyInitialLayoutAndOverlapResolution → DagreLayoutStrategy.
 * applyLayout) still handed every edge to dagre unfiltered. This test pins that
 * the same hardening is applied here.
 */

import { describe, it, expect } from '@jest/globals';

describe('DagreLayoutStrategy dangling-edge hardening', () => {
  it('drops edges whose endpoints are not in the node set (no phantom dagre nodes)', async () => {
    const { DagreLayoutStrategy } = await import(
      '@/visualization/strategies/DagreLayoutStrategy'
    );
    const { FallbackLayoutStrategy } = await import(
      '@/visualization/strategies/FallbackLayoutStrategy'
    );

    const config = {
      nodeWidth: 120,
      nodeHeight: 60,
      canvasWidth: 800,
      canvasHeight: 600,
    } as never;
    const fallback = new FallbackLayoutStrategy(config);
    const strategy = new DagreLayoutStrategy(config, fallback);

    const nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ] as never;

    const edges = [
      { from: 'a', to: 'b', label: 'valid' },
      // Both endpoints below reference ids that are NOT in `nodes`. Without
      // filtering, dagre silently creates phantom nodes for 'ghost'/'ghost2'.
      { from: 'b', to: 'ghost', label: 'dangling-target' },
      { from: 'ghost2', to: 'c', label: 'dangling-source' },
    ] as never;

    const result = await strategy.applyLayout(nodes, edges, 'flowchart');

    // All real nodes are laid out with finite coordinates — phantom nodes must
    // not corrupt the positions of the real ones.
    expect(result.nodes.map((n: { id: string }) => n.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
    for (const n of result.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(Number.isFinite(n.w)).toBe(true);
      expect(Number.isFinite(n.h)).toBe(true);
    }

    // Only the valid edge survives; dangling edges are dropped before dagre,
    // so no output edge references a phantom node.
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('a');
    expect(result.edges[0].to).toBe('b');
    for (const e of result.edges) {
      expect(e.from).not.toBe('ghost');
      expect(e.from).not.toBe('ghost2');
      expect(e.to).not.toBe('ghost');
      expect(e.to).not.toBe('ghost2');
    }
  });
});
