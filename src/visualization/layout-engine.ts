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
import { DagreLayoutStrategy } from './strategies/DagreLayoutStrategy'; // Added
import { getGraphConfig } from './layout-utils';

export class LayoutEngine extends BaseLayoutEngine {
  private complexEngine?: ComplexLayoutEngine;
  private fallbackLayoutStrategy: FallbackLayoutStrategy;
  private dagreLayoutStrategy: DagreLayoutStrategy;
  private overlapResolver: OverlapResolver;
  private layoutOptimizer?: LayoutOptimizer;
  private layoutEvaluator?: LayoutEvaluator;
  constructor(config: Partial<LayoutConfig> = {}) {
    super(config); // Call the constructor of BaseLayoutEngine

    // Initialize fallback layout strategy
    this.fallbackLayoutStrategy = new FallbackLayoutStrategy(this.config);

    // Initialize Dagre layout strategy
    this.dagreLayoutStrategy = new DagreLayoutStrategy(this.config, this.fallbackLayoutStrategy); // Added

    // Initialize overlap resolver
    this.overlapResolver = new OverlapResolver(
      this.config
    );

    if (!this.config.isSimpleMode) {
      // Initialize complex layout engine for large diagrams
      this.complexEngine = new ComplexLayoutEngine({
        ...this.config,
        enableClustering: true,
        enableForceDirected: true,
        enableOverlapResolution: true,
        enableEdgeOptimization: true
      }, this.overlapResolver, this.layoutOptimizer);

      // Initialize layout optimizer
      this.layoutOptimizer = new LayoutOptimizer(this.config);

      // Initialize layout evaluator
      this.layoutEvaluator = new LayoutEvaluator(
        this.config
      );
    }
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
    diagramType: DiagramType,
    iteration: number // Added iteration parameter
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    this.logger.info(`[Layout Engine V${iteration}] Generating ${diagramType} layout for ${nodes.length} nodes, ${edges.length} edges`);
    this.logger.info(`🎯 Custom Instructions: Target <5s processing, zero overlaps`);

    try {
      if (this.config.isSimpleMode) {
        this.logger.info('🔧 Using simple layout mode...');
        let layout = await this.dagreLayoutStrategy.applyLayout(nodes, edges, diagramType);
        layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);
        const bounds = this.calculateBounds(layout);
        const processingTime = performance.now() - startTime;
        return {
          layout,
          bounds,
          processingTime,
          success: true,
          confidence: 1.0 // Simple mode assumes high confidence for basic layout
        };
      }

      if (nodes.length >= 20) {
        this.logger.info('🔧 Using complex layout engine for large diagram...');
        return await this.complexEngine!.generateComplexLayout(nodes, edges, diagramType);
      }

      // For smaller diagrams, use enhanced approach
      let layout = await this._applyBasicLayoutAndOptimizations(nodes, edges, diagramType, iteration); // Pass iteration

      return await this._logAndEvaluateLayout(layout, startTime, diagramType);

    } catch (error) {
      this.logger.error('[Layout Engine] Error:', error);
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
   * Applies basic Dagre layout, overlap resolution, and type-specific optimizations.
   */
  private async _applyBasicLayoutAndOptimizations(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType,
    iteration: number // Added iteration parameter
  ): Promise<DiagramLayout> {
    // Iteration 1: Basic Dagre layout
    let layout = await this.dagreLayoutStrategy.applyLayout(nodes, edges, diagramType); // Updated

    // 🎯 Custom Instructions: MANDATORY Zero Overlap Check + Resolution
    layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);

    // Iteration 2+: Type-specific optimizations
    if (iteration > 1) {
      layout = await this.layoutOptimizer.optimizeForDiagramType(layout, diagramType);
    }

    // Iteration 3+: Advanced layout improvements
    if (iteration > 2) {
      layout = await this.layoutOptimizer.advancedOptimizations(layout, diagramType);
    }

    // 🎯 Custom Instructions: Final Zero Overlap Guarantee
    layout = await this.overlapResolver.finalOverlapResolution(layout);

    return layout;
  }

  /**
   * Logs performance metrics and evaluates the layout.
   */
  private async _logAndEvaluateLayout(
    layout: DiagramLayout,
    startTime: number,
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const bounds = this.calculateBounds(layout);
    const processingTime = performance.now() - startTime;

    // 🎯 Custom Instructions: Performance Check (5s requirement)
    if (processingTime > 5000) {
      this.logger.warn(`⚠️ Layout processing exceeded 5s limit: ${(processingTime / 1000).toFixed(1)}s`);
    } else {
      this.logger.info(`✅ Layout completed within performance target: ${processingTime.toFixed(0)}ms`);
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
  }




























  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('📐 Layout configuration updated');
  }
}