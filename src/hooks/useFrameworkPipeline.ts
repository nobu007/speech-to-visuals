/**
 * Phase 41: useFrameworkPipeline Hook
 *
 * React hook for interacting with FrameworkIntegratedPipeline
 * Provides real-time updates, execution control, and metrics access
 *
 * Based on: Custom Instructions (音声→図解動画自動生成システム)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FrameworkIntegratedPipeline } from '@/pipeline/framework-integrated-pipeline';
import { PipelineInput, PipelineResult } from '@/pipeline/types';
import { DEVELOPMENT_CYCLES } from '@/framework/iteration-manager';
import { QualityRecommendation } from '@/framework/auto-improvement-engine';
import { MonitoringError } from '@/pipeline/pipeline-errors';
import { logger } from '@stv/core/utils/logger';

/**
 * Execution state
 */
interface ExecutionState {
  isRunning: boolean;
  currentPhase: keyof typeof DEVELOPMENT_CYCLES;
  progress: number;
  timeElapsed: number;
  estimatedRemaining: number;
  shouldCommit: boolean;
  commitMessage?: string;
  error?: string;
}

/**
 * Iteration data from framework
 */
interface IterationData {
  iterationNumber: number;
  phase: string;
  status: 'success' | 'failure';
  duration: number;
  metrics: Record<string, unknown>;
  timestamp: string;
}

/**
 * Quality metrics from improvement engine
 */
interface QualityMetrics {
  overallScore: number;
  needsImprovement: boolean;
  recommendations: QualityRecommendation[];
  breakdown: {
    performance: number;
    accuracy: number;
    stability: number;
  };
}

/**
 * Hook return type
 */
interface UseFrameworkPipelineReturn {
  // Execution control
  execute: (input: PipelineInput) => Promise<void>;
  stop: () => void;
  setPhase: (phase: keyof typeof DEVELOPMENT_CYCLES) => void;

  // State
  executionState: ExecutionState;
  iterationHistory: IterationData[];
  qualityMetrics: QualityMetrics;
  result: PipelineResult | null;

  // Metrics
  getReport: () => string;
  getIterationSummary: () => Record<string, unknown> | null;
  getImprovementHistory: () => Record<string, unknown>[];
}

/**
 * Hook configuration
 */
interface UseFrameworkPipelineConfig {
  autoStart?: boolean;
  enableAutoCommit?: boolean;
  maxImprovementCycles?: number;
  targetQualityScore?: number;
}

/**
 * Main hook
 */
