/**
 * Dead-idiom batch census — SEVERAL confirmed-zero idiom classes pinned by
 * ONE lightweight guard (REQ-410 / Phase 217 / census family 19).
 *
 * make-run steering directive this guard is shaped by (2026-08-25, after
 * REQ-405): families 15/16 each shipped zero violations yet cost a 6-file
 * spec + 2 phases + an MW entry — so from family 19 on, the DISCOVERY SWEEP
 * runs BEFORE the requirements are written, classes that measure clean are
 * bundled into one batch guard (adding a kind is the whole cost), and full
 * per-family investment goes only to classes with measured violations.
 *
 * The 2026-08-25 discovery sweep walked the production surface (repo src/ +
 * installed @stv/core core-four — same walkProductionSurface as every other
 * census guard; 331 files) and measured SEVEN candidate classes:
 *
 * The 2026-08-25 SECOND discovery sweep (REQ-411 / Phase 218, same walk)
 * measured ELEVEN more candidate classes with the exact detectors below.
 * Two were rejected BEFORE pinning — `with (…) {}` and `arguments.callee`
 * are SyntaxErrors under TS/ESM strict, so tsc already blocks them and a
 * guard would have no teeth tsc does not; the remaining nine joined the
 * registry (this is the steering contract working: adding a kind is the
 * whole cost of a confirmed-zero class):
 *
 * The 2026-08-25 THIRD discovery sweep (REQ-412 / Phase 219, same walk)
 * measured THIRTEEN more candidate classes. One was rejected BEFORE
 * pinning — `Math.pow(a, b)` is behavior-identical to `a ** b` (both
 * return NaN for a negative base with a fractional exponent; neither
 * deopts), so its 13 measured sites carry zero incident shape and a pin
 * would be permanent ALLOWED-roster noise for a style preference. The
 * remaining TWELVE joined the registry:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   direct-eval                   0         exact-0 pin
 *   timer-string-arg              0         exact-0 pin
 *   typeof-impossible-tag         0         exact-0 pin
 *   json-clone-idiom              1 (src)   ALLOWED — ProcessingStrategy
 *                                             (adaptive-content-processor)
 *                                             is string/number/enum-literal
 *                                             only, so the round-trip is
 *                                             lossless; structuredClone is
 *                                             absent from the jest vm
 *                                             context (probed 2026-08-25),
 *                                             so unifying breaks the test
 *                                             bed — re-judge if a non-JSON
 *                                             field ever joins the shape
 *   comparator-less-sort          0         exact-0 pin
 *   instanceof-array              0         exact-0 pin
 *   empty-catch                   0         exact-0 pin (single-line shape)
 *   legacy-substr                 0         exact-0 pin
 *   escape-unescape               0         exact-0 pin
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   parseint-no-radix             5 (src)   VIOLATION — unified in-commit:
 *                                             all five are the SAME shape
 *                                             in ProductionDashboard.tsx
 *                                             number-input handlers
 *                                             (`parseInt(e.target.value)`),
 *                                             now `parseInt(…, 10)` — the
 *                                             repo-canonical spelling (api/
 *                                             routes/monitoring.ts:34 etc.)
 *                                             and hex-prefix hardening
 *                                             (`parseInt('0x10') === 16`
 *                                             without a radix)
 *   bitwise-truncation            0         exact-0 pin (`~~` / `| 0`;
 *                                             `>>> 0` unsigned-coercion is
 *                                             REQUIRED hash math — CRC32 /
 *                                             mulberry32 — and out of class)
 *   legacy-push-apply             0         exact-0 pin
 *   apply-null-spread             0         exact-0 pin
 *   new-function-ctor             0         exact-0 pin
 *   deprecated-date-api           0         exact-0 pin
 *   debugger-statement            0         exact-0 pin
 *   document-write                0         exact-0 pin
 *   arraylike-slice-call          0         exact-0 pin
 *   constructor-index-access      0         exact-0 pin
 *   from-char-code                5 (src)   ALLOWED — every measured site is
 *                                             BYTE-DOMAIN (Uint8Array
 *                                             element reads for PNG/APNG
 *                                             chunk types and GIF version,
 *                                             and the RLE marker where
 *                                             `count` is capped at 255 by
 *                                             the `count < 255` loop guard);
 *                                             fromCharCode is exact for
 *                                             0..255. Teeth stay live: a
 *                                             NEW site passing a code point
 *                                             > 0xFFFF silently truncates
 *                                             (ToUint16 wrap) and is an
 *                                             unrostered RED
 *   proto-key-literal             1 (src)   ALLOWED — the hit is the
 *                                             sanitizer's OWN blocklist
 *                                             (`PROTOTYPE_POLLUTION_KEYS`
 *                                             string data, not an object
 *                                             literal key); a real
 *                                             `__proto__:` key/assignment
 *                                             elsewhere is an unrostered RED
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   coercing-isnan                2 (src)   VIOLATION — unified in-commit:
 *                                             global isNaN → Number.isNaN
 *                                             (srt-parser.ts:98 guarded by
 *                                             parseInt-always-number,
 *                                             quality-monitor.ts:637 guarded
 *                                             by the REQ-375 typeof filter;
 *                                             both keep identical semantics,
 *                                             the coercing spelling is gone)
 *   coercing-isfinite             1 (core)  ALLOWED — @stv/core
 *                                             formatDuration(seconds: number)
 *                                             typed param; this repo cannot
 *                                             edit the package in-tree
 *   unguarded-for-in              1 (src)   ALLOWED — body opens with the
 *                                             own-key filter `if (key in …)`
 *   unawaited-async-forEach       0         exact-0 pin
 *   legacy-indexof-membership     0         exact-0 pin
 *   loose-equality-nonnullish     0         exact-0 pin
 *   bare-hasOwnProperty           0         exact-0 pin
 *
 * Why these axes are load-bearing and not style:
 *   - global isNaN/isFinite COERCE (`isFinite('12') === true`), so a future
 *     refactor that widens the operand type flips the verdict silently —
 *     this repo's recurring NaN-routing incidents are exactly that shape.
 *   - `.forEach(async …)` drops the returned promise: rejections become
 *     unhandled, ordering is lost, and the caller's `await` covers nothing.
 *   - `for (k in o)` walks the prototype chain; an unfiltered body reads
 *     inherited keys as data.
 *   - `x.indexOf(y) !== -1` and bare `x == y` (outside the deliberate
 *     `== null` nullish idiom) are the legacy spellings of `.includes` /
 *     `===`; nothing on the surface uses them, so the pin is pure ratchet.
 *   - `x.hasOwnProperty(k)` crashes on null-prototype objects;
 *     `Object.prototype.hasOwnProperty.call` / `Object.hasOwn` are the safe
 *     forms. Zero sites today.
 *
 * Structure (the "add a kind" contract): every class is ONE entry in
 * IDIOM_KINDS — a per-line detector, plus an optional contextual
 * `guardedBy` rule for classes whose incident shape is contextual (for-in).
 * A hit is an offender unless (a) it carries its guard where the kind
 * requires one AND (b) its `rel:line` key is judged in the ALLOWED roster.
 * ALLOWED / ERADICATED are the census-artifact three-way blocks (REQ-395):
 * the requirements prose must declare `ALLOWED 2 key` / `ERADICATED 2 key`.
 *
 *   <!-- census-pin:F19:dead-idiom-batch ALLOWED 2 key / ERADICATED 2 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - line-level detection sees one line at a time: a `==` split across a
 *     line break, or an `indexOf` comparison wrapped to the next line,
 *     escapes the detector. No such site exists (measured with the exact
 *     detector below); multi-line idioms would need an AST pass.
 *   - a line that contains BOTH a nonnullish loose equality and a `== null`
 *     comparison is skipped whole (the nullish exclusion is line-granular).
 *   - the for-in `guardedBy` rule scans the body by indent (≤12 lines) for
 *     an own-key filter — a guard spelled later in the body than that, or
 *     via a helper call the regex does not know, reads as unguarded (safe
 *     direction: it lands in the offender list, forcing a judgment).
 *   - kind regexes are line text: string literals containing the idiom
 *     (e.g. a message `'a == b'`) can false-positive; any such hit simply
 *     demands an ALLOWED judgment, which is the census working as designed.
 *   - empty-catch detects the SINGLE-LINE shape only: a `catch (e) {` whose
 *     `}` sits on a later line, or an empty catch carrying an inline
 *     comment, is invisible to a line detector (no such site exists on the
 *     surface — measured with the detector below plus a grep -A1 pass).
 *   - typeof-impossible-tag is pinned to the typo tags that can NEVER be
 *     produced (`array/int/float/bool/double/long/decimal`); the real tags
 *     (object/function/bigint/…) are legitimate comparisons and excluded.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Kind registry — adding a class = adding one entry here (steering contract).
// ---------------------------------------------------------------------------

/** One dead-idiom class: where the incident shape lives, line by line. */
export interface IdiomKind {
  /** Stable id, used in offender messages and the spec's kind table. */
  id: string;
  /** Non-comment lines matching this are hits (regex or predicate). */
  detect: RegExp | ((line: string) => boolean);
  /**
   * Context rule for classes whose acceptability is contextual: when
   * present, a hit must satisfy it (e.g. a for-in body must open with an
   * own-key filter). A rostered hit that fails this rule is STILL an
   * offender — ALLOWED never overrides a missing guard.
   */
  guardedBy?: (lines: string[], hitIdx: number) => boolean;
}

