/**
 * Bug being prevented: `EdgeCrossingMinimizer.applySpringEmbedding` gave
 * "Stronger repulsion for crossing nodes" (weight 2) by building a set from
 * `CrossingPair.edge1`/`edge2` and testing it with `PositionedNode.id`.
 *
 * But `edge1`/`edge2` are EDGE segment ids (`e.id ?? `${fromId}-${toId}``),
 * while the lookup uses NODE ids. A node id never equals an edge id, so both
 * `.has(...)` checks were always false and the weight-2 branch was dead —
 * crossing-involved nodes never got the extra repulsion. Extracted into the
 * pure `collectCrossingNodeIds` helper so the namespace resolution is testable.
 */
import { describe, it, expect } from '@jest/globals';
import { collectCrossingNodeIds } from '../edge-crossing-minimizer';
import type { LayoutEdge, CrossingPair } from '../edge-crossing-minimizer';

function pair(edge1: string, edge2: string): CrossingPair {
  return { edge1, edge2, point: { x: 0, y: 0 } };
}

describe('collectCrossingNodeIds — resolves edge ids to NODE ids', () => {
  it('returns the endpoint node ids of crossing edges (not the edge ids)', () => {
    // Two crossing edges A->B and C->D. Segment ids are the `from-to` form.
    const edges: LayoutEdge[] = [
      { from: 'A', to: 'B' },
      { from: 'C', to: 'D' },
    ];
    const crossingPairs = [pair('A-B', 'C-D')];

    const result = collectCrossingNodeIds(crossingPairs, edges);

    expect(result.has('A')).toBe(true);
    expect(result.has('B')).toBe(true);
    expect(result.has('C')).toBe(true);
    expect(result.has('D')).toBe(true);
    // The edge ids must NOT leak through as if they were node ids.
    expect(result.has('A-B')).toBe(false);
    expect(result.has('C-D')).toBe(false);
  });

  it('respects explicit edge.id when present', () => {
    const edges: LayoutEdge[] = [
      { id: 'edge-one', from: 'A', to: 'B' },
      { id: 'edge-two', from: 'C', to: 'D' },
    ];
    const crossingPairs = [pair('edge-one', 'edge-two')];

    const result = collectCrossingNodeIds(crossingPairs, edges);

    expect([...result].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('is empty when no edges cross', () => {
    const edges: LayoutEdge[] = [{ from: 'A', to: 'B' }];
    expect(collectCrossingNodeIds([], edges).size).toBe(0);
  });
});
