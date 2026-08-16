import { DiagramType, NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyRegistry } from './types';
import { DefaultStrategyRegistry } from './strategies/base-strategy';
import { OverlapResolver } from './overlap-resolver';
import { calculateCanvasSize, calculateMetrics } from './layout-engine-v2';
import { nodeExtentEdges, foldNodeExtents } from './layout-utils';
import { FlowStrategy } from './strategies/flow-strategy';
import { TreeStrategy } from './strategies/tree-strategy';
import { TimelineStrategy } from './strategies/timeline-strategy';
import { MatrixStrategy } from './strategies/matrix-strategy';
import { CycleStrategy } from './strategies/cycle-strategy';
import { MindMapStrategy } from './strategies/mindmap-strategy';
import { NetworkStrategy } from './strategies/network-strategy';
import { ConceptMapStrategy } from './strategies/conceptmap-strategy';
import { FlowchartStrategy } from './strategies/flowchart-strategy';
import { ComparisonStrategy } from './strategies/comparison-strategy';
import { GeneralStrategy } from './strategies/general-strategy';
import { logger } from '../utils/logger';

export class StrategySelector {
  private registry: StrategyRegistry;
  private fallbackStrategy: LayoutStrategy;
  private overlapResolver: OverlapResolver;

  constructor(registry?: StrategyRegistry) {
    this.registry = registry ?? new DefaultStrategyRegistry();
    this.overlapResolver = new OverlapResolver(100);
    this.fallbackStrategy = new GridSnapFallbackStrategy();

    // Register all default strategies
    if (!registry) {
      this.registerDefaults();
    }
  }

  private registerDefaults(): void {
    this.registry.register('flow', new FlowStrategy());
    this.registry.register('tree', new TreeStrategy());
    this.registry.register('timeline', new TimelineStrategy());
    this.registry.register('matrix', new MatrixStrategy());
    this.registry.register('cycle', new CycleStrategy());
    this.registry.register('mindmap', new MindMapStrategy());
    this.registry.register('network', new NetworkStrategy());
    this.registry.register('conceptmap', new ConceptMapStrategy());
    this.registry.register('flowchart', new FlowchartStrategy());
    this.registry.register('comparison', new ComparisonStrategy());
    this.registry.register('general', new GeneralStrategy());
  }

  select(diagramType: DiagramType): LayoutStrategy {
    if (this.registry.hasStrategy(diagramType)) {
      return this.registry.getStrategy(diagramType);
    }
    logger.warn(`Unknown diagram type '${diagramType}', using default Grid-Snap strategy`);
    return this.fallbackStrategy;
  }

  getFallbackChain(diagramType: DiagramType): LayoutStrategy[] {
    const main = this.select(diagramType);
    return [main, this.fallbackStrategy];
  }

  estimateComplexity(diagramType: DiagramType, nodeCount: number): number {
    const strategy = this.select(diagramType);
    const dummyNodes: NodeDatum[] = Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
    }));
    return strategy.estimateComplexity(dummyNodes);
  }

  getRegistry(): StrategyRegistry {
    return this.registry;
  }
}

class GridSnapFallbackStrategy implements LayoutStrategy {
  readonly name = 'grid-snap-fallback';
  readonly canEscapeLocalMinimum = false;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    const positioned = nodes.map((n, i) => ({
      ...n,
      x: (i % 5) * 160 + 40,
      y: Math.floor(i / 5) * 100 + 40,
      width: getNodeWidth(n, DEFAULT_NODE_WIDTH),
      height: getNodeHeight(n, DEFAULT_NODE_HEIGHT),
    }));

    const layoutEdges = edges.map(e => ({
      from: e.from,
      to: e.to,
      points: [] as { x: number; y: number }[],
      label: e.label,
    }));

    const canvas = calculateCanvasSize(positioned);
    const metrics = calculateMetrics(positioned, layoutEdges);

    return { nodes: positioned, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return 1; // Grid is O(1) complexity
  }
}

export async function executeLayout(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  diagramType: DiagramType,
): Promise<StrategyLayoutResult> {
  const selector = new StrategySelector();

  // 1. Strategy selection
  const strategy = selector.select(diagramType);

  // 2. Layout calculation
  const result = strategy.apply(nodes, edges);

  // 3. Overlap resolution
  if (result.metrics.overlapCount > 0) {
    const resolver = new OverlapResolver(100);
    const resolvedNodes = resolver.resolve(result.nodes);
    const canvas = calculateCanvasSize(resolvedNodes);
    const metrics = calculateMetrics(resolvedNodes, result.edges);
    result.nodes = resolvedNodes;
    result.canvas = canvas;
    result.metrics = metrics;
  }

  // 4. Centering
  if (result.nodes.length > 0) {
    const bbox = calculateBoundingBox(result.nodes);
    const offsetX = (result.canvas.width - bbox.width) / 2 - bbox.minX;
    const offsetY = (result.canvas.height - bbox.height) / 2 - bbox.minY;
    result.nodes = result.nodes.map(n => ({
      ...n,
      x: n.x + offsetX,
      y: n.y + offsetY,
    }));
  }

  return result;
}

function calculateBoundingBox(nodes: PositionedNode[]) {
  // Extent scan delegates to foldNodeExtents (round 41 single source); the
  // 0 fallbacks preserve the "never invent a dimension" policy. Callers only
  // reach this with a non-empty node set (length guard at the call site), so
  // the null arm replaces the retired loop's unreachable ±Infinity box on
  // empty input with a zero box.
  const extents = foldNodeExtents(nodes, (n) => nodeExtentEdges(n, 0, 0));
  if (extents === null) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  const { minX, minY, maxX, maxY } = extents;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
