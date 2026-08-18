/**
 * @jest-environment node
 */
/**
 * canvas-calculator-sanitizeFinite-migration-pinning.test.ts
 *
 * Pins the consolidation of inline `Number.isFinite(x) ? x : 0` patterns in
 * `src/visualization/canvas-calculator.ts` to the canonical `sanitizeFinite(x, 0)`
 * helper from `@stv/core/utils/guards`. Ten inline sites migrated across the `calculate()`
 * bounding-box loop (5 sites: x, w, y, h), the `center()` bounding-box loop
 * (5 sites: x, w, y, h), and the `center()` map-reprojection (2 sites for
 * the offset-applied x/y). The 10-site count groups the migration at the
 * `bbox-extent` + `point-reproject` patterns — every "this number might be
 * NaN, fall back to 0" site on a PositionedNode coordinate flows through
 * the chokepoint.
 *
 * THE BUG CLASS. The inline `Number.isFinite(x) ? x : 0` pattern is fragile:
 * - The two bounding-box loops in `calculate()` and `center()` are
 *   structurally identical (same 5 sites: `left`, `right`, `top`,
 *   `bottom`, `width`/`height` via getNodeWidth/Height). Any future
 *   contributor copy-pasting between them duplicates the sprawl.
 * - The `center()` map-reprojection repeats the same idiom twice for
 *   the offset-applied x and y, making it a third copy site.
 * - `sanitizeFinite` (with `defaultValue = 0`) is byte-for-byte
 *   equivalent to the inline ternary for every input that flows through
 *   this module (finite x, NaN, ±Infinity — all collapse to the same
 *   fallback). The inline form bypasses the chokepoint.
 *
 * WHY MUTATION PINNING. Layer 1 source-anchors ZERO remaining inline
 * `Number.isFinite(...)?...: 0` ternary in canvas-calculator.ts and
 * confirms `sanitizeFinite` is imported and called at the migrated sites.
 * Layer 2 behavioral: a node with `x = NaN` / `Infinity` / `-Infinity`
 * must not poison `minX`/`maxX` (the bbox accumulator); the migrated
 * chokepoint collapses the sentinel to 0, preserving a finite bbox.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { CanvasCalculator } from '@/visualization/canvas-calculator';
import type { PositionedNode } from '@stv/core/types/diagram';

const GUARD_FILE = 'src/visualization/canvas-calculator.ts';

// --- (1) source anchors: ZERO inline Number.isFinite(x) ? x : 0 ternary ---

describe('canvas-calculator sanitizeFinite — source anchors pinned', () => {
  const src = (): string => readFileSync(GUARD_FILE, 'utf8');

  it('does NOT contain the inline `Number.isFinite(...) ? ... : 0` ternary', () => {
    // The migrated sites must use sanitizeFinite; any reintroduction of the
    // inline ternary bypasses the chokepoint → RED.
    expect(src()).not.toMatch(/Number\.isFinite\([^)]*\)\s*\?\s*[^)]*\s*:\s*0/);
  });

  it('imports sanitizeFinite from @stv/core/utils/guards', () => {
    // The migration contract: canvas-calculator depends on the canonical
    // helper. Removing the import (and rolling back to inline ternaries)
    // breaks this anchor → RED.
    expect(src()).toMatch(/import\s*\{\s*sanitizeFinite\s*\}\s*from\s*['"]@stv\/core\/utils\/guards['"]/);
  });

  it('calls sanitizeFinite at the migrated sites (≥ 6 invocations)', () => {
    // Round 41 update (was ≥ 10): the two structurally identical bbox loops
    // in calculate()/center() were deduplicated into the ONE
    // `sanitizedExtentEdges` read helper (4 chokepoint reads: x, y, width,
    // height), with the extent FOLD delegated to `foldNodeExtents` in
    // layout-utils. 4 reads + 2 map-reproject sites in center() = 6 minimum.
    // Drop any one → match count < 6 → RED.
    const matches = src().match(/sanitizeFinite\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });

  it('routes both extent scans through the sanitized read (round 41)', () => {
    // The r41 delegation seam: calculate() and center() must BOTH pass the
    // local sanitized read to the canonical fold — a site that swaps in the
    // raw `nodeExtentEdges` read silently drops the NaN chokepoint → RED.
    const occurrences = src().match(/foldNodeExtents\(nodes, sanitizedExtentEdges\)/g);
    expect(occurrences?.length).toBe(2);
    // ...and the read helper itself carries the four chokepoint calls.
    expect(src()).toMatch(
      /function sanitizedExtentEdges[\s\S]*?sanitizeFinite\(node\.x, 0\)[\s\S]*?sanitizeFinite\(getNodeWidth\(node, 0\), 0\)/,
    );
  });
});

// --- (2) behavioral witness: NaN/Infinity coordinates do not poison bbox ----

describe('canvas-calculator sanitizeFinite — behavioral witness', () => {
  const calculator = new CanvasCalculator();

  const makeNode = (overrides: Partial<PositionedNode> = {}): PositionedNode => ({
    id: 'n0',
    label: 'Node 0',
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    ...overrides,
  });

  it('calculate() finite bbox when a node has NaN/Infinity coordinates', () => {
    // Pre-migration the inline ternary collapsed these to 0 already, so the
    // bbox stayed finite. Post-migration, sanitizeFinite collapses ±Infinity
    // and NaN to 0 identically. If a regression reintroduces a non-zero
    // fallthrough (or the sentinel leaks), bboxWidth / bboxHeight becomes
    // NaN/Infinity and the final `width` / `height` (after Math.max(1, ...))
    // is no longer `>= 2`. The test pins to the lower bound of a sane
    // finite result.
    const nodes: PositionedNode[] = [
      makeNode({ x: 0, y: 0 }),
      makeNode({ id: 'n1', label: 'NaN-node', x: Number.NaN, y: 100, width: 80, height: 40 }),
      makeNode({ id: 'n2', label: '+Inf-node', x: Number.POSITIVE_INFINITY, y: 200, width: 80, height: 40 }),
      makeNode({ id: 'n3', label: '-Inf-node', x: Number.NEGATIVE_INFINITY, y: 300, width: 80, height: 40 }),
    ];

    const result = calculator.calculate(nodes);

    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(Number.isFinite(result.padding.left)).toBe(true);
    expect(Number.isFinite(result.padding.top)).toBe(true);
  });

  it('center() produces finite reprojected coordinates for non-finite inputs', () => {
    // The two map-reprojection sites must use sanitizeFinite. Without the
    // chokepoint, a NaN node.x would propagate to the reprojected x
    // (NaN + offsetX = NaN), breaking downstream layout. The migrated
    // chokepoint drops NaN / ±Infinity to 0 before adding the offset,
    // keeping the result finite.
    const nodes: PositionedNode[] = [
      makeNode({ x: Number.NaN, y: 50, width: 80, height: 40 }),
      makeNode({ id: 'n1', label: 'Inf-x', x: Number.POSITIVE_INFINITY, y: 150, width: 80, height: 40 }),
    ];
    const canvas = {
      width: 1000,
      height: 1000,
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      scale: 1,
    };

    const reprojected = calculator.center(nodes, canvas);

    expect(reprojected.length).toBe(2);
    for (const node of reprojected) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});
