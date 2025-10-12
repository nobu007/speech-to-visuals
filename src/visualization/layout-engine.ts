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
import { LayoutOptimizer } from './strategies/LayoutOptimizer';
import { LayoutEvaluator } from './strategies/LayoutEvaluator';

export class LayoutEngine extends BaseLayoutEngine {
  private iteration: number = 1;
  private complexEngine: ComplexLayoutEngine;
  private fallbackLayoutStrategy: FallbackLayoutStrategy;
  private overlapResolver: OverlapResolver;
  private layoutOptimizer: LayoutOptimizer;
  private layoutEvaluator: LayoutEvaluator;

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
      this.config
    );

    // Initialize layout optimizer
    this.layoutOptimizer = new LayoutOptimizer(this.config);

    // Initialize layout evaluator
    this.layoutEvaluator = new LayoutEvaluator(
      this.config,
      this.calculateLayoutMetrics.bind(this)
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
        layout = await this.layoutOptimizer.optimizeForDiagramType(layout, diagramType);
      }

      // Iteration 3+: Advanced layout improvements
      if (this.iteration > 2) {
        layout = await this.layoutOptimizer.advancedOptimizations(layout, diagramType);
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
        confidence: this.layoutEvaluator.calculateLayoutConfidence(layout, processingTime)
      };

      await this.layoutEvaluator.evaluateLayoutWithCustomInstructions(result, diagramType);
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
          width: this.calculateNodeWidth(node),
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