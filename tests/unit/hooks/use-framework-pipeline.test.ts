/**
 * @jest-environment jsdom
 */

/**
 * REQ-137: useFrameworkPipeline Hook Unit Tests
 *
 * Tests the hook logic via:
 * 1. FrameworkIntegratedPipeline mock interactions
 * 2. Execution state transitions
 * 3. Iteration history tracking
 * 4. Error recovery mechanisms
 *
 * Uses @testing-library/react-hooks pattern with jest mocks.
 * Converted to jest.unstable_mockModule() for ESM compatibility (TASK-0191).
 */

import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks (ESM-compatible)
// ---------------------------------------------------------------------------

const mockSetPhase = jest.fn();
const mockExecute = jest.fn();
const mockGenerateReport = jest.fn().mockReturnValue('# Report');
const mockGetIterationSummary = jest.fn().mockReturnValue({ iterations: 0 });
const mockGetImprovementHistory = jest.fn().mockReturnValue([]);

jest.unstable_mockModule('@/pipeline/framework-integrated-pipeline', () => ({
  FrameworkIntegratedPipeline: jest.fn().mockImplementation(() => ({
    setPhase: mockSetPhase,
    execute: mockExecute,
    generateReport: mockGenerateReport,
    getIterationSummary: mockGetIterationSummary,
    getImprovementHistory: mockGetImprovementHistory,
  })),
}));

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('@/framework/iteration-manager', () => ({
  DEVELOPMENT_CYCLES: {
    'MVP構築': { phase: 'MVP構築', maxIterations: 3, successCriteria: [], failureRecovery: '' },
    '基本機能': { phase: '基本機能', maxIterations: 5, successCriteria: [], failureRecovery: '' },
    '高品質化': { phase: '高品質化', maxIterations: 5, successCriteria: [], failureRecovery: '' },
    'リリース準備': { phase: 'リリース準備', maxIterations: 3, successCriteria: [], failureRecovery: '' },
  },
}));

// Fetch mock for auto-commit
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
});

// ---------------------------------------------------------------------------
// Dynamic imports (ESM-compatible)
// ---------------------------------------------------------------------------

let MonitoringError: typeof import('@/pipeline/pipeline-errors').MonitoringError;
let useFrameworkPipeline: typeof import('@/hooks/useFrameworkPipeline').useFrameworkPipeline;
let useIterationLog: typeof import('@/hooks/useFrameworkPipeline').useIterationLog;

