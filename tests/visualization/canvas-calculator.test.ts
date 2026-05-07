import { CanvasCalculator, CanvasCalcResult } from '@/visualization/canvas-calculator';
import { PositionedNode } from '@/types/diagram';

function makeNodes(positions: Array<{ x: number; y: number; w?: number; h?: number }>): PositionedNode[] {
  return positions.map((p, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    x: p.x,
    y: p.y,
    width: p.w ?? 120,
    height: p.h ?? 60,
  }));
}

describe('CanvasCalculator', () => {
  const calculator = new CanvasCalculator();

  describe('calculate', () => {
    it('should return canvas containing all nodes with padding', () => {
      const nodes = makeNodes([
        { x: 100, y: 100 },
        { x: 500, y: 400 },
      ]);

      const result = calculator.calculate(nodes);

      // Bounding box: x from 100 to 620 (500+120), y from 100 to 460 (400+60)
      // bbox width = 520, bbox height = 360
      // padding = max(520*0.05, 40) = max(26, 40) = 40
      // width before aspect ratio = 520 + 80 = 600
      // height before aspect ratio = 360 + 80 = 440
      // 600/440 = 1.36 < 16/9 = 1.78, so width = 440 * 16/9 = 782.2
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.padding.left).toBeGreaterThanOrEqual(40);
      expect(result.padding.top).toBeGreaterThanOrEqual(40);
    });

    it('should return default 1920x1080 for empty graph', () => {
      const result = calculator.calculate([]);

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.scale).toBe(1);
    });

    it('should maintain 16:9 aspect ratio', () => {
      const nodes = makeNodes([
        { x: 0, y: 0 },
        { x: 300, y: 200 },
      ]);

      const result = calculator.calculate(nodes);
      const ratio = result.width / result.height;

      // Aspect ratio should be approximately 16:9
      expect(ratio).toBeCloseTo(16 / 9, 1);
    });

    it('should scale down when nodes exceed 1920x1080', () => {
      // Create nodes that span a very large area
      const nodes = makeNodes([
        { x: 0, y: 0, w: 3000, h: 2000 },
      ]);

      const result = calculator.calculate(nodes);

      // Should be scaled to fit within 1920x1080
      expect(result.width).toBeLessThanOrEqual(1920);
      expect(result.height).toBeLessThanOrEqual(1080);
      expect(result.scale).toBeLessThan(1);
    });

    it('should compute padding as 5% of bbox with minimum 40px', () => {
      // Small bounding box: 5% would be small, so min 40 applies
      const smallNodes = makeNodes([
        { x: 0, y: 0 },
        { x: 50, y: 30 },
      ]);
      const smallResult = calculator.calculate(smallNodes);
      expect(smallResult.padding.left).toBe(40);
      expect(smallResult.padding.top).toBe(40);

      // Large bounding box: 5% should exceed 40
      const largeNodes = makeNodes([
        { x: 0, y: 0 },
        { x: 5000, y: 3000 },
      ]);
      const largeResult = calculator.calculate(largeNodes);
      expect(largeResult.padding.left).toBeGreaterThan(40);
      expect(largeResult.padding.top).toBeGreaterThan(40);
    });

    it('should return scale of 1 when canvas fits within defaults', () => {
      const nodes = makeNodes([
        { x: 100, y: 100 },
        { x: 400, y: 300 },
      ]);

      const result = calculator.calculate(nodes);
      expect(result.scale).toBe(1);
    });

    it('should handle single node', () => {
      const nodes = makeNodes([{ x: 500, y: 300 }]);
      const result = calculator.calculate(nodes);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      const ratio = result.width / result.height;
      expect(ratio).toBeCloseTo(16 / 9, 1);
    });
  });

  describe('center', () => {
    it('should position node group at canvas center', () => {
      const nodes = makeNodes([
        { x: 0, y: 0 },
        { x: 200, y: 100 },
      ]);

      const canvas: CanvasCalcResult = {
        width: 1920,
        height: 1080,
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        scale: 1,
      };

      const centered = calculator.center(nodes, canvas);

      // Bounding box center should be at canvas center
      const allX = centered.map((n) => n.x + n.width / 2);
      const allY = centered.map((n) => n.y + n.height / 2);
      const avgX = allX.reduce((a, b) => a + b, 0) / allX.length;
      const avgY = allY.reduce((a, b) => a + b, 0) / allY.length;

      expect(avgX).toBeCloseTo(1920 / 2, 1);
      expect(avgY).toBeCloseTo(1080 / 2, 1);
    });

    it('should preserve relative positions of nodes', () => {
      const nodes = makeNodes([
        { x: 100, y: 100 },
        { x: 300, y: 200 },
        { x: 500, y: 150 },
      ]);

      const canvas: CanvasCalcResult = {
        width: 1920,
        height: 1080,
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        scale: 1,
      };

      const centered = calculator.center(nodes, canvas);

      // Relative distances should be preserved
      const dx01 = centered[1].x - centered[0].x;
      const dy01 = centered[1].y - centered[0].y;
      expect(dx01).toBe(200); // 300 - 100
      expect(dy01).toBe(100); // 200 - 100

      const dx02 = centered[2].x - centered[0].x;
      const dy02 = centered[2].y - centered[0].y;
      expect(dx02).toBe(400); // 500 - 100
      expect(dy02).toBe(50);  // 150 - 100
    });

    it('should return empty array for empty input', () => {
      const canvas: CanvasCalcResult = {
        width: 1920,
        height: 1080,
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        scale: 1,
      };

      const centered = calculator.center([], canvas);
      expect(centered).toHaveLength(0);
    });

    it('should center already-centered nodes without moving them', () => {
      const canvas: CanvasCalcResult = {
        width: 1920,
        height: 1080,
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        scale: 1,
      };

      // Node centered at canvas center: node center = (960, 540)
      const nodes = makeNodes([{ x: 960 - 60, y: 540 - 30 }]); // center at (960, 540)
      const centered = calculator.center(nodes, canvas);

      expect(centered[0].x).toBeCloseTo(960 - 60, 1);
      expect(centered[0].y).toBeCloseTo(540 - 30, 1);
    });
  });
});
