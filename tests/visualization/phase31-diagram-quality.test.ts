/**
 * Phase 31 Tests: REQ-079 ~ REQ-083 — Diagram Quality Enhancement
 *
 * 13 test cases covering:
 * - TC-079-01 / TC-079-02 / TC-079-E01 / TC-079-B01: Visual balance scoring
 * - TC-080-01 / TC-080-02 / TC-080-B01: Edge crossing detection & minimization
 * - TC-081-01 / TC-081-02 / TC-081-E01: Smart label sizing
 * - TC-082-01 / TC-082-E01: Layout quality composite score
 * - TC-083-01: Quality-based auto-optimization loop
 */

import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { VisualBalanceScorer } from '@/visualization/visual-balance-scorer';
import {
  detectEdgeCrossings,
  minimizeEdgeCrossings,
  analyzeEdgeCrossings,
} from '@/visualization/edge-crossing-minimizer';
import { sizeLabel, sizeAllLabels, LabelSizingConfig } from '@/visualization/smart-label-sizer';
import {
  calculateCompositeScore,
  scoreLayout,
  CompositeScoreInput,
} from '@/visualization/layout-quality-composite';
import { runAutoOptimization, OptimizationConfig } from '@/visualization/layout-auto-optimizer';

// ============================================================
// REQ-079: Visual Balance Scoring
// ============================================================

describe('REQ-079: Visual Balance Scoring', () => {
  const scorer = new VisualBalanceScorer();
  const bounds = { width: 400, height: 400 };

  // TC-079-01: 完全対称レイアウトのバランススコア
  it('TC-079-01: symmetric layout should score >= 0.95', () => {
    const cx = 200;
    const cy = 200;
    const offset = 100;
    const nodes: PositionedNode[] = [
      { id: 'tl', label: 'TL', x: cx - offset, y: cy - offset, width: 60, height: 40 },
      { id: 'tr', label: 'TR', x: cx + offset, y: cy - offset, width: 60, height: 40 },
      { id: 'bl', label: 'BL', x: cx - offset, y: cy + offset, width: 60, height: 40 },
      { id: 'br', label: 'BR', x: cx + offset, y: cy + offset, width: 60, height: 40 },
    ];
    const result = scorer.calculateVisualBalance(nodes, bounds);
    expect(result.overallScore).toBeGreaterThanOrEqual(0.95);
  });

  // TC-079-02: 非対称レイアウトのバランススコア低下
  it('TC-079-02: asymmetric layout should score < 0.5', () => {
    // 10 nodes all clustered in top-left corner
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push({
        id: `n${i}`,
        label: `N${i}`,
        x: 10 + i * 5,
        y: 10 + i * 3,
        width: 60,
        height: 40,
      });
    }
    const result = scorer.calculateVisualBalance(nodes, bounds);
    expect(result.overallScore).toBeLessThan(0.5);
  });

  // TC-079-E01: 単一ノード図解のバランス評価
  it('TC-079-E01: single node should return valid score without crash', () => {
    const nodes: PositionedNode[] = [
      { id: 'only', label: 'Only', x: 100, y: 100, width: 60, height: 40 },
    ];
    const result = scorer.calculateVisualBalance(nodes, bounds);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
  });

  // TC-079-B01: 空図解データのハンドリング
  it('TC-079-B01: empty nodes should not crash and return score 1.0', () => {
    const result = scorer.calculateVisualBalance([], bounds);
    expect(result.overallScore).toBe(1.0);
    expect(result.centroidDeviation).toBe(1.0);
    expect(result.quadrantBalance).toBe(1.0);
    expect(result.densityUniformity).toBe(1.0);
  });
});

// ============================================================
// REQ-080: Edge Crossing Detection & Minimization
// ============================================================

