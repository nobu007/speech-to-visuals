/**
 * Phase 39: IterationManager - Automated Iteration Tracking & Management
 *
 * Implements the recursive development cycle from custom instructions:
 * - Tracks iterations within phases
 * - Manages success criteria validation
 * - Handles failure recovery strategies
 * - Automates commit trigger decisions
 * - Provides real-time iteration metrics
 *
 * Based on: Custom Instructions Section 2 (段階的開発フロー)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import { logger } from '../utils/logger';
import { safeArray } from '../lib/safe-array';

export type IterationStatus = 'in_progress' | 'success' | 'failure';
export type CommitTrigger = 'on_success' | 'on_checkpoint' | 'on_review';
export type RecoveryStrategy = 'retry' | 'fallback' | 'minimal' | 'manual';

export interface DevelopmentCycle {
  phase: string;
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: CommitTrigger;
  currentIteration: number;
  status: IterationStatus;
}

export interface IterationMetrics {
  iterationNumber: number;
  status: IterationStatus;
  timestamp: string;
  duration: number; // milliseconds
  successCriteria: {
    criterion: string;
    met: boolean;
    value?: unknown;
    threshold?: unknown;
  }[];
  metrics: Record<string, unknown>;
  error?: string;
  nextSteps?: string[];
}

export interface IterationHistory {
  phase: string;
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  iterations: IterationMetrics[];
  finalStatus: IterationStatus;
  insights: string[];
}

// ──────────────────────────────────────────────────────────────────────
// Criterion → threshold + metric-key resolution.
//
// Extracted to module scope (out of the checkCriterion body) so that
// checkCriterion and the DEVELOPMENT_CYCLES regression test share ONE
// definition and cannot drift apart. This is the structural fix for the
// recurring silent-pass class (defect 9): a criterion that carries a numeric
// bar but matches no keyword silently passed via the "any metric present →
// true" fallback. The exported helpers let a test enumerate every shipped
// criterion and prove none of its numeric SLOs is unmapped.
// ──────────────────────────────────────────────────────────────────────

/**
 * The numeric bar a criterion asserts, or null for a descriptive criterion
 * that states no bar. Recognizes:
 *  - a percent ("80%")                      → { threshold: 80,  isPercent: true }
 *  - a bare number ("95", or the "0" in
 *    "レイアウト破綻0")                        → { threshold,      isPercent: false }
 *  - a zero written as a WORD — ゼロ/零/〇/zero (defect 8: "ゼロクリティカル
 *    バグ" carries no ASCII digit)            → { threshold: 0,   isPercent: false }
 */
export function parseCriterionThreshold(
  criterion: string,
): { threshold: number; isPercent: boolean } | null {
  const percentMatch = criterion.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return { threshold: parseFloat(percentMatch[1]), isPercent: true };
  const numberMatch = criterion.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) return { threshold: parseFloat(numberMatch[1]), isPercent: false };
  if (/ゼロ|零|〇|\bzero\b/i.test(criterion)) return { threshold: 0, isPercent: false };
  return null;
}

/** True when the criterion carries a numeric/percent/zero-word bar. */
export function criterionHasNumericThreshold(criterion: string): boolean {
  return parseCriterionThreshold(criterion) !== null;
}

/**
 * Per-criterion keyword → candidate metric keys. ORDER MATTERS: specifics are
 * listed before generics so e.g. "シーン分割精度" resolves to
 * sceneSegmentationF1, not the generic accuracy/精度 entry. First matching
 * entry wins.
 */
