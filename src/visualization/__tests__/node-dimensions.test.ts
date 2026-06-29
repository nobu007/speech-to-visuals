import { describe, it, expect } from '@jest/globals';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import type { PositionedNode } from '@/types/diagram';

describe('node-dimensions', () => {
  // ---------- getNodeWidth ----------

  describe('getNodeWidth', () => {
    it('returns width when set', () => {
      const node = { width: 200 } as PositionedNode;
      expect(getNodeWidth(node)).toBe(200);
    });

    it('returns w when width is undefined', () => {
      const node = { w: 150 } as PositionedNode;
      expect(getNodeWidth(node)).toBe(150);
    });

    it('prefers width over w', () => {
      const node = { width: 200, w: 100 } as PositionedNode;
      expect(getNodeWidth(node)).toBe(200);
    });

    it('returns default fallback (120) when neither is set', () => {
      const node = {} as PositionedNode;
      expect(getNodeWidth(node)).toBe(DEFAULT_NODE_WIDTH);
      expect(DEFAULT_NODE_WIDTH).toBe(120);
    });

    it('accepts custom fallback', () => {
      const node = {} as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(0);
      expect(getNodeWidth(node, 99)).toBe(99);
    });

    // NaN safety — the core motivation for this helper
    it('falls through when width is NaN', () => {
      const node = { width: NaN } as PositionedNode;
      expect(getNodeWidth(node)).toBe(DEFAULT_NODE_WIDTH);
    });

    it('falls through when width is NaN but w is finite', () => {
      const node = { width: NaN, w: 180 } as PositionedNode;
      expect(getNodeWidth(node)).toBe(180);
    });

    it('falls through when both width and w are NaN', () => {
      const node = { width: NaN, w: NaN } as PositionedNode;
      expect(getNodeWidth(node, 50)).toBe(50);
    });

    it('falls through when width is Infinity', () => {
      const node = { width: Infinity } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(0);
    });

    it('falls through when width is -Infinity', () => {
      const node = { width: -Infinity } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(0);
    });

    it('falls through when width is undefined and w is NaN', () => {
      const node = { w: NaN } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(0);
    });

    it('handles width: 0 correctly (0 is finite)', () => {
      const node = { width: 0 } as PositionedNode;
      expect(getNodeWidth(node, 120)).toBe(0);
    });

    it('handles negative width (finite, though unusual)', () => {
      const node = { width: -10 } as PositionedNode;
      expect(getNodeWidth(node, 120)).toBe(-10);
    });

    it('handles fractional width', () => {
      const node = { width: 120.5 } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(120.5);
    });
  });

  // ---------- getNodeHeight ----------

  describe('getNodeHeight', () => {
    it('returns height when set', () => {
      const node = { height: 100 } as PositionedNode;
      expect(getNodeHeight(node)).toBe(100);
    });

    it('returns h when height is undefined', () => {
      const node = { h: 75 } as PositionedNode;
      expect(getNodeHeight(node)).toBe(75);
    });

    it('prefers height over h', () => {
      const node = { height: 100, h: 50 } as PositionedNode;
      expect(getNodeHeight(node)).toBe(100);
    });

    it('returns default fallback (60) when neither is set', () => {
      const node = {} as PositionedNode;
      expect(getNodeHeight(node)).toBe(DEFAULT_NODE_HEIGHT);
      expect(DEFAULT_NODE_HEIGHT).toBe(60);
    });

    it('accepts custom fallback', () => {
      const node = {} as PositionedNode;
      expect(getNodeHeight(node, 0)).toBe(0);
      expect(getNodeHeight(node, 99)).toBe(99);
    });

    // NaN safety
    it('falls through when height is NaN', () => {
      const node = { height: NaN } as PositionedNode;
      expect(getNodeHeight(node)).toBe(DEFAULT_NODE_HEIGHT);
    });

    it('falls through when height is NaN but h is finite', () => {
      const node = { height: NaN, h: 90 } as PositionedNode;
      expect(getNodeHeight(node)).toBe(90);
    });

    it('falls through when both height and h are NaN', () => {
      const node = { height: NaN, h: NaN } as PositionedNode;
      expect(getNodeHeight(node, 25)).toBe(25);
    });

    it('falls through when height is Infinity', () => {
      const node = { height: Infinity } as PositionedNode;
      expect(getNodeHeight(node, 0)).toBe(0);
    });

    it('falls through when height is -Infinity', () => {
      const node = { height: -Infinity } as PositionedNode;
      expect(getNodeHeight(node, 0)).toBe(0);
    });

    it('handles height: 0 correctly (0 is finite)', () => {
      const node = { height: 0 } as PositionedNode;
      expect(getNodeHeight(node, 60)).toBe(0);
    });

    it('handles fractional height', () => {
      const node = { height: 45.5 } as PositionedNode;
      expect(getNodeHeight(node, 0)).toBe(45.5);
    });
  });

  // ---------- Consistency ----------

  describe('property-pair consistency', () => {
    it('getNodeWidth + getNodeHeight work on same node', () => {
      const node = { width: 200, height: 80 } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(200);
      expect(getNodeHeight(node, 0)).toBe(80);
    });

    it('works with w/h pair', () => {
      const node = { w: 140, h: 50 } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(140);
      expect(getNodeHeight(node, 0)).toBe(50);
    });

    it('works with mixed pairs', () => {
      const node = { width: 200, h: 50 } as PositionedNode;
      expect(getNodeWidth(node, 0)).toBe(200);
      expect(getNodeHeight(node, 0)).toBe(50);
    });

    it('works with PositionedNode having x/y', () => {
      const node: PositionedNode = {
        id: 'n1',
        label: 'Node 1',
        x: 10,
        y: 20,
        width: 100,
        height: 40,
      };
      expect(getNodeWidth(node)).toBe(100);
      expect(getNodeHeight(node)).toBe(40);
    });
  });
});
