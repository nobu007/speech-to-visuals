import { NodeDatum, PositionedNode, LayoutEdge, EdgeDatum } from '@stv/core/types/diagram';
import { LayoutConfig } from '../../visualization/types';

export const createTestNode = (id: string, x = 0, y = 0, width = 100, height = 50): PositionedNode => ({
  id: `node-${id}`,
  label: `Node ${id}`,
  x,
  y,
  width,
  height,
});

export const createDatumNode = (id: string, label?: string): NodeDatum => ({
  id: `node-${id}`,
  label: label ?? `Node ${id}`,
});

export const createLayoutEdge = (id: string, source: string, target: string): LayoutEdge => ({
  id: `edge-${id}`,
  from: source, // keep legacy
  to: target,   // keep legacy
  source,
  target,
  points: [],
});

export const createEdgeDatum = (id: string, source: string, target: string, label?: string): EdgeDatum => ({
  id: `edge-${id}`,
  from: source,
  to: target,
  source,
  target,
  label,
});

export const createTestConfig = (overrides: Partial<LayoutConfig> = {}): LayoutConfig => ({
  width: 1000,
  height: 800,
  nodeWidth: 100,
  nodeHeight: 50,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 30,
  edgeSeparation: 10,
  rankSeparation: 50,
  isSimpleMode: false,
  ...overrides,
});

export const createOverlappingPositioned = (count: number): PositionedNode[] => {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(createTestNode(`${i}`, i * 10, i * 10, 100, 50));
  }
  return nodes;
};

export const createNonOverlappingPositioned = (count: number): PositionedNode[] => {
  const nodes: PositionedNode[] = [];
  const grid = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / grid);
    const c = i % grid;
    nodes.push(createTestNode(`${i}`, c * 160, r * 110, 100, 50));
  }
  return nodes;
};

export const toDataNodes = (nodes: PositionedNode[]): NodeDatum[] =>
  nodes.map(n => ({ id: n.id, label: n.label }));

export const hasAnyOverlap = (nodes: PositionedNode[], padding = 0): boolean => {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      // PositionedNode.width/height are optional upstream; an absent dim must
      // keep producing NaN comparisons (overlap reported) exactly like the
      // old `!`, so normalize to NaN rather than a fabricated 0
      // (Phase 147 / REQ-336).
      const aWidth = a.width ?? Number.NaN;
      const aHeight = a.height ?? Number.NaN;
      const bWidth = b.width ?? Number.NaN;
      const bHeight = b.height ?? Number.NaN;
      const overlap = !(
        a.x + aWidth / 2 + padding < b.x - bWidth / 2 ||
        a.x - aWidth / 2 - padding > b.x + bWidth / 2 ||
        a.y + aHeight / 2 + padding < b.y - bHeight / 2 ||
        a.y - aHeight / 2 - padding > b.y + bHeight / 2
      );
      if (overlap) return true;
    }
  }
  return false;
};
