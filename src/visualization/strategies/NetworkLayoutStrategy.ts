/**
 * Network Layout Strategy
 *
 * Implements force-directed network layout
 * Optimized for complex relationships, social networks, and interconnected data
 *
 * Algorithm: Enhanced force-directed positioning
 * - Repulsive forces between nodes (prevent overlap)
 * - Attractive forces along edges (maintain structure)
 * - Multi-phase optimization for better convergence
 *
 * Custom Instructions Compliance:
 * - Zero overlap through adaptive spacing
 * - <5s processing with phased optimization
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';
import { countOverlapPairs } from '../layout-utils';
import { logger } from '../../utils/logger';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges, centerToCenterAnchors } from '../strategy-edges';
import { DEFAULT_NODE_SEPARATION, DEFAULT_EDGE_SEPARATION } from '../layout-spacing';
import { createLayoutRng } from '../layout-rng';
import {
  runForceDirectedPhases,
  applyForceDirectedStep
} from '../force-directed-params';

export class NetworkLayoutStrategy implements ILayoutStrategy {
  readonly name = 'network';

  supports(diagramType: DiagramType): boolean {
    return diagramType === 'network';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {

    try {
      // Step 1: Calculate optimal spacing based on node density
      const optimalSpacing = this.calculateOptimalSpacing(nodes.length, config);

      // Step 2: Initialize nodes with distributed positions
      const positionedNodes = this.initializeNodePositions(nodes, config, optimalSpacing);

      // Step 3: Apply enhanced force-directed algorithm
      await this.applyForceDirectedAlgorithm(positionedNodes, edges, config, optimalSpacing);

      // Step 4: Generate edges
      const layoutEdges = this.generateNetworkEdges(edges, positionedNodes);


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[Network] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal spacing based on node density
   */
  private calculateOptimalSpacing(nodeCount: number, config: LayoutConfig): number {
    const baseSpacing = config.nodeSeparation || DEFAULT_NODE_SEPARATION;

    // Scale spacing with square root of node count (handles density well)
    const densityFactor = Math.sqrt(nodeCount / 10);

    return Math.max(baseSpacing, baseSpacing * densityFactor);
  }

  /**
   * Initialize nodes with better distributed positions (grid with jitter)
   */
  private initializeNodePositions(
    nodes: NodeDatum[],
    config: LayoutConfig,
    spacing: number
  ): PositionedNode[] {
    const gridSize = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const cellWidth = config.width / gridSize;
    const cellHeight = config.height / gridSize;

    // Seeded jitter: same node set → same initial positions → reproducible
    // layout output (single source: layout-rng).
    const rand = createLayoutRng(nodes.map(n => n.id).join('|'));

    return nodes.map((node, index) => {
      const width = this.calculateNodeWidth(node, config);
      const height = config.nodeHeight || DEFAULT_NODE_HEIGHT;

      // Calculate grid position
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      const gridX = col * cellWidth + cellWidth / 2 - width / 2;
      const gridY = row * cellHeight + cellHeight / 2 - height / 2;

      // Add randomization to avoid perfect grid (helps force-directed converge)
      const jitterX = (rand() - 0.5) * spacing;
      const jitterY = (rand() - 0.5) * spacing;

      return {
        ...node,
        x: Math.max(0, Math.min(config.width - width, gridX + jitterX)),
        y: Math.max(0, Math.min(config.height - height, gridY + jitterY)),
        w: width,
        h: height
      };
    });
  }

  /**
   * Apply enhanced force-directed algorithm with multiple optimization phases
   */
  private async applyForceDirectedAlgorithm(
    nodes: PositionedNode[],
    edges: EdgeDatum[],
    config: LayoutConfig,
    optimalSpacing: number
  ): Promise<void> {
    // Multi-phase optimization for better convergence (shared schedule +
    // canonical convergence predicate — see force-directed-params.ts)
    runForceDirectedPhases(
      (strength) => this.applyForceStep(nodes, edges, strength, optimalSpacing, config),
      () => this.countOverlaps(nodes, optimalSpacing) === 0
    );
  }

  /**
   * Apply single force-directed step
   */
  private applyForceStep(
    nodes: PositionedNode[],
    edges: EdgeDatum[],
    strength: number,
    optimalSpacing: number,
    config: LayoutConfig
  ): void {
    // Round 40 single-source — the step body lives in force-directed-params
    // (applyForceDirectedStep); this seam keeps its LayoutConfig bounds.
    applyForceDirectedStep(nodes, edges, strength, optimalSpacing, config);
  }

  /**
   * Count overlapping nodes
   */
  private countOverlaps(nodes: PositionedNode[], spacing: number): number {
    return countOverlapPairs(nodes, spacing);
  }



  /**
   * Generate edges for network
   */
  private generateNetworkEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts;
    // this strategy's geometry is the shared center→center anchor pair.
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      (source, target) => [...centerToCenterAnchors(source, target)],
      '[Network] '
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
    // Round 31 single-source — log messages keep the '[Network]' prefix.
    return validateStrategyInputs(nodes, edges, '[Network]');
  }

  /**
   * Get network-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      nodeSeparation: 60,        // Adaptive spacing for networks
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      marginX: 40,
      marginY: 40
    };
  }
}
