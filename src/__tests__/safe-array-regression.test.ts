/**
 * Genuine regression tests for nullable-array guard pattern.
 *
 * Unlike the previous nullable-access-guard.test.ts (which tested inline
 * `x || []` patterns tautologically), these tests IMPORT ACTUAL EXPORTED
 * FUNCTIONS and call them with null/undefined inputs.
 *
 * Without the safeArray guards in the source files, every test below
 * would throw "Cannot read properties of null (reading 'map')" or
 * "Cannot read properties of undefined (reading 'length')".
 */

import { describe, it, expect } from '@jest/globals';
import {
  detectEdgeCrossings,
  minimizeEdgeCrossings,
  analyzeEdgeCrossings,
  EdgeCrossingMinimizer,
} from '../visualization/edge-crossing-minimizer';
import {
  safeArray,
  safeMap,
  safeJoin,
} from '../lib/safe-array';
import type { PositionedNode, LayoutEdge } from '@/types/diagram';

// -- Utility tests (direct) --------------------------------------------------

describe('safeArray utility', () => {
  it('returns empty array for null', () => {
    expect(safeArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it('returns the original array for valid input', () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
  });
});

describe('safeMap utility', () => {
  it('returns [] for null receiver', () => {
    expect(safeMap(null, (x: number) => x * 2)).toEqual([]);
  });

  it('returns [] for undefined receiver', () => {
    expect(safeMap(undefined, (x: number) => x * 2)).toEqual([]);
  });

  it('maps valid arrays correctly', () => {
    expect(safeMap([1, 2, 3], x => x * 2)).toEqual([2, 4, 6]);
  });
});

describe('safeJoin utility', () => {
  it('returns empty string for null', () => {
    expect(safeJoin(null, ', ')).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(safeJoin(undefined, ', ')).toBe('');
  });

  it('joins valid arrays correctly', () => {
    expect(safeJoin(['a', 'b', 'c'], ', ')).toBe('a, b, c');
  });
});

// -- Regression tests: detectEdgeCrossings -----------------------------------

describe('detectEdgeCrossings with null/undefined inputs', () => {
  /*
   * WITHOUT the safeArray guard at the top of detectEdgeCrossings,
   * `edges.length` on line 59 throws:
   *   TypeError: Cannot read properties of null (reading 'length')
   *
   * With the guard, the function returns 0 gracefully.
   */

  it('does not crash when edges is undefined', () => {
    expect(() => detectEdgeCrossings([], undefined as unknown as LayoutEdge[]))
      .not.toThrow();
    expect(detectEdgeCrossings([], undefined as unknown as LayoutEdge[]))
      .toBe(0);
  });

  it('does not crash when nodes is undefined', () => {
    expect(() => detectEdgeCrossings(undefined as unknown as PositionedNode[], []))
      .not.toThrow();
    expect(detectEdgeCrossings(undefined as unknown as PositionedNode[], []))
      .toBe(0);
  });

  it('does not crash when both inputs are undefined', () => {
    expect(() =>
      detectEdgeCrossings(
        undefined as unknown as PositionedNode[],
        undefined as unknown as LayoutEdge[],
      ),
    ).not.toThrow();
  });

  it('does not crash when both inputs are null', () => {
    expect(() =>
      detectEdgeCrossings(
        null as unknown as PositionedNode[],
        null as unknown as LayoutEdge[],
      ),
    ).not.toThrow();
  });

  it('still detects crossings correctly for valid input', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', x: 0, y: 0, label: 'A', width: 100, height: 50 },
      { id: 'b', x: 300, y: 100, label: 'B', width: 100, height: 50 },
      { id: 'c', x: 0, y: 100, label: 'C', width: 100, height: 50 },
      { id: 'd', x: 300, y: 0, label: 'D', width: 100, height: 50 },
    ];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b', source: 'a', target: 'b' },
      { from: 'c', to: 'd', source: 'c', target: 'd' },
    ];
    const count = detectEdgeCrossings(nodes, edges);
    expect(count).toBeGreaterThan(0);
  });
});

