/**
 * @jest-environment node
 */
/**
 * layout-outcome-overlap-regression.test.ts — outcome-level layout regression
 * guard (steering item, post-0531aa4f).
 *
 * WHY THIS FILE EXISTS: the convergence-predicate unification (0531aa4f)
 * changed WHEN force-directed phases exit (the i=0 check is now included),
 * which alters iteration counts and therefore FINAL NODE POSITIONS in real
 * renders. Every existing pin around that change asserted ITERATION-COUNT
 * behavior, not layout outcome — "iteration-count pin ≠ outcome pin" (r15
 * lesson). The same blind spot applies to any future change that shifts when
 * or how layout phases terminate (convergence thresholds, seeded jitter,
 * dagre upgrades, overlap-fallback triggers): positions can move and overlaps
 * can appear while every count-based pin stays green.
 *
 * This guard pins the OUTCOME the renderer actually consumes, through the two
 * live composition seams, on a topology corpus:
 *
 *   1. executeLayout (src/visualization/strategy-selector.ts) — strategy
 *      apply + OverlapResolver physics pass + centering: the exported
 *      composition of the registered-strategy stack the pipeline layout
 *      paths use.
 *   2. EnhancedZeroOverlapLayoutEngine.generateZeroOverlapLayout — the engine
 *      the simple pipeline instantiates (src/pipeline/simple-pipeline.ts),
 *      whose contract is literally "zero overlap guaranteed".
 *
 * Pinned per topology × seam:
 *   - every node position and extent is FINITE (no NaN/Infinity sink, no
 *     phantom geometry),
 *   - ZERO pairwise overlaps — asserted TWICE: via the production predicate
 *     nodesOverlap (the single source calculateMetrics/ezo quality metrics
 *     both consume) and via a deliberately independent inline AABB check so
 *     a drifted predicate cannot silently pass its own decision value,
 *   - every layout edge with BOTH endpoints present carries ≥1 finite anchor
 *     point (dangling edges keep the frozen r32/r33 `points: []` fallback
 *     contract; the dagre trio drops them instead),
 *   - DETERMINISM: two runs deep-equal (physics is seeded via createLayoutRng
 *     since r17; dagre is deterministic) — without this, before/after
 *     outcome comparisons are meaningless.
 *
 * Findings probed at creation (documented in the round-36 spec record, NOT
 * fixed here — both are design-heavy semantics changes on the live render
 * path, each deserving its own round with delta oracles):
 *   - ezo's qualityMetrics.overlapCount conflates geometric overlap with
 *     violations of minimumSpacing.nodeToNode (40px): the engine returns
 *     success=false on final layouts that are geometrically overlap-free
 *     (mixed-extent + dense-hub shapes). The success flag flows into the
 *     simple pipeline's layout result. The guard pins the GEOMETRIC contract
 *     plus the flag's internal consistency.
 *   - ezo emits GENUINE geometric overlaps on 4 of the 40 type × topology
 *     combos (tree/mixed-extents and dense-hub under flowchart/tree/timeline),
 *     despite the class's "zero overlap guaranteed" contract. Two root
 *     causes: (a) sizing-source divergence — the ezo dagre paths size boxes
 *     with the label-driven calculateNodeWidth (clamped to [base, 2×base],
 *     NEVER reads node.width) while every downstream measurement
 *     (getNodeWidth) honors the explicit width field first, so a width-400
 *     input node is PLACED as a ≤240px box but MEASURED as 400px; (b) the
 *     overlap resolver does not fully separate 16-spoke hubs. These are
 *     pinned as exact expected pair lists below (KNOWN_EZO_GAPS): an
 *     improvement OR a worsening forces a conscious update to this file.
 *
 * Both probes were RUN at creation (not asserted from reading):
 *   - RED probe: disabling the OverlapResolver branch in executeLayout (the
 *     exact "regression" shape this guard exists for) fails 7 tests — the
 *     mixed-extent topology under flow/flowchart/general/mindmap/network plus
 *     dense-hub under mindmap/network. The corpus does not silently depend
 *     on resolution never firing.
 *   - Convergence probe (the 0531aa4f question): reverting the force-directed
 *     exit predicate to the pre-unification shape (`&& i > 0`, skipping the
 *     i=0 check — the later exit) keeps all 128 outcome assertions green,
 *     while 2 existing iteration-count pins correctly fail — proving the
 *     probe changed behavior yet regressed no layout OUTCOME. The earlier
 *     exit does not degrade overlap quality on this corpus; the guard now
 *     pins that permanently.
 *
 * Deliberately NOT pinned: exact coordinates (any tuning change would break
 * them — overlap-freedom, finiteness and determinism are the contract).
 */

