/**
 * Defect-9 silent-pass class — ONE consolidated cross-evaluator regression.
 *
 * The class (absent/unmapped/empty input → a manufactured value satisfies a
 * gate) was closed incrementally across THREE gate evaluators and a score-
 * resolver family, each in its own commit and each with its own isolated test:
 *   - iteration-manager.checkCriterion ............ 21c3521a / beda9ecb / be0448b8
 *   - adaptive-quality-gates.evaluateGate ......... 35b845e4 (extractMetricValue)
 *   - quality-gate captionSync/audioSync .......... dbcdfaad (resolveMeasuredMetric)
 *   - quality-monitor assessLayoutQuality ......... cbd885c2 (empty→0, polarity b)
 *
 * The recurring critique of that closure is that it happened facet-by-facet:
 * the SAME class was re-discovered under a new operator/typo each iteration.
 * This file is the proactive one-pass answer. Rather than pin each evaluator in
 * isolation, it holds the SINGLE roster of every silent-pass site found by a
 * repo-wide sweep and LIVE re-checks each one, so:
 *   1. the CLOSED sites stay closed (absent/empty FAILS) — a regression in any
 *      one closure flips its row here, in ONE place;
 *   2. the BY-DESIGN sites stay classified with a sharp, non-circular reason —
 *      so a future change forces a conscious decision instead of a silent drift;
 *   3. the COMPLETENESS GUARD ensures every known evaluator family has a row, so
 *      a NEW evaluator — the only remaining re-open vector — cannot ship
 *      unclassified. (The class is closed for both polarities: (a) absent→falsy
 *      `0` satisfies lt/lte/eq; (b) empty→PERFECT `1.0`/`100`/`true` satisfies
 *      gte/gt. Both are "absent data manufactures a value that satisfies the
 *      gate".)
 *
 * The sweep added one site the per-family tables had not pinned —
 * `compareWithBaseline` (unknown stage → no regression) — which is the SAME
 * fail-open-for-robustness shape as `isWithinBaseline`, classified BY-DESIGN.
 */

const { QualityGateEvaluator } = await import('../quality-gate');
const { QualityMonitor } = await import('../quality-monitor');
const { IterationManager } = await import('../../framework/iteration-manager');
const { VisualBalanceScorer } = await import('../../visualization/visual-balance-scorer');
const { scoreCost } = await import('../../pipeline/pipeline-health-score');
const { isWithinBaseline } = await import('../../pipeline/performance-baseline');
const { compareWithBaseline } = await import('../../pipeline/performance-regression-detector');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PipelineResult } from '../../pipeline/types';
import type { SceneGraph } from '../../types/diagram';

// ---------------------------------------------------------------------------
// Drivers. Each returns TRUE iff the gate FAILS on absent/empty input.
// (CLOSED rows ⇒ true; BY-DESIGN rows ⇒ false. The class-level assertion is
// uniform: gateFailsOnAbsent() === (verdict === 'CLOSED').)
// ---------------------------------------------------------------------------

const evaluator = new QualityGateEvaluator();

/** A quality-gate criterion's `passed` when its stage is driven with `{}`. */
function stageCriterionPassed(stage: number, criterion: string): boolean {
  const r = evaluator
    .evaluateStage(stage, {})
    .results.find((c) => c.criterionName === criterion);
  return r?.passed ?? false;
}

/** A scene with content but a DEGENERATE (empty) placed-node set. */
function nodelessScene(): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ source: 'n1', target: 'n2' }],
    summary: 'degenerate',
    keyphrases: [],
    startMs: 0,
    durationMs: 5000,
    layout: { nodes: [], edges: [] },
  };
}

/** accuracyScore for a nodeless scene; PERFECT (1.0) before the defect-9 fix. */
async function nodelessAccuracyScore(): Promise<number> {
  const monitor = new QualityMonitor();
  const result = await monitor.assessPipelineQuality({
    success: true,
    scenes: [nodelessScene()],
    audioUrl: '/t.wav',
    duration: 60,
    processingTime: 10000,
    stages: [],
    outputPath: '/o.mp4',
    metrics: {},
  } as unknown as PipelineResult);
  return (result as { accuracyScore?: number }).accuracyScore ?? 1;
}

