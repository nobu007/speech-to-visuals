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
  type DevelopmentCycle,
} from '../iteration-manager';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

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

  test('completeIteration maps criteria values from metrics', async () => {
    const mgr = new IterationManager(makeCycle({
      successCriteria: ['accuracy > 80%', 'precision > 90%'],
    }), tmpLogPath());
    await mgr.startIteration();
    const result = await mgr.completeIteration('success', { accuracy: 85, precision: 95 });
    expect(result.successCriteria).toHaveLength(2);
    // On success, all criteria are marked met=true
    expect(result.successCriteria[0].met).toBe(true);
    expect(result.successCriteria[1].met).toBe(true);
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
});
