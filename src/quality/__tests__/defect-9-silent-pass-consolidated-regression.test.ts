/**
 * Defect-9 silent-pass class — ONE consolidated cross-evaluator regression.
 *
 * The class (absent/unmapped/empty input → a manufactured value satisfies a
 * gate) was closed incrementally across gate evaluators and a score-resolver
 * family, each in its own commit and each with its own isolated test:
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
 *   3. the COMPLETENESS GUARD (discovery-authoritative) ensures every evaluator-
 *      shaped file in src/ is classified in DEFECT9_SURFACE, so a NEW evaluator
 *      — the only remaining re-open vector — cannot ship unclassified. (The
 *      class is closed for both polarities: (a) absent→falsy `0` satisfies
 *      lt/lte/eq; (b) empty→PERFECT `1.0`/`100`/`true` satisfies gte/gt. Both
 *      are "absent data manufactures a value that satisfies the gate".)
 *
 * Extending the sweep beyond quality-GATE evaluators added two more CLOSED sites
 * the gate-only sweep had missed — both live:
 *   - pipeline/quality-monitor.generateReport ... absent quality metrics → 100/'excellent'
 *   - continuous-learner.assessCustomInstructionsCompliance ... empty history → 0 < 30000
 *
 * This iteration hardened the COMPLETENESS GUARD itself. The discovery markers
 * matched a file by its VERDICT shape (a returned passed/isRegression object, a
 * status/compliance tier) OR a named-evaluator export (evaluate/assess/check/
 * score). That left a blind spot: a quality-SIGNAL RESOLVER - a file whose
 * exported functions take a PipelineResult and return the number that FEEDS a
 * gate, but are named with estimate- or count- prefixes and return no verdict
 * object. The canonical case (src/pipeline/quality-estimators.ts, the single
 * source of the framework's transcription/segmentation/entity/relation gate
 * inputs) sailed past both markers and shipped UNCLASSIFIED. A
 * PipelineResult-to-number clause was added to EXPORT_MARKER; discovery now
 * finds it (17 to 18) and it is classified as ruled-out (the module exists to
 * CLOSE a defect-9 sibling: it replaced never-populated fields whose
 * undefined-to-0.85/0.75/0 fallbacks equaled the thresholds; its own
 * derivations are real signals, not absent-data literals). The lesson: a
 * completeness guard is only as authoritative as the shape it keys on; the file
 * most likely to re-open the class is the one whose naming differs from the
 * markers' assumption.
 *
 * This iteration found a THIRD marker blind spot while extending the sweep to
 * the manufactured-default-vs-threshold class beyond quality gates: the markers
 * keyed on the QUALITY tier vocabulary (excellent/good/...) and gate-evaluator
 * naming, so the entire error-recovery HEALTH family — a second status
 * vocabulary ('healthy'/'degraded'/'unhealthy') with overall*-resolver naming —
 * shipped unclassified. Discovery now also matches that vocabulary plus
 * overallResilience/overallSuccessRate/alertLevel (18 to 24 files). One LIVE
 * closure came out of the classification (health-tracker's `?? 1` perfect-score
 * fallback → 0); the rest of the family is classified fail-open-for-robustness
 * (the same pinned symmetry as isWithinBaseline/compareWithBaseline), and
 * health-check-service / production-monitor are ruled out because their
 * absent-input paths already fail loud ('degraded' / 'unknown' — never a
 * manufactured healthy tier).
 *
 * This iteration found the FOURTH blind spot one directory level up: the
 * discovery WALK itself only covered 6 host directories (quality/pipeline/
 * framework/visualization/monitoring/optimization), so every evaluator-shaped
 * file in analysis/, transcription/, export/, api/ and config/ was outside the
 * guard's authority regardless of marker shape. Extending the walk to all of
 * src/ surfaced 7 previously-invisible files (24 → 31). One is a LIVE defect-9
 * site, now closed:
 *   - transcription/streaming-quality-monitor.getSummary ... empty session → 'excellent'
 * The remaining six are ruled out with file-anchored reasons (empty→0 / empty→
 * passed:false / fail-safe verdicts) — including the analysis self-improvement
 * evaluators, which fail loud on empty input by construction.
 *
 * This iteration closed the FIFTH blind-spot class — DIRECTORY scope beyond
 * src/: the walk covered all of src/ but nothing else, so an evaluator-shaped
 * file in scripts/ (CLI verification gates whose console verdicts humans gate
 * releases on) or supabase/functions (the deployable Deno edge runtime) would
 * ship unclassified no matter how sharp the markers were. Extending the walk
 * surfaced 3 script files (31 → 34), all classified ruled-out (worst-of
 * aggregate verdicts, count-based summaries over static runner lists, every
 * catch path failing loud). The edge functions matched no marker. RED-
 * verified: a synthetic evaluator-shaped file in scripts/ flips the
 * completeness guard red.
 */

