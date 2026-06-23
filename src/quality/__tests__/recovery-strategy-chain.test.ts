/**
 * Tests for RecoveryStrategyChain — composable sequential fallback chains
 * for error recovery.
 *
 * Tests cover:
 * - ChainBuilder fluent API
 * - Chain execution (success, failure, timeout, confidence threshold)
 * - Statistics tracking
 * - Event bus integration
 * - Edge cases (empty chains, throwing steps, optional steps)
 */

import {
  ChainBuilder,
  RecoveryStrategyChain,
  globalRecoveryChain,
  type ChainStep,
  type ChainOutcome,
  type StrategyChain,
  type ChainConfig,
} from '../recovery-strategy-chain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a step that resolves with the given result. */
function makeSuccessStep(
  id: string,
  result: unknown = 'ok',
  confidence: number = 1.0,
  fallbackUsed: boolean = false,
  delay: number = 0,
): ChainStep {
  return {
    id,
    name: `Step ${id}`,
    optional: false,
    async execute() {
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      return { result, fallbackUsed, confidence };
    },
  };
}

/** Create a step that returns undefined (failure). */
function makeFailStep(id: string, delay: number = 0): ChainStep {
  return {
    id,
    name: `Step ${id}`,
    optional: false,
    async execute() {
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      return undefined;
    },
  };
}

/** Create a step that throws an error. */
function makeThrowStep(id: string, error?: Error): ChainStep {
  return {
    id,
    name: `Step ${id}`,
    optional: false,
    async execute() {
      throw error ?? new Error(`Step ${id} failed`);
    },
  };
}

// ---------------------------------------------------------------------------
// ChainBuilder tests
// ---------------------------------------------------------------------------

