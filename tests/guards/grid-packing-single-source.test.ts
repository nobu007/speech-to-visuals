/**
 * @jest-environment node
 */
/**
 * grid-packing-single-source.test.ts — round 50.
 *
 * Family: the square-grid packing skeleton + the cell-centered stamp —
 *   columns: `Math.max(1, Math.ceil(Math.sqrt(count)))`      (10 sites)
 *   rows:    `Math.max(1, Math.ceil(count / columns))`       (7 sites + 1 dead)
 *   aspect:  `Math.max(1, Math.ceil(Math.sqrt(n·ratio)))`    (3 sites)
 *   stamp:   `i·cell + (cell − extent)/2 [+ origin]`         (9 sites × 2 axes)
 * re-inlined across ezo ×2, NetworkLayoutStrategy,
 * ConceptMapLayoutStrategy, LayoutOptimizer ×2, FallbackLayoutStrategy,
 * advanced-layouts, GridSnapStrategy, flow-strategy, matrix-strategy,
 * general-strategy and overlap-resolver. Canonical since round 50:
 * squareGridColumns / squareGridRows / aspectGridColumns / centerInCell in
 * src/visualization/layout-utils.ts.
 *
 * DRIFT SCENARIOS this guard defends against:
 *   - a copy drops the `max(1, …)` clamp (advanced-layouts' rows copy had
 *     ALREADY dropped it — dead, but live copies dividing canvas/rows by
 *     zero would NaN the whole grid);
 *   - an aspect copy multiplies the ratio on the wrong operand side or
 *     folds it into the rows line instead of the columns line;
 *   - a stamp copy swaps the per-axis cell/extent pair (the r47 per-axis
 *     seam lesson, grid edition) or re-groups the arithmetic.
 *
 * NUMERIC-DELTA CONTRACT (the reason this round carries a behavior-change
 * note): the retired stamps used two algebraically equal groupings that are
 * NOT bit-identical in binary64 —
 *   A: `(i·cell + cell/2) − extent/2`   (ezo ×2, Network, LayoutOptimizer)
 *   B: `i·cell + (cell − extent)/2`     (ConceptMap, Fallback,
 *      LayoutOptimizer.improveMatrixGrid, matrix, general)
 * The canonical is B (the strategy layer's majority form). Layer 1 pins
 * BOTH retired forms: B sites are Object.is-identical to the canonical;
 * A sites may differ by last-ulp regrouping, pinned ≤ 1e-12 px (measured
 * max 9.1e-13 over the full canvas sweep — 8 orders below render precision,
 * unable to flip an overlap predicate at real node sizes).
 *
 * Layers:
 *   1. VERBATIM ORACLE — every retired expression frozen below (columns,
 *      rows, aspect, stamp A, stamp B, matrix's two-step B variant),
 *      equated to the canonicals over seeded corpora.
 *   2. SEMANTIC PINS — the live-clamp witnesses (0 → 1 column/row), NaN
 *      contracts, stamp arithmetic, and live strategy witnesses (matrix
 *      integer-exact stamp; general spiral stamp recomposed from
 *      primitives).
 *   3. SOURCE ANCHORS — every migrated file delegates with its shape, the
 *      raw expressions live in exactly one module, and the scope-outs
 *      (origin-only snap stamp, multi-cell span stamp, fixed-pitch grid)
 *      keep their inline forms.
 *
 * The "no site re-inlines the family" discovery sweep lives in the shared
 * registry (frozen-literal-families/grid-packing.ts); this file holds the
 * behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import {
  squareGridColumns,
  squareGridRows,
  aspectGridColumns,
  centerInCell,
} from '@/visualization/layout-utils';
import { TARGET_ASPECT_RATIO } from '@/visualization/canvas-dimensions';
import { MatrixStrategy } from '@/visualization/strategies/matrix-strategy';
import { GeneralStrategy } from '@/visualization/strategies/general-strategy';
import type { NodeDatum } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-50 expressions, frozen from the
// migrated files at 22980e5c (round 49 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

/** The columns derivation — all 10 retired sites, byte-identical. */
function legacyColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/** The rows derivation — 7 retired sites (ezo, ConceptMap, LayoutOptimizer
 *  improveMatrixGrid, Fallback's inline divisor, matrix, general,
 *  overlap-resolver). */
