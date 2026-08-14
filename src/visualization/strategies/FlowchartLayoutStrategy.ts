/**
 * Flowchart Layout Strategy
 *
 * Implements top-to-bottom flowchart layout using Dagre
 * Optimized for process flows, decision trees, and sequential diagrams
 *
 * Algorithm: Dagre (DAG + Rank-based layout)
 * - Assigns nodes to ranks (levels)
 * - Minimizes edge crossings
 * - Creates hierarchical top-to-bottom flow
 *
 * Custom Instructions Compliance:
 * - Zero overlap guarantee through node separation
 * - <5s processing for standard diagrams
 */

import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { calculateNodeWidth as calculateNodeWidthUtil, DEFAULT_CHAR_WIDTH, DEFAULT_LABEL_PADDING } from '../layout-utils';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';
import { logger } from '../../utils/logger';

export class FlowchartLayoutStrategy implements ILayoutStrategy {
  readonly name = 'flowchart';

  supports(diagramType: DiagramType): boolean {
    // Support both 'flow' and 'flowchart' diagram types
    return diagramType === 'flow' || diagramType === 'flowchart';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {

    try {
      // Initialize Dagre graph
      const g = new dagre.graphlib.Graph();

      // Configure graph for flowchart (top-to-bottom)
      g.setGraph({
        rankdir: 'TB',  // Top to Bottom
        ranksep: config.rankSeparation || 50,  // Vertical spacing between ranks
        nodesep: config.nodeSeparation || 50,  // Horizontal spacing between nodes
        edgesep: config.edgeSeparation || 10,  // Spacing between edges
        marginx: config.marginX || 50,
        marginy: config.marginY || 50,
        align: 'UL'  // Align to upper-left
      });

      g.setDefaultEdgeLabel(() => ({}));

      // Add nodes to graph with calculated dimensions
      nodes.forEach(node => {
        const width = this.calculateNodeWidth(node, config);
        const height = config.nodeHeight || DEFAULT_NODE_HEIGHT;

        g.setNode(node.id, {
          label: node.label,
          width,
          height
        });
      });

      // Filter dangling edges BEFORE dagre. dagre silently auto-creates phantom
      // nodes for any edge endpoint not in the input node set, which corrupts
      // the layout (real nodes pulled toward phantom positions, NaN propagation)
      // and emits edges pointing at non-existent nodes. Mirrors the hardening in
      // flowchart-strategy.ts / enhanced-zero-overlap-layout.ts (commit f178cbf).
      const nodeIds = new Set(nodes.map(node => node.id));
      const safeEdges = edges.filter(
        edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)
      );

      // Add (filtered) edges to graph
      safeEdges.forEach(edge => {
        g.setEdge(edge.from, edge.to, {
          label: edge.label || ''
        });
      });

      // Run Dagre layout algorithm
      dagre.layout(g);

      // Extract positioned nodes from Dagre
      const positionedNodes: PositionedNode[] = nodes.map(node => {
        const dagreNode = g.node(node.id);

        // Dagre returns center coordinates, convert to top-left
        return {
          ...node,
          x: dagreNode.x - dagreNode.width / 2,
          y: dagreNode.y - dagreNode.height / 2,
          w: dagreNode.width,
          h: dagreNode.height
        };
      });

      // Extract layout edges with points from Dagre (only the filtered edges
      // were added to the graph; `g.edge`/`g.node` would be undefined for a
      // dangling endpoint and crash on `.x` below).
      const layoutEdges: LayoutEdge[] = safeEdges.map(edge => {
        const dagreEdge = g.edge(edge.from, edge.to);
        const sourceNode = g.node(edge.from);
        const targetNode = g.node(edge.to);

        // Use Dagre's calculated points if available, otherwise straight line
        const points = dagreEdge?.points || [
          { x: sourceNode.x, y: sourceNode.y },
          { x: targetNode.x, y: targetNode.y }
        ];

        return {
          from: edge.from,
          to: edge.to,
          points,
          label: edge.label
        };
      });


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[Flowchart] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate node width based on label length
   * Ensures text fits within node
   */
  private calculateNodeWidth(node: NodeDatum, config: LayoutConfig): number {
    // Label-driven width delegates to the shared util (round 10 single-source
    // of charWidth 8 / padding 20 — see layout-utils.ts).
    const baseWidth = config.nodeWidth || DEFAULT_NODE_WIDTH;
    return calculateNodeWidthUtil(node, {
      nodeWidth: baseWidth,
      nodeHeight: config.nodeHeight,
      charWidth: DEFAULT_CHAR_WIDTH,
      padding: DEFAULT_LABEL_PADDING,
    });
  }

  /**
   * Validate inputs before layout generation
   */
  validateInputs(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    // Check for empty nodes
    if (nodes.length === 0) {
      logger.warn('[Flowchart] No nodes to layout');
      return false;
    }

    // Check for duplicate node IDs
    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      logger.error('[Flowchart] Duplicate node IDs detected');
      return false;
    }

    // Check for invalid edges (referencing non-existent nodes)
    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
    );

    if (invalidEdges.length > 0) {
      logger.error('[Flowchart] Invalid edges detected:', invalidEdges);
      return false;
    }

    return true;
  }

  /**
   * Get flowchart-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'TB',       // Top to bottom
      rankSeparation: 70,        // More vertical space for flow readability
      nodeSeparation: 50,        // Standard horizontal spacing
      edgeSeparation: 10,        // Minimal edge spacing
      marginX: 50,
      marginY: 50
    };
  }
}
