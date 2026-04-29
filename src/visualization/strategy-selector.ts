import { DiagramType, NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, CanvasSize, StrategyRegistry } from './types';
import { DefaultStrategyRegistry } from './strategies/base-strategy';
import { OverlapResolver } from './overlap-resolver';
import { calculateCanvasSize, calculateMetrics } from './layout-engine-v2';
import { FlowStrategy } from './strategies/flow-strategy';
import { TreeStrategy } from './strategies/tree-strategy';
import { TimelineStrategy } from './strategies/timeline-strategy';
import { MatrixStrategy } from './strategies/matrix-strategy';
import { CycleStrategy } from './strategies/cycle-strategy';

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
  }

  select(diagramType: DiagramType): LayoutStrategy {
    if (this.registry.hasStrategy(diagramType)) {
      return this.registry.getStrategy(diagramType);
    }
    console.warn(`Unknown diagram type '${diagramType}', using default Grid-Snap strategy`);
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
      width: n.width ?? 120,
      height: n.height ?? 60,
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
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + w > maxX) maxX = n.x + w;
    if (n.y + h > maxY) maxY = n.y + h;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
