import {
  createTestNode,
  createDatumNode,
  createLayoutEdge,
  createEdgeDatum,
  createTestConfig,
  createOverlappingPositioned,
  createNonOverlappingPositioned,
  toDataNodes,
  hasAnyOverlap,
} from './test-utils';

describe('test-utils', () => {
  describe('createTestNode', () => {
    it('should create a positioned node with defaults', () => {
      const node = createTestNode('1');
      expect(node.id).toBe('node-1');
      expect(node.label).toBe('Node 1');
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.width).toBe(100);
      expect(node.height).toBe(50);
    });

    it('should create a positioned node with custom values', () => {
      const node = createTestNode('2', 100, 200, 150, 75);
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.width).toBe(150);
      expect(node.height).toBe(75);
    });
  });

  describe('createDatumNode', () => {
    it('should create a node datum with default label', () => {
      const node = createDatumNode('1');
      expect(node.id).toBe('node-1');
      expect(node.label).toBe('Node 1');
    });

    it('should create a node datum with custom label', () => {
      const node = createDatumNode('1', 'Custom');
      expect(node.label).toBe('Custom');
    });
  });

  describe('createLayoutEdge', () => {
    it('should create a layout edge', () => {
      const edge = createLayoutEdge('1', 'A', 'B');
      expect(edge.id).toBe('edge-1');
      expect(edge.from).toBe('A');
      expect(edge.to).toBe('B');
      expect(edge.source).toBe('A');
      expect(edge.target).toBe('B');
    });
  });

  describe('createEdgeDatum', () => {
    it('should create an edge datum without label', () => {
      const edge = createEdgeDatum('1', 'A', 'B');
      expect(edge.label).toBeUndefined();
    });

    it('should create an edge datum with label', () => {
      const edge = createEdgeDatum('1', 'A', 'B', 'connects');
      expect(edge.label).toBe('connects');
    });
  });

  describe('hasAnyOverlap', () => {
    it('should return false for empty array', () => {
      expect(hasAnyOverlap([])).toBe(false);
    });

    it('should return false for single node', () => {
      expect(hasAnyOverlap([createTestNode('1')])).toBe(false);
    });

    it('should return false for non-overlapping nodes', () => {
      const nodes = createNonOverlappingPositioned(4);
      expect(hasAnyOverlap(nodes)).toBe(false);
    });

    it('should return true for overlapping nodes', () => {
      const nodes = createOverlappingPositioned(4);
      expect(hasAnyOverlap(nodes)).toBe(true);
    });

    it('should return false for non-overlapping nodes with padding', () => {
      const nodes = [
        createTestNode('1', 0, 0, 100, 50),
        createTestNode('2', 200, 0, 100, 50),
      ];
      expect(hasAnyOverlap(nodes, 10)).toBe(false);
    });

    it('should return true for nodes overlapping when padding is considered', () => {
      const nodes = [
        createTestNode('1', 0, 0, 100, 50),
        createTestNode('2', 90, 0, 100, 50),
      ];
      // Without padding they might not overlap (depends on center-based positions)
      // With large padding they should
      expect(hasAnyOverlap(nodes, 100)).toBe(true);
    });
  });

  describe('createNonOverlappingPositioned', () => {
    it('should create specified number of non-overlapping nodes', () => {
      const nodes = createNonOverlappingPositioned(9);
      expect(nodes).toHaveLength(9);
      // Verify none overlap
      expect(hasAnyOverlap(nodes)).toBe(false);
    });
  });

  describe('createOverlappingPositioned', () => {
    it('should create specified number of potentially overlapping nodes', () => {
      const nodes = createOverlappingPositioned(3);
      expect(nodes).toHaveLength(3);
    });
  });

  describe('toDataNodes', () => {
    it('should convert positioned nodes to data nodes', () => {
      const positioned = [createTestNode('1'), createTestNode('2')];
      const data = toDataNodes(positioned);
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('node-1');
      expect(data[0].label).toBe('Node 1');
      // Should not have x, y, width, height
      expect('x' in data[0]).toBe(false);
    });
  });

  describe('createTestConfig', () => {
    it('should create config with defaults', () => {
      const config = createTestConfig();
      expect(config.width).toBe(1000);
      expect(config.height).toBe(800);
    });

    it('should override config values', () => {
      const config = createTestConfig({ width: 500, isSimpleMode: true });
      expect(config.width).toBe(500);
      expect(config.isSimpleMode).toBe(true);
      expect(config.height).toBe(800); // default
    });
  });
});