describe('REQ-080: Edge Crossing Detection & Minimization', () => {
  // TC-080-01: 交差なし図解の検出
  it('TC-080-01: tree-type layout should have 0 crossings', () => {
    // Simple tree: root → left, root → right (no crossing)
    const nodes: PositionedNode[] = [
      { id: 'root', label: 'Root', x: 200, y: 50, width: 60, height: 40 },
      { id: 'left', label: 'Left', x: 100, y: 150, width: 60, height: 40 },
      { id: 'right', label: 'Right', x: 300, y: 150, width: 60, height: 40 },
      { id: 'll', label: 'LL', x: 50, y: 250, width: 60, height: 40 },
      { id: 'lr', label: 'LR', x: 150, y: 250, width: 60, height: 40 },
      { id: 'rl', label: 'RL', x: 250, y: 250, width: 60, height: 40 },
      { id: 'rr', label: 'RR', x: 350, y: 250, width: 60, height: 40 },
      { id: 'lll', label: 'LLL', x: 30, y: 350, width: 60, height: 40 },
      { id: 'llr', label: 'LLR', x: 100, y: 350, width: 60, height: 40 },
      { id: 'rrl', label: 'RRL', x: 280, y: 350, width: 60, height: 40 },
    ];
    const edges: LayoutEdge[] = [
      { from: 'root', to: 'left', points: [] },
      { from: 'root', to: 'right', points: [] },
      { from: 'left', to: 'll', points: [] },
      { from: 'left', to: 'lr', points: [] },
      { from: 'right', to: 'rl', points: [] },
      { from: 'right', to: 'rr', points: [] },
      { from: 'll', to: 'lll', points: [] },
      { from: 'll', to: 'llr', points: [] },
      { from: 'rr', to: 'rrl', points: [] },
    ];
    const crossings = detectEdgeCrossings(nodes, edges);
    expect(crossings).toBe(0);
  });

  // TC-080-02: 交差あり図解の検出と最小化
  it('TC-080-02: crossing layout should detect and minimize crossings', () => {
    // 5 nodes in near-complete graph — some edges will cross
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 100, y: 100, width: 40, height: 30 },
      { id: 'b', label: 'B', x: 300, y: 100, width: 40, height: 30 },
      { id: 'c', label: 'C', x: 100, y: 300, width: 40, height: 30 },
      { id: 'd', label: 'D', x: 300, y: 300, width: 40, height: 30 },
      { id: 'e', label: 'E', x: 200, y: 200, width: 40, height: 30 },
    ];
    // Create edges that cross: A-D crosses B-C
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'd', points: [] },  // diagonal
      { from: 'b', to: 'c', points: [] },  // opposite diagonal (crosses A-D)
      { from: 'a', to: 'b', points: [] },
      { from: 'c', to: 'd', points: [] },
      { from: 'a', to: 'e', points: [] },
      { from: 'b', to: 'e', points: [] },
    ];

    const original = detectEdgeCrossings(nodes, edges);
    expect(original).toBeGreaterThan(0);

    const result = analyzeEdgeCrossings(nodes, edges);
    expect(result.crossingCount).toBeGreaterThan(0);
    expect(result.minimizedCrossingCount).toBeLessThanOrEqual(result.crossingCount);
  });

  // TC-080-B01: エッジ0本の図解
  it('TC-080-B01: no edges should return 0 crossings without crash', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 100, y: 100, width: 60, height: 40 },
      { id: 'b', label: 'B', x: 200, y: 200, width: 60, height: 40 },
    ];
    expect(detectEdgeCrossings(nodes, [])).toBe(0);
  });
});

// ============================================================
// REQ-081: Smart Label Sizing
// ============================================================

describe('REQ-081: Smart Label Sizing', () => {
  const defaultConfig: LabelSizingConfig = {
    defaultFontSize: 14,
    minFontSize: 8,
    charWidthFactor: 8,
  };

  // TC-081-01: 短いラベルのフォントサイズ維持
  it('TC-081-01: short label should keep default font size', () => {
    const result = sizeLabel('ABC', 200, 60, defaultConfig);
    expect(result.fontSize).toBe(14); // default preserved
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toBe('ABC');
    expect(result.truncated).toBe(false);
  });

  // TC-081-02: 長いラベルの自動折り返し
  it('TC-081-02: long Japanese label should wrap into multiple lines', () => {
    // 50-char Japanese label in a narrow node
    const longLabel = 'これは非常に長い日本語ラベルテキストの例で折り返しが必要なものです';
    const result = sizeLabel(longLabel, 120, 80, defaultConfig);
    expect(result.lines.length).toBeGreaterThan(1);
    // All lines should fit within node width
    for (const line of result.lines) {
      // Rough check: each line is shorter than the original
      expect(line.length).toBeLessThan(longLabel.length);
    }
  });

  // TC-081-E01: 空ラベルのハンドリング
  it('TC-081-E01: empty label should not crash and use default font size', () => {
    const result = sizeLabel('', 120, 60, defaultConfig);
    expect(result.fontSize).toBe(14);
    expect(result.truncated).toBe(false);
    expect(result.lines).toEqual(['']);
  });
});

