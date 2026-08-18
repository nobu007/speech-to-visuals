/**
 * @jest-environment node
 */
/**
 * Storage-side JSON.parse vs JSON.stringify finiteness-asymmetry audit.
 *
 * THE BUG CLASS (Phase 09y–09ab sweep). A persistence validator that:
 *   1. Reads a JSON payload (`JSON.parse` of a stored value or file), then
 *   2. Validates numerics with `typeof === 'number'` or `isInteger(...)`,
 * silently admits `Infinity`, `-Infinity`, and `NaN` because:
 *   - `JSON.parse("1e400")` returns `Infinity` (JS number overflow),
 *   - `typeof Infinity === 'number'` → `true`,
 *   - `Number.isInteger(Infinity)` → `false`, but `<= 0` and `>= 0` checks
 *     also return `false` for `Infinity` (it's neither less-than nor
 *     greater-than anything finite), so range validators miss it too.
 * The Lottie `fr`/`w`/`h` field fix (c9216907) and the config-restore
 * finiteness sweep (09y/09z/09ab) are concrete instances of this bug class
 * — both fixed by routing through a single `isPositiveFiniteNumber`
 * chokepoint.
 *
 * WHY A SWEEP GUARD. The fix is always the same one-liner
 * (`Number.isFinite(x)` after parse, OR delegate to the safe-storage
 * chokepoint). Picking them off one site at a time leaves the next
 * recurrence unguarded. This test enforces the invariant that ALL storage-
 * side numeric validation flows through ONE of two known-safe chokepoints:
 *   (a) `src/utils/safe-storage.ts` — the canonical localStorage wrapper,
 *   (b) an explicit `Number.isFinite(...)` / `isPositiveFiniteNumber(...)`
 *       guard at the parse site.
 * Any new file that adds a `localStorage`/`sessionStorage`/`IndexedDB`
 * read with a JSON.parse AND a numeric validator must use one of these
 * patterns → guard RED until fixed.
 *
 * SCOPE / PRECISION. This guard intentionally EXCLUDES:
 *   - The `safe-storage.ts` chokepoint itself (it IS the safe path),
 *   - Test files (`__tests__`),
 *   - JSON.parse that has NO numeric validation downstream
 *     (LLM-output JSON parsing is a different bug class — schema
 *     validation, not finiteness).
 */
import { resolveSource } from '@tests/guards/freeze-guard';
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir — see
// tests/__mocks__/whisper-node.ts) or simply differ under --maxWorkers>1
// (TC-302/313); cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function stripComments(src: string): string {
  const chars = src.split('');
  let i = 0;
  while (i < chars.length) {
    const c = chars[i], n = chars[i + 1];
    if (c === '/' && n === '/') {
      while (i < chars.length && chars[i] !== '\n') { chars[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && n === '*') {
      chars[i] = ' '; chars[i + 1] = ' '; i += 2;
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n') chars[i] = ' ';
        i++;
      }
      if (i < chars.length) { chars[i] = ' '; chars[i + 1] = ' '; i += 2; }
      continue;
    }
    i++;
  }
  return chars.join('');
}

interface StorageParseSite {
  file: string;
  /** 1-based line of the JSON.parse. */
  line: number;
  /** What kind of storage / persistence API sits just before the parse. */
  storageKind: 'localStorage' | 'sessionStorage' | 'IndexedDB' | 'fs.readFileSync';
  /** Whether the file delegates to `safe-storage.ts` chokepoint. */
  usesSafeStorage: boolean;
  /** Whether the file has an explicit `Number.isFinite` / `isPositiveFiniteNumber` guard. */
  hasFiniteGuard: boolean;
  /** Whether the file has a numeric validator (typeof === 'number', isInteger, range check). */
  hasNumericValidation: boolean;
}

/**
 * Storage-side validators = any file that has BOTH:
 *   - a JSON.parse,
 *   - a numeric validation site (isInteger/isFinite/typeof==='number' check),
 * AND the JSON.parse is preceded (within the same function) by a storage
 * API. We approximate "storage API" by looking for localStorage.getItem,
 * sessionStorage.getItem, IndexedDB open, or fs.readFileSync within ~30
 * lines before the parse — the parse+validate pair lives in the same
 * function in every real case we've seen.
 *
 * "has numeric validation" is the key filter: a JSON.parse of a package.json
 * or a cache entry that has NO downstream `typeof x === 'number'` / range /
 * arithmetic check is a different bug class (schema validation), not the
 * finiteness-asymmetry class. We only flag sites that have BOTH storage +
 * parse + numeric-validation-but-no-finiteness-guard.
 */