beforeAll(async () => {
  const errorsMod = await import('@/pipeline/pipeline-errors');
  MonitoringError = errorsMod.MonitoringError;
  const hooksMod = await import('@/hooks/useFrameworkPipeline');
  useFrameworkPipeline = hooksMod.useFrameworkPipeline;
  useIterationLog = hooksMod.useIterationLog;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultPipelineInput = {
  audioFile: 'test.wav' as unknown as File,
};

const successResult = {
  success: true,
  scenes: [],
  audioUrl: '/audio/test.wav',
  duration: 10,
  processingTime: 5000,
};

const successExecution = {
  result: successResult,
  iterationMetrics: { score: 90 },
  qualityAnalysis: {
    overallScore: 92,
    needsImprovement: false,
    recommendations: [],
    performanceScore: 90,
    accuracyScore: 94,
    stabilityScore: 92,
  },
  shouldCommit: false,
  commitMessage: undefined,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFrameworkPipeline (REQ-137)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue(successExecution);
    mockGenerateReport.mockReturnValue('# Report');
    mockGetIterationSummary.mockReturnValue({ iterations: 0 });
    mockGetImprovementHistory.mockReturnValue([]);
  });

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    test('should start with isRunning=false', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.executionState.isRunning).toBe(false);
    });

    test('should start with progress=0', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.executionState.progress).toBe(0);
    });

    test('should start with empty iterationHistory', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.iterationHistory).toEqual([]);
    });

    test('should start with zero quality score', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.qualityMetrics.overallScore).toBe(0);
    });

    test('should start with null result', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.result).toBeNull();
    });
  });

  // =========================================================================
  // Pipeline execution
  // =========================================================================

  describe('execute', () => {
    test('should set isRunning=true during execution', async () => {
      let resolveExecution!: (value: unknown) => void;
      mockExecute.mockReturnValue(new Promise(r => { resolveExecution = r; }));

      const { result } = renderHook(() => useFrameworkPipeline());

      // Start execution in a suspended state
      let execPromise: Promise<void>;
      act(() => {
        execPromise = result.current.execute(defaultPipelineInput);
      });

      // Resolve and await completion
      await act(async () => {
        resolveExecution(successExecution);
        await execPromise!;
      });

      // After completion, isRunning should be false again
      expect(result.current.executionState.isRunning).toBe(false);
    });

    test('should update progress to 100 on success', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.executionState.progress).toBe(100);
      expect(result.current.executionState.isRunning).toBe(false);
    });

    test('should set result on success', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.result).toEqual(successResult);
    });

    test('should add iteration to history on success', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.iterationHistory).toHaveLength(1);
      expect(result.current.iterationHistory[0].status).toBe('success');
      expect(result.current.iterationHistory[0].iterationNumber).toBe(1);
    });

    test('should update quality metrics from execution', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      // overallScore flows from qa.overallScore (A123 wiring fix).
      expect(result.current.qualityMetrics.overallScore).toBe(92);
      // breakdown.{performance,accuracy,stability} is an A124 DEFER (the engine
      // emits no per-category derivation — see useFrameworkPipeline.ts:243-249).
      // Asserting 0 here pins the typed deferral so a regression that silently
      // re-surfaces the pre-A124 lying `qa.performanceScore||0` (which always
      // read 0 because the producer never emitted those keys) is caught.
      expect(result.current.qualityMetrics.breakdown.performance).toBe(0);
      expect(result.current.qualityMetrics.breakdown.accuracy).toBe(0);
      expect(result.current.qualityMetrics.breakdown.stability).toBe(0);
    });
  });

  // =========================================================================
  // Error recovery
  // =========================================================================

  describe('error recovery', () => {
    test('should handle pipeline execution errors', async () => {
      mockExecute.mockRejectedValue(new Error('Pipeline crashed'));

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.executionState.isRunning).toBe(false);
      expect(result.current.executionState.error).toBe('Pipeline crashed');
    });

    test('should handle non-Error thrown values', async () => {
      mockExecute.mockRejectedValue('string error');

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.executionState.error).toBe('Unknown error');
    });

    test('should add failed iteration to history on error', async () => {
      mockExecute.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.iterationHistory).toHaveLength(1);
      expect(result.current.iterationHistory[0].status).toBe('failure');
    });

    test('should reset progress on error', async () => {
      mockExecute.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.executionState.progress).toBe(0);
    });
  });

  // =========================================================================
  // Stop execution
  // =========================================================================

  describe('stop', () => {
    test('should set isRunning=false on stop', () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      act(() => {
        result.current.stop();
      });

      expect(result.current.executionState.isRunning).toBe(false);
      expect(result.current.executionState.progress).toBe(0);
    });
  });

  // =========================================================================
  // Metrics accessors
  // =========================================================================

  describe('metrics accessors', () => {
    test('getReport should delegate to pipeline', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      const report = result.current.getReport();
      expect(report).toBe('# Report');
    });

    test('getIterationSummary should delegate to pipeline', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      const summary = result.current.getIterationSummary();
      expect(summary).toEqual({ iterations: 0 });
    });

    test('getImprovementHistory should delegate to pipeline', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      const history = result.current.getImprovementHistory();
      expect(history).toEqual([]);
    });
  });

  // =========================================================================
  // Auto-commit
  // =========================================================================

  describe('auto-commit', () => {
    test('should not auto-commit when shouldCommit is false', async () => {
      mockExecute.mockResolvedValue({
        ...successExecution,
        shouldCommit: false,
      });

      const { result } = renderHook(() => useFrameworkPipeline({
        enableAutoCommit: true,
      }));

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should auto-commit when shouldCommit=true and enableAutoCommit=true', async () => {
      mockExecute.mockResolvedValue({
        ...successExecution,
        shouldCommit: true,
        commitMessage: 'feat: auto commit',
      });

      const { result } = renderHook(() => useFrameworkPipeline({
        enableAutoCommit: true,
      }));

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'feat: auto commit' }),
      });
    });

    test('should not auto-commit when enableAutoCommit is false (default)', async () => {
      mockExecute.mockResolvedValue({
        ...successExecution,
        shouldCommit: true,
        commitMessage: 'feat: should not commit',
      });

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // REQ-137 Acceptance Criteria
  // =========================================================================

  describe('REQ-137 acceptance criteria', () => {
    test('TC-137-01: hook initializes with correct default state', () => {
      const { result } = renderHook(() => useFrameworkPipeline());
      expect(result.current.executionState.isRunning).toBe(false);
      expect(result.current.executionState.progress).toBe(0);
      expect(result.current.iterationHistory).toHaveLength(0);
      expect(result.current.qualityMetrics.overallScore).toBe(0);
    });

    test('TC-137-02: execute updates iteration history', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.iterationHistory).toHaveLength(1);
      const iter = result.current.iterationHistory[0];
      expect(iter).toHaveProperty('iterationNumber');
      expect(iter).toHaveProperty('phase');
      expect(iter).toHaveProperty('status');
      expect(iter).toHaveProperty('duration');
      expect(iter).toHaveProperty('timestamp');
    });

    test('TC-137-03: execute updates quality metrics', async () => {
      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.qualityMetrics.overallScore).toBeGreaterThan(0);
      expect(result.current.qualityMetrics.breakdown).toHaveProperty('performance');
      expect(result.current.qualityMetrics.breakdown).toHaveProperty('accuracy');
      expect(result.current.qualityMetrics.breakdown).toHaveProperty('stability');
    });

    test('TC-137-04: error recovery captures failed iteration', async () => {
      mockExecute.mockRejectedValue(new Error('test failure'));

      const { result } = renderHook(() => useFrameworkPipeline());

      await act(async () => {
        await result.current.execute(defaultPipelineInput);
      });

      expect(result.current.iterationHistory[0].status).toBe('failure');
      expect(result.current.executionState.error).toBe('test failure');
    });
  });
});

// =========================================================================
// useIterationLog — MonitoringError migration
// =========================================================================

describe('useIterationLog', () => {
  test('should capture error message when fetch returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useIterationLog());

    // Wait for the useEffect-triggered fetch to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to fetch iteration log');
  });

  test('should set log text on successful fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('log line 1\nlog line 2'),
    });

    const { result } = renderHook(() => useIterationLog());

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.log).toBe('log line 1\nlog line 2');
  });

  test('should throw MonitoringError on non-ok response (instanceof check)', async () => {
    const origFetch = global.fetch;

    // Intercept the MonitoringError by temporarily patching fetch
    global.fetch = jest.fn().mockImplementation(async () => {
      throw new MonitoringError('Failed to fetch iteration log');
    });

    const { result } = renderHook(() => useIterationLog());

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.error).toBe('Failed to fetch iteration log');
    expect(result.current.loading).toBe(false);

    global.fetch = origFetch;
  });
});
