/**
 * Flowchart Layout Strategy
 *
 * Top-to-bottom hierarchical layout using Dagre.
 * Distinct from FlowStrategy (left-to-right) — optimized for process flows,
 * decision trees, and sequential diagrams with vertical flow.
 */

import { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '../types';
import { calculateCanvasSize, calculateMetrics } from '../layout-engine-v2';
import { emptyLayoutResult } from '../empty-layout-result';
import { runDagrePipeline } from '../dagre-pipeline';

const NODE_SEP = 50;
const RANK_SEP = 70;

export class FlowchartStrategy implements LayoutStrategy {
  readonly name = 'flowchart';
  readonly canEscapeLocalMinimum = true;

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    if (nodes.length === 0) {
      return emptyLayoutResult();
    }

    // Shared dagre pipeline (round 30): graph construction, TC-307 dangling
    // edge filter, center→top-left extraction — single-sourced in
    // dagre-pipeline.ts with the flow/tree strategies.
    const { positionedNodes, layoutEdges } = runDagrePipeline(nodes, edges, {
      rankdir: 'TB',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
    });

    const canvas = calculateCanvasSize(positionedNodes);
    const metrics = calculateMetrics(positionedNodes, layoutEdges);

    return { nodes: positionedNodes, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length * nodes.length;
  }
}

export const flowchartStrategy = new FlowchartStrategy();