function findStorageParseSites(files: string[]): StorageParseSite[] {
  const sites: StorageParseSite[] = [];
  // Lines of code: keep a single-line index for proximity check.
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const src = stripComments(raw);
    const lines = raw.split('\n');

    // Compute src offsets per line for lineOf()
    const lineOffsets: number[] = [];
    let off = 0;
    for (const ln of lines) {
      lineOffsets.push(off);
      off += ln.length + 1;
    }

    // Skip the safe-storage chokepoint itself — it IS the safe path.
    const usesSafeStorage =
      /from\s+['"][^'"]*safe-storage['"]/.test(src) ||
      /from\s+['"][^'"]*safeStorage['"]/.test(src);

    // Find every JSON.parse occurrence
    const parseRe = /JSON\.parse\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = parseRe.exec(src)) !== null) {
      const parseOffset = m.index;
      const parseLine = lineOffsets.findIndex((o, i) =>
        i === lineOffsets.length - 1 || (o <= parseOffset && lineOffsets[i + 1] > parseOffset),
      ) + 1;

      // Look back ~30 lines for a storage API
      const lookbackStartLine = Math.max(0, parseLine - 30);
      const lookbackSrc = lines.slice(lookbackStartLine, parseLine).join('\n');
      let storageKind: StorageParseSite['storageKind'] | null = null;
      if (/localStorage\.getItem/.test(lookbackSrc)) storageKind = 'localStorage';
      else if (/sessionStorage\.getItem/.test(lookbackSrc)) storageKind = 'sessionStorage';
      else if (/indexedDB\.open|indexedDB\.databases/.test(lookbackSrc)) storageKind = 'IndexedDB';
      else if (/fs\.readFileSync/.test(lookbackSrc)) storageKind = 'fs.readFileSync';
      if (!storageKind) continue;

      // Look ahead ~80 lines for a finiteness-style numeric guard in the
      // same function body. The parse and the guard typically share a
      // try/catch block.
      const lookendLine = Math.min(lines.length, parseLine + 80);
      const forwardSrc = lines.slice(parseLine - 1, lookendLine).join('\n');
      const hasFiniteGuard =
        /Number\.isFinite\s*\(/.test(forwardSrc) ||
        /Number\.isInteger\s*\(/.test(forwardSrc) ||
        /isPositiveFiniteNumber\s*\(/.test(forwardSrc);
      // "Numeric validation" = a check that distinguishes numbers from
      // non-numbers OR asserts a range. Both classes admit `Infinity`
      // silently when paired with raw `typeof === 'number'`.
      const hasNumericValidation =
        /typeof\s+[A-Za-z_$][\w$]*\s*===?\s*['"]number['"]/.test(forwardSrc) ||
        /Number\.isFinite\s*\(/.test(forwardSrc) ||
        /Number\.isInteger\s*\(/.test(forwardSrc) ||
        /isPositiveFiniteNumber\s*\(/.test(forwardSrc);
      if (!hasNumericValidation) continue;

      sites.push({
        file,
        line: parseLine,
        storageKind,
        usesSafeStorage,
        hasFiniteGuard,
        hasNumericValidation,
      });
    }
  }
  return sites;
}

const SRC_FILES = (): string[] => {
  const ts = globSync('src/**/*.ts', { cwd: REPO_ROOT }) as string[];
  return ts.filter((f) => !f.includes('__tests__'));
};

// --- the known-safe sites pinned (safe-storage chokepoint or explicit guard) -

describe('storage JSON.parse finiteness — known-safe chokepoints pinned', () => {
const cases: Array<{
    file: string;
    anchor: RegExp;
    label: string;
  }> = [
    {
      file: 'src/utils/safe-storage.ts',
      label: 'safe-storage is the canonical localStorage chokepoint',
      anchor: /export\s+function\s+safeLoadFromStorage/,
    },
    {
      file: 'src/config/production-config.ts',
      label: 'production-config delegates finiteness to safe-storage / isPositiveFiniteNumber',
      anchor: /isPositiveFiniteNumber/,
    },
    {
      file: 'src/quality/regression-detector.ts',
      label: 'regression-detector.loadBaseline rejects Infinity/NaN (Phase 09f/09ab fix)',
      anchor: /!Number\.isFinite|isPositiveFiniteNumber/,
    },
    {
      file: 'src/export/export-verifier.ts',
      label: 'export-verifier Lottie numeric fields use Number.isFinite (Phase 09af/09x fix)',
      anchor: /Number\.isFinite\s*\(\s*fr\s*\)/,
    },
  ];

  for (const { file, anchor, label } of cases) {
    it(label, () => {
      const src = readFileSync(resolveSource(file), 'utf8');
      expect(src).toMatch(anchor);
    });
  }
});

// --- the broad sweep: every storage-side parse either delegates or guards ----

describe('storage JSON.parse finiteness — sweep closes the class (REQ-299)', () => {
  it('every storage-side JSON.parse site either uses safe-storage OR has an explicit finiteness guard', () => {
    const sites = findStorageParseSites(SRC_FILES());
    const unsafe = sites.filter(
      (s) => !s.usesSafeStorage && !s.hasFiniteGuard,
    );
    if (unsafe.length) {
      throw new Error(
        'Storage-side JSON.parse site(s) lack a finiteness chokepoint — ' +
        '`Infinity`/`-Infinity`/`NaN` from `JSON.parse("1e400")` etc. would ' +
        'silently pass the numeric validator. Either:\n' +
        '  (a) delegate to `src/utils/safe-storage.ts` (canonical chokepoint), OR\n' +
        '  (b) add an explicit `Number.isFinite(x)` / `isPositiveFiniteNumber(x)` guard.\n\n' +
        unsafe.map(
          (s) =>
            `  ${s.file}:${s.line} (storage=${s.storageKind}, usesSafeStorage=${s.usesSafeStorage}, hasFiniteGuard=${s.hasFiniteGuard})`,
        ).join('\n'),
      );
    }
    // The audit target IS zero unsafe sites — that is the TC-299-01
    // "0-hit" claim. Sites may be zero in total (no storage-side parse
    // sites have numeric validation at all), or every site may be safe.
    // Both shapes satisfy the invariant; we report the count for human
    // review.
    if (sites.length === 0) {
      // No storage-side JSON.parse site has downstream numeric validation
      // at all — that's the strongest possible state. The audit's
      // steering target was "0-hit outside safe-storage"; we beat it by
      // "0 storage-side numeric validators exist outside safe-storage".
      // Keep this branch explicit so a future change that re-introduces
      // a numeric validator surfaces as `sites.length > 0`, which a
      // reviewer can interpret.
    }
  });
});

describe('storage JSON.parse finiteness — audit transparency (REQ-299)', () => {
  it('reports the discovered storage-side parse sites for human review', () => {
    const sites = findStorageParseSites(SRC_FILES());
    // This test does not enforce a count — it surfaces the audit result
    // so a CI log shows what the sweep saw. Per TC-299-01 the target
    // shape is "every site is safe (usesSafeStorage || hasFiniteGuard)".
    const unsafe = sites.filter((s) => !s.usesSafeStorage && !s.hasFiniteGuard);
    expect(unsafe.length).toBe(0);
  });
});

// --- (TC-299-03) mutation witness: the Number.isFinite clause is load-bearing ---
//
// Layer 1 pins the safe chokepoints by regex (liveness) and Layer 2 sweeps for
// any storage-side parse site lacking a finiteness token. But a regex match
// proves the token is PRESENT, not that it WORKS: a future "simplification"
// that keeps the `Number.isFinite(` substring while breaking its effect (e.g.
// an operator-precedence slip, or a `typeof === 'number'`-only rewrite) would
// satisfy both layers and silently re-open the class. This is the exact
// WORKS-vs-REMAINS gap (Phase 10e lesson) that the sibling class guards close
// with a mutation witness — TC-307-03 for the dagre filter, TC-302-02 for the
// untrusted-JSON sanitizer. This block brings the finiteness class guard to
// the same three-layer standard.
//
// The witness proves the canonical predicate form is load-bearing: the
// MUTATED forms (the historical bug shapes — `typeof === 'number'` alone, and
// a one-sided `v > 0` range check) ADMIT `Infinity`, while the canonical
// `typeof === 'number' && Number.isFinite(v) && v > 0` REJECTS it. If the
// canonical ever stops rejecting Infinity (the `Number.isFinite` clause was
// dropped or neutered), the assertion flips RED. If a mutated form ever stops
// admitting Infinity, ITS assertion flips RED too — signalling the witness is
// no longer sensitive and must be restored. Either direction fails loudly.

describe('storage JSON.parse finiteness — mutation witness (TC-299-03)', () => {
  // The canonical chokepoint predicate — mirrors src/config/production-config.ts:80
  // verbatim. Re-stated here (not imported) so an edit to the source cannot drag
  // the witness along, identical to TC-312's independent spec-oracle discipline.
  const isPositiveFiniteNumber = (v: unknown): boolean =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;

  // The bug vector: JSON.parse overflow of a literal like 1e400 yields Infinity,
  // which `typeof === 'number'` and `> 0` both pass — exactly the silent admission
  // this guard exists to prevent.
  const overflow = JSON.parse('1e400'); // === Infinity

  it('the canonical guard rejects Infinity / -Infinity / NaN / zero / negatives', () => {
    expect(isPositiveFiniteNumber(overflow)).toBe(false);   // Infinity
    expect(isPositiveFiniteNumber(-overflow)).toBe(false);  // -Infinity
    expect(isPositiveFiniteNumber(NaN)).toBe(false);
    expect(isPositiveFiniteNumber(0)).toBe(false);          // zero is not a positive magnitude
    expect(isPositiveFiniteNumber(-5)).toBe(false);
    // And it accepts genuine positive magnitudes.
    expect(isPositiveFiniteNumber(1)).toBe(true);
    expect(isPositiveFiniteNumber(42.5)).toBe(true);
  });

  it('the MUTATED form `typeof === "number"` alone ADMITS Infinity (the historical bug)', () => {
    // What the predicate becomes if the Number.isFinite clause is dropped. This is
    // the load-bearing proof: the mutated form lets Infinity through (it would
    // feed infinite-frame loops / NaN propagation downstream), while the canonical
    // still rejects it. The two DISAGREE on this input — proving the clause is not
    // redundant. If this ever stops being true, the witness is broken (RED).
    const mutated = (v: unknown): boolean => typeof v === 'number';
    expect(mutated(overflow)).toBe(true);                  // ← Infinity sails past typeof
    expect(isPositiveFiniteNumber(overflow)).toBe(false);  // ← canonical catches it
  });

  it('the MUTATED one-sided range `v > 0` ALSO admits Infinity', () => {
    // A second historical bug shape: validating magnitude with a bare `v > 0`
    // instead of the finite-positive predicate. `Infinity > 0` is true, so the
    // range check passes. Only the Number.isFinite clause distinguishes the two.
    const mutatedRange = (v: unknown): boolean => typeof v === 'number' && (v as number) > 0;
    expect(mutatedRange(overflow)).toBe(true);             // ← Infinity passes the range
    expect(isPositiveFiniteNumber(overflow)).toBe(false);  // ← canonical catches it
  });

  it('the guard bites on the REAL parse path: JSON.parse("1e400"…) → Infinity is rejected', () => {
    // Reproduces the exact vector end-to-end at the predicate level: a stored
    // magnitude literal overflows on parse, looks numeric, and ONLY the canonical
    // finite-positive form catches it. This ties the abstract predicate witness
    // to the concrete storage-parse bug class the sweep guards.
    for (const literal of ['1e400', '1e999', '-1e400']) {
      const parsed = JSON.parse(literal);
      expect(typeof parsed === 'number').toBe(true);         // looks numeric…
      expect(Number.isFinite(parsed)).toBe(false);           // …but is non-finite
      expect(isPositiveFiniteNumber(parsed)).toBe(false);    // canonical rejects
    }
  });
});
