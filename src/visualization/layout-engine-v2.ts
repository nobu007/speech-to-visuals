import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult, StrategyLayoutMetrics, CanvasSize, StrategyRegistry } from './types';
import { DefaultStrategyRegistry } from './strategies/base-strategy';
import { getNodeWidth, getNodeHeight } from './node-dimensions';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, TARGET_ASPECT_RATIO } from './canvas-dimensions';
import { emptyLayoutResult } from './empty-layout-result';
// Canonical overlap predicate + pairwise scan — single source of truth (see
// layout-utils.ts). Local byte-identical copies previously lived here; any
// future edit MUST propagate through this import, not a re-inlined copy.
import { countOverlapPairs } from './layout-utils';

const CANVAS_PADDING_RATIO = 0.05;

export { DefaultStrategyRegistry } from './strategies/base-strategy';

export function calculateCanvasSize(nodes: PositionedNode[]): CanvasSize {
  if (nodes.length === 0) {
    return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const left = node.x;
    const right = node.x + getNodeWidth(node, 0);
    const top = node.y;
    const bottom = node.y + getNodeHeight(node, 0);
    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  const bboxWidth = maxX - minX;
  const bboxHeight = maxY - minY;
  const padding = Math.max(bboxWidth, bboxHeight) * CANVAS_PADDING_RATIO;
  const minPadding = 40;
  const effectivePadding = Math.max(padding, minPadding);

  let width = bboxWidth + 2 * effectivePadding;
  let height = bboxHeight + 2 * effectivePadding;

  // Maintain 16:9 aspect ratio
  const currentRatio = width / height;
  if (currentRatio < TARGET_ASPECT_RATIO) {
    width = height * TARGET_ASPECT_RATIO;
  } else {
    height = width / TARGET_ASPECT_RATIO;
  }

  // Scale down if exceeds default canvas size
  if (width > DEFAULT_CANVAS_WIDTH) {
    const scale = DEFAULT_CANVAS_WIDTH / width;
    width = DEFAULT_CANVAS_WIDTH;
    height = Math.round(height * scale);
  }
  if (height > DEFAULT_CANVAS_HEIGHT) {
    const scale = DEFAULT_CANVAS_HEIGHT / height;
    height = DEFAULT_CANVAS_HEIGHT;
    width = Math.round(width * scale);
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function calculateMetrics(
  nodes: PositionedNode[],
  _edges: LayoutEdge[],
): StrategyLayoutMetrics {
  const overlapCount = countOverlapPairs(nodes);
  let edgeCrossings = 0;

  // Edge crossing detection is simplified for performance
  edgeCrossings = 0;

  const canvas = calculateCanvasSize(nodes);
  const aspectRatio = canvas.height > 0 ? canvas.width / canvas.height : TARGET_ASPECT_RATIO;

  return { overlapCount, edgeCrossings, aspectRatio };
}

export class LayoutEngineV2 {
  private registry: StrategyRegistry;

  constructor(registry?: StrategyRegistry) {
    this.registry = registry ?? new DefaultStrategyRegistry();
  }

  registerStrategy(diagramType: DiagramType, strategy: LayoutStrategy): void {
    this.registry.register(diagramType, strategy);
  }

  layout(diagramType: DiagramType, nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    const strategy = this.registry.getStrategy(diagramType);
    return strategy.apply(nodes, edges);
  }

  getRegistry(): StrategyRegistry {
    return this.registry;
  }
}
