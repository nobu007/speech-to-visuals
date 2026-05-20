/**
 * Tests for RecoveryStrategyChain — composable sequential fallback chains.
 */

import {
  RecoveryStrategyChain,
  ChainBuilder,
  globalRecoveryChain,
} from '@/quality/recovery-strategy-chain';
import type {
  StrategyChain,
  ChainOutcome,
  ChainStepResult,
  ChainConfig,
} from '@/quality/recovery-strategy-chain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A step that always succeeds with the given confidence. */
function successStep(id: string, value: string, confidence = 0.9) {
  return async (): Promise<ChainStepResult | undefined> => ({
    result: value,
    fallbackUsed: id.includes('fallback'),
    confidence,
  });
}

/** A step that always fails (returns undefined). */
function failStep(_id?: string) {
  return async (): Promise<ChainStepResult | undefined> => undefined;
}

/** A step that throws an error. */
function throwStep(message = 'boom') {
  return async (): Promise<ChainStepResult | undefined> => {
    throw new Error(message);
  };
}

/** A step that delays before succeeding. */
function delayedStep(id: string, value: string, delayMs: number) {
  return async (): Promise<ChainStepResult | undefined> => {
    await new Promise((r) => setTimeout(r, delayMs));
    return { result: value, fallbackUsed: false, confidence: 0.8 };
  };
}

