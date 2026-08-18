/**
 * Round-20 safe-aggregation migration oracles for the framework continent
 * (specs/finite-safe-aggregation TASK-0011).
 *
 * Sites:
 *
 *   continuous-learner.ts analyzeUserSatisfaction (was 497/502):
 *     averageRating / avgRating = reduce((sum, d) => sum + (d.userFeedback || 0), 0) / n
 *     `userFeedback` enters through the UNVALIDATED public
 *     `learnFromUserFeedback(rating)` boundary (no 1-5 clamp), and the `|| 0`
 *     falsy-guard zero-SUBSTITUTED a non-finite rating — dragging the mean
 *     toward 0 and able to spuriously satisfy the `< 3.0` low-satisfaction
 *     insight on acceptable feedback.
 *
 *   recursive-custom-instructions.ts calculateModuleScore (was 295-299):
 *     metrics = Object.values(...).filter(v => typeof v === 'number')
 *     mean over the filter output. `typeof v === 'number'` ADMITS NaN and
 *     ±Infinity — exactly what a validity filter exists to reject — so one
 *     non-finite metric made the module score NaN, propagating through
 *     calculateOverallScore into the `passed = overallScore >= 0.8` gate
 *     (NaN comparison → false → silent fail) or, for +Infinity, an absurd
 *     always-pass.
 *
 * behavior change (non-finite sample only): the poisoned sample is EXCLUDED
 * (D2) instead of zero-substituted (learner) or collapsing the mean to NaN
 * (module score).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMean } from '@stv/core/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';
import { ContinuousLearner } from '@/framework/continuous-learner';
import { RecursiveCustomInstructionsFramework } from '@/framework/recursive-custom-instructions';

const here = path.dirname(fileURLToPath(import.meta.url));
const learnerSource = readFileSync(
  path.join(here, '../../src/framework/continuous-learner.ts'),
  'utf8',
);
const rciSource = readFileSync(
  path.join(here, '../../src/framework/recursive-custom-instructions.ts'),
  'utf8',
);

/**
 * Legacy learner fold, replicated: `|| 0` zero-substitutes non-finite ratings.
 * (Was feedbackData.reduce((sum, d) => sum + (d.userFeedback || 0), 0) / n.)
 */
const legacyRatingMean = (ratings: number[]): number =>
  ratings.reduce((sum, r) => sum + (r || 0), 0) / ratings.length;

/**
 * Legacy module-score fold, replicated: `typeof` filter admits non-finite
 * numbers. (Was Object.values(m).filter(typeof number) then reduce/n.)
 */
const legacyModuleScore = (moduleResults: Record<string, unknown>): number => {
  const metrics = Object.values(moduleResults).filter((v) => typeof v === 'number');
  return metrics.length > 0
    ? (metrics as number[]).reduce((sum, val) => sum + val, 0) / metrics.length
    : 0;
};

// ---------------------------------------------------------------------------
// Numeric-delta oracle: finite inputs are value-identical to the legacy folds
// ---------------------------------------------------------------------------

describe('learner rating means: finite ratings are value-identical', () => {
  test('safeMean(ratings) === legacy || 0 fold (300 seeded cases)', () => {
    const rng = createLayoutRng('round20|userFeedback-means');
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rng() * 15);
      const ratings = Array.from({ length: n }, () => 1 + Math.floor(rng() * 5));
      // The population is pre-filtered to `userFeedback !== undefined`; on
      // that population `?? NaN` never fires, so the map is the identity.
      expect(safeMean(ratings)).toBe(legacyRatingMean(ratings));
    }
  });

  test('zero is a legitimate rating and stays in the population', () => {
    // The legacy `|| 0` was a falsy-guard on a field whose contract is 1-5 —
    // 0 itself is not a legal rating, but if it ever occurs it must NOT be
    // dropped by the new code either (population semantics unchanged).
    expect(safeMean([0, 5])).toBe(legacyRatingMean([0, 5]));
    expect(safeMean([0, 5])).toBe(2.5);
  });
});

