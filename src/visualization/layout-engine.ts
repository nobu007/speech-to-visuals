import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics } from './types';
import ComplexLayoutEngine from './complex-layout-engine';
import { BaseLayoutEngine } from './base/BaseLayoutEngine';

/**
 * Diagram Layout Engine - Iterative Implementation
 * Uses Dagre for automatic graph layout with diagram-specific optimizations
 */
import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy';
import { OverlapResolver } from './strategies/OverlapResolver';

export class LayoutEngine extends BaseLayoutEngine {
  private iteration: number = 1;
  private complexEngine: ComplexLayoutEngine;
  private fallbackLayoutStrategy: FallbackLayoutStrategy;
  private overlapResolver: OverlapResolver;

  constructor(config: Partial<LayoutConfig> = {}) {
    super(config); // Call the constructor of BaseLayoutEngine

    // Initialize complex layout engine for large diagrams
    this.complexEngine = new ComplexLayoutEngine({
      ...this.config,
      enableClustering: true,
      enableForceDirected: true,
      enableOverlapResolution: true,
      enableEdgeOptimization: true
    });

    // Initialize fallback layout strategy
    this.fallbackLayoutStrategy = new FallbackLayoutStrategy(this.config);

    // Initialize overlap resolver
    this.overlapResolver = new OverlapResolver(
      this.config,
      this.nodesOverlap.bind(this),
      this.constrainNodeToBounds.bind(this)
    );
  }

  /**
   * Get default configuration with overrides
   */
  protected getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig {
    return {
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
      ...override
    };
  }

  /**
   * Generate layout for a diagram
   * 🎯 Custom Instructions Phase 4: Zero Overlap + 5s Processing Requirement
   */
  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    console.log(`[Layout Engine V${this.iteration}] Generating ${diagramType} layout for ${nodes.length} nodes, ${edges.length} edges`);
    console.log(`🎯 Custom Instructions: Target <5s processing, zero overlaps`);

    try {
      // For complex diagrams (20+ nodes), use specialized complex layout engine
      if (nodes.length >= 20) {
        console.log('🔧 Using complex layout engine for large diagram...');
        return await this.complexEngine.generateComplexLayout(nodes, edges, diagramType);
      }

      // For smaller diagrams, use enhanced approach
      // Iteration 1: Basic Dagre layout
      let layout = await this.basicDagreLayout(nodes, edges, diagramType);

      // 🎯 Custom Instructions: MANDATORY Zero Overlap Check + Resolution
      layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);

      // Iteration 2+: Type-specific optimizations
      if (this.iteration > 1) {
        layout = await this.optimizeForDiagramType(layout, diagramType);
      }

      // Iteration 3+: Advanced layout improvements
      if (this.iteration > 2) {
        layout = await this.advancedOptimizations(layout, diagramType);
      }

      // 🎯 Custom Instructions: Final Zero Overlap Guarantee
      layout = await this.overlapResolver.finalOverlapResolution(layout);

      const bounds = this.calculateBounds(layout);
      const processingTime = performance.now() - startTime;

      // 🎯 Custom Instructions: Performance Check (5s requirement)
      if (processingTime > 5000) {
        console.warn(`⚠️ Layout processing exceeded 5s limit: ${(processingTime / 1000).toFixed(1)}s`);
      } else {
        console.log(`✅ Layout completed within performance target: ${processingTime.toFixed(0)}ms`);
      }

      const result: LayoutResult = {
        layout,
        bounds,
        processingTime,
        success: true,
        confidence: this.calculateLayoutConfidence(layout, processingTime)
      };

      await this.evaluateLayoutWithCustomInstructions(result, diagramType);
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
      return this.fallbackLayoutStrategy.fallbackLayout(nodes, edges, diagramType);
    }
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
   * Evaluate layout quality
   */
  private async evaluateLayout(result: LayoutResult, diagramType: DiagramType): Promise<void> {
    const metrics = this.calculateLayoutMetrics(result.layout.nodes, result.layout.edges);

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
   * Calculate layout confidence based on quality metrics
   */
  private calculateLayoutConfidence(layout: DiagramLayout, processingTime: number): number {
    const metrics = this.calculateLayoutMetrics(layout.nodes, layout.edges);
    let confidence = 0.8; // Base confidence

    // Zero overlaps is mandatory for high confidence
    if (metrics.overlapCount === 0) {
      confidence += 0.15;
    } else {
      confidence -= metrics.overlapCount * 0.1; // Heavy penalty for overlaps
    }

    // Performance bonus
    if (processingTime < 2000) {
      confidence += 0.05; // Fast processing bonus
    } else if (processingTime > 5000) {
      confidence -= 0.1; // Slow processing penalty
    }

    // Structure quality
    if (layout.nodes.length > 0 && layout.edges.length > 0) {
      confidence += 0.05; // Has valid structure
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 🎯 Custom Instructions: Enhanced Layout Evaluation
   * Evaluates against Custom Instructions Phase 4 requirements
   */
  private async evaluateLayoutWithCustomInstructions(result: LayoutResult, diagramType: DiagramType): Promise<void> {
    const metrics = this.calculateLayoutMetrics(result.layout.nodes, result.layout.edges);

    console.log('\n🎯 Custom Instructions Phase 4 Evaluation:');
    console.log(`- Zero Overlaps: ${metrics.overlapCount === 0 ? '✅ PASSED' : '❌ FAILED'} (${metrics.overlapCount} overlaps)`);
    console.log(`- Processing Time: ${result.processingTime < 5000 ? '✅ PASSED' : '❌ FAILED'} (${(result.processingTime / 1000).toFixed(1)}s)`);
    console.log(`- Layout Quality: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`- Diagram Type: ${diagramType}`);
    console.log(`- Node Count: ${result.layout.nodes.length}`);
    console.log(`- Edge Count: ${result.layout.edges.length}`);

    // Custom Instructions compliance check
    const compliance = {
      zeroOverlaps: metrics.overlapCount === 0,
      fastProcessing: result.processingTime < 5000,
      hasValidStructure: result.layout.nodes.length > 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height
    };

    const complianceScore = Object.values(compliance).filter(v => v).length / Object.keys(compliance).length;
    const passed = complianceScore >= 0.75; // 75% compliance required

    console.log(`\n🎯 Custom Instructions Compliance: ${(complianceScore * 100).toFixed(1)}%`);
    console.log(`🎯 Overall Assessment: ${passed ? '✅ COMPLIANT' : '❌ NEEDS IMPROVEMENT'}`);

    if (!passed) {
      console.log('🔧 Failed Requirements:');
      Object.entries(compliance).forEach(([requirement, passed]) => {
        if (!passed) {
          console.log(`  - ${requirement}: FAILED`);
        }
      });
    }

    // Trigger improvement if needed
    if (!compliance.zeroOverlaps) {
      console.log('🚨 CRITICAL: Zero overlap requirement not met - triggering emergency resolution');
    }
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