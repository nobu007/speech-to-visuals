/**
 * @jest-environment node
 */
/**
 * dagre-pipeline-single-source.test.ts — round 30.
 *
 * Family: the ENTIRE dagre layout pipeline (graphlib graph construction, the
 * TC-307 dangling-edge filter, dagre.layout, center→top-left node extraction,
 * edge-point extraction with its straight-line `??` fallback) was pasted
 * byte-identical — modulo per-diagram graph config — into the three
 * dagre-based registered strategies (flow LR 50/80, tree TB 60/100,
 * flowchart TB 50/70). Canonical since round 30: runDagrePipeline in
 * src/visualization/dagre-pipeline.ts.
 *
 * DRIFT SCENARIO this guard defends against: a re-rolled or edited copy at
 * ONE strategy corrupts only that diagram type — `x: dagreNode.x - w` instead
 * of `- w / 2` shifts every node by half its extent; a dropped `.has(to)`
 * re-opens TC-307 phantom nodes; a dropped `??` fallback emits
 * `points: undefined` — while the other diagram types and every shared-fixture
 * test stay green.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-30 inline body, frozen below, must
 *      produce deep-equal output to runDagrePipeline over a topology corpus ×
 *      the three real strategy configs. Any mutation of the canonical
 *      pipeline shape (operator, operand, filter side, fallback, spread)
 *      diverges here.
 *   2. DELEGATION EQUALITY — each strategy's apply() must equal the canonical
 *      pipeline composed with canvas/metrics for its OWN config (value pins
 *      for rankdir/nodesep/ranksep live here, not in the registry) whenever
 *      the dagre result is overlap-free; when it is NOT (flow on mixed-extent
 *      inputs — empirically reachable), flow/tree must take their own
 *      grid-snap fallback instead, and flowchart must return the dagre result
 *      unconditionally. Both branches are pinned.
 *   3. SOURCE ANCHORS — the canonical file holds the frozen shapes; each
 *      strategy delegates and rolls no private graph; flow/tree keep the
 *      overlap-fallback wiring after metrics.
 *
 * The "no site re-rolls the extraction shapes" discovery sweep lives in the
 * shared registry (tests/guards/frozen-literal-rules.ts, round-30 entry);
 * this file holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import * as dagreLib from '@dagrejs/dagre';
const dagre = (dagreLib as unknown as { default?: typeof dagreLib }).default ?? dagreLib;
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';
import { runDagrePipeline } from '@/visualization/dagre-pipeline';
import { FlowStrategy } from '@/visualization/strategies/flow-strategy';
import { TreeStrategy } from '@/visualization/strategies/tree-strategy';
import { FlowchartStrategy } from '@/visualization/strategies/flowchart-strategy';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-30 inline pipeline (frozen from
// flow-strategy.ts @ 6d9554ee — the byte-identical member of the trio). Do not
// "improve" this copy: its job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

interface PipelineConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
}

function legacyInlineDagrePipeline(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  config: PipelineConfig,
): { positionedNodes: PositionedNode[]; safeEdges: EdgeDatum[]; layoutEdges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: config.rankdir,
    nodesep: config.nodesep,
    ranksep: config.ranksep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
    const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
    g.setNode(node.id, { width: w, height: h, label: node.label });
  }

  // Filter edges whose endpoints are not in the input node set BEFORE handing
  // them to dagre. dagre auto-creates phantom nodes for unknown edge
  // endpoints, corrupting the layout and emitting edges that point at
  // non-existent nodes. Mirrors the f178cbf hardening in
  // enhanced-zero-overlap-layout.ts.
  const nodeIds = new Set(nodes.map((node) => node.id));
  const safeEdges = edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  for (const edge of safeEdges) {
    g.setEdge(edge.from, edge.to, { label: edge.label ?? '' });
  }

  dagre.layout(g);

  const positionedNodes: PositionedNode[] = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
    const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT);
    return {
      ...node,
      x: dagreNode.x - w / 2,
      y: dagreNode.y - h / 2,
      width: w,
      height: h,
    };
  });

  const layoutEdges: LayoutEdge[] = safeEdges.map((edge) => {
    const dagreEdge = g.edge(edge.from, edge.to);
    return {
      from: edge.from,
      to: edge.to,
      points: dagreEdge.points ?? [
        { x: g.node(edge.from).x, y: g.node(edge.from).y },
        { x: g.node(edge.to).x, y: g.node(edge.to).y },
      ],
      label: edge.label,
      id: edge.id,
    };
  });

  return { positionedNodes, safeEdges, layoutEdges };
}

// ---------------------------------------------------------------------------
// Corpus: fixed topologies (deterministic — no randomness, per repo test
// convention). Each exercises a different pipeline facet.
// ---------------------------------------------------------------------------

const TOPOLOGIES: Array<{ name: string; nodes: NodeDatum[]; edges: EdgeDatum[] }> = [
  {
    name: 'chain-3 (plain extents from short labels)',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  },
  {
    name: 'star-5 (hub and spokes)',
    nodes: [
      { id: 'hub', label: 'Hub' },
      { id: 's1', label: 'Spoke 1' },
      { id: 's2', label: 'Spoke 2' },
      { id: 's3', label: 'Spoke 3' },
      { id: 's4', label: 'Spoke 4' },
    ],
    edges: [
      { from: 'hub', to: 's1' },
      { from: 'hub', to: 's2' },
      { from: 'hub', to: 's3' },
      { from: 'hub', to: 's4' },
    ],
  },
  {
    name: 'cycle-4 (rank crossover)',
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
    name: 'dangling-edges (TC-307 filter: ghost source AND ghost target)',
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
    name: 'single-node-no-edges',
    nodes: [{ id: 'only', label: 'Only' }],
    edges: [],
  },
  {
    name: 'isolated-nodes-no-edges',
    nodes: [
      { id: 'i1', label: 'I1' },
      { id: 'i2', label: 'I2' },
      { id: 'i3', label: 'I3' },
    ],
    edges: [],
  },
  {
    name: 'explicit-extents (NodeDatum width/height drive every extent)',
    nodes: [
      { id: 'wide', label: 'Wide', width: 400, height: 120 },
      { id: 'tall', label: 'Tall', width: 80, height: 320 },
      { id: 'norm', label: 'Norm' },
    ],
    edges: [
      { from: 'wide', to: 'tall' },
      { from: 'tall', to: 'norm', label: 'labeled' },
    ],
  },
  {
    name: 'long-cjk-labels (extent computed from label length)',
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
    name: 'mixed-label-presence (?? label normalization on setEdge)',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    edges: [
      { from: 'a', to: 'b', label: 'has-label' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd', label: undefined },
      { from: 'a', to: 'd', id: 'e-with-id' },
    ],
  },
  {
    name: 'duplicate-edge (same endpoints twice)',
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
    name: 'big-explicit-extents-chain-20',
    nodes: Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      width: 500,
      height: 300,
    })),
    edges: Array.from({ length: 19 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
    })),
  },
];

/** The three real strategy configs — value pins (drift = different layout). */
const STRATEGY_CONFIGS: Array<{
  strategy: 'flow' | 'tree' | 'flowchart';
  config: PipelineConfig;
}> = [
  { strategy: 'flow', config: { rankdir: 'LR', nodesep: 50, ranksep: 80 } },
  { strategy: 'tree', config: { rankdir: 'TB', nodesep: 60, ranksep: 100 } },
  { strategy: 'flowchart', config: { rankdir: 'TB', nodesep: 50, ranksep: 70 } },
];

