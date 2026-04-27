import { PositionedNode } from '@/types/diagram';

export interface SpatialHash {
  insert(node: PositionedNode): void;
  remove(node: PositionedNode): void;
  query(node: PositionedNode): PositionedNode[];
  clear(): void;
}

export class GridSpatialHash implements SpatialHash {
  private grid = new Map<string, Set<PositionedNode>>();
  private cellSize: number;

  constructor(nodes: PositionedNode[] = []) {
    this.cellSize = this.calculateCellSize(nodes);
    for (const node of nodes) {
      this.insert(node);
    }
  }

  private calculateCellSize(nodes: PositionedNode[]): number {
    if (nodes.length === 0) return 200;
    const maxSize = Math.max(
      ...nodes.map(n => Math.max(n.width, n.height))
    );
    return Math.max(maxSize, 50);
  }

  private getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  private getNodeCells(node: PositionedNode): string[] {
    const keys: string[] = [];
    const minGx = Math.floor(node.x / this.cellSize);
    const minGy = Math.floor(node.y / this.cellSize);
    const maxGx = Math.floor((node.x + node.width) / this.cellSize);
    const maxGy = Math.floor((node.y + node.height) / this.cellSize);

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        keys.push(`${gx},${gy}`);
      }
    }
    return keys;
  }

  insert(node: PositionedNode): void {
    const keys = this.getNodeCells(node);
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key)!.add(node);
    }
  }

  remove(node: PositionedNode): void {
    const keys = this.getNodeCells(node);
    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(node);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }
  }

  query(node: PositionedNode): PositionedNode[] {
    const candidates = new Set<PositionedNode>();
    const keys = this.getNodeCells(node);

    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const candidate of cell) {
          if (candidate.id !== node.id) {
            candidates.add(candidate);
          }
        }
      }
    }

    return Array.from(candidates);
  }

  clear(): void {
    this.grid.clear();
  }

  get cellCount(): number {
    return this.grid.size;
  }
}
