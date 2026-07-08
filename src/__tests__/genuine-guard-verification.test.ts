/**
 * Genuine guard verification tests.
 *
 * Unlike tautological tests that only prove `null.map()` throws in JavaScript,
 * these tests call ACTUAL PRODUCTION FUNCTIONS with null/undefined injected
 * into guarded fields. Each test verifies:
 *
 * 1. WITH guard: function completes without crashing
 * 2. The guard is on the CRASH PATH (first access to the nullable field)
 *
 * Red-phase verification was performed during development by temporarily
 * replacing `safeArray(x)` with `x` (or `x as Type[]`) and confirming
 * each test crashes with TypeError.
 */

import {
  describe,
  it,
  expect,
} from '@jest/globals';

import { IterationManager } from '../framework/iteration-manager';
import type { DevelopmentCycle } from '../framework/iteration-manager';
import { StageQualityGate } from '../quality/quality-gate';
import { QualityMonitor } from '../quality/quality-monitor';

// ============================================================
// 1. IterationManager.evaluateSuccessCriteria — line 121 guard
//    safeArray(this.cycle.successCriteria).map(...)
//    This is the FIRST access to successCriteria in this method.
// ============================================================

describe('IterationManager.evaluateSuccessCriteria — safeArray guard (line 121)', () => {
  function makeManager(criteria: unknown): IterationManager {
    const cycle = {
      phase: 'test',
      maxIterations: 1,
      successCriteria: criteria,
      failureRecovery: 'retry',
      commitTrigger: 'on_success',
      currentIteration: 0,
      status: 'in_progress',
    } as unknown as DevelopmentCycle;
    return new IterationManager(cycle);
  }

  it('WITH guard: completes when successCriteria is null', () => {
    const manager = makeManager(null);
    const priv = manager as unknown as {
      evaluateSuccessCriteria: (m: Record<string, unknown>) => {
        allMet: boolean;
        results: { criterion: string; met: boolean }[];
      };
    };
    expect(() => priv.evaluateSuccessCriteria({})).not.toThrow();
  });

  it('WITH guard: completes when successCriteria is undefined', () => {
    const manager = makeManager(undefined);
    const priv = manager as unknown as {
      evaluateSuccessCriteria: (m: Record<string, unknown>) => {
        allMet: boolean;
        results: { criterion: string; met: boolean }[];
      };
    };
    expect(() => priv.evaluateSuccessCriteria({})).not.toThrow();
  });

  it('WITH guard: returns empty results when successCriteria is null', () => {
    const manager = makeManager(null);
    const priv = manager as unknown as {
      evaluateSuccessCriteria: (m: Record<string, unknown>) => {
        allMet: boolean;
        results: { criterion: string; met: boolean }[];
      };
    };
    const result = priv.evaluateSuccessCriteria({});
    expect(result.results).toEqual([]);
    expect(result.allMet).toBe(true); // every() on empty array → true
  });

  it('WITH guard: still works normally with valid criteria', () => {
    const manager = makeManager(['accuracy > 80%']);
    const priv = manager as unknown as {
      evaluateSuccessCriteria: (m: Record<string, unknown>) => {
        allMet: boolean;
        results: { criterion: string; met: boolean }[];
      };
    };
    const result = priv.evaluateSuccessCriteria({ accuracy: 90 });
    expect(result.results).toHaveLength(1);
    expect(result.allMet).toBe(true);
  });
});

// ============================================================
// 2. StageQualityGate.evaluate — line 107 guard
//    safeArray(this.config.criteria).map(...)
//    This is the FIRST access to criteria in this method.
// ============================================================

