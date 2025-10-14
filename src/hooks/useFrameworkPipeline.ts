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
  metrics: Record<string, any>;
  timestamp: string;
}

/**
 * Quality metrics from improvement engine
 */
interface QualityMetrics {
  overallScore: number;
  needsImprovement: boolean;
  recommendations: string[];
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
  getIterationSummary: () => any;
  getImprovementHistory: () => any[];
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
      console.log('✅ FrameworkIntegratedPipeline initialized');
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
      console.warn('Cannot change phase while pipeline is running');
      return;
    }

    if (pipelineRef.current) {
      pipelineRef.current.setPhase(phase);
      setExecutionState(prev => ({ ...prev, currentPhase: phase }));
      console.log(`📋 Phase changed to: ${phase}`);
    }
  }, [executionState.isRunning]);

  /**
   * Execute pipeline with real-time updates
   */
  const execute = useCallback(async (input: PipelineInput) => {
    if (!pipelineRef.current) {
      console.error('Pipeline not initialized');
      return;
    }

    if (executionState.isRunning) {
      console.warn('Pipeline already running');
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
      console.log('🚀 Starting Framework-Integrated Pipeline execution...');

      // Phase 1: Transcription (0-20%)
      setExecutionState(prev => ({ ...prev, progress: 5 }));
      console.log('📝 Phase 1: Transcription...');

      // Phase 2: Analysis (20-50%)
      setExecutionState(prev => ({ ...prev, progress: 25 }));
      console.log('🔍 Phase 2: Content Analysis...');

      // Phase 3: Visualization (50-80%)
      setExecutionState(prev => ({ ...prev, progress: 55 }));
      console.log('🎨 Phase 3: Diagram Generation...');

      // Execute main pipeline with framework
      const execution = await pipelineRef.current.execute(input);

      setExecutionState(prev => ({ ...prev, progress: 85 }));

      // Extract iteration metrics
      const iterationData: IterationData = {
        iterationNumber: iterationHistory.length + 1,
        phase: executionState.currentPhase,
        status: execution.result.success ? 'success' : 'failure',
        duration: execution.result.processingTime,
        metrics: execution.iterationMetrics,
        timestamp: new Date().toISOString()
      };

      setIterationHistory(prev => [...prev, iterationData]);

      // Update quality metrics
      const qualityData: QualityMetrics = {
        overallScore: execution.qualityAnalysis.overallScore || 0,
        needsImprovement: execution.qualityAnalysis.needsImprovement,
        recommendations: execution.qualityAnalysis.recommendations || [],
        breakdown: {
          performance: execution.qualityAnalysis.performanceScore || 0,
          accuracy: execution.qualityAnalysis.accuracyScore || 0,
          stability: execution.qualityAnalysis.stabilityScore || 0
        }
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
          console.log('📝 Auto-commit enabled, triggering commit...');
          console.log(execution.commitMessage);
          // TODO: Implement actual git commit via API
        }
      }

      setExecutionState(prev => ({ ...prev, progress: 100, isRunning: false }));
      console.log('✅ Pipeline execution completed successfully');

    } catch (error: any) {
      console.error('❌ Pipeline execution failed:', error);
      setExecutionState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message || 'Unknown error',
        progress: 0
      }));

      // Add failed iteration to history
      const failedIteration: IterationData = {
        iterationNumber: iterationHistory.length + 1,
        phase: executionState.currentPhase,
        status: 'failure',
        duration: Date.now() - startTimeRef.current,
        metrics: { error: error.message },
        timestamp: new Date().toISOString()
      };

      setIterationHistory(prev => [...prev, failedIteration]);
    }
  }, [executionState.isRunning, executionState.currentPhase, iterationHistory.length, enableAutoCommit]);

  /**
   * Stop execution
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('⏸️  Pipeline execution stopped by user');
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
  const getIterationSummary = useCallback((): any => {
    if (!pipelineRef.current) return null;
    return pipelineRef.current.getIterationSummary();
  }, []);

  /**
   * Get improvement history
   */
  const getImprovementHistory = useCallback((): any[] => {
    if (!pipelineRef.current) return [];
    return pipelineRef.current.getImprovementHistory();
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

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement API endpoint to read ITERATION_LOG.md
      // For now, return placeholder
      const response = await fetch('/api/iteration-log');
      if (!response.ok) throw new Error('Failed to fetch iteration log');

      const text = await response.text();
      setLog(text);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch iteration log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  return { log, loading, error, refetch: fetchLog };
}
