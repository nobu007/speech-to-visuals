import { BaseLayoutStrategy } from '../../visualization/layout/strategies/LayoutStrategy';
import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge, DiagramLayout } from '../../types/diagram';
import { LayoutConfig, LayoutResult } from '../../visualization/types';
import { createTestConfig, createTestNode, createLayoutEdge } from './test-utils';

/**
 * Concrete test implementation of BaseLayoutStrategy
 */
class TestableStrategy extends BaseLayoutStrategy {
  readonly name = 'test-strategy';
  readonly canEscapeLocalMinimum = true;

  private shouldThrow: boolean;

  constructor(shouldThrow = false) {
    super();
    this.shouldThrow = shouldThrow;
  }

  protected async performLayout(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    _config: LayoutConfig,
    _existingLayout?: DiagramLayout
  ): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
    if (this.shouldThrow) {
      throw new Error('Layout failed');
    }
    return { nodes, edges };
  }
}

describe('BaseLayoutStrategy', () => {
  let strategy: TestableStrategy;
  const config = createTestConfig();

  beforeEach(() => {
    strategy = new TestableStrategy();
  });

  // ---------- apply() happy path ----------
  it('returns a LayoutResult for normal inputs', async () => {
    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ];
    const edges: EdgeDatum[] = [
      { id: 'e1', from: 'n1', to: 'n2', source: 'n1', target: 'n2' },
    ];

    const result: LayoutResult = await strategy.apply(nodes, edges, config);

    // Both nodes get x=0,y=0 from ensurePositionedNode, so they overlap
    // success = overlapCount === 0; therefore it may be false
    expect(typeof result.success).toBe('boolean');
    expect(result.layout.nodes.length).toBe(2);
    expect(result.layout.edges.length).toBe(1);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
    expect(result.bounds).toBeDefined();
    expect(result.metrics).toBeDefined();
  });

  // ---------- apply() catch / fallback (lines 128-153) ----------
  it('returns fallback layout with success=false when performLayout throws', async () => {
    const failingStrategy = new TestableStrategy(true /* shouldThrow */);

    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'Node 1' },
    ];
    const edges: EdgeDatum[] = [];

    const result = await failingStrategy.apply(nodes, edges, config);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Layout failed');
    expect(result.layout.nodes.length).toBe(1);
    // The fallback assigns x=0, y=0, width/height from config
    expect(result.layout.nodes[0].x).toBe(0);
    expect(result.layout.nodes[0].y).toBe(0);
    expect(result.layout.nodes[0].width).toBe(config.nodeWidth);
    expect(result.layout.nodes[0].height).toBe(config.nodeHeight);
    expect(result.bounds).toEqual({ width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  // ---------- apply() catch with non-Error error (line 151) ----------
  it('returns "Unknown error occurred" when thrown value is not an Error', async () => {
    class ThrowingNonError extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        throw 'string error'; // eslint-disable-line no-throw-literal
      }
    }

    const s = new ThrowingNonError(false);
    const result = await s.apply([{ id: 'a', label: 'A' }], [], config);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error occurred');
  });

  // ---------- apply() catch fallback edges ----------
  it('maps edges in fallback with proper from/to resolution', async () => {
    class AlwaysFail extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        throw new Error('fail');
      }
    }

    const s = new AlwaysFail(false);
    const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges: EdgeDatum[] = [
      { id: 'e1', source: 'a', target: 'b', label: 'test', type: 'solid' },
    ];

    const result = await s.apply(nodes, edges, config);
    expect(result.layout.edges.length).toBe(1);
    expect(result.layout.edges[0].from).toBe('a');
    expect(result.layout.edges[0].to).toBe('b');
    expect(result.layout.edges[0].points).toEqual([]);
  });

  // ---------- calculateBoundingBox empty (line 258) ----------
  it('calculateBoundingBox returns zeros for empty node list', async () => {
    // Call apply with no nodes to trigger calculateMetrics on empty nodes
    const result = await strategy.apply([], [], config);
    expect(result.bounds).toEqual({ width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  // ---------- getDefaultConfig switch branches (lines 287-339) ----------
  it('returns flow config with LR rankDirection for "flow"', () => {
    const cfg = strategy.getDefaultConfig('flow');
    expect(cfg.rankDirection).toBe('LR');
    expect(cfg.nodeSeparation).toBe(40);
    expect(cfg.rankSeparation).toBe(80);
  });

  it('returns tree config with TB rankDirection for "tree"', () => {
    const cfg = strategy.getDefaultConfig('tree');
    expect(cfg.rankDirection).toBe('TB');
    expect(cfg.nodeSeparation).toBe(30);
    expect(cfg.rankSeparation).toBe(100);
  });

  it('returns timeline config for "timeline"', () => {
    const cfg = strategy.getDefaultConfig('timeline');
    expect(cfg.rankDirection).toBe('LR');
    expect(cfg.nodeSeparation).toBe(20);
    expect(cfg.rankSeparation).toBe(120);
  });

  it('returns matrix config for "matrix"', () => {
    const cfg = strategy.getDefaultConfig('matrix');
    expect(cfg.rankDirection).toBe('LR');
    expect(cfg.nodeSeparation).toBe(100);
    expect(cfg.rankSeparation).toBe(100);
  });

  it('returns cycle config for "cycle"', () => {
    const cfg = strategy.getDefaultConfig('cycle');
    expect(cfg.rankDirection).toBe('LR');
    expect(cfg.nodeSeparation).toBe(40);
    expect(cfg.rankSeparation).toBe(40);
  });

  it('returns base config for unknown diagram type (default branch)', () => {
    const cfg = strategy.getDefaultConfig('unknown');
    expect(cfg.nodeWidth).toBe(150);
    expect(cfg.nodeHeight).toBe(60);
    expect(cfg.marginX).toBe(50);
    expect(cfg.marginY).toBe(50);
    expect(cfg.nodeSeparation).toBe(30);
    expect(cfg.edgeSeparation).toBe(10);
    expect(cfg.rankSeparation).toBe(50);
  });

  it('handles case-insensitive diagram type', () => {
    const cfg = strategy.getDefaultConfig('FLOW');
    expect(cfg.rankDirection).toBe('LR');
  });

  // ---------- ensurePositionedNode edge case (line 350) ----------
  it('assigns x=0, y=0 and config dimensions to nodes without x/y properties', async () => {
    // Nodes that have no x/y - ensurePositionedNode will assign x=0, y=0, width/height from config
    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'Node 1' },
    ];

    const result = await strategy.apply(nodes, [], config);
    expect(result.layout.nodes[0].x).toBe(0);
    expect(result.layout.nodes[0].y).toBe(0);
    // ensurePositionedNode assigns config.nodeWidth/nodeHeight when node lacks x/y
    expect(result.layout.nodes[0].width).toBe(config.nodeWidth);
    expect(result.layout.nodes[0].height).toBe(config.nodeHeight);
  });

  // ---------- estimateComplexity ----------
  it('estimateComplexity returns n*n + e*2', () => {
    const complexity = strategy.estimateComplexity(10, 5);
    expect(complexity).toBe(10 * 10 + 5 * 2);
  });

  // ---------- calculateMetrics with edge crossings ----------
  it('detects edge crossings in calculateMetrics', async () => {
    // Create a layout that has intersecting edges
    class CrossingLayoutStrategy extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        // Create 4 nodes in a cross pattern to ensure edge crossings
        const nodes: PositionedNode[] = [
          createTestNode('a', 0, 0, 50, 50),   // top-left
          createTestNode('b', 100, 100, 50, 50), // bottom-right
          createTestNode('c', 100, 0, 50, 50),   // top-right
          createTestNode('d', 0, 100, 50, 50),   // bottom-left
        ];
        // Edge a->b goes diagonally, c->d goes diagonally crossing a->b
        const edges: LayoutEdge[] = [
          createLayoutEdge('1', 'a', 'b'),
          createLayoutEdge('2', 'c', 'd'),
        ];
        return { nodes, edges };
      }
    }

    const s = new CrossingLayoutStrategy(false);
    const result = await s.apply([], [], config);
    expect(result.metrics).toBeDefined();
    // The metrics should reflect edge crossings
    expect(typeof result.metrics.edgeCrossings).toBe('number');
  });

  // ---------- detectOverlaps ----------
  it('detectOverlaps returns empty for non-overlapping nodes', async () => {
    class SpreadLayout extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        const nodes: PositionedNode[] = [
          createTestNode('a', 0, 0, 50, 50),
          createTestNode('b', 500, 500, 50, 50),
        ];
        return { nodes, edges: [] };
      }
    }

    const s = new SpreadLayout(false);
    const result = await s.apply([], [], config);
    expect(result.metrics.overlapCount).toBe(0);
  });

  // ---------- calculateBoundingBox with nodes having width/height 0 ----------
  it('calculateBoundingBox handles nodes with zero width/height', async () => {
    class ZeroSizeLayout extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        const nodes: PositionedNode[] = [
          { id: 'a', label: 'A', x: 100, y: 100, width: 0, height: 0 },
          { id: 'b', label: 'B', x: 200, y: 200, width: 0, height: 0 },
        ];
        return { nodes, edges: [] };
      }
    }

    const s = new ZeroSizeLayout(false);
    const result = await s.apply([], [], config);
    expect(result.bounds).toBeDefined();
    expect(result.bounds.width).toBe(100);
    expect(result.bounds.height).toBe(100);
  });

  // ---------- Edge crossings: ensure doLinesIntersect branch (lines 217-223, 375-379) ----------
  it('counts edge crossings when edges actually cross', async () => {
    class CrossingEdgesStrategy extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        // Create 4 nodes in a cross pattern to ensure edge crossings
        const nodes: PositionedNode[] = [
          { id: 'a', label: 'A', x: 0, y: 0, width: 50, height: 50 },
          { id: 'b', label: 'B', x: 100, y: 100, width: 50, height: 50 },
          { id: 'c', label: 'C', x: 100, y: 0, width: 50, height: 50 },
          { id: 'd', label: 'D', x: 0, y: 100, width: 50, height: 50 },
        ];
        // Edge a->b goes diagonally top-left to bottom-right
        // Edge c->d goes diagonally top-right to bottom-left
        // These two edges cross at (50, 50)
        const edges: LayoutEdge[] = [
          { id: 'e1', from: 'a', to: 'b', source: 'a', target: 'b', points: [] },
          { id: 'e2', from: 'c', to: 'd', source: 'c', target: 'd', points: [] },
        ];
        return { nodes, edges };
      }
    }

    const s = new CrossingEdgesStrategy(false);
    const result = await s.apply([], [], config);
    // Both edges should be found and should cross
    expect(result.metrics.edgeCrossings).toBeGreaterThan(0);
  });

  // ---------- Non-crossing edges ----------
  it('reports zero crossings for non-crossing parallel edges', async () => {
    class ParallelEdgesStrategy extends TestableStrategy {
      protected async performLayout(): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }> {
        const nodes: PositionedNode[] = [
          { id: 'a', label: 'A', x: 0, y: 0, width: 50, height: 50 },
          { id: 'b', label: 'B', x: 200, y: 0, width: 50, height: 50 },
          { id: 'c', label: 'C', x: 0, y: 200, width: 50, height: 50 },
          { id: 'd', label: 'D', x: 200, y: 200, width: 50, height: 50 },
        ];
        // Parallel horizontal edges: a->b at y=0, c->d at y=200
        const edges: LayoutEdge[] = [
          { id: 'e1', from: 'a', to: 'b', source: 'a', target: 'b', points: [] },
          { id: 'e2', from: 'c', to: 'd', source: 'c', target: 'd', points: [] },
        ];
        return { nodes, edges };
      }
    }

    const s = new ParallelEdgesStrategy(false);
    const result = await s.apply([], [], config);
    expect(result.metrics.edgeCrossings).toBe(0);
  });

  // ---------- ensurePositionedNode: node that already has x/y (line 346-348) ----------
  it('preserves existing x/y for already-positioned nodes', async () => {
    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'Node 1', x: 50, y: 60, width: 100, height: 50 } as NodeDatum,
    ];

    const result = await strategy.apply(nodes, [], config);
    expect(result.layout.nodes[0].x).toBe(50);
    expect(result.layout.nodes[0].y).toBe(60);
  });
});