const CRITERION_KEY_MAP: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/f1|分割|segment/i, ['sceneSegmentationF1', 'f1']],
  [/エンティティ|entity/i, ['entityExtractionF1']],
  [/関係|relation/i, ['relationAccuracy']],
  [/スコア|品質|score|quality/i, ['overallScore', 'overall_score', 'score']],
  [/成功率|success/i, ['successRate', 'success_rate']],
  [/精度|正確|accuracy|precision/i, ['accuracy', 'precision', 'transcriptionAccuracy']],
  // Label readability (0-1 fraction of non-truncated node labels, higher is
  // better). Estimated from the PipelineResult by the canonical
  // `estimateLabelReadability` (which delegates to the renderer's own
  // `sizeLabel` truncation predicate). "ラベル可読性100%" previously matched
  // NO key and fell through to the "any metric present → pass" fallback
  // (defect 7), so a layout with truncating labels silently satisfied its own
  // 100% readability SLO on the live FIP path.
  [/ラベル|可読性|label|readab/i, ['labelReadability']],
  [/エラー|error/i, ['errorRate']],
  // Crash / critical-bug defect-count criteria (lower is better). "ゼロクリテ
  // ィカルバグ" ("zero critical bugs") previously matched NO key and fell
  // through to the "any metric present → pass" fallback (defect 8): a run that
  // crashed still satisfied its own zero-crash SLO on the live FIP path.
  // `crashCount` is a real QualityMetrics field produced by the FIP, so this
  // mapping makes the gate fire on actual crash data.
  [/クリティカル|critical|crash|バグ|bug/i, ['crashCount']],
  // Layout defect-count criteria. All three are defect COUNTS (lower is better)
  // computed from the PipelineResult by the canonical estimators in
  // quality-estimators: layoutOverlap (overlapping node pairs), nodeOverflow
  // (off-canvas / unpositioned nodes), danglingLayoutEdges (edges whose
  // endpoints are absent from the node set). Specific keywords map to one
  // dimension; the generic "レイアウト破綻0" ("layout breakdowns: 0") maps to ALL
  // THREE because "breakdown" means any of them — and (AND-semantics in
  // checkCriterion) a multi-key defect criterion must hold for EVERY dimension,
  // not just the first present one, or an overflowing layout silently passes on
  // its overlap count alone. Bare English 'layout' is intentionally omitted so
  // "layout integrity" keeps the descriptive fallback (defect 5 + tests).
  [/はみ出し|overflow/i, ['nodeOverflow']],
  [/ズレ|dangling|misalign/i, ['danglingLayoutEdges']],
  [/レイアウト|破綻|overlap/i, ['layoutOverlap', 'nodeOverflow', 'danglingLayoutEdges']],
  // (defect 9) Test-pass-rate criteria. "テスト通過率100%" previously matched
  // NO key and silently passed on "any metric present". `testPassRate` is not
  // yet produced by the FIP (design-heavy), but MAPPING the keyword means the
  // gate now fails LOUD on the missing metric instead of silently passing — and
  // the regression test guarantees every shipped numeric SLO resolves to keys.
  [/通過率|テスト|test\s*pass/i, ['testPassRate', 'test_pass_rate']],
  // Time/duration criteria ("平均処理時間<60秒"). Listed LAST so a compound name
  // still wins on its more-specific keyword (成功率 → success, 精度 → accuracy).
  // The metric fields are milliseconds; they are reconciled against the seconds
  // bar in checkCriterion (defect 4).
  [/時間|処理時間|duration|processingtime|\btime\b/i,
    ['processingTime', 'processing_time', 'duration', 'durationMs', 'totalTime']],
];

/**
 * Resolve a criterion's keyword to candidate metric keys (first matching
 * CRITERION_KEY_MAP entry wins). Returns null when NO keyword matches — an
 * UNMAPPED SLO, the recurring silent-pass defect (defect 9).
 */
export function mapCriterionToKeys(criterion: string): readonly string[] | null {
  for (const [re, ks] of CRITERION_KEY_MAP) {
    if (re.test(criterion)) return ks;
  }
  return null;
}

// Generic fallback metric keys (priority order) used when a criterion's keyword
// matches no CRITERION_KEY_MAP entry. Shared by checkCriterion (the verdict)
// and resolveCriterionValue (the recorded value) so both resolve the SAME
// metric — they cannot drift apart. (defect 9 — see checkCriterion.)
const GENERIC_FALLBACK_KEYS = [
  'accuracy', 'precision', 'rate', 'score', 'pass_rate', 'success_rate',
] as const;

/**
 * The metric value a criterion would be evaluated against — the first
 * present candidate key (mapped keys, else GENERIC_FALLBACK_KEYS), mirroring
 * checkCriterion's first-present-wins resolution. Used to populate the
 * recorded IterationMetrics.successCriteria[].value with the value actually
 * evaluated, instead of the legacy `metrics[criterion]` (which indexed by the
 * full criterion string, e.g. "平均処理時間<60秒", and so was always undefined).
 */
