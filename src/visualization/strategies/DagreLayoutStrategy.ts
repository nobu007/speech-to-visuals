import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { getGraphConfig, calculateNodeWidth as calculateNodeWidthUtil } from '../layout-utils';
import { FallbackLayoutStrategy } from './FallbackLayoutStrategy';

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
    console.log(`[DagreLayoutStrategy] Applying basic Dagre layout...`);

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

      edges.forEach(edge => {
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

      const layoutEdges: LayoutEdge[] = edges.map(edge => {
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
      console.log(`[DagreLayoutStrategy] Dagre failed, using fallback layout...`);
      return this.fallbackLayoutStrategy.fallbackLayout(nodes, edges, diagramType);
    }
  }

  /**
   * Calculate node width based on label and config.
   * Uses the utility function from layout-utils.
   */
  private calculateNodeWidth(node: NodeDatum): number {
    // Provide default values for charWidth and padding, as they are not in LayoutConfig
    const DEFAULT_CHAR_WIDTH = 8; // px per character
    const DEFAULT_PADDING = 20; // px padding

    return calculateNodeWidthUtil(node, {
      nodeWidth: this.config.nodeWidth,
      nodeHeight: this.config.nodeHeight, // nodeHeight is also part of NodeDimensionsConfig
      charWidth: DEFAULT_CHAR_WIDTH,
      padding: DEFAULT_PADDING,
    });
  }
}
