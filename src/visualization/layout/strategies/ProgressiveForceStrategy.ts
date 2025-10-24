import { PositionedNode, LayoutEdge, DiagramLayout } from '@/types/diagram';
import { BaseLayoutStrategy, LayoutStrategy } from './LayoutStrategy';
import { LayoutConfig, LayoutResult } from '../../types';

interface ForceNode extends PositionedNode {
  fx?: number | null;
  fy?: number | null;
  vx: number;
  vy: number;
}

export class ProgressiveForceStrategy extends BaseLayoutStrategy {
  readonly name = 'progressive-force';
  readonly canEscapeLocalMinimum = false; // This strategy can't escape local minima on its own
  
  // Force simulation parameters
  private alpha = 1.0; // Current simulation temperature
  private alphaMin = 0.001; // Minimum temperature
  private alphaDecay = 1 - Math.pow(0.001, 1 / 300); // Decay rate for 300 iterations to reach alphaMin
  private velocityDecay = 0.6; // Friction coefficient
  private temperature = 10; // Initial temperature for jitter
  
  // Force parameters (will be adjusted dynamically)
  private forceStrength = 0.5;
  private repulsionStrength = 1000;
  private linkDistance = 200;
  private centerStrength = 0.1;
  
  // Adaptive parameters
  private iterationCount = 0;
  private maxIterations = 300;
  private stabilityThreshold = 0.01;
  private stabilityWindow = 5;
  private recentEnergy: number[] = [];
  
  // Performance optimization
  private useSpatialHash = true;
  private spatialGrid: Map<string, ForceNode[]> = new Map();
  private gridSize = 50; // Size of each grid cell
  
  async performLayout(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
    // Initialize nodes with positions from existing layout or random positions
    const forceNodes: ForceNode[] = this.initializeNodes(nodes, existingLayout);
    
    // Set up the simulation
    this.initializeParameters(forceNodes.length, edges.length, config);
    
    // Run the force-directed layout
    await this.runSimulation(forceNodes, edges, config);
    
    // Convert back to PositionedNode
    const positionedNodes: PositionedNode[] = forceNodes.map(node => ({
      ...node,
      // Remove simulation-specific properties
      fx: undefined,
      fy: undefined,
      vx: undefined,
      vy: undefined,
    }));
    
    return {
      nodes: positionedNodes,
      edges: this.updateEdgePoints(positionedNodes, edges, config)
    };
  }
  
  estimateComplexity(nodeCount: number, edgeCount: number): number {
    // O(n²) for repulsion + O(e) for links
    return nodeCount * nodeCount * 0.7 + edgeCount * 0.3;
  }
  
  private initializeNodes(nodes: PositionedNode[], existingLayout?: DiagramLayout): ForceNode[] {
    if (existingLayout?.nodes?.length) {
      // Use existing node positions if available
      const nodeMap = new Map<string, PositionedNode>(existingLayout.nodes.map(n => [n.id, n]));
      return nodes.map(node => {
        const existingNode = nodeMap.get(node.id);
        return {
          ...node,
          x: existingNode?.x ?? (Math.random() * 1000 - 500),
          y: existingNode?.y ?? (Math.random() * 1000 - 500),
          vx: 0,
          vy: 0,
          fx: null,
          fy: null
        };
      });
    }
    
    // Initialize with random positions in a circle
    const radius = Math.sqrt(nodes.length) * 50;
    return nodes.map((node, i) => {
      const angle = (i * 2 * Math.PI) / nodes.length;
      return {
        ...node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null
      };
    });
  }
  
  private initializeParameters(nodeCount: number, edgeCount: number, config: LayoutConfig): void {
    // Reset simulation parameters
    this.alpha = 1.0;
    this.iterationCount = 0;
    this.recentEnergy = [];
    
    // Adjust parameters based on graph size and type
    const density = nodeCount / (config.width * config.height || 1e6);
    
    // Adaptive force parameters
    this.repulsionStrength = Math.min(10000, Math.max(100, nodeCount * 10));
    this.linkDistance = Math.min(300, Math.max(50, 200 - nodeCount));
    this.forceStrength = 0.5 * Math.min(1, 100 / nodeCount);
    
    // Use spatial hashing for larger graphs
    this.useSpatialHash = nodeCount > 50;
    this.gridSize = Math.max(30, Math.min(100, Math.sqrt(config.width * config.height / nodeCount) * 0.5));
    
    // Adjust iterations based on graph size
    this.maxIterations = Math.min(500, Math.max(100, nodeCount * 5));
  }
  