describe('ChainBuilder', () => {
  test('start creates a new builder', () => {
    const builder = ChainBuilder.start('test-chain');
    expect(builder).toBeDefined();
  });

  test('then adds mandatory step', () => {
    const chain = ChainBuilder.start('test')
      .then('s1', 'Step 1', async () => ({ result: 'a', fallbackUsed: false, confidence: 1 }))
      .build();
    expect(chain.steps).toHaveLength(1);
    expect(chain.steps[0].id).toBe('s1');
    expect(chain.steps[0].optional).toBe(false);
  });

  test('thenOptional adds optional step', () => {
    const chain = ChainBuilder.start('test')
      .thenOptional('s1', 'Step 1', async () => undefined)
      .build();
    expect(chain.steps[0].optional).toBe(true);
  });

  test('multiple steps are added in order', () => {
    const chain = ChainBuilder.start('test')
      .then('s1', 'Step 1', async () => undefined)
      .then('s2', 'Step 2', async () => undefined)
      .thenOptional('s3', 'Step 3', async () => undefined)
      .build();
    expect(chain.steps).toHaveLength(3);
    expect(chain.steps.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  test('build produces immutable copy of steps', () => {
    const builder = ChainBuilder.start('test')
      .then('s1', 'Step 1', async () => undefined);
    const chain1 = builder.build();
    builder.then('s2', 'Step 2', async () => undefined);
    const chain2 = builder.build();
    expect(chain1.steps).toHaveLength(1);
    expect(chain2.steps).toHaveLength(2);
  });

  test('build sets chain name', () => {
    const chain = ChainBuilder.start('my-chain').build();
    expect(chain.name).toBe('my-chain');
  });

  test('empty chain can be built', () => {
    const chain = ChainBuilder.start('empty').build();
    expect(chain.steps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Registration
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Registration', () => {
  test('register adds chain for stage', () => {
    const executor = new RecoveryStrategyChain();
    const chain = ChainBuilder.start('test').then('s1', 'Step 1', async () => undefined).build();
    executor.register('transcription', chain);
    expect(executor.getChain('transcription')).toBe(chain);
  });

  test('register replaces existing chain', () => {
    const executor = new RecoveryStrategyChain();
    const chain1 = ChainBuilder.start('chain1').build();
    const chain2 = ChainBuilder.start('chain2').build();
    executor.register('stage', chain1);
    executor.register('stage', chain2);
    expect(executor.getChain('stage')).toBe(chain2);
  });

  test('unregister removes chain', () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('test').build());
    expect(executor.unregister('stage')).toBe(true);
    expect(executor.getChain('stage')).toBeUndefined();
  });

  test('unregister returns false for unregistered stage', () => {
    const executor = new RecoveryStrategyChain();
    expect(executor.unregister('nonexistent')).toBe(false);
  });

  test('getChain returns undefined for unregistered stage', () => {
    const executor = new RecoveryStrategyChain();
    expect(executor.getChain('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Execution
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Execution', () => {
  test('returns empty outcome for unregistered stage', async () => {
    const executor = new RecoveryStrategyChain();
    const outcome = await executor.execute('nonexistent', { stage: 'nonexistent' });
    expect(outcome.success).toBe(false);
    expect(outcome.stepsAttempted).toBe(0);
    expect(outcome.stepsSkipped).toBe(0);
    expect(outcome.trace).toHaveLength(0);
  });

  test('succeeds when first step returns valid result', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'data', fallbackUsed: false, confidence: 0.9 }))
      .then('s2', 'Step 2', async () => ({ result: 'data2', fallbackUsed: false, confidence: 1.0 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(true);
    expect(outcome.winningStepId).toBe('s1');
    expect(outcome.result).toBe('data');
    expect(outcome.confidence).toBe(0.9);
    expect(outcome.stepsAttempted).toBe(1);
    expect(outcome.fallbackUsed).toBe(false);
  });

  test('falls through to next step on failure', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => undefined)
      .then('s2', 'Step 2', async () => ({ result: 'recovered', fallbackUsed: true, confidence: 0.5 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(true);
    expect(outcome.winningStepId).toBe('s2');
    expect(outcome.result).toBe('recovered');
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.stepsAttempted).toBe(2);
  });

  test('fails when all steps return undefined', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => undefined)
      .then('s2', 'Step 2', async () => undefined)
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(false);
    expect(outcome.winningStepId).toBeNull();
    expect(outcome.stepsAttempted).toBe(2);
    expect(outcome.trace).toHaveLength(2);
    expect(outcome.trace.every(t => !t.success)).toBe(true);
  });

  test('handles thrown errors gracefully', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => { throw new Error('boom'); })
      .then('s2', 'Step 2', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(true);
    expect(outcome.winningStepId).toBe('s2');
    expect(outcome.trace[0].attempted).toBe(true);
    expect(outcome.trace[0].success).toBe(false);
  });

  test('minConfidence threshold stops chain early', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'low', fallbackUsed: false, confidence: 0.3 }))
      .then('s2', 'Step 2', async () => ({ result: 'high', fallbackUsed: false, confidence: 0.9 }))
      .build());

    // minConfidence = 0.8 means s1 succeeds but doesn't meet threshold
    const outcome = await executor.execute('stage', { stage: 'stage', minConfidence: 0.8 });
    expect(outcome.success).toBe(true);
    expect(outcome.winningStepId).toBe('s2');
    expect(outcome.confidence).toBe(0.9);
  });

  test('result with low confidence is recorded but chain continues', async () => {
    const executor = new RecoveryStrategyChain();
    let s2Called = false;
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'low', fallbackUsed: false, confidence: 0.3 }))
      .then('s2', 'Step 2', async () => { s2Called = true; return undefined; })
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage', minConfidence: 0.8 });
    expect(outcome.success).toBe(false);
    expect(s2Called).toBe(true);
    expect(outcome.trace[0].success).toBe(true); // s1 did return a result
    expect(outcome.trace[0].confidence).toBe(0.3);
  });

  test('onStepComplete callback is called for each step', async () => {
    const executor = new RecoveryStrategyChain();
    const completedSteps: Array<{ id: string; success: boolean }> = [];

    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => undefined)
      .then('s2', 'Step 2', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    await executor.execute('stage', {
      stage: 'stage',
      onStepComplete: (id, success) => completedSteps.push({ id, success }),
    });

    expect(completedSteps).toEqual([
      { id: 's1', success: false },
      { id: 's2', success: true },
    ]);
  });

  test('empty chain returns failure', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('empty').build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(false);
    expect(outcome.stepsAttempted).toBe(0);
  });

  test('totalDurationMs is positive after execution', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Time budget
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Time budget', () => {
  test('skips optional steps when budget is low', async () => {
    const executor = new RecoveryStrategyChain();
    let optionalCalled = false;
    executor.register('stage', ChainBuilder.start('chain')
      .then('slow', 'Slow mandatory', async () => {
        await new Promise(r => setTimeout(r, 50));
        return undefined;
      })
      .thenOptional('optional', 'Optional', async () => {
        optionalCalled = true;
        return { result: 'opt', fallbackUsed: false, confidence: 1 };
      })
      .then('fallback', 'Fallback', async () => ({ result: 'fallback', fallbackUsed: true, confidence: 0.5 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage', timeBudgetMs: 60 });
    // Optional step should be skipped if remaining < 500ms
    // The mandatory slow step takes 50ms, leaving ~10ms, which is < 500ms
    expect(optionalCalled).toBe(false);
  });

  test('skips all remaining steps when budget is exhausted', async () => {
    const executor = new RecoveryStrategyChain();
    let s2Called = false;
    executor.register('stage', ChainBuilder.start('chain')
      .then('slow', 'Slow step', async () => {
        await new Promise(r => setTimeout(r, 60));
        return undefined;
      })
      .then('s2', 'Step 2', async () => {
        s2Called = true;
        return { result: 'ok', fallbackUsed: false, confidence: 1 };
      })
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage', timeBudgetMs: 30 });
    // After 60ms step, remaining is negative → s2 should be skipped
    expect(outcome.stepsSkipped).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Trace
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Trace', () => {
  test('trace records all attempted steps with timing', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.trace).toHaveLength(1);
    expect(outcome.trace[0].stepId).toBe('s1');
    expect(outcome.trace[0].stepName).toBe('Step 1');
    expect(outcome.trace[0].attempted).toBe(true);
    expect(outcome.trace[0].success).toBe(true);
    expect(outcome.trace[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(outcome.trace[0].confidence).toBe(1);
  });

  test('trace records skipReason for skipped steps', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('slow', 'Slow', async () => {
        await new Promise(r => setTimeout(r, 60));
        return undefined;
      })
      .then('s2', 'Step 2', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage', timeBudgetMs: 30 });
    const skipped = outcome.trace.filter(t => !t.attempted);
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    expect(skipped[0].skipReason).toBe('budget_exhausted');
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Statistics
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Statistics', () => {
  test('records stats on success', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    await executor.execute('stage', { stage: 'stage' });

    const stats = executor.getStats('chain');
    expect(stats).not.toBeNull();
    expect(stats!.totalRuns).toBe(1);
    expect(stats!.successes).toBe(1);
    expect(stats!.topWinningStep).toBe('s1');
    expect(stats!.lastRunAt).toBeGreaterThan(0);
  });

  test('records stats on failure', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => undefined)
      .build());

    await executor.execute('stage', { stage: 'stage' });

    const stats = executor.getStats('chain');
    expect(stats!.totalRuns).toBe(1);
    expect(stats!.successes).toBe(0);
    expect(stats!.topWinningStep).toBeNull();
  });

  test('avgStepsToSuccess calculates correctly', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => undefined)
      .then('s2', 'Step 2', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    // Run 1: fails on s1, succeeds on s2 (2 steps)
    await executor.execute('stage', { stage: 'stage' });
    // Run 2: same pattern
    await executor.execute('stage', { stage: 'stage' });

    const stats = executor.getStats('chain');
    expect(stats!.successes).toBe(2);
    expect(stats!.avgStepsToSuccess).toBe(2); // 4 total / 2 successes
  });

  test('avgDurationMs is positive', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    await executor.execute('stage', { stage: 'stage' });
    await executor.execute('stage', { stage: 'stage' });

    const stats = executor.getStats('chain');
    expect(stats!.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  test('getStats returns null for unknown chain', () => {
    const executor = new RecoveryStrategyChain();
    expect(executor.getStats('nonexistent')).toBeNull();
  });

  test('getAllStats returns all registered chain stats', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage1', ChainBuilder.start('chain1')
      .then('s1', 'Step 1', async () => ({ result: 'a', fallbackUsed: false, confidence: 1 }))
      .build());
    executor.register('stage2', ChainBuilder.start('chain2')
      .then('s1', 'Step 1', async () => ({ result: 'b', fallbackUsed: false, confidence: 1 }))
      .build());

    await executor.execute('stage1', { stage: 'stage1' });
    await executor.execute('stage2', { stage: 'stage2' });

    const allStats = executor.getAllStats();
    expect(allStats).toHaveLength(2);
    expect(allStats.map(s => s.chainName)).toContain('chain1');
    expect(allStats.map(s => s.chainName)).toContain('chain2');
  });
});

// ---------------------------------------------------------------------------
// RecoveryStrategyChain — Outcome structure
// ---------------------------------------------------------------------------

describe('RecoveryStrategyChain — Outcome structure', () => {
  test('outcome has all required fields', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome).toHaveProperty('success');
    expect(outcome).toHaveProperty('winningStepId');
    expect(outcome).toHaveProperty('fallbackUsed');
    expect(outcome).toHaveProperty('confidence');
    expect(outcome).toHaveProperty('stepsAttempted');
    expect(outcome).toHaveProperty('stepsSkipped');
    expect(outcome).toHaveProperty('trace');
    expect(outcome).toHaveProperty('totalDurationMs');
    expect(outcome).toHaveProperty('stage');
    expect(outcome.stage).toBe('stage');
  });

  test('empty outcome for missing chain has correct shape', async () => {
    const executor = new RecoveryStrategyChain();
    const outcome = await executor.execute('missing', { stage: 'missing' });
    expect(outcome.success).toBe(false);
    expect(outcome.winningStepId).toBeNull();
    expect(outcome.fallbackUsed).toBe(false);
    expect(outcome.confidence).toBe(0);
    expect(outcome.stepsAttempted).toBe(0);
    expect(outcome.stepsSkipped).toBe(0);
    expect(outcome.trace).toEqual([]);
    expect(outcome.totalDurationMs).toBe(0);
    expect(outcome.stage).toBe('missing');
  });
});

// ---------------------------------------------------------------------------
// globalRecoveryChain singleton
// ---------------------------------------------------------------------------

describe('globalRecoveryChain', () => {
  test('is an instance of RecoveryStrategyChain', () => {
    expect(globalRecoveryChain).toBeInstanceOf(RecoveryStrategyChain);
  });
});

// ---------------------------------------------------------------------------
// Default config values
// ---------------------------------------------------------------------------

describe('default config values', () => {
  test('timeBudgetMs defaults to 30000', async () => {
    const executor = new RecoveryStrategyChain();
    const chain = ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 1 }))
      .build();
    executor.register('stage', chain);

    // Should complete fine with default budget
    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(true);
  });

  test('minConfidence defaults to 0 (any result accepted)', async () => {
    const executor = new RecoveryStrategyChain();
    executor.register('stage', ChainBuilder.start('chain')
      .then('s1', 'Step 1', async () => ({ result: 'ok', fallbackUsed: false, confidence: 0.01 }))
      .build());

    const outcome = await executor.execute('stage', { stage: 'stage' });
    expect(outcome.success).toBe(true);
    expect(outcome.confidence).toBe(0.01);
  });
});
