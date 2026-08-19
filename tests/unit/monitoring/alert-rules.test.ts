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

/**
 * Fail-loud rule lookup (Phase 148 / REQ-338): replaces the 55 `rule!`
 * non-null assertions this file used to postfix `.find()` results with.
 * An absent rule previously surfaced as an opaque `TypeError: Cannot read
 * properties of undefined` inside the first `expect` (or a bare
 * `expect(rule).toBeDefined()` failure); the helper keeps the exact same
 * RED verdict with the missing alert name in the message, and lets the
 * assertions read the narrowed rule without asserting presence away.
 */
function requireAlertRule(config: AlertingConfig, alert: string): AlertRule {
  const rule = config.groups[0].rules.find(r => r.alert === alert);
  if (rule === undefined) {
    throw new Error(`alert rule not found: ${alert}`);
  }
  return rule;
}

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
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('> 0.05');
      expect(rule.severity).toBe('critical');
      expect(rule.for).toBe('2m');
    });

    it('should reference error and request metrics', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('http_errors_total');
      expect(rule.expr).toContain('http_requests_total');
      expect(rule.expr).toContain('rate(');
    });

    it('should respect custom error rate threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules({ errorRateThreshold: 0.1 }),
        'SpeechToVisualsHighErrorRate',
      );
      expect(rule.expr).toContain('> 0.1');
    });
  });

  describe('HighLatencyP95 alert', () => {
    it('should use 20s (20000ms) threshold by default', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('> 20000');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });

    it('should reference P95 quantile', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('quantile="0.95"');
      expect(rule.expr).toContain('http_request_duration_ms');
    });

    it('should respect custom latency threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules({ latencyP95ThresholdMs: 30000 }),
        'SpeechToVisualsHighLatencyP95',
      );
      expect(rule.expr).toContain('> 30000');
    });
  });

  describe('HealthCheckFailures alert', () => {
    it('should use critical severity', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHealthCheckFailures');
      expect(rule.severity).toBe('critical');
    });

    it('should reference health check paths', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('/health');
      expect(rule.expr).toContain('http_errors_total');
    });

    it('should have minimum hold duration', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsHealthCheckFailures');
      expect(rule.for).toBe('1m');
    });
  });

  describe('LLMBudgetOverage alert', () => {
    it('should use warning severity', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsLLMBudgetOverage');
      expect(rule.severity).toBe('warning');
    });

    it('should reference monitoring API in description', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsLLMBudgetOverage');
      expect(rule.description).toContain('/api/v1/monitoring/cost');
    });
  });

  describe('ExportQueueBacklog alert', () => {
    it('should use warning severity', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueBacklog');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('3m');
    });

    it('should use 50 as default queue size threshold', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueBacklog');
      expect(rule.expr).toContain('export_queue_size');
      expect(rule.expr).toContain('> 50');
    });

    it('should reference export API in description', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueBacklog');
      expect(rule.description).toContain('/api/v1/export/jobs');
    });

    it('should respect custom queue size threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules({ exportQueueSizeThreshold: 75 }),
        'SpeechToVisualsExportQueueBacklog',
      );
      expect(rule.expr).toContain('> 75');
    });
  });

  describe('ExportQueueSlowWait alert', () => {
    it('should use warning severity', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueSlowWait');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });

    it('should use 10000ms as default wait time threshold', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueSlowWait');
      expect(rule.expr).toContain('export_queue_wait_time_ms');
      expect(rule.expr).toContain('> 10000');
    });

    it('should respect custom wait time threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules({ exportQueueWaitTimeThresholdMs: 30000 }),
        'SpeechToVisualsExportQueueSlowWait',
      );
      expect(rule.expr).toContain('> 30000');
    });
  });

  describe('ExportQueueCriticalBacklog alert', () => {
    it('should use critical severity', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule.severity).toBe('critical');
      expect(rule.for).toBe('1m');
    });

    it('should use 100 as default critical queue size threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule.expr).toContain('export_queue_size');
      expect(rule.expr).toContain('> 100');
    });

    it('should have shorter hold than warning backlog alert', () => {
      const criticalRule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      const warningRule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportQueueBacklog');
      expect(criticalRule.for).toBe('1m');
      expect(warningRule.for).toBe('3m');
    });

    it('should reference export API in description', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule.description).toContain('/api/v1/export/jobs');
    });

    it('should respect custom critical queue size threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules({ exportQueueCriticalSizeThreshold: 150 }),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule.expr).toContain('> 150');
    });

    it('should reference the backlog runbook', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportQueueCriticalBacklog',
      );
      expect(rule.runbookUrl).toBe('docs/runbooks/export-queue-backlog.md');
    });
  });

  describe('ExportDeadLetterQueueGrowth alert', () => {
    it('should use dlq_size > 0 as threshold', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportDeadLetterQueueGrowth',
      );
      expect(rule.expr).toContain('export_queue_dlq_size > 0');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });

    it('should reference DLQ API endpoint in description', () => {
      const rule = requireAlertRule(
        generateAlertRules(),
        'SpeechToVisualsExportDeadLetterQueueGrowth',
      );
      expect(rule.description).toContain('/api/v1/export/jobs/dead-letter');
    });
  });

  describe('ExportHighRetryRate alert', () => {
    it('should use rate-based expression on retry_total', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportHighRetryRate');
      expect(rule.expr).toContain('rate(');
      expect(rule.expr).toContain('export_queue_retry_total');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });
  });

  describe('ExportDLQReplayRate alert', () => {
    it('should use rate-based expression on dlq_replay_total', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportDLQReplayRate');
      expect(rule.expr).toContain('rate(');
      expect(rule.expr).toContain('export_queue_dlq_replay_total');
      expect(rule.expr).toContain('> 0.1');
      expect(rule.severity).toBe('warning');
      expect(rule.for).toBe('5m');
    });

    it('should reference DLQ API endpoint in description', () => {
      const rule = requireAlertRule(generateAlertRules(), 'SpeechToVisualsExportDLQReplayRate');
      expect(rule.description).toContain('/api/v1/export/jobs/dead-letter');
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
      const highErrorRule = requireAlertRule(
        generateAlertRules({ metricPrefix: '' }),
        'SpeechToVisualsHighErrorRate',
      );
      // Should start with rate(http_ directly
      expect(highErrorRule.expr).toContain('rate(http_errors_total');
      expect(highErrorRule.expr).not.toContain('undefined_');
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
