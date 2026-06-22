import {
  generateGrafanaDashboard,
  exportDashboardJson,
  DashboardGenerateOptions,
  GrafanaDashboardConfig,
  GrafanaPanel,
} from '../grafana-dashboard-model';

// ---------------------------------------------------------------------------
// generateGrafanaDashboard
// ---------------------------------------------------------------------------

describe('generateGrafanaDashboard', () => {
  describe('default options', () => {
    const dashboard = generateGrafanaDashboard();

    it('returns a valid dashboard config object', () => {
      expect(dashboard).toBeDefined();
      expect(typeof dashboard).toBe('object');
    });

    it('sets uid with prefix and timestamp', () => {
      expect(dashboard.uid).toMatch(/^s2v-monitoring-\d+$/);
    });

    it('sets the expected title', () => {
      expect(dashboard.title).toBe('Speech-to-Visuals Monitoring');
    });

    it('includes required tags', () => {
      expect(dashboard.tags).toContain('speech-to-visuals');
      expect(dashboard.tags).toContain('monitoring');
      expect(dashboard.tags).toContain('prometheus');
    });

    it('sets timezone to browser', () => {
      expect(dashboard.timezone).toBe('browser');
    });

    it('sets default refresh to 30s', () => {
      expect(dashboard.refresh).toBe('30s');
    });

    it('sets default time range', () => {
      expect(dashboard.time).toEqual({ from: 'now-1h', to: 'now' });
    });

    it('generates exactly 11 panels', () => {
      expect(dashboard.panels).toHaveLength(11);
    });

    it('assigns unique sequential panel ids starting at 1', () => {
      const ids = dashboard.panels.map(p => p.id);
      expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('includes templating with datasource variable', () => {
      expect(dashboard.templating).toBeDefined();
      expect(dashboard.templating!.list).toHaveLength(1);
      expect(dashboard.templating!.list[0].name).toBe('datasource');
      expect(dashboard.templating!.list[0].type).toBe('datasource');
      expect(dashboard.templating!.list[0].current.value).toBe('Prometheus');
    });
  });

  describe('custom options', () => {
    it('uses custom uidPrefix', () => {
      const dash = generateGrafanaDashboard({ uidPrefix: 'custom' });
      expect(dash.uid).toMatch(/^custom-monitoring-\d+$/);
    });

    it('uses custom refresh interval', () => {
      const dash = generateGrafanaDashboard({ refresh: '5s' });
      expect(dash.refresh).toBe('5s');
    });

    it('uses custom timeFrom', () => {
      const dash = generateGrafanaDashboard({ timeFrom: 'now-6h' });
      expect(dash.time.from).toBe('now-6h');
      expect(dash.time.to).toBe('now');
    });

    it('uses custom datasource in templating', () => {
      const dash = generateGrafanaDashboard({ datasource: 'MyPrometheus' });
      expect(dash.templating!.list[0].current.value).toBe('MyPrometheus');
      expect(dash.templating!.list[0].current.text).toBe('MyPrometheus');
    });

    it('uses custom metricPrefix in expressions', () => {
      const dash = generateGrafanaDashboard({ metricPrefix: 's2v' });
      // The prefix is used as `s2v_` before metric names
      const latencyPanel = dash.panels.find(p => p.title === 'HTTP Latency Distribution')!;
      expect(latencyPanel.targets[0].expr).toContain('s2v_http_request_duration_ms');
    });

    it('does not add underscore prefix when metricPrefix is empty', () => {
      const dash = generateGrafanaDashboard({ metricPrefix: '' });
      const latencyPanel = dash.panels.find(p => p.title === 'HTTP Latency Distribution')!;
      expect(latencyPanel.targets[0].expr).not.toContain('_http_request_duration_ms');
      expect(latencyPanel.targets[0].expr).toContain('http_request_duration_ms');
    });
  });

  describe('panel structure', () => {
    const dashboard = generateGrafanaDashboard();

    it('every panel has required fields', () => {
      for (const panel of dashboard.panels) {
        expect(panel.id).toBeDefined();
        expect(panel.title).toBeDefined();
        expect(panel.type).toBeDefined();
        expect(panel.gridPos).toBeDefined();
        expect(panel.targets).toBeDefined();
        expect(Array.isArray(panel.targets)).toBe(true);
        expect(panel.targets.length).toBeGreaterThan(0);
      }
    });

    it('every panel has valid gridPos with h, w, x, y', () => {
      for (const panel of dashboard.panels) {
        expect(panel.gridPos.h).toBeGreaterThan(0);
        expect(panel.gridPos.w).toBeGreaterThan(0);
        expect(panel.gridPos.w).toBeLessThanOrEqual(24);
        expect(panel.gridPos.x).toBeGreaterThanOrEqual(0);
        expect(panel.gridPos.x).toBeLessThanOrEqual(24);
        expect(panel.gridPos.y).toBeGreaterThanOrEqual(0);
        expect(panel.gridPos.x + panel.gridPos.w).toBeLessThanOrEqual(24);
      }
    });

    it('every target has expr, legendFormat, and refId', () => {
      for (const panel of dashboard.panels) {
        for (const target of panel.targets) {
          expect(target.expr).toBeTruthy();
          expect(target.legendFormat).toBeTruthy();
          expect(target.refId).toBeTruthy();
          expect(target.expr.length).toBeGreaterThan(5);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Individual panel assertions
  // -------------------------------------------------------------------------

  describe('Success Rate panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Pipeline Success Rate')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('uses percentunit', () => {
      expect(panel.fieldConfig!.defaults.unit).toBe('percentunit');
    });

    it('has correct threshold steps', () => {
      const steps = panel.fieldConfig!.defaults.thresholds.steps;
      expect(steps).toHaveLength(3);
      expect(steps[0]).toEqual({ value: 0, color: 'red' });
      expect(steps[1]).toEqual({ value: 0.9, color: 'yellow' });
      expect(steps[2]).toEqual({ value: 0.95, color: 'green' });
    });

    it('expression calculates 1 - error rate', () => {
      expect(panel.targets[0].expr).toContain('1 - (rate(');
      expect(panel.targets[0].expr).toContain('http_errors_total');
      expect(panel.targets[0].expr).toContain('http_requests_total');
    });
  });

  describe('Slow Requests panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Slow Requests')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('references http_slow_requests_total metric', () => {
      expect(panel.targets[0].expr).toContain('http_slow_requests_total');
    });
  });

  describe('Active Requests panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Active Requests')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('references http_active_requests metric', () => {
      expect(panel.targets[0].expr).toContain('http_active_requests');
    });
  });

  describe('Process Uptime panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Process Uptime')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('converts uptime to minutes', () => {
      expect(panel.targets[0].expr).toContain('process_uptime_ms');
      expect(panel.targets[0].expr).toContain('/ 1000 / 60');
    });
  });

  describe('HTTP Latency Distribution panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'HTTP Latency Distribution')!;

    it('is a timeseries panel', () => {
      expect(panel.type).toBe('timeseries');
    });

    it('has three targets for P50, P95, P99', () => {
      expect(panel.targets).toHaveLength(3);
      const legends = panel.targets.map(t => t.legendFormat);
      expect(legends).toContain('P50');
      expect(legends).toContain('P95');
      expect(legends).toContain('P99');
    });

    it('queries http_request_duration_ms with quantile labels', () => {
      expect(panel.targets[0].expr).toContain('quantile="0.5"');
      expect(panel.targets[1].expr).toContain('quantile="0.95"');
      expect(panel.targets[2].expr).toContain('quantile="0.99"');
    });

    it('uses ms as unit', () => {
      expect(panel.fieldConfig!.defaults.unit).toBe('ms');
    });
  });

  describe('Error Rate Trends panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Error Rate Trends')!;

    it('is a timeseries panel', () => {
      expect(panel.type).toBe('timeseries');
    });

    it('calculates error rate percentage', () => {
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('http_errors_total');
      expect(panel.targets[0].expr).toContain('http_requests_total');
      expect(panel.targets[0].expr).toContain('* 100');
    });

    it('uses percent unit', () => {
      expect(panel.fieldConfig!.defaults.unit).toBe('percent');
    });
  });

  describe('Request Volume panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Request Volume')!;

    it('is a timeseries panel', () => {
      expect(panel.type).toBe('timeseries');
    });

    it('queries rate of http_requests_total', () => {
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('http_requests_total');
    });

    it('uses reqps unit', () => {
      expect(panel.fieldConfig!.defaults.unit).toBe('reqps');
    });
  });

  describe('Errors by Route panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Errors by Route')!;

    it('is a timeseries panel', () => {
      expect(panel.type).toBe('timeseries');
    });

    it('queries rate of http_errors_total', () => {
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('http_errors_total');
    });
  });

  // -------------------------------------------------------------------------
  // Export queue panels (REQ-229)
  // -------------------------------------------------------------------------

  describe('Export Queue Size panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Export Queue Size')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('references export_queue_size metric', () => {
      expect(panel.targets[0].expr).toContain('export_queue_size');
    });
  });

  describe('Export Queue Wait Time panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Export Queue Wait Time')!;

    it('is a stat panel', () => {
      expect(panel.type).toBe('stat');
    });

    it('references export_queue_wait_time_ms metric', () => {
      expect(panel.targets[0].expr).toContain('export_queue_wait_time_ms');
    });

    it('uses ms as unit', () => {
      expect(panel.fieldConfig!.defaults.unit).toBe('ms');
    });
  });

  describe('Export Queue Dequeue Rate panel', () => {
    const dashboard = generateGrafanaDashboard();
    const panel = dashboard.panels.find(p => p.title === 'Export Queue Dequeue Rate by Priority')!;

    it('is a timeseries panel', () => {
      expect(panel.type).toBe('timeseries');
    });

    it('queries rate of export_queue_dequeue_total', () => {
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('export_queue_dequeue_total');
    });

    it('has full width (w=24)', () => {
      expect(panel.gridPos.w).toBe(24);
    });
  });

  // -------------------------------------------------------------------------
  // Grid layout: no overlapping panels
  // -------------------------------------------------------------------------

  describe('grid layout', () => {
    const dashboard = generateGrafanaDashboard();

    it('has no overlapping panels', () => {
      const panels = dashboard.panels;
      let overlaps = 0;
      for (let i = 0; i < panels.length; i++) {
        for (let j = i + 1; j < panels.length; j++) {
          const a = panels[i].gridPos;
          const b = panels[j].gridPos;
          const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
          const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
          if (overlapX && overlapY) overlaps++;
        }
      }
      expect(overlaps).toBe(0);
    });

    it('row 1 panels (y=0) span 4 stat panels across 24 columns', () => {
      const row1 = dashboard.panels.filter(p => p.gridPos.y === 0);
      expect(row1).toHaveLength(4);
      const totalWidth = row1.reduce((sum, p) => sum + p.gridPos.w, 0);
      expect(totalWidth).toBe(24);
    });

    it('row 2 panels (y=4) span 2 timeseries across 24 columns', () => {
      const row2 = dashboard.panels.filter(p => p.gridPos.y === 4);
      expect(row2).toHaveLength(2);
      const totalWidth = row2.reduce((sum, p) => sum + p.gridPos.w, 0);
      expect(totalWidth).toBe(24);
    });

    it('row 3 panels (y=12) span 2 timeseries across 24 columns', () => {
      const row3 = dashboard.panels.filter(p => p.gridPos.y === 12);
      expect(row3).toHaveLength(2);
      const totalWidth = row3.reduce((sum, p) => sum + p.gridPos.w, 0);
      expect(totalWidth).toBe(24);
    });

    it('row 4 panels (y=20) span 2 stat panels across 24 columns', () => {
      const row4 = dashboard.panels.filter(p => p.gridPos.y === 20);
      expect(row4).toHaveLength(2);
      const totalWidth = row4.reduce((sum, p) => sum + p.gridPos.w, 0);
      expect(totalWidth).toBe(24);
    });

    it('row 5 panel (y=24) spans full width', () => {
      const row5 = dashboard.panels.filter(p => p.gridPos.y === 24);
      expect(row5).toHaveLength(1);
      expect(row5[0].gridPos.w).toBe(24);
    });
  });
});

