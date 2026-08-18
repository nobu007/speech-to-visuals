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

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics, Point, BoundingBox, OverlapPair } from '../types';
import { calculateNodeCenter, calculateDistance, calculateNodeDistance, generateEdgePoints, detectOverlapPairs, resolveNodeHeight, nodeExtentEdges, foldNodeExtents } from '../layout-utils';
import { strategyNodeWidth } from '../strategy-common';
import { buildWarnedAnchoredEdges } from '../strategy-edges';
import { getNodeWidth, getNodeHeight } from '../node-dimensions';
import { logger } from '@stv/core/utils/logger';

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
    diagramType: DiagramType,
    iteration?: number
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
   * Calculate node height, respecting explicit dimension overrides.
   * Round 37 single-source — delegates to layout-utils.ts resolveNodeHeight
   * (the same explicit-first branch the width sibling gained in round 31 via
   * strategyNodeWidth, plus the `|| DEFAULT_NODE_HEIGHT` NaN-guard under a
   * `{}` config cast; engine constructors default the field).
   */
  protected calculateNodeHeight(node: NodeDatum): number {
    return resolveNodeHeight(node, this.config);
  }

  /**
   * Calculate node width based on label and config
   * Single source of truth for node width calculation
   */
  protected calculateNodeWidth(node: NodeDatum): number {
    // Round 31 single-source — delegates to strategy-common.ts, gaining the
    // explicit-dimension-first branch and the `|| DEFAULT_NODE_WIDTH`
    // fallback the raw `this.config.nodeWidth` pass lacked (NaN-producing
    // only under a `{}` config cast; engine constructors default the field).
    return strategyNodeWidth(node, this.config);
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
    // Extent scan delegates to foldNodeExtents (round 41 single source); the
    // 0 fallbacks preserve this engine's "never invent a dimension" policy.
    const extents = foldNodeExtents(nodes, (n) => nodeExtentEdges(n, 0, 0));
    if (extents === null) {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0
      };
    }

    const { minX, minY, maxX, maxY } = extents;

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
   *
   * Round 39 single source — the pairwise scan itself lives in layout-utils
   * `detectOverlapPairs`; only this engine's spacing default
   * (`config.nodeSeparation`) is decided here.
   */
  protected detectAllOverlaps(nodes: PositionedNode[], spacing?: number): OverlapPair[] {
    return detectOverlapPairs(nodes, spacing ?? this.config.nodeSeparation);
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
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts.
    // The anchor closure keeps the virtual `this.generateEdgePoints` dispatch
    // (LayoutEngine subclass overrides still take effect) and this site keeps
    // its unprefixed warn message ('' prefix).
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      (source, target) => this.generateEdgePoints(source, target),
      ''
    );
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

  /**
   * Constrain a single node to canvas bounds
   */
  protected constrainNodeToBounds(node: PositionedNode, margin: number = 10): void {
    const w = getNodeWidth(node, 0);
    const h = getNodeHeight(node, 0);
    if (node.x - w / 2 < margin) {
      node.x = w / 2 + margin;
    }
    if (node.y - h / 2 < margin) {
      node.y = h / 2 + margin;
    }
    if (node.x + w / 2 > this.config.width - margin) {
      node.x = this.config.width - w / 2 - margin;
    }
    if (node.y + h / 2 > this.config.height - margin) {
      node.y = this.config.height - h / 2 - margin;
    }
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
