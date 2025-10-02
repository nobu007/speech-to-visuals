import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface QualityMetrics {
  timestamp: Date;
  iteration: number;
  overallScore: number;
  performanceScore: number;
  accuracyScore: number;
  reliabilityScore: number;
  recommendations: string[];
  concerns: string[];
  improvements: string[];
}

interface DashboardProps {
  realtime?: boolean;
  refreshInterval?: number;
}

export function QualityDashboard({ realtime = true, refreshInterval = 5000 }: DashboardProps) {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [history, setHistory] = useState<QualityMetrics[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Simulate real-time quality metrics updates
  useEffect(() => {
    if (!realtime) return;

    const interval = setInterval(() => {
      // Simulate quality monitoring data
      const newMetrics: QualityMetrics = {
        timestamp: new Date(),
        iteration: (metrics?.iteration || 0) + 1,
        overallScore: 0.85 + Math.random() * 0.1,
        performanceScore: 0.82 + Math.random() * 0.15,
        accuracyScore: 0.88 + Math.random() * 0.1,
        reliabilityScore: 0.92 + Math.random() * 0.06,
        recommendations: [
          'System performing within optimal parameters',
          'Cache hit rate improving with recent optimizations'
        ],
        concerns: Math.random() > 0.8 ? ['Memory usage spike detected'] : [],
        improvements: ['Processing speed improved by 12%', 'Accuracy enhanced with better preprocessing']
      };

      setMetrics(newMetrics);
      setHistory(prev => [...prev.slice(-19), newMetrics]);
      setLastUpdate(new Date());
      setIsConnected(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [realtime, refreshInterval, metrics?.iteration]);

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-yellow-600';
    if (score >= 0.7) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 0.9) return 'default';
    if (score >= 0.8) return 'secondary';
    if (score >= 0.7) return 'outline';
    return 'destructive';
  };

  const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`;

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Activity className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground">Initializing quality monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of Audio-to-Diagram Pipeline
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Overview</span>
            <Badge variant="outline">Iteration {metrics.iteration}</Badge>
          </CardTitle>
          <CardDescription>
            Current pipeline quality and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Overall Score */}
            <div className="text-center space-y-2">
              <div className={`text-3xl font-bold ${getScoreColor(metrics.overallScore)}`}>
                {formatScore(metrics.overallScore)}
              </div>
              <div className="text-sm text-muted-foreground">Overall Quality</div>
              <Progress value={metrics.overallScore * 100} className="h-2" />
              <Badge variant={getScoreBadgeVariant(metrics.overallScore)}>
                {metrics.overallScore >= 0.9 ? 'Excellent' :
                 metrics.overallScore >= 0.8 ? 'Good' :
                 metrics.overallScore >= 0.7 ? 'Fair' : 'Needs Improvement'}
              </Badge>
            </div>

            {/* Performance Score */}
            <div className="text-center space-y-2">
              <div className={`text-3xl font-bold ${getScoreColor(metrics.performanceScore)}`}>
                {formatScore(metrics.performanceScore)}
              </div>
              <div className="text-sm text-muted-foreground">Performance</div>
              <Progress value={metrics.performanceScore * 100} className="h-2" />
              <div className="flex items-center justify-center space-x-1">
                {metrics.performanceScore > 0.85 ?
                  <TrendingUp className="h-4 w-4 text-green-500" /> :
                  <TrendingDown className="h-4 w-4 text-red-500" />
                }
                <span className="text-xs text-muted-foreground">
                  {metrics.performanceScore > 0.85 ? 'Optimized' : 'Needs Tuning'}
                </span>
              </div>
            </div>

            {/* Accuracy Score */}
            <div className="text-center space-y-2">
              <div className={`text-3xl font-bold ${getScoreColor(metrics.accuracyScore)}`}>
                {formatScore(metrics.accuracyScore)}
              </div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
              <Progress value={metrics.accuracyScore * 100} className="h-2" />
              <div className="flex items-center justify-center space-x-1">
                {metrics.accuracyScore > 0.85 ?
                  <CheckCircle className="h-4 w-4 text-green-500" /> :
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                }
                <span className="text-xs text-muted-foreground">
                  {metrics.accuracyScore > 0.85 ? 'High Precision' : 'Improving'}
                </span>
              </div>
            </div>

            {/* Reliability Score */}
            <div className="text-center space-y-2">
              <div className={`text-3xl font-bold ${getScoreColor(metrics.reliabilityScore)}`}>
                {formatScore(metrics.reliabilityScore)}
              </div>
              <div className="text-sm text-muted-foreground">Reliability</div>
              <Progress value={metrics.reliabilityScore * 100} className="h-2" />
              <div className="flex items-center justify-center space-x-1">
                {metrics.reliabilityScore > 0.9 ?
                  <CheckCircle className="h-4 w-4 text-green-500" /> :
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                }
                <span className="text-xs text-muted-foreground">
                  {metrics.reliabilityScore > 0.9 ? 'Stable' : 'Monitoring'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Improvements */}
        {metrics.improvements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>Recent Improvements</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {metrics.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    <span className="text-sm">{improvement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {metrics.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-600">
                <TrendingUp className="h-5 w-5" />
                <span>Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {metrics.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span className="text-sm">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Concerns */}
        {metrics.concerns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Concerns</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {metrics.concerns.map((concern, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                    <span className="text-sm">{concern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quality Trends Chart */}
      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Trends</CardTitle>
            <CardDescription>
              Performance trends over the last {history.length} iterations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Simple trend visualization */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Overall Trend</div>
                  <div className="flex items-center justify-center space-x-1">
                    {history[history.length - 1].overallScore > history[0].overallScore ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-semibold">
                      {((history[history.length - 1].overallScore - history[0].overallScore) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-2">Performance</div>
                  <div className="flex items-center justify-center space-x-1">
                    {history[history.length - 1].performanceScore > history[0].performanceScore ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-semibold">
                      {((history[history.length - 1].performanceScore - history[0].performanceScore) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-2">Accuracy</div>
                  <div className="flex items-center justify-center space-x-1">
                    {history[history.length - 1].accuracyScore > history[0].accuracyScore ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-semibold">
                      {((history[history.length - 1].accuracyScore - history[0].accuracyScore) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-2">Reliability</div>
                  <div className="flex items-center justify-center space-x-1">
                    {history[history.length - 1].reliabilityScore > history[0].reliabilityScore ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-semibold">
                      {((history[history.length - 1].reliabilityScore - history[0].reliabilityScore) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>System Health Indicators</CardTitle>
          <CardDescription>
            Key performance indicators and system status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">6.0x</div>
              <div className="text-sm text-muted-foreground">Processing Speed</div>
              <div className="text-xs text-muted-foreground mt-1">vs. Realtime</div>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">128MB</div>
              <div className="text-sm text-muted-foreground">Memory Usage</div>
              <div className="text-xs text-muted-foreground mt-1">Peak Usage</div>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">99.2%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
              <div className="text-xs text-muted-foreground mt-1">Last 24h</div>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">5</div>
              <div className="text-sm text-muted-foreground">Diagram Types</div>
              <div className="text-xs text-muted-foreground mt-1">Supported</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QualityDashboard;