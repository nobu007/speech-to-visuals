/**
 * Extended tests for IterationManager — covers paths not exercised by the base suite.
 *
 * Focus areas:
 *   - checkCriterion with string metrics, multiple metric keys, parseFloat path
 *   - determineRecoveryStrategy edge cases (iteration 1 retry, failureRate boundaries)
 *   - shouldCommit on_checkpoint at maxIterations with non-3 multiple
 *   - generateCommitMessage: refactor type, success-only with single iteration
 *   - generateInsights: high, moderate, fast, slow, max-iterations paths
 *   - determineNextSteps: retry, fallback, minimal branches
 *   - getSummary with empty history (in_progress)
 *   - getTotalDuration formatting
 *   - DEVELOPMENT_CYCLES content validation
 *   - createIterationManager with all 5 predefined phases
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  IterationManager,
  createIterationManager,
  DEVELOPMENT_CYCLES,
  criterionHasNumericThreshold,
  mapCriterionToKeys,
  type DevelopmentCycle,
  type IterationStatus,
} from '../iteration-manager';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@/utils/logger';

function makeCycle(overrides: Partial<DevelopmentCycle> = {}): DevelopmentCycle {
  return {
    phase: 'TestPhase',
    maxIterations: 5,
    successCriteria: ['accuracy > 80%'],
    failureRecovery: 'fallback',
    commitTrigger: 'on_success',
    currentIteration: 0,
    status: 'in_progress',
    ...overrides,
  };
}

function tmpLogPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'im-ext-')), 'log.md');
}

describe('IterationManager — extended coverage', () => {

  // ── checkCriterion via evaluateSuccessCriteria ──────────────────────

  describe('evaluateSuccessCriteria — metric key resolution', () => {
    test('matches "precision" metric key for percent criteria', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['precision > 75%'],
      }), tmpLogPath());
      const result = mgr.evaluateSuccessCriteria({ precision: 80 });
      expect(result.allMet).toBe(true);
    });

    test('matches "rate" metric key', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['rate > 50%'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ rate: 60 }).allMet).toBe(true);
      expect(mgr.evaluateSuccessCriteria({ rate: 40 }).allMet).toBe(false);
    });

    test('matches "score" metric key', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['score > 70%'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ score: 75 }).allMet).toBe(true);
    });

    test('matches "pass_rate" metric key', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['pass_rate > 90%'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ pass_rate: 95 }).allMet).toBe(true);
    });

    test('matches "success_rate" metric key', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['success_rate > 85%'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ success_rate: 90 }).allMet).toBe(true);
    });

    test('parses string metric values via parseFloat', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ accuracy: '85.5' }).allMet).toBe(true);
    });

    test('falls back to "any metrics exist" for non-percent criteria', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['layout integrity'],
      }), tmpLogPath());
      expect(mgr.evaluateSuccessCriteria({ foo: 1 }).allMet).toBe(true);
      expect(mgr.evaluateSuccessCriteria({}).allMet).toBe(false);
    });

    test('multiple criteria — partial pass', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%', 'precision > 90%'],
      }), tmpLogPath());
      const result = mgr.evaluateSuccessCriteria({ accuracy: 85, precision: 50 });
      expect(result.allMet).toBe(false);
      expect(result.results[0].met).toBe(true);
      expect(result.results[1].met).toBe(false);
      expect(result.results[1].reason).toContain('Failed');
    });
  });

  // ── determineRecoveryStrategy edge cases ─────────────────────────────

  describe('determineRecoveryStrategy — edge cases', () => {
    test('returns retry at iteration 1 with history and low failure rate', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 5,
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      // currentIteration=1, failureRate=0
      expect(mgr.determineRecoveryStrategy()).toBe('retry');
    });

    test('returns minimal when exactly 50% failures (boundary)', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 10,
      }), tmpLogPath());
      // 2 failures out of 4 = 0.5 → >0.5 is false, so NOT minimal
      for (let i = 0; i < 2; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('failure', {});
      }
      for (let i = 0; i < 2; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      // failureRate = 0.5, not >0.5, currentIteration=4 < maxIterations=10
      // Should return 'retry' (not 'minimal')
      expect(mgr.determineRecoveryStrategy()).toBe('retry');
    });

    test('returns minimal when >50% failures', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 10,
      }), tmpLogPath());
      // 3 failures out of 4 = 0.75 > 0.5
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('failure', {});
      }
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.determineRecoveryStrategy()).toBe('minimal');
    });

    test('fallback takes precedence over minimal at max iterations', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 2,
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      // currentIteration=2 >= maxIterations=2 → fallback
      expect(mgr.determineRecoveryStrategy()).toBe('fallback');
    });
  });

  // ── shouldCommit — on_checkpoint edge cases ──────────────────────────

  describe('shouldCommit — on_checkpoint edge cases', () => {
    test('commits at max iterations even if successes not multiple of 3', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 4,
        commitTrigger: 'on_checkpoint',
      }), tmpLogPath());
      // 2 successes, 2 failures — at max iterations
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      // successCount=2, not multiple of 3, but currentIteration=4 >= maxIterations=4
      expect(mgr.shouldCommit()).toBe(true);
    });

    test('does NOT commit on_checkpoint when 0 successes', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 3,
        commitTrigger: 'on_checkpoint',
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      expect(mgr.shouldCommit()).toBe(false);
    });

    test('does NOT commit on_checkpoint at 1 or 2 successes', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 10,
        commitTrigger: 'on_checkpoint',
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.shouldCommit()).toBe(false);
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.shouldCommit()).toBe(false);
    });
  });

  // ── shouldCommit — on_review edge cases ──────────────────────────────

  describe('shouldCommit — on_review edge cases', () => {
    test('does NOT commit on_review if last iteration failed at max', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 2,
        commitTrigger: 'on_review',
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      // currentIteration >= maxIterations but last status is failure
      expect(mgr.shouldCommit()).toBe(false);
    });

    test('does NOT commit on_review before max iterations', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 5,
        commitTrigger: 'on_review',
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      // currentIteration=1 < maxIterations=5
      expect(mgr.shouldCommit()).toBe(false);
    });
  });

  // ── shouldCommit — empty history ─────────────────────────────────────

  test('shouldCommit returns false with empty history', () => {
    const mgr = new IterationManager(makeCycle(), tmpLogPath());
    expect(mgr.shouldCommit()).toBe(false);
  });

  // ── generateCommitMessage ─────────────────────────────────────────────

  describe('generateCommitMessage', () => {
    test('uses refactor type for all-success with >1 iterations', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 3,
      }), tmpLogPath());
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      const msg = mgr.generateCommitMessage();
      expect(msg).toContain('refactor');
    });

    test('uses feat type for single success iteration', async () => {
      const mgr = new IterationManager(makeCycle({
        maxIterations: 5,
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      const msg = mgr.generateCommitMessage();
      expect(msg).toContain('feat');
      expect(msg).not.toContain('refactor');
    });

    test('includes iteration number and phase in message', async () => {
      const mgr = new IterationManager(makeCycle({
        phase: 'FeatureX',
      }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      const msg = mgr.generateCommitMessage();
      expect(msg).toContain('featurex');
      expect(msg).toContain('iteration-1');
    });

    test('includes total duration in message', async () => {
      const mgr = new IterationManager(makeCycle(), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      const msg = mgr.generateCommitMessage();
      expect(msg).toMatch(/Total Duration: \d+\.\d+s/);
    });
  });

  // ── generateInsights via getSummary ──────────────────────────────────

  describe('generateInsights', () => {
    test('high success rate insight (>=0.8, <1.0)', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 5 }), tmpLogPath());
      // 4 successes, 1 failure = 0.8
      for (let i = 0; i < 4; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      const summary = mgr.getSummary();
      expect(summary.insights).toContainEqual(
        expect.stringContaining('High success rate')
      );
    });

    test('moderate success rate insight (>=0.5, <0.8)', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 5 }), tmpLogPath());
      // 2 successes, 2 failures = 0.5
      for (let i = 0; i < 2; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      for (let i = 0; i < 2; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('failure', {});
      }
      const summary = mgr.getSummary();
      expect(summary.insights).toContainEqual(
        expect.stringContaining('Moderate success rate')
      );
    });

    test('fast iteration insight (<5000ms avg)', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 5 }), tmpLogPath());
      // Durations will be near-zero in tests (<5000ms)
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      const summary = mgr.getSummary();
      expect(summary.insights).toContainEqual(
        expect.stringContaining('Fast iteration')
      );
    });

    test('max iterations reached insight', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 3 }), tmpLogPath());
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      const summary = mgr.getSummary();
      expect(summary.insights).toContainEqual(
        expect.stringContaining('Maximum iterations reached')
      );
    });

    test('empty history returns no insights', () => {
      const mgr = new IterationManager(makeCycle(), tmpLogPath());
      expect(mgr.getSummary().insights).toEqual([]);
    });
  });

  // ── getSummary with empty history ────────────────────────────────────

  test('getSummary returns in_progress status with empty history', () => {
    const mgr = new IterationManager(makeCycle(), tmpLogPath());
    const summary = mgr.getSummary();
    expect(summary.totalIterations).toBe(0);
    expect(summary.successfulIterations).toBe(0);
    expect(summary.failedIterations).toBe(0);
    expect(summary.finalStatus).toBe('in_progress');
    expect(summary.iterations).toEqual([]);
  });

  // ── determineNextSteps via completeIteration ─────────────────────────

  describe('determineNextSteps — failure recovery branches', () => {
    test('retry strategy steps on first failure', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 5 }), tmpLogPath());
      await mgr.startIteration();
      const result = await mgr.completeIteration('failure', {});
      expect(result.nextSteps).toContain('Analyze failure cause');
      expect(result.nextSteps).toContain('Retry iteration');
    });

    test('minimal strategy steps when failure rate > 50%', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 10 }), tmpLogPath());
      // 2 failures
      for (let i = 0; i < 2; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('failure', {});
      }
      // 3rd failure — failureRate = 1.0 > 0.5 → minimal
      await mgr.startIteration();
      const result = await mgr.completeIteration('failure', {});
      expect(result.nextSteps).toContain('Return to minimal viable implementation');
    });

    test('fallback strategy steps at max iterations', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 2 }), tmpLogPath());
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      // 2nd iteration — at max, fails
      await mgr.startIteration();
      const result = await mgr.completeIteration('failure', {});
      // currentIteration=2 >= maxIterations=2 → fallback
      expect(result.nextSteps).toContain('Use fallback approach');
    });

    test('success nextSteps when not at max iterations', async () => {
      const mgr = new IterationManager(makeCycle({ maxIterations: 5 }), tmpLogPath());
      await mgr.startIteration();
      const result = await mgr.completeIteration('success', { accuracy: 90 });
      expect(result.nextSteps).toContain('Continue to next iteration');
      expect(result.nextSteps).toContain('Validate improvements');
    });
  });

  // ── reset ────────────────────────────────────────────────────────────

  test('reset restores in_progress status', async () => {
    const mgr = new IterationManager(makeCycle(), tmpLogPath());
    await mgr.startIteration();
    await mgr.completeIteration('success', { accuracy: 90 });
    mgr.reset();
    const summary = mgr.getSummary();
    expect(summary.finalStatus).toBe('in_progress');
  });

  // ── DEVELOPMENT_CYCLES content validation ────────────────────────────

  describe('DEVELOPMENT_CYCLES content', () => {
    test('MVP構築 has correct configuration', () => {
      const cycle = DEVELOPMENT_CYCLES['MVP構築'];
      expect(cycle.maxIterations).toBe(3);
      expect(cycle.commitTrigger).toBe('on_success');
      expect(cycle.failureRecovery).toContain('最小');
      expect(cycle.successCriteria).toContain('音声入力→字幕付き動画出力が動作');
    });

    test('内容分析 has percent thresholds in criteria', () => {
      const cycle = DEVELOPMENT_CYCLES['内容分析'];
      expect(cycle.maxIterations).toBe(5);
      expect(cycle.commitTrigger).toBe('on_checkpoint');
      expect(cycle.successCriteria.some(c => c.includes('80%'))).toBe(true);
      expect(cycle.successCriteria.some(c => c.includes('90%'))).toBe(true);
      expect(cycle.successCriteria.some(c => c.includes('85%'))).toBe(true);
    });

    test('図解生成 has zero-tolerance criteria', () => {
      const cycle = DEVELOPMENT_CYCLES['図解生成'];
      expect(cycle.maxIterations).toBe(4);
      expect(cycle.commitTrigger).toBe('on_review');
      expect(cycle.successCriteria.some(c => c.includes('破綻0'))).toBe(true);
      expect(cycle.successCriteria.some(c => c.includes('100%'))).toBe(true);
    });

    test('E2E統合 has performance criteria', () => {
      const cycle = DEVELOPMENT_CYCLES['E2E統合'];
      expect(cycle.maxIterations).toBe(3);
      expect(cycle.commitTrigger).toBe('on_success');
      expect(cycle.successCriteria.some(c => c.includes('>90%'))).toBe(true);
      expect(cycle.successCriteria.some(c => c.includes('<60秒'))).toBe(true);
    });

    test('品質向上 has quality score criteria', () => {
      const cycle = DEVELOPMENT_CYCLES['品質向上'];
      expect(cycle.maxIterations).toBe(5);
      expect(cycle.commitTrigger).toBe('on_checkpoint');
      expect(cycle.successCriteria.some(c => c.includes('>95'))).toBe(true);
      expect(cycle.successCriteria.some(c => c.includes('100%'))).toBe(true);
    });

    test('all cycles have required fields', () => {
      for (const [name, cycle] of Object.entries(DEVELOPMENT_CYCLES)) {
        expect(cycle.phase).toBe(name);
        expect(cycle.maxIterations).toBeGreaterThan(0);
        expect(cycle.maxIterations).toBeLessThanOrEqual(10);
        expect(cycle.successCriteria.length).toBeGreaterThan(0);
        expect(cycle.failureRecovery).toBeTruthy();
        expect(['on_success', 'on_checkpoint', 'on_review']).toContain(cycle.commitTrigger);
      }
    });
  });

  // ── createIterationManager factory — all phases ──────────────────────

  describe('createIterationManager — all predefined phases', () => {
    const phases = Object.keys(DEVELOPMENT_CYCLES) as Array<keyof typeof DEVELOPMENT_CYCLES>;

    for (const phase of phases) {
      test(`creates manager for "${phase}"`, () => {
        const logPath = tmpLogPath();
        const mgr = createIterationManager(phase, logPath);
        expect(mgr).toBeInstanceOf(IterationManager);
      });
    }

    test('all phases produce functional managers', async () => {
      for (const phase of phases) {
        const logPath = tmpLogPath();
        const mgr = createIterationManager(phase, logPath);
        await mgr.startIteration();
        const result = await mgr.completeIteration('success', { accuracy: 90 });
        expect(result.iterationNumber).toBe(1);
        expect(result.status).toBe('success');
      }
    });
  });

  // ── completeIteration records correct duration ──────────────────────

  test('completeIteration records positive duration', async () => {
    const mgr = new IterationManager(makeCycle(), tmpLogPath());
    await mgr.startIteration();
    const result = await mgr.completeIteration('success', { accuracy: 90 });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // ── success criteria mapping in completeIteration ────────────────────

  test('completeIteration records the evaluated metric value per criterion', async () => {
    const mgr = new IterationManager(makeCycle({
      successCriteria: ['accuracy > 80%', 'success_rate > 50%'],
    }), tmpLogPath());
    await mgr.startIteration();
    const result = await mgr.completeIteration('success', { accuracy: 85, success_rate: 60 });
    expect(result.successCriteria).toHaveLength(2);
    // Each criterion is evaluated for real against its mapped metric, and the
    // recorded value is the metric actually checked (not metrics[criterion],
    // which indexed by the full criterion string and was always undefined).
    const acc = result.successCriteria.find(c => c.criterion === 'accuracy > 80%')!;
    expect(acc.met).toBe(true);
    expect(acc.value).toBe(85);
    expect(acc.threshold).toBe(80);
    const sr = result.successCriteria.find(c => c.criterion === 'success_rate > 50%')!;
    expect(sr.met).toBe(true);
    expect(sr.value).toBe(60);
    expect(sr.threshold).toBe(50);
  });

  // ── logIteration write error handling ────────────────────────────────

  test('completeIteration does not throw when log directory is missing', async () => {
    const mgr = new IterationManager(
      makeCycle(),
      path.join(os.tmpdir(), 'nonexistent-dir-' + Date.now(), 'log.md'),
    );
    await mgr.startIteration();
    // Should complete without throwing despite missing directory
    await expect(mgr.completeIteration('success', { accuracy: 90 })).resolves.toBeDefined();
  });

  // ── defect 9: an unverifiable numeric SLO never silently passes ──────

  describe('checkCriterion — loud fallback for unverifiable numeric SLOs (defect 9)', () => {
    // Every criterion shipped in DEVELOPMENT_CYCLES that carries a numeric /
    // percent / zero-word bar MUST resolve to a KEY_MAP entry. A numeric SLO
    // whose keyword matches no entry used to silently pass ("any metric
    // present → true"); this guard fails the moment someone adds one without a
    // mapping. "テスト通過率100%" was the last unmapped instance and is now
    // mapped to testPassRate.
    test('every numeric-threshold criterion in DEVELOPMENT_CYCLES is mapped', () => {
      const allCriteria = Object.values(DEVELOPMENT_CYCLES).flatMap(c => c.successCriteria);
      const unmapped: string[] = [];
      for (const criterion of allCriteria) {
        if (criterionHasNumericThreshold(criterion)) {
          const keys = mapCriterionToKeys(criterion);
          if (keys === null || keys.length === 0) unmapped.push(criterion);
        }
      }
      expect(unmapped).toEqual([]);
    });

    test('テスト通過率100% is no longer unmapped (the last surviving instance)', () => {
      expect(mapCriterionToKeys('テスト通過率100%')).toEqual(['testPassRate', 'test_pass_rate']);
    });

    test('a numeric SLO whose metric is absent FAILS instead of silently passing', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['テスト通過率100%'],
      }), tmpLogPath());
      // an unrelated metric is present, but no testPassRate → must NOT pass.
      expect(mgr.evaluateSuccessCriteria({ accuracy: 1.0 }).allMet).toBe(false);
      // no metrics at all → must fail.
      expect(mgr.evaluateSuccessCriteria({}).allMet).toBe(false);
      // when the real metric is supplied, the bar is honored.
      expect(mgr.evaluateSuccessCriteria({ testPassRate: 100 }).allMet).toBe(true);
      expect(mgr.evaluateSuccessCriteria({ testPassRate: 80 }).allMet).toBe(false);
    });

    test('an unverifiable numeric SLO emits a warning (the gate is loud)', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const mgr = new IterationManager(makeCycle({
          successCriteria: ['テスト通過率100%'],
        }), tmpLogPath());
        mgr.evaluateSuccessCriteria({ accuracy: 1.0 });
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('テスト通過率100%'),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failing the gate'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    test('descriptive criteria (no numeric bar) keep the "met when metrics reported" result', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const mgr = new IterationManager(makeCycle({
          successCriteria: ['出力品質:視認可能'],
        }), tmpLogPath());
        expect(mgr.evaluateSuccessCriteria({ foo: 1 }).allMet).toBe(true);
        expect(mgr.evaluateSuccessCriteria({}).allMet).toBe(false);
        // a descriptive criterion requests no bar, so it never reaches the loud
        // fallback and emits no warning.
        mgr.evaluateSuccessCriteria({ foo: 1 });
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    // The generic-fallback keys (accuracy/precision/rate/score/pass_rate/
    // success_rate) are the ONLY resolution for criteria whose keyword is the
    // generic metric NAME itself ('rate > 50%', 'pass_rate > 90%'). But the
    // legacy fallback evaluated them in PRIORITY ORDER, first-present-wins — so
    // a criterion naming "rate" was satisfied by the FIRST present generic key
    // (accuracy), not by the metric it named. This is the surviving instance of
    // the silent-pass class: a criterion whose keyword matches no KEY_MAP entry
    // passing on the mere presence of an UNRELATED metric. The generic fallback
    // now only accepts a generic key the criterion textually NAMES.

    test('a criterion naming "rate" is NOT satisfied by an unrelated "accuracy" metric', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['rate > 50%'],
      }), tmpLogPath());
      // rate=40 fails its own bar; accuracy=95 is present and >= 50. The legacy
      // generic fallback resolved "rate" against accuracy (first generic key)
      // and silently passed. Only the metric the criterion names may satisfy it.
      expect(mgr.evaluateSuccessCriteria({ accuracy: 95, rate: 40 }).allMet).toBe(false);
      // and when the named metric genuinely meets the bar, it still passes.
      expect(mgr.evaluateSuccessCriteria({ accuracy: 95, rate: 60 }).allMet).toBe(true);
    });

    test('a criterion naming "pass_rate" ignores the "rate" metric (no substring bleed)', () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['pass_rate > 90%'],
      }), tmpLogPath());
      // rate=95 would satisfy a 90% bar, but the criterion names pass_rate, and
      // pass_rate=40 fails it. 'rate' must not bleed in as a candidate just
      // because it is a substring of 'pass_rate'.
      expect(mgr.evaluateSuccessCriteria({ rate: 95, pass_rate: 40 }).allMet).toBe(false);
      expect(mgr.evaluateSuccessCriteria({ rate: 95, pass_rate: 95 }).allMet).toBe(true);
    });

    test('an unmapped numeric SLO naming no known metric FAILS even with unrelated metrics present', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const mgr = new IterationManager(makeCycle({
          successCriteria: ['未知指標90%'],
        }), tmpLogPath());
        // accuracy is present (0.95 → 95%) and would satisfy a 90% bar, but the
        // criterion names no known metric keyword and no generic metric token →
        // it must NOT silently pass on accuracy's presence.
        expect(mgr.evaluateSuccessCriteria({ accuracy: 0.95 }).allMet).toBe(false);
        // and it fails LOUD: the unmapped-SLO warning names the criterion.
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('未知指標90%'));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unmapped SLO'));
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  // ── completeIteration: recorded verdict matches the actual SLO evaluation ─

  describe('completeIteration — records the REAL per-criterion verdict', () => {
    // The legacy completeIteration recorded `met: status === 'success'` for
    // every criterion, collapsing the per-criterion verdict into one uniform
    // boolean, and `value: metrics[criterion]` (indexed by the full criterion
    // string, always undefined). The record must reflect the actual evaluation.

    test('a soft-failure records which criteria passed and which failed', async () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%', 'precision > 90%'],
      }), tmpLogPath());
      await mgr.startIteration();
      // accuracy passes (90>80), precision fails (50<90) ⇒ allMet false, no error.
      const result = await mgr.completeIteration('failure', { accuracy: 90, precision: 50 });
      expect(result.status).toBe('failure');
      const byCrit = Object.fromEntries(result.successCriteria.map(c => [c.criterion, c]));
      expect(byCrit['accuracy > 80%'].met).toBe(true);
      expect(byCrit['precision > 90%'].met).toBe(false);
    });

    test('records the resolved metric value and parsed threshold', async () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%'],
      }), tmpLogPath());
      await mgr.startIteration();
      const result = await mgr.completeIteration('success', { accuracy: 92 });
      // value is the evaluated metric (92), NOT metrics['accuracy > 80%'] (undefined);
      // threshold is the parsed bar (80).
      expect(result.successCriteria[0].value).toBe(92);
      expect(result.successCriteria[0].threshold).toBe(80);
    });

    test('a successful iteration records every criterion met with its value', async () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%', '全体品質スコア>95'],
      }), tmpLogPath());
      await mgr.startIteration();
      const result = await mgr.completeIteration('success', { accuracy: 90, overallScore: 97 });
      expect(result.successCriteria.every(c => c.met === true)).toBe(true);
      const acc = result.successCriteria.find(c => c.criterion === 'accuracy > 80%')!;
      expect(acc.value).toBe(90);
      expect(acc.threshold).toBe(80);
    });

    test('an errored iteration records all criteria not-met (contract preserved)', async () => {
      const mgr = new IterationManager(makeCycle({
        successCriteria: ['accuracy > 80%', 'precision > 90%'],
      }), tmpLogPath());
      await mgr.startIteration();
      // Even with passing metrics, an errored run achieved none of its SLOs.
      const result = await mgr.completeIteration('failure', { accuracy: 99, precision: 99 }, 'boom');
      expect(result.successCriteria.every(c => c.met === false)).toBe(true);
    });

    test('the record path is silent — no duplicate defect-9 loud-fail warning', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const mgr = new IterationManager(makeCycle({
          successCriteria: ['テスト通過率100%'],
        }), tmpLogPath());
        await mgr.startIteration();
        // testPassRate absent ⇒ unverifiable numeric SLO. The gate
        // (evaluateSuccessCriteria) warns; completeIteration must NOT duplicate it.
        await mgr.completeIteration('failure', { accuracy: 1.0 });
        expect(warnSpy).not.toHaveBeenCalled();
        // …whereas the gate still warns for the same criterion.
        mgr.evaluateSuccessCriteria({ accuracy: 1.0 });
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  // ── defect 9: ONE consolidated end-to-end regression ───────────────────
  //
  // Defect 9 (criterion-mapping silent-pass) was closed across THREE commits
  // — the gate's loud-fail for an unverifiable SLO (21c3521a), the real
  // per-criterion verdict recorded in completeIteration (aebe992d), and the
  // terminal generic-fallback branch (beda9ecb). The tests above each pin one
  // facet in isolation. This single test drives the WHOLE chain the live
  // FrameworkIntegratedPipeline uses
  //   (evaluateSuccessCriteria → allMet → 'success'|'failure' → completeIteration,
  //    src/pipeline/framework-integrated-pipeline.ts:143-150)
  // with a MIX of a mappable criterion that genuinely passes and an UNMAPPED
  // numeric SLO whose metric is absent. The silent-pass bug in ANY of the three
  // facets would have made the unmapped SLO report met:true → allMet:true →
  // status:'success', so the iteration SILENTLY PASSED on an unverifiable SLO.
  // Locking the entire class here means a future regression in any one facet
  // fails this one test in one place instead of being re-closed incrementally.

  describe('defect 9 — consolidated end-to-end (mix of mappable + unmapped criteria)', () => {
    test('a passing mappable criterion + an absent-metric SLO marks the iteration FAILED, not silently passed', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const mgr = new IterationManager(makeCycle({
          // MIX: 'accuracy > 80%' is mappable and genuinely passes;
          // 'テスト通過率100%' is a numeric SLO whose metric (testPassRate) is not
          // produced by the live FIP path, so it is unverifiable this run.
          successCriteria: ['accuracy > 80%', 'テスト通過率100%'],
        }), tmpLogPath());

        // A passing metric IS present (accuracy=90), and an unrelated metric is
        // present — exactly the state the silent-pass exploited.
        const metrics = { accuracy: 90 };

        // Mirror the live FrameworkIntegratedPipeline chain:
        //   evaluateSuccessCriteria → allMet → 'success'|'failure' → completeIteration
        const evaluation = mgr.evaluateSuccessCriteria(metrics);
        const status: IterationStatus = evaluation.allMet ? 'success' : 'failure';

        await mgr.startIteration();
        const iteration = await mgr.completeIteration(status, metrics);

        // The gate does NOT silently pass: the absent-metric SLO is not met, so
        // allMet is false even though accuracy passed and a metric is present.
        expect(evaluation.allMet).toBe(false);
        // The live status derivation therefore marks the iteration failed.
        expect(status).toBe('failure');
        expect(iteration.status).toBe('failure');

        // The record reflects the REAL per-criterion verdict (not the legacy
        // uniform `met: status==='success'`): accuracy met with its value, the
        // unmapped SLO not met.
        const byCrit = Object.fromEntries(iteration.successCriteria.map(c => [c.criterion, c]));
        expect(byCrit['accuracy > 80%'].met).toBe(true);
        expect(byCrit['accuracy > 80%'].value).toBe(90);
        expect(byCrit['accuracy > 80%'].threshold).toBe(80);
        expect(byCrit['テスト通過率100%'].met).toBe(false);

        // Contrast: when the missing metric IS supplied and meets its bar, the
        // SAME chain marks the iteration a SUCCESS — proving the gate fails on
        // the absent metric specifically, not by always-failing.
        const okMetrics = { accuracy: 90, testPassRate: 100 };
        const okEval = mgr.evaluateSuccessCriteria(okMetrics);
        expect(okEval.allMet).toBe(true);
        expect(okEval.allMet ? 'success' : 'failure').toBe('success');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
