import { LayoutEvaluator } from '@/visualization/strategies/LayoutEvaluator';
import { PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutResult } from '@/visualization/types';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  nodeSeparation: 20,
};

function makePositionedNodes(): PositionedNode[] {
  return [
    { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
    { id: 'b', label: 'B', x: 400, y: 100, w: 120, h: 60, width: 120, height: 60 },
    { id: 'c', label: 'C', x: 250, y: 300, w: 120, h: 60, width: 120, height: 60 },
  ];
}

function makeEdges(nodes: PositionedNode[]): LayoutEdge[] {
  return [
    { from: 'a', to: 'b', points: [{ x: 220, y: 130 }, { x: 400, y: 130 }] },
    { from: 'b', to: 'c', points: [{ x: 460, y: 160 }, { x: 310, y: 300 }] },
  ];
}

describe('LayoutEvaluator', () => {
  const evaluator = new LayoutEvaluator(defaultConfig);

  describe('calculateLayoutMetrics', () => {
    it('should calculate metrics for a valid layout', () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const metrics = evaluator.calculateLayoutMetrics(nodes, edges);

      expect(metrics.overlapCount).toBe(0);
      expect(typeof metrics.edgeCrossings).toBe('number');
      expect(metrics.edgeCrossings).toBeGreaterThanOrEqual(0);
      expect(metrics.totalArea).toBeGreaterThan(0);
      expect(typeof metrics.nodeSpacing).toBe('number');
      expect(typeof metrics.layoutBalance).toBe('number');
    });

    it('should detect overlapping nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60, width: 120, height: 60 },
      ];
      const metrics = evaluator.calculateLayoutMetrics(nodes, []);
      expect(metrics.overlapCount).toBeGreaterThan(0);
    });

    it('should handle single node', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
      ];
      const metrics = evaluator.calculateLayoutMetrics(nodes, []);
      expect(metrics.overlapCount).toBe(0);
    });

    it('should handle empty nodes', () => {
      const metrics = evaluator.calculateLayoutMetrics([], []);
      expect(metrics.overlapCount).toBe(0);
    });
  });

  describe('calculateLayoutConfidence', () => {
    it('should return high confidence for good layout', () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const confidence = evaluator.calculateLayoutConfidence(
        { nodes, edges },
        100
      );
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should penalize overlaps', () => {
      const overlappingNodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60, width: 120, height: 60 },
        { id: 'c', label: 'C', x: 120, y: 120, w: 120, h: 60, width: 120, height: 60 },
      ];
      const confidence = evaluator.calculateLayoutConfidence(
        { nodes: overlappingNodes, edges: [] },
        100
      );
      // Should be lower than a clean layout
      expect(confidence).toBeLessThan(0.9);
    });

    it('should penalize slow processing', () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const confidence = evaluator.calculateLayoutConfidence(
        { nodes, edges },
        10000
      );
      expect(confidence).toBeLessThan(1);
    });

    it('should reward fast processing', () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const confidence = evaluator.calculateLayoutConfidence(
        { nodes, edges },
        100
      );
      expect(confidence).toBeGreaterThan(0.5);
    });

    it('should reward having both nodes and edges', () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const confidenceWithEdges = evaluator.calculateLayoutConfidence(
        { nodes, edges },
        100
      );
      const confidenceNoEdges = evaluator.calculateLayoutConfidence(
        { nodes, edges: [] },
        100
      );
      expect(confidenceWithEdges).toBeGreaterThanOrEqual(confidenceNoEdges);
    });
  });

  describe('evaluateLayout', () => {
    it('should evaluate a successful layout', async () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const result: LayoutResult = {
        success: true,
        layout: { nodes, edges },
        bounds: { minX: 100, minY: 100, maxX: 520, maxY: 360, width: 420, height: 260 },
        processingTime: 100,
        confidence: 0.95,
        iteration: 1,
      };

      // Should not throw
      await expect(evaluator.evaluateLayout(result, 'flow')).resolves.toBeUndefined();
    });

    it('should evaluate layout that exceeds bounds', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, w: 2000, h: 1200 },
      ];
      const result: LayoutResult = {
        success: true,
        layout: { nodes, edges: [] },
        bounds: { minX: 0, minY: 0, maxX: 2000, maxY: 1200, width: 2000, height: 1200 },
        processingTime: 100,
        confidence: 0.5,
        iteration: 1,
      };

      await expect(evaluator.evaluateLayout(result, 'flow')).resolves.toBeUndefined();
    });
  });

  describe('evaluateLayoutWithCustomInstructions', () => {
    it('should evaluate with custom instructions criteria', async () => {
      const nodes = makePositionedNodes();
      const edges = makeEdges(nodes);
      const result: LayoutResult = {
        success: true,
        layout: { nodes, edges },
        bounds: { minX: 100, minY: 100, maxX: 520, maxY: 360, width: 420, height: 260 },
        processingTime: 100,
        confidence: 0.95,
        iteration: 1,
      };

      await expect(
        evaluator.evaluateLayoutWithCustomInstructions(result, 'flow')
      ).resolves.toBeUndefined();
    });

    it('should report failures for overlapping layouts', async () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60, width: 120, height: 60 },
      ];
      const result: LayoutResult = {
        success: true,
        layout: { nodes, edges: [] },
        bounds: { minX: 100, minY: 100, maxX: 230, maxY: 170, width: 130, height: 70 },
        processingTime: 6000,
        confidence: 0.3,
        iteration: 1,
      };

      await expect(
        evaluator.evaluateLayoutWithCustomInstructions(result, 'flow')
      ).resolves.toBeUndefined();
    });
  });
});
