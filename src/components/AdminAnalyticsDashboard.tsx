/**
 * Admin Analytics Dashboard
 *
 * Unified monitoring view aggregating health checks, production metrics,
 * performance trends, and system recommendations.
 *
 * Integrates with:
 *   - HealthCheckService (system health, nextDueAt, lastResult)
 *   - ProductionMonitor (component health, alerts, success rates)
 *   - RealTimePerformanceMonitor (pipeline metrics, trend analysis)
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { safeToLocaleString } from '@/utils/guards';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  HeartPulse,
  Lightbulb,
  Pause,
  Play,
  RefreshCw,
  Server,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTimestamp(ts: number | null): string {
  if (ts === null) return '—';
  return new Date(ts).toLocaleTimeString();
}

function statusBadge(status: string): React.ReactNode {
  const cls =
    status === 'healthy'
      ? 'bg-green-100 text-green-800'
      : status === 'degraded'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'unhealthy' || status === 'critical'
          ? 'bg-red-100 text-red-800'
          : 'bg-gray-100 text-gray-600';
  return <Badge className={cls}>{status.toUpperCase()}</Badge>;
}

function pct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

/**
 * Rounded confidence percentage shown in the Detected-Patterns badge.
 *
 * This is the SINGLE source of truth for both the displayed number and the
 * badge-color branch in {@link confidenceBadgeClass}. Both must read the same
 * rounded value: a raw confidence like 0.795 rounds to "80%" for display, so
 * the color must also be derived from 80 — otherwise the badge would render
 * "80%" in yellow (raw 0.795 < 0.8) while showing exactly 80%, the
 * rounded-display-vs-raw-threshold contradiction (same class as the
 * FrameworkDashboard overallScore / PerformanceMetricsVisualization
 * qualityScore reconciliations).
 */
export function confidencePercent(confidence: number): number {
  return Math.round(confidence * 100);
}

/**
 * Badge color for a learning-pattern confidence. Branches on the ROUNDED
 * percentage (via {@link confidencePercent}) so the color always matches the
 * number the user sees: a displayed 80% is green, 50% is yellow.
 */
export function confidenceBadgeClass(confidence: number): string {
  const displayed = confidencePercent(confidence);
  if (displayed >= 80) return 'bg-green-100 text-green-800';
  if (displayed >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

// ── sub-components ───────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
}> = ({ title, value, subtitle, icon: Icon }) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardDescription>{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </CardContent>
  </Card>
);

const ComponentHealthTable: React.FC<{
  components: Record<string, { name: string; status: string; metrics: { successRate: number; averageLatency: number; errorRate: number }; lastError?: string }>;
}> = ({ components }) => (
  <div className="space-y-2">
    {Object.values(components).map((comp) => (
      <div
        key={comp.name}
        className="flex items-center justify-between rounded-md border p-3"
      >
        <div className="flex items-center gap-3">
          {comp.status === 'healthy' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : comp.status === 'degraded' ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="font-medium">{comp.name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Success: {pct(comp.metrics.successRate)}</span>
          <span>Latency: {(comp.metrics.averageLatency / 1000).toFixed(2)}s</span>
          <span>Errors: {pct(comp.metrics.errorRate)}</span>
          {statusBadge(comp.status)}
        </div>
      </div>
    ))}
  </div>
);

const AlertList: React.FC<{
  alerts: Array<{ severity: string; component: string; message: string; actionRequired: string }>;
}> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-green-500" />
        No active alerts
      </div>
    );
  }
  return (
    <ScrollArea className="max-h-64">
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`rounded-md border p-3 ${
              alert.severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {alert.severity === 'critical' ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="font-medium">{alert.message}</span>
              {statusBadge(alert.severity === 'critical' ? 'critical' : 'degraded')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Component: {alert.component} — {alert.actionRequired}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const TrendList: React.FC<{
  trends: Array<{ metric: string; trend: string; changePercent: number }>;
}> = ({ trends }) => (
  <div className="space-y-2">
    {trends.length === 0 ? (
      <p className="text-sm text-muted-foreground">No trend data available</p>
    ) : (
      trends.map((t) => (
        <div key={t.metric} className="flex items-center justify-between rounded-md border p-2">
          <span className="text-sm font-medium">{t.metric}</span>
          <div className="flex items-center gap-2">
            {t.trend === 'improving' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : t.trend === 'degrading' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <Activity className="h-4 w-4 text-gray-400" />
            )}
            <span
              className={`text-sm ${
                t.trend === 'improving'
                  ? 'text-green-600'
                  : t.trend === 'degrading'
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {t.changePercent > 0 ? '+' : ''}
              {t.changePercent.toFixed(1)}%
            </span>
          </div>
        </div>
      ))
    )}
  </div>
);

