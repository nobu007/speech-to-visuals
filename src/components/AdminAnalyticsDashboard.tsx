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
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  HeartPulse,
  Pause,
  Play,
  RefreshCw,
  Server,
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

  const { healthCheck, productionHealth, productionMetrics, performanceSnapshot, trends } = snapshot;

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
          value={totalRequests.toLocaleString()}
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