export function useFrameworkPipeline(
  config: UseFrameworkPipelineConfig = {}
): UseFrameworkPipelineReturn {
  const {
    autoStart = false,
    enableAutoCommit = false,
    maxImprovementCycles = 5,
    targetQualityScore = 95
  } = config;

  // Pipeline instance (singleton pattern)
  const pipelineRef = useRef<FrameworkIntegratedPipeline | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // TASK-0220 sibling (REQ-300): async-setState-after-unmount guard.
  // `execute` awaits `pipelineRef.current.execute()` and, when shouldCommit +
  // enableAutoCommit hold, a second `await fetch('/api/git/commit')`. Both are
  // non-trivial (a full framework pipeline run; a network POST). If the
  // dashboard unmounts mid-run (tab switch / route change), a naive post-await
  // setState would fire on an unmounted hook — and worse, the post-await
  // commit branch would fire a stray `git commit` for an abandoned session.
  // `mountedRef` is the single "still alive" flag; flip it in the unmount
  // cleanup and gate every post-await side effect on it. Mirrors the reference
  // pattern in InteractiveResultViewer.tsx / AudioUploader.tsx (TC-316/317).
  const mountedRef = useRef(true);

  // State
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    currentPhase: 'MVP構築',
    progress: 0,
    timeElapsed: 0,
    estimatedRemaining: 0,
    shouldCommit: false
  });

  const [iterationHistory, setIterationHistory] = useState<IterationData[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({
    overallScore: 0,
    needsImprovement: false,
    recommendations: [],
    breakdown: { performance: 0, accuracy: 0, stability: 0 }
  });
  const [result, setResult] = useState<PipelineResult | null>(null);

  /**
   * Initialize pipeline instance
   */
  useEffect(() => {
    if (!pipelineRef.current) {
      pipelineRef.current = new FrameworkIntegratedPipeline();
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * mountedRef teardown — the async-setState-after-unmount guard.
   *
   * Distinct from the abort-controller cleanup above: aborting the controller
   * cancels in-flight work the pipeline OPTS to observe, but `execute`'s own
   * post-await resume is not abortable (an awaited promise resolves regardless).
   * This flag is what `execute` checks after each await to bail before any
   * setState or the stray commit fetch.
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Progress update loop
   */
  useEffect(() => {
    if (!executionState.isRunning) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setExecutionState(prev => ({
        ...prev,
        timeElapsed: elapsed,
        // Estimate remaining time based on progress
        estimatedRemaining: prev.progress > 0
          ? (elapsed / prev.progress) * (100 - prev.progress)
          : 30000
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [executionState.isRunning]);

  /**
   * Set current development phase
   */
  const setPhase = useCallback((phase: keyof typeof DEVELOPMENT_CYCLES) => {
    if (executionState.isRunning) {
      logger.warn('[useFrameworkPipeline] Cannot change phase while pipeline is running');
      return;
    }

    if (pipelineRef.current) {
      pipelineRef.current.setPhase(phase);
      setExecutionState(prev => ({ ...prev, currentPhase: phase }));
    }
  }, [executionState.isRunning]);

  /**
   * Execute pipeline with real-time updates
   */
  const execute = useCallback(async (input: PipelineInput) => {
    if (!pipelineRef.current) {
      logger.error('[useFrameworkPipeline] Pipeline not initialized');
      return;
    }

    if (executionState.isRunning) {
      logger.warn('[useFrameworkPipeline] Pipeline already running');
      return;
    }

    // Setup abort controller for cancellation
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();

    setExecutionState(prev => ({
      ...prev,
      isRunning: true,
      progress: 0,
      timeElapsed: 0,
      estimatedRemaining: 30000,
      error: undefined
    }));

    try {

      // Phase 1: Transcription (0-20%)
      setExecutionState(prev => ({ ...prev, progress: 5 }));

      // Phase 2: Analysis (20-50%)
      setExecutionState(prev => ({ ...prev, progress: 25 }));

      // Phase 3: Visualization (50-80%)
      setExecutionState(prev => ({ ...prev, progress: 55 }));

      // Execute main pipeline with framework
      const execution = await pipelineRef.current.execute(input);

      // Unmounted while the framework run was in flight: skip ALL post-await
      // work — no setState on an unmounted hook and, critically, no stray
      // /api/git/commit POST for an abandoned session (the load-bearing side
      // effect this guard exists to close; witnessed by TC-318-03).
      if (!mountedRef.current) return;

      setExecutionState(prev => ({ ...prev, progress: 85 }));

      // Extract iteration metrics
      const iterationData: IterationData = {
        iterationNumber: iterationHistory.length + 1,
        phase: executionState.currentPhase,
        status: execution.result.success ? 'success' : 'failure',
        duration: execution.result.processingTime,
        metrics: execution.iterationMetrics as Record<string, unknown>,
        timestamp: new Date().toISOString()
      };

      setIterationHistory(prev => [...prev, iterationData]);

      // Update quality metrics. `qualityAnalysis` is typed by
      // FrameworkIntegratedPipeline.execute()'s return contract (A124): it
      // carries the serializable QualityRecommendation[] projection, so no cast
      // is needed and recommendations render as {name, description} (not the old
      // lying `as string[]` that yielded "[object Object]").
      const qa = execution.qualityAnalysis;
      const qualityData: QualityMetrics = {
        overallScore: qa.overallScore,
        needsImprovement: qa.needsImprovement,
        recommendations: qa.recommendations,
        // DEFERRED (A124): the engine has NO per-category score derivation —
        // calculateQualityScore produces only the flat weighted overallScore, so
        // performance/accuracy/stability have no producer. Surfacing a real
        // breakdown is a product/scoring decision, not a wiring fix. The previous
        // code read qa.performanceScore/accuracyScore/stabilityScore, which the
        // producer never emits (always undefined → 0); kept at 0 explicitly.
        breakdown: { performance: 0, accuracy: 0, stability: 0 }
      };

      setQualityMetrics(qualityData);

      // Update result
      setResult(execution.result);

      // Check if should commit
      if (execution.shouldCommit) {
        setExecutionState(prev => ({
          ...prev,
          shouldCommit: true,
          commitMessage: execution.commitMessage
        }));

        if (enableAutoCommit && execution.commitMessage) {
          try {
            const response = await fetch('/api/git/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: execution.commitMessage }),
            });
            // A second await boundary: the dashboard may have unmounted while
            // the commit POST was in flight. Bail before the trailing setState.
            if (!mountedRef.current) return;
            if (!response.ok) {
              logger.error('[useFrameworkPipeline] Auto-commit failed:', response.status, response.statusText);
            }
          } catch (commitError) {
            logger.error('[useFrameworkPipeline] Auto-commit error:', commitError);
          }
        }
      }

      if (mountedRef.current) {
        setExecutionState(prev => ({ ...prev, progress: 100, isRunning: false }));
      }

    } catch (error: unknown) {
      logger.error('[useFrameworkPipeline] Pipeline execution failed:', error);
      if (mountedRef.current) {
        setExecutionState(prev => ({
          ...prev,
          isRunning: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          progress: 0
        }));
      }

      // Add failed iteration to history
      const failedIteration: IterationData = {
        iterationNumber: iterationHistory.length + 1,
        phase: executionState.currentPhase,
        status: 'failure',
        duration: Date.now() - startTimeRef.current,
        metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString()
      };

      if (mountedRef.current) {
        setIterationHistory(prev => [...prev, failedIteration]);
      }
    }
  }, [executionState.isRunning, executionState.currentPhase, iterationHistory.length, enableAutoCommit]);

  /**
   * Stop execution
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setExecutionState(prev => ({ ...prev, isRunning: false, progress: 0 }));
  }, []);

  /**
   * Get comprehensive report
   */
  const getReport = useCallback((): string => {
    if (!pipelineRef.current) return '';
    return pipelineRef.current.generateReport();
  }, []);

  /**
   * Get iteration summary
   */
  const getIterationSummary = useCallback((): Record<string, unknown> | null => {
    if (!pipelineRef.current) return null;
    return pipelineRef.current.getIterationSummary() as Record<string, unknown> | null;
  }, []);

  /**
   * Get improvement history
   */
  const getImprovementHistory = useCallback((): Record<string, unknown>[] => {
    if (!pipelineRef.current) return [];
    return pipelineRef.current.getImprovementHistory() as Record<string, unknown>[];
  }, []);

  return {
    // Control functions
    execute,
    stop,
    setPhase,

    // State
    executionState,
    iterationHistory,
    qualityMetrics,
    result,

    // Metrics
    getReport,
    getIterationSummary,
    getImprovementHistory
  };
}

/**
 * Helper hook for ITERATION_LOG reading (file system access)
 */
export function useIterationLog() {
  const [log, setLog] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TASK-0220 sibling (REQ-300): async-setState-after-unmount guard. This hook
  // AUTO-FIRES fetchLog on mount (the useEffect below), so an unmount during
  // the initial /api/iteration-log fetch — e.g. landing on the dashboard then
  // immediately switching tabs — is a common vector. Without the guard, the
  // post-await setLog/setError/setLoading fire on an unmounted hook.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Frontend implementation complete; backend /api/iteration-log endpoint
      // is managed separately.
      const response = await fetch('/api/iteration-log');
      // Unmounted while the fetch was in flight: bail before any post-await
      // setState (setLog/setError/setLoading).
      if (!mountedRef.current) return;
      if (!response.ok) throw new MonitoringError('Failed to fetch iteration log');

      const text = await response.text();
      if (!mountedRef.current) return;
      setLog(text);
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
      logger.error('[useIterationLog] Failed to fetch iteration log:', err);
    } finally {
      // `finally` runs even on the early-return path; guard the trailing
      // setLoading so it never fires on an unmounted hook.
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  return { log, loading, error, refetch: fetchLog };
}
