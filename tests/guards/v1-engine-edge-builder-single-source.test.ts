/**
 * @jest-environment node
 */
/**
 * v1-engine-edge-builder-single-source.test.ts — round 33.
 *
 * Family: the six LEGACY engine edge builders hand-rolled the same skeleton
 * the v2 strategies had (round 32) — endpoint lookup over positioned nodes,
 * warn-on-dangling + points:[] fallback, anchored LayoutEdge assembly —
 * under the v1 contract:
 *
 *   base/BaseLayoutEngine.generateAllEdges   unprefixed warn, anchors via
 *                                            the overridable
 *                                            this.generateEdgePoints
 *   ComparisonLayoutStrategy                 side anchors, pair-dependent
 *   ConceptMapLayoutStrategy                 center→center
 *   NetworkLayoutStrategy                    center→center
 *   TimelineLayoutStrategy                   right-center→left-center
 *   TreeLayoutStrategy                       bottom-center→top-center
 *
 * Canonical since round 33: buildWarnedAnchoredEdges in
 * src/visualization/strategy-edges.ts. Unlike round 32 the copies had NOT
 * drifted — uniform warn diagnostics, uniform no-id LayoutEdge shape — so
 * this extraction is ZERO DELTA by construction and every oracle below is a
 * pure equality (no two-sided drift pins; the deliberate v1-vs-v2 contract
 * differences are pinned as explicit witnesses instead):
 *
 *   - dangling edges WARN (v2 never warned);
 *   - the LayoutEdge carries NO id (all 6 legacy sites omit it; the v2
 *     majority keeps it);
 *   - endpoint lookup is FIRST-match-wins (v1 nodes.find semantics; the v2
 *     builder's plain Map construction is last-match-wins on the malformed
 *     duplicate-id node lists only the v1 engines can see).
 *
 * DRIFT SCENARIO this guard defends against: one legacy engine re-rolls its
 * private builder (drops the warn — silencing the dangling-edge diagnostic
 * for one diagram type only; adds id — forking the LayoutEdge contract;
 * switches to last-match lookup) and only that engine drifts while
 * shared-fixture tests stay green.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-33 bodies, frozen below (five
 *      shapes + the base shape), must stay value-equal to the canonical
 *      builder (with each site's anchors and prefix) on every corpus case,
 *      dangling included. Plus WARN pins: the exact legacy messages.
 *   2. DELEGATION EQUALITY — each of the five strategies'
 *      generateLayout().edges equals the canonical builder over its own
 *      positioned nodes; BaseLayoutEngine via an exposing subclass, with a
 *      virtual-dispatch pin proving a generateEdgePoints override still
 *      wins (the closure preserves `this.generateEdgePoints`).
 *   3. CONTRACT WITNESSES — dangling edge is exactly
 *      {from, to, points: [], label} with NO id key; duplicate-id node
 *      lists resolve first-match-wins.
 *   4. SOURCE ANCHORS — the canonical file holds the frozen shapes; the six
 *      engine files delegate; tree/timeline/comparison keep their anchor
 *      geometry formulas; out-of-family files do NOT delegate.
 *
 * The "no site re-rolls the skeleton" discovery sweep lives in the shared
 * registry (tests/guards/frozen-literal-rules.ts, round-33 entry — which
 * also un-excludes this family from the round-32 entry now that the shared
 * `points: [],` line is gone); this file holds the behavioral pins.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import { generateEdgePoints } from '@/visualization/layout-utils';
import { buildWarnedAnchoredEdges, centerToCenterAnchors, EdgeAnchor } from '@/visualization/strategy-edges';
import { BaseLayoutEngine } from '@/visualization/base/BaseLayoutEngine';
import { ComparisonLayoutStrategy } from '@/visualization/strategies/ComparisonLayoutStrategy';
import { ConceptMapLayoutStrategy } from '@/visualization/strategies/ConceptMapLayoutStrategy';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { TimelineLayoutStrategy } from '@/visualization/strategies/TimelineLayoutStrategy';
import { TreeLayoutStrategy } from '@/visualization/strategies/TreeLayoutStrategy';
import { logger } from '@stv/core/utils/logger';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-33 bodies, frozen from
// ConceptMapLayoutStrategy.ts / NetworkLayoutStrategy.ts /
// TimelineLayoutStrategy.ts / TreeLayoutStrategy.ts /
// ComparisonLayoutStrategy.ts / base/BaseLayoutEngine.ts @ 86a3917d.
// Do not "improve" these copies: their job is to be the OLD behavior, not
// good behavior. The logger.warn lines are omitted here (they have no return
// value to compare) — the messages are pinned separately in the WARN pins.
// ---------------------------------------------------------------------------

/** conceptmap + network shape: `.find` lookup, center anchors (DEFAULT-extent fallback). */
function legacyV1CenterBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  return edges.map(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label };
    }
    const sourcePoint = {
      x: source.x + getNodeWidth(source) / 2,
      y: source.y + getNodeHeight(source) / 2
    };
    const targetPoint = {
      x: target.x + getNodeWidth(target) / 2,
      y: target.y + getNodeHeight(target) / 2
    };
    return { from: edge.from, to: edge.to, points: [sourcePoint, targetPoint], label: edge.label };
  });
}