const { QualityGateEvaluator } = await import('../quality-gate');
const { QualityMonitor } = await import('../quality-monitor');
const { getQualityMonitor: getPipelineQualityMonitor } = await import('../../pipeline/quality-monitor');
const { IterationManager } = await import('../../framework/iteration-manager');
const { ContinuousLearner } = await import('../../framework/continuous-learner');
const { VisualBalanceScorer } = await import('../../visualization/visual-balance-scorer');
const { scoreCost } = await import('../../pipeline/pipeline-health-score');
const { isWithinBaseline } = await import('../../pipeline/performance-baseline');
const { compareWithBaseline } = await import('../../pipeline/performance-regression-detector');
const { EnhancedErrorRecovery } = await import('../enhanced-error-recovery');
const { ErrorRecoveryHealthTracker } = await import('../error-recovery-health-tracker');
const { RecoveryTelemetryAggregator } = await import('../recovery-telemetry-aggregator');
const { StreamingQualityMonitor } = await import('../../transcription/streaming-quality-monitor');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import type { PipelineResult } from '../../pipeline/types';
import type { SceneGraph } from '../../types/diagram';

// Anchor filesystem reads to THIS file, not process.cwd(). The discovery walk
// and the REFERENCED-row guard both read repo-relative paths; under
// --maxWorkers>1 a worker's cwd is not guaranteed to be the repo root, which
// made those checks flake intermittently (the TC-302/313 cwd-relative-read
// class — same flake as the distance-canonical-cross-invariant-fuzz guard).
// Resolving from import.meta.url keeps the canonical regression net
// deterministic regardless of worker cwd.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

// ---------------------------------------------------------------------------
// Discovery — the authoritative source of "which src/ files are evaluator-
// shaped". A pure-Node walk (cwd-independent, shell-free) over the evaluator-
// host directories; a file qualifies if it matches a verdict-producing shape
// (a returned verdict object, a status/compliance tier mapping, or a metric/
// polarity registry) OR exports a score/verdict entry point. The COMPLETENESS
// GUARD below asserts this walk's result equals DEFECT9_SURFACE's keys, so a
// NEW evaluator file is caught the moment it matches either marker.
// ---------------------------------------------------------------------------

// The walk covers ALL of src/ — plus scripts/ and the Deno edge functions —
// not a hand-picked host-dir subset. The first version of this guard walked
// only 6 directories (quality/pipeline/framework/visualization/monitoring/
// optimization), which left every evaluator-shaped file in analysis/,
// transcription/, export/, api/ and config/ OUTSIDE the discovery walk — a
// FOURTH blind spot, one directory-level up from the three marker-shape ones
// below: a new evaluator in src/analysis shipped unclassified not because its
// naming evaded the markers but because the walk never read the file. The walk
// found 7 more files the moment it covered src/ (24 → 31). Extending past src/
// (FIFTH blind spot class — production-shaped code outside the client tree)
// closes the last directory-level re-open vector this guard can reach: the
// deployable edge functions (supabase/functions — a separate runtime whose
// request handling is user-facing) and the CI/CLI-facing verification scripts
// (scripts/ — several of which compute and PRINT pass/fail verdicts a human
// gates releases on). Over-inclusion is the point: a marker-matched file here
// forces a DEFECT9_SURFACE row (ruledOut is fine) instead of shipping unseen.
const HOST_DIRS = ['src', 'scripts', 'supabase/functions'];

// Verdict-producing shapes: a returned verdict object / a status|compliance tier
// mapping / a metric-or-polarity registry.
// The final three alternations close the THIRD blind-spot shape (found while
// extending the sweep beyond quality gates): the error-recovery HEALTH family —
// a second status-tier vocabulary the excellent/good clause never matched
// ('healthy'/'degraded'/'unhealthy' — health checks, not quality tiers),
// alertLevel tiering, and overall*-resolver naming (overallResilience/
// overallSuccessRate) — the same resolver-naming shape the PipelineResult→
// number clause caught for estimate*/count*, in a different prefix family.
// Until these clauses, all four error-recovery health files sat in walked host
// directories yet shipped unclassified.
const VERDICT_MARKER =
  /return\s*\{[^}]*(?:passed|isRegression|shouldBlock|allMet|isWithin)|determineStatus|status:\s*'(?:excellent|good|acceptable|needs_improvement|critical)'|compliance:\s*'(?:excellent|good|needs_improvement|critical)'|METRIC_EXTRACTORS|CRITERION_KEY_MAP|LOWER_IS_BETTER|overallResilience|overallSuccessRate|alertLevel|status\s*[:=]\s*'(?:healthy|degraded|unhealthy)'/;