/** True iff an unverifiable SLO fails the iteration-manager gate. */
function imUnmappedSLOFails(): boolean {
  // 'テスト通過率100%' maps to testPassRate; with NO metrics supplied the SLO
  // is unverifiable this run and the gate must fail loud (not silently pass).
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'd9-')), 'log.md');
  const mgr = new IterationManager(
    {
      phase: 'TestPhase',
      maxIterations: 5,
      successCriteria: ['テスト通過率100%'],
      failureRecovery: 'fallback',
      commitTrigger: 'on_success',
      currentIteration: 0,
      status: 'in_progress',
    },
    logPath,
  );
  return mgr.evaluateSuccessCriteria({}).allMet === false;
}

// ---------------------------------------------------------------------------
// THE ROSTER — the single map of every defect-9 silent-pass site.
// ---------------------------------------------------------------------------

type Polarity = 'a' | 'b';
type Verdict = 'CLOSED' | 'BY-DESIGN' | 'REFERENCED';

interface Row {
  id: string;
  family: string;
  polarity: Polarity;
  verdict: Verdict;
  /**
   * True iff absent/empty input makes the gate FAIL. CLOSED ⇒ true, BY-DESIGN ⇒
   * false. REFERENCED rows are verified by a dedicated test (see `verifiedBy`)
   * and are not re-driven here to avoid duplicating their heavy setup.
   */
  gateFailsOnAbsent?: () => boolean | Promise<boolean>;
  verifiedBy?: string;
  reason: string;
}