/** timeline shape: horizontal arrow, source right-center → target left-center. */
function legacyV1TimelineBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  return edges.map(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label };
    }
    const sourcePoint = {
      x: source.x + getNodeWidth(source),
      y: source.y + getNodeHeight(source) / 2
    };
    const targetPoint = {
      x: target.x,
      y: target.y + getNodeHeight(target) / 2
    };
    return { from: edge.from, to: edge.to, points: [sourcePoint, targetPoint], label: edge.label };
  });
}

/** tree shape: source center-bottom → target center-top. */
function legacyV1TreeBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  return edges.map(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label };
    }
    const sourcePoint = {
      x: source.x + getNodeWidth(source) / 2,
      y: source.y + getNodeHeight(source)
    };
    const targetPoint = {
      x: target.x + getNodeWidth(target) / 2,
      y: target.y
    };
    return { from: edge.from, to: edge.to, points: [sourcePoint, targetPoint], label: edge.label };
  });
}

/** comparison shape: pair-dependent side anchors. */
function legacyV1ComparisonBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  return edges.map(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label };
    }
    const sourceIsLeft = source.x < target.x;
    const sourcePoint = {
      x: sourceIsLeft ? source.x + getNodeWidth(source) : source.x,
      y: source.y + getNodeHeight(source) / 2
    };
    const targetPoint = {
      x: sourceIsLeft ? target.x : target.x + getNodeWidth(target),
      y: target.y + getNodeHeight(target) / 2
    };
    return { from: edge.from, to: edge.to, points: [sourcePoint, targetPoint], label: edge.label };
  });
}

/**
 * base shape: anchors via generateEdgePoints → calculateNodeCenter, whose
 * extent fallback is 0 (NOT DEFAULT — a real cross-site difference on
 * widthless positioned nodes, exactly why anchors are parameterized).
 */
function legacyV1BaseBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  return edges.map(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label };
    }
    return { from: edge.from, to: edge.to, points: generateEdgePoints(source, target), label: edge.label };
  });
}

// ---------------------------------------------------------------------------
// Corpus: (edges, positionedNodes) pairs at BUILDER level — deterministic,
// no layout algorithm involved. PositionedNode extents are optional in the
// type, which is how the base-vs-strategy fallback difference fires, and
// the duplicate-id case is how a last-match lookup would fire.
// ---------------------------------------------------------------------------

function p(
  id: string,
  x: number,
  y: number,
  extents?: { width?: number; height?: number },
): PositionedNode {
  return {
    id,
    label: id,
    x,
    y,
    ...(extents?.width !== undefined ? { width: extents.width } : {}),
    ...(extents?.height !== undefined ? { height: extents.height } : {}),
  } as PositionedNode;
}

