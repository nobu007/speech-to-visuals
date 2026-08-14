/**
 * Structural guard: error-rate thresholds have ONE source (defect 09a).
 *
 * Before 09a, the 5%/15% error-rate boundaries were hardcoded independently
 * in production-monitor, health-check-service, alert-rules, and
 * real-time-performance-monitor — and the real-time monitor's critical
 * boundary had drifted to 10% while every other alerting engine fired
 * critical at 15%.
 *
 * This file pins VALUES and CONSUMER IMPORTS. The "no src/ file outside
 * exclusions hardcodes an error-rate threshold literal" discovery sweep lives
 * in the shared registry since round 8 — tests/guards/frozen-literal-registry.test.ts,
 * rule 'error-rate thresholds (0.05/0.10/0.15) …' (covers both the same-line
 * `errorRate … 0.05` coupling and the next-line `warning: 0.05` threshold
 * shape that catches multi-line setAlertThreshold calls).
 * src/config/production-config.ts is the documented intentional exclusion
 * (user-editable `alertThresholds` default; coupling a UI-editable default to
 * the engine threshold is its own defect class — see module header comment).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  ERROR_RATE_WARNING_THRESHOLD,
  ERROR_RATE_CRITICAL_THRESHOLD,
} from '@/monitoring/error-rate-thresholds';

const CONSUMERS = [
  'src/monitoring/production-monitor.ts',
  'src/monitoring/health-check-service.ts',
  'src/monitoring/alert-rules.ts',
  'src/monitoring/real-time-performance-monitor.ts',
  'src/monitoring/performance-dashboard.ts',
];

describe('09a: error-rate threshold single source', () => {
  it('canonical module exports 0.05 warning / 0.15 critical', () => {
    expect(ERROR_RATE_WARNING_THRESHOLD).toBe(0.05);
    expect(ERROR_RATE_CRITICAL_THRESHOLD).toBe(0.15);
  });

  it.each(CONSUMERS)('%s imports the canonical module', (file) => {
    expect(readSource(file)).toMatch(/from '\.\/error-rate-thresholds'/);
  });
});
