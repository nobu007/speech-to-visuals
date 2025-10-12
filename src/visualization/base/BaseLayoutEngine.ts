/**
 * Base Layout Engine - Foundation for All Layout Strategies
 *
 * Phase 0: Refactoring Foundation
 * - Extracts common calculations and utilities
 * - Provides template method pattern
 * - Single source of truth for geometric operations
 *
 * Custom Instructions Compliance:
 * - Zero tolerance for overlaps
 * - Performance target: <5s for standard layouts
 * - Iterative improvement approach
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics } from '../types';
import { calculateNodeWidth, calculateNodeHeight, calculateNodeCenter, calculateDistance, calculateNodeDistance, generateEdgePoints, nodesOverlap } from '../layout-utils';
import { logger } from '@/utils/logger';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface OverlapPair {
  node1: PositionedNode;
  node2: PositionedNode;
}

/**
 * Abstract base class for all layout engines
 * Implements Template Method pattern
 */
export abstract class BaseLayoutEngine {
  protected config: LayoutConfig;
  protected logger = logger;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = this.getDefaultConfig(config);
  }

  /**
   * Template method: Main layout generation workflow
   * Subclasses implement specific layout algorithms
   */
  abstract generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<LayoutResult>;

  /**
   * Get default configuration with overrides
   */
  protected abstract getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig;

  // ============================================================
  // SHARED GEOMETRY CALCULATIONS
  // ============================================================

  /**
   * Calculate horizontal center of canvas
   */
  protected calculateCenterX(): number {
    return this.config.width / 2;
  }

  /**
   * Calculate vertical center of canvas
   */
  protected calculateCenterY(): number {
    return this.config.height / 2;
  }

  /**
   * Calculate center point of canvas
   */
  protected calculateCenter(): Point {
    return {
      x: this.calculateCenterX(),
      y: this.calculateCenterY()
    };
  }

  /**
   * Calculate node width based on label and config
   * Single source of truth for node width calculation
   */
  protected calculateNodeHeight(node: NodeDatum): number {
    return calculateNodeHeight(node, { nodeWidth: this.config.nodeWidth, nodeHeight: this.config.nodeHeight });
  }

  /**
   * Calculate node width based on label and config
   * Single source of truth for node width calculation
   */
  protected calculateNodeWidth(node: NodeDatum): number {
    // Provide default values for charWidth and padding, as they are not in LayoutConfig
    const DEFAULT_CHAR_WIDTH = 8; // px per character
    const DEFAULT_PADDING = 20; // px padding

    return calculateNodeWidth(node, {
      nodeWidth: this.config.nodeWidth,
      nodeHeight: this.config.nodeHeight, // nodeHeight is also part of NodeDimensionsConfig
      charWidth: DEFAULT_CHAR_WIDTH,
      padding: DEFAULT_PADDING,
    });
  }

  /**
   * Calculate center point of a node
   */
  protected calculateNodeCenter(node: PositionedNode): Point {
    return calculateNodeCenter(node);
  }

  /**
   * Calculate distance between two points
   */
  protected calculateDistance(p1: Point, p2: Point): number {
    return calculateDistance(p1, p2);
  }

  /**
   * Calculate distance between two node centers
   */
  protected calculateNodeDistance(node1: PositionedNode, node2: PositionedNode): number {
    return calculateNodeDistance(node1, node2);
  }

  // ============================================================
  // BOUNDS AND LAYOUT CALCULATIONS
  // ============================================================

  /**
   * Calculate bounding box for a set of nodes
   * Single source of truth for bounds calculation
   */
  protected calculateBounds(nodes: PositionedNode[]): BoundingBox {
    if (nodes.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0
      };
    }

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.w));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.h));

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if bounds are within canvas limits
   */
  protected boundsWithinCanvas(bounds: BoundingBox): boolean {
    return (
      bounds.width <= this.config.width &&
      bounds.height <= this.config.height
    );
  }

  // ============================================================
  // OVERLAP DETECTION (ZERO TOLERANCE)
  // ============================================================

  /**
   * Detect all overlapping node pairs
   * Custom Instructions: Zero overlap tolerance
   */
  protected detectAllOverlaps(nodes: PositionedNode[], spacing?: number): OverlapPair[] {
    const overlaps: OverlapPair[] = [];
    const minSpacing = spacing ?? this.config.nodeSeparation;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodesOverlap(nodes[i], nodes[j], minSpacing)) {
          overlaps.push({ node1: nodes[i], node2: nodes[j] });
        }
      }
    }

    return overlaps;
  }



  /**
   * Count total overlaps in layout
   */
  protected countOverlaps(nodes: PositionedNode[]): number {
    return this.detectAllOverlaps(nodes).length;
  }

  // ============================================================
  // EDGE OPERATIONS
  // ============================================================

  /**
   * Generate simple straight-line edge points
   * From node center to node center
   */
  protected generateEdgePoints(
    source: PositionedNode,
    target: PositionedNode
  ): Point[] {
    return generateEdgePoints(source, target);
  }

  /**
   * Generate edge points for all edges
   */
  protected generateAllEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (!source || !target) {
        this.logger.warn(`Edge ${edge.from} -> ${edge.to} missing nodes`);
        return {
          from: edge.from,
          to: edge.to,
          points: [],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        points: this.generateEdgePoints(source, target),
        label: edge.label
      };
    });
  }

  // ============================================================
  // BOUNDS CONSTRAINTS
  // ============================================================



  /**
   * Constrain all nodes to canvas bounds
   */
  protected constrainAllNodesToBounds(nodes: PositionedNode[], margin: number = 10): void {
    nodes.forEach(node => this.constrainNodeToBounds(node, margin));
  }

  // ============================================================
  // QUALITY METRICS
  // ============================================================

  /**
   * Update configuration dynamically
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('📐 Layout configuration updated');
  }

  /**
   * Get current configuration (for debugging/inspection)
   */
  public getConfig(): LayoutConfig {
    return { ...this.config };
  }
}
