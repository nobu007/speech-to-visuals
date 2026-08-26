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
 * The 2026-08-25 FOURTH discovery sweep (REQ-413 / Phase 220, same walk)
 * measured SEVEN more candidate classes. Three more were rejected BEFORE
 * pinning — `.map(async …)` is acceptable-or-not at the CONSUMPTION site
 * (a line detector cannot see whether the promise array is awaited, so a
 * pin would be pure noise; the dropping form `.forEach(async` is already
 * the pinned kind); `new Array(n)` preallocation (7 src sites) is
 * sized-assign or `.fill`-ed with no hole-read path, so the class carries
 * no incident shape as measured; and `Math.max(...xs)`-style spread-apply
 * (25 sites) is input-bounded everywhere measured (segment groups, node
 * coordinates, level keys — cardinalities orders of magnitude under the
 * ~65k spread-arg limit), making it a clean class whose per-site bounded
 * prose would cost a FULL family for zero fixes — re-run this census the
 * moment an unbounded-input site appears. The remaining SEVEN joined the
 * registry:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   primitive-wrapper-ctor        0         exact-0 pin
 *   arguments-index-access        0         exact-0 pin
 *   regexp-literal-ctor           0         exact-0 pin (fully-literal
 *                                           single-arg form only — dynamic
 *                                           construction is legitimate)
 *   split-join-replaceall         0         exact-0 pin (production
 *                                           surface; the two repo hits are
 *                                           off-walk __tests__ fixtures)
 *   label-statement               0         exact-0 pin
 *   bare-encodeuri                0         exact-0 pin
 *   var-declaration               2 (src)   ALLOWED — both hits are the
 *                                           TYPE-ONLY ambient spelling
 *                                           inside browser-transcriber's
 *                                           `declare global { … }` block;
 *                                           any runtime `var` is an
 *                                           unrostered RED
 *
 * The 2026-08-25 FIFTH discovery sweep (REQ-414 / Phase 221, same walk)
 * measured SEVENTEEN more candidate classes. Three more were rejected BEFORE
 * pinning — `.charCodeAt(` (15 sites) is code-unit-domain CORRECT at every
 * measured site (kana ranges are BMP, PNG/GIF chunk+header bytes are ASCII,
 * the octal-escape builder is Latin-1, the security compare WANTS code
 * units), so the class carries zero fixes and a 15-row prose roster is a
 * full family's investment for nothing (the Math.max(...xs) precedent:
 * re-run the census the moment a site does astral-plane text math);
 * `if (x = y)` assignment-in-condition is line-undetectable here because
 * every measured hit is an arrow (`=>`) inside the condition parens or the
 * canonical `while ((m = re.exec(src)) !== null)` loop — a line regex cannot
 * tell arrow-fat from assignment-equals without paren-depth parsing; and
 * `.charAt()` is behavior-equivalent to bracket access for every in-range
 * read (out-of-range: '' vs undefined — both falsy, no incident shape), the
 * same "挙動等価型" rejection class as Math.pow. The remaining FOURTEEN
 * joined the registry:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   nan-comparison                0         exact-0 pin (`x === NaN` is
 *                                           always false; Object.is is the
 *                                           NaN-safe spelling)
 *   bitwise-not-indexof           0         exact-0 pin (`~xs.indexOf(y)`)
 *   throw-string                  0         exact-0 pin (no stack, not
 *                                           instanceof Error, breaks
 *                                           catch-typing)
 *   legacy-endswith               0         exact-0 pin
 *                                           (`.lastIndexOf(x) === s.length-1`)
 *   legacy-datetime-now           0         exact-0 pin
 *                                           (`new Date().getTime()/.valueOf()`)
 *   unary-plus-date               0         exact-0 pin (`+new Date`)
 *   concat-empty-coercion         0         exact-0 pin (`x + ''`)
 *   deprecated-keycode            0         exact-0 pin (`.keyCode` /
 *                                           `.which`)
 *   caller-callee-access          0         exact-0 pin (strict-mode
 *                                           forbidden members)
 *   document-all                  0         exact-0 pin
 *   array-prototype-generic-call  0         exact-0 pin (non-slice
 *                                           spellings; slice stays the
 *                                           arraylike-slice-call kind's
 *                                           own row)
 *   console-debug-log             1 (core)  ALLOWED — the logger's own
 *                                           level-gated debug transport
 *   process-exit                  1 (src)   ALLOWED — the API server's
 *                                           graceful-shutdown epilogue
 *   tolocalestring-bare           1 (core)  ALLOWED — safeToLocaleString's
 *                                           own finite-number delegation
 *
 * The 2026-08-26 SEVENTH discovery sweep (REQ-416 / Phase 224, same walk,
 * 331 files) measured TEN more candidate classes. THREE were rejected
 * BEFORE pinning — `.length = 0` (10 sites) and `.splice(…)` (27 sites)
 * both measured zero incident shape: every site is an intentional
 * in-place drain / queue op on an instance-owned receiver (splice IS the
 * correct queue primitive, and family 16 canonized the receiver-mutation
 * concept), so a pin would be 37 rows of permanent ALLOWED-roster noise
 * for zero fixes — the 投資不釣合型 rejection (charCodeAt /
 * Math.max(...xs) / .substring precedent, examples #4 and #5).
 * `return` inside `finally` was rejected as 検出不可能型 (the
 * assignment-in-condition precedent, second example): the incident shape
 * spans lines and needs block-scope parsing, while a finally-line
 * detector's site population is EVERY finally block (13 on the surface,
 * all cleanup-only) — pinning it would tax every future legitimate
 * try/finally with a roster row (site population ≠ incident population).
 * The remaining SEVEN joined the registry:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   async-promise-executor        0         exact-0 pin (an async
 *                                           executor's throws become
 *                                           unhandled rejections)
 *   array-delete-hole             0         exact-0 pin (`delete a[i]`
 *                                           holes skip map/forEach)
 *   instanceof-primitive-wrapper  0         exact-0 pin (always false for
 *                                           primitives — typeof is the form)
 *   atob-btoa                     0         exact-0 pin (Latin-1 codecs;
 *                                           TextEncoder/Decoder are the form)
 *   inner-html-op-assign          0         exact-0 pin (`innerHTML +=` is
 *                                           the = sink's compound form)
 *   insert-adjacent-html          0         exact-0 pin (markup-parsing
 *                                           sink — innerHTML's sibling)
 *   sparse-array-ctor             0         exact-0 pin (new Array(n) is
 *                                           holey; Array.from is the form)
 *
 * The 2026-08-25 SIXTH discovery sweep (REQ-415 / Phase 222, same walk)
 * measured TWENTY-THREE more candidate classes. One was rejected BEFORE
 * pinning — `.substring(` (23 src sites) is behavior-identical to slice at
 * every measured site (0-start truncations and Math.min/Max-normalized
 * spans cannot hit the indexA>indexB swap that is the class's only incident
 * shape), so the class carries zero fixes and a 23-row per-site prose
 * roster is a full family's investment for nothing — the 投資不釣合型
 * rejection (charCodeAt/Math.max(...xs) precedent, third example). The
 * remaining TWENTY-TWO joined the registry:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   legacy-trim-side              0         exact-0 pin (trimStart/trimEnd)
 *   regexp-static-property        0         exact-0 pin (RegExp.$1 statics)
 *   throw-object-literal          0         exact-0 pin (no stack / not
 *                                           instanceof Error — throw-string's
 *                                           own class)
 *   throw-null                    0         exact-0 pin (same class)
 *   javascript-url                0         exact-0 pin (inline-handler
 *                                           vector / CSP violation)
 *   blocking-dialog               1 (src)   ALLOWED — the GuardMetrics
 *                                           reset button's destructive-action
 *                                           confirm gate
 *   legacy-xhr                    0         exact-0 pin (fetch is the form)
 *   minified-boolean-literal      0         exact-0 pin (!0 / !1)
 *   esm-require-call              0         exact-0 pin (`"type": "module"`
 *                                           repo — CJS spellings are
 *                                           runtime crashes; scripts/ tsx
 *                                           shims are off-walk)
 *   esm-module-exports            0         exact-0 pin
 *   esm-cjs-global                0         exact-0 pin (__dirname etc.)
 *   node-global-identifier        5 (src)   VIOLATION — unified in-commit:
 *                                           `global.gc` → `globalThis.gc` at
 *                                           all five lines (three spelling
 *                                           shapes of ONE feature check);
 *                                           `global` is undefined in
 *                                           browsers/ESM bundles, so the two
 *                                           unguarded sites were latent
 *                                           ReferenceErrors and the typeof-
 *                                           guarded site was a third spelling
 *   direct-cookie-access          0         exact-0 pin
 *   useragent-sniffing            3 (src)   ALLOWED — all three measured
 *                                           sites REPORT the UA (telemetry
 *                                           context / browser-name
 *                                           diagnostics); none branches
 *                                           behavior on it
 *   localecompare-bare            0         exact-0 pin (default-locale sort
 *                                           drift — tolocalestring-bare's
 *                                           ordering twin)
 *   intl-bare-default-locale      0         exact-0 pin
 *   inner-html-assignment         0         exact-0 pin (the XSS sink)
 *   window-implicit-event         0         exact-0 pin (IE event model)
 *   event-returnvalue             0         exact-0 pin
 *   string-html-method            0         exact-0 pin (Annex B wrappers)
 *   legacy-define-getter          0         exact-0 pin (pre-ES5 accessors)
 *   locale-sensitive-bare         0         exact-0 pin (locale-default
 *                                           case conversion)
 *
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
 *   <!-- census-pin:F19:dead-idiom-batch ALLOWED 18 key / ERADICATED 12 key -->
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
  // --- REQ-413 fourth sweep (seven kinds, all measured on 2026-08-25) ---
  // `new Number/String/Boolean(x)` boxes a primitive: `new Number(1) === 1`
  // is false and typeof reports 'object' — the wrapper then leaks into
  // arithmetic as the unboxed value while comparing as an object.
  {
    id: 'primitive-wrapper-ctor',
    detect: /\bnew\s+(?:Number|String|Boolean)\s*\(/,
  },
  // `arguments[i]` aliases the (possibly mutated) parameter list and is not
  // an array; rest params (`...args`) are the typed spelling.
  { id: 'arguments-index-access', detect: /\barguments\s*\[/ },
  // A FULLY-LITERAL `new RegExp('…')` (no interpolation, single arg) is the
  // regex-literal spelled wrong: `'\\b'` vs `'\b'` typo class produces a
  // silently-wrong pattern. Dynamic construction (interpolated / multi-arg)
  // is NOT the class.
  {
    id: 'regexp-literal-ctor',
    detect: /new\s+RegExp\s*\(\s*['"][^'"}$]*['"]\s*\)/,
  },
  // `.split(sep).join(repl)` is the pre-ES2021 replaceAll spelling. NOT
  // behavior-identical on migration: a repl containing `$&`-patterns is
  // literal under split/join but interpolated under replaceAll — the ratchet
  // forces the swap to be made (and re-read) per site.
  { id: 'split-join-replaceall', detect: /\.split\([^)]*\)\s*\.\s*join\(/ },
  // A labeled loop (`outer: for …`) is the pre-extract-function control-flow
  // idiom; break-with-label reads as a plain break after any local refactor.
  { id: 'label-statement', detect: /^\s*[A-Za-z_$][\w$]*\s*:\s*(?:for|while)\s*\(/ },
  // Bare `encodeURI` leaves `&=?#` unescaped — a query value built with it
  // splits into attacker-chosen parameters. encodeURIComponent is the form.
  { id: 'bare-encodeuri', detect: /(?<![.\w$])encodeURI\(/ },
  // Runtime `var` (hoisting, no block scope). The two measured hits are
  // TYPE-ONLY ambient declarations inside `declare global { … }` — the
  // canonical TS spelling — and sit in the ALLOWED roster below; any other
  // `var` on the surface is a runtime one and an unrostered RED.
  { id: 'var-declaration', detect: /^\s*var\s+\w/ },
  // --- REQ-414 fifth sweep (fourteen kinds, all measured on 2026-08-25) ---
  // `x === NaN` / `NaN !== x` is always false/true — NaN is the one value
  // unequal to itself; Object.is(x, NaN) is the NaN-safe spelling.
  {
    id: 'nan-comparison',
    detect:
      /\bNaN\s*(?:===?|!==?)\s*[^\s=]|[^\s=!<>]\s*(?:===?|!==?)\s*NaN\b/,
  },
  // `~xs.indexOf(y)` (and `!!~…`) is the bitwise-trick spelling of `>= 0`.
  {
    id: 'bitwise-not-indexof',
    detect: /[!~]~[\w$.]+\.(?:indexOf|lastIndexOf)\(/,
  },
  // `throw 'message'` throws a string: no stack trace, not instanceof Error.
  { id: 'throw-string', detect: /throw\s+['"`]/ },
  // `.lastIndexOf(x) === s.length - 1` is the pre-endsWith spelling.
  {
    id: 'legacy-endswith',
    detect:
      /\.lastIndexOf\([^)]*\)\s*(?:!==?|===?)\s*[\w$.]+\.length\s*-\s*1/,
  },
  // `new Date().getTime()` / `.valueOf()` is the legacy spelling of
  // Date.now() (getHours etc. are NOT the class — they read local fields).
  {
    id: 'legacy-datetime-now',
    detect:
      /new Date\(\)\.get(?:Time|Milliseconds)\(\)|new Date\(\)\.valueOf\(\)/,
  },
  // Unary `+new Date` coerces the date to a number — Date.now() is the form.
  // The lookbehind keeps BINARY string concat (`'…' + new Date()`) out;
  // other unary spellings (`y || +new Date`) are a documented ceiling.
  {
    id: 'unary-plus-date',
    detect: /(?<==|\(|return)\s*\+\s*new\s+Date\b/,
  },
  // `x + ''` is the legacy string coercion — String(x) is the explicit form.
  { id: 'concat-empty-coercion', detect: /\+\s*(?:''|"")/ },
  // `.keyCode` / `.which` are the deprecated keyboard/mouse event spellings
  // (`key` / `button` are the modern members).
  { id: 'deprecated-keycode', detect: /\.(?:keyCode|which)\b/ },
  // Function.prototype.caller / arguments.callee are forbidden in strict
  // mode, block optimizations, and break inlining.
  { id: 'caller-callee-access', detect: /\.(?:caller|callee)\b/ },
  // `document.all` is the dead IE detection idiom (a falsy "truthy" object).
  { id: 'document-all', detect: /document\.all\b/ },
  // `Array.prototype.X.call(…)` generic-call spellings other than slice
  // (the slice spelling is the arraylike-slice-call kind's own row).
  {
    id: 'array-prototype-generic-call',
    detect: /Array\.prototype\.(?!slice\b)\w+\.call\(/,
  },
  // Stray debug tracing on the production surface: console.log /
  // console.debug outside the logger itself (info/warn/error are
  // operational logging, not the class).
  { id: 'console-debug-log', detect: /console\.(?:log|debug)\s*\(/ },
  // process.exit tears the process down mid-flight; the one measured site is
  // the API server's deliberate graceful-shutdown exit.
  { id: 'process-exit', detect: /process\.exit\s*\(/ },
  // Bare `.toLocaleString()` formats with the RUNTIME's default locale —
  // output drifting across environments (locale commas in CSV/PDF export
  // would be data corruption); explicit-locale / helper-gated spellings are
  // the form.
  { id: 'tolocalestring-bare', detect: /\.toLocaleString\s*\(\s*\)/ },
  // --- REQ-415 sixth sweep (twenty-two kinds, all measured on 2026-08-25) ---
  // trimLeft/trimRight are the Annex-B spellings; trimStart/trimEnd are ES2019.
  { id: 'legacy-trim-side', detect: /\.trim(?:Left|Right)\s*\(/ },
  // RegExp.$1 / lastMatch statics are Annex-B legacy and per-thread mutable.
  {
    id: 'regexp-static-property',
    detect: /RegExp\s*[.[]\s*(?:\$\d|lastMatch|lastParen|input|\$[&+`])/,
  },
  // `throw {…}` shares throw-string's class: no stack, not instanceof Error,
  // breaks catch-typing (throw-null is the same class's degenerate form).
  { id: 'throw-object-literal', detect: /throw\s*\{/ },
  { id: 'throw-null', detect: /throw\s+null\b/ },
  // A `javascript:` URL is the inline-event-handler vector (and a CSP
  // violation in any sandboxed deployment).
  { id: 'javascript-url', detect: /['"`]javascript:/i },
  // alert/confirm/prompt block the main thread for the WHOLE page and are
  // silently no-ops in sandboxed iframes without allow-modals.
  {
    id: 'blocking-dialog',
    detect: /(?<![.\w$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/,
  },
  // XMLHttpRequest is the pre-fetch transport (callback hell, no streams).
  { id: 'legacy-xhr', detect: /XMLHttpRequest/ },
  // `!0` / `!1` minified booleans are unreadable in handwritten source.
  {
    id: 'minified-boolean-literal',
    detect: /[=,({[?:;&|<>+\-*\/%^~]\s*!\s*[01]\b|^\s*!\s*[01]\b/,
  },
  // require()/module.exports/__dirname/__filename are CJS spellings; this
  // repo is `"type": "module"`, so they are ReferenceError/undefined at
  // runtime in ESM and browser contexts (scripts/ tsx shims are off-walk).
  { id: 'esm-require-call', detect: /(?<![.\w$])require\s*\(/ },
  { id: 'esm-module-exports', detect: /module\.exports|(^|\s)exports\.\w+\s*=/ },
  { id: 'esm-cjs-global', detect: /__dirname|__filename/ },
  // `global.` is the Node-only identifier — undefined in browsers and Vite
  // ESM bundles (ReferenceError); globalThis is the portable spelling. The
  // five measured sites were unified in-commit (see ERADICATED below).
  { id: 'node-global-identifier', detect: /(?<![.\w$])global\s*\./ },
  // document.cookie bypasses every storage abstraction the repo has.
  { id: 'direct-cookie-access', detect: /document\.cookie/ },
  // navigator.userAgent BRANCHING is the legacy capability check; feature
  // detection is the form. The three measured sites are report-only.
  { id: 'useragent-sniffing', detect: /navigator\.userAgent(?!\w)/ },
  // Single-arg `.localeCompare(x)` compares with the RUNTIME default locale —
  // sort order drifts across environments (the tolocalestring-bare drift
  // class, applied to ordering); explicit-locale args are the form.
  { id: 'localecompare-bare', detect: /\.localeCompare\s*\(\s*[\w$.'"]+\s*\)/ },
  // A no-arg Intl ctor formats with the runtime default locale.
  { id: 'intl-bare-default-locale', detect: /new\s+Intl\.\w+\s*\(\s*\)/ },
  // `.innerHTML =` is THE XSS sink; dangerouslySetInnerHTML is React's form.
  { id: 'inner-html-assignment', detect: /\.innerHTML\s*=/ },
  // window.event / `.returnValue =` are the IE legacy event model.
  { id: 'window-implicit-event', detect: /window\.event\b/ },
  { id: 'event-returnvalue', detect: /\.returnValue\s*=/ },
  // String's HTML wrapper methods (Annex B) build markup from strings.
  {
    id: 'string-html-method',
    detect: /\.(?:anchor|big|blink|bold|fixed|fontcolor|fontsize|italics|link|small|strike|sub|sup)\s*\(/,
  },
  // __defineGetter__ / __lookupGetter__ are the pre-ES5 accessor spellings.
  {
    id: 'legacy-define-getter',
    detect: /__define(?:Getter|Setter)__|__lookup(?:Getter|Setter)__/,
  },
  // Bare toLocaleUpperCase/toLocaleLowerCase case-fold with the runtime
  // default locale (same drift class as tolocalestring-bare).
  {
    id: 'locale-sensitive-bare',
    detect: /\.to(?:LocaleUpperCase|LocaleLowerCase)\s*\(\s*\)/,
  },
  // --- REQ-416 seventh sweep (seven kinds, all measured on 2026-08-26) ---
  // An async Promise executor detaches every throw inside it from the
  // promise chain — the rejection is unhandled and the promise never
  // settles from the executor's own failure.
  { id: 'async-promise-executor', detect: /new\s+Promise\s*\(\s*async\b/ },
  // `delete a[i]` punches a hole: length is unchanged and map/forEach skip
  // the slot. splice / filter are the forms.
  { id: 'array-delete-hole', detect: /delete\s+[\w$.]+\s*\[/ },
  // Primitives never satisfy instanceof String/Number/Boolean — always
  // false for the primitive side the check is written for (typeof is the
  // form).
  {
    id: 'instanceof-primitive-wrapper',
    detect: /instanceof\s+(?:String|Number|Boolean)\b/,
  },
  // atob/btoa are Latin-1 byte codecs — they throw INVALID_CHARACTER_ERR
  // on any UTF-8 content (TextEncoder/TextDecoder are the form).
  { id: 'atob-btoa', detect: /(?<![.\w$])(?:atob|btoa)\s*\(/ },
  // `.innerHTML +=` is inner-html-assignment's compound form — the same
  // XSS sink, invisible to the `=`-only regex.
  { id: 'inner-html-op-assign', detect: /\.innerHTML\s*\+=/ },
  // insertAdjacentHTML parses its argument as markup — the innerHTML
  // sink's sibling (React's dangerouslySetInnerHTML is the explicit form).
  { id: 'insert-adjacent-html', detect: /\.insertAdjacentHTML\s*\(/ },
  // `new Array(n)` builds a holey array whose map/forEach skip every slot;
  // Array.from({ length: n }) is the form (literal-length single-arg only —
  // a variable-length ctor site gets measured if one ever appears).
  { id: 'sparse-array-ctor', detect: /new\s+Array\s*\(\s*\d+\s*\)/ },
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
  // [var-declaration] both hits sit inside `declare global { … }` (line
  // 449): `var X: T` there is TS's CANONICAL spelling of a global ambient
  // variable (the DOM-lib convention — `declare var SpeechRecognition`).
  // Type-only, zero runtime emit; a runtime `var` anywhere else on the
  // surface is an unrostered RED.
  'src/transcription/browser-transcriber.ts:497':
    'AMBIENT-SYNTAX — inside declare global: `var SpeechRecognition: {…}` is the canonical TS spelling of a global ambient constructor var (type-only, no runtime emit).',
  'src/transcription/browser-transcriber.ts:502':
    'AMBIENT-SYNTAX — webkit-prefixed constructor var in the same declare-global block (type-only, no runtime emit).',
  // [console-debug-log] the core logger's own debug sink — the level gate
  // (`currentLogLevel <= LogLevel.DEBUG`, monitoring.logLevel-driven) is the
  // adjacent line and console.debug IS the transport. A console.log/debug
  // anywhere else on the surface is a stray debug trace and an unrostered
  // RED.
  'src/utils/logger.ts:20':
    'LOGGER-IMPL — the logger itself: the debug method level gate (currentLogLevel <= LogLevel.DEBUG) is the adjacent line and console.debug is the transport; every other console.log/debug on the surface is a stray debug trace.',
  // [process-exit] the API server entrypoint's deliberate terminal act —
  // gracefulShutdown has already stopped/logged every background service by
  // the time this line runs (SIGTERM/SIGINT handlers route here).
  'src/api/index.ts:64':
    'SERVER-EXIT — gracefulShutdown epilogue after every background service is stopped and logged (SIGTERM/SIGINT route here); a process.exit in library/pipeline/component code is an unrostered RED.',
  // [tolocalestring-bare] safeToLocaleString's own finite-number return
  // path delegates to the native formatter — the null/NaN gate IS the
  // helper's purpose. A bare locale-default call elsewhere (especially in
  // export/CSV/PDF paths where locale commas corrupt deterministic output)
  // is an unrostered RED.
  'src/utils/guards.ts:114':
    'HELPER-DELEGATION — safeToLocaleString finite-number branch (typeof+Number.isFinite gated one line up); bare locale-default formatting elsewhere — locale commas in export output would be data corruption — is an unrostered RED.',
  // [blocking-dialog] the dashboard reset button's deliberate
  // destructive-action gate — confirm() IS the confirmation UX here (a
  // blocking modal before wiping accumulated security metrics). A blocking
  // dialog in any library/pipeline code path is an unrostered RED.
  'src/components/GuardMetricsDashboard.tsx:90':
    'CONFIRM-GATE — the reset button arms its destructive action with confirm(Reset all security metrics?) before reset(); blocking dialogs in non-UI flow (pipeline/library/api code) are an unrostered RED.',
  // [useragent-sniffing] all three measured sites REPORT the UA (telemetry
  // context / browser-name diagnostics) — none branches behavior on it. The
  // capability decision in browser-transcriber is the feature detection one
  // line up (`isRecognitionSupported`), not the UA string.
  'src/monitoring/production-error-handler.ts:271':
    'REPORT-ONLY — getBrowserInfo() fills a telemetry context object (userAgent/language/platform fields); no behavior branches on the string.',
  'src/monitoring/production-error-handler.ts:461':
    'REPORT-ONLY — telemetry payload field for error correlation; no behavior branches on the string.',
  'src/transcription/browser-transcriber.ts:257':
    'REPORT-ONLY — getBrowserCompatibility() diagnostics; the capability verdict is the feature detection (`isRecognitionSupported`), not the UA parse; a UA BRANCH is an unrostered RED.',
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
  // [node-global-identifier] `global` is the Node-only identifier: undefined
  // in browsers and Vite ESM bundles, so the three unguarded sites
  // (performance-dashboard :419, enhanced-error-recovery :284) were latent
  // ReferenceErrors in any browser-reachable path, and main-pipeline's
  // typeof-global spelling was a fourth spelling of one feature check.
  // globalThis is defined in BOTH realms (ES2020) and gc presence stays a
  // runtime feature check (--expose-gc), so semantics are identical.
  'src/monitoring/performance-dashboard.ts:419':
    'unified 2026-08-25 (REQ-415) — `if (global.gc) {` → `if (globalThis.gc) {`: globalThis exists in browsers too, so the memory-optimization branch no longer ReferenceErrors off-Node; the gc feature check is unchanged.',
  'src/monitoring/performance-dashboard.ts:420':
    'unified 2026-08-25 (REQ-415) — `global.gc();` → `globalThis.gc();` (same site as :419).',
  'src/pipeline/main-pipeline.ts:1428':
    'unified 2026-08-25 (REQ-415) — `if (typeof global !== "undefined" && global.gc)` → `if (globalThis.gc)`: the typeof guard existed only because `global` is browser-undefined; globalThis needs no guard and the spelling joins the two other sites.',
  'src/pipeline/main-pipeline.ts:1429':
    'unified 2026-08-25 (REQ-415) — `global.gc();` → `globalThis.gc();` (same site as :1428).',
  'src/quality/enhanced-error-recovery.ts:284':
    'unified 2026-08-25 (REQ-415) — `if (global.gc) global.gc();` → `if (globalThis.gc) globalThis.gc();`: unguarded `global` in the memory_cleanup preventive action was a latent browser ReferenceError; the feature check is unchanged.',
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
    expect(sites.filter((s) => s.kind === 'var-declaration').length).toBeGreaterThanOrEqual(2);
    expect(sites.filter((s) => s.kind === 'console-debug-log').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'process-exit').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'tolocalestring-bare').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'blocking-dialog').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'useragent-sniffing').length).toBeGreaterThanOrEqual(3);
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
      'primitive-wrapper-ctor',
      'arguments-index-access',
      'regexp-literal-ctor',
      'split-join-replaceall',
      'label-statement',
      'bare-encodeuri',
      'var-declaration',
      'nan-comparison',
      'bitwise-not-indexof',
      'throw-string',
      'legacy-endswith',
      'legacy-datetime-now',
      'unary-plus-date',
      'concat-empty-coercion',
      'deprecated-keycode',
      'caller-callee-access',
      'document-all',
      'array-prototype-generic-call',
      'console-debug-log',
      'process-exit',
      'tolocalestring-bare',
      'legacy-trim-side',
      'regexp-static-property',
      'throw-object-literal',
      'throw-null',
      'javascript-url',
      'blocking-dialog',
      'legacy-xhr',
      'minified-boolean-literal',
      'esm-require-call',
      'esm-module-exports',
      'esm-cjs-global',
      'node-global-identifier',
      'direct-cookie-access',
      'useragent-sniffing',
      'localecompare-bare',
      'intl-bare-default-locale',
      'inner-html-assignment',
      'window-implicit-event',
      'event-returnvalue',
      'string-html-method',
      'legacy-define-getter',
      'locale-sensitive-bare',
      'async-promise-executor',
      'array-delete-hole',
      'instanceof-primitive-wrapper',
      'atob-btoa',
      'inner-html-op-assign',
      'insert-adjacent-html',
      'sparse-array-ctor',
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
      // The two rostered var sites stay INSIDE the declare-global block —
      // ambient type syntax. Moving them out (runtime var) must land in the
      // offender list; converting them to another ambient spelling makes
      // the rows stale (RED), forcing the roster to shed them in-commit.
      [
        'src/transcription/browser-transcriber.ts',
        /declare global \{[\s\S]*\n  var SpeechRecognition: \{/,
      ],
      // The rostered core logger site keeps its level gate on the adjacent
      // line — an unconditional console.debug (gate deleted) flips this
      // anchor, forcing the row to be re-judged in the same change.
      [
        'src/utils/logger.ts',
        /currentLogLevel <= LogLevel\.DEBUG\) \{\s*\n\s*console\.debug\(/,
      ],
      // The rostered process-exit stays the graceful-shutdown epilogue: the
      // services-stopped log precedes it. Moving it ahead of the shutdown
      // work (or into library code) fails this anchor.
      [
        'src/api/index.ts',
        /logger\.info\('All background services shut down'\);[\s\S]*\n\s*process\.exit\(0\);/,
      ],
      // The rostered toLocaleString site stays the finite-number branch of
      // safeToLocaleString (the null/NaN gate is the helper's whole point).
      [
        'src/utils/guards.ts',
        /Number\.isFinite\(value\)\) return value\.toLocaleString\(\);/,
      ],
      // The rostered confirm gate keeps arming the destructive reset — a
      // direct reset() (gate deleted) fails this anchor, the stale-row test,
      // AND the authority floor, forcing re-judgment in the same change.
      [
        'src/components/GuardMetricsDashboard.tsx',
        /if \(confirm\('Reset all security metrics\?'\)\) reset\(\);/,
      ],
      // The rostered UA sites stay REPORT-ONLY (telemetry field /
      // diagnostics read). A behavior branch on the UA string is not the
      // rostered shape — it reads as a new site and lands in the offender
      // list; swapping to a feature-detection report makes the rows stale.
      ['src/monitoring/production-error-handler.ts', /userAgent: navigator\.userAgent,/],
      ['src/transcription/browser-transcriber.ts', /const ua = navigator\.userAgent;/],
      // The three unified gc sites keep the globalThis spelling — `global`
      // is undefined in browsers/ESM bundles, so a revert is a latent
      // ReferenceError AND an eradicated-reappear RED.
      ['src/monitoring/performance-dashboard.ts', /if \(globalThis\.gc\) \{\s*\n\s*globalThis\.gc\(\);/],
      ['src/pipeline/main-pipeline.ts', /if \(globalThis\.gc\) \{\s*\n\s*globalThis\.gc\(\);/],
      ['src/quality/enhanced-error-recovery.ts', /if \(globalThis\.gc\) globalThis\.gc\(\);/],
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
    // Same completeness pin for the globalThis unify: all five unified
    // lines (six occurrences — the one-line recovery site carries two)
    // across the three files at once.
    expect(
      [
        'src/monitoring/performance-dashboard.ts',
        'src/pipeline/main-pipeline.ts',
        'src/quality/enhanced-error-recovery.ts',
      ].reduce(
        (sum, f) =>
          sum + (readSource(f).match(/globalThis\.gc/g) ?? []).length,
        0,
      ),
    ).toBe(6);
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

    // (x) REQ-413 fourth-sweep kinds: each flags its dead form and leaves
    // the modern / dynamic spellings alone.
    // (x1) primitive wrappers flagged; the coercion functions (no `new`) not.
    expect(
      discoverIdiomSites('f.ts', 'const boxed = new Number(5);\nconst s = new String(x);'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const n = Number(x); const s = String(x); const b = Boolean(x);'),
    ).toEqual([]);
    // (x2) arguments indexing flagged; a rest-param array not.
    expect(
      discoverIdiomSites('f.ts', 'const first = arguments[0];'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const first = args[0];')).toEqual([]);
    // (x3) a FULLY-LITERAL RegExp ctor flagged; regex literals, dynamic
    // (identifier / multi-arg / template) construction not.
    expect(
      discoverIdiomSites("f.ts", "const re = new RegExp('\\\\d+');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        'const a = /\\d+/; const b = new RegExp(src); const c = new RegExp(src, \'i\');',
      ),
    ).toEqual([]);
    // (x4) split/join replaceAll flagged; replaceAll and split-alone not.
    expect(
      discoverIdiomSites("f.ts", "const s = x.split(',').join('-');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites("f.ts", "const s = x.replaceAll(',', '-'); const parts = x.split(',');"),
    ).toEqual([]);
    // (x5) a labeled loop flagged; plain loops and object keys not.
    expect(
      discoverIdiomSites('f.ts', 'outer: for (const x of xs) { break outer; }'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'for (const x of xs) {} while (done) {} const t = { color: x };'),
    ).toEqual([]);
    // (x6) bare encodeURI flagged; encodeURIComponent and members not.
    expect(
      discoverIdiomSites('f.ts', 'const u = encodeURI(loc);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const u = encodeURIComponent(q); const v = myEncodeURI(x);'),
    ).toEqual([]);
    // (x7) runtime var flagged; let/const and comment lines not.
    expect(discoverIdiomSites('f.ts', 'var legacy = 1;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const a = 1; let b = 2;\n// var commented = 3;'),
    ).toEqual([]);

    // (y) REQ-414 fifth-sweep kinds: each flags its dead form and leaves
    // the modern spellings alone.
    // (y1) NaN comparison flagged in both directions; Object.is and the
    // Number.isNaN spelling not.
    expect(
      discoverIdiomSites('f.ts', 'if (x === NaN) run();\nif (NaN !== x) run();'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const ok = Object.is(x, NaN); const bad = Number.isNaN(x);'),
    ).toEqual([]);
    // (y2) the ~indexOf trick flagged (both !!~ and bare ~); includes and a
    // plain indexOf read not.
    expect(discoverIdiomSites('f.ts', 'const found = !!~xs.indexOf(y);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const found = xs.includes(y); const i = xs.indexOf(y);'),
    ).toEqual([]);
    // (y3) string/template throws flagged; an Error throw not.
    expect(
      discoverIdiomSites('f.ts', "throw 'boom';\nthrow `boom`;"),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', "throw new Error('boom');")).toEqual([]);
    // (y4) the lastIndexOf endsWith legacy flagged; endsWith not.
    expect(
      discoverIdiomSites('f.ts', "if (name.lastIndexOf('/') === name.length - 1) run();"),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', "if (name.endsWith('/')) run();")).toEqual([]);
    // (y5) legacy Date.now spellings flagged; Date.now() and the legitimate
    // local-field readers (getHours) not.
    expect(
      discoverIdiomSites('f.ts', 'const t = new Date().getTime();\nconst v = new Date().valueOf();'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const t = Date.now(); const h = new Date().getHours();'),
    ).toEqual([]);
    // (y6) unary +new Date flagged; binary string concat with a Date not.
    expect(discoverIdiomSites('f.ts', 'const t = +new Date;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const s = 'at ' + new Date().toISOString();"),
    ).toEqual([]);
    // (y7) the + '' coercion flagged; String(x) and real suffix concat not.
    expect(discoverIdiomSites('f.ts', "const s = x + '';")).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const s = String(x); const q = a + 'px';"),
    ).toEqual([]);
    // (y8) keyCode/which flagged; the modern `key` member not.
    expect(
      discoverIdiomSites('f.ts', "if (e.keyCode === 13) run();\nif (ev.which === 1) run();"),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', "if (e.key === 'Enter') run();")).toEqual([]);
    // (y9) caller/callee flagged; .call and .map not.
    expect(
      discoverIdiomSites('f.ts', 'const c = fn.caller;\nconst a = arguments.callee;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const c = obj.call; const m = xs.map(fn);'),
    ).toEqual([]);
    // (y10) document.all flagged (word-boundary); a longer property not.
    expect(discoverIdiomSites('f.ts', 'if (document.all) run();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'if (document.allSupported) run();')).toEqual([]);
    // (y11) non-slice Array.prototype generic calls flagged; the slice
    // spelling stays the arraylike-slice-call kind's own single hit.
    expect(
      discoverIdiomSites('f.ts', 'Array.prototype.forEach.call(list, fn);'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const xs = Array.from(list);')).toEqual([]);
    const sliceForm = discoverIdiomSites(
      'f.ts',
      'const xs = Array.prototype.slice.call(args);',
    );
    expect(sliceForm).toHaveLength(1);
    expect(sliceForm[0].kind).toBe('arraylike-slice-call');
    // (y12) console.log/debug flagged (one line × one kind = one hit);
    // info/warn/error and the logger facade not.
    expect(
      discoverIdiomSites('f.ts', "console.log('x'); console.debug('y');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        "console.info('z'); console.warn('w'); console.error('e'); logger.debug('m');",
      ),
    ).toEqual([]);
    // (y13) process.exit(…) flagged; the exitCode assignment not.
    expect(discoverIdiomSites('f.ts', 'process.exit(1);')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'process.exitCode = 1;')).toEqual([]);
    // (y14) bare locale-default toLocaleString flagged; explicit-locale and
    // helper-gated spellings not.
    expect(discoverIdiomSites('f.ts', 'const s = n.toLocaleString();')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const s = n.toLocaleString('ja-JP'); const t = safeToLocaleString(n);"),
    ).toEqual([]);

    // (z) REQ-415 sixth-sweep kinds: each flags its dead form and leaves
    // the modern spellings alone.
    // (z1) trimLeft/trimRight flagged; trimStart/trimEnd not.
    expect(
      discoverIdiomSites('f.ts', 'const a = s.trimLeft();\nconst b = s.trimRight();'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const a = s.trimStart(); const b = s.trimEnd();'),
    ).toEqual([]);
    // (z2) RegExp statics flagged; match-array access not.
    expect(discoverIdiomSites('f.ts', 'const m = RegExp.$1;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const m = match[1]; const re = /x/;')).toEqual([]);
    // (z3) throw of a literal / null flagged; Error throws not.
    expect(
      discoverIdiomSites('f.ts', 'throw { code: 1 };\nthrow null;'),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', "throw new Error('x');")).toEqual([]);
    // (z4) javascript: URL flagged; http(s)/data URLs not.
    expect(
      discoverIdiomSites('f.ts', "const u = 'javascript:void(0)';"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const u = 'https://x.test/a'; const d = 'data:text/plain,hi';"),
    ).toEqual([]);
    // (z5) blocking dialogs flagged (bare and window-spelled); member and
    // custom-spelled forms not.
    expect(
      discoverIdiomSites('f.ts', "if (confirm('ok?')) reset();\nwindow.alert('x');"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const v = myConfirm(x); dialogs.confirm = f;'),
    ).toEqual([]);
    // (z6) XMLHttpRequest flagged; fetch not.
    expect(
      discoverIdiomSites('f.ts', 'const x = new XMLHttpRequest();'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const x = fetch(u);')).toEqual([]);
    // (z7) minified booleans flagged; true/false and !== 0 not.
    expect(
      discoverIdiomSites('f.ts', 'const ok = !0;\nconst no = !1;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const ok = true; const same = x !== 0; const diff = a !== 1;'),
    ).toEqual([]);
    // (z8) CJS spellings flagged (require / module.exports / __dirname /
    // __filename); ESM spellings not.
    expect(
      discoverIdiomSites('f.ts', "const fs = require('fs');\nmodule.exports = run;\nconst d = __dirname;\nconst f = __filename;"),
    ).toHaveLength(4);
    expect(
      discoverIdiomSites('f.ts', "import fs from 'node:fs';\nexport default run;\nconst here = import.meta.url;"),
    ).toEqual([]);
    // (z9) Node `global.` flagged; globalThis (the portable spelling) not.
    expect(discoverIdiomSites('f.ts', 'if (global.gc) run();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'if (globalThis.gc) run(); const g = myGlobal.x;')).toEqual([]);
    // (z10) document.cookie flagged; storage abstractions not.
    expect(discoverIdiomSites('f.ts', 'const c = document.cookie;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const c = localStorage.getItem(k);')).toEqual([]);
    // (z11) navigator.userAgent flagged; feature detection not.
    expect(
      discoverIdiomSites('f.ts', 'const ua = navigator.userAgent;'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "if (typeof window.speechSynthesis !== 'undefined') run();"),
    ).toEqual([]);
    // (z12) single-arg default-locale localeCompare flagged; explicit-locale
    // two-arg form not.
    expect(
      discoverIdiomSites('f.ts', 'const ord = a.localeCompare(b);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const ord = a.localeCompare(b, 'en');"),
    ).toEqual([]);
    // (z13) no-arg Intl ctor flagged; explicit-locale construction not.
    expect(
      discoverIdiomSites('f.ts', 'const fmt = new Intl.NumberFormat();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const fmt = new Intl.NumberFormat('ja-JP');"),
    ).toEqual([]);
    // (z14) innerHTML assignment flagged; textContent and React's
    // dangerouslySetInnerHTML prop not.
    expect(discoverIdiomSites('f.ts', 'el.innerHTML = html;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'el.textContent = text; const r = <div dangerouslySetInnerHTML={{ __html: h }} />;'),
    ).toEqual([]);
    // (z15) window.event / .returnValue flagged; the standard event members
    // (target, preventDefault) not.
    expect(
      discoverIdiomSites('f.ts', 'const t = window.event.type;\nel.returnValue = false;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const t = e.target.value; e.preventDefault();'),
    ).toEqual([]);
    // (z16) String HTML wrapper methods flagged; real formatting calls not.
    expect(discoverIdiomSites('f.ts', 'const h = name.bold();')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const h = name.toUpperCase(); const l = xs.length;'),
    ).toEqual([]);
    // (z17) __defineGetter__/__lookupGetter__ flagged; defineProperty not.
    expect(
      discoverIdiomSites('f.ts', "obj.__defineGetter__('x', fn);"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "Object.defineProperty(obj, 'x', { get: fn });"),
    ).toEqual([]);
    // (z18) bare locale-default case conversion flagged; explicit-locale and
    // locale-free forms not.
    expect(discoverIdiomSites('f.ts', 'const a = s.toLocaleUpperCase();')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const a = s.toLocaleUpperCase('de'); const b = s.toUpperCase();"),
    ).toEqual([]);
    // (aa) REQ-416 seventh-sweep kinds: each flags its dead form and
    // leaves the modern spelling alone.
    // (aa1) async executor flagged; the standard executor not.
    expect(
      discoverIdiomSites('f.ts', 'const p = new Promise(async (resolve) => { resolve(1); });'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const p = new Promise((resolve, reject) => { resolve(1); });'),
    ).toEqual([]);
    // (aa2) bracket-form delete flagged; dot-form property delete and
    // splice removal not.
    expect(
      discoverIdiomSites('f.ts', 'delete this.cache[key];'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'delete this.cache[keyField]; this.queue.splice(idx, 1);'),
    ).toHaveLength(1);
    // (aa3) instanceof String/Number/Boolean flagged; instanceof Array /
    // instanceof Error not.
    expect(
      discoverIdiomSites('f.ts', 'const a = x instanceof String;\nconst b = y instanceof Number;\nconst c = z instanceof Boolean;'),
    ).toHaveLength(3);
    expect(
      discoverIdiomSites('f.ts', 'const a = x instanceof Error; const b = y instanceof Map;'),
    ).toEqual([]);
    // (aa4) atob/btoa flagged; TextEncoder/TextDecoder not. (Both codec
    // spellings on separate lines — a line yields one site per kind.)
    expect(
      discoverIdiomSites('f.ts', "const raw = atob('Zm9v');\nconst enc = btoa(raw);"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "const bytes = new TextEncoder().encode(s); const t = new TextDecoder().decode(bytes);"),
    ).toEqual([]);
    // (aa5) `.innerHTML +=` flagged (op-assign kind); the plain `=` form
    // stays inner-html-assignment's site, textContent not a hit.
    const opAssign = discoverIdiomSites('f.ts', 'el.innerHTML += markup;');
    expect(opAssign).toHaveLength(1);
    expect(opAssign[0].kind).toBe('inner-html-op-assign');
    const plainAssign = discoverIdiomSites('f.ts', 'el.innerHTML = markup;');
    expect(plainAssign).toHaveLength(1);
    expect(plainAssign[0].kind).toBe('inner-html-assignment');
    expect(discoverIdiomSites('f.ts', 'el.textContent += text;')).toEqual([]);
    // (aa6) insertAdjacentHTML flagged; textContent append not.
    expect(
      discoverIdiomSites('f.ts', "el.insertAdjacentHTML('beforeend', markup);"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "el.insertAdjacentText('beforeend', text);"),
    ).toEqual([]);
    // (aa7) single literal-length `new Array(n)` flagged; the dense
    // multi-arg ctor and Array.from not.
    expect(discoverIdiomSites('f.ts', 'const xs = new Array(12);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const xs = new Array(1, 2, 3);\nconst ys = Array.from({ length: 12 });'),
    ).toEqual([]);
  });
});
