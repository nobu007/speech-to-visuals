/**
 * Defect-9 silent-pass class — the EMPTY/ABSENT→PERFECT-SCORE sub-variant.
 *
 * The class was originally closed for the NAME-RESOLUTION polarity: a resolver
 * returns a falsy `0` for an unknown metric name and that `0` silently satisfies
 * a lower-is-better `lt`/`lte`/`eq` gate (captionSync/audioSync in quality-gate;
 * extractMetricValue in adaptive-quality-gates; checkCriterion in
 * iteration-manager). That closure left a mirror image UN-swept: a SCORE
 * resolver that returns a PERFECT default (`1.0` / `100` / `true`) when its
 * input is EMPTY or ABSENT, and that perfect default silently satisfies a
 * higher-is-better `>= threshold` gate. Both polarities are the same defect:
 * absent data manufactures a value that satisfies the gate.
 *
 * This file:
 *   1. FIXES the live instance — `QualityMonitor.assessLayoutQuality` awarded a
 *      PERFECT layout score (1.0) to a scene whose `layout.nodes` was an empty
 *      array (`detectOverlaps([])` is vacuously "no overlaps → excellent"), which
 *      inflated `accuracyScore`/`overallScore` on a degenerate, nodeless scene.
 *      `assessPipelineQuality` is called live from MainPipeline and its result is
 *      attached to `PipelineResult.qualityAssessment`, so the vacuous-perfect
 *      score reached consumers. The fix: empty nodes → 0 (matching every other
 *      empty-input assessor in this file), closing the silent-pass.
 *   2. Adds ONE parameterized regression table auditing every sibling
 *      empty/absent→default resolver found in the one-pass sweep, classifying
 *      each as FIXED or BY-DESIGN so the class cannot be re-discovered under a
 *      new module/operator next iteration.
 */

const { QualityMonitor } = await import('../quality-monitor');
const { VisualBalanceScorer } = await import('../../visualization/visual-balance-scorer');
const { scoreCost } = await import('../../pipeline/pipeline-health-score');
const { isWithinBaseline } = await import('../../pipeline/performance-baseline');
import type { PipelineResult } from '../../pipeline/types';
import type { SceneGraph } from '../../types/diagram';

/** A scene with top-level content but a DEGENERATE (empty) placed-node set. */
function nodelessLayoutScene(): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
    ],
    edges: [{ source: 'n1', target: 'n2' }],
    summary: 'A scene whose layout placed zero nodes (degenerate).',
    keyphrases: ['degenerate', 'layout'],
    startMs: 0,
    durationMs: 5000,
    // layout EXISTS but placed no nodes — the vacuous-perfect trap.
    layout: { nodes: [], edges: [] },
  };
}

