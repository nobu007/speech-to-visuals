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

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';

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
    console.log(`⚖️ [Comparison] Generating side-by-side layout for ${nodes.length} nodes`);

    try {
      // Split nodes into two groups (left and right)
      const midpoint = Math.ceil(nodes.length / 2);
      const leftNodes = nodes.slice(0, midpoint);
      const rightNodes = nodes.slice(midpoint);

      console.log(`   📊 Split: ${leftNodes.length} left, ${rightNodes.length} right`);

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

      console.log(`✅ [Comparison] Layout generated successfully`);

      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      console.error('[Comparison] Layout generation failed:', error);
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

    const nodeHeight = config.nodeHeight || 60;
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
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (!source || !target) {
        console.warn(`[Comparison] Edge ${edge.from} -> ${edge.to} missing nodes`);
        return {
          from: edge.from,
          to: edge.to,
          points: [],
          label: edge.label
        };
      }

      // Determine edge direction
      const sourceIsLeft = source.x < target.x;

      const sourcePoint = {
        x: sourceIsLeft ? source.x + source.w : source.x,  // Right or left edge
        y: source.y + source.h / 2                          // Vertical center
      };

      const targetPoint = {
        x: sourceIsLeft ? target.x : target.x + target.w,   // Left or right edge
        y: target.y + target.h / 2                           // Vertical center
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
    const baseWidth = config.nodeWidth || 120;
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
      console.warn('[Comparison] No nodes to layout');
      return false;
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      console.error('[Comparison] Duplicate node IDs detected');
      return false;
    }

    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
    );

    if (invalidEdges.length > 0) {
      console.error('[Comparison] Invalid edges detected:', invalidEdges);
      return false;
    }

    return true;
  }

  /**
   * Get comparison-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      nodeSeparation: 70,        // Vertical spacing between items
      edgeSeparation: 10,
      marginX: 80,               // Larger margins for columns
      marginY: 50
    };
  }
}