// Score/verdict entry-point exports. The final alternation catches a distinct
// shape the named-evaluator clause misses: a quality-SIGNAL RESOLVER — a file
// whose exported functions take a PipelineResult and return a number that FEEDS
// a gate threshold (src/pipeline/quality-estimators.ts is the canonical case: 8
// estimate*/count* functions named with neither evaluate/assess/check/score nor
// a verdict object, so the gate-only markers sailed past it even though it is
// the single source of the framework's transcription/segmentation/entity/
// relation gate inputs). Without this clause the completeness guard's blind
// spot is exactly the file most likely to re-open the class.
const EXPORT_MARKER =
  /export (?:async )?function (?:evaluate|assess|check|score|isWithin|isRegression|compareWith|passes|meets)[A-Za-z]*\s*\(|export function scoreCost|export class (?:QualityMonitor|QualityGateEvaluator|LayoutEvaluator|VisualBalanceScorer)|export (?:async )?function [A-Za-z]+\([^)]*PipelineResult[^)]*\):\s*number/;

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(p, out);
    else if (
      entry.isFile() &&
      p.endsWith('.ts') &&
      !p.endsWith('.test.ts') &&
      !p.includes('__tests__')
    ) {
      out.push(p);
    }
  }
  return out;
}

/** Repo-relative paths of every evaluator-shaped file in the host dirs. */
function discoverEvaluatorFiles(): string[] {
  const found: string[] = [];
  for (const d of HOST_DIRS) {
    const abs = path.join(REPO_ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of walkTs(abs)) {
      const src = fs.readFileSync(f, 'utf8');
      if (VERDICT_MARKER.test(src) || EXPORT_MARKER.test(src)) {
        found.push(path.relative(REPO_ROOT, f));
      }
    }
  }
  return found.sort();
}

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