// ── main component ───────────────────────────────────────

export const AdminAnalyticsDashboard: React.FC = () => {
  const { snapshot, isPolling, refresh, start, stop } = useAdminAnalytics({
    intervalMs: 10_000,
    autoStart: true,
  });

  const { healthCheck, productionHealth, productionMetrics, performanceSnapshot, trends, learningStatus, learningReport, detectedPatterns, systemInsights, reportHistory } = snapshot;

  const overallStatus = healthCheck?.status ?? productionHealth?.status ?? 'unknown';

  const totalRequests = productionMetrics?.totalRequests ?? 0;
  const successRate =
    productionMetrics && totalRequests > 0
      ? productionMetrics.successfulRequests / totalRequests
      : 0;
  const avgProcessingTime = productionMetrics?.averageProcessingTime ?? 0;

  const alerts = productionHealth?.alerts ?? [];

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          <h2 className="text-xl font-bold">Admin Analytics</h2>
          {statusBadge(overallStatus)}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          {isPolling ? (
            <Button size="sm" variant="outline" onClick={stop}>
              <Pause className="mr-1 h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={start}>
              <Play className="mr-1 h-4 w-4" /> Start
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Uptime"
          value={formatDuration(snapshot.uptime)}
          subtitle={`Last check: ${formatTimestamp(snapshot.lastCheckedAt)}`}
          icon={Clock}
        />
        <StatCard
          title="Next Health Check"
          value={formatTimestamp(snapshot.nextDueAt)}
          subtitle={snapshot.nextDueAt !== null ? 'Auto-scheduled' : 'Pending'}
          icon={HeartPulse}
        />
        <StatCard
          title="Total Requests"
          value={safeToLocaleString(totalRequests)}
          subtitle={`Success: ${pct(successRate)}`}
          icon={Activity}
        />
        <StatCard
          title="Avg Processing"
          value={avgProcessingTime > 0 ? `${(avgProcessingTime / 1000).toFixed(2)}s` : '—'}
          subtitle={
            performanceSnapshot
              ? `P95: ${(performanceSnapshot.pipeline.p95ProcessingTime / 1000).toFixed(2)}s`
              : undefined
          }
          icon={Zap}
        />
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.length > 0 && (
              <Badge className="ml-1 bg-red-500 text-white">{alerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="learning">
            Learning
            {learningReport.detectedPatterns > 0 && (
              <Badge className="ml-1 bg-blue-500 text-white">{learningReport.detectedPatterns}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Health tab */}
        <TabsContent value="health" className="space-y-4">
          {productionHealth && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Component Health</CardTitle>
                <CardDescription>
                  Real-time status of pipeline components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComponentHealthTable components={productionHealth.components} />
              </CardContent>
            </Card>
          )}

          {healthCheck && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Health Checks</CardTitle>
                <CardDescription>
                  Infrastructure health from HealthCheckService
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(healthCheck.checks).map(([name, check]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {check.status === 'healthy' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : check.status === 'degraded' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <span className="font-medium">{name}</span>
                          <p className="text-xs text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {check.latency !== undefined && (
                          <span className="text-xs text-muted-foreground">{check.latency}ms</span>
                        )}
                        {statusBadge(check.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!productionHealth && !healthCheck && (
            <div className="p-8 text-center text-muted-foreground">
              No health data available. Click "Start" to begin monitoring.
            </div>
          )}
        </TabsContent>

        {/* Alerts tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Alerts</CardTitle>
              <CardDescription>
                Threshold violations and degraded components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertList alerts={alerts} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends tab */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Trends</CardTitle>
              <CardDescription>
                Metric direction and change percentage over recent history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendList trends={trends} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning tab */}
        <TabsContent value="learning" className="space-y-4">
          {/* Learning status cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Learning Process"
              value={learningStatus.isRunning ? 'Active' : 'Stopped'}
              subtitle={`Iteration: ${learningStatus.iteration}`}
              icon={Brain}
            />
            <StatCard
              title="Next Analysis"
              value={formatTimestamp(learningStatus.nextAnalysisAt)}
              subtitle={learningStatus.isRunning ? 'Auto-scheduled' : 'Not running'}
              icon={Clock}
            />
            <StatCard
              title="Data Points"
              value={safeToLocaleString(learningReport.totalDataPoints)}
              subtitle={`Patterns: ${learningReport.detectedPatterns}`}
              icon={Target}
            />
            <StatCard
              title="Last Analysis"
              value={
                learningStatus.lastAnalysisAt !== null
                  ? formatTimestamp(learningStatus.lastAnalysisAt)
                  : '—'
              }
              subtitle={
                learningStatus.lastAnalysisAt !== null
                  ? learningStatus.lastAnalysisSuccess
                    ? 'Completed successfully'
                    : 'Completed with errors'
                  : 'No analysis yet'
              }
              icon={Activity}
            />
          </div>

          {/* Detected patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detected Patterns</CardTitle>
              <CardDescription>
                Learning patterns identified from processing history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detectedPatterns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No patterns detected yet</p>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {detectedPatterns.map((p, i) => (
                      <div key={i} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.pattern}</span>
                          <Badge className={confidenceBadgeClass(p.confidence)}>
                            {confidencePercent(p.confidence)}%
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.improvementSuggestion}
                        </p>
                        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Gain: {(p.expectedGain * 100).toFixed(0)}%</span>
                          <span>Validations: {p.validationCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* System insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Insights</CardTitle>
              <CardDescription>
                AI-driven insights from continuous learning analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemInsights.length === 0 ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  No insights generated yet. Insights appear after sufficient data collection.
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {systemInsights.map((insight, i) => (
                      <div key={i} className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          {insight.type === 'performance' ? (
                            <Zap className="h-4 w-4 text-orange-500" />
                          ) : insight.type === 'quality' ? (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          ) : insight.type === 'reliability' ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-purple-500" />
                          )}
                          <span className="font-medium">{insight.description}</span>
                          {insight.actionable && (
                            <Badge className="bg-blue-100 text-blue-800">Actionable</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {insight.recommendation}
                        </p>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Confidence: {(insight.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Recent optimizations */}
          {learningReport.recentOptimizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Optimizations</CardTitle>
                <CardDescription>
                  Applied optimization strategies from learning cycles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {learningReport.recentOptimizations.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{opt}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report History</CardTitle>
              <CardDescription>
                Learning metrics snapshots from past analysis cycles (max 20)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No history yet. Entries appear after each scheduled analysis cycle.
                </p>
              ) : (
                <ScrollArea className="max-h-64">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-1 pr-2">Time</th>
                        <th className="pb-1 pr-2">Iter</th>
                        <th className="pb-1 pr-2">Data</th>
                        <th className="pb-1 pr-2">Patterns</th>
                        <th className="pb-1 pr-2">Insights</th>
                        <th className="pb-1 pr-2">Velocity</th>
                        <th className="pb-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportHistory.map((entry, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-2 text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-1 pr-2">{entry.iteration}</td>
                          <td className="py-1 pr-2">{entry.dataPoints}</td>
                          <td className="py-1 pr-2">{entry.detectedPatterns}</td>
                          <td className="py-1 pr-2">{entry.systemInsights}</td>
                          <td className="py-1 pr-2">{entry.learningVelocity}</td>
                          <td className="py-1">
                            {entry.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommendations</CardTitle>
              <CardDescription>
                Actionable insights from monitoring systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(healthCheck?.recommendations ?? productionHealth?.recommendations ?? []).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
                {(healthCheck?.recommendations ?? productionHealth?.recommendations ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No recommendations available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
