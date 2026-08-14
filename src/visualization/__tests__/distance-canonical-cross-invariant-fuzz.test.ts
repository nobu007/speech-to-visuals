/**
 * Cross-invariant pin for the 2-D Euclidean distance consolidation.
 *
 * Every layout / overlap / edge-crossing / visual-balance / animation module
 * previously inlined its own `Math.sqrt(dx * dx + dy * dy)` (and a `** 2`
 * variant) — ~25 independent copies across 12 files that could silently drift
 * (someone writes `Math.sqrt(dx*dx) + Math.sqrt(dy*dy)`, drops a square, or
 * swaps in a Manhattan `|dx|+|dy|`), corrupting the layout-quality decisions
 * that depend on correct distances. They now ALL delegate to the single
 * canonical `distance(dx, dy)` in layout-utils.ts, and `calculateDistance`
 * delegates to it too. This file pins:
 *
 *   1. the canonical's arithmetic against an INDEPENDENT reference
 *      (`Math.hypot` — a different implementation of the same 2-norm) over a
 *      deterministic fuzz, so an edit that changes the formula is caught;
 *   2. that `calculateDistance(p1, p2)` agrees with the primitive everywhere;
 *   3. that NO production source under src/visualization + src/remotion
 *      re-inlines the `sqrt(x·x + y·y)` / `sqrt(x**2 + y**2)` pattern (except
 *      the canonical definition itself), so a future copy-paste re-inline is
 *      caught at test time rather than reintroducing the drift hazard.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism,
 * mirroring overlap-canonical-cross-invariant-fuzz.test.ts.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '@tests/helpers/fuzz';
import { distance, calculateDistance } from '../layout-utils';
import type { Point } from '../types';

// Guard reads are anchored to import.meta.url, not process.cwd(): jest workers
// can run with a cwd that is not the repo root, which flaked the bare
// relative 'src/visualization' form under --maxWorkers>1 (same as TC-302/313).
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

/** Independent reference: Math.hypot is a distinct implementation of sqrt(x²+y²). */
function referenceDistance(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

describe('2-D distance: single source of truth (layout-utils.distance)', () => {
  // -------------------------------------------------------------------------
  // Literal anchors — known distances. Catches a formula that is wrong by a
  // constant factor or missing a term.
  // -------------------------------------------------------------------------
  describe('literal anchors: canonical matches known distances', () => {
    it('3-4-5 right triangle', () => {
      expect(distance(3, 4)).toBe(5);
    });

    it('axis-aligned delta reduces to the axis magnitude', () => {
      expect(distance(7, 0)).toBe(7);
      expect(distance(0, 9)).toBe(9);
      expect(distance(-7, 0)).toBe(7);
    });

    it('zero vector has zero length', () => {
      expect(distance(0, 0)).toBe(0);
    });

    it('is a norm: sign-symmetric', () => {
      expect(distance(-3, -4)).toBe(5);
      expect(distance(3, -4)).toBe(5);
      expect(distance(-3, 4)).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Fuzz — canonical must match the independent reference for any (dx, dy).
  // -------------------------------------------------------------------------
  describe('fuzz: canonical == Math.hypot (independent reference)', () => {
    it('5000 random (dx,dy) agree to floating precision', () => {
      const rng = mulberry32(0x64697374); // 'dist'
      let maxAbsDiff = 0;
      for (let i = 0; i < 5000; i++) {
        const dx = (rng() - 0.5) * 2000;
        const dy = (rng() - 0.5) * 2000;
        const got = distance(dx, dy);
        const ref = referenceDistance(dx, dy);
        maxAbsDiff = Math.max(maxAbsDiff, Math.abs(got - ref));
        // A wrong formula (e.g. |dx|+|dy|, or a dropped square) diverges by
        // O(result); the two correct implementations agree to ~1e-12.
        expect(got).toBeCloseTo(ref, 8);
      }
      // Guard the guard: the fuzz must actually exercise non-trivial inputs.
      expect(maxAbsDiff).toBeLessThan(1e-6);
    });
  });

  // -------------------------------------------------------------------------
  // Delegation — calculateDistance must route through the primitive.
  // -------------------------------------------------------------------------
  describe('calculateDistance delegates to the canonical primitive', () => {
    it('calculateDistance(p1,p2) == distance(delta) == hypot', () => {
      const rng = mulberry32(0x707473); // 'pts'
      for (let i = 0; i < 1000; i++) {
        const p1: Point = { x: rng() * 500, y: rng() * 500 };
        const p2: Point = { x: rng() * 500, y: rng() * 500 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        expect(calculateDistance(p1, p2)).toBeCloseTo(distance(dx, dy), 10);
        expect(calculateDistance(p1, p2)).toBeCloseTo(Math.hypot(dx, dy), 8);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Structural guard — no production source re-inlines the distance formula.
  // -------------------------------------------------------------------------
  describe('structural guard: no re-inlined distance formula in production', () => {
    /**
     * `sqrt(x·x + y·y)` — the SAME factor on both sides of each product, i.e.
     * a true x²+y². Backreferences (\1, \2) make this precise: a non-distance
     * `sqrt(a*b + c*d)` with distinct factors does NOT match.
     */
    const SQ_FORM =
      /Math\.sqrt\(\s*([\w.()-]+)\s*\*\s*\1\s*\+\s*([\w.()-]+)\s*\*\s*\2\s*\)/;
    /** `sqrt(x**2 + y**2)` — the power form (also consolidated away). */
    const POW_FORM =
      /Math\.sqrt\(\s*[\w.() -]+?\s*\*\*\s*2\s*\+\s*[\w.() -]+?\s*\*\*\s*2\s*\)/;

    function collectTs(dir: string, acc: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collectTs(full, acc);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) acc.push(full);
      }
      return acc;
    }

    it('src/visualization + src/remotion re-inline nothing (except the canonical)', () => {
      const files = [...collectTs(join(REPO_ROOT, 'src/visualization')), ...collectTs(join(REPO_ROOT, 'src/remotion'))];
      const violations: string[] = [];

      for (const file of files) {
        // layout-utils.ts legitimately DEFINES the canonical — skip it.
        if (file.endsWith('layout-utils.ts')) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, idx) => {
          if (SQ_FORM.test(line) || POW_FORM.test(line)) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it('src/visualization + src/remotion do not re-inline sqrt(Math.pow(x,2)+Math.pow(y,2)) (the multi-line Math.pow form)', () => {
      // The line-scoped SQ_FORM / POW_FORM above catch the single-line
      // `sqrt(x*x + y*y)` and `sqrt(x**2 + y**2)` spellings. They miss TWO
      // things at once: the `Math.pow(x, 2)` FUNCTION form (neither `*` nor
      // `**`), and any inline split across multiple lines (the guard above
      // tests one line at a time). Together those gaps let a residual distance
      // formula stay inline in enhanced-zero-overlap-layout.ts long after the
      // consolidation. Read whole-file source here so newlines cannot hide a
      // copy, and forbid the Math.pow form as well.
      const POW_FN_FORM =
        /Math\.sqrt\(\s*Math\.pow\([\s\S]+?,\s*2\s*\)\s*\+\s*Math\.pow\([\s\S]+?,\s*2\s*\)\s*\)/;
      const files = [...collectTs(join(REPO_ROOT, 'src/visualization')), ...collectTs(join(REPO_ROOT, 'src/remotion'))];
      const violations: string[] = [];
      for (const file of files) {
        if (file.endsWith('layout-utils.ts')) continue; // canonical definition
        // Test CODE only: strip comments so a doc comment quoting the formula
        // cannot false-positive (same convention as the clamp01 single-source
        // guard).
        const src = readFileSync(file, 'utf8')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        if (POW_FN_FORM.test(src)) violations.push(file);
      }
      expect(violations).toEqual([]);
    });
  });
});