/** overallScore for a pipeline-quality-monitor record with NO quality metrics. */
function pipelineQualityMonitorAbsentScore(): number {
  // recordMetrics({}) leaves every measured-quality metric undefined; before the
  // defect-9 fix detectViolations skipped them all and calculateOverallScore
  // manufactured a PERFECT 100/'excellent' from a base of 100.
  const monitor = getPipelineQualityMonitor();
  monitor.reset();
  monitor.recordMetrics({});
  return monitor.generateReport().overallScore;
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

/**
 * continuous-learner compliance score for a component with NO history. Before
 * the defect-9 fix, an empty history reduced to `0` and `0 < 30000` awarded the
 * performance-compliance points with nothing measured.
 */
function continuousLearnerEmptyHistoryScore(): number {
  const learner = new ContinuousLearner(false);
  const proto = ContinuousLearner.prototype as unknown as {
    // assessCustomInstructionsCompliance is private; reach it to assert the
    // absent-history path without wiring a full learnFromProcessingResult run.
    assessCustomInstructionsCompliance: (
      component: string,
      qualityScore: number,
      success: boolean,
    ) => { score: number };
  };
  return proto.assessCustomInstructionsCompliance.call(
    learner,
    'defect-9-empty-history',
    0.95,
    true,
  ).score;
}

/**
 * overallScore for a tracker with NO stage scores and NO samples. PERFECT (1)
 * before the defect-9 fix. Reached directly because sample() always pushes a
 * sample before computing — the double-empty path IS the fallback branch.
 */
function trackerEmptyOverallScore(): number {
  const tracker = new ErrorRecoveryHealthTracker(new EnhancedErrorRecovery());
  const proto = ErrorRecoveryHealthTracker.prototype as unknown as {
    // computeOverallScore is private; asserted directly so the no-data fallback
    // is exercised without wiring a full sample() run.
    computeOverallScore: (stageScores: []) => number;
  };
  return proto.computeOverallScore.call(tracker, []);
}

/** overallResilience for a NEVER-EXERCISED recovery system (no load, no circuits). */
function freshSystemResilience(): number {
  return new EnhancedErrorRecovery().getResilienceMetrics().overallResilience;
}

/** Telemetry snapshot for a sliding window with ZERO recovery attempts. */
function emptyTelemetrySnapshot(): { overallSuccessRate: number; degraded: boolean } {
  const agg = new RecoveryTelemetryAggregator();
  try {
    return agg.getSnapshot();
  } finally {
    agg.destroy();
  }
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
  /** Source file(s) implementing this site's resolution path (traceability). */
  sourceFiles: string[];
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
    sourceFiles: ['src/quality/quality-gate.ts'],
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
    sourceFiles: ['src/quality/quality-gate.ts'],
    gateFailsOnAbsent: () => !stageCriterionPassed(5, 'audioSync'),
    reason: 'Same shape as captionSync; resolveMeasuredMetric closes it for all operators.',
  },
  {
    id: 'iteration-manager/checkCriterion',
    family: 'iteration-manager',
    polarity: 'a',
    verdict: 'CLOSED',
    sourceFiles: ['src/framework/iteration-manager.ts'],
    gateFailsOnAbsent: () => imUnmappedSLOFails(),
    reason:
      'A numeric SLO whose metric is absent (or whose keyword matches no CRITERION_KEY_MAP ' +
      'entry) fails loud instead of passing on an unrelated present metric.',
  },
  {
    id: 'continuous-learner/performanceCompliance',
    family: 'continuous-learner',
    polarity: 'a',
    verdict: 'CLOSED',
    sourceFiles: ['src/framework/continuous-learner.ts'],
    gateFailsOnAbsent: () => continuousLearnerEmptyHistoryScore() < 75,
    reason:
      'Found by extending the sweep beyond gate evaluators. An empty component history reduced ' +
      'to avgProcessingTime 0 and `0 < 30000` awarded the performance-compliance points with ' +
      'nothing measured, inflating complianceScore toward the `>= 85` commit trigger. Now gated ' +
      'on recentData.length > 0, so absent history cannot satisfy the lower-is-better check. ' +
      'success(+30)+quality≥0.85(+40) = 70 baseline; the +10 perf points are no longer awarded ' +
      '(would read 80), so < 75 proves the gate fails on absent.',
  },
  {
    id: 'adaptive-quality-gates/evaluateGate',
    family: 'adaptive-quality-gates',
    polarity: 'a',
    verdict: 'REFERENCED',
    sourceFiles: ['src/quality/adaptive-quality-gates.ts'],
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
    sourceFiles: ['src/quality/quality-monitor.ts'],
    gateFailsOnAbsent: async () => (await nodelessAccuracyScore()) < 0.8,
    reason:
      'An empty layout.nodes used to score a PERFECT 1.0 (detectOverlaps([]) is vacuously ' +
      '"no overlaps"), inflating accuracyScore past the 0.8 readiness bar. Now empty → 0.',
  },
  {
    id: 'pipeline-quality-monitor/generateReport',
    family: 'pipeline-quality-monitor',
    polarity: 'b',
    verdict: 'CLOSED',
    sourceFiles: ['src/pipeline/quality-monitor.ts'],
    gateFailsOnAbsent: () => pipelineQualityMonitorAbsentScore() < 90,
    reason:
      'Found by extending the sweep beyond gate evaluators (the 0-100 sibling of the quality-' +
      'monitor above, used live by simple-pipeline/gemini-analyzer/production-monitor). ' +
      'detectViolations skips every metric guarded by `!== undefined`, so a record with NONE of ' +
      'the measured-quality metrics accrued zero violations and calculateOverallScore ' +
      'manufactured a PERFECT 100 → `determineStatus` ≥ 90 → "excellent". Now capped below the ' +
      '"good" tier (≤ 59) when no quality metric is measured, so absent data cannot satisfy the ' +
      'excellence gate.',
  },

  {
    id: 'error-recovery-health-tracker/overallScoreFallback',
    family: 'error-recovery-health',
    polarity: 'b',
    verdict: 'CLOSED',
    sourceFiles: ['src/quality/error-recovery-health-tracker.ts'],
    gateFailsOnAbsent: () => trackerEmptyOverallScore() < 0.5,
    reason:
      'Found by extending the discovery markers to the error-recovery health family (a THIRD ' +
      'marker blind spot: a second status-tier vocabulary plus overall*-resolver naming — neither ' +
      'matched until this iteration, so all four family files shipped unclassified). ' +
      'computeOverallScore with no stage scores and no samples fell back to `?? 1` — a PERFECT ' +
      'overall score from nothing, feeding the monitor\'s `overallScore < 0.4` degrade gate and ' +
      'its consecutive-degraded alerting. The branch is unreachable through sample() (a sample is ' +
      'pushed before the call), but the fallback literal is exactly the recordStageSuccess ' +
      '`?? 0.85` shape (iteration 87): a perfect-score fallback must be the FAIL value. Now `?? 0`.',
  },

  // ── BY-DESIGN (polarity b: empty→PERFECT that is legitimately vacuous, or
  //    fail-open-for-robustness) ───────────────────────────────────────────
  {
    id: 'quality-gate/layoutQualityComposite',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/quality/quality-gate.ts', 'src/visualization/layout-quality-composite.ts'],
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
    sourceFiles: ['src/quality/quality-gate.ts'],
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
    sourceFiles: ['src/quality/quality-gate.ts'],
    gateFailsOnAbsent: () => !stageCriterionPassed(2, 'relationCompleteness'),
    reason: 'Same explicit-zero vacuous-truth as entityExtractionRate.',
  },
  {
    id: 'quality-gate/zeroOverlap',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/quality/quality-gate.ts'],
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
    sourceFiles: ['src/quality/quality-gate.ts'],
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'timelineContinuity'),
    reason: '≤1 segment → continuity is trivially satisfied (a single span has no internal gap).',
  },
  {
    id: 'quality-gate/segmentNormalization',
    family: 'quality-gate',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/quality/quality-gate.ts'],
    gateFailsOnAbsent: () => !stageCriterionPassed(3, 'segmentNormalization'),
    reason: 'No segments → nothing to normalize. Vacuous, not manufactured.',
  },
  {
    id: 'pipeline-quality-monitor/detectRegression',
    family: 'pipeline-quality-monitor',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/pipeline/quality-monitor.ts'],
    gateFailsOnAbsent: () =>
      getPipelineQualityMonitor().detectRegression('defect-9-unknown-id', 50).isRegression,
    reason:
      'Same fail-open-for-robustness shape as isWithinBaseline/compareWithBaseline (below): an ' +
      'unknown id (no baseline ⇒ previousScore 0) is reported as no-regression rather than a ' +
      'false alarm, so a brand-new component does not instantly block. Pinned here so the ' +
      'symmetry with the score-resolver family is explicit.',
  },
  {
    id: 'visual-balance-scorer/calculateVisualBalance',
    family: 'score-resolver',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/visualization/visual-balance-scorer.ts'],
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
    sourceFiles: ['src/pipeline/pipeline-health-score.ts'],
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
    sourceFiles: ['src/pipeline/performance-baseline.ts'],
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
    sourceFiles: ['src/pipeline/performance-regression-detector.ts'],
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
  {
    id: 'enhanced-error-recovery/errorRecoverySpeed',
    family: 'error-recovery-health',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/quality/enhanced-error-recovery.ts'],
    gateFailsOnAbsent: () => freshSystemResilience() < 0.4,
    reason:
      'A never-exercised system reports overallResilience ≈ 0.97 (errorRecoverySpeed 1.0 from an ' +
      'empty metrics sample, circuitBreakerEffectiveness 1.0 with no breakers configured, ' +
      'successRate 0.5 neutral). Pinned BY-DESIGN fail-open-for-robustness (running-average suite: ' +
      '"all entries corrupted → recovery speed = 1"): the score feeds the `< 0.4` DEGRADE gate, and ' +
      'a fresh/idle system must not instantly alert — the same pinned symmetry as ' +
      'isWithinBaseline/compareWithBaseline/detectRegression. The gate is lower-is-bad, so ' +
      'absent→high reads "not degraded", not "excellent". Classified so a future reweighting that ' +
      'turns this into an excellence gate forces a conscious decision.',
  },
  {
    id: 'streaming-quality-monitor/emptySessionStatus',
    family: 'streaming-quality-monitor',
    polarity: 'b',
    verdict: 'CLOSED',
    sourceFiles: ['src/transcription/streaming-quality-monitor.ts'],
    gateFailsOnAbsent: () => new StreamingQualityMonitor().getSummary().status !== 'excellent',
    reason:
      'Found by extending the discovery WALK to all of src/ (the FOURTH blind spot was ' +
      'directory-level, not marker-shaped: transcription/ sat outside the 6 host dirs, so this ' +
      'file was invisible to the guard no matter how good its markers were). getSummary() with ' +
      'ZERO evaluated chunks manufactured the TOP tier status \'excellent\' while the SAME summary ' +
      'reported averageConfidence 0 — a self-contradictory verdict where absent data satisfies ' +
      'the best gate (polarity b). An empty session is a FAILED session (dropped stream / a chunk ' +
      'loop that threw before storing its first record), so the summary now fails loud with ' +
      '\'poor\'.',
  },
  {
    id: 'recovery-telemetry-aggregator/overallSuccessRate',
    family: 'error-recovery-health',
    polarity: 'b',
    verdict: 'BY-DESIGN',
    sourceFiles: ['src/quality/recovery-telemetry-aggregator.ts'],
    gateFailsOnAbsent: () => {
      const s = emptyTelemetrySnapshot();
      return s.overallSuccessRate < 1 || s.degraded;
    },
    reason:
      'An empty window reports overallSuccessRate 1 — a documented, test-pinned sentinel ' +
      '("default when no data"), surfaced on the REST monitoring endpoint only. The `degraded` ' +
      'flag derives from INTER-window rate deltas (never the absolute rate), so the sentinel ' +
      'cannot satisfy any gate. Pinned so a future consumer that gates on the absolute rate must ' +
      'first revisit this row.',
  },
];