import { describe, it, expect } from '@jest/globals';
import type { NodeDatum, EdgeDatum, DiagramType } from '@/types/diagram';
import { executeLayout } from '@/visualization/strategy-selector';
import { nodesOverlap } from '@/visualization/layout-utils';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';
import { EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';

// ---------------------------------------------------------------------------
// Topology corpus. Same shapes the family guards freeze, minus the degenerate
// duplicate-id case (two nodes at one id trivially overlap — overlap-freedom
// is meaningless there) — plus the round-30 mixed-extent shape that makes the
// overlap-resolution path genuinely fire.
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
  ['mixed extents (r30 shape: dagre LR overlap is real here)',
    [
      { id: 'm0', label: 'M0', width: 400, height: 120 },
      { id: 'm1', label: 'M1', width: 400, height: 120 },
      { id: 'm2', label: 'M2' },
      { id: 'm3', label: 'M3' },
    ],
    [{ from: 'm0', to: 'm1' }, { from: 'm1', to: 'm2' }, { from: 'm2', to: 'm3' }]],
  ['dangling edges filtered before layout (TC-307)',
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    [{ from: 'a', to: 'b' }, { from: 'ghost', to: 'a' }, { from: 'b', to: 'phantom' }]],
  ['dense hub (16 spokes, physics stress)',
    [
      { id: 'hub', label: 'Hub' },
      ...Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, label: `Spoke ${i}` })),
    ],
    Array.from({ length: 16 }, (_, i) => ({ from: 'hub', to: `s${i}` }))],
  ['single node, no edges',
    [{ id: 'only', label: 'Only' }], []],
];

const ALL_TYPES: DiagramType[] = [
  'flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle',
  'comparison', 'network', 'conceptmap', 'mindmap', 'general',
];

// ---------------------------------------------------------------------------
// Outcome predicates. `nodesOverlap` is the production single source; the
// inline AABB is deliberately INDEPENDENT so a drifted predicate cannot
// certify its own decisions.
// ---------------------------------------------------------------------------

function finiteNodeOutcomes(layout: { nodes: Array<{ id: string; x: number; y: number }> }): void {
  for (const node of layout.nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(Number.isFinite(getNodeWidth(node, 0))).toBe(true);
    expect(Number.isFinite(getNodeHeight(node, 0))).toBe(true);
  }
}

function independentOverlapPairs(nodes: Array<{ id: string; x: number; y: number }>): string[] {
  const offenders: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const aw = getNodeWidth(a, 0);
      const ah = getNodeHeight(a, 0);
      const bw = getNodeWidth(b, 0);
      const bh = getNodeHeight(b, 0);
      const separated =
        a.x + aw <= b.x || b.x + bw <= a.x || a.y + ah <= b.y || b.y + bh <= a.y;
      if (!separated) {
        offenders.push(`${a.id}×${b.id}`);
      }
    }
  }
  return offenders;
}

