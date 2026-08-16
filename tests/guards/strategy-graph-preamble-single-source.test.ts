/**
 * @jest-environment node
 */
/**
 * strategy-graph-preamble-single-source.test.ts — round 42.
 *
 * Family: the IMPORTANCE-TREE STRATEGY PREAMBLE — the graph/roots/sizing
 * prologue+epilogue the mindmap (radial) and conceptmap (hierarchical)
 * strategies share as a copy-paste pair, plus the sizing idiom the network
 * strategy pasted from the same source:
 *
 *   - buildUndirectedAdjacency  (mindmap + conceptmap, byte-identical)
 *   - findImportanceRoot        (mindmap + conceptmap; conceptmap carried a
 *                                dead `nodes.length === 0 → ''` guard)
 *   - scaledNodeExtent          (5 sites: mindmap ×2, conceptmap ×2, network ×1
 *                                — while importance-scaler's `scaledDimensions`
 *                                sat UNWIRED with zero production callers)
 *   - singleNodeCenteredLayout  (mindmap + conceptmap, byte-identical)
 *
 * Canonical since round 42: src/visualization/strategy-graph.ts.
 *
 * DRIFT SCENARIO this guard defends against: the two tree-like strategies
 * pick different roots for the SAME diagram (one drops the importance boost
 * `d * (0.5 + imp)`, the other flips the strict-`>` first-max tie-break),
 * build adjacency that disagrees about reciprocity or child order, or size
 * the same node differently (one site's scale formula detaching from
 * importance-scaler). Each copy serves a different diagram type, so the
 * divergence is invisible to every per-strategy suite — the
 * single-diagram-type latent desync this campaign freezes.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-42 inline bodies (BOTH findRoot
 *      flavors, adjacency, the 3-line extent, the single-node epilogue),
 *      frozen from 7353b3c4 (round 41 HEAD), must be field-identical to the
 *      canonical over a seeded fuzz corpus of graphs with importance /
 *      dimension / dangling-endpoint variation. Any mutation of the score
 *      formula, tie-break, adjacency reciprocity, scale, round, or centering
 *      diverges here.
 *   2. SEMANTIC PINS — the importance-boost witness, first-max tie-break,
 *      the dangling-hub materialization asymmetry (degree map CREATES ghost
 *      entries and they can WIN; adjacency drops them), reciprocity + edge
 *      order + duplicates, exact extent numbers per importance tier, exact
 *      epilogue coordinates, and the one documented behavior change
 *      (findImportanceRoot([], []) now throws instead of conceptmap's dead
 *      `return ''`).
 *   3. SOURCE ANCHORS — all 3 files delegate with the canonical names, no
 *      site re-inlines a retired shape, and the canonical carries each
 *      retired shape exactly once.
 *
 * The "no site re-inlines the preamble" discovery sweep lives in the shared
 * registry (frozen-literal-families/strategy-graph-preamble.ts); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import { getImportance, importanceSizeScale } from '@/visualization/importance-scaler';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '@/visualization/canvas-dimensions';
import { emptyStrategyLayoutMetrics } from '@/visualization/empty-layout-result';
import { calculateCanvasSize } from '@/visualization/layout-engine-v2';
import {
  buildUndirectedAdjacency,
  findImportanceRoot,
  scaledNodeExtent,
  singleNodeCenteredLayout,
} from '@/visualization/strategy-graph';
import { mindmapStrategy } from '@/visualization/strategies/mindmap-strategy';
import { conceptmapStrategy } from '@/visualization/strategies/conceptmap-strategy';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-42 inline bodies, frozen from the
// two strategy files at 7353b3c4 (round 41 HEAD). Do not "improve" these
// copies: their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

/** mindmap-strategy.findRoot — the no-guard flavor. */
function oldMindmapFindRoot(nodes: NodeDatum[], edges: EdgeDatum[]): string {
  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node.id, 0);
  }
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  let best = nodes[0].id;
  let bestScore = -1;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const [id, d] of degree) {
    const node = nodeMap.get(id);
    const imp = node ? getImportance(node) : 0.5;
    const score = d * (0.5 + imp);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/** conceptmap-strategy.findRoot — same scan with the (dead) empty guard. */
function oldConceptmapFindRoot(nodes: NodeDatum[], edges: EdgeDatum[]): string {
  const degree = new Map<string, number>();
  for (const node of nodes) degree.set(node.id, 0);
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (nodes.length === 0) return '';
  let best = nodes[0].id;
  let bestScore = -1;
  for (const [id, d] of degree) {
    const node = nodeMap.get(id);
    const imp = node ? getImportance(node) : 0.5;
    const score = d * (0.5 + imp);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/** mindmap/conceptmap buildAdjacency — byte-identical in both files. */
function oldBuildUndirectedAdjacency(nodes: NodeDatum[], edges: EdgeDatum[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
    adj.get(edge.to)?.push(edge.from);
  }
  return adj;
}

/** The 3-line sizing idiom inlined at 5 sites (mindmap ×2, conceptmap ×2, network). */
function oldScaledExtent(node: NodeDatum): { width: number; height: number } {
  const scale = importanceSizeScale(node);
  const w = Math.round(getNodeWidth(node, DEFAULT_NODE_WIDTH) * scale);
  const h = Math.round(getNodeHeight(node, DEFAULT_NODE_HEIGHT) * scale);
  return { width: w, height: h };
}

/** The single-node epilogue, mindmap flavor (conceptmap was identical). */
function oldSingleNodeCentered(nodes: NodeDatum[]) {
  const scale = importanceSizeScale(nodes[0]);
  const w = Math.round(getNodeWidth(nodes[0], DEFAULT_NODE_WIDTH) * scale);
  const h = Math.round(getNodeHeight(nodes[0], DEFAULT_NODE_HEIGHT) * scale);
  const positioned = [{
    ...nodes[0],
    x: (DEFAULT_CANVAS_WIDTH - w) / 2,
    y: (DEFAULT_CANVAS_HEIGHT - h) / 2,
    width: w,
    height: h,
  }];
  const canvas = calculateCanvasSize(positioned);
  return { nodes: positioned, edges: [], canvas, metrics: emptyStrategyLayoutMetrics() };
}

// ---------------------------------------------------------------------------
// Seeded fuzz corpus: graphs with importance / dimension / dangling-endpoint
// variation. Deterministic via mulberry32 — a failing iteration reproduces.
// ---------------------------------------------------------------------------

const IMPORTANCE_POOL: Array<number | undefined> = [
  undefined, 0, 0.25, 0.5, 0.75, 1, NaN, 1.5, -0.5,
];

type DimVariant = { width?: number; height?: number; w?: number; h?: number };
const DIM_VARIANTS: DimVariant[] = [
  {},
  { width: 200 },
  { w: 210 },
  { width: 177, height: 88 },
  { w: 140, h: 70 },
  { width: 177, w: 210, h: 70, height: 88 },
];

interface CorpusGraph {
  nodes: NodeDatum[];
  edges: EdgeDatum[];
}

function corpusGraph(seed: number, count: number): CorpusGraph {
  const rng = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const nodes: NodeDatum[] = Array.from({ length: count }, (_, i) => {
    const importance = pick(IMPORTANCE_POOL);
    const dims = pick(DIM_VARIANTS);
    return {
      id: `n${i}`,
      label: `node ${i}`,
      ...(importance === undefined ? {} : { meta: { importance } }),
      ...dims,
    };
  });
  const edgeCount = Math.floor(rng() * (2 * count + 1));
  const ids = nodes.map((n) => n.id);
  const edges: EdgeDatum[] = Array.from({ length: edgeCount }, (_, i) => {
    // ~20% dangling endpoints: exercises the degree map's materialized ghost
    // entries (and their 0.5 importance fallback) plus adjacency's `?.` drop.
    const from = rng() < 0.1 ? `ghost-${i}` : pick(ids);
    const to = rng() < 0.1 ? `ghost-${i}-t` : pick(ids);
    return { from, to, label: `e${i}` };
  });
  return { nodes, edges };
}

function expectAdjacencyEqual(
  actual: Map<string, string[]>,
  expected: Map<string, string[]>,
): void {
  expect([...actual.keys()]).toEqual([...expected.keys()]);
  for (const [key, list] of expected) {
    expect(actual.get(key)).toEqual(list);
  }
}

describe('strategy-graph preamble: canonical ≡ pre-round-42 inline bodies', () => {
  const CORPUS: CorpusGraph[] = [];
  for (const count of [1, 5, 12, 25]) {
    for (let seed = 1; seed <= 25; seed++) {
      CORPUS.push(corpusGraph(seed * 1000 + count, count));
    }
  }

  it('findImportanceRoot matches BOTH legacy flavors on every corpus graph', () => {
    for (const { nodes, edges } of CORPUS) {
      const canonical = findImportanceRoot(nodes, edges);
      expect(canonical).toBe(oldMindmapFindRoot(nodes, edges));
      // The conceptmap flavor's empty-list guard is unreachable here (corpus
      // is non-empty) — the two flavors must agree everywhere both are
      // defined, which is the entire reachable domain.
      expect(canonical).toBe(oldConceptmapFindRoot(nodes, edges));
    }
  });

  it('buildUndirectedAdjacency matches the legacy adjacency on every corpus graph', () => {
    for (const { nodes, edges } of CORPUS) {
      expectAdjacencyEqual(
        buildUndirectedAdjacency(nodes, edges),
        oldBuildUndirectedAdjacency(nodes, edges),
      );
    }
  });

  it('scaledNodeExtent matches the 3-line inline idiom for every corpus node', () => {
    for (const { nodes } of CORPUS) {
      for (const node of nodes) {
        const canonical = scaledNodeExtent(node);
        const legacy = oldScaledExtent(node);
        expect(Object.is(canonical.width, legacy.width)).toBe(true);
        expect(Object.is(canonical.height, legacy.height)).toBe(true);
      }
    }
  });

  it('singleNodeCenteredLayout matches the legacy epilogue field-for-field', () => {
    for (const { nodes } of CORPUS) {
      const canonical = singleNodeCenteredLayout([nodes[0]]);
      const legacy = oldSingleNodeCentered([nodes[0]]);
      expect(canonical.nodes).toEqual(legacy.nodes);
      expect(canonical.edges).toEqual(legacy.edges);
      expect(canonical.canvas).toEqual(legacy.canvas);
      expect(canonical.metrics).toEqual(legacy.metrics);
      // Per-field exactness (toEqual would pass 870 === 870.000000001).
      expect(Object.is(canonical.nodes[0].x, legacy.nodes[0].x)).toBe(true);
      expect(Object.is(canonical.nodes[0].y, legacy.nodes[0].y)).toBe(true);
      expect(Object.is(canonical.nodes[0].width, legacy.nodes[0].width)).toBe(true);
      expect(Object.is(canonical.nodes[0].height, legacy.nodes[0].height)).toBe(true);
    }
  });

  it('both delegating strategies emit the canonical epilogue for single-node input', () => {
    const solo: NodeDatum[] = [{ id: 'only', label: 'only', meta: { importance: 1.0 } }];
    for (const strategy of [mindmapStrategy, conceptmapStrategy]) {
      const result = strategy.apply(solo, []);
      const canonical = singleNodeCenteredLayout(solo);
      expect(result.nodes).toEqual(canonical.nodes);
      expect(result.edges).toEqual([]);
      expect(result.metrics).toEqual(emptyStrategyLayoutMetrics());
      // Exact witness: importance 1 → scale 1.5 → 120×1.5=180, 60×1.5=90,
      // centered on the default canvas.
      expect(result.nodes[0].width).toBe(180);
      expect(result.nodes[0].height).toBe(90);
      expect(result.nodes[0].x).toBe((DEFAULT_CANVAS_WIDTH - 180) / 2);
      expect(result.nodes[0].y).toBe((DEFAULT_CANVAS_HEIGHT - 90) / 2);
    }
  });
});

describe('strategy-graph preamble: semantic pins', () => {
  it('importance boost: degree 1 × (0.5+1.0) beats degree 2 × (0.5+0.0)', () => {
    const nodes: NodeDatum[] = [
      { id: 'hub', label: 'hub', meta: { importance: 0 } },
      { id: 'vip', label: 'vip', meta: { importance: 1.0 } },
      { id: 'x', label: 'x', meta: { importance: 0 } },
    ];
    const edges: EdgeDatum[] = [
      { from: 'hub', to: 'vip' },
      { from: 'hub', to: 'x' },
    ];
    // hub: degree 2 → 2 × 0.5 = 1.0; vip: degree 1 → 1 × 1.5 = 1.5 → vip wins.
    expect(findImportanceRoot(nodes, edges)).toBe('vip');
  });

  it('tie-break is first-max-wins in degree-map insertion order (strict >)', () => {
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
    expect(
      findImportanceRoot(
        [
          { id: 'a', label: 'a' },
          { id: 'b', label: 'b' },
        ],
        edges,
      ),
    ).toBe('a');
    // Same graph, node order swapped → the other id wins: proves the winner
    // is insertion order, not id sort or last-match.
    expect(
      findImportanceRoot(
        [
          { id: 'b', label: 'b' },
          { id: 'a', label: 'a' },
        ],
        edges,
      ),
    ).toBe('b');
  });

  it('dangling hub materializes in the degree map and can WIN (legacy semantics)', () => {
    const nodes: NodeDatum[] = [
      { id: 'n0', label: 'n0', meta: { importance: 0 } },
      { id: 'n1', label: 'n1', meta: { importance: 0.5 } },
    ];
    const edges: EdgeDatum[] = [
      { from: 'n0', to: 'ghost' },
      { from: 'n0', to: 'ghost' },
      { from: 'n0', to: 'ghost' },
    ];
    // n0: degree 3 × 0.5 = 1.5; ghost: degree 3 with the 0.5 IMPORTANCE
    // FALLBACK (nodeMap miss) → 3 × 1.0 = 3.0 → the ghost id wins.
    expect(findImportanceRoot(nodes, edges)).toBe('ghost');
  });

  it('adjacency: reciprocity, edge order, duplicates — but NO ghost materialization', () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' },
      { id: 'c', label: 'c' },
      { id: 'd', label: 'd' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'a' },
      { from: 'd', to: 'ghost' },
    ];
    const adj = buildUndirectedAdjacency(nodes, edges);
    // `b → a` appends BOTH ways: adj[b] += 'a' (forward), adj[a] += 'b'
    // (reciprocal) — duplicates and edge order survive verbatim.
    expect(adj.get('a')).toEqual(['b', 'c', 'b']);
    expect(adj.get('b')).toEqual(['a', 'a']);
    expect(adj.get('c')).toEqual(['a']);
    // `d → ghost`: the forward push lands (d lists ghost), only the
    // RECIPROCAL push is dropped by `?.` — no ghost key materializes.
    expect(adj.get('d')).toEqual(['ghost']);
    // The degree map materializes ghost entries; the adjacency map does NOT
    // — the asymmetry is verbatim legacy semantics, frozen here.
    expect(adj.has('ghost')).toBe(false);
    // Truly isolated nodes still seed an empty list.
    expect(buildUndirectedAdjacency(nodes, []).get('a')).toEqual([]);
  });

  it('scaledNodeExtent exact numbers per importance tier', () => {
    // scale = 0.75 + 0.75 × importance over the DEFAULT 120×60 extents.
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: 1.0 } }))
      .toEqual({ width: 180, height: 90 });
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: 0 } }))
      .toEqual({ width: 90, height: 45 });
    // undefined importance → default 0.5 → scale 1.125 → 135 / 67.5 → 68.
    expect(scaledNodeExtent({ id: 'a', label: 'a' }))
      .toEqual({ width: 135, height: 68 });
    // NaN importance → default 0.5 (getImportance) → same as undefined.
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: NaN } }))
      .toEqual({ width: 135, height: 68 });
    // Out-of-range clamps to [0, 1] before scaling.
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: 1.5 } }))
      .toEqual({ width: 180, height: 90 });
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: -0.5 } }))
      .toEqual({ width: 90, height: 45 });
    // Dimension reads go through node-dimensions: explicit `width` beats the
    // `w` alias; both axes independently.
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: 1.0 }, width: 177, w: 210 }))
      .toEqual({ width: 266, height: 90 });
    expect(scaledNodeExtent({ id: 'a', label: 'a', meta: { importance: 1.0 }, w: 140, h: 70 }))
      .toEqual({ width: 210, height: 105 });
  });

  it('singleNodeCenteredLayout: exact centered coordinates, no edges, empty metrics', () => {
    const result = singleNodeCenteredLayout([
      { id: 'solo', label: 'solo', meta: { importance: 0.5 }, width: 200 },
    ]);
    // scale 1.125 → w = round(225) = 225, h = round(67.5) = 68.
    // The epilogue spreads the input node and OVERRIDES the extent fields —
    // the input's explicit width:200 is replaced by the scaled 225.
    expect(result.nodes[0]).toEqual({
      id: 'solo', label: 'solo', meta: { importance: 0.5 },
      x: (1920 - 225) / 2,
      y: (1080 - 68) / 2,
      width: 225,
      height: 68,
    });
    expect(result.edges).toEqual([]);
    expect(result.metrics).toEqual(emptyStrategyLayoutMetrics());
    expect(result.canvas).toEqual(calculateCanvasSize(result.nodes));
  });

  it('behavior change (unreachable inputs): findImportanceRoot([]) throws, adjacency([]) is empty', () => {
    // The retired conceptmap flavor returned '' from its dead empty-list
    // guard; every caller guards first, so the canonical drops the guard and
    // fails loud instead of handing back a phantom root id.
    expect(() => findImportanceRoot([], [])).toThrow();
    expect(buildUndirectedAdjacency([], []).size).toBe(0);
    // Empty EDGES with non-empty nodes stays a pure degree-0 scan: first node.
    expect(findImportanceRoot([{ id: 'only', label: 'only' }], [])).toBe('only');
  });
});

