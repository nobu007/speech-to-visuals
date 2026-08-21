/**
 * Tests for IterationManager
 * Covers: startIteration, completeIteration, evaluateSuccessCriteria,
 *         recovery strategy, commit triggers, insights, reset,
 *         logIteration findIndex fix, createIterationManager factory
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  IterationManager,
  createIterationManager,
  DEVELOPMENT_CYCLES,
} from '../iteration-manager';

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@stv/core/utils/logger';

describe('IterationManager', () => {
  let tmpDir: string;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-test-'));
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    errorSpy.mockRestore();
  });

  function createManager(trigger: 'on_success' | 'on_checkpoint' | 'on_review' = 'on_success') {
    return new IterationManager(
      {
        phase: 'TestPhase',
        maxIterations: 3,
        successCriteria: ['accuracy > 80%', '処理成功率'],
        failureRecovery: 'fallback',
        commitTrigger: trigger,
        currentIteration: 0,
        status: 'in_progress' as const,
      },
      path.join(tmpDir, 'ITERATION_LOG.md')
    );
  }

  describe('startIteration (BUG FIX: removed dead forEach)', () => {
    it('increments iteration counter', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      const result = await mgr.completeIteration('success', { accuracy: 90 });
      expect(result.iterationNumber).toBe(1);
    });

    it('does not crash — dead forEach removed', async () => {
      const mgr = createManager();
      await expect(mgr.startIteration()).resolves.not.toThrow();
    });
  });

  describe('completeIteration', () => {
    it('records success iteration with metrics', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      const result = await mgr.completeIteration('success', { accuracy: 90 });
      expect(result.status).toBe('success');
      expect(result.iterationNumber).toBe(1);
      expect(result.successCriteria).toHaveLength(2);
      expect(result.successCriteria[0].met).toBe(true);
    });

    it('records failure iteration with error', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      const result = await mgr.completeIteration('failure', {}, 'Test error');
      expect(result.status).toBe('failure');
      expect(result.error).toBe('Test error');
      expect(result.successCriteria[0].met).toBe(false);
    });

    it('computes nextSteps on success at max iterations', async () => {
      const mgr = createManager();
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      const summary = mgr.getSummary();
      const lastIteration = summary.iterations[summary.iterations.length - 1];
      expect(lastIteration.nextSteps).toContain('Phase completed successfully');
    });
  });

  describe('evaluateSuccessCriteria (BUG FIX: removed dead forEach)', () => {
    it('returns allMet=true when criteria satisfied', () => {
      const mgr = createManager();
      const result = mgr.evaluateSuccessCriteria({ accuracy: 90 });
      expect(result.allMet).toBe(true);
    });

    it('returns allMet=false when criteria not satisfied', () => {
      const mgr = createManager();
      const result = mgr.evaluateSuccessCriteria({ accuracy: 50 });
      expect(result.allMet).toBe(false);
      expect(result.results[0].met).toBe(false);
    });

    it('passes when any metrics exist for non-numeric criteria', () => {
      const mgr = createManager();
      const result = mgr.evaluateSuccessCriteria({ accuracy: 90 });
      expect(result.results[1].met).toBe(true);
    });
  });

  describe('evaluateSuccessCriteria (REQ-385: no vacuous allMet on empty criteria)', () => {
    it('fails closed with a loud row when the cycle declares no criteria', () => {
      // Old behavior: `results.every(...)` on an empty array is vacuously
      // true, so a criteria-less cycle claimed allMet: true — and the
      // pipeline caller maps allMet straight to iteration status 'success'.
      const mgr = new IterationManager(
        {
          phase: 'EmptyPhase',
          maxIterations: 3,
          successCriteria: [],
          failureRecovery: 'retry',
          commitTrigger: 'on_success',
          currentIteration: 0,
          status: 'in_progress' as const,
        },
        path.join(tmpDir, 'ITERATION_LOG.md')
      );
      const result = mgr.evaluateSuccessCriteria({ accuracy: 90 });
      expect(result.allMet).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].criterion).toBe('(no success criteria defined)');
      expect(result.results[0].met).toBe(false);
      expect(result.results[0].reason).toContain('no successCriteria');
    });

    it('shipped DEVELOPMENT_CYCLES templates never hit the fail-closed branch', () => {
      // The fail-closed branch is a guard for caller-supplied cycles; every
      // template the factory serves must still carry real criteria.
      for (const cycle of Object.values(DEVELOPMENT_CYCLES)) {
        expect(cycle.successCriteria.length).toBeGreaterThan(0);
      }
    });
  });

  describe('determineRecoveryStrategy', () => {
    it('returns retry when no history', () => {
      const mgr = createManager();
      expect(mgr.determineRecoveryStrategy()).toBe('retry');
    });

    it('returns fallback at max iterations', async () => {
      const mgr = createManager();
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('failure', {});
      }
      expect(mgr.determineRecoveryStrategy()).toBe('fallback');
    });

    it('returns minimal when failure rate > 50%', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      expect(mgr.determineRecoveryStrategy()).toBe('minimal');
    });
  });

  describe('shouldCommit', () => {
    it('commits on_success when last iteration succeeded', async () => {
      const mgr = createManager('on_success');
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.shouldCommit()).toBe(true);
    });

    it('does not commit on_success when last iteration failed', async () => {
      const mgr = createManager('on_success');
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      expect(mgr.shouldCommit()).toBe(false);
    });

    it('commits on_checkpoint every 3 successes', async () => {
      const mgr = createManager('on_checkpoint');
      for (let i = 0; i < 3; i++) {
        await mgr.startIteration();
        await mgr.completeIteration('success', { accuracy: 90 });
      }
      expect(mgr.shouldCommit()).toBe(true);
    });

    it('commits on_review only at phase completion', async () => {
      const mgr = createManager('on_review');
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.shouldCommit()).toBe(false);

      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.shouldCommit()).toBe(true);
    });
  });

  describe('generateCommitMessage', () => {
    it('generates feat message for all-success iterations', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      expect(mgr.generateCommitMessage()).toContain('feat');
    });

    it('generates fix message for mixed success/failure', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      expect(mgr.generateCommitMessage()).toContain('fix');
    });
  });

  describe('getSummary and insights', () => {
    it('generates insights for perfect success rate', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      const summary = mgr.getSummary();
      expect(summary.successfulIterations).toBe(1);
      expect(summary.finalStatus).toBe('success');
      expect(summary.insights).toContainEqual(
        expect.stringContaining('Perfect')
      );
    });

    it('generates insights for low success rate', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('failure', {});
      const summary = mgr.getSummary();
      expect(summary.insights).toContainEqual(
        expect.stringContaining('Low')
      );
    });
  });

  describe('reset', () => {
    it('clears history and resets iteration counter', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });
      mgr.reset();
      expect(mgr.getSummary().totalIterations).toBe(0);
    });
  });

  describe('logIteration (BUG FIX: findIndex -1 insertion)', () => {
    it('writes iteration log to file', async () => {
      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });

      const content = fs.readFileSync(
        path.join(tmpDir, 'ITERATION_LOG.md'),
        'utf-8'
      );
      expect(content).toContain('TestPhase');
      expect(content).toContain('Iteration 1');
    });

    it('appends to existing log without corruption', async () => {
      const logFile = path.join(tmpDir, 'ITERATION_LOG.md');
      fs.writeFileSync(logFile, '# Iteration History\n\nSome intro\n\n', 'utf-8');

      const mgr = createManager();
      await mgr.startIteration();
      await mgr.completeIteration('success', { accuracy: 90 });

      const content = fs.readFileSync(logFile, 'utf-8');
      expect(content).toContain('Some intro');
      expect(content).toContain('TestPhase');
    });

    it('creates new log when file does not exist (ENOENT)', async () => {
      const logFile = path.join(tmpDir, 'nonexistent-log.md');
      expect(fs.existsSync(logFile)).toBe(false);

      const mgrNew = new IterationManager(
        {
          phase: 'TestPhase',
          maxIterations: 3,
          successCriteria: ['accuracy > 80%'],
          failureRecovery: 'fallback',
          commitTrigger: 'on_success',
          currentIteration: 0,
          status: 'in_progress' as const,
        },
        logFile,
      );
      await mgrNew.startIteration();
      await mgrNew.completeIteration('success', { accuracy: 90 });

      // File should have been created
      expect(fs.existsSync(logFile)).toBe(true);
      const content = fs.readFileSync(logFile, 'utf-8');
      expect(content).toContain('Iteration History');
      expect(content).toContain('TestPhase');
    });

    it('logs error for non-ENOENT read failures (e.g. permission denied)', async () => {
      // Create a directory at the log path — reading a directory throws EISDIR
      const dirPath = path.join(tmpDir, 'I_AM_A_DIRECTORY.md');
      fs.mkdirSync(dirPath);

      const mgrWithDir: IterationManager = new IterationManager(
        {
          phase: 'TestPhase',
          maxIterations: 3,
          successCriteria: ['accuracy > 80%'],
          failureRecovery: 'fallback',
          commitTrigger: 'on_success',
          currentIteration: 0,
          status: 'in_progress' as const,
        },
        dirPath,
      );

      // Reset logger spy
      errorSpy.mockClear();

      await mgrWithDir.startIteration();
      // completeIteration should not throw — outer catch logs warning
      await mgrWithDir.completeIteration('success', { accuracy: 90 });

      // The inner catch should have logged the I/O error (not silently treated as ENOENT)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(dirPath),
      );
    });
  });

  describe('createIterationManager factory', () => {
    it('creates manager for known phase', () => {
      const mgr = createIterationManager(
        'MVP構築' as keyof typeof DEVELOPMENT_CYCLES,
        path.join(tmpDir, 'log.md')
      );
      expect(mgr).toBeInstanceOf(IterationManager);
    });

    it('throws for unknown phase', () => {
      expect(() =>
        createIterationManager('Unknown' as never, path.join(tmpDir, 'log.md'))
      ).toThrow();
    });
  });

  describe('DEVELOPMENT_CYCLES', () => {
    it('contains predefined phases', () => {
      expect(DEVELOPMENT_CYCLES['MVP構築']).toBeDefined();
      expect(DEVELOPMENT_CYCLES['内容分析']).toBeDefined();
      expect(DEVELOPMENT_CYCLES['図解生成']).toBeDefined();
      expect(DEVELOPMENT_CYCLES['E2E統合']).toBeDefined();
      expect(DEVELOPMENT_CYCLES['品質向上']).toBeDefined();
    });
  });

  // checkCriterion parsing fix — three defects in the original stub, each
  // pinned by a witness that is RED on the pre-fix code:
  //   1. bare-number thresholds (">95") were never honored — numberMatch was
  //      computed then discarded;
  //   2. the comparison operator was ignored — every check used ">=", so a
  //      less-than criterion ("<90%") was evaluated backwards;
  //   3. percent thresholds (0-100) were compared against 0-1 fraction
  //      metrics (successRate, *F1) without scaling, so 0.90 >= 80 was always
  //      false.
  describe('checkCriterion — parses bare-number, operator, and 0-1 scale (BUG FIX)', () => {
    function mgrWith(successCriteria: string[]): IterationManager {
      return new IterationManager(
        {
          phase: 'CriterionFix',
          maxIterations: 1,
          successCriteria,
          failureRecovery: 'fallback',
          commitTrigger: 'on_success',
          currentIteration: 0,
          status: 'in_progress' as const,
        },
        path.join(tmpDir, 'criterion-log.md'),
      );
    }

    it('honors a bare-number threshold (previously dead numberMatch)', () => {
      // "全体品質スコア>95" with score 50 must be NOT met. Old code parsed
      // only "%", found none, and fell through to "any metric present" → true.
      const m = mgrWith(['全体品質スコア>95']);
      expect(m.evaluateSuccessCriteria({ overallScore: 50 }).allMet).toBe(false);
      expect(m.evaluateSuccessCriteria({ overallScore: 96 }).allMet).toBe(true);
    });

    it('honors a less-than operator (previously forced ">=")', () => {
      // "成功率<90%" with a 50% rate: the <90 bar IS met (true). Old code used
      // ">=", so 0.5 >= 90 → false (backwards).
      const m = mgrWith(['成功率<90%']);
      expect(m.evaluateSuccessCriteria({ successRate: 0.5 }).allMet).toBe(true);
      expect(m.evaluateSuccessCriteria({ successRate: 0.95 }).allMet).toBe(false);
    });

    it('normalizes a 0-1 fraction against a percent threshold (0-100 vs 0-1)', () => {
      // "精度>80%" with accuracy 0.90 (=90%) must be met. Old code compared
      // 0.90 >= 80 → false (scale bug).
      const m = mgrWith(['精度>80%']);
      expect(m.evaluateSuccessCriteria({ accuracy: 0.9 }).allMet).toBe(true);
      expect(m.evaluateSuccessCriteria({ accuracy: 0.5 }).allMet).toBe(false);
    });

    it('maps "シーン分割精度" to sceneSegmentationF1, not accuracy (specificity order)', () => {
      // The 分割 keyword must win over the generic 精度 keyword.
      const m = mgrWith(['シーン分割精度>80%']);
      expect(
        m.evaluateSuccessCriteria({ sceneSegmentationF1: 0.85, accuracy: 0.1 }).allMet,
      ).toBe(true);
    });

    it('reconciles a milliseconds metric against a seconds time criterion (平均処理時間<60秒)', () => {
      // processingTime is a MILLISECONDS delta (performance.now()/Date.now());
      // the "<60秒" SLO bar is in SECONDS. Previously the time key was
      // unmapped, so the criterion fell through to "any metric present → pass":
      // a 70-second run silently satisfied its own <60s performance SLO. This
      // is the 4th defect of the original criterion stub. The framework passes
      // `processingTime` (ms) into evaluateSuccessCriteria via the live
      // FrameworkIntegratedPipeline → useFrameworkPipeline path.
      const m = mgrWith(['平均処理時間<60秒']);
      // 45s = 45000ms → under the 60s bar → MET
      expect(m.evaluateSuccessCriteria({ processingTime: 45000 }).allMet).toBe(true);
      // 70s = 70000ms → over the 60s bar → NOT MET (the SLO violation this gate exists to catch)
      expect(m.evaluateSuccessCriteria({ processingTime: 70000 }).allMet).toBe(false);
    });

    it('maps "レイアウト破綻0" to layoutOverlap and fails on a non-zero count (defect 5)', () => {
      // "レイアウト破綻0" = "layout breakdowns: 0". layoutOverlap is a defect
      // COUNT (countLayoutOverlaps) and the criterion has no operator, so the
      // legacy ">=" default at threshold 0 was a tautology — any non-negative
      // overlap count silently passed, so the layout SLO never fired on the live
      // FIP path (FrameworkIntegratedPipeline → evaluateSuccessCriteria →
      // checkCriterion, with layoutOverlap spread into metricsForEvaluation).
      // Now operator-less lower-is-better criteria use "<=".
      const m = mgrWith(['レイアウト破綻0']);
      // 3 overlaps → over the "0 breakdowns" bar → NOT MET (the SLO violation
      // this gate exists to catch). Old code: 3 >= 0 → true (silent pass).
      expect(m.evaluateSuccessCriteria({ layoutOverlap: 3 }).allMet).toBe(false);
      // 0 overlaps → exactly the bar → MET.
      expect(m.evaluateSuccessCriteria({ layoutOverlap: 0 }).allMet).toBe(true);
    });

    it('requires EVERY layout defect dimension for "レイアウト破綻0" (defect 6, AND-semantics)', () => {
      // "レイアウト破綻0" ("layout breakdowns: 0") now maps to ALL THREE defect
      // counts — layoutOverlap, nodeOverflow, danglingLayoutEdges — because
      // "breakdown" means any of them. A multi-key defect criterion must hold
      // for EVERY present dimension, not just the first: previously a layout
      // with zero overlaps but two off-canvas nodes silently passed on its
      // overlap count alone (first-key-wins).
      const m = mgrWith(['レイアウト破綻0']);
      // overlap=0 but overflow=2 → NOT MET: the off-canvas nodes are a breakdown
      // the old single-dimension gate let through.
      expect(
        m.evaluateSuccessCriteria({ layoutOverlap: 0, nodeOverflow: 2, danglingLayoutEdges: 0 }).allMet,
      ).toBe(false);
      // overlap=0 but a dangling edge → NOT MET.
      expect(
        m.evaluateSuccessCriteria({ layoutOverlap: 0, nodeOverflow: 0, danglingLayoutEdges: 1 }).allMet,
      ).toBe(false);
      // all three defect counts zero → MET.
      expect(
        m.evaluateSuccessCriteria({ layoutOverlap: 0, nodeOverflow: 0, danglingLayoutEdges: 0 }).allMet,
      ).toBe(true);
    });

    it('maps "はみ出し0" to nodeOverflow and "ズレ0" to danglingLayoutEdges (single dimension)', () => {
      // Specific keywords target a single defect dimension.
      const overflow = mgrWith(['はみ出し0']);
      expect(overflow.evaluateSuccessCriteria({ nodeOverflow: 2 }).allMet).toBe(false);
      expect(overflow.evaluateSuccessCriteria({ nodeOverflow: 0 }).allMet).toBe(true);

      const misalign = mgrWith(['ズレ0']);
      expect(misalign.evaluateSuccessCriteria({ danglingLayoutEdges: 1 }).allMet).toBe(false);
      expect(misalign.evaluateSuccessCriteria({ danglingLayoutEdges: 0 }).allMet).toBe(true);
    });

    it('maps "ラベル可読性100%" to labelReadability and fails when any label truncates (defect 7)', () => {
      // "ラベル可読性100%" = "label readability: 100%". labelReadability is a 0-1
      // fraction of non-truncated node labels (estimateLabelReadability → the
      // renderer's own sizeLabel truncation predicate). Previously the
      // ラベル/可読性 keyword matched NO key in the map, so the criterion fell
      // through to the "any metric present → pass" fallback: a layout whose node
      // labels truncated silently satisfied its own 100% readability SLO on the
      // live FIP path (FrameworkIntegratedPipeline → evaluateSuccessCriteria →
      // checkCriterion, with labelReadability spread into metricsForEvaluation).
      const m = mgrWith(['ラベル可読性100%']);
      // 1.0 (=100%) → exactly the bar → MET.
      expect(m.evaluateSuccessCriteria({ labelReadability: 1 }).allMet).toBe(true);
      // 0.5 (=50%) → below the 100% bar → NOT MET. Old code: unmapped key → any
      // metric present → true (silent pass); now it correctly fails.
      expect(m.evaluateSuccessCriteria({ labelReadability: 0.5 }).allMet).toBe(false);
    });

    it('maps "ゼロクリティカルバグ" to crashCount and fails on a non-zero count (defect 8)', () => {
      // "ゼロクリティカルバグ" = "zero critical bugs". crashCount is a defect
      // COUNT (lower is better) and a REAL QualityMetrics field produced by the
      // FIP. Two things broke this SLO before:
      //  (a) the クリティカル/バグ keyword matched NO key in the map, and
      //  (b) the threshold is written as the WORD "ゼロ", not the ASCII digit "0",
      //      so the numeric threshold was never parsed.
      // Both sent the criterion to the "any metric present → pass" fallback, so a
      // run WITH crashes silently satisfied its own zero-crash SLO on the live FIP
      // path (FrameworkIntegratedPipeline → evaluateSuccessCriteria →
      // checkCriterion, with crashCount spread into metricsForEvaluation).
      const m = mgrWith(['ゼロクリティカルバグ']);
      // 0 crashes → exactly the "zero" bar → MET.
      expect(m.evaluateSuccessCriteria({ crashCount: 0 }).allMet).toBe(true);
      // 5 crashes → over the "zero" bar → NOT MET (the SLO violation this gate
      // exists to catch). Old code: no ASCII digit + unmapped key → any metric
      // present → true (silent pass).
      expect(m.evaluateSuccessCriteria({ crashCount: 5 }).allMet).toBe(false);
    });
  });
});
