/**
 * @jest-environment node
 */
/**
 * grid-packing-single-source.test.ts — round 50 (round 51: migrated to the
 * table-driven harness).
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
 * A sites may differ by last-ulp regrouping, pinned ≤ 1e-12 px on canvas
 * domains (measured max 9.1e-13 over the full canvas sweep — 8 orders below
 * render precision, unable to flip an overlap predicate at real node sizes)
 * and ≤ 1e-9 on the fuzz tail (measured max 5.8e-11).
 *
 * Layers (round 51: the MECHANICAL layers 1 and 3 are data rows on the
 * shared harness — see single-source-harness.ts; Layer 2 stays handwritten):
 *   1. VERBATIM ORACLE rows — every retired expression frozen below
 *      (columns, rows, aspect, stamp A, stamp B, matrix's two-step B
 *      variant), equated to the canonicals over seeded corpora. The delta
 *      rows carry the mandatory > 0 witness (a vacuous bound would hide the
 *      behavior change this round shipped).
 *   2. SEMANTIC PINS — the live-clamp witnesses (0 → 1 column/row), NaN
 *      contracts, stamp arithmetic, live strategy witnesses (matrix
 *      integer-exact stamp; general spiral stamp recomposed from
 *      primitives), and the aspect compose-exact witness (moved here from
 *      layer 1 in round 51: it is a canonical-vs-canonical delegation
 *      check, not a retired-vs-canonical oracle — see the fingerprint
 *      ledger in harness-fingerprint.test.ts).
 *   3. SOURCE ANCHOR rows — every migrated file delegates with its shape,
 *      the raw expressions live in exactly one module, and the scope-outs
 *      (origin-only snap stamp, multi-cell span stamp, fixed-pitch grid)
 *      keep their inline forms. Scope 'source' preserves the retired
 *      whole-file `src.match(/…/g)` counts; scope 'code' (default) excludes
 *      comment lines.
 *
 * The "no site re-inlines the family" discovery sweep lives in the shared
 * registry (frozen-literal-families/grid-packing.ts); this file holds the
 * behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { oracleRow, anchorRow, describeSingleSource } from '@tests/guards/single-source-harness';
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

/** (count, columns) tuples — the retired rows sites' seeded inputs: the
 *  2000-case fuzz plus the hand-built count × canonical-columns grid. */
function buildRowsCorpus(): Array<[number, number]> {
  const rng = mulberry32(5022);
  const cases: Array<[number, number]> = [];
  for (let k = 0; k < 2000; k++) {
    const count = COUNTS[Math.floor(rng() * COUNTS.length)];
    const columns = squareGridColumns(Math.floor(rng() * 500));
    cases.push([count, columns]);
  }
  for (const count of COUNTS) {
    for (const columns of [1, 2, 3, 7, 13, 100]) {
      cases.push([count, columns]);
    }
  }
  return cases;
}

/** (count, ratio) tuples — the retired aspect sites' inputs (NaN/0/negative
 *  ratios included: the max(1, …) clamp and the NaN passthrough both pin). */
function buildAspectCorpus(): Array<[number, number]> {
  const ratios = [TARGET_ASPECT_RATIO, 1, 0.5, 0.75, 9 / 16, 2, 4 / 3, NaN, 0, -1.5];
  const cases: Array<[number, number]> = [];
  for (const count of COUNTS) {
    for (const ratio of ratios) {
      cases.push([count, ratio]);
    }
  }
  return cases;
}

/** Integer-friendly grids — every layout test's domain: integer cell with
 *  even (cell − extent) has no rounding at all, both with the default
 *  origin (3-tuple → optional param) and with origin 80. */
function buildIntegerExactCorpus(): Array<[number, number, number] | [number, number, number, number]> {
  const cases: Array<[number, number, number] | [number, number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    for (const cell of [100, 240, 480, 880]) {
      for (const extent of [60, 120, 140]) {
        cases.push([i, cell, extent]);
        cases.push([i, cell, extent, 80]);
      }
    }
  }
  return cases;
}

const CANVAS_STAMP_CORPUS = buildCanvasStampCorpus();
const FUZZ_STAMP_CORPUS = buildFuzzStampCorpus();

