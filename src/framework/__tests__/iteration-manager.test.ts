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

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@/utils/logger';

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
});
