/**
 * Flowchart Layout Strategy
 *
 * Top-to-bottom hierarchical layout using Dagre.
 * Distinct from FlowStrategy (left-to-right) — optimized for process flows,
 * decision trees, and sequential diagrams with vertical flow.
 */

import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as unknown as { default?: typeof dagreLib }).default ?? dagreLib;
import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyLayoutMetrics } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';

const NODE_SEP = 50;
const RANK_SEP = 70;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const TARGET_ASPECT_RATIO = 16 / 9;

export class FlowchartStrategy implements LayoutStrategy {
  readonly name = 'flowchart';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
        metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO },
      };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
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

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * nodes.length;
  }
}

export const flowchartStrategy = new FlowchartStrategy();