// -- Regression tests: minimizeEdgeCrossings ---------------------------------

describe('minimizeEdgeCrossings with null/undefined inputs', () => {
  /*
   * WITHOUT the safeArray guard, `edges.length` on line 115 throws.
   * After guard, returns { nodes: [], crossingCount: 0 }.
   */

  it('returns empty result for undefined nodes and edges', () => {
    const result = minimizeEdgeCrossings(
      undefined as unknown as PositionedNode[],
      undefined as unknown as LayoutEdge[],
    );
    expect(result.nodes).toEqual([]);
    expect(result.crossingCount).toBe(0);
  });

  it('returns empty result for null nodes and edges', () => {
    const result = minimizeEdgeCrossings(
      null as unknown as PositionedNode[],
      null as unknown as LayoutEdge[],
    );
    expect(result.nodes).toEqual([]);
    expect(result.crossingCount).toBe(0);
  });

  it('does not crash with valid nodes but undefined edges', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', x: 0, y: 0, label: 'A', width: 100, height: 50 },
    ];
    expect(() => minimizeEdgeCrossings(nodes, undefined as unknown as LayoutEdge[]))
      .not.toThrow();
  });
});

// -- Regression tests: analyzeEdgeCrossings ----------------------------------

describe('analyzeEdgeCrossings with null/undefined inputs', () => {
  /*
   * analyzeEdgeCrossings delegates to detectEdgeCrossings + minimizeEdgeCrossings.
   * Without guards in those callees, this throws.
   */

  it('does not crash for undefined inputs', () => {
    expect(() =>
      analyzeEdgeCrossings(
        undefined as unknown as PositionedNode[],
        undefined as unknown as LayoutEdge[],
      ),
    ).not.toThrow();
  });

  it('returns zero crossings for null inputs', () => {
    const result = analyzeEdgeCrossings(
      null as unknown as PositionedNode[],
      null as unknown as LayoutEdge[],
    );
    expect(result.crossingCount).toBe(0);
    expect(result.minimizedCrossingCount).toBe(0);
    expect(result.improved).toBe(false);
  });
});

// -- Regression tests: EdgeCrossingMinimizer class ---------------------------

describe('EdgeCrossingMinimizer.detectCrossings with null/undefined', () => {
  /*
   * The class method detectCrossings also accesses edges.length directly.
   * Without guard, throws TypeError.
   */

  it('does not crash for undefined nodes and edges', () => {
    const minimizer = new EdgeCrossingMinimizer();
    expect(() =>
      minimizer.detectCrossings(
        undefined as unknown as PositionedNode[],
        undefined as unknown as LayoutEdge[],
      ),
    ).not.toThrow();
  });

  it('returns zero crossings for null inputs', () => {
    const minimizer = new EdgeCrossingMinimizer();
    const result = minimizer.detectCrossings(
      null as unknown as PositionedNode[],
      null as unknown as LayoutEdge[],
    );
    expect(result.crossingCount).toBe(0);
    expect(result.crossingPairs).toEqual([]);
  });
});

describe('EdgeCrossingMinimizer.minimizeCrossings with null/undefined', () => {
  it('does not crash for undefined nodes and edges', () => {
    const minimizer = new EdgeCrossingMinimizer();
    expect(() =>
      minimizer.minimizeCrossings(
        undefined as unknown as PositionedNode[],
        undefined as unknown as LayoutEdge[],
      ),
    ).not.toThrow();
  });

  it('returns safe defaults for null inputs', () => {
    const minimizer = new EdgeCrossingMinimizer();
    const result = minimizer.minimizeCrossings(
      null as unknown as PositionedNode[],
      null as unknown as LayoutEdge[],
    );
    expect(result.crossingCount).toBe(0);
    expect(result.minimizedNodes).toEqual([]);
    expect(result.improvementPercent).toBe(100);
  });
});