interface BuilderCase {
  name: string;
  nodes: PositionedNode[];
  edges: EdgeDatum[];
}

const BUILDER_CASES: BuilderCase[] = [
  {
    name: 'chain-3 finite extents',
    nodes: [
      p('a', 10, 20, { width: 120, height: 60 }),
      p('b', 200, 40, { width: 200, height: 80 }),
      p('c', 90, 300, { width: 120, height: 60 }),
    ],
    edges: [
      { from: 'a', to: 'b', label: 'first' },
      { from: 'b', to: 'c', id: 'e2' },
    ],
  },
  {
    name: 'star-4 hub/spokes with mixed label presence',
    nodes: [
      p('hub', 400, 300, { width: 160, height: 40 }),
      p('s1', 100, 100, { width: 90, height: 40 }),
      p('s2', 700, 110, { width: 90, height: 40 }),
      p('s3', 120, 500, { width: 90, height: 40 }),
      p('s4', 680, 510, { width: 90, height: 40 }),
    ],
    edges: [
      { from: 'hub', to: 's1', label: 'has-label', id: 'x1' },
      { from: 'hub', to: 's2' },
      { from: 'hub', to: 's3', label: undefined },
      { from: 'hub', to: 's4', id: 'x4' },
    ],
  },
  {
    name: 'dangling ghost target + ghost source',
    nodes: [p('a', 0, 0, { width: 120, height: 60 }), p('b', 300, 0, { width: 120, height: 60 })],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'ghost', label: 'dangling-target', id: 'e2' },
      { from: 'ghost2', to: 'a', label: 'dangling-source', id: 'e3' },
    ],
  },
  {
    name: 'widthless positioned extents (fallback-dependent)',
    nodes: [p('a', 50, 60), p('b', 350, 260)],
    edges: [{ from: 'a', to: 'b', label: 'no-extents' }],
  },
  {
    name: 'same-x pair (comparison sourceIsLeft tie-break via <)',
    nodes: [
      p('a', 100, 0, { width: 120, height: 60 }),
      p('b', 100, 300, { width: 120, height: 60 }),
    ],
    edges: [{ from: 'a', to: 'b' }],
  },
  {
    name: 'duplicate node ids (first-match lookup semantics)',
    nodes: [
      p('dup', 0, 0, { width: 100, height: 50 }),
      p('dup', 500, 500, { width: 100, height: 50 }),
      p('b', 300, 0, { width: 120, height: 60 }),
    ],
    edges: [
      { from: 'dup', to: 'b', label: 'which-dup' },
      { from: 'b', to: 'dup' },
    ],
  },
  {
    name: 'self-edge',
    nodes: [p('a', 40, 40, { width: 120, height: 60 })],
    edges: [{ from: 'a', to: 'a', label: 'loop', id: 'self' }],
  },
];

// The canonical closures — the exact anchor functions the migrated files
// pass (strategy-specific geometry re-typed here; source-anchored in
// round-33-4).
const canonicalTimelineAnchors = (source: PositionedNode, target: PositionedNode): EdgeAnchor[] => [
  { x: source.x + getNodeWidth(source), y: source.y + getNodeHeight(source) / 2 },
  { x: target.x, y: target.y + getNodeHeight(target) / 2 },
];

const canonicalTreeAnchors = (source: PositionedNode, target: PositionedNode): EdgeAnchor[] => [
  { x: source.x + getNodeWidth(source) / 2, y: source.y + getNodeHeight(source) },
  { x: target.x + getNodeWidth(target) / 2, y: target.y },
];

const canonicalComparisonAnchors = (source: PositionedNode, target: PositionedNode): EdgeAnchor[] => {
  const sourceIsLeft = source.x < target.x;
  return [
    { x: sourceIsLeft ? source.x + getNodeWidth(source) : source.x, y: source.y + getNodeHeight(source) / 2 },
    { x: sourceIsLeft ? target.x : target.x + getNodeWidth(target), y: target.y + getNodeHeight(target) / 2 },
  ];
};