// ============================================================
// REQ-082: Layout Quality Composite Score
// ============================================================

describe('REQ-082: Layout Quality Composite Score', () => {
  // TC-082-01: 高品質レイアウトの複合スコア
  it('TC-082-01: high quality layout should score >= 0.8', () => {
    const result = calculateCompositeScore({
      balanceScore: 0.95,
      crossingCount: 0,
      edgeCount: 5,
      overflowCount: 0,
      nodeCount: 10,
      densityUniformity: 0.9,
    });
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.8);
    // Verify contributions
    expect(result.contributions.balance.value).toBe(0.95);
    expect(result.contributions.crossing.value).toBe(1.0); // 0 crossings
    expect(result.contributions.overflow.value).toBe(1.0); // 0 overflow
  });

  // TC-082-E01: スコア欠損時のハンドリング
  it('TC-082-E01: missing scores should not crash and use defaults', () => {
    const result = calculateCompositeScore({
      // Only provide partial metrics
      crossingCount: 2,
      edgeCount: 5,
    });
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(1);
    // balance and density should default to 0.5
    expect(result.contributions.balance.value).toBe(0.5);
    expect(result.contributions.density.value).toBe(0.5);
  });
});

// ============================================================
// REQ-083: Quality-based Auto-Optimization Loop
// ============================================================

describe('REQ-083: Quality-based Auto-Optimization Loop', () => {
  // TC-083-01: 低品質レイアウトの自動改善
  it('TC-083-01: low quality layout should improve after auto-optimization', () => {
    // Create a deliberately unbalanced layout
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push({
        id: `n${i}`,
        label: `N${i}`,
        x: 10 + i * 3, // clustered in top-left
        y: 10 + i * 2,
        width: 60,
        height: 40,
      });
    }
    const edges: LayoutEdge[] = [
      { from: 'n0', to: 'n5', points: [] },
      { from: 'n1', to: 'n6', points: [] },
      { from: 'n2', to: 'n7', points: [] },
    ];

    const config: OptimizationConfig = {
      threshold: 0.7,
      maxAttempts: 3,
      canvasWidth: 400,
      canvasHeight: 400,
    };

    const result = runAutoOptimization(nodes, edges, config);

    // Should have attempted at least once
    expect(result.attempts).toBeGreaterThan(0);
    // Score should improve or reach threshold
    expect(result.finalScore).toBeGreaterThan(result.initialScore);
    // Should have score history
    expect(result.scoreHistory.length).toBeGreaterThan(1);
    // Score history should match: initial + per-attempt
    expect(result.scoreHistory[0]).toBe(result.initialScore);
  });

  it('already-good layout should not attempt optimization', () => {
    // Perfectly centered, well-spaced nodes
    const cx = 200;
    const cy = 200;
    const nodes: PositionedNode[] = [
      { id: 'tl', label: 'TL', x: cx - 100, y: cy - 100, width: 60, height: 40 },
      { id: 'tr', label: 'TR', x: cx + 100, y: cy - 100, width: 60, height: 40 },
      { id: 'bl', label: 'BL', x: cx - 100, y: cy + 100, width: 60, height: 40 },
      { id: 'br', label: 'BR', x: cx + 100, y: cy + 100, width: 60, height: 40 },
    ];
    const edges: LayoutEdge[] = [];

    const result = runAutoOptimization(nodes, edges, {
      threshold: 0.5,
      canvasWidth: 400,
      canvasHeight: 400,
    });

    expect(result.attempts).toBe(0);
    expect(result.passed).toBe(true);
  });
});
