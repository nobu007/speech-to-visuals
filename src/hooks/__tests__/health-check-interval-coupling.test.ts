/**
 * @jest-environment node
 */
/**
 * HEALTH_CHECK_INTERVAL_MS — producer/consumer single-source-of-truth guard.
 *
 * useAdminAnalytics derives the dashboard's `nextDueAt` (when the next cached
 * health refresh is due) as `lastCheckedAt + HEALTH_CHECK_INTERVAL_MS`, while
 * HealthCheckService.refresh uses the SAME interval to actually repopulate that
 * cache. Previously the hook re-hard-coded `10_000` behind a
 * "// matches HealthCheckService internal interval" comment and the service used
 * a bare `10000` literal — a classic producer/consumer desync (the f724a8a
 * STAGGER_DELAY family): the moment either side changed, the dashboard's "next
 * check due" countdown would silently drift.
 *
 * Because both literals coincidentally equalled 10000, the desync was LATENT —
 * no behavioral test can go RED while the values agree (the A121 RED→GREEN
 * impossibility). These STRUCTURAL anchors pin the coupling instead: the
 * constant is exported once from the producer, the producer's setInterval reads
 * it, the consumer imports it, and no divergent literal or "matches" comment
 * remains. Every anchor is RED on the pre-fix source and GREEN after; together
 * they fail loudly if anyone re-inlines a value on either side.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HEALTH_CHECK_INTERVAL_MS } from '@/monitoring/health-check-service';

const serviceSrc = readFileSync(
  resolve(process.cwd(), 'src/monitoring/health-check-service.ts'),
  'utf8',
);
const hookSrc = readFileSync(
  resolve(process.cwd(), 'src/hooks/useAdminAnalytics.ts'),
  'utf8',
);

describe('HEALTH_CHECK_INTERVAL_MS — single source of truth (producer ↔ consumer)', () => {
  it('exports a finite, positive interval from the producer', () => {
    // Runtime anchor: the import resolves and is a sane cadence.
    expect(Number.isFinite(HEALTH_CHECK_INTERVAL_MS)).toBe(true);
    expect(HEALTH_CHECK_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('health-check-service exports HEALTH_CHECK_INTERVAL_MS as a named const', () => {
    expect(serviceSrc).toMatch(
      /export\s+const\s+HEALTH_CHECK_INTERVAL_MS\s*=\s*\d+/,
    );
  });

  it('health-check-service periodic setInterval reads the constant, not a bare literal', () => {
    // The refresh cadence must reference the exported constant so the cache-TTL
    // contract the consumer relies on stays in one place.
    expect(serviceSrc).toMatch(/}\s*,\s*HEALTH_CHECK_INTERVAL_MS\s*\)/);
    // The pre-fix bare-literal form must be gone.
    expect(serviceSrc).not.toMatch(/setInterval\([\s\S]*?\)\s*,\s*10000\s*\)/);
  });

  it('useAdminAnalytics imports HEALTH_CHECK_INTERVAL_MS from the producer', () => {
    expect(hookSrc).toMatch(
      /import\s*\{[^}]*\bHEALTH_CHECK_INTERVAL_MS\b[^}]*\}\s*from\s*['"]@\/monitoring\/health-check-service['"]/,
    );
  });

  it('useAdminAnalytics does NOT redefine HEALTH_CHECK_INTERVAL_MS as a local literal', () => {
    // A local `const HEALTH_CHECK_INTERVAL_MS = <num>` would re-introduce the
    // exact desync trap the import was meant to eliminate.
    expect(hookSrc).not.toMatch(
      /(?:const|let|var)\s+HEALTH_CHECK_INTERVAL_MS\s*=\s*\d/,
    );
  });

  it('the "// matches HealthCheckService" desync smell is gone from useAdminAnalytics', () => {
    expect(hookSrc).not.toMatch(/matches\s+HealthCheckService/i);
  });
});
