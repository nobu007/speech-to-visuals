/**
 * @jest-environment node
 */
/**
 * dagre-node-extraction-single-source.test.ts — round 36.
 *
 * Family: the v1 dagre center→top-left node extraction. Four sites carried a
 * byte-identical block (diff-verified at 217fada6):
 *
 *   const positionedNodes: PositionedNode[] = nodes.map(node => {
 *     const dagreNode = g.node(node.id);
 *     return {
 *       ...node,
 *       x: dagreNode.x - dagreNode.width / 2,
 *       y: dagreNode.y - dagreNode.height / 2,
 *       w: dagreNode.width,
 *       h: dagreNode.height
 *     };
 *   });
 *
 *   - strategies/DagreLayoutStrategy.ts   (applyLayout)
 *   - strategies/FlowchartLayoutStrategy.ts (generateLayout)
 *   - enhanced-zero-overlap-layout.ts generateFlowchartLayout
 *   - enhanced-zero-overlap-layout.ts generateTreeLayout
 *
 * Round 30 single-sourced the v2 pipeline and left these alone on purpose:
 * the v1 shape echoes the extents DAGRE assigned (not a node-dimensions
 * re-read) and emits the deprecated `w`/`h` fields — a genuinely different
 * conversion contract that must stay separate from dagre-pipeline.ts (the
 * do-not-merge boundary is pinned in layer 4). Round 36 single-sources the
 * v1 shape on its own terms: canonical positionedFromDagre in
 * src/visualization/dagre-node-extraction.ts, body moved VERBATIM — zero
 * behavior delta by construction. The ezo sites are live render paths (the
 * simple pipeline instantiates EnhancedZeroOverlapLayoutEngine), so a drifted
 * re-roll at one site corrupts only that engine's diagram type while every
 * other site and shared fixture stays green — the latent-desync shape this
 * campaign freezes.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-36 body, frozen below, stays deep-equal
 *      to the canonical export over real laid-out dagre graphs (per-site
 *      configs) and over stub graphs with degenerate geometry.
 *   2. DELEGATION EQUALITY — each of the four LIVE sites equals its frozen
 *      legacy pipeline replica (graph build + filter + layout + the frozen
 *      extraction + that site's edge extraction) over a topology corpus.
 *      This pins each site's graph inputs AND proves the migration changed
 *      nothing end-to-end.
 *   3. CONTRACT WITNESSES — top-left conversion arithmetic, extents echoed
 *      from DAGRE (not from the input node's own width/height fields — the
 *      v1-vs-v2 boundary), new objects / inputs unmutated, order and
 *      duplicates preserved.
 *   4. SOURCE ANCHORS — one canonical declaration; the four sites delegate
 *      and roll no private copy; the v2 dagre-pipeline keeps its DIFFERENT
 *      shape and does not call the v1 canonical.
 *
 * The "no site re-rolls the extraction" discovery sweep lives in the shared
 * registry (round-36 entry in
 * tests/guards/frozen-literal-families/dagre-node-extraction.ts); this file
 * holds the behavioral pins.
 *
 * Mutations RED-verified at round 36 (all against THIS file + the registry):
 *   M1 canonical `- dagreNode.width / 2` → `- dagreNode.width` — oracle AND
 *      all four delegation replicas fail (half-extent offset).
 *   M2 FlowchartLayoutStrategy re-freezes the inline block at its call site —
 *      registry sweep + layer-4 anchors fail.
 *   M3 canonical echoes input dims instead of dagre's (`w: node.width ?? …`)
 *      — oracle fails on the explicit-dims corpus case; layer-3 witness fails
 *      on the stub graph.
 *   M4 registry pattern written as multi-line regex — never matches the
 *      line-based walk (r135 lesson); patterns here are single-line.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as unknown as { default?: typeof dagreLib }).default ?? dagreLib;
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
  DEFAULT_MARGIN,
} from '@/visualization/layout-spacing';
import { strategyNodeWidth } from '@/visualization/strategy-common';
import { getGraphConfig, calculateNodeWidth, calculateNodeHeight, resolveNodeWidth, resolveNodeHeight, generateEdgePoints } from '@/visualization/layout-utils';
import { positionedFromDagre } from '@/visualization/dagre-node-extraction';
import type { LayoutConfig } from '@/visualization/types';
import { DagreLayoutStrategy } from '@/visualization/strategies/DagreLayoutStrategy';
import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import { FlowchartLayoutStrategy } from '@/visualization/strategies/FlowchartLayoutStrategy';
import { EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';

const CANONICAL = 'src/visualization/dagre-node-extraction.ts';
const SITES = [
  'src/visualization/strategies/DagreLayoutStrategy.ts',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
] as const;
const V2_CANONICAL = 'src/visualization/dagre-pipeline.ts';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-36 body, frozen from the four
// byte-identical sites @ 217fada6. Do not "improve" this copy: its job is to
// be the OLD behavior, not good behavior.
// ---------------------------------------------------------------------------

/** Structural stand-in accepted by the frozen body (real graphs satisfy it). */
interface GraphLike {
  node(id: string): { x: number; y: number; width: number; height: number };
}