const canonicalCenterAnchors = (source: PositionedNode, target: PositionedNode): EdgeAnchor[] => [
  ...centerToCenterAnchors(source, target),
];

// --- (round-33-1) verbatim oracle: canonical builder == frozen legacy bodies ---

describe('v1 engine edge builder — verbatim legacy oracle (round-33-1)', () => {
  it.each(BUILDER_CASES)('%s: canonical(center, prefix) matches conceptmap/network replica', ({ nodes, edges }) => {
    expect(buildWarnedAnchoredEdges(edges, nodes, canonicalCenterAnchors, '[ConceptMap] '))
      .toEqual(legacyV1CenterBuilder(edges, nodes));
    expect(buildWarnedAnchoredEdges(edges, nodes, canonicalCenterAnchors, '[Network] '))
      .toEqual(legacyV1CenterBuilder(edges, nodes));
  });

  it.each(BUILDER_CASES)('%s: canonical(timeline anchors) matches timeline replica', ({ nodes, edges }) => {
    expect(buildWarnedAnchoredEdges(edges, nodes, canonicalTimelineAnchors, '[Timeline] '))
      .toEqual(legacyV1TimelineBuilder(edges, nodes));
  });

  it.each(BUILDER_CASES)('%s: canonical(tree anchors) matches tree replica', ({ nodes, edges }) => {
    expect(buildWarnedAnchoredEdges(edges, nodes, canonicalTreeAnchors, '[Tree] '))
      .toEqual(legacyV1TreeBuilder(edges, nodes));
  });

  it.each(BUILDER_CASES)('%s: canonical(comparison anchors) matches comparison replica', ({ nodes, edges }) => {
    expect(buildWarnedAnchoredEdges(edges, nodes, canonicalComparisonAnchors, '[Comparison] '))
      .toEqual(legacyV1ComparisonBuilder(edges, nodes));
  });

  it.each(BUILDER_CASES)('%s: canonical(generateEdgePoints, no prefix) matches base replica', ({ nodes, edges }) => {
    expect(buildWarnedAnchoredEdges(edges, nodes, generateEdgePoints, ''))
      .toEqual(legacyV1BaseBuilder(edges, nodes));
  });

  // The base-vs-strategy fallback difference is real and preserved: on
  // widthless positioned nodes generateEdgePoints anchors at the raw corner
  // (fallback 0) while the strategy anchors use DEFAULT extents.
  it('CONTRACT PIN: base anchors (fallback 0) differ from strategy anchors (fallback DEFAULT) on widthless nodes', () => {
    const nodes = [p('a', 50, 60), p('b', 350, 260)];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
    const base = buildWarnedAnchoredEdges(edges, nodes, generateEdgePoints, '');
    const strategy = buildWarnedAnchoredEdges(edges, nodes, canonicalCenterAnchors, '[ConceptMap] ');
    expect(base[0].points[0]).toEqual({ x: 50, y: 60 });
    expect(strategy[0].points[0]).toEqual({
      x: 50 + DEFAULT_NODE_WIDTH / 2,
      y: 60 + DEFAULT_NODE_HEIGHT / 2,
    });
  });
});

// --- (round-33-1b) warn pins: the exact legacy dangling-edge diagnostics ---

