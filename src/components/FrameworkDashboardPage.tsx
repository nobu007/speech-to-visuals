/**
 * Phase 41: Framework Dashboard Page (Connected)
 *
 * Integrates FrameworkDashboard component with useFrameworkPipeline hook
 * Provides full real-time functionality for framework monitoring
 */

import React from 'react';
import { FrameworkDashboard } from './FrameworkDashboard';
import { useFrameworkPipeline } from '@/hooks/useFrameworkPipeline';
import { PipelineInput } from '@/pipeline/types';

export const FrameworkDashboardPage: React.FC = () => {
  const {
    execute,
    stop,
    setPhase,
    executionState,
    iterationHistory,
    qualityMetrics,
    result
  } = useFrameworkPipeline({
    enableAutoCommit: false, // User must manually commit
    maxImprovementCycles: 5,
    targetQualityScore: 95
  });

  /**
   * Handle execution from dashboard
   */
  const handleExecute = async (phase: string) => {
    // Set phase first
    setPhase(phase as any);

    // Create dummy input for demo (replace with real audio file upload)
    const dummyInput: PipelineInput = {
      audioPath: '/public/audio/sample.wav',
      outputPath: '/public/output/',
      options: {
        quality: 'high',
        enableCache: true,
        parallelScenes: true
      }
    };

    await execute(dummyInput);
  };

  /**
   * Handle stop from dashboard
   */
  const handleStop = () => {
    stop();
  };

  // Convert data to dashboard format
  const dashboardData = {
    executionStatus: {
      isRunning: executionState.isRunning,
      currentPhase: executionState.currentPhase,
      progress: executionState.progress,
      timeElapsed: executionState.timeElapsed,
      estimatedRemaining: executionState.estimatedRemaining,
      shouldCommit: executionState.shouldCommit,
      commitMessage: executionState.commitMessage
    },
    iterationHistory: iterationHistory.map(iter => ({
      iterationNumber: iter.iterationNumber,
      phase: iter.phase,
      status: iter.status,
      duration: iter.duration,
      metrics: iter.metrics,
      timestamp: iter.timestamp
    })),
    qualityAnalysis: {
      overallScore: qualityMetrics.overallScore,
      needsImprovement: qualityMetrics.needsImprovement,
      recommendations: qualityMetrics.recommendations,
      breakdown: qualityMetrics.breakdown
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <FrameworkDashboard
        onExecute={handleExecute}
        onStop={handleStop}
        autoRefresh={executionState.isRunning}
        refreshInterval={1000}
      />

      {/* Debug Panel (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 max-w-xs p-4 bg-black/80 text-white text-xs rounded-lg">
          <div className="font-bold mb-2">Debug Info</div>
          <div>Phase: {executionState.currentPhase}</div>
          <div>Running: {executionState.isRunning ? 'Yes' : 'No'}</div>
          <div>Progress: {executionState.progress.toFixed(0)}%</div>
          <div>Iterations: {iterationHistory.length}</div>
          <div>Quality Score: {qualityMetrics.overallScore.toFixed(0)}/100</div>
          {executionState.error && (
            <div className="mt-2 text-red-400">Error: {executionState.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default FrameworkDashboardPage;
