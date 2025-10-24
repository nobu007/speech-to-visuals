import { PositionedNode, LayoutEdge, DiagramLayout } from '@/types/diagram';
import { BaseLayoutStrategy } from './LayoutStrategy';
import { LayoutConfig, LayoutResult, BoundingBox } from '../../types';

interface AnnealingNode extends PositionedNode {
  initialX: number;
  initialY: number;
  temperature: number;
}

export class SimulatedAnnealingStrategy extends BaseLayoutStrategy {
  readonly name = 'simulated-annealing';
  readonly canEscapeLocalMinimum = true;
  
  // Annealing parameters
  private initialTemperature = 10;
  private coolingRate = 0.95;
  private minTemperature = 0.1;
  private maxIterations = 1000;
  private iterationsPerTemp = 10;
  
  // Energy weights
  private overlapWeight = 2.0;
  private edgeLengthWeight = 1.0;
  private crossingWeight = 1.5;
  private balanceWeight = 0.5;
  
  // State
  private currentEnergy = Infinity;
  private bestEnergy = Infinity;
  private bestSolution: PositionedNode[] = [];
  
  async performLayout(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
    // Initialize nodes with positions from existing layout or input nodes
    const annealingNodes = this.initializeNodes(nodes, existingLayout);
    
    // Store the initial best solution
    this.bestSolution = this.cloneNodes(annealingNodes);
    this.bestEnergy = this.calculateTotalEnergy(annealingNodes, edges, config);
    this.currentEnergy = this.bestEnergy;
    
    // Run the simulated annealing algorithm
    await this.runAnnealing(annealingNodes, edges, config);
    
    // Update edge points based on final node positions
    const finalNodes = this.bestSolution.length > 0 ? this.bestSolution : annealingNodes;
    
    return {
      nodes: finalNodes,
      edges: this.updateEdgePoints(finalNodes, edges, config)
    };
  }
  
  estimateComplexity(nodeCount: number, edgeCount: number): number {
    // O(iterations * nodes * edges)
    return this.maxIterations * this.iterationsPerTemp * (nodeCount + edgeCount) * 0.5;
  }
  
  private initializeNodes(nodes: PositionedNode[], existingLayout?: DiagramLayout): AnnealingNode[] {
    if (existingLayout?.nodes?.length) {
      // Use existing node positions if available
      const nodeMap = new Map<string, PositionedNode>(existingLayout.nodes.map(n => [n.id, n]));
      return nodes.map(node => ({
        ...node,
        initialX: nodeMap.get(node.id)?.x ?? node.x ?? 0,
        initialY: nodeMap.get(node.id)?.y ?? node.y ?? 0,
        temperature: this.initialTemperature
      }));
    }
    
    // Initialize with positions from input nodes or random positions
    return nodes.map(node => ({
      ...node,
      x: node.x ?? (Math.random() * 1000 - 500),
      y: node.y ?? (Math.random() * 1000 - 500),
      initialX: node.x ?? 0,
      initialY: node.y ?? 0,
      temperature: this.initialTemperature
    }));
  }
  
  private async runAnnealing(
    nodes: AnnealingNode[],
    edges: LayoutEdge[],
    config: LayoutConfig
  ): Promise<void> {
    let temperature = this.initialTemperature;
    let iteration = 0;
    
    while (temperature > this.minTemperature && iteration < this.maxIterations) {
      // Store current state for rollback if needed
      const previousNodes = this.cloneNodes(nodes);
      const previousEnergy = this.currentEnergy;
      
      // Try several perturbations at this temperature
      let accepted = 0;
      
      for (let i = 0; i < this.iterationsPerTemp; i++) {
        const nodeIndex = Math.floor(Math.random() * nodes.length);
        const node = nodes[nodeIndex];
        
        // Store original position
        const originalX = node.x;
        const originalY = node.y;
        
        // Perturb position
        this.perturbNode(node, temperature, config);
        
        // Calculate new energy
        const newEnergy = this.calculateTotalEnergy(nodes, edges, config);
        const energyDelta = newEnergy - this.currentEnergy;
        
        // Accept or reject the move
        if (this.shouldAccept(energyDelta, temperature)) {
          this.currentEnergy = newEnergy;
          accepted++;
          
          // Update best solution if needed
          if (newEnergy < this.bestEnergy) {
            this.bestEnergy = newEnergy;
            this.bestSolution = this.cloneNodes(nodes);
            
            // Early exit if we've found a good enough solution
            if (this.bestEnergy < 0.1) {
              return;
            }
          }
        } else {
          // Revert the move
          node.x = originalX;
          node.y = originalY;
        }
      }
      
      // Cool down
      temperature *= this.coolingRate;
      
      // Update node temperatures based on acceptance rate
      const acceptanceRate = accepted / this.iterationsPerTemp;
      this.updateNodeTemperatures(nodes, acceptanceRate);
      
      iteration++;
      
      // Yield to the event loop occasionally
      if (iteration % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Early termination if we've converged
      if (this.hasConverged()) {
        break;
      }
    }
  }
  
  private perturbNode(node: AnnealingNode, temperature: number, config: LayoutConfig): void {
    // Scale perturbation by temperature and node's individual temperature
    const scale = temperature * node.temperature;
    
    // Generate random delta within bounds
    const maxDelta = Math.min(config.width, config.height) * 0.1 * scale;
    const dx = (Math.random() * 2 - 1) * maxDelta;
    const dy = (Math.random() * 2 - 1) * maxDelta;
    
    // Apply perturbation
    node.x += dx;
    node.y += dy;
    
    // Apply boundary constraints
    this.applyBoundaryConstraints(node, config);
  }
  
  private calculateTotalEnergy(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig
  ): number {
    let energy = 0;
    
    // Calculate overlap energy
    const overlapEnergy = this.calculateOverlapEnergy(nodes);
    
    // Calculate edge length energy
    const edgeEnergy = this.calculateEdgeEnergy(nodes, edges);
    
    // Calculate edge crossing energy
    const crossingEnergy = this.calculateCrossingEnergy(nodes, edges);
    
    // Calculate balance energy (how centered the layout is)
    const balanceEnergy = this.calculateBalanceEnergy(nodes, config);
    
    // Weighted sum of all energy components
    energy = this.overlapWeight * overlapEnergy +
             this.edgeLengthWeight * edgeEnergy +
             this.crossingWeight * crossingEnergy +
             this.balanceWeight * balanceEnergy;
    
    return energy;
  }
  
  private calculateOverlapEnergy(nodes: PositionedNode[]): number {
    let energy = 0;
    const nodeCount = nodes.length;
    
    for (let i = 0; i < nodeCount; i++) {
      const node1 = nodes[i];
      
      for (let j = i + 1; j < nodeCount; j++) {
        const node2 = nodes[j];
        
        // Calculate overlap area
        const overlap = this.calculateOverlap(node1, node2);
        
        if (overlap > 0) {
          // Quadratic penalty for overlaps
          energy += overlap * overlap;
        }
      }
    }
    
    return energy;
  }
  
  private calculateEdgeEnergy(nodes: PositionedNode[], edges: LayoutEdge[]): number {
    let energy = 0;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const targetLength = 150; // Ideal edge length
    
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Quadratic penalty for edge lengths different from target
        const diff = length - targetLength;
        energy += diff * diff;
      }
    }
    
