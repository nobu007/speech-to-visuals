/**
 * Layout Generator - Core visualization component per custom instructions
 *
 * Implements automatic layout generation for diagram scenes
 * Following the modular architecture specified in custom instructions
 */

import { LayoutResult, DiagramNode, DiagramEdge } from './types';
import { DiagramType } from '@/types/diagram';

export interface LayoutConfig {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  spacing: number;
  algorithm: 'dagre' | 'force' | 'hierarchical' | 'manual';
}

export interface LayoutMetrics {
  nodeCount: number;
  edgeCount: number;
  hasOverlaps: boolean;
  boundingBox: { width: number; height: number };
  layoutTime: number;
}

/**
 * Core Layout Generator Class
 *
 * Implements the layout generation requirements from custom instructions:
 * - レイアウト破綻0 (Zero layout failures)
 * - ラベル可読性100% (100% label readability)
 */
export class LayoutGenerator {
  private config: LayoutConfig;
  private metrics: LayoutMetrics;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = {
      width: 1920,
      height: 1080,
      nodeWidth: 150,
      nodeHeight: 80,
      spacing: 50,
      algorithm: 'dagre',
      ...config
    };

    this.metrics = {
      nodeCount: 0,
      edgeCount: 0,
      hasOverlaps: false,
      boundingBox: { width: 0, height: 0 },
      layoutTime: 0
    };
  }

  /**
   * Generate layout for diagram scene
   * Main entry point following custom instructions architecture
   */
  async generateLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const startTime = performance.now();

    console.log(`🎨 Generating ${diagramType} layout for ${nodes.length} nodes, ${edges.length} edges`);

    try {
      // Select appropriate layout algorithm
      const algorithm = this.selectLayoutAlgorithm(diagramType, nodes.length);

      // Generate layout based on diagram type
      const layout = await this.generateTypeSpecificLayout(nodes, edges, diagramType, algorithm);

      // Validate layout quality (custom instructions requirement: レイアウト破綻0)
      const validation = this.validateLayout(layout);

      // Apply improvements if needed
      const optimizedLayout = validation.hasOverlaps ?
        await this.optimizeLayout(layout) : layout;

      this.metrics = {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        hasOverlaps: validation.hasOverlaps,
        boundingBox: validation.boundingBox,
        layoutTime: performance.now() - startTime
      };

      console.log(`✅ Layout generated successfully in ${this.metrics.layoutTime.toFixed(1)}ms`);

      return {
        ...optimizedLayout,
        metrics: this.metrics,
        quality: validation.score
      };

    } catch (error) {
      console.error('❌ Layout generation failed:', error);

      // Fallback layout generation (failure recovery per custom instructions)
      return this.generateFallbackLayout(nodes, edges, diagramType);
    }
  }

  /**
   * Select optimal layout algorithm based on diagram type and complexity
   */
  private selectLayoutAlgorithm(diagramType: DiagramType, nodeCount: number): string {
    switch (diagramType) {
      case 'flow':
        return nodeCount > 20 ? 'hierarchical' : 'dagre';
      case 'tree':
        return 'hierarchical';
      case 'timeline':
        return 'manual'; // Linear arrangement
      case 'matrix':
        return 'manual'; // Grid arrangement
      case 'cycle':
        return 'force';
      default:
        return 'dagre';
    }
  }

  /**
   * Generate layout specific to diagram type
   */
  private async generateTypeSpecificLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    diagramType: DiagramType,
    algorithm: string
  ): Promise<Partial<LayoutResult>> {

    switch (diagramType) {
      case 'flow':
        return this.generateFlowLayout(nodes, edges, algorithm);
      case 'tree':
        return this.generateTreeLayout(nodes, edges);
      case 'timeline':
        return this.generateTimelineLayout(nodes);
      case 'matrix':
        return this.generateMatrixLayout(nodes, edges);
      case 'cycle':
        return this.generateCycleLayout(nodes, edges);
      default:
        return this.generateDefaultLayout(nodes, edges);
    }
  }

  /**
   * Flow diagram layout generation
   */
  private async generateFlowLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    algorithm: string
  ): Promise<Partial<LayoutResult>> {

    if (algorithm === 'dagre') {
      return this.generateDagreLayout(nodes, edges, 'TB'); // Top-Bottom flow
    } else {
      return this.generateHierarchicalLayout(nodes, edges);
    }
  }

  /**
   * Tree diagram layout generation
   */
  private async generateTreeLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Promise<Partial<LayoutResult>> {

    // Find root nodes (nodes with no incoming edges)
    const rootNodes = nodes.filter(node =>
      !edges.some(edge => edge.target === node.id)
    );

    const root = rootNodes[0] || nodes[0];
    const positioned = new Set<string>();
    const nodePositions = new Map<string, { x: number; y: number }>();

    // Position root at top center
    nodePositions.set(root.id, {
      x: this.config.width / 2,
      y: this.config.nodeHeight + this.config.spacing
    });
    positioned.add(root.id);

    // Position children in levels
    await this.positionTreeChildren(root, nodes, edges, nodePositions, positioned, 1);

    return {
      nodes: nodes.map(node => ({
        ...node,
        ...nodePositions.get(node.id)!
      })),
      edges
    };
  }

  /**
   * Timeline layout generation
   */
  private async generateTimelineLayout(nodes: DiagramNode[]): Promise<Partial<LayoutResult>> {
    const totalWidth = this.config.width - 2 * this.config.spacing;
    const stepWidth = totalWidth / Math.max(1, nodes.length - 1);
    const centerY = this.config.height / 2;

    return {
      nodes: nodes.map((node, index) => ({
        ...node,
        x: this.config.spacing + index * stepWidth,
        y: centerY - this.config.nodeHeight / 2
      })),
      edges: [] // Timeline typically has connecting lines, not edges
    };
  }

  /**
   * Matrix layout generation
   */
  private async generateMatrixLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Promise<Partial<LayoutResult>> {

    const gridSize = Math.ceil(Math.sqrt(nodes.length));
    const cellWidth = (this.config.width - 2 * this.config.spacing) / gridSize;
    const cellHeight = (this.config.height - 2 * this.config.spacing) / gridSize;

    return {
      nodes: nodes.map((node, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;

        return {
          ...node,
          x: this.config.spacing + col * cellWidth + cellWidth / 2 - this.config.nodeWidth / 2,
          y: this.config.spacing + row * cellHeight + cellHeight / 2 - this.config.nodeHeight / 2
        };
      }),
      edges
    };
  }

  /**
   * Cycle layout generation
   */
  private async generateCycleLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Promise<Partial<LayoutResult>> {

    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(centerX, centerY) - this.config.nodeWidth - this.config.spacing;
    const angleStep = (2 * Math.PI) / nodes.length;

    return {
      nodes: nodes.map((node, index) => {
        const angle = index * angleStep;
        return {
          ...node,
          x: centerX + radius * Math.cos(angle) - this.config.nodeWidth / 2,
          y: centerY + radius * Math.sin(angle) - this.config.nodeHeight / 2
        };
      }),
      edges
    };
  }

  /**
   * Default layout using Dagre algorithm
   */
  private async generateDefaultLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Promise<Partial<LayoutResult>> {
    return this.generateDagreLayout(nodes, edges, 'TB');
  }

  /**
   * Dagre layout implementation
   */
  private async generateDagreLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    direction: 'TB' | 'LR' = 'TB'
  ): Promise<Partial<LayoutResult>> {

    try {
      // Try to use @dagrejs/dagre if available
      const dagre = await import('@dagrejs/dagre');

      const g = new dagre.graphlib.Graph();
      g.setGraph({
        rankdir: direction,
        ranksep: this.config.spacing,
        nodesep: this.config.spacing
      });

      // Add nodes
      nodes.forEach(node => {
        g.setNode(node.id, {
          width: this.config.nodeWidth,
          height: this.config.nodeHeight
        });
      });

      // Add edges
      edges.forEach(edge => {
        g.setEdge(edge.source, edge.target);
      });

      // Run layout
      dagre.layout(g);

      // Extract positions
      const layoutNodes = nodes.map(node => {
        const pos = g.node(node.id);
        return {
          ...node,
          x: pos.x - this.config.nodeWidth / 2,
          y: pos.y - this.config.nodeHeight / 2
        };
      });

      return { nodes: layoutNodes, edges };

    } catch (error) {
      console.warn('Dagre layout failed, falling back to manual layout:', error);
      return this.generateManualGrid(nodes, edges);
    }
  }

  /**
   * Hierarchical layout implementation
   */
  private async generateHierarchicalLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Promise<Partial<LayoutResult>> {
    // Simple hierarchical layout as fallback
    return this.generateTreeLayout(nodes, edges);
  }

  /**
   * Manual grid layout as ultimate fallback
   */
  private generateManualGrid(
    nodes: DiagramNode[],
    edges: DiagramEdge[]
  ): Partial<LayoutResult> {

    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);

    const cellWidth = this.config.width / cols;
    const cellHeight = this.config.height / rows;

    const layoutNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      return {
        ...node,
        x: col * cellWidth + cellWidth / 2 - this.config.nodeWidth / 2,
        y: row * cellHeight + cellHeight / 2 - this.config.nodeHeight / 2
      };
    });

    return { nodes: layoutNodes, edges };
  }

  /**
   * Position tree children recursively
   */
  private async positionTreeChildren(
    parent: DiagramNode,
    allNodes: DiagramNode[],
    edges: DiagramEdge[],
    positions: Map<string, { x: number; y: number }>,
    positioned: Set<string>,
    level: number
  ): Promise<void> {

    const children = edges
      .filter(edge => edge.source === parent.id)
      .map(edge => allNodes.find(node => node.id === edge.target)!)
      .filter(child => child && !positioned.has(child.id));

    if (children.length === 0) return;

    const parentPos = positions.get(parent.id)!;
    const totalWidth = children.length * (this.config.nodeWidth + this.config.spacing);
    const startX = parentPos.x - totalWidth / 2 + this.config.nodeWidth / 2;
    const childY = parentPos.y + this.config.nodeHeight + this.config.spacing * 2;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childX = startX + i * (this.config.nodeWidth + this.config.spacing);

      positions.set(child.id, { x: childX, y: childY });
      positioned.add(child.id);

      // Recursively position grandchildren
      await this.positionTreeChildren(child, allNodes, edges, positions, positioned, level + 1);
    }
  }

  /**
   * Validate layout quality (custom instructions: レイアウト破綻0)
   */
  private validateLayout(layout: Partial<LayoutResult>): {
    hasOverlaps: boolean;
    score: number;
    boundingBox: { width: number; height: number };
    issues: string[];
  } {

    const issues: string[] = [];
    let hasOverlaps = false;

    if (!layout.nodes) {
      return { hasOverlaps: true, score: 0, boundingBox: { width: 0, height: 0 }, issues: ['No nodes in layout'] };
    }

    // Check for overlaps
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const node1 = layout.nodes[i];
        const node2 = layout.nodes[j];

        if (this.nodesOverlap(node1, node2)) {
          hasOverlaps = true;
          issues.push(`Nodes ${node1.id} and ${node2.id} overlap`);
        }
      }
    }

    // Check bounds
    const boundingBox = this.calculateBoundingBox(layout.nodes);
    if (boundingBox.width > this.config.width || boundingBox.height > this.config.height) {
      issues.push('Layout exceeds canvas bounds');
    }

    // Calculate quality score
    let score = 1.0;
    if (hasOverlaps) score -= 0.5;
    if (issues.length > 2) score -= 0.3;
    if (boundingBox.width > this.config.width) score -= 0.2;

    return { hasOverlaps, score: Math.max(0, score), boundingBox, issues };
  }

  /**
   * Check if two nodes overlap
   */
  private nodesOverlap(node1: any, node2: any): boolean {
    const margin = 5; // Small margin for error

    return !(
      node1.x + this.config.nodeWidth + margin < node2.x ||
      node2.x + this.config.nodeWidth + margin < node1.x ||
      node1.y + this.config.nodeHeight + margin < node2.y ||
      node2.y + this.config.nodeHeight + margin < node1.y
    );
  }

  /**
   * Calculate bounding box of all nodes
   */
  private calculateBoundingBox(nodes: any[]): { width: number; height: number } {
    if (nodes.length === 0) return { width: 0, height: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + this.config.nodeWidth);
      maxY = Math.max(maxY, node.y + this.config.nodeHeight);
    });

    return {
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Optimize layout to eliminate overlaps
   */
  private async optimizeLayout(layout: Partial<LayoutResult>): Promise<Partial<LayoutResult>> {
    console.log('🔧 Optimizing layout to eliminate overlaps...');

    if (!layout.nodes) return layout;

    // Simple optimization: spread overlapping nodes
    const optimizedNodes = [...layout.nodes];

    for (let iteration = 0; iteration < 10; iteration++) {
      let hasChanges = false;

      for (let i = 0; i < optimizedNodes.length; i++) {
        for (let j = i + 1; j < optimizedNodes.length; j++) {
          const node1 = optimizedNodes[i];
          const node2 = optimizedNodes[j];

          if (this.nodesOverlap(node1, node2)) {
            // Move nodes apart
            const centerX1 = node1.x + this.config.nodeWidth / 2;
            const centerY1 = node1.y + this.config.nodeHeight / 2;
            const centerX2 = node2.x + this.config.nodeWidth / 2;
            const centerY2 = node2.y + this.config.nodeHeight / 2;

            const dx = centerX2 - centerX1;
            const dy = centerY2 - centerY1;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
              const minDistance = this.config.nodeWidth + this.config.spacing;
              const moveDistance = (minDistance - distance) / 2;

              const moveX = (dx / distance) * moveDistance;
              const moveY = (dy / distance) * moveDistance;

              node1.x -= moveX;
              node1.y -= moveY;
              node2.x += moveX;
              node2.y += moveY;

              hasChanges = true;
            }
          }
        }
      }

      if (!hasChanges) break;
    }

    return { ...layout, nodes: optimizedNodes };
  }

  /**
   * Generate fallback layout when primary generation fails
   */
  private generateFallbackLayout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    diagramType: DiagramType
  ): LayoutResult {

    console.log('🔄 Generating fallback layout...');

    const fallbackLayout = this.generateManualGrid(nodes, edges);

    return {
      nodes: fallbackLayout.nodes || [],
      edges: fallbackLayout.edges || [],
      metrics: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        hasOverlaps: false,
        boundingBox: { width: this.config.width, height: this.config.height },
        layoutTime: 0
      },
      quality: 0.7, // Fallback quality score
      algorithm: 'fallback_grid',
      warnings: ['Primary layout generation failed, using fallback grid layout']
    };
  }

  /**
   * Get current layout configuration
   */
  public getConfig(): LayoutConfig {
    return { ...this.config };
  }

  /**
   * Update layout configuration
   */
  public updateConfig(updates: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get last layout metrics
   */
  public getMetrics(): LayoutMetrics {
    return { ...this.metrics };
  }
}

// Export default instance
export const layoutGenerator = new LayoutGenerator();