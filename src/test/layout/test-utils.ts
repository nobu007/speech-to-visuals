import { NodeDatum, PositionedNode, LayoutEdge, EdgeDatum } from '../../types/diagram';
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
      const overlap = !(
        a.x + a.width / 2 + padding < b.x - b.width / 2 ||
        a.x - a.width / 2 - padding > b.x + b.width / 2 ||
        a.y + a.height / 2 + padding < b.y - b.height / 2 ||
        a.y - a.height / 2 - padding > b.y + b.height / 2
      );
      if (overlap) return true;
    }
  }
  return false;
};
