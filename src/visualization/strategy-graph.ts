/**
 * Single source for the importance-tree strategy preamble (round 42).
 *
 * The mindmap (radial) and conceptmap (hierarchical) strategies are a
 * copy-paste pair — their `apply` prologue and epilogue were pasted
 * wholesale, and the network strategy pasted the sizing idiom. Before this
 * module, four shapes lived as private/inline duplicates:
 *
 *   - `buildUndirectedAdjacency` — adjacency seeded from the node ids, each
 *     edge appended BOTH ways (`adj.get(edge.from)?.push(edge.to)` +
 *     `adj.get(edge.to)?.push(edge.from)`), dangling edge endpoints dropped
 *     silently — mindmap-strategy.ts + conceptmap-strategy.ts, byte-identical.
 *   - `findImportanceRoot` — undirected degree map (`degree.set(edge.from/to,
 *     (degree.get(...) ?? 0) + 1)`, which MATERIALIZES entries for dangling
 *     edge endpoints), then the combined score scan `d * (0.5 + imp)` with
 *     strict `>` (first-max-wins) and the 0.5 importance fallback for ids the
 *     node map does not know — mindmap + conceptmap, byte-identical except a
 *     dead `nodes.length === 0` guard on the conceptmap side (unreachable:
 *     every `apply` returns `emptyLayoutResult()` before reaching it).
 *   - `scaledNodeExtent` — `Math.round(getNodeWidth(node,
 *     DEFAULT_NODE_WIDTH) * scale)` + height twin, where `scale =
 *     importanceSizeScale(node)`. FIVE sites: mindmap single-node epilogue +
 *     positionRadially tail, conceptmap single-node epilogue +
 *     positionHierarchical tail, network initializeCircle. The composition
 *     already existed as `scaledDimensions` in importance-scaler.ts — written
 *     as the canonical helper and then never wired: zero production callers
 *     while five sites hand-rolled the same three lines around it (the
 *     incomplete-factor-wiring shape; this round wires it).
 *   - `singleNodeCenteredLayout` — the `nodes.length === 1` epilogue:
 *     importance-scaled extents, node centered on the default canvas
 *     (`(DEFAULT_CANVAS_WIDTH - w) / 2`), `edges: []`, empty metrics —
 *     mindmap + conceptmap, byte-identical.
 *
 * DRIFT SCENARIO this module closes: the two strategies pick different roots
 * (one drops the importance boost, the other flips the tie-break), build
 * adjacency that disagrees about reciprocity, or size the same node
 * differently on the same diagram (one site's scale formula silently
 * detaches from importance-scaler). Because each copy serves a different
 * diagram type, their divergence is invisible to every per-strategy test —
 * the single-diagram-type latent desync this campaign freezes.
 *
 * What is intentionally NOT here (near misses, different concepts):
 *   - conceptmap's level-width packing `widths` (width-only, `node ??
 *     { width: 0, w: 0 }` half-variant) — packing math, not node extent.
 *   - mindmap's `branchWeights` (`n ? importanceSizeScale(n) : 1`) — a
 *     weight, not a dimension; no round, no extent read.
 *   - mindmap's `positionFallback` extents (`getNodeWidth(node,
 *     DEFAULT_NODE_WIDTH)` with NO importance scale) — the fallback ring
 *     path sizes unscaled by original design; reachable (root without
 *     children), so scaling it is a behavior change no round has licensed.
 *   - the DIRECTED adjacency/degree folds (flow-strategy Kahn in-degree,
 *     tree-strategy `hasIncoming`) — direction is the contract there.
 *   - LayoutOptimizer's `spacingMultiplier` — spacing, not sizing.
 *   - `emptyStrategyLayoutMetrics`/`emptyLayoutResult` — already single
 *     (round 29); the epilogue composes them.
 *
 * Behavior change (unreachable inputs only): the canonical
 * `findImportanceRoot` follows the mindmap flavor — NO empty-list guard — so
 * the conceptmap copy's dead `return ''` branch is retired. Every caller
 * guards `nodes.length === 0` first; an unguarded call now fails loud
 * (`nodes[0]` of `[]`) instead of returning a phantom root id.
 *
 * Guarded by tests/guards/strategy-graph-preamble-single-source.test.ts
 * (verbatim legacy oracles over a seeded fuzz corpus, semantic pins, source
 * anchors) and the round-42 entry in tests/guards/frozen-literal-rules.ts
 * (no site re-rolls the four retired inline shapes).
 */