function legacyPositionedFromDagre(g: GraphLike, nodes: NodeDatum[]): PositionedNode[] {
  return nodes.map(node => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      x: dagreNode.x - dagreNode.width / 2,
      y: dagreNode.y - dagreNode.height / 2,
      w: dagreNode.width,
      h: dagreNode.height
    };
  });
}

// ---------------------------------------------------------------------------
// Topology corpus: chain, branching tree, cycle + isolated node, long labels,
// explicit dims, dangling edges (TC-307), duplicate ids, single node.
// ---------------------------------------------------------------------------

const CORPUS: ReadonlyArray<readonly [string, NodeDatum[], EdgeDatum[]]> = [
  ['chain a→b→c→d',
    [{ id: 'a', label: 'Start' }, { id: 'b', label: 'Fetch' }, { id: 'c', label: 'Render' }, { id: 'd', label: 'End' }],
    [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }]],
  ['branching tree (1-2-4)',
    [{ id: 'root', label: 'Root' }, { id: 'l', label: 'Left' }, { id: 'r', label: 'Right' },
     { id: 'l1', label: 'L1' }, { id: 'l2', label: 'L2' }, { id: 'r1', label: 'R1' }, { id: 'r2', label: 'R2' }],
    [{ from: 'root', to: 'l' }, { from: 'root', to: 'r' },
     { from: 'l', to: 'l1' }, { from: 'l', to: 'l2' }, { from: 'r', to: 'r1' }, { from: 'r', to: 'r2' }]],
  ['cycle + isolated node',
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'iso', label: 'Island' }],
    [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }]],
  ['long CJK labels widen extents',
    [{ id: 'wide', label: '音声から図解動画を自動生成するシステムの構成要素' }, { id: 'narrow', label: 'x' }],
    [{ from: 'wide', to: 'narrow' }]],
  ['explicit dims (round 37: ezo sizes explicit-first like every consumer)',
    [{ id: 'e1', label: 'E', width: 260, height: 90 }, { id: 'e2', label: 'F' }],
    [{ from: 'e1', to: 'e2' }]],
  ['dangling edges filtered before dagre (TC-307)',
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    [{ from: 'a', to: 'b' }, { from: 'ghost', to: 'a' }, { from: 'b', to: 'phantom' }]],
  ['duplicate ids keep both entries',
    [{ id: 'dup', label: 'first' }, { id: 'dup', label: 'last' }, { id: 'solo', label: 'S' }],
    [{ from: 'dup', to: 'solo' }]],
  ['single node, no edges',
    [{ id: 'only', label: 'Only' }], []],
];

// ---------------------------------------------------------------------------
// Per-site frozen legacy pipeline replicas (graph build + TC-307 filter +
// layout + the frozen extraction + that site's OWN edge extraction). These
// pin each site's dagre INPUTS (graph config, dims source, label wiring) —
// value pins for the configs live here, not in the registry.
// ---------------------------------------------------------------------------

