/**
 * Phase 86: Alert Rule Threshold Boundary Tests (REQ-215)
 *
 * Validates that each alert rule's threshold evaluation correctly determines
 * firing conditions. Tests cover three scenarios per rule:
 * 1. Normal: value well below threshold → no alert expected
 * 2. Boundary: value at exact threshold → alert should fire
 * 3. Exceeded: value well above threshold → alert should fire
 *
 * Alert rules tested:
 * - HighErrorRate: 5% threshold (errorRateThreshold = 0.05)
 * - HighLatencyP95: 20s threshold (latencyP95ThresholdMs = 20000)
 * - HealthCheckFailures: 3 consecutive failures threshold
 * - LLMBudgetOverage: warning severity rule
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateAlertRules,
  type AlertRule,
  type AlertRulesOptions,
} from '@/monitoring/alert-rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findRule(config: ReturnType<typeof generateAlertRules>, alertName: string): AlertRule {
  const rule = config.groups[0].rules.find(r => r.alert === alertName);
  if (!rule) throw new Error(`Rule ${alertName} not found`);
  return rule;
}

/** Extract numeric threshold from a PromQL expression like "> 0.05" */
function extractThreshold(expr: string): number {
  const match = expr.match(/>=\s*([\d.]+)|>\s*([\d.]+)/);
  if (!match) throw new Error(`No threshold found in: ${expr}`);
  return parseFloat(match[1] ?? match[2]);
}

