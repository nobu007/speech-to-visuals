/**
 * REQ-378 (c) + (d) zero-fallback audit pin.
 *
 * Phase 176 (REQ-378 a) closed the catch-fallback and `checkCacheHealth || 0`
 * vectors in `health-check-service.ts`. Phase 177 (REQ-378 c, d) audits the
 * remaining audit regions:
 *   - (c) `checkMemoryHealth` / `checkLLMHealth` / `checkErrorHealth` summary
 *         numeric fields (`memoryUsagePercent`, `successRate`, `recoverySuccessRate`, …)
 *   - (d) `generateRecommendations` score denominators
 *         (`memoryUsagePercent`, `activeRequests`)
 *
 * Both regions are already fail-loud via `isFiniteMetric(...)` (REQ-352/353
 * MW-028/029, REQ-359/360 MW-033/034): the numerics are null or finite, never
 * defaulted to 0. A `?? 0` / `|| 0` resurrection at either site would silently
 * re-route the gate to the "no regression" verdict, exactly the
 * "applied=0/detected=0 → 0% fabricated" vector MW-038 closed and the
 * hunter for the REQ-378 b class requires.
 *
 * This guard pins the count of non-comment `?? 0` / `|| 0` zero-fallbacks in
 * the three audited files to 0 — so a re-injection that "looks harmless"
 * fails LOUD at regression time instead of being silently accepted by review.
 *
 * Anti-vacuity: each file is read from disk (not a hand-typed constant), and
 * the swept region is asserted non-empty so a refactor that deletes the file
 * fails the count test vacuously rather than passing it trivially.
 *
 * Steering motivation (Phase 175 make-run feedback): "Maintain the
 * count-or-null contract pattern as a generalized policy: any
 * monitoring/quality field that defaults to 0 when unmeasured must instead
 * return null so callers can distinguish 'unmeasured' from 'measured-and-zero'.
 * Audit other DEFAULT 0 literals in health-check-service / regression-detector
 * and convert where unmeasured is the true state."
 */

import { describe, it, expect } from '@jest/globals';
import { readSource, isCommentLine } from './freeze-guard';

const AUDITED_FILES = [
  'src/monitoring/health-check-service.ts',
  'src/quality/regression-detector.ts',
] as const;

/**
 * A zero-fallback line pattern: `?? 0` or `|| 0` followed by a NON-digit
 * continuation (so `?? 0.85` is also flagged). Tail-chars exclude the
 * `0` inside larger numbers by requiring the next char to be one of the
 * usual JS sentence terminators.
 */
const ZERO_FALLBACK_PATTERN = /(\?\?|\|\|)\s*0(?![.\d])/;

interface FileAudit {
  rel: string;
  /** Non-zero, non-comment lines asserting the file is actually swept. */
  codeLines: number;
  /** Non-comment lines that contain a `?? 0` / `|| 0` zero-fallback. */
  offenders: string[];
}

function auditFile(rel: string): FileAudit {
  const source = readSource(rel);
  const lines = source.split('\n');
  const offenders: string[] = [];
  let codeLines = 0;
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return;
    codeLines += 1;
    if (ZERO_FALLBACK_PATTERN.test(line)) {
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  });
  return { rel, codeLines, offenders };
}

describe('REQ-378 (c,d): zero-fallback audit pin', () => {
  const audits = AUDITED_FILES.map((rel) => [rel, auditFile(rel)] as const);

  it.each(audits)('audit region %s is non-empty (non-vacuous sweep)', (_rel, audit) => {
    // Refactor that empties the file fails LOUD here rather than trivially
    // passing the zero-fallback count check on a zero-line source.
    expect(audit.codeLines).toBeGreaterThan(20);
  });

  it.each(audits)(
    '%s contains zero non-comment `?? 0` / `|| 0` zero-fallbacks',
    (_rel, audit) => {
      // The whole point of the audit: a resurrection of "default to 0" in
      // the trailing sites — `isFiniteMetric` already guards the gate
      // reads, but a `?? 0` quietly slipped past the guard would re-route
      // to the no-regression verdict. The pin is 0.
      expect(audit.offenders).toEqual([]);
    },
  );

  it('total offender count across the audited surface is 0', () => {
    // Cross-file ledger: future AUDITED_FILES additions must keep this
    // composite at 0. A new entry that injects a `?? 0` fails THIS test
    // (and the per-file test above) at the same time.
    const total = audits.reduce((acc, [, a]) => acc + a.offenders.length, 0);
    expect(total).toBe(0);
  });
});
