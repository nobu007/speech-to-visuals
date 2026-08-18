/**
 * Regression: spatial-grid overlap detector must not miss wide nodes.
 *
 * detectOverlapsWithSpatialGrid previously registered each node in the SINGLE
 * cell containing its top-left corner and only probed ±1 neighbor cells. A node
 * wider than `cellSize` (defaults: max(nodeWidth,nodeHeight,120) + minSpacing =
 * 120 + 40 = 160) spans several cells but was registered in only one, so a node
 * placed two cells away was never reached by the ±1 probe — the overlap was
 * silently missed and the "zero-overlap guarantee" reported success on an
 * overlapping layout. Real node widths reach up to 2× the configured nodeWidth
 * (calculateNodeWidth → baseWidth * 2 = 240), so this is the common case.
 *
 * The fix inserts each node into EVERY cell its bounding box covers, then probes
 * exactly those cells — the standard uniform-grid broad phase, which guarantees
 * two overlapping nodes always share a cell.
 */
import { describe, it, expect } from '@jest/globals';
import { ZeroOverlapLayoutEngine } from '../enhanced-zero-overlap-layout';
import type { PositionedNode } from '@stv/core/types/diagram';

function makeNode(overrides: Partial<PositionedNode>): PositionedNode {
  return { id: 'x', label: 'N', x: 0, y: 0, w: 120, h: 60, ...overrides };
}

/** Bound the private detector so we can exercise it directly. */
function detector(engine: ZeroOverlapLayoutEngine) {
  return (engine as unknown as {
    detectAllOverlaps: (nodes: PositionedNode[]) => { node1: PositionedNode; node2: PositionedNode }[];
  }).detectAllOverlaps.bind(engine);
}

const hasPair = (
  overlaps: { node1: PositionedNode; node2: PositionedNode }[],
  a: string,
  b: string,
) => overlaps.some(({ node1, node2 }) =>
  (node1.id === a && node2.id === b) || (node1.id === b && node2.id === a));

describe('detectAllOverlaps — spatial grid must cover wide nodes', () => {
  it('detects an overlap between a wide node and a node two cells away', () => {
    // Defaults: nodeWidth=120, nodeToNode=40 → cellSize = 120 + 40 = 160.
    const engine = new ZeroOverlapLayoutEngine();
    const detect = detector(engine);

    // A is 240px wide (> cellSize 160). Its box X = [159, 399] spans grid cells
    // 0..2, but the buggy detector registered only its top-left cell 0.
    const A = makeNode({ id: 'A', x: 159, y: 0, w: 240, h: 60 });
    // B's box X = [330, 450] sits in cell 2 — two cells from A's top-left cell 0.
    const B = makeNode({ id: 'B', x: 330, y: 0, w: 120, h: 60 });
    // A and B overlap in X over [330, 399].
    // Fillers (≥5 nodes total to engage the spatial-grid path) far from everything.
    const fillers = [
      makeNode({ id: 'f1', x: 1000, y: 1000 }),
      makeNode({ id: 'f2', x: 1400, y: 1000 }),
      makeNode({ id: 'f3', x: 1000, y: 700 }),
    ];

    const overlaps = detect([A, B, ...fillers]);
    expect(hasPair(overlaps, 'A', 'B')).toBe(true);
  });

  it('agrees with brute-force detection on a dense set of wide nodes', () => {
    const wide: PositionedNode[] = [
      makeNode({ id: 'n0', x: 150, y: 0, w: 240, h: 60 }),
      makeNode({ id: 'n1', x: 330, y: 0, w: 220, h: 60 }),
      makeNode({ id: 'n2', x: 500, y: 0, w: 240, h: 60 }),
      makeNode({ id: 'n3', x: 150, y: 40, w: 230, h: 60 }),
      makeNode({ id: 'n4', x: 400, y: 50, w: 240, h: 60 }),
      makeNode({ id: 'n5', x: 700, y: 0, w: 240, h: 60 }),
      makeNode({ id: 'n6', x: 720, y: 30, w: 240, h: 60 }),
    ];

    const gridEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: true });
    const bruteEngine = new ZeroOverlapLayoutEngine({ spatialIndexing: false });

    const gridOverlaps = detector(gridEngine)(wide);
    const bruteOverlaps = detector(bruteEngine)(wide);

    const count = (o: typeof gridOverlaps) => o.length;
    // The spatial grid must find at least every pair the exhaustive brute-force finds.
    expect(count(gridOverlaps)).toBe(count(bruteOverlaps));
    for (const { node1, node2 } of bruteOverlaps) {
      expect(hasPair(gridOverlaps, node1.id, node2.id)).toBe(true);
    }
  });

  it('reports no overlaps for well-separated wide nodes (no false positives)', () => {
    const engine = new ZeroOverlapLayoutEngine();
    const detect = detector(engine);
    const nodes: PositionedNode[] = [
      makeNode({ id: 'a', x: 0, y: 0, w: 240, h: 60 }),
      makeNode({ id: 'b', x: 500, y: 0, w: 240, h: 60 }),
      makeNode({ id: 'c', x: 0, y: 500, w: 240, h: 60 }),
      makeNode({ id: 'd', x: 500, y: 500, w: 240, h: 60 }),
      makeNode({ id: 'e', x: 1000, y: 1000, w: 240, h: 60 }),
    ];
    expect(detect(nodes).length).toBe(0);
  });
});