describe('v1 engine edge builder — warn-message pins (round-33-1b)', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('the canonical builder emits `${warnPrefix}Edge <from> -> <to> missing nodes`', () => {
    const nodes = [p('a', 0, 0, { width: 120, height: 60 })];
    buildWarnedAnchoredEdges(
      [{ from: 'b', to: 'ghost', label: 'gone' }],
      nodes,
      canonicalCenterAnchors,
      '[ConceptMap] ',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[ConceptMap] Edge b -> ghost missing nodes');
  });

  it.each([
    ['[ConceptMap] ', '[ConceptMap] Edge x -> ghost missing nodes'],
    ['[Network] ', '[Network] Edge x -> ghost missing nodes'],
    ['[Timeline] ', '[Timeline] Edge x -> ghost missing nodes'],
    ['[Tree] ', '[Tree] Edge x -> ghost missing nodes'],
    ['[Comparison] ', '[Comparison] Edge x -> ghost missing nodes'],
    ['', 'Edge x -> ghost missing nodes'], // BaseLayoutEngine: unprefixed
  ])('prefix %j reproduces the legacy message', (prefix, message) => {
    buildWarnedAnchoredEdges(
      [{ from: 'x', to: 'ghost' }],
      [p('x', 0, 0, { width: 120, height: 60 })],
      canonicalCenterAnchors,
      prefix,
    );
    expect(warnSpy).toHaveBeenCalledWith(message);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 material: delegation equality through the real engines.
// ---------------------------------------------------------------------------

const V1_CONFIG: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 80,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 70,
  edgeSeparation: 10,
  rankSeparation: 50,
};

const TOPOLOGIES: Array<{ name: string; nodes: NodeDatum[]; edges: EdgeDatum[] }> = [
  {
    name: 'chain-3',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    edges: [
      { from: 'a', to: 'b', label: 'ab' },
      { from: 'b', to: 'c', id: 'bc' },
    ],
  },
  {
    name: 'star-5',
    nodes: [
      { id: 'hub', label: 'Hub' },
      { id: 's1', label: 'Spoke 1' },
      { id: 's2', label: 'Spoke 2' },
      { id: 's3', label: 'Spoke 3' },
      { id: 's4', label: 'Spoke 4' },
    ],
    edges: [
      { from: 'hub', to: 's1' },
      { from: 'hub', to: 's2', label: 'two' },
      { from: 'hub', to: 's3', id: 'three' },
      { from: 's4', to: 'hub', label: 'reverse' },
    ],
  },
  {
    name: 'explicit-extents',
    nodes: [
      { id: 'wide', label: 'Wide', width: 400, height: 120 },
      { id: 'tall', label: 'Tall', width: 80, height: 320 },
      { id: 'norm', label: 'Norm' },
    ],
    edges: [
      { from: 'wide', to: 'tall', label: 'labeled' },
      { from: 'tall', to: 'norm' },
    ],
  },
  {
    name: 'long-cjk-labels',
    nodes: [
      { id: 'jp', label: '非常に長い日本語ラベルのノード' },
      { id: 'jp2', label: '短い' },
      { id: 'en', label: 'a-much-longer-english-label-here' },
    ],
    edges: [
      { from: 'jp', to: 'jp2', label: '関連' },
      { from: 'jp2', to: 'en' },
    ],
  },
  {
    name: 'duplicate-edge',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    edges: [
      { from: 'a', to: 'b', label: 'first' },
      { from: 'a', to: 'b', label: 'second' },
    ],
  },
  {
    name: 'dangling-edges',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', label: 'valid' },
      { id: 'e2', from: 'b', to: 'ghost', label: 'dangling-target' },
      { id: 'e3', from: 'ghost2', to: 'c', label: 'dangling-source' },
    ],
  },
  {
    name: 'chain-12',
    nodes: Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
    })),
    edges: Array.from({ length: 11 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
    })),
  },
];

/** Minimal concrete BaseLayoutEngine exposing the protected template API. */
class ExposingEngine extends BaseLayoutEngine {
  protected getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig {
    return { ...V1_CONFIG, ...override };
  }
  generateLayout(): Promise<never> {
    throw new Error('not used in this guard');
  }
  public allEdges(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
    return this.generateAllEdges(edges, nodes);
  }
}

// --- (round-33-2) delegation equality: engine output == canonical builder ---

