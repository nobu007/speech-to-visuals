import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';

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
}

export interface LayoutMetrics {
  overlapCount: number;
  edgeCrossings: number;
  totalArea: number;
  nodeSpacing: number;
  layoutBalance: number;
}