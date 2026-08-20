/**
 * @jest-environment node
 */
/**
 * Heap-usage ratio — structural guard against re-derivation.
 *
 * The `heapUsed / heapTotal` division (with its `heapTotal > 0` guard) recurred
 * at THREE layers because each was fixed in isolation while the next module
 * kept re-inlining the same division:
 *   - health-check-service.ts        → memoryUsagePercent (×100)
 *   - real-time-performance-monitor  → memoryUsagePercent (×100)
 *   - enhanced-error-recovery.ts     → memoryPressure (fraction)
 * Two of the three feed the SAME `memoryUsagePercent` field consumed by
 * decision-bearing gates (health status at 70/90; `adaptive-quality-gates`
 * deployment readiness). A unit test on any one site proves nothing about the
 * others — the division always survived somewhere. This concentrates the
 * division+guard into ONE canonical function (`heapUsageRatio`, with
 * `heapUsagePercent` as its ×100 form) and STRUCTURALLY forbids re-inlining the
 * `heapUsed / heapTotal` division at any call site. The broad sweep fails loudly
 * if anyone re-inlines the division — the 4th instance of this defect class.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir — see
// tests/__mocks__/whisper-node.ts) or simply differ under --maxWorkers>1
// (TC-302/313); cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

import { resolveSource } from '@tests/guards/freeze-guard';
const metricsUtilsSrc = readFileSync(
  resolveSource('src/lib/metrics-utils.ts'),
  'utf8',
);
const healthCheckSrc = readFileSync(
  resolve(REPO_ROOT, 'src/monitoring/health-check-service.ts'),
  'utf8',
);
const monitorSrc = readFileSync(
  resolve(REPO_ROOT, 'src/monitoring/real-time-performance-monitor.ts'),
  'utf8',
);
// Split 2026-08: the memoryPressure computation moved verbatim from
// enhanced-error-recovery.ts into error-recovery/load-balanced-executor.ts.
const errorRecoverySrc = readFileSync(
  resolve(REPO_ROOT, 'src/quality/error-recovery/load-balanced-executor.ts'),
  'utf8',
);
// Phase 166 (REQ-358): the raw-backend heap fields now enter through ONE
// boundary — src/monitoring/memory-backend.ts — whose helpers are the
// canonical heapUsagePercent/heapUsageRatio call sites for monitoring
// consumers.
const memoryBackendSrc = readFileSync(
  resolve(REPO_ROOT, 'src/monitoring/memory-backend.ts'),
  'utf8',
);

/** Strip comments (block + line) so doc references to the formula don't match. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Matches a heap-usage DIVISION: a `heapUsed` property access followed within a
 * short window by a `/` then a `heapTotal` property access — the re-derivation
 * shape (`memoryUsage.heapUsed / memoryUsage.heapTotal`). Bare parameter names
 * (`heapUsed / heapTotal` in the canonical) lack the leading `.` and don't
 * match, so the canonical definition in metrics-utils.ts is naturally exempt.
 */
const HEAP_DIVISION = /\.heapUsed\b[\s\S]{0,30}?\/[\s\S]{0,30}?\.heapTotal\b/;

describe('heapUsageRatio / heapUsagePercent — canonical heap-ratio builders', () => {
  it('metrics-utils exports both the ratio core and the percent form', () => {
    expect(metricsUtilsSrc).toMatch(/export\s+function\s+heapUsageRatio\s*\(/);
    expect(metricsUtilsSrc).toMatch(/export\s+function\s+heapUsagePercent\s*\(/);
    // The percent form delegates to the ratio core (scaling lives once).
    expect(metricsUtilsSrc).toMatch(/heapUsagePercent[\s\S]*?return\s+heapUsageRatio\s*\(/);
    // The core guards a non-positive total (the shared zero-division guard).
    expect(stripComments(metricsUtilsSrc)).toMatch(/heapUsageRatio[\s\S]*?heapTotal\s*<=\s*0/);
  });
});

describe('heap-ratio division — no re-derivation at the known call sites', () => {
  it('memory-backend is the monitoring boundary delegating to heapUsagePercent (Phase 166 / REQ-358)', () => {
    expect(stripComments(memoryBackendSrc)).toMatch(/import\s*\{[^}]*\bheapUsagePercent\b[^}]*\}\s*from\s*['"]@stv\/core\/lib\/metrics-utils['"]/);
    expect(stripComments(memoryBackendSrc)).toMatch(/heapUsagePercent\s*\(\s*reading\.heapUsed\s*,\s*reading\.heapTotal\s*\)/);
    expect(stripComments(memoryBackendSrc)).not.toMatch(HEAP_DIVISION);
  });

  it('health-check-service reads the backend through the memory-backend boundary', () => {
    expect(stripComments(healthCheckSrc)).toMatch(/import\s*\{[^}]*\breadMemoryBackend\b[^}]*\}\s*from\s*['"]\.\/memory-backend['"]/);
    expect(stripComments(healthCheckSrc)).toMatch(/heapUsagePercent\s*\(\s*memory\.heapUsed\s*,\s*memory\.heapTotal\s*\)/);
    expect(stripComments(healthCheckSrc)).not.toMatch(HEAP_DIVISION);
  });

  it('real-time-performance-monitor delegates system percent/MB to the memory-backend helpers', () => {
    expect(stripComments(monitorSrc)).toMatch(/import\s*\{[^}]*\breadMemoryBackend\b[^}]*\}\s*from\s*['"]\.\/memory-backend['"]/);
    expect(stripComments(monitorSrc)).toMatch(/heapUsagePercentRoundedOrNull\s*\(\s*memory\s*,\s*2\s*\)/);
    expect(stripComments(monitorSrc)).not.toMatch(HEAP_DIVISION);
  });

  it('load-balanced-executor (ex enhanced-error-recovery) delegates memoryPressure to heapUsageRatio (fraction, not percent)', () => {
    expect(stripComments(errorRecoverySrc)).toMatch(/import\s*\{[^}]*\bheapUsageRatio\b[^}]*\}\s*from\s*['"]@stv\/core\/lib\/metrics-utils['"]/);
    expect(stripComments(errorRecoverySrc)).toMatch(/memoryPressure:\s*\n?\s*memory\.heapUsed !== null && memory\.heapTotal !== null\s*\?\s*\n?\s*heapUsageRatio\s*\(/);
    expect(stripComments(errorRecoverySrc)).not.toMatch(HEAP_DIVISION);
  });
});

describe('heap-ratio division — broad cross-layer sweep', () => {
  // Belt-and-suspenders: no production file anywhere under src/ may re-inline the
  // `heapUsed / heapTotal` division. Catches a future site in any dir, not just
  // the three known publishers. The canonical definition in metrics-utils.ts is
  // excluded (it is the ONE sanctioned division).
  it('no production source file re-derives heapUsed / heapTotal', () => {
    const files = (globSync('src/**/*.ts', { cwd: REPO_ROOT }) as string[]).filter(
      f => !f.includes('__tests__') && !f.endsWith('metrics-utils.ts'),
    );

    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(resolve(REPO_ROOT, file), 'utf8'));
      if (HEAP_DIVISION.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