function resolveCriterionValue(
  criterion: string,
  metrics: Record<string, unknown>,
): unknown {
  const keys = mapCriterionToKeys(criterion) ?? GENERIC_FALLBACK_KEYS;
  for (const key of keys) {
    if (metrics[key] === undefined) continue;
    return metrics[key];
  }
  return undefined;
}

/**
 * IterationManager: Manages the recursive development cycle
 */
export class IterationManager {
  private cycle: DevelopmentCycle;
  private history: IterationMetrics[] = [];
  private startTime: number = 0;
  private logPath: string;

  constructor(cycle: DevelopmentCycle, logPath?: string) {
    this.cycle = cycle;
    this.logPath = logPath || path.join(process.cwd(), 'docs', 'architecture', 'ITERATION_LOG.md');
  }

  /**
   * Start a new iteration
   */
  async startIteration(): Promise<void> {
    this.cycle.currentIteration++;
    this.startTime = Date.now();
    this.cycle.status = 'in_progress';
  }

  /**
   * Complete current iteration with results
   */
  async completeIteration(
    status: IterationStatus,
    metrics: Record<string, unknown>,
    error?: string
  ): Promise<IterationMetrics> {
    const duration = Date.now() - this.startTime;

    const iteration: IterationMetrics = {
      iterationNumber: this.cycle.currentIteration,
      status,
      timestamp: new Date().toISOString(),
      duration,
      successCriteria: safeArray(this.cycle.successCriteria).map(criterion =>
        this.recordCriterion(criterion, metrics, error),
      ),
      metrics,
      error,
      nextSteps: this.determineNextSteps(status),
    };

    this.history.push(iteration);
    await this.logIteration(iteration);

    return iteration;
  }

  /**
   * Build the per-criterion record for a completed iteration: the REAL verdict
   * (from checkCriterion — the same engine evaluateSuccessCriteria uses), the
   * resolved metric value, and the parsed numeric threshold.
   *
   * The legacy code recorded `met: status === 'success'` for EVERY criterion,
   * collapsing the per-criterion verdict evaluateSuccessCriteria had just
   * computed into one uniform boolean — so a soft-failure iteration (allMet
   * false) recorded even its passing criteria as not-met. It also set
   * `value: metrics[criterion]`, indexing by the full criterion string (e.g.
   * "平均処理時間<60秒") which is never a metrics key, so value/threshold were
   * always undefined. This records the actual evaluation instead.
   *
   * An errored iteration (`error` provided — a thrown run, or a result.error)
   * achieved none of its success criteria, so it keeps the all-not-met record.
   * This preserves the existing contract (tests pass an error and expect every
   * criterion not-met) and avoids spuriously marking a descriptive SLO met on
   * the {error, success:false} stub metrics of a thrown run.
   */
  private recordCriterion(
    criterion: string,
    metrics: Record<string, unknown>,
    error?: string,
  ): { criterion: string; met: boolean; value?: unknown; threshold?: unknown } {
    if (error) return { criterion, met: false };
    const thresholdInfo = parseCriterionThreshold(criterion);
    // silent=true: the gate (evaluateSuccessCriteria) already emits the
    // defect-9 loud-fail warning; the record must not duplicate it.
    return {
      criterion,
      met: this.checkCriterion(criterion, metrics, true),
      value: thresholdInfo === null ? undefined : resolveCriterionValue(criterion, metrics),
      threshold: thresholdInfo === null ? undefined : thresholdInfo.threshold,
    };
  }

  /**
   * Evaluate if current iteration meets success criteria
   */
  evaluateSuccessCriteria(metrics: Record<string, unknown>): {
    allMet: boolean;
    results: { criterion: string; met: boolean; reason?: string }[];
  } {
    const results = safeArray(this.cycle.successCriteria).map(criterion => {
      const met = this.checkCriterion(criterion, metrics);
      return {
        criterion,
        met,
        reason: met ? undefined : `Failed: ${criterion}`,
      };
    });

    const allMet = results.every(r => r.met);

    return { allMet, results };
  }

