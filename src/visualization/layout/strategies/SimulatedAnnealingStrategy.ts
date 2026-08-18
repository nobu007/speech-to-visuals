import { PositionedNode, LayoutEdge, DiagramLayout } from '@stv/core/types/diagram';
import { BaseLayoutStrategy } from './LayoutStrategy';
import { LayoutConfig, LayoutResult, BoundingBox } from '../../types';
import { createLayoutRng } from '../../layout-rng';
import { getNodeWidth, getNodeHeight } from '../../node-dimensions';
import { distance } from '../../layout-utils';
import { repointEdgesStraightLine } from '../../edge-repointing';
import { countEdgeCrossings } from '../edge-crossings';

/** Get effective node width (handles both `w` and `width` properties, consistent with other layout modules) */
function effWidth(node: PositionedNode): number {
  return getNodeWidth(node);
}

/** Get effective node height (handles both `h` and `height` properties, consistent with other layout modules) */
function effHeight(node: PositionedNode): number {
  return getNodeHeight(node);
}

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
    // Seeded per-generate (round 17): ALL stochastic draws in this strategy —
    // initial placement, node selection, perturbation and the Metropolis
    // acceptance draw — share ONE stream. Partial seeding is forbidden: the
    // acceptance draw feeds updateNodeTemperatures (the cooling schedule), so
    // a mixed stream breaks reproducibility. The rng lives in a local, never
    // on `this`: strategy instances are reused across diagrams and a stored
    // rng would leak the previous diagram's sequence.
    const rng = createLayoutRng(nodes.map(n => n.id).join('|'));

    // Initialize nodes with positions from existing layout or input nodes
    const annealingNodes = this.initializeNodes(nodes, existingLayout, rng);

    // Store the initial best solution
    this.bestSolution = this.cloneNodes(annealingNodes);
    this.bestEnergy = this.calculateTotalEnergy(annealingNodes, edges, config);
    this.currentEnergy = this.bestEnergy;

    // Run the simulated annealing algorithm
    await this.runAnnealing(annealingNodes, edges, config, rng);
    
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
  
  private initializeNodes(
    nodes: PositionedNode[],
    existingLayout: DiagramLayout | undefined,
    rng: () => number
  ): AnnealingNode[] {
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
      x: node.x ?? (rng() * 1000 - 500),
      y: node.y ?? (rng() * 1000 - 500),
      initialX: node.x ?? 0,
      initialY: node.y ?? 0,
      temperature: this.initialTemperature
    }));
  }
  
  private async runAnnealing(
    nodes: AnnealingNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    rng: () => number
  ): Promise<void> {
    let temperature = this.initialTemperature;
    let iteration = 0;
    
    while (temperature > this.minTemperature && iteration < this.maxIterations) {
      // Try several perturbations at this temperature
      let accepted = 0;
      
      for (let i = 0; i < this.iterationsPerTemp; i++) {
        const nodeIndex = Math.floor(rng() * nodes.length);
        const node = nodes[nodeIndex];
        
        // Store original position
        const originalX = node.x;
        const originalY = node.y;
        
        // Perturb position
        this.perturbNode(node, temperature, config, rng);
        
        // Calculate new energy
        const newEnergy = this.calculateTotalEnergy(nodes, edges, config);
        const energyDelta = newEnergy - this.currentEnergy;
        
        // Accept or reject the move
        if (this.shouldAccept(energyDelta, temperature, rng)) {
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
  
  private perturbNode(
    node: AnnealingNode,
    temperature: number,
    config: LayoutConfig,
    rng: () => number
  ): void {
    // Scale perturbation by temperature and node's individual temperature
    const scale = temperature * node.temperature;
    
    // Generate random delta within bounds (guard against zero dimensions)
    const minDim = Math.min(config.width, config.height);
    const maxDelta = Math.max(1, minDim) * 0.1 * scale;
    const dx = (rng() * 2 - 1) * maxDelta;
    const dy = (rng() * 2 - 1) * maxDelta;
    
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
        const length = distance(dx, dy);
        
        // Quadratic penalty for edge lengths different from target
        const diff = length - targetLength;
        energy += diff * diff;
      }
    }
    
    return energy / Math.max(1, edges.length);
  }
  
  private calculateCrossingEnergy(nodes: PositionedNode[], edges: LayoutEdge[]): number {
    // Round 43: the pair scan + strict ccw predicate were a byte-identical
    // copy of OverlapResolver's — both delegate to ../edge-crossings now.
    // (The dropped `Array.from` copy was inert: `edges` is an array.)
    const crossings = countEdgeCrossings(nodes, edges);

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
  
  private shouldAccept(energyDelta: number, temperature: number, rng: () => number): boolean {
    // Always accept improvements
    if (energyDelta <= 0) return true;

    // Accept worse solutions with a probability that decreases with temperature
    const probability = Math.exp(-energyDelta / temperature);
    return rng() < probability;
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
    const aW = effWidth(a);
    const aH = effHeight(a);
    const bW = effWidth(b);
    const bH = effHeight(b);

    const aLeft = a.x - aW / 2;
    const aRight = a.x + aW / 2;
    const aTop = a.y - aH / 2;
    const aBottom = a.y + aH / 2;

    const bLeft = b.x - bW / 2;
    const bRight = b.x + bW / 2;
    const bTop = b.y - bH / 2;
    const bBottom = b.y + bH / 2;
    
    // Calculate overlap area
    const xOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
    const yOverlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
    
    return xOverlap * yOverlap;
  }

  // Round 43 retired `segmentsIntersect` (private): byte-identical to
  // OverlapResolver's strict ccw predicate — both live in ../edge-crossings.

  private applyBoundaryConstraints(node: PositionedNode, config: LayoutConfig): void {
    const padding = 10;
    const halfWidth = effWidth(node) / 2;
    const halfHeight = effHeight(node) / 2;
    
    // Keep nodes within canvas bounds with padding
    node.x = Math.max(padding + halfWidth, Math.min(config.width - padding - halfWidth, node.x));
    node.y = Math.max(padding + halfHeight, Math.min(config.height - padding - halfHeight, node.y));
  }
  
  private updateEdgePoints(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig
  ): LayoutEdge[] {
    return repointEdgesStraightLine(nodes, edges);
  }
}

export default SimulatedAnnealingStrategy;
