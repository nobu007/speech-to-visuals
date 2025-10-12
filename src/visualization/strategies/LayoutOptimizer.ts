import { DiagramLayout, PositionedNode, DiagramType, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';

export class LayoutOptimizer {
  private config: LayoutConfig;

  constructor(config: LayoutConfig) {
    this.config = config;
  }

  /**
   * Iteration 2+: Diagram type-specific optimizations
   */
  public async optimizeForDiagramType(
    layout: DiagramLayout,
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    console.log(`Applying ${diagramType}-specific optimizations...`);

    switch (diagramType) {
      case 'cycle':
        return this.optimizeCycleLayout(layout);
      case 'timeline':
        return this.optimizeTimelineLayout(layout);
      case 'matrix':
        return this.optimizeMatrixLayout(layout);
      default:
        return layout;
    }
  }

  /**
   * Optimize cycle diagrams for circular arrangement
   */
  private optimizeCycleLayout(layout: DiagramLayout): DiagramLayout {
    const nodes = [...layout.nodes];
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.3;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      node.x = centerX + radius * Math.cos(angle) - node.w / 2;
      node.y = centerY + radius * Math.sin(angle) - node.h / 2;
    });

    // Update edges to follow the circular arrangement
    const edges = layout.edges.map(edge => ({
      ...edge,
      points: this.calculateCircularEdgePoints(edge, nodes)
    }));

    return { nodes, edges };
  }

  /**
   * Optimize timeline for strict left-to-right progression
   */
  private optimizeTimelineLayout(layout: DiagramLayout): DiagramLayout {
    const nodes = [...layout.nodes];
    const sortedNodes = nodes.sort((a, b) => a.x - b.x);

    // Ensure even spacing
    const spacing = (this.config.width - 2 * this.config.marginX) / (nodes.length - 1);
    sortedNodes.forEach((node, index) => {
      node.x = this.config.marginX + index * spacing - node.w / 2;
      node.y = this.config.height / 2 - node.h / 2; // Center vertically
    });

    return { nodes: sortedNodes, edges: layout.edges };
  }

  /**
   * Optimize matrix layout for grid arrangement
   */
  private optimizeMatrixLayout(layout: DiagramLayout): DiagramLayout {
    const nodes = [...layout.nodes];
    const gridSize = Math.ceil(Math.sqrt(nodes.length));
    const cellWidth = (this.config.width - 2 * this.config.marginX) / gridSize;
    const cellHeight = (this.config.height - 2 * this.config.marginY) / gridSize;

    nodes.forEach((node, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      node.x = this.config.marginX + col * cellWidth + cellWidth / 2 - node.w / 2;
      node.y = this.config.marginY + row * cellHeight + cellHeight / 2 - node.h / 2;
    });

    return { nodes, edges: layout.edges };
  }

  /**
   * Calculate edge points for circular layouts
   */
  private calculateCircularEdgePoints(
    edge: LayoutEdge,
    nodes: PositionedNode[]
  ): { x: number; y: number }[] {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) {
      return edge.points;
    }

    return [
      { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
      { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
    ];
  }

  /**
   * Iteration 3+: Advanced layout optimizations
   */
  public async advancedOptimizations(
    layout: DiagramLayout,
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    console.log(`Applying advanced optimizations...`);

    let optimizedLayout = { ...layout };

    // Step 1: Overlap detection and resolution (handled by OverlapResolver)
    // optimizedLayout = await this.resolveNodeOverlaps(optimizedLayout);

    // Step 2: Dynamic spacing based on content importance
    optimizedLayout = await this.adjustSpacingByImportance(optimizedLayout);

    // Step 3: Aesthetic improvements (symmetry, balance)
    optimizedLayout = await this.improveAesthetics(optimizedLayout, diagramType);

    // Step 4: Edge crossing minimization
    optimizedLayout = await this.minimizeEdgeCrossings(optimizedLayout);

    console.log('✅ Advanced optimizations completed');
    return optimizedLayout;
  }

  /**
   * Adjust spacing based on node importance
   */
  private async adjustSpacingByImportance(layout: DiagramLayout): Promise<DiagramLayout> {
    const nodes = layout.nodes.map(node => {
      const importance = node.meta?.importance || 0.5;

      // More important nodes get more space around them
      const spacingMultiplier = 1 + importance * 0.5;

      return {
        ...node,
        x: node.x * spacingMultiplier,
        y: node.y * spacingMultiplier
      };
    });

    return { ...layout, nodes };
  }

  /**
   * Improve visual aesthetics (symmetry, balance)
   */
  private async improveAesthetics(layout: DiagramLayout, diagramType: DiagramType): Promise<DiagramLayout> {
    let nodes = [...layout.nodes];

    // Apply diagram-specific aesthetic improvements
    switch (diagramType) {
      case 'tree':
        nodes = this.improveTreeSymmetry(nodes);
        break;
      case 'cycle':
        nodes = this.improveCycleBalance(nodes);
        break;
      case 'timeline':
        nodes = this.improveTimelineAlignment(nodes);
        break;
      case 'matrix':
        nodes = this.improveMatrixGrid(nodes);
        break;
    }

    return { ...layout, nodes };
  }

  /**
   * Improve tree diagram symmetry
   */
  private improveTreeSymmetry(nodes: PositionedNode[]): PositionedNode[] {
    // Sort nodes by y-coordinate (levels)
    const levels = new Map<number, PositionedNode[]>();

    nodes.forEach(node => {
      const level = Math.round(node.y / 100); // Group by approximate level
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    });

    // Center each level
    levels.forEach((levelNodes, level) => {
      const centerX = this.config.width / 2;
      const totalWidth = levelNodes.length * 150; // Approximate spacing
      const startX = centerX - totalWidth / 2;

      levelNodes.sort((a, b) => a.x - b.x);
      levelNodes.forEach((node, index) => {
        node.x = startX + index * 150;
      });
    });

    return nodes;
  }

  /**
   * Improve cycle diagram balance
   */
  private improveCycleBalance(nodes: PositionedNode[]): PositionedNode[] {
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.35;

    return nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) - node.w / 2,
        y: centerY + radius * Math.sin(angle) - node.h / 2
      };
    });
  }

  /**
   * Improve timeline alignment
   */
  private improveTimelineAlignment(nodes: PositionedNode[]): PositionedNode[] {
    const sortedNodes = [...nodes].sort((a, b) => a.x - b.x);
    const y = this.config.height / 2 - sortedNodes[0].h / 2;

    return sortedNodes.map((node, index) => ({
      ...node,
      y: y, // Align all nodes horizontally
      x: this.config.marginX + index * ((this.config.width - 2 * this.config.marginX) / (nodes.length - 1))
    }));
  }

  /**
   * Improve matrix grid alignment
   */
  private improveMatrixGrid(nodes: PositionedNode[]): PositionedNode[] {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);

    const cellWidth = (this.config.width - 2 * this.config.marginX) / cols;
    const cellHeight = (this.config.height - 2 * this.config.marginY) / rows;

    return nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      return {
        ...node,
        x: this.config.marginX + col * cellWidth + (cellWidth - node.w) / 2,
        y: this.config.marginY + row * cellHeight + (cellHeight - node.h) / 2
      };
    });
  }

  /**
   * Minimize edge crossings using simple heuristics
   */
  public async minimizeEdgeCrossings(layout: DiagramLayout): Promise<DiagramLayout> {
    // Simple edge optimization - route edges to minimize crossings
    const optimizedEdges = layout.edges.map(edge => {
      const fromNode = layout.nodes.find(n => n.id === edge.from);
      const toNode = layout.nodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) return edge;

      // Calculate optimal connection points
      const fromPoint = this.getOptimalConnectionPoint(fromNode, toNode);
      const toPoint = this.getOptimalConnectionPoint(toNode, fromNode);

      return {
        ...edge,
        points: [fromPoint, toPoint]
      };
    });

    return { ...layout, edges: optimizedEdges };
  }

  /**
   * Get optimal connection point to minimize crossings
   */
  private getOptimalConnectionPoint(fromNode: PositionedNode, toNode: PositionedNode): { x: number; y: number } {
    const fromCenterX = fromNode.x + fromNode.w / 2;
    const fromCenterY = fromNode.y + fromNode.h / 2;
    const toCenterX = toNode.x + toNode.w / 2;
    const toCenterY = toNode.y + toNode.h / 2;

    // Determine which side of the node to connect to
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Connect horizontally
      return {
        x: dx > 0 ? fromNode.x + fromNode.w : fromNode.x,
        y: fromCenterY
      };
    } else {
      // Connect vertically
      return {
        x: fromCenterX,
        y: dy > 0 ? fromNode.y + fromNode.h : fromNode.y
      };
    }
  }
}