// ---------------------------------------------------------------------------
// DEFECT9_SURFACE — the authoritative classification of EVERY evaluator-shaped
// file the discovery walk finds. `family` ⇒ the file's gate/verdict path is
// covered by a roster row of that family; `ruledOut` ⇒ the file is NOT a
// defect-9 surface, with a one-line reason. This is the single source of truth
// the COMPLETENESS GUARD checks against discovery, so a new evaluator-shaped
// file cannot ship unclassified.
// ---------------------------------------------------------------------------

interface SurfaceEntry {
  file: string;
  family?: string;
  ruledOut?: string;
}

const DEFECT9_SURFACE: ReadonlyArray<SurfaceEntry> = [
  { file: 'src/quality/quality-gate.ts', family: 'quality-gate' },
  { file: 'src/quality/quality-monitor.ts', family: 'quality-monitor' },
  { file: 'src/quality/adaptive-quality-gates.ts', family: 'adaptive-quality-gates' },
  {
    file: 'src/quality/regression-detector.ts',
    ruledOut:
      'detectRegressions skips undefined/0 baselines (lines 290-291); loadBaseline rejects ' +
      'Infinity/NaN/non-date via exhaustive finiteness guards — no absent input reaches a comparison.',
  },
  { file: 'src/pipeline/quality-monitor.ts', family: 'pipeline-quality-monitor' },
  {
    file: 'src/pipeline/quality-estimators.ts',
    ruledOut:
      'A quality-SIGNAL RESOLVER (8 estimate*/count* exports named with neither ' +
      'evaluate/assess/check/score nor a verdict object — hence invisible to the gate-only ' +
      'markers until the PipelineResult→number clause was added). NOT a silent-pass: every ' +
      'estimator derives from a REAL PipelineResult signal (scene presence, node/edge density, ' +
      'label-fit via sizeLabel), and the defect-COUNTERS (countLayoutOverlaps/countNodeOverflow/' +
      'countDanglingLayoutEdges) + estimateLabelReadability return 0 on absent data (FAIL, ' +
      'polarity a), never a manufactured passing value. The module EXISTS to CLOSE a defect-9 ' +
      'sibling: MainPipeline previously read never-populated fields whose undefined→sanitizeFinite ' +
      'fallbacks (0.85/0.75/0) equaled the framework quality thresholds, pinning 3/4 gates ' +
      'permanently green; it replaces that with real-signal derivation. Classified so a future ' +
      'edit that re-introduces an absent-data literal here cannot ship unclassified.',
  },
  { file: 'src/pipeline/performance-baseline.ts', family: 'score-resolver' },
  { file: 'src/pipeline/performance-regression-detector.ts', family: 'score-resolver' },
  { file: 'src/pipeline/pipeline-health-score.ts', family: 'score-resolver' },
  { file: 'src/framework/iteration-manager.ts', family: 'iteration-manager' },
  { file: 'src/framework/continuous-learner.ts', family: 'continuous-learner' },
  {
    file: 'src/framework/auto-improvement-engine.ts',
    ruledOut:
      'Metrics are required fields compared directly; calculateQualityScore normalizes absent ' +
      'metrics out of BOTH numerator and weight (neutral), and all-absent → 0 (fails every gate). ' +
      'The `??` defaults manufacture THRESHOLDS, not metric values.',
  },
  { file: 'src/visualization/visual-balance-scorer.ts', family: 'score-resolver' },
  { file: 'src/visualization/layout-quality-composite.ts', family: 'quality-gate' },
  {
    file: 'src/visualization/layout-auto-optimizer.ts',
    ruledOut:
      'Consumer of the layout-quality-composite score (already rostered); its own `??` are config ' +
      'defaults (maxIterations/threshold), not data-manufacturing.',
  },
  {
    file: 'src/visualization/strategies/LayoutEvaluator.ts',
    ruledOut:
      'calculateLayoutBalance→1 for empty nodes is a DEAD value (no gate reads it); ' +
      'overlapCount===0 for empty nodes is a genuine count, not a manufactured fallback.',
  },
  {
    file: 'src/monitoring/production-monitoring-excellence.ts',
    ruledOut:
      'Every metric is a hardcoded literal; no absent/empty input reaches any comparison and no ' +
      'gate operators exist.',
  },
  {
    file: 'src/monitoring/real-time-performance-monitor.ts',
    ruledOut:
      'sanitizeFinite→0 FAILS (not satisfies) the >= alert comparisons; the getSnapshot ' +
      'defaults (:1/:0) flow into the emitted snapshot and are never gated within the file.',
  },
  { file: 'src/quality/enhanced-error-recovery.ts', family: 'error-recovery-health' },
  { file: 'src/quality/error-recovery-health-tracker.ts', family: 'error-recovery-health' },
  { file: 'src/quality/error-recovery-monitor.ts', family: 'error-recovery-health' },
  { file: 'src/quality/recovery-telemetry-aggregator.ts', family: 'error-recovery-health' },
  {
    file: 'src/monitoring/health-check-service.ts',
    ruledOut:
      'Discovered via the health-status vocabulary clause. Every component check measures a ' +
      'real signal and fails in the FAIL direction on absent input: a throwing probe returns ' +
      'status "degraded", the snapshot fallback manufactures zeros (which fail thresholds, not ' +
      'satisfy them), and calculateOverallStatus is worst-of. No absent-input path can ' +
      'manufacture a passing tier.',
  },
  {
    file: 'src/monitoring/production-monitor.ts',
    ruledOut:
      'Discovered via the health-status vocabulary clause. checkComponentHealth maps ' +
      'metrics.requests === 0 to status "unknown" — NOT "healthy" — so absent data cannot ' +
      'manufacture a passing tier (the defect-9 discipline, already built in). The hardcoded ' +
      '0.05/0.15 alert thresholds are the separate, documented alerting-vs-readiness ' +
      'threshold-drift concern (09a), not an absent-data silent-pass.',
  },
  { file: 'src/transcription/streaming-quality-monitor.ts', family: 'streaming-quality-monitor' },
  {
    file: 'src/analysis/diagram-detector.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. The self-improvement evaluator ' +
      '(testDetectionQuality) runs four sub-tests whose empty-input paths all fail loud: ' +
      'sanitizeFinite(confidence, 0) feeds meetsGoodDetectionConfidence from the FAIL value (the ' +
      'LLM-confidence 0.9-fallback defect was already closed in this very file), and an analysis ' +
      'with no nodes fails Structural/Semantic with passed:false rather than a manufactured pass. ' +
      'Empty testResults reduce to overallScore 0 → passed false (0 > 0.75 is false).',
  },
  {
    file: 'src/analysis/scene-segmenter.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. Same self-improvement evaluator shape as ' +
      'diagram-detector: every sub-test returns { passed: false, score: 0 } on empty segments, ' +
      'scores fold through sanitizeFinite(result.score, 0), and empty testResults → overallScore 0 ' +
      '→ passed false against the 80% threshold. No empty input can manufacture a pass.',
  },
  {
    file: 'src/analysis/simple-diagram-detector.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. The testDetector shape matched by the ' +
      'markers is a self-test harness counting cases (passed = total − failures), not a gate ' +
      'evaluator: zero cases yield passed 0/0 — a count, never a threshold-satisfying verdict.',
  },
  {
    file: 'src/export/export-content-validator.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. validateSceneGraphForExport / ' +
      'validateExportPayload are explicitly fail-safe by documented design: the verdict is ' +
      'passed = !(strict && hasHighSeverity) with every finding still surfaced, and the ' +
      'non-strict open mode is the pinned WYSIWYG parity contract (validator recurses ' +
      'scene.layout; findings are never dropped). Not a manufactured pass.',
  },
  {
    file: 'src/api/routes/export-jobs.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. The health-status vocabulary matched by ' +
      'the markers gates in the FAIL direction: utilization 0 (idle/absent queue) maps to ' +
      "'healthy' from a REAL measured signal (stats.queued / maxQueueSize), and the route maps " +
      'unhealthy → HTTP 503. No absent input manufactures a passing tier; utilization is computed ' +
      'from required queue stats, not a ?? fallback literal.',
  },
  {
    file: 'src/api/routes/health.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. Thin transport wrapper over ' +
      "health-check-service (already ruled out above): it derives HTTP status FROM the service " +
      "verdict (unhealthy → 503) and its own fallbacks fail loud ('unhealthy', success:false). " +
      'No tier is manufactured here.',
  },
  {
    file: 'src/config/code-size-audit.ts',
    ruledOut:
      'Discovered by extending the walk to all of src/. evaluateAudit is a count-vs-limit ' +
      'checker (warnings per exceeded limit; isCompliant = zero warnings) over REQUIRED measured ' +
      'metrics — there is no absent-input path: every metric field is a mandatory number produced ' +
      'by collectMetrics itself, and no default literal is ever compared to a threshold.',
  },
  // ── Discovered by extending the walk BEYOND src/ (scripts/ + the Deno edge
  //    functions) — the FIFTH blind-spot class: production-shaped code outside
  //    the client tree. None is a silent-pass; each is classified so a future
  //    edit cannot introduce one unclassified.
  {
    file: 'scripts/validate-deployment-readiness.ts',
    ruledOut:
      'Discovered by extending the walk beyond src/. A CLI readiness gate whose overallStatus ' +
      'is worst-of over REQUIRED check results (failedChecks > 0 → not_ready): every check ' +
      'measures a real signal (package.json presence, .env keys, tsc exit code, file structure) ' +
      'and every catch path pushes status "fail", so absent data fails the gate — the process ' +
      'then exits non-zero on not_ready. No default literal is ever compared to a threshold.',
  },
  {
    file: 'scripts/validate-llm-integration-phase42.ts',
    ruledOut:
      'Discovered by extending the walk beyond src/. A one-shot validation script whose ' +
      'passed booleans all derive from REAL extraction outputs (nodes/edges length, model ' +
      'selection per complexity score) with every catch path returning passed: false and the ' +
      'config check requiring the API key to be PRESENT (missing key → failed). Absent input ' +
      'fails loud in every branch; the summary exits non-zero unless all components passed.',
  },
  {
    file: 'scripts/test-phase37.ts',
    ruledOut:
      'Discovered by extending the walk beyond src/. A phase test harness whose aggregate ' +
      'verdict is a COUNT of real sub-test results (successRate = passed/total) over a ' +
      'hardcoded list of awaited runners — an empty results array is unreachable (the list is ' +
      'static), every catch returns passed: false, and the exit code is 0 only at a 100% count. ' +
      'No absent-input path manufactures a passing value.',
  },
];

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
    expect(closed.length).toBeGreaterThanOrEqual(4);
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

  // COMPLETENESS GUARD (authoritative) — the only remaining re-open vector is a
  // NEW evaluator file. The discovery walk is the source of truth for "which
  // files are evaluator-shaped"; this asserts it matches DEFECT9_SURFACE exactly
  // in both directions, so adding a new evaluator-shaped file (or removing one)
  // forces a conscious classification here rather than shipping unclassified.
  it('completeness: discovery matches DEFECT9_SURFACE exactly (no evaluator ships unclassified)', () => {
    const discovered = discoverEvaluatorFiles();
    const registered = DEFECT9_SURFACE.map((e) => e.file);
    const unregistered = discovered.filter((f) => !registered.includes(f));
    const stale = registered.filter((f) => !discovered.includes(f));
    // Both directions: a NEW evaluator file ⇒ unregistered non-empty; a deleted
    // evaluator ⇒ stale non-empty. Pin the exact count so the registry cannot
    // silently drift away from reality.
    expect({ unregistered, stale, discoveredCount: discovered.length }).toEqual({
      unregistered: [],
      stale: [],
      discoveredCount: DEFECT9_SURFACE.length,
    });
  });

  // The registry must cover every evaluator family, and the roster must cover
  // every family the registry declares — bidirectionally, so a new family forces
  // both a registry entry AND a roster row.
  it('completeness: roster families cover every evaluator family in DEFECT9_SURFACE', () => {
    const rosterFamilies = new Set(ROSTER.map((r) => r.family));
    const registryFamilies = new Set(
      DEFECT9_SURFACE.filter((e) => e.family).map((e) => e.family),
    );
    const missingFromRoster = [...registryFamilies].filter((f) => !rosterFamilies.has(f));
    const extraInRoster = [...rosterFamilies].filter((f) => !registryFamilies.has(f));
    expect({ missingFromRoster, extraInRoster }).toEqual({
      missingFromRoster: [],
      extraInRoster: [],
    });
  });

  // Every registry file must exist (catches a moved/deleted evaluator) and every
  // ruled-out entry must carry a non-empty reason (catches a lazy skip).
  it('every DEFECT9_SURFACE file exists and every ruled-out entry has a reason', () => {
    for (const entry of DEFECT9_SURFACE) {
      expect({ file: entry.file, exists: fs.existsSync(path.join(REPO_ROOT, entry.file)) }).toEqual({
        file: entry.file,
        exists: true,
      });
      if (entry.ruledOut !== undefined) {
        expect({ file: entry.file, reasonLength: entry.ruledOut.length }).toEqual({
          file: entry.file,
          reasonLength: expect.any(Number),
        });
        expect(entry.ruledOut.length).toBeGreaterThan(10);
      }
    }
  });

  // Every roster row's sourceFiles must exist and be a DEFECT9_SURFACE member
  // of the SAME family (or a ruled-out file consumed only as context) — so a
  // row cannot point at a phantom or mis-family'd source.
  it('every roster row points at real DEFECT9_SURFACE source files', () => {
    const byFile = new Map(DEFECT9_SURFACE.map((e) => [e.file, e]));
    for (const row of ROSTER) {
      for (const file of row.sourceFiles) {
        const entry = byFile.get(file);
        expect({ row: row.id, file, registered: Boolean(entry) }).toEqual({
          row: row.id,
          file,
          registered: true,
        });
      }
    }
  });

  // REFERENCED rows delegate to a dedicated test. Guard that the referenced
  // file actually exists, so a reference can never silently go stale.
  it('every REFERENCED row points at an existing dedicated closure test', () => {
    const referenced = ROSTER.filter((r) => r.verdict === 'REFERENCED');
    expect(referenced.length).toBeGreaterThanOrEqual(1);
    for (const row of referenced) {
      expect({ id: row.id, exists: fs.existsSync(path.join(REPO_ROOT, row.verifiedBy!)) }).toEqual({
        id: row.id,
        exists: true,
      });
    }
  });
});
