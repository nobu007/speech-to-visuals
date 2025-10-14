/**
 * Performance Metrics Visualization Dashboard
 * Phase 15: UI/UX Improvements
 *
 * Features:
 * - Real-time performance metrics display
 * - Visual charts for processing stages
 * - Historical performance tracking
 * - Quality score indicators
 * - Parallel processing visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Zap,
  Clock,
  TrendingUp,
  Target,
  Layers,
  Cpu,
  BarChart3,
  PieChart,
  CheckCircle
} from 'lucide-react';

interface ProcessingStage {
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  quality?: number;
  startTime?: number;
  endTime?: number;
}

interface PerformanceMetrics {
  currentStage: string;
  qualityScore: number;
  processingSpeed: number;
  timeElapsed: number;
  estimatedRemaining: number;
  confidence: number;
  parallelScenes?: number;
  parallelBatches?: number;
  parallelSpeedup?: number;
}

interface PerformanceMetricsVisualizationProps {
  metrics: PerformanceMetrics;
  stages: ProcessingStage[];
  isProcessing: boolean;
  showHistoricalData?: boolean;
}

export const PerformanceMetricsVisualization: React.FC<PerformanceMetricsVisualizationProps> = ({
  metrics,
  stages,
  isProcessing,
  showHistoricalData = true
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate stage statistics
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const totalStages = stages.length;
  const completionPercentage = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;

  // Calculate average stage duration
  const avgStageDuration = stages
    .filter(s => s.duration !== undefined)
    .reduce((acc, s) => acc + (s.duration || 0), 0) / Math.max(1, completedStages);

  // Quality indicator color
  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Quality indicator badge variant
  const getQualityBadge = (score: number) => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    if (score >= 50) return 'outline';
    return 'destructive';
  };

  // Stage status icon
  const StageStatusIcon = ({ status }: { status: ProcessingStage['status'] }) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'active':
        return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'error':
        return <Target className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Real-time Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Quality Score */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <Badge variant={getQualityBadge(metrics.qualityScore)}>
                {metrics.qualityScore >= 90 ? 'Excellent' : metrics.qualityScore >= 70 ? 'Good' : 'Fair'}
              </Badge>
            </div>
            <div className={`text-2xl font-bold ${getQualityColor(metrics.qualityScore)}`}>
              {metrics.qualityScore.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">品質スコア / 100</p>
            <Progress value={metrics.qualityScore} className="h-1 mt-2" />
          </CardContent>
        </Card>

        {/* Processing Time */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              {isProcessing && (
                <Badge variant="outline" className="animate-pulse">
                  進行中
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {(metrics.timeElapsed / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-muted-foreground">
              {isProcessing
                ? `残り: ~${(metrics.estimatedRemaining / 1000).toFixed(0)}s`
                : '処理時間'}
            </p>
            {isProcessing && (
              <Progress
                value={(metrics.timeElapsed / (metrics.timeElapsed + metrics.estimatedRemaining)) * 100}
                className="h-1 mt-2"
              />
            )}
          </CardContent>
        </Card>

        {/* Processing Speed */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <Badge variant="secondary">
                {metrics.processingSpeed > 1 ? '高速' : '標準'}
              </Badge>
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {metrics.processingSpeed.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">%/秒</p>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {metrics.processingSpeed > 1.5 ? '⚡ 高速処理中' : metrics.processingSpeed > 0.8 ? '📊 安定' : '⏳ 低速'}
            </div>
          </CardContent>
        </Card>

        {/* Confidence */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-orange-600" />
              <Badge variant={metrics.confidence > 0.8 ? 'default' : 'outline'}>
                {metrics.confidence > 0.9 ? '非常に高' : metrics.confidence > 0.7 ? '高' : '中'}
              </Badge>
            </div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {(metrics.confidence * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">信頼度</p>
            <Progress value={metrics.confidence * 100} className="h-1 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="stages">ステージ詳細</TabsTrigger>
          <TabsTrigger value="parallel">並列処理</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                処理概要
              </CardTitle>
              <CardDescription>現在の処理状況とパフォーマンス指標</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Stage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">現在のステージ</span>
                  <Badge>{metrics.currentStage || '待機中'}</Badge>
                </div>
                <Progress value={completionPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completedStages} / {totalStages} ステージ完了 ({completionPercentage.toFixed(0)}%)
                </p>
              </div>

              {/* Performance Indicators */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    平均ステージ時間
                  </div>
                  <div className="text-lg font-semibold">
                    {avgStageDuration > 0 ? `${(avgStageDuration / 1000).toFixed(2)}s` : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    完了率
                  </div>
                  <div className="text-lg font-semibold">{completionPercentage.toFixed(0)}%</div>
                </div>
              </div>

              {/* Quality Breakdown */}
              <div className="space-y-2 pt-4 border-t">
                <div className="text-sm font-medium mb-2">品質内訳</div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>速度スコア</span>
                      <span>{(metrics.processingSpeed * 20).toFixed(0)}/100</span>
                    </div>
                    <Progress value={Math.min(100, metrics.processingSpeed * 20)} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>精度スコア</span>
                      <span>{(metrics.confidence * 100).toFixed(0)}/100</span>
                    </div>
                    <Progress value={metrics.confidence * 100} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>安定性スコア</span>
                      <span>{completionPercentage.toFixed(0)}/100</span>
                    </div>
                    <Progress value={completionPercentage} className="h-1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Detail Tab */}
        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                処理ステージ詳細
              </CardTitle>
              <CardDescription>各ステージのステータスとパフォーマンス</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-all ${
                      stage.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : stage.status === 'active'
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 animate-pulse'
                        : stage.status === 'error'
                        ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        : 'bg-muted/30 border-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StageStatusIcon status={stage.status} />
                        <div>
                          <div className="font-medium text-sm">{stage.name}</div>
                          {stage.duration !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              処理時間: {(stage.duration / 1000).toFixed(2)}s
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            stage.status === 'completed'
                              ? 'default'
                              : stage.status === 'active'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {stage.status === 'completed'
                            ? '完了'
                            : stage.status === 'active'
                            ? '進行中'
                            : stage.status === 'error'
                            ? 'エラー'
                            : '待機中'}
                        </Badge>
                        {stage.quality !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            品質: {stage.quality.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parallel Processing Tab */}
        <TabsContent value="parallel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                並列処理メトリクス (Phase 14)
              </CardTitle>
              <CardDescription>並列処理によるパフォーマンス向上</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.parallelScenes !== undefined ? (
                <>
                  {/* Parallel Processing Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {metrics.parallelScenes}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">並列シーン数</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        {metrics.parallelBatches || 1}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">処理バッチ数</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {metrics.parallelSpeedup ? `${metrics.parallelSpeedup.toFixed(1)}x` : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">高速化率</div>
                    </div>
                  </div>

                  {/* Speedup Visualization */}
                  {metrics.parallelSpeedup && (
                    <div className="space-y-2 pt-4 border-t">
                      <div className="text-sm font-medium">並列処理効果</div>
                      <Progress
                        value={Math.min(100, (metrics.parallelSpeedup / 4) * 100)}
                        className="h-3"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>順次処理</span>
                        <span>{metrics.parallelSpeedup.toFixed(1)}倍高速化</span>
                        <span>理論最大 (4x)</span>
                      </div>
                    </div>
                  )}

                  {/* Performance Gain */}
                  <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="font-medium">パフォーマンス向上</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      並列処理により、シーン生成が{' '}
                      <span className="font-bold text-green-600">
                        {metrics.parallelSpeedup ? (((metrics.parallelSpeedup - 1) / metrics.parallelSpeedup) * 100).toFixed(0) : '0'}%
                      </span>{' '}
                      高速化されました
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">並列処理のメトリクスは処理開始後に表示されます</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceMetricsVisualization;