  /**
   * Check if a specific criterion is met.
   *
   * Parses (a) a comparison operator, (b) a numeric threshold — percent
   * ("accuracy > 80%") OR bare number ("全体品質スコア>95") — and (c) which
   * metric the criterion refers to (by keyword), then compares the first
   * present metric value against the threshold.
   *
   * Fixes the following defects in the original stub:
   *  1. Bare-number thresholds were never honored — `numberMatch` was
   *     computed then discarded, so criteria like "全体品質スコア>95" silently
   *     always passed (fell through to "any metric present").
   *  2. The comparison operator was ignored — every comparison used ">=", so
   *     a less-than criterion ("成功率<90%") was evaluated backwards.
   *  3. Percent thresholds are 0-100, but several metrics are 0-1 fractions
   *     (successRate, *F1, transcriptionAccuracy — see auto-improvement-engine
   *     QualityMetrics). A 0.90 accuracy compared with `>= 80` was always
   *     false. Fractions in [0,1] are now scaled to 0-100 when the threshold
   *     is a percent.
   *  4. Time-unit mismatch — time criteria ("平均処理時間<60秒") state the bar
   *     in SECONDS, but the metric fields (processingTime, duration, …) are
   *     MILLISECONDS. The time keyword was not in the key map, so the criterion
   *     fell through to "any metric present → pass": a 70-second run silently
   *     satisfied its own <60s performance SLO on the live framework path
   *     (FrameworkIntegratedPipeline → useFrameworkPipeline). Millisecond
   *     metrics are now scaled to seconds when the threshold is in seconds.
   *  5. Defect-count tautology — "レイアウト破綻0" ("layout breakdowns: 0") had
   *     no KEY_MAP entry, so it fell through to "any metric present → pass"; and
   *     even when mapped, the default ">=" operator at threshold 0 is a
   *     tautology (every non-negative count passes). The live FIP path therefore
   *     never caught a real overlap. `layoutOverlap` now resolves via KEY_MAP,
   *     and operator-less lower-is-better (defect-count) criteria use "<=" so a
   *     non-zero overlap count actually fails the gate.
   *  6. Single-dimension defect gate — "レイアウト破綻0" mapped to `layoutOverlap`
   *     ALONE, so a layout with zero overlaps but off-canvas nodes (overflow) or
   *     edges pointing at unplaced nodes (dangling) silently passed: "breakdown"
   *     was checked against one of three defect dimensions. The generic layout
   *     keyword now maps to all three defect COUNTS (`layoutOverlap`,
   *     `nodeOverflow`, `danglingLayoutEdges`) and a multi-key defect criterion
   *     must hold for EVERY present dimension (AND), so any one kind of
   *     breakdown fails the gate.
   *  7. Label-readability silent-pass — "ラベル可読性100%" matched NO key and fell
   *     through to "any metric present → pass": a layout whose node labels
   *     truncated silently satisfied its own 100% readability SLO. The
   *     ラベル/可読性 keyword now maps to `labelReadability` (estimated by the
   *     canonical `estimateLabelReadability`, which delegates to the renderer's
   *     own `sizeLabel` truncation predicate).
   *  8. Zero-as-a-word + unmapped crash key — "ゼロクリティカルバグ" ("zero
   *     critical bugs") carried no ASCII digit (the threshold is the WORD "ゼロ",
   *     not "0"), so the threshold was never parsed; and the クリティカル/バグ
   *     keyword matched NO key either. Both sent it to the "any metric present →
   *     pass" fallback, so a run WITH crashes silently satisfied its own
   *     zero-crash SLO on the live FIP path. A zero-word (ゼロ/零/〇/zero) is now
   *     recognized as threshold 0 (when no explicit number/percent is given), and
   *     the crash keyword maps to the real `crashCount` metric (a lower-is-better
   *     QualityMetrics field produced by the FIP).
   *
   * Criterion→key mapping is keyword-based and best-effort. The keyword→key
   * table lives at module scope (CRITERION_KEY_MAP), shared with the
   * DEVELOPMENT_CYCLES regression test via parseCriterionThreshold and
   * mapCriterionToKeys so the mapping and its coverage test cannot drift.
   *
   * 9. Unmapped / uncheckable-SLO silent-pass — a criterion that carries a
   *    numeric/percent/zero-word bar but resolves to ZERO checkable keys (its
   *    keyword matches no CRITERION_KEY_MAP entry, OR its mapped metric is
   *    absent this run) previously fell through to "any metric present → pass":
   *    the SLO silently passed on the mere presence of unrelated metrics.
   *    "テスト通過率100%" was the surviving instance — 通過率 matched no key and
   *    no test-result metric is produced by the FIP. Such an SLO now FAILS the
   *    gate with a warning naming the missing metric, so an unverifiable SLO
   *    can never silently pass again. Descriptive criteria (no numeric bar)
   *    keep the legacy "met when metrics reported" result.
   */
  // `silent` suppresses the defect-9 loud-fail warning. The gate
  // (evaluateSuccessCriteria) calls with silent=false (default) so an
  // unverifiable SLO is visible; completeIteration's record path calls with
  // silent=true so it does not duplicate the warning the gate already emitted.
  private checkCriterion(
    criterion: string,
    metrics: Record<string, unknown>,
    silent = false,
  ): boolean {
    // (a) Comparison operator; default ">=" (preserves the legacy default for
    // operator-less criteria like "シーン分割精度80%"). Operator-less
    // lower-is-better (defect-count) criteria are re-interpreted as "<=" below.
    const opMatch = criterion.match(/>=|<=|>|</);
    const op = opMatch?.[0] ?? '>=';
    const hasExplicitOperator = opMatch !== null;

    // (b) The numeric bar — percent, bare number, or a zero written as a word.
    // null ⇒ a descriptive criterion that states no bar. See
    // parseCriterionThreshold (shared with the regression test).
    const thresholdInfo = parseCriterionThreshold(criterion);
    if (!thresholdInfo) {
      // Descriptive criterion with no numeric bar — met whenever metrics were
      // reported (e.g. "音声入力→字幕付き動画出力が動作").
      return Object.keys(metrics).length > 0;
    }
    const { threshold, isPercent } = thresholdInfo;

    // (c) Which metric does this criterion quantify? Keyword → candidate keys,
    // first present key wins (specifics before generics — see CRITERION_KEY_MAP).
    // mappedKeys === null means the keyword matched no entry: an UNMAPPED SLO.
    const mappedKeys = mapCriterionToKeys(criterion);
    const possibleKeys = mappedKeys ?? GENERIC_FALLBACK_KEYS;

    // Metric fields expressed in MILLISECONDS (Date.now()/performance.now()
    // deltas). Time criteria express the threshold in seconds, so these must be
    // scaled ms→s before the comparison (defect 4).
    const MS_KEYS = new Set([
      'processingTime', 'processing_time', 'duration', 'durationMs', 'totalTime', 'renderTime',
    ]);
    // Defect-count metrics (lower is better). A criterion written WITHOUT an
    // explicit operator — e.g. "レイアウト破綻0" — means "at most this many
    // defects". The legacy ">=" default is a tautology at threshold 0 (every
    // non-negative count passes), so the layout SLO never fired on the live FIP
    // path. Operator-less lower-is-better criteria use "<=" instead; an explicit
    // operator is always honored as written (defect 5).
    const LOWER_IS_BETTER = new Set([
      'layoutOverlap', 'nodeOverflow', 'danglingLayoutEdges', 'errorRate', 'crashCount',
    ]);
    const isSecondsThreshold = /秒|secs?|seconds?/i.test(criterion);

    // Evaluate a single metric key against the threshold. Returns null when the
    // key is absent or non-finite (not checkable), otherwise pass/fail.
    const evaluateKey = (key: string): boolean | null => {
      if (metrics[key] === undefined) return null;
      const raw =
        typeof metrics[key] === 'number'
          ? (metrics[key] as number)
          : parseFloat(String(metrics[key]));
      if (!Number.isFinite(raw)) return null;
      // (defect 3) Normalize a 0-1 fraction to 0-100 for percent thresholds.
      // (defect 4) Scale a milliseconds metric to seconds when the threshold is
      // in seconds, so "平均処理時間<60秒" actually compares 70s < 60s rather
      // than 70000 < 60 (or silently passing via the unmapped-key fallback).
      let value = raw;
      if (isPercent && raw >= 0 && raw <= 1) {
        value = raw * 100;
      } else if (MS_KEYS.has(key) && isSecondsThreshold) {
        value = raw / 1000;
      }
      // (defect 5) An operator-less lower-is-better (defect-count) criterion
      // means "at most threshold" — flip the legacy ">=" default to "<=" so a
      // non-zero overlap/error count fails the gate instead of silently passing.
      const effectiveOp = !hasExplicitOperator && LOWER_IS_BETTER.has(key) ? '<=' : op;
      switch (effectiveOp) {
        case '>':
          return value > threshold;
        case '<':
          return value < threshold;
        case '<=':
          return value <= threshold;
        case '>=':
        default:
          return value >= threshold;
      }
    };

    // A defect-count criterion whose candidate keys are ALL lower-is-better —
    // e.g. "レイアウト破綻0" → layoutOverlap + nodeOverflow + danglingLayoutEdges
    // — must hold for EVERY dimension present, not just the first: "0 breakdowns"
    // means zero overlaps AND zero overflow AND zero dangling edges. The legacy
    // first-present-wins loop would silently pass a layout that only overflows.
    // Single-key criteria (and any criterion with a higher-is-better key) keep
    // first-present-wins, so existing mappings are unchanged.
    const allDefectKeys =
      possibleKeys.length > 1 && possibleKeys.every(k => LOWER_IS_BETTER.has(k));
    if (allDefectKeys) {
      let checked = 0;
      for (const key of possibleKeys) {
        const passed = evaluateKey(key);
        if (passed === null) continue;
        checked++;
        if (!passed) return false;
      }
      if (checked > 0) return true;
      // No defect key was present/finite → fall through to the loud fail (defect 9).
    } else {
      for (const key of possibleKeys) {
        const passed = evaluateKey(key);
        if (passed !== null) return passed;
      }
    }

    // (defect 9) LOUD fallback: a numeric bar was requested but NO candidate
    // key supplied a checkable value. The legacy code returned "met when any
    // metric is present" here — a SILENT PASS that let an unverifiable SLO
    // (e.g. "テスト通過率100%" before its metric is produced, or any future
    // unmapped criterion) pass the gate on the mere presence of unrelated
    // metrics. An SLO you cannot verify must NOT silently pass: fail loud with a
    // warning that names the criterion, its bar, and the missing metric, so the
    // gap is visible and actionable instead of a green light.
    // (defect 9) LOUD only at the gate: emit the warning unless `silent`
    // (the record path — completeIteration — already had the gate emit it).
    if (!silent) {
      if (mappedKeys === null) {
        logger.warn(
          `Iteration criterion "${criterion}" asserts a numeric bar ` +
          `(${threshold}${isPercent ? '%' : ''}) but matched NO known metric keyword ` +
          `(unmapped SLO). Failing the gate instead of silently passing — add a ` +
          `KEY_MAP entry or supply the metric.`,
        );
      } else {
        logger.warn(
          `Iteration criterion "${criterion}" asserts a numeric bar ` +
          `(${threshold}${isPercent ? '%' : ''}) but none of its candidate metrics ` +
          `(${mappedKeys.join(', ')}) were present/finite this run. Failing the ` +
          `gate instead of silently passing — supply the metric to make this SLO checkable.`,
        );
      }
    }
    return false;
  }