describe('module score: finite metrics are value-identical, non-numbers still excluded', () => {
  test('safeMean(Object.values(m)) === legacy typeof-filter fold (300 seeded cases)', () => {
    const rng = createLayoutRng('round20|module-score');
    for (let i = 0; i < 300; i++) {
      const module: Record<string, unknown> = {};
      const keys = 1 + Math.floor(rng() * 8);
      for (let k = 0; k < keys; k++) {
        // Mix numeric metrics with the non-numbers the real check results
        // carry (`issues: string[]`) plus strings/booleans/null.
        const kind = rng();
        if (kind < 0.6) module[`metric${k}`] = Math.round(rng() * 100) / 100;
        else if (kind < 0.7) module[`metric${k}`] = 'text';
        else if (kind < 0.8) module[`metric${k}`] = ['an issue'];
        else if (kind < 0.9) module[`metric${k}`] = true;
        else module[`metric${k}`] = null;
      }
      expect(safeMean(Object.values(module) as unknown as readonly number[])).toBe(legacyModuleScore(module));
    }
  });

  test('a module of ONLY non-numbers scores 0 (legacy else-branch preserved)', () => {
    expect(safeMean(Object.values({ issues: [], note: 'x' }) as unknown as readonly number[])).toBe(0);
    expect(legacyModuleScore({ issues: [], note: 'x' })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior-change oracle: poisoned samples are excluded, not substituted/NaN
// ---------------------------------------------------------------------------

describe('learner: NaN rating no longer manufactures a low-satisfaction insight', () => {
  async function learnerWithRatings(ratings: number[]): Promise<ContinuousLearner> {
    const tl = new ContinuousLearner(false); // no interval — drive manually
    for (let i = 0; i < ratings.length; i++) {
      await tl.learnFromProcessingResult('ui_comp', {}, {}, 1000, 0.9, true, [], {});
    }
    const db = (tl as unknown as { learningDatabase: Array<{ id: string }> }).learningDatabase;
    for (let i = 0; i < ratings.length; i++) {
      await tl.learnFromUserFeedback(db[i].id, ratings[i]);
    }
    return tl;
  }

  test('9x rating 3 + 1 NaN: legacy mean 2.7 fired the insight, safeMean keeps it at 3.0', async () => {
    const ratings = [3, 3, 3, 3, 3, 3, 3, 3, 3, Number.NaN];
    // Legacy: (9*3 + 0) / 10 = 2.7 < 3.0 → spurious "Low user satisfaction"
    // (true satisfaction is exactly the 3.0 acceptance line).
    expect(legacyRatingMean(ratings)).toBe(2.7);
    // New: the NaN rating leaves the population → mean of the nine 3s.
    expect(safeMean(ratings)).toBe(3);

    const tl = await learnerWithRatings(ratings);
    const internal = tl as unknown as { analyzeUserSatisfaction: () => Promise<void> };
    await internal.analyzeUserSatisfaction();

    const fired = tl
      .getSystemInsights()
      .some((i) => i.description === 'Low user satisfaction in ui_comp');
    expect(fired).toBe(false);
  });

  test('genuinely low ratings still fire the insight (gate semantics intact)', async () => {
    const tl = await learnerWithRatings([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const internal = tl as unknown as { analyzeUserSatisfaction: () => Promise<void> };
    await internal.analyzeUserSatisfaction();

    const fired = tl
      .getSystemInsights()
      .some((i) => i.description === 'Low user satisfaction in ui_comp');
    expect(fired).toBe(true);
  });
});

describe('module score: non-finite metric can no longer NaN/Infinity the gate', () => {
  const fw = new RecursiveCustomInstructionsFramework();
  const internal = fw as unknown as {
    calculateModuleScore: (m: Record<string, unknown>) => number;
    calculateOverallScore: (t: Record<string, Record<string, unknown>>) => number;
    evaluateResults: (t: Record<string, Record<string, unknown>>) => Promise<{
      passed: boolean;
      score: number;
    }>;
  };

  test('NaN metric: legacy module score was NaN, new score excludes it', () => {
    const module = { sceneSegmentation: Number.NaN, diagramDetection: 0.78, relationshipExtraction: 0.75 };
    // Legacy: typeof filter admits NaN → mean NaN → overallScore NaN →
    // `passed = NaN >= 0.8` false (silent fail).
    expect(Number.isNaN(legacyModuleScore(module))).toBe(true);
    expect(internal.calculateModuleScore(module)).toBeCloseTo((0.78 + 0.75) / 2, 15);
  });

  test('+Infinity metric: legacy was always-pass absurdity, new is finite', () => {
    const module = { layoutQuality: Number.POSITIVE_INFINITY, labelReadability: 1.0, renderPerformance: 0.88 };
    expect(legacyModuleScore(module)).toBe(Number.POSITIVE_INFINITY);
    const score = internal.calculateModuleScore(module);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeCloseTo((1.0 + 0.88) / 2, 15);
  });

  test('evaluateResults keeps a meaningful passed verdict on a poisoned module', async () => {
    // All four modules carry one poisoned metric each; the finite metrics
    // average 0.5 — below the 0.8 gate — so `passed` must be FALSE for a
    // reason the caller can act on, not false because the score was NaN.
    // (Every number-valued field is a metric to this formula, `duration`
    // included, so all values are kept at 0.5 to keep the arithmetic legible.)
    const testResults = {
      transcription: { accuracy: Number.NaN, confidence: 0.5, duration: 0.5, issues: [] },
      analysis: { sceneSegmentation: 0.5, diagramDetection: Number.NaN, relationshipExtraction: 0.5, issues: [] },
      visualization: { layoutQuality: 0.5, labelReadability: 0.5, renderPerformance: Number.NaN, issues: [] },
      integration: { pipelineFlow: 0.5, errorHandling: 0.5, memoryUsage: Number.NaN, issues: [] },
    };
    const evaluation = await internal.evaluateResults(testResults);
    expect(Number.isFinite(evaluation.score)).toBe(true);
    expect(evaluation.score).toBeCloseTo(0.5, 12);
    expect(evaluation.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source anchors: the legacy expressions stay migrated
// ---------------------------------------------------------------------------

describe('source anchor: legacy folds are gone, safeMean delegates remain', () => {
  test('continuous-learner.ts (analyzeUserSatisfaction 497/502)', () => {
    expect(learnerSource).not.toMatch(
      /sum \+ \(d\.userFeedback \|\| 0\), 0\)/,
    );
    expect(learnerSource.match(/safeMean\(\w+\.map\(d => d\.userFeedback \?\? NaN\)\)/g)?.length).toBe(2);
  });

  test('recursive-custom-instructions.ts (calculateModuleScore)', () => {
    expect(rciSource).not.toMatch(/filter\(v => typeof v === 'number'\)/);
    expect(rciSource).not.toMatch(/metrics\.reduce\(\(sum: number, val: number\) => sum \+ val, 0\)/);
    expect(rciSource).toMatch(/safeMean\(Object\.values\(moduleResults\) as number\[\]\)/);
  });
});
