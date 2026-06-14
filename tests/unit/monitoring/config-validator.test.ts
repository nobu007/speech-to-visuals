/**
 * Monitoring Config Validator Tests
 *
 * Tests the validation logic that guards deploy/monitoring/ configs.
 * Covers both the actual config files and synthetic fixtures for
 * error-case coverage.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateAlertRules,
  validateGrafanaDashboard,
  validateMonitoringConfigs,
} from '@/monitoring/config-validator';

const DEPLOY_DIR = join(process.cwd(), 'deploy', 'monitoring');

// ---------------------------------------------------------------------------
// Alert Rules — Real File
// ---------------------------------------------------------------------------

describe('Config Validator — alert-rules.yml (real file)', () => {
  const yaml = readFileSync(join(DEPLOY_DIR, 'alert-rules.yml'), 'utf-8');

  it('should pass validation with zero errors', () => {
    const errors = validateAlertRules(yaml);
    expect(errors).toEqual([]);
  });

  it('should have exactly one group', () => {
    // The validator should not error, implying exactly one group is well-formed
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.field?.startsWith('group'))).toBe(false);
  });

  it('should have no duplicate alert names', () => {
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('Duplicate'))).toBe(false);
  });

  it('should have all required annotations for every rule', () => {
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing annotation'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Alert Rules — Synthetic Error Cases
// ---------------------------------------------------------------------------

describe('Config Validator — alert-rules.yml error cases', () => {
  const validRule = `
groups:
  - name: test-alerts
    interval: 30s
    rules:
      - alert: TestAlert
        expr: rate(http_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Test summary"
          description: "Test description"
          runbook_url: "docs/runbooks/test.md"
`.trim();

  it('should pass on valid minimal config', () => {
    const errors = validateAlertRules(validRule);
    expect(errors).toEqual([]);
  });

  it('should detect missing alert name', () => {
    const yaml = validRule.replace('alert: TestAlert', 'alert: ""');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing required field: alert'))).toBe(true);
  });

  it('should detect missing expr', () => {
    const yaml = validRule.replace('expr: rate(http_errors_total[5m]) > 0.05', '');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing required field: expr'))).toBe(true);
  });

  it('should detect invalid severity', () => {
    const yaml = validRule.replace('severity: critical', 'severity: fatal');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('Invalid severity'))).toBe(true);
  });

  it('should detect missing severity label', () => {
    const yaml = validRule.replace('severity: critical', '');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing severity'))).toBe(true);
  });

  it('should detect invalid for duration format', () => {
    const yaml = validRule.replace('for: 2m', 'for: forever');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('Invalid duration'))).toBe(true);
  });

  it('should detect missing runbook_url annotation', () => {
    const yaml = validRule.replace('runbook_url: "docs/runbooks/test.md"', '');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing annotation: runbook_url'))).toBe(true);
  });

  it('should detect runbook_url not pointing to docs/runbooks/', () => {
    const yaml = validRule.replace('docs/runbooks/test.md', 'https://example.com/runbook');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('runbook_url should point'))).toBe(true);
  });

  it('should detect duplicate alert names', () => {
    const yaml = `
groups:
  - name: test-alerts
    interval: 30s
    rules:
      - alert: DuplicateAlert
        expr: rate(http_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "First"
          description: "Desc"
          runbook_url: "docs/runbooks/test.md"
      - alert: DuplicateAlert
        expr: rate(http_errors_total[5m]) > 0.1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Second"
          description: "Desc 2"
          runbook_url: "docs/runbooks/test2.md"
`.trim();
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('Duplicate alert name'))).toBe(true);
  });

  it('should detect missing summary annotation', () => {
    const yaml = validRule.replace('summary: "Test summary"\n', '');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing annotation: summary'))).toBe(true);
  });

  it('should detect missing description annotation', () => {
    const yaml = validRule.replace('description: "Test description"\n', '');
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('missing annotation: description'))).toBe(true);
  });

  it('should detect too-short expression', () => {
    const yaml = validRule.replace(
      'expr: rate(http_errors_total[5m]) > 0.05',
      'expr: ab',
    );
    const errors = validateAlertRules(yaml);
    expect(errors.some(e => e.message.includes('too short'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Grafana Dashboard — Real File
// ---------------------------------------------------------------------------

describe('Config Validator — grafana-dashboard.json (real file)', () => {
  const json = readFileSync(join(DEPLOY_DIR, 'grafana-dashboard.json'), 'utf-8');

  it('should pass validation with zero errors', () => {
    const errors = validateGrafanaDashboard(json);
    expect(errors).toEqual([]);
  });

  it('should have no duplicate panel IDs', () => {
    const errors = validateGrafanaDashboard(json);
    expect(errors.some(e => e.message.includes('Duplicate panel id'))).toBe(false);
  });

  it('should have no overlapping panels', () => {
    const errors = validateGrafanaDashboard(json);
    expect(errors.some(e => e.message.includes('overlap'))).toBe(false);
  });

  it('should have overwrite=true', () => {
    const errors = validateGrafanaDashboard(json);
    expect(errors.some(e => e.field === 'overwrite')).toBe(false);
  });

  it('should have Prometheus datasource input', () => {
    const errors = validateGrafanaDashboard(json);
    expect(errors.some(e => e.message.includes('Prometheus datasource'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grafana Dashboard — Synthetic Error Cases
// ---------------------------------------------------------------------------

describe('Config Validator — grafana-dashboard.json error cases', () => {
  const validDashboard = JSON.stringify({
    __inputs: [{ name: 'Prometheus', type: 'datasource', pluginId: 'prometheus', pluginName: 'Prometheus' }],
    __requires: [{ type: 'grafana', id: 'grafana', name: 'Grafana', version: '9.0.0' }],
    dashboard: {
      uid: 'test-uid',
      title: 'Test Dashboard',
      tags: ['test'],
      timezone: 'browser',
      refresh: '30s',
      time: { from: 'now-1h', to: 'now' },
      panels: [
        {
          id: 1,
          title: 'Panel 1',
          type: 'stat',
          gridPos: { h: 4, w: 6, x: 0, y: 0 },
          datasource: { type: 'prometheus', uid: '${datasource}' },
          targets: [{ expr: 'rate(http_requests_total[5m])', legendFormat: 'reqs', refId: 'A' }],
        },
      ],
    },
    overwrite: true,
  });

  it('should pass on valid dashboard', () => {
    const errors = validateGrafanaDashboard(validDashboard);
    expect(errors).toEqual([]);
  });

  it('should detect invalid JSON', () => {
    const errors = validateGrafanaDashboard('{ not json }}}');
    expect(errors.some(e => e.message.includes('Invalid JSON'))).toBe(true);
  });

  it('should detect missing dashboard wrapper', () => {
    const json = JSON.stringify({ foo: 'bar' });
    const errors = validateGrafanaDashboard(json);
    expect(errors.some(e => e.message.includes('Missing "dashboard"'))).toBe(true);
  });

  it('should detect missing uid', () => {
    const obj = JSON.parse(validDashboard);
    delete obj.dashboard.uid;
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.field === 'dashboard.uid')).toBe(true);
  });

  it('should detect missing title', () => {
    const obj = JSON.parse(validDashboard);
    delete obj.dashboard.title;
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.field === 'dashboard.title')).toBe(true);
  });

  it('should detect missing tags', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.tags = [];
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.field === 'dashboard.tags')).toBe(true);
  });

  it('should detect unusual refresh value', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.refresh = '7s';
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('Unusual refresh'))).toBe(true);
  });

  it('should detect overwrite not being true', () => {
    const obj = JSON.parse(validDashboard);
    obj.overwrite = false;
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.field === 'overwrite')).toBe(true);
  });

  it('should detect missing Prometheus input', () => {
    const obj = JSON.parse(validDashboard);
    obj.__inputs = [{ name: 'Influx', type: 'datasource', pluginId: 'influxdb' }];
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('No Prometheus datasource'))).toBe(true);
  });

  it('should detect missing Grafana requirement', () => {
    const obj = JSON.parse(validDashboard);
    obj.__requires = [{ type: 'datasource', id: 'prometheus', name: 'Prometheus', version: '1.0.0' }];
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('No Grafana version'))).toBe(true);
  });

  it('should detect duplicate panel IDs', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.panels.push({ ...obj.dashboard.panels[0] });
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('Duplicate panel id'))).toBe(true);
  });

  it('should detect duplicate panel titles', () => {
    const obj = JSON.parse(validDashboard);
    const original = obj.dashboard.panels[0];
    obj.dashboard.panels.push({
      ...original,
      id: 2,
      title: original.title, // Same title but different ID
    });
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('Duplicate panel title'))).toBe(true);
  });

  it('should detect panel extending beyond 24 columns', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.panels[0].gridPos = { h: 4, w: 10, x: 20, y: 0 };
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('beyond 24-column'))).toBe(true);
  });

  it('should detect panel width out of range', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.panels[0].gridPos = { h: 4, w: 0, x: 0, y: 0 };
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('width') && e.message.includes('out of range'))).toBe(true);
  });

  it('should detect panel with no targets', () => {
    const obj = JSON.parse(validDashboard);
    obj.dashboard.panels[0].targets = [];
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('no targets'))).toBe(true);
  });

  it('should detect overlapping panels', () => {
    const obj = JSON.parse(validDashboard);
    // Panel 1 is at {h:4, w:6, x:0, y:0}
    // Add a second panel that overlaps
    obj.dashboard.panels.push({
      id: 2,
      title: 'Overlapping Panel',
      type: 'stat',
      gridPos: { h: 4, w: 6, x: 3, y: 0 },
      targets: [{ expr: 'up', refId: 'A' }],
    });
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.message.includes('overlap'))).toBe(true);
  });

  it('should detect missing time range', () => {
    const obj = JSON.parse(validDashboard);
    delete obj.dashboard.time;
    const errors = validateGrafanaDashboard(JSON.stringify(obj));
    expect(errors.some(e => e.field === 'dashboard.time')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Combined Validation
// ---------------------------------------------------------------------------

describe('Config Validator — combined validation', () => {
  it('should return valid=true for real deploy configs', () => {
    const result = validateMonitoringConfigs(DEPLOY_DIR);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should return valid=false for non-existent directory', () => {
    const result = validateMonitoringConfigs('/nonexistent/path/monitoring');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('File not found'))).toBe(true);
  });
});