const LAYOUT_CONFIG: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: DEFAULT_NODE_WIDTH,
  nodeHeight: DEFAULT_NODE_HEIGHT,
  marginX: 40,
  marginY: 40,
  rankDirection: 'TB',
  nodeSeparation: DEFAULT_NODE_SEPARATION,
  edgeSeparation: DEFAULT_EDGE_SEPARATION,
  rankSeparation: DEFAULT_RANK_SEPARATION,
};

function safeEdgeFilter(nodes: NodeDatum[], edges: EdgeDatum[]): EdgeDatum[] {
  const nodeIds = new Set(nodes.map(node => node.id));
  return edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
}

/** Replica of DagreLayoutStrategy.applyLayout's dagre section (flow config). */
function legacyDagreLayoutStrategy(nodes: NodeDatum[], edges: EdgeDatum[]): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph(getGraphConfig('flow', LAYOUT_CONFIG));
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(node => {
    g.setNode(node.id, {
      label: node.label,
      width: strategyNodeWidth(node, LAYOUT_CONFIG),
      height: LAYOUT_CONFIG.nodeHeight
    });
  });
  const safeEdges = safeEdgeFilter(nodes, edges);
  safeEdges.forEach(edge => {
    g.setEdge(edge.from, edge.to, { label: edge.label || '' });
  });
  dagre.layout(g);
  const positionedNodes = legacyPositionedFromDagre(g, nodes);
  const layoutEdges: LayoutEdge[] = safeEdges.map(edge => {
    const dagreEdge = g.edge(edge.from, edge.to);
    return {
      from: edge.from,
      to: edge.to,
      points: dagreEdge.points || [
        { x: g.node(edge.from).x, y: g.node(edge.from).y },
        { x: g.node(edge.to).x, y: g.node(edge.to).y }
      ],
      label: edge.label
    };
  });
  return { nodes: positionedNodes, edges: layoutEdges };
}

/** Replica of FlowchartLayoutStrategy.generateLayout's dagre section (TB). */
function legacyFlowchartLayoutStrategy(nodes: NodeDatum[], edges: EdgeDatum[]): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    ranksep: LAYOUT_CONFIG.rankSeparation || DEFAULT_RANK_SEPARATION,
    nodesep: LAYOUT_CONFIG.nodeSeparation || DEFAULT_NODE_SEPARATION,
    edgesep: LAYOUT_CONFIG.edgeSeparation || DEFAULT_EDGE_SEPARATION,
    marginx: LAYOUT_CONFIG.marginX || DEFAULT_MARGIN,
    marginy: LAYOUT_CONFIG.marginY || DEFAULT_MARGIN,
    align: 'UL'
  });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(node => {
    const width = strategyNodeWidth(node, LAYOUT_CONFIG);
    const height = LAYOUT_CONFIG.nodeHeight || DEFAULT_NODE_HEIGHT;
    g.setNode(node.id, { label: node.label, width, height });
  });
  const safeEdges = safeEdgeFilter(nodes, edges);
  safeEdges.forEach(edge => {
    g.setEdge(edge.from, edge.to, { label: edge.label || '' });
  });
  dagre.layout(g);
  const positionedNodes = legacyPositionedFromDagre(g, nodes);
  const layoutEdges: LayoutEdge[] = safeEdges.map(edge => {
    const dagreEdge = g.edge(edge.from, edge.to);
    const sourceNode = g.node(edge.from);
    const targetNode = g.node(edge.to);
    const points = dagreEdge?.points || [
      { x: sourceNode.x, y: sourceNode.y },
      { x: targetNode.x, y: targetNode.y }
    ];
    return { from: edge.from, to: edge.to, points, label: edge.label };
  });
  return { nodes: positionedNodes, edges: layoutEdges };
}

/** ezo ctor defaults pinned here (value pins — graph inputs of the two ezo sites). */
const EZO_MIN_SPACING = { nodeToNode: 40, nodeToEdge: 20 } as const;
const ezoDimsConfig = { nodeWidth: DEFAULT_NODE_WIDTH, nodeHeight: DEFAULT_NODE_HEIGHT };