// --- (round-30-1) verbatim oracle: canonical pipeline == frozen inline body ---

describe('dagre pipeline single source — verbatim legacy oracle (round-30-1)', () => {
  for (const { name, nodes, edges } of TOPOLOGIES) {
    for (const { strategy, config } of STRATEGY_CONFIGS) {
      it(`${name} × ${strategy} config: runDagrePipeline deep-equals the frozen inline body`, () => {
        const canonical = runDagrePipeline(nodes, edges, config);
        const legacy = legacyInlineDagrePipeline(nodes, edges, config);

        expect(canonical.positionedNodes).toEqual(legacy.positionedNodes);
        expect(canonical.safeEdges).toEqual(legacy.safeEdges);
        expect(canonical.layoutEdges).toEqual(legacy.layoutEdges);
      });
    }
  }

  it('the oracle corpus is real: at least one topology exercises the TC-307 filter', () => {
    // If the dangling topology were dropped from the corpus, the filter side
    // of the oracle would vacuous-pass. Pin its effect directly.
    const { safeEdges } = runDagrePipeline(TOPOLOGIES[3].nodes, TOPOLOGIES[3].edges, {
      rankdir: 'LR',
      nodesep: 50,
      ranksep: 80,
    });
    expect(safeEdges.map((e) => e.id)).toEqual(['e1']);
  });
});

// --- (round-30-2) delegation equality: apply() == pipeline + canvas/metrics ---

