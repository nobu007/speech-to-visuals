import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics } from './types';
import ComplexLayoutEngine from './complex-layout-engine';
import { BaseLayoutEngine } from './base/BaseLayoutEngine';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
  DEFAULT_MARGIN,
} from './layout-spacing';

/**
 * Diagram Layout Engine - Iterative Implementation
 * Uses Dagre for automatic graph layout with diagram-specific optimizations
 */
import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy';
import { OverlapResolver } from './strategies/OverlapResolver';
import { LayoutOptimizer } from './strategies/LayoutOptimizer';
import { LayoutEvaluator } from './strategies/LayoutEvaluator';
import { DagreLayoutStrategy } from './strategies/DagreLayoutStrategy'; // Added
import { LayoutOptimizationPipeline } from './strategies/LayoutOptimizationPipeline';
import { getGraphConfig } from './layout-utils';

export class LayoutEngine extends BaseLayoutEngine {
  private complexEngine?: ComplexLayoutEngine;
  private fallbackLayoutStrategy: FallbackLayoutStrategy;
  private dagreLayoutStrategy: DagreLayoutStrategy;
  private overlapResolver: OverlapResolver;
  private layoutOptimizer?: LayoutOptimizer;
  private layoutEvaluator: LayoutEvaluator;
  private layoutOptimizationPipeline: LayoutOptimizationPipeline; // Added
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

    // Initialize layout optimizer
    this.layoutOptimizer = new LayoutOptimizer(this.config);

    // Initialize layout evaluator
    this.layoutEvaluator = new LayoutEvaluator(
      this.config
    );

    // Initialize layout optimization pipeline
    this.layoutOptimizationPipeline = new LayoutOptimizationPipeline(this.layoutOptimizer);