function legacyEzoDagrePath(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  graphConfig: { rankdir: 'TB' | 'LR'; ranksep: number; nodesep: number; marginx: number; marginy: number },
): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: graphConfig.rankdir,
    ranksep: graphConfig.ranksep,
    nodesep: graphConfig.nodesep,
    edgesep: EZO_MIN_SPACING.nodeToEdge,
    marginx: graphConfig.marginx,
    marginy: graphConfig.marginy
  });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(node => {
    // Round 37: the live ezo sites moved from the raw label-driven estimate
    // to the canonical explicit-first resolveNodeWidth/resolveNodeHeight
    // (layout-utils). This replica pins the dagre EXTRACTION contract, not
    // the sizing decision (that has its own family guard,
    // ezo-explicit-dimension-sizing.test.ts), so it follows the migration.
    const width = resolveNodeWidth(node, ezoDimsConfig);
    const height = resolveNodeHeight(node, ezoDimsConfig);
    g.setNode(node.id, { width, height, label: node.label });
  });
  const nodeIds = new Set(nodes.map(n => n.id));
  edges
    .filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .forEach(edge => {
      g.setEdge(edge.from, edge.to);
    });
  dagre.layout(g);
  const positionedNodes = legacyPositionedFromDagre(g, nodes);
  const layoutEdges: LayoutEdge[] = edges
    .flatMap(edge => {
      const source = positionedNodes.find(n => n.id === edge.from);
      const target = positionedNodes.find(n => n.id === edge.to);
      if (!source || !target) {
        return [];
      }
      return [{ ...edge, points: generateEdgePoints(source, target) }];
    });
  return { nodes: positionedNodes, edges: layoutEdges };
}

/** Stub graph: exact geometry control for the oracle degenerate cases. */
function stubGraph(entries: Record<string, { x: number; y: number; width: number; height: number }>): GraphLike {
  return { node: (id: string) => entries[id] };
}

type EzoPrivate = {
  generateFlowchartLayout(nodes: NodeDatum[], edges: EdgeDatum[]): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }>;
  generateTreeLayout(nodes: NodeDatum[], edges: EdgeDatum[]): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }>;
};

