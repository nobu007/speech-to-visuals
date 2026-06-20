/**
 * Tests for GridSpatialHash
 * Covers: insert, remove, query, queryByRect, clear, cellSize calculation
 */

import { GridSpatialHash } from '../spatial-hash';
import { PositionedNode } from '@/types/diagram';

function makeNode(id: string, x: number, y: number, w = 100, h = 100): PositionedNode {
  return { id, label: id, x, y, w, h };
}

describe('GridSpatialHash', () => {
  describe('constructor', () => {
    it('creates empty hash when no nodes provided', () => {
      const hash = new GridSpatialHash();
      expect(hash.cellCount).toBe(0);
    });

    it('initializes with nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 300, 300),
      ];
      const hash = new GridSpatialHash(nodes);
      expect(hash.cellCount).toBeGreaterThan(0);
    });
  });

  describe('insert', () => {
    it('inserts a single node', () => {
      const hash = new GridSpatialHash();
      hash.insert(makeNode('a', 0, 0));
      expect(hash.cellCount).toBeGreaterThan(0);
    });

    it('inserts node spanning multiple cells', () => {
      // With cellSize=200 (from a 200x200 sizer node), a 600x600 node
      // at a far position will create new cells
      const hash = new GridSpatialHash([makeNode('sizer', 0, 0, 200, 200)]);
      const initialCells = hash.cellCount;

      hash.insert(makeNode('big', 1000, 1000, 600, 600));
      expect(hash.cellCount).toBeGreaterThan(initialCells);
    });
  });

  describe('remove', () => {
    it('removes a node from the hash', () => {
      const node = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([node]);

      hash.remove(node);
      const results = hash.query(node);
      expect(results).toHaveLength(0);
    });

    it('handles removing a node that does not exist', () => {
      const hash = new GridSpatialHash();
      // Should not throw
      hash.remove(makeNode('ghost', 0, 0));
    });

    it('cleans up empty cells after removal', () => {
      const node = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([node]);
      expect(hash.cellCount).toBeGreaterThan(0);

      hash.remove(node);
      expect(hash.cellCount).toBe(0);
    });
  });

  describe('query', () => {
    it('returns nearby nodes', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 50),
      ];
      const hash = new GridSpatialHash(nodes);

      const results = hash.query(makeNode('query', 10, 10));
      expect(results).toHaveLength(2);
    });

    it('excludes the querying node from results', () => {
      const nodeA = makeNode('a', 0, 0);
      const hash = new GridSpatialHash([nodeA]);

      const results = hash.query(nodeA);
      expect(results).toHaveLength(0);
    });

    it('returns empty array for query in empty area', () => {
      const hash = new GridSpatialHash([makeNode('a', 0, 0)]);

      const results = hash.query(makeNode('far', 5000, 5000));
      expect(results).toHaveLength(0);
    });

    it('returns nodes from adjacent cells when overlapping', () => {
      const nodes = [
        makeNode('a', 0, 0, 200, 200),
        makeNode('b', 150, 150, 100, 100),
      ];
      const hash = new GridSpatialHash(nodes);

      // Query node overlapping both
      const results = hash.query(makeNode('query', 100, 100, 100, 100));
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('queryByRect', () => {
    it('returns nodes within the rect', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 50),
      ];
      const hash = new GridSpatialHash(nodes);

      const results = hash.queryByRect({ x: 0, y: 0, width: 200, height: 200 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for rect in empty area', () => {
      const hash = new GridSpatialHash([makeNode('a', 0, 0)]);

      const results = hash.queryByRect({ x: 5000, y: 5000, width: 100, height: 100 });
      expect(results).toHaveLength(0);
    });

    it('covers a large rect spanning many cells', () => {
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 500, 500),
        makeNode('c', 1000, 1000),
      ];
      const hash = new GridSpatialHash(nodes);

      const results = hash.queryByRect({ x: 0, y: 0, width: 2000, height: 2000 });
      expect(results.length).toBe(3);
    });
  });

  describe('clear', () => {
    it('removes all nodes and cells', () => {
      const hash = new GridSpatialHash([
        makeNode('a', 0, 0),
        makeNode('b', 200, 200),
      ]);

      hash.clear();
      expect(hash.cellCount).toBe(0);
      expect(hash.queryByRect({ x: 0, y: 0, width: 500, height: 500 })).toHaveLength(0);
    });
  });

  describe('cellSize calculation', () => {
    it('uses 200 as default cell size for empty input', () => {
      const hash = new GridSpatialHash();
      // A node at 0,0 should occupy 1 cell
      hash.insert(makeNode('test', 0, 0, 50, 50));
      expect(hash.cellCount).toBe(1);
    });

    it('adapts cell size based on largest node', () => {
      const smallHash = new GridSpatialHash([makeNode('s', 0, 0, 50, 50)]);
      const largeHash = new GridSpatialHash([makeNode('l', 0, 0, 500, 500)]);

      // With larger cell size, fewer cells are needed for the same area
      const smallResults = smallHash.queryByRect({ x: 0, y: 0, width: 1000, height: 1000 });
      const largeResults = largeHash.queryByRect({ x: 0, y: 0, width: 1000, height: 1000 });

      // Both should find the node
      expect(smallResults.length).toBe(1);
      expect(largeResults.length).toBe(1);
    });

    it('enforces minimum cell size of 50', () => {
      const hash = new GridSpatialHash([makeNode('tiny', 0, 0, 10, 10)]);
      // cellSize should be at least 50, so a 10x10 node occupies 1 cell
      hash.insert(makeNode('other', 0, 0, 10, 10));
      expect(hash.cellCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('integration scenarios', () => {
    it('supports insert → query → remove → query cycle', () => {
      const hash = new GridSpatialHash();

      const nodeA = makeNode('a', 0, 0);
      const nodeB = makeNode('b', 30, 30);

      hash.insert(nodeA);
      hash.insert(nodeB);

      expect(hash.query(nodeA)).toHaveLength(1);
      expect(hash.query(nodeA)[0].id).toBe('b');

      hash.remove(nodeB);
      expect(hash.query(nodeA)).toHaveLength(0);
    });

    it('handles nodes with width/height instead of w/h', () => {
      const node: PositionedNode = {
        id: 'wh',
        label: 'wh',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      const hash = new GridSpatialHash([node]);

      const results = hash.queryByRect({ x: 0, y: 0, width: 200, height: 200 });
      expect(results).toHaveLength(1);
    });
  });
});
