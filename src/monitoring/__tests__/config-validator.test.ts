import {
  validateAlertRules,
  validateGrafanaDashboard,
  validateMonitoringConfigs,
  ValidationError,
  ValidationResult,
} from '../config-validator';

import { logger } from '@stv/core/utils/logger';

// ---------------------------------------------------------------------------
// validateAlertRules
// ---------------------------------------------------------------------------

describe('validateAlertRules', () => {
  const validAlertYaml = `
groups:
  - name: http
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 10%"
          runbook_url: "docs/runbooks/high-error-rate"
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_ms) > 5000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency above 5s"
          runbook_url: "docs/runbooks/high-latency"
`;

  describe('valid input', () => {
    it('returns no errors for well-formed YAML', () => {
      const errors = validateAlertRules(validAlertYaml);
      expect(errors).toHaveLength(0);
    });

    it('accepts single-quoted values', () => {
      const yaml = `
groups:
  - name: test
    interval: '30s'
    rules:
      - alert: 'TestAlert'
        expr: 'http_requests_total > 100'
        for: '5m'
        labels:
          severity: 'warning'
        annotations:
          summary: 'Test summary'
          description: 'Test description'
          runbook_url: 'docs/runbooks/test'
`;
      const errors = validateAlertRules(yaml);
      expect(errors).toHaveLength(0);
    });

    it('accepts info severity', () => {
      const yaml = validAlertYaml.replace('severity: critical', 'severity: info');
      expect(validateAlertRules(yaml)).toHaveLength(0);
    });
  });

  describe('structure errors', () => {
    it('returns error for empty groups', () => {
      const errors = validateAlertRules('groups:\n');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('No alert groups');
    });

    it('returns error for completely empty content', () => {
      const errors = validateAlertRules('');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('No alert groups');
    });

    it('returns error for group with no rules', () => {
      const yaml = `
groups:
  - name: empty
    interval: 30s
    rules:
`;
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('no rules'))).toBe(true);
    });
  });

  describe('missing required fields', () => {
    // Parser only recognizes rules starting with `- alert:`, so a missing
    // alert name means the rule is not detected. The validation for
    // missing expr/for is tested instead.

    it('detects missing expr', () => {
      const yaml = `
groups:
  - name: test
    interval: 30s
    rules:
      - alert: NoExpr
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "S"
          description: "D"
          runbook_url: "docs/runbooks/x"
`;
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing required field: expr'))).toBe(true);
    });

    it('detects missing for', () => {
      const yaml = `
groups:
  - name: test
    interval: 30s
    rules:
      - alert: NoFor
        expr: http_requests_total > 100
        labels:
          severity: warning
        annotations:
          summary: "S"
          description: "D"
          runbook_url: "docs/runbooks/x"
`;
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing required field: for'))).toBe(true);
    });
  });

  describe('severity validation', () => {
    it('detects invalid severity', () => {
      const yaml = validAlertYaml.replace('severity: critical', 'severity: bogus');
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('Invalid severity "bogus"'))).toBe(true);
    });

    it('detects missing severity', () => {
      const yaml = `
groups:
  - name: test
    interval: 30s
    rules:
      - alert: NoSeverity
        expr: http_requests_total > 100
        for: 5m
        labels: {}
        annotations:
          summary: "S"
          description: "D"
          runbook_url: "docs/runbooks/x"
`;
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing severity'))).toBe(true);
    });
  });

  describe('duration format validation', () => {
    it('detects invalid for duration', () => {
      const yaml = validAlertYaml.replace('for: 5m', 'for: 5minutes');
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('Invalid duration format'))).toBe(true);
    });

    it('accepts seconds duration', () => {
      const yaml = validAlertYaml.replace('for: 5m', 'for: 30s');
      expect(validateAlertRules(yaml)).toHaveLength(0);
    });

    it('accepts hours duration', () => {
      const yaml = validAlertYaml.replace('for: 5m', 'for: 1h');
      expect(validateAlertRules(yaml)).toHaveLength(0);
    });
  });

  describe('expression validation', () => {
    it('detects very short expressions', () => {
      const yaml = validAlertYaml.replace(
        'rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.1',
        'abc',
      );
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('Expression too short'))).toBe(true);
    });
  });

  describe('annotation validation', () => {
    it('detects missing summary annotation', () => {
      const yaml = validAlertYaml.replace('summary: "High error rate detected"', '');
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing annotation: summary'))).toBe(true);
    });

    it('detects missing description annotation', () => {
      const yaml = validAlertYaml.replace('description: "Error rate is above 10%"', '');
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing annotation: description'))).toBe(true);
    });

    it('detects missing runbook_url annotation', () => {
      const yaml = validAlertYaml.replace('runbook_url: "docs/runbooks/high-error-rate"', '');
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('missing annotation: runbook_url'))).toBe(true);
    });

    it('detects runbook_url not pointing to docs/runbooks/', () => {
      const yaml = validAlertYaml.replace(
        'runbook_url: "docs/runbooks/high-error-rate"',
        'runbook_url: "https://example.com/runbook"',
      );
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('runbook_url should point to docs/runbooks/'))).toBe(true);
    });
  });

  describe('duplicate detection', () => {
    it('detects duplicate alert names', () => {
      const yaml = `
groups:
  - name: g1
    interval: 30s
    rules:
      - alert: SameName
        expr: http_requests_total > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "S"
          description: "D"
          runbook_url: "docs/runbooks/x"
      - alert: SameName
        expr: http_errors_total > 50
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "S2"
          description: "D2"
          runbook_url: "docs/runbooks/y"
`;
      const errors = validateAlertRules(yaml);
      expect(errors.some(e => e.message.includes('Duplicate alert name'))).toBe(true);
    });
  });

  describe('comments and whitespace handling', () => {
    it('ignores comment lines', () => {
      const yaml = `
# This is a comment
groups:
  # Another comment
  - name: test
    interval: 30s
    rules:
      - alert: TestAlert
        expr: http_requests_total > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "S"
          description: "D"
          runbook_url: "docs/runbooks/x"
`;
      const errors = validateAlertRules(yaml);
      expect(errors).toHaveLength(0);
    });

    it('handles CRLF line endings', () => {
      const yaml = validAlertYaml.replace(/\n/g, '\r\n');
      const errors = validateAlertRules(yaml);
      expect(errors).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// validateGrafanaDashboard
// ---------------------------------------------------------------------------

describe('validateGrafanaDashboard', () => {
  function makeValidDashboard(): string {
    return JSON.stringify({
      __inputs: [{ name: 'DS_PROMETHEUS', type: 'datasource', pluginId: 'prometheus' }],
      __requires: [{ type: 'grafana', id: 'grafana', name: 'Grafana', version: '10.0.0' }],
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
            title: 'Panel A',
            type: 'stat',
            gridPos: { h: 4, w: 12, x: 0, y: 0 },
            targets: [{ expr: 'metric_a', legendFormat: 'A', refId: 'A' }],
          },
          {
            id: 2,
            title: 'Panel B',
            type: 'timeseries',
            gridPos: { h: 4, w: 12, x: 12, y: 0 },
            targets: [{ expr: 'metric_b', legendFormat: 'B', refId: 'A' }],
          },
        ],
      },
      overwrite: true,
    });
  }

  describe('valid input', () => {
    it('returns no errors for well-formed dashboard', () => {
      const errors = validateGrafanaDashboard(makeValidDashboard());
      expect(errors).toHaveLength(0);
    });
  });

  describe('JSON parse errors', () => {
    it('returns error for invalid JSON', () => {
      const errors = validateGrafanaDashboard('{ invalid json }');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Invalid JSON');
    });
  });

  describe('structure errors', () => {
    it('detects missing dashboard wrapper', () => {
      const errors = validateGrafanaDashboard(JSON.stringify({ foo: 'bar' }));
      expect(errors.some(e => e.message.includes('"dashboard" wrapper'))).toBe(true);
    });

    it('detects missing uid', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.uid;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing uid'))).toBe(true);
    });

    it('detects missing title', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.title;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing title'))).toBe(true);
    });

    it('detects missing tags', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.tags = [];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('at least one tag'))).toBe(true);
    });

    it('detects missing timezone', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.timezone;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing timezone'))).toBe(true);
    });

    it('detects missing refresh', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.refresh;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing refresh'))).toBe(true);
    });

    it('detects unusual refresh value', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.refresh = '2s';
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Unusual refresh value'))).toBe(true);
    });

    it('detects missing time range', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.time;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('time range'))).toBe(true);
    });

    it('detects missing __inputs', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.__inputs = [];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing datasource inputs'))).toBe(true);
    });

    it('detects missing Prometheus datasource', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.__inputs = [{ name: 'DS', type: 'datasource', pluginId: 'mysql' }];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('No Prometheus datasource'))).toBe(true);
    });

    it('detects missing __requires', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.__requires = [];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing requirements'))).toBe(true);
    });

    it('detects missing Grafana in __requires', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.__requires = [{ type: 'panel', id: 'graph', name: 'Graph', version: '1.0' }];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('No Grafana version'))).toBe(true);
    });

    it('detects overwrite not set to true', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.overwrite = false;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('overwrite should be true'))).toBe(true);
    });
  });

  describe('panel validation', () => {
    it('detects empty panels array', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels = [];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('no panels'))).toBe(true);
    });

    it('detects duplicate panel ids', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[1].id = 1;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Duplicate panel id'))).toBe(true);
    });

    it('detects duplicate panel titles', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[1].title = 'Panel A';
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Duplicate panel title'))).toBe(true);
    });

    it('detects missing panel type', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.panels[0].type;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing type'))).toBe(true);
    });

    it('detects unknown panel type', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].type = 'unknown_type';
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Unknown panel type'))).toBe(true);
    });

    it('detects missing gridPos', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.panels[0].gridPos;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('missing gridPos'))).toBe(true);
    });

    it('detects panel width exceeding 24', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].gridPos.w = 25;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('out of range'))).toBe(true);
    });

    it('detects panel extending beyond grid', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].gridPos = { h: 4, w: 20, x: 10, y: 0 };
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('beyond 24-column grid'))).toBe(true);
    });

    it('detects panel height < 1', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].gridPos.h = 0;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('height must be >= 1'))).toBe(true);
    });

    it('detects panel with no targets', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].targets = [];
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('no targets'))).toBe(true);
    });

    it('detects target with missing expr', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.panels[0].targets[0].expr;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Target missing expr'))).toBe(true);
    });

    it('detects target with missing refId', () => {
      const dash = JSON.parse(makeValidDashboard());
      delete dash.dashboard.panels[0].targets[0].refId;
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('Target missing refId'))).toBe(true);
    });

    it('detects overlapping panels', () => {
      const dash = JSON.parse(makeValidDashboard());
      dash.dashboard.panels[0].gridPos = { h: 8, w: 12, x: 0, y: 0 };
      dash.dashboard.panels[1].gridPos = { h: 8, w: 12, x: 6, y: 0 };
      const errors = validateGrafanaDashboard(JSON.stringify(dash));
      expect(errors.some(e => e.message.includes('overlap in grid'))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateMonitoringConfigs
// ---------------------------------------------------------------------------

describe('validateMonitoringConfigs', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns errors when alert-rules.yml is not found', () => {
    const result = validateMonitoringConfigs('/nonexistent/path');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('File not found'))).toBe(true);
  });

  it('returns ValidationResult type with valid, errors, and warnings', () => {
    const result = validateMonitoringConfigs('/nonexistent');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('logs warning when alert-rules.yml read fails', () => {
    validateMonitoringConfigs('/nonexistent/path');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('alert-rules.yml read failed')
    );
  });

  it('logs warning when grafana-dashboard.json read fails', () => {
    validateMonitoringConfigs('/nonexistent/path');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('grafana-dashboard.json read failed')
    );
  });
});
