/**
 * REQ-208: Grafana Dashboard Model Tests
 *
 * Validates the generated Grafana dashboard JSON model structure,
 * panel configuration, and metric expression correctness.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateGrafanaDashboard,
  exportDashboardJson,
  type GrafanaDashboardConfig,
  type GrafanaPanel,
} from '@/monitoring/grafana-dashboard-model';

/**
 * Fail-loud panel lookup (Phase 149 / TASK-0236). Replaces the old
 * `dashboard.panels.find(...)!` checker suppression: an absent panel used
 * to surface as a bare `expect(panel).toBeDefined()` failure, the helper
 * keeps the RED verdict with the missing panel title.
 */
function requirePanel(dashboard: GrafanaDashboardConfig, title: string): GrafanaPanel {
  const panel = dashboard.panels.find(p => p.title === title);
  if (panel === undefined) {
    throw new Error(`panel not found: ${title}`);
  }
  return panel;
}

describe('Grafana Dashboard Model (REQ-208)', () => {
  describe('generateGrafanaDashboard', () => {
    it('should generate a dashboard with required metadata', () => {
      const dashboard = generateGrafanaDashboard();

      expect(dashboard.uid).toMatch(/^s2v-monitoring-\d+$/);
      expect(dashboard.title).toBe('Speech-to-Visuals Monitoring');
      expect(dashboard.tags).toContain('speech-to-visuals');
      expect(dashboard.tags).toContain('prometheus');
      expect(dashboard.timezone).toBe('browser');
      expect(dashboard.refresh).toBe('30s');
      expect(dashboard.time.from).toBe('now-1h');
      expect(dashboard.time.to).toBe('now');
    });

    it('should generate exactly 11 panels', () => {
      const dashboard = generateGrafanaDashboard();
      expect(dashboard.panels).toHaveLength(11);
    });

    it('should assign unique sequential panel IDs', () => {
      const dashboard = generateGrafanaDashboard();
      const ids = dashboard.panels.map(p => p.id);
      const sorted = [...ids].sort((a, b) => a - b);
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('should include required panel types', () => {
      const dashboard = generateGrafanaDashboard();
      const types = dashboard.panels.map(p => p.type);
      expect(types).toContain('timeseries');
      expect(types).toContain('stat');
    });

    it('should include latency panel with P50/P95/P99 targets', () => {
      const dashboard = generateGrafanaDashboard();
      const latencyPanel = requirePanel(dashboard, 'HTTP Latency Distribution');
      expect(latencyPanel.type).toBe('timeseries');
      expect(latencyPanel.targets).toHaveLength(3);

      const exprs = latencyPanel.targets.map(t => t.expr);
      expect(exprs.some(e => e.includes('quantile="0.5"'))).toBe(true);
      expect(exprs.some(e => e.includes('quantile="0.95"'))).toBe(true);
      expect(exprs.some(e => e.includes('quantile="0.99"'))).toBe(true);

      // Check latency thresholds
      const thresholds = (latencyPanel.fieldConfig as Record<string, Record<string, Record<string, unknown>>>)
        ?.defaults?.thresholds?.steps as Array<{ value: number; color: string }>;
      expect(thresholds).toBeDefined();
      expect(thresholds.find((t: { value: number }) => t.value === 20000)?.color).toBe('red');
    });

    it('should include error rate panel with rate expression', () => {
      const dashboard = generateGrafanaDashboard();
      const errorPanel = requirePanel(dashboard, 'Error Rate Trends');
      expect(errorPanel.targets[0].expr).toContain('http_errors_total');
      expect(errorPanel.targets[0].expr).toContain('http_requests_total');
      expect(errorPanel.targets[0].expr).toContain('rate(');
    });

    it('should include success rate stat panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Pipeline Success Rate');
      expect(panel.type).toBe('stat');
      expect(panel.gridPos.w).toBeLessThanOrEqual(24);
    });

    it('should include slow requests stat panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Slow Requests');
      expect(panel.type).toBe('stat');
      expect(panel.targets[0].expr).toContain('http_slow_requests_total');
    });

    it('should include active requests panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Active Requests');
      expect(panel.targets[0].expr).toContain('http_active_requests');
    });

    it('should include uptime panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Process Uptime');
      expect(panel.targets[0].expr).toContain('process_uptime_ms');
    });

    it('should include request volume panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Request Volume');
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('http_requests_total');
    });

    it('should include errors by route panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Errors by Route');
      expect(panel.targets[0].expr).toContain('http_errors_total');
    });

    it('should include export queue size stat panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Export Queue Size');
      expect(panel.type).toBe('stat');
      expect(panel.targets[0].expr).toContain('export_queue_size');
    });

    it('should include export queue wait time stat panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Export Queue Wait Time');
      expect(panel.type).toBe('stat');
      expect(panel.targets[0].expr).toContain('export_queue_wait_time_ms');
    });

    it('should include export queue dequeue rate timeseries panel', () => {
      const dashboard = generateGrafanaDashboard();
      const panel = requirePanel(dashboard, 'Export Queue Dequeue Rate by Priority');
      expect(panel.type).toBe('timeseries');
      expect(panel.targets[0].expr).toContain('rate(');
      expect(panel.targets[0].expr).toContain('export_queue_dequeue_total');
    });

    it('should have all panels within 24-column grid width', () => {
      const dashboard = generateGrafanaDashboard();
      for (const panel of dashboard.panels) {
        expect(panel.gridPos.x + panel.gridPos.w).toBeLessThanOrEqual(24);
      }
    });

    it('should respect custom options', () => {
      const dashboard = generateGrafanaDashboard({
        datasource: 'MyPrometheus',
        uidPrefix: 'custom',
        metricPrefix: 's2v',
        refresh: '10s',
        timeFrom: 'now-6h',
      });

      expect(dashboard.uid).toMatch(/^custom-monitoring-\d+$/);
      expect(dashboard.refresh).toBe('10s');
      expect(dashboard.time.from).toBe('now-6h');

      // All metric expressions should use the prefix
      for (const panel of dashboard.panels) {
        for (const target of panel.targets) {
          // Either has the prefix or uses rate() with the prefix
          if (target.expr.includes('s2v_http')) {
            expect(target.expr).toContain('s2v_');
          }
        }
      }
    });

    it('should include templating variables', () => {
      const dashboard = generateGrafanaDashboard();
      const templating = dashboard.templating;
      if (templating === undefined) {
        throw new Error('dashboard.templating is undefined');
      }
      expect(templating.list).toHaveLength(1);
      expect(templating.list[0].name).toBe('datasource');
    });
  });

  describe('exportDashboardJson', () => {
    it('should produce valid JSON', () => {
      const json = exportDashboardJson();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should wrap dashboard in Grafana import format', () => {
      const json = exportDashboardJson();
      const parsed = JSON.parse(json);
      expect(parsed.dashboard).toBeDefined();
      expect(parsed.overwrite).toBe(true);
      expect(parsed.__inputs).toBeDefined();
      expect(parsed.__requires).toBeDefined();
    });

    it('should include all 11 panels in exported JSON', () => {
      const json = exportDashboardJson();
      const parsed = JSON.parse(json);
      expect(parsed.dashboard.panels).toHaveLength(11);
    });
  });

  describe('Panel grid layout', () => {
    it('should not have overlapping panels', () => {
      const dashboard = generateGrafanaDashboard();
      const panels = dashboard.panels;

      for (let i = 0; i < panels.length; i++) {
        for (let j = i + 1; j < panels.length; j++) {
          const a = panels[i].gridPos;
          const b = panels[j].gridPos;

          const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
          const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlapsX && overlapsY).toBe(false);
        }
      }
    });
  });

  describe('Metric expression correctness', () => {
    it('should reference all Prometheus metrics across panels', () => {
      const dashboard = generateGrafanaDashboard();
      const allExprs = dashboard.panels.flatMap(p => p.targets.map(t => t.expr)).join(' ');

      expect(allExprs).toContain('http_request_duration_ms');
      expect(allExprs).toContain('http_errors_total');
      expect(allExprs).toContain('http_requests_total');
      expect(allExprs).toContain('http_active_requests');
      expect(allExprs).toContain('http_slow_requests_total');
      expect(allExprs).toContain('process_uptime_ms');
      expect(allExprs).toContain('export_queue_size');
      expect(allExprs).toContain('export_queue_wait_time_ms');
      expect(allExprs).toContain('export_queue_dequeue_total');
    });

    it('should not use prefix when metricPrefix is empty', () => {
      const dashboard = generateGrafanaDashboard({ metricPrefix: '' });
      const allExprs = dashboard.panels.flatMap(p => p.targets.map(t => t.expr)).join(' ');

      // Should start with metric names directly (no underscore prefix)
      expect(allExprs).not.toContain('undefined_');
    });
  });
});
