import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { lookupEndpoint } from '../edge-endpoints';

/**
 * Edge-crossing pair scan for the v2 `layout/` cluster (round 43 single
 * source). Verbatim lift of the byte-identical private pair that
 * `OverlapResolver.countEdgeCrossings` and
 * `SimulatedAnnealingStrategy.calculateCrossingEnergy` each carried — a
 * strict-predicate scan edited at one site would silently disagree with the
 * other's on the SAME layout.
 *
 * Semantics pinned by tests/guards/edge-crossing-scan-single-source.test.ts:
 * endpoints are the nodes' raw `x`/`y` (the v2 CENTER convention — unlike
 * the v1 scan, no `+ width/2` centering happens
 * here — see `edge-crossing-minimizer.ts`), pairs sharing an endpoint NODE
 * OBJECT are skipped, and the
 * predicate is STRICT: only proper crossings count; touching (T-junction)
 * and collinear-overlapping segments do NOT. That strictness is a deliberate
 * policy difference from the v1 orientation+collinear predicate in
 * `edge-crossing-minimizer.ts` — two geometry policies, each written once.
 */
export interface CrossingSegment {
  source: PositionedNode;
  target: PositionedNode;
}

/**
 * Check if two line segments intersect (STRICT: excludes touching and
 * collinear overlap).
 */
export function segmentsIntersect(a: CrossingSegment, b: CrossingSegment): boolean {
  const ccw = (A: PositionedNode, B: PositionedNode, C: PositionedNode): number => {
    return (C.y - A.y) * (B.x - A.x) - (B.y - A.y) * (C.x - A.x);
  };

  const A = a.source;
  const B = a.target;
  const C = b.source;
  const D = b.target;

  return (
    (ccw(A, C, D) * ccw(B, C, D) < 0) &&
    (ccw(C, A, B) * ccw(D, A, B) < 0)
  );
}

/**
 * Count the number of edge crossings (strict predicate, endpoint-object
 * skip). Edges whose endpoints cannot be resolved in `nodes` are dropped.
 */
export function countEdgeCrossings(nodes: PositionedNode[], edges: LayoutEdge[]): number {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  let crossings = 0;

  // Convert edges to line segments
  const segments = edges
    .map(edge => {
      const source = lookupEndpoint(nodeMap, edge.source);
      const target = lookupEndpoint(nodeMap, edge.target);
      return source && target ? { source, target } : null;
    })
    .filter((segment): segment is CrossingSegment => segment !== null);

  // Check all pairs of edges for crossings
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];

      // Skip if edges share a node
      if (a.source === b.source || a.source === b.target ||
          a.target === b.source || a.target === b.target) {
        continue;
      }

      // Check for intersection
      if (segmentsIntersect(a, b)) {
        crossings++;
      }
    }
  }

  return crossings;
}
