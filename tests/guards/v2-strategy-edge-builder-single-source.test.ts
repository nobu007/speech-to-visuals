/**
 * @jest-environment node
 */
/**
 * v2-strategy-edge-builder-single-source.test.ts — round 32.
 *
 * Family: every non-dagre registered strategy (the v2 kebab-case family
 * wired in StrategySelector.registerDefaults) hand-rolled the SAME
 * edge-construction skeleton — nodeMap over the positioned nodes, a
 * dangling-endpoint fallback, LayoutEdge assembly — with only the anchor
 * geometry varying:
 *
 *   matrix / general    center→center, fallback {from,to,points:[],label,id}
 *   cycle               center→center via getNodeWidth(node, 0)
 *   conceptmap / network center→center, fallback DROPPED edge.id
 *   mindmap             center anchors, NO fallback branch (phantom points)
 *   timeline            bottom-center→top-center
 *   comparison          side anchors, pair-dependent
 *
 * Canonical since round 32: buildAnchoredLayoutEdges + centerToCenterAnchors
 * in src/visualization/strategy-edges.ts. Three drifts were ALREADY live and
 * are frozen here as pinned behavior changes (majority shape wins, like
 * round 31's Tree preamble): conceptmap/network dangling edges gain `id`;
 * mindmap dangling edges lose their phantom near-origin points; cycle's
 * `getNodeWidth(node, 0)` width fallback becomes NaN-safe DEFAULT.
 *
 * DRIFT SCENARIO this guard defends against: one strategy re-rolls a private
 * builder (drops `id` from the fallback, restores phantom points, reads raw
 * `.width`) and only that diagram type drifts while shared-fixture tests
 * stay green.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-32 bodies, frozen below (six shapes),
 *      must stay value-equal to the canonical builder on every corpus case
 *      where the legacy shape did not itself carry the drift; the drift
 *      cases are pinned as explicit two-sided deltas (legacy value AND
 *      canonical value), so "fixing" either side fails loudly.
 *   2. DELEGATION EQUALITY — each of the eight strategies' apply().edges
 *      equals the canonical builder over apply().nodes with that strategy's
 *      anchor, for multi-node topologies (single/empty paths short-circuit
 *      before edge building and are covered by the strategy suites).
 *   3. UNIFIED DANGLING SHAPE — the behavior-change witness: in all eight
 *      strategies a dangling edge yields exactly
 *      {from, to, points: [], label, id}.
 *   4. SOURCE ANCHORS — the canonical file holds the frozen shapes; the
 *      eight strategy files import the builder and re-roll neither the
 *      fallback nor the LayoutEdge assembly; timeline/comparison keep their
 *      anchor geometry formulas in place.
 *
 * The "no site re-rolls the skeleton" discovery sweep lives in the shared
 * registry (tests/guards/frozen-literal-rules.ts, round-32 entry); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import {
  buildAnchoredLayoutEdges,
  centerToCenterAnchors,
  EdgeAnchorPair,
} from '@/visualization/strategy-edges';
import { MatrixStrategy } from '@/visualization/strategies/matrix-strategy';
import { GeneralStrategy } from '@/visualization/strategies/general-strategy';
import { CycleLayoutStrategy } from '@/visualization/strategies/cycle-strategy';
import { ConceptMapStrategy } from '@/visualization/strategies/conceptmap-strategy';
import { NetworkStrategy } from '@/visualization/strategies/network-strategy';
import { MindMapStrategy } from '@/visualization/strategies/mindmap-strategy';
import { TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import { ComparisonStrategy } from '@/visualization/strategies/comparison-strategy';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-32 bodies, frozen from
// matrix-strategy.ts / cycle-strategy.ts / conceptmap-strategy.ts /
// timeline-strategy.ts / comparison-strategy.ts / mindmap-strategy.ts @
// 7cacc8d9. Do not "improve" these copies: their job is to be the OLD
// behavior, not good behavior.
// ---------------------------------------------------------------------------

/** matrix + general shape: fallback keeps id; center anchors, DEFAULT extents. */
function legacyCenterBuilderWithId(
  edges: EdgeDatum[],
  nodes: PositionedNode[],
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);

    if (!source || !target) {
      return {
        from: edge.from,
        to: edge.to,
        points: [],
        label: edge.label,
        id: edge.id,
      };
    }

    const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
    const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
    const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
    const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
    const sourcePoint = {
      x: source.x + sw / 2,
      y: source.y + sh / 2,
    };
    const targetPoint = {
      x: target.x + tw / 2,
      y: target.y + th / 2,
    };

    return {
      from: edge.from,
      to: edge.to,
      points: [sourcePoint, targetPoint],
      label: edge.label,
      id: edge.id,
    };
  });
}

