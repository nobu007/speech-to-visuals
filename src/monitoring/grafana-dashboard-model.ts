/**
 * REQ-208: Grafana-Compatible Dashboard Configuration
 *
 * Generates a Grafana dashboard JSON model that visualizes metrics
 * from the /api/v1/monitoring/prometheus endpoint.
 *
 * Panels:
 * 1. HTTP Latency Distribution (P50/P95/P99 time series)
 * 2. Error Rate Trends (percentage over time)
 * 3. Pipeline Processing Success Rate (stat panel)
 * 4. LLM Cost Trends (time series)
 * 5. Health Status Overview (stat panel)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrafanaDashboardConfig {
  uid: string;
  title: string;
  tags: string[];
  timezone: string;
  refresh: string;
  time: { from: string; to: string };
  panels: GrafanaPanel[];
  templating?: {
    list: GrafanaTemplateVariable[];
  };
}

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  gridPos: { h: number; w: number; x: number; y: number };
  targets: GrafanaTarget[];
  fieldConfig?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface GrafanaTarget {
  expr: string;
  legendFormat: string;
  refId: string;
}

export interface GrafanaTemplateVariable {
  name: string;
  type: string;
  query: string;
  current: { text: string; value: string };
}

export interface DashboardGenerateOptions {
  /** Prometheus data source name (default: 'Prometheus') */
  datasource?: string;
  /** Dashboard UID prefix (default: 's2v') */
  uidPrefix?: string;
  /** Metric namespace prefix (default: '') */
  metricPrefix?: string;
  /** Refresh interval (default: '30s') */
  refresh?: string;
  /** Time range from (default: 'now-1h') */
  timeFrom?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<DashboardGenerateOptions> = {
  datasource: 'Prometheus',
  uidPrefix: 's2v',
  metricPrefix: '',
  refresh: '30s',
  timeFrom: 'now-1h',
};

// ---------------------------------------------------------------------------
// Panel builders
// ---------------------------------------------------------------------------

function buildLatencyPanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'HTTP Latency Distribution',
    type: 'timeseries',
    gridPos: { h: 8, w: 12, x: 0, y },
    targets: [
      {
        expr: `${p}http_request_duration_ms{quantile="0.5"}`,
        legendFormat: 'P50',
        refId: 'A',
      },
      {
        expr: `${p}http_request_duration_ms{quantile="0.95"}`,
        legendFormat: 'P95',
        refId: 'B',
      },
      {
        expr: `${p}http_request_duration_ms{quantile="0.99"}`,
        legendFormat: 'P99',
        refId: 'C',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'ms',
        custom: {
          lineWidth: 2,
          fillOpacity: 10,
          spanNulls: true,
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'green' },
            { value: 5000, color: 'yellow' },
            { value: 20000, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      tooltip: { mode: 'multi', sort: 'desc' },
      legend: { displayMode: 'list', placement: 'bottom' },
    },
  };
}

function buildErrorRatePanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Error Rate Trends',
    type: 'timeseries',
    gridPos: { h: 8, w: 12, x: 12, y },
    targets: [
      {
        expr: `rate(${p}http_errors_total[5m]) / rate(${p}http_requests_total[5m]) * 100`,
        legendFormat: '{{method}} {{path}}',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'percent',
        min: 0,
        max: 100,
        custom: {
          lineWidth: 2,
          fillOpacity: 15,
          spanNulls: true,
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'green' },
            { value: 5, color: 'yellow' },
            { value: 10, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      tooltip: { mode: 'multi', sort: 'desc' },
      legend: { displayMode: 'table', placement: 'bottom' },
    },
  };
}

function buildSuccessRatePanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Pipeline Success Rate',
    type: 'stat',
    gridPos: { h: 4, w: 6, x: 0, y },
    targets: [
      {
        expr: `1 - (rate(${p}http_errors_total[5m]) / rate(${p}http_requests_total[5m]))`,
        legendFormat: 'Success Rate',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'percentunit',
        min: 0,
        max: 1,
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'red' },
            { value: 0.9, color: 'yellow' },
            { value: 0.95, color: 'green' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      reduceOptions: { calcs: ['lastNotNull'] },
      orientation: 'auto',
      textMode: 'auto',
      wideLayout: true,
    },
  };
}

function buildSlowRequestsPanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Slow Requests',
    type: 'stat',
    gridPos: { h: 4, w: 6, x: 6, y },
    targets: [
      {
        expr: `${p}http_slow_requests_total`,
        legendFormat: 'Total Slow Requests',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'green' },
            { value: 5, color: 'yellow' },
            { value: 20, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      reduceOptions: { calcs: ['lastNotNull'] },
      orientation: 'auto',
      textMode: 'auto',
      wideLayout: true,
    },
  };
}

function buildActiveRequestsPanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Active Requests',
    type: 'stat',
    gridPos: { h: 4, w: 6, x: 12, y },
    targets: [
      {
        expr: `${p}http_active_requests`,
        legendFormat: 'Active',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'green' },
            { value: 10, color: 'yellow' },
            { value: 50, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      reduceOptions: { calcs: ['lastNotNull'] },
      orientation: 'auto',
      textMode: 'auto',
      wideLayout: true,
    },
  };
}

function buildUptimePanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Process Uptime',
    type: 'stat',
    gridPos: { h: 4, w: 6, x: 18, y },
    targets: [
      {
        expr: `${p}process_uptime_ms / 1000 / 60`,
        legendFormat: 'Uptime (min)',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'm',
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'red' },
            { value: 5, color: 'yellow' },
            { value: 30, color: 'green' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      reduceOptions: { calcs: ['lastNotNull'] },
      orientation: 'auto',
      textMode: 'auto',
      wideLayout: true,
    },
  };
}

function buildRequestTotalPanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Request Volume',
    type: 'timeseries',
    gridPos: { h: 8, w: 12, x: 0, y },
    targets: [
      {
        expr: `rate(${p}http_requests_total[5m])`,
        legendFormat: '{{method}} {{path}} {{status_class}}',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'reqps',
        custom: {
          lineWidth: 1,
          fillOpacity: 10,
          spanNulls: true,
        },
      },
      overrides: [],
    },
    options: {
      tooltip: { mode: 'multi', sort: 'desc' },
      legend: { displayMode: 'table', placement: 'bottom' },
    },
  };
}

function buildErrorDetailPanel(
  ds: string,
  prefix: string,
  id: number,
  y: number,
): GrafanaPanel {
  const p = prefix;
  return {
    id,
    title: 'Errors by Route',
    type: 'timeseries',
    gridPos: { h: 8, w: 12, x: 12, y },
    targets: [
      {
        expr: `rate(${p}http_errors_total[5m])`,
        legendFormat: '{{method}} {{path}}',
        refId: 'A',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'reqps',
        custom: {
          lineWidth: 2,
          fillOpacity: 15,
          spanNulls: true,
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: 0, color: 'green' },
            { value: 0.01, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    options: {
      tooltip: { mode: 'multi', sort: 'desc' },
      legend: { displayMode: 'table', placement: 'bottom' },
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Grafana dashboard JSON model for speech-to-visuals monitoring.
 *
 * The dashboard visualizes metrics from the Prometheus exporter endpoint
 * (GET /api/v1/monitoring/prometheus) and provides:
 * - HTTP latency percentiles (P50/P95/P99)
 * - Error rate trends by route
 * - Pipeline success rate overview
 * - Slow request tracking
 * - Active request gauge
 * - Process uptime
 * - Request volume
 * - Error breakdown by route
 */
export function generateGrafanaDashboard(
  options?: DashboardGenerateOptions,
): GrafanaDashboardConfig {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const prefix = opts.metricPrefix ? `${opts.metricPrefix}_` : '';

  let panelId = 1;
  const panels: GrafanaPanel[] = [
    // Row 1: Summary stats (y=0)
    buildSuccessRatePanel(opts.datasource, prefix, panelId++, 0),
    buildSlowRequestsPanel(opts.datasource, prefix, panelId++, 0),
    buildActiveRequestsPanel(opts.datasource, prefix, panelId++, 0),
    buildUptimePanel(opts.datasource, prefix, panelId++, 0),
    // Row 2: Latency + Error rate time series (y=4)
    buildLatencyPanel(opts.datasource, prefix, panelId++, 4),
    buildErrorRatePanel(opts.datasource, prefix, panelId++, 4),
    // Row 3: Request volume + Error detail (y=12)
    buildRequestTotalPanel(opts.datasource, prefix, panelId++, 12),
    buildErrorDetailPanel(opts.datasource, prefix, panelId++, 12),
  ];

  return {
    uid: `${opts.uidPrefix}-monitoring-${Date.now()}`,
    title: 'Speech-to-Visuals Monitoring',
    tags: ['speech-to-visuals', 'monitoring', 'prometheus'],
    timezone: 'browser',
    refresh: opts.refresh,
    time: { from: opts.timeFrom, to: 'now' },
    panels,
    templating: {
      list: [
        {
          name: 'datasource',
          type: 'datasource',
          query: opts.datasource,
          current: { text: opts.datasource, value: opts.datasource },
        },
      ],
    },
  };
}

/**
 * Export the dashboard as a JSON string suitable for Grafana import.
 */
export function exportDashboardJson(
  options?: DashboardGenerateOptions,
): string {
  const dashboard = generateGrafanaDashboard(options);
  // Grafana import format wraps the dashboard
  return JSON.stringify(
    {
      __inputs: [],
      __requires: [],
      dashboard,
      overwrite: true,
    },
    null,
    2,
  );
}
