import {
  getImportance,
  importanceSizeScale,
  importanceWeight,
  scaledDimensions,
  isHighImportance,
  isLowImportance,
  pickHighestImportance,
} from '@/visualization/importance-scaler';
import { NodeDatum } from '@stv/core/types/diagram';

const node = (id: string, importance?: number): NodeDatum => ({
  id,
  label: `Node ${id}`,
  ...(importance !== undefined ? { meta: { importance } } : {}),
});

describe('importance-scaler', () => {
  describe('getImportance', () => {
    it('returns the node importance when set', () => {
      expect(getImportance(node('a', 0.8))).toBe(0.8);
    });

    it('returns 0.5 default when importance is undefined', () => {
      expect(getImportance(node('a'))).toBe(0.5);
    });

    it('clamps values above 1 to 1', () => {
      expect(getImportance(node('a', 2.0))).toBe(1);
    });

    it('clamps negative values to 0', () => {
      expect(getImportance(node('a', -0.5))).toBe(0);
    });

    it('treats NaN as default', () => {
      expect(getImportance(node('a', Number.NaN))).toBe(0.5);
    });
  });

  describe('importanceSizeScale', () => {
    it('returns MIN_SCALE for importance 0', () => {
      expect(importanceSizeScale(node('a', 0))).toBeCloseTo(0.75);
    });

    it('returns MAX_SCALE for importance 1', () => {
      expect(importanceSizeScale(node('a', 1))).toBeCloseTo(1.5);
    });

    it('returns intermediate value for default importance', () => {
      const scale = importanceSizeScale(node('a'));
      expect(scale).toBeGreaterThan(0.75);
      expect(scale).toBeLessThan(1.5);
    });
  });

  describe('importanceWeight', () => {
    it('returns 0.5 for importance 0', () => {
      expect(importanceWeight(node('a', 0))).toBeCloseTo(0.5);
    });

    it('returns 2.0 for importance 1', () => {
      expect(importanceWeight(node('a', 1))).toBeCloseTo(2.0);
    });
  });

  describe('scaledDimensions', () => {
    it('scales base dimensions by importance', () => {
      const dim = scaledDimensions(node('a', 1), 120, 60);
      expect(dim.width).toBe(180); // 120 * 1.5
      expect(dim.height).toBe(90); // 60 * 1.5
    });

    it('uses minimum scale for zero importance', () => {
      const dim = scaledDimensions(node('a', 0), 120, 60);
      expect(dim.width).toBe(90); // 120 * 0.75
      expect(dim.height).toBe(45); // 60 * 0.75
    });
  });

  describe('isHighImportance', () => {
    it('returns true for importance > 0.5', () => {
      expect(isHighImportance(node('a', 0.8))).toBe(true);
    });

    it('returns false for importance <= 0.5', () => {
      expect(isHighImportance(node('a', 0.5))).toBe(false);
    });

    it('returns false for default importance', () => {
      expect(isHighImportance(node('a'))).toBe(false);
    });
  });

  describe('isLowImportance', () => {
    it('returns true for importance < 0.3', () => {
      expect(isLowImportance(node('a', 0.1))).toBe(true);
    });

    it('returns false for importance >= 0.3', () => {
      expect(isLowImportance(node('a', 0.3))).toBe(false);
    });
  });

  describe('pickHighestImportance', () => {
    it('picks the node with highest importance', () => {
      const nodes = [node('a', 0.2), node('b', 0.9), node('c', 0.5)];
      expect(pickHighestImportance(nodes).id).toBe('b');
    });

    it('picks first node when all equal', () => {
      const nodes = [node('a', 0.5), node('b', 0.5)];
      expect(pickHighestImportance(nodes).id).toBe('a');
    });

    it('picks explicitly important over default', () => {
      const nodes = [node('a'), node('b', 0.7)];
      expect(pickHighestImportance(nodes).id).toBe('b');
    });

    it('throws on empty array', () => {
      expect(() => pickHighestImportance([])).toThrow('Cannot pick from empty node list');
    });
  });
});

