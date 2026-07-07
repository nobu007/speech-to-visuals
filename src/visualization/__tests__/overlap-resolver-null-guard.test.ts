import { OverlapResolver } from '../strategies/OverlapResolver';
import type { DiagramLayout, DiagramType } from '@/types/diagram';
import type { LayoutConfig } from '../types';

function makeConfig(): LayoutConfig {
  return {
    width: 1920,
    height: 1080,
    nodeWidth: 160,
    nodeHeight: 60,
    marginX: 40,
    marginY: 40,
    rankDirection: 'TB',
    nodeSeparation: 30,
    edgeSeparation: 20,
    rankSeparation: 80,
  };
}

describe('OverlapResolver null-guard for layout.nodes', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver(makeConfig());
  });

  describe('ensureZeroOverlaps', () => {
    it('returns empty-node layout when layout.nodes is null', async () => {
      const layout = { nodes: null as unknown as DiagramLayout['nodes'], edges: [] };
      const result = await resolver.ensureZeroOverlaps(layout, 'flow' as DiagramType);
      expect(result.nodes).toEqual([]);
    });

    it('returns empty-node layout when layout.nodes is undefined', async () => {
      const layout = { nodes: undefined as unknown as DiagramLayout['nodes'], edges: [] };
      const result = await resolver.ensureZeroOverlaps(layout, 'flow' as DiagramType);
      expect(result.nodes).toEqual([]);
    });

    it('returns early when layout.nodes is empty array', async () => {
      const layout: DiagramLayout = { nodes: [], edges: [] };
      const result = await resolver.ensureZeroOverlaps(layout, 'flow' as DiagramType);
      expect(result.nodes).toEqual([]);
    });

    it('does not throw for null layout.nodes', async () => {
      const layout = { nodes: null as unknown as DiagramLayout['nodes'], edges: [] };
      await expect(resolver.ensureZeroOverlaps(layout, 'flow')).resolves.toBeDefined();
    });
  });

  describe('finalOverlapResolution', () => {
    it('returns empty-node layout when layout.nodes is null', async () => {
      const layout = { nodes: null as unknown as DiagramLayout['nodes'], edges: [] };
      const result = await resolver.finalOverlapResolution(layout);
      expect(result.nodes).toEqual([]);
    });

    it('returns empty-node layout when layout.nodes is undefined', async () => {
      const layout = { nodes: undefined as unknown as DiagramLayout['nodes'], edges: [] };
      const result = await resolver.finalOverlapResolution(layout);
      expect(result.nodes).toEqual([]);
    });

    it('returns early when layout.nodes is empty array', async () => {
      const layout: DiagramLayout = { nodes: [], edges: [] };
      const result = await resolver.finalOverlapResolution(layout);
      expect(result.nodes).toEqual([]);
    });

    it('does not throw for null layout.nodes', async () => {
      const layout = { nodes: null as unknown as DiagramLayout['nodes'], edges: [] };
      await expect(resolver.finalOverlapResolution(layout)).resolves.toBeDefined();
    });
  });
});
