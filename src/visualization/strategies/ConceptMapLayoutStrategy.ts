/**
 * Concept Map Layout Strategy
 *
 * Implements grid-based concept map layout
 * Optimized for concept maps, mind maps, and general-purpose diagrams
 *
 * Algorithm: Simple grid distribution
 * - Arranges nodes in a grid pattern
 * - Even spacing horizontally and vertically
 * - Good for general-purpose use
 *
 * Custom Instructions Compliance:
 * - Zero overlap through grid spacing
 * - <5s processing for standard concept maps
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { squareGridColumns, squareGridRows, centerInCell } from '../layout-utils';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';
import { logger } from '../../utils/logger';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges, centerToCenterAnchors } from '../strategy-edges';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_MARGIN,
} from '../layout-spacing';

export class ConceptMapLayoutStrategy implements ILayoutStrategy {
  readonly name = 'conceptmap';

  supports(diagramType: DiagramType): boolean {
    // Support concept map and general-purpose diagrams (mindmap has its own strategy)
    return diagramType === 'conceptmap' ||
           diagramType === 'general';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {

    try {
      if (nodes.length === 0) {
        return { nodes: [], edges: [] };
      }

      // Calculate grid dimensions (square-ish grid)
      // Round 50 single source — square-grid packing derivation.
      const cols = squareGridColumns(nodes.length);
      const rows = squareGridRows(nodes.length, cols);


      // Calculate cell dimensions
      const cellWidth = config.width / cols;
      const cellHeight = config.height / rows;

      // Position nodes in grid
      const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const width = this.calculateNodeWidth(node, config);
        const height = config.nodeHeight || DEFAULT_NODE_HEIGHT;

        // Center node in cell (round 50 single source — cell-centered stamp)
        const x = centerInCell(col, cellWidth, width);
        const y = centerInCell(row, cellHeight, height);

        return {
          ...node,
          x,
          y,
          w: width,
          h: height
        };
      });

      // Generate edges (straight lines between nodes)
      const layoutEdges = this.generateConceptMapEdges(edges, positionedNodes);


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[ConceptMap] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate edges for concept map (center-to-center connections)
   */
  private generateConceptMapEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts;
    // this strategy's geometry is the shared center→center anchor pair.
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      (source, target) => [...centerToCenterAnchors(source, target)],
      '[ConceptMap] '
    );
  }

  /**
   * Calculate node width based on label
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
    // Round 31 single-source — log messages keep the '[ConceptMap]' prefix.
    return validateStrategyInputs(nodes, edges, '[ConceptMap]');
  }

  /**
   * Get concept map-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      nodeSeparation: DEFAULT_NODE_SEPARATION,  // Standard spacing
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      marginX: DEFAULT_MARGIN,
      marginY: DEFAULT_MARGIN
    };
  }
}
