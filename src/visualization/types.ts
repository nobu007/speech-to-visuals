import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface OverlapPair {
  node1: PositionedNode;
  node2: PositionedNode;
}

export interface NodeDimensionsConfig {
  nodeWidth: number;
  nodeHeight: number;
  charWidth?: number;
  padding?: number;
}

export interface LayoutConfig {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  marginX: number;
  marginY: number;
  rankDirection: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSeparation: number;
  edgeSeparation: number;
  rankSeparation: number;
  isSimpleMode?: boolean;
}

export interface LayoutResult {
  layout: DiagramLayout;
  bounds: {
    width: number;
    height: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  processingTime: number;
  success: boolean;
  error?: string;
  metrics?: LayoutMetrics;
  confidence?: number;
}

export interface LayoutMetrics {
  overlapCount: number;
  edgeCrossings: number;
  totalArea: number;
  nodeSpacing: number;
  layoutBalance: number;
}

// --- Phase 3: Strategy-based Layout Architecture ---

export interface LayoutStrategy {
  readonly name: string;
  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult;
  readonly canEscapeLocalMinimum: boolean;
  estimateComplexity(nodes: NodeDatum[]): number;
}

export interface StrategyLayoutResult {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  canvas: CanvasSize;
  metrics: StrategyLayoutMetrics;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface StrategyLayoutMetrics {
  overlapCount: number;
  edgeCrossings: number;
  aspectRatio: number;
}

export interface StrategyRegistry {
  register(diagramType: DiagramType, strategy: LayoutStrategy): void;
  getStrategy(diagramType: DiagramType): LayoutStrategy;
  hasStrategy(diagramType: DiagramType): boolean;
  getAllStrategies(): Map<DiagramType, LayoutStrategy>;
}