  private async runSimulation(nodes: ForceNode[], edges: LayoutEdge[], config: LayoutConfig): Promise<void> {
    let lastEnergy = Infinity;
    let stableCount = 0;
    
    // Main simulation loop
    while (this.alpha > this.alphaMin && this.iterationCount < this.maxIterations) {
      // Update simulation state
      this.alpha *= 1 - this.alphaDecay;
      this.iterationCount++;
      
      // Store previous positions for stability check
      const prevX = nodes.map(n => n.x);
      const prevY = nodes.map(n => n.y);
      
      // Apply forces
      this.applyForces(nodes, edges, config);
      
      // Update positions
      this.updatePositions(nodes);
      
      // Calculate system energy (lower is better)
      const energy = this.calculateEnergy(nodes, edges, prevX, prevY);
      
      // Check for stability
      if (this.isStable(energy, lastEnergy)) {
        stableCount++;
        
        // If we've been stable for a while, try to escape local minimum
        if (stableCount > 10) {
          this.escapeLocalMinimum(nodes);
          stableCount = 0;
        }
      } else {
        stableCount = 0;
      }
      
      lastEnergy = energy;
      
      // Yield to the event loop occasionally
      if (this.iterationCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
  
  private applyForces(nodes: ForceNode[], edges: LayoutEdge[], config: LayoutConfig): void {
    // Reset forces
    for (const node of nodes) {
      node.fx = null;
      node.fy = null;
    }
    
    // Apply repulsion (all pairs, with spatial hashing for large graphs)
    if (this.useSpatialHash) {
      this.applyRepulsionSpatial(nodes);
    } else {
      this.applyRepulsionAllPairs(nodes);
    }
    
    // Apply link forces
    this.applyLinkForces(nodes, edges);
    
    // Apply centering force
    this.applyCenteringForce(nodes, config);
    
    // Apply boundary constraints
    this.applyBoundaryConstraints(nodes, config);
  }
  
  private applyRepulsionAllPairs(nodes: ForceNode[]): void {
    const k = this.repulsionStrength / nodes.length;
    
    for (let i = 0; i < nodes.length; i++) {
      const node1 = nodes[i];
      
      for (let j = i + 1; j < nodes.length; j++) {
        const node2 = nodes[j];
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        const distSq = dx * dx + dy * dy;
        
        // Skip if nodes are at the same position
        if (distSq < 1e-6) {
          node1.x += (Math.random() - 0.5) * 10;
          node1.y += (Math.random() - 0.5) * 10;
          continue;
        }
        
        // Calculate repulsive force (Coulomb's law)
        const dist = Math.sqrt(distSq);
        const force = k * k / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        node1.vx += fx;
        node1.vy += fy;
        node2.vx -= fx;
        node2.vy -= fy;
      }
    }
  }
  
  private applyRepulsionSpatial(nodes: ForceNode[]): void {
    // Clear the spatial grid
    this.spatialGrid.clear();
    
    // Assign nodes to grid cells
    for (const node of nodes) {
      const gridX = Math.floor(node.x / this.gridSize);
      const gridY = Math.floor(node.y / this.gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, []);
      }
      this.spatialGrid.get(key)?.push(node);
    }
    
    const k = this.repulsionStrength / nodes.length;
    
    // For each node, check nearby grid cells for potential collisions
    for (const node of nodes) {
      const gridX = Math.floor(node.x / this.gridSize);
      const gridY = Math.floor(node.y / this.gridSize);
      
      // Check the 3x3 grid around the node's cell
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gridX + dx},${gridY + dy}`;
          const cellNodes = this.spatialGrid.get(key) || [];
          
          for (const otherNode of cellNodes) {
            if (node === otherNode) continue;
            
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            const distSq = dx * dx + dy * dy;
            
            // Only consider nodes within a certain distance
            if (distSq > this.gridSize * this.gridSize * 4) continue;
            
            // Calculate repulsive force
            const dist = Math.sqrt(distSq);
            const force = k * k / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            node.vx += fx;
            node.vy += fy;
          }
        }
      }
    }
  }
  
  private applyLinkForces(nodes: ForceNode[], edges: LayoutEdge[]): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      
      if (!source || !target) continue;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      // Calculate spring force (Hooke's law)
      const delta = (dist - this.linkDistance) / dist;
      const fx = dx * delta * this.forceStrength;
      const fy = dy * delta * this.forceStrength;
      
      // Apply forces to both nodes
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }
  }
  
  private applyCenteringForce(nodes: ForceNode[], config: LayoutConfig): void {
    // Calculate center of mass
    let sumX = 0;
    let sumY = 0;
    
    for (const node of nodes) {
      sumX += node.x;
      sumY += node.y;
    }
    
    const centerX = sumX / nodes.length;
    const centerY = sumY / nodes.length;
    
    // Apply force towards center
    for (const node of nodes) {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      
      node.vx += dx * this.centerStrength * this.alpha;
      node.vy += dy * this.centerStrength * this.alpha;
    }
  }
  
  private applyBoundaryConstraints(nodes: ForceNode[], config: LayoutConfig): void {
    const padding = 50;
    const { width, height } = config;
    
    if (!width || !height) return;
    
    for (const node of nodes) {
      // Soft boundary constraints (gradual repulsion)
      const leftDist = node.x - padding;
      const rightDist = width - node.x - padding;
      const topDist = node.y - padding;
      const bottomDist = height - node.y - padding;
      
      // Apply repulsion from boundaries
      if (leftDist < 0) node.vx += -leftDist * 0.1;
      if (rightDist < 0) node.vx += rightDist * 0.1;
      if (topDist < 0) node.vy += -topDist * 0.1;
      if (bottomDist < 0) node.vy += bottomDist * 0.1;
    }
  }
  
  private updatePositions(nodes: ForceNode[]): void {
    const alpha = this.alpha;
    
    for (const node of nodes) {
      // Skip fixed nodes
      if (node.fx !== null && node.fy !== null) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      
      // Apply velocity
      node.vx *= this.velocityDecay;
      node.vy *= this.velocityDecay;
      
      // Update position
      node.x += node.vx * alpha;
      node.y += node.vy * alpha;
    }
  }
  
  private calculateEnergy(
    nodes: ForceNode[],
    edges: LayoutEdge[],
    prevX: number[],
    prevY: number[]
  ): number {
    let energy = 0;
    
    // Energy from node movement (kinetic energy)
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const dx = node.x - prevX[i];
      const dy = node.y - prevY[i];
      energy += dx * dx + dy * dy;
    }
    
    // Energy from edge lengths (potential energy)
    const nodeMap = new Map(nodes.map((n, i) => [n.id, { node: n, index: i }]));
    
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      
      if (source && target) {
        const dx = target.node.x - source.node.x;
        const dy = target.node.y - source.node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = dist - this.linkDistance;
        energy += delta * delta * 0.5;
      }
    }
    
    return energy;
  }
  
  private isStable(currentEnergy: number, lastEnergy: number): boolean {
    // Track recent energy values
    this.recentEnergy.push(currentEnergy);
    if (this.recentEnergy.length > this.stabilityWindow) {
      this.recentEnergy.shift();
    }
    
    // Calculate energy variance
    const mean = this.recentEnergy.reduce((a, b) => a + b, 0) / this.recentEnergy.length;
    const variance = this.recentEnergy.reduce((a, b) => a + (b - mean) ** 2, 0) / this.recentEnergy.length;
    
    // Consider the system stable if energy is low and not changing much
    return (
      currentEnergy < this.stabilityThreshold ||
      (variance < this.stabilityThreshold * 0.1 && this.recentEnergy.length === this.stabilityWindow)
    );
  }
  
  private escapeLocalMinimum(nodes: ForceNode[]): void {
    // If we're stuck, try to escape by adding some noise
    const scale = this.temperature * Math.exp(-this.iterationCount / 100);
    
    for (const node of nodes) {
      // Skip fixed nodes
      if (node.fx !== null && node.fy !== null) continue;
      
      // Add random jitter
      node.x += (Math.random() - 0.5) * scale;
      node.y += (Math.random() - 0.5) * scale;
    }
    
    // Increase temperature for next time
    this.temperature = Math.min(100, this.temperature * 1.5);
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

export default ProgressiveForceStrategy;