describe('v1 engine edge builder — engine delegation equality (round-33-2)', () => {
  const strategies: Array<{
    name: string;
    run: (nodes: NodeDatum[], edges: EdgeDatum[]) => Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }>;
    anchors: (s: PositionedNode, t: PositionedNode) => EdgeAnchor[];
    prefix: string;
  }> = [
    {
      name: 'comparison',
      run: (n, e) => new ComparisonLayoutStrategy().generateLayout(n, e, V1_CONFIG),
      anchors: canonicalComparisonAnchors,
      prefix: '[Comparison] ',
    },
    {
      name: 'conceptmap',
      run: (n, e) => new ConceptMapLayoutStrategy().generateLayout(n, e, V1_CONFIG),
      anchors: canonicalCenterAnchors,
      prefix: '[ConceptMap] ',
    },
    {
      name: 'network',
      run: (n, e) => new NetworkLayoutStrategy().generateLayout(n, e, V1_CONFIG),
      anchors: canonicalCenterAnchors,
      prefix: '[Network] ',
    },
    {
      name: 'timeline',
      run: (n, e) => new TimelineLayoutStrategy().generateLayout(n, e, V1_CONFIG),
      anchors: canonicalTimelineAnchors,
      prefix: '[Timeline] ',
    },
    {
      name: 'tree',
      run: (n, e) => new TreeLayoutStrategy().generateLayout(n, e, V1_CONFIG),
      anchors: canonicalTreeAnchors,
      prefix: '[Tree] ',
    },
  ];

  for (const { name, run, anchors, prefix } of strategies) {
    // Tree's buildTree THROWS on a dangling endpoint long before edge
    // building (VisualizationError 'Node ghost not found') — a pre-existing
    // engine-level contract outside this family; every other topology runs.
    const topologies = name === 'tree' ? TOPOLOGIES.filter((t) => t.name !== 'dangling-edges') : TOPOLOGIES;
    for (const { name: topo, nodes, edges } of topologies) {
      it(`${name}.generateLayout() on ${topo}: edges == canonical builder over its own nodes`, async () => {
        const applied = await run(nodes, edges);
        expect(applied.edges).toEqual(buildWarnedAnchoredEdges(edges, applied.nodes, anchors, prefix));
      });
    }
  }

  it('the delegation corpus is real: at least one case produces anchored (non-empty) points everywhere', async () => {
    const applied = await new ComparisonLayoutStrategy().generateLayout(
      TOPOLOGIES[0].nodes,
      TOPOLOGIES[0].edges,
      V1_CONFIG,
    );
    expect(applied.edges).toHaveLength(2);
    expect(applied.edges[0].points).toHaveLength(2);
  });

  it('BaseLayoutEngine.generateAllEdges delegates to the canonical builder (base anchors, no prefix)', () => {
    const engine = new ExposingEngine();
    const case_ = BUILDER_CASES[0];
    expect(engine.allEdges(case_.edges, case_.nodes))
      .toEqual(buildWarnedAnchoredEdges(case_.edges, case_.nodes, generateEdgePoints, ''));
  });

  it('VIRTUAL-DISPATCH PIN: a generateEdgePoints override still wins (the closure preserves this.generateEdgePoints)', () => {
    const sentinel = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    class OverridingEngine extends ExposingEngine {
      protected generateEdgePoints(): { x: number; y: number }[] {
        return sentinel;
      }
    }
    const case_ = BUILDER_CASES[0];
    const edges = new OverridingEngine().allEdges(case_.edges, case_.nodes);
    expect(edges[0].points).toEqual(sentinel);
    expect(edges[1].points).toEqual(sentinel);
  });
});

// --- (round-33-3) contract witnesses: no-id shape + first-match lookup ---

