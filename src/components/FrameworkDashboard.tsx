/**
 * Phase 41: Real-Time Framework Dashboard
 *
 * Displays live progress from FrameworkIntegratedPipeline with:
 * - Real-time iteration tracking from ITERATION_LOG
 * - Live quality metrics from AutoImprovementEngine
 * - Phase-based success criteria evaluation
 * - Auto-commit trigger status
 * - Improvement recommendations visualization
 *
 * Based on: Custom Instructions (音声→図解動画自動生成システム)
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Zap,
  Target,
  GitCommit,
  Layers,
  BarChart3,
  RefreshCw,
  Play,
  Pause,
  FastForward
} from 'lucide-react';

/**
 * Phase information from DEVELOPMENT_CYCLES
 */
interface PhaseInfo {
  name: string;
  maxIterations: number;
  successCriteria: string[];
  currentIteration: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

/**
 * Iteration metrics from IterationManager
 */
interface IterationMetrics {
  iterationNumber: number;
  phase: string;
  status: 'success' | 'failure';
  duration: number;
  metrics: Record<string, any>;
  timestamp: string;
}

/**
 * Quality analysis from AutoImprovementEngine
 */
interface QualityAnalysis {
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
 * Execution status
 */
interface ExecutionStatus {
  isRunning: boolean;
  currentPhase: string;
  progress: number;
  timeElapsed: number;
  estimatedRemaining: number;
  shouldCommit: boolean;
  commitMessage?: string;
}

interface FrameworkDashboardProps {
  onExecute?: (phase: string) => Promise<void>;
  onStop?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const FrameworkDashboard: React.FC<FrameworkDashboardProps> = ({
  onExecute,
  onStop,
  autoRefresh = true,
  refreshInterval = 2000
}) => {
  // State management
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>({
    isRunning: false,
    currentPhase: 'MVP構築',
    progress: 0,
    timeElapsed: 0,
    estimatedRemaining: 0,
    shouldCommit: false
  });

  const [iterationHistory, setIterationHistory] = useState<IterationMetrics[]>([]);
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis>({
    overallScore: 0,
    needsImprovement: false,
    recommendations: [],
    breakdown: { performance: 0, accuracy: 0, stability: 0 }
  });

  const [phases] = useState<PhaseInfo[]>([
    {
      name: 'MVP構築',
      maxIterations: 3,
      successCriteria: ['音声入力→字幕付き動画出力が動作'],
      currentIteration: 0,
      status: 'pending'
    },
    {
      name: '内容分析',
      maxIterations: 5,
      successCriteria: ['シーン分割精度80%', '主要エンティティ抽出率90%', '関係性の正確性85%'],
      currentIteration: 0,
      status: 'pending'
    },
    {
      name: '図解生成',
      maxIterations: 4,
      successCriteria: ['レイアウト破綻0', 'ラベル可読性100%'],
      currentIteration: 0,
      status: 'pending'
    }
  ]);

  const [selectedPhase, setSelectedPhase] = useState('MVP構築');

  // Auto-refresh iteration data
  useEffect(() => {
    if (!autoRefresh || !executionStatus.isRunning) return;

    const interval = setInterval(() => {
      fetchIterationData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, executionStatus.isRunning, refreshInterval]);

  /**
   * Fetch latest iteration data (simulated for now, will connect to real API)
   */
  const fetchIterationData = () => {
    // TODO: Connect to real FrameworkIntegratedPipeline API
    // For now, simulate progress
    setExecutionStatus(prev => ({
      ...prev,
      progress: Math.min(100, prev.progress + 2),
      timeElapsed: prev.timeElapsed + refreshInterval,
      estimatedRemaining: Math.max(0, prev.estimatedRemaining - refreshInterval)
    }));
  };

  /**
   * Handle execution start
   */
  const handleExecute = async () => {
    setExecutionStatus(prev => ({
      ...prev,
      isRunning: true,
      progress: 0,
      timeElapsed: 0,
      estimatedRemaining: 30000
    }));

    if (onExecute) {
      try {
        await onExecute(selectedPhase);
      } catch (error) {
        console.error('Execution failed:', error);
        setExecutionStatus(prev => ({ ...prev, isRunning: false }));
      }
    }
  };

  /**
   * Handle execution stop
   */
  const handleStop = () => {
    setExecutionStatus(prev => ({ ...prev, isRunning: false }));
    if (onStop) onStop();
  };

  /**
   * Get phase badge color
   */
  const getPhaseBadgeColor = (status: PhaseInfo['status']) => {
    switch (status) {
      case 'completed': return 'default';
      case 'active': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  /**
   * Get quality color
   */
  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  /**
   * Execution Control Panel
   */
  const ExecutionControlPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          実行制御
        </CardTitle>
        <CardDescription>フレームワーク統合パイプラインの実行管理</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">フェーズ選択</label>
          <div className="grid grid-cols-3 gap-2">
            {phases.map((phase) => (
              <Button
                key={phase.name}
                variant={selectedPhase === phase.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPhase(phase.name)}
                disabled={executionStatus.isRunning}
                className="text-xs"
              >
                {phase.name}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Execution Controls */}
        <div className="flex gap-2">
          {!executionStatus.isRunning ? (
            <Button onClick={handleExecute} className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              実行開始
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive" className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              停止
            </Button>
          )}
          <Button variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Bar */}
        {executionStatus.isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>進捗状況</span>
              <span className="font-medium">{executionStatus.progress.toFixed(0)}%</span>
            </div>
            <Progress value={executionStatus.progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>経過: {(executionStatus.timeElapsed / 1000).toFixed(1)}s</span>
              <span>残り: ~{(executionStatus.estimatedRemaining / 1000).toFixed(0)}s</span>
            </div>
          </div>
        )}

        {/* Commit Status */}
        {executionStatus.shouldCommit && (
          <Alert>
            <GitCommit className="h-4 w-4" />
            <AlertTitle>コミット推奨</AlertTitle>
            <AlertDescription className="text-xs">
              {executionStatus.commitMessage || '成功基準を満たしました。コミットを推奨します。'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  /**
   * Phase Overview Panel
   */
  const PhaseOverviewPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          フェーズ概要
        </CardTitle>
        <CardDescription>開発サイクルの進捗状況</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {phases.map((phase, index) => {
            const phaseProgress = phase.currentIteration > 0
              ? (phase.currentIteration / phase.maxIterations) * 100
              : 0;

            return (
              <div key={phase.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{phase.name}</span>
                    <Badge variant={getPhaseBadgeColor(phase.status)} className="text-xs">
                      {phase.status === 'completed' ? '完了' :
                       phase.status === 'active' ? '実行中' :
                       phase.status === 'failed' ? '失敗' : '待機中'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {phase.currentIteration}/{phase.maxIterations}
                  </span>
                </div>
                <Progress value={phaseProgress} className="h-1.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">成功基準:</div>
                  {phase.successCriteria.map((criteria, i) => (
                    <div key={i} className="flex items-center gap-1 ml-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      <span>{criteria}</span>
                    </div>
                  ))}
                </div>
                {index < phases.length - 1 && <Separator className="mt-3" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  /**
   * Quality Metrics Panel
   */
  const QualityMetricsPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          品質メトリクス
        </CardTitle>
        <CardDescription>AutoImprovementEngineによる品質分析</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
          <div className={`text-5xl font-bold ${getQualityColor(qualityAnalysis.overallScore)}`}>
            {qualityAnalysis.overallScore.toFixed(0)}
          </div>
          <div className="text-sm text-muted-foreground mt-2">総合品質スコア / 100</div>
          <Progress value={qualityAnalysis.overallScore} className="h-2 mt-4" />
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <div className="text-sm font-medium">詳細内訳</div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-500" />
                パフォーマンス
              </span>
              <span className="font-medium">{qualityAnalysis.breakdown.performance}/100</span>
            </div>
            <Progress value={qualityAnalysis.breakdown.performance} className="h-1.5" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                精度
              </span>
              <span className="font-medium">{qualityAnalysis.breakdown.accuracy}/100</span>
            </div>
            <Progress value={qualityAnalysis.breakdown.accuracy} className="h-1.5" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                安定性
              </span>
              <span className="font-medium">{qualityAnalysis.breakdown.stability}/100</span>
            </div>
            <Progress value={qualityAnalysis.breakdown.stability} className="h-1.5" />
          </div>
        </div>

        {/* Improvement Status */}
        {qualityAnalysis.needsImprovement && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>改善推奨</AlertTitle>
            <AlertDescription className="text-xs">
              品質向上のための改善サイクルが推奨されます
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  /**
   * Iteration History Panel
   */
  const IterationHistoryPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          イテレーション履歴
        </CardTitle>
        <CardDescription>ITERATION_LOGからの実行履歴</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {iterationHistory.length > 0 ? (
            <div className="space-y-3">
              {iterationHistory.map((iteration, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    iteration.status === 'success'
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {iteration.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-medium text-sm">
                        Iteration {iteration.iterationNumber}
                      </span>
                    </div>
                    <Badge variant={iteration.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {iteration.phase}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Duration: {(iteration.duration / 1000).toFixed(2)}s</div>
                    <div>Time: {new Date(iteration.timestamp).toLocaleTimeString()}</div>
                    {iteration.metrics && Object.keys(iteration.metrics).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                        {Object.entries(iteration.metrics).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span>{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">まだイテレーションが実行されていません</p>
              <p className="text-xs mt-1">実行を開始すると履歴が表示されます</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  /**
   * Recommendations Panel
   */
  const RecommendationsPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          改善推奨事項
        </CardTitle>
        <CardDescription>品質向上のための推奨アクション</CardDescription>
      </CardHeader>
      <CardContent>
        {qualityAnalysis.recommendations.length > 0 ? (
          <div className="space-y-2">
            {qualityAnalysis.recommendations.map((rec, index) => (
              <Alert key={index}>
                <FastForward className="h-4 w-4" />
                <AlertDescription className="text-sm">{rec}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="text-sm">品質基準を満たしています</p>
            <p className="text-xs mt-1">改善推奨事項はありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Framework Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          リアルタイム進捗追跡 & 自律改善フレームワーク
        </p>
      </div>

      {/* Top Row: Control + Phase Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutionControlPanel />
        <PhaseOverviewPanel />
      </div>

      {/* Main Content: Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">品質メトリクス</TabsTrigger>
          <TabsTrigger value="history">イテレーション履歴</TabsTrigger>
          <TabsTrigger value="recommendations">改善推奨</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <QualityMetricsPanel />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <IterationHistoryPanel />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <RecommendationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FrameworkDashboard;