describe('layout outcome regression — overlap-free, finite, deterministic (steering post-0531aa4f)', () => {
  describe.each(ALL_TYPES)('executeLayout [%s]', (diagramType) => {
    for (const [caseName, nodes, edges] of CORPUS) {
      it(`outcome: overlap-free, finite, deterministic — ${caseName}`, async () => {
        const first = await executeLayout([...nodes], [...edges] as EdgeDatum[], diagramType);
        const second = await executeLayout([...nodes], [...edges] as EdgeDatum[], diagramType);

        // The production decision value itself…
        expect(first.metrics.overlapCount).toBe(0);
        // …the production predicate pairwise…
        const pairs: string[] = [];
        for (let i = 0; i < first.nodes.length; i++) {
          for (let j = i + 1; j < first.nodes.length; j++) {
            if (nodesOverlap(first.nodes[i], first.nodes[j])) {
              pairs.push(`${first.nodes[i].id}×${first.nodes[j].id}`);
            }
          }
        }
        expect(pairs).toEqual([]);
        // …and the independent AABB (a drifted predicate cannot pass itself).
        expect(independentOverlapPairs(first.nodes)).toEqual([]);

        finiteNodeOutcomes(first);
        // Edge-anchor contract, endpoint-aware: an edge whose BOTH endpoints
        // exist must carry ≥1 finite anchor point. Dangling edges (TC-307
        // corpus case) are ALLOWED `points: []` — that is the frozen r32/r33
        // fallback contract; the dagre trio drops them entirely instead.
        const nodeIdSet = new Set(nodes.map(n => n.id));
        for (const edge of first.edges) {
          expect(Array.isArray(edge.points)).toBe(true);
          const bothEndpointsExist =
            edge.from !== undefined && edge.to !== undefined &&
            nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to);
          if (bothEndpointsExist) {
            expect(edge.points.length).toBeGreaterThanOrEqual(1);
          }
          for (const point of edge.points) {
            expect(Number.isFinite(point.x)).toBe(true);
            expect(Number.isFinite(point.y)).toBe(true);
          }
        }

        expect(second.nodes).toEqual(first.nodes);
        expect(second.edges).toEqual(first.edges);
      });
    }
  });

  describe('EnhancedZeroOverlapLayoutEngine (simple-pipeline engine)', () => {
    const engine = new EnhancedZeroOverlapLayoutEngine();
    const EZO_TYPES: DiagramType[] = ['flowchart', 'tree', 'timeline', 'comparison', 'network'];

    // KNOWN GAPS, pinned exactly (probed at guard creation, NOT fixed here —
    // see the file header for both root causes). These 4 of 40 combos emit
    // GENUINE geometric overlaps from the "zero overlap guaranteed" engine.
    // The values are the exact pair lists the independent AABB produces, so a
    // fix (list shrinks/empties) or a regression (grows/new combo) both turn
    // this suite RED and force a conscious decision here.
    const KNOWN_EZO_GAPS: Record<string, string[]> = {
      'flowchart / dense hub (16 spokes, physics stress)':
        ['s1×s2', 's2×s3', 's3×s4', 's4×s5', 's5×s6', 's6×s7', 's7×s8', 's8×s9',
         's9×s10', 's10×s11', 's11×s12', 's12×s13', 's13×s14', 's14×s15'],
      'tree / dense hub (16 spokes, physics stress)':
        ['hub×s0', 's0×s3', 's12×s13', 's14×s15'],
      'timeline / dense hub (16 spokes, physics stress)':
        ['hub×s0', 's1×s2', 's2×s3', 's3×s4', 's4×s5', 's5×s6', 's6×s7', 's7×s8',
         's8×s9', 's9×s10', 's10×s11', 's11×s12', 's12×s13', 's14×s15'],
      'tree / mixed extents (r30 shape: dagre LR overlap is real here)':
        ['m0×m1', 'm2×m3'],
    };

    // KNOWN CURRENT SEMANTICS (probed at guard creation, NOT a bug fix here):
    // ezo's detectAllOverlaps counts a pair as "overlapping" when it violates
    // minimumSpacing.nodeToNode (40px), so qualityMetrics.overlapCount can be
    // > 0 — and success false — while the FINAL GEOMETRY is overlap-free in
    // the plain sense (independent AABB: zero pairs). Empirically the
    // separation target is missed on the mixed-extent and dense-hub shapes
    // for the dagre/timeline initial layouts. The renderer-consumed contract
    // this guard pins is the geometric one; the success flag is pinned only
    // for internal consistency (it is defined as overlapCount === 0).
    for (const diagramType of EZO_TYPES) {
      for (const [caseName, nodes, edges] of CORPUS) {
        const key = `${diagramType} / ${caseName}`;
        const expectedPairs = KNOWN_EZO_GAPS[key] ?? [];
        const expectation = expectedPairs.length === 0
          ? 'geometrically overlap-free'
          : `exactly the pinned known-gap pairs (${expectedPairs.length})`;
        it(`outcome: ${expectation} + finite — ${key}`, async () => {
          const result = await engine.generateZeroOverlapLayout(
            diagramType,
            [...nodes],
            [...edges] as EdgeDatum[],
          );

          expect(independentOverlapPairs(result.nodes)).toEqual(expectedPairs);
          finiteNodeOutcomes(result);
          expect(result.success).toBe(result.qualityMetrics.overlapCount === 0);
          expect(result.nodes.map(n => n.id).sort()).toEqual(nodes.map(n => n.id).sort());
        });
      }
    }
  });
});
