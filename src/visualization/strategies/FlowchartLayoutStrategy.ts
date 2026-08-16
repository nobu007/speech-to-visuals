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
import { DiagramType, NodeDatum, EdgeDatum, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { positionedFromDagre } from '../dagre-node-extraction';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
  DEFAULT_MARGIN,
} from '../layout-spacing';
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
        ranksep: config.rankSeparation || DEFAULT_RANK_SEPARATION,  // Vertical spacing between ranks
        nodesep: config.nodeSeparation || DEFAULT_NODE_SEPARATION,  // Horizontal spacing between nodes
        edgesep: config.edgeSeparation || DEFAULT_EDGE_SEPARATION,  // Spacing between edges
        marginx: config.marginX || DEFAULT_MARGIN,
        marginy: config.marginY || DEFAULT_MARGIN,
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

      // Extract positioned nodes from Dagre.
      // Round 36 single-source — the v1 center→top-left extraction
      // (extents echoed from dagre, deprecated w/h) lives in
      // dagre-node-extraction.ts; verbatim move, zero delta.
      const positionedNodes = positionedFromDagre(g, nodes);

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
    // Round 31 single-source — explicit-dimension-first + label-driven width
    // live in strategy-common.ts.
    return strategyNodeWidth(node, config);
  }

  /**
   * Validate inputs before layout generation
   */
  validateInputs(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    // Round 31 single-source — log messages keep the '[Flowchart]' prefix.
    return validateStrategyInputs(nodes, edges, '[Flowchart]');
  }

  /**
   * Get flowchart-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'TB',       // Top to bottom
      rankSeparation: 70,        // More vertical space for flow readability
      nodeSeparation: DEFAULT_NODE_SEPARATION,  // Standard horizontal spacing
      edgeSeparation: DEFAULT_EDGE_SEPARATION,  // Minimal edge spacing
      marginX: DEFAULT_MARGIN,
      marginY: DEFAULT_MARGIN
    };
  }
}
