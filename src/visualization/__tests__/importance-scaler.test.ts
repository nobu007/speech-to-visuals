/**
 * Unit tests for importance-scaler
 * Covers: getImportance, importanceSizeScale, importanceWeight,
 * scaledDimensions, isHighImportance, isLowImportance, pickHighestImportance,
 * and VisualizationError migration (TASK-0176).
 */

import {
  getImportance,
  importanceSizeScale,
  importanceWeight,
  scaledDimensions,
  isHighImportance,
  isLowImportance,
  pickHighestImportance,
} from '../importance-scaler';
import { VisualizationError } from '@/pipeline/pipeline-errors';
import type { NodeDatum } from '@stv/core/types/diagram';

function makeNode(id: string, importance?: number): NodeDatum {
  return { id, label: id, meta: importance !== undefined ? { importance } : undefined };
}

// ---------------------------------------------------------------------------
// getImportance
// ---------------------------------------------------------------------------

describe('getImportance', () => {
  it('returns the node importance when set', () => {
    expect(getImportance(makeNode('a', 0.8))).toBe(0.8);
  });

  it('returns DEFAULT_IMPORTANCE (0.5) when meta is undefined', () => {
    expect(getImportance({ id: 'a', label: 'a' })).toBe(0.5);
  });

  it('returns DEFAULT_IMPORTANCE when meta.importance is undefined', () => {
    expect(getImportance(makeNode('a'))).toBe(0.5);
  });

  it('clamps importance below 0 to 0', () => {
    expect(getImportance(makeNode('a', -0.5))).toBe(0);
  });

  it('clamps importance above 1 to 1', () => {
    expect(getImportance(makeNode('a', 1.5))).toBe(1);
  });

  it('treats NaN as missing', () => {
    expect(getImportance(makeNode('a', NaN))).toBe(0.5);
  });

  it('treats null as missing', () => {
    const node: NodeDatum = { id: 'a', label: 'a', meta: { importance: null as unknown as number } };
    expect(getImportance(node)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// importanceSizeScale
// ---------------------------------------------------------------------------

describe('importanceSizeScale', () => {
  it('returns MIN_SCALE (0.75) for importance 0', () => {
    expect(importanceSizeScale(makeNode('a', 0))).toBe(0.75);
  });

  it('returns MAX_SCALE (1.5) for importance 1', () => {
    expect(importanceSizeScale(makeNode('a', 1))).toBe(1.5);
  });

  it('returns midpoint for importance 0.5', () => {
    const scale = importanceSizeScale(makeNode('a', 0.5));
    expect(scale).toBeCloseTo(1.125, 4);
  });
});

// ---------------------------------------------------------------------------
// importanceWeight
// ---------------------------------------------------------------------------

describe('importanceWeight', () => {
  it('returns 0.5 for importance 0', () => {
    expect(importanceWeight(makeNode('a', 0))).toBe(0.5);
  });

  it('returns 2.0 for importance 1', () => {
    expect(importanceWeight(makeNode('a', 1))).toBe(2.0);
  });

  it('returns midpoint for importance 0.5', () => {
    expect(importanceWeight(makeNode('a', 0.5))).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// scaledDimensions
// ---------------------------------------------------------------------------

describe('scaledDimensions', () => {
  it('scales base dimensions by importance', () => {
    const result = scaledDimensions(makeNode('a', 1), 100, 50);
    expect(result.width).toBe(150);  // 100 * 1.5
    expect(result.height).toBe(75);  // 50 * 1.5
  });

  it('scales with default importance', () => {
    const result = scaledDimensions(makeNode('a'), 100, 50);
    // importance 0.5 → scale 0.75 + 0.75 * 0.5 = 1.125
    expect(result.width).toBe(113);  // Math.round(112.5)
    expect(result.height).toBe(56);  // Math.round(56.25)
  });

  it('does not mutate input', () => {
    const node = makeNode('a', 0.8);
    const before = { ...node };
    scaledDimensions(node, 100, 50);
    expect(node).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// isHighImportance / isLowImportance
// ---------------------------------------------------------------------------

describe('isHighImportance', () => {
  it('returns true for importance > 0.5', () => {
    expect(isHighImportance(makeNode('a', 0.7))).toBe(true);
  });

  it('returns false for importance <= 0.5', () => {
    expect(isHighImportance(makeNode('a', 0.5))).toBe(false);
    expect(isHighImportance(makeNode('a', 0.3))).toBe(false);
  });

  it('returns false for default importance', () => {
    expect(isHighImportance(makeNode('a'))).toBe(false);
  });
});

describe('isLowImportance', () => {
  it('returns true for importance < 0.3', () => {
    expect(isLowImportance(makeNode('a', 0.1))).toBe(true);
  });

  it('returns false for importance >= 0.3', () => {
    expect(isLowImportance(makeNode('a', 0.3))).toBe(false);
    expect(isLowImportance(makeNode('a', 0.5))).toBe(false);
  });

  it('returns false for default importance (0.5)', () => {
    expect(isLowImportance(makeNode('a'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pickHighestImportance
// ---------------------------------------------------------------------------

describe('pickHighestImportance', () => {
  it('picks the node with highest importance', () => {
    const nodes = [
      makeNode('a', 0.3),
      makeNode('b', 0.9),
      makeNode('c', 0.5),
    ];
    expect(pickHighestImportance(nodes).id).toBe('b');
  });

  it('returns first node when all have equal importance', () => {
    const nodes = [
      makeNode('a', 0.5),
      makeNode('b', 0.5),
    ];
    expect(pickHighestImportance(nodes).id).toBe('a');
  });

  it('returns single node array element', () => {
    const node = makeNode('a', 0.7);
    expect(pickHighestImportance([node])).toBe(node);
  });

  it('throws VisualizationError for empty array', () => {
    expect(() => pickHighestImportance([])).toThrow(VisualizationError);
  });

  it('throws VisualizationError with correct message for empty array', () => {
    expect(() => pickHighestImportance([])).toThrow('Cannot pick from empty node list');
  });

  it('handles nodes without importance (defaults to 0.5)', () => {
    const nodes = [
      { id: 'a', label: 'a' },           // importance defaults to 0.5
      makeNode('b', 0.3),                // importance 0.3
    ];
    expect(pickHighestImportance(nodes).id).toBe('a');
  });
});
