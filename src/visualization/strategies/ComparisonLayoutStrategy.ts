/**
 * Comparison Layout Strategy
 *
 * Implements side-by-side comparison layout
 * Optimized for comparing two sets of items, before/after scenarios
 *
 * Algorithm: Two-column vertical distribution
 * - Divides nodes into two groups (left and right)
 * - Vertical distribution within each column
 * - Balanced spacing
 *
 * Custom Instructions Compliance:
 * - Zero overlap through column separation
 * - <5s processing for standard comparisons
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { LayoutConfig } from '../types';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';
import { logger } from '@stv/core/utils/logger';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges, flankAnchors } from '../strategy-edges';
import { DEFAULT_EDGE_SEPARATION, DEFAULT_MARGIN } from '../layout-spacing';

export class ComparisonLayoutStrategy implements ILayoutStrategy {
  readonly name = 'comparison';

  supports(diagramType: DiagramType): boolean {
    return diagramType === 'comparison';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {

    try {
      // Split nodes into two groups (left and right)
      const midpoint = Math.ceil(nodes.length / 2);
      const leftNodes = nodes.slice(0, midpoint);
      const rightNodes = nodes.slice(midpoint);


      // Position left column nodes
      const leftPositioned = this.positionColumn(
        leftNodes,
        config.width * 0.25,  // Left column at 25% width
        config,
        'left'
      );

      // Position right column nodes
      const rightPositioned = this.positionColumn(
        rightNodes,
        config.width * 0.75,  // Right column at 75% width
        config,
        'right'
      );

      // Combine positioned nodes
      const positionedNodes = [...leftPositioned, ...rightPositioned];

      // Generate edges (typically connect left to right)
      const layoutEdges = this.generateComparisonEdges(edges, positionedNodes);


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[Comparison] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Position nodes in a vertical column
   */
  private positionColumn(
    nodes: NodeDatum[],
    centerX: number,
    config: LayoutConfig,
    side: 'left' | 'right'
  ): PositionedNode[] {
    if (nodes.length === 0) {
      return [];
    }

    const nodeHeight = config.nodeHeight || DEFAULT_NODE_HEIGHT;
    const verticalSpacing = config.nodeSeparation || 60;

    // Calculate total height needed
    const totalHeight = nodes.length * nodeHeight + (nodes.length - 1) * verticalSpacing;

    // Start position (vertically centered)
    const startY = (config.height - totalHeight) / 2;

    return nodes.map((node, index) => {
      const width = this.calculateNodeWidth(node, config);
      const height = nodeHeight;

      // Calculate Y position
      const y = startY + index * (height + verticalSpacing);

      // Calculate X position (centered on column)
      const x = centerX - width / 2;

      return {
        ...node,
        x,
        y,
        w: width,
        h: height
      };
    });
  }

  /**
   * Generate edges for comparison (typically horizontal connections)
   */
  private generateComparisonEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts.
    // Round 46 — the pair-dependent flank geometry delegates to the canonical
    // flankAnchors pair (shared with v2 comparison); only the '[Comparison] '
    // prefix is site-specific.
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      flankAnchors,
      '[Comparison] '
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
    // Round 31 single-source — log messages keep the '[Comparison]' prefix.
    return validateStrategyInputs(nodes, edges, '[Comparison]');
  }

  /**
   * Get comparison-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      nodeSeparation: 70,        // Vertical spacing between items
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      marginX: 80,               // Larger margins for columns
      marginY: DEFAULT_MARGIN
    };
  }
}
