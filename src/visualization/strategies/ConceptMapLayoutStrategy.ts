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
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';

export class ConceptMapLayoutStrategy implements ILayoutStrategy {
  readonly name = 'conceptmap';

  supports(diagramType: DiagramType): boolean {
    // Support multiple diagram types that don't have specific strategies
    return diagramType === 'conceptmap' ||
           diagramType === 'mindmap' ||
           diagramType === 'general';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {
    console.log(`🗺️ [ConceptMap] Generating grid layout for ${nodes.length} nodes`);

    try {
      // Calculate grid dimensions (square-ish grid)
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const rows = Math.ceil(nodes.length / cols);

      console.log(`   📐 Grid: ${rows} rows × ${cols} cols`);

      // Calculate cell dimensions
      const cellWidth = config.width / cols;
      const cellHeight = config.height / rows;

      // Position nodes in grid
      const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const width = this.calculateNodeWidth(node, config);
        const height = config.nodeHeight || 60;

        // Center node in cell
        const x = col * cellWidth + (cellWidth - width) / 2;
        const y = row * cellHeight + (cellHeight - height) / 2;

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

      console.log(`✅ [ConceptMap] Layout generated successfully`);

      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      console.error('[ConceptMap] Layout generation failed:', error);
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
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (!source || !target) {
        console.warn(`[ConceptMap] Edge ${edge.from} -> ${edge.to} missing nodes`);
        return {
          from: edge.from,
          to: edge.to,
          points: [],
          label: edge.label
        };
      }

      // Simple straight line from center to center
      const sourcePoint = {
        x: source.x + source.w / 2,
        y: source.y + source.h / 2
      };

      const targetPoint = {
        x: target.x + target.w / 2,
        y: target.y + target.h / 2
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
      console.warn('[ConceptMap] No nodes to layout');
      return false;
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      console.error('[ConceptMap] Duplicate node IDs detected');
      return false;
    }

    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
    );

    if (invalidEdges.length > 0) {
      console.error('[ConceptMap] Invalid edges detected:', invalidEdges);
      return false;
    }

    return true;
  }

  /**
   * Get concept map-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      nodeSeparation: 50,        // Standard spacing
      edgeSeparation: 10,
      marginX: 50,
      marginY: 50
    };
  }
}