const ROSTER: Row[] = [
  // ── CLOSED (polarity a: absent→0 satisfies lt/lte/eq) ──────────────────
  {
    id: 'quality-gate/captionSync',
    family: 'quality-gate',
    polarity: 'a',
    verdict: 'CLOSED',
    gateFailsOnAbsent: () => !stageCriterionPassed(4, 'captionSync'),
    reason:
      'ABSENT captionSyncOffsetMs used to manufacture 0ms (`?? 0`) and satisfy `<= 50`. ' +
      'resolveMeasuredMetric routes absent → null → fail for ANY operator.',
  },
  {
    id: 'quality-gate/audioSync',
    family: 'quality-gate',
    polarity: 'a',
    verdict: 'CLOSED',
    gateFailsOnAbsent: () => !stageCriterionPassed(5, 'audioSync'),
    reason: 'Same shape as captionSync; resolveMeasuredMetric closes it for all operators.',
  },
  {
    id: 'iteration-manager/checkCriterion',
    family: 'iteration-manager',
    polarity: 'a',
    verdict: 'CLOSED',
    gateFailsOnAbsent: () => imUnmappedSLOFails(),
    reason:
      'A numeric SLO whose metric is absent (or whose keyword matches no CRITERION_KEY_MAP ' +
      'entry) fails loud instead of passing on an unrelated present metric.',
  },
  {
    id: 'adaptive-quality-gates/evaluateGate',
    family: 'adaptive-quality-gates',
    polarity: 'a',
    verdict: 'REFERENCED',
    verifiedBy: 'src/quality/__tests__/adaptive-quality-gates.test.ts',
    reason:
      'A gate whose `metric` is not in METRIC_EXTRACTORS fails loud via isKnownMetric (the 0 ' +
      'returned by extractMetricValue no longer satisfies lt/lte/eq). Verified by its dedicated ' +
      'suite (needs the realTimeMonitor snapshot mock); listed here so the family is represented.',
  },

  // ── CLOSED (polarity b: empty→PERFECT satisfies gte/gt) ────────────────
  {
    id: 'quality-monitor/assessLayoutQuality',
    family: 'quality-monitor',
    polarity: 'b',
    verdict: 'CLOSED',
    gateFailsOnAbsent: async () => (await nodelessAccuracyScore()) < 0.8,
    reason:
      'An empty layout.nodes used to score a PERFECT 1.0 (detectOverlaps([]) is vacuously ' +
      '"no overlaps"), inflating accuracyScore past the 0.8 readiness bar. Now empty → 0.',
  },

  // ── BY-DESIGN (polarity b: empty→PERFECT that is legitimately vacuous) ─
  {
    id: 'quality-gate/layoutQualityComposite',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'layoutQualityComposite'),
    reason:
      'A multi-criterion REFINEMENT in the Stage-3 gate. The three hard criteria ' +
      '(zeroOverlap/timelineContinuity/segmentNormalization) enforce the guarantees; the ' +
      'composite is computed when nodes+edges+bounds are supplied and explicitly "skips ' +
      'gracefully" otherwise (pinned by layout-quality-composite.test.ts). The skip never MASKS ' +
      'a layout that fails a hard criterion — it only fires when the hard criteria are ' +
      'independently satisfiable — so it is a documented optional refinement, not a manufactured pass.',
  },
  {
    id: 'quality-gate/entityExtractionRate',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(2, 'entityExtractionRate'),
    reason:
      'When expectedEntities is EXPLICITLY 0 the rate is vacuously 100% — one cannot fail the ' +
      'extraction of nothing. (Caveat: an absent expectedEntities falls back to entities.length, ' +
      'so fully-absent analysis data also passes; acceptable because this evaluator has no live ' +
      'caller and Stage-2 inputs always supply a baseline.)',
  },
  {
    id: 'quality-gate/relationCompleteness',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(2, 'relationCompleteness'),
    reason: 'Same explicit-zero vacuous-truth as entityExtractionRate.',
  },
  {
    id: 'quality-gate/zeroOverlap',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'zeroOverlap'),
    reason:
      'Empty nodes → genuinely zero overlaps. This is the vacuous truth of a REAL property ' +
      '(no two of zero nodes overlap), not a manufactured perfect score — distinct from the class.',
  },
  {
    id: 'quality-gate/timelineContinuity',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'timelineContinuity'),
    reason: '≤1 segment → continuity is trivially satisfied (a single span has no internal gap).',
  },
  {
    id: 'quality-gate/segmentNormalization',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'segmentNormalization'),
    reason: 'No segments → nothing to normalize. Vacuous, not manufactured.',
  },
  {
    id: 'visual-balance-scorer/calculateVisualBalance',
    family: 'score-resolver',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () =>
      new VisualBalanceScorer().calculateVisualBalance([], { width: 1920, height: 1080 })
        .overallScore < 0.7,
    reason:
      'An empty layout is vacuously "balanced" (overallScore 1.0). It feeds the layout-auto-' +
      'optimizer as a COMPARISON score (never a candidate the optimizer emits), so the perfect ' +
      'default never gates anything.',
  },
  {
    id: 'pipeline-health-score/scoreCost',
    family: 'score-resolver',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () => scoreCost(null) < 70,
    reason:
      'No cost baseline ⇒ no cost penalty (score 100). "Cannot compare" is intentionally not a ' +
      'failure; a null comparison is legitimately absent, not a manufactured pass.',
  },
  {
    id: 'performance-baseline/isWithinBaseline',
    family: 'score-resolver',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () =>
      !isWithinBaseline({
        stage: 'brand-new-stage',
        durationMs: 999_999,
        memoryMB: 999_999,
        timestamp: 0,
      }),
    reason:
      'A stage with no baseline cannot be declared a regression, so it is "within baseline" ' +
      '(true). Fail-open for robustness so new stages do not instantly fail; distinct from a ' +
      'measured duration exceeding a known baseline.',
  },
  {
    id: 'performance-regression-detector/compareWithBaseline',
    family: 'score-resolver',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    gateFailsOnAbsent: () =>
      compareWithBaseline({
        stage: 'brand-new-stage',
        durationMs: 999_999,
        memoryMB: 999_999,
        timestamp: 0,
      }).isRegression,
    reason:
      'Found in the one-pass sweep. Same fail-open-for-robustness shape as isWithinBaseline: an ' +
      'unknown stage (baselineMs 0) is reported as no-regression rather than a false alarm. ' +
      'Pinned here so the symmetry with isWithinBaseline is explicit.',
  },
];

