/**
 * @jest-environment node
 */
/**
 * Listener-registration leak — structural guard against register-without-
 * unsubscribe APIs.
 *
 * The listener-registration leak class is DISTINCT from the bounded-collection
 * growth fixed by CappedArray/CappedMap: it cannot be solved by a cap, only by
 * explicit unsubscribe, because each leaked registration also pins a (often
 * stale) closure. The live instance was ProductionErrorHandler.onError ↔
 * ErrorAlertSystem (fixed in 09t / e138130d): onError returned void, so every
 * React mount/StrictMode double-invoke appended a callback that was never
 * released — the singleton's errorCallbacks map grew without bound and each
 * leaked closure re-fired on every future error.
 *
 * 09t established the FIX SHAPE — a register API returns `() => void` (ref-
 * counted: the same reference registered N times needs N unsubscribes) and the
 * owning scope calls it on teardown — but applied it to only the one live
 * instance. Three sibling register APIs still returned void:
 *   - PerformanceDashboard.onAlert / onOptimization  (module singleton globalDashboard)
 *   - BudgetAlertSystem.onAlert                       (owned by singleton llmService)
 *   - StreamingQualityMonitor.onAlert                 (propagated via transcriber.onQualityAlert)
 * Each was a latent trap: a future consumer (especially a React useEffect)
 * registering without teardown would reintroduce the exact leak 09t fixed.
 *
 * This file closes the class STRUCTURALLY, mirroring the cap-class guard
 * (no-uncapped-singleton-push) and the cache-key canon (cache-key-canon.test):
 *
 *   (1) Enumerated contract — every known register API MUST declare `() => void`
 *       and its body MUST return a teardown. A rename/removal surfaces loudly,
 *       and a regression to `void` fails here.
 *   (2) Broad sweep — no production method anywhere under src/ may push a
 *       callback into a `*Callbacks`/`listeners`/`handlers`/`subscribers`/
 *       `observers` array without declaring `() => void`. Catches a brand-new
 *       register API not in the enumerated list.
 *
 * The deserialize-bypass class named in the same steering input is PHANTOM in
 * this repo (0-hit; the only persistence layer is safe-storage.ts, which IS the
 * guard) — this listener-leak guard is the real analog of the "winning pattern".
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

// --- Source-audit helpers (comment-stripped + balanced scanning) -------------

/** Strip comments (block + line) so doc references to old bugs don't match. */
function stripComments(src: string): string {
  // Same proven two-pass approach as cache-key-canon.test.ts: block comments
  // first, then `//` line comments only at line start (so `http://` inside
  // strings survives). Kept simple deliberately — the balanced scanners below
  // handle string/brace nesting at runtime.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * From `src[openIdx] === openCh`, return the index of the balancing `closeCh`,
 * skipping string literals. Returns -1 if unbalanced.
 */
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

/** Balanced-brace extraction from `src[braceIdx] === '{'`. */
function extractBody(src: string, braceIdx: number): string {
  let depth = 0;
  let str: string | null = null;
  for (let i = braceIdx; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === '\\') { i++; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(braceIdx, i + 1); }
  }
  return src.slice(braceIdx);
}

interface MethodDef {
  name: string;
  /** Normalized return-type text (empty if none annotated). */
  retType: string;
  /** Index of the method body's opening `{`. */
  bodyBraceIdx: number;
  /** Parameter names of the method (empty if none). */
  paramNames: string[];
}

const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof',
  'void', 'delete', 'new', 'await', 'yield', 'super', 'this', 'class',
  'interface', 'type', 'enum', 'extends', 'implements', 'import', 'export',
  'from', 'as', 'keyof', 'infer', 'is', 'satisfies', 'do', 'else',
]);

/**
 * Extract parameter identifiers from the param-list text between `openParen`
 * and `closeParen` (exclusive). Splits on top-level commas so callback types
 * like `cb: (a: T) => void` stay one param; the first identifier of each part
 * is the param name.
 */