  /**
   * Determine recovery strategy based on iteration status
   */
  determineRecoveryStrategy(): RecoveryStrategy {
    if (this.history.length === 0) return 'retry';
    const failureRate = this.history.filter(i => i.status === 'failure').length / this.history.length;

    if (this.cycle.currentIteration >= this.cycle.maxIterations) {
      return 'fallback';
    }

    if (failureRate > 0.5) {
      return 'minimal';
    }

    if (this.cycle.currentIteration === 1) {
      return 'retry';
    }

    return 'retry';
  }

  /**
   * Determine if commit should be triggered
   */
  shouldCommit(): boolean {
    const lastIteration = this.history[this.history.length - 1];

    switch (this.cycle.commitTrigger) {
      case 'on_success':
        return lastIteration?.status === 'success';

      case 'on_checkpoint': {
        // Commit every N successful iterations or at max iterations
        const successCount = this.history.filter(i => i.status === 'success').length;
        return successCount > 0 && (successCount % 3 === 0 ||
               this.cycle.currentIteration >= this.cycle.maxIterations);
      }

      case 'on_review':
        // Only commit at phase completion
        return lastIteration?.status === 'success' &&
               this.cycle.currentIteration >= this.cycle.maxIterations;

      default:
        return false;
    }
  }

  /**
   * Generate commit message based on iteration history
   */
  generateCommitMessage(): string {
    const successCount = this.history.filter(i => i.status === 'success').length;
    const totalCount = this.history.length;

    let type = 'feat';
    if (successCount === totalCount && totalCount > 1) {
      type = 'refactor';
    } else if (successCount < totalCount) {
      type = 'fix';
    }

    const message = `${type}(${this.cycle.phase.toLowerCase()}): ` +
      `${this.cycle.phase} completion [iteration-${this.cycle.currentIteration}]\n\n` +
      `✅ Success Rate: ${successCount}/${totalCount} iterations\n` +
      `📊 Criteria Met: ${this.cycle.successCriteria.join(', ')}\n` +
      `⏱️  Total Duration: ${this.getTotalDuration()}s\n\n` +
      `🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n` +
      `Co-Authored-By: Claude <noreply@anthropic.com>`;

    return message;
  }

