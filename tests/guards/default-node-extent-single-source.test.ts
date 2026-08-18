/**
 * @jest-environment node
 */
/**
 * default-node-extent-single-source.test.ts — round 49 (round 51: migrated
 * to the table-driven harness).
 *
 * Family: the DEFAULT-fallback dimension-resolution pair
 * `const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
 *  const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT)` — was re-inlined at
 *  16 sites across 11 files (dagre-pipeline ×2 — g.setNode sizing + the
 *  positioned-node stamp; strategy-selector fallback-grid inline property
 *  reads; comparison / general / flow / matrix / tree / timeline strategy
 *  stamps; cycle-strategy ×4 — single-node stamp, ring stamp, and both
 *  radius maxima; network-strategy clamp sizing; mindmap-strategy ×2 stamp
 *  branches), plus the raw pair inside strategy-graph's `scaledNodeExtent`
 *  (the scaled twin of the same resolution). Canonical since round 49:
 *  `defaultNodeExtent` in src/visualization/node-dimensions.ts.
 *
 * DRIFT SCENARIO this guard defends against: the width and height defaults
 * are DIFFERENT numbers (120 and 60) — a copy that swaps the axes' fallback
 * literals, passes one number for both, or re-reads the deprecated `w`/`h`
 * aliases directly mis-sizes one engine's stamps while every other consumer
 * of the same shape agrees. The per-axis seam is the whole point (round 47's
 * lesson: a single shared fallback number is the bug, not the cleanup).
 *
 * Layers (round 51: the MECHANICAL layers 1 and 3 are data rows on the
 * shared harness — see single-source-harness.ts; Layer 2 stays handwritten):
 *   1. VERBATIM ORACLE rows — every retired idiom (two-const pair, inline
 *      property reads, the `Math.max(...nodes.map(...))` maxima, and the
 *      scaledNodeExtent pre-round-49 body) frozen below, Object.is-identical
 *      to the canonical over a seeded corpus of dimension shapes
 *      (dimensionless, `width`/`height`, `w`/`h` alias, NaN, Infinity,
 *      negative, zero, large).
 *   2. SEMANTIC PINS — the per-axis asymmetry witness (120 ≠ 60 for a
 *      dimensionless node), the fallback-chain precedence per axis, the
 *      implicit-default idiom equivalence (the scope-out that STAYS legal),
 *      and live strategy witnesses through real stamps (cycle single-node,
 *      timeline block-form stamp).
 *   3. SOURCE ANCHOR rows — every migrated file delegates with its idiom's
 *      shape, the raw pair lives in exactly one module, and the scope-outs
 *      (0-fallback measured reads, `?? DEFAULT_*` optional-chained edge
 *      reads) keep their inline forms. Scope 'source' preserves the retired
 *      whole-file `src.match(/…/g)` / `not.toMatch(…)` semantics; scope
 *      'code' (default) preserves the retired `codeLines()` filters.
 *
 * The "no site re-inlines the resolution pair" discovery sweep lives in the
 * shared registry (frozen-literal-families/default-node-extent.ts); this
 * file holds the behavioral pins.
 *
 * Worker-mock note: unlike rounds 41/48 (new layout-utils exports), the new
 * export lands in node-dimensions, which no test partial-mocks via
 * unstable_mockModule — there is no link-error surface to pin here.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { oracleRow, anchorRow, describeSingleSource } from '@tests/guards/single-source-harness';
import {
  defaultNodeExtent,
  getNodeWidth,
  getNodeHeight,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '@/visualization/node-dimensions';
import { scaledNodeExtent } from '@/visualization/strategy-graph';
import { scaledDimensions } from '@/visualization/importance-scaler';
import { CycleLayoutStrategy } from '@/visualization/strategies/cycle-strategy';
import { TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import type { NodeDatum } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-49 expressions, frozen from the
// migrated files at c5c21785 (round 48 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

type ExtentNodeShape = { width?: number; w?: number; height?: number; h?: number };

/** The two-const preamble — dagre ×2, comparison, general, flow, matrix,
 *  tree, cycle ×2 stamps, network clamp, mindmap ×2 (12 sites). */