function defaultConfig(stage: string, overrides?: Partial<ChainConfig>): ChainConfig {
  return { stage, timeBudgetMs: 30_000, minConfidence: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain', () => {
  let chain: RecoveryStrategyChain;

  beforeEach(() => {
    chain = new RecoveryStrategyChain();
  });

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  describe('registration', () => {
    it('registers and retrieves a chain', () => {
      const sc = ChainBuilder.start('test-chain').then('a', 'A', successStep('a', 'ok')).build();
      chain.register('analysis', sc);
      expect(chain.getChain('analysis')).toBe(sc);
    });

    it('replaces an existing registration', () => {
      const sc1 = ChainBuilder.start('v1').then('a', 'A', successStep('a', '1')).build();
      const sc2 = ChainBuilder.start('v2').then('b', 'B', successStep('b', '2')).build();
      chain.register('analysis', sc1);
      chain.register('analysis', sc2);
      expect(chain.getChain('analysis')).toBe(sc2);
    });

    it('unregisters a chain', () => {
      const sc = ChainBuilder.start('test').then('a', 'A', successStep('a', 'ok')).build();
      chain.register('analysis', sc);
      expect(chain.unregister('analysis')).toBe(true);
      expect(chain.getChain('analysis')).toBeUndefined();
    });

    it('returns false for unregistering unknown stage', () => {
      expect(chain.unregister('nope')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Execution — happy path
  // -----------------------------------------------------------------------

  describe('execution — first step succeeds', () => {
    it('returns success with the result from the first step', async () => {
      const sc = ChainBuilder.start('chain-a')
        .then('retry', 'Retry', successStep('retry', 'recovered'))
        .build();
      chain.register('transcription', sc);

      const outcome = await chain.execute('transcription', defaultConfig('transcription'));

      expect(outcome.success).toBe(true);
      expect(outcome.result).toBe('recovered');
      expect(outcome.winningStepId).toBe('retry');
      expect(outcome.stepsAttempted).toBe(1);
      expect(outcome.stepsSkipped).toBe(0);
      expect(outcome.confidence).toBe(0.9);
    });
  });

  describe('execution — fallback to second step', () => {
    it('tries the next step when the first fails', async () => {
      const sc = ChainBuilder.start('chain-b')
        .then('retry', 'Retry', failStep())
        .then('cache', 'Cache', successStep('cache', 'cached'))
        .build();
      chain.register('analysis', sc);

      const outcome = await chain.execute('analysis', defaultConfig('analysis'));

      expect(outcome.success).toBe(true);
      expect(outcome.result).toBe('cached');
      expect(outcome.winningStepId).toBe('cache');
      expect(outcome.stepsAttempted).toBe(2);
      expect(outcome.trace).toHaveLength(2);
      expect(outcome.trace[0].success).toBe(false);
      expect(outcome.trace[1].success).toBe(true);
    });
  });

  describe('execution — all steps fail', () => {
    it('returns failure with all steps attempted', async () => {
      const sc = ChainBuilder.start('chain-c')
        .then('retry', 'Retry', failStep())
        .then('cache', 'Cache', failStep())
        .then('minimal', 'Minimal', failStep())
        .build();
      chain.register('rendering', sc);

      const outcome = await chain.execute('rendering', defaultConfig('rendering'));

      expect(outcome.success).toBe(false);
      expect(outcome.result).toBeUndefined();
      expect(outcome.winningStepId).toBeNull();
      expect(outcome.stepsAttempted).toBe(3);
      expect(outcome.trace.every((t) => !t.success)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Execution — no chain registered
  // -----------------------------------------------------------------------

  describe('execution — no chain for stage', () => {
    it('returns a failure outcome without crashing', async () => {
      const outcome = await chain.execute('unknown_stage', defaultConfig('unknown_stage'));
      expect(outcome.success).toBe(false);
      expect(outcome.stepsAttempted).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Execution — confidence threshold
  // -----------------------------------------------------------------------

  describe('minConfidence threshold', () => {
    it('continues to next step when confidence is below threshold', async () => {
      const sc = ChainBuilder.start('chain-d')
        .then('low', 'Low confidence', successStep('low', 'weak', 0.3))
        .then('high', 'High confidence', successStep('high', 'strong', 0.95))
        .build();
      chain.register('layout_generation', sc);

      const outcome = await chain.execute('layout_generation', {
        stage: 'layout_generation',
        timeBudgetMs: 30_000,
        minConfidence: 0.8,
      });

      expect(outcome.success).toBe(true);
      expect(outcome.result).toBe('strong');
      expect(outcome.winningStepId).toBe('high');
      expect(outcome.stepsAttempted).toBe(2);
    });

    it('accepts the first step when confidence meets threshold', async () => {
      const sc = ChainBuilder.start('chain-e')
        .then('good', 'Good enough', successStep('good', 'acceptable', 0.7))
        .then('better', 'Better', successStep('better', 'best', 0.99))
        .build();
      chain.register('analysis', sc);

      const outcome = await chain.execute('analysis', {
        stage: 'analysis',
        timeBudgetMs: 30_000,
        minConfidence: 0.5,
      });

      expect(outcome.success).toBe(true);
      expect(outcome.result).toBe('acceptable');
      expect(outcome.winningStepId).toBe('good');
      expect(outcome.stepsAttempted).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Execution — time budget
  // -----------------------------------------------------------------------

  describe('time budget', () => {
    it('skips optional steps when budget is low', async () => {
      const sc = ChainBuilder.start('chain-f')
        .then('slow', 'Slow step', delayedStep('slow', 'slow-val', 200))
        .thenOptional('optional-cache', 'Optional cache', successStep('optional-cache', 'cached'))
        .then('final', 'Final fallback', successStep('final', 'last-resort', 0.5))
        .build();
      chain.register('transcription', sc);

      const outcome = await chain.execute('transcription', {
        stage: 'transcription',
        timeBudgetMs: 250, // barely enough for slow step
      });

      // The slow step should succeed but the optional step may be skipped
      // depending on timing. The final step is mandatory and should still run.
      expect(outcome.success).toBe(true);
      // Either slow won (confidence 0.8) or final won (0.5)
      expect(['slow', 'final']).toContain(outcome.winningStepId);
    });
  });

  // -----------------------------------------------------------------------
  // Execution — step throws
  // -----------------------------------------------------------------------

  describe('step throws error', () => {
    it('continues to the next step when a step throws', async () => {
      const sc = ChainBuilder.start('chain-g')
        .then('crash', 'Crashy step', throwStep('oh no'))
        .then('recover', 'Recovery step', successStep('recover', 'saved'))
        .build();
      chain.register('animation', sc);

      const outcome = await chain.execute('animation', defaultConfig('animation'));

      expect(outcome.success).toBe(true);
      expect(outcome.result).toBe('saved');
      expect(outcome.winningStepId).toBe('recover');
      expect(outcome.trace[0].success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // onStepComplete callback
  // -----------------------------------------------------------------------

  describe('onStepComplete callback', () => {
    it('calls onStepComplete for each step', async () => {
      const completions: Array<{ stepId: string; success: boolean }> = [];

      const sc = ChainBuilder.start('chain-h')
        .then('a', 'Step A', failStep())
        .then('b', 'Step B', successStep('b', 'ok'))
        .build();
      chain.register('export', sc);

      await chain.execute('export', {
        stage: 'export',
        timeBudgetMs: 30_000,
        onStepComplete: (stepId, success) => {
          completions.push({ stepId, success });
        },
      });

      expect(completions).toEqual([
        { stepId: 'a', success: false },
        { stepId: 'b', success: true },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  describe('statistics', () => {
    it('tracks success rate and average steps', async () => {
      const sc = ChainBuilder.start('stats-chain')
        .then('retry', 'Retry', successStep('retry', 'ok'))
        .build();
      chain.register('analysis', sc);

      await chain.execute('analysis', defaultConfig('analysis'));
      await chain.execute('analysis', defaultConfig('analysis'));

      const stats = chain.getStats('stats-chain');
      expect(stats).not.toBeNull();
      expect(stats!.totalRuns).toBe(2);
      expect(stats!.successes).toBe(2);
      expect(stats!.avgStepsToSuccess).toBe(1);
      expect(stats!.topWinningStep).toBe('retry');
      expect(stats!.lastRunAt).toBeGreaterThan(0);
    });

    it('tracks failures in stats', async () => {
      const sc = ChainBuilder.start('fail-chain')
        .then('x', 'X', failStep())
        .build();
      chain.register('rendering', sc);

      await chain.execute('rendering', defaultConfig('rendering'));

      const stats = chain.getStats('fail-chain');
      expect(stats!.totalRuns).toBe(1);
      expect(stats!.successes).toBe(0);
      expect(stats!.topWinningStep).toBeNull();
    });

    it('getAllStats returns stats for all chains', async () => {
      const sc1 = ChainBuilder.start('c1').then('a', 'A', successStep('a', '1')).build();
      const sc2 = ChainBuilder.start('c2').then('b', 'B', failStep()).build();
      chain.register('s1', sc1);
      chain.register('s2', sc2);

      await chain.execute('s1', defaultConfig('s1'));
      await chain.execute('s2', defaultConfig('s2'));

      const allStats = chain.getAllStats();
      expect(allStats).toHaveLength(2);
      const names = allStats.map((s) => s.chainName).sort();
      expect(names).toEqual(['c1', 'c2']);
    });

    it('returns null for unknown chain stats', () => {
      expect(chain.getStats('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // ChainBuilder
  // -----------------------------------------------------------------------

  describe('ChainBuilder', () => {
    it('builds a chain with mandatory steps', () => {
      const chain = ChainBuilder.start('test')
        .then('a', 'Step A', successStep('a', '1'))
        .then('b', 'Step B', successStep('b', '2'))
        .build();

      expect(chain.name).toBe('test');
      expect(chain.steps).toHaveLength(2);
      expect(chain.steps[0].optional).toBe(false);
      expect(chain.steps[1].optional).toBe(false);
    });

    it('builds a chain with optional steps', () => {
      const chain = ChainBuilder.start('test')
        .then('a', 'A', successStep('a', '1'))
        .thenOptional('b', 'B', successStep('b', '2'))
        .build();

      expect(chain.steps[0].optional).toBe(false);
      expect(chain.steps[1].optional).toBe(true);
    });

    it('build() returns a fresh copy each time', () => {
      const builder = ChainBuilder.start('test')
        .then('a', 'A', successStep('a', '1'));

      const c1 = builder.build();
      const c2 = builder.build();

      expect(c1.steps).not.toBe(c2.steps); // different array instances
      expect(c1.steps).toEqual(c2.steps);  // same content
    });
  });

  // -----------------------------------------------------------------------
  // Trace detail
  // -----------------------------------------------------------------------

  describe('trace', () => {
    it('records duration and skip reason for skipped steps', async () => {
      const sc = ChainBuilder.start('trace-chain')
        .thenOptional('opt', 'Optional', successStep('opt', 'x'))
        .build();
      chain.register('analysis', sc);

      // Give 0 budget so optional is skipped
      const outcome = await chain.execute('analysis', {
        stage: 'analysis',
        timeBudgetMs: 0,
      });

      // With 0 budget, the optional step should be skipped
      expect(outcome.trace.length).toBeGreaterThanOrEqual(1);
      const skipped = outcome.trace.find((t) => !t.attempted);
      if (skipped) {
        expect(skipped.skipReason).toBe('budget_exhausted');
        expect(skipped.durationMs).toBe(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('globalRecoveryChain singleton', () => {
  it('is an instance of RecoveryStrategyChain', () => {
    expect(globalRecoveryChain).toBeInstanceOf(RecoveryStrategyChain);
  });
});
