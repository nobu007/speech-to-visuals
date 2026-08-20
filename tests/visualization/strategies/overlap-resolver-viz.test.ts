import { OverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { DiagramLayout, PositionedNode, DiagramType } from '@stv/core/types/diagram';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  nodeSeparation: 20,
  rankDirection: 'TB' as const,
  edgeSeparation: 10,
  rankSeparation: 50,
};

function makeOverlappingNodes(): PositionedNode[] {
  return [
    { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
    { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60 },
  ];
}

function makeLayout(nodes: PositionedNode[]): DiagramLayout {
  return {
    nodes: [...nodes],
    edges: [],
  };
}

describe('OverlapResolver (visualization/strategies)', () => {
  const resolver = new OverlapResolver(defaultConfig);

  describe('ensureZeroOverlaps', () => {
    it('should resolve overlapping nodes for flow diagrams', async () => {
      const nodes = makeOverlappingNodes();
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'flow');

      expect(result.nodes).toHaveLength(2);
      // Nodes should have been moved apart
      const n0 = result.nodes[0];
      const n1 = result.nodes[1];
      // Check they're no longer overlapping
      const overlap = n0.x < n1.x + (n1.w ?? Number.NaN) && n0.x + (n0.w ?? Number.NaN) > n1.x &&
                      n0.y < n1.y + (n1.h ?? Number.NaN) && n0.y + (n0.h ?? Number.NaN) > n1.y;
      expect(overlap).toBe(false);
    });

    it('should handle tree diagram overlaps', async () => {
      const nodes = makeOverlappingNodes();
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'tree');
      expect(result.nodes).toHaveLength(2);
    });

    it('should handle timeline diagram overlaps', async () => {
      const nodes = makeOverlappingNodes();
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'timeline');
      expect(result.nodes).toHaveLength(2);
    });

    it('should handle cycle diagram overlaps', async () => {
      const nodes = makeOverlappingNodes();
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'cycle');
      expect(result.nodes).toHaveLength(2);
    });

    it('should handle already non-overlapping nodes', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'flow');
      expect(result.nodes).toHaveLength(2);
    });

    it('should handle identical positions', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 100, y: 100, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await resolver.ensureZeroOverlaps(layout, 'flow');
      expect(result.nodes).toHaveLength(2);
      // Nodes should have been separated
      const samePos = result.nodes[0].x === result.nodes[1].x &&
                      result.nodes[0].y === result.nodes[1].y;
      expect(samePos).toBe(false);
    });
  });

  describe('finalOverlapResolution', () => {
    it('should verify and resolve remaining overlaps', async () => {
      const nodes = makeOverlappingNodes();
      const layout = makeLayout(nodes);
      const result = await resolver.finalOverlapResolution(layout);
      expect(result.nodes).toHaveLength(2);
    });

    it('should pass through non-overlapping layout', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await resolver.finalOverlapResolution(layout);
      expect(result.nodes).toHaveLength(2);
    });
  });

  describe('constrainNodeToBounds — small canvas edge case', () => {
    it('should not produce NaN when node is larger than canvas', async () => {
      // constrainNodeToBounds reads only the size fields; the remaining
      // LayoutConfig members are irrelevant to this edge case.
      const tinyConfig = {
        width: 80,
        height: 40,
        nodeWidth: 120,
        nodeHeight: 60,
        marginX: 10,
        marginY: 10,
        nodeSeparation: 5,
      } as unknown as import('@/visualization/types').LayoutConfig;
      const tinyResolver = new OverlapResolver(tinyConfig);

      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 200, y: 200, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await tinyResolver.finalOverlapResolution(layout);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      // x and y should be clamped to a valid bound, not NaN or negative
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    });
  });
});
