/**
 * Simple Layout Engine for Diagrams
 * MVP implementation following custom instructions
 * 🔄 Focus: 確実に動作する最小実装
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { BaseLayoutEngine } from './base/BaseLayoutEngine';
import { LayoutConfig, LayoutResult } from './types';
import { DagreLayoutStrategy } from './strategies/DagreLayoutStrategy';
import { OverlapResolver } from './strategies/OverlapResolver';
import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy';

/**
 * Simple deterministic layout engine
 * MVP: Predictable layouts, no complex algorithms
 */
export class SimpleLayoutEngine extends BaseLayoutEngine {
  private dagreLayoutStrategy: DagreLayoutStrategy;
  private overlapResolver: OverlapResolver;

  constructor(config: Partial<LayoutConfig> = {}) {
    super(config);

    // Initialize fallback layout strategy (can be a simple one for this engine)
    const fallbackLayoutStrategy = new FallbackLayoutStrategy(this.config);

    // Initialize Dagre layout strategy
    this.dagreLayoutStrategy = new DagreLayoutStrategy(this.config, fallbackLayoutStrategy);

    // Initialize overlap resolver
    this.overlapResolver = new OverlapResolver(this.config);
  }

  protected getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig {
    const defaultConfig: LayoutConfig = {
      width: 1920,
      height: 1080,
      nodeWidth: 160,
      nodeHeight: 80,
      nodeSeparation: 120,
      marginX: 100,
      marginY: 100,
      rankDirection: 'TB',
      edgeSeparation: 30,
      rankSeparation: 50,
    };
    return { ...defaultConfig, ...override };
  }

  /**
   * Generate layout based on diagram type using Dagre and OverlapResolver
   */
  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    this.logger.info(`🎨 Generating ${diagramType} layout for ${nodes.length} nodes...`);

    try {
      // Apply basic Dagre layout
      let layout = await this.dagreLayoutStrategy.applyLayout(nodes, edges, diagramType);

      // Ensure zero overlaps
      layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);

      // Generate edges using BaseLayoutEngine's method
      const layoutEdges = this.generateAllEdges(edges, layout.nodes);

      const endTime = performance.now();
      const processingTime = endTime - startTime; // Convert to milliseconds

      const bounds = this.calculateBounds(layout.nodes);
      const metrics = this.calculateLayoutMetrics(layout.nodes, layoutEdges);
      const confidence = this.calculateConfidence(metrics, processingTime);

      const result: LayoutResult = {
        layout: { nodes: layout.nodes, edges: layoutEdges },
        bounds: bounds,
        processingTime: processingTime,
        success: true,
        confidence: confidence
      };

      this.logLayoutEvaluation(diagramType, result);
      return result;

    } catch (error) {
      this.logger.error('❌ Layout generation failed:', error);
      return this.createErrorResult(error);
    }
  }}

export const simpleLayoutEngine = new SimpleLayoutEngine();