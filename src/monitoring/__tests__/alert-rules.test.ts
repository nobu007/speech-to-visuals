/**
 * Tests for alert-rules.ts (REQ-209)
 *
 * Verifies Prometheus alert rule generation including:
 * - All 10 alert rules are generated
 * - Custom thresholds are respected
 * - Metric prefix is applied correctly
 * - YAML export format is valid
 * - Each rule has required fields (alert, expr, for, severity, summary, description)
 */
import { describe, it, expect } from '@jest/globals';
import {
  generateAlertRules,
  exportAlertRulesYaml,
  getAlertRuleNames,
  SYSTEM_CONSTITUTION_LIMITS,
  type AlertRulesOptions,
} from '../alert-rules';

describe('alert-rules', () => {
  describe('generateAlertRules', () => {
    it('should generate rules with a single group', () => {
      const config = generateAlertRules();
      expect(config.groups).toHaveLength(1);
      expect(config.groups[0].name).toBe('speech-to-visuals-alerts');
      expect(config.groups[0].interval).toBe('30s');
    });

    it('should generate exactly 10 alert rules', () => {
      const config = generateAlertRules();
      expect(config.groups[0].rules).toHaveLength(10);
    });

    it('should generate all expected alert names', () => {
      const names = getAlertRuleNames();
      expect(names).toEqual([
        'SpeechToVisualsHighErrorRate',
        'SpeechToVisualsHighLatencyP95',
        'SpeechToVisualsHealthCheckFailures',
        'SpeechToVisualsLLMBudgetOverage',
        'SpeechToVisualsExportQueueBacklog',
        'SpeechToVisualsExportQueueSlowWait',
        'SpeechToVisualsExportQueueCriticalBacklog',
        'SpeechToVisualsExportDeadLetterQueueGrowth',
        'SpeechToVisualsExportHighRetryRate',
        'SpeechToVisualsExportDLQReplayRate',
      ]);
    });

    it('every rule should have required fields', () => {
      const config = generateAlertRules();
      for (const rule of config.groups[0].rules) {
        expect(rule.alert).toBeTruthy();
        expect(rule.expr).toBeTruthy();
        expect(rule.for).toBeTruthy();
        expect(rule.severity).toBeTruthy();
        expect(rule.summary).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(rule.runbookUrl).toBeTruthy();
      }
    });

    it('every rule should have valid severity', () => {
      const config = generateAlertRules();
      const validSeverities = ['critical', 'warning', 'info'];
      for (const rule of config.groups[0].rules) {
        expect(validSeverities).toContain(rule.severity);
      }
    });

    it('every rule should have a unique alert name', () => {
      const config = generateAlertRules();
      const names = config.groups[0].rules.map(r => r.alert);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('every rule should have a runbookUrl', () => {
      const config = generateAlertRules();
      for (const rule of config.groups[0].rules) {
        expect(rule.runbookUrl).toMatch(/^docs\/runbooks\//);
      }
    });
  });

  // --- Individual rule content tests ---

  describe('HighErrorRate rule', () => {
    it('should use default 5% threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[0];
      expect(rule.alert).toBe('SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('0.05');
      expect(rule.severity).toBe('critical');
      expect(rule.for).toBe('2m');
    });

    it('should respect custom error rate threshold', () => {
      const config = generateAlertRules({ errorRateThreshold: 0.1 });
      const rule = config.groups[0].rules[0];
      expect(rule.expr).toContain('0.1');
    });

    it('should format threshold as percentage in description', () => {
      const config = generateAlertRules({ errorRateThreshold: 0.15 });
      const rule = config.groups[0].rules[0];
      expect(rule.description).toContain('15.0%');
    });
  });

  describe('HighLatencyP95 rule', () => {
    it('should use default 20s threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[1];
      expect(rule.alert).toBe('SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('20000');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });

    it('should respect custom latency threshold', () => {
      const config = generateAlertRules({ latencyP95ThresholdMs: 30000 });
      const rule = config.groups[0].rules[1];
      expect(rule.expr).toContain('30000');
      expect(rule.description).toContain('30s');
    });
  });

  describe('HealthCheckFailures rule', () => {
    it('should use default threshold of 3', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[2];
      expect(rule.alert).toBe('SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('3');
      expect(rule.severity).toBe('critical');
      expect(rule.expr).toMatch(/\/health/);
    });

    it('should respect custom health check failure threshold', () => {
      const config = generateAlertRules({ healthCheckFailureThreshold: 5 });
      const rule = config.groups[0].rules[2];
      expect(rule.expr).toContain('>= 5');
    });
  });

  describe('LLMBudgetOverage rule', () => {
    it('should be a warning severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[3];
      expect(rule.alert).toBe('SpeechToVisualsLLMBudgetOverage');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('10m');
    });
  });

  describe('ExportQueueBacklog rule', () => {
    it('should use default threshold of 50', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[4];
      expect(rule.alert).toBe('SpeechToVisualsExportQueueBacklog');
      expect(rule.expr).toContain('> 50');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('3m');
    });

    it('should respect custom queue size threshold', () => {
      const config = generateAlertRules({ exportQueueSizeThreshold: 75 });
      const rule = config.groups[0].rules[4];
      expect(rule.expr).toContain('> 75');
    });
  });

  describe('ExportQueueSlowWait rule', () => {
    it('should use default 10s threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[5];
      expect(rule.alert).toBe('SpeechToVisualsExportQueueSlowWait');
      expect(rule.expr).toContain('10000');
      expect(rule.severity).toBe('warning');
    });

    it('should respect custom wait time threshold', () => {
      const config = generateAlertRules({ exportQueueWaitTimeThresholdMs: 20000 });
      const rule = config.groups[0].rules[5];
      expect(rule.expr).toContain('> 20000');
      expect(rule.description).toContain('20s');
    });
  });

  describe('ExportQueueCriticalBacklog rule', () => {
    it('should use default threshold of 100', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[6];
      expect(rule.alert).toBe('SpeechToVisualsExportQueueCriticalBacklog');
      expect(rule.expr).toContain('> 100');
      expect(rule.severity).toBe('critical');
      expect(rule.for).toBe('1m');
    });

    it('should respect custom critical queue threshold', () => {
      const config = generateAlertRules({ exportQueueCriticalSizeThreshold: 150 });
      const rule = config.groups[0].rules[6];
      expect(rule.expr).toContain('> 150');
    });
  });

  describe('ExportDeadLetterQueueGrowth rule', () => {
    it('should fire when DLQ has any jobs', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[7];
      expect(rule.alert).toBe('SpeechToVisualsExportDeadLetterQueueGrowth');
      expect(rule.expr).toContain('> 0');
      expect(rule.severity).toBe('warning');
    });
  });

  describe('ExportHighRetryRate rule', () => {
    it('should use 0.5/s threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[8];
      expect(rule.alert).toBe('SpeechToVisualsExportHighRetryRate');
      expect(rule.expr).toContain('> 0.5');
      expect(rule.severity).toBe('warning');
    });
  });

  describe('ExportDLQReplayRate rule', () => {
    it('should use 0.1/s threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[9];
      expect(rule.alert).toBe('SpeechToVisualsExportDLQReplayRate');
      expect(rule.expr).toContain('> 0.1');
      expect(rule.severity).toBe('warning');
    });
  });

  // --- Metric prefix tests ---

  describe('metricPrefix option', () => {
    it('should apply no prefix by default', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules[0];
      expect(rule.expr).not.toContain('customprefix_');
    });

    it('should apply custom metric prefix with underscore separator', () => {
      const config = generateAlertRules({ metricPrefix: 'stv' });
      const rule = config.groups[0].rules[0];
      expect(rule.expr).toContain('stv_http_errors_total');
    });

    it('should apply prefix to all rules consistently', () => {
      const config = generateAlertRules({ metricPrefix: 'app' });
      for (const rule of config.groups[0].rules) {
        // Every expr should reference the prefix
        expect(rule.expr).toContain('app_');
      }
    });

    it('should handle empty string prefix (no prefix)', () => {
      const config = generateAlertRules({ metricPrefix: '' });
      const rule = config.groups[0].rules[0];
      expect(rule.expr).toContain('http_errors_total');
      expect(rule.expr).not.toMatch(/^app_/);
    });
  });

  // --- Combined options test ---

  describe('combined options', () => {
    it('should apply all custom options simultaneously', () => {
      const opts: AlertRulesOptions = {
        metricPrefix: 'stv',
        errorRateThreshold: 0.1,
        latencyP95ThresholdMs: 30000,
        healthCheckFailureThreshold: 5,
        exportQueueSizeThreshold: 75,
        exportQueueCriticalSizeThreshold: 150,
        exportQueueWaitTimeThresholdMs: 15000,
      };
      const config = generateAlertRules(opts);
      const rules = config.groups[0].rules;

      expect(rules[0].expr).toContain('stv_');
      expect(rules[0].expr).toContain('0.1');

      expect(rules[1].expr).toContain('stv_');
      expect(rules[1].expr).toContain('30000');

      expect(rules[2].expr).toContain('stv_');
      expect(rules[2].expr).toContain('>= 5');

      expect(rules[4].expr).toContain('stv_');
      expect(rules[4].expr).toContain('> 75');

      expect(rules[5].expr).toContain('stv_');
      expect(rules[5].expr).toContain('15000');

      expect(rules[6].expr).toContain('stv_');
      expect(rules[6].expr).toContain('> 150');
    });
  });

  // --- YAML export tests ---

  describe('exportAlertRulesYaml', () => {
    it('should produce valid YAML with header comment', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('# Speech-to-Visuals Prometheus Alerting Rules');
      expect(yaml).toContain('# Generated by alert-rules.ts (REQ-209)');
    });

    it('should include groups section', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('groups:');
      expect(yaml).toContain('name: speech-to-visuals-alerts');
      expect(yaml).toContain('interval: 30s');
    });

    it('should include all 10 rules', () => {
      const yaml = exportAlertRulesYaml();
      const alertCount = (yaml.match(/- alert:/g) || []).length;
      expect(alertCount).toBe(10);
    });

    it('should include expr, for, severity for each rule', () => {
      const yaml = exportAlertRulesYaml();
      const exprCount = (yaml.match(/expr:/g) || []).length;
      const forCount = (yaml.match(/\s+for:/g) || []).length;
      const severityCount = (yaml.match(/severity:/g) || []).length;

      expect(exprCount).toBe(10);
      expect(forCount).toBe(10);
      expect(severityCount).toBe(10);
    });

    it('should include summary and description annotations', () => {
      const yaml = exportAlertRulesYaml();
      const summaryCount = (yaml.match(/summary:/g) || []).length;
      const descCount = (yaml.match(/description:/g) || []).length;

      expect(summaryCount).toBe(10);
      expect(descCount).toBe(10);
    });

    it('should include runbook_url for each rule', () => {
      const yaml = exportAlertRulesYaml();
      const runbookCount = (yaml.match(/runbook_url:/g) || []).length;
      expect(runbookCount).toBe(10);
    });

    it('should end with newline', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml.endsWith('\n')).toBe(true);
    });

    it('should apply custom options to YAML output', () => {
      const yaml = exportAlertRulesYaml({ metricPrefix: 'test', errorRateThreshold: 0.2 });
      expect(yaml).toContain('test_http_errors_total');
      expect(yaml).toContain('0.2');
    });
  });

  // --- getAlertRuleNames ---

  describe('getAlertRuleNames', () => {
    it('should return 10 unique names', () => {
      const names = getAlertRuleNames();
      expect(names).toHaveLength(10);
      expect(new Set(names).size).toBe(10);
    });

    it('should return names matching the rules in generateAlertRules', () => {
      const names = getAlertRuleNames();
      const config = generateAlertRules();
      const ruleNames = config.groups[0].rules.map(r => r.alert);
      expect(names).toEqual(ruleNames);
    });
  });

  // --- Severity distribution ---

  describe('severity distribution', () => {
    it('should have 3 critical alerts', () => {
      const config = generateAlertRules();
      const criticalRules = config.groups[0].rules.filter(r => r.severity === 'critical');
      expect(criticalRules).toHaveLength(3);
    });

    it('should have 7 warning alerts', () => {
      const config = generateAlertRules();
      const warningRules = config.groups[0].rules.filter(r => r.severity === 'warning');
      expect(warningRules).toHaveLength(7);
    });
  });
});
