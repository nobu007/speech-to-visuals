import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics } from './types';
import ComplexLayoutEngine from './complex-layout-engine';

/**
 * Diagram Layout Engine - Iterative Implementation
 * Uses Dagre for automatic graph layout with diagram-specific optimizations
 */
export class LayoutEngine {
  private config: LayoutConfig;
  private iteration: number = 1;
  private complexEngine: ComplexLayoutEngine;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB',
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
      ...config
    };

    // Initialize complex layout engine for large diagrams
    this.complexEngine = new ComplexLayoutEngine({
      ...this.config,
      enableClustering: true,
      enableForceDirected: true,
      enableOverlapResolution: true,
      enableEdgeOptimization: true
    });
  }

  /**
   * Generate layout for a diagram
   */
  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    console.log(`[Layout Engine V${this.iteration}] Generating ${diagramType} layout for ${nodes.length} nodes, ${edges.length} edges`);

    try {
      // For complex diagrams (20+ nodes), use specialized complex layout engine
      if (nodes.length >= 20) {
        console.log('🔧 Using complex layout engine for large diagram...');
        return await this.complexEngine.generateComplexLayout(nodes, edges, diagramType);
      }

      // For smaller diagrams, use standard approach
      // Iteration 1: Basic Dagre layout
      let layout = await this.basicDagreLayout(nodes, edges, diagramType);

      // Iteration 2+: Type-specific optimizations
      if (this.iteration > 1) {
        layout = await this.optimizeForDiagramType(layout, diagramType);
      }

      // Iteration 3+: Advanced layout improvements
      if (this.iteration > 2) {
        layout = await this.advancedOptimizations(layout, diagramType);
      }

      const bounds = this.calculateBounds(layout);
      const processingTime = performance.now() - startTime;

      const result: LayoutResult = {
        layout,
        bounds,
        processingTime,
        success: true
      };

      await this.evaluateLayout(result, diagramType);
      return result;

    } catch (error) {
      console.error('[Layout Engine] Error:', error);
      return {
        layout: { nodes: [], edges: [] },
        bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
        processingTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown layout error'
      };
    }
  }

  /**
   * Iteration 1: Basic Dagre layout implementation with fallback
   */
  private async basicDagreLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    console.log(`[V${this.iteration}] Applying basic Dagre layout...`);

    try {
      // Try to use Dagre layout
      const g = new dagre.graphlib.Graph();
      const graphConfig = this.getGraphConfig(diagramType);
      g.setGraph(graphConfig);
      g.setDefaultEdgeLabel(() => ({}));

      nodes.forEach(node => {
        g.setNode(node.id, {
          label: node.label,
          width: this.calculateNodeWidth(node.label),
          height: this.config.nodeHeight
        });
      });

      edges.forEach(edge => {
        g.setEdge(edge.from, edge.to, {
          label: edge.label || ''
        });
      });

      // Run the layout algorithm
      dagre.layout(g);

      // Convert Dagre output to our format
      const positionedNodes: PositionedNode[] = nodes.map(node => {
        const dagreNode = g.node(node.id);
        return {
          ...node,
          x: dagreNode.x - dagreNode.width / 2,
          y: dagreNode.y - dagreNode.height / 2,
          w: dagreNode.width,
          h: dagreNode.height
        };
      });

      const layoutEdges: LayoutEdge[] = edges.map(edge => {
        const dagreEdge = g.edge(edge.from, edge.to);
        return {
          from: edge.from,
          to: edge.to,
          points: dagreEdge.points || [
            { x: g.node(edge.from).x, y: g.node(edge.from).y },
            { x: g.node(edge.to).x, y: g.node(edge.to).y }
          ],
          label: edge.label
        };
      });

      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      console.log(`[V${this.iteration}] Dagre failed, using fallback layout...`);
      return this.fallbackLayout(nodes, edges, diagramType);
    }
  }

  /**
   * Fallback layout implementation (manual positioning)
   */
  private fallbackLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): DiagramLayout {
    console.log(`[V${this.iteration}] Applying fallback ${diagramType} layout...`);

    const positionedNodes: PositionedNode[] = [];
    const layoutEdges: LayoutEdge[] = [];

    // Different layout strategies based on diagram type
    switch (diagramType) {
      case 'flow':
        return this.createFlowLayout(nodes, edges);
      case 'tree':
        return this.createTreeLayout(nodes, edges);
      case 'timeline':
        return this.createTimelineLayout(nodes, edges);
      case 'cycle':
        return this.createCycleLayout(nodes, edges);
      case 'matrix':
        return this.createMatrixLayout(nodes, edges);
      default:
        return this.createGridLayout(nodes, edges);
    }
  }

  /**
   * Create a simple flow layout (top to bottom)
   */
  private createFlowLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const nodeWidth = 200;
    const nodeHeight = 80;
    const spacing = 100;
    const startX = (this.config.width - nodeWidth) / 2;
    const startY = 100;

    const positionedNodes = nodes.map((node, index) => ({
      ...node,
      x: startX,
      y: startY + index * (nodeHeight + spacing),
      w: nodeWidth,
      h: nodeHeight
    }));

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h },
          { x: toNode.x + toNode.w / 2, y: toNode.y }
        ],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a simple tree layout (hierarchical)
   */
  private createTreeLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    return this.createFlowLayout(nodes, edges); // Simple fallback for now
  }

  /**
   * Create a timeline layout (horizontal progression)
   */
  private createTimelineLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const nodeWidth = 160;
    const nodeHeight = 60;
    const spacing = (this.config.width - 2 * 50) / Math.max(1, nodes.length - 1);
    const y = (this.config.height - nodeHeight) / 2;

    const positionedNodes = nodes.map((node, index) => ({
      ...node,
      x: 50 + index * spacing - nodeWidth / 2,
      y: y,
      w: nodeWidth,
      h: nodeHeight
    }));

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: fromNode.x + fromNode.w, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x, y: toNode.y + toNode.h / 2 }
        ],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a cycle layout (circular)
   */
  private createCycleLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.3;
    const nodeWidth = 140;
    const nodeHeight = 60;

    const positionedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) - nodeWidth / 2,
        y: centerY + radius * Math.sin(angle) - nodeHeight / 2,
        w: nodeWidth,
        h: nodeHeight
      };
    });

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
        ],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a matrix layout (grid)
   */
  private createMatrixLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const nodeWidth = 140;
    const nodeHeight = 60;
    const spacingX = this.config.width / cols;
    const spacingY = this.config.height / Math.ceil(nodes.length / cols);

    const positionedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...node,
        x: col * spacingX + (spacingX - nodeWidth) / 2,
        y: row * spacingY + (spacingY - nodeHeight) / 2,
        w: nodeWidth,
        h: nodeHeight
      };
    });

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
        ],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a simple grid layout (default fallback)
   */
  private createGridLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    return this.createMatrixLayout(nodes, edges);
  }

  /**
   * Get Dagre configuration based on diagram type
   */
  private getGraphConfig(diagramType: DiagramType) {
    const baseConfig = {
      nodesep: this.config.nodeSeparation,
      edgesep: this.config.edgeSeparation,
      ranksep: this.config.rankSeparation,
      marginx: this.config.marginX,
      marginy: this.config.marginY
    };

    switch (diagramType) {
      case 'flow':
        return {
          ...baseConfig,
          rankdir: 'TB', // Top to bottom for flow diagrams
          align: 'UL'
        };
      case 'tree':
        return {
          ...baseConfig,
          rankdir: 'TB', // Top to bottom for hierarchies
          ranker: 'longest-path'
        };
      case 'timeline':
        return {
          ...baseConfig,
          rankdir: 'LR', // Left to right for timelines
          ranker: 'tight-tree'
        };
      case 'matrix':
        return {
          ...baseConfig,
          rankdir: 'TB',
          ranker: 'network-simplex'
        };
      case 'cycle':
        return {
          ...baseConfig,
          rankdir: 'TB',
          ranker: 'longest-path'
        };
      default:
        return baseConfig;
    }
  }

  /**
   * Calculate dynamic node width based on text content
   */
  private calculateNodeWidth(label: string): number {
    const baseWidth = this.config.nodeWidth;
    const charWidth = 8; // Approximate character width
    const padding = 20;

    const textWidth = label.length * charWidth + padding;
    return Math.max(baseWidth, Math.min(textWidth, baseWidth * 2));
  }

  /**
   * Iteration 2+: Diagram type-specific optimizations
   */
  private async optimizeForDiagramType(
    layout: DiagramLayout,
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    console.log(`[V${this.iteration}] Applying ${diagramType}-specific optimizations...`);

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
  private async advancedOptimizations(
    layout: DiagramLayout,
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    console.log(`[V${this.iteration}] Applying advanced optimizations...`);

    let optimizedLayout = { ...layout };

    // Step 1: Overlap detection and resolution
    optimizedLayout = await this.resolveNodeOverlaps(optimizedLayout);

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
   * Resolve node overlaps using repulsion forces
   */
  private async resolveNodeOverlaps(layout: DiagramLayout): Promise<DiagramLayout> {
    const nodes = [...layout.nodes];
    const maxIterations = 20;
    let hasOverlaps = true;

    for (let iteration = 0; iteration < maxIterations && hasOverlaps; iteration++) {
      hasOverlaps = false;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (this.nodesOverlap(nodes[i], nodes[j])) {
            hasOverlaps = true;
            this.applyRepulsionForce(nodes[i], nodes[j]);
          }
        }
      }
    }

    return { ...layout, nodes };
  }

  /**
   * Apply repulsion force between overlapping nodes
   */
  private applyRepulsionForce(node1: PositionedNode, node2: PositionedNode): void {
    const centerX1 = node1.x + node1.w / 2;
    const centerY1 = node1.y + node1.h / 2;
    const centerX2 = node2.x + node2.w / 2;
    const centerY2 = node2.y + node2.h / 2;

    const dx = centerX1 - centerX2;
    const dy = centerY1 - centerY2;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // Random displacement for identical positions
      node1.x += Math.random() * 20 - 10;
      node1.y += Math.random() * 20 - 10;
      return;
    }

    const repulsionStrength = 15;
    const unitX = dx / distance;
    const unitY = dy / distance;

    node1.x += unitX * repulsionStrength;
    node1.y += unitY * repulsionStrength;
    node2.x -= unitX * repulsionStrength;
    node2.y -= unitY * repulsionStrength;
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
  private async minimizeEdgeCrossings(layout: DiagramLayout): Promise<DiagramLayout> {
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

  /**
   * Calculate layout bounds
   */
  private calculateBounds(layout: DiagramLayout) {
    if (layout.nodes.length === 0) {
      return { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const xs = layout.nodes.map(n => [n.x, n.x + n.w]).flat();
    const ys = layout.nodes.map(n => [n.y, n.y + n.h]).flat();

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
      maxX,
      maxY
    };
  }

  /**
   * Evaluate layout quality
   */
  private async evaluateLayout(result: LayoutResult, diagramType: DiagramType): Promise<void> {
    const metrics = this.calculateLayoutMetrics(result.layout);

    console.log('\n📊 Layout Metrics:');
    console.log(`- Type: ${diagramType}`);
    console.log(`- Bounds: ${result.bounds.width.toFixed(0)}x${result.bounds.height.toFixed(0)}`);
    console.log(`- Node Count: ${result.layout.nodes.length}`);
    console.log(`- Edge Count: ${result.layout.edges.length}`);
    console.log(`- Overlaps: ${metrics.overlapCount}`);
    console.log(`- Processing Time: ${result.processingTime.toFixed(0)}ms`);

    const successCriteria = {
      hasNodes: result.layout.nodes.length > 0,
      noOverlaps: metrics.overlapCount === 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height,
      fastProcessing: result.processingTime < 5000
    };

    const success = Object.values(successCriteria).every(v => v);
    console.log(success ? '✅ Layout successful' : '⚠️ Layout needs improvement');

    if (!success) {
      console.log('Failed criteria:');
      Object.entries(successCriteria).forEach(([key, passed]) => {
        if (!passed) console.log(`  - ${key}: FAILED`);
      });
    }
  }

  /**
   * Calculate detailed layout metrics
   */
  private calculateLayoutMetrics(layout: DiagramLayout): LayoutMetrics {
    // Check for node overlaps
    let overlapCount = 0;
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const node1 = layout.nodes[i];
        const node2 = layout.nodes[j];

        if (this.nodesOverlap(node1, node2)) {
          overlapCount++;
        }
      }
    }

    // Calculate other metrics
    const totalArea = layout.nodes.reduce((sum, node) => sum + node.w * node.h, 0);

    return {
      overlapCount,
      edgeCrossings: 0, // TODO: Implement edge crossing detection
      totalArea,
      nodeSpacing: this.calculateAverageNodeSpacing(layout.nodes),
      layoutBalance: this.calculateLayoutBalance(layout.nodes)
    };
  }

  /**
   * Check if two nodes overlap
   */
  private nodesOverlap(node1: PositionedNode, node2: PositionedNode): boolean {
    return !(node1.x + node1.w < node2.x ||
             node2.x + node2.w < node1.x ||
             node1.y + node1.h < node2.y ||
             node2.y + node2.h < node1.y);
  }

  /**
   * Calculate average spacing between nodes
   */
  private calculateAverageNodeSpacing(nodes: PositionedNode[]): number {
    if (nodes.length < 2) return 0;

    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = (nodes[i].x + nodes[i].w / 2) - (nodes[j].x + nodes[j].w / 2);
        const dy = (nodes[i].y + nodes[i].h / 2) - (nodes[j].y + nodes[j].h / 2);
        totalDistance += Math.sqrt(dx * dx + dy * dy);
        pairCount++;
      }
    }

    return totalDistance / pairCount;
  }

  /**
   * Calculate layout balance (how evenly distributed nodes are)
   */
  private calculateLayoutBalance(nodes: PositionedNode[]): number {
    if (nodes.length === 0) return 1;

    const centerX = nodes.reduce((sum, node) => sum + node.x + node.w / 2, 0) / nodes.length;
    const centerY = nodes.reduce((sum, node) => sum + node.y + node.h / 2, 0) / nodes.length;

    const variance = nodes.reduce((sum, node) => {
      const dx = (node.x + node.w / 2) - centerX;
      const dy = (node.y + node.h / 2) - centerY;
      return sum + dx * dx + dy * dy;
    }, 0) / nodes.length;

    // Normalize variance to a 0-1 scale (higher = more balanced)
    return Math.max(0, 1 - variance / 100000);
  }

  /**
   * Method to increment iteration for testing improvements
   */
  public nextIteration(): void {
    this.iteration++;
    console.log(`🔄 Moving to layout iteration ${this.iteration}`);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📐 Layout configuration updated');
  }
}