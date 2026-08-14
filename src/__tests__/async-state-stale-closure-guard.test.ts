/**
 * @jest-environment node
 */
/**
 * Post-await / post-loop React-state stale-closure read — structural guard.
 *
 * THE BUG CLASS (09c). A React component/hook does `const [X, setX] =
 * useState(...)`. Inside ONE async handler/callback (or one synchronous loop)
 * it calls `setX(...)` and then, after an `await` (or after the loop), reads the
 * bare state identifier `X` expecting the value it just set. But within a single
 * invocation the closure binding of `X` never refreshes — `setX` only schedules
 * a render — so the post-await/post-loop read returns the STALE pre-call value.
 *
 * Two live instances were fixed:
 *   - StreamingProcessor.handleFileProcessing (09c) — after `await
 *     transcribeStream(...)`, `onComplete(scenes)` reported "0 scenes".
 *     Fix: a synchronous `useRef` mirror (`scenesRef.current`) updated alongside
 *     `setScenes`, read post-await instead of the closure.
 *   - Iteration43Interface.startProcessing (09v / 75351f92) — a loop called
 *     `setQualityMetrics` per iteration, then the post-loop log read
 *     `qualityMetrics.overallScore` (0.0%). Fix: a local `let finalOverallScore`
 *     accumulator assigned in the loop, read post-loop.
 *
 * WHY THIS CLASS IS HARDER TO GUARD THAN listener-registration. The listener
 * leak has a SYNTACTIC contract ("a register method that pushes a callback must
 * return `() => void`") — grep-clean, ~zero false positives. The stale-closure
 * class has NO syntactic contract: "setX, then await/loop, then read X" is the
 * NORMAL shape of almost every async React handler (you setX at the start, await
 * work, and the JSX later renders X). The bug is indistinguishable from correct
 * code by shape alone — only by SEMANTICS (does the post-await read expect the
 * value the setX/await produced?). A file-level or component-level sweep drowns
 * in false positives (JSX render reads, useCallback dependency-array reads, hook
 * return-object reads, reads in a SIBLING callback, reads of a value preserved
 * unchanged across `setX(prev => ({...prev, ...}))`).
 *
 * THE NARROWING that makes a sweep viable: analyze at ASYNC-HANDLER-BODY
 * granularity (the balanced `{...}` of each `async` function/arrow), not the
 * enclosing component. This automatically excludes (a) dependency arrays and
 * hook return objects (they live OUTSIDE the handler body) and (b) reads in
 * sibling callbacks. Within the handler body we additionally exclude the JSX
 * render region (from `return (` onward) since reads there are render reads, and
 * the bug only ever manifests in IMPERATIVE post-await/post-loop logic.
 *
 * Even so the sweep is HEURISTIC: a flagged handler is "at-risk" (it both writes
 * and post-await/loop reads the same state) — not necessarily buggy. So the
 * guard is an ENUMERATED CONTRACT, mirroring listener-registration:
 *   (1) The two KNOWN fixes are pinned structurally — reverting either is RED.
 *   (2) Every at-risk handler found by the sweep MUST be registered in
 *       AT_RISK_HANDLERS with a documented safe-mechanism. A brand-new at-risk
 *       handler (the next Iteration43, in a different component) is not in the
 *       registry → RED, forcing human classification. A registered handler that
 *       is no longer at-risk → RED (stale entry).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd(): jest workers can run with a
// cwd that is not the repo root, which flaked the bare relative form under
// --maxWorkers>1 (same as TC-302/313).
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// --- Source-audit helpers (comment+string-stripped + balanced scanning) ------

/**
 * Neutralize comments AND string/char-literal contents, replacing each
 * neutralized char with a space (newlines preserved) so offsets and line numbers
 * are STABLE. String-stripping is essential here (unlike the listener guard,
 * which scans signatures): we scan bare identifiers, and without it the word
 * `error` inside `setStatus('error')` / `'Unknown error'` would read as a
 * state-var read and drown the sweep in false positives.
 *
 * Template literals need special care: their `${...}` interpolations are CODE
 * (and that is exactly where a stale-closure read hides — e.g. a log line
 * `${stateVar.field}`), so interpolations are PRESERVED while the surrounding
 * literal text is blanked. Nested strings inside an interpolation are blanked
 * recursively.
 */
function stripComments(src: string): string {
  const chars = src.split('');
  let i = 0;
  while (i < chars.length) {
    const c = chars[i], n = chars[i + 1];
    if (c === '/' && n === '/') { while (i < chars.length && chars[i] !== '\n') { chars[i] = ' '; i++; } continue; }
    if (c === '/' && n === '*') { chars[i] = ' '; chars[i + 1] = ' '; i += 2; while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) { if (chars[i] !== '\n') chars[i] = ' '; i++; } if (i < chars.length) { chars[i] = ' '; chars[i + 1] = ' '; i += 2; } continue; }
    if (c === '"' || c === "'" || c === '`') { i = blankString(chars, i); continue; }
    i++;
  }
  return chars.join('');
}

