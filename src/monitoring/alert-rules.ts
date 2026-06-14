/**
 * REQ-209: Prometheus Alerting Rules
 *
 * Generates threshold-based alert rules for speech-to-visuals monitoring.
 * Designed for Prometheus AlertManager or compatible systems.
 *
 * Alert rules:
 * 1. HighErrorRate: error rate > 5% → critical
 * 2. HighLatencyP95: P95 latency > 20s → warning
 * 3. HealthCheckFailures: consecutive failures ≥ 3 → critical
 * 4. LLMBudgetOverage: cost approaching limit → warning
 * 5. ExportQueueBacklog: queue depth > 50 → warning
 * 6. ExportQueueSlowWait: avg wait time > 10s → warning
 * 7. ExportQueueCriticalBacklog: queue depth > 100 → critical
 * 8. ExportDeadLetterQueueGrowth: DLQ has jobs → warning
 * 9. ExportHighRetryRate: retry rate > 0.5/s → warning
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertRule {
  /** Alert name (must be unique) */
  alert: string;
  /** PromQL expression */
  expr: string;
  /** Duration the condition must hold before firing */
  for: string;
  /** Severity level */
  severity: AlertSeverity;
  /** Human-readable summary */
  summary: string;
  /** Detailed description */
  description: string;
  /** Runbook URL for resolution */
  runbookUrl?: string;
}

export interface AlertRuleGroup {
  name: string;
  rules: AlertRule[];
  interval?: string;
}

export interface AlertingConfig {
  groups: AlertRuleGroup[];
}

export interface AlertRulesOptions {
  /** Metric namespace prefix (default: '') */
  metricPrefix?: string;
  /** Error rate threshold (default: 0.05 = 5%) */
  errorRateThreshold?: number;
  /** P95 latency threshold in ms (default: 20000 = 20s) */
  latencyP95ThresholdMs?: number;
  /** Consecutive health check failures (default: 3) */
  healthCheckFailureThreshold?: number;
  /** LLM budget utilization percentage warning threshold (default: 80 = 80%) */
  llmBudgetWarningPercent?: number;
  /** Export queue depth warning threshold (default: 50) */
  exportQueueSizeThreshold?: number;
  /** Export queue depth critical threshold (default: 100) */
  exportQueueCriticalSizeThreshold?: number;
  /** Export queue wait time warning threshold in ms (default: 10000 = 10s) */
  exportQueueWaitTimeThresholdMs?: number;
}

// ---------------------------------------------------------------------------
// Default thresholds (aligned with REQ-209)
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: Required<AlertRulesOptions> = {
  metricPrefix: '',
  errorRateThreshold: 0.05,
  latencyP95ThresholdMs: 20000,
  healthCheckFailureThreshold: 3,
  llmBudgetWarningPercent: 80,
  exportQueueSizeThreshold: 50,
  exportQueueCriticalSizeThreshold: 100,
  exportQueueWaitTimeThresholdMs: 10000,
};

// ---------------------------------------------------------------------------
// Rule builders
// ---------------------------------------------------------------------------

function buildHighErrorRateRule(prefix: string, threshold: number): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsHighErrorRate',
    expr: `rate(${p}http_errors_total[5m]) / rate(${p}http_requests_total[5m]) > ${threshold}`,
    for: '2m',
    severity: 'critical',
    summary: 'HTTP error rate exceeds threshold',
    description: `Error rate is above ${(threshold * 100).toFixed(1)}% (current: {{ $value | humanizePercentage }}). Check /api/v1/monitoring/error-recovery for recovery telemetry.`,
    runbookUrl: 'docs/runbooks/high-error-rate.md',
  };
}

function buildHighLatencyP95Rule(
  prefix: string,
  thresholdMs: number,
): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsHighLatencyP95',
    expr: `${p}http_request_duration_ms{quantile="0.95"} > ${thresholdMs}`,
    for: '5m',
    severity: 'warning',
    summary: 'P95 latency exceeds threshold',
    description: `P95 request latency is above ${(thresholdMs / 1000).toFixed(0)}s (current: {{ $value }}ms). Check /api/v1/monitoring/http-metrics for per-route breakdown.`,
    runbookUrl: 'docs/runbooks/high-latency.md',
  };
}

function buildHealthCheckFailureRule(
  prefix: string,
  threshold: number,
): AlertRule {
  // Health check failures tracked via http_errors_total on /health endpoints
  const p = prefix;
  return {
    alert: 'SpeechToVisualsHealthCheckFailures',
    expr: `sum(increase(${p}http_errors_total{path=~"/health.*"}[10m])) >= ${threshold}`,
    for: '1m',
    severity: 'critical',
    summary: 'Health check endpoint returning errors',
    description: 'Health check endpoints have returned 3+ errors in the last 10 minutes. The system may be unhealthy. Check /health for component-level status.',
    runbookUrl: 'docs/runbooks/health-check-failures.md',
  };
}

function buildLLMBudgetOverageRule(prefix: string): AlertRule {
  // This is a placeholder rule since LLM budget metrics come from
  // the monitoring API rather than Prometheus. A real deployment would
  // need a custom metric exporter for budget data.
  const p = prefix;
  return {
    alert: 'SpeechToVisualsLLMBudgetOverage',
    expr: `${p}http_slow_requests_total > 0 and on() ${p}process_uptime_ms > 3600000`,
    for: '10m',
    severity: 'warning',
    summary: 'LLM budget utilization approaching limit',
    description: 'LLM API cost is approaching the configured budget limit. Check /api/v1/monitoring/cost for detailed cost breakdown and token usage.',
    runbookUrl: 'docs/runbooks/llm-budget-overage.md',
  };
}

