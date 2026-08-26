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
 *   <!-- census-pin:F19:dead-idiom-batch ALLOWED 27 key / ERADICATED 13 key -->
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
    detect: /[=,({[?:;&|<>+\-*/%^~]\s*!\s*[01]\b|^\s*!\s*[01]\b/,
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
  // --- REQ-417 eighth sweep (twelve kinds, all measured on 2026-08-26) ---
  // Date.parse / new Date('<literal>') off the ISO profile is
  // implementation-dependent (Safari's classic NaN on '2026-08-26 00:00'
  // shapes); the numeric ctor and hand-built UTC fields are the forms.
  {
    id: 'date-string-parse',
    detect: /(?<![.\w$])Date\.parse\(|new\s+Date\(\s*['"`]/,
  },
  // Bare decodeURI leaves %2F %3F %23 … encoded (reserved characters);
  // decodeURIComponent is the form — the decode sibling of bare-encodeuri.
  { id: 'bare-decodeuri', detect: /(?<![.\w$])decodeURI\(/ },
  // navigator.appName/appVersion/appCodeName/product are dead UA fields —
  // fixed strings ("Netscape"/"Gecko"/"5.0 (Windows)") that answer nothing.
  {
    id: 'dead-ua-field',
    detect: /navigator\.(?:appName|appVersion|appCodeName|product)\b/,
  },
  // findDOMNode / unmountComponentAtNode / ReactDOM.render are the React 18
  // legacy root trio — removed under StrictMode, superseded by refs and
  // createRoot().unmount().
  {
    id: 'react-legacy-root-api',
    detect: /findDOMNode|unmountComponentAtNode|ReactDOM\.render\s*\(/,
  },
  // componentWillMount/ReceiveProps/Update (incl. UNSAFE_ spellings) are
  // the unsafe lifecycles React 18 removed — componentWillUnmount is NOT
  // one of them (the fixture's negative anchors the boundary).
  {
    id: 'react-unsafe-lifecycle',
    detect: /(?<![.\w$])(?:UNSAFE_)?componentWill(?:Mount|ReceiveProps|Update)\b/,
  },
  // dangerouslySetInnerHTML is React's markup sink — insert-adjacent-html's
  // sibling for the component surface; a future site demands a sanitizer
  // context judgment (DOMPurify or equivalent) in the same change.
  { id: 'dangerously-set-innerhtml', detect: /dangerouslySetInnerHTML/ },
  // `Array(n)` (no new) is sparse-array-ctor's call-form twin — the same
  // holey array, invisible to the new-prefixed regex (the lookbehind
  // blocks `new Array(n)`; a double-space `new  Array(n)` slips through
  // but stays caught by sparse-array-ctor — same incident, still RED).
  {
    id: 'bare-array-ctor',
    detect: /(?<!new\s)(?<![.\w$])Array\s*\(\s*\d+\s*\)/,
  },
  // postMessage(…, '*') broadcasts to any origin — the unqualified-target
  // shape (workers' single-arg postMessage has no origin parameter and is
  // not this kind's incident).
  {
    id: 'postmessage-wildcard',
    detect: /postMessage\s*\([^)]*['"]\*['"]/,
  },
  // createElement('script') is the script-injection sink — a future site
  // demands a provenance judgment for whatever src/text it is given.
  {
    id: 'script-element-creation',
    detect: /createElement\s*\(\s*['"]script['"]/,
  },
  // `x instanceof Object` is true for every object (arrays, dates, …) and
  // false cross-realm — it answers no question typeof doesn't answer better.
  { id: 'instanceof-object', detect: /instanceof\s+Object\b/ },
  // `.catch(() => {})` / `.catch(() => null)` / `.catch(undefined)` is
  // empty-catch's promise form — the rejection vanishes with no trace
  // (line-granular, like empty-catch: a multi-line or commented body is
  // invisible; measured with this detector plus a grep -A1 pass).
  {
    id: 'swallowed-rejection',
    detect: /\.catch\s*\(\s*(?:\(\s*\)\s*=>\s*)?(?:\{\s*\}|undefined|null)\s*\)/,
  },
  // console.info/warn/error/trace outside the logger are stray sinks that
  // bypass the level gate — console-debug-log's non-debug twin (log/debug
  // stay that kind's sites).
  {
    id: 'console-nondebug-sink',
    detect: /console\.(?:info|warn|error|trace)\s*\(/,
  },
  // --- REQ-418 ninth sweep (twenty-eight kinds, all measured on 2026-08-26) ---
  // `.outerHTML =` parses its argument as markup — inner-html-assignment's
  // sink sibling (the whole-element form; `==` comparisons are not the class).
  { id: 'outer-html-assignment', detect: /\.outerHTML\s*(?:\+=|=)(?!=)/ },
  // `.srcdoc =` (and React's srcDoc prop) is the iframe markup sink —
  // innerHTML's iframe-vector sibling (sandbox without allow-same-origin is
  // the only legitimate context, judged per site).
  { id: 'srcdoc-assignment', detect: /\.srcdoc\s*(?:\+=|=)(?!=)/i },
  // `document.createEvent(…)` + initEvent is the pre-`new CustomEvent()`
  // construction dance; a future site is the legacy spelling by definition
  // (the `?.` optional-chain spelling is the same call — MW-082 mutation
  // (c) caught the gap in the first detector draft).
  { id: 'legacy-dispatch-event', detect: /document\??\.createEvent\s*\(/ },
  // attachEvent/detachEvent are the IE-only event API (addEventListener is
  // the universal form; a hit is dead code in every current engine).
  { id: 'ie-attach-event', detect: /\.(?:attachEvent|detachEvent)\s*\(/ },
  // `.currentStyle` is IE's computed-style member (getComputedStyle is the
  // standard form); undefined in every current engine.
  { id: 'ie-current-style', detect: /\.currentStyle\b/ },
  // window.execScript evaluates GLOBAL-scope code — eval's IE twin (and
  // deader: removed from IE11+ edge modes and absent everywhere else). The
  // lookbehind blocks identifier spellings but admits the `window.` member
  // form (the incident's own shape).
  { id: 'window-execscript', detect: /(?<![\w$])execScript\s*\(/ },
  // window.navigate( is IE's navigation spelling (location.assign / href).
  { id: 'window-navigate', detect: /window\.navigate\s*\(/ },
  // setCapture/releaseCapture are the IE mouse-capture pair;
  // setPointerCapture (which does NOT match this regex) is the modern form.
  { id: 'element-set-capture', detect: /\.(?:setCapture|releaseCapture)\s*\(/ },
  // document.createStyleSheet is IE-only stylesheet injection (the <link>
  // element or adoptedStyleSheets is the form).
  { id: 'document-create-stylesheet', detect: /createStyleSheet\s*\(/ },
  // `Array(n).join(sep)` is the pre-`sep.repeat(n - 1)` string-repeat
  // idiom — with the off-by-one (`Array(3).join('-')` is TWO dashes) that
  // makes every reader re-derive the count.
  { id: 'array-join-repeat', detect: /Array\s*\([^)]*\)\s*\.join\s*\(/ },
  // A STRING ref (`ref="name"`) is React's legacy ref spelling — removed
  // for function components, and ref forwarding breaks silently.
  { id: 'react-string-ref', detect: /\bref\s*=\s*['"]/ },
  // React.createClass is the pre-class/pre-hooks component factory,
  // removed since React 16.
  { id: 'react-create-class', detect: /createClass\s*\(/ },
  // `.isMounted()` is the removed React anti-pattern (setState-after-unmount
  // guard); the data flow must not need it.
  { id: 'react-is-mounted', detect: /\.isMounted\s*\(/ },
  // childContextTypes / getChildContext are the removed legacy context API;
  // createContext is the only supported form.
  { id: 'legacy-context-api', detect: /childContextTypes\b|getChildContext\b/ },
  // `addEventListener('onclick', …)` subscribes to a never-fired event name
  // (DOM names carry no `on` prefix) — the handler silently never runs.
  { id: 'on-prefixed-event-name', detect: /addEventListener\s*\(\s*['"]on\w+['"]/ },
  // `new Object()` is the pointless ctor spelling of `{}` — `new ObjectType()`
  // (a real class) does not match (the ctor call must close immediately).
  { id: 'object-ctor', detect: /\bnew\s+Object\s*\(\s*\)/ },
  // document.domain is the deprecated same-origin-policy relaxation
  // (cross-subdomain cookie sharing) — a security hazard, not a capability.
  { id: 'document-domain-access', detect: /document\.domain\b/ },
  // `with (x) {…}` is a strict-mode SyntaxError — dead in every module
  // (`.with(` ES2023 array copy and `switch (` are not the shape).
  { id: 'with-statement', detect: /(?<![.\w$])with\s*\(/ },
  // window.showModalDialog is the removed IE/Firefox modal API
  // (the <dialog> element's showModal() is the form — a different name).
  // Same member-admitting lookbehind as window-execscript.
  { id: 'window-showmodaldialog', detect: /(?<![\w$])showModalDialog\s*\(/ },
  // document.selection is IE's selection model (getSelection is the form).
  { id: 'document-selection-ie', detect: /document\.selection\b/ },
  // `.doScroll()` is IE's scroll hack (scrollIntoView is the form).
  { id: 'ie-do-scroll', detect: /\.doScroll\s*\(/ },
  // `.cancelBubble = true` is IE's stopPropagation spelling — silently a
  // no-op assignment in current engines.
  { id: 'event-cancel-bubble', detect: /\.cancelBubble\s*=(?!=)/ },
  // `.srcElement` is IE's event-target field (`.target` is the form);
  // a bare `srcElement` identifier (no member access) is not the shape.
  { id: 'event-src-element', detect: /\.srcElement\b/ },
  // document.layers is the Netscape 4 DHTML API — dead for two decades.
  { id: 'document-layers', detect: /document\.layers\b/ },
  // console.assert is a debug-only sink outside the logger's level gate —
  // console-debug-log's assertion twin.
  { id: 'console-assert-sink', detect: /console\.assert\s*\(/ },
  // `.then(undefined, onRejected)` is the legacy two-arg rejection
  // spelling; `.catch(onRejected)` is the canonical form (a REAL first
  // argument is a legitimate two-arg then and not the shape).
  { id: 'then-two-arg-rejection', detect: /\.then\s*\(\s*(?:undefined|null)\s*,/ },
  // `navigator.platform` is a fixed hint string that answers nothing the
  // UA string does not (dead-ua-field's platform sibling; the one measured
  // site REPORTS it in telemetry — no behavior branches on it).
  { id: 'dead-ua-platform', detect: /navigator\.platform\b/ },
  // `.split('')` breaks astral code points (CJK ext-B kanji, emoji) into
  // lone surrogate halves — `[...text]` iterates code points. The one
  // measured site was unified in-commit (see ERADICATED).
  { id: 'string-char-split', detect: /\.split\(\s*(['"`])\1\s*\)/ },
  // --- REQ-419 tenth sweep (recovered union: 7 kinds landed via MW-083 +
  // 31 more recovered from PR #23's 34-kind sweep on 2026-08-28; the 3
  // shape-duplicates doc-execcommand / nonstandard-setimmediate /
  // node-process-nexttick were deduped into exec-command-legacy /
  // setimmediate-call / process-nexttick — the MW-084-refined detectors) ---
  // `.filter(…)[0]` materializes the whole filtered array to read one
  // element; `.find(…)` is the short-circuit form (an index read like
  // `.filter(…)[i]` with a real i, or `[0]` on a non-filter receiver, is
  // not the shape).
  {
    id: 'filter-index-zero',
    detect: /\.filter\((?:[^()]|\([^()]*\))*\)\s*\[\s*0\s*\]/,
  },
  // `setAttribute('onclick', …)` installs a string handler through the
  // CSP-unsafe inline path; addEventListener is the form (javascript-url /
  // inline-handler-attr are the two string-handler vectors).
  { id: 'inline-handler-attr', detect: /setAttribute\s*\(\s*['"]on\w+/ },
  // `x instanceof Function` is cross-realm unreliable (each realm has its
  // own Function); `typeof x === 'function'` is the form
  // (instanceof-primitive-wrapper's callable sibling).
  { id: 'instanceof-function', detect: /instanceof\s+Function\b/ },
  // Object.setPrototypeOf deoptimizes the object's hidden class in every
  // engine; class extends / Object.create is the form (a READ of
  // Object.getPrototypeOf is not the shape).
  { id: 'object-setprototypeof', detect: /Object\.setPrototypeOf\s*\(/ },
  // document.execCommand is deprecated (clipboard & editing commands are
  // async APIs now); execScript is window-execscript's own row.
  { id: 'exec-command-legacy', detect: /document\.execCommand\s*\(/ },
  // setImmediate is IE/Node-only scheduling — a browser crash; setTimeout /
  // queueMicrotask is the portable form.
  { id: 'setimmediate-call', detect: /(?<![.\w$])setImmediate\s*\(/ },
  // process.nextTick starves the event loop and is absent in browsers;
  // queueMicrotask is the portable form (scripts/ node shims are off-walk).
  { id: 'process-nexttick', detect: /process\.nextTick\s*\(/ },
  // window.clipboardData is IE's clipboard object — undefined in every
  // current engine (the DataTransfer lives on the event, not window).
  { id: 'window-clipboard-data', detect: /window\.clipboardData/ },
  // The bare `Buffer(n)` / `new Buffer(n)` ctor is Node-deprecated
  // (zero-fill hazard, length-vs-content confusion); Buffer.alloc /
  // Buffer.from are the forms. The lookbehind keeps ArrayBuffer out.
  { id: 'legacy-buffer-ctor', detect: /(?<![.\w$])Buffer\s*\(/ },
  // url.parse is the legacy Node url API (no WHATWG semantics, silent
  // shape differences); the URL ctor is the form.
  { id: 'node-url-parse', detect: /url\.parse\s*\(/ },
  // The querystring module is the legacy percent-encoding API
  // (URLSearchParams is the form — and the charset pitfalls are real).
  { id: 'node-querystring', detect: /querystring\./ },
  // Promise.defer() / .defer() is the long-removed non-standard deferred
  // API (Promise.withResolvers is the modern spelling).
  { id: 'promise-deferred', detect: /Promise\.defer\s*\(|\.defer\s*\(\s*\)/ },
  // Object/Array.observe is the removed observation proposal
  // (Proxy / MutationObserver are the live forms).
  { id: 'object-observe', detect: /(?:Object|Array)\.observe\s*\(/ },
  // System.import is the removed module-loader spelling; dynamic
  // `import()` is the standard form.
  { id: 'system-import', detect: /System\.import\s*\(/ },
  // XDomainRequest is the IE9-only CORS transport.
  { id: 'x-domain-request', detect: /XDomainRequest/ },
  // ActiveXObject is the IE plugin/COM bridge.
  { id: 'activex-object', detect: /ActiveXObject/ },
  // console.table/dir/group/count/time/profile are devtools-only sinks
  // that bypass the logger's level gate — the console family's third
  // twin (log/debug and info/warn/error/trace/assert already pinned).
  {
    id: 'console-devtools-sink',
    detect: /console\.(?:table|dir|group|groupEnd|groupCollapsed|count|time|timeEnd|timeLog|timeStamp|profile|profileEnd)\s*\(/,
  },
  // getComputedStyle(el, null) carries the legacy MANDATORY pseudoElt
  // second arg; the one-arg form is the standard spelling.
  {
    id: 'getcomputedstyle-null-arg',
    detect: /getComputedStyle\s*\([^)]*,\s*(?:null|undefined)\s*\)/,
  },
  // webkit/moz/ms/oMatchesSelector are the prefixed matches spellings;
  // element.matches is the standard form.
  { id: 'prefixed-matches-selector', detect: /(?:webkit|moz|ms|o)MatchesSelector/ },
  // .scrollIntoViewIfNeeded() is the Safari-only non-standard scroll
  // (scrollIntoView is the standard form everywhere).
  { id: 'scroll-into-view-if-needed', detect: /\.scrollIntoViewIfNeeded\s*\(/ },
  // forceUpdate is the React escape hatch that papers over a missed
  // state/props dependency; the data flow must not need it.
  { id: 'react-force-update', detect: /\.forceUpdate\s*\(/ },
  // Runtime propTypes duplicate what tsc already proves in-repo — the
  // `.propTypes =` static / PropTypes.x spellings are dead weight here.
  { id: 'react-prop-types', detect: /\.propTypes\s*=\s*\{|\bPropTypes\./ },
  // importScripts is the worker-only global — ReferenceError on the main
  // thread (ES module import is the form).
  { id: 'importscripts-global', detect: /(?<![.\w$])importScripts\s*\(/ },
  // Error.captureStackTrace is a V8-only extension — ReferenceError in
  // Firefox/Safari and in any non-V8 context of the isomorphic bundle.
  { id: 'error-capture-stack-trace', detect: /Error\.captureStackTrace\s*\(/ },
  // `x ? x : y` is `x || y` longhand: the falsy-vs-nullish hazard class
  // ('' / 0 / false read as absent; `??` is the form). The reserved-word
  // consequent (`cond ? null : y`) is NOT the shape — the draft detector
  // false-positived on exactly that (memory-backend.ts:94) and the
  // exclusion list was added before pinning.
  {
    id: 'self-ternary-default',
    detect:
      /(?<![\w$.])(?!null\b|undefined\b|true\b|false\b|this\b)([A-Za-z_$][\w$.]*)\s*\?\s*\1\s*:/,
  },
  // navigator.msXxx (msSaveBlob / msSaveOrOpenBlob …) are the IE-prefixed
  // navigator extensions — undefined in every current engine.
  { id: 'navigator-ms-prefixed', detect: /navigator\.ms[A-Z]/ },
  // process.binding is the deprecated Node internal bridge — removed from
  // the public API surface.
  { id: 'process-binding', detect: /process\.binding\s*\(/ },
  // window.external is the IE addon-scripting API (AddFavorite etc.) —
  // undefined elsewhere.
  { id: 'window-external', detect: /window\.external/ },
  // getBoxObjectFor is the Netscape/Firefox-dead element-geometry API
  // (getBoundingClientRect is the form) — document.layers' sibling.
  { id: 'getbox-object-for', detect: /getBoxObjectFor/ },
  // DOMNodeInserted / DOMAttrModified / … are the deprecated mutation
  // EVENTS (per-spec dead, whole-document forced layout); MutationObserver
  // is the form.
  {
    id: 'mutation-event-name',
    detect: /DOM(?:AttrModified|NodeInserted|NodeRemoved|SubtreeModified|CharacterDataModified)/,
  },
  // window.status = is the status-bar write — a no-op in every current
  // engine (the bookmark-hack relic).
  { id: 'window-status-assign', detect: /window\.status\s*=/ },
  // .fireEvent() is IE's dispatch spelling (dispatchEvent is the form).
  { id: 'element-fire-event', detect: /\.fireEvent\s*\(/ },
  // `children.map(…)` assumes children is an array — React passes a
  // SINGLE element (not array-wrapped) for one child, so the call
  // TypeErrors; React.Children.map / toArray are the forms.
  { id: 'children-map-direct', detect: /children\.map\s*\(/ },
  // Event.path is the non-standard accessor (undefined in Firefox/IE);
  // composedPath() is the standard form. The lookbehind keeps identifier
  // suffixes (largestFile.path) out — the draft matched exactly that at
  // code-size-audit.ts:95 and the boundary was fixed before pinning.
  { id: 'event-path-access', detect: /(?<![\w$])(?:event|evt|e)\.path\b/ },
  // createCipher / createDecipher (no iv suffix) are the deprecated
  // implicit-IV Node crypto ctors (removed; createCipheriv is the form —
  // the 'iv' suffix escapes this regex).
  { id: 'node-createcipher', detect: /create(?:Decipher|Cipher)\s*\(/ },
  // Bare .toLocaleDateString() / .toLocaleTimeString() format with the
  // RUNTIME default locale — tolocalestring-bare's date twin. The four
  // measured sites are display-only (ALLOWED below); an export/CSV/PDF
  // or comparison consumer is an unrostered RED.
  {
    id: 'localedatestring-bare',
    detect: /\.toLocale(?:Date|Time)String\s*\(\s*\)/,
  },
  // `xs.splice(xs.indexOf(x), 1)` is the remove-by-value idiom whose
  // not-found case is the incident: indexOf -1 makes splice(-1, 1)
  // silently remove the LAST element. filter / findIndex+guard are forms.
  { id: 'splice-indexof-remove', detect: /\.splice\(\s*[\w$.]+\.indexOf\(/ },
  // unstable_batchedUpdates / unstable_renderSubtreeIntoContainer are the
  // React exported-then-doomed unstable APIs (18 removes the need; 19
  // removes the exports).
  {
    id: 'unstable-react-api',
    detect: /unstable_batchedUpdates|unstable_renderSubtreeIntoContainer/,
  },
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
  'src/optimization/smart-parameter-tuner.ts:351':
    'GUARDED — body opens with `if (key in result)`, so prototype-chain keys never reach the blend.',
  // [json-clone-idiom] ProcessingStrategy (adaptive-content-processor.ts:12)
  // is string/number/enum-literal fields only, so the round-trip is
  // lossless; structuredClone is ABSENT from the jest vm context (probed
  // 2026-08-25: Node 24 has it, the jest vm sandbox does not), so unifying
  // would break the test bed. Re-judge the moment a non-JSON field
  // (Date/Map/Set/undefined) joins the interface.
  'src/optimization/adaptive-content-processor.ts:186':
    'JSON-SAFE — ProcessingStrategy is string/number/enum-literal only (lossless round-trip) and structuredClone is unavailable in the jest vm context; re-judge if a non-JSON field joins the interface.',
  // [from-char-code] all six sites operate on BYTES (0..255), where
  // fromCharCode is exact: apng-encoder/export-verifier build PNG/APNG/GIF
  // chunk-type and version strings from Uint8Array element reads;
  // intelligent-cache's RLE emits the fixed 0x01 marker (C2: control byte,
  // JSON.stringify always escapes it, collision-free by construction) and a
  // `count` that the `count < 255` loop guard caps in range. fromCodePoint
  // is the equivalent spelling here — swapping is fine but must shed the
  // roster row in the same commit (stale-row test). A NEW site passing a
  // code point > 0xFFFF is an unrostered RED (ToUint16 wraps silently).
  'src/export/apng-encoder.ts:275':
    'BYTE-DOMAIN — chunk type from Uint8Array element reads (apng[pos+4..7]), 0..255 where fromCharCode is exact.',
  'src/export/export-verifier.ts:198':
    'BYTE-DOMAIN — GIF version bytes view[3..5], 0..255 where fromCharCode is exact.',
  'src/export/export-verifier.ts:363':
    'BYTE-DOMAIN — PNG chunk-type bytes view[offset+4..7], 0..255 where fromCharCode is exact.',
  'src/performance/intelligent-cache.ts:136':
    'BYTE-DOMAIN — RLE marker char from the pinned RLE_ESCAPE_BYTE constant (0x01); 0..255 where fromCharCode is exact.',
  'src/performance/intelligent-cache.ts:174':
    'BYTE-DOMAIN — fixed 0x01 marker and `count` capped at 255 by the `count < 255` loop guard; 0..255 where fromCharCode is exact.',
  'src/performance/intelligent-cache.ts:184':
    'BYTE-DOMAIN — trailing-run flush of the same 0x01-marker/255-capped RLE pair; 0..255 where fromCharCode is exact.',
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
  // the time this line runs (all four signal routes terminate here; the
  // argument is the INV-API-001 parity call: clean drain 0 / abnormal 1).
  'src/api/index.ts:73':
    'SERVER-EXIT — gracefulShutdown epilogue after every background service is stopped and logged (all signals route here; the exit code is the exitCodeForSignal parity value, INV-API-001); a process.exit in library/pipeline/component code is an unrostered RED.',
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
  // [swallowed-rejection] the Node whisper path's dynamic-import
  // availability probe — whether whisper-node LOADS is the whole question;
  // a failed import resolves null and the null is deliberately discarded
  // (README: the server route only probes loadability, it never runs
  // inference). Every other .catch-to-void is a silent rejection swallow
  // and an unrostered RED.
  'src/transcription/whisper-transcriber.ts:121':
    'PROBE-DELIBERATE — await import("whisper-node").catch(() => null) is the README-documented loadability probe (no inference runs on this route); the null is discarded by design; any other .catch(() => {})/null/undefined swallow is an unrostered RED.',
  // [console-nondebug-sink] the logger's own transports — the sibling rows
  // of the console.debug LOGGER-IMPL entry at :20 in the same file
  // (@stv/core-owned): info/warn/error ARE the level-gated sinks. A
  // console.info/warn/error/trace anywhere else bypasses the level gate
  // and is an unrostered RED.
  'src/utils/logger.ts:25':
    'LOGGER-IMPL — console.info is the logger transport itself (the file the console.debug LOGGER-IMPL row at :20 lives in; @stv/core-owned); every other console.info/warn/error/trace on the surface bypasses the level gate.',
  'src/utils/logger.ts:30':
    'LOGGER-IMPL — console.warn is the logger transport itself (@stv/core-owned); every other console.info/warn/error/trace on the surface bypasses the level gate.',
  'src/utils/logger.ts:35':
    'LOGGER-IMPL — console.error is the logger transport itself (@stv/core-owned); every other console.info/warn/error/trace on the surface bypasses the level gate.',
  // [dead-ua-platform] the third telemetry field of the same getBrowserInfo
  // object the :271 userAgent row reports into — no behavior branches on
  // the string (the same REPORT-ONLY verdict, one field over).
  'src/monitoring/production-error-handler.ts:273':
    'REPORT-ONLY — getBrowserInfo() telemetry context field beside the :271 userAgent row (platform: navigator.platform); no behavior branches on the fixed hint string; a BRANCH on it is an unrostered RED.',
  // [localedatestring-bare] all four sites are HUMAN-FACING wall-clock
  // display (dashboard table cells, a detail line, an in-app log prefix).
  // The drift class matters where locale-formatted output lands in a
  // DETERMINISTIC artifact (CSV/PDF export — locale commas/eras are data
  // corruption there, the tolocalestring-bare row's own rationale); for
  // display the runtime locale IS the appropriate formatter. A site whose
  // formatted value feeds comparison/export/caching is a different shape
  // and an unrostered RED.
  'src/components/AdminAnalyticsDashboard.tsx:56':
    'DISPLAY-ONLY — formatTimestamp() renders the admin analytics table wall-clock column; runtime-default locale is the appropriate formatter for human display (the drift class matters for export output, not display).',
  'src/components/AdminAnalyticsDashboard.tsx:606':
    'DISPLAY-ONLY — report-history table cell timestamp; same judgment as the :56 formatTimestamp site in the same file (display, not export).',
  'src/components/FrameworkDashboard.tsx:533':
    'DISPLAY-ONLY — iteration detail Time: line rendered into the dashboard tree; same judgment as the AdminAnalytics :56 site (display, not export). Re-pointed from :494 after PR #9\'s mountedRef guards shifted the line.',
  'src/components/Iteration43Interface.tsx:106':
    'DISPLAY-ONLY — addIterationLog wall-clock prefix for the in-app iteration log list; the string is never parsed or exported (display, not export).',
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
  // [string-char-split] `text.split('')` → `[...text]` in the legacy
  // detectLanguage wrapper: IDENTICAL for every input the classifier can
  // distinguish — no KANA/CJK/English range (@stv/core unicode-script-ranges:
  // 0x3040-0x31FF, 0x3400-0xFAFF, A-Z) intersects the surrogate block
  // 0xD800-0xDFFF, so astral code points (CJK ext-B kanji, emoji) classify
  // as Other under BOTH spellings and enter no ratio. The code-point form
  // removes the surrogate-half artifact: element count now equals code
  // points (matching the `for (const char of text)` spelling the SAME file
  // uses in hasKana/scoreLatinLanguage), so a future astral CJK-ext range
  // table works without re-touching the loop.
  'src/analysis/language-detector.ts:537':
    'unified 2026-08-26 (REQ-418) — `const chars = text.split(\'\');` → `const chars = [...text];`: code-point iteration, ratio-identical today (no classifier range intersects the surrogate block), canonical spelling aligned with the same file\'s for-of loops.',
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
    expect(sites.filter((s) => s.kind === 'swallowed-rejection').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'console-nondebug-sink').length).toBeGreaterThanOrEqual(3);
    expect(sites.filter((s) => s.kind === 'dead-ua-platform').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'localedatestring-bare').length).toBeGreaterThanOrEqual(4);
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
      'date-string-parse',
      'bare-decodeuri',
      'dead-ua-field',
      'react-legacy-root-api',
      'react-unsafe-lifecycle',
      'dangerously-set-innerhtml',
      'bare-array-ctor',
      'postmessage-wildcard',
      'script-element-creation',
      'instanceof-object',
      'swallowed-rejection',
      'console-nondebug-sink',
      'outer-html-assignment',
      'srcdoc-assignment',
      'legacy-dispatch-event',
      'ie-attach-event',
      'ie-current-style',
      'window-execscript',
      'window-navigate',
      'element-set-capture',
      'document-create-stylesheet',
      'array-join-repeat',
      'react-string-ref',
      'react-create-class',
      'react-is-mounted',
      'legacy-context-api',
      'on-prefixed-event-name',
      'object-ctor',
      'document-domain-access',
      'with-statement',
      'window-showmodaldialog',
      'document-selection-ie',
      'ie-do-scroll',
      'event-cancel-bubble',
      'event-src-element',
      'document-layers',
      'console-assert-sink',
      'then-two-arg-rejection',
      'dead-ua-platform',
      'string-char-split',
      'filter-index-zero',
      'inline-handler-attr',
      'instanceof-function',
      'object-setprototypeof',
      'exec-command-legacy',
      'setimmediate-call',
      'process-nexttick',
      'window-clipboard-data',
      'legacy-buffer-ctor',
      'node-url-parse',
      'node-querystring',
      'promise-deferred',
      'object-observe',
      'system-import',
      'x-domain-request',
      'activex-object',
      'console-devtools-sink',
      'getcomputedstyle-null-arg',
      'prefixed-matches-selector',
      'scroll-into-view-if-needed',
      'react-force-update',
      'react-prop-types',
      'importscripts-global',
      'error-capture-stack-trace',
      'self-ternary-default',
      'navigator-ms-prefixed',
      'process-binding',
      'window-external',
      'getbox-object-for',
      'mutation-event-name',
      'window-status-assign',
      'element-fire-event',
      'children-map-direct',
      'event-path-access',
      'node-createcipher',
      'localedatestring-bare',
      'splice-indexof-remove',
      'unstable-react-api',
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
        /declare global \{[\s\S]*\n {2}var SpeechRecognition: \{/,
      ],
      // The rostered core logger site keeps its level gate on the adjacent
      // line — an unconditional console.debug (gate deleted) flips this
      // anchor, forcing the row to be re-judged in the same change.
      [
        'src/utils/logger.ts',
        /currentLogLevel <= LogLevel\.DEBUG\) \{\s*\n\s*console\.debug\(/,
      ],
      // The rostered process-exit stays the graceful-shutdown epilogue: the
      // services-stopped log precedes it, and the exit code is the INV-API-001
      // parity call (collapsing it back to a literal 0 fails this anchor).
      // Moving it ahead of the shutdown work (or into library code) fails too.
      [
        'src/api/index.ts',
        /logger\.info\('All background services shut down'\);[\s\S]*\n\s*process\.exit\(exitCodeForSignal\(signal\)\);/,
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
      // The unified char-iteration site keeps the code-point spread — a
      // revert to split('') is an eradicated-reappear RED AND this anchor
      // (the for-of body below consumes the elements, so the anchor also
      // documents WHY the materialized array exists at all).
      ['src/analysis/language-detector.ts', /const chars = \[\.\.\.text\];/],
      // The rostered platform site stays the third REPORT-ONLY telemetry
      // field of getBrowserInfo (beside the :271 userAgent row). A behavior
      // branch on the hint string is not the rostered shape — it lands in
      // the offender list.
      ['src/monitoring/production-error-handler.ts', /platform: navigator\.platform/],
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
    // (y12) console.log/debug flagged (one line × one kind = one hit); the
    // logger facade not. (info/warn/error were the not-flagged side here
    // until REQ-417's console-nondebug-sink claimed them — (ab12) owns
    // that boundary now.)
    expect(
      discoverIdiomSites('f.ts', "console.log('x'); console.debug('y');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        "logger.info('z'); logger.warn('w'); logger.error('e'); logger.debug('m');",
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
    // (z14) innerHTML assignment flagged; textContent not. (React's
    // dangerouslySetInnerHTML prop was the other not-flagged side here
    // until REQ-417's dangerously-set-innerhtml claimed it — (ab6) owns
    // that boundary now.)
    expect(discoverIdiomSites('f.ts', 'el.innerHTML = html;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'el.textContent = text; const r = <div>{text}</div>;'),
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
    // (ab) REQ-417 eighth-sweep kinds: each flags its dead form and
    // leaves the modern spelling alone.
    // (ab1) Date.parse and the string-literal ctor flagged; the numeric
    // ctor not.
    expect(
      discoverIdiomSites('f.ts', "const a = Date.parse(text);\nconst b = new Date('2026-08-26');"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const c = new Date(2026, 7, 26);\nconst d = new Date(ms);'),
    ).toEqual([]);
    // (ab2) bare decodeURI flagged; decodeURIComponent not.
    expect(discoverIdiomSites('f.ts', 'const u = decodeURI(path);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const u = decodeURIComponent(path); const e = decodeURIComponent(x, y);'),
    ).toEqual([]);
    // (ab3) dead UA fields flagged; userAgent stays useragent-sniffing's
    // site (kind帰着の分離) and language is no kind's shape. platform was
    // this fixture's negative until REQ-418 made it dead-ua-platform's own
    // site (kind 分離契約 4 例目 — the negative handed over to (ac18)).
    expect(
      discoverIdiomSites('f.ts', 'const n = navigator.appName;\nconst v = navigator.appVersion;'),
    ).toHaveLength(2);
    const uaHit = discoverIdiomSites('f.ts', 'const ua = navigator.userAgent;');
    expect(uaHit).toHaveLength(1);
    expect(uaHit[0].kind).toBe('useragent-sniffing');
    expect(discoverIdiomSites('f.ts', 'const l = navigator.language;')).toEqual([]);
    // (ab4) the React 18 legacy root trio flagged; createRoot not.
    expect(
      discoverIdiomSites('f.ts', "const n = findDOMNode(this);\nconst u = unmountComponentAtNode(el);"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "import { createRoot } from 'react-dom';\nconst r = createRoot(el);"),
    ).toEqual([]);
    // (ab5) the unsafe lifecycles (bare AND UNSAFE_) flagged;
    // componentWillUnmount — the safe one — not.
    expect(
      discoverIdiomSites('f.ts', 'componentWillMount() {}\nUNSAFE_componentWillReceiveProps(p) {}'),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'componentWillUnmount() {}')).toEqual([]);
    // (ab6) dangerouslySetInnerHTML flagged; the sanitizer feeding a text
    // node not.
    expect(
      discoverIdiomSites('f.ts', '<div dangerouslySetInnerHTML={{ __html: html }} />'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const clean = DOMPurify.sanitize(html);\nreturn <div>{clean}</div>;'),
    ).toEqual([]);
    // (ab7) call-form `Array(n)` flagged (bare-array-ctor); the new-form
    // site stays sparse-array-ctor's, Array.from not a hit.
    const bareCtor = discoverIdiomSites('f.ts', 'const xs = Array(12);');
    expect(bareCtor).toHaveLength(1);
    expect(bareCtor[0].kind).toBe('bare-array-ctor');
    const newCtor = discoverIdiomSites('f.ts', 'const xs = new Array(12);');
    expect(newCtor).toHaveLength(1);
    expect(newCtor[0].kind).toBe('sparse-array-ctor');
    expect(discoverIdiomSites('f.ts', 'const ys = Array.from({ length: 12 });')).toEqual([]);
    // (ab8) wildcard-origin postMessage flagged; the single-arg worker
    // form and a named origin not.
    expect(discoverIdiomSites('f.ts', "win.postMessage(data, '*');")).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "self.postMessage(response);\nwin.postMessage(data, targetOrigin);"),
    ).toEqual([]);
    // (ab9) createElement('script') flagged; other element tags not.
    expect(
      discoverIdiomSites('f.ts', "const s = document.createElement('script');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const d = document.createElement('div');\nconst i = document.createElement('iframe');"),
    ).toEqual([]);
    // (ab10) instanceof Object flagged; instanceof ObjectType (a real
    // class) not.
    expect(discoverIdiomSites('f.ts', 'const a = x instanceof Object;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const a = x instanceof ObjectType; const b = y instanceof Error;'),
    ).toEqual([]);
    // (ab11) the void catch shapes flagged; a handler or a logging catch
    // not.
    expect(
      discoverIdiomSites('f.ts', 'p.catch(() => {});\nq.catch(() => null);\nr.catch(undefined);'),
    ).toHaveLength(3);
    expect(
      discoverIdiomSites('f.ts', 'p.catch(handle);\nq.catch((e) => { logger.warn(e); });'),
    ).toEqual([]);
    // (ab12) console.info/warn/error/trace flagged (console-nondebug-sink);
    // console.log stays console-debug-log's site.
    const infoSink = discoverIdiomSites('f.ts', "console.info('x');");
    expect(infoSink).toHaveLength(1);
    expect(infoSink[0].kind).toBe('console-nondebug-sink');
    const logSink = discoverIdiomSites('f.ts', "console.log('x');");
    expect(logSink).toHaveLength(1);
    expect(logSink[0].kind).toBe('console-debug-log');
    expect(
      discoverIdiomSites('f.ts', "logger.info('x'); logger.warn('y'); logger.error('z');"),
    ).toEqual([]);
    // (ac) REQ-418 ninth-sweep kinds: each flags its dead form and leaves
    // the modern spelling alone.
    // (ac1) `.outerHTML =` / `+=` flagged; the == comparison not.
    expect(
      discoverIdiomSites('f.ts', 'el.outerHTML = markup;\nhead.outerHTML += banner;'),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'const same = a.outerHTML === b.outerHTML;')).toEqual([]);
    // (ac2) `.srcdoc =` flagged (case-insensitive); sandbox string attr not.
    expect(
      discoverIdiomSites('f.ts', 'frame.srcdoc = html;\nframe.srcDoc = otherHtml;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "frame.setAttribute('sandbox', 'allow-scripts');"),
    ).toEqual([]);
    // (ac3) document.createEvent flagged; new Event / new CustomEvent not.
    expect(
      discoverIdiomSites('f.ts', "const ev = document.createEvent('HTMLEvents');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const a = new Event('x');\nconst b = new CustomEvent('y', { detail: 1 });"),
    ).toEqual([]);
    // (ac4) attachEvent/detachEvent flagged; addEventListener/removeEventListener not.
    expect(
      discoverIdiomSites('f.ts', "el.attachEvent('onclick', fn);\nel.detachEvent('onclick', fn);"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "el.addEventListener('click', fn);\nel.removeEventListener('click', fn);"),
    ).toEqual([]);
    // (ac5) `.currentStyle` flagged; getComputedStyle not.
    expect(discoverIdiomSites('f.ts', 'const s = el.currentStyle;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const s = getComputedStyle(el);')).toEqual([]);
    // (ac6) execScript flagged; eval stays direct-eval's site (kind 分離).
    expect(discoverIdiomSites('f.ts', 'execScript(code);')).toHaveLength(1);
    const evalHit = discoverIdiomSites('f.ts', 'const v = eval(code);');
    expect(evalHit).toHaveLength(1);
    expect(evalHit[0].kind).toBe('direct-eval');
    // (ac7) window.navigate flagged; location.assign not.
    expect(discoverIdiomSites('f.ts', 'window.navigate(url);')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'location.assign(url);\nlocation.href = url;')).toEqual([]);
    // (ac8) setCapture/releaseCapture flagged; the POINTER capture pair not.
    expect(
      discoverIdiomSites('f.ts', 'el.setCapture();\nel.releaseCapture();'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'el.setPointerCapture(id);\nel.releasePointerCapture(id);'),
    ).toEqual([]);
    // (ac9) createStyleSheet flagged; an injected <link> element not.
    expect(discoverIdiomSites('f.ts', 'document.createStyleSheet(url);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const l = document.createElement('link'); l.rel = 'stylesheet';"),
    ).toEqual([]);
    // (ac10) `Array(n).join(sep)` flagged; sep.repeat not. The literal-length
    // form stays bare-array-ctor's twin hit — a variable length separates
    // the kinds (bare-array-ctor pins literal digits only).
    expect(
      discoverIdiomSites('f.ts', "const line = Array(width + 1).join(pad);"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const line = '-'.repeat(3);\nconst j = xs.join(', ');"),
    ).toEqual([]);
    // (ac11) a string ref flagged; the ref-object form not.
    expect(discoverIdiomSites('f.ts', '<input ref="name" />')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', '<input ref={inputRef} /><div href = "x"></div>;'),
    ).toEqual([]);
    // (ac12) createClass flagged; a function component not.
    expect(discoverIdiomSites('f.ts', 'const C = createClass({ render() {} });')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'function C() { return null; }')).toEqual([]);
    // (ac13) `.isMounted()` flagged; a mounted ref flag not.
    expect(discoverIdiomSites('f.ts', 'if (this.isMounted()) run();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'if (mountedRef.current) run();')).toEqual([]);
    // (ac14) legacy context API flagged; createContext not.
    expect(
      discoverIdiomSites('f.ts', 'childContextTypes = {};\ngetChildContext() {}'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "const Ctx = createContext(null);\nCtx.Provider;"),
    ).toEqual([]);
    // (ac15) the `on`-prefixed event NAME flagged (the handler never
    // fires); the real name not.
    expect(
      discoverIdiomSites('f.ts', "el.addEventListener('onclick', fn);"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "el.addEventListener('click', fn);\nel.removeEventListener('onclick', fn);"),
    ).toEqual([]);
    // (ac16) `new Object()` flagged; a real class ctor not.
    expect(discoverIdiomSites('f.ts', 'const o = new Object();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const o = new ObjectType();')).toEqual([]);
    // (ac17) document.domain flagged; documentElement not.
    expect(discoverIdiomSites('f.ts', 'const d = document.domain;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const r = document.documentElement;')).toEqual([]);
    // (ac18) `with (` flagged (strict SyntaxError); the ES2023 `.with(`
    // array copy and switch not.
    expect(discoverIdiomSites('f.ts', 'with (obj) { run(x); }')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const w = xs.with(0, 9);\nswitch (x) { case 1: break; }'),
    ).toEqual([]);
    // (ac19) navigator.platform flagged (dead-ua-platform — the platform
    // negative handed over from (ab3)); the REPORT-ONLY rostered spelling
    // is the :273 site's own judgment, userAgent stays its kind's shape.
    const platformHit = discoverIdiomSites('f.ts', 'platform: navigator.platform');
    expect(platformHit).toHaveLength(1);
    expect(platformHit[0].kind).toBe('dead-ua-platform');
    expect(discoverIdiomSites('f.ts', 'const lang = navigator.languages;')).toEqual([]);
    // (ac20) `.split('')` flagged; delimiter splits and code-point spread not.
    expect(
      discoverIdiomSites("f.ts", "const a = text.split('');\nconst b = text.split(``);"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "const a = text.split('-');\nconst b = [...text];\nconst c = Array.from(text);"),
    ).toEqual([]);
    // (ac21) showModalDialog flagged; the <dialog> element's showModal not.
    expect(discoverIdiomSites('f.ts', 'window.showModalDialog(url);')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'dialog.showModal();\ndialog.close();')).toEqual([]);
    // (ac22) document.selection flagged; window.getSelection not.
    expect(discoverIdiomSites('f.ts', 'const s = document.selection;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const s = window.getSelection();')).toEqual([]);
    // (ac23) `.doScroll()` flagged; scrollIntoView not.
    expect(discoverIdiomSites('f.ts', 'el.doScroll();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'el.scrollIntoView();\nwindow.scrollTo(0, 0);')).toEqual([]);
    // (ac24) `.cancelBubble =` flagged; stopPropagation not.
    expect(discoverIdiomSites('f.ts', 'e.cancelBubble = true;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'e.stopPropagation();\nconst b = e.cancelBubble === true;')).toEqual([]);
    // (ac25) `.srcElement` flagged; `.target` not.
    expect(discoverIdiomSites('f.ts', 'const t = e.srcElement;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const t = e.target;')).toEqual([]);
    // (ac26) document.layers flagged; getElementsByClassName not (that is
    // a live collection, a different concept with its own judgment).
    expect(discoverIdiomSites('f.ts', 'const l = document.layers;')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', "const l = document.getElementsByClassName('x');")).toEqual([]);
    // (ac27) console.assert flagged; logger assertion not.
    expect(discoverIdiomSites('f.ts', "console.assert(x > 0, 'pos');")).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', "logger.debug('assert', x > 0);")).toEqual([]);
    // (ac28) `.then(undefined, …)` flagged; a real first argument not.
    expect(
      discoverIdiomSites('f.ts', 'p.then(undefined, onReject);\nq.then(null, onReject);'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'p.then(mapValue, onReject);\np.catch(onReject);'),
    ).toEqual([]);
    // (ad) REQ-419 tenth-sweep kinds: each flags its dead form and leaves
    // the modern spelling alone.
    // (ad1) `.filter(…)[0]` flagged; .find and a real index not.
    expect(
      discoverIdiomSites('f.ts', "const f = xs.filter(isOn)[0];"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const f = xs.find(isOn);\nconst g = xs.filter(isOn)[i];'),
    ).toEqual([]);
    // (ad1b) sibling-statement false-positive guard: `.filter(…)` on one
    // statement and `[0]` on a DIFFERENT receiver must NOT be flagged
    // (the `[0]` does not index the filtered array). The detector
    // changed in MW-083 → MW-084 to forbid `.*` from crossing past a
    // balanced `)`; this fixture pins the behavior so a future rewrite
    // cannot silently re-introduce the greedy span.
    expect(
      discoverIdiomSites('f.ts', 'xs.filter(isOn); const first = groups.get(k)[0];'),
    ).toEqual([]);
    // (ad1c) chained-call false-positive guard: when `.filter(…)` is
    // followed by `.length` (or any other non-`)` member access that
    // gives back a different receiver), the trailing `[0]` indexes
    // that receiver, not the filtered array. The balanced-arg regex
    // stops at the `)` of `.filter(…)`; the original greedy `.*` would
    // have read the trailing `)[0]` as a filter receiver.
    expect(
      discoverIdiomSites('f.ts', 'if (xs.filter(isOn).length > 0) { const y = pair(a)[0]; }'),
    ).toEqual([]);
    // (ad1d) array-returning chained-call false-positive guard: when
    // `.filter(…)` is followed by an array-returning member call such
    // as `.map(…)`, the trailing `[0]` indexes the mapped array, not
    // the filtered one. The balanced-arg regex stops at the FIRST `)`
    // of `.filter(…)`, so the original greedy `.*` would have crossed
    // past it to read `)[0]` (sibling of ac24/ac25 cross-receiver
    // coverage). Real modern usage is `xs.find(…)`; the chained form
    // `.filter(…).map(…)[0]` is itself questionable but is a DIFFERENT
    // idiom — it is not the `.filter(…)[0]` shape and must not match.
    expect(
      discoverIdiomSites('f.ts', 'const f = xs.filter(isOn).map(g)[0];'),
    ).toEqual([]);
    // (ad2) an `on`-prefixed setAttribute handler flagged; the sandbox attr
    // (ac2's negative) and addEventListener not.
    expect(
      discoverIdiomSites('f.ts', "el.setAttribute('onclick', 'run()');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "el.setAttribute('sandbox', 'allow-scripts');\nel.addEventListener('click', fn);"),
    ).toEqual([]);
    // (ad3) `instanceof Function` flagged; the typeof spelling and a real
    // class test not.
    expect(discoverIdiomSites('f.ts', 'if (x instanceof Function) run();')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "if (typeof x === 'function') run();\nconst b = v instanceof MyClass;"),
    ).toEqual([]);
    // (ad4) Object.setPrototypeOf flagged; the read + class forms not.
    expect(
      discoverIdiomSites('f.ts', 'Object.setPrototypeOf(proto, base);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const p = Object.getPrototypeOf(o);\nclass Sub extends Base {}'),
    ).toEqual([]);
    // (ad5) document.execCommand flagged; the async clipboard API not.
    expect(
      discoverIdiomSites('f.ts', "document.execCommand('copy');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'navigator.clipboard.writeText(t);'),
    ).toEqual([]);
    // (ad6) a bare setImmediate call flagged; member access and the
    // portable forms not.
    expect(discoverIdiomSites('f.ts', 'setImmediate(cb);')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'handlers.setImmediate = cb;\nqueueMicrotask(cb);\nsetTimeout(cb, 0);'),
    ).toEqual([]);
    // (ad7) process.nextTick flagged; queueMicrotask not.
    expect(discoverIdiomSites('f.ts', 'process.nextTick(cb);')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'queueMicrotask(cb);')).toEqual([]);
    // (ad8) window.clipboardData flagged; the event's own DataTransfer not.
    expect(
      discoverIdiomSites('f.ts', 'const cb = window.clipboardData;'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const cb = event.clipboardData;'),
    ).toEqual([]);
    // (ad9) the deprecated Buffer ctor flagged in BOTH spellings (one
    // regex, `new Buffer(` and call-form); Buffer.from and ArrayBuffer not.
    expect(
      discoverIdiomSites('f.ts', 'const b = new Buffer(16);\nconst c = Buffer(16);'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const d = Buffer.from(hex);\nconst e = new ArrayBuffer(16);'),
    ).toEqual([]);
    // (ad10) url.parse flagged; the WHATWG URL ctor not.
    expect(discoverIdiomSites('f.ts', 'const u = url.parse(raw);')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const u = new URL(raw);')).toEqual([]);
    // (ad11) the querystring module flagged; URLSearchParams not.
    expect(
      discoverIdiomSites('f.ts', 'const q = querystring.parse(search);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const q = new URLSearchParams(search);'),
    ).toEqual([]);
    // (ad12) Promise.defer()/.defer() flagged; withResolvers not.
    expect(
      discoverIdiomSites('f.ts', 'const d = Promise.defer();\nhandler.defer();'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const d = Promise.withResolvers();'),
    ).toEqual([]);
    // (ad13) Object/Array.observe flagged; MutationObserver not.
    expect(
      discoverIdiomSites('f.ts', 'Object.observe(cfg, cb);\nArray.observe(xs, cb);'),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'new MutationObserver(cb);')).toEqual([]);
    // (ad14) System.import flagged; dynamic import() not.
    expect(discoverIdiomSites('f.ts', "System.import('mod');")).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const m = await import('mod');"),
    ).toEqual([]);
    // (ad15) XDomainRequest flagged (fetch is the modern negative — XHR
    // itself is legacy-xhr's own pinned shape).
    expect(
      discoverIdiomSites('f.ts', 'const x = new XDomainRequest();'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'const r = await fetch(url);')).toEqual([]);
    // (ad16) ActiveXObject flagged; a real adapter class not.
    expect(
      discoverIdiomSites('f.ts', "const a = new ActiveXObject('X');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const a = new ActiveXAdapter();'),
    ).toEqual([]);
    // (ad17) devtools-only console sinks flagged; the logger facade not.
    expect(
      discoverIdiomSites('f.ts', "console.time('op');\nconsole.table(rows);"),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "logger.info('op done');"),
    ).toEqual([]);
    // (ad18) getComputedStyle's legacy null second arg flagged; the
    // one-arg standard form not.
    expect(
      discoverIdiomSites('f.ts', 'const s = getComputedStyle(el, null);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const s = getComputedStyle(el);'),
    ).toEqual([]);
    // (ad19) prefixed matches spellings flagged; element.matches not.
    expect(
      discoverIdiomSites('f.ts', 'el.webkitMatchesSelector(sel);\nel.mozMatchesSelector(sel);'),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'el.matches(sel);')).toEqual([]);
    // (ad20) scrollIntoViewIfNeeded flagged; scrollIntoView not.
    expect(
      discoverIdiomSites('f.ts', 'el.scrollIntoViewIfNeeded();'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'el.scrollIntoView();')).toEqual([]);
    // (ad21) forceUpdate flagged; a state update not.
    expect(discoverIdiomSites('f.ts', 'this.forceUpdate();')).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', 'setCount(c + 1);')).toEqual([]);
    // (ad22) runtime propTypes flagged in both spellings (one line, one
    // kind hit); displayName not.
    expect(
      discoverIdiomSites('f.ts', 'C.propTypes = { size: PropTypes.string };'),
    ).toHaveLength(1);
    expect(discoverIdiomSites('f.ts', "C.displayName = 'C';")).toEqual([]);
    // (ad23) importScripts flagged; the ESM import not.
    expect(
      discoverIdiomSites('f.ts', "importScripts('worker-lib.js');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "import { lib } from './worker-lib.js';"),
    ).toEqual([]);
    // (ad24) Error.captureStackTrace flagged; a plain Error not.
    expect(
      discoverIdiomSites('f.ts', 'Error.captureStackTrace(e);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const e = new Error('x');"),
    ).toEqual([]);
    // (ad25) the self-referential ternary flagged (identifier and
    // property-path forms); distinct operands and the reserved-word
    // consequent (`cond ? null : y` — the draft's false positive) not.
    expect(
      discoverIdiomSites('f.ts', 'const v = flag ? flag : fallback;\nconst w = a.b ? a.b : c;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites(
        'f.ts',
        'const v = flag ? on : off;\nreturn percent === null ? null : round(x);',
      ),
    ).toEqual([]);
    // (ad26) the IE-prefixed navigator extension flagged; live navigator
    // members not.
    expect(
      discoverIdiomSites('f.ts', "navigator.msSaveBlob(blob, 'x.png');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'navigator.storage.estimate();'),
    ).toEqual([]);
    // (ad27) process.binding flagged; the public import not.
    expect(
      discoverIdiomSites('f.ts', "const fs = process.binding('fs');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "const fs = await import('node:fs');"),
    ).toEqual([]);
    // (ad28) window.external flagged; a live window member not.
    expect(
      discoverIdiomSites('f.ts', 'const ext = window.external;'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const s = window.getSelection();'),
    ).toEqual([]);
    // (ad29) getBoxObjectFor flagged; getBoundingClientRect not.
    expect(
      discoverIdiomSites('f.ts', 'const box = el.getBoxObjectFor();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const box = el.getBoundingClientRect();'),
    ).toEqual([]);
    // (ad30) mutation EVENT names flagged; MutationObserver not.
    expect(
      discoverIdiomSites(
        'f.ts',
        "el.addEventListener('DOMNodeInserted', cb);\nel.addEventListener('DOMSubtreeModified', cb);",
      ),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'new MutationObserver(cb);')).toEqual([]);
    // (ad31) the window.status write flagged; document.title not.
    expect(
      discoverIdiomSites('f.ts', "window.status = 'done';"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "document.title = 'done';"),
    ).toEqual([]);
    // (ad32) fireEvent flagged; dispatchEvent not.
    expect(
      discoverIdiomSites('f.ts', "el.fireEvent('onclick');"),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', "el.dispatchEvent(new Event('x'));"),
    ).toEqual([]);
    // (ad33) children.map flagged (single-child TypeError shape);
    // React.Children.map / toArray not.
    expect(
      discoverIdiomSites('f.ts', 'const parts = children.map((c) => render(c));'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        'const a = React.Children.map(children, (c) => render(c));\nconst b = React.Children.toArray(children);',
      ),
    ).toEqual([]);
    // (ad34) Event.path flagged in the evt/e spellings; composedPath and
    // an unrelated identifier suffix (largestFile.path — the draft's false
    // positive) not.
    expect(
      discoverIdiomSites('f.ts', 'const p = e.path;\nconst q = evt.path;'),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', 'const p = e.composedPath();\nconst s = metrics.largestFile.path;'),
    ).toEqual([]);
    // (ad35) the iv-less cipher ctors flagged; createCipheriv not.
    expect(
      discoverIdiomSites(
        'f.ts',
        "const c = crypto.createCipher('aes-128-cbc', key);\nconst d = crypto.createDecipher('aes-128-cbc', key);",
      ),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites('f.ts', "const c = crypto.createCipheriv('aes-128-cbc', key, iv);"),
    ).toEqual([]);
    // (ad36) bare toLocale{Date,Time}String flagged; the explicit-locale
    // and ISO forms not.
    expect(
      discoverIdiomSites(
        'f.ts',
        'const t = new Date(ts).toLocaleTimeString();\nconst d = new Date(ts).toLocaleDateString();',
      ),
    ).toHaveLength(2);
    expect(
      discoverIdiomSites(
        'f.ts',
        "const t = new Date(ts).toLocaleTimeString('ja-JP');\nconst i = new Date(ts).toISOString();",
      ),
    ).toEqual([]);
    // (ad37) remove-by-value via indexOf+splice flagged; the filter form
    // and a guarded index not.
    expect(
      discoverIdiomSites('f.ts', 'xs.splice(xs.indexOf(bad), 1);'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const ys = xs.filter((x) => x !== bad);'),
    ).toEqual([]);
    // (ad38) the doomed unstable React exports flagged; flushSync not.
    expect(
      discoverIdiomSites(
        'f.ts',
        'unstable_batchedUpdates(() => setX(1));\nunstable_renderSubtreeIntoContainer(C, el, container);',
      ),
    ).toHaveLength(2);
    expect(discoverIdiomSites('f.ts', 'flushSync(() => setX(1));')).toEqual([]);
  });
});
