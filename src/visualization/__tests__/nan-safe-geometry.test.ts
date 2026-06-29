/**
 * Tests verifying that NaN values in node `.w`/`.h`/`.width`/`.height`
 * do not propagate through shared geometry functions.
 *
 * These tests guard against regressions where modules bypass the shared
 * getNodeWidth/getNodeHeight helpers and access .w/.h directly.
 */
import { calculateNodeCenter, nodesOverlap } from '../layout-utils';
import { getNodeWidth, getNodeHeight } from '../node-dimensions';
import type { PositionedNode } from '@/types/diagram';

function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'test',
    label: 'Test',
    x: 0,
    y: 0,
    ...overrides,
  } as PositionedNode;
}

describe('getNodeWidth / getNodeHeight NaN safety', () => {
  it('returns fallback when width is NaN', () => {
    const node = makeNode({ width: NaN });
    expect(getNodeWidth(node, 0)).toBe(0);
    expect(getNodeWidth(node)).toBe(120); // default fallback
  });

  it('returns fallback when height is NaN', () => {
    const node = makeNode({ height: NaN });
    expect(getNodeHeight(node, 0)).toBe(0);
    expect(getNodeHeight(node)).toBe(60); // default fallback
  });

  it('returns fallback when w is NaN and width is absent', () => {
    const node = makeNode({ w: NaN });
    expect(getNodeWidth(node, 0)).toBe(0);
  });

  it('returns fallback when h is NaN and height is absent', () => {
    const node = makeNode({ h: NaN });
    expect(getNodeHeight(node, 0)).toBe(0);
  });

  it('returns canonical width when both width and w are set', () => {
    const node = makeNode({ width: 200, w: 100 });
    expect(getNodeWidth(node, 0)).toBe(200);
  });

  it('falls through NaN width to finite w', () => {
    const node = makeNode({ width: NaN, w: 100 });
    expect(getNodeWidth(node, 0)).toBe(100);
  });

  it('returns fallback for negative Infinity', () => {
    const node = makeNode({ width: -Infinity, height: Infinity });
    expect(getNodeWidth(node, 50)).toBe(50);
    expect(getNodeHeight(node, 50)).toBe(50);
  });
});

describe('calculateNodeCenter NaN safety', () => {
  it('does not produce NaN center when w/h are NaN', () => {
    const node = makeNode({ x: 100, y: 50, w: NaN, h: NaN });
    const center = calculateNodeCenter(node);
    expect(Number.isFinite(center.x)).toBe(true);
    expect(Number.isFinite(center.y)).toBe(true);
  });

  it('does not produce NaN center when width/height are NaN', () => {
    const node = makeNode({ x: 100, y: 50, width: NaN, height: NaN });
    const center = calculateNodeCenter(node);
    expect(Number.isFinite(center.x)).toBe(true);
    expect(Number.isFinite(center.y)).toBe(true);
  });

  it('computes correct center with finite dimensions', () => {
    const node = makeNode({ x: 100, y: 50, w: 120, h: 60 });
    const center = calculateNodeCenter(node);
    expect(center.x).toBe(160); // 100 + 120/2
    expect(center.y).toBe(80);  // 50 + 60/2
  });
});

describe('nodesOverlap NaN safety', () => {
  it('does not return true for NaN dimensions (NaN comparison is always false)', () => {
    const node1 = makeNode({ x: 0, y: 0, w: NaN, h: NaN });
    const node2 = makeNode({ x: 10, y: 10, w: 50, h: 50 });
    // With NaN dimensions treated as 0, node1 is a point at (0,0) which
    // doesn't overlap with node2 starting at (10,10)
    const result = nodesOverlap(node1, node2);
    expect(typeof result).toBe('boolean');
    expect(result).toBe(false); // point at (0,0) doesn't overlap box at (10,10)
  });

  it('correctly detects overlap with finite dimensions', () => {
    const node1 = makeNode({ x: 0, y: 0, w: 100, h: 100 });
    const node2 = makeNode({ x: 50, y: 50, w: 100, h: 100 });
    expect(nodesOverlap(node1, node2)).toBe(true);
  });

  it('correctly detects non-overlap with finite dimensions', () => {
    const node1 = makeNode({ x: 0, y: 0, w: 100, h: 100 });
    const node2 = makeNode({ x: 200, y: 200, w: 100, h: 100 });
    expect(nodesOverlap(node1, node2)).toBe(false);
  });

  it('handles both nodes having NaN dimensions', () => {
    const node1 = makeNode({ x: 0, y: 0, w: NaN, h: NaN });
    const node2 = makeNode({ x: 0, y: 0, w: NaN, h: NaN });
    // Both treated as 0x0 points at (0,0) — they overlap (same point)
    const result = nodesOverlap(node1, node2);
    expect(typeof result).toBe('boolean');
  });
});

describe('LayoutEvaluator NaN-safe totalArea', () => {
  it('calculates totalArea without NaN when nodes have NaN w/h', async () => {
    const { LayoutEvaluator } = await import('../strategies/LayoutEvaluator');
    const evalInstance = new LayoutEvaluator({
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      nodeSeparation: 40,
      edgeSeparation: 20,
      rankSeparation: 80,
      marginX: 50,
      marginY: 50,
    });

    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 0, w: NaN, h: NaN }),
      makeNode({ id: 'b', x: 100, y: 100, w: 120, h: 60 }),
    ];

    const metrics = evalInstance.calculateLayoutMetrics(nodes, []);
    expect(Number.isFinite(metrics.totalArea)).toBe(true);
    // Node a has 0 area (NaN → 0 fallback), node b has 120*60=7200
    expect(metrics.totalArea).toBe(7200);
  });
});
