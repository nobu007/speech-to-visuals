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
import { countOverlapPairs, distance } from '../layout-utils';
import { logger } from '../../utils/logger';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges, centerToCenterAnchors } from '../strategy-edges';
import { DEFAULT_NODE_SEPARATION, DEFAULT_EDGE_SEPARATION } from '../layout-spacing';
import { createLayoutRng } from '../layout-rng';
import {
  FORCE_DIRECTED_PHYSICS,
  runForceDirectedPhases
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
    const forces = new Map<string, { x: number; y: number }>();

    // Initialize forces
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Apply repulsive forces between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const dx = (node2.x + getNodeWidth(node2) / 2) - (node1.x + getNodeWidth(node1) / 2);
        const dy = (node2.y + getNodeHeight(node2) / 2) - (node1.y + getNodeHeight(node1) / 2);
        const dist = distance(dx, dy);

        if (dist > 0) {
          const idealDistance = optimalSpacing + (getNodeWidth(node1) + getNodeWidth(node2)) / 2;
          let repulsion = 0;

          if (dist < idealDistance) {
            // Strong repulsion when too close
            repulsion = strength * (idealDistance - dist) / dist * FORCE_DIRECTED_PHYSICS.STRONG_REPULSION_FACTOR;
          } else if (dist < idealDistance * FORCE_DIRECTED_PHYSICS.REPULSION_RANGE_MULTIPLIER) {
            // Moderate repulsion in intermediate range
            repulsion = strength * idealDistance / (dist * dist) * FORCE_DIRECTED_PHYSICS.MODERATE_REPULSION_FACTOR;
          }

          if (repulsion > 0) {
            const fx = (dx / dist) * repulsion;
            const fy = (dy / dist) * repulsion;

            const force1 = forces.get(node1.id) ?? { x: 0, y: 0 };
            const force2 = forces.get(node2.id) ?? { x: 0, y: 0 };

            force1.x -= fx;
            force1.y -= fy;
            force2.x += fx;
            force2.y += fy;
          }
        }
      }
    }

    // Apply attractive forces along edges
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (source && target) {
        const dx = (target.x + getNodeWidth(target) / 2) - (source.x + getNodeWidth(source) / 2);
        const dy = (target.y + getNodeHeight(target) / 2) - (source.y + getNodeHeight(source) / 2);
        const dist = distance(dx, dy);

        if (dist > 0) {
          const idealEdgeLength = optimalSpacing * FORCE_DIRECTED_PHYSICS.IDEAL_EDGE_LENGTH_MULTIPLIER;
          const attraction = strength * (dist - idealEdgeLength) * FORCE_DIRECTED_PHYSICS.ATTRACTION_FACTOR;

          const fx = (dx / dist) * attraction;
          const fy = (dy / dist) * attraction;

          const forceSource = forces.get(source.id) ?? { x: 0, y: 0 };
          const forceTarget = forces.get(target.id) ?? { x: 0, y: 0 };

          forceSource.x += fx;
          forceSource.y += fy;
          forceTarget.x -= fx;
          forceTarget.y -= fy;
        }
      }
    });

    // Apply forces with damping and bounds checking
    nodes.forEach(node => {
      const force = forces.get(node.id) ?? { x: 0, y: 0 };
      const damping = FORCE_DIRECTED_PHYSICS.DAMPING;

      // Limit maximum velocity
      const maxVelocity = optimalSpacing / FORCE_DIRECTED_PHYSICS.MAX_VELOCITY_DIVISOR;
      const velocity = distance(force.x, force.y);

      if (velocity > maxVelocity) {
        force.x = (force.x / velocity) * maxVelocity;
        force.y = (force.y / velocity) * maxVelocity;
      }

      // Update position
      node.x += force.x * damping;
      node.y += force.y * damping;

      // Constrain to canvas bounds
      const margin = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
      node.x = Math.max(margin, Math.min(config.width - getNodeWidth(node) - margin, node.x));
      node.y = Math.max(margin, Math.min(config.height - getNodeHeight(node) - margin, node.y));
    });
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
