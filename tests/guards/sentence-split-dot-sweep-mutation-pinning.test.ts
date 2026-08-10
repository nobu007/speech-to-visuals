/**
 * @jest-environment node
 */
/**
 * sentence-split-dot-sweep-mutation-pinning.test.ts — TC-309
 *
 * Pins the "decimal-safe sentence splitter" invariant — a RECURRING bug class
 * (see MEMORY: "MISSED-SIBLING-SITE — the project's core lesson") — as a
 * structural source sweep over src/analysis.
 *
 * THE BUG CLASS. A regex character class like `[.!?。]` contains a LITERAL dot
 * (inside `[...]` the `.` has no special meaning), so `.split(/[.!?。]/)` splits
 * on EVERY dot — including the decimal in "1.5", the version "2.0", the IP
 * "192.168.1.1", the percent "99.9%". Decimal-bearing text then tore across
 * node labels / summaries / context: "The ratio is 1.5 to 1." → "The ratio is
 * 1" + "5 to 1". The canonical neutralization (landed in diagram-detector
 * extractKeyPhrases as daebbc45, and in scene-segmenter
 * splitTextAtSentenceBoundaries before that) is to treat an English '.' as a
 * boundary ONLY via `\.(?:\s+|$)` — never as a bare member of the class:
 *
 *   BAD:  .split(/[.!?。！？]+/)            // '.' tears "1.5" → "1" + "5"
 *   GOOD: .split(/[!?。！？]+|\.(?:\s+|$)/) // intra-token dots preserved
 *
 * This is a CLASS, not a single guard: daebbc45 fixed ONE site
 * (diagram-detector extractKeyPhrases) but the identical bare-'.' defect
 * survived in FIVE more sentence splitters and ONE word tokenizer across
 * src/analysis — exactly the "one site's fix is NEVER sufficient" trap. Each
 * new splitter that puts a bare '.' back in its class re-opens the class.
 *
 * WHY A STRUCTURAL SWEEP. Layer 1 pins the safe form at the 4 files that were
 * buggy. Layer 2 is the class-closing invariant: it scans the WHOLE src/analysis
 * tree for any `.split(`/`<re>` whose regex has an UNESCAPED '.' inside a `[...]`
 * class — so a future splitter added with a bare '.' fails CI immediately,
 * independent of any behavioral test. Layer 3 proves the dot rule is
 * load-bearing (bare '.' tears a decimal; `\.(?:\s+|$)` preserves it while still
 * splitting real sentence boundaries).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The safe boundary — every sentence splitter that needs to honor a '.' must
// spell it this way, NOT as a bare member of its `[...]` class.
const SAFE_DOT_BOUNDARY = '\\.(?:\\s+|$)';

// The 4 src/analysis files that held the bare-'.' defect (6 split sites total —
// diagram-detector and complexity-detector each carry two).
const ANALYSIS_SPLIT_FILES = [
  'src/analysis/content-analyzer.ts',
  'src/analysis/scene-segmenter.ts',
  'src/analysis/complexity-detector.ts',
  'src/analysis/diagram-detector.ts',
];

/**
 * Extract the regex-LITERAL bodies passed to `.split(/.../)` in `source`.
 *
 * Tracks escape (`\\.`) and character-class (`[...]`) state so a `/` that is a
 * literal class member (e.g. diagram-detector's word tokenizer class contains
 * `/`) is NOT mistaken for the regex close. Returns each body without its
 * surrounding `/ /` delimiters.
 */
function extractSplitRegexBodies(source: string): string[] {
  const bodies: string[] = [];
  let idx = 0;
  while (true) {
    const at = source.indexOf('.split(', idx);
    if (at < 0) break;
    let i = at + '.split('.length;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== '/') { idx = at + 1; continue; } // not a regex literal
    i++; // past opening '/'
    let body = '';
    let inClass = false;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') { body += c + (source[i + 1] ?? ''); i += 2; continue; }
      if (c === '[') { inClass = true; body += c; i++; continue; }
      if (c === ']' && inClass) { inClass = false; body += c; i++; continue; }
      if (c === '/' && !inClass) break; // closing delimiter
      body += c; i++;
    }
    bodies.push(body);
    idx = i + 1;
  }
  return bodies;
}

/**
 * Return every `[...]` class in `body` that contains an UNESCAPED '.' — the
 * forbidden "bare dot in a class" signature.
 */
function bareDotClasses(body: string): string[] {
  const offenders: string[] = [];
  const classRe = /\[([^\][]*)\]/g; // class content (no nested/escaped brackets here)
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(body)) !== null) {
    const content = m[1];
    // an unescaped '.' somewhere in the class content
    if (/(?<!\\)\./.test(content)) offenders.push(`[${content}]`);
  }
  return offenders;
}

// Recursively collect non-test .ts files under a directory.
function collectTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // skip the test-tree entirely — test fixtures may legitimately split on '.'
      if (entry === '__tests__' || entry === '__mocks__') continue;
      collectTs(full, acc);
    } else if (entry.endsWith('.ts') && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
}

// --- (TC-309-01) source anchors: the safe dot-boundary is present ---------------

describe('decimal-safe splitter — safe form pinned per file (TC-309-01)', () => {
  it.each(ANALYSIS_SPLIT_FILES)('%s uses the decimal-safe dot boundary', (file) => {
    // Each file that split on a bare '.' now spells the boundary as
    // `\.(?:\s+|$)`. A drift that reverts to a bare class-member '.' drops
    // this anchor → RED (caught again by the sweep in TC-309-02).
    const src = readFileSync(file, 'utf8');
    expect(src).toContain(SAFE_DOT_BOUNDARY);
  });
});

// --- (TC-309-02) structural class sweep: NO bare '.' in any split class ---------

describe('decimal-safe splitter — structural class sweep (TC-309-02)', () => {
  it('no src/analysis non-test .ts splits on a bare "." inside a character class', () => {
    // THE CLASS-CLOSING INVARIANT. Any splitter in src/analysis that puts a
    // bare '.' in its `[...]` class tears decimals. A future splitter added
    // with the bare-'.' defect lands here → RED, independent of behavioral tests.
    const repoRoot = process.cwd(); // jest runs from the repo root
    const files = collectTs(join(repoRoot, 'src/analysis'));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const body of extractSplitRegexBodies(src)) {
        for (const cls of bareDotClasses(body)) {
          offenders.push(`${f.replace(repoRoot + '/', '')}  split(/${body}/)  class ${cls}`);
        }
      }
    }
    expect(offenders).toEqual([]); // no splitter may carry a bare-dot class
  });
});

// --- (TC-309-03) mutation witness: the dot rule is load-bearing ----------------

describe('decimal-safe splitter — mutation witness (TC-309-03)', () => {
  it('a bare "." class tears a decimal; the safe boundary preserves it', () => {
    // This is the BUG shape — what the guard defends against. The bare-'.'
    // class splits on the decimal dot, severing "1.5" into "1" + "5 to 1".
    // The safe boundary splits only on a sentence-ending dot.
    const text = 'The ratio is 1.5 to 1.';

    const mutated = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    // Bare '.' tore the decimal — no fragment contains the intact "1.5".
    expect(mutated.some(s => s.includes('1.5'))).toBe(false);
    expect(mutated).toContain('5 to 1'); // the orphan tail fragment

    const safe = text.split(/[!?]+|\.(?:\s+|$)/).map(s => s.trim()).filter(Boolean);
    // The safe boundary kept "1.5" intact and still split the real end-of-sentence.
    expect(safe.some(s => s.includes('1.5'))).toBe(true);
    expect(safe).not.toContain('5 to 1');
  });
});