describe('dagre pipeline single source — strategy delegation equality (round-30-2)', () => {
  const strategies = {
    flow: new FlowStrategy(),
    tree: new TreeStrategy(),
    flowchart: new FlowchartStrategy(),
  } as const;

  for (const { name, nodes, edges } of TOPOLOGIES) {
    for (const { strategy, config } of STRATEGY_CONFIGS) {
      it(`${strategy}.apply() on ${name} equals the canonical pipeline composed with canvas/metrics`, () => {
        const pipeline = runDagrePipeline(nodes, edges, config);
        const composed = {
          nodes: pipeline.positionedNodes,
          edges: pipeline.layoutEdges,
          canvas: calculateCanvasSize(pipeline.positionedNodes),
          metrics: calculateMetrics(pipeline.positionedNodes, pipeline.layoutEdges),
        };
        const applied = strategies[strategy].apply(nodes, edges);

        if (strategy === 'flowchart' || composed.metrics.overlapCount === 0) {
          // flowchart has NO overlap fallback (returns the dagre result
          // unconditionally); flow/tree return the dagre result whenever it
          // is overlap-free. Both must be EXACTLY the canonical pipeline
          // composed with canvas/metrics — this is the delegation pin.
          expect(applied).toEqual(composed);
        } else {
          // Overlap fallback engaged (flow/tree only): the result is the
          // strategy's OWN grid-snap fallback over the pipeline's safeEdges —
          // never the dagre positions. Pin that the branch actually fired
          // (positions deviate) while completeness is preserved.
          expect(applied.nodes.map((n) => n.id).sort())
            .toEqual(nodes.map((n) => n.id).sort());
          expect(applied.edges).toHaveLength(pipeline.safeEdges.length);
          expect(applied.nodes).not.toEqual(composed.nodes);
        }
      });
    }
  }

  it('the corpus really exercises the flow overlap fallback (trigger pin)', () => {
    // explicit-extents × flow empirically yields one overlap (mixed
    // width/height nodes mispack under LR rankdir). Pin the trigger so a
    // dagre upgrade that changes this fails loudly instead of silently
    // flipping the branch coverage above.
    const { positionedNodes, layoutEdges } = runDagrePipeline(
      TOPOLOGIES[6].nodes,
      TOPOLOGIES[6].edges,
      { rankdir: 'LR', nodesep: 50, ranksep: 80 },
    );
    expect(calculateMetrics(positionedNodes, layoutEdges).overlapCount).toBeGreaterThan(0);
  });

  it('empty input still short-circuits to the shared empty result before the pipeline', () => {
    // The empty guard (round 29) stays in front of the pipeline call at every
    // strategy — runDagrePipeline must never see an empty node list.
    expect(strategies.flow.apply([], [])).toEqual(strategies.tree.apply([], []));
    expect(strategies.flowchart.apply([], []).nodes).toEqual([]);
  });
});

// --- (round-30-3) source anchors: canonical shapes + delegation, no re-rolls --

describe('dagre pipeline single source — source anchors (round-30-3)', () => {
  const CANONICAL = 'src/visualization/dagre-pipeline.ts';
  const STRATEGY_FILES = [
    'src/visualization/strategies/flow-strategy.ts',
    'src/visualization/strategies/tree-strategy.ts',
    'src/visualization/strategies/flowchart-strategy.ts',
  ];

  it('the canonical file holds the frozen extraction shapes', () => {
    const src = readSource(CANONICAL);
    // center→top-left conversion (a bare-local extent, NOT dagreNode.width —
    // the v1 family's different shape).
    expect(src).toMatch(/dagreNode\.x\s*-\s*w\s*\/\s*2/);
    expect(src).toMatch(/dagreNode\.y\s*-\s*h\s*\/\s*2/);
    // TC-307 filter, both endpoints.
    expect(src).toMatch(/\.has\(\s*\w+\.from\s*\)\s*&&\s*\w+\.has\(\s*\w+\.to\s*\)/);
    // straight-line fallback when dagre yields no points.
    expect(src).toMatch(/points:\s*dagreEdge\.points\s*\?\?\s*\[/);
    // label normalization on setEdge.
    expect(src).toMatch(/label:\s*edge\.label\s*\?\?\s*''/);
    // runs the layout itself.
    expect(src).toMatch(/dagre\.layout\(/);
  });

  it.each(STRATEGY_FILES)('%s delegates to the canonical pipeline and rolls no private dagre graph', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/runDagrePipeline\(/);
    expect(src).not.toMatch(/dagre\.layout\(/);
    expect(src).not.toMatch(/graphlib/);
    expect(src).not.toMatch(/\.setEdge\(/);
  });

  it('flow/tree keep the overlap-fallback wiring AFTER the pipeline composition (structural)', () => {
    // If the fallback call is dropped or reordered ahead of metrics, layout
    // silently loses its safety net. The branch IS behaviorally reachable
    // (round-30-2 trigger pin: mixed-extent inputs under LR) and behaviorally
    // covered there; this anchor keeps the wiring shape itself from being
    // "cleaned up" into a different guard expression.
    for (const file of ['flow-strategy.ts', 'tree-strategy.ts']) {
      const src = readSource(`src/visualization/strategies/${file}`);
      expect(src).toMatch(/if \(metrics\.overlapCount > 0\) \{\s*\n\s*return this\.gridSnapFallback\(/);
    }
  });

  it('per-strategy tuned configs stay per-strategy (no cross-strategy bleed)', () => {
    // Value anchors for the three configs — these ARE different on purpose
    // (per-diagram tuning); the registry bans the pipeline SHAPE, not the
    // tuning. A copy-paste of one strategy's config into another changes
    // layouts and must be a conscious edit.
    expect(readSource('src/visualization/strategies/flow-strategy.ts')).toMatch(
      /const NODE_SEP = 50;\s*\nconst RANK_SEP = 80;/,
    );
    expect(readSource('src/visualization/strategies/tree-strategy.ts')).toMatch(
      /const NODE_SEP = 60;\s*\nconst RANK_SEP = 100;/,
    );
    expect(readSource('src/visualization/strategies/flowchart-strategy.ts')).toMatch(
      /const NODE_SEP = 50;\s*\nconst RANK_SEP = 70;/,
    );
  });
});
