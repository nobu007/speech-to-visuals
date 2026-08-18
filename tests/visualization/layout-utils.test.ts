import {
  calculateNodeWidth,
  calculateNodeHeight,
  calculateNodeCenter,
  calculateDistance,
  calculateNodeDistance,
  generateEdgePoints,
  nodesOverlap,
  getGraphConfig,
} from '@/visualization/layout-utils';
import { NodeDatum, PositionedNode } from '@stv/core/types/diagram';
import { LayoutConfig, NodeDimensionsConfig } from '@/visualization/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'n0',
    label: 'Node 0',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    ...overrides,
  };
}

const defaultDimConfig: NodeDimensionsConfig = {
  nodeWidth: 100,
  nodeHeight: 40,
  charWidth: 8,
  padding: 16,
};

const defaultLayoutConfig: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 100,
  nodeHeight: 40,
  marginX: 20,
  marginY: 20,
  rankDirection: 'TB',
  nodeSeparation: 60,
  edgeSeparation: 30,
  rankSeparation: 100,
};

// ---------------------------------------------------------------------------
// calculateNodeWidth
// ---------------------------------------------------------------------------

describe('calculateNodeWidth', () => {
  it('returns base width for short labels', () => {
    const node: NodeDatum = { id: 'a', label: 'Hi' };
    expect(calculateNodeWidth(node, defaultDimConfig)).toBe(100);
  });

  it('scales width for longer labels within 2x cap', () => {
    const node: NodeDatum = { id: 'a', label: 'A'.repeat(30) };
    const result = calculateNodeWidth(node, defaultDimConfig);
    // 30 chars * 8 + 16 = 256, capped at 200
    expect(result).toBe(200);
  });

  it('uses baseWidth when label is undefined', () => {
    const node: NodeDatum = { id: 'a', label: undefined as unknown as string };
    expect(calculateNodeWidth(node, defaultDimConfig)).toBe(100);
  });

  it('respects minimum of baseWidth', () => {
    const node: NodeDatum = { id: 'a', label: '' };
    expect(calculateNodeWidth(node, defaultDimConfig)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateNodeHeight
// ---------------------------------------------------------------------------

describe('calculateNodeHeight', () => {
  it('returns configured nodeHeight', () => {
    const node: NodeDatum = { id: 'a', label: 'Test' };
    expect(calculateNodeHeight(node, defaultDimConfig)).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// calculateNodeCenter
// ---------------------------------------------------------------------------

describe('calculateNodeCenter', () => {
  it('computes center from x, y, width, height', () => {
    const node = makeNode({ x: 10, y: 20, width: 100, height: 60 });
    expect(calculateNodeCenter(node)).toEqual({ x: 60, y: 50 });
  });

  it('handles zero-dimension nodes', () => {
    const node = makeNode({ x: 0, y: 0, width: 0, height: 0 });
    expect(calculateNodeCenter(node)).toEqual({ x: 0, y: 0 });
  });

  it('computes center from x, y, w, h (layout engine convention)', () => {
    const node = makeNode({ x: 10, y: 20, w: 100, h: 60, width: undefined, height: undefined });
    expect(calculateNodeCenter(node)).toEqual({ x: 60, y: 50 });
  });

  it('prefers width/height when both w/width are present (canonical property)', () => {
    const node = makeNode({ x: 0, y: 0, w: 80, h: 40, width: 999, height: 999 });
    expect(calculateNodeCenter(node)).toEqual({ x: 499.5, y: 499.5 });
  });

  it('does not return NaN for nodes with only w/h (regression)', () => {
    const node = makeNode({ x: 50, y: 60, w: 120, h: 80, width: undefined, height: undefined });
    const center = calculateNodeCenter(node);
    expect(Number.isFinite(center.x)).toBe(true);
    expect(Number.isFinite(center.y)).toBe(true);
    expect(center).toEqual({ x: 110, y: 100 });
  });
});

// ---------------------------------------------------------------------------
// calculateDistance
// ---------------------------------------------------------------------------

describe('calculateDistance', () => {
  it('returns 0 for identical points', () => {
    expect(calculateDistance({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
  });

  it('computes Euclidean distance correctly', () => {
    // 3-4-5 triangle
    const dist = calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(dist).toBeCloseTo(5, 10);
  });

  it('computes distance for negative coordinates', () => {
    const dist = calculateDistance({ x: -1, y: -1 }, { x: 2, y: 3 });
    expect(dist).toBeCloseTo(5, 10);
  });
});

// ---------------------------------------------------------------------------
// calculateNodeDistance
// ---------------------------------------------------------------------------

describe('calculateNodeDistance', () => {
  it('computes distance between two node centers', () => {
    const node1 = makeNode({ x: 0, y: 0, width: 2, height: 2 });   // center (1,1)
    const node2 = makeNode({ x: 2, y: 2, width: 2, height: 2 });   // center (3,3)
    const dist = calculateNodeDistance(node1, node2);
    expect(dist).toBeCloseTo(Math.sqrt(8), 10);
  });
});

// ---------------------------------------------------------------------------
// generateEdgePoints
// ---------------------------------------------------------------------------

describe('generateEdgePoints', () => {
  it('returns two points from source center to target center', () => {
    const source = makeNode({ x: 0, y: 0, width: 10, height: 10 });
    const target = makeNode({ x: 100, y: 100, width: 10, height: 10 });
    const pts = generateEdgePoints(source, target);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 5, y: 5 });
    expect(pts[1]).toEqual({ x: 105, y: 105 });
  });

  it('computes correct centers for nodes with w/h only (regression)', () => {
    const source = makeNode({ x: 0, y: 0, w: 10, h: 10, width: undefined, height: undefined });
    const target = makeNode({ x: 100, y: 100, w: 10, h: 10, width: undefined, height: undefined });
    const pts = generateEdgePoints(source, target);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 5, y: 5 });
    expect(pts[1]).toEqual({ x: 105, y: 105 });
  });
});

// ---------------------------------------------------------------------------
// nodesOverlap
// ---------------------------------------------------------------------------

describe('nodesOverlap', () => {
  it('detects overlapping nodes', () => {
    const a = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const b = makeNode({ x: 50, y: 0, width: 100, height: 40 });
    expect(nodesOverlap(a, b)).toBe(true);
  });

  it('returns false for non-overlapping nodes', () => {
    const a = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const b = makeNode({ x: 200, y: 0, width: 100, height: 40 });
    expect(nodesOverlap(a, b)).toBe(false);
  });

  it('returns false for adjacent (touching) nodes without spacing', () => {
    const a = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const b = makeNode({ x: 100, y: 0, width: 100, height: 40 });
    expect(nodesOverlap(a, b)).toBe(false);
  });

  it('detects overlap when spacing pushes boundaries together', () => {
    const a = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const b = makeNode({ x: 100, y: 0, width: 100, height: 40 });
    expect(nodesOverlap(a, b, 10)).toBe(true);
  });

  it('handles w/h properties instead of width/height', () => {
    const a = makeNode({ x: 0, y: 0, w: 50, h: 50 });
    const b = makeNode({ x: 30, y: 30, w: 50, h: 50 });
    expect(nodesOverlap(a, b)).toBe(true);
  });

  it('returns false for vertically separated nodes', () => {
    const a = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const b = makeNode({ x: 0, y: 50, width: 100, height: 40 });
    expect(nodesOverlap(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getGraphConfig
// ---------------------------------------------------------------------------

describe('getGraphConfig', () => {
  const diagramTypes = ['flow', 'tree', 'timeline', 'matrix', 'cycle'] as const;

  it('includes base config fields for every diagram type', () => {
    for (const dt of diagramTypes) {
      const cfg = getGraphConfig(dt, defaultLayoutConfig);
      expect(cfg.nodesep).toBe(60);
      expect(cfg.edgesep).toBe(30);
      expect(cfg.ranksep).toBe(100);
      expect(cfg.marginx).toBe(20);
      expect(cfg.marginy).toBe(20);
    }
  });

  it('uses TB for flow diagrams', () => {
    expect((getGraphConfig('flow', defaultLayoutConfig) as { rankdir: string }).rankdir).toBe('TB');
  });

  it('uses TB with longest-path ranker for tree diagrams', () => {
    const cfg = getGraphConfig('tree', defaultLayoutConfig) as { rankdir: string; ranker: string };
    expect(cfg.rankdir).toBe('TB');
    expect(cfg.ranker).toBe('longest-path');
  });

  it('uses LR for timeline diagrams', () => {
    expect((getGraphConfig('timeline', defaultLayoutConfig) as { rankdir: string }).rankdir).toBe('LR');
  });

  it('uses network-simplex for matrix diagrams', () => {
    expect((getGraphConfig('matrix', defaultLayoutConfig) as { ranker: string }).ranker).toBe('network-simplex');
  });

  it('uses longest-path for cycle diagrams', () => {
    expect((getGraphConfig('cycle', defaultLayoutConfig) as { ranker: string }).ranker).toBe('longest-path');
  });

  it('returns base config for unknown diagram type', () => {
    const cfg = getGraphConfig('general' as 'flow', defaultLayoutConfig);
    expect(cfg).toEqual(
      expect.objectContaining({
        nodesep: 60,
        edgesep: 30,
        ranksep: 100,
        marginx: 20,
        marginy: 20,
      })
    );
  });
});