/** cycle shape: same skeleton, but anchors read fallback 0 (the drift). */
function legacyCycleBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  const nodeMap = new Map<string, PositionedNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);

    if (!source || !target) {
      return {
        from: edge.from,
        to: edge.to,
        points: [],
        label: edge.label,
        id: edge.id,
      };
    }

    const sourcePoint = {
      x: source.x + getNodeWidth(source, 0) / 2,
      y: source.y + getNodeHeight(source, 0) / 2,
    };

    const targetPoint = {
      x: target.x + getNodeWidth(target, 0) / 2,
      y: target.y + getNodeHeight(target, 0) / 2,
    };

    return {
      from: edge.from,
      to: edge.to,
      points: [sourcePoint, targetPoint],
      label: edge.label,
      id: edge.id,
    };
  });
}

/** conceptmap + network shape: fallback DROPS id (the drift). */
function legacyCenterBuilderWithoutId(
  edges: EdgeDatum[],
  nodes: PositionedNode[],
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  return edges.map(edge => {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) {
      return { from: edge.from, to: edge.to, points: [] as { x: number; y: number }[], label: edge.label };
    }
    return {
      from: edge.from,
      to: edge.to,
      points: [
        { x: src.x + getNodeWidth(src, DEFAULT_NODE_WIDTH) / 2, y: src.y + getNodeHeight(src, DEFAULT_NODE_HEIGHT) / 2 },
        { x: tgt.x + getNodeWidth(tgt, DEFAULT_NODE_WIDTH) / 2, y: tgt.y + getNodeHeight(tgt, DEFAULT_NODE_HEIGHT) / 2 },
      ],
      label: edge.label,
      id: edge.id,
    };
  });
}

/** timeline shape: vertical flow anchors (bottom-center → top-center). */
function legacyTimelineBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);

    if (!source || !target) {
      return {
        from: edge.from,
        to: edge.to,
        points: [],
        label: edge.label,
        id: edge.id,
      };
    }

    const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
    const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
    const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
    const sourcePoint = {
      x: source.x + sw / 2,
      y: source.y + sh,
    };
    const targetPoint = {
      x: target.x + tw / 2,
      y: target.y,
    };

    return {
      from: edge.from,
      to: edge.to,
      points: [sourcePoint, targetPoint],
      label: edge.label,
      id: edge.id,
    };
  });
}

/** comparison shape: pair-dependent side anchors. */
function legacyComparisonBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) {
      return { from: edge.from, to: edge.to, points: [], label: edge.label, id: edge.id };
    }
    const sourceIsLeft = source.x < target.x;
    const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
    const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
    const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
    const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
    return {
      from: edge.from,
      to: edge.to,
      points: [
        { x: sourceIsLeft ? source.x + sw : source.x, y: source.y + sh / 2 },
        { x: sourceIsLeft ? target.x : target.x + tw, y: target.y + th / 2 },
      ],
      label: edge.label,
      id: edge.id,
    };
  });
}