/** Same scene but with a real, well-spread, non-overlapping layout. */
function wellLaidOutScene(): SceneGraph {
  return {
    ...nodelessLayoutScene(),
    layout: {
      nodes: [
        { id: 'n1', label: 'Node 1', x: 100, y: 100, width: 120, height: 60 },
        { id: 'n2', label: 'Node 2', x: 800, y: 500, width: 120, height: 60 },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    },
  };
}

function resultWith(scene: SceneGraph): PipelineResult {
  return {
    success: true,
    scenes: [scene],
    audioUrl: '/test.wav',
    duration: 60,
    processingTime: 10000,
    stages: [],
    outputPath: '/output/video.mp4',
    metrics: {},
  } as unknown as PipelineResult;
}

async function accuracyScore(scene: SceneGraph): Promise<number> {
  const monitor = new QualityMonitor();
  const assessment = await monitor.assessPipelineQuality(resultWith(scene));
  return assessment.accuracyScore;
}

describe('defect-9 empty→perfect-score sub-variant — quality-monitor fix', () => {
  // RED anchor: before the fix, an empty-nodes layout scored PERFECT (1.0) on
  // layout, so a degenerate scene scored EQUAL to a well-laid-out one — the
  // vacuous-perfect silent-pass. After the fix, empty nodes score 0, so the
  // degenerate scene scores strictly lower on accuracy. (Revert the fix → this
  // fails: the two become equal because both layouts score 1.0.)
  it('a nodeless layout scores STRICTLY LOWER than a real layout (no vacuous-perfect)', async () => {
    const empty = await accuracyScore(nodelessLayoutScene());
    const real = await accuracyScore(wellLaidOutScene());
    expect(real).toBeGreaterThan(empty);
  });

  // The deployment-readiness accuracy bar is 0.8. Before the fix, the
  // vacuous-perfect layout pushed a nodeless scene's accuracyScore ABOVE 0.8
  // (it "passed" on absent layout data). After the fix it falls below.
  it('a nodeless layout does NOT clear the 0.8 accuracy readiness bar', async () => {
    const empty = await accuracyScore(nodelessLayoutScene());
    expect(empty).toBeLessThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// ONE-PASS sibling audit: every empty/absent→default score resolver found in
// the sweep, classified. Unified on the class's defining question — "does
// empty/absent input yield a value that satisfies the module's OWN pass
// condition?" — so the FIXED site and the BY-DESIGN sites sit in one table and
// the class cannot be re-discovered under a new module next iteration.
// ---------------------------------------------------------------------------

interface AuditRow {
  module: string;
  scenario: string;
  /** True iff empty/absent input yields a value satisfying the module's own pass condition. */
  emptyPasses: () => boolean | Promise<boolean>;
  expected: boolean;
  classification: 'FIXED' | 'BY-DESIGN';
  reason: string;
}

const AUDIT: AuditRow[] = [
  {
    module: 'quality-monitor',
    scenario: 'scene with empty layout.nodes',
    emptyPasses: async () => (await accuracyScore(nodelessLayoutScene())) >= 0.8,
    expected: false,
    classification: 'FIXED',
    reason:
      'Empty node set used to score a PERFECT 1.0 layout (detectOverlaps([]) vacuously "no overlaps"), ' +
      'inflating accuracyScore past the 0.8 readiness bar. Now 0 — matches the file-wide empty→0 convention.',
  },
  {
    module: 'visual-balance-scorer',
    scenario: 'calculateVisualBalance([])',
    emptyPasses: () =>
      new VisualBalanceScorer().calculateVisualBalance([], { width: 1920, height: 1080 }).overallScore >= 0.7,
    expected: true,
    classification: 'BY-DESIGN',
    reason:
      'An empty layout is vacuously "balanced" (overallScore 1.0). It feeds the layout-auto-optimizer as a ' +
      'COMPARISON score (never a candidate the optimizer emits) and the quality-gate layoutQualityComposite ' +
      'criterion explicitly skips on no-data — so the perfect default never gates anything. Pinned, not changed.',
  },
  {
    module: 'pipeline-health-score',
    scenario: 'scoreCost(null) — no cost baseline',
    emptyPasses: () => scoreCost(null) >= 70,
    expected: true,
    classification: 'BY-DESIGN',
    reason:
      'No cost-baseline data ⇒ no cost penalty (score 100). "Cannot compare" is intentionally not a failure; ' +
      'a null comparison is legitimately absent, not a manufactured pass. Pinned by pipeline-health-score.test.ts.',
  },
  {
    module: 'performance-baseline',
    scenario: 'isWithinBaseline(unknown stage)',
    emptyPasses: () =>
      isWithinBaseline({ stage: 'brand-new-stage', durationMs: 999_999, memoryMB: 999_999, timestamp: 0 }),
    expected: true,
    classification: 'BY-DESIGN',
    reason:
      'A stage with no baseline cannot be declared a regression, so it is treated as "within baseline" (true). ' +
      'This is a fail-open-for-robustness choice (new stages do not instantly fail), distinct from a measured ' +
      'duration exceeding a known baseline. Pinned by performance-baseline.test.ts. Revisit only if a new stage ' +
      'silently masking a real regression becomes a live concern.',
  },
];

describe('defect-9 empty→perfect-score sub-variant — one-pass sibling audit', () => {
  it.each(AUDIT)(
    '$module / "$scenario" → empty passes own-gate = $expected ($classification)',
    async (row) => {
      const passes = await row.emptyPasses();
      expect(passes).toBe(row.expected);
    },
  );

  // Guards the FIX against regression and ensures the audit stays classified:
  // exactly one site is FIXED (the rest are documented BY-DESIGN), so adding a
  // new resolver forces a conscious classification rather than a silent default.
  it('audit is classified: the FIXED site fails its own gate on empty, BY-DESIGN sites pass', () => {
    const fixed = AUDIT.filter((r) => r.classification === 'FIXED');
    const byDesign = AUDIT.filter((r) => r.classification === 'BY-DESIGN');
    expect(fixed.length).toBeGreaterThanOrEqual(1);
    expect(fixed.every((r) => r.expected === false)).toBe(true);
    expect(byDesign.every((r) => r.expected === true)).toBe(true);
  });
});