describe('MindMapStrategy importance-aware layout', () => {
  // Use dynamic import to get the module after modifications
  let MindMapStrategy: typeof import('@/visualization/strategies/mindmap-strategy').MindMapStrategy | undefined;
  beforeAll(async () => {
    const mod = await import('@/visualization/strategies/mindmap-strategy');
    MindMapStrategy = mod.MindMapStrategy;
  });

  it('scales high-importance nodes larger', () => {
    const strategy = new MindMapStrategy();
    const nodes: NodeDatum[] = [
      node('root', 1.0),
      node('child1', 0.3),
      node('child2', 0.9),
    ];
    const edges = [
      { from: 'root', to: 'child1' },
      { from: 'root', to: 'child2' },
    ];

    const result = strategy.apply(nodes, edges);
    const root = result.nodes.find(n => n.id === 'root')!;
    const child1 = result.nodes.find(n => n.id === 'child1')!;

    // Root (importance 1.0) should be larger than child1 (importance 0.3)
    expect(root.width!).toBeGreaterThan(child1.width!);
    expect(root.height!).toBeGreaterThan(child1.height!);
  });

  it('selects high-importance node as root over low-importance high-degree node', () => {
    const strategy = new MindMapStrategy();
    const nodes: NodeDatum[] = [
      node('a', 0.1),  // low importance
      node('b', 1.0),  // high importance
      node('c', 0.2),  // low importance
    ];
    // 'b' connects to both others → degree 2 + high importance
    // 'a' connects to both others → degree 2 + low importance
    // Score for b: 2 * (0.5 + 1.0) = 3.0 (should be root)
    // Score for a: 2 * (0.5 + 0.1) = 1.2
    const edges = [
      { from: 'b', to: 'a' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ];

    const result = strategy.apply(nodes, edges);

    // The 'b' node should be at center (it's the root due to high importance)
    const bNode = result.nodes.find(n => n.id === 'b')!;
    const cx = 1920 / 2;
    const cy = 1080 / 2;
    const distB = Math.sqrt(
      (bNode.x + bNode.width! / 2 - cx) ** 2 +
      (bNode.y + bNode.height! / 2 - cy) ** 2,
    );
    // Root should be at center
    expect(distB).toBeLessThan(100);
  });
});

describe('NetworkStrategy importance-aware layout', () => {
  let NetworkStrategy: typeof import('@/visualization/strategies/network-strategy').NetworkStrategy | undefined;
  beforeAll(async () => {
    const mod = await import('@/visualization/strategies/network-strategy');
    NetworkStrategy = mod.NetworkStrategy;
  });

  it('scales high-importance nodes larger than low-importance nodes', () => {
    const strategy = new NetworkStrategy();
    const nodes: NodeDatum[] = [
      node('important', 1.0),
      node('normal', 0.5),
      node('minor', 0.1),
    ];
    const edges = [
      { from: 'important', to: 'normal' },
      { from: 'normal', to: 'minor' },
    ];

    const result = strategy.apply(nodes, edges);
    const important = result.nodes.find(n => n.id === 'important')!;
    const minor = result.nodes.find(n => n.id === 'minor')!;

    expect(important.width!).toBeGreaterThan(minor.width!);
    expect(important.height!).toBeGreaterThan(minor.height!);
  });

  it('places high-importance nodes closer to center initially', () => {
    const strategy = new NetworkStrategy();
    const nodes: NodeDatum[] = [
      node('a', 1.0),
      node('b', 0.0),
    ];

    // Access private method via initializeCircle
    const positioned = (strategy as unknown as { initializeCircle(n: LayoutNode[]): LayoutNode[] }).initializeCircle(nodes);
    const cx = 1920 / 2;
    const cy = 1080 / 2;

    const distA = Math.sqrt(
      (positioned[0].x + positioned[0].width / 2 - cx) ** 2 +
      (positioned[0].y + positioned[0].height / 2 - cy) ** 2,
    );
    const distB = Math.sqrt(
      (positioned[1].x + positioned[1].width / 2 - cx) ** 2 +
      (positioned[1].y + positioned[1].height / 2 - cy) ** 2,
    );

    // Node 'a' (importance 1.0) should start closer to center than 'b' (0.0)
    expect(distA).toBeLessThan(distB);
  });

  it('maintains zero overlap for simple graph', () => {
    const strategy = new NetworkStrategy();
    const nodes: NodeDatum[] = Array.from({ length: 6 }, (_, i) =>
      node(`n${i}`, 0.3 + i * 0.12),
    );
    const edges = [
      { from: 'n0', to: 'n1' },
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ];

    const result = strategy.apply(nodes, edges);
    expect(result.metrics.overlapCount).toBe(0);
    expect(result.nodes).toHaveLength(6);
  });
});
