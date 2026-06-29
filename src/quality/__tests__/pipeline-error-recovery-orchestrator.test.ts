import {
  PipelineErrorRecoveryOrchestrator,
} from '../pipeline-error-recovery-orchestrator';
import type { ChainStep, StrategyChain } from '../recovery-strategy-chain';

describe('PipelineErrorRecoveryOrchestrator', () => {
  let orchestrator: PipelineErrorRecoveryOrchestrator;

  beforeEach(() => {
    orchestrator = new PipelineErrorRecoveryOrchestrator();
  });

  afterEach(() => {
    orchestrator.destroy();
  });

  // -----------------------------------------------------------------------
  // Constructor & Configuration
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates instance with default config', () => {
      const orch = new PipelineErrorRecoveryOrchestrator();
      expect(orch).toBeDefined();
      orch.destroy();
    });

    it('accepts custom config', () => {
      const orch = new PipelineErrorRecoveryOrchestrator({
        useChainFirst: false,
        stageTimeBudgetMs: 10_000,
      });
      expect(orch).toBeDefined();
      orch.destroy();
    });

    it('accepts runConfig', () => {
      const orch = new PipelineErrorRecoveryOrchestrator({
        useChainFirst: true,
        stageTimeBudgetMs: 5_000,
        runConfig: {
          maxTotalRetries: 5,
          maxDegradedStages: 2,
        },
      });
      expect(orch).toBeDefined();
      orch.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  describe('accessors', () => {
    it('exposes strategyChain', () => {
      expect(orchestrator.strategyChain).toBeDefined();
      expect(typeof orchestrator.strategyChain.register).toBe('function');
    });

    it('exposes runTracker', () => {
      expect(orchestrator.runTracker).toBeDefined();
      expect(typeof orchestrator.runTracker.startRun).toBe('function');
    });

    it('exposes batchRecovery', () => {
      expect(orchestrator.batchRecovery).toBeDefined();
      expect(typeof orchestrator.batchRecovery.process).toBe('function');
    });

    it('exposes recoveryMonitor', () => {
      expect(orchestrator.recoveryMonitor).toBeDefined();
    });

    it('exposes enhancedRecovery', () => {
      expect(orchestrator.enhancedRecovery).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Run lifecycle: startRun
  // -----------------------------------------------------------------------

  describe('startRun', () => {
    it('starts a run without error', () => {
      expect(() => orchestrator.startRun('run-001')).not.toThrow();
    });

    it('accepts custom runConfig', () => {
      expect(() =>
        orchestrator.startRun('run-002', {
          maxTotalRetries: 3,
          maxDegradedStages: 1,
        }),
      ).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // executeStage: primary success
  // -----------------------------------------------------------------------

  describe('executeStage - primary success', () => {
    beforeEach(() => {
      orchestrator.startRun('test-run-success');
    });

    it('returns primary result on direct success', async () => {
      const result = await orchestrator.executeStage<string>(
        'transcription',
        async () => 'transcribed text',
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('transcribed text');
      expect(result.degraded).toBe(false);
      expect(result.recoveryPath).toBe('primary');
      expect(result.attempts).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns object results correctly', async () => {
      const data = { scenes: 3, duration: 120 };
      const result = await orchestrator.executeStage(
        'analysis',
        async () => data,
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(data);
      expect(result.recoveryPath).toBe('primary');
    });

    it('records timing for successful operations', async () => {
      const result = await orchestrator.executeStage(
        'segmentation',
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 'done';
        },
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(5);
    });
  });

  // -----------------------------------------------------------------------
  // executeStage: primary failure → recovery
  // -----------------------------------------------------------------------

  describe('executeStage - primary failure', () => {
    beforeEach(() => {
      orchestrator.startRun('test-run-failure');
    });

    it('enters recovery when primary throws', async () => {
      const result = await orchestrator.executeStage<string>(
        'transcription',
        async () => {
          throw new Error('primary failed');
        },
        { maxRetries: 1 },
      );

      expect(result.attempts).toBeGreaterThanOrEqual(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns recovery attempt when all primary fails', async () => {
      const result = await orchestrator.executeStage<string>(
        'rendering',
        async () => {
          throw new Error('total failure');
        },
        { maxRetries: 0 },
      );

      // The boundary may produce its own degraded result via internal strategies
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('uses boundary recovery when primary fails with fallback', async () => {
      const result = await orchestrator.executeStage<string>(
        'export',
        async () => {
          throw new Error('primary failed');
        },
        {
          maxRetries: 0,
          fallback: async () => 'fallback result',
        },
      );

      // Boundary recovery kicks in — may use internal strategy or provided fallback
      expect(result.degraded).toBe(true);
      expect(result.recoveryPath).not.toBe('primary');
    });
  });

  // -----------------------------------------------------------------------
  // executeStage: with registered chain
  // -----------------------------------------------------------------------

  describe('executeStage - chain recovery', () => {
    beforeEach(() => {
      orchestrator.startRun('test-chain');
    });

    it('attempts chain recovery when registered', async () => {
      const chain: StrategyChain = {
        name: 'test-chain',
        steps: [
          {
            id: 'retry',
            name: 'Retry analysis',
            execute: async () => ({
              result: 'recovered data',
              fallbackUsed: false,
              confidence: 0.95,
            }),
            optional: false,
          },
        ],
      };

      orchestrator.strategyChain.register('analysis', chain);

      const result = await orchestrator.executeStage<string>(
        'analysis',
        async () => {
          throw new Error('primary failed');
        },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('recovered data');
      expect(result.recoveryPath).toBe('chain');
      expect(result.chainOutcome).toBeDefined();
      expect(result.chainOutcome?.winningStepId).toBe('retry');
    });

    it('falls through to boundary when chain fails', async () => {
      const chain: StrategyChain = {
        name: 'fail-chain',
        steps: [
          {
            id: 'retry-fail',
            name: 'Retry (fails)',
            execute: async () => undefined,
            optional: false,
          },
        ],
      };

      orchestrator.strategyChain.register('transcription', chain);

      const result = await orchestrator.executeStage<string>(
        'transcription',
        async () => {
          throw new Error('primary failed');
        },
        { maxRetries: 0 },
      );

      // Chain failed, boundary recovery kicks in
      expect(result.recoveryPath).not.toBe('chain');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('marks result as degraded when confidence is low', async () => {
      const chain: StrategyChain = {
        name: 'low-conf-chain',
        steps: [
          {
            id: 'low-confidence',
            name: 'Low confidence recovery',
            execute: async () => ({
              result: 'low quality',
              fallbackUsed: false,
              confidence: 0.3,
            }),
            optional: false,
          },
        ],
      };

      orchestrator.strategyChain.register('analysis', chain);

      const result = await orchestrator.executeStage<string>(
        'analysis',
        async () => {
          throw new Error('primary failed');
        },
      );

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.result).toBe('low quality');
    });

    it('marks result as degraded when fallback was used', async () => {
      const chain: StrategyChain = {
        name: 'fallback-chain',
        steps: [
          {
            id: 'fallback-step',
            name: 'Fallback strategy',
            execute: async () => ({
              result: 'degraded output',
              fallbackUsed: true,
              confidence: 0.9,
            }),
            optional: false,
          },
        ],
      };

      orchestrator.strategyChain.register('layout_generation', chain);

      const result = await orchestrator.executeStage<string>(
        'layout_generation',
        async () => {
          throw new Error('primary failed');
        },
      );

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // executeStage: useChainFirst = false
  // -----------------------------------------------------------------------

  describe('executeStage - useChainFirst disabled', () => {
    it('skips chain when useChainFirst is false', async () => {
      const orch = new PipelineErrorRecoveryOrchestrator({
        useChainFirst: false,
        stageTimeBudgetMs: 5_000,
      });

      const chain: StrategyChain = {
        name: 'should-not-run',
        steps: [
          {
            id: 'should-not-run',
            name: 'Should not run',
            execute: async () => ({
              result: 'chain result',
              fallbackUsed: false,
              confidence: 1.0,
            }),
            optional: false,
          },
        ],
      };

      orch.strategyChain.register('analysis', chain);
      orch.startRun('test-no-chain');

      const result = await orch.executeStage<string>(
        'analysis',
        async () => {
          throw new Error('primary failed');
        },
        { maxRetries: 0, fallback: async () => 'boundary fallback' },
      );

      expect(result.recoveryPath).toBe('boundary');
      expect(result.degraded).toBe(true);

      orch.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // executeStage: recommendation when no active run
  // -----------------------------------------------------------------------

  describe('executeStage - no active run', () => {
    it('uses default recommendation when no run started', async () => {
      // startRun is called internally by executeStage via tracker
      // getRecommendation catches the "no active run" error and returns defaults
      // But setActiveStage also throws, so executeStage will throw
      // We verify the error propagates
      await expect(
        orchestrator.executeStage<string>(
          'transcription',
          async () => 'success anyway',
        ),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // executeBatchStage
  // -----------------------------------------------------------------------

  describe('executeBatchStage', () => {
    beforeEach(() => {
      orchestrator.startRun('test-batch');
    });

    it('processes all items successfully', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => item * 2;

      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        items,
        processor,
        undefined,
      );

      expect(batchResult.failed).toBe(0);
      expect(batchResult.succeeded).toBe(3);
      expect(batchResult.items).toHaveLength(3);
      expect(batchResult.items[0].result).toBe(2);
      expect(batchResult.items[1].result).toBe(4);
      expect(batchResult.items[2].result).toBe(6);

      expect(stageResult.success).toBe(true);
      expect(stageResult.recoveryPath).toBe('primary');
      expect(stageResult.degraded).toBe(false);
    });

    it('handles partial failures with fallback', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => {
        if (item === 2) throw new Error('fail');
        return item * 10;
      };
      const fallback = async (item: number) => item * 5;

      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        items,
        processor,
        fallback,
        { maxRetries: 0 },
      );

      expect(batchResult.failed).toBe(0); // fallback saved it
      expect(batchResult.items[1].result).toBe(10); // fallback: 2*5
      expect(batchResult.items[1].fallbackUsed).toBe(true);
      expect(stageResult.degraded).toBe(true);
    });

    it('reports failures when no fallback provided', async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => {
        if (item === 3) throw new Error('fail');
        return item;
      };

      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        items,
        processor,
        undefined,
        { maxRetries: 0 },
      );

      expect(batchResult.failed).toBe(1);
      expect(stageResult.success).toBe(false);
      expect(stageResult.degraded).toBe(true);
    });

    it('processes empty array', async () => {
      const { batchResult, stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        [],
        async () => null,
        undefined,
      );

      expect(batchResult.items).toHaveLength(0);
      expect(stageResult.success).toBe(true);
      expect(stageResult.recoveryPath).toBe('primary');
    });

    it('tracks total attempts across items', async () => {
      const items = [1, 2];
      let attempts = 0;
      const processor = async (item: number) => {
        attempts++;
        return item;
      };

      const { stageResult } = await orchestrator.executeBatchStage(
        'analysis',
        items,
        processor,
        undefined,
      );

      expect(stageResult.attempts).toBe(2);
      expect(attempts).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // finalizeRun
  // -----------------------------------------------------------------------

  describe('finalizeRun', () => {
    it('returns a recovery report', () => {
      orchestrator.startRun('finalize-test');

      const report = orchestrator.finalizeRun(true);

      expect(report).toBeDefined();
      expect(report.runId).toBe('finalize-test');
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('records failure status', () => {
      orchestrator.startRun('finalize-fail');

      const report = orchestrator.finalizeRun(false);

      expect(report).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // shouldAbort
  // -----------------------------------------------------------------------

  describe('shouldAbort', () => {
    it('returns false for a fresh run', () => {
      orchestrator.startRun('abort-test');
      expect(orchestrator.shouldAbort()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getHealthAssessment
  // -----------------------------------------------------------------------

  describe('getHealthAssessment', () => {
    it('returns a health assessment', () => {
      orchestrator.startRun('health-test');

      const assessment = orchestrator.getHealthAssessment();

      expect(assessment).toBeDefined();
      expect(typeof assessment).toBe('object');
    });
  });

  // -----------------------------------------------------------------------
  // destroy
  // -----------------------------------------------------------------------

  describe('destroy', () => {
    it('cleans up without error', () => {
      const orch = new PipelineErrorRecoveryOrchestrator();
      orch.startRun('destroy-test');
      expect(() => orch.destroy()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      const orch = new PipelineErrorRecoveryOrchestrator();
      orch.destroy();
      expect(() => orch.destroy()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Full lifecycle integration
  // -----------------------------------------------------------------------

  describe('full lifecycle', () => {
    it('runs a complete pipeline with mixed results', async () => {
      orchestrator.startRun('lifecycle-001');

      // Stage 1: success
      const s1 = await orchestrator.executeStage('transcription', async () => 'text');
      expect(s1.success).toBe(true);

      // Stage 2: success
      const s2 = await orchestrator.executeStage('segmentation', async () => ['seg1', 'seg2']);
      expect(s2.success).toBe(true);

      // Stage 3: failure with fallback
      const s3 = await orchestrator.executeStage('analysis', async () => {
        throw new Error('fail');
      }, {
        maxRetries: 0,
        fallback: async () => ({ degraded: true }),
      });
      expect(s3.success).toBe(true);
      expect(s3.degraded).toBe(true);

      // Finalize
      const report = orchestrator.finalizeRun(true);
      expect(report.runId).toBe('lifecycle-001');
    });

    it('handles multiple sequential runs', async () => {
      // Run 1
      orchestrator.startRun('multi-1');
      const r1 = await orchestrator.executeStage('transcription', async () => 'run1');
      expect(r1.success).toBe(true);
      orchestrator.finalizeRun(true);

      // Run 2
      orchestrator.startRun('multi-2');
      const r2 = await orchestrator.executeStage('transcription', async () => 'run2');
      expect(r2.success).toBe(true);
      orchestrator.finalizeRun(true);
    });
  });
});