/** mindmap shape: NO fallback branch — phantom points via ?? (the drift). */
function legacyMindmapBuilder(edges: EdgeDatum[], nodes: PositionedNode[]): LayoutEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  return edges.map(edge => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    return {
      from: edge.from,
      to: edge.to,
      points: [
        { x: (source?.x ?? 0) + (source?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (source?.y ?? 0) + (source?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
        { x: (target?.x ?? 0) + (target?.width ?? DEFAULT_NODE_WIDTH) / 2, y: (target?.y ?? 0) + (target?.height ?? DEFAULT_NODE_HEIGHT) / 2 },
      ],
      label: edge.label,
      id: edge.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Corpus: (edges, positionedNodes) pairs at BUILDER level — deterministic,
// no layout algorithm involved. PositionedNode extents are optional in the
// type, which is exactly how the cycle/mindmap fallback drifts fire.
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

const NO_DANGLING_CASES: BuilderCase[] = [
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
    name: 'duplicate-edge same endpoints',
    nodes: [
      p('a', 0, 0, { width: 120, height: 60 }),
      p('b', 300, 0, { width: 120, height: 60 }),
    ],
    edges: [
      { from: 'a', to: 'b', label: 'first' },
      { from: 'a', to: 'b', label: 'second', id: 'dup' },
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
    name: 'self-edge',
    nodes: [p('a', 40, 40, { width: 120, height: 60 })],
    edges: [{ from: 'a', to: 'a', label: 'loop', id: 'self' }],
  },
];

const DANGLING_CASES: BuilderCase[] = [
  {
    name: 'ghost target',
    nodes: [p('a', 0, 0, { width: 120, height: 60 }), p('b', 300, 0, { width: 120, height: 60 })],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'ghost', label: 'dangling-target', id: 'e2' },
    ],
  },
  {
    name: 'ghost source',
    nodes: [p('a', 0, 0, { width: 120, height: 60 }), p('b', 300, 0, { width: 120, height: 60 })],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'ghost2', to: 'a', label: 'dangling-source', id: 'e3' },
    ],
  },
  {
    name: 'both endpoints ghost, no id/label',
    nodes: [p('a', 0, 0, { width: 120, height: 60 })],
    edges: [{ from: 'g1', to: 'g2' }],
  },
];

// --- (round-32-1) verbatim oracle: canonical builder == frozen legacy bodies ---

describe('v2 strategy edge builder — verbatim legacy oracle (round-32-1)', () => {
  const ALL_CASES = [...NO_DANGLING_CASES, ...DANGLING_CASES];

  it.each(ALL_CASES)('%s: canonical(with-id center replica shape) matches matrix/general', ({ nodes, edges }) => {
    expect(buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors))
      .toEqual(legacyCenterBuilderWithId(edges, nodes));
  });

  it.each(ALL_CASES)('%s: canonical matches timeline vertical replica', ({ nodes, edges }) => {
    const vertical = (source: PositionedNode, target: PositionedNode): EdgeAnchorPair => {
      const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
      const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
      const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
      return [
        { x: source.x + sw / 2, y: source.y + sh },
        { x: target.x + tw / 2, y: target.y },
      ];
    };
    expect(buildAnchoredLayoutEdges(edges, nodes, vertical))
      .toEqual(legacyTimelineBuilder(edges, nodes));
  });

  it.each(ALL_CASES)('%s: canonical matches comparison side replica', ({ nodes, edges }) => {
    const side = (source: PositionedNode, target: PositionedNode): EdgeAnchorPair => {
      const sourceIsLeft = source.x < target.x;
      const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
      const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
      const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
      const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
      return [
        { x: sourceIsLeft ? source.x + sw : source.x, y: source.y + sh / 2 },
        { x: sourceIsLeft ? target.x : target.x + tw, y: target.y + th / 2 },
      ];
    };
    expect(buildAnchoredLayoutEdges(edges, nodes, side))
      .toEqual(legacyComparisonBuilder(edges, nodes));
  });

  // cycle's replica only diverges when extents are absent (fallback 0 vs
  // DEFAULT) — equal on every explicit-extent case, dangling included.
  it.each(
    ALL_CASES.filter((c) => c.nodes.every((n) => n.width !== undefined && n.height !== undefined)),
  )('%s: canonical matches cycle replica (explicit extents)', ({ nodes, edges }) => {
    expect(buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors))
      .toEqual(legacyCycleBuilder(edges, nodes));
  });

  // concept/network replicas keep the id on present-endpoint edges — equal
  // there; their DANGLING divergence is pinned separately below.
  it.each(NO_DANGLING_CASES)('%s: canonical matches conceptmap/network replica (no dangling)', ({ nodes, edges }) => {
    expect(buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors))
      .toEqual(legacyCenterBuilderWithoutId(edges, nodes));
  });

  // mindmap's replica is point-identical when both endpoints are present and
  // finite — equal there; its two divergences are pinned below.
  it.each(NO_DANGLING_CASES)('%s: canonical matches mindmap replica (no dangling)', ({ nodes, edges }) => {
    expect(buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors))
      .toEqual(legacyMindmapBuilder(edges, nodes));
  });

  // --- the three pinned drifts: two-sided deltas (old value AND new value) ---

  it('DRIFT PIN (cycle): widthless extents — legacy anchored at x+0, canonical at x+DEFAULT/2', () => {
    const nodes = [p('a', 50, 60), p('b', 350, 260)];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
    const legacy = legacyCycleBuilder(edges, nodes);
    const canonical = buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors);
    // OLD (drift): fallback 0 → anchor at the raw corner.
    expect(legacy[0].points[0]).toEqual({ x: 50, y: 60 });
    // NEW (canonical): NaN-safe default extent.
    expect(canonical[0].points[0]).toEqual({
      x: 50 + DEFAULT_NODE_WIDTH / 2,
      y: 60 + DEFAULT_NODE_HEIGHT / 2,
    });
  });

  it('DRIFT PIN (conceptmap/network): dangling edge — legacy drops id, canonical keeps it', () => {
    const nodes = [p('a', 0, 0, { width: 120, height: 60 }), p('b', 300, 0, { width: 120, height: 60 })];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'ghost', label: 'dangling-target', id: 'e2' },
    ];
    const legacy = legacyCenterBuilderWithoutId(edges, nodes);
    const canonical = buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors);
    // OLD (drift): identity lost on the dangling edge only.
    expect(legacy[1].id).toBeUndefined();
    expect(legacy[0].id).toBeUndefined(); // absent on dangling; undefined on id-less input
    // NEW (canonical): id preserved verbatim wherever the input carried one.
    expect(canonical[1].id).toBe('e2');
    expect(canonical[1].points).toEqual([]);
    expect(canonical[1].label).toBe('dangling-target');
  });

  it('DRIFT PIN (mindmap): dangling edge — legacy emits phantom near-origin points, canonical emits none', () => {
    const nodes = [p('a', 0, 0, { width: 120, height: 60 }), p('b', 300, 0, { width: 120, height: 60 })];
    const edges: EdgeDatum[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'ghost', label: 'dangling-target', id: 'e2' },
    ];
    const legacy = legacyMindmapBuilder(edges, nodes);
    const canonical = buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors);
    // OLD (drift): two bogus points for the missing endpoint — a line to
    // (DEFAULT/2, DEFAULT/2) near the canvas corner.
    expect(legacy[1].points).toHaveLength(2);
    expect(legacy[1].points[1]).toEqual({
      x: DEFAULT_NODE_WIDTH / 2,
      y: DEFAULT_NODE_HEIGHT / 2,
    });
    // NEW (canonical): no geometry for unknown endpoints.
    expect(canonical[1].points).toEqual([]);
    expect(canonical[1].id).toBe('e2');
  });

  it('DRIFT PIN (mindmap): NaN width — legacy propagates NaN, canonical falls back', () => {
    const nodes = [
      p('a', 50, 60, { width: Number.NaN, height: 40 }),
      p('b', 350, 260, { width: 100, height: 40 }),
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
    const legacy = legacyMindmapBuilder(edges, nodes);
    const canonical = buildAnchoredLayoutEdges(edges, nodes, centerToCenterAnchors);
    expect(Number.isNaN(legacy[0].points[0].x)).toBe(true);
    expect(canonical[0].points[0].x).toBe(50 + DEFAULT_NODE_WIDTH / 2);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 material: delegation equality through the real strategies.
// ---------------------------------------------------------------------------

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
    name: 'cycle-4',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'a' },
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

// Test-local verbatim copies of the two strategy-specific anchor functions
// (timeline's verticalFlowAnchors / comparison's sideAnchorPair — not
// exported). Their GEOMETRY is source-anchored in round-32-4; these copies
// pin the skeleton delegation only.
function testVerticalAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
  const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
  const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
  return [
    { x: source.x + sw / 2, y: source.y + sh },
    { x: target.x + tw / 2, y: target.y },
  ];
}

function testSideAnchors(
  source: PositionedNode,
  target: PositionedNode,
): EdgeAnchorPair {
  const sourceIsLeft = source.x < target.x;
  const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
  const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
  const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
  const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
  return [
    { x: sourceIsLeft ? source.x + sw : source.x, y: source.y + sh / 2 },
    { x: sourceIsLeft ? target.x : target.x + tw, y: target.y + th / 2 },
  ];
}

// --- (round-32-2) delegation equality: apply().edges == canonical over apply().nodes ---

describe('v2 strategy edge builder — strategy delegation equality (round-32-2)', () => {
  const strategies: Array<{
    name: string;
    apply: (nodes: NodeDatum[], edges: EdgeDatum[]) => { nodes: PositionedNode[]; edges: LayoutEdge[] };
    anchor:
      | typeof centerToCenterAnchors
      | ((s: PositionedNode, t: PositionedNode) => EdgeAnchorPair);
  }> = [
    { name: 'matrix', apply: (n, e) => new MatrixStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'general', apply: (n, e) => new GeneralStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'cycle', apply: (n, e) => new CycleLayoutStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'conceptmap', apply: (n, e) => new ConceptMapStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'network', apply: (n, e) => new NetworkStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'mindmap', apply: (n, e) => new MindMapStrategy().apply(n, e), anchor: centerToCenterAnchors },
    { name: 'timeline', apply: (n, e) => new TimelineStrategy().apply(n, e), anchor: testVerticalAnchors },
    { name: 'comparison', apply: (n, e) => new ComparisonStrategy().apply(n, e), anchor: testSideAnchors },
  ];

  for (const { name: strategyName, apply, anchor } of strategies) {
    for (const { name, nodes, edges } of TOPOLOGIES) {
      it(`${strategyName}.apply() on ${name}: edges == canonical builder over its own nodes`, () => {
        const applied = apply(nodes, edges);
        expect(applied.edges).toEqual(buildAnchoredLayoutEdges(edges, applied.nodes, anchor));
      });
    }
  }

  it('the delegation corpus is real: at least one case produces anchored (non-empty) points everywhere', () => {
    const applied = new MatrixStrategy().apply(TOPOLOGIES[0].nodes, TOPOLOGIES[0].edges);
    expect(applied.edges).toHaveLength(2);
    expect(applied.edges[0].points).toHaveLength(2);
  });
});

// --- (round-32-3) unified dangling shape: the behavior-change witness ---

describe('v2 strategy edge builder — unified dangling shape (round-32-3)', () => {
  const strategies: Array<{ name: string; strategy: { apply: (n: NodeDatum[], e: EdgeDatum[]) => { edges: LayoutEdge[] } } }> = [
    { name: 'matrix', strategy: new MatrixStrategy() },
    { name: 'general', strategy: new GeneralStrategy() },
    { name: 'cycle', strategy: new CycleLayoutStrategy() },
    { name: 'conceptmap', strategy: new ConceptMapStrategy() },
    { name: 'network', strategy: new NetworkStrategy() },
    { name: 'mindmap', strategy: new MindMapStrategy() },
    { name: 'timeline', strategy: new TimelineStrategy() },
    { name: 'comparison', strategy: new ComparisonStrategy() },
  ];

  const nodes: NodeDatum[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const edges: EdgeDatum[] = [
    { id: 'ok', from: 'a', to: 'b', label: 'valid' },
    { id: 'drop-target', from: 'b', to: 'ghost', label: 'dangling-target' },
    { id: 'drop-source', from: 'ghost2', to: 'c', label: 'dangling-source' },
  ];

  it.each(strategies)('%s: dangling edges are exactly {from,to,points:[],label,id}', ({ strategy }) => {
    const applied = strategy.apply(nodes, edges);
    expect(applied.edges).toHaveLength(3);

    const valid = applied.edges.find((e) => e.id === 'ok')!;
    expect(valid.points).toHaveLength(2);

    for (const id of ['drop-target', 'drop-source']) {
      const dangling = applied.edges.find((e) => e.id === id)!;
      expect(dangling.points).toEqual([]);
      expect(dangling.id).toBe(id);
      expect(dangling.label).toBe(id === 'drop-target' ? 'dangling-target' : 'dangling-source');
      expect(dangling.from).toBeDefined();
      expect(dangling.to).toBeDefined();
    }
  });
});

// --- (round-32-4) source anchors: canonical shapes + delegation, no re-rolls ---

describe('v2 strategy edge builder — source anchors (round-32-4)', () => {
  const CANONICAL = 'src/visualization/strategy-edges.ts';
  const STRATEGY_FILES = [
    'src/visualization/strategies/matrix-strategy.ts',
    'src/visualization/strategies/general-strategy.ts',
    'src/visualization/strategies/cycle-strategy.ts',
    'src/visualization/strategies/conceptmap-strategy.ts',
    'src/visualization/strategies/network-strategy.ts',
    'src/visualization/strategies/mindmap-strategy.ts',
    'src/visualization/strategies/timeline-strategy.ts',
    'src/visualization/strategies/comparison-strategy.ts',
  ];

  it('the canonical file holds the frozen skeleton shapes', () => {
    const src = readSource(CANONICAL);
    // nodeMap lookup for both endpoints.
    expect(src).toMatch(/nodeMap\.get\(edge\.from\)/);
    expect(src).toMatch(/nodeMap\.get\(edge\.to\)/);
    // the dangling fallback: empty points, identity preserved.
    expect(src).toMatch(/points:\s*\[\],\s*\n\s*label:\s*edge\.label,\s*\n\s*id:\s*edge\.id,/);
    // anchored return: exactly the anchor pair, identity preserved.
    expect(src).toMatch(/points:\s*\[sourcePoint,\s*targetPoint\]/);
    // the anchor seam.
    expect(src).toMatch(/anchorPair\(source,\s*target\)/);
    // NaN-safe center anchors via node-dimensions with DEFAULT extents.
    expect(src).toMatch(/getNodeWidth\(source,\s*DEFAULT_NODE_WIDTH\)/);
    expect(src).toMatch(/getNodeHeight\(target,\s*DEFAULT_NODE_HEIGHT\)/);
  });

  it.each(STRATEGY_FILES)('%s delegates and re-rolls neither fallback nor assembly', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/buildAnchoredLayoutEdges\(/);
    // the skeleton shapes are gone from every strategy file. (network's
    // force-directed PHYSICS still reads `nodeMap.get(edge.from)` for edge
    // attraction — a different concept, NOT banned; the fallback/assembly
    // shapes below are what a re-rolled builder cannot avoid emitting.)
    expect(src).not.toMatch(/points:\s*\[\]\s*,?\s*\n/);
    expect(src).not.toMatch(/label:\s*edge\.label/);
    expect(src).not.toMatch(/id:\s*edge\.id/);
  });

  it('timeline keeps its vertical-flow anchor geometry in place', () => {
    const src = readSource('src/visualization/strategies/timeline-strategy.ts');
    // source bottom-center (bare source.y + sh), target top-center (bare target.y).
    expect(src).toMatch(/\{\s*x:\s*source\.x\s*\+\s*sw\s*\/\s*2,\s*y:\s*source\.y\s*\+\s*sh\s*\}/);
    expect(src).toMatch(/\{\s*x:\s*target\.x\s*\+\s*tw\s*\/\s*2,\s*y:\s*target\.y\s*\}/);
  });

  it('comparison keeps its side-anchor geometry in place', () => {
    const src = readSource('src/visualization/strategies/comparison-strategy.ts');
    expect(src).toMatch(/sourceIsLeft\s*\?\s*source\.x\s*\+\s*sw\s*:\s*source\.x/);
    expect(src).toMatch(/sourceIsLeft\s*\?\s*target\.x\s*:\s*target\.x\s*\+\s*tw/);
  });

  it('the dagre trio and the engine family are NOT swept into this family (scope pin)', () => {
    // Round 30 owns the dagre trio's edge extraction; the v1 engine family's
    // `{ ...edge, points: [] }` spread fallback is a different contract. If
    // either is ever migrated onto this builder, that is a deliberate
    // cross-family change and must update this pin consciously.
    for (const file of [
      'src/visualization/strategies/flow-strategy.ts',
      'src/visualization/dagre-pipeline.ts',
    ]) {
      expect(readSource(file)).not.toMatch(/buildAnchoredLayoutEdges/);
    }
  });
});
