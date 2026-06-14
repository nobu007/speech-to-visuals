/**
 * REQ-209: Prometheus Alert Rules Tests
 *
 * Validates alert rule definitions, threshold values,
 * YAML export format, and severity levels.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateAlertRules,
  exportAlertRulesYaml,
  getAlertRuleNames,
  type AlertingConfig,
  type AlertRule,
} from '@/monitoring/alert-rules';

describe('Alert Rules (REQ-209)', () => {
  describe('generateAlertRules', () => {
    it('should generate exactly one rule group', () => {
      const config = generateAlertRules();
      expect(config.groups).toHaveLength(1);
      expect(config.groups[0].name).toBe('speech-to-visuals-alerts');
    });

    it('should generate exactly 10 alert rules', () => {
      const config = generateAlertRules();
      expect(config.groups[0].rules).toHaveLength(10);
    });

    it('should include all required alert names', () => {
      const names = getAlertRuleNames();
      expect(names).toContain('SpeechToVisualsHighErrorRate');
      expect(names).toContain('SpeechToVisualsHighLatencyP95');
      expect(names).toContain('SpeechToVisualsHealthCheckFailures');
      expect(names).toContain('SpeechToVisualsLLMBudgetOverage');
      expect(names).toContain('SpeechToVisualsExportQueueBacklog');
      expect(names).toContain('SpeechToVisualsExportQueueSlowWait');
      expect(names).toContain('SpeechToVisualsExportQueueCriticalBacklog');
      expect(names).toContain('SpeechToVisualsExportDeadLetterQueueGrowth');
      expect(names).toContain('SpeechToVisualsExportHighRetryRate');
      expect(names).toContain('SpeechToVisualsExportDLQReplayRate');
    });

    it('should have unique alert names', () => {
      const names = getAlertRuleNames();
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('HighErrorRate alert', () => {
    it('should use 5% error rate threshold by default', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighErrorRate',
      );
      expect(rule).toBeDefined();
      expect(rule!.expr).toContain('> 0.05');
      expect(rule!.severity).toBe('critical');
      expect(rule!.for).toBe('2m');
    });

    it('should reference error and request metrics', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighErrorRate',
      );
      expect(rule!.expr).toContain('http_errors_total');
      expect(rule!.expr).toContain('http_requests_total');
      expect(rule!.expr).toContain('rate(');
    });

    it('should respect custom error rate threshold', () => {
      const config = generateAlertRules({ errorRateThreshold: 0.1 });
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighErrorRate',
      );
      expect(rule!.expr).toContain('> 0.1');
    });
  });

  describe('HighLatencyP95 alert', () => {
    it('should use 20s (20000ms) threshold by default', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighLatencyP95',
      );
      expect(rule).toBeDefined();
      expect(rule!.expr).toContain('> 20000');
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('5m');
    });

    it('should reference P95 quantile', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighLatencyP95',
      );
      expect(rule!.expr).toContain('quantile="0.95"');
      expect(rule!.expr).toContain('http_request_duration_ms');
    });

    it('should respect custom latency threshold', () => {
      const config = generateAlertRules({ latencyP95ThresholdMs: 30000 });
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighLatencyP95',
      );
      expect(rule!.expr).toContain('> 30000');
    });
  });

  describe('HealthCheckFailures alert', () => {
    it('should use critical severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHealthCheckFailures',
      );
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('critical');
    });

    it('should reference health check paths', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHealthCheckFailures',
      );
      expect(rule!.expr).toContain('/health');
      expect(rule!.expr).toContain('http_errors_total');
    });

    it('should have minimum hold duration', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHealthCheckFailures',
      );
      expect(rule!.for).toBe('1m');
    });
  });

  describe('LLMBudgetOverage alert', () => {
    it('should use warning severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsLLMBudgetOverage',
      );
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('warning');
    });

    it('should reference monitoring API in description', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsLLMBudgetOverage',
      );
      expect(rule!.description).toContain('/api/v1/monitoring/cost');
    });
  });

  describe('ExportQueueBacklog alert', () => {
    it('should use warning severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueBacklog',
      );
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('3m');
    });

    it('should use 50 as default queue size threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueBacklog',
      );
      expect(rule!.expr).toContain('export_queue_size');
      expect(rule!.expr).toContain('> 50');
    });

    it('should reference export API in description', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueBacklog',
      );
      expect(rule!.description).toContain('/api/v1/export/jobs');
    });

    it('should respect custom queue size threshold', () => {
      const config = generateAlertRules({ exportQueueSizeThreshold: 75 });
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueBacklog',
      );
      expect(rule!.expr).toContain('> 75');
    });
  });

  describe('ExportQueueSlowWait alert', () => {
    it('should use warning severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueSlowWait',
      );
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('5m');
    });

    it('should use 10000ms as default wait time threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueSlowWait',
      );
      expect(rule!.expr).toContain('export_queue_wait_time_ms');
      expect(rule!.expr).toContain('> 10000');
    });

    it('should respect custom wait time threshold', () => {
      const config = generateAlertRules({ exportQueueWaitTimeThresholdMs: 30000 });
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueSlowWait',
      );
      expect(rule!.expr).toContain('> 30000');
    });
  });

  describe('ExportQueueCriticalBacklog alert', () => {
    it('should use critical severity', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('critical');
      expect(rule!.for).toBe('1m');
    });

    it('should use 100 as default critical queue size threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule!.expr).toContain('export_queue_size');
      expect(rule!.expr).toContain('> 100');
    });

    it('should have shorter hold than warning backlog alert', () => {
      const config = generateAlertRules();
      const criticalRule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      const warningRule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueBacklog',
      );
      expect(criticalRule!.for).toBe('1m');
      expect(warningRule!.for).toBe('3m');
    });

    it('should reference export API in description', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule!.description).toContain('/api/v1/export/jobs');
    });

    it('should respect custom critical queue size threshold', () => {
      const config = generateAlertRules({ exportQueueCriticalSizeThreshold: 150 });
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule!.expr).toContain('> 150');
    });

    it('should reference the backlog runbook', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule!.runbookUrl).toBe('docs/runbooks/export-queue-backlog.md');
    });
  });

  describe('ExportDeadLetterQueueGrowth alert', () => {
    it('should use dlq_size > 0 as threshold', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportDeadLetterQueueGrowth',
      );
      expect(rule).toBeDefined();
      expect(rule!.expr).toContain('export_queue_dlq_size > 0');
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('5m');
    });

    it('should reference DLQ API endpoint in description', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportDeadLetterQueueGrowth',
      );
      expect(rule!.description).toContain('/api/v1/export/jobs/dead-letter');
    });
  });

  describe('ExportHighRetryRate alert', () => {
    it('should use rate-based expression on retry_total', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportHighRetryRate',
      );
      expect(rule).toBeDefined();
      expect(rule!.expr).toContain('rate(');
      expect(rule!.expr).toContain('export_queue_retry_total');
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('5m');
    });
  });

  describe('ExportDLQReplayRate alert', () => {
    it('should use rate-based expression on dlq_replay_total', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportDLQReplayRate',
      );
      expect(rule).toBeDefined();
      expect(rule!.expr).toContain('rate(');
      expect(rule!.expr).toContain('export_queue_dlq_replay_total');
      expect(rule!.expr).toContain('> 0.1');
      expect(rule!.severity).toBe('warning');
      expect(rule!.for).toBe('5m');
    });

    it('should reference DLQ API endpoint in description', () => {
      const config = generateAlertRules();
      const rule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsExportDLQReplayRate',
      );
      expect(rule!.description).toContain('/api/v1/export/jobs/dead-letter');
    });
  });

  describe('Severity distribution', () => {
    it('should have exactly 3 critical and 7 warning alerts', () => {
      const config = generateAlertRules();
      const rules = config.groups[0].rules;
      const critical = rules.filter(r => r.severity === 'critical');
      const warning = rules.filter(r => r.severity === 'warning');
      expect(critical).toHaveLength(3);
      expect(warning).toHaveLength(7);
    });
  });

  describe('Alert rule structure', () => {
    it('should have all required fields for every rule', () => {
      const config = generateAlertRules();
      for (const rule of config.groups[0].rules) {
        expect(rule.alert).toBeTruthy();
        expect(rule.expr).toBeTruthy();
        expect(rule.for).toMatch(/^\d+[smh]$/);
        expect(['critical', 'warning', 'info']).toContain(rule.severity);
        expect(rule.summary).toBeTruthy();
        expect(rule.description).toBeTruthy();
      }
    });

    it('should have runbook URLs for all rules', () => {
      const config = generateAlertRules();
      for (const rule of config.groups[0].rules) {
        expect(rule.runbookUrl).toBeTruthy();
        expect(rule.runbookUrl).toContain('docs/runbooks/');
      }
    });
  });

  describe('Metric prefix support', () => {
    it('should apply metric prefix to all expressions', () => {
      const config = generateAlertRules({ metricPrefix: 's2v' });
      const rules = config.groups[0].rules;

      for (const rule of rules) {
        if (rule.expr.includes('http_') || rule.expr.includes('process_') || rule.expr.includes('export_queue')) {
          expect(rule.expr).toContain('s2v_');
        }
      }
    });

    it('should not add prefix when empty', () => {
      const config = generateAlertRules({ metricPrefix: '' });
      const highErrorRule = config.groups[0].rules.find(
        r => r.alert === 'SpeechToVisualsHighErrorRate',
      );
      // Should start with rate(http_ directly
      expect(highErrorRule!.expr).toContain('rate(http_errors_total');
      expect(highErrorRule!.expr).not.toContain('undefined_');
    });
  });

  describe('exportAlertRulesYaml', () => {
    it('should produce non-empty YAML string', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml.length).toBeGreaterThan(100);
    });

    it('should start with header comment', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('# Speech-to-Visuals Prometheus Alerting Rules');
      expect(yaml).toContain('REQ-209');
    });

    it('should contain all alert names in YAML output', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('SpeechToVisualsHighErrorRate');
      expect(yaml).toContain('SpeechToVisualsHighLatencyP95');
      expect(yaml).toContain('SpeechToVisualsHealthCheckFailures');
      expect(yaml).toContain('SpeechToVisualsLLMBudgetOverage');
      expect(yaml).toContain('SpeechToVisualsExportQueueBacklog');
      expect(yaml).toContain('SpeechToVisualsExportQueueSlowWait');
      expect(yaml).toContain('SpeechToVisualsExportQueueCriticalBacklog');
      expect(yaml).toContain('SpeechToVisualsExportDeadLetterQueueGrowth');
      expect(yaml).toContain('SpeechToVisualsExportHighRetryRate');
      expect(yaml).toContain('SpeechToVisualsExportDLQReplayRate');
    });

    it('should contain severity labels in YAML output', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('severity: critical');
      expect(yaml).toContain('severity: warning');
    });

    it('should contain for durations in YAML output', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('for: 2m');
      expect(yaml).toContain('for: 5m');
    });

    it('should contain annotations in YAML output', () => {
      const yaml = exportAlertRulesYaml();
      expect(yaml).toContain('summary:');
      expect(yaml).toContain('description:');
    });

    it('should use custom options in YAML output', () => {
      const yaml = exportAlertRulesYaml({ errorRateThreshold: 0.1 });
      expect(yaml).toContain('> 0.1');
    });
  });

  describe('getAlertRuleNames', () => {
    it('should return 10 names', () => {
      const names = getAlertRuleNames();
      expect(names).toHaveLength(10);
    });

    it('should return strings with SpeechToVisuals prefix', () => {
      const names = getAlertRuleNames();
      for (const name of names) {
        expect(name).toMatch(/^SpeechToVisuals/);
      }
    });
  });

  describe('Hold duration correctness', () => {
    it('should use shorter hold for critical alerts than warning', () => {
      const config = generateAlertRules();
      const rules = config.groups[0].rules;

      const parseDuration = (d: string): number => {
        const match = d.match(/^(\d+)([smh])$/);
        if (!match) return 0;
        const val = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 's') return val * 1000;
        if (unit === 'm') return val * 60 * 1000;
        return val * 3600 * 1000;
      };

      const criticalRules = rules.filter(r => r.severity === 'critical');
      const warningRules = rules.filter(r => r.severity === 'warning');

      // Critical alerts should fire faster (shorter hold duration)
      const maxCriticalFor = Math.max(...criticalRules.map(r => parseDuration(r.for)));
      const maxWarningFor = Math.max(...warningRules.map(r => parseDuration(r.for)));
      expect(maxCriticalFor).toBeLessThanOrEqual(maxWarningFor);
    });
  });
});
