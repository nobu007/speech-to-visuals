/**
 * Quality Monitoring Dashboard Component
 * 🔄 Custom Instructions Phase 1: MVP基盤強化
 *
 * Real-time quality monitoring and performance visualization
 * Following iterative improvement approach: 実装→テスト→評価→改善→コミット
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  MemoryStick,
  TrendingUp,
  Zap,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react';

interface QualityMetrics {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  layoutOverlap: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: Date;
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface PerformanceSnapshot {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  queueLength: number;
  responseTime: number;
}

interface QualityTrend {
  metric: string;
  values: { timestamp: Date; value: number }[];
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

interface QualityMonitoringDashboardProps {
  isEnabled?: boolean;
  refreshInterval?: number;
  onExportReport?: () => void;
  onConfigureAlerts?: () => void;
}

/**
 * Quality Monitoring Dashboard
 * Provides real-time insights into system performance and quality
 */
export const QualityMonitoringDashboard: React.FC<QualityMonitoringDashboardProps> = ({
  isEnabled = true,
  refreshInterval = 5000,
  onExportReport,
  onConfigureAlerts
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<QualityMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceSnapshot[]>([]);
  const [qualityTrends, setQualityTrends] = useState<QualityTrend[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(isEnabled);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'critical'>('healthy');

  const intervalRef = useRef<NodeJS.Timeout>();

  // Quality thresholds per custom instructions
  const qualityThresholds = {
    transcriptionAccuracy: 0.85,
    sceneSegmentationF1: 0.75,
    layoutOverlap: 0,
    renderTime: 30000, // 30 seconds
    memoryUsage: 512 * 1024 * 1024, // 512MB
  };

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => stopMonitoring();
  }, [isMonitoring, refreshInterval]);

  const startMonitoring = () => {
    console.log('🔄 Starting quality monitoring dashboard');

    intervalRef.current = setInterval(async () => {
      await updateMetrics();
    }, refreshInterval);

    // Initial load
    updateMetrics();
  };

  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  };

  const updateMetrics = async () => {
    try {
      // In real implementation, this would fetch from monitoring APIs
      const newMetrics = await fetchCurrentQualityMetrics();
      const newPerformance = await fetchPerformanceSnapshot();

      setCurrentMetrics(newMetrics);
      setPerformanceData(prev => {
        const updated = [...prev, newPerformance];
        // Keep only last 100 data points
        return updated.slice(-100);
      });

      updateQualityTrends(newMetrics);
      updateSystemStatus(newMetrics, newPerformance);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('❌ Failed to update quality metrics:', error);
    }
  };

  const updateQualityTrends = (metrics: QualityMetrics) => {
    const timestamp = new Date();

    setQualityTrends(prev => {
      const updated = [...prev];

      // Update or create trends for each metric
      const metricsToTrack = [
        { key: 'transcriptionAccuracy', value: metrics.transcriptionAccuracy, threshold: qualityThresholds.transcriptionAccuracy },
        { key: 'sceneSegmentationF1', value: metrics.sceneSegmentationF1, threshold: qualityThresholds.sceneSegmentationF1 },
        { key: 'renderTime', value: metrics.renderTime, threshold: qualityThresholds.renderTime },
        { key: 'memoryUsage', value: metrics.memoryUsage, threshold: qualityThresholds.memoryUsage }
      ];

      metricsToTrack.forEach(({ key, value, threshold }) => {
        const existingIndex = updated.findIndex(trend => trend.metric === key);

        if (existingIndex >= 0) {
          updated[existingIndex].values.push({ timestamp, value });
          // Keep only last 50 data points
          updated[existingIndex].values = updated[existingIndex].values.slice(-50);

          // Update status based on threshold
          if (key === 'layoutOverlap') {
            updated[existingIndex].status = value > threshold ? 'critical' : 'good';
          } else if (key === 'renderTime' || key === 'memoryUsage') {
            updated[existingIndex].status = value > threshold ? 'warning' : 'good';
          } else {
            updated[existingIndex].status = value < threshold ? 'warning' : 'good';
          }
        } else {
          updated.push({
            metric: key,
            values: [{ timestamp, value }],
            threshold,
            status: 'good'
          });
        }
      });

      return updated;
    });
  };

  const updateSystemStatus = (metrics: QualityMetrics, performance: PerformanceSnapshot) => {
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check critical conditions
    if (metrics.layoutOverlap > 0 ||
        metrics.transcriptionAccuracy < 0.6 ||
        performance.memoryUsage > qualityThresholds.memoryUsage * 1.5) {
      status = 'critical';
    }
    // Check warning conditions
    else if (metrics.transcriptionAccuracy < qualityThresholds.transcriptionAccuracy ||
             metrics.sceneSegmentationF1 < qualityThresholds.sceneSegmentationF1 ||
             metrics.renderTime > qualityThresholds.renderTime ||
             performance.memoryUsage > qualityThresholds.memoryUsage) {
      status = 'degraded';
    }

    setSystemStatus(status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'good': return 'text-green-600 bg-green-50';
      case 'degraded': case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <Activity className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatMemoryUsage = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Mock data fetching functions (in real implementation, these would call actual APIs)
  const fetchCurrentQualityMetrics = async (): Promise<QualityMetrics> => {
    // Simulate API call with realistic variance
    const baseAccuracy = 0.85 + (Math.random() - 0.5) * 0.1;
    const baseF1 = 0.75 + (Math.random() - 0.5) * 0.08;

    return {
      transcriptionAccuracy: Math.max(0.6, Math.min(1.0, baseAccuracy)),
      sceneSegmentationF1: Math.max(0.6, Math.min(1.0, baseF1)),
      layoutOverlap: Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0,
      renderTime: 15000 + Math.random() * 20000,
      memoryUsage: 300 * 1024 * 1024 + Math.random() * 200 * 1024 * 1024,
      timestamp: new Date(),
      success: Math.random() > 0.05, // 95% success rate
      errors: Math.random() < 0.1 ? ['Sample error for testing'] : [],
      warnings: Math.random() < 0.2 ? ['Sample warning for testing'] : []
    };
  };

  const fetchPerformanceSnapshot = async (): Promise<PerformanceSnapshot> => {
    return {
      timestamp: new Date(),
      cpuUsage: 20 + Math.random() * 60, // 20-80%
      memoryUsage: 300 * 1024 * 1024 + Math.random() * 200 * 1024 * 1024,
      activeConnections: Math.floor(Math.random() * 10) + 1,
      queueLength: Math.floor(Math.random() * 5),
      responseTime: 1000 + Math.random() * 2000
    };
  };

  if (!isMonitoring) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Quality monitoring is disabled</p>
            <Button onClick={() => setIsMonitoring(true)}>
              <Activity className="h-4 w-4 mr-2" />
              Start Monitoring
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quality Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            🔄 Real-time system performance and quality metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(systemStatus)}>
            {getStatusIcon(systemStatus)}
            <span className="ml-1 capitalize">{systemStatus}</span>
          </Badge>

          <Button variant="outline" size="sm" onClick={() => updateMetrics()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>

          {onExportReport && (
            <Button variant="outline" size="sm" onClick={onExportReport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}

          {onConfigureAlerts && (
            <Button variant="outline" size="sm" onClick={onConfigureAlerts}>
              <Settings className="h-4 w-4 mr-1" />
              Configure
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transcription Accuracy</p>
                <p className="text-2xl font-bold">
                  {currentMetrics ? `${(currentMetrics.transcriptionAccuracy * 100).toFixed(1)}%` : '--'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${currentMetrics?.transcriptionAccuracy >= qualityThresholds.transcriptionAccuracy ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <Activity className="h-4 w-4" />
              </div>
            </div>
            {currentMetrics && (
              <Progress
                value={currentMetrics.transcriptionAccuracy * 100}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scene Segmentation F1</p>
                <p className="text-2xl font-bold">
                  {currentMetrics ? `${(currentMetrics.sceneSegmentationF1 * 100).toFixed(1)}%` : '--'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${currentMetrics?.sceneSegmentationF1 >= qualityThresholds.sceneSegmentationF1 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            {currentMetrics && (
              <Progress
                value={currentMetrics.sceneSegmentationF1 * 100}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing Time</p>
                <p className="text-2xl font-bold">
                  {currentMetrics ? formatDuration(currentMetrics.renderTime) : '--'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${currentMetrics?.renderTime <= qualityThresholds.renderTime ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <Clock className="h-4 w-4" />
              </div>
            </div>
            {currentMetrics && (
              <Progress
                value={Math.min(100, (qualityThresholds.renderTime - currentMetrics.renderTime) / qualityThresholds.renderTime * 100)}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Memory Usage</p>
                <p className="text-2xl font-bold">
                  {currentMetrics ? formatMemoryUsage(currentMetrics.memoryUsage) : '--'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${currentMetrics?.memoryUsage <= qualityThresholds.memoryUsage ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <MemoryStick className="h-4 w-4" />
              </div>
            </div>
            {currentMetrics && (
              <Progress
                value={Math.min(100, (currentMetrics.memoryUsage / qualityThresholds.memoryUsage) * 100)}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="quality" className="w-full">
        <TabsList>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Quality Status</CardTitle>
              <CardDescription>
                Real-time quality metrics per custom instructions thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentMetrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Transcription Accuracy</span>
                        <Badge className={currentMetrics.transcriptionAccuracy >= qualityThresholds.transcriptionAccuracy ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {(currentMetrics.transcriptionAccuracy * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={currentMetrics.transcriptionAccuracy * 100} />
                      <p className="text-xs text-muted-foreground">
                        Threshold: {(qualityThresholds.transcriptionAccuracy * 100).toFixed(0)}%
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Scene Segmentation F1</span>
                        <Badge className={currentMetrics.sceneSegmentationF1 >= qualityThresholds.sceneSegmentationF1 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {(currentMetrics.sceneSegmentationF1 * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={currentMetrics.sceneSegmentationF1 * 100} />
                      <p className="text-xs text-muted-foreground">
                        Threshold: {(qualityThresholds.sceneSegmentationF1 * 100).toFixed(0)}%
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Layout Overlap</span>
                        <Badge className={currentMetrics.layoutOverlap === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {currentMetrics.layoutOverlap}
                        </Badge>
                      </div>
                      <Progress value={currentMetrics.layoutOverlap === 0 ? 100 : 0} />
                      <p className="text-xs text-muted-foreground">
                        Target: 0 overlaps (Zero Overlap Layout Engine)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Processing Time</span>
                        <Badge className={currentMetrics.renderTime <= qualityThresholds.renderTime ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {formatDuration(currentMetrics.renderTime)}
                        </Badge>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, (qualityThresholds.renderTime - currentMetrics.renderTime) / qualityThresholds.renderTime * 100))} />
                      <p className="text-xs text-muted-foreground">
                        Target: ≤ {formatDuration(qualityThresholds.renderTime)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Waiting for quality metrics...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>CPU Usage</span>
                        <span>{performanceData[performanceData.length - 1].cpuUsage.toFixed(1)}%</span>
                      </div>
                      <Progress value={performanceData[performanceData.length - 1].cpuUsage} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Memory Usage</span>
                        <span>{formatMemoryUsage(performanceData[performanceData.length - 1].memoryUsage)}</span>
                      </div>
                      <Progress value={(performanceData[performanceData.length - 1].memoryUsage / qualityThresholds.memoryUsage) * 100} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Connections</p>
                        <p className="text-xl font-semibold">{performanceData[performanceData.length - 1].activeConnections}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Queue Length</p>
                        <p className="text-xl font-semibold">{performanceData[performanceData.length - 1].queueLength}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-center">
                      <p className="text-3xl font-bold">
                        {formatDuration(performanceData[performanceData.length - 1].responseTime)}
                      </p>
                      <p className="text-sm text-muted-foreground">Average Response Time</p>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, (10000 - performanceData[performanceData.length - 1].responseTime) / 10000 * 100))} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Trends</CardTitle>
              <CardDescription>
                Historical performance trends to track iterative improvements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {qualityTrends.map((trend) => (
                  <div key={trend.metric} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="capitalize">{trend.metric.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                      <Badge className={getStatusColor(trend.status)}>
                        {getStatusIcon(trend.status)}
                        <span className="ml-1 capitalize">{trend.status}</span>
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {trend.values.length} data points • Last update: {lastUpdate.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alerts & Issues</CardTitle>
              <CardDescription>
                Current system issues and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {currentMetrics?.errors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-700">Error</p>
                        <p className="text-xs text-red-600">{error}</p>
                      </div>
                    </div>
                  ))}

                  {currentMetrics?.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-700">Warning</p>
                        <p className="text-xs text-yellow-600">{warning}</p>
                      </div>
                    </div>
                  ))}

                  {(!currentMetrics?.errors.length && !currentMetrics?.warnings.length) && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-700">No active alerts</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-3 rounded">
        <div className="flex items-center gap-4">
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <span>•</span>
          <span>Refresh interval: {refreshInterval / 1000}s</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Monitoring active
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMonitoring(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          Stop monitoring
        </Button>
      </div>
    </div>
  );
};

export default QualityMonitoringDashboard;