// ---------------------------------------------------------------------------
// exportDashboardJson
// ---------------------------------------------------------------------------

describe('exportDashboardJson', () => {
  it('returns a JSON string', () => {
    const result = exportDashboardJson();
    expect(typeof result).toBe('string');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('wraps dashboard in Grafana import format', () => {
    const parsed = JSON.parse(exportDashboardJson());
    expect(parsed).toHaveProperty('__inputs');
    expect(parsed).toHaveProperty('__requires');
    expect(parsed).toHaveProperty('dashboard');
    expect(parsed).toHaveProperty('overwrite', true);
  });

  it('dashboard object inside JSON has all expected fields', () => {
    const parsed = JSON.parse(exportDashboardJson());
    expect(parsed.dashboard.title).toBe('Speech-to-Visuals Monitoring');
    expect(parsed.dashboard.panels).toHaveLength(11);
    expect(parsed.dashboard.timezone).toBe('browser');
  });

  it('passes options through to dashboard generation', () => {
    const parsed = JSON.parse(exportDashboardJson({ refresh: '10s', metricPrefix: 'test' }));
    expect(parsed.dashboard.refresh).toBe('10s');
    const latencyPanel = parsed.dashboard.panels.find(
      (p: GrafanaPanel) => p.title === 'HTTP Latency Distribution',
    );
    expect(latencyPanel.targets[0].expr).toContain('test_http_request_duration_ms');
  });

  it('produces pretty-printed JSON with 2-space indent', () => {
    const result = exportDashboardJson();
    // Check for 2-space indentation
    expect(result).toContain('\n  "');
  });
});

// ---------------------------------------------------------------------------
// Type export verification
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('GrafanaDashboardConfig fields are accessible', () => {
    const config: GrafanaDashboardConfig = generateGrafanaDashboard();
    expect(config.uid).toBeDefined();
    expect(config.title).toBeDefined();
    expect(config.tags).toBeDefined();
    expect(config.panels).toBeDefined();
  });

  it('DashboardGenerateOptions accepts all optional fields', () => {
    const opts: DashboardGenerateOptions = {
      datasource: 'TestDS',
      uidPrefix: 'test',
      metricPrefix: 'm',
      refresh: '15s',
      timeFrom: 'now-3h',
    };
    const dash = generateGrafanaDashboard(opts);
    expect(dash.refresh).toBe('15s');
    expect(dash.time.from).toBe('now-3h');
  });
});