function legacyPairW(node: ExtentNodeShape): number {
  return getNodeWidth(node, DEFAULT_NODE_WIDTH);
}
function legacyPairH(node: ExtentNodeShape): number {
  return getNodeHeight(node, DEFAULT_NODE_HEIGHT);
}

/** The inline property reads — strategy-selector / timeline stamp literals. */
function legacyInlineW(node: ExtentNodeShape): number {
  return getNodeWidth(node, DEFAULT_NODE_WIDTH);
}
function legacyInlineH(node: ExtentNodeShape): number {
  return getNodeHeight(node, DEFAULT_NODE_HEIGHT);
}

/** The per-node maxima — cycle-strategy ×2 radius sizing. */
function legacyMaxW(nodes: ExtentNodeShape[]): number {
  return Math.max(...nodes.map((n) => getNodeWidth(n, DEFAULT_NODE_WIDTH)));
}
function legacyMaxH(nodes: ExtentNodeShape[]): number {
  return Math.max(...nodes.map((n) => getNodeHeight(n, DEFAULT_NODE_HEIGHT)));
}

/** The pre-round-49 `scaledNodeExtent` body (strategy-graph) — the scaled
 *  twin resolving the same raw pair inline. */
function legacyScaledExtent(node: NodeDatum): { width: number; height: number } {
  return scaledDimensions(
    node,
    getNodeWidth(node, DEFAULT_NODE_WIDTH),
    getNodeHeight(node, DEFAULT_NODE_HEIGHT),
  );
}

// ---------------------------------------------------------------------------
// Corpora: seeded node shapes spanning the retired sites' dimension inputs.
// ---------------------------------------------------------------------------

const DIM_VALUES = [undefined, 0, -3.5, NaN, Infinity, -Infinity, 60, 120, 1e15];

function buildNodeCorpus(): ExtentNodeShape[] {
  const rng = mulberry32(4921);
  const pickVal = () => DIM_VALUES[Math.floor(rng() * DIM_VALUES.length)];
  const nodes: ExtentNodeShape[] = [{}]; // the dimensionless node — the default path
  for (let k = 0; k < 240; k++) {
    nodes.push({
      width: pickVal(),
      w: pickVal(),
      height: pickVal(),
      h: pickVal(),
    });
  }
  // hand-built precedence ladders the fuzz cannot guarantee
  nodes.push(
    { width: 177, w: 210 },
    { w: 140, h: 70 },
    { width: NaN, w: 88 },
    { height: NaN, h: 44 },
    { width: Infinity, w: 51 },
    { height: Infinity, h: 33 },
    { width: 0, w: 999 },
    { height: 0, h: 999 },
  );
  return nodes;
}

const NODE_CORPUS = buildNodeCorpus();

/** The retired maxima sites' inputs (seed 4948, same consumption order as
 *  the retired loop): groups of 0–5 corpus nodes, empty groups included —
 *  `Math.max()` of nothing is -Infinity at BOTH forms. */
function buildMaximaCorpus(): ExtentNodeShape[][] {
  const rng = mulberry32(4948);
  const groups: ExtentNodeShape[][] = [];
  for (let k = 0; k < 120; k++) {
    const n = Math.floor(rng() * 6);
    groups.push(Array.from({ length: n }, () => NODE_CORPUS[Math.floor(rng() * NODE_CORPUS.length)]));
  }
  return groups;
}

/** The retired scaledNodeExtent site's inputs (seed 4960): corpus shapes
 *  with an importance meta layered on top. */
