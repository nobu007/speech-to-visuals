/**
 * Single source for the shared dagre layout pipeline (round 30).
 *
 * Before this module, the ENTIRE dagre pipeline — graph construction, the
 * TC-307 dangling-edge filter, layout run, center→top-left node extraction,
 * and edge-point extraction with its straight-line fallback — was pasted
 * byte-identical (modulo the per-diagram graph config) into the three
 * dagre-based registered strategies:
 *   - flow-strategy.ts      (rankdir LR, nodesep 50, ranksep 80)
 *   - tree-strategy.ts      (rankdir TB, nodesep 60, ranksep 100)
 *   - flowchart-strategy.ts (rankdir TB, nodesep 50, ranksep 70)
 *
 * The pipeline is the SAME concept at all three sites: identical inputs must
 * reach dagre identically, and identical dagre output must be converted
 * identically. A drift at one site corrupts that diagram type only — the
 * center→corner conversion (`x: dagreNode.x - w / 2`) silently off by half a
 * node, or a missing `??` fallback emitting `points: undefined` — while the
 * other diagram types stay correct, so every per-strategy test that shares
 * fixtures keeps passing. That is the classic latent-desync shape this
 * campaign freezes (rounds 4-29).
 *
 * What is intentionally NOT here (different concepts, do not merge):
 *   - The per-strategy graph CONFIG (rankdir/nodesep/ranksep) — deliberately
 *     tuned per diagram type; each strategy passes its own values in.
 *   - The grid-snap overlap fallbacks (flow: Kahn topological grid, tree: BFS
 *     level grid) — different algorithms, stay in their strategies.
 *   - The v1 dagre paths (DagreLayoutStrategy, FlowchartLayoutStrategy, the
 *     flowchart/tree paths in enhanced-zero-overlap-layout) — they return
 *     DiagramLayout, read extents back from dagre (`dagreNode.width`), and
 *     emit the deprecated `w`/`h` fields; a separate family with a genuinely
 *     different conversion shape.
 *
 * Guarded by tests/guards/dagre-pipeline-single-source.test.ts (verbatim
 * legacy-inline oracle, delegation equality, source anchors) and the round-30
 * entry in tests/guards/frozen-literal-rules.ts (no site re-rolls the
 * extraction shapes).
 */

import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as unknown as { default?: typeof dagreLib }).default ?? dagreLib;
import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';

/** Per-diagram graph tuning; each strategy supplies its own values. */
export interface DagrePipelineConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
}

export interface DagrePipelineResult {
  /** dagre center coordinates converted to top-left; extents re-read via node-dimensions. */
  positionedNodes: PositionedNode[];
  /** Only the input edges whose endpoints exist in the node set (TC-307). */
  safeEdges: EdgeDatum[];
  /** One LayoutEdge per safeEdge, carrying dagre's points (or the straight-line fallback). */
  layoutEdges: LayoutEdge[];
}

/**
 * Build the dagre graph, filter dangling edges (TC-307), run the layout, and
 * extract positioned nodes + layout edges. Verbatim extraction of the
 * former inline pipeline — zero behavior delta by construction.
 */
export function runDagrePipeline(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  config: DagrePipelineConfig,
): DagrePipelineResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: config.rankdir,
    nodesep: config.nodesep,
    ranksep: config.ranksep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
    const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
    g.setNode(node.id, { width: w, height: h, label: node.label });
  }

  // Filter edges whose endpoints are not in the input node set BEFORE handing
  // them to dagre. dagre auto-creates phantom nodes for unknown edge
  // endpoints, corrupting the layout and emitting edges that point at
  // non-existent nodes. Mirrors the f178cbf hardening in
  // enhanced-zero-overlap-layout.ts.
  const nodeIds = new Set(nodes.map((node) => node.id));
  const safeEdges = edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  for (const edge of safeEdges) {
    g.setEdge(edge.from, edge.to, { label: edge.label ?? '' });
  }

  dagre.layout(g);

  const positionedNodes: PositionedNode[] = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
    const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
    return {
      ...node,
      x: dagreNode.x - w / 2,
      y: dagreNode.y - h / 2,
      width: w,
      height: h,
    };
  });

  const layoutEdges: LayoutEdge[] = safeEdges.map((edge) => {
    const dagreEdge = g.edge(edge.from, edge.to);
    return {
      from: edge.from,
      to: edge.to,
      points: dagreEdge.points ?? [
        { x: g.node(edge.from).x, y: g.node(edge.from).y },
        { x: g.node(edge.to).x, y: g.node(edge.to).y },
      ],
      label: edge.label,
      id: edge.id,
    };
  });

  return { positionedNodes, safeEdges, layoutEdges };
}
