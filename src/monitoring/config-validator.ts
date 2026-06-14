/**
 * Monitoring Config Validator
 *
 * Validates alert-rules.yml and grafana-dashboard.json before deploy
 * to prevent shipping broken monitoring configs.
 *
 * Used by:
 *   - scripts/validate-monitoring-configs.ts (CI CLI)
 *   - tests/unit/monitoring/config-validator.test.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  file: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Alert Rules Validation
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = ['critical', 'warning', 'info'];
const REQUIRED_ALERT_FIELDS = ['alert', 'expr', 'for'] as const;
const REQUIRED_ANNOTATION_FIELDS = ['summary', 'description', 'runbook_url'];

/**
 * Minimal YAML parser for Prometheus alert rules.
 * We intentionally avoid a yaml dependency so the validator can run in
 * CI without installing extra npm packages.
 */
/** Strip surrounding double or single quotes from a YAML value. */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

interface ParsedAlertRule {
  alert: string;
  expr: string;
  for: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

function parseAlertRulesYaml(content: string): { groups: Array<{ name: string; interval: string; rules: ParsedAlertRule[] }> } {
  const lines = content.split('\n');
  const groups: Array<{ name: string; interval: string; rules: ParsedAlertRule[] }> = [];

  let currentGroup: { name: string; interval: string; rules: ParsedAlertRule[] } | null = null;
  let currentRule: Partial<ParsedAlertRule> & { labels: Record<string, string>; annotations: Record<string, string> } | null = null;
  let inLabels = false;
  let inAnnotations = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    // Skip comments and blank lines
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Top-level: groups:
    if (line === 'groups:') continue;

    // Group start: "  - name: ..."
    const groupMatch = line.match(/^  - name:\s*(.+)$/);
    if (groupMatch) {
      currentGroup = { name: groupMatch[1].trim(), interval: '30s', rules: [] };
      groups.push(currentGroup);
      currentRule = null;
      inLabels = false;
      inAnnotations = false;
      continue;
    }

    // interval
    const intervalMatch = line.match(/^    interval:\s*(.+)$/);
    if (intervalMatch && currentGroup) {
      currentGroup.interval = intervalMatch[1].trim();
      continue;
    }

    // rules:
    if (line === '    rules:') continue;

    // Rule start: "      - alert: ..."
    const ruleMatch = line.match(/^      - alert:\s*(.+)$/);
    if (ruleMatch && currentGroup) {
      if (currentRule) {
        currentGroup.rules.push(currentRule as ParsedAlertRule);
      }
      const alertName = stripQuotes(ruleMatch[1].trim());
      currentRule = {
        alert: alertName,
        labels: {},
        annotations: {},
      };
      inLabels = false;
      inAnnotations = false;
      continue;
    }

    // expr
    const exprMatch = line.match(/^        expr:\s*(.+)$/);
    if (exprMatch && currentRule) {
      currentRule.expr = stripQuotes(exprMatch[1].trim());
      continue;
    }

    // for
    const forMatch = line.match(/^        for:\s*(.+)$/);
    if (forMatch && currentRule) {
      currentRule.for = stripQuotes(forMatch[1].trim());
      continue;
    }

    // labels:
    if (line === '        labels:') {
      inLabels = true;
      inAnnotations = false;
      continue;
    }

    // annotations:
    if (line === '        annotations:') {
      inAnnotations = true;
      inLabels = false;
      continue;
    }

    // Label or annotation key-value
    const kvMatch = line.match(/^          (\w+):\s*"?(.*?)"?\s*$/);
    if (kvMatch && currentRule) {
      const [, key, value] = kvMatch;
      if (inLabels) {
        currentRule.labels[key] = value;
      } else if (inAnnotations) {
        currentRule.annotations[key] = value;
      }
    }
  }

  // Push last rule
  if (currentRule && currentGroup) {
    currentGroup.rules.push(currentRule as ParsedAlertRule);
  }