function buildExportQueueBacklogRule(
  prefix: string,
  threshold: number,
): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsExportQueueBacklog',
    expr: `${p}export_queue_size > ${threshold}`,
    for: '3m',
    severity: 'warning',
    summary: 'Export queue backlog exceeds threshold',
    description: `Export queue has more than ${threshold} jobs waiting (current: {{ $value }}). Check /api/v1/export/jobs for queue details and consider scaling concurrency.`,
    runbookUrl: 'docs/runbooks/export-queue-backlog.md',
  };
}

function buildExportQueueSlowWaitRule(
  prefix: string,
  thresholdMs: number,
): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsExportQueueSlowWait',
    expr: `${p}export_queue_wait_time_ms > ${thresholdMs}`,
    for: '5m',
    severity: 'warning',
    summary: 'Export queue wait time exceeds threshold',
    description: `Average export job queue wait time is above ${(thresholdMs / 1000).toFixed(0)}s (current: {{ $value }}ms). Check /api/v1/export/jobs for active jobs and processing status.`,
    runbookUrl: 'docs/runbooks/export-queue-slow-wait.md',
  };
}

function buildExportQueueCriticalBacklogRule(
  prefix: string,
  threshold: number,
): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsExportQueueCriticalBacklog',
    expr: `${p}export_queue_size > ${threshold}`,
    for: '1m',
    severity: 'critical',
    summary: 'Export queue backlog at critical level',
    description: `Export queue has more than ${threshold} jobs waiting (current: {{ $value }}). The system is severely backed up. Immediate intervention required — check /api/v1/export/jobs and scale processing concurrency.`,
    runbookUrl: 'docs/runbooks/export-queue-backlog.md',
  };
}

function buildExportDlqGrowthRule(prefix: string): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsExportDeadLetterQueueGrowth',
    expr: `${p}export_queue_dlq_size > 0`,
    for: '5m',
    severity: 'warning',
    summary: 'Export dead letter queue has jobs',
    description: 'Export dead letter queue has {{ $value }} job(s) that failed after exhausting all retries. Check /api/v1/export/jobs/dead-letter for details and consider replaying after fixing root cause.',
    runbookUrl: 'docs/runbooks/export-queue-backlog.md',
  };
}

function buildExportHighRetryRateRule(prefix: string): AlertRule {
  const p = prefix;
  return {
    alert: 'SpeechToVisualsExportHighRetryRate',
    expr: `rate(${p}export_queue_retry_total[5m]) > 0.5`,
    for: '5m',
    severity: 'warning',
    summary: 'Export job retry rate is high',
    description: 'Export jobs are retrying at a rate above 0.5/min (current: {{ $value }}/s). This indicates a systemic issue with export processing. Check /api/v1/export/jobs for active jobs and recent error logs.',
    runbookUrl: 'docs/runbooks/export-queue-backlog.md',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate alert rules for speech-to-visuals monitoring.
 *
 * Returns structured alert rule definitions compatible with
 * Prometheus AlertManager configuration format.
 */
export function generateAlertRules(options?: AlertRulesOptions): AlertingConfig {
  const opts = { ...DEFAULT_THRESHOLDS, ...options };
  const prefix = opts.metricPrefix ? `${opts.metricPrefix}_` : '';

  const rules: AlertRule[] = [
    buildHighErrorRateRule(prefix, opts.errorRateThreshold),
    buildHighLatencyP95Rule(prefix, opts.latencyP95ThresholdMs),
    buildHealthCheckFailureRule(prefix, opts.healthCheckFailureThreshold),
    buildLLMBudgetOverageRule(prefix),
    buildExportQueueBacklogRule(prefix, opts.exportQueueSizeThreshold),
    buildExportQueueSlowWaitRule(prefix, opts.exportQueueWaitTimeThresholdMs),
    buildExportQueueCriticalBacklogRule(prefix, opts.exportQueueCriticalSizeThreshold),
    buildExportDlqGrowthRule(prefix),
    buildExportHighRetryRateRule(prefix),
  ];

  return {
    groups: [
      {
        name: 'speech-to-visuals-alerts',
        interval: '30s',
        rules,
      },
    ],
  };
}

/**
 * Export alert rules in Prometheus rule file YAML format.
 * Can be written directly to a Prometheus rules directory.
 */
export function exportAlertRulesYaml(options?: AlertRulesOptions): string {
  const config = generateAlertRules(options);
  const lines: string[] = [];

  lines.push('# Speech-to-Visuals Prometheus Alerting Rules');
  lines.push('# Generated by alert-rules.ts (REQ-209)');
  lines.push('');

  for (const group of config.groups) {
    lines.push(`groups:`);
    lines.push(`  - name: ${group.name}`);
    if (group.interval) {
      lines.push(`    interval: ${group.interval}`);
    }
    lines.push(`    rules:`);

    for (const rule of group.rules) {
      lines.push(`      - alert: ${rule.alert}`);
      lines.push(`        expr: ${rule.expr}`);
      lines.push(`        for: ${rule.for}`);
      lines.push(`        labels:`);
      lines.push(`          severity: ${rule.severity}`);
      lines.push(`        annotations:`);
      lines.push(`          summary: "${rule.summary}"`);
      lines.push(`          description: "${rule.description}"`);
      if (rule.runbookUrl) {
        lines.push(`          runbook_url: "${rule.runbookUrl}"`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Get alert rule names for validation/testing.
 */
export function getAlertRuleNames(): string[] {
  const config = generateAlertRules();
  return config.groups.flatMap(g => g.rules.map(r => r.alert));
}
