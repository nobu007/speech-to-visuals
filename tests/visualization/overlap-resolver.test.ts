import { describe, it, expect } from '@jest/globals';
import { PositionedNode } from '@/types/diagram';
import { OverlapResolver } from '@/visualization/overlap-resolver';
import { GridSpatialHash } from '@/visualization/spatial-hash';

function makeNode(id: string, x: number, y: number, w = 100, h = 50): PositionedNode {
  return { id, label: id, x, y, width: w, height: h };
}

describe('OverlapResolver (TASK-0029)', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver(100);
  });

  describe('Overlap detection', () => {
    it('should detect overlapping pair', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0), // overlaps with a
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].node1.id).toBe('a');
      expect(pairs[0].node2.id).toBe('b');
    });

    it('should not detect non-overlapping nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 0), // no overlap
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(0);
    });

    it('should detect multiple overlaps', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0), // overlaps with a
        makeNode('c', 25, 0), // overlaps with both a and b
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Overlap resolution', () => {
    it('should resolve overlaps to zero', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0), // overlaps with a
      ];
      const resolved = resolver.resolve(nodes);
      const overlaps = resolver.detectOverlaps(resolved);
      expect(overlaps).toHaveLength(0);
    });

    it('should respect iteration limit', () => {
      const resolver100 = new OverlapResolver(100);
      const nodes = Array.from({ length: 20 }, (_, i) =>
        makeNode(`n${i}`, i * 10, 0) // all overlapping at origin area
      );
      const resolved = resolver100.resolve(nodes);
      const overlaps = resolver100.detectOverlaps(resolved);
      expect(overlaps).toHaveLength(0); // Grid-snap fallback guarantees this
    });

    it('should handle large graph (50+ nodes) within time', () => {
      const nodes = Array.from({ length: 50 }, (_, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        return makeNode(`n${i}`, col * 30, row * 20); // many overlaps
      });

      const start = performance.now();
      const resolved = resolver.resolve(nodes);
      const elapsed = performance.now() - start;

      const overlaps = resolver.detectOverlaps(resolved);
      expect(overlaps).toHaveLength(0);
      expect(elapsed).toBeLessThan(2000); // 2 second limit
    });

    it('should handle empty graph', () => {
      const resolved = resolver.resolve([]);
      expect(resolved).toHaveLength(0);
    });

    it('should handle single node', () => {
      const nodes = [makeNode('a', 0, 0)];
      const resolved = resolver.resolve(nodes);
      expect(resolved).toHaveLength(1);
    });
  });

  describe('getOverlapCount', () => {
    it('should return correct overlap count', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0),
      ];
      expect(resolver.getOverlapCount(nodes)).toBe(1);
    });

    it('should return 0 for non-overlapping nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 0),
      ];
      expect(resolver.getOverlapCount(nodes)).toBe(0);
    });
  });
});

describe('GridSpatialHash (TASK-0029)', () => {
  it('should find nearby nodes', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 50, 0), // nearby
      makeNode('c', 500, 0), // far
    ];
    const hash = new GridSpatialHash(nodes);
    const nearby = hash.query(nodes[0]);
    expect(nearby.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle insert and remove', () => {
    const node = makeNode('a', 0, 0);
    const hash = new GridSpatialHash();
    hash.insert(node);
    let nearby = hash.query(node);
    // querying itself should return empty (excludes self)
    expect(nearby).toHaveLength(0);

    const node2 = makeNode('b', 10, 0);
    hash.insert(node2);
    nearby = hash.query(node);
    expect(nearby.length).toBeGreaterThanOrEqual(1);

    hash.remove(node2);
    nearby = hash.query(node);
    expect(nearby).toHaveLength(0);
  });

  it('should clear all entries', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100)];
    const hash = new GridSpatialHash(nodes);
    hash.clear();
    expect(hash.cellCount).toBe(0);
  });
});