/** Simulate PromQL > threshold check */
function exceedsThreshold(value: number, threshold: number, operator: string): boolean {
  if (operator === '>=') return value >= threshold;
  return value > threshold;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-215: Alert Rule Threshold Boundary Tests', () => {
  describe('HighErrorRate (5% threshold)', () => {
    const THRESHOLD = 0.05;

    it('normal: error rate below threshold should not fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighErrorRate');
      const threshold = extractThreshold(rule.expr);

      const errorRate = 0.03; // 3%, well below 5%
      expect(exceedsThreshold(errorRate, threshold, '>')).toBe(false);
    });

    it('boundary: error rate at exact threshold should not fire (strict >)', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighErrorRate');
      const threshold = extractThreshold(rule.expr);

      // At exactly 5% — strict > means this should not fire
      expect(exceedsThreshold(THRESHOLD, threshold, '>')).toBe(false);
    });

    it('exceeded: error rate above threshold should fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighErrorRate');
      const threshold = extractThreshold(rule.expr);

      const errorRate = 0.08; // 8%, above 5%
      expect(exceedsThreshold(errorRate, threshold, '>')).toBe(true);
    });

    it('uses correct default threshold value in expression', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('> 0.05');
    });

    it('respects custom threshold option', () => {
      const config = generateAlertRules({ errorRateThreshold: 0.10 });
      const rule = findRule(config, 'SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('> 0.1');

      const threshold = extractThreshold(rule.expr);
      expect(exceedsThreshold(0.08, threshold, '>')).toBe(false); // 8% < 10%
      expect(exceedsThreshold(0.12, threshold, '>')).toBe(true);  // 12% > 10%
    });
  });

  describe('HighLatencyP95 (20s threshold)', () => {
    const THRESHOLD_MS = 20000;

    it('normal: P95 latency below threshold should not fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      const threshold = extractThreshold(rule.expr);

      const latency = 15000; // 15s, well below 20s
      expect(exceedsThreshold(latency, threshold, '>')).toBe(false);
    });

    it('boundary: P95 latency at exact threshold should not fire (strict >)', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      const threshold = extractThreshold(rule.expr);

      expect(exceedsThreshold(THRESHOLD_MS, threshold, '>')).toBe(false);
    });

    it('exceeded: P95 latency above threshold should fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      const threshold = extractThreshold(rule.expr);

      const latency = 25000; // 25s, above 20s
      expect(exceedsThreshold(latency, threshold, '>')).toBe(true);
    });

    it('uses correct default threshold value in expression', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('> 20000');
    });

    it('respects custom latency threshold option', () => {
      const config = generateAlertRules({ latencyP95ThresholdMs: 30000 });
      const rule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('> 30000');

      const threshold = extractThreshold(rule.expr);
      expect(exceedsThreshold(25000, threshold, '>')).toBe(false); // 25s < 30s
      expect(exceedsThreshold(35000, threshold, '>')).toBe(true);  // 35s > 30s
    });
  });

  describe('HealthCheckFailures (3 consecutive failures)', () => {
    const FAILURE_THRESHOLD = 3;

    it('normal: 2 failures should not fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      const threshold = extractThreshold(rule.expr);

      // PromQL: >= 3, so 2 should not fire
      expect(exceedsThreshold(2, threshold, '>=')).toBe(false);
    });

    it('boundary: exactly 3 failures should fire (>= operator)', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      const threshold = extractThreshold(rule.expr);

      expect(exceedsThreshold(FAILURE_THRESHOLD, threshold, '>=')).toBe(true);
    });

    it('exceeded: 5 failures should fire', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      const threshold = extractThreshold(rule.expr);

      expect(exceedsThreshold(5, threshold, '>=')).toBe(true);
    });

    it('uses correct default threshold in expression', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('>= 3');
    });

    it('respects custom failure threshold', () => {
      const config = generateAlertRules({ healthCheckFailureThreshold: 5 });
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('>= 5');

      const threshold = extractThreshold(rule.expr);
      expect(exceedsThreshold(3, threshold, '>=')).toBe(false); // 3 < 5
      expect(exceedsThreshold(5, threshold, '>=')).toBe(true);  // 5 >= 5
    });

    it('references health check path pattern', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toMatch(/\/health/);
      expect(rule.expr).toContain('http_errors_total');
    });
  });

  describe('LLMBudgetOverage (warning severity)', () => {
    it('has warning severity', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsLLMBudgetOverage');
      expect(rule.severity).toBe('warning');
    });

    it('references monitoring cost endpoint in description', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsLLMBudgetOverage');
      expect(rule.description).toContain('/api/v1/monitoring/cost');
    });

    it('references slow requests and uptime metrics', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsLLMBudgetOverage');
      // Rule checks slow_requests > 0 AND uptime > 1 hour
      expect(rule.expr).toContain('http_slow_requests_total');
      expect(rule.expr).toContain('process_uptime_ms');
      expect(rule.expr).toContain('3600000'); // 1 hour in ms
    });

    it('has reasonable hold duration', () => {
      const config = generateAlertRules();
      const rule = findRule(config, 'SpeechToVisualsLLMBudgetOverage');
      expect(rule.for).toMatch(/^\d+[smh]$/);
      // Budget overage uses 10m hold to avoid flapping
      expect(rule.for).toBe('10m');
    });
  });

  describe('Threshold consistency across custom options', () => {
    it('all thresholds can be overridden simultaneously', () => {
      const options: AlertRulesOptions = {
        errorRateThreshold: 0.15,
        latencyP95ThresholdMs: 50000,
        healthCheckFailureThreshold: 10,
      };
      const config = generateAlertRules(options);

      const errorRule = findRule(config, 'SpeechToVisualsHighErrorRate');
      expect(errorRule.expr).toContain('> 0.15');

      const latencyRule = findRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(latencyRule.expr).toContain('> 50000');

      const healthRule = findRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(healthRule.expr).toContain('>= 10');
    });

    it('metric prefix is applied to all rules consistently', () => {
      const config = generateAlertRules({ metricPrefix: 's2v' });

      for (const rule of config.groups[0].rules) {
        // All rules reference metrics; prefix should appear where metrics are used
        if (rule.expr.includes('http_') || rule.expr.includes('process_')) {
          expect(rule.expr).toContain('s2v_');
        }
      }
    });
  });
});