import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { StrategyLayoutResult } from './types';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import { getImportance, scaledDimensions } from './importance-scaler';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './canvas-dimensions';
import { emptyStrategyLayoutMetrics } from './empty-layout-result';
import { calculateCanvasSize } from './layout-engine-v2';

/**
 * Undirected adjacency over the node set: every node id seeds an empty list
 * (so isolated nodes are present), each edge appends both directions in edge
 * order, and an edge whose endpoint is not a node id is dropped silently
 * (`?.push`). Order inside each list is edge-iteration order — BFS consumers
 * rely on it for deterministic child order.
 */
export function buildUndirectedAdjacency(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
    adj.get(edge.to)?.push(edge.from);
  }
  return adj;
}

/**
 * Root selection for tree-like strategies: highest combined score of
 * undirected degree × (0.5 + importance). Strict `>` keeps FIRST-max-wins —
 * a tie resolves to whichever id the degree map inserted first (node order,
 * then first edge to materialize an unknown endpoint).
 *
 * The degree map materializes entries for dangling edge endpoints, and those
 * ids score with the 0.5 default importance (`nodeMap.get(id)` miss) —
 * verbatim semantics of both legacy copies; a dangling hub id can therefore
 * win over real nodes, which callers accept (the strategies' edge inputs are
 * dagre-filtered in practice).
 *
 * No empty-list guard: `nodes` must be non-empty (callers guard). Reading
 * `nodes[0].id` on `[]` throws — fail-loud by design (see module header).
 */
export function findImportanceRoot(nodes: NodeDatum[], edges: EdgeDatum[]): string {
  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node.id, 0);
  }
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  let best = nodes[0].id;
  let bestScore = -1;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const [id, d] of degree) {
    const node = nodeMap.get(id);
    const imp = node ? getImportance(node) : 0.5;
    const score = d * (0.5 + imp); // importance boosts degree
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/**
 * Importance-scaled node extent: `Math.round(extent * importanceSizeScale(
 * node))` for width and height, extents read through node-dimensions
 * (NaN-safe, `width`→`w` alias) with the DEFAULT fallbacks. Composes the
 * previously-unwired canonical `scaledDimensions` (importance-scaler.ts) —
 * identical operations in identical order, so bitwise-equal to the five
 * retired inline sites.
 */
export function scaledNodeExtent(node: NodeDatum): { width: number; height: number } {
  return scaledDimensions(
    node,
    getNodeWidth(node, DEFAULT_NODE_WIDTH),
    getNodeHeight(node, DEFAULT_NODE_HEIGHT),
  );
}

/**
 * The single-node epilogue of the tree-like strategies: the lone node gets
 * its importance-scaled extent and is centered on the default canvas, with
 * no edges and empty metrics. Canvas size comes from the shared
 * `calculateCanvasSize` (round 41 extent scan underneath).
 */
export function singleNodeCenteredLayout(nodes: NodeDatum[]): StrategyLayoutResult {
  // Same Math.round(extent × scale) the five positioning sites delegate to —
  // composed, not re-inlined, so the epilogue cannot detach from the sizing
  // canonical (bitwise-identical: same ops, same order).
  const { width: w, height: h } = scaledNodeExtent(nodes[0]);
  const positioned = [{
    ...nodes[0],
    x: (DEFAULT_CANVAS_WIDTH - w) / 2,
    y: (DEFAULT_CANVAS_HEIGHT - h) / 2,
    width: w,
    height: h,
  }];
  const canvas = calculateCanvasSize(positioned);
  return {
    nodes: positioned,
    edges: [],
    canvas,
    metrics: emptyStrategyLayoutMetrics(),
  };
}