describe('v1 engine edge builder — contract witnesses (round-33-3)', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  const nodes: PositionedNode[] = [
    p('a', 0, 0, { width: 120, height: 60 }),
    p('b', 300, 0, { width: 120, height: 60 }),
  ];

  it('a dangling edge is exactly {from, to, points: [], label} — NO id key (v1 contract)', () => {
    const [edge] = buildWarnedAnchoredEdges(
      [{ from: 'b', to: 'ghost', label: 'gone', id: 'e9' }],
      nodes,
      canonicalCenterAnchors,
      '[Tree] ',
    );
    expect(edge.points).toEqual([]);
    expect(edge.from).toBe('b');
    expect(edge.to).toBe('ghost');
    expect(edge.label).toBe('gone');
    // The deliberate v1-vs-v2 difference: even when the input carries an id,
    // the v1 LayoutEdge does NOT echo it.
    expect('id' in edge).toBe(false);
  });

  it('an anchored edge likewise carries no id key', () => {
    const [edge] = buildWarnedAnchoredEdges(
      [{ from: 'a', to: 'b', label: 'ok', id: 'e1' }],
      nodes,
      canonicalCenterAnchors,
      '[Tree] ',
    );
    expect(edge.points).toHaveLength(2);
    expect('id' in edge).toBe(false);
  });

  it('duplicate node ids resolve FIRST-match-wins (nodes.find semantics, not the v2 last-wins Map)', () => {
    const dupNodes = [
      p('dup', 0, 0, { width: 100, height: 50 }),
      p('dup', 500, 500, { width: 100, height: 50 }),
      p('b', 300, 0, { width: 120, height: 60 }),
    ];
    const [outgoing] = buildWarnedAnchoredEdges(
      [{ from: 'dup', to: 'b' }],
      dupNodes,
      canonicalCenterAnchors,
      '',
    );
    // First 'dup' is at (0,0): center x = 0 + 100/2. A last-wins lookup would
    // anchor at 500 + 100/2.
    expect(outgoing.points[0].x).toBe(50);
    expect(outgoing.points[0].x).not.toBe(550);
  });
});

// --- (round-33-4) source anchors: canonical shapes + delegation, no re-rolls ---

