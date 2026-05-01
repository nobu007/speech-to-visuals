import { describe, it, expect } from '@jest/globals';
import { OverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { DiagramLayout, PositionedNode, DiagramType } from '@/types/diagram';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  nodeSeparation: 20,
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
      const overlap = n0.x < n1.x + n1.w && n0.x + n0.w > n1.x &&
                      n0.y < n1.y + n1.h && n0.y + n0.h > n1.y;
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
});
