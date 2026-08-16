import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { getGraphConfig } from '../layout-utils';
import { strategyNodeWidth } from '../strategy-common';
import { FallbackLayoutStrategy } from './FallbackLayoutStrategy';
import { logger } from '@/utils/logger';

export class DagreLayoutStrategy {
  private config: LayoutConfig;
  private fallbackLayoutStrategy: FallbackLayoutStrategy;

  constructor(config: LayoutConfig, fallbackLayoutStrategy: FallbackLayoutStrategy) {
    this.config = config;
    this.fallbackLayoutStrategy = fallbackLayoutStrategy;
  }

  /**
   * Applies basic Dagre layout to the given nodes and edges.
   */
  public async applyLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {

    try {
      const g = new dagre.graphlib.Graph();
      const graphConfig = getGraphConfig(diagramType, this.config);
      g.setGraph(graphConfig);
      g.setDefaultEdgeLabel(() => ({}));

      nodes.forEach(node => {
        g.setNode(node.id, {
          label: node.label,
          width: this.calculateNodeWidth(node),
          height: this.config.nodeHeight
        });
      });

      // Filter edges whose endpoints are not in the input node set BEFORE
      // handing them to dagre. dagre auto-creates phantom nodes for unknown
      // edge endpoints, which corrupts the layout (real nodes get pulled
      // toward phantom positions and propagate NaN) and emits edges pointing
      // at non-existent nodes. Mirrors the concept-map / flowchart / tree
      // paths in enhanced-zero-overlap-layout.ts (commit f178cbf).
      const nodeIds = new Set(nodes.map(node => node.id));
      const safeEdges = edges.filter(
        edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)
      );

      safeEdges.forEach(edge => {
        g.setEdge(edge.from, edge.to, {
          label: edge.label || ''
        });
      });

      dagre.layout(g);

      const positionedNodes: PositionedNode[] = nodes.map(node => {
        const dagreNode = g.node(node.id);
        return {
          ...node,
          x: dagreNode.x - dagreNode.width / 2,
          y: dagreNode.y - dagreNode.height / 2,
          w: dagreNode.width,
          h: dagreNode.height
        };
      });

      const layoutEdges: LayoutEdge[] = safeEdges.map(edge => {
        const dagreEdge = g.edge(edge.from, edge.to);
        return {
          from: edge.from,
          to: edge.to,
          points: dagreEdge.points || [
            { x: g.node(edge.from).x, y: g.node(edge.from).y },
            { x: g.node(edge.to).x, y: g.node(edge.to).y }
          ],
          label: edge.label
        };
      });

      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.warn('[DagreLayoutStrategy] Layout failed, falling back to fallback layout:', error);
      return this.fallbackLayoutStrategy.fallbackLayout(nodes, edges, diagramType);
    }
  }

  /**
   * Calculate node width based on label and config.
   * Uses the utility function from layout-utils.
   */
  private calculateNodeWidth(node: NodeDatum): number {
    // Round 31 single-source — delegates to strategy-common.ts, gaining the
    // explicit-dimension-first branch and the `|| DEFAULT_NODE_WIDTH`
    // fallback the raw `this.config.nodeWidth` pass lacked (NaN-producing
    // only under a `{}` config cast; LayoutConfig.nodeWidth is typed required
    // and engine constructors default it).
    return strategyNodeWidth(node, this.config);
  }
}