function paramNamesOf(src: string, openParen: number, closeParen: number): string[] {
  const text = src.slice(openParen + 1, closeParen);
  const parts: string[] = [];
  let depth = 0;
  let str: string | null = null;
  let cur = '';
  for (const c of text) {
    if (str) { cur += c; if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  const names: string[] = [];
  for (const p of parts) {
    const m = p.trim().match(/^([a-zA-Z_$][\w$]*)/);
    if (m) names.push(m[1]);
  }
  return names;
}

/** True if `name` looks like a callback/handler parameter. */
function isCallbackParam(name: string): boolean {
  return /callback|^cb$|listener|handler|subscriber|observer|^fn$/.test(name);
}

/**
 * Yield every concrete method definition in `src` (a method name + param list
 * followed by a `{` body), with its normalized return type and param names.
 * Uses balanced scanning so callback-type params like `cb: (a: T) => void`
 * (nested parens) do not break param-list matching the way `[^)]*` would.
 */
function* iterMethodDefs(src: string): Generator<MethodDef> {
  const re = /\b([a-zA-Z_$][\w$]*)\s*(?:<[^<>]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (CONTROL_KEYWORDS.has(name)) continue;
    const openParen = m.index + m[0].length - 1;
    const closeParen = matchBalanced(src, openParen, '(', ')');
    if (closeParen < 0) continue;
    let i = closeParen + 1;
    while (i < src.length && /\s/.test(src[i])) i++;
    let retType = '';
    if (src[i] === ':') {
      i++;
      const retStart = i;
      let depth = 0;
      let str: string | null = null;
      while (i < src.length) {
        const c = src[i];
        if (str) {
          if (c === '\\') { i++; continue; }
          if (c === str) str = null;
          i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { str = c; i++; continue; }
        // `=>` is an arrow, not a `>` closing angle bracket — consume both so a
        // `() => void` return type does not desync the depth tracker (which
        // would otherwise swallow the method body and silently drop the def).
        if (c === '=' && src[i + 1] === '>') { i += 2; continue; }
        if (c === '{' && depth === 0) break;
        if (c === '(' || c === '[' || c === '<') depth++;
        else if (c === ')' || c === ']' || c === '>') depth--;
        i++;
      }
      retType = src.slice(retStart, i).trim().replace(/\s+/g, ' ');
    }
    if (src[i] !== '{') continue; // not a concrete def with a body (e.g. iface/abstract)
    yield { name, retType, bodyBraceIdx: i, paramNames: paramNamesOf(src, openParen, closeParen) };
  }
}

/** Find the first concrete method named `name` in `src`. */
function findMethodDef(src: string, name: string): MethodDef | null {
  for (const def of iterMethodDefs(src)) {
    if (def.name === name) return def;
  }
  return null;
}

/** True if `retType` declares the unsubscribe contract `() => void`. */
function returnsUnsubscribe(retType: string): boolean {
  return /\(\s*\)\s*=>\s*void/.test(retType);
}

/** True if a method body returns a teardown (inline arrow or propagation). */
function bodyReturnsTeardown(body: string): boolean {
  // `return () =>` (inline arrow teardown) OR `return this.<x>.<register>(`
  // (propagation to an underlying register API that itself returns unsub).
  return /return\s*\(\s*\)\s*=>/.test(body)
    || /return\s+this\.[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\s*\(/.test(body);
}

// --- The enumerated register-API inventory -----------------------------------

/**
 * Every register API in the codebase: a method that takes a callback and
 * appends it to an owner-scoped registry for later fan-out. Each MUST declare
 * `() => void` and return a teardown so a caller registering per mount/request
 * on a long-lived owner cannot accumulate callbacks (the listener leak).
 *
 * If you add a new register API, add it here — the broad sweep below will also
 * catch it, but the enumerated list pins each site explicitly (rename/removal
 * surfaces loudly instead of silently passing).
 */
const REGISTER_APIS: Array<{ file: string; method: string; owner: string }> = [
  // Fixed in 09t (the live instance).
  { file: 'src/monitoring/production-error-handler.ts', method: 'onError', owner: 'ProductionErrorHandler (process singleton)' },
  // Returns () => this.off(...) — already correct.
  { file: 'src/quality/error-recovery-event-bus.ts', method: 'on', owner: 'ErrorRecoveryEventBus (process singleton)' },
  // Hardened in this change (latent siblings).
  { file: 'src/monitoring/performance-dashboard.ts', method: 'onAlert', owner: 'PerformanceDashboard (module singleton globalDashboard)' },
  { file: 'src/monitoring/performance-dashboard.ts', method: 'onOptimization', owner: 'PerformanceDashboard (module singleton globalDashboard)' },
  { file: 'src/analysis/budget-alert.ts', method: 'onAlert', owner: 'BudgetAlertSystem (owned by singleton llmService)' },
  { file: 'src/transcription/streaming-quality-monitor.ts', method: 'onAlert', owner: 'StreamingQualityMonitor' },
  // Thin wrappers that propagate the underlying unsubscribe.
  { file: 'src/analysis/llm-service.ts', method: 'onBudgetAlert', owner: 'LLMService (process singleton llmService) → BudgetAlertSystem.onAlert' },
  { file: 'src/transcription/streaming-transcriber.ts', method: 'onQualityAlert', owner: 'StreamingTranscriber → StreamingQualityMonitor.onAlert' },
];

/**
 * Files exempt from the broad sweep because they use a DIFFERENT, correct
 * teardown pattern (not a register-API-returning-unsubscribe) — listed with the
 * reason so an exemption cannot hide a real leak. Currently empty: every
 * callback registry in src/ either is a `() => void` register API (enumerated
 * above) or tears down intrinsically (useToast's module-level `listeners`
 * array is cleaned via the same useEffect's splice return — a React-hook
 * pattern with no `this.`-prefixed instance registry, so the broad sweep's
 * instance-field regex never reaches it).
 */
const BROAD_SWEEP_EXEMPT: Array<{ file: string; reason: string }> = [];

function readCode(file: string): string {
  return stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));
}

// --- Tests -------------------------------------------------------------------

describe('listener-registration register APIs — enumerated unsubscribe contract', () => {
  // Each anchor is RED on the pre-fix source (void return) and GREEN after.

  it('every enumerated register API is present (rename/removal surfaces loudly)', () => {
    const missing: string[] = [];
    for (const { file, method } of REGISTER_APIS) {
      const src = readCode(file);
      if (!findMethodDef(src, method)) missing.push(`${file} :: ${method}`);
    }
    expect(missing).toEqual([]);
  });

  it('every enumerated register API declares `() => void` (not void)', () => {
    const offenders: string[] = [];
    for (const { file, method, owner } of REGISTER_APIS) {
      const src = readCode(file);
      const def = findMethodDef(src, method);
      if (!def) continue; // presence asserted above
      if (!returnsUnsubscribe(def.retType)) {
        offenders.push(`${file} :: ${method} — retType "${def.retType || '(none)'}" [${owner}]`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every enumerated register API body returns a teardown (no annotated-but-discarded lie)', () => {
    const offenders: string[] = [];
    for (const { file, method } of REGISTER_APIS) {
      const src = readCode(file);
      const def = findMethodDef(src, method);
      if (!def) continue;
      const body = extractBody(src, def.bodyBraceIdx);
      if (!bodyReturnsTeardown(body)) {
        offenders.push(`${file} :: ${method}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('listener-registration leak — broad sweep (no void register API anywhere)', () => {
  // Belt-and-suspenders: catches a brand-new register API added in ANY src/ dir
  // that is not in REGISTER_APIS. A register method is one that takes a
  // callback-typed param and pushes it into a `*Callbacks`/`listeners`/
  // `handlers`/`subscribers`/`observers` instance registry; it MUST declare
  // `() => void`. Requiring a callback PARAM (not just any `.push`) excludes
  // false positives like RecoveryTelemetryAggregator.subscribe(), which pushes
  // internally-created unsubscribe fns (not a caller's callback) into a list
  // drained by destroy(). The enumerated list above pins the known sites; this
  // catches the unknown future one.
  const CALLBACK_REGISTRY_PUSH =
    /\.(?:[a-zA-Z_$][\w$]*(?:Callbacks|listeners|handlers|subscribers|observers))\b[\s\S]{0,80}?\.(?:push|add)\s*\(/;

  it('no production method registers a callback without declaring `() => void`', () => {
    const exemptFiles = new Set(BROAD_SWEEP_EXEMPT.map(e => e.file));
    const files = (globSync('src/**/*.ts') as string[]).filter(
      f => !f.includes('__tests__') && !exemptFiles.has(f),
    );

    const offenders: string[] = [];
    for (const file of files) {
      const src = readCode(file);
      for (const def of iterMethodDefs(src)) {
        // Must take a callback-typed param to be a register API.
        if (!def.paramNames.some(isCallbackParam)) continue;
        const body = extractBody(src, def.bodyBraceIdx);
        if (!CALLBACK_REGISTRY_PUSH.test(body)) continue;
        // It's a register method — it MUST return an unsubscribe.
        if (!returnsUnsubscribe(def.retType)) {
          offenders.push(
            `${file} :: ${def.name}() — retType "${def.retType || '(none)'}" registers a callback without unsubscribe`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every broad-sweep exemption is still present and justified (no stale exemptions)', () => {
    // An exemption for a file that no longer exists, or whose register pattern
    // was removed, is stale and should be deleted. This keeps the exemption
    // list honest. (List is currently empty — this guard exists so a future
    // exemption cannot silently stick around after the code that needed it is
    // gone.)
    const stale: string[] = [];
    for (const { file } of BROAD_SWEEP_EXEMPT) {
      let src: string;
      try {
        src = readCode(file);
      } catch {
        stale.push(`${file} — file not found (delete exemption)`);
        continue;
      }
      // The exempt file must still actually contain the callback-registry push
      // pattern it is exempted for; otherwise the exemption is stale.
      if (!CALLBACK_REGISTRY_PUSH.test(src)) {
        stale.push(`${file} — no callback-registry push found (delete exemption)`);
      }
    }
    expect(stale).toEqual([]);
  });
});
