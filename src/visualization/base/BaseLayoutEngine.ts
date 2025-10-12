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
  protected calculateNodeWidth(node: NodeDatum): number {
    const baseWidth = this.config.nodeWidth;
    const labelLength = node.label?.length || 0;
    const charWidth = 8; // Approximate character width in pixels
    const padding = 20; // Total padding

    const textWidth = labelLength * charWidth + padding;
    return Math.max(baseWidth, Math.min(textWidth, baseWidth * 2));
  }

  /**
   * Calculate node height (currently fixed, but extensible)
   */
  protected calculateNodeHeight(node: NodeDatum): number {
    return this.config.nodeHeight;
  }

  /**
   * Calculate center point of a node
   */
  protected calculateNodeCenter(node: PositionedNode): Point {
    return {
      x: node.x + node.w / 2,
      y: node.y + node.h / 2
    };
  }

  /**
   * Calculate distance between two points
   */
  protected calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate distance between two node centers
   */
  protected calculateNodeDistance(node1: PositionedNode, node2: PositionedNode): number {
    const center1 = this.calculateNodeCenter(node1);
    const center2 = this.calculateNodeCenter(node2);
    return this.calculateDistance(center1, center2);
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
        if (this.nodesOverlap(nodes[i], nodes[j], minSpacing)) {
          overlaps.push({ node1: nodes[i], node2: nodes[j] });
        }
      }
    }

    return overlaps;
  }

  /**
   * Check if two nodes overlap
   * Includes minimum spacing requirement
   */
  protected nodesOverlap(
    node1: PositionedNode,
    node2: PositionedNode,
    spacing: number = 0
  ): boolean {
    const left1 = node1.x - spacing / 2;
    const right1 = node1.x + node1.w + spacing / 2;
    const top1 = node1.y - spacing / 2;
    const bottom1 = node1.y + node1.h + spacing / 2;

    const left2 = node2.x - spacing / 2;
    const right2 = node2.x + node2.w + spacing / 2;
    const top2 = node2.y - spacing / 2;
    const bottom2 = node2.y + node2.h + spacing / 2;

    return !(
      right1 <= left2 ||
      left1 >= right2 ||
      bottom1 <= top2 ||
      top1 >= bottom2
    );
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
    const sourceCenter = this.calculateNodeCenter(source);
    const targetCenter = this.calculateNodeCenter(target);

    return [sourceCenter, targetCenter];
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
        console.warn(`Edge ${edge.from} -> ${edge.to} missing nodes`);
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
   * Constrain node position to canvas bounds
   * Ensures nodes don't go off-canvas
   */
  protected constrainNodeToBounds(node: PositionedNode, margin: number = 10): void {
    node.x = Math.max(margin, Math.min(node.x, this.config.width - node.w - margin));
    node.y = Math.max(margin, Math.min(node.y, this.config.height - node.h - margin));
  }

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
   * Calculate layout quality metrics
   */
  protected calculateLayoutMetrics(
    nodes: PositionedNode[],
    edges: LayoutEdge[]
  ): LayoutMetrics {
    const overlapCount = this.countOverlaps(nodes);
    const totalArea = nodes.reduce((sum, node) => sum + node.w * node.h, 0);
    const nodeSpacing = this.calculateAverageNodeSpacing(nodes);
    const layoutBalance = this.calculateLayoutBalance(nodes);

    return {
      overlapCount,
      edgeCrossings: 0, // TODO: Implement edge crossing detection
      totalArea,
      nodeSpacing,
      layoutBalance
    };
  }

  /**
   * Calculate average spacing between all node pairs
   */
  protected calculateAverageNodeSpacing(nodes: PositionedNode[]): number {
    if (nodes.length < 2) return 0;

    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        totalDistance += this.calculateNodeDistance(nodes[i], nodes[j]);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDistance / pairCount : 0;
  }

  /**
   * Calculate layout balance (how evenly distributed nodes are)
   * Returns 0-1, higher = more balanced
   */
  protected calculateLayoutBalance(nodes: PositionedNode[]): number {
    if (nodes.length === 0) return 1;

    const centers = nodes.map(node => this.calculateNodeCenter(node));
    const centerX = centers.reduce((sum, c) => sum + c.x, 0) / nodes.length;
    const centerY = centers.reduce((sum, c) => sum + c.y, 0) / nodes.length;

    const variance = centers.reduce((sum, center) => {
      const dx = center.x - centerX;
      const dy = center.y - centerY;
      return sum + dx * dx + dy * dy;
    }, 0) / nodes.length;

    // Normalize variance to 0-1 scale (higher = more balanced)
    return Math.max(0, 1 - variance / 100000);
  }

  /**
   * Calculate layout confidence score (0-1)
   * Custom Instructions: Zero overlaps is mandatory for high confidence
   */
  protected calculateConfidence(
    metrics: LayoutMetrics,
    processingTime: number
  ): number {
    let confidence = 0.8; // Base confidence

    // Zero overlaps is mandatory
    if (metrics.overlapCount === 0) {
      confidence += 0.15;
    } else {
      confidence -= metrics.overlapCount * 0.1; // Heavy penalty
    }

    // Performance bonus/penalty
    if (processingTime < 2000) {
      confidence += 0.05; // Fast processing bonus
    } else if (processingTime > 5000) {
      confidence -= 0.1; // Slow processing penalty (Custom Instructions: <5s target)
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Log layout evaluation
   */
  protected logLayoutEvaluation(
    diagramType: DiagramType,
    result: LayoutResult
  ): void {
    console.log(`\n📊 Layout Evaluation: ${diagramType}`);
    console.log(`  Nodes: ${result.layout.nodes.length}`);
    console.log(`  Edges: ${result.layout.edges.length}`);
    console.log(`  Bounds: ${result.bounds.width.toFixed(0)}x${result.bounds.height.toFixed(0)}`);
    console.log(`  Processing: ${result.processingTime.toFixed(0)}ms`);
    console.log(`  Success: ${result.success ? '✅' : '❌'}`);

    if (result.confidence !== undefined) {
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }
  }

  /**
   * Create error result for exception handling
   */
  protected createErrorResult(error: unknown): LayoutResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      layout: { nodes: [], edges: [] },
      bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
      processingTime: 0,
      success: false,
      confidence: 0,
      error: errorMessage
    };
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📐 Layout configuration updated');
  }

  /**
   * Get current configuration (for debugging/inspection)
   */
  public getConfig(): LayoutConfig {
    return { ...this.config };
  }
}
