/**
 * Guard Metrics Dashboard
 *
 * Displays real-time security guard rejection metrics from the export pipeline.
 * Integrates with the useExportGuardMetrics hook to provide end-user observability
 * into the defense-in-depth security architecture.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useExportGuardMetrics } from '@/hooks/useExportGuardMetrics';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

export const GuardMetricsDashboard: React.FC = () => {
  const { metrics, isPolling, refresh, start, stop, reset, prometheusText } =
    useExportGuardMetrics({ intervalMs: 5000, autoStart: true });

  const layerLabels: Record<string, string> = {
    'content-validator': 'Content Validator',
    'strict-mode-block': 'Strict Mode',
    'escape-function': 'Escape Function',
  };

  const severityColor = (sev: string) =>
    sev === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';

  const totalBySeverity = metrics.bySeverity;
  const threatLevel =
    totalBySeverity.high > 0
      ? 'critical'
      : totalBySeverity.medium > 0
        ? 'elevated'
        : 'clear';

  const ThreatIcon =
    threatLevel === 'critical'
      ? ShieldAlert
      : threatLevel === 'elevated'
        ? Shield
        : ShieldCheck;

  const threatBadge =
    threatLevel === 'critical'
      ? 'bg-red-500 text-white'
      : threatLevel === 'elevated'
        ? 'bg-yellow-500 text-white'
        : 'bg-green-500 text-white';

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThreatIcon className="h-6 w-6" />
          <h2 className="text-xl font-bold">Security Guard Metrics</h2>
          <Badge className={threatBadge}>{threatLevel.toUpperCase()}</Badge>
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
              <Play className="mr-1 h-4 w-4" /> Resume
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm('Reset all security metrics?')) reset();
            }}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Rejections</CardDescription>
            <CardTitle className="text-3xl">{metrics.totalRejections}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" /> Cumulative guard blocks
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Severity</CardDescription>
            <CardTitle className="text-3xl text-red-600">{totalBySeverity.high}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={severityColor('high')}>Active script vectors</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Medium Severity</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{totalBySeverity.medium}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={severityColor('medium')}>Event handlers, protocols</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Tabs defaultValue="layers">
        <TabsList>
          <TabsTrigger value="layers">Defense Layers</TabsTrigger>
          <TabsTrigger value="patterns">Top Patterns</TabsTrigger>
          <TabsTrigger value="matrix">Severity Matrix</TabsTrigger>
          <TabsTrigger value="prometheus">Prometheus Export</TabsTrigger>
        </TabsList>

        {/* Layer Breakdown */}
        <TabsContent value="layers" className="space-y-2">
          {(Object.keys(metrics.byLayer) as Array<keyof typeof metrics.byLayer>).map((layer) => (
            <Card key={layer}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{layerLabels[layer] ?? layer}</CardTitle>
                  <Badge variant="secondary">{metrics.byLayer[layer]} rejections</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge className={severityColor('high')}>
                    High: {metrics.matrix[layer]?.high ?? 0}
                  </Badge>
                  <Badge className={severityColor('medium')}>
                    Medium: {metrics.matrix[layer]?.medium ?? 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Top Patterns */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle>Most Frequently Detected Patterns</CardTitle>
              <CardDescription>Attack patterns ranked by detection count</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.byPattern.length === 0 ? (
                <p className="text-sm text-muted-foreground">No patterns detected yet.</p>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-1">
                    {metrics.byPattern.map((p) => (
                      <div
                        key={p.pattern}
                        className="flex items-center justify-between rounded border px-3 py-1.5"
                      >
                        <code className="text-sm">{p.pattern}</code>
                        <Badge variant="outline">{p.count}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Severity Matrix */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Layer × Severity Matrix</CardTitle>
              <CardDescription>Detection distribution across defense layers</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Layer</th>
                    <th className="py-2 text-right">High</th>
                    <th className="py-2 text-right">Medium</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(metrics.matrix) as Array<keyof typeof metrics.matrix>).map(
                    (layer) => {
                      const row = metrics.matrix[layer];
                      return (
                        <tr key={layer} className="border-b">
                          <td className="py-2">{layerLabels[layer] ?? layer}</td>
                          <td className="py-2 text-right text-red-600">{row.high}</td>
                          <td className="py-2 text-right text-yellow-600">{row.medium}</td>
                          <td className="py-2 text-right font-bold">{row.high + row.medium}</td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right text-red-600">{totalBySeverity.high}</td>
                    <td className="py-2 text-right text-yellow-600">{totalBySeverity.medium}</td>
                    <td className="py-2 text-right">{metrics.totalRejections}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prometheus Export */}
        <TabsContent value="prometheus">
          <Card>
            <CardHeader>
              <CardTitle>Prometheus Exposition Format</CardTitle>
              <CardDescription>
                Copy this text into Prometheus scrape endpoint configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3">
                  {prometheusText || '# No metrics recorded'}
                </pre>
              </ScrollArea>
              <Separator className="my-3" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(prometheusText)}
              >
                Copy to Clipboard
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
