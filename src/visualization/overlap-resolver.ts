import { PositionedNode, LayoutEdge } from '@/types/diagram';
import { SpatialHash, GridSpatialHash } from './spatial-hash';

export interface OverlapPair {
  node1: PositionedNode;
  node2: PositionedNode;
}

export class OverlapResolver {
  private maxIterations: number;

  constructor(maxIterations: number = 100) {
    this.maxIterations = maxIterations;
  }

  detectOverlaps(nodes: PositionedNode[]): OverlapPair[] {
    if (nodes.length < 2) return [];

    const spatialHash = new GridSpatialHash(nodes);
    const pairs: OverlapPair[] = [];
    const checked = new Set<string>();

    for (const node of nodes) {
      const candidates = spatialHash.query(node);
      for (const candidate of candidates) {
        const pairKey = node.id < candidate.id
          ? `${node.id}:${candidate.id}`
          : `${candidate.id}:${node.id}`;

        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        if (this.nodesOverlap(node, candidate)) {
          pairs.push({ node1: node, node2: candidate });
        }
      }
    }

    return pairs;
  }

  getOverlapCount(nodes: PositionedNode[]): number {
    return this.detectOverlaps(nodes).length;
  }

  resolve(nodes: PositionedNode[]): PositionedNode[] {
    if (nodes.length < 2) return nodes;

    let current = nodes.map(n => ({ ...n }));
    let iteration = 0;
    let noProgressCount = 0;
    let lastOverlapCount = Infinity;

    while (iteration < this.maxIterations) {
      const overlaps = this.detectOverlaps(current);
      const overlapCount = overlaps.length;

      if (overlapCount === 0) break;

      // Check for no progress (stuck in local minimum)
      if (overlapCount >= lastOverlapCount) {
        noProgressCount++;
        if (noProgressCount >= 5) break;
      } else {
        noProgressCount = 0;
      }
      lastOverlapCount = overlapCount;

      // Apply repulsion force for overlapping pairs
      current = this.applyRepulsion(current, overlaps);
      iteration++;
    }

    // Final check - if still has overlaps, apply grid-snap fallback
    if (this.detectOverlaps(current).length > 0) {
      current = this.gridSnapFallback(current);
    }

    return current;
  }

  private applyRepulsion(
    nodes: PositionedNode[],
    overlaps: OverlapPair[]
  ): PositionedNode[] {
    const moved = nodes.map(n => ({ ...n, dx: 0, dy: 0 }));

    const indexMap = new Map<string, number>();
    moved.forEach((n, i) => indexMap.set(n.id, i));

    for (const { node1, node2 } of overlaps) {
      const i1 = indexMap.get(node1.id);
      const i2 = indexMap.get(node2.id);
      if (i1 === undefined || i2 === undefined) continue;

      const overlapX = Math.min(node1.x + node1.width, node2.x + node2.width) -
                        Math.max(node1.x, node2.x);
      const overlapY = Math.min(node1.y + node1.height, node2.y + node2.height) -
                        Math.max(node1.y, node2.y);

      const step = 0.5;

      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          const direction = node1.x < node2.x ? -1 : 1;
          const shift = overlapX * step * direction;
          moved[i1].dx += shift;
          moved[i2].dx -= shift;
        } else {
          const direction = node1.y < node2.y ? -1 : 1;
          const shift = overlapY * step * direction;
          moved[i1].dy += shift;
          moved[i2].dy -= shift;
        }
      }
    }

    return moved.map(({ dx, dy, ...rest }) => ({
      ...rest,
      x: rest.x + dx,
      y: rest.y + dy,
    }));
  }

  private gridSnapFallback(nodes: PositionedNode[]): PositionedNode[] {
    if (nodes.length === 0) return nodes;

    const maxNodeWidth = Math.max(...nodes.map(n => n.width));
    const maxNodeHeight = Math.max(...nodes.map(n => n.height));
    const cellWidth = maxNodeWidth + 20;
    const cellHeight = maxNodeHeight + 20;

    const aspectRatio = 16 / 9;
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * aspectRatio)));
    const rows = Math.max(1, Math.ceil(nodes.length / columns));

    const sortedNodes = [...nodes].sort((a, b) => {
      if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
      return a.x - b.x;
    });

    return sortedNodes.map((node, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      return {
        ...node,
        x: col * cellWidth + 40,
        y: row * cellHeight + 40,
      };
    });
  }

  private nodesOverlap(a: PositionedNode, b: PositionedNode): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}
