/**
 * Single source for the strategy edge-repointing skeleton (round 34).
 *
 * The physics-first strategies (grid-snap, progressive-force,
 * simulated-annealing) all end the same way: positioning has moved the nodes,
 * so the ALREADY-BUILT LayoutEdges must be re-pointed to the new node
 * positions. Before this module that epilogue was one 25-line private method
 * (`updateEdgePoints`) pasted byte-identical into all three strategy files:
 *
 *   - GridSnapStrategy.ts          updateEdgePoints (after grid placement)
 *   - ProgressiveForceStrategy.ts  updateEdgePoints (after force settling)
 *   - SimulatedAnnealingStrategy.ts updateEdgePoints (after annealing)
 *
 * The skeleton is a DIFFERENT contract from the edge BUILDERS in
 * strategy-edges.ts (rounds 32/33), and deliberately stays separate:
 *
 *   - it consumes LayoutEdge[] (built edges with `source`/`target` refs),
 *     not EdgeDatum[] (`from`/`to`), and emits LayoutEdge[] — a re-point, not
 *     a build;
 *   - both the anchored and the dangling branch SPREAD the input edge, so
 *     every field the producer set — including optional ones the type does
 *     not enumerate exhaustively like `type` — survives verbatim. A
 *     reconstructed `{ from, to, points, label }` would silently drop them;
 *   - a dangling endpoint blanks the geometry (`points: []`) with NO warn and
 *     NO drop — the edge object is preserved for downstream consumers
 *     (unlike enhanced-zero-overlap's timeline path, which warns AND filters
 *     the blank edges out; a different site, not this family);
 *   - anchors are the RAW node x/y — these strategies position node.x/y as
 *     the edge endpoint directly, with no center-offset arithmetic (unlike
 *     centerToCenterAnchors, which adds half the extent for top-left
 *     coordinates);
 *   - endpoint lookup keeps plain-Map LAST-match-wins semantics on duplicate
 *     node ids (the round-33 v1 builder deliberately chose first-match-wins
 *     to mirror its `nodes.find` heritage — do not "unify" these; they are
 *     two frozen contracts with opposite tie-breaks).
 *
 * Still uniform at extraction time (no drift yet — three byte-identical
 * copies verified by diff); frozen before one could fork. A silent variant
 * here would corrupt only the strategy that drifted — e.g. blanking points on
 * live edges, or dropping the spread and losing `type`/`source`/`target` on
 * every edge of one diagram — while the other two strategies' tests stay
 * green: the classic single-diagram-type latent desync this campaign freezes.
 *
 * The private `updateEdgePoints` methods remain in each strategy as one-line
 * delegates (same signature, unused `config` parameter included verbatim —
 * it was already dead in the pasted original) so call sites and subclass
 * shape are unchanged.
 *
 * Guarded by tests/guards/edge-repointing-single-source.test.ts (verbatim
 * legacy-inline oracle, delegation equality for all three strategies, source
 * anchors) and the round-34 entry in tests/guards/frozen-literal-rules.ts
 * (no strategy file re-rolls the spread skeleton).
 */

import { PositionedNode, LayoutEdge } from '@/types/diagram';

/**
 * Re-point already-built LayoutEdges at positioned nodes.
 *
 * An edge whose `source`/`target` matches a positioned node gets a straight
 * two-point line between the RAW node coordinates; an edge referencing an
 * unknown node is returned verbatim with `points: []` (kept, not dropped,
 * not warned). All other edge fields survive via spread.
 */
export function repointEdgesStraightLine(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return edges.map(edge => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return { ...edge, points: [] };
    }

    // Simple straight line for now
    return {
      ...edge,
      points: [
        { x: source.x, y: source.y },
        { x: target.x, y: target.y }
      ]
    };
  });
}
