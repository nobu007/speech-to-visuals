/**
 * Round 29 single-source guard: the EMPTY layout result.
 *
 * Before this module the zero-nodes early return of every layout path was
 * hand-rolled at 12 sites in one shape —
 *   `{ nodes: [], edges: [], canvas: {width: DEFAULT_CANVAS_WIDTH, height:
 *    DEFAULT_CANVAS_HEIGHT}, metrics: {overlapCount: 0, edgeCrossings: 0,
 *    aspectRatio: TARGET_ASPECT_RATIO}}` —
 * across all 11 registered strategies plus LayoutEngineV2.layout, with two
 * more sites (mindmap/conceptmap single-node early returns) re-freezing the
 * metrics triple alone. The family had ALREADY drifted: cycle-strategy
 * re-derived `aspectRatio: DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT`
 * instead of reading TARGET_ASPECT_RATIO — numerically invisible only while
 * TARGET_ASPECT_RATIO stays derived from exactly those two constants, which
 * is the desync shape every round 4..28 family hunt targets (a future edit
 * to the derivation silently splits cycle's empty geometry from the other
 * ten strategies').
 *
 * An empty diagram flows through LayoutEngineV2.layout -> the type's
 * strategy -> the caller's video-length math: if one path's empty result
 * reported different geometry than another, the SAME empty input would
 * produce different reported canvas/aspect per diagram type.
 *
 * This file pins (a) the canonical result against the pre-migration inline
 * literal replicated verbatim as the oracle — including that the cycle
 * drift variant evaluates to the SAME object (the zero-delta proof for the
 * fix), (b) cross-path behavioral identity: every registered strategy, the
 * engine, AND the selector's grid-snap fallback (which reaches the same
 * object emergently via calculateCanvasSize/calculateMetrics delegation)
 * return the identical canonical result for empty input, (c) the
 * metrics-only twins on the single-node path, (d) freshness (no shared
 * mutable instance), and (e) source anchors that every migrated site
 * delegates to the canonical helper. The discovery sweep ("no src file
 * outside the canonical module re-freezes the metrics triple + default
 * canvas combination, or re-derives the aspect ratio from the canvas
 * constants") lives in tests/guards/frozen-literal-rules.ts, rule
 * 'empty layout result single-sourced in empty-layout-result (round 29)'.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  emptyLayoutResult,
  emptyStrategyLayoutMetrics,
} from '@/visualization/empty-layout-result';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  TARGET_ASPECT_RATIO,
} from '@/visualization/canvas-dimensions';
import { LayoutEngineV2 } from '@/visualization/layout-engine-v2';
import { StrategySelector } from '@/visualization/strategy-selector';
import { FlowStrategy } from '@/visualization/strategies/flow-strategy';
import { TreeStrategy } from '@/visualization/strategies/tree-strategy';
import { TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import { MatrixStrategy } from '@/visualization/strategies/matrix-strategy';
import { CycleStrategy } from '@/visualization/strategies/cycle-strategy';
import { MindMapStrategy } from '@/visualization/strategies/mindmap-strategy';
import { NetworkStrategy } from '@/visualization/strategies/network-strategy';
import { ConceptMapStrategy } from '@/visualization/strategies/conceptmap-strategy';
import { FlowchartStrategy } from '@/visualization/strategies/flowchart-strategy';
import { ComparisonStrategy } from '@/visualization/strategies/comparison-strategy';
import { GeneralStrategy } from '@/visualization/strategies/general-strategy';
import type { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';
import type { DiagramType, NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

/** The pre-migration inline literal, replicated verbatim as the oracle. */
const PRE_MIGRATION_INLINE_RESULT = {
  nodes: [] as NodeDatum[],
  edges: [] as EdgeDatum[],
  canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
  metrics: { overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO },
};

/**
 * The drifted cycle-strategy variant, replicated verbatim: it re-derived the
 * aspect ratio instead of reading TARGET_ASPECT_RATIO. Must evaluate to the
 * SAME object — that equivalence is the zero-delta proof for the round 29 fix.
 */
const PRE_MIGRATION_CYCLE_DRIFT_RESULT = {
  nodes: [] as NodeDatum[],
  edges: [] as EdgeDatum[],
  canvas: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
  metrics: {
    overlapCount: 0,
    edgeCrossings: 0,
    aspectRatio: DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT,
  },
};

const ALL_REGISTERED_STRATEGIES: [string, LayoutStrategy][] = [
  ['flow', new FlowStrategy()],
  ['tree', new TreeStrategy()],
  ['timeline', new TimelineStrategy()],
  ['matrix', new MatrixStrategy()],
  ['cycle', new CycleStrategy()],
  ['mindmap', new MindMapStrategy()],
  ['network', new NetworkStrategy()],
  ['conceptmap', new ConceptMapStrategy()],
  ['flowchart', new FlowchartStrategy()],
  ['comparison', new ComparisonStrategy()],
  ['general', new GeneralStrategy()],
];