// ---------------------------------------------------------------------------
// Layer 3 material: delegation shapes + bans.
// ---------------------------------------------------------------------------

const LAYOUT_UTILS = 'src/visualization/layout-utils.ts';
const EZO = 'src/visualization/enhanced-zero-overlap-layout.ts';
const NETWORK = 'src/visualization/strategies/NetworkLayoutStrategy.ts';
const CONCEPTMAP = 'src/visualization/strategies/ConceptMapLayoutStrategy.ts';
const OPTIMIZER = 'src/visualization/strategies/LayoutOptimizer.ts';
const FALLBACK = 'src/visualization/strategies/FallbackLayoutStrategy.ts';
const ADVANCED = 'src/visualization/advanced-layouts.ts';
const GRIDSNAP = 'src/visualization/layout/strategies/GridSnapStrategy.ts';
const FLOW = 'src/visualization/strategies/flow-strategy.ts';
const MATRIX = 'src/visualization/strategies/matrix-strategy.ts';
const GENERAL = 'src/visualization/strategies/general-strategy.ts';
const OVERLAP = 'src/visualization/overlap-resolver.ts';

const RAW_COLUMNS = /Math\.max\(1,\s*Math\.ceil\(Math\.sqrt\(/;
const RAW_ROWS = /Math\.max\(1,\s*Math\.ceil\([^\n()]*\/\s*[^\n()]*\)\)/;

/** Files whose rows-divisor ban is checked individually (the retired
 *  'no swept file re-inlines the rows divisor' loop). */
const ROWS_BAN_FILES: ReadonlyArray<[string, string]> = [
  [EZO, 'ezo'],
  [CONCEPTMAP, 'conceptmap'],
  [OPTIMIZER, 'optimizer'],
  [FALLBACK, 'fallback'],
  [MATRIX, 'matrix'],
  [GENERAL, 'general'],
  [OVERLAP, 'overlap-resolver'],
];

// ---------------------------------------------------------------------------
// The rows — Layer 1 oracles + Layer 3 anchors (round 51 migration).
// ---------------------------------------------------------------------------

const GRID_PACKING_ROWS = [
  // ---- Layer 1: verbatim oracles -----------------------------------------
  oracleRow({
    id: 'columns-verbatim',
    canonical: (count: number) => squareGridColumns(count),
    retired: legacyColumns,
    corpus: [...COUNTS, NaN, -1, -4, Infinity, 2.5, 0.000001].map((c) => [c] as [number]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'rows-verbatim',
    canonical: (count: number, columns: number) => squareGridRows(count, columns),
    retired: legacyRows,
    corpus: buildRowsCorpus(),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'aspect-verbatim',
    canonical: (count: number, ratio: number) => aspectGridColumns(count, ratio),
    retired: legacyAspectColumns,
    corpus: buildAspectCorpus(),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'stamp-b-object-is',
    canonical: (i: number, cell: number, extent: number, origin: number) => centerInCell(i, cell, extent, origin),
    retired: legacyStampB,
    corpus: [...CANVAS_STAMP_CORPUS, ...FUZZ_STAMP_CORPUS],
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'stamp-matrix-object-is',
    canonical: (i: number, cell: number, extent: number, origin: number) => centerInCell(i, cell, extent, origin),
    retired: legacyStampMatrix,
    corpus: [...CANVAS_STAMP_CORPUS, ...FUZZ_STAMP_CORPUS],
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'stamp-a-canvas-delta',
    // the regrouping (a + b) − c → a + (b − c) rounds at different points;
    // last-ulp differences exist and MUST be pinned as existing.
    canonical: (i: number, cell: number, extent: number, origin: number) => centerInCell(i, cell, extent, origin),
    retired: legacyStampA,
    corpus: CANVAS_STAMP_CORPUS,
    mode: { kind: 'delta', maxDelta: 1e-12 },
  }),
  oracleRow({
    id: 'stamp-a-integer-exact',
    canonical: (i: number, cell: number, extent: number, origin: number) => centerInCell(i, cell, extent, origin),
    retired: legacyStampA,
    corpus: buildIntegerExactCorpus(),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'stamp-a-fuzz-delta',
    // measured max 5.8e-11 at i·cell up to ~5e5 — still ~7 result-ulps
    canonical: (i: number, cell: number, extent: number, origin: number) => centerInCell(i, cell, extent, origin),
    retired: legacyStampA,
    corpus: FUZZ_STAMP_CORPUS,
    mode: { kind: 'delta', maxDelta: 1e-9 },
  }),
  // ---- Layer 3: source anchors -------------------------------------------
  // layout-utils holds each raw expression exactly once (the canonicals).
  anchorRow({ kind: 'occurs', id: 'utils-raw-columns-once', file: LAYOUT_UTILS, pattern: RAW_COLUMNS, exactly: 1 }),
  anchorRow({ kind: 'occurs', id: 'utils-raw-rows-divisor-once', file: LAYOUT_UTILS, pattern: /Math\.ceil\(count \/ columns\)/, exactly: 1 }),
  anchorRow({ kind: 'occurs', id: 'utils-raw-stamp-b-once', file: LAYOUT_UTILS, pattern: /return origin \+ index \* cell \+ \(cell - extent\) \/ 2;/, exactly: 1 }),
  anchorRow({ kind: 'occurs', id: 'utils-aspect-composes-columns-once', file: LAYOUT_UTILS, pattern: /return squareGridColumns\(count \* aspectRatio\);/, exactly: 1 }),
  // ezo delegates both grid sites (network init + basic grid, 4 stamps).
  anchorRow({ kind: 'occurs', id: 'ezo-columns-delegates', file: EZO, pattern: /squareGridColumns\(nodes\.length\)/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'ezo-rows-delegates', file: EZO, pattern: /squareGridRows\(nodes\.length, cols\)/, exactly: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'ezo-stamps-delegate', file: EZO, pattern: /centerInCell\((?:col|row), cell(?:Width|Height), (?:width|height)\)/, exactly: 4, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'ezo-no-raw-columns', file: EZO, pattern: RAW_COLUMNS }),
  // NetworkLayoutStrategy delegates the init grid + both stamps.
  anchorRow({ kind: 'occurs-at-least', id: 'network-grid-delegates', file: NETWORK, pattern: /const gridSize = squareGridColumns\(nodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'network-stamps-delegate', file: NETWORK, pattern: /const grid[XY] = centerInCell\(/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'network-no-raw-columns', file: NETWORK, pattern: RAW_COLUMNS }),
  // ConceptMapLayoutStrategy delegates packing + both stamps.
  anchorRow({ kind: 'occurs-at-least', id: 'conceptmap-columns-delegates', file: CONCEPTMAP, pattern: /const cols = squareGridColumns\(nodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'conceptmap-rows-delegates', file: CONCEPTMAP, pattern: /const rows = squareGridRows\(nodes\.length, cols\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'conceptmap-stamps-delegate', file: CONCEPTMAP, pattern: /centerInCell\((?:col|row), cell(?:Width|Height), (?:width|height)\)/, exactly: 2, scope: 'source' }),
  // LayoutOptimizer delegates both matrix grids (2 packings + 4 stamps).
  anchorRow({ kind: 'occurs', id: 'optimizer-columns-delegates', file: OPTIMIZER, pattern: /squareGridColumns\(nodes\.length\)/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'optimizer-rows-delegates', file: OPTIMIZER, pattern: /squareGridRows\(nodes\.length, cols\)/, exactly: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'optimizer-stamps-delegate', file: OPTIMIZER, pattern: /centerInCell\(/, exactly: 4, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'optimizer-no-raw-columns', file: OPTIMIZER, pattern: RAW_COLUMNS }),
  // FallbackLayoutStrategy delegates packing (inline rows divisor
  // included) + both stamps.
  anchorRow({ kind: 'occurs-at-least', id: 'fallback-columns-delegates', file: FALLBACK, pattern: /const cols = squareGridColumns\(nodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'fallback-rows-delegates', file: FALLBACK, pattern: /squareGridRows\(nodes\.length, cols\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'fallback-stamps-delegate', file: FALLBACK, pattern: /centerInCell\((?:col|row), spacing[XY], node(?:Width|Height)\)/, exactly: 2, scope: 'source' }),
  // advanced-layouts delegates columns and RETIRES the dead unclamped rows
  // copy (comment lines excluded so the ban matches CODE, not the
  // retirement note itself).
  anchorRow({ kind: 'occurs-at-least', id: 'advanced-columns-delegates', file: ADVANCED, pattern: /const cols = squareGridColumns\(nodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'advanced-dead-rows-copy-retired', file: ADVANCED, pattern: /Math\.ceil\(nodes\.length \/ cols\)/ }),
  anchorRow({ kind: 'occurs-at-least', id: 'advanced-fixed-pitch-stamp-stays', file: ADVANCED, pattern: /200 \+ \(index % cols\) \* 200/, atLeast: 1, scope: 'source' }),
  // GridSnapStrategy delegates the cell-bound columns and keeps its
  // multi-cell span-center stamp (scope-out: span center is a different
  // concept, not remaining-space center).
  anchorRow({ kind: 'occurs-at-least', id: 'gridsnap-columns-delegates', file: GRIDSNAP, pattern: /const sqrtNodes = squareGridColumns\(nodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'gridsnap-span-stamp-stays', file: GRIDSNAP, pattern: /\(this\.cellSize \* cellsWide\) \/ 2/, atLeast: 1, scope: 'source' }),
  // flow-strategy delegates the row-capacity columns.
  anchorRow({ kind: 'occurs-at-least', id: 'flow-columns-delegates', file: FLOW, pattern: /const maxPerRow = squareGridColumns\(originalNodes\.length\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'flow-no-raw-columns', file: FLOW, pattern: RAW_COLUMNS }),
  // matrix-strategy delegates aspect packing + rows + the padded stamp.
  anchorRow({ kind: 'occurs-at-least', id: 'matrix-aspect-delegates', file: MATRIX, pattern: /aspectGridColumns\(nodeCount, TARGET_ASPECT_RATIO\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'matrix-rows-delegates', file: MATRIX, pattern: /squareGridRows\(nodeCount, columns\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'matrix-stamps-delegate', file: MATRIX, pattern: /centerInCell\((?:col|row), cell(?:Width|Height), node(?:Width|Height), CANVAS_PADDING\)/, exactly: 2, scope: 'source' }),
  // general-strategy delegates aspect packing + rows + the spiral stamps.
  anchorRow({ kind: 'occurs-at-least', id: 'general-aspect-delegates', file: GENERAL, pattern: /aspectGridColumns\(sortedNodes\.length, TARGET_ASPECT_RATIO\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'general-rows-delegates', file: GENERAL, pattern: /squareGridRows\(sortedNodes\.length, columns\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'general-stamps-delegate', file: GENERAL, pattern: /centerInCell\(pos\.(?:col|row), cell(?:Width|Height), [wh], offset[XY]\)/, exactly: 2, scope: 'source' }),
  // overlap-resolver delegates aspect packing and KEEPS the origin-only
  // snap stamp (`col · cellWidth + 40` has no centering term — folding it
  // into centerInCell would CHANGE the resolver's snap semantics).
  anchorRow({ kind: 'occurs-at-least', id: 'overlap-aspect-delegates', file: OVERLAP, pattern: /aspectGridColumns\(nodes\.length, aspectRatio\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'overlap-rows-delegates', file: OVERLAP, pattern: /squareGridRows\(nodes\.length, columns\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'overlap-snap-stamp-x-stays', file: OVERLAP, pattern: /x: col \* cellWidth \+ 40,/, exactly: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'overlap-snap-stamp-y-stays', file: OVERLAP, pattern: /y: row \* cellHeight \+ 40,/, exactly: 1, scope: 'source' }),
  // No swept file re-inlines the rows divisor shape outside the canonical.
  ...ROWS_BAN_FILES.map(([file, label]) =>
    anchorRow({ kind: 'ban', id: `${label}-no-raw-rows-divisor`, file, pattern: RAW_ROWS }),
  ),
];

/** The pinned row enumeration — corpus shrink / row delete / ban delete
 *  flips the generated fingerprint it RED (TC-004-E01, permanently).
 *  Every count is a STATIC LITERAL (846,000 canvas cases + 4,000 fuzz):
 *  interpolating corpus .length here makes the pin track the shrink and
 *  the ratchet degenerate (caught by the M3 corpus-shrink mutation — the
 *  pin must not be self-referential). */
const GRID_PACKING_FINGERPRINT = [
  'grid-packing:columns-verbatim:28',
  'grid-packing:rows-verbatim:2132',
  'grid-packing:aspect-verbatim:220',
  'grid-packing:stamp-b-object-is:850000',
  'grid-packing:stamp-matrix-object-is:850000',
  'grid-packing:stamp-a-canvas-delta:846001',
  'grid-packing:stamp-a-integer-exact:240',
  'grid-packing:stamp-a-fuzz-delta:4001',
  'grid-packing:utils-raw-columns-once:1',
  'grid-packing:utils-raw-rows-divisor-once:1',
  'grid-packing:utils-raw-stamp-b-once:1',
  'grid-packing:utils-aspect-composes-columns-once:1',
  'grid-packing:ezo-columns-delegates:1',
  'grid-packing:ezo-rows-delegates:1',
  'grid-packing:ezo-stamps-delegate:1',
  'grid-packing:ezo-no-raw-columns:1',
  'grid-packing:network-grid-delegates:1',
  'grid-packing:network-stamps-delegate:1',
  'grid-packing:network-no-raw-columns:1',
  'grid-packing:conceptmap-columns-delegates:1',
  'grid-packing:conceptmap-rows-delegates:1',
  'grid-packing:conceptmap-stamps-delegate:1',
  'grid-packing:optimizer-columns-delegates:1',
  'grid-packing:optimizer-rows-delegates:1',
  'grid-packing:optimizer-stamps-delegate:1',
  'grid-packing:optimizer-no-raw-columns:1',
  'grid-packing:fallback-columns-delegates:1',
  'grid-packing:fallback-rows-delegates:1',
  'grid-packing:fallback-stamps-delegate:1',
  'grid-packing:advanced-columns-delegates:1',
  'grid-packing:advanced-dead-rows-copy-retired:1',
  'grid-packing:advanced-fixed-pitch-stamp-stays:1',
  'grid-packing:gridsnap-columns-delegates:1',
  'grid-packing:gridsnap-span-stamp-stays:1',
  'grid-packing:flow-columns-delegates:1',
  'grid-packing:flow-no-raw-columns:1',
  'grid-packing:matrix-aspect-delegates:1',
  'grid-packing:matrix-rows-delegates:1',
  'grid-packing:matrix-stamps-delegate:1',
  'grid-packing:general-aspect-delegates:1',
  'grid-packing:general-rows-delegates:1',
  'grid-packing:general-stamps-delegate:1',
  'grid-packing:overlap-aspect-delegates:1',
  'grid-packing:overlap-rows-delegates:1',
  'grid-packing:overlap-snap-stamp-x-stays:1',
  'grid-packing:overlap-snap-stamp-y-stays:1',
  'grid-packing:ezo-no-raw-rows-divisor:1',
  'grid-packing:conceptmap-no-raw-rows-divisor:1',
  'grid-packing:optimizer-no-raw-rows-divisor:1',
  'grid-packing:fallback-no-raw-rows-divisor:1',
  'grid-packing:matrix-no-raw-rows-divisor:1',
  'grid-packing:general-no-raw-rows-divisor:1',
  'grid-packing:overlap-resolver-no-raw-rows-divisor:1',
].join('\n');

describeSingleSource('grid-packing', GRID_PACKING_ROWS, { fingerprint: GRID_PACKING_FINGERPRINT });

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

  it('aspect compose is exact: aspectGridColumns delegates the SAME product to squareGridColumns — no re-grouped sqrt of a re-associated multiply (moved from layer 1 in round 51)', () => {
    expect(aspectGridColumns(12, TARGET_ASPECT_RATIO)).toBe(squareGridColumns(12 * TARGET_ASPECT_RATIO));
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
