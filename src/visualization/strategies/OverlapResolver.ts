import { DiagramLayout, PositionedNode, DiagramType } from '@stv/core/types/diagram';
import { LayoutConfig } from '../types';
import { createLayoutRng } from '../layout-rng';
import { nodesOverlap, distance, clampNodeCoordinate, ringAngle, pointOnCircle } from '../layout-utils';
import { logger } from '@stv/core/utils/logger';
import { getNodeWidth, getNodeHeight } from '../node-dimensions';

export class OverlapResolver {
  private config: LayoutConfig;

  constructor(
    config: LayoutConfig
  ) {
    this.config = config;
  }

  /**
   * Constrain node position to canvas bounds
   * Ensures nodes don't go off-canvas
   */
  private constrainNodeToBounds(node: PositionedNode, margin: number = 10): void {
    // round 45: the double-guarded `maxX` collapse (pre-clamped upper bound,
    // then clamp) resolves identically to the canonical single expression —
    // oversized nodes land on the margin either way.
    node.x = clampNodeCoordinate(node.x, this.config.width, getNodeWidth(node), margin);
    node.y = clampNodeCoordinate(node.y, this.config.height, getNodeHeight(node), margin);
  }

  /**
   * Build a lightweight spatial grid for fast overlap candidate lookup.
   * Reduces overlap detection from O(n²) to ~O(n·k) where k is avg neighbors per cell.
   */
  private buildSpatialGrid(nodes: PositionedNode[], cellSize: number): Map<number, PositionedNode[]> {
    const grid = new Map<number, PositionedNode[]>();
    for (const node of nodes) {
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);
      const minCol = Math.floor(node.x / cellSize);
      const maxCol = Math.floor((node.x + w) / cellSize);
      const minRow = Math.floor(node.y / cellSize);
      const maxRow = Math.floor((node.y + h) / cellSize);
      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          const key = col * 73856093 ^ row * 19349663; // spatial hash key
          let cell = grid.get(key);
          if (!cell) { cell = []; grid.set(key, cell); }
          cell.push(node);
        }
      }
    }
    return grid;
  }

  /**
   * Detect all overlapping pairs using spatial grid (faster than O(n²) for large sets).
   * Returns deduplicated pairs.
   */
  private detectOverlapsFast(nodes: PositionedNode[]): Array<[PositionedNode, PositionedNode]> {
    if (nodes.length < 2) return [];

    // Calculate cell size from max node dimension
    let maxDim = 0;
    for (const n of nodes) {
      const d = Math.max(getNodeWidth(n), getNodeHeight(n));
      if (d > maxDim) maxDim = d;
    }
    const cellSize = Math.max(maxDim + 10, 50);

    const grid = this.buildSpatialGrid(nodes, cellSize);
    const pairs: Array<[PositionedNode, PositionedNode]> = [];
    const checked = new Set<string>();

    for (const cellNodes of grid.values()) {
      for (let i = 0; i < cellNodes.length; i++) {
        for (let j = i + 1; j < cellNodes.length; j++) {
          const a = cellNodes[i];
          const b = cellNodes[j];
          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);
          if (nodesOverlap(a, b)) {
            pairs.push([a, b]);
          }
        }
      }
    }

    return pairs;
  }

  /**
   * 🎯 Custom Instructions: Ensure Zero Overlaps (MANDATORY)
   * Phase 4 requirement: Zero tolerance for overlaps
   *
   * Optimized with spatial hashing and adaptive iteration limits.
   */
  public async ensureZeroOverlaps(layout: DiagramLayout, diagramType: DiagramType): Promise<DiagramLayout> {

    const nodes = layout.nodes ? [...layout.nodes] : [];
    if (nodes.length === 0) {
      return { ...layout, nodes: [] };
    }
    // Seeded per-call (round 17): the identical-position default-branch
    // displacement angle draws from createLayoutRng keyed by this call's node
    // ids instead of Math.random. flow/flowchart/timeline/tree branches were
    // already deterministic. Local variable — a stored rng would leak the
    // previous call's sequence.
    const rng = createLayoutRng(nodes.map(n => n.id).join('|'));

    // Scale max iterations down for large datasets to maintain performance
    const maxIterations = Math.min(50, Math.max(10, Math.floor(2000 / nodes.length)));
    let overlapCount = 0;
    let iteration = 0;
    let prevOverlapCount = Infinity;
    let stagnationCount = 0;

    do {
      const overlappingPairs = this.detectOverlapsFast(nodes);
      overlapCount = overlappingPairs.length;

      if (overlapCount === 0) break;

      // Stagnation detection: break early if not making progress
      if (overlapCount >= prevOverlapCount) {
        stagnationCount++;
        if (stagnationCount >= 3) break;
      } else {
        stagnationCount = 0;
      }
      prevOverlapCount = overlapCount;

      // Resolve all detected overlaps
      for (const [a, b] of overlappingPairs) {
        await this.resolveSpecificOverlap(a, b, diagramType, rng);
      }

      iteration++;
    } while (overlapCount > 0 && iteration < maxIterations);

    if (overlapCount === 0) {
      // Intentionally empty: all overlaps resolved successfully, no action needed
    } else {
      logger.warn(`Could not eliminate all overlaps: ${overlapCount} remaining after ${iteration} iterations`);
      // Force separation for remaining overlaps
      await this.forceSeparateOverlappingNodes(nodes);
    }

    return { ...layout, nodes };
  }

  /**
   * 🎯 Custom Instructions: Final Overlap Resolution (GUARANTEE)
   * Final check to absolutely guarantee zero overlaps
   * Uses spatial hashing for efficient overlap detection.
   */
  public async finalOverlapResolution(layout: DiagramLayout): Promise<DiagramLayout> {

    const nodes = layout.nodes ? [...layout.nodes] : [];
    if (nodes.length === 0) {
      return { ...layout, nodes: [] };
    }
    const overlappingPairs = this.detectOverlapsFast(nodes);

    if (overlappingPairs.length === 0) {
      return { ...layout, nodes };
    }

    for (const [a, b] of overlappingPairs) {
      await this.forceSeparateNodes(a, b);
    }

    return { ...layout, nodes };
  }

  /**
   * Resolve specific overlap between two nodes with diagram-type awareness
   */
  private async resolveSpecificOverlap(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType, rng: () => number): Promise<void> {
    const separation = this.getMinimumSeparationForType(diagramType);

    const w1 = getNodeWidth(node1), h1 = getNodeHeight(node1);
    const w2 = getNodeWidth(node2), h2 = getNodeHeight(node2);
    const centerX1 = node1.x + w1 / 2;
    const centerY1 = node1.y + h1 / 2;
    const centerX2 = node2.x + w2 / 2;
    const centerY2 = node2.y + h2 / 2;

    const dx = centerX1 - centerX2;
    const dy = centerY1 - centerY2;
    const dist = distance(dx, dy);

    if (dist === 0) {
      // Handle identical positions with type-specific logic
      await this.handleIdenticalPositions(node1, node2, diagramType, rng);
      return;
    }

    const unitX = dx / dist;
    const unitY = dy / dist;
    const requiredDistance = separation + (w1 + w2) / 2;
    const moveDistance = (requiredDistance - dist) / 2;

    // Move nodes apart
    node1.x += unitX * moveDistance;
    node1.y += unitY * moveDistance;
    node2.x -= unitX * moveDistance;
    node2.y -= unitY * moveDistance;

    // Ensure nodes stay within bounds
    this.constrainNodeToBounds(node1);
    this.constrainNodeToBounds(node2);
  }

  /**
   * Get minimum separation distance based on diagram type
   */
  private getMinimumSeparationForType(diagramType: DiagramType): number {
    const separations: Record<string, number> = {
      flow: 30,      // Flow diagrams need clear paths
      flowchart: 30, // Flowchart is a flow diagram (canonical distinct DiagramType)
      tree: 40,      // Hierarchy needs breathing room
      timeline: 20,  // Timeline can be more compact
      matrix: 25,    // Grid layout moderate spacing
      cycle: 35      // Circular needs balanced spacing
    };
    return separations[diagramType] || 30;
  }

  /**
   * Handle nodes at identical positions
   */
  private async handleIdenticalPositions(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType, rng: () => number): Promise<void> {
    const separation = this.getMinimumSeparationForType(diagramType);

    switch (diagramType) {
      // 'flowchart' shares flow's deterministic y-axis separation; previously it
      // hit the default branch's unseeded random displacement, giving a flowchart
      // non-deterministic jitter on the identical-position edge case.
      case 'flow':
      case 'flowchart':
        node1.y -= separation;
        node2.y += separation;
        break;
      case 'timeline':
        node1.x -= separation;
        node2.x += separation;
        break;
      case 'tree':
        node1.x -= separation / 2;
        node1.y -= separation;
        node2.x += separation / 2;
        node2.y += separation;
        break;
      default: {
        // Seeded displacement for other types (round 17; was Math.random)
        const angle = rng() * 2 * Math.PI;
        node1.x += Math.cos(angle) * separation;
        node1.y += Math.sin(angle) * separation;
        node2.x -= Math.cos(angle) * separation;
        node2.y -= Math.sin(angle) * separation;
      }
    }
  }

  /**
   * Force separate overlapping nodes (emergency method)
   * Uses spatial hashing for efficient detection.
   */
  private async forceSeparateOverlappingNodes(nodes: PositionedNode[]): Promise<void> {

    const overlappingPairs = this.detectOverlapsFast(nodes);
    for (const [a, b] of overlappingPairs) {
      await this.forceSeparateNodes(a, b);
    }
  }

  /**
   * Force separate two specific nodes
   */
  private async forceSeparateNodes(node1: PositionedNode, node2: PositionedNode): Promise<void> {
    const minDistance = 50; // Minimum safe distance

    // Find safe positions
    const attempts = 20;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const distance = minDistance + attempt * 10;

      // Round 48 single-source — the probe walks a ring of candidate
      // positions around node1 (the retired `(Math.PI * 2 * attempt)` operand
      // order is bit-identical, IEEE multiplication commutes).
      const probe = pointOnCircle(node1.x, node1.y, ringAngle(attempt, attempts), distance);

      const newX = probe.x;
      const newY = probe.y;

      // Check if this position is safe
      if (this.isPositionSafe({ ...node2, x: newX, y: newY }, [node1])) {
        node2.x = newX;
        node2.y = newY;
        this.constrainNodeToBounds(node2);
        break;
      }
    }
  }

  /**
   * Check if a position is safe (no overlaps)
   */
  private isPositionSafe(testNode: PositionedNode, otherNodes: PositionedNode[]): boolean {
    return !otherNodes.some(node => nodesOverlap(testNode, node));
  }
}