// ---------------------------------------------------------------------------
// Layer 3: SOURCE ANCHORS — delegation shapes present, retired shapes gone.
// ---------------------------------------------------------------------------

const STRATEGY_FILES = [
  'src/visualization/strategies/mindmap-strategy.ts',
  'src/visualization/strategies/conceptmap-strategy.ts',
] as const;

describe('strategy-graph preamble: source anchors', () => {
  it('mindmap + conceptmap delegate all four shapes to strategy-graph', () => {
    for (const file of STRATEGY_FILES) {
      const src = readSource(file);
      expect(src).toMatch(/findImportanceRoot\(nodes, edges\)/);
      expect(src).toMatch(/buildUndirectedAdjacency\(nodes, edges\)/);
      expect(src).toMatch(/scaledNodeExtent\(node\)/);
      expect(src).toMatch(/singleNodeCenteredLayout\(nodes\)/);
      expect(src).toMatch(/from '\.\.\/strategy-graph'/);
    }
  });

  it('network delegates the sizing idiom to strategy-graph', () => {
    const src = readSource('src/visualization/strategies/network-strategy.ts');
    expect(src).toMatch(/scaledNodeExtent\(node\)/);
    expect(src).toMatch(/from '\.\.\/strategy-graph'/);
  });

  it('no migrated site re-inlines a retired preamble shape', () => {
    const retiredShapes: RegExp[] = [
      /degree\.get\(edge\.to\)/,
      /adj\.get\(edge\.to\)\?\.push\(edge\.from\)/,
      /importanceSizeScale\(nodes\[0\]\)/,
      /Math\.round\(getNodeWidth\((node|nodes\[0\]), DEFAULT_NODE_WIDTH\) \* scale\)/,
    ];
    for (const file of [...STRATEGY_FILES, 'src/visualization/strategies/network-strategy.ts']) {
      const src = readSource(file);
      for (const shape of retiredShapes) {
        const offenders = src.split('\n').filter((line) => shape.test(line));
        expect({ file, shape: shape.source, offenders }).toEqual({
          file, shape: shape.source, offenders: [],
        });
      }
    }
  });

  it('the canonical module carries each retired shape exactly once', () => {
    const src = readSource('src/visualization/strategy-graph.ts');
    // Count CODE lines only — the module header quotes the retired shapes in
    // prose, which is documentation, not duplication.
    const codeLines = src.split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
    const count = (re: RegExp) => codeLines.filter((line) => re.test(line)).length;
    expect(count(/degree\.get\(edge\.to\)/)).toBe(1);
    expect(count(/adj\.get\(edge\.to\)\?\.push\(edge\.from\)/)).toBe(1);
    expect(count(/d \* \(0\.5 \+ imp\)/)).toBe(1);
    // The canonical sizing path composes scaledDimensions (the previously
    // unwired helper) — the retired 3-line idiom must NOT reappear inline.
    expect(src).not.toMatch(/Math\.round\(getNodeWidth\(node, DEFAULT_NODE_WIDTH\) \* scale\)/);
  });

  it('scaledDimensions is no longer an unwired canonical (wired via scaledNodeExtent)', () => {
    // Pre-round-42, importance-scaler.scaledDimensions had zero production
    // callers while five sites hand-rolled its body. The wiring is the fix —
    // pin the import so the canonical cannot silently detach again.
    const src = readSource('src/visualization/strategy-graph.ts');
    expect(src).toMatch(/import \{ getImportance, scaledDimensions \} from '\.\/importance-scaler'/);
    expect(src).toMatch(/scaledDimensions\(/);
  });
});
