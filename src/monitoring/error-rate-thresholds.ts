/**
 * Single source of truth for error-rate thresholds across monitoring modules.
 *
 * Closes defect 09a (monitor↔health-check threshold drift): before this
 * module, the 5%/15% boundaries were hardcoded independently in
 * production-monitor, health-check-service, alert-rules, and
 * real-time-performance-monitor — and the real-time monitor's critical
 * boundary had silently drifted to 10% while every other alerting engine
 * fired critical at 15%.
 *
 * All alerting (warning/critical) and readiness (healthy/degraded) engines
 * MUST import from here; do not reintroduce bare `0.05`/`0.15` literals.
 * (src/config/production-config.ts `alertThresholds.errorRate` is a
 * user-editable default and intentionally does NOT import this — coupling a
 * UI-editable default to the engine threshold is its own defect class.)
 *
 * Guarded by tests/guards/error-rate-threshold-single-source.test.ts.
 */

/** Warning threshold: alert/readiness boundary at 5% error rate. */
export const ERROR_RATE_WARNING_THRESHOLD = 0.05;

/** Critical threshold: alert/readiness boundary at 15% error rate. */
export const ERROR_RATE_CRITICAL_THRESHOLD = 0.15;