describe('round 36: v1 dagre node extraction single source', () => {
  describe('layer 1 — verbatim oracle (canonical ≡ frozen pre-round-36 body)', () => {
    const GRAPH_BUILDERS: ReadonlyArray<readonly [string, (nodes: NodeDatum[], edges: EdgeDatum[]) => GraphLike]> = [
      ['real dagre, DagreLayoutStrategy flow config', (nodes, edges) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph(getGraphConfig('flow', LAYOUT_CONFIG));
        g.setDefaultEdgeLabel(() => ({}));
        nodes.forEach(node => g.setNode(node.id, { label: node.label, width: strategyNodeWidth(node, LAYOUT_CONFIG), height: LAYOUT_CONFIG.nodeHeight }));
        const safeEdges = safeEdgeFilter(nodes, edges);
        safeEdges.forEach(edge => g.setEdge(edge.from, edge.to, { label: edge.label || '' }));
        dagre.layout(g);
        return g as unknown as GraphLike;
      }],
      ['real dagre, FlowchartLayoutStrategy TB config', (nodes, edges) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: 'TB', ranksep: DEFAULT_RANK_SEPARATION, nodesep: DEFAULT_NODE_SEPARATION, edgesep: DEFAULT_EDGE_SEPARATION, marginx: DEFAULT_MARGIN, marginy: DEFAULT_MARGIN, align: 'UL' });
        g.setDefaultEdgeLabel(() => ({}));
        nodes.forEach(node => g.setNode(node.id, { label: node.label, width: strategyNodeWidth(node, LAYOUT_CONFIG), height: DEFAULT_NODE_HEIGHT }));
        const safeEdges = safeEdgeFilter(nodes, edges);
        safeEdges.forEach(edge => g.setEdge(edge.from, edge.to, { label: edge.label || '' }));
        dagre.layout(g);
        return g as unknown as GraphLike;
      }],
      ['real dagre, ezo tree LR config (ranksep 3×, nodesep 2×)', (nodes, edges) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: 'LR', ranksep: EZO_MIN_SPACING.nodeToNode * 3, nodesep: EZO_MIN_SPACING.nodeToNode * 2, edgesep: EZO_MIN_SPACING.nodeToEdge, marginx: 30, marginy: 30 });
        g.setDefaultEdgeLabel(() => ({}));
        nodes.forEach(node => g.setNode(node.id, { label: node.label, width: calculateNodeWidth(node, ezoDimsConfig), height: calculateNodeHeight(node, ezoDimsConfig) }));
        const nodeIds = new Set(nodes.map(n => n.id));
        edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)).forEach(edge => g.setEdge(edge.from, edge.to));
        dagre.layout(g);
        return g as unknown as GraphLike;
      }],
      ['stub graph, fractional centers / zero / huge extents', (nodes) => {
        // Deterministic per-id geometry covering fractional centers, zero
        // extents and huge extents — ids outside the corpus are impossible
        // here because the stub is built from THIS corpus's nodes.
        const entries: Record<string, { x: number; y: number; width: number; height: number }> = {};
        nodes.forEach((node, i) => {
          entries[node.id] = [
            { x: 100.25, y: -33.75, width: 40, height: 20 },
            { x: 0, y: 0, width: 0, height: 0 },
            { x: 1e6, y: -1e6, width: 1e4, height: 1e3 },
          ][i % 3];
        });
        return stubGraph(entries);
      }],
    ];

    for (const [builderName, build] of GRAPH_BUILDERS) {
      for (const [caseName, nodes, edges] of CORPUS) {
        it(`${builderName}: ${caseName}`, () => {
          const g = build(nodes, edges);
          expect(positionedFromDagre(g, nodes)).toEqual(legacyPositionedFromDagre(g, nodes));
        });
      }
    }
  });

  describe('layer 2 — delegation equality (live sites ≡ frozen legacy replicas)', () => {
    const dagreStrategy = new DagreLayoutStrategy(LAYOUT_CONFIG, new FallbackLayoutStrategy(LAYOUT_CONFIG));
    const flowchartStrategy = new FlowchartLayoutStrategy();
    const ezo = new EnhancedZeroOverlapLayoutEngine() as unknown as EzoPrivate;

    for (const [caseName, nodes, edges] of CORPUS) {
      it(`DagreLayoutStrategy.applyLayout ≡ replica: ${caseName}`, async () => {
        const live = await dagreStrategy.applyLayout(nodes, edges, 'flow');
        expect(live).toEqual(legacyDagreLayoutStrategy(nodes, edges));
      });

      it(`FlowchartLayoutStrategy.generateLayout ≡ replica: ${caseName}`, async () => {
        const live = await flowchartStrategy.generateLayout(nodes, edges, LAYOUT_CONFIG);
        expect(live).toEqual(legacyFlowchartLayoutStrategy(nodes, edges));
      });

      it(`ezo generateFlowchartLayout ≡ replica: ${caseName}`, async () => {
        const live = await ezo.generateFlowchartLayout(nodes, edges);
        expect(live).toEqual(legacyEzoDagrePath(nodes, edges, {
          rankdir: 'TB',
          ranksep: EZO_MIN_SPACING.nodeToNode * 2,
          nodesep: EZO_MIN_SPACING.nodeToNode,
          marginx: 20,
          marginy: 20,
        }));
      });

      it(`ezo generateTreeLayout ≡ replica: ${caseName}`, async () => {
        const live = await ezo.generateTreeLayout(nodes, edges);
        expect(live).toEqual(legacyEzoDagrePath(nodes, edges, {
          rankdir: 'LR',
          ranksep: EZO_MIN_SPACING.nodeToNode * 3,
          nodesep: EZO_MIN_SPACING.nodeToNode * 2,
          marginx: 30,
          marginy: 30,
        }));
      });
    }
  });

  describe('layer 3 — contract witnesses', () => {
    it('top-left conversion: x = center − width/2, y = center − height/2', () => {
      const g = stubGraph({ n: { x: 100, y: 50, width: 40, height: 20 } });
      const [node] = positionedFromDagre(g, [{ id: 'n', label: 'N' }]);
      expect(node.x).toBe(80);
      expect(node.y).toBe(40);
    });

    it('extents echo DAGRE, never the input node fields (v1-vs-v2 boundary)', () => {
      const g = stubGraph({ n: { x: 100, y: 50, width: 40, height: 20 } });
      const [node] = positionedFromDagre(g, [{ id: 'n', label: 'N', width: 999, height: 999 }]);
      expect(node.w).toBe(40);
      expect(node.h).toBe(20);
      // …while the spread still carries the input's own fields untouched —
      // the deprecated w/h vs width/height divergence is the CONTRACT, not a
      // bug to "fix" here (getNodeWidth reads width first).
      expect(node.width).toBe(999);
      expect(node.height).toBe(999);
    });

    it('fractional centers pass through unrounded', () => {
      const g = stubGraph({ n: { x: 33.333, y: -7.5, width: 3, height: 3 } });
      const [node] = positionedFromDagre(g, [{ id: 'n', label: 'N' }]);
      expect(node.x).toBe(33.333 - 1.5);
      expect(node.y).toBe(-7.5 - 1.5);
    });

    it('new array + new element objects; inputs are not mutated', () => {
      const g = stubGraph({ n: { x: 10, y: 10, width: 4, height: 4 } });
      const input: NodeDatum[] = [{ id: 'n', label: 'N' }];
      const out = positionedFromDagre(g, input);
      expect(out).not.toBe(input);
      expect(out[0]).not.toBe(input[0]);
      out[0].x = 12345;
      expect(input[0]).toEqual({ id: 'n', label: 'N' });
    });

    it('order, length, duplicate ids and every declared field preserved', () => {
      const g = stubGraph({
        a: { x: 1, y: 2, width: 3, height: 4 },
        b: { x: 5, y: 6, width: 7, height: 8 },
      });
      const input: NodeDatum[] = [
        { id: 'a', label: 'A', type: 'step', meta: { importance: 3 } },
        { id: 'a', label: 'A2' },
        { id: 'b', label: 'B' },
      ];
      const out = positionedFromDagre(g, input);
      expect(out.map(n => n.id)).toEqual(['a', 'a', 'b']);
      expect(out[0].type).toBe('step');
      expect(out[0].meta).toEqual({ importance: 3 });
      // duplicate ids each read the same geometry (copy, not normalization);
      // their INPUT fields stay their own, so only the geometry matches
      expect(out[0].x).toBe(out[1].x);
      expect(out[0].y).toBe(out[1].y);
      expect(out[0].w).toBe(out[1].w);
      expect(out[0].h).toBe(out[1].h);
      expect(out[1].label).toBe('A2');
    });
  });

  describe('layer 4 — source anchors', () => {
    it('the canonical file holds exactly one extraction, verbatim shape', () => {
      const src = readSource(CANONICAL);
      expect(src.match(/dagreNode\.x\s*-\s*dagreNode\.width\s*\/\s*2/g)?.length).toBe(1);
      expect(src).toContain('export function positionedFromDagre(');
      expect(src).toContain('w: dagreNode.width,');
      expect(src).toContain('h: dagreNode.height');
    });

    it.each(SITES)('%s delegates and rolls no private extraction', (file) => {
      const src = readSource(file);
      expect(src).not.toMatch(/dagreNode\.x\s*-\s*dagreNode\.width\s*\/\s*2/); // no re-freeze
      expect(src).not.toMatch(/w:\s*dagreNode\.width\s*,/);
      expect(src).toContain('positionedFromDagre(g, nodes)');
    });

    it('call-site counts: Dagre 1, Flowchart 1, ezo 2', () => {
      expect(readSource(SITES[0]).match(/positionedFromDagre\(g, nodes\)/g)?.length).toBe(1);
      expect(readSource(SITES[1]).match(/positionedFromDagre\(g, nodes\)/g)?.length).toBe(1);
      expect(readSource(SITES[2]).match(/positionedFromDagre\(g, nodes\)/g)?.length).toBe(2);
    });

    it('the v2 dagre-pipeline keeps its DIFFERENT shape and does not call the v1 canonical', () => {
      const src = readSource(V2_CANONICAL);
      expect(src).toContain('x: dagreNode.x - w / 2,'); // node-dimensions re-read shape
      expect(src).not.toContain('positionedFromDagre');
    });
  });
});