    return energy / Math.max(1, edges.length);
  }
  
  private calculateCrossingEnergy(nodes: PositionedNode[], edges: LayoutEdge[]): number {
    let crossings = 0;
    const edgeArray = Array.from(edges);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Convert edges to line segments
    const segments = edgeArray
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
    
    // Quadratic penalty for crossings
    return crossings * crossings;
  }
  
  private calculateBalanceEnergy(nodes: PositionedNode[], config: LayoutConfig): number {
    if (nodes.length === 0) return 0;
    
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
    const targetX = config.width / 2;
    const targetY = config.height / 2;
    const dx = centerX - targetX;
    const dy = centerY - targetY;
    
    // Normalize by canvas size
    const normDx = dx / Math.max(1, config.width);
    const normDy = dy / Math.max(1, config.height);
    
    // Return squared distance from center (normalized)
    return (normDx * normDx + normDy * normDy) * 100;
  }
  
  private shouldAccept(energyDelta: number, temperature: number): boolean {
    // Always accept improvements
    if (energyDelta <= 0) return true;
    
    // Accept worse solutions with a probability that decreases with temperature
    const probability = Math.exp(-energyDelta / temperature);
    return Math.random() < probability;
  }
  
  private updateNodeTemperatures(nodes: AnnealingNode[], acceptanceRate: number): void {
    // Adjust individual node temperatures based on acceptance rate
    for (const node of nodes) {
      // Nodes with more rejections get higher temperatures (more exploration)
      // Nodes with more acceptances get lower temperatures (more exploitation)
      const adjustment = acceptanceRate > 0.5 ? 0.95 : 1.05;
      node.temperature = Math.max(0.1, Math.min(2.0, node.temperature * adjustment));
    }
  }
  
  private hasConverged(): boolean {
    // Consider converged if we've found a good solution
    return this.bestEnergy < 0.1;
  }
  
  private calculateOverlap(a: PositionedNode, b: PositionedNode): number {
    const aLeft = a.x - a.width / 2;
    const aRight = a.x + a.width / 2;
    const aTop = a.y - a.height / 2;
    const aBottom = a.y + a.height / 2;
    
    const bLeft = b.x - b.width / 2;
    const bRight = b.x + b.width / 2;
    const bTop = b.y - b.height / 2;
    const bBottom = b.y + b.height / 2;
    
    // Calculate overlap area
    const xOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
    const yOverlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
    
    return xOverlap * yOverlap;
  }
  
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
    
    // Check if line segments AB and CD intersect
    return (
      (ccw(A, C, D) * ccw(B, C, D) < 0) &&
      (ccw(C, A, B) * ccw(D, A, B) < 0)
    );
  }
  
  private applyBoundaryConstraints(node: PositionedNode, config: LayoutConfig): void {
    const padding = 10;
    const halfWidth = (node.width || 10) / 2;
    const halfHeight = (node.height || 10) / 2;
    
    // Keep nodes within canvas bounds with padding
    node.x = Math.max(padding + halfWidth, Math.min(config.width - padding - halfWidth, node.x));
    node.y = Math.max(padding + halfHeight, Math.min(config.height - padding - halfHeight, node.y));
  }
  
  private cloneNodes<T extends PositionedNode>(nodes: T[]): T[] {
    return nodes.map(node => ({
      ...node,
      // Create a shallow copy of the node
    } as T));
  }
  
  private updateEdgePoints(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig
  ): LayoutEdge[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    return edges.map(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      
      if (!source || !target) {
        return { ...edge, points: [] };
      }
      
      // Simple straight line for now
      return {
        ...edge,
        points: [
          { x: source.x, y: source.y },
          { x: target.x, y: target.y }
        ]
      };
    });
  }
}

export default SimulatedAnnealingStrategy;
