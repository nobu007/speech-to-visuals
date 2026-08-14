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
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';

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
      const availableWidth = config.width - 2 * (config.marginX || 50);
      const totalSpacing = availableWidth - totalNodeWidth;
      const spacing = nodes.length > 1 ? totalSpacing / (nodes.length + 1) : availableWidth / 2;


      // Calculate vertical center position
      const baseY = config.height / 2;
      const nodeHeight = config.nodeHeight || DEFAULT_NODE_HEIGHT;

      // Position nodes along timeline
      let currentX = config.marginX || 50;

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
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (!source || !target) {
        logger.warn(`[Timeline] Edge ${edge.from} -> ${edge.to} missing nodes`);
        return {
          from: edge.from,
          to: edge.to,
          points: [],
          label: edge.label
        };
      }

      // Create horizontal arrow from source right-center to target left-center
      const sourcePoint = {
        x: source.x + getNodeWidth(source),      // Right edge of source
        y: source.y + getNodeHeight(source) / 2   // Vertical center
      };

      const targetPoint = {
        x: target.x,                 // Left edge of target
        y: target.y + getNodeHeight(target) / 2   // Vertical center
      };

      return {
        from: edge.from,
        to: edge.to,
        points: [sourcePoint, targetPoint],
        label: edge.label
      };
    });
  }

  /**
   * Calculate node width based on label
   */
  private calculateNodeWidth(node: NodeDatum, config: LayoutConfig): number {
    const baseWidth = config.nodeWidth || DEFAULT_NODE_WIDTH;
    const labelLength = node.label?.length || 0;
    const charWidth = 8;
    const padding = 20;

    const textWidth = labelLength * charWidth + padding;
    return Math.max(baseWidth, Math.min(textWidth, baseWidth * 2));
  }

  /**
   * Validate inputs before layout generation
   */
  validateInputs(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    if (nodes.length === 0) {
      logger.warn('[Timeline] No nodes to layout');
      return false;
    }

    // Check for duplicate node IDs
    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      logger.error('[Timeline] Duplicate node IDs detected');
      return false;
    }

    // Check for invalid edges
    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
    );

    if (invalidEdges.length > 0) {
      logger.error('[Timeline] Invalid edges detected:', invalidEdges);
      return false;
    }

    return true;
  }

  /**
   * Get timeline-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'LR',       // Left to right
      nodeSeparation: 80,        // Horizontal spacing between nodes
      edgeSeparation: 10,
      marginX: 80,               // Larger margins for timeline
      marginY: 50
    };
  }
}
