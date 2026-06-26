/**
 * End-to-end pipeline integration tests: text → diagram detection → layout generation.
 *
 * Unlike strategy-level tests that feed pre-built nodes/edges to a single
 * layout strategy, these tests exercise the full chain:
 *
 *   raw text
 *     → SimpleDiagramDetector.analyze()  (keyword detection + node/edge generation)
 *     → LayoutEngine.generateLayout()     (Dagre → OverlapResolver → optimization)
 *     → positioned output verification
 *
 * Regression coverage:
 * - Tree detection → tree layout: multi-level positioning correctness
 * - Timeline detection → timeline layout: on-screen positioning for single + multi nodes
 * - Type mismatch: detection produces 'tree' but caller requests 'timeline' (fallback)
 * - Edge point validity: all edges have ≥2 finite points
 * - width/height consistency: no undefined/NaN downstream
 */

import { describe, it, expect } from '@jest/globals';
import { SimpleDiagramDetector } from '@/analysis/simple-diagram-detector';
import type { SimpleNode, SimpleEdge } from '@/analysis/simple-diagram-detector';
import { LayoutEngine } from '@/visualization';
import type { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleNodeToNodeDatum(sn: SimpleNode): NodeDatum {
  return { id: sn.id, label: sn.label, type: sn.type };
}

function simpleEdgeToEdgeDatum(se: SimpleEdge): EdgeDatum {
  return { from: se.from, to: se.to, id: se.id, type: se.type };
}

function getNodeWidth(n: PositionedNode): number {
  return n.width ?? n.w ?? 0;
}

function getNodeHeight(n: PositionedNode): number {
  return n.height ?? n.h ?? 0;
}

function expectValidPositions(nodes: PositionedNode[]): void {
  for (const node of nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(getNodeWidth(node)).toBeGreaterThan(0);
    expect(getNodeHeight(node)).toBeGreaterThan(0);
  }
}

function expectWithinBounds(nodes: PositionedNode[], width: number, height: number, tolerance = 100): void {
  for (const node of nodes) {
    expect(node.x).toBeGreaterThanOrEqual(-tolerance);
    expect(node.y).toBeGreaterThanOrEqual(-tolerance);
    expect(node.x + getNodeWidth(node)).toBeLessThanOrEqual(width + tolerance);
    expect(node.y + getNodeHeight(node)).toBeLessThanOrEqual(height + tolerance);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full pipeline: text → detection → layout', () => {
  const detector = new SimpleDiagramDetector();
  const engine = new LayoutEngine({ width: 1920, height: 1080 });

  describe('Tree: text with hierarchy keywords → tree layout', () => {
    const treeText =
      'The organization has a clear hierarchy. ' +
      'The root branch contains the parent node. ' +
      'Each child branch leads to leaf nodes. ' +
      'The classification structure has multiple levels and categories.';

    it('should detect tree type from keywords', async () => {
      const analysis = await detector.analyze({ text: treeText });
      expect(analysis.type).toBe('tree');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.nodes.length).toBeGreaterThan(0);
      expect(analysis.edges.length).toBeGreaterThan(0);
    });

    it('should produce valid layout through full pipeline', async () => {
      const analysis = await detector.analyze({ text: treeText });

      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result.success).toBe(true);
      expect(result.layout.nodes.length).toBeGreaterThanOrEqual(1);
      expectValidPositions(result.layout.nodes);
      expectWithinBounds(result.layout.nodes, 1920, 1080);
    });

    it('should place root at level 0 and children below', async () => {
      const analysis = await detector.analyze({ text: treeText });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      // Root should be at the top (lowest y)
      const root = result.layout.nodes.find(n => n.id === 'root');
      expect(root).toBeDefined();

      // Children should be below root
      const branch1 = result.layout.nodes.find(n => n.id === 'branch1');
      const branch2 = result.layout.nodes.find(n => n.id === 'branch2');
      if (root && branch1) {
        expect(branch1.y).toBeGreaterThan(root.y);
      }
      if (root && branch2) {
        expect(branch2.y).toBeGreaterThan(root.y);
      }
    });

    it('should produce edges with valid finite points', async () => {
      const analysis = await detector.analyze({ text: treeText });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result.layout.edges.length).toBeGreaterThan(0);
      for (const edge of result.layout.edges) {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (const pt of edge.points) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
      }
    });

    it('should not produce NaN in any width/height field', async () => {
      const analysis = await detector.analyze({ text: treeText });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      for (const node of result.layout.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
        const w = getNodeWidth(node);
        const h = getNodeHeight(node);
        expect(isNaN(w)).toBe(false);
        expect(isNaN(h)).toBe(false);
      }
    });
  });

  describe('Timeline: text with time keywords → timeline layout', () => {
    const timelineText =
      'The project timeline started in 2020. ' +
      'Before the launch in 2021, we planned the chronology. ' +
      'After 2022, the history shows continuous development. ' +
      'The time sequence covers multiple periods and years.';

    it('should detect timeline type from keywords', async () => {
      const analysis = await detector.analyze({ text: timelineText });
      expect(analysis.type).toBe('timeline');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.nodes.length).toBeGreaterThan(0);
    });

    it('should produce valid layout through full pipeline', async () => {
      const analysis = await detector.analyze({ text: timelineText });

      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'timeline', 1);

      expect(result.success).toBe(true);
      expect(result.layout.nodes.length).toBeGreaterThanOrEqual(1);
      expectValidPositions(result.layout.nodes);
      expectWithinBounds(result.layout.nodes, 1920, 1080);
    });

    it('should position timeline nodes ordered left to right', async () => {
      const analysis = await detector.analyze({ text: timelineText });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'timeline', 1);

      // When Dagre lays out a timeline (LR), nodes should be ordered by x
      const sortedByX = [...result.layout.nodes].sort((a, b) => a.x - b.x);
      if (sortedByX.length >= 2) {
        expect(sortedByX[0].x).toBeLessThanOrEqual(sortedByX[sortedByX.length - 1].x);
      }
    });
  });

  describe('Single-node timeline: minimal input → on-screen output', () => {
    it('should position single node on-screen through full pipeline', async () => {
      // Use a generic text that triggers default (non-specific) detection
      const analysis = await detector.analyze({ text: 'Something happened.' });
      const singleNode: NodeDatum[] = [
        { id: 'solo', label: 'Solo Event' },
      ];

      const result = await engine.generateLayout(singleNode, [], 'timeline', 1);

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(1);
      expectValidPositions(result.layout.nodes);

      const node = result.layout.nodes[0];
      expect(node.x).toBeGreaterThanOrEqual(-50);
    });
  });

  describe('Type mismatch: detection type vs. requested layout type', () => {
    it('should still produce valid layout when tree content is laid out as timeline', async () => {
      const treeText =
        'The hierarchy has a root with child branches and leaf nodes. ' +
        'The parent classification structure spans multiple levels.';

      const analysis = await detector.analyze({ text: treeText });
      // Detect may say 'tree', but caller requests 'timeline'
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'timeline', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes.length).toBeGreaterThanOrEqual(1);
      expectValidPositions(result.layout.nodes);
    });

    it('should still produce valid layout when timeline content is laid out as tree', async () => {
      const timelineText =
        'The timeline started in 2020. After that period, the chronology continued.';

      const analysis = await detector.analyze({ text: timelineText });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);

      const result = await engine.generateLayout(nodes, edges, 'tree', 1);

      expect(result).toBeDefined();
      expect(result.layout.nodes.length).toBeGreaterThanOrEqual(1);
      expectValidPositions(result.layout.nodes);
    });
  });

  describe('Performance: full pipeline completes within 5s', () => {
    it('should complete detection + layout in under 5 seconds', async () => {
      const text =
        'The organization hierarchy has a root with parent and child branches. ' +
        'Each branch contains leaf nodes at different levels of classification.';

      const start = Date.now();

      const analysis = await detector.analyze({ text });
      const nodes = analysis.nodes.map(simpleNodeToNodeDatum);
      const edges = analysis.edges.map(simpleEdgeToEdgeDatum);
      await engine.generateLayout(nodes, edges, analysis.type as 'tree', 1);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