function legacyRows(count: number, columns: number): number {
  return Math.max(1, Math.ceil(count / columns));
}

/** The aspect-columns derivation — matrix / general / overlap-resolver. */
function legacyAspectColumns(count: number, ratio: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count * ratio)));
}

/** Stamp A — ezo ×2, Network, LayoutOptimizer.optimizeMatrixLayout. */
function legacyStampA(index: number, cell: number, extent: number, origin = 0): number {
  return origin + index * cell + cell / 2 - extent / 2;
}

/** Stamp B — ConceptMap, Fallback, LayoutOptimizer.improveMatrixGrid,
 *  general (all single-expression). */
function legacyStampB(index: number, cell: number, extent: number, origin = 0): number {
  return origin + index * cell + (cell - extent) / 2;
}

/** matrix-strategy's two-step B — cell origin local, then the offset. */
function legacyStampMatrix(col: number, cell: number, extent: number, padding: number): number {
  const cellX = padding + col * cell;
  return cellX + (cell - extent) / 2;
}

// ---------------------------------------------------------------------------
// Corpora.
// ---------------------------------------------------------------------------

/** Counts the retired sites actually see: 0 (empty graph — the LIVE clamp
 *  case), small grids, big grids, and the non-finite contract values. */
const COUNTS: number[] = [0, 1, 2, 3, 4, 5, 8, 9, 10, 15, 16, 17, 24, 25, 99, 100, 101, 250, 1000, 4356, 9999, 1e6];

/** (index, cell, extent, origin) tuples over the migrated sites' canvas
 *  domains: 1920×1080-class canvases, 1–80 columns, node extents 0–480,
 *  margins 0/40/80. This is the domain the A-form delta bound is pinned
 *  against (measured max 9.1e-13 px). */
function buildCanvasStampCorpus(): Array<[number, number, number, number]> {
  const cases: Array<[number, number, number, number]> = [];
  const canvases = [1920, 1080, 1280, 720, 2560, 1440, 3840, 2160, 1760, 920];
  for (const canvas of canvases) {
    for (let cols = 1; cols <= 80; cols++) {
      const cell = canvas / cols;
      for (let i = 0; i < Math.min(cols * 2, 40); i++) {
        for (const extent of [0, 20, 60, 120, 140, 177.5, 240, 250.3, 400, 480]) {
          for (const origin of [0, 40, 80]) {
            cases.push([i, cell, extent, origin]);
          }
        }
      }
    }
  }
  return cases;
}

/** Seeded fuzz tail: wider indexes/cells/extents than any real canvas, to
 *  keep the equality oracles honest beyond the hand-built domain (the A-form
 *  delta bound here is the looser 1e-9 — measured max 5.8e-11). */
function buildFuzzStampCorpus(): Array<[number, number, number, number]> {
  const cases: Array<[number, number, number, number]> = [];
  const rng = mulberry32(5021);
  for (let k = 0; k < 4000; k++) {
    cases.push([
      Math.floor(rng() * 120),
      +(rng() * 4000).toFixed(4),
      +(rng() * 900).toFixed(4),
      [0, 40, 80, 160][Math.floor(rng() * 4)],
    ]);
  }
  return cases;
}

const CANVAS_STAMP_CORPUS = buildCanvasStampCorpus();
const FUZZ_STAMP_CORPUS = buildFuzzStampCorpus();

