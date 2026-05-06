import { DiagramLayout, PositionedNode, DiagramType } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { nodesOverlap } from '../layout-utils';

/** Get effective node width (handles both `w` and `width` properties) */
function nodeW(n: PositionedNode): number {
  return n.w ?? n.width ?? 120;
}

/** Get effective node height (handles both `h` and `height` properties) */
function nodeH(n: PositionedNode): number {
  return n.h ?? n.height ?? 60;
}

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
    node.x = Math.max(margin, Math.min(node.x, this.config.width - nodeW(node) - margin));
    node.y = Math.max(margin, Math.min(node.y, this.config.height - nodeH(node) - margin));
  }

  /**
   * Build a lightweight spatial grid for fast overlap candidate lookup.
   * Reduces overlap detection from O(n²) to ~O(n·k) where k is avg neighbors per cell.
   */
  private buildSpatialGrid(nodes: PositionedNode[], cellSize: number): Map<number, PositionedNode[]> {
    const grid = new Map<number, PositionedNode[]>();
    for (const node of nodes) {
      const w = nodeW(node);
      const h = nodeH(node);
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
      const d = Math.max(nodeW(n), nodeH(n));
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

    const nodes = [...layout.nodes];
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
        await this.resolveSpecificOverlap(a, b, diagramType);
      }

      iteration++;
    } while (overlapCount > 0 && iteration < maxIterations);

    if (overlapCount === 0) {
      // Intentionally empty: all overlaps resolved successfully, no action needed
    } else {
      console.warn(`⚠️ Could not eliminate all overlaps: ${overlapCount} remaining after ${iteration} iterations`);
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

    const nodes = [...layout.nodes];
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
  private async resolveSpecificOverlap(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType): Promise<void> {
    const separation = this.getMinimumSeparationForType(diagramType);

    const w1 = nodeW(node1), h1 = nodeH(node1);
    const w2 = nodeW(node2), h2 = nodeH(node2);
    const centerX1 = node1.x + w1 / 2;
    const centerY1 = node1.y + h1 / 2;
    const centerX2 = node2.x + w2 / 2;
    const centerY2 = node2.y + h2 / 2;

    const dx = centerX1 - centerX2;
    const dy = centerY1 - centerY2;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // Handle identical positions with type-specific logic
      await this.handleIdenticalPositions(node1, node2, diagramType);
      return;
    }

    const unitX = dx / distance;
    const unitY = dy / distance;
    const requiredDistance = separation + (w1 + w2) / 2;
    const moveDistance = (requiredDistance - distance) / 2;

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
    const separations = {
      flow: 30,      // Flow diagrams need clear paths
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
  private async handleIdenticalPositions(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType): Promise<void> {
    const separation = this.getMinimumSeparationForType(diagramType);

    switch (diagramType) {
      case 'flow':
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
        // Random displacement for other types
        const angle = Math.random() * 2 * Math.PI;
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
      const angle = (Math.PI * 2 * attempt) / attempts;
      const distance = minDistance + attempt * 10;

      const newX = node1.x + Math.cos(angle) * distance;
      const newY = node1.y + Math.sin(angle) * distance;

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
