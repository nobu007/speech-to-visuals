import { PositionedNode } from '@/types/diagram';
import { getNodeWidth as nodeW, getNodeHeight as nodeH } from './node-dimensions';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpatialHash {
  insert(node: PositionedNode): void;
  remove(node: PositionedNode): void;
  query(node: PositionedNode): PositionedNode[];
  queryByRect(rect: Rect): PositionedNode[];
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
      ...nodes.map(n => Math.max(nodeW(n, 0), nodeH(n, 0)))
    );
    return Math.max(maxSize, 50);
  }

  private getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  private getRectCells(x: number, y: number, w: number, h: number): string[] {
    const keys: string[] = [];
    const minGx = Math.floor(x / this.cellSize);
    const minGy = Math.floor(y / this.cellSize);
    const maxGx = Math.floor((x + w) / this.cellSize);
    const maxGy = Math.floor((y + h) / this.cellSize);

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        keys.push(`${gx},${gy}`);
      }
    }
    return keys;
  }

  private getNodeCells(node: PositionedNode): string[] {
    return this.getRectCells(node.x, node.y, nodeW(node, 0), nodeH(node, 0));
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

  /**
   * Query all nodes whose bounding boxes overlap with the given rectangle.
   */
  queryByRect(rect: Rect): PositionedNode[] {
    const candidates = new Set<PositionedNode>();
    const keys = this.getRectCells(rect.x, rect.y, rect.width, rect.height);

    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const candidate of cell) {
          candidates.add(candidate);
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