describe('v1 engine edge builder — source anchors (round-33-4)', () => {
  const CANONICAL = 'src/visualization/strategy-edges.ts';
  const ENGINE_FILES = [
    'src/visualization/base/BaseLayoutEngine.ts',
    'src/visualization/strategies/ComparisonLayoutStrategy.ts',
    'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
    'src/visualization/strategies/NetworkLayoutStrategy.ts',
    'src/visualization/strategies/TimelineLayoutStrategy.ts',
    'src/visualization/strategies/TreeLayoutStrategy.ts',
  ];

  it('the canonical file holds the v1 skeleton shapes', () => {
    const src = readSource(CANONICAL);
    // first-match-wins map construction (the has-check is the v1 contract).
    expect(src).toMatch(/if\s*\(!nodeMap\.has\(node\.id\)\)\s*\{/);
    // the warn seam and its prefix interpolation.
    expect(src).toMatch(/logger\.warn\(`\$\{warnPrefix\}Edge \$\{edge\.from\} -> \$\{edge\.to\} missing nodes`\)/);
    // the dangling fallback: empty points + label echo, NO id line between them.
    expect(src).toMatch(/points:\s*\[\],\s*\n\s*label:\s*edge\.label,\s*\n\s*\};/);
    // Round 46 conscious update: pointsOf now accepts BOTH the round-46
    // anchor pairs (readonly EdgeAnchorPair tuple) and legacy point-array
    // anchors (BaseLayoutEngine's overridable generateEdgePoints returns a
    // plain Point[]); the assembly spreads either into the mutable points
    // array — same two elements, fresh array, bit-identical output.
    expect(src).toMatch(/points:\s*\[\.\.\.pointsOf\(source,\s*target\)\],/);
  });

  it.each(ENGINE_FILES)('%s delegates to buildWarnedAnchoredEdges and re-rolls no skeleton shape', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/buildWarnedAnchoredEdges\(/);
    // The skeleton shapes are gone from every engine file. (ConceptMap/
    // Network keep no geometry; the warn literal 'missing nodes' and the
    // fallback/assembly lines belong to the canonical builder only.)
    expect(src).not.toMatch(/missing nodes/);
    expect(src).not.toMatch(/points:\s*\[\]\s*,?\s*$/);
    expect(src).not.toMatch(/label:\s*edge\.label/);
    expect(src).not.toMatch(/from:\s*edge\.from/);
    expect(src).not.toMatch(/to:\s*edge\.to\b/);
  });

  it('the five clean engine files re-roll no endpoint lookup (Network keeps its physics loop)', () => {
    // The `.find(n => n.id === edge.from)` lookup is the v1 skeleton's third
    // tell. It cannot be banned module-wide (5 legitimate corpora) nor in
    // NetworkLayoutStrategy (its force-directed PHYSICS reads the same shape
    // for edge attraction — a different concept, like the v2 network
    // strategy in round 32); the other five family files must not carry it.
    for (const file of [
      'src/visualization/base/BaseLayoutEngine.ts',
      'src/visualization/strategies/ComparisonLayoutStrategy.ts',
      'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
      'src/visualization/strategies/TimelineLayoutStrategy.ts',
      'src/visualization/strategies/TreeLayoutStrategy.ts',
    ]) {
      expect(readSource(file)).not.toMatch(/\.find\(\s*\w+\s*=>\s*\w+\.id\s*===\s*edge\./);
    }
  });

  // Round 46 conscious update: the three strategy-specific anchor geometries
  // this section used to pin "in place" were PROMOTED to canonical pair
  // helpers in strategy-edges.ts — comparison's flanks and timeline's
  // right→left and tree's bottom→top each had a second/third site by round 46
  // (v2 comparison / Fallback timeline / v2 timeline + Fallback flow). The
  // strategies now pass the canonical pair; the geometry pins moved with the
  // code to edge-anchor-geometry-single-source.test.ts (round 46).
  it('comparison/timeline/tree pass the canonical round-46 anchor pairs', () => {
    const srcC = readSource('src/visualization/strategies/ComparisonLayoutStrategy.ts');
    expect(srcC).toMatch(/buildWarnedAnchoredEdges,\s*flankAnchors\s*\}\s*from\s*'\.\.\/strategy-edges';/);
    expect(srcC).not.toMatch(/sourceIsLeft/);
    const srcT = readSource('src/visualization/strategies/TimelineLayoutStrategy.ts');
    expect(srcT).toMatch(/buildWarnedAnchoredEdges,\s*horizontalFlowAnchors\s*\}\s*from\s*'\.\.\/strategy-edges';/);
    expect(srcT).not.toMatch(/x:\s*source\.x\s*\+\s*getNodeWidth\(source\),/);
    const srcTr = readSource('src/visualization/strategies/TreeLayoutStrategy.ts');
    expect(srcTr).toMatch(/buildWarnedAnchoredEdges,\s*verticalFlowAnchors\s*\}\s*from\s*'\.\.\/strategy-edges';/);
    expect(srcTr).not.toMatch(/y:\s*source\.y\s*\+\s*getNodeHeight\(source\)/);
  });

  it('conceptmap/network delegate with the shared center anchors', () => {
    for (const file of [
      'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
      'src/visualization/strategies/NetworkLayoutStrategy.ts',
    ]) {
      const src = readSource(file);
      expect(src).toMatch(/centerToCenterAnchors/);
    }
  });

  it('BaseLayoutEngine keeps the virtual-dispatch closure and its empty prefix in place', () => {
    const src = readSource('src/visualization/base/BaseLayoutEngine.ts');
    expect(src).toMatch(/\(source,\s*target\)\s*=>\s*this\.generateEdgePoints\(source,\s*target\),\s*\n\s*''/);
  });

  it('out-of-family files do NOT delegate to the v1 builder (scope pin)', () => {
    // The v2 builder (round 32) serves the registered-strategy family; the
    // dagre pipelines own their edge extraction (round 30); the layout/
    // spread-fallback family is a different contract. A cross-family switch
    // must update this pin consciously.
    for (const file of [
      'src/visualization/strategies/matrix-strategy.ts',
      'src/visualization/dagre-pipeline.ts',
      'src/visualization/enhanced-zero-overlap-layout.ts',
      'src/visualization/strategies/DagreLayoutStrategy.ts',
      'src/visualization/strategies/FlowchartLayoutStrategy.ts',
    ]) {
      expect(readSource(file)).not.toMatch(/buildWarnedAnchoredEdges/);
    }
  });
});
