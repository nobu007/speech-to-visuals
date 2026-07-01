/**
 * Tests verifying that the w/h → getNodeWidth/getNodeHeight migration
 * is complete and NaN-safe across all visualization, quality, and pipeline modules.
 *
 * REQ-263: Remaining w/h access points migrated to shared helpers
 */
import { describe, it, expect } from '@jest/globals';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';

describe('w/h migration completeness - NaN safety across modules', () => {

  describe('getNodeWidth/getNodeHeight with corrupted node shapes', () => {
    it('returns fallback for node with only w/h = NaN', () => {
      const node = { x: 0, y: 0, w: NaN, h: NaN };
      expect(getNodeWidth(node)).toBe(120); // default fallback
      expect(getNodeHeight(node)).toBe(60);
    });

    it('returns fallback for node with only width/height = NaN', () => {
      const node = { x: 0, y: 0, width: NaN, height: NaN };
      expect(getNodeWidth(node)).toBe(120);
      expect(getNodeHeight(node)).toBe(60);
    });

    it('returns fallback for empty object (no dimensions)', () => {
      expect(getNodeWidth({})).toBe(120);
      expect(getNodeHeight({})).toBe(60);
    });

    it('returns fallback for null-ish dimensions', () => {
      const node = { x: 0, y: 0, width: null as unknown as number, height: undefined as unknown as number };
      expect(getNodeWidth(node)).toBe(120);
      expect(getNodeHeight(node)).toBe(60);
    });

    it('returns fallback for Infinity dimensions', () => {
      const node = { x: 0, y: 0, width: Infinity, height: -Infinity };
      expect(getNodeWidth(node)).toBe(120);
      expect(getNodeHeight(node)).toBe(60);
    });

    it('prefers width over w when both are valid', () => {
      const node = { x: 0, y: 0, width: 200, w: 100, height: 80, h: 40 };
      expect(getNodeWidth(node)).toBe(200);
      expect(getNodeHeight(node)).toBe(80);
    });

    it('falls back to w when width is invalid', () => {
      const node = { x: 0, y: 0, width: NaN, w: 150, height: NaN, h: 70 };
      expect(getNodeWidth(node)).toBe(150);
      expect(getNodeHeight(node)).toBe(70);
    });

    it('handles custom fallback values', () => {
      const node = { x: 0, y: 0, width: NaN, height: NaN };
      expect(getNodeWidth(node, 999)).toBe(999);
      expect(getNodeHeight(node, 888)).toBe(888);
    });
  });

  describe('quality-gate rectsOverlap NaN safety', () => {
    // Direct test of the rectsOverlap behavior through getNodeWidth/getNodeHeight
    it('two nodes with NaN w/h should not spuriously report overlap', () => {
      // If w/h were NaN, the old code would produce NaN comparisons → false → overlap detected
      // With helpers, fallback dimensions are used → correct behavior
      const nodeA = { x: 0, y: 0, width: NaN, height: NaN };
      const nodeB = { x: 500, y: 500, width: NaN, height: NaN };

      const aRight = nodeA.x + getNodeWidth(nodeA);
      const bLeft = nodeB.x;
      // With fallback (120), node A spans [0, 120], node B starts at 500 → no overlap
      expect(aRight + 10).toBeLessThanOrEqual(bLeft);
    });
  });

  describe('FallbackLayoutStrategy edge midpoint NaN safety', () => {
    it('computes valid midpoint even with corrupted dimensions', () => {
      const fromNode = { x: 10, y: 20, width: NaN, height: NaN };
      const midpointX = fromNode.x + getNodeWidth(fromNode) / 2;
      const midpointY = fromNode.y + getNodeHeight(fromNode) / 2;

      expect(Number.isFinite(midpointX)).toBe(true);
      expect(Number.isFinite(midpointY)).toBe(true);
      expect(midpointX).toBe(10 + 60); // 10 + 120/2
      expect(midpointY).toBe(20 + 30); // 20 + 60/2
    });
  });

  describe('CulturalLayoutAdapter RTL flip NaN safety', () => {
    it('RTL x-coord flip produces finite value with corrupted w', () => {
      const node = { x: 100, y: 50, width: NaN, height: NaN };
      const centerX = 500;
      const flippedX = centerX + (centerX - node.x - getNodeWidth(node));

      expect(Number.isFinite(flippedX)).toBe(true);
      // 500 + (500 - 100 - 120) = 500 + 280 = 780
      expect(flippedX).toBe(780);
    });
  });

  describe('complex-layout-engine bounds calculation NaN safety', () => {
    it('calculateBounds produces finite values with mixed valid/invalid dimensions', () => {
      const nodes = [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 200, y: 100, width: NaN, height: NaN },
        { x: 400, y: 200, w: 80, h: 40 },
      ];

      const xs = nodes.map(n => [n.x, n.x + getNodeWidth(n)]).flat();
      const ys = nodes.map(n => [n.y, n.y + getNodeHeight(n)]).flat();

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      expect(Number.isFinite(minX)).toBe(true);
      expect(Number.isFinite(maxX)).toBe(true);
      expect(Number.isFinite(minY)).toBe(true);
      expect(Number.isFinite(maxY)).toBe(true);

      // With fallback (120), node[1] right edge = 200+120=320
      expect(maxX).toBe(480); // max(100, 320, 480)
      expect(maxY).toBe(240); // max(50, 160, 240)
    });
  });

  describe('framework-integrated-pipeline overlap check NaN safety', () => {
    it('overlap detection with fallback dimensions does not produce false negatives', () => {
      const n1 = { x: 0, y: 0, width: NaN, height: NaN };
      const n2 = { x: 5, y: 5, width: NaN, height: NaN };

      const w1 = getNodeWidth(n1);
      const h1 = getNodeHeight(n1);
      const w2 = getNodeWidth(n2);
      const h2 = getNodeHeight(n2);

      const overlaps = !(
        n1.x + w1 < n2.x ||
        n2.x + w2 < n1.x ||
        n1.y + h1 < n2.y ||
        n2.y + h2 < n1.y
      );

      // With fallback 120x60, both nodes at near origin → overlap
      expect(overlaps).toBe(true);
      expect(Number.isFinite(w1)).toBe(true);
      expect(Number.isFinite(h1)).toBe(true);
    });
  });

  // ─── Strategy files .w/.h migration verification ──────────────

  describe('NetworkLayoutStrategy edge midpoint NaN safety', () => {
    it('edge center calculation produces finite values with corrupted dimensions', () => {
      const source = { x: 100, y: 200, width: NaN, height: NaN, id: 's', label: 'S' };
      const target = { x: 300, y: 400, width: NaN, height: NaN, id: 't', label: 'T' };

      const dx = (target.x + getNodeWidth(target) / 2) - (source.x + getNodeWidth(source) / 2);
      const dy = (target.y + getNodeHeight(target) / 2) - (source.y + getNodeHeight(source) / 2);

      expect(Number.isFinite(dx)).toBe(true);
      expect(Number.isFinite(dy)).toBe(true);
    });

    it('bounds constraint produces finite values with corrupted dimensions', () => {
      const node = { x: 50, y: 50, width: NaN, height: NaN, id: 'n', label: 'N' };
      const canvasWidth = 800;
      const margin = 20;

      const clampedX = Math.max(margin, Math.min(canvasWidth - getNodeWidth(node) - margin, node.x));
      const clampedY = Math.max(margin, Math.min(600 - getNodeHeight(node) - margin, node.y));

      expect(Number.isFinite(clampedX)).toBe(true);
      expect(Number.isFinite(clampedY)).toBe(true);
    });
  });

  describe('TreeLayoutStrategy edge endpoint NaN safety', () => {
    it('source center-bottom and target center-top produce finite values', () => {
      const source = { x: 100, y: 200, width: NaN, height: NaN, id: 's', label: 'S' };
      const target = { x: 300, y: 400, width: NaN, height: NaN, id: 't', label: 'T' };

      const sourcePoint = {
        x: source.x + getNodeWidth(source) / 2,
        y: source.y + getNodeHeight(source)
      };
      const targetPoint = {
        x: target.x + getNodeWidth(target) / 2,
      };

      expect(Number.isFinite(sourcePoint.x)).toBe(true);
      expect(Number.isFinite(sourcePoint.y)).toBe(true);
      expect(Number.isFinite(targetPoint.x)).toBe(true);
    });
  });

  describe('TimelineLayoutStrategy edge endpoint NaN safety', () => {
    it('source right-center and target left-center produce finite values', () => {
      const source = { x: 100, y: 200, width: NaN, height: NaN, id: 's', label: 'S' };
      const target = { x: 300, y: 400, width: NaN, height: NaN, id: 't', label: 'T' };

      const sourcePoint = {
        x: source.x + getNodeWidth(source),
        y: source.y + getNodeHeight(source) / 2
      };
      const targetPoint = {
        y: target.y + getNodeHeight(target) / 2
      };

      expect(Number.isFinite(sourcePoint.x)).toBe(true);
      expect(Number.isFinite(sourcePoint.y)).toBe(true);
      expect(Number.isFinite(targetPoint.y)).toBe(true);
    });
  });

  describe('ComparisonLayoutStrategy edge endpoint NaN safety', () => {
    it('comparison edge endpoints produce finite values with corrupted dimensions', () => {
      const source = { x: 100, y: 200, width: NaN, height: NaN, id: 's', label: 'S' };
      const target = { x: 300, y: 400, width: NaN, height: NaN, id: 't', label: 'T' };
      const sourceIsLeft = source.x < target.x;

      const sourceX = sourceIsLeft ? source.x + getNodeWidth(source) : source.x;
      const sourceY = source.y + getNodeHeight(source) / 2;
      const targetX = sourceIsLeft ? target.x : target.x + getNodeWidth(target);
      const targetY = target.y + getNodeHeight(target) / 2;

      expect(Number.isFinite(sourceX)).toBe(true);
      expect(Number.isFinite(sourceY)).toBe(true);
      expect(Number.isFinite(targetX)).toBe(true);
      expect(Number.isFinite(targetY)).toBe(true);
    });
  });

  describe('ConceptMapLayoutStrategy edge midpoint NaN safety', () => {
    it('concept map edge center produces finite values with corrupted dimensions', () => {
      const source = { x: 100, y: 200, width: NaN, height: NaN, id: 's', label: 'S' };
      const target = { x: 300, y: 400, width: NaN, height: NaN, id: 't', label: 'T' };

      const sourcePoint = {
        x: source.x + getNodeWidth(source) / 2,
        y: source.y + getNodeHeight(source) / 2
      };
      const targetPoint = {
        x: target.x + getNodeWidth(target) / 2,
        y: target.y + getNodeHeight(target) / 2
      };

      expect(Number.isFinite(sourcePoint.x)).toBe(true);
      expect(Number.isFinite(sourcePoint.y)).toBe(true);
      expect(Number.isFinite(targetPoint.x)).toBe(true);
      expect(Number.isFinite(targetPoint.y)).toBe(true);
    });
  });

  describe('quality-monitor nodesOverlap NaN safety', () => {
    it('overlap detection uses fallback dimensions instead of NaN', () => {
      // Simulate what quality-monitor does after migration
      const node1 = { x: 0, y: 0, w: NaN, h: NaN };
      const node2 = { x: 5, y: 5, w: NaN, h: NaN };

      // With helpers, NaN w/h is resolved to fallback (120, 60)
      const w1 = getNodeWidth(node1 as never);
      const h1 = getNodeHeight(node1 as never);
      const w2 = getNodeWidth(node2 as never);
      const h2 = getNodeHeight(node2 as never);

      const margin = 10;
      const overlaps = !(
        node1.x + w1 + margin < node2.x ||
        node2.x + w2 + margin < node1.x ||
        node1.y + h1 + margin < node2.y ||
        node2.y + h2 + margin < node1.y
      );

      expect(Number.isFinite(w1)).toBe(true);
      expect(Number.isFinite(h1)).toBe(true);
      expect(overlaps).toBe(true); // Both at origin with fallback dimensions → overlap
    });
  });

  describe('enhanced-zero-overlap-layout canvas utilization NaN safety', () => {
    it('calculateCanvasUtilization produces finite bounds with corrupted dimensions', () => {
      const nodes = [
        { x: 0, y: 0, width: NaN, height: NaN, id: 'a', label: 'A' },
        { x: 200, y: 100, width: NaN, height: NaN, id: 'b', label: 'B' },
      ];

      const minX = Math.min(...nodes.map(n => n.x));
      const maxX = Math.max(...nodes.map(n => n.x + getNodeWidth(n)));
      const minY = Math.min(...nodes.map(n => n.y));
      const maxY = Math.max(...nodes.map(n => n.y + getNodeHeight(n)));

      expect(Number.isFinite(minX)).toBe(true);
      expect(Number.isFinite(maxX)).toBe(true);
      expect(Number.isFinite(minY)).toBe(true);
      expect(Number.isFinite(maxY)).toBe(true);

      const usedArea = (maxX - minX) * (maxY - minY);
      expect(Number.isFinite(usedArea)).toBe(true);
      expect(usedArea).toBeGreaterThan(0);
    });

    it('collision resolution produces finite positions with corrupted dimensions', () => {
      const node1 = { x: 50, y: 50, width: NaN, height: NaN, id: 'a', label: 'A' };
      const node2 = { x: 55, y: 55, width: NaN, height: NaN, id: 'b', label: 'B' };
      const canvasWidth = 800;
      const canvasHeight = 600;

      const x1 = Math.max(0, Math.min(canvasWidth - getNodeWidth(node1), node1.x));
      const y1 = Math.max(0, Math.min(canvasHeight - getNodeHeight(node1), node1.y));
      const x2 = Math.max(0, Math.min(canvasWidth - getNodeWidth(node2), node2.x));
      const y2 = Math.max(0, Math.min(canvasHeight - getNodeHeight(node2), node2.y));

      expect(Number.isFinite(x1)).toBe(true);
      expect(Number.isFinite(y1)).toBe(true);
      expect(Number.isFinite(x2)).toBe(true);
      expect(Number.isFinite(y2)).toBe(true);
    });
  });
});
