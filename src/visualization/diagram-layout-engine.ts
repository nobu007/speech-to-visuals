/**
 * 🎨 Diagram Layout Engine
 * Simplified interface to the main LayoutEngine
 * Provides diagram-specific layout generation with zero-overlap guarantee
 */

import { LayoutEngine } from './layout-engine';
import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutConfig, LayoutResult } from './types';

export class DiagramLayoutEngine {
  private layoutEngine: LayoutEngine;
  private config: LayoutConfig;

  constructor(config?: Partial<LayoutConfig>) {
    this.config = {
      width: 1920,
      height: 1080,
      nodeWidth: 140,
      nodeHeight: 70,
      marginX: 60,
      marginY: 60,
      rankDirection: 'TB',
      nodeSeparation: 50,
      edgeSeparation: 15,
      rankSeparation: 60,
      ...config
    };

    this.layoutEngine = new LayoutEngine(this.config);
  }

  /**
   * Generate optimized layout for any diagram type
   */
  async generate(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    type: DiagramType = 'flow'
  ): Promise<LayoutResult> {
    console.log(`[DiagramLayoutEngine] Generating ${type} layout for ${nodes.length} nodes`);

    const startTime = performance.now();

    try {
      // Delegate to the main layout engine
      const result = await this.layoutEngine.generateLayout(nodes, edges, type);

      const duration = performance.now() - startTime;
      console.log(`[DiagramLayoutEngine] Layout generated in ${duration.toFixed(0)}ms`);

      return result;

    } catch (error) {
      console.error('[DiagramLayoutEngine] Generation failed:', error);

      return {
        layout: { nodes: [], edges: [] },
        bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
        processingTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Quick layout generation for simple diagrams
   */
  async generateQuick(nodes: NodeDatum[], edges: EdgeDatum[]): Promise<LayoutResult> {
    console.log('[DiagramLayoutEngine] Quick layout generation');

    // Infer diagram type from structure
    const type = this.inferDiagramType(nodes, edges);

    return this.generate(nodes, edges, type);
  }

  /**
   * Infer diagram type from structure
   */
  private inferDiagramType(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramType {
    if (nodes.length === 0) return 'flow';

    // Check for hierarchical structure (tree)
    const hasRoot = edges.some(e => !edges.some(e2 => e2.to === e.from));
    const hasLeaves = edges.some(e => !edges.some(e2 => e2.from === e.to));
    if (hasRoot && hasLeaves) return 'tree';

    // Check for cyclic structure
    const hasCycles = this.detectCycles(nodes, edges);
    if (hasCycles) return 'cycle';

    // Check for linear progression (timeline)
    const isLinear = edges.length === nodes.length - 1 && this.isLinearGraph(edges);
    if (isLinear) return 'timeline';

    // Default to flow diagram
    return 'flow';
  }

  /**
   * Detect cycles in the graph
   */
  private detectCycles(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = edges.filter(e => e.from === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.to)) {
          if (dfs(edge.to)) return true;
        } else if (recursionStack.has(edge.to)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Check if graph is linear (no branching)
   */
  private isLinearGraph(edges: EdgeDatum[]): boolean {
    // Count outgoing edges for each node
    const outDegree = new Map<string, number>();

    edges.forEach(edge => {
      outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
    });

    // Linear if no node has more than 1 outgoing edge
    return Array.from(outDegree.values()).every(degree => degree <= 1);
  }

  /**
   * Update layout configuration
   */
  updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.layoutEngine.updateConfig(newConfig);
    console.log('[DiagramLayoutEngine] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): LayoutConfig {
    return { ...this.config };
  }
}

export default DiagramLayoutEngine;