/**
 * Blank a string/char/template literal starting at `chars[i] === quote`,
 * PRESERVING `${...}` interpolations (their code is left intact; nested strings
 * inside are blanked recursively). Returns the index just past the closing quote.
 */
function blankString(chars: string[], i: number): number {
  const q = chars[i];
  chars[i] = ' ';
  i++;
  while (i < chars.length) {
    const c = chars[i];
    if (q === '`' && c === '$' && chars[i + 1] === '{') {
      i += 2; // step past `${` (non-word chars; left as-is)
      let depth = 1;
      while (i < chars.length && depth > 0) {
        const cc = chars[i];
        if (cc === '"' || cc === "'" || cc === '`') { i = blankString(chars, i); continue; }
        if (cc === '{') depth++;
        else if (cc === '}') { depth--; if (depth === 0) { i++; break; } }
        i++;
      }
      continue;
    }
    if (c === '\\') { if (chars[i + 1] !== '\n') chars[i + 1] = ' '; chars[i] = ' '; i += 2; continue; }
    if (c === q) { chars[i] = ' '; return i + 1; }
    if (c !== '\n') chars[i] = ' ';
    i++;
  }
  return i;
}

function matchBalanced(src: string, openIdx: number, openCh: string, closeCh: string): number {
  let depth = 0;
  let str: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === '\\') { i++; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function lineOf(src: string, off: number): number {
  let l = 1;
  for (let i = 0; i < off && i < src.length; i++) if (src[i] === '\n') l++;
  return l;
}

interface AsyncHandler {
  name: string;
  /** Absolute offset of the body's opening `{`. */
  bodyBraceIdx: number;
}

/**
 * Yield every `async` function/arrow/method handler in `src`, with the best-
 * effort handler name and its body's opening-brace offset. Anonymous inline
 * arrows are named `<inline>`. Param lists (with nested `()`/`<>`) and an
 * optional `: RetType` annotation are skipped so the body `{` is found reliably.
 */
function* iterAsyncHandlers(src: string): Generator<AsyncHandler> {
  for (const m of src.matchAll(/\basync\b/g)) {
    const ai = m.index;
    // Back-scan for a declaration name: `NAME = [...useCallback(] async` or
    // `NAME: async`. Best-effort; falls back to the forward name below.
    let name: string | null = null;
    const before = src.slice(Math.max(0, ai - 100), ai);
    const bm = before.match(/([a-zA-Z_$][\w$]*)\s*[:=]\s*(?:[\w.]*use(?:Callback|Memo|Effect|LayoutEffect)\s*\(\s*)?$/);
    if (bm) name = bm[1];

    let i = ai + 5;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith('function', i)) i += 8;
    while (i < src.length && /\s/.test(src[i])) i++;
    const nm = src.slice(i).match(/^[a-zA-Z_$][\w$]*/);
    if (nm) { if (!name) name = nm[0]; i += nm[0].length; }
    while (i < src.length && /\s/.test(src[i])) i++;
    // optional generic params <...>
    if (src[i] === '<') {
      const g = matchBalanced(src, i, '<', '>');
      if (g > 0) { i = g + 1; while (i < src.length && /\s/.test(src[i])) i++; }
    }
    if (src[i] !== '(') continue; // not a callable (e.g. `async` in a type)
    const closeP = matchBalanced(src, i, '(', ')');
    if (closeP < 0) continue;
    i = closeP + 1;
    while (i < src.length && /\s/.test(src[i])) i++;
    // optional `: RetType` — skip until `=>` or `{` at depth 0
    if (src[i] === ':') {
      i++;
      let depth = 0; let str: string | null = null;
      while (i < src.length) {
        const c = src[i];
        if (str) { if (c === '\\') { i += 2; continue; } if (c === str) str = null; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { str = c; i++; continue; }
        if (c === '=' && src[i + 1] === '>') { i += 2; break; } // consume `=>`
        if (c === '{' && depth === 0) break;
        if (c === '(' || c === '[' || c === '<') depth++;
        else if (c === ')' || c === ']' || c === '>') depth--;
        i++;
      }
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.slice(i, i + 2) === '=>') { i += 2; while (i < src.length && /\s/.test(src[i])) i++; }
    if (src[i] !== '{') continue; // expression-body arrow — no stale imperative read possible
    yield { name: name || '<inline>', bodyBraceIdx: i };
  }
}

function extractBody(src: string, braceIdx: number): string {
  const end = matchBalanced(src, braceIdx, '{', '}');
  return end > 0 ? src.slice(braceIdx, end + 1) : src.slice(braceIdx);
}

/** Map of state-var name → setter name for every `useState` in the file. */
function useStateVars(src: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of src.matchAll(/const\s+\[\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*(set[a-zA-Z_$][\w$]*)\s*)?\]\s*=\s*useState/g)) {
    const X = m[1];
    const setX = m[2] || ('set' + X.charAt(0).toUpperCase() + X.slice(1));
    vars.set(X, setX);
  }
  return vars;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Offender {
  file: string;
  handler: string;
  stateVar: string;
  pattern: 'A' | 'B';
}

/**
 * Analyze one async handler body for the at-risk shape (not "is it a bug" — only
 * "does it both write and post-await/loop read the same state in imperative
 * code"). Returns one offender per (stateVar, pattern).
 */
function analyzeHandler(file: string, name: string, body: string): Offender[] {
  const offenders: Offender[] = [];
  const vars = useStateVars(/* file-scoped */ readCode(file));
  if (vars.size === 0) return offenders;

  // Exclude the JSX render region: from the first `return (` onward in the body,
  // reads are render reads (the bug only manifests in imperative logic).
  const retM = body.search(/\breturn\s*\(/);
  const logicEnd = retM >= 0 ? retM : body.length;

  const awaitPositions = [...body.matchAll(/\bawait\b/g)].map(m => m.index);

  for (const [X, setX] of vars) {
    const setterRe = new RegExp('(?<![a-zA-Z0-9_$])' + escapeRe(setX) + '\\s*\\(', 'g');
    const setters = [...body.matchAll(setterRe)].map(m => m.index);
    // bare state read: not the setter, not a `.X` member, not an object-key `X:`, not a redeclare
    const readRe = new RegExp('(?<![a-zA-Z0-9_$.])' + escapeRe(X) + '\\b(?!\\s*[:=])', 'g');
    const reads = [...body.matchAll(readRe)]
      .map(m => m.index)
      .filter(r => {
        const ctx = body.slice(Math.max(0, r - 12), r);
        return !/(?:let|const|var)\s+$/.test(ctx) && r < logicEnd;
      });
    if (reads.length === 0) continue;

    // Pattern A: setX before an await, read after that await.
    if (awaitPositions.length) {
      for (const aw of awaitPositions) {
        if (setters.some(s => s < aw) && reads.some(r => r > aw)) {
          offenders.push({ file, handler: name, stateVar: X, pattern: 'A' });
          break;
        }
      }
    }

    // Pattern B: setX inside a loop, read after the loop.
    const loops: Array<[number, number]> = [];
    for (const m of body.matchAll(/\b(?:for|while|do)\b\s*\(/g)) {
      const op = body.indexOf('(', m.index);
      const cp = matchBalanced(body, op, '(', ')');
      if (cp < 0) continue;
      let k = cp + 1;
      while (k < body.length && /\s/.test(body[k])) k++;
      if (body[k] === '{') { const eb = matchBalanced(body, k, '{', '}'); if (eb > 0) loops.push([m.index, eb]); }
    }
    for (const m of body.matchAll(/\.(?:forEach|map|filter|reduce|some|every)\s*\(/g)) {
      const op = m.index + m[0].length - 1;
      const cp = matchBalanced(body, op, '(', ')');
      if (cp > 0) loops.push([m.index, cp]);
    }
    for (const [ls, le] of loops) {
      if (setters.some(s => s > ls && s < le) && reads.some(r => r > le)) {
        offenders.push({ file, handler: name, stateVar: X, pattern: 'B' });
        break;
      }
    }
  }
  return offenders;
}

function readCode(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

// --- The pinned known fixes ---------------------------------------------------

describe('stale-closure class — known fixes pinned (RED on revert)', () => {
  // Each anchor is RED on the pre-fix source and GREEN after. These pin the two
  // concrete bugs so a revert (or copy-paste of the old shape elsewhere) fails.

  it('Iteration43Interface logs the local accumulator, not the stale closure', () => {
    const src = readFileSync(join(REPO_ROOT, 'src/components/Iteration43Interface.tsx'), 'utf8');
    // The accumulator exists and is assigned in-loop.
    expect(src).toMatch(/\blet\s+finalOverallScore\s*=/);
    expect(src).toMatch(/\bfinalOverallScore\s*=/);
    // The completion score log interpolates the accumulator — NOT
    // qualityMetrics.overallScore (the stale closure). Captures the identifier
    // before `.toFixed` in the "Overall quality score" log.
    const logM = src.match(/Overall quality score:[^$]*\$\{\s*([a-zA-Z_$][\w$]*)\.toFixed/);
    if (!logM) {
      throw new Error(
        'Iteration43 completion score log not found, or it does not reference an ' +
        'identifier.toFixed — the stale-closure fix (finalOverallScore accumulator) ' +
        'may have been reverted so the log reads qualityMetrics.overallScore again.',
      );
    }
    expect(logM[1]).toBe('finalOverallScore');
  });

  it('StreamingProcessor reads the synchronous ref mirror after the await', () => {
    const src = readFileSync(join(REPO_ROOT, 'src/components/StreamingProcessor.tsx'), 'utf8');
    // The ref mirror exists.
    expect(src).toMatch(/\bscenesRef\s*=\s*useRef/);
    // The post-await onComplete reads scenesRef.current — NOT the stale `scenes`.
    expect(src).toMatch(/onComplete\(\s*scenesRef\.current\s*\)/);
    // And the stale pre-fix shape is absent.
    expect(src).not.toMatch(/onComplete\(\s*scenes\s*\)/);
  });
});

// --- The enumerated at-risk-handler registry + broad sweep -------------------

/**
 * Every async handler the sweep flags as at-risk (both writes a state var and
 * reads it after an await/loop in imperative code), with the reason it is SAFE.
 * The sweep below MUST produce exactly this set — a brand-new at-risk handler
 * (the next Iteration43 in another component) is not listed → RED.
 */
const AT_RISK_HANDLERS: Array<{
  file: string;
  handler: string;
  stateVar: string;
  pattern: 'A' | 'B';
  safeBecause: string;
}> = [
  {
    file: 'src/hooks/useFrameworkPipeline.ts',
    handler: 'execute',
    stateVar: 'executionState',
    pattern: 'A',
    safeBecause:
      'The pre-await setExecutionState calls all use `...prev` and never change ' +
      '`currentPhase`, so the closure binding equals the post-update value — the ' +
      'post-await read of executionState.currentPhase is not stale.',
  },
  {
    file: 'src/hooks/useFrameworkPipeline.ts',
    handler: 'execute',
    stateVar: 'iterationHistory',
    pattern: 'A',
    safeBecause:
      'The only setIterationHistory in execute (the success-iteration append) runs ' +
      'at line ~231; nothing between it and the end of the try can throw (the only ' +
      'await after it is the auto-commit fetch, guarded by its own try/catch), so ' +
      'the catch-block read of iterationHistory.length cannot observe a post-append ' +
      'length — the stale precondition is structurally unreachable.',
  },
];

describe('stale-closure class — at-risk async handlers enumerated and swept', () => {
  it('every registered handler is still present (rename/removal surfaces loudly)', () => {
    const missing: string[] = [];
    for (const { file, handler } of AT_RISK_HANDLERS) {
      const src = readCode(file);
      const names = new Set([...iterAsyncHandlers(src)].map(h => h.name));
      if (!names.has(handler)) missing.push(`${file} :: ${handler}`);
    }
    expect(missing).toEqual([]);
  });

  it('the sweep flags EXACTLY the registered at-risk handlers (no new, no stale)', () => {
    const files = (globSync(join(REPO_ROOT, 'src/**/*.tsx')) as string[])
      .concat(globSync('src/**/*.ts') as string)
      .filter(f => !f.includes('__tests__'));

    const found: Offender[] = [];
    for (const file of files) {
      const src = readCode(file);
      for (const h of iterAsyncHandlers(src)) {
        const body = extractBody(src, h.bodyBraceIdx);
        found.push(...analyzeHandler(file, h.name, body));
      }
    }

    const key = (o: { file: string; handler: string; stateVar: string; pattern: string }) =>
      `${o.file} :: ${o.handler} :: ${o.stateVar} (pattern ${o.pattern})`;
    const foundKeys = new Set(found.map(key));
    const registeredKeys = new Set(AT_RISK_HANDLERS.map(key));

    // (a) No brand-new at-risk handler — the next Iteration43 would land here.
    const unregistered = [...foundKeys].filter(k => !registeredKeys.has(k));
    if (unregistered.length) {
      throw new Error(
        'NEW at-risk async handler(s) not in AT_RISK_HANDLERS — classify each ' +
        '(real stale-closure bug → fix like 09c/09v; safe → add a safeBecause entry ' +
        'so it is tracked and cannot silently regress):\n' +
        unregistered.join('\n'),
      );
    }

    // (b) No stale registration — an edited handler that is no longer at-risk.
    const stale = [...registeredKeys].filter(k => !foundKeys.has(k));
    if (stale.length) {
      throw new Error(
        'Registered at-risk handler(s) no longer flagged by the sweep — delete the ' +
        'stale AT_RISK_HANDLERS entry:\n' + stale.join('\n'),
      );
    }
  });
});
