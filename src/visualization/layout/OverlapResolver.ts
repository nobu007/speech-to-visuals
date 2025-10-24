import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge, DiagramLayout } from '@/types/diagram';
import { LayoutStrategy, BaseLayoutStrategy } from './strategies/LayoutStrategy';
import ProgressiveForceStrategy from './strategies/ProgressiveForceStrategy';
import SimulatedAnnealingStrategy from './strategies/SimulatedAnnealingStrategy';
import GridSnapStrategy from './strategies/GridSnapStrategy';
import { LayoutConfig, LayoutResult, LayoutMetrics } from '../types';

export class OverlapResolver {
  private strategies: LayoutStrategy[] = [];
  private currentStrategyIndex: number = 0;
  private currentStrategy: LayoutStrategy | null = null;
  private metrics: LayoutMetrics[] = [];
  private startTime: number = 0;
  
  // Configuration
  private maxTimePerStrategy: number = 2000; // 2 seconds per strategy
  private maxTotalTime: number = 5000; // 5 seconds total
  private minImprovement: number = 0.1; // 10% improvement required to continue
  
  constructor() {
    // Initialize strategies in order of preference
    this.strategies = [
      new ProgressiveForceStrategy(),
      new SimulatedAnnealingStrategy(),
      new GridSnapStrategy()
    ];
  }
  