/** Every migrated production file -> the delegation it must contain. */
const DELEGATION_SITES: [string, RegExp][] = [
  ['src/visualization/layout-engine-v2.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/flow-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/tree-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/timeline-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/matrix-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/cycle-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/mindmap-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/network-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/conceptmap-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/flowchart-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/comparison-strategy.ts', /return emptyLayoutResult\(\);/],
  ['src/visualization/strategies/general-strategy.ts', /return emptyLayoutResult\(\);/],
  // Round 42 conscious update: the single-node epilogue — the only mindmap/
  // conceptmap site that wrote `metrics: emptyStrategyLayoutMetrics()` — moved
  // one hop. Both strategies now delegate the whole epilogue to
  // strategy-graph.singleNodeCenteredLayout, which holds the metrics line, so
  // the anchor follows the moved writer and the strategies anchor their new
  // delegation shape instead. Intent unchanged: the metrics triple is still
  // written exactly once, in the empty-layout-result canonical chain.
  ['src/visualization/strategies/mindmap-strategy.ts', /singleNodeCenteredLayout\(nodes\)/],
  ['src/visualization/strategies/conceptmap-strategy.ts', /singleNodeCenteredLayout\(nodes\)/],
  ['src/visualization/strategy-graph.ts', /metrics: emptyStrategyLayoutMetrics\(\)/],
];

describe('round 29: empty layout result single source', () => {
  describe('zero-delta oracle vs the pre-migration inline literals', () => {
    it('canonical emptyLayoutResult() equals the historic inline literal exactly', () => {
      expect(emptyLayoutResult()).toEqual(PRE_MIGRATION_INLINE_RESULT);
    });

    it('the cycle-strategy drift variant evaluates to the SAME object (fix is zero-delta)', () => {
      // TARGET_ASPECT_RATIO is derived from DEFAULT_CANVAS_WIDTH/HEIGHT, so
      // the drifted re-derivation happened to agree — pin that agreement so
      // the unification provably changed no reported geometry.
      expect(PRE_MIGRATION_CYCLE_DRIFT_RESULT).toEqual(PRE_MIGRATION_INLINE_RESULT);
    });

    it('emptyStrategyLayoutMetrics() equals the historic inline metrics triple', () => {
      expect(emptyStrategyLayoutMetrics()).toEqual({
        overlapCount: 0,
        edgeCrossings: 0,
        aspectRatio: TARGET_ASPECT_RATIO,
      });
    });
  });

  describe('cross-path behavioral identity for empty input', () => {
    it.each(ALL_REGISTERED_STRATEGIES)('%s strategy returns the canonical result', (_name, strategy) => {
      expect(strategy.apply([], [])).toEqual(emptyLayoutResult());
    });

    it('LayoutEngineV2.layout returns the canonical result for every registered diagram type', () => {
      const engine = new LayoutEngineV2();
      const types: DiagramType[] = [
        'flow', 'tree', 'timeline', 'matrix', 'cycle',
        'mindmap', 'network', 'conceptmap', 'flowchart', 'comparison', 'general',
      ];
      for (const t of types) {
        expect(engine.layout(t, [], [])).toEqual(emptyLayoutResult());
      }
    });

    it('the selector grid-snap fallback agrees EMERGENTLY (delegates to calculateCanvasSize/calculateMetrics)', () => {
      // The fallback has no empty guard of its own; for zero nodes its
      // helpers must still produce the canonical object. If this pin breaks
      // the fallback has stopped delegating its empty-case geometry.
      const selector = new StrategySelector();
      const fallback = selector.select('flow' as DiagramType); // any known type selects its strategy
      const unknown = selector.select('unknown-type' as DiagramType);
      expect(unknown).not.toBe(fallback);
      expect(unknown.apply([], [])).toEqual(emptyLayoutResult());
    });
  });

  describe('metrics-only twins on the single-node path', () => {
    const singleNode: NodeDatum[] = [{ id: 'n1', label: 'only' }];

    it('mindmap single-node early return reports the canonical metrics', () => {
      const result: StrategyLayoutResult = new MindMapStrategy().apply(singleNode, []);
      expect(result.metrics).toEqual(emptyStrategyLayoutMetrics());
    });

    it('conceptmap single-node early return reports the canonical metrics', () => {
      const result: StrategyLayoutResult = new ConceptMapStrategy().apply(singleNode, []);
      expect(result.metrics).toEqual(emptyStrategyLayoutMetrics());
    });
  });

  describe('freshness: callers get their own object', () => {
    it('repeated calls return deep-equal but distinct objects', () => {
      const a = emptyLayoutResult();
      const b = emptyLayoutResult();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.metrics).not.toBe(b.metrics);
      expect(a.canvas).not.toBe(b.canvas);

      // Mutating one result must not corrupt future calls.
      a.metrics.overlapCount = 99;
      a.nodes.push({ id: 'poison', label: 'poison' });
      expect(emptyLayoutResult()).toEqual(PRE_MIGRATION_INLINE_RESULT);
    });
  });

  describe('source anchors: every migrated site delegates', () => {
    it.each(DELEGATION_SITES)('%s delegates to the canonical helper', (file, delegation) => {
      const src = readSource(file);
      expect(src).toMatch(delegation);
      expect(src).toMatch(/empty-layout-result/);
      // And the site no longer re-freezes the triple inline.
      expect(src).not.toMatch(/overlapCount:\s*0,\s*edgeCrossings:\s*0,\s*aspectRatio:/);
    });

    it('the canonical module is the ONLY src file still writing the triple', () => {
      const canonical = readSource('src/visualization/empty-layout-result.ts');
      expect(canonical).toMatch(/aspectRatio: TARGET_ASPECT_RATIO/);
      expect(canonical).toMatch(/width: DEFAULT_CANVAS_WIDTH/);
    });
  });
});
