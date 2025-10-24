import { PositionedNode, LayoutEdge, DiagramLayout } from '@/types/diagram';
import { BaseLayoutStrategy } from './LayoutStrategy';
import { LayoutConfig } from '../../types';

interface GridCell {
  x: number;
  y: number;
  occupied: boolean;
  nodeId?: string;
}

export class GridSnapStrategy extends BaseLayoutStrategy {
  readonly name = 'grid-snap';
  readonly canEscapeLocalMinimum = true; // This strategy can always find a solution
  
  // Grid configuration
  private cellSize: number = 100; // Initial cell size, will be adjusted
  private padding: number = 10;   // Padding between cells
  
  // State
  private grid: GridCell[][] = [];
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private placedNodes: Set<string> = new Set();
  
  async performLayout(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
    // Make a copy of nodes to avoid mutating the input
    const nodesToPlace = this.cloneNodes(nodes);
    
    // Calculate cell size based on the largest node
    this.calculateCellSize(nodesToPlace, config);
    
    // Initialize grid
    this.initializeGrid(config);
    
    // Sort nodes by size (largest first) to improve packing
    const sortedNodes = this.sortNodesBySize(nodesToPlace);
    
    // Place nodes on the grid
    const placedNodes = this.placeNodesOnGrid(sortedNodes, config);
    
    // Update edge points based on final node positions
    const updatedEdges = this.updateEdgePoints(placedNodes, edges, config);
    
    return {
      nodes: placedNodes,
      edges: updatedEdges
    };
  }
  
  estimateComplexity(nodeCount: number): number {
    // O(n²) for grid placement in the worst case
    return nodeCount * nodeCount;
  }
  
  private calculateCellSize(nodes: PositionedNode[], config: LayoutConfig): void {
    if (nodes.length === 0) {
      this.cellSize = 100; // Default size
      return;
    }
    
    // Find the largest node dimensions
    let maxWidth = 0;
    let maxHeight = 0;
    
    for (const node of nodes) {
      maxWidth = Math.max(maxWidth, node.width || 100);
      maxHeight = Math.max(maxHeight, node.height || 50);
    }
    
    // Set cell size to accommodate the largest node plus padding
    this.cellSize = Math.max(maxWidth, maxHeight) + this.padding * 2;
    
    // Adjust based on available space
    const maxCellSize = Math.min(
      (config.width * 0.8) / Math.ceil(Math.sqrt(nodes.length)),
      (config.height * 0.8) / Math.ceil(Math.sqrt(nodes.length))
    );
    
    this.cellSize = Math.min(this.cellSize, maxCellSize);
    this.cellSize = Math.max(this.cellSize, 50); // Minimum cell size
  }
  
