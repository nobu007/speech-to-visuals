/**
 * Tests for TreeLayoutStrategy w/h property fallback
 * Verifies that explicit NodeDatum.width and NodeDatum.height are respected
 * and that the fallback to config defaults works when they're absent.
 */

import { jest } from '@jest/globals';

const { TreeLayoutStrategy } = await import('../TreeLayoutStrategy');
import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import type { LayoutConfig } from '../../types';

describe('TreeLayoutStrategy w/h property fallback', () => {
  let strategy: InstanceType<typeof TreeLayoutStrategy>;

  beforeEach(() => {
    strategy = new TreeLayoutStrategy();
  });

  const baseConfig: LayoutConfig = {
    width: 800,
    height: 600,
    nodeWidth: 120,
    nodeHeight: 60,
    rankSeparation: 100,
    nodeSeparation: 80,
  };

  // Helper: simple 2-level tree
  function makeTree(
    rootOverride?: Partial<NodeDatum>,
    childOverride?: Partial<NodeDatum>
  ): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    const nodes: NodeDatum[] = [
      { id: 'root', label: 'Root', ...rootOverride },
      { id: 'child1', label: 'Child 1', ...childOverride },
      { id: 'child2', label: 'Child 2', ...childOverride },
    ];
    const edges: EdgeDatum[] = [
      { from: 'root', to: 'child1' },
      { from: 'root', to: 'child2' },
    ];
    return { nodes, edges };
  }

  describe('explicit width/height override', () => {
    it('should respect explicit node.width on root', async () => {
      const { nodes, edges } = makeTree({ width: 200 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.width).toBe(200);
      expect(root.w).toBe(200);
    });

    it('should respect explicit node.height on root', async () => {
      const { nodes, edges } = makeTree({ height: 100 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.height).toBe(100);
      expect(root.h).toBe(100);
    });

    it('should respect explicit width on child nodes', async () => {
      const { nodes, edges } = makeTree(undefined, { width: 150 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const child1 = result.nodes.find(n => n.id === 'child1')!;
      expect(child1.width).toBe(150);
    });

    it('should respect explicit height on child nodes', async () => {
      const { nodes, edges } = makeTree(undefined, { height: 80 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const child1 = result.nodes.find(n => n.id === 'child1')!;
      expect(child1.height).toBe(80);
    });

    it('should fall back to config.nodeWidth when no explicit width', async () => {
      const { nodes, edges } = makeTree();
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const child1 = result.nodes.find(n => n.id === 'child1')!;
      // Without explicit width, falls back to config.nodeWidth (120) or text-width calculation
      expect(child1.width).toBeGreaterThanOrEqual(120);
    });

    it('should fall back to config.nodeHeight when no explicit height', async () => {
      const { nodes, edges } = makeTree();
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const child1 = result.nodes.find(n => n.id === 'child1')!;
      expect(child1.height).toBe(60);
    });
  });

  describe('invalid width/height values', () => {
    it('should ignore NaN width and fall back to calculated width', async () => {
      const { nodes, edges } = makeTree({ width: NaN });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(Number.isFinite(root.width!)).toBe(true);
      expect(root.width).toBeGreaterThanOrEqual(120);
    });

    it('should ignore Infinity width and fall back to calculated width', async () => {
      const { nodes, edges } = makeTree({ width: Infinity });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(Number.isFinite(root.width!)).toBe(true);
    });

    it('should ignore negative width and fall back to calculated width', async () => {
      const { nodes, edges } = makeTree({ width: -50 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.width!).toBeGreaterThan(0);
    });

    it('should ignore zero width and fall back to calculated width', async () => {
      const { nodes, edges } = makeTree({ width: 0 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.width!).toBeGreaterThan(0);
    });

    it('should ignore NaN height and fall back to config', async () => {
      const { nodes, edges } = makeTree({ height: NaN });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.height).toBe(60);
    });

    it('should ignore Infinity height and fall back to config', async () => {
      const { nodes, edges } = makeTree({ height: Infinity });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.height).toBe(60);
    });
  });

  describe('output consistency', () => {
    it('should set both w and width to the same value', async () => {
      const { nodes, edges } = makeTree({ width: 180, height: 90 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.w).toBe(root.width);
    });

    it('should set both h and height to the same value', async () => {
      const { nodes, edges } = makeTree({ width: 180, height: 90 });
      const result = await strategy.generateLayout(nodes, edges, baseConfig);
      const root = result.nodes.find(n => n.id === 'root')!;
      expect(root.h).toBe(root.height);
    });
  });
});