function buildScaledCorpus(): NodeDatum[] {
  const rng = mulberry32(4960);
  const nodes: NodeDatum[] = [];
  for (let k = 0; k < 200; k++) {
    const base = NODE_CORPUS[Math.floor(rng() * NODE_CORPUS.length)];
    const importance = [undefined, 0, 0.5, 1, 1.5, -0.5, NaN][Math.floor(rng() * 7)];
    nodes.push({
      id: `n${k}`,
      label: `n${k}`,
      ...(importance === undefined ? {} : { meta: { importance } }),
      ...base,
    } as unknown as NodeDatum);
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Layer 3 material: delegation shapes + bans.
// ---------------------------------------------------------------------------

const NODE_DIMENSIONS = 'src/visualization/node-dimensions.ts';
const DAGRE = 'src/visualization/dagre-pipeline.ts';
const SELECTOR = 'src/visualization/strategy-selector.ts';
const STRATEGY_GRAPH = 'src/visualization/strategy-graph.ts';
const COMPARISON = 'src/visualization/strategies/comparison-strategy.ts';
const GENERAL = 'src/visualization/strategies/general-strategy.ts';
const FLOW = 'src/visualization/strategies/flow-strategy.ts';
const MATRIX = 'src/visualization/strategies/matrix-strategy.ts';
const TREE = 'src/visualization/strategies/tree-strategy.ts';
const CYCLE = 'src/visualization/strategies/cycle-strategy.ts';
const NETWORK = 'src/visualization/strategies/network-strategy.ts';
const MINDMAP = 'src/visualization/strategies/mindmap-strategy.ts';
const CONCEPTMAP = 'src/visualization/strategies/conceptmap-strategy.ts';
const TIMELINE = 'src/visualization/strategies/timeline-strategy.ts';
const LAYOUT_UTILS = 'src/visualization/layout-utils.ts';

const RAW_PAIR_W = /getNodeWidth\(\w+(?:\[\w+\])?,\s*DEFAULT_NODE_WIDTH\)/;
const RAW_PAIR_H = /getNodeHeight\(\w+(?:\[\w+\])?,\s*DEFAULT_NODE_HEIGHT\)/;
const PAIR_SHAPE = /const \{ width: w, height: h \} = defaultNodeExtent\(node\);/;
const MATRIX_SHAPE = /const \{ width: nodeWidth, height: nodeHeight \} = defaultNodeExtent\(node\);/;

// ---------------------------------------------------------------------------
// The rows — Layer 1 oracles + Layer 3 anchors (round 51 migration).
// ---------------------------------------------------------------------------

const DEFAULT_NODE_EXTENT_ROWS = [
  // ---- Layer 1: verbatim oracles -----------------------------------------
  // width resolves BEFORE height in the retired preamble; the canonical
  // object literal preserves that evaluation order (both reads are pure,
  // so this is a shape witness, not a value one).
  oracleRow({
    id: 'pair-w-verbatim',
    canonical: (node: ExtentNodeShape) => defaultNodeExtent(node).width,
    retired: legacyPairW,
    corpus: NODE_CORPUS.map((node) => [node] as [ExtentNodeShape]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'pair-h-verbatim',
    canonical: (node: ExtentNodeShape) => defaultNodeExtent(node).height,
    retired: legacyPairH,
    corpus: NODE_CORPUS.map((node) => [node] as [ExtentNodeShape]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'inline-w-verbatim',
    canonical: (node: ExtentNodeShape) => defaultNodeExtent(node).width,
    retired: legacyInlineW,
    corpus: NODE_CORPUS.map((node) => [node] as [ExtentNodeShape]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'inline-h-verbatim',
    canonical: (node: ExtentNodeShape) => defaultNodeExtent(node).height,
    retired: legacyInlineH,
    corpus: NODE_CORPUS.map((node) => [node] as [ExtentNodeShape]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'cycle-maxima-w',
    canonical: (nodes: ExtentNodeShape[]) => Math.max(...nodes.map((x) => defaultNodeExtent(x).width)),
    retired: legacyMaxW,
    corpus: buildMaximaCorpus().map((nodes) => [nodes] as [ExtentNodeShape[]]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'cycle-maxima-h',
    canonical: (nodes: ExtentNodeShape[]) => Math.max(...nodes.map((x) => defaultNodeExtent(x).height)),
    retired: legacyMaxH,
    corpus: buildMaximaCorpus().map((nodes) => [nodes] as [ExtentNodeShape[]]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'scaled-extent-w',
    canonical: (node: NodeDatum) => scaledNodeExtent(node).width,
    retired: (node: NodeDatum) => legacyScaledExtent(node).width,
    corpus: buildScaledCorpus().map((node) => [node] as [NodeDatum]),
    mode: { kind: 'object-is' },
  }),
  oracleRow({
    id: 'scaled-extent-h',
    canonical: (node: NodeDatum) => scaledNodeExtent(node).height,
    retired: (node: NodeDatum) => legacyScaledExtent(node).height,
    corpus: buildScaledCorpus().map((node) => [node] as [NodeDatum]),
    mode: { kind: 'object-is' },
  }),
  // ---- Layer 3: source anchors -------------------------------------------
  // node-dimensions holds the raw pair exactly once (the canonical itself).
  anchorRow({ kind: 'occurs', id: 'node-dimensions-raw-pair-w-once', file: NODE_DIMENSIONS, pattern: RAW_PAIR_W, exactly: 1 }),
  anchorRow({ kind: 'occurs', id: 'node-dimensions-raw-pair-h-once', file: NODE_DIMENSIONS, pattern: RAW_PAIR_H, exactly: 1 }),
  anchorRow({ kind: 'occurs', id: 'node-dimensions-default-extent-export-once', file: NODE_DIMENSIONS, pattern: /export function defaultNodeExtent\(/, exactly: 1 }),
  // dagre-pipeline delegates both sites (g.setNode sizing + the stamp); the
  // center→top-left conversion locals stay (round-30 guard depends on them).
  anchorRow({ kind: 'occurs', id: 'dagre-pair-delegates', file: DAGRE, pattern: PAIR_SHAPE, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'dagre-no-raw-pair-w', file: DAGRE, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'dagre-no-raw-pair-h', file: DAGRE, pattern: RAW_PAIR_H, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'dagre-center-conversion-stays', file: DAGRE, pattern: /dagreNode\.x - w \/ 2/, atLeast: 1, scope: 'source' }),
  // strategy-selector delegates the fallback-grid inline property reads.
  anchorRow({ kind: 'occurs', id: 'selector-inline-delegates', file: SELECTOR, pattern: /const \{ width, height \} = defaultNodeExtent\(n\);/, exactly: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'selector-no-raw-pair-w', file: SELECTOR, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'selector-no-raw-pair-h', file: SELECTOR, pattern: RAW_PAIR_H, scope: 'source' }),
  // strategy-graph composes the canonical (scaledNodeExtent no longer
  // resolves the raw pair); the round-42 guard's own ban still holds: the
  // retired 3-line scaled idiom must not reappear inline.
  anchorRow({ kind: 'occurs-at-least', id: 'strategy-graph-extent-delegates', file: STRATEGY_GRAPH, pattern: /const extent = defaultNodeExtent\(node\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'strategy-graph-scaled-composes', file: STRATEGY_GRAPH, pattern: /scaledDimensions\(node, extent\.width, extent\.height\)/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'strategy-graph-no-raw-pair-w', file: STRATEGY_GRAPH, pattern: RAW_PAIR_W }),
  anchorRow({ kind: 'ban', id: 'strategy-graph-retired-scaled-idiom-banned', file: STRATEGY_GRAPH, pattern: /Math\.round\(getNodeWidth\(node, DEFAULT_NODE_WIDTH\) \* scale\)/, scope: 'source' }),
  // the five pair-const strategy stamps delegate.
  anchorRow({ kind: 'occurs-at-least', id: 'comparison-stamp-delegates', file: COMPARISON, pattern: PAIR_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'comparison-no-raw-pair-w', file: COMPARISON, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'comparison-no-raw-pair-h', file: COMPARISON, pattern: RAW_PAIR_H, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'general-stamp-delegates', file: GENERAL, pattern: PAIR_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'general-no-raw-pair-w', file: GENERAL, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'general-no-raw-pair-h', file: GENERAL, pattern: RAW_PAIR_H, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'flow-stamp-delegates', file: FLOW, pattern: PAIR_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'flow-no-raw-pair-w', file: FLOW, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'flow-no-raw-pair-h', file: FLOW, pattern: RAW_PAIR_H, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'matrix-stamp-delegates', file: MATRIX, pattern: MATRIX_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'matrix-no-raw-pair-w', file: MATRIX, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'matrix-no-raw-pair-h', file: MATRIX, pattern: RAW_PAIR_H, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'tree-stamp-delegates', file: TREE, pattern: PAIR_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'tree-no-raw-pair-w', file: TREE, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'tree-no-raw-pair-h', file: TREE, pattern: RAW_PAIR_H, scope: 'source' }),
  // flow/tree keep the `?? DEFAULT_*` optional-chained EDGE reads (r46
  // scope-out, untouched).
  anchorRow({ kind: 'occurs', id: 'flow-edge-reads-stay-w', file: FLOW, pattern: /\?\.width \?\? DEFAULT_NODE_WIDTH/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'flow-edge-reads-stay-h', file: FLOW, pattern: /\?\.height \?\? DEFAULT_NODE_HEIGHT/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'tree-edge-reads-stay-w', file: TREE, pattern: /\?\.width \?\? DEFAULT_NODE_WIDTH/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'tree-edge-reads-stay-h', file: TREE, pattern: /\?\.height \?\? DEFAULT_NODE_HEIGHT/, exactly: 2, scope: 'source' }),
  // cycle-strategy delegates all four sites (2 stamps + 2 maxima).
  anchorRow({ kind: 'occurs', id: 'cycle-stamps-delegate', file: CYCLE, pattern: PAIR_SHAPE, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'cycle-maxima-delegate-w', file: CYCLE, pattern: /defaultNodeExtent\((?:n|nd)\)\.width/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'cycle-maxima-delegate-h', file: CYCLE, pattern: /defaultNodeExtent\((?:n|nd)\)\.height/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'cycle-no-raw-pair-w', file: CYCLE, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'cycle-no-raw-pair-h', file: CYCLE, pattern: RAW_PAIR_H, scope: 'source' }),
  // network-strategy delegates the clamp sizing.
  anchorRow({ kind: 'occurs-at-least', id: 'network-stamp-delegates', file: NETWORK, pattern: PAIR_SHAPE, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'network-no-raw-pair-w', file: NETWORK, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'network-no-raw-pair-h', file: NETWORK, pattern: RAW_PAIR_H, scope: 'source' }),
  // mindmap-strategy delegates both stamp branches.
  anchorRow({ kind: 'occurs', id: 'mindmap-stamps-delegate', file: MINDMAP, pattern: PAIR_SHAPE, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'mindmap-no-raw-pair-w', file: MINDMAP, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'mindmap-no-raw-pair-h', file: MINDMAP, pattern: RAW_PAIR_H, scope: 'source' }),
  // conceptmap-strategy delegates the width-only level-width read
  // (registry-sweep discovery: this site passes an EXPRESSION arg
  // (`node ?? { width: 0, w: 0 }`) — the first sweep's identifier-only grep
  // missed it; the registry's shape-level pattern caught it. The defensive
  // nullish guard and the importance scale stay at the site).
  anchorRow({ kind: 'occurs-at-least', id: 'conceptmap-level-width-delegates', file: CONCEPTMAP, pattern: /defaultNodeExtent\(node \?\? \{ width: 0, w: 0 \}\)\.width/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'conceptmap-no-raw-pair-w', file: CONCEPTMAP, pattern: RAW_PAIR_W, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'conceptmap-no-raw-pair-h', file: CONCEPTMAP, pattern: RAW_PAIR_H, scope: 'source' }),
  // timeline-strategy delegates the stamp and KEEPS the 0-fallback measured
  // reads (round 41's measured-policy reads (fallback 0) are a DIFFERENT
  // policy and must not be converged onto the render-default box).
  anchorRow({ kind: 'occurs-at-least', id: 'timeline-stamp-delegates', file: TIMELINE, pattern: /const \{ width, height \} = defaultNodeExtent\(node\);/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'timeline-no-raw-pair-w', file: TIMELINE, pattern: RAW_PAIR_W }),
  anchorRow({ kind: 'occurs', id: 'timeline-measured-reads-stay-w', file: TIMELINE, pattern: /getNodeWidth\(result\[(?:i|j)\], 0\)/, exactly: 2, scope: 'source' }),
  anchorRow({ kind: 'occurs', id: 'timeline-measured-reads-stay-h', file: TIMELINE, pattern: /getNodeHeight\(result\[i\], 0\)/, exactly: 1, scope: 'source' }),
  // layout-utils keeps its fallback-PARAMETER signature (r41 seam,
  // untouched): it calls getNodeWidth with the VARIABLE fallback, not the
  // literal — the registry ban must never fire on the r41 canonical.
  anchorRow({ kind: 'occurs-at-least', id: 'layout-utils-fallback-param-w-stays', file: LAYOUT_UTILS, pattern: /fallbackWidth: number = DEFAULT_NODE_WIDTH/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'occurs-at-least', id: 'layout-utils-fallback-param-h-stays', file: LAYOUT_UTILS, pattern: /fallbackHeight: number = DEFAULT_NODE_HEIGHT/, atLeast: 1, scope: 'source' }),
  anchorRow({ kind: 'ban', id: 'layout-utils-no-raw-pair-w', file: LAYOUT_UTILS, pattern: RAW_PAIR_W }),
];

/** The pinned row enumeration — corpus shrink / row delete / ban delete
 *  flips the generated fingerprint it RED (TC-004-E01, permanently).
 *  Every count is a STATIC LITERAL: interpolating `NODE_CORPUS.length`
 *  here makes the pin track the shrink and the ratchet degenerate (caught
 *  by the M3 corpus-shrink mutation — the pin must not be self-referential). */
const DEFAULT_NODE_EXTENT_FINGERPRINT = [
  'default-node-extent:pair-w-verbatim:249',
  'default-node-extent:pair-h-verbatim:249',
  'default-node-extent:inline-w-verbatim:249',
  'default-node-extent:inline-h-verbatim:249',
  'default-node-extent:cycle-maxima-w:120',
  'default-node-extent:cycle-maxima-h:120',
  'default-node-extent:scaled-extent-w:200',
  'default-node-extent:scaled-extent-h:200',
  'default-node-extent:node-dimensions-raw-pair-w-once:1',
  'default-node-extent:node-dimensions-raw-pair-h-once:1',
  'default-node-extent:node-dimensions-default-extent-export-once:1',
  'default-node-extent:dagre-pair-delegates:1',
  'default-node-extent:dagre-no-raw-pair-w:1',
  'default-node-extent:dagre-no-raw-pair-h:1',
  'default-node-extent:dagre-center-conversion-stays:1',
  'default-node-extent:selector-inline-delegates:1',
  'default-node-extent:selector-no-raw-pair-w:1',
  'default-node-extent:selector-no-raw-pair-h:1',
  'default-node-extent:strategy-graph-extent-delegates:1',
  'default-node-extent:strategy-graph-scaled-composes:1',
  'default-node-extent:strategy-graph-no-raw-pair-w:1',
  'default-node-extent:strategy-graph-retired-scaled-idiom-banned:1',
  'default-node-extent:comparison-stamp-delegates:1',
  'default-node-extent:comparison-no-raw-pair-w:1',
  'default-node-extent:comparison-no-raw-pair-h:1',
  'default-node-extent:general-stamp-delegates:1',
  'default-node-extent:general-no-raw-pair-w:1',
  'default-node-extent:general-no-raw-pair-h:1',
  'default-node-extent:flow-stamp-delegates:1',
  'default-node-extent:flow-no-raw-pair-w:1',
  'default-node-extent:flow-no-raw-pair-h:1',
  'default-node-extent:matrix-stamp-delegates:1',
  'default-node-extent:matrix-no-raw-pair-w:1',
  'default-node-extent:matrix-no-raw-pair-h:1',
  'default-node-extent:tree-stamp-delegates:1',
  'default-node-extent:tree-no-raw-pair-w:1',
  'default-node-extent:tree-no-raw-pair-h:1',
  'default-node-extent:flow-edge-reads-stay-w:1',
  'default-node-extent:flow-edge-reads-stay-h:1',
  'default-node-extent:tree-edge-reads-stay-w:1',
  'default-node-extent:tree-edge-reads-stay-h:1',
  'default-node-extent:cycle-stamps-delegate:1',
  'default-node-extent:cycle-maxima-delegate-w:1',
  'default-node-extent:cycle-maxima-delegate-h:1',
  'default-node-extent:cycle-no-raw-pair-w:1',
  'default-node-extent:cycle-no-raw-pair-h:1',
  'default-node-extent:network-stamp-delegates:1',
  'default-node-extent:network-no-raw-pair-w:1',
  'default-node-extent:network-no-raw-pair-h:1',
  'default-node-extent:mindmap-stamps-delegate:1',
  'default-node-extent:mindmap-no-raw-pair-w:1',
  'default-node-extent:mindmap-no-raw-pair-h:1',
  'default-node-extent:conceptmap-level-width-delegates:1',
  'default-node-extent:conceptmap-no-raw-pair-w:1',
  'default-node-extent:conceptmap-no-raw-pair-h:1',
  'default-node-extent:timeline-stamp-delegates:1',
  'default-node-extent:timeline-no-raw-pair-w:1',
  'default-node-extent:timeline-measured-reads-stay-w:1',
  'default-node-extent:timeline-measured-reads-stay-h:1',
  'default-node-extent:layout-utils-fallback-param-w-stays:1',
  'default-node-extent:layout-utils-fallback-param-h-stays:1',
  'default-node-extent:layout-utils-no-raw-pair-w:1',
].join('\n');

describeSingleSource('default-node-extent', DEFAULT_NODE_EXTENT_ROWS, {
  fingerprint: DEFAULT_NODE_EXTENT_FINGERPRINT,
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — per-axis seam, fallback chain, the legal
// implicit-default idiom, and live strategy witnesses.
// ---------------------------------------------------------------------------

describe('round 49: default node extent — layer 2 semantic pins', () => {
  it('PER-AXIS SEAM WITNESS: a dimensionless node resolves 120 × 60, NOT one shared number', () => {
    const got = defaultNodeExtent({});
    expect(got).toEqual({ width: 120, height: 60 });
    // the seam: the two fallbacks differ — collapsing them to one number is
    // the drift this round closes; a swap or a shared constant fails here.
    expect(DEFAULT_NODE_WIDTH).toBe(120);
    expect(DEFAULT_NODE_HEIGHT).toBe(60);
    expect(DEFAULT_NODE_WIDTH).not.toBe(DEFAULT_NODE_HEIGHT);
  });

  it('fallback chain precedence, per axis: canonical → alias → DEFAULT (NaN/Infinity fall through)', () => {
    expect(defaultNodeExtent({ width: 177, w: 210, height: 88, h: 99 })).toEqual({ width: 177, height: 88 });
    expect(defaultNodeExtent({ w: 210, h: 99 })).toEqual({ width: 210, height: 99 });
    expect(defaultNodeExtent({ width: NaN, w: 210, height: Infinity, h: 99 })).toEqual({ width: 210, height: 99 });
    expect(defaultNodeExtent({ width: 0, w: 210, height: 0, h: 99 })).toEqual({ width: 0, height: 0 });
    expect(defaultNodeExtent({})).toEqual({ width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT });
  });

  it('SCOPE-OUT LEGAL IDIOM: the implicit default `getNodeWidth(node)` stays value-identical', () => {
    // getNodeWidth's own default parameter IS the single source for the
    // implicit form (e.g. quality-estimators reads) — no raw DEFAULT pair
    // needed there, and the registry bans only the explicit DEFAULT-literal
    // argument form.
    for (const node of NODE_CORPUS) {
      expect(Object.is(getNodeWidth(node), defaultNodeExtent(node).width)).toBe(true);
      expect(Object.is(getNodeHeight(node), defaultNodeExtent(node).height)).toBe(true);
    }
  });

  it('LIVE WITNESS: CycleLayoutStrategy single node stamps the 120×60 default box', () => {
    const strategy = new CycleLayoutStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' }], []);
    // the n === 1 branch delegates: x = canvas/2 − w/2 = 960 − 60, y = 540 − 30.
    expect(result.nodes[0]).toMatchObject({ x: 960 - 120 / 2, y: 540 - 60 / 2, width: 120, height: 60 });
  });

  it('LIVE WITNESS: TimelineStrategy stamp (block-form delegation) keeps 120×60', () => {
    const strategy = new TimelineStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' }], []);
    // x = DEFAULT_CANVAS_WIDTH/2 − DEFAULT_NODE_WIDTH/2; y = CANVAS_PADDING (80).
    expect(result.nodes[0]).toMatchObject({ x: 960 - 120 / 2, y: 80, width: 120, height: 60 });
  });
});
