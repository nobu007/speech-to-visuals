import { DiagramLayout, PositionedNode, DiagramType, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';

/** Get effective node width (handles w, width, and config fallback) */
function nodeW(n: PositionedNode, config: LayoutConfig): number {
  const w = n.w ?? n.width;
  return Number.isFinite(w) ? w : config.nodeWidth;
}

/** Get effective node height (handles h, height, and config fallback) */
function nodeH(n: PositionedNode, config: LayoutConfig): number {
  const h = n.h ?? n.height;
  return Number.isFinite(h) ? h : config.nodeHeight;
}

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
    if (nodes.length === 0) return { nodes, edges: layout.edges };

    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.3;

    const repositioned = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, nodes.length);
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) - nodeW(node, this.config) / 2,
        y: centerY + radius * Math.sin(angle) - nodeH(node, this.config) / 2,
      };
    });

    // Update edges to follow the circular arrangement
    const edges = layout.edges.map(edge => ({
      ...edge,
      points: this.calculateCircularEdgePoints(edge, repositioned)
    }));

    return { nodes: repositioned, edges };
  }

  /**
   * Optimize timeline for strict left-to-right progression
   */
  private optimizeTimelineLayout(layout: DiagramLayout): DiagramLayout {
    const nodes = [...layout.nodes];
    if (nodes.length === 0) return { nodes, edges: layout.edges };

    const sortedNodes = nodes.sort((a, b) => a.x - b.x);

    // Ensure even spacing (guard single-node case to avoid division by zero)
    const usableWidth = this.config.width - 2 * this.config.marginX;
    const spacing = nodes.length > 1 ? usableWidth / (nodes.length - 1) : 0;
    const repositioned = sortedNodes.map((node, index) => ({
      ...node,
      x: this.config.marginX + index * spacing - nodeW(node, this.config) / 2,
      y: this.config.height / 2 - nodeH(node, this.config) / 2, // Center vertically
    }));

    return { nodes: repositioned, edges: layout.edges };
  }

  /**
   * Optimize matrix layout for grid arrangement
   */
  private optimizeMatrixLayout(layout: DiagramLayout): DiagramLayout {
    const nodes = [...layout.nodes];
    if (nodes.length === 0) return { nodes, edges: layout.edges };

    const gridSize = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const cellWidth = (this.config.width - 2 * this.config.marginX) / gridSize;
    const cellHeight = (this.config.height - 2 * this.config.marginY) / gridSize;

    const repositioned = nodes.map((node, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      return {
        ...node,
        x: this.config.marginX + col * cellWidth + cellWidth / 2 - nodeW(node, this.config) / 2,
        y: this.config.marginY + row * cellHeight + cellHeight / 2 - nodeH(node, this.config) / 2,
      };
    });

    return { nodes: repositioned, edges: layout.edges };
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
      { x: fromNode.x + nodeW(fromNode, this.config) / 2, y: fromNode.y + nodeH(fromNode, this.config) / 2 },
      { x: toNode.x + nodeW(toNode, this.config) / 2, y: toNode.y + nodeH(toNode, this.config) / 2 }
    ];
  }

  /**
   * Iteration 3+: Advanced layout optimizations
   */
  public async advancedOptimizations(
    layout: DiagramLayout,
    diagramType: DiagramType
  ): Promise<DiagramLayout> {

    let optimizedLayout = { ...layout };

    // Step 1: Overlap detection and resolution (handled by OverlapResolver)
    // optimizedLayout = await this.resolveNodeOverlaps(optimizedLayout);

    // Step 2: Dynamic spacing based on content importance
    optimizedLayout = await this.adjustSpacingByImportance(optimizedLayout);

    // Step 3: Aesthetic improvements (symmetry, balance)
    optimizedLayout = await this.improveAesthetics(optimizedLayout, diagramType);

    // Step 4: Edge crossing minimization
    optimizedLayout = await this.minimizeEdgeCrossings(optimizedLayout);

    return optimizedLayout;
  }

  /**
   * Adjust spacing based on node importance
   */
  private async adjustSpacingByImportance(layout: DiagramLayout): Promise<DiagramLayout> {
    if (layout.nodes.length === 0) return layout;

    // Calculate centroid to scale relative to center, not origin
    const centerX = layout.nodes.reduce((sum, n) => sum + (n.x + nodeW(n, this.config) / 2), 0) / layout.nodes.length;
    const centerY = layout.nodes.reduce((sum, n) => sum + (n.y + nodeH(n, this.config) / 2), 0) / layout.nodes.length;

    const nodes = layout.nodes.map(node => {
      const importance = node.meta?.importance || 0.5;

      // More important nodes get more space around them
      const spacingMultiplier = 1 + importance * 0.5;

      // Scale relative to centroid to avoid pushing nodes off-canvas
      const nw = nodeW(node, this.config);
      const nh = nodeH(node, this.config);
      const nodeCenterX = node.x + nw / 2;
      const nodeCenterY = node.y + nh / 2;

      return {
        ...node,
        x: centerX + (nodeCenterX - centerX) * spacingMultiplier - nw / 2,
        y: centerY + (nodeCenterY - centerY) * spacingMultiplier - nh / 2
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

    // Center each level — map over all nodes to avoid mutating inputs
    const updated = new Map<string, PositionedNode>();
    levels.forEach((levelNodes) => {
      const centerX = this.config.width / 2;
      const totalWidth = levelNodes.length * 150; // Approximate spacing
      const startX = centerX - totalWidth / 2;

      const sorted = [...levelNodes].sort((a, b) => a.x - b.x);
      sorted.forEach((node, index) => {
        updated.set(node.id, {
          ...node,
          x: startX + index * 150,
        });
      });
    });

    return nodes.map(n => updated.get(n.id) ?? n);
  }

  /**
   * Improve cycle diagram balance
   */
  private improveCycleBalance(nodes: PositionedNode[]): PositionedNode[] {
    if (nodes.length === 0) return nodes;

    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.35;

    return nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, nodes.length);
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) - nodeW(node, this.config) / 2,
        y: centerY + radius * Math.sin(angle) - nodeH(node, this.config) / 2
      };
    });
  }

  /**
   * Improve timeline alignment
   */
  private improveTimelineAlignment(nodes: PositionedNode[]): PositionedNode[] {
    if (nodes.length === 0) return nodes;

    const sortedNodes = [...nodes].sort((a, b) => a.x - b.x);
    const y = this.config.height / 2 - nodeH(sortedNodes[0], this.config) / 2;
    const usableWidth = this.config.width - 2 * this.config.marginX;
    const spacing = nodes.length > 1 ? usableWidth / (nodes.length - 1) : 0;

    return sortedNodes.map((node, index) => ({
      ...node,
      y: y, // Align all nodes horizontally
      x: this.config.marginX + index * spacing
    }));
  }

  /**
   * Improve matrix grid alignment
   */
  private improveMatrixGrid(nodes: PositionedNode[]): PositionedNode[] {
    if (nodes.length === 0) return nodes;

    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const rows = Math.max(1, Math.ceil(nodes.length / cols));

    const cellWidth = (this.config.width - 2 * this.config.marginX) / cols;
    const cellHeight = (this.config.height - 2 * this.config.marginY) / rows;

    return nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const nw = nodeW(node, this.config);
      const nh = nodeH(node, this.config);

      return {
        ...node,
        x: this.config.marginX + col * cellWidth + (cellWidth - nw) / 2,
        y: this.config.marginY + row * cellHeight + (cellHeight - nh) / 2
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
    const fw = nodeW(fromNode, this.config);
    const fh = nodeH(fromNode, this.config);
    const tw = nodeW(toNode, this.config);
    const th = nodeH(toNode, this.config);

    const fromCenterX = fromNode.x + fw / 2;
    const fromCenterY = fromNode.y + fh / 2;
    const toCenterX = toNode.x + tw / 2;
    const toCenterY = toNode.y + th / 2;

    // Determine which side of the node to connect to
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Connect horizontally
      return {
        x: dx > 0 ? fromNode.x + fw : fromNode.x,
        y: fromCenterY
      };
    } else {
      // Connect vertically
      return {
        x: fromCenterX,
        y: dy > 0 ? fromNode.y + fh : fromNode.y
      };
    }
  }
}