describe('round 50: grid packing single source — layer 1 verbatim oracle', () => {
  it('the columns derivation is byte-identical at every retired count', () => {
    for (const count of COUNTS) {
      expect(Object.is(squareGridColumns(count), legacyColumns(count))).toBe(true);
    }
    // NaN/negative contract: sqrt(NaN) and sqrt(negative) are NaN, and
    // max(1, NaN) is NaN — the retired forms did exactly this.
    for (const count of [NaN, -1, -4, Infinity, 2.5, 0.000001]) {
      expect(Object.is(squareGridColumns(count), legacyColumns(count))).toBe(true);
    }
  });

  it('the rows derivation is byte-identical over counts × canonical columns', () => {
    const rng = mulberry32(5022);
    for (let k = 0; k < 2000; k++) {
      const count = COUNTS[Math.floor(rng() * COUNTS.length)];
      const columns = squareGridColumns(Math.floor(rng() * 500));
      expect(Object.is(squareGridRows(count, columns), legacyRows(count, columns))).toBe(true);
    }
    for (const count of COUNTS) {
      for (const columns of [1, 2, 3, 7, 13, 100]) {
        expect(Object.is(squareGridRows(count, columns), legacyRows(count, columns))).toBe(true);
      }
    }
  });

  it('the aspect derivation preserves the retired operand order (count · ratio)', () => {
    const ratios = [TARGET_ASPECT_RATIO, 1, 0.5, 0.75, 9 / 16, 2, 4 / 3, NaN, 0, -1.5];
    for (const count of COUNTS) {
      for (const ratio of ratios) {
        expect(Object.is(aspectGridColumns(count, ratio), legacyAspectColumns(count, ratio))).toBe(true);
      }
    }
    // the compose is exact: aspectGridColumns delegates the SAME product to
    // squareGridColumns — no re-grouped sqrt of a re-associated multiply.
    expect(aspectGridColumns(12, TARGET_ASPECT_RATIO)).toBe(squareGridColumns(12 * TARGET_ASPECT_RATIO));
  });

  it('stamp B sites are Object.is-identical to the canonical (zero delta)', () => {
    // ConceptMap / Fallback / improveMatrixGrid / general were ALREADY the
    // canonical grouping; delegating them cannot move a single bit.
    for (const [i, cell, extent, origin] of [...CANVAS_STAMP_CORPUS, ...FUZZ_STAMP_CORPUS]) {
      expect(Object.is(centerInCell(i, cell, extent, origin), legacyStampB(i, cell, extent, origin))).toBe(true);
    }
  });

  it("matrix's two-step B variant folds to the same canonical call", () => {
    for (const [i, cell, extent, origin] of [...CANVAS_STAMP_CORPUS, ...FUZZ_STAMP_CORPUS]) {
      expect(Object.is(centerInCell(i, cell, extent, origin), legacyStampMatrix(i, cell, extent, origin))).toBe(true);
    }
  });

  it('stamp A sites (ezo ×2, Network, optimizeMatrixLayout) shift by ≤ 1e-12 px on canvas domains — and the witness PROVES the shift is real', () => {
    // The regrouping (a + b) − c → a + (b − c) rounds at different points;
    // last-ulp differences exist and MUST be pinned as existing (a vacuous
    // bound would hide the behavior change this round ships).
    let deltas = 0;
    for (const [i, cell, extent, origin] of CANVAS_STAMP_CORPUS) {
      const got = centerInCell(i, cell, extent, origin);
      const legacy = legacyStampA(i, cell, extent, origin);
      if (!Object.is(got, legacy)) {
        deltas++;
        expect(Math.abs(got - legacy)).toBeLessThanOrEqual(1e-12);
      }
    }
    expect(deltas).toBeGreaterThan(0); // the bound is exercised, not vacuous
    // Integer-friendly grids — every layout test's domain — stay EXACT:
    // integer cell with even (cell − extent) has no rounding at all.
    for (let i = 0; i < 10; i++) {
      for (const cell of [100, 240, 480, 880]) {
        for (const extent of [60, 120, 140]) {
          expect(Object.is(centerInCell(i, cell, extent), legacyStampA(i, cell, extent))).toBe(true);
          expect(Object.is(centerInCell(i, cell, extent, 80), legacyStampA(i, cell, extent, 80))).toBe(true);
        }
      }
    }
  });

  it('stamp A fuzz tail: deltas stay last-ulp class beyond canvas domains too', () => {
    for (const [i, cell, extent, origin] of FUZZ_STAMP_CORPUS) {
      const got = centerInCell(i, cell, extent, origin);
      const legacy = legacyStampA(i, cell, extent, origin);
      if (!Object.is(got, legacy)) {
        // measured max 5.8e-11 at i·cell up to ~5e5 — still ~7 result-ulps
        expect(Math.abs(got - legacy)).toBeLessThanOrEqual(1e-9);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — live clamps, contracts, and live strategies.
// ---------------------------------------------------------------------------

describe('round 50: grid packing — layer 2 semantic pins', () => {
  it('LIVE CLAMP WITNESS: an empty graph packs to 1 column / 1 row (canvas/cols never divides by zero)', () => {
    expect(squareGridColumns(0)).toBe(1);
    expect(squareGridRows(0, squareGridColumns(0))).toBe(1);
    // unlike ringAngle (round 48, dead clamp), these sites DO see 0
    expect(squareGridColumns(5)).toBe(3); // ceil(√5)
    expect(squareGridRows(5, squareGridColumns(5))).toBe(2); // ceil(5/3)
  });

  it('packing sizes: ceil(√n) columns, ceil(n/cols) rows', () => {
    expect(squareGridColumns(1)).toBe(1);
    expect(squareGridColumns(2)).toBe(2); // ceil(√2)
    expect(squareGridColumns(4)).toBe(2);
    expect(squareGridColumns(5)).toBe(3);
    expect(squareGridColumns(9)).toBe(3);
    expect(squareGridColumns(10)).toBe(4);
    expect(squareGridRows(4, 2)).toBe(2);
    expect(squareGridRows(5, 2)).toBe(3);
    expect(squareGridRows(10, 4)).toBe(3);
  });

  it('aspect columns outnumber square ones on a 16:9 canvas', () => {
    expect(TARGET_ASPECT_RATIO).toBe(16 / 9);
    expect(aspectGridColumns(9, TARGET_ASPECT_RATIO)).toBe(4); // ceil(√16)
    expect(aspectGridColumns(9, TARGET_ASPECT_RATIO)).toBeGreaterThan(squareGridColumns(9));
  });

  it('stamp arithmetic: half the remaining space, per axis, after the origin', () => {
    expect(centerInCell(0, 100, 60)).toBe(20);
    expect(centerInCell(2, 240, 140, 80)).toBe(80 + 2 * 240 + 50);
    // extent == cell parks the node at the cell origin; a too-large extent
    // legitimately crosses left of it (documented, matches retired forms)
    expect(centerInCell(3, 100, 100)).toBe(300);
    expect(centerInCell(3, 100, 140, 10)).toBe(10 + 300 - 20);
  });

  it('LIVE WITNESS: MatrixStrategy single node stamps the exact integer cell position', () => {
    const strategy = new MatrixStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' } as NodeDatum], []);
    // columns = ceil(√(1·16/9)) = 2, rows = 1; usable = (1920−160)×(1080−160);
    // cell = 880×920; x = 80 + (880−120)/2 = 460, y = 80 + (920−60)/2 = 510.
    expect(result.nodes[0]).toMatchObject({ x: 460, y: 510, width: 120, height: 60 });
  });

  it('LIVE WITNESS: GeneralStrategy spiral stamp recomposes from primitives', () => {
    const strategy = new GeneralStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' } as NodeDatum], []);
    // columns = 2, rows = 1; spiral starts at (centerCol, centerRow) = (1, 0);
    // cell = (120+NODE_SEP)×(60+NODE_SEP) with the module-local NODE_SEP = 40;
    // offsets center the grid, min 40.
    const cellW = 120 + 40;
    const cellH = 60 + 40;
    const offsetX = Math.max(40, (1920 - 2 * cellW) / 2);
    const offsetY = Math.max(40, (1080 - 1 * cellH) / 2);
    const expectedX = centerInCell(1, cellW, 120, offsetX);
    const expectedY = centerInCell(0, cellH, 60, offsetY);
    expect(result.nodes[0].x).toBe(expectedX);
    expect(result.nodes[0].y).toBe(expectedY);
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shapes at every migrated site, the
// raw expressions exactly once, the scope-outs documented.
// ---------------------------------------------------------------------------

const RAW_COLUMNS = /Math\.max\(1,\s*Math\.ceil\(Math\.sqrt\(/;
const RAW_ROWS = /Math\.max\(1,\s*Math\.ceil\([^\n()]*\/\s*[^\n()]*\)\)/;

function codeLines(rel: string): string[] {
  return readSource(rel)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

describe('round 50: grid packing — layer 3 source anchors', () => {
  it('layout-utils holds each raw expression exactly once (the canonicals)', () => {
    const lines = codeLines('src/visualization/layout-utils.ts');
    expect(lines.filter((l) => RAW_COLUMNS.test(l)).length).toBe(1);
    expect(lines.filter((l) => /Math\.ceil\(count \/ columns\)/.test(l)).length).toBe(1);
    expect(lines.filter((l) => /return origin \+ index \* cell \+ \(cell - extent\) \/ 2;/.test(l)).length).toBe(1);
    // aspect composes the columns canonical — no second sqrt fold
    expect(lines.filter((l) => /return squareGridColumns\(count \* aspectRatio\);/.test(l)).length).toBe(1);
  });

  it('ezo delegates both grid sites (network init + basic grid, 4 stamps)', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect((src.match(/squareGridColumns\(nodes\.length\)/g) ?? []).length).toBe(2);
    expect((src.match(/squareGridRows\(nodes\.length, cols\)/g) ?? []).length).toBe(1);
    expect((src.match(/centerInCell\((?:col|row), cell(?:Width|Height), (?:width|height)\)/g) ?? []).length).toBe(4);
    expect(codeLines('src/visualization/enhanced-zero-overlap-layout.ts').some((l) => RAW_COLUMNS.test(l))).toBe(false);
  });

  it('NetworkLayoutStrategy delegates the init grid + both stamps', () => {
    const src = readSource('src/visualization/strategies/NetworkLayoutStrategy.ts');
    expect(src).toMatch(/const gridSize = squareGridColumns\(nodes\.length\);/);
    expect((src.match(/const grid[XY] = centerInCell\(/g) ?? []).length).toBe(2);
    expect(codeLines('src/visualization/strategies/NetworkLayoutStrategy.ts').some((l) => RAW_COLUMNS.test(l))).toBe(false);
  });

  it('ConceptMapLayoutStrategy delegates packing + both stamps', () => {
    const src = readSource('src/visualization/strategies/ConceptMapLayoutStrategy.ts');
    expect(src).toMatch(/const cols = squareGridColumns\(nodes\.length\);/);
    expect(src).toMatch(/const rows = squareGridRows\(nodes\.length, cols\);/);
    expect((src.match(/centerInCell\((?:col|row), cell(?:Width|Height), (?:width|height)\)/g) ?? []).length).toBe(2);
  });

  it('LayoutOptimizer delegates both matrix grids (2 packings + 4 stamps)', () => {
    const src = readSource('src/visualization/strategies/LayoutOptimizer.ts');
    expect((src.match(/squareGridColumns\(nodes\.length\)/g) ?? []).length).toBe(2);
    expect((src.match(/squareGridRows\(nodes\.length, cols\)/g) ?? []).length).toBe(1);
    expect((src.match(/centerInCell\(/g) ?? []).length).toBe(4);
    expect(codeLines('src/visualization/strategies/LayoutOptimizer.ts').some((l) => RAW_COLUMNS.test(l))).toBe(false);
  });

  it('FallbackLayoutStrategy delegates packing (inline rows divisor included) + both stamps', () => {
    const src = readSource('src/visualization/strategies/FallbackLayoutStrategy.ts');
    expect(src).toMatch(/const cols = squareGridColumns\(nodes\.length\);/);
    expect(src).toMatch(/squareGridRows\(nodes\.length, cols\)/);
    expect((src.match(/centerInCell\((?:col|row), spacing[XY], node(?:Width|Height)\)/g) ?? []).length).toBe(2);
  });

  it('advanced-layouts delegates columns and RETIRES the dead unclamped rows copy', () => {
    const src = readSource('src/visualization/advanced-layouts.ts');
    expect(src).toMatch(/const cols = squareGridColumns\(nodes\.length\);/);
    // the drift this round found: rows without the family clamp, computed
    // and never read — gone, not delegated (comment lines excluded so this
    // ban matches CODE, not the retirement note itself).
    expect(codeLines('src/visualization/advanced-layouts.ts').some((l) => /Math\.ceil\(nodes\.length \/ cols\)/.test(l))).toBe(false);
    // its fixed-pitch stamp (200/150, no extent term) is a scope-out:
    expect(src).toMatch(/200 \+ \(index % cols\) \* 200/);
  });

  it('GridSnapStrategy delegates the cell-bound columns and keeps its span-center stamp', () => {
    const src = readSource('src/visualization/layout/strategies/GridSnapStrategy.ts');
    expect(src).toMatch(/const sqrtNodes = squareGridColumns\(nodes\.length\);/);
    // scope-out: multi-cell span center `(cellSize · cellsWide) / 2` is a
    // different concept (span center, not remaining-space center).
    expect(src).toMatch(/\(this\.cellSize \* cellsWide\) \/ 2/);
  });

  it('flow-strategy delegates the row-capacity columns', () => {
    const src = readSource('src/visualization/strategies/flow-strategy.ts');
    expect(src).toMatch(/const maxPerRow = squareGridColumns\(originalNodes\.length\);/);
    expect(codeLines('src/visualization/strategies/flow-strategy.ts').some((l) => RAW_COLUMNS.test(l))).toBe(false);
  });

  it('matrix-strategy delegates aspect packing + rows + the padded stamp', () => {
    const src = readSource('src/visualization/strategies/matrix-strategy.ts');
    expect(src).toMatch(/aspectGridColumns\(nodeCount, TARGET_ASPECT_RATIO\)/);
    expect(src).toMatch(/squareGridRows\(nodeCount, columns\)/);
    expect((src.match(/centerInCell\((?:col|row), cell(?:Width|Height), node(?:Width|Height), CANVAS_PADDING\)/g) ?? []).length).toBe(2);
  });

  it('general-strategy delegates aspect packing + rows + the spiral stamps', () => {
    const src = readSource('src/visualization/strategies/general-strategy.ts');
    expect(src).toMatch(/aspectGridColumns\(sortedNodes\.length, TARGET_ASPECT_RATIO\)/);
    expect(src).toMatch(/squareGridRows\(sortedNodes\.length, columns\)/);
    expect((src.match(/centerInCell\(pos\.(?:col|row), cell(?:Width|Height), [wh], offset[XY]\)/g) ?? []).length).toBe(2);
  });

  it('overlap-resolver delegates aspect packing and KEEPS the origin-only snap stamp', () => {
    const src = readSource('src/visualization/overlap-resolver.ts');
    expect(src).toMatch(/aspectGridColumns\(nodes\.length, aspectRatio\)/);
    expect(src).toMatch(/squareGridRows\(nodes\.length, columns\)/);
    // scope-out: `col · cellWidth + 40` has no centering term — folding it
    // into centerInCell would CHANGE the resolver's snap semantics.
    expect((src.match(/x: col \* cellWidth \+ 40,/g) ?? []).length).toBe(1);
    expect((src.match(/y: row \* cellHeight \+ 40,/g) ?? []).length).toBe(1);
  });

  it('no swept file re-inlines the rows divisor shape outside the canonical', () => {
    for (const rel of [
      'src/visualization/enhanced-zero-overlap-layout.ts',
      'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
      'src/visualization/strategies/LayoutOptimizer.ts',
      'src/visualization/strategies/FallbackLayoutStrategy.ts',
      'src/visualization/strategies/matrix-strategy.ts',
      'src/visualization/strategies/general-strategy.ts',
      'src/visualization/overlap-resolver.ts',
    ]) {
      expect(codeLines(rel).some((l) => RAW_ROWS.test(l))).toBe(false);
    }
  });
});
