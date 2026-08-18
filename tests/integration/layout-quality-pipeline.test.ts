/**
 * Phase 31 Integration Test: Layout Quality Pipeline
 *
 * Exercises the full REQ-079~083 pipeline end-to-end:
 *   1. Visual Balance Scoring (REQ-079)
 *   2. Edge Crossing Detection & Minimization (REQ-080)
 *   3. Smart Label Sizing (REQ-081)
 *   4. Layout Quality Composite Score (REQ-082)
 *   5. Quality-based Auto-Optimization Loop (REQ-083)
 *
 * Verifies that all Phase 31 modules interoperate correctly
 * when fed realistic diagram layouts.
 */

import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { VisualBalanceScorer } from '@/visualization/visual-balance-scorer';
import { detectEdgeCrossings, minimizeEdgeCrossings } from '@/visualization/edge-crossing-minimizer';
import { sizeLabel, sizeAllLabels } from '@/visualization/smart-label-sizer';
import { calculateCompositeScore, scoreLayout } from '@/visualization/layout-quality-composite';
import { runAutoOptimization } from '@/visualization/layout-auto-optimizer';

// --- Test fixtures ---

function makeFlowchartLayout(): {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
} {
  const nodes: PositionedNode[] = [
    { id: 'start', label: '開始', x: 400, y: 50, width: 120, height: 50 },
    { id: 'input', label: 'データ入力', x: 400, y: 150, width: 120, height: 50 },
    { id: 'process', label: '処理実行', x: 400, y: 250, width: 120, height: 50 },
    { id: 'check', label: '結果確認', x: 400, y: 350, width: 120, height: 50 },
    { id: 'retry', label: 'リトライ', x: 200, y: 250, width: 120, height: 50 },
    { id: 'output', label: '出力', x: 400, y: 450, width: 120, height: 50 },
    { id: 'end', label: '終了', x: 400, y: 550, width: 120, height: 50 },
  ];
  const edges: LayoutEdge[] = [
    { from: 'start', to: 'input', points: [] },
    { from: 'input', to: 'process', points: [] },
    { from: 'process', to: 'check', points: [] },
    { from: 'check', to: 'retry', points: [] },
    { from: 'check', to: 'output', points: [] },
    { from: 'retry', to: 'process', points: [] },
    { from: 'output', to: 'end', points: [] },
  ];
  return { nodes, edges };
}

function makeNetworkLayout(): {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
} {
  const nodes: PositionedNode[] = [
    { id: 'a', label: 'Node A', x: 100, y: 100, width: 80, height: 50 },
    { id: 'b', label: 'Node B', x: 300, y: 100, width: 80, height: 50 },
    { id: 'c', label: 'Node C', x: 100, y: 300, width: 80, height: 50 },
    { id: 'd', label: 'Node D', x: 300, y: 300, width: 80, height: 50 },
    { id: 'e', label: 'Node E', x: 200, y: 200, width: 80, height: 50 },
  ];
  // Edges that cross: a→d crosses b→c
  const edges: LayoutEdge[] = [
    { from: 'a', to: 'd', points: [] },
    { from: 'b', to: 'c', points: [] },
    { from: 'a', to: 'b', points: [] },
    { from: 'c', to: 'd', points: [] },
    { from: 'a', to: 'e', points: [] },
    { from: 'e', to: 'd', points: [] },
  ];
  return { nodes, edges };
}

// --- Integration tests ---