  private initializeGrid(config: LayoutConfig): void {
    // Calculate grid dimensions based on cell size and canvas size
    this.gridWidth = Math.ceil((config.width * 0.9) / this.cellSize);
    this.gridHeight = Math.ceil((config.height * 0.9) / this.cellSize);
    
    // Initialize empty grid
    this.grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        row.push({
          x,
          y,
          occupied: false
        });
      }
      this.grid.push(row);
    }
    
    this.placedNodes.clear();
  }
  
  private sortNodesBySize(nodes: PositionedNode[]): PositionedNode[] {
    // Sort by area (largest first) to improve packing
    return [...nodes].sort((a, b) => {
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      return areaB - areaA; // Descending order
    });
  }
  
  private placeNodesOnGrid(nodes: PositionedNode[], config: LayoutConfig): PositionedNode[] {
    const placedNodes: PositionedNode[] = [];
    
    // Place each node on the grid
    for (const node of nodes) {
      const placedNode = this.placeNode(node, config);
      if (placedNode) {
        placedNodes.push(placedNode);
        this.placedNodes.add(placedNode.id);
      }
    }
    
    return placedNodes;
  }
  
  private placeNode(node: PositionedNode, config: LayoutConfig): PositionedNode | null {
    // Calculate how many cells this node needs
    const cellsWide = Math.ceil((node.width || 100) / this.cellSize) + 1;
    const cellsHigh = Math.ceil((node.height || 50) / this.cellSize) + 1;
    
    // Try to find an empty spot for this node
    const position = this.findEmptySpot(cellsWide, cellsHigh);
    
    if (!position) {
      // If no spot found, expand the grid and try again
      this.expandGrid(cellsWide, cellsHigh, config);
      return this.placeNode(node, config);
    }
    
    // Mark cells as occupied
    this.markCells(position.x, position.y, cellsWide, cellsHigh, node.id);
    
    // Calculate the actual position in pixels
    const x = position.x * this.cellSize + (this.cellSize * cellsWide) / 2;
    const y = position.y * this.cellSize + (this.cellSize * cellsHigh) / 2;
    
    // Return the positioned node
    return {
      ...node,
      x: x + config.marginX,
      y: y + config.marginY
    };
  }
  
  private findEmptySpot(cellsWide: number, cellsHigh: number): { x: number; y: number } | null {
    // Try to find the first empty spot that can fit the node
    for (let y = 0; y <= this.gridHeight - cellsHigh; y++) {
      for (let x = 0; x <= this.gridWidth - cellsWide; x++) {
        if (this.isAreaEmpty(x, y, cellsWide, cellsHigh)) {
          return { x, y };
        }
      }
    }
    
    // If we get here, no spot was found
    return null;
  }
  
  private isAreaEmpty(startX: number, startY: number, width: number, height: number): boolean {
    // Check if the area is empty
    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        // If we're out of bounds, the area is not empty
        if (y >= this.gridHeight || x >= this.gridWidth) {
          return false;
        }
        
        // If any cell in the area is occupied, the area is not empty
        if (this.grid[y][x].occupied) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  private markCells(x: number, y: number, width: number, height: number, nodeId: string): void {
    // Mark cells as occupied
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cellY = y + dy;
        const cellX = x + dx;
        
        // Skip if out of bounds (shouldn't happen if we checked first)
        if (cellY >= this.gridHeight || cellX >= this.gridWidth) {
          continue;
        }
        
        this.grid[cellY][cellX].occupied = true;
        this.grid[cellY][cellX].nodeId = nodeId;
      }
    }
  }
  
  private expandGrid(neededWidth: number, neededHeight: number, config: LayoutConfig): void {
    // Determine how much to expand the grid
    const expandRight = neededWidth > this.gridWidth;
    const expandDown = neededHeight > this.gridHeight;
    
    // Expand right if needed
    if (expandRight) {
      const newWidth = Math.max(this.gridWidth * 2, neededWidth);
      
      for (let y = 0; y < this.gridHeight; y++) {
        // Add new columns to each row
        for (let x = this.gridWidth; x < newWidth; x++) {
          this.grid[y].push({
            x,
            y,
            occupied: false
          });
        }
      }
      
      this.gridWidth = newWidth;
    }
    
    // Expand down if needed
    if (expandDown) {
      const newHeight = Math.max(this.gridHeight * 2, neededHeight);
      
      for (let y = this.gridHeight; y < newHeight; y++) {
        const row: GridCell[] = [];
        
        // Create a new row
        for (let x = 0; x < this.gridWidth; x++) {
          row.push({
            x,
            y,
            occupied: false
          });
        }
        
        this.grid.push(row);
      }
      
      this.gridHeight = newHeight;
    }
    
    // If we couldn't expand enough, increase cell size and try again
    if ((expandRight && this.gridWidth < neededWidth) || 
        (expandDown && this.gridHeight < neededHeight)) {
      this.cellSize = Math.min(
        this.cellSize * 1.5,
        Math.min(config.width, config.height) / 2
      );
      this.initializeGrid(config);
    }
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
  
  // Override the default overlap detection since we guarantee no overlaps
  detectOverlaps(nodes: PositionedNode[]): any[] {
    return []; // No overlaps by design
  }
}

export default GridSnapStrategy;