  /**
   * Resolve overlaps using the best available strategy
   */
  async resolve(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<LayoutResult> {
    this.startTime = performance.now();
    this.metrics = [];
    this.currentStrategyIndex = 0;
    
    // If we have an existing layout with nodes, use it as a starting point
    let currentNodes = this.initializeNodes(nodes, existingLayout);
    let currentEdges = this.initializeEdges(edges, currentNodes);
    
    let bestResult: LayoutResult | null = null;
    let bestEnergy = Infinity;
    
    // Try each strategy in sequence until we find a good solution or run out of time
    while (this.currentStrategyIndex < this.strategies.length && !this.isTimeout()) {
      const strategy = this.strategies[this.currentStrategyIndex];
      this.currentStrategy = strategy;
      
      console.log(`Trying strategy: ${strategy.name}`);
      
      try {
        // Apply the current strategy with a time limit
        const strategyResult = await this.applyStrategyWithTimeout(
          strategy,
          currentNodes,
          currentEdges,
          config,
          existingLayout
        );
        
        // Calculate metrics for this strategy
        const metrics = this.calculateMetrics(strategyResult);
        this.metrics.push(metrics);
        
        // Update current nodes and edges for the next strategy
        currentNodes = strategyResult.layout.nodes;
        currentEdges = strategyResult.layout.edges;
        
        // Check if this is the best solution so far
        const currentEnergy = this.calculateEnergy(metrics);
        
        if (currentEnergy < bestEnergy * (1 - this.minImprovement)) {
          bestEnergy = currentEnergy;
          bestResult = strategyResult;
          
          // If we have no overlaps and good edge lengths, we're done
          if (metrics.overlapCount === 0 && metrics.edgeCrossings < currentNodes.length / 2) {
            console.log('Found good solution, early termination');
            break;
          }
        }
        
        // If this strategy didn't help much, move to the next one
        if (currentEnergy > bestEnergy * 0.9) {
          this.currentStrategyIndex++;
        }
        
      } catch (error) {
        console.error(`Error in strategy ${strategy.name}:`, error);
        this.currentStrategyIndex++;
      }
    }
    
    // If we didn't find a good solution, use the best one we have
    if (!bestResult) {
      console.warn('No valid layout found, using fallback');
      bestResult = {
        layout: {
          nodes: currentNodes,
          edges: currentEdges
        },
        bounds: this.calculateBounds(currentNodes),
        processingTime: performance.now() - this.startTime,
        success: false,
        error: 'No valid layout found'
      };
    }
    
    // Ensure we have no overlaps (fallback to grid if needed)
    if (this.metrics.some(m => m.overlapCount > 0)) {
      console.log('Falling back to grid layout to remove overlaps');
      const gridStrategy = new GridSnapStrategy();
      const fallbackEdges = bestResult.layout.edges.map(e => ({
        id: e.id as string,
        from: (e as any).from ?? e.source!,
        to: (e as any).to ?? e.target!,
        label: (e as any).label,
      }));
      bestResult = await gridStrategy.apply(
        bestResult.layout.nodes as any,
        fallbackEdges as any,
        config,
        bestResult.layout
      );
    }
    
    return {
      ...bestResult,
      metrics: this.aggregateMetrics()
    };
  }
  
  /**
   * Apply a strategy with a time limit
   */
  private async applyStrategyWithTimeout(
    strategy: LayoutStrategy,
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    const timeout = Math.min(
      this.maxTimePerStrategy,
      this.maxTotalTime - (performance.now() - this.startTime)
    );
    
    if (timeout <= 0) {
      throw new Error('Out of time');
    }
    
    // Create a promise that will reject after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Strategy ${strategy.name} timed out after ${timeout}ms`));
      }, timeout);
    });
    
    // Race the strategy against the timeout
    return Promise.race([
      strategy.apply(nodes as any, edges as any, config, existingLayout),
      timeoutPromise
    ]);
  }
  
  /**
   * Initialize nodes with positions from existing layout if available
   */
  private initializeNodes(nodes: NodeDatum[], existingLayout?: DiagramLayout): PositionedNode[] {
    if (!existingLayout?.nodes?.length) {
      return nodes.map(node => ({
        ...node,
        x: Math.random() * 1000 - 500,
        y: Math.random() * 1000 - 500,
        width: node.width || 100,
        height: node.height || 50
      }));
    }
    
    // Create a map of existing node positions
    const nodeMap = new Map(existingLayout.nodes.map(n => [n.id, n]));
    
    return nodes.map(node => {
      const existingNode = nodeMap.get(node.id);
      
      return {
        ...node,
        x: existingNode?.x ?? Math.random() * 1000 - 500,
        y: existingNode?.y ?? Math.random() * 1000 - 500,
        width: node.width || existingNode?.width || 100,
        height: node.height || existingNode?.height || 50
      };
    });
  }
  
  /**
   * Initialize edges with references to nodes
   */
  private initializeEdges(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
    const nodeIds = new Set(nodes.map(n => n.id));
    
    return edges
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(edge => ({
        ...edge,
        points: []
      }));
  }
  
  /**
   * Calculate metrics for a layout result
   */
  private calculateMetrics(result: LayoutResult): LayoutMetrics {
    const { nodes, edges } = result.layout;
    
    // Calculate overlap count
    const overlapCount = this.countOverlaps(nodes);
    
    // Calculate edge crossings
    const edgeCrossings = this.countEdgeCrossings(nodes, edges);
    
    // Calculate total area
    const totalArea = this.calculateTotalArea(nodes);
    
    // Calculate node spacing
    const nodeSpacing = this.calculateNodeSpacing(nodes);
    
    // Calculate layout balance
    const layoutBalance = this.calculateLayoutBalance(nodes, result.bounds);
    
    return {
      overlapCount,
      edgeCrossings,
      totalArea,
      nodeSpacing,
      layoutBalance
    };
  }
  
  /**
   * Count the number of overlapping node pairs
   */
  private countOverlaps(nodes: PositionedNode[]): number {
    let count = 0;
    
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        
        if (this.nodesOverlap(a, b)) {
          count++;
        }
      }
    }
    
    return count;
  }
  
  /**
   * Check if two nodes overlap
   */
  private nodesOverlap(a: PositionedNode, b: PositionedNode): boolean {
    return !(
      a.x + a.width / 2 < b.x - b.width / 2 ||
      a.x - a.width / 2 > b.x + b.width / 2 ||
      a.y + a.height / 2 < b.y - b.height / 2 ||
      a.y - a.height / 2 > b.y + b.height / 2
    );
  }
  
  /**
   * Count the number of edge crossings
   */
  private countEdgeCrossings(nodes: PositionedNode[], edges: LayoutEdge[]): number {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let crossings = 0;
    
    // Convert edges to line segments
    const segments = edges
      .map(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        return source && target ? { source, target } : null;
      })
      .filter((segment): segment is { source: PositionedNode; target: PositionedNode } => segment !== null);
    
    // Check all pairs of edges for crossings
    for (let i = 0; i < segments.length; i++) {
      const a = segments[i];
      
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j];
        
        // Skip if edges share a node
        if (a.source === b.source || a.source === b.target ||
            a.target === b.source || a.target === b.target) {
          continue;
        }
        
        // Check for intersection
        if (this.segmentsIntersect(a, b)) {
          crossings++;
        }
      }
    }
    
    return crossings;
  }
  
  /**
   * Check if two line segments intersect
   */
  private segmentsIntersect(
    a: { source: PositionedNode; target: PositionedNode },
    b: { source: PositionedNode; target: PositionedNode }
  ): boolean {
    const ccw = (A: PositionedNode, B: PositionedNode, C: PositionedNode): number => {
      return (C.y - A.y) * (B.x - A.x) - (B.y - A.y) * (C.x - A.x);
    };
    
    const A = a.source;
    const B = a.target;
    const C = b.source;
    const D = b.target;
    
    return (
      (ccw(A, C, D) * ccw(B, C, D) < 0) &&
      (ccw(C, A, B) * ccw(D, A, B) < 0)
    );
  }
  
  /**
   * Calculate the total area covered by nodes
   */
  private calculateTotalArea(nodes: PositionedNode[]): number {
    if (nodes.length === 0) return 0;
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.width / 2);
      minY = Math.min(minY, node.y - node.height / 2);
      maxX = Math.max(maxX, node.x + node.width / 2);
      maxY = Math.max(maxY, node.y + node.height / 2);
    }
    
    return (maxX - minX) * (maxY - minY);
  }
  
  /**
   * Calculate the minimum distance between any two nodes
   */
  private calculateNodeSpacing(nodes: PositionedNode[]): number {
    if (nodes.length < 2) return 0;
    
    let minDistance = Infinity;
    
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        minDistance = Math.min(minDistance, distance);
      }
    }
    
    return minDistance;
  }
  
  /**
   * Calculate how balanced the layout is (0 to 1, higher is better)
   */
  private calculateLayoutBalance(nodes: PositionedNode[], bounds: { width: number; height: number }): number {
    if (nodes.length === 0) return 1;
    
    // Calculate center of mass
    let sumX = 0;
    let sumY = 0;
    
    for (const node of nodes) {
      sumX += node.x;
      sumY += node.y;
    }
    
    const centerX = sumX / nodes.length;
    const centerY = sumY / nodes.length;
    
    // Calculate distance from center
    const targetX = bounds.width / 2;
    const targetY = bounds.height / 2;
    const dx = (centerX - targetX) / targetX;
    const dy = (centerY - targetY) / targetY;
    
    // Calculate balance (1 - normalized distance from center)
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance);
  }
  
  /**
   * Calculate the total energy of a layout (lower is better)
   */
  private calculateEnergy(metrics: LayoutMetrics): number {
    // Weights for different components of the energy function
    const weights = {
      overlap: 10,
      crossing: 5,
      area: 0.001,
      spacing: -0.1, // Negative because we want to maximize spacing
      balance: -2    // Negative because we want to maximize balance
    };
    
    return (
      weights.overlap * metrics.overlapCount +
      weights.crossing * metrics.edgeCrossings +
      weights.area * metrics.totalArea +
      weights.spacing * metrics.nodeSpacing +
      weights.balance * metrics.layoutBalance
    );
  }
  
  /**
   * Calculate the bounding box of all nodes
   */
  private calculateBounds(nodes: PositionedNode[]): { width: number; height: number; minX: number; minY: number; maxX: number; maxY: number } {
    if (nodes.length === 0) {
      return { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.width / 2);
      minY = Math.min(minY, node.y - node.height / 2);
      maxX = Math.max(maxX, node.x + node.width / 2);
      maxY = Math.max(maxY, node.y + node.height / 2);
    }
    
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
   * Aggregate metrics from all strategies
   */
  private aggregateMetrics(): LayoutMetrics {
    if (this.metrics.length === 0) {
      return {
        overlapCount: 0,
        edgeCrossings: 0,
        totalArea: 0,
        nodeSpacing: 0,
        layoutBalance: 0
      };
    }
    
    // Return the metrics from the best strategy (lowest energy)
    let bestMetrics = this.metrics[0];
    let bestEnergy = this.calculateEnergy(bestMetrics);
    
    for (let i = 1; i < this.metrics.length; i++) {
      const energy = this.calculateEnergy(this.metrics[i]);
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestMetrics = this.metrics[i];
      }
    }
    
    return bestMetrics;
  }
  
  /**
   * Check if we've run out of time
   */
  private isTimeout(): boolean {
    return performance.now() - this.startTime >= this.maxTotalTime;
  }
}

export default OverlapResolver;