  return { groups };
}

export function validateAlertRules(yamlContent: string): ValidationError[] {
  const errors: ValidationError[] = [];

  let parsed: { groups: Array<{ name: string; interval: string; rules: ParsedAlertRule[] }> };

  try {
    parsed = parseAlertRulesYaml(yamlContent);
  } catch {
    errors.push({ file: 'alert-rules.yml', message: 'Failed to parse YAML structure' });
    return errors;
  }

  if (parsed.groups.length === 0) {
    errors.push({ file: 'alert-rules.yml', message: 'No alert groups defined' });
    return errors;
  }

  const alertNames = new Set<string>();

  for (const group of parsed.groups) {
    if (!group.name) {
      errors.push({ file: 'alert-rules.yml', message: 'Group missing name' });
    }

    if (!group.interval) {
      errors.push({ file: 'alert-rules.yml', field: `group.${group.name}.interval`, message: 'Group missing interval' });
    }

    if (group.rules.length === 0) {
      errors.push({ file: 'alert-rules.yml', field: `group.${group.name}`, message: 'Group has no rules' });
    }

    for (const rule of group.rules) {
      // Check required fields
      for (const field of REQUIRED_ALERT_FIELDS) {
        if (!rule[field]) {
          errors.push({ file: 'alert-rules.yml', field: `rule.${rule.alert || 'unknown'}.${field}`, message: `Rule missing required field: ${field}` });
        }
      }

      // Check alert name uniqueness
      if (rule.alert) {
        if (alertNames.has(rule.alert)) {
          errors.push({ file: 'alert-rules.yml', field: `rule.${rule.alert}`, message: 'Duplicate alert name' });
        }
        alertNames.add(rule.alert);
      }

      // Validate severity
      const severity = rule.labels?.severity;
      if (severity && !VALID_SEVERITIES.includes(severity)) {
        errors.push({
          file: 'alert-rules.yml',
          field: `rule.${rule.alert}.labels.severity`,
          message: `Invalid severity "${severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`,
        });
      }

      if (!severity) {
        errors.push({
          file: 'alert-rules.yml',
          field: `rule.${rule.alert}.labels.severity`,
          message: 'Rule missing severity label',
        });
      }

      // Validate 'for' duration format
      if (rule.for && !/^\d+[smh]$/.test(rule.for)) {
        errors.push({
          file: 'alert-rules.yml',
          field: `rule.${rule.alert}.for`,
          message: `Invalid duration format "${rule.for}". Must match pattern like "5m", "1h", "30s"`,
        });
      }

      // Validate expr is non-empty and looks like PromQL
      if (rule.expr && rule.expr.length < 5) {
        errors.push({
          file: 'alert-rules.yml',
          field: `rule.${rule.alert}.expr`,
          message: 'Expression too short to be valid PromQL',
        });
      }

      // Check required annotations
      for (const annField of REQUIRED_ANNOTATION_FIELDS) {
        if (!rule.annotations?.[annField]) {
          errors.push({
            file: 'alert-rules.yml',
            field: `rule.${rule.alert}.annotations.${annField}`,
            message: `Rule missing annotation: ${annField}`,
          });
        }
      }

      // Validate runbook_url points to docs/runbooks/
      if (rule.annotations?.runbook_url && !rule.annotations.runbook_url.includes('docs/runbooks/')) {
        errors.push({
          file: 'alert-rules.yml',
          field: `rule.${rule.alert}.annotations.runbook_url`,
          message: `runbook_url should point to docs/runbooks/. Got: ${rule.annotations.runbook_url}`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Grafana Dashboard Validation
// ---------------------------------------------------------------------------

interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  gridPos: { h: number; w: number; x: number; y: number };
  datasource?: { type: string; uid: string };
  targets: Array<{ expr: string; legendFormat?: string; refId: string }>;
  fieldConfig?: { defaults?: Record<string, unknown>; overrides?: unknown[] };
}

interface GrafanaDashboard {
  __inputs?: Array<{ name: string; type: string; pluginId: string }>;
  __requires?: Array<{ type: string; id: string; name: string; version: string }>;
  dashboard: {
    uid: string;
    title: string;
    tags: string[];
    timezone: string;
    refresh: string;
    time: { from: string; to: string };
    templating?: { list: Array<Record<string, unknown>> };
    panels: GrafanaPanel[];
  };
  overwrite: boolean;
}

const VALID_PANEL_TYPES = ['stat', 'timeseries', 'table', 'gauge', ' bargauge', 'graph', 'singlestat', 'heatmap', 'barchart', 'piechart'];
const VALID_REFRESH_VALUES = ['5s', '10s', '15s', '30s', '1m', '5m', '15m', '1h'];

export function validateGrafanaDashboard(jsonContent: string): ValidationError[] {
  const errors: ValidationError[] = [];

  let dashboard: GrafanaDashboard;

  try {
    dashboard = JSON.parse(jsonContent);
  } catch (e) {
    errors.push({ file: 'grafana-dashboard.json', message: `Invalid JSON: ${(e as Error).message}` });
    return errors;
  }

  // Check top-level structure
  if (!dashboard.dashboard) {
    errors.push({ file: 'grafana-dashboard.json', message: 'Missing "dashboard" wrapper object' });
    return errors;
  }

  const db = dashboard.dashboard;

  // Required metadata fields
  if (!db.uid) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.uid', message: 'Dashboard missing uid' });
  }
  if (!db.title) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.title', message: 'Dashboard missing title' });
  }
  if (!db.tags || !Array.isArray(db.tags) || db.tags.length === 0) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.tags', message: 'Dashboard should have at least one tag' });
  }
  if (!db.timezone) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.timezone', message: 'Dashboard missing timezone' });
  }
  if (!db.refresh) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.refresh', message: 'Dashboard missing refresh interval' });
  } else if (!VALID_REFRESH_VALUES.includes(db.refresh)) {
    errors.push({
      file: 'grafana-dashboard.json',
      field: 'dashboard.refresh',
      message: `Unusual refresh value "${db.refresh}". Expected one of: ${VALID_REFRESH_VALUES.join(', ')}`,
    });
  }
  if (!db.time || !db.time.from || !db.time.to) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.time', message: 'Dashboard missing time range (from/to)' });
  }

  // Check __inputs
  if (!dashboard.__inputs || dashboard.__inputs.length === 0) {
    errors.push({ file: 'grafana-dashboard.json', field: '__inputs', message: 'Dashboard missing datasource inputs' });
  } else {
    const hasPrometheus = dashboard.__inputs.some(i => i.pluginId === 'prometheus');
    if (!hasPrometheus) {
      errors.push({ file: 'grafana-dashboard.json', field: '__inputs', message: 'No Prometheus datasource input found' });
    }
  }

  // Check __requires
  if (!dashboard.__requires || dashboard.__requires.length === 0) {
    errors.push({ file: 'grafana-dashboard.json', field: '__requires', message: 'Dashboard missing requirements metadata' });
  } else {
    const hasGrafana = dashboard.__requires.some(r => r.id === 'grafana');
    if (!hasGrafana) {
      errors.push({ file: 'grafana-dashboard.json', field: '__requires', message: 'No Grafana version requirement found' });
    }
  }

  // Check overwrite flag
  if (dashboard.overwrite !== true) {
    errors.push({ file: 'grafana-dashboard.json', field: 'overwrite', message: 'overwrite should be true for import' });
  }

  // Check panels
  if (!db.panels || !Array.isArray(db.panels) || db.panels.length === 0) {
    errors.push({ file: 'grafana-dashboard.json', field: 'dashboard.panels', message: 'Dashboard has no panels' });
    return errors;
  }

  const panelIds = new Set<number>();
  const panelTitles = new Set<string>();

  for (const panel of db.panels) {
    const panelRef = `panel.${panel.id || 'unknown'}`;

    // Check required panel fields
    if (panel.id === undefined || panel.id === null) {
      errors.push({ file: 'grafana-dashboard.json', field: panelRef, message: 'Panel missing id' });
    } else if (panelIds.has(panel.id)) {
      errors.push({ file: 'grafana-dashboard.json', field: panelRef, message: `Duplicate panel id: ${panel.id}` });
    }
    if (panel.id !== undefined) panelIds.add(panel.id);

    if (!panel.title) {
      errors.push({ file: 'grafana-dashboard.json', field: panelRef, message: 'Panel missing title' });
    } else if (panelTitles.has(panel.title)) {
      errors.push({ file: 'grafana-dashboard.json', field: panelRef, message: `Duplicate panel title: ${panel.title}` });
    }
    if (panel.title) panelTitles.add(panel.title);

    if (!panel.type) {
      errors.push({ file: 'grafana-dashboard.json', field: panelRef, message: 'Panel missing type' });
    } else if (!VALID_PANEL_TYPES.includes(panel.type)) {
      errors.push({
        file: 'grafana-dashboard.json',
        field: `${panelRef}.type`,
        message: `Unknown panel type "${panel.type}"`,
      });
    }

    // Check gridPos
    if (!panel.gridPos) {
      errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.gridPos`, message: 'Panel missing gridPos' });
    } else {
      const { h, w, x, y } = panel.gridPos;
      if (h === undefined || w === undefined || x === undefined || y === undefined) {
        errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.gridPos`, message: 'gridPos missing required keys (h, w, x, y)' });
      }
      if (w !== undefined && (w < 1 || w > 24)) {
        errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.gridPos.w`, message: `Panel width ${w} out of range (1-24)` });
      }
      if (x !== undefined && w !== undefined && x + w > 24) {
        errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.gridPos`, message: `Panel extends beyond 24-column grid (x=${x} + w=${w})` });
      }
      if (h !== undefined && h < 1) {
        errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.gridPos.h`, message: `Panel height must be >= 1, got ${h}` });
      }
    }

    // Check targets
    if (!panel.targets || !Array.isArray(panel.targets) || panel.targets.length === 0) {
      errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.targets`, message: 'Panel has no targets' });
    } else {
      for (const target of panel.targets) {
        if (!target.expr) {
          errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.targets`, message: 'Target missing expr' });
        }
        if (!target.refId) {
          errors.push({ file: 'grafana-dashboard.json', field: `${panelRef}.targets`, message: 'Target missing refId' });
        }
      }
    }
  }

  // Check for overlapping panels
  for (let i = 0; i < db.panels.length; i++) {
    for (let j = i + 1; j < db.panels.length; j++) {
      const a = db.panels[i].gridPos;
      const b = db.panels[j].gridPos;
      if (!a || !b) continue;

      const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlapsX && overlapsY) {
        errors.push({
          file: 'grafana-dashboard.json',
          field: 'dashboard.panels',
          message: `Panels ${db.panels[i].id} and ${db.panels[j].id} overlap in grid`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Combined Validation
// ---------------------------------------------------------------------------

export function validateMonitoringConfigs(deployDir: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate alert-rules.yml
  const alertRulesPath = join(deployDir, 'alert-rules.yml');
  try {
    const yamlContent = readFileSync(alertRulesPath, 'utf-8');
    errors.push(...validateAlertRules(yamlContent));
  } catch {
    errors.push({ file: 'alert-rules.yml', message: `File not found: ${alertRulesPath}` });
  }

  // Validate grafana-dashboard.json
  const dashboardPath = join(deployDir, 'grafana-dashboard.json');
  try {
    const jsonContent = readFileSync(dashboardPath, 'utf-8');
    errors.push(...validateGrafanaDashboard(jsonContent));
  } catch {
    errors.push({ file: 'grafana-dashboard.json', message: `File not found: ${dashboardPath}` });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