describe('StageQualityGate.evaluate — safeArray guard (line 107)', () => {
  it('WITH guard: completes when config.criteria is null', () => {
    const gate = new StageQualityGate({
      stage: 'test',
      name: 'test-gate',
      criteria: null,
      blockingOnFailure: false,
    } as unknown as ConstructorParameters<typeof StageQualityGate>[0]);
    expect(() => gate.evaluate({})).not.toThrow();
  });

  it('WITH guard: completes when config.criteria is undefined', () => {
    const gate = new StageQualityGate({
      stage: 'test',
      name: 'test-gate',
      criteria: undefined,
      blockingOnFailure: false,
    } as unknown as ConstructorParameters<typeof StageQualityGate>[0]);
    expect(() => gate.evaluate({})).not.toThrow();
  });

  it('WITH guard: returns passed=true when criteria is null (vacuous truth)', () => {
    const gate = new StageQualityGate({
      stage: 'test',
      name: 'test-gate',
      criteria: null,
      blockingOnFailure: false,
    } as unknown as ConstructorParameters<typeof StageQualityGate>[0]);
    const result = gate.evaluate({});
    expect(result.passed).toBe(true); // every() on empty results → true
    expect(result.results).toEqual([]);
  });
});

// ============================================================
// 3. QualityMonitor.getQualityTrends — line 669 guard
//    const history = safeArray(this.iterationHistory)
//    This is the FIRST access to iterationHistory in this method.
// ============================================================

describe('QualityMonitor.getQualityTrends — safeArray guard (line 669)', () => {
  it('WITH guard: completes when iterationHistory is null', () => {
    const monitor = new QualityMonitor();
    // Inject null via cast to simulate field corruption / deserialization gap
    (monitor as unknown as { iterationHistory: null }).iterationHistory = null;
    expect(() => monitor.getQualityTrends()).not.toThrow();
  });

  it('WITH guard: completes when iterationHistory is undefined', () => {
    const monitor = new QualityMonitor();
    (monitor as unknown as { iterationHistory: undefined }).iterationHistory = undefined;
    expect(() => monitor.getQualityTrends()).not.toThrow();
  });

  it('WITH guard: returns empty arrays when iterationHistory is null', () => {
    const monitor = new QualityMonitor();
    (monitor as unknown as { iterationHistory: null }).iterationHistory = null;
    const trends = monitor.getQualityTrends();
    expect(trends.performance).toEqual([]);
    expect(trends.accuracy).toEqual([]);
    expect(trends.reliability).toEqual([]);
    expect(trends.overall).toEqual([]);
  });
});

// ============================================================
// 4. errorHandler — line 119 guard
//    safeArray(guidance.recoveryStrategies).map(...)
//    This is the FIRST access to recoveryStrategies in the response builder.
// ============================================================

describe('errorHandler — safeArray guard on recoveryStrategies (line 119)', () => {
  /*
   * Testing this requires a PipelineError + Express response mock + the
   * pipelineErrorGuidance bridge. Since provideGuidance always returns
   * an array for recoveryStrategies (never null), the safeArray guard
   * here is defense-in-depth against a corrupted guidance object.
   *
   * We verify the guard by calling errorHandler with a mocked PipelineError
   * and intercepting the guidance bridge to return null recoveryStrategies.
   */

  it('WITH guard: error response builds when recoveryStrategies is null', async () => {
    // Dynamic import to get the module with its dependencies
    const { errorHandler } = await import('../api/middleware/error-handler');
    const { PipelineError } = await import('../pipeline/pipeline-errors');
    const { pipelineErrorGuidance } = await import('../quality/pipeline-error-guidance');

    // Spy on provideGuidance to return null recoveryStrategies
    const original = pipelineErrorGuidance.provideGuidance;
    pipelineErrorGuidance.provideGuidance = () => ({
      userMessage: 'Test error',
      classifiedType: 'test',
      recoverable: false,
      suggestedAction: 'none',
      severity: 'low',
      recoveryStrategies: null as unknown as { description: string }[],
      preventionTips: [],
    });

    const err = new PipelineError('test error', 'validation', 'test-stage');
    const res = {
      status: () => res,
      json: (body: unknown) => {
        // Verify the response builds without crashing
        expect(body).toBeDefined();
        const e = (body as { error: { strategies: unknown } }).error;
        expect(e.strategies).toEqual([]);
      },
    };

    try {
      errorHandler(
        err,
        {} as never,
        res as never,
        {} as never,
      );
    } finally {
      pipelineErrorGuidance.provideGuidance = original;
    }
  });
});
