import { OverlapResolver } from '../overlap-resolver';
import type { PositionedNode } from '@stv/core/types/diagram';

// Helper to create nodes with `width`/`height` properties
function makeNodeW(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

// Helper to create nodes with `w`/`h` properties (alternative dimension fields)
function makeNodeWh(id: string, x: number, y: number, w: number, h: number): PositionedNode {
  return { id, label: id, x, y, w, h };
}

describe('OverlapResolver', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver(100);
  });

  // ── detectOverlaps ──────────────────────────────────────────────────

  describe('detectOverlaps', () => {
    it('returns empty array for fewer than 2 nodes', () => {
      expect(resolver.detectOverlaps([])).toEqual([]);
      expect(resolver.detectOverlaps([makeNodeW('a', 0, 0, 50, 30)])).toEqual([]);
    });

    it('detects overlap between two nodes with width/height', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 50, 0, 100, 60),
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(1);
    });

    it('returns no overlap for non-overlapping nodes', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 200, 0, 100, 60),
      ];
      expect(resolver.detectOverlaps(nodes)).toEqual([]);
    });

    it('detects overlap between nodes using w/h properties', () => {
      const nodes = [
        makeNodeWh('a', 0, 0, 100, 60),
        makeNodeWh('b', 50, 0, 100, 60),
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(1);
    });

    it('detects overlap when one node uses width and other uses w', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeWh('b', 50, 0, 100, 60),
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(1);
    });

    it('does not produce duplicate pairs', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 50, 0, 100, 60),
        makeNodeW('c', 25, 0, 100, 60),
      ];
      const pairs = resolver.detectOverlaps(nodes);
      const pairKeys = pairs.map(p => [p.node1.id, p.node2.id].sort().join(':'));
      const uniqueKeys = new Set(pairKeys);
      expect(pairKeys.length).toBe(uniqueKeys.size);
    });

    it('handles touching edges (no overlap at exact boundary)', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 100, 0, 100, 60),
      ];
      expect(resolver.detectOverlaps(nodes)).toEqual([]);
    });
  });

  // ── getOverlapCount ─────────────────────────────────────────────────

  describe('getOverlapCount', () => {
    it('returns 0 for non-overlapping nodes', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 200, 200, 100, 60),
      ];
      expect(resolver.getOverlapCount(nodes)).toBe(0);
    });

    it('returns correct count for multiple overlaps', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 50, 0, 100, 60),
        makeNodeW('c', 25, 0, 100, 60),
      ];
      const count = resolver.getOverlapCount(nodes);
      expect(count).toBeGreaterThan(0);
    });

    it('returns correct count using w/h properties', () => {
      const nodes = [
        makeNodeWh('a', 0, 0, 100, 60),
        makeNodeWh('b', 50, 0, 100, 60),
      ];
      expect(resolver.getOverlapCount(nodes)).toBe(1);
    });
  });

  // ── resolve ─────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('returns nodes unchanged for fewer than 2 nodes', () => {
      const single = [makeNodeW('a', 0, 0, 100, 60)];
      const result = resolver.resolve(single);
      expect(result).toEqual(single);
    });

    it('resolves overlaps and produces zero-overlap layout', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 0, 0, 100, 60),
      ];
      const result = resolver.resolve(nodes);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('resolves overlaps for nodes using w/h properties', () => {
      const nodes = [
        makeNodeWh('a', 0, 0, 100, 60),
        makeNodeWh('b', 0, 0, 100, 60),
      ];
      const result = resolver.resolve(nodes);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('resolves multiple overlapping nodes', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 10, 10, 100, 60),
        makeNodeW('c', 20, 20, 100, 60),
        makeNodeW('d', 30, 30, 100, 60),
      ];
      const result = resolver.resolve(nodes);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('preserves node count after resolution', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 0, 0, 100, 60),
        makeNodeW('c', 0, 0, 100, 60),
      ];
      const result = resolver.resolve(nodes);
      expect(result).toHaveLength(3);
    });

    it('preserves node ids after resolution', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 0, 0, 100, 60),
      ];
      const result = resolver.resolve(nodes);
      const ids = result.map(n => n.id).sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('applies grid-snap fallback when repulsion cannot resolve', () => {
      // Create a scenario with many overlapping nodes that repulsion may struggle with
      const nodes = Array.from({ length: 20 }, (_, i) =>
        makeNodeW(`n${i}`, 0, 0, 120, 80),
      );
      const result = resolver.resolve(nodes);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('does not mutate input nodes', () => {
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 0, 0, 100, 60),
      ];
      const originalX = nodes[0].x;
      resolver.resolve(nodes);
      expect(nodes[0].x).toBe(originalX);
    });
  });

  // ── Mixed dimension properties ──────────────────────────────────────

  describe('mixed width/w and height/h properties', () => {
    it('detects overlap when nodes have mixed dimension property names', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'a', x: 0, y: 0, width: 100, h: 60 },
        { id: 'b', label: 'b', x: 50, y: 0, w: 100, height: 60 },
      ];
      const pairs = resolver.detectOverlaps(nodes);
      expect(pairs).toHaveLength(1);
    });

    it('resolves overlaps when nodes have mixed dimension property names', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'a', x: 0, y: 0, width: 100, h: 60 },
        { id: 'b', label: 'b', x: 0, y: 0, w: 100, height: 60 },
      ];
      const result = resolver.resolve(nodes);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('handles nodes with no dimension properties (defaults to 0)', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 0, y: 0 },
      ];
      // Zero-size nodes at same position — no overlap since w=h=0
      expect(resolver.detectOverlaps(nodes)).toEqual([]);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles single-node resolve', () => {
      const result = resolver.resolve([makeNodeW('solo', 50, 50, 100, 60)]);
      expect(result).toHaveLength(1);
      expect(result[0].x).toBe(50);
    });

    it('handles empty array resolve', () => {
      expect(resolver.resolve([])).toEqual([]);
    });

    it('handles large node count without hanging', () => {
      const nodes = Array.from({ length: 50 }, (_, i) =>
        makeNodeW(`n${i}`, (i % 5) * 10, Math.floor(i / 5) * 10, 80, 50),
      );
      const result = resolver.resolve(nodes);
      expect(result).toHaveLength(50);
      expect(resolver.getOverlapCount(result)).toBe(0);
    });

    it('grid-snap fallback produces valid grid layout', () => {
      // Force the fallback by using identical positions for all nodes
      const nodes = Array.from({ length: 10 }, (_, i) =>
        makeNodeW(`n${i}`, 0, 0, 100, 60),
      );
      const result = resolver.resolve(nodes);
      // All nodes should have unique positions
      const positions = new Set(result.map(n => `${n.x},${n.y}`));
      expect(positions.size).toBe(10);
    });
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts custom maxIterations', () => {
      const r = new OverlapResolver(5);
      const nodes = [
        makeNodeW('a', 0, 0, 100, 60),
        makeNodeW('b', 0, 0, 100, 60),
      ];
      const result = r.resolve(nodes);
      expect(result).toHaveLength(2);
    });

    it('uses default maxIterations when omitted', () => {
      const r = new OverlapResolver();
      expect(r).toBeDefined();
    });
  });
});
