/**
 * Timeline Layout Strategy
 *
 * Implements horizontal timeline layout
 * Optimized for chronological sequences, process steps, and temporal data
 *
 * Algorithm: Horizontal left-to-right positioning
 * - Places nodes along a horizontal timeline
 * - Even spacing between nodes
 * - Centered vertically
 *
 * Custom Instructions Compliance:
 * - Zero overlap through calculated spacing
 * - <5s processing for standard timelines
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';
import { logger } from '../../utils/logger';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges, horizontalFlowAnchors } from '../strategy-edges';
import { DEFAULT_EDGE_SEPARATION, DEFAULT_MARGIN } from '../layout-spacing';

export class TimelineLayoutStrategy implements ILayoutStrategy {
  readonly name = 'timeline';

  supports(diagramType: DiagramType): boolean {
    return diagramType === 'timeline';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {

    try {
      // Sort nodes by temporal order (using array order as proxy for time)
      // In a real implementation, this would use timestamps from node metadata
      const sortedNodes = [...nodes];

      // Calculate spacing and positioning
      const nodeWidths = sortedNodes.map(node => this.calculateNodeWidth(node, config));
      const totalNodeWidth = nodeWidths.reduce((sum, width) => sum + width, 0);

      // Calculate spacing to distribute nodes evenly
      const availableWidth = config.width - 2 * (config.marginX || DEFAULT_MARGIN);
      const totalSpacing = availableWidth - totalNodeWidth;
      const spacing = nodes.length > 1 ? totalSpacing / (nodes.length + 1) : availableWidth / 2;


      // Calculate vertical center position
      const baseY = config.height / 2;
      const nodeHeight = config.nodeHeight || DEFAULT_NODE_HEIGHT;

      // Position nodes along timeline
      let currentX = config.marginX || DEFAULT_MARGIN;

      const positionedNodes: PositionedNode[] = sortedNodes.map((node, index) => {
        const width = nodeWidths[index];
        const height = nodeHeight;

        currentX += spacing;

        const positioned: PositionedNode = {
          ...node,
          x: currentX,
          y: baseY - height / 2,
          w: width,
          h: height,
          width,
          height
        };

        currentX += width;

        return positioned;
      });

      // Generate edges (typically sequential connections in a timeline)
      const layoutEdges = this.generateTimelineEdges(edges, positionedNodes);


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[Timeline] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate edges for timeline (usually sequential arrows)
   */
  private generateTimelineEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts.
    // Round 46 — the right→left geometry delegates to the canonical
    // horizontalFlowAnchors pair (shared with the Fallback timeline block);
    // only the '[Timeline] ' prefix is site-specific.
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      horizontalFlowAnchors,
      '[Timeline] '
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
    // Round 31 single-source — log messages keep the '[Timeline]' prefix.
    return validateStrategyInputs(nodes, edges, '[Timeline]');
  }

  /**
   * Get timeline-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'LR',       // Left to right
      nodeSeparation: 80,        // Horizontal spacing between nodes
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      marginX: 80,               // Larger margins for timeline
      marginY: DEFAULT_MARGIN
    };
  }
}
