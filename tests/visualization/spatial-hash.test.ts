import { GridSpatialHash, Rect } from '@/visualization/spatial-hash';
import { PositionedNode } from '@stv/core/types/diagram';

function makeNode(id: string, x: number, y: number, w = 40, h = 30): PositionedNode {
  return { id, label: id, x, y, width: w, height: h };
}

function makeNodeWH(id: string, x: number, y: number, w: number, h: number): PositionedNode {
  return { id, label: id, x, y, w, h };
}

describe('GridSpatialHash', () => {
  describe('constructor', () => {
    it('creates empty hash with no nodes', () => {
      const hash = new GridSpatialHash();
      expect(hash.cellCount).toBe(0);
    });

    it('inserts initial nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 200),
      ];
      const hash = new GridSpatialHash(nodes);
      expect(hash.cellCount).toBeGreaterThan(0);
    });
  });

  describe('insert', () => {
    it('adds a node to the grid', () => {
      const hash = new GridSpatialHash();
      hash.insert(makeNode('a', 0, 0));
      expect(hash.cellCount).toBeGreaterThan(0);
    });

    it('places large nodes in multiple cells', () => {
      const hash = new GridSpatialHash();
      // cellSize defaults to 200 for empty, so a 500x500 node spans multiple cells
      hash.insert({ id: 'big', label: 'big', x: 0, y: 0, width: 500, height: 500 });
      expect(hash.cellCount).toBeGreaterThan(1);
    });
  });

  describe('remove', () => {
    it('removes a node from the grid', () => {
      const node = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([node]);
      const cellsBefore = hash.cellCount;

      hash.remove(node);
      expect(hash.cellCount).toBeLessThanOrEqual(cellsBefore);
    });

    it('cleans up empty cells', () => {
      const node = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([node]);
      hash.remove(node);
      expect(hash.cellCount).toBe(0);
    });
  });

  describe('query', () => {
    it('returns nearby nodes', () => {
      const a = makeNode('a', 0, 0);
      const b = makeNode('b', 20, 20);
      const hash = new GridSpatialHash([a, b]);

      const neighbors = hash.query(a);
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('b');
    });

    it('excludes the queried node', () => {
      const a = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([a]);

      const neighbors = hash.query(a);
      expect(neighbors).toHaveLength(0);
    });

    it('returns empty for distant nodes', () => {
      const a = makeNode('a', 0, 0);
      const b = makeNode('b', 5000, 5000);
      const hash = new GridSpatialHash([a, b]);

      const neighbors = hash.query(a);
      expect(neighbors).toHaveLength(0);
    });

    it('returns multiple overlapping neighbors', () => {
      const a = makeNode('a', 100, 100);
      const b = makeNode('b', 110, 110);
      const c = makeNode('c', 120, 120);
      const hash = new GridSpatialHash([a, b, c]);

      const neighbors = hash.query(a);
      expect(neighbors.map(n => n.id).sort()).toEqual(['b', 'c']);
    });
  });

  describe('queryByRect', () => {
    it('returns nodes overlapping the rect', () => {
      const a = makeNode('a', 0, 0);
      const b = makeNode('b', 200, 200);
      const hash = new GridSpatialHash([a, b]);

      const rect: Rect = { x: -10, y: -10, width: 50, height: 50 };
      const results = hash.queryByRect(rect);
      expect(results.map(n => n.id)).toContain('a');
      expect(results.map(n => n.id)).not.toContain('b');
    });

    it('returns all nodes for a large rect', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 200, 200),
        makeNode('c', 400, 400),
      ];
      const hash = new GridSpatialHash(nodes);

      const rect: Rect = { x: -100, y: -100, width: 1000, height: 1000 };
      const results = hash.queryByRect(rect);
      expect(results).toHaveLength(3);
    });

    it('returns empty for rect in empty area', () => {
      const hash = new GridSpatialHash([makeNode('a', 0, 0)]);
      const rect: Rect = { x: 9000, y: 9000, width: 100, height: 100 };
      expect(hash.queryByRect(rect)).toHaveLength(0);
    });
  });

  describe('w/h field support', () => {
    it('handles nodes with w/h instead of width/height', () => {
      const a = makeNodeWH('a', 0, 0, 60, 60);
      const b = makeNodeWH('b', 30, 30, 60, 60);
      const hash = new GridSpatialHash([a, b]);

      const neighbors = hash.query(a);
      expect(neighbors.map(n => n.id)).toContain('b');
    });

    it('calculates cell size from w/h fields', () => {
      const nodes = [makeNodeWH('a', 0, 0, 300, 300)];
      const hash = new GridSpatialHash(nodes);
      // Cell size should be at least 300 (the max of w/h)
      expect(hash.cellCount).toBeGreaterThanOrEqual(1);
    });

    it('inserts and queries nodes with w/h correctly', () => {
      const a: PositionedNode = { id: 'a', label: 'a', x: 0, y: 0, w: 200, h: 200 };
      const b: PositionedNode = { id: 'b', label: 'b', x: 100, y: 100, w: 200, h: 200 };
      const hash = new GridSpatialHash([a, b]);

      const neighbors = hash.query(a);
      expect(neighbors.map(n => n.id)).toContain('b');
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const hash = new GridSpatialHash([
        makeNode('a', 0, 0),
        makeNode('b', 100, 100),
      ]);
      hash.clear();
      expect(hash.cellCount).toBe(0);
    });
  });
});