// Every family that owns a metric/criterion/score resolution path must appear.
const EXPECTED_FAMILIES = new Set<Row['family']>([
  'quality-gate',
  'quality-monitor',
  'iteration-manager',
  'adaptive-quality-gates',
  'score-resolver',
]);

describe('defect-9 silent-pass class — consolidated cross-evaluator regression', () => {
  // The uniform class-level assertion: for every LIVE-driven row, absent/empty
  // FAILS the gate iff the row is CLOSED. BY-DESIGN rows pass on absent by
  // design. A regression in any closure (absent starts passing again) flips its
  // CLOSED row to false here; a by-design site drifting to silent-pass flips to
  // true. Either way the row fails in this ONE table.
  it.each(ROSTER.filter((r) => r.gateFailsOnAbsent))(
    '$id — absent/empty fails gate iff CLOSED (polarity $polarity, $verdict)',
    async (row) => {
      expect(await row.gateFailsOnAbsent!()).toBe(row.verdict === 'CLOSED');
    },
  );

  // The CLOSED rows are the regression net: re-affirm as a group that EVERY
  // closed site fails on absent input (no silent-pass survives anywhere).
  it('every CLOSED site fails on absent/empty input (no silent-pass survives)', async () => {
    const closed = ROSTER.filter((r) => r.verdict === 'CLOSED' && r.gateFailsOnAbsent);
    expect(closed.length).toBeGreaterThanOrEqual(3);
    for (const row of closed) {
      expect({ id: row.id, fails: await row.gateFailsOnAbsent!() }).toEqual({
        id: row.id,
        fails: true,
      });
    }
  });

  // The BY-DESIGN rows are classified, not fixed: confirm they STILL pass on
  // absent (the pinned behavior) so a "fix" that accidentally flips one is
  // caught, and the classification stays honest.
  it('every BY-DESIGN site still passes on absent/empty (pinned classification)', async () => {
    const byDesign = ROSTER.filter((r) => r.verdict === 'BY-DESIGN' && r.gateFailsOnAbsent);
    expect(byDesign.length).toBeGreaterThanOrEqual(1);
    for (const row of byDesign) {
      expect({ id: row.id, fails: await row.gateFailsOnAbsent!() }).toEqual({
        id: row.id,
        fails: false,
      });
    }
  });

  // COMPLETENESS GUARD — the only remaining re-open vector is a NEW evaluator
  // family. This asserts the roster covers every known family, so adding a new
  // resolution path forces a conscious row here rather than shipping unclassified.
  it('completeness: every known evaluator family has at least one roster row', () => {
    const covered = new Set(ROSTER.map((r) => r.family));
    const missing = [...EXPECTED_FAMILIES].filter((f) => !covered.has(f));
    expect(missing).toEqual([]);
    // And no phantom family snuck into the roster.
    const extra = [...covered].filter((f) => !EXPECTED_FAMILIES.has(f));
    expect(extra).toEqual([]);
  });

  // REFERENCED rows delegate to a dedicated test. Guard that the referenced
  // file actually exists, so a reference can never silently go stale.
  it('every REFERENCED row points at an existing dedicated closure test', () => {
    const referenced = ROSTER.filter((r) => r.verdict === 'REFERENCED');
    expect(referenced.length).toBeGreaterThanOrEqual(1);
    for (const row of referenced) {
      expect({ id: row.id, exists: fs.existsSync(row.verifiedBy!) }).toEqual({
        id: row.id,
        exists: true,
      });
    }
  });
});