  /**
   * Get iteration summary
   */
  getSummary(): IterationHistory {
    const successCount = this.history.filter(i => i.status === 'success').length;
    const failureCount = this.history.filter(i => i.status === 'failure').length;

    return {
      phase: this.cycle.phase,
      totalIterations: this.history.length,
      successfulIterations: successCount,
      failedIterations: failureCount,
      iterations: this.history,
      finalStatus: this.history[this.history.length - 1]?.status || 'in_progress',
      insights: this.generateInsights(),
    };
  }

  /**
   * Generate insights from iteration history
   */
  private generateInsights(): string[] {
    const insights: string[] = [];
    if (this.history.length === 0) return insights;
    const successRate = this.history.filter(i => i.status === 'success').length / this.history.length;

    if (successRate === 1.0) {
      insights.push('Perfect success rate - all iterations successful');
    } else if (successRate >= 0.8) {
      insights.push('High success rate - implementation is stable');
    } else if (successRate >= 0.5) {
      insights.push('Moderate success rate - some adjustments needed');
    } else {
      insights.push('Low success rate - consider fallback strategy');
    }

    const avgDuration = this.history.reduce((sum, i) => sum + i.duration, 0) / this.history.length;
    if (avgDuration < 5000) {
      insights.push('Fast iteration cycles - good for rapid development');
    } else if (avgDuration > 30000) {
      insights.push('Long iteration cycles - consider optimization');
    }

    if (this.history.length >= this.cycle.maxIterations) {
      insights.push('Maximum iterations reached - phase completion achieved');
    }

    return insights;
  }

