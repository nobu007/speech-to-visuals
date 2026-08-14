/**
 * Defect-9 silent-pass class — parameterized regression table for the
 * StageQualityGate criteria. This is the THIRD gate evaluator closed for the
 * class (after adaptive-quality-gates.extractMetricValue and
 * iteration-manager.checkCriterion).
 *
 * The class: a criterion resolves its metric with a falsy default (`?? 0`) and
 * that default silently satisfies a lower-is-better (`lt`/`lte`) or equality
 * (`eq`) threshold, so an UNMEASURED SLO passes. The closed instances were
 * captionSync / audioSync: an ABSENT sync offset manufactured a perfect 0 ms
 * (`?? 0`) and `0 <= 50` PASSED, so an uncaptioned render silently satisfied its
 * own caption-sync SLO.
 *
 * Rather than re-discover the class under a new operator/typo, this table drives
 * the ABSENT-metric case for EVERY default-gate criterion and pins the verdict.
 * The rows split into three groups:
 *   1. CLOSED defect-9 — absent must FAIL (captionSync, audioSync). The fix
 *      (resolveMeasuredMetric) routes absent → null → fail for ANY operator, so
 *      a future threshold/polarity change cannot re-open these.
 *   2. SAFE-by-accident — absent already fails because the default 0 does NOT
 *      satisfy the comparison (higher-is-better `>= n` with n > 0, or
 *      lower-is-better `< -30`). Pinned anyway: they are safe only because of
 *      today's threshold sign, and a threshold change would silently flip them
 *      to a silent-pass without this guard.
 *   3. PASS-BY-DESIGN — absent/empty input is legitimately vacuous or an
 *      explicit skip (no expected entities; ≤1 segment; no nodes to overlap;
 *      composite "skipped"). Listed so a future change forces a conscious
 *      decision rather than a silent drift.
 *
 * The completeness guard asserts every default-gate criterion has a row, so a
 * newly added criterion cannot ship without its absent-behavior being pinned.
 */

const { QualityGateEvaluator, createDefaultQualityGates } = await import('../quality-gate');

interface AbsentRow {
  stage: number;
  criterion: string;
  /** Verdict when the metric is ABSENT / input is empty `{}`. */
  absentPassed: boolean;
  /** Why this verdict is correct (and, for pass-by-design, why it is NOT the class). */
  reason: string;
}

const TABLE: AbsentRow[] = [
  // ---- Stage 1 (Transcription): absent → FAIL (safe-by-accident) ----
  { stage: 1, criterion: 'audioDuration', absentPassed: false, reason: 'higher-is-better `>= 1.0`; absent default 0 fails' },
  { stage: 1, criterion: 'sampleRate', absentPassed: false, reason: 'higher-is-better `>= 16000`; absent default 0 fails' },
  { stage: 1, criterion: 'noiseLevel', absentPassed: false, reason: 'lower-is-better `< -30`, but threshold is negative so default 0 does NOT satisfy (0 < -30 is false)' },

  // ---- Stage 2 (Analysis): two pass-by-design, one fail ----
  { stage: 2, criterion: 'entityExtractionRate', absentPassed: true, reason: 'PASS-BY-DESIGN: no expected entities (expected===0) — cannot fail extraction of nothing; not a manufactured value' },
  { stage: 2, criterion: 'relationCompleteness', absentPassed: true, reason: 'PASS-BY-DESIGN: no expected relations (expected===0); vacuous, not a manufactured default' },
  { stage: 2, criterion: 'schemaConformance', absentPassed: false, reason: 'absent → `?? false` → fails (boolean default, not numeric)' },

  // ---- Stage 3 (Layout): pass-by-design (vacuous on empty input) ----
  { stage: 3, criterion: 'zeroOverlap', absentPassed: true, reason: 'PASS-BY-DESIGN: empty nodes → genuinely zero overlaps (vacuous truth of a real property, not a manufactured 0)' },
  { stage: 3, criterion: 'timelineContinuity', absentPassed: true, reason: 'PASS-BY-DESIGN: ≤1 segment → continuity trivially satisfied' },
  { stage: 3, criterion: 'segmentNormalization', absentPassed: true, reason: 'PASS-BY-DESIGN: no segments → nothing to normalize' },
  { stage: 3, criterion: 'layoutQualityComposite', absentPassed: true, reason: 'PASS-BY-DESIGN: no layout data → explicit documented "skipped" verdict' },

  // ---- Stage 4 (Render Prep): the CLOSED defect-9 instance + safe sibling ----
  { stage: 4, criterion: 'captionSync', absentPassed: false, reason: 'CLOSED defect-9: absent offset must NOT manufacture 0ms and satisfy `<= 50`; resolveMeasuredMetric → fail' },
  { stage: 4, criterion: 'layoutConsistency', absentPassed: false, reason: 'higher-is-better `>= 0.9`; absent default 0 fails' },

  // ---- Stage 5 (Render Final): the CLOSED defect-9 instance + safe siblings ----
  { stage: 5, criterion: 'resolution', absentPassed: false, reason: 'higher-is-better `>= 720`; absent default 0 fails' },
  { stage: 5, criterion: 'fps', absentPassed: false, reason: 'higher-is-better `>= 30`; absent default 0 fails' },
  { stage: 5, criterion: 'audioSync', absentPassed: false, reason: 'CLOSED defect-9: absent offset must NOT manufacture 0ms and satisfy `<= 50`; resolveMeasuredMetric → fail' },
];

