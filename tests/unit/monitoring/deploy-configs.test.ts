/**
 * Deployment Config Consistency Tests
 *
 * Validates that the static config files under deploy/monitoring/ are
 * structurally valid and contain the same alert names and metric references
 * as the programmatic generators.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAlertRuleNames, exportAlertRulesYaml } from '@/monitoring/alert-rules';

const DEPLOY_DIR = join(process.cwd(), 'deploy', 'monitoring');

describe('Deployment Config Files', () => {
  describe('alert-rules.yml', () => {
    const yamlContent = readFileSync(join(DEPLOY_DIR, 'alert-rules.yml'), 'utf-8');

    it('should be a non-empty file', () => {
      expect(yamlContent.length).toBeGreaterThan(500);
    });

    it('should start with header comment', () => {
      expect(yamlContent).toContain('# Speech-to-Visuals Prometheus Alerting Rules');
    });

    it('should contain all programmatic alert names', () => {
      const names = getAlertRuleNames();
      for (const name of names) {
        expect(yamlContent).toContain(`alert: ${name}`);
      }
    });

    it('should contain both critical and warning severity labels', () => {
      expect(yamlContent).toContain('severity: critical');
      expect(yamlContent).toContain('severity: warning');
    });

    it('should contain export queue metrics', () => {
      expect(yamlContent).toContain('export_queue_size');
      expect(yamlContent).toContain('export_queue_wait_time_ms');
    });

    it('should contain runbook URLs for all rules', () => {
      expect(yamlContent).toContain('runbook_url:');
      expect(yamlContent).toContain('docs/runbooks/');
    });

    it('should have 10 alert rule entries', () => {
      const alertCount = (yamlContent.match(/- alert: /g) || []).length;
      expect(alertCount).toBe(10);
    });
  });

  describe('grafana-dashboard.json', () => {
    const raw = readFileSync(join(DEPLOY_DIR, 'grafana-dashboard.json'), 'utf-8');
    const parsed = JSON.parse(raw);

    it('should be valid JSON with dashboard wrapper', () => {
      expect(parsed.dashboard).toBeDefined();
      expect(parsed.dashboard.title).toBe('Speech-to-Visuals Monitoring');
      expect(parsed.overwrite).toBe(true);
    });

    it('should have stable UID for import tracking', () => {
      expect(parsed.dashboard.uid).toBe('s2v-monitoring');
    });

    it('should contain export queue panels', () => {
      const titles = parsed.dashboard.panels.map((p: { title: string }) => p.title);
      expect(titles).toContain('Export Queue Size');
      expect(titles).toContain('Export Queue Wait Time');
      expect(titles).toContain('Export Queue Dequeue Rate by Priority');
    });

    it('should reference export_queue metrics in panel targets', () => {
      const exprs = parsed.dashboard.panels
        .flatMap((p: { targets: Array<{ expr: string }> }) => p.targets)
        .map((t: { expr: string }) => t.expr);
      const allExprs = exprs.join(' ');
      expect(allExprs).toContain('export_queue_size');
      expect(allExprs).toContain('export_queue_wait_time_ms');
      expect(allExprs).toContain('export_queue_dequeue_total');
    });

    it('should have Prometheus datasource input', () => {
      expect(parsed.__inputs).toBeDefined();
      expect(parsed.__inputs[0].pluginId).toBe('prometheus');
    });

    it('should have at least 11 panels', () => {
      expect(parsed.dashboard.panels.length).toBeGreaterThanOrEqual(11);
    });

    it('should use 100 as red threshold for export queue size panel', () => {
      const queuePanel = parsed.dashboard.panels.find(
        (p: { title: string }) => p.title === 'Export Queue Size',
      );
      const steps = queuePanel.fieldConfig.defaults.thresholds.steps;
      const redStep = steps.find((s: { color: string }) => s.color === 'red');
      expect(redStep.value).toBe(100);
    });
  });

  describe('Config-source consistency', () => {
    it('static YAML should contain same alert count as generator', () => {
      const yamlContent = readFileSync(join(DEPLOY_DIR, 'alert-rules.yml'), 'utf-8');
      const staticCount = (yamlContent.match(/- alert: /g) || []).length;
      const generatedYaml = exportAlertRulesYaml();
      const generatedCount = (generatedYaml.match(/- alert: /g) || []).length;
      expect(staticCount).toBe(generatedCount);
    });
  });
});