  /**
   * Determine next steps based on status
   */
  private determineNextSteps(status: IterationStatus): string[] {
    if (status === 'success') {
      if (this.cycle.currentIteration >= this.cycle.maxIterations) {
        return ['Phase completed successfully', 'Commit changes', 'Move to next phase'];
      }
      return ['Continue to next iteration', 'Validate improvements', 'Monitor metrics'];
    }

    const strategy = this.determineRecoveryStrategy();
    const steps: string[] = [];

    switch (strategy) {
      case 'retry':
        steps.push('Analyze failure cause', 'Apply targeted fixes', 'Retry iteration');
        break;
      case 'fallback':
        steps.push('Use fallback approach', 'Simplify implementation', 'Validate basic functionality');
        break;
      case 'minimal':
        steps.push('Return to minimal viable implementation', 'Re-validate requirements', 'Rebuild incrementally');
        break;
      case 'manual':
        steps.push('Manual intervention required', 'Review logs and metrics', 'Consult documentation');
        break;
    }

    return steps;
  }

  /**
   * Log iteration to ITERATION_LOG.md
   */
  private async logIteration(iteration: IterationMetrics): Promise<void> {
    try {
      let logContent = '';

      try {
        logContent = await fs.readFile(this.logPath, 'utf-8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          // File doesn't exist yet — create new
          logContent = '# Iteration History\n\nLast Updated: ' + new Date().toISOString() + '\n\n';
        } else {
          // Permission, disk, or other I/O error — log and rethrow to outer catch
          logger.error(`Failed to read iteration log at ${this.logPath}: ${err}`);
          throw err;
        }
      }

      const logEntry = `
## ${this.cycle.phase}

### Iteration ${iteration.iterationNumber} - ${iteration.status}
**Date**: ${iteration.timestamp}
**Duration**: ${(iteration.duration / 1000).toFixed(2)}s

**Metrics**:
${safeArray(Object.entries(iteration.metrics)).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

${iteration.error ? `**Error**:\n\`\`\`\n${iteration.error}\n\`\`\`\n` : ''}
**Next Steps**:
${safeArray(iteration.nextSteps).map(step => `- ${step}`).join('\n') || '- None'}

---

`;

      // Insert after header
      const lines = logContent.split('\n');
      const foundIndex = lines.findIndex(line => line.startsWith('## '));
      const insertIndex = foundIndex >= 0 ? foundIndex : 3;
      lines.splice(insertIndex, 0, logEntry);

      await fs.writeFile(this.logPath, lines.join('\n'), 'utf-8');
    } catch (error) {
      logger.warn(`Failed to log iteration: ${error}`);
    }
  }

  /**
   * Get total duration of all iterations
   */
  private getTotalDuration(): string {
    const total = this.history.reduce((sum, i) => sum + i.duration, 0);
    return (total / 1000).toFixed(2);
  }

  /**
   * Reset iteration manager for new phase
   */
  reset(): void {
    this.history = [];
    this.cycle.currentIteration = 0;
    this.cycle.status = 'in_progress';
  }
}

/**
 * Predefined development cycles from custom instructions
 */
export const DEVELOPMENT_CYCLES: Record<string, Omit<DevelopmentCycle, 'currentIteration' | 'status'>> = {
  'MVP構築': {
    phase: 'MVP構築',
    maxIterations: 3,
    successCriteria: ['音声入力→字幕付き動画出力が動作'],
    failureRecovery: '最小構成に戻って再構築',
    commitTrigger: 'on_success',
  },
  '内容分析': {
    phase: '内容分析',
    maxIterations: 5,
    successCriteria: ['シーン分割精度80%', '主要エンティティ抽出率90%', '関係性の正確性85%'],
    failureRecovery: 'ルールベースにフォールバック',
    commitTrigger: 'on_checkpoint',
  },
  '図解生成': {
    phase: '図解生成',
    maxIterations: 4,
    successCriteria: ['レイアウト破綻0', 'ラベル可読性100%'],
    failureRecovery: '手動レイアウトテンプレート使用',
    commitTrigger: 'on_review',
  },
  'E2E統合': {
    phase: 'E2E統合',
    maxIterations: 3,
    successCriteria: ['処理成功率>90%', '平均処理時間<60秒', '出力品質:視認可能'],
    failureRecovery: 'パイプライン分割実行',
    commitTrigger: 'on_success',
  },
  '品質向上': {
    phase: '品質向上',
    maxIterations: 5,
    successCriteria: ['全体品質スコア>95', 'テスト通過率100%', 'ゼロクリティカルバグ'],
    failureRecovery: '個別モジュール最適化',
    commitTrigger: 'on_checkpoint',
  },
};

/**
 * Create iteration manager for specific phase
 */
export function createIterationManager(
  phaseName: keyof typeof DEVELOPMENT_CYCLES,
  logPath?: string
): IterationManager {
  const cycleTemplate = DEVELOPMENT_CYCLES[phaseName];
  if (!cycleTemplate) {
    throw new PipelineConfigError('phaseName', `Unknown phase: ${phaseName}`);
  }

  const cycle: DevelopmentCycle = {
    ...cycleTemplate,
    currentIteration: 0,
    status: 'in_progress',
  };

  return new IterationManager(cycle, logPath);
}