describe('defect-9 silent-pass class — quality-gate absent-metric regression table', () => {
  it.each(TABLE)(
    'stage $stage "$criterion" → absent metric passed=$absentPassed ($reason)',
    (row) => {
      const evaluator = new QualityGateEvaluator();
      const result = evaluator.evaluateStage(row.stage, {});
      const cr = result.results.find((r) => r.criterionName === row.criterion);
      expect(cr).toBeDefined();
      expect(cr!.passed).toBe(row.absentPassed);
    },
  );

  // RED-verification anchor: the two CLOSED instances. If the `?? 0` default is
  // restored (revert of resolveMeasuredMetric), these flip to passed:true and
  // fail — locking the closure against regression.
  it('RED anchor: captionSync and audioSync FAIL on absent offset (not silent-pass)', () => {
    const evaluator = new QualityGateEvaluator();
    const stage4 = evaluator.evaluateStage(4, {}).results.find((r) => r.criterionName === 'captionSync');
    const stage5 = evaluator.evaluateStage(5, {}).results.find((r) => r.criterionName === 'audioSync');
    expect(stage4?.passed).toBe(false);
    expect(stage5?.passed).toBe(false);
    expect(stage4?.details).toMatch(/not provided|unverifiable|defect 9/i);
    expect(stage5?.details).toMatch(/not provided|unverifiable|defect 9/i);
  });

  // Distinguishes ABSENT (unverifiable → fail) from a MEASURED 0 (perfect sync
  // → pass). The original bug conflated them; this pins the distinction so a
  // future "absent → 0" revert cannot hide behind an explicit-0 test.
  it('ABSENT ≠ measured-0: explicit offset 0 PASSES, absent FAILS', () => {
    const evaluator = new QualityGateEvaluator();
    const captionMeasured0 = evaluator.evaluateStage(4, { captionSyncOffsetMs: 0 }).results.find((r) => r.criterionName === 'captionSync');
    const audioMeasured0 = evaluator.evaluateStage(5, { audioSyncOffsetMs: 0 }).results.find((r) => r.criterionName === 'audioSync');
    expect(captionMeasured0?.passed).toBe(true);
    expect(audioMeasured0?.passed).toBe(true);
  });

  // Completeness guard: every default-gate criterion must have a pinned row, so
  // a NEW criterion cannot ship without its absent-behavior being decided.
  it('completeness: every default-gate criterion is pinned (no silent new criterion)', () => {
    const evaluator = new QualityGateEvaluator();
    const pinned = new Set(TABLE.map((r) => `${r.stage}:${r.criterion}`));
    const unpinned: string[] = [];
    for (let stage = 1; stage <= 5; stage++) {
      const result = evaluator.evaluateStage(stage, {});
      for (const r of result.results) {
        if (r.criterionName === 'gateNotFound') continue;
        if (!pinned.has(`${stage}:${r.criterionName}`)) {
          unpinned.push(`${stage}:${r.criterionName}`);
        }
      }
    }
    expect(unpinned).toEqual([]);
  });
});
