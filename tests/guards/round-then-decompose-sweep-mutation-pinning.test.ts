/**
 * @jest-environment node
 */
/**
 * round-then-decompose-sweep-mutation-pinning.test.ts — TC-310
 *
 * Pins the "round-then-decompose" invariant — a RECURRING bug class (see
 * MEMORY: "MISSED-SIBLING-SITE — the project's core lesson") — as a structural
 * source sweep over all of src/.
 *
 * THE BUG CLASS. When decomposing a quantity into a larger unit + remainder
 * (seconds → minutes+seconds, ms → s+ms, bytes → KB+B, …), the TOTAL must be
 * rounded/clamped to the smaller unit's grid BEFORE the division/modulo. The
 * recurring defect is the inverse: round the REMAINDER in isolation.
 *
 *   BAD:  Math.round(seconds % 60)   // 119.5s → 1m, remainder=59.5 → "1分60秒"
 *   BAD:  Math.round(seconds) < 60 → "60秒" for 59.5s (violates the <60 guard)
 *   GOOD: const total = Math.round(seconds); Math.floor(total/60); total % 60
 *
 * `total % 60` (total already integral) is BOUNDED in [0, 59]; a rounded
 * fractional remainder is not — it can equal the divisor (60). `Math.floor(x%N)`
 * is always safe (x%N < N ⇒ floor keeps it < N); only `Math.round`/`Math.ceil`
 * on a modulo operand can reach the divisor.
 *
 * This is a CLASS, not a single guard: animated-scene-renderer's subtitle
 * formatter was fixed first, then the IDENTICAL defect survived in
 * StageIndicator.formatElapsed until TC-310 — exactly the "one site's fix is
 * NEVER sufficient" trap. Each new formatter that rounds a modulo re-opens it.
 *
 * WHY A STRUCTURAL SWEEP. Layer 1 pins the safe form at StageIndicator. Layer 2
 * is the class-closing invariant: it scans ALL of src/ for any `Math.round` /
 * `Math.ceil` whose argument contains a `%` (modulo) — so a future formatter
 * added with the defect fails CI immediately, independent of behavioral tests.
 * Layer 3 proves the rule is load-bearing (rounded remainder → "1分60秒";
 * round-total-first → "2分").
 *
 * SCOPE LIMITATION. The detector finds a `%` within the balanced argument span
 * of Math.round/Math.ceil. A modulo nested behind several function calls is
 * still caught (balanced-paren scan); a `%` inside a string literal within the
 * args would be a false positive (vanishingly rare in numeric rounding code).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd(): jest workers can run with a
// cwd that is not the repo root, which flaked the bare relative form under
// --maxWorkers>1 (same as TC-302/313).
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// Recursively collect non-test .ts/.tsx files under a directory.
function collectTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      collectTs(full, acc);
    } else if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * For every `Math.round(` / `Math.ceil(` in `source`, return the argument
 * span if it contains a top-level `%` (modulo) — the defect signature. Uses a
 * balanced-paren scan so a modulo nested behind calls (e.g.
 * `Math.round(f(x) % 60)`) is still detected, which a flat `[^)]*%` regex
 * would miss.
 */
function roundCeilModuloSites(source: string): string[] {
  const hits: string[] = [];
  const openers = ['Math.round(', 'Math.ceil('];
  for (const opener of openers) {
    let from = 0;
    while (true) {
      const at = source.indexOf(opener, from);
      if (at < 0) break;
      let i = at + opener.length;
      let depth = 1;
      let arg = '';
      while (i < source.length && depth > 0) {
        const c = source[i];
        if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) break;
        }
        arg += c;
        i++;
      }
      // A `%` anywhere in the balanced argument is the modulo-on-remainder smell.
      if (arg.includes('%')) hits.push(`${opener}${arg.trim()}%)`);
      from = i + 1;
    }
  }
  return hits;
}

// --- (TC-310-01) source anchor: StageIndicator uses the safe form ---------------

describe('round-then-decompose — safe form pinned at StageIndicator (TC-310-01)', () => {
  it('StageIndicator.formatElapsed rounds the TOTAL before decomposing', () => {
    // The canonical fix: `const total = Math.round(seconds)` THEN `total % 60`,
    // never `Math.round(seconds % 60)`. A revert to the rounded-remainder form
    // drops BOTH anchors → RED (also re-caught by the sweep in TC-310-02).
    const src = readFileSync(join(REPO_ROOT, 'src/components/StageIndicator.tsx'), 'utf8');
    expect(src).toContain('const total = Math.round(seconds)');
    expect(src).toContain('total % 60');
    // The defect signature must NOT survive here.
    expect(src).not.toContain('Math.round(seconds % 60)');
  });
});

// --- (TC-310-02) structural class sweep: NO Math.round/ceil on a modulo ---------

describe('round-then-decompose — structural class sweep (TC-310-02)', () => {
  it('no src/ non-test .ts/.tsx applies Math.round/ceil to a modulo operand', () => {
    // THE CLASS-CLOSING INVARIANT. `Math.floor(x % N)` is always safe (the
    // remainder is < N); only `Math.round`/`Math.ceil` on a modulo can reach
    // the divisor ("1分60秒", "60秒"). Any formatter added with this shape
    // lands here → RED, independent of behavioral tests.
    const repoRoot = REPO_ROOT;
    const files = collectTs(join(repoRoot, 'src'));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const site of roundCeilModuloSites(src)) {
        offenders.push(`${f.replace(repoRoot + '/', '')}  ${site}`);
      }
    }
    expect(offenders).toEqual([]); // no formatter may round/ceil a modulo
  });
});

// --- (TC-310-03) mutation witness: the round-total rule is load-bearing ---------

describe('round-then-decompose — mutation witness (TC-310-03)', () => {
  it('a rounded remainder yields "1分60秒"; round-total-first yields "2分"', () => {
    // The BUG shape — what the guard defends against. Rounding the remainder
    // of 119.5s in isolation: floor(119.5/60)=1, round(119.5%60)=round(59.5)=60
    // → the impossible "1分60秒". Rounding the total first (120) decomposes
    // cleanly to "2分".
    const seconds = 119.5;

    // Defective form (rounded remainder).
    const defectiveMins = Math.floor(seconds / 60);
    const defectiveSecs = Math.round(seconds % 60);
    const defective = `${defectiveMins}分${defectiveSecs}秒`;
    expect(defectiveSecs).toBe(60); // remainder reached the divisor — the tell
    expect(defective).toBe('1分60秒');

    // Safe form (round total, then decompose on the integer).
    const total = Math.round(seconds);
    const safeMins = Math.floor(total / 60);
    const safeSecs = total % 60;
    expect(safeSecs).toBeLessThan(60); // bounded — can never reach the divisor
    expect(safeMins).toBe(2);
    expect(safeSecs).toBe(0); // 120 s → exactly 2 min, zero remainder
    // The formatter drops the "0秒" suffix when the remainder is zero.
    const safe = safeSecs > 0 ? `${safeMins}分${safeSecs}秒` : `${safeMins}分`;
    expect(safe).toBe('2分');
  });
});