/** `==` / `!=` loose equality that is NOT the deliberate nullish idiom. */
const LOOSE_EQ_RE = /(?<![=!<>+\-*/&|^%])(==|!=)(?![=])/;

function isNonNullishLooseEquality(line: string): boolean {
  if (!LOOSE_EQ_RE.test(line)) return false;
  // `x == null` / `null != y` is the repo-wide nullish idiom — excluded.
  return !/(==|!=)\s*null\b|null\s*(==|!=)/.test(line);
}

/**
 * A for-in hit is acceptable only when its body opens with an own-key
 * filter (`if (k in target)`, `.hasOwnProperty(`, `Object.hasOwn(`) before
 * the body closes at the for-line's indent (scan capped at 12 lines).
 */
function forInBodyHasOwnKeyFilter(lines: string[], hitIdx: number): boolean {
  const indent = lines[hitIdx].match(/^\s*/)?.[0].length ?? 0;
  const ownKeyFilter =
    /if\s*\(\s*\w+\s+in\s|\.hasOwnProperty\(|Object\.hasOwn\(/;
  // A one-line body (`for (…) { … }`) is checked on the hit line itself.
  if (ownKeyFilter.test(lines[hitIdx].slice(lines[hitIdx].indexOf('{')))) {
    return true;
  }
  for (let j = hitIdx + 1; j < lines.length && j <= hitIdx + 12; j++) {
    const lineIndent = lines[j].match(/^\s*/)?.[0].length ?? 0;
    if (lineIndent <= indent && /^\s*\}/.test(lines[j])) break;
    if (ownKeyFilter.test(lines[j])) return true;
  }
  return false;
}

export const IDIOM_KINDS: readonly IdiomKind[] = [
  // global isNaN coerces; Number.isNaN does not. (Number.isNaN excluded by
  // the lookbehind, as is any myIsNaN identifier.)
  { id: 'coercing-isnan', detect: /(?<![.\w$])isNaN\(/ },
  { id: 'coercing-isfinite', detect: /(?<![.\w$])isFinite\(/ },
  // `.forEach(async …)` drops the promise: rejections go unhandled.
  { id: 'unawaited-async-foreach', detect: /\.forEach\(\s*async\b/ },
  // `.indexOf(x) !== -1`-family: the legacy spelling of `.includes`.
  {
    id: 'legacy-indexof-membership',
    detect: /\.indexOf\([^)]*\)\s*(?:!==|===|!=|==|>=|<=|>|<)\s*-?\d/,
  },
  // `a == b` outside the `== null` nullish idiom.
  { id: 'loose-equality-nonnullish', detect: isNonNullishLooseEquality },
  // Direct `.hasOwnProperty(` crashes on null-prototype objects.
  { id: 'bare-hasOwnProperty', detect: /\.hasOwnProperty\(/ },
  // Unfiltered for-in reads prototype-chain keys as data.
  {
    id: 'unguarded-for-in',
    detect: /for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s/,
    guardedBy: forInBodyHasOwnKeyFilter,
  },
  // --- REQ-411 second sweep (nine kinds, all measured on 2026-08-25) ---
  // Direct eval: the code-injection incident shape itself.
  { id: 'direct-eval', detect: /(?<![.\w$])eval\s*\(/ },
  // `setTimeout("…")` parses the string as code — eval in disguise.
  { id: 'timer-string-arg', detect: /set(?:Timeout|Interval)\(\s*['"`]/ },
  // `typeof x === 'array'` is never true: typeof cannot produce these tags.
  {
    id: 'typeof-impossible-tag',
    detect: /typeof\s+\w+\s*(?:!==?|===?)\s*['"](array|int|float|bool|double|long|decimal)['"]/,
  },
  // `JSON.parse(JSON.stringify(x))` drops undefined, mangles Date/Map/Set.
  { id: 'json-clone-idiom', detect: /JSON\.parse\(\s*JSON\.stringify\(/ },
  // `.sort()` with no comparator sorts NUMBERS lexicographically.
  { id: 'comparator-less-sort', detect: /\.sort\s*\(\s*\)/ },
  // `instanceof Array` is false for cross-realm arrays; Array.isArray is not.
  { id: 'instanceof-array', detect: /instanceof\s+Array\b/ },
  // An empty catch swallows the error silently (single-line shape only).
  {
    id: 'empty-catch',
    detect: /catch\s*(?:\(\s*\w+\s*\))?\s*\{\s*\}/,
  },
  // substr is legacy; its negative-index behavior is slice's opposite.
  { id: 'legacy-substr', detect: /\.substr\s*\(/ },
  // escape/unescape are deprecated globals with non-UTF-8 semantics.
  { id: 'escape-unescape', detect: /(?<![.\w$])(?:un)?escape\s*\(/ },
  // --- REQ-412 third sweep (twelve kinds, all measured on 2026-08-25) ---
  // `parseInt(s)` without a radix: hex-prefixed strings coerce
  // (`parseInt('0x10') === 16`); radix-less is also the non-canonical
  // spelling repo-wide (api/ routes all pass `, 10`). Simple single-arg
  // operands only — as-cast / nested-call operands escape (documented
  // ceiling). The lookbehind keeps `Number.parseInt(v, 10)` out.
  { id: 'parseint-no-radix', detect: /(?<![.\w$])parseInt\(\s*[\w$.]+\s*\)/ },
  // `~~x` / `x | 0` are dead truncation idioms: they wrap at 2^31, keep
  // `-0`, and hide Math.trunc intent. `>>> 0` (unsigned coercion) is
  // REQUIRED bit math (CRC32 / mulberry32) and deliberately out of class.
  { id: 'bitwise-truncation', detect: /~~|(?<!\|)\|\s*0\b/ },
  // `xs.push.apply(xs, ys)` is the pre-spread concatenation idiom.
  { id: 'legacy-push-apply', detect: /\.push\.apply\(/ },
  // `f.apply(null, args)` is the pre-spread call idiom (and loses `this`).
  { id: 'apply-null-spread', detect: /\.apply\(\s*(?:null|undefined)\s*,/ },
  // `new Function(…)` compiles a string body — eval in disguise.
  { id: 'new-function-ctor', detect: /\bnew\s+Function\s*\(/ },
  // getYear/setYear/toGMTString are deprecated Date members (2-digit years).
  { id: 'deprecated-date-api', detect: /\.(?:getYear|setYear|toGMTString)\(/ },
  // A stray `debugger` halts every devtools session that opens the app.
  { id: 'debugger-statement', detect: /^\s*debugger\b/ },
  // document.write blows away the document tree after load.
  { id: 'document-write', detect: /document\.write(?:ln)?\(/ },
  // `Array.prototype.slice.call(…)` is the pre-ES2015 array-like conversion.
  { id: 'arraylike-slice-call', detect: /\.slice\.call\(|Array\.prototype\.slice\b/ },
  // `x.constructor` is the prototype-pollution escape hatch
  // (`x.constructor.constructor('return 1')()` reaches the Function ctor).
  { id: 'constructor-index-access', detect: /\.constructor\b/ },
  // String.fromCharCode applies ToUint16 — code points > 0xFFFF wrap
  // silently (fromCharCode(65536) === '\0'); fromCodePoint does not.
  { id: 'from-char-code', detect: /fromCharCode\(/ },
  // A `__proto__` key/assignment is the prototype-pollution shape itself;
  // the sanitizer's own blocklist string is the one rostered data site.
  { id: 'proto-key-literal', detect: /__proto__/ },
];

/** One discovered idiom site, classified against its kind's context rule. */
export interface IdiomSite {
  /** `${rel}:${line}` — the roster key form. */
  key: string;
  kind: string;
  rel: string;
  line: number;
  /** False when the kind's guardedBy rule is not satisfied. */
  guarded: boolean;
  text: string;
}

/** Extract every kind's hits from one file (comment lines skipped). */
export function discoverIdiomSites(rel: string, content: string): IdiomSite[] {
  const lines = content.split('\n');
  const sites: IdiomSite[] = [];
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    for (const kind of IDIOM_KINDS) {
      const hit =
        typeof kind.detect === 'function' ? kind.detect(line) : kind.detect.test(line);
      if (!hit) continue;
      sites.push({
        key: `${rel}:${idx + 1}`,
        kind: kind.id,
        rel,
        line: idx + 1,
        guarded: kind.guardedBy === undefined || kind.guardedBy(lines, idx),
        text: line.trim(),
      });
    }
  });
  return sites;
}

// ---------------------------------------------------------------------------
// The judged rosters (census-artifact three-way blocks, REQ-395).
// ---------------------------------------------------------------------------

/**
 * Sites whose idiom is judged acceptable — every key needs a reason, and
 * every key must stay a live hit (stale rows are RED).
 */
const ALLOWED: Record<string, string> = {
  // [coercing-isfinite] core package surface — formatDuration's param is
  // the typed `seconds: number`, so global coercion is unreachable from
  // typed callers; the file lives in @stv/core and this repo cannot fix
  // the spelling in-tree (core's own CI owns the follow-up).
  'src/utils/audio-duration.ts:47':
    'CORE-TYPED — @stv/core formatDuration(seconds: number); typed param makes the coercing verdict unreachable from typed callers, package-owned file.',
  // [unguarded-for-in] the body opens with the own-key filter.
  'src/optimization/smart-parameter-tuner.ts:332':
    'GUARDED — body opens with `if (key in result)`, so prototype-chain keys never reach the blend.',
  // [json-clone-idiom] ProcessingStrategy (adaptive-content-processor.ts:12)
  // is string/number/enum-literal fields only, so the round-trip is
  // lossless; structuredClone is ABSENT from the jest vm context (probed
  // 2026-08-25: Node 24 has it, the jest vm sandbox does not), so unifying
  // would break the test bed. Re-judge the moment a non-JSON field
  // (Date/Map/Set/undefined) joins the interface.
  'src/optimization/adaptive-content-processor.ts:185':
    'JSON-SAFE — ProcessingStrategy is string/number/enum-literal only (lossless round-trip) and structuredClone is unavailable in the jest vm context; re-judge if a non-JSON field joins the interface.',
  // [from-char-code] all five sites operate on BYTES (0..255), where
  // fromCharCode is exact: apng-encoder/export-verifier build PNG/APNG/GIF
  // chunk-type and version strings from Uint8Array element reads;
  // intelligent-cache's RLE emits the fixed 255 marker and a `count` that
  // the `count < 255` loop guard caps in range. fromCodePoint is the
  // equivalent spelling here — swapping is fine but must shed the roster
  // row in the same commit (stale-row test). A NEW site passing a code
  // point > 0xFFFF is an unrostered RED (ToUint16 wraps silently).
  'src/export/apng-encoder.ts:275':
    'BYTE-DOMAIN — chunk type from Uint8Array element reads (apng[pos+4..7]), 0..255 where fromCharCode is exact.',
  'src/export/export-verifier.ts:198':
    'BYTE-DOMAIN — GIF version bytes view[3..5], 0..255 where fromCharCode is exact.',
  'src/export/export-verifier.ts:363':
    'BYTE-DOMAIN — PNG chunk-type bytes view[offset+4..7], 0..255 where fromCharCode is exact.',
  'src/performance/intelligent-cache.ts:153':
    'BYTE-DOMAIN — fixed 255 marker and `count` capped at 255 by the `count < 255` loop guard; 0..255 where fromCharCode is exact.',
  'src/performance/intelligent-cache.ts:163':
    'BYTE-DOMAIN — trailing-run flush of the same 255-capped RLE marker/count pair; 0..255 where fromCharCode is exact.',
  // [proto-key-literal] the hit is the sanitizer's OWN blocklist — string
  // data the defense compares keys against, not an object-literal key.
  // Every other `__proto__` occurrence on the surface is a comment line
  // (skipped by discovery).
  'src/analysis/untrusted-json-core.ts:38':
    'SANITIZER-DATA — PROTOTYPE_POLLUTION_KEYS is the blocklist the defense matches against (string data, not a key literal); any real `__proto__:` key or assignment is an unrostered RED.',
};

/**
 * The unified sites (the measured violations this family fixed in-commit).
 * Reappearance of either spelling is RED.
 */
const ERADICATED: Record<string, string> = {
  'src/remotion/srt-parser.ts:98':
    'unified 2026-08-25 (REQ-410) — global isNaN → Number.isNaN; the parseInt(…, 10) result is always a number so semantics are identical, the coercing spelling is gone.',
  'src/pipeline/quality-monitor.ts:637':
    'unified 2026-08-25 (REQ-410) — !isNaN → !Number.isNaN inside the REQ-375 typeof-number filter (kept: Number.isNaN(null) is false too, so the typeof guard stays load-bearing).',
  'src/components/ProductionDashboard.tsx:156':
    'unified 2026-08-25 (REQ-412) — parseInt(v) → parseInt(v, 10): decimal input strings parse identically (radix 10 is the default except for 0x/legacy-0 prefixes), the spelling joins the repo-canonical form (api/routes/monitoring.ts:34), and a hex-prefixed value no longer coerces (parseInt("0x10") === 16 without a radix).',
  'src/components/ProductionDashboard.tsx:170':
    'unified 2026-08-25 (REQ-412) — parseInt(v) → parseInt(v, 10) in the memoryLimit number-input handler; identical for decimal strings, hex-prefix hardening, canonical spelling.',
  'src/components/ProductionDashboard.tsx:187':
    'unified 2026-08-25 (REQ-412) — parseInt(v) → parseInt(v, 10) in the timeoutMs number-input handler; identical for decimal strings, hex-prefix hardening, canonical spelling.',
  'src/components/ProductionDashboard.tsx:320':
    'unified 2026-08-25 (REQ-412) — parseInt(v) → parseInt(v, 10) in the metricsCollectionInterval number-input handler; identical for decimal strings, hex-prefix hardening, canonical spelling.',
  'src/components/ProductionDashboard.tsx:359':
    'unified 2026-08-25 (REQ-412) — parseInt(v) → parseInt(v, 10) in the alertThresholds.responseTime handler; identical for decimal strings, hex-prefix hardening, canonical spelling.',
};

describe('dead-idiom batch census (REQ-410)', () => {
  const sites: IdiomSite[] = walkProductionSurface().flatMap((rel) =>
    discoverIdiomSites(rel, readSource(rel)),
  );
  const liveKeys = new Set(sites.map((s) => s.key));

  it('discovery has authority (the walk traversed the production surface)', () => {
    // Floor pins against the 2026-08-25 baseline: 331 swept files, with
    // the three rostered classes still represented (1 core isFinite +
    // 1 for-in + 1 json-clone). A collapse means the walk rotted, not that
    // the tree got cleaner. The exact-0 kinds have no floor — zero is
    // their pin.
    expect(walkProductionSurface().length).toBeGreaterThanOrEqual(300);
    expect(sites.filter((s) => s.kind === 'coercing-isfinite').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'unguarded-for-in').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'json-clone-idiom').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'from-char-code').length).toBeGreaterThanOrEqual(3);
    expect(sites.filter((s) => s.kind === 'proto-key-literal').length).toBeGreaterThanOrEqual(1);
    // The kind registry is the steering contract — shrinking it is RED.
    expect(IDIOM_KINDS.map((k) => k.id)).toEqual([
      'coercing-isnan',
      'coercing-isfinite',
      'unawaited-async-foreach',
      'legacy-indexof-membership',
      'loose-equality-nonnullish',
      'bare-hasOwnProperty',
      'unguarded-for-in',
      'direct-eval',
      'timer-string-arg',
      'typeof-impossible-tag',
      'json-clone-idiom',
      'comparator-less-sort',
      'instanceof-array',
      'empty-catch',
      'legacy-substr',
      'escape-unescape',
      'parseint-no-radix',
      'bitwise-truncation',
      'legacy-push-apply',
      'apply-null-spread',
      'new-function-ctor',
      'deprecated-date-api',
      'debugger-statement',
      'document-write',
      'arraylike-slice-call',
      'constructor-index-access',
      'from-char-code',
      'proto-key-literal',
    ]);
  });

  it('completeness: every hit is either guard-carried and ALLOWED, or RED', () => {
    const offenders = sites.filter((s) => !(s.key in ALLOWED));
    expect(
      offenders.map((s) => `${s.key} [${s.kind}]: ${s.text}`),
    ).toEqual([]);
  });

  it('a roster key never overrides a missing context guard (for-in rule)', () => {
    // ALLOWED is a judgment about a SITE AS WRITTEN — deleting the
    // own-key filter must put the rostered site back in the offender
    // list, so every hit of a guard-carrying kind must carry its guard
    // whether rostered or not.
    const unguarded = sites.filter((s) => !s.guarded);
    expect(
      unguarded.map((s) => `${s.key} [${s.kind}] missing own-key guard: ${s.text}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry is still a live hit)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !liveKeys.has(k));
    expect(stale).toEqual([]);
  });

  it('eradicated spellings stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => liveKeys.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared — the unified site regressed`),
    ).toEqual([]);
  });

  it('every ALLOWED / ERADICATED entry carries a non-empty reason', () => {
    for (const [map, name] of [
      [ALLOWED, 'ALLOWED'],
      [ERADICATED, 'ERADICATED'],
    ] as const) {
      for (const [key, reason] of Object.entries(map)) {
        expect({ name, key, reason }).toEqual({
          name,
          key,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it('negative anchors: the unified and rostered spellings stay pinned', () => {
    const anchors: Array<[string, RegExp]> = [
      // The two unified isNaN sites keep the Number.isNaN spelling.
      ['src/remotion/srt-parser.ts', /if \(Number\.isNaN\(index\)\) \{/],
      [
        'src/pipeline/quality-monitor.ts',
        /typeof v === 'number' && !Number\.isNaN\(v\)/,
      ],
      // The rostered for-in keeps its own-key filter (deleting it must
      // flip the guard-carried rule above, this anchor documents why).
      [
        'src/optimization/smart-parameter-tuner.ts',
        /for \(const key in historical\) \{\s*\n\s*if \(key in result\) \{/,
      ],
      // The rostered core isFinite keeps the judged spelling (a core-side
      // flip to Number.isFinite is fine — it only makes this row stale,
      // which the stale-row test catches).
      ['src/utils/audio-duration.ts', /!isFinite\(seconds\)/],
      // The rostered json-clone keeps the judged spelling; replacing it
      // with a real clone (when the interface grows a non-JSON field) is
      // the intended follow-up — that edit makes this row stale (RED),
      // forcing the roster to shed the row in the same change.
      [
        'src/optimization/adaptive-content-processor.ts',
        /JSON\.parse\(JSON\.stringify\(baseStrategy\)\)/,
      ],
      // The five unified parseInt sites keep the radix spelling — and all
      // five stay unified (a partial revert fails this count).
      ['src/components/ProductionDashboard.tsx', /maxConcurrentJobs: parseInt\(e\.target\.value, 10\) \|\| 1/],
      // The rostered byte-domain fromCharCode sites keep the judged
      // spelling (swapping to fromCodePoint is fine — it makes the row
      // stale, forcing the roster to shed it in the same change).
      ['src/export/apng-encoder.ts', /const type = String\.fromCharCode\(/],
      // The rostered proto-key site keeps being the sanitizer's blocklist.
      [
        'src/analysis/untrusted-json-core.ts',
        /PROTOTYPE_POLLUTION_KEYS = new Set\(\['__proto__', 'constructor', 'prototype'\]\)/,
      ],
    ];
    for (const [file, pattern] of anchors) {
      expect(`${file}: ${readSource(file)}`).toMatch(pattern);
    }
    // All five unified handlers carry the radix at once — the per-anchor
    // patterns above pin the spelling, this count pins the completeness
    // of the unify (4-of-5 is a silent partial regression otherwise).
    expect(
      (readSource('src/components/ProductionDashboard.tsx').match(
        /parseInt\(e\.target\.value, 10\)/g,
      ) ?? []).length,
    ).toBe(5);
  });

  it('liveness: synthetic fixtures prove every kind detects its incident shape', () => {
    // (a) coercing predicates: globals flagged, Number./member forms not.
    expect(discoverIdiomSites('f.ts', 'if (isNaN(x)) return;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const ok = Number.isNaN(x); const m = myIsNaN(x);'),
    ).toEqual([]);

    // (b) unawaited-async-foreach flagged; sync callback and for-await not.
    expect(
      discoverIdiomSites('f.ts', 'items.forEach(async (x) => fetch(x));'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'items.forEach((x) => save(x));'),
    ).toEqual([]);

    // (c) legacy indexOf membership flagged in both polarities (`!== -1`
    // found, `< 0` not-found); includes and lastIndexOf are not the class.
    expect(
      discoverIdiomSites('f.ts', 'if (xs.indexOf(y) !== -1) run();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'if (xs.indexOf(y) < 0) skip();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'if (xs.includes(y)) run(); if (xs.lastIndexOf(y) >= 0) run();'),
    ).toEqual([]);

    // (d) nonnullish loose equality flagged; `== null` and strict forms not.
    expect(discoverIdiomSites('f.ts', 'if (a == b) run();')).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        "if (a == null) run(); if (a === b) run(); if (a !== b) run(); if (a <= b) run(); if (a != null) run();",
      ),
    ).toEqual([]);

    // (e) bare hasOwnProperty flagged; the safe call/hasOwn forms not.
    expect(
      discoverIdiomSites('f.ts', 'if (obj.hasOwnProperty(k)) run();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        'Object.prototype.hasOwnProperty.call(o, k); Object.hasOwn(o, k);',
      ),
    ).toEqual([]);

    // (f) for-in: unguarded body is an offender, own-key-filtered body is
    // a guarded hit — the roster judgment is what makes the latter ALLOWED.
    const unguarded = discoverIdiomSites(
      'f.ts',
      ['for (const key in cfg) {', '  total += cfg[key];', '}'].join('\n'),
    );
    expect(unguarded).toHaveLength(1);
    expect(unguarded[0].guarded).toBe(false);
    const guarded = discoverIdiomSites(
      'f.ts',
      ['for (const key in cfg) {', '  if (key in known) {', '    total += cfg[key];', '  }', '}'].join('\n'),
    );
    expect(guarded).toHaveLength(1);
    expect(guarded[0].guarded).toBe(true);

    // (g) comment lines are documentation, not decisions.
    expect(discoverIdiomSites('f.ts', '// if (isNaN(x)) return;')).toEqual([]);

    // (h) a hit on a file NOT in the roster is an offender by shape — the
    // completeness rule keys off the same discovery used here.
    const rogue = discoverIdiomSites('f.ts', 'const bad = !isFinite(v);');
    expect(rogue).toHaveLength(1);
    expect(rogue[0].kind).toBe('coercing-isfinite');

    // (i) direct eval flagged; member/identifier-spelled eval not.
    expect(discoverIdiomSites('f.ts', 'const v = eval(expr);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const v = safeEval(expr); const w = obj.eval(x);'),
    ).toEqual([]);

    // (j) timer-string-arg flagged; function callback not.
    expect(
      discoverIdiomSites('f.ts', "setTimeout('doX()', 100);"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'setTimeout(() => doX(), 100); setInterval(tick, 50);'),
    ).toEqual([]);

    // (k) typeof vs an impossible tag flagged in both polarities; the real
    // tags (object/bigint/…) are legitimate and not the class.
    expect(
      discoverIdiomSites('f.ts', "if (typeof x === 'array') run();"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "if (typeof x !== 'int') run();"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        "if (typeof x === 'object') run(); if (typeof x === 'bigint') run();",
      ),
    ).toEqual([]);

    // (l) json-clone idiom flagged; plain JSON.parse is not the class.
    expect(
      discoverIdiomSites('f.ts', 'const c = JSON.parse(JSON.stringify(cfg));'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const v = JSON.parse(text);')).toEqual([]);

    // (m) comparator-less sort flagged; comparator and typed sorts not.
    expect(discoverIdiomSites('f.ts', 'const s = xs.sort();')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const s = xs.sort((a, b) => a - b);'),
    ).toEqual([]);

    // (n) instanceof Array flagged; ArrayBuffer (a different global) not.
    expect(
      discoverIdiomSites('f.ts', 'if (xs instanceof Array) run();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'if (buf instanceof ArrayBuffer) run();'),
    ).toEqual([]);

    // (o) empty catch flagged (with and without binding); a logging body
    // is not empty.
    expect(
      discoverIdiomSites('f.ts', 'try { f(); } catch (e) {}'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'try { f(); } catch {}')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'try { f(); } catch (e) { log(e); }'),
    ).toEqual([]);

    // (p) substr flagged; the modern slice/substring spellings not.
    expect(discoverIdiomSites('f.ts', 'const t = s.substr(0, 3);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const t = s.slice(0, 3); const u = s.substring(0, 3);'),
    ).toEqual([]);

    // (q) escape/unescape flagged; encodeURIComponent is the safe form.
    // (two lines: discovery is line×kind, so one line holding both
    // spellings yields one hit — the census reads a line as a unit)
    expect(
      discoverIdiomSites('f.ts', 'const a = escape(u);\nconst b = unescape(u);'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const a = encodeURIComponent(u); const b = decodeURIComponent(u);'),
    ).toEqual([]);

    // (r) radix-less parseInt flagged; the radix form not.
    expect(discoverIdiomSites('f.ts', 'const n = parseInt(v);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const n = parseInt(v, 10); const m = Number.parseInt(v, 10);'),
    ).toEqual([]);

    // (s) `~~` and `| 0` truncation flagged; `|| 0` falsy-guard and the
    // `>>> 0` unsigned-coercion (required CRC/PRNG math) are not the class.
    expect(
      discoverIdiomSites('f.ts', 'const t = ~~x;\nconst u = x | 0;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const a = xs.get(k) || 0; const b = crc >>> 0; const c = q >> 1;'),
    ).toEqual([]);

    // (t) legacy apply-spread forms flagged; spread/Function.apply-this not.
    expect(
      discoverIdiomSites('f.ts', 'xs.push.apply(xs, ys);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'Math.max.apply(null, xs);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'xs.push(...ys); const m = Math.max(...xs); fn.apply(this, args);'),
    ).toEqual([]);

    // (u) new Function / debugger / document.write / deprecated Date API
    // flagged; their safe counterparts not.
    expect(
      discoverIdiomSites('f.ts', 'const f = new Function("a", "return a");'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', '  debugger;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'document.write("<b>hi</b>");'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const y = d.getYear();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        'const f = () => 1; const y = d.getFullYear(); const el = document.createElement("b"); const debuggerX = 1;',
      ),
    ).toEqual([]);

    // (v) array-like slice.call and .constructor escape hatch flagged;
    // Array.from and quoted data not. (One line matching several
    // alternatives of ONE kind is a single hit — discovery is line×kind.)
    expect(
      discoverIdiomSites('f.ts', 'const xs = Array.prototype.slice.call(args);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const proto = obj.constructor;'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const xs = Array.from(args); const keys = ['constructor', 'prototype'];"),
    ).toEqual([]);

    // (w) fromCharCode and __proto__ flagged; fromCodePoint and comment
    // lines not.
    expect(
      discoverIdiomSites('f.ts', 'const s = String.fromCharCode(cp);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const merged = { __proto__: base, extra: 1 };'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const s = String.fromCodePoint(cp);\n// __proto__ comment line'),
    ).toEqual([]);
  });
});
