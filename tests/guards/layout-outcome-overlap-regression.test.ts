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
 * Findings probed at creation (round 36) — both FIXED:
 *   - FIXED IN ROUND 37: ezo emitted GENUINE geometric overlaps on 4 of the 40 type × topology
 *     combos (tree/mixed-extents and dense-hub under flowchart/tree/timeline),
 *     despite the class's "zero overlap guaranteed" contract. Two root
 *     causes, both closed in round 37: (a) sizing-source divergence — the ezo
 *     paths sized boxes with the label-driven calculateNodeWidth (clamped to
 *     [base, 2×base], NEVER reads node.width) while every downstream
 *     measurement (getNodeWidth) honors the explicit width field first, so a
 *     width-400 input node was PLACED as a ≤240px box but MEASURED as 400px —
 *     closed by resolveNodeWidth/resolveNodeHeight (layout-utils.ts, the
 *     round-31 explicit-first branch made engine-wide); (b) the force loop's
 *     no-progress exit stranded residual overlaps when a displacement traded
 *     one pair for another — closed by a final production-OverlapResolver
 *     last-mile pass (clamped to the fixed canvas, kept only when still
 *     geometric-clean) inside resolveAllOverlaps. The ezo block below
 *     therefore asserts the SAME zero-overlap contract as the executeLayout
 *     block; a reintroduced gap fails red instead of being pinned.
 *   - FIXED IN ROUND 38: ezo's qualityMetrics.overlapCount conflated
 *     geometric overlap with violations of minimumSpacing.nodeToNode (40px)
 *     — the engine returned success=false on final layouts that were
 *     geometrically overlap-free (mixed-extent + dense-hub shapes), and the
 *     flag flowed into the simple pipeline as 'layout_generation_failed'
 *     with the scene skipped. overlapCount is now the GEOMETRIC count — the
 *     same predicate every other engine reports (layout-engine-v2's
 *     calculateMetrics, quality-gate, OverlapResolver) — and the 40px
 *     separation target is reported separately as spacingViolationCount
 *     (warning-only; it can never fail the layout). The ezo block below now
 *     asserts success===true on every combo and pins spacingViolationCount
 *     against the production spacing predicate, so a re-conflation from
 *     either side fails red.
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

/**
 * Pair count violating the engine's minimumSpacing.nodeToNode separation
 * target, via the production predicate (`nodesOverlap(a, b, spacing)` —
 * each AABB inflated by spacing/2). This is the metric ezo reports as
 * spacingViolationCount: same predicate, so the engine's spatial-grid and
 * brute-force paths are cross-checked against an independent loop.
 */
function countSpacingViolations(
  nodes: Array<{ id: string; x: number; y: number }>,
  spacing: number,
): number {
  let count = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j], spacing)) {
        count++;
      }
    }
  }
  return count;
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

    // Round 36 found 4 of these 40 combos emitting GENUINE geometric overlaps
    // and pinned them as KNOWN_EZO_GAPS; round 37 fixed both root causes (see
    // the file header). The pins are GONE on purpose: every ezo combo now
    // asserts the same zero-overlap contract as the executeLayout block, so a
    // reintroduced gap — sizing regression, resolver strand, canvas clamp
    // re-overlap — fails RED instead of matching a stale expected list.

    // ROUND 38 SEMANTICS: success and qualityMetrics.overlapCount are the
    // GEOMETRIC zero-overlap contract (success === overlapCount === 0 for
    // every combo here — all are geometrically clean since round 37, and a
    // geometrically-clean layout must NOT report failure). The 40px
    // minimumSpacing.nodeToNode separation target (default engine = the
    // simple-pipeline configuration, which does not override it) is a
    // SEPARATE warning-only signal: spacingViolationCount must equal the
    // production spacing predicate's own pair count on the emitted nodes.
    // Empirically the target is missed on mixed-extent/dense-hub shapes —
    // those combos are exactly the RED witness for the round-38 fix.
    for (const diagramType of EZO_TYPES) {
      for (const [caseName, nodes, edges] of CORPUS) {
        const key = `${diagramType} / ${caseName}`;
        it(`outcome: geometrically overlap-free + finite — ${key}`, async () => {
          const result = await engine.generateZeroOverlapLayout(
            diagramType,
            [...nodes],
            [...edges] as EdgeDatum[],
          );

          expect(independentOverlapPairs(result.nodes)).toEqual([]);
          finiteNodeOutcomes(result);
          expect(result.success).toBe(true);
          expect(result.qualityMetrics.overlapCount).toBe(0);
          // spacingViolationCount: the 40px separation target, reported but
          // never a failure — pinned against the production predicate so the
          // grid and brute-force detection paths can't drift apart either.
          expect(result.qualityMetrics.spacingViolationCount).toBe(
            countSpacingViolations(result.nodes, 40));
          expect(result.nodes.map(n => n.id).sort()).toEqual(nodes.map(n => n.id).sort());
        });
      }
    }
  });
});