describe('Phase 31 Integration: Layout Quality Pipeline', () => {
  const canvasWidth = 800;
  const canvasHeight = 700;

  it('REQ-079→082: balance feeds into composite score', () => {
    const { nodes } = makeFlowchartLayout();
    const scorer = new VisualBalanceScorer();
    const balance = scorer.calculateVisualBalance(nodes, { width: canvasWidth, height: canvasHeight });

    expect(balance.overallScore).toBeGreaterThan(0);
    expect(balance.overallScore).toBeLessThanOrEqual(1);

    const composite = calculateCompositeScore({
      balanceScore: balance.overallScore,
      crossingCount: 0,
      edgeCount: 7,
      overflowCount: 0,
      nodeCount: nodes.length,
      densityUniformity: balance.densityUniformity,
    });

    expect(composite.compositeScore).toBeGreaterThan(0);
    expect(composite.contributions.balance.value).toBe(balance.overallScore);
  });

  it('REQ-080→082: crossing detection feeds into composite score', () => {
    const { nodes, edges } = makeNetworkLayout();
    const crossings = detectEdgeCrossings(nodes, edges);
    expect(crossings).toBeGreaterThan(0);

    const composite = calculateCompositeScore({
      crossingCount: crossings,
      edgeCount: edges.length,
      nodeCount: nodes.length,
    });

    // With crossings, crossing contribution should be < 1.0
    expect(composite.contributions.crossing.value).toBeLessThan(1.0);
    expect(composite.compositeScore).toBeGreaterThan(0);
  });

  it('REQ-081: label sizing produces results for all nodes', () => {
    const { nodes } = makeFlowchartLayout();
    const labelMap = sizeAllLabels(nodes);

    expect(labelMap.size).toBe(nodes.length);
    for (const node of nodes) {
      const result = labelMap.get(node.id);
      expect(result).toBeDefined();
      expect(result!.fontSize).toBeGreaterThanOrEqual(8);
      expect(result!.lines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('REQ-081: long label wraps correctly', () => {
    const longLabel = 'これは非常に長い日本語テキストの例です折り返しが発生するはずです';
    const result = sizeLabel(longLabel, 100, 60);
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('REQ-080→080: minimizeEdgeCrossings reduces crossings', () => {
    const { nodes, edges } = makeNetworkLayout();
    const original = detectEdgeCrossings(nodes, edges);
    expect(original).toBeGreaterThan(0);

    const { nodes: optimized, crossingCount } = minimizeEdgeCrossings(nodes, edges);
    expect(crossingCount).toBeLessThanOrEqual(original);
    // Optimized nodes should have same count
    expect(optimized.length).toBe(nodes.length);
  });

  it('REQ-079→082: scoreLayout integrates balance + crossings', () => {
    const { nodes, edges } = makeFlowchartLayout();
    const result = scoreLayout(nodes, edges, canvasWidth, canvasHeight);

    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(1);
    // Flowchart layout should be decent quality (tree-like, few crossings)
    expect(result.compositeScore).toBeGreaterThan(0.3);
    expect(result.contributions.balance.value).toBeGreaterThan(0);
    expect(result.contributions.crossing.value).toBeGreaterThanOrEqual(0);
  });

  it('REQ-083: auto-optimization improves poor layout', () => {
    // Create a deliberately bad layout
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 8; i++) {
      nodes.push({
        id: `n${i}`,
        label: `Node ${i}`,
        x: 10 + i * 2,
        y: 10 + i * 2,
        width: 80,
        height: 50,
      });
    }
    const edges: LayoutEdge[] = [
      { from: 'n0', to: 'n7', points: [] },
      { from: 'n1', to: 'n6', points: [] },
      { from: 'n2', to: 'n5', points: [] },
    ];

    const result = runAutoOptimization(nodes, edges, {
      threshold: 0.6,
      maxAttempts: 3,
      canvasWidth,
      canvasHeight,
    });

    expect(result.initialScore).toBeGreaterThan(0);
    expect(result.attempts).toBeGreaterThan(0);
    expect(result.scoreHistory.length).toBeGreaterThan(1);
    expect(result.scoreHistory[0]).toBe(result.initialScore);
  });

  it('REQ-083: good layout passes without optimization', () => {
    const { nodes, edges } = makeFlowchartLayout();
    const result = runAutoOptimization(nodes, edges, {
      threshold: 0.3,
      canvasWidth,
      canvasHeight,
    });

    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(0);
  });

  it('full pipeline: bad layout → optimize → label size → composite score', () => {
    // Step 1: Start with a clustered layout
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 6; i++) {
      nodes.push({
        id: `n${i}`,
        label: `項目${i}のデータ処理結果`,
        x: 20 + i * 3,
        y: 20 + i * 3,
        width: 100,
        height: 50,
      });
    }
    const edges: LayoutEdge[] = [
      { from: 'n0', to: 'n5', points: [] },
      { from: 'n1', to: 'n4', points: [] },
      { from: 'n2', to: 'n3', points: [] },
    ];

    // Step 2: Auto-optimize
    const optimized = runAutoOptimization(nodes, edges, {
      threshold: 0.5,
      maxAttempts: 3,
      canvasWidth,
      canvasHeight,
    });

    // Step 3: Size labels on optimized nodes
    const labelMap = sizeAllLabels(optimized.nodes);
    expect(labelMap.size).toBe(6);

    // Step 4: Compute final composite score
    const finalScore = scoreLayout(
      optimized.nodes, optimized.edges, canvasWidth, canvasHeight
    );
    expect(finalScore.compositeScore).toBeGreaterThan(0);

    // Step 5: Verify improvement
    expect(optimized.finalScore).toBeGreaterThanOrEqual(optimized.initialScore);
  });
});
