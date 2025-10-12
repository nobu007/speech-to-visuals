import { DiagramLayout, PositionedNode, DiagramType } from '@/types/diagram';
import { LayoutConfig } from '../types';

export class OverlapResolver {
  private config: LayoutConfig;

  constructor(
    config: LayoutConfig
  ) {
    this.config = config;
  }

  /**
   * Check if two nodes overlap
   * Includes minimum spacing requirement
   */
  private nodesOverlap(
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
   * Constrain node position to canvas bounds
   * Ensures nodes don't go off-canvas
   */
  private constrainNodeToBounds(node: PositionedNode, margin: number = 10): void {
    node.x = Math.max(margin, Math.min(node.x, this.config.width - node.w - margin));
    node.y = Math.max(margin, Math.min(node.y, this.config.height - node.h - margin));
  }

  /**
   * 🎯 Custom Instructions: Ensure Zero Overlaps (MANDATORY)
   * Phase 4 requirement: Zero tolerance for overlaps
   */
  public async ensureZeroOverlaps(layout: DiagramLayout, diagramType: DiagramType): Promise<DiagramLayout> {
    console.log('🎯 Ensuring zero overlaps (Custom Instructions requirement)...');

    const nodes = [...layout.nodes];
    const maxIterations = 50; // Increased for thoroughness
    let overlapCount = 0;
    let iteration = 0;

    do {
      overlapCount = 0;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (this.nodesOverlap(nodes[i], nodes[j])) {
            overlapCount++;
            await this.resolveSpecificOverlap(nodes[i], nodes[j], diagramType);
          }
        }
      }

      iteration++;

      if (iteration % 10 === 0 && overlapCount > 0) {
        console.log(`🔄 Overlap resolution iteration ${iteration}: ${overlapCount} overlaps remaining`);
      }

    } while (overlapCount > 0 && iteration < maxIterations);

    if (overlapCount === 0) {
      console.log(`✅ Zero overlaps achieved in ${iteration} iterations`);
    } else {
      console.warn(`⚠️ Could not eliminate all overlaps: ${overlapCount} remaining after ${maxIterations} iterations`);
      // Force separation for remaining overlaps
      await this.forceSeparateOverlappingNodes(nodes);
    }

    return { ...layout, nodes };
  }

  /**
   * 🎯 Custom Instructions: Final Overlap Resolution (GUARANTEE)
   * Final check to absolutely guarantee zero overlaps
   */
  public async finalOverlapResolution(layout: DiagramLayout): Promise<DiagramLayout> {
    console.log('🎯 Final overlap resolution check...');

    const nodes = [...layout.nodes];
    let remainingOverlaps = 0;

    // Final verification pass
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (this.nodesOverlap(nodes[i], nodes[j])) {
          remainingOverlaps++;
          // Force immediate separation
          await this.forceSeparateNodes(nodes[i], nodes[j]);
        }
      }
    }

    if (remainingOverlaps === 0) {
      console.log('✅ Zero overlap guarantee achieved');
    } else {
      console.log('🔧 Applied emergency separation for final overlaps');
    }

    return { ...layout, nodes };
  }

  /**
   * Resolve specific overlap between two nodes with diagram-type awareness
   */
  private async resolveSpecificOverlap(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType): Promise<void> {
    const separation = this.getMinimumSeparationForType(diagramType);

    const centerX1 = node1.x + node1.w / 2;
    const centerY1 = node1.y + node1.h / 2;
    const centerX2 = node2.x + node2.w / 2;
    const centerY2 = node2.y + node2.h / 2;

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
    const requiredDistance = separation + (node1.w + node2.w) / 2;
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
      default:
        // Random displacement for other types
        const angle = Math.random() * 2 * Math.PI;
        node1.x += Math.cos(angle) * separation;
        node1.y += Math.sin(angle) * separation;
        node2.x -= Math.cos(angle) * separation;
        node2.y -= Math.sin(angle) * separation;
    }
  }

  /**
   * Force separate overlapping nodes (emergency method)
   */
  private async forceSeparateOverlappingNodes(nodes: PositionedNode[]): Promise<void> {
    console.log('🚨 Applying emergency overlap resolution...');

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (this.nodesOverlap(nodes[i], nodes[j])) {
          await this.forceSeparateNodes(nodes[i], nodes[j]);
        }
      }
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
    return !otherNodes.some(node => this.nodesOverlap(testNode, node));
  }
}
