/**
 * Structural guard: error-rate thresholds have ONE source (defect 09a).
 *
 * Before 09a, the 5%/15% error-rate boundaries were hardcoded independently
 * in production-monitor, health-check-service, alert-rules, and
 * real-time-performance-monitor — and the real-time monitor's critical
 * boundary had drifted to 10% while every other alerting engine fired
 * critical at 15%.
 *
 * This guard pins:
 *   1. The canonical module exports 0.05 / 0.15.
 *   2. Every known consumer imports the canonical module and carries no
 *      bare error-rate threshold literals.
 *   3. Discovery sweep: NO file under src/ (outside the canonical module)
 *      hardcodes an error-rate threshold literal — catches NEW files that
 *      reintroduce the drift. src/config/production-config.ts is the
 *      documented intentional exclusion (user-editable `alertThresholds`
 *      default; coupling a UI-editable default to the engine threshold is
 *      its own defect class — see module header comment).
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative
 * reads flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  ERROR_RATE_WARNING_THRESHOLD,
  ERROR_RATE_CRITICAL_THRESHOLD,
} from '@/monitoring/error-rate-thresholds';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONSUMERS = [
  'src/monitoring/production-monitor.ts',
  'src/monitoring/health-check-service.ts',
  'src/monitoring/alert-rules.ts',
  'src/monitoring/real-time-performance-monitor.ts',
  'src/monitoring/performance-dashboard.ts',
];

/** Files allowed to mention error-rate threshold literals (documented exclusions). */
const EXCLUDED = new Set([
  'src/monitoring/error-rate-thresholds.ts', // the canonical source itself
  'src/config/production-config.ts', // user-editable alertThresholds default — see header
]);

/** Bare error-rate threshold literals that must not appear on errorRate lines. */
const BARE_LITERAL = /\b0\.05\b|\b0\.10\b|\b0\.15\b/;

function walk(dirRel: string, acc: string[]): string[] {
  for (const entry of readdirSync(join(REPO_ROOT, dirRel))) {
    const rel = `${dirRel}/${entry}`;
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) {
      // Co-located __tests__ hold metric fixtures, not production thresholds.
      if (!entry.includes('__tests__')) walk(rel, acc);
    } else if (
      (rel.endsWith('.ts') || rel.endsWith('.tsx')) &&
      !/\.(test|spec)\./.test(rel)
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

/** Lines that couple `errorRate` (any casing/spacing) to a bare threshold literal. */
function offendingLines(src: string): string[] {
  return src
    .split('\n')
    .filter(
      (line) =>
        // Same-line coupling: `errorRate < 0.05`, `errorRateThreshold: 0.05`, …
        (/errorRate/i.test(line) && BARE_LITERAL.test(line)) ||
        // Threshold-shaped assignment of the literal itself — catches the
        // multi-line `setAlertThreshold('errorRate', { warning: 0.05, … })`
        // shape where the literal sits on the line AFTER the errorRate mention.
        // (`critical: 0.1` for cacheHitRate etc. is a different literal and
        // intentionally not matched.)
        /(warning|critical|maxErrorRate|errorRateThreshold)\s*:\s*(0\.05|0\.10|0\.15)\b/.test(
          line,
        ),
    );
}

describe('09a: error-rate threshold single source', () => {
  it('canonical module exports 0.05 warning / 0.15 critical', () => {
    expect(ERROR_RATE_WARNING_THRESHOLD).toBe(0.05);
    expect(ERROR_RATE_CRITICAL_THRESHOLD).toBe(0.15);
  });

  it.each(CONSUMERS)('%s imports the canonical module and has no bare literals', (file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf-8');
    expect(src).toMatch(/from '\.\/error-rate-thresholds'/);
    expect(offendingLines(src)).toEqual([]);
  });

  it('discovery sweep: no src/ file outside exclusions hardcodes error-rate thresholds', () => {
    const offenders: string[] = [];
    for (const file of walk('src', [])) {
      if (EXCLUDED.has(file)) continue;
      const lines = offendingLines(readFileSync(join(REPO_ROOT, file), 'utf-8'));
      if (lines.length > 0) offenders.push(`${file}: ${lines[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });
});