    this._manageComplexEngine();
  }

  /**
   * Get default configuration with overrides
   */
  protected getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig {
    return {
      width: 1920,
      height: 1080,
      nodeWidth: DEFAULT_NODE_WIDTH,
      nodeHeight: DEFAULT_NODE_HEIGHT,
      marginX: DEFAULT_MARGIN,
      marginY: DEFAULT_MARGIN,
      rankDirection: 'TB',
      nodeSeparation: DEFAULT_NODE_SEPARATION,
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      rankSeparation: DEFAULT_RANK_SEPARATION,
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
        return await this._handleSimpleModeLayout(nodes, edges, diagramType, startTime);
      }

      if (nodes.length >= 20) {
        this.logger.info('🔧 Using complex layout engine for large diagram...');
        // Safely check if complexEngine is initialized
        if (this.complexEngine) {
          const complexResult = await this.complexEngine.generateComplexLayout(nodes, edges, diagramType);
          // ComplexLayoutEngine bypasses _logAndEvaluateLayout and never sets
          // `confidence` (the canonical path sets it via calculateLayoutConfidence).
          // Route its result through the same evaluation so large diagrams get a
          // real, quality-derived confidence — otherwise SimplePipeline consumers
          // default-mask the missing field (constant 0.8 layout quality,
          // scene.confidence never lowered). Same DROPS class as e0f269af.
          return complexResult.success
            ? this._evaluateLayoutResult(complexResult, diagramType)
            : complexResult;
        } else {
          // Fallback to simple mode if complexEngine is not initialized (e.g., in simple mode)
          this.logger.warn('Complex engine not initialized, falling back to simple mode layout.');
          return await this._handleSimpleModeLayout(nodes, edges, diagramType, startTime);
        }
      }

      // For smaller diagrams, use enhanced approach
      const layout = await this._applyBasicLayoutAndOptimizations(nodes, edges, diagramType, iteration); // Pass iteration

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
   * Applies initial Dagre layout and resolves overlaps.
   */
  private async _applyInitialLayoutAndOverlapResolution(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {
    const initialLayout = await this.dagreLayoutStrategy.applyLayout(nodes, edges, diagramType);
    return await this.overlapResolver.ensureZeroOverlaps(initialLayout, diagramType);
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
    const layoutAfterOverlapResolution = await this._applyInitialLayoutAndOverlapResolution(nodes, edges, diagramType);

    // Iteration 2+: Apply optimizations via pipeline
    const layoutAfterOptimizations = await this.layoutOptimizationPipeline.applyOptimizations(layoutAfterOverlapResolution, diagramType, iteration);

    // 🎯 Custom Instructions: Final Zero Overlap Guarantee
    const finalLayout = await this.overlapResolver.finalOverlapResolution(layoutAfterOptimizations);

    return finalLayout;
  }

  /**
   * Logs performance metrics and evaluates the layout.
   */
  private async _logAndEvaluateLayout(
    layout: DiagramLayout,
    startTime: number,
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const bounds = this.calculateBounds(layout.nodes);
    const processingTime = performance.now() - startTime;

    // 🎯 Custom Instructions: Performance Check (5s requirement)
    if (processingTime > 5000) {
      this.logger.warn(`⚠️ Layout processing exceeded 5s limit: ${(processingTime / 1000).toFixed(1)}s`);
    } else {
      this.logger.info(`✅ Layout completed within performance target: ${processingTime.toFixed(0)}ms`);
    }

    return this._evaluateLayoutResult(
      { layout, bounds, processingTime, success: true },
      diagramType
    );
  }

  /**
   * Attach the layout confidence + Custom-Instructions compliance evaluation to
   * a LayoutResult. Single source for BOTH layout paths: the standard path (via
   * _logAndEvaluateLayout) and the complex path (>=20-node diagrams routed to
   * ComplexLayoutEngine, which returns a result without `confidence`). Keeps the
   * confidence + compliance contract identical across paths so neither can
   * silently drop the layout-quality metric.
   */
  private async _evaluateLayoutResult(
    result: LayoutResult,
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const evaluated: LayoutResult = {
      ...result,
      confidence: this.layoutEvaluator.calculateLayoutConfidence(result.layout, result.processingTime),
    };

    // 🎯 Custom Instructions: compliance evaluation (Phase 4 requirements).
    // Previously awaited as a fire-and-forget void; the evaluator now returns the
    // compliance result so failures (overlaps, out-of-bounds, slow, empty) are
    // surfaced instead of silently dropped.
    const compliance = await this.layoutEvaluator.evaluateLayoutWithCustomInstructions(evaluated, diagramType);
    if (!compliance.passed) {
      this.logger.warn(
        `⚠️ Layout compliance check failed (score ${compliance.complianceScore.toFixed(2)}): ${compliance.failures.join(', ') || 'unknown criteria'}`
      );
    }
    return evaluated;
  }




























  private async _handleSimpleModeLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType,
    startTime: number
  ): Promise<LayoutResult> {
    this.logger.info('🔧 Using simple layout mode...');
    const layout = await this._applyInitialLayoutAndOverlapResolution(nodes, edges, diagramType);
    const bounds = this.calculateBounds(layout.nodes);
    const processingTime = performance.now() - startTime;
    return {
      layout,
      bounds,
      processingTime,
      success: true,
      confidence: 1.0 // Simple mode assumes high confidence for basic layout
    };
  }

  /**
   * Manages the initialization or disposal of the complexEngine based on the current config.isSimpleMode.
   */
  private _manageComplexEngine(): void {
    if (!this.config.isSimpleMode) {
      if (!this.complexEngine) {
        this.complexEngine = new ComplexLayoutEngine({
          ...this.config,
          enableClustering: true,
          enableForceDirected: true,
          enableOverlapResolution: true,
          enableEdgeOptimization: true
        }, this.overlapResolver, this.layoutOptimizer, this.dagreLayoutStrategy);
        this.logger.info('🔧 Complex layout engine initialized.');
      }
    } else {
      if (this.complexEngine) {
        this.complexEngine = undefined;
        this.logger.info('🔧 Complex layout engine disposed.');
      }
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LayoutConfig>): void {
    const oldIsSimpleMode = this.config.isSimpleMode;
    // Mutate `this.config` IN PLACE rather than reassigning a new object.
    // Every construction-once sub-strategy (dagre, fallback, overlap resolver,
    // optimizer, evaluator) captured the `this.config` reference handed to it
    // in the constructor and reads nodeWidth/nodeHeight/width/height/margins
    // from THAT object at GENERATION time. A spread reassignment
    // (`{ ...this.config, ...newConfig }`) broke the shared reference and left
    // every sub-strategy holding the stale original — so layout config pushed
    // here by the pipeline's `applyConfigToCollaborators` helper (user
    // `PipelineConfig.layout` overrides and auto-tuner values) updated
    // `getConfig()` (which reads `this.config` directly) but never reached
    // `dagreLayoutStrategy.applyLayout`, a silent no-op (REQ-051).
    // `this.config` is engine-owned (created fresh by getDefaultConfig;
    // getConfig() returns a copy), so in-place mutation is safe and keeps the
    // shared reference live for all sub-strategies at once.
    Object.assign(this.config, newConfig);
    this.logger.info('📐 Layout configuration updated');

    // Dynamically manage complexEngine based on isSimpleMode change
    this._manageComplexEngine();
  }
}
