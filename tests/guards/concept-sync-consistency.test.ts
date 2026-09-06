/**
 * Concept-sync consistency guard — `.concept/` bootstrap (commit 5fd0dd60,
 * run 20260826-104126-424261) test-stage receipt.
 *
 * The bootstrap generated 41 ontology terms / 16 invariants / 41 mappings /
 * 63 claims plus an `ontology_metrics.json` self-census, but nothing in CI
 * re-derived those numbers from the YAML entities. The LLM eval of the
 * implement stage called this out: "metrics と YAML 実体の一致・term 参照の
 * 有効性を検証する構造 guard が無く、次回 run でのドリフト・手動破損を CI
 * が検出できない". This guard is that check.
 *
 * What each leg pins (all RED-verified against the pre-fix bootstrap, which
 * failed the referential-integrity legs with 5 dangling related_terms and a
 * wrong evidence path — see the data fix shipped in the same commit):
 *   1. inventory  — exactly the 14 tracked files exist; no stray entries.
 *   2. metrics    — ontology_metrics.json numbers equal the YAML entities
 *                   (total_terms, by_layer, draft_ratio, queue_pending,
 *                   claims lines, decisions lines, gc merged, run_id).
 *   3. references — related_terms / invariants / ambiguities / queue
 *                   candidates / mappings keys all resolve to canonical
 *                   terms; every term has a mapping with ≥1 code_symbol and
 *                   ≥1 evidence whose source file exists on disk.
 *   4. claims     — every ndjson line parses; term_canonical resolves (or is
 *                   __UNMAPPED__); unmapped ratio ≤ 20% (Q5); confidence and
 *                   priority are in-vocabulary.
 *   5. budget     — ontology.yml stays inside ontology_budget.yml limits
 *                   (terms ≤ 80, layer maxes, draft_ratio_max,
 *                   queue_pending_max) and decisions.md ≤ 200 lines (Rule 6).
 *   6. charter    — north_star non-empty and ≥1 milestone (Q7); autopilot
 *                   command strings reference real package.json scripts.
 *   7. quotes     — evidence quotes are verbatim (whitespace-normalized)
 *                   substrings of their source file; a `…`/`...` INSIDE a
 *                   quote is an elision whose flanking fragments must each
 *                   appear verbatim, in source order; only a TRAILING
 *                   `…`/`...` suffix declares the quote a paraphrase and
 *                   exempts it — and paraphrases are capped at 30% of all
 *                   evidence so the exemption cannot become the norm.
 *   8. gc         — gc_actions.merged equals queue 'merged' decisions,
 *                   gc_actions.deleted equals the tombstones count (every
 *                   GC deletion leaves a tombstone), queue decision values
 *                   stay inside the C-7 vocabulary, and each tombstone's
 *                   term is gone from canonical_terms with its former_id
 *                   unreused (deletion backfill).
 *
 * LLM-eval follow-up (run 20260826-110658 test-stage eval, 90/100): closed
 * the four weaknesses it listed — non-npm autopilot commands passed
 * unvalidated (now allowlist-contracted), gc_actions.deleted/deprecated
 * were unpinned (now derived/typed), evidence quotes had no substring teeth
 * (now the elision contract above; the 15 marker-less paraphrases the
 * bootstrap shipped are fixed in the same diff), and the claims leg's
 * unmapped ratio could read NaN on 0 lines (now floored in the same leg).
 *
 * LLM-eval follow-up #2 (run 20260826-112509 test-stage eval, 92/100): this
 * commit closes the three residual weaknesses — (1) a trailing marker alone
 * let fabricated quotes skip verification entirely (now bounded by the 30%
 * paraphrase-ratio cap), (2) a verbatim quote that merely CONTAINED `...`
 * (spread syntax, string literals) escaped as a false paraphrase (the hatch
 * is now suffix-only; mid-quote markers are verified as elided fragments,
 * each a substring and in source order — the 5 quotes whose fragments were
 * not actually verbatim are fixed in the same diff), and (3) the
 * gc_actions.deleted derivation was 0=0-vacuous with TombstoneEntry typed
 * but unused (tombstones now get a structural backfill leg consuming those
 * fields; the count derivation itself stays as-is).
 *
 * LLM-eval follow-up #3 (run 20260826-114716 test-stage eval, 91/100): the
 * quote/tombstone verification logic moved into concept-quote-contract.ts so
 * it can be pinned directly (session-239 lesson — a helper only exercised
 * through live data has no contract). That module now enforces a ≥5-char
 * floor on elided fragments (`X…a…Y` with a 1-char middle matched anywhere
 * and passed for free; the one live quote with a 1-char `）` flank is
 * extended with real source text in the same diff), and the tombstone
 * backfill branches (malformed / still-canonical / id-reused) get fixture
 * legs so they are proven RED-able while real tombstones are still 0. The
 * paraphrase cap gains a 0.15 ratchet under its 0.30 contract ceiling.
 *
 * Invariant増産 run (2026-08-26T12:48:37Z, repo-autopilot Q3 quality phase):
 * the bootstrap's Q3 weakness (16 invariants against 772 test files, the
 * only FAIL left from the bootstrap eval) was attacked by extracting 10 more
 * invariants from the guards' own bug-class headers (dagre phantom nodes,
 * fps finiteness, time-origin, virtual-mock hang, JWT secret single-source,
 * PDF CJK routing, finite-safe aggregation, quality-threshold single-source,
 * white-space pre-line, sort-receiver mutation — each with verbatim guard
 * evidence). Two contract gaps closed in the same diff: the invariant count
 * had NO metrics↔entity pin (terms/claims/queue did — a silently deleted
 * invariant would not have surfaced in ontology_metrics.json), and the ≥10
 * floor predated the increase. metrics.invariants_total is now derived
 * against invariants.yml and the floor ratchets to 26. The Q3 denominator
 * itself (invariants/test-files ≥ 50% implies ~386 entries, colliding with
 * Rule 7 integration-first) is recorded as AMB-PROC-001 with an AUTO
 * decision to run Q3 on bug-class coverage instead.
 *
 * Test-stage follow-up (run 20260826-124041 eval, 90/100): the増産 run's own
 * additions were the least-pinned surface in this file. Its invariants cite
 * one guard test each under `checks`, but nothing resolved those targets —
 * a typo'd path or a dead npm script would pass silently (the same shape as
 * the evidence-source leg, which caught the bootstrap's path typo). The
 * invariant vocabulary leg pinned `strength` but not the §5.4 `status` enum
 * nor INV- id uniqueness/pattern — exactly where a 10-entry batch edit could
 * duplicate an id. And the run added AMB-PROC-001 plus its decisions.md
 * section in one diff, but no leg pins the cache↔ambiguity correspondence,
 * so a future run recording only one side would drift silently. Three legs
 * close these: checks-target resolution (test → on-disk path or `npm test`,
 * command → real package.json script, manual → non-empty), invariant
 * status/id vocabulary, and the AUTO-cache linkage in both directions.
 *
 * Test-stage follow-up #5 (run 20260826-130957 test-stage eval, 91/100): the
 * #4 legs' three residual contract-strength gaps. (1) A manual check was
 * pinned non-empty only, so any prose passed as a gate; a manual target must
 * now carry ≥1 path-like token that resolves on disk (all-tokens-must-exist
 * is deliberately NOT the contract — INV-ARCH-003 names absent dirs on
 * purpose). (2) The `/^npm test\b/` escape accepted any tail: `npm test --
 * "typo"` is a gate that selects nothing and `npm test-foo` is not even a
 * command; the form is parsed strictly now and a `-- pattern` argument must
 * select ≥1 real test file under tests/. (3) The AUTO-cache loop demanded a
 * Linked line from every `##` section while the duplicate check only covered
 * `## AUTO:` — a legitimate future non-AUTO heading would have RED'd
 * spuriously; Linked is required of AUTO: sections and merely validated
 * elsewhere. All three legs RED-verified by mutation (matrix in the commit).
 *
 * Test-stage follow-up #6 (run 20260826-132518 test-stage eval, 93/100): the
 * #5 selector's named residuals, against VERIFIED jest behavior (jest 30.4.2
 * from this repo's node_modules, not the eval's assumption). (1) The eval
 * said an invalid pattern makes jest "fail at runtime" — it does not:
 * jest-config buildTestPathPatterns catches isValid()=false, prints
 * `Invalid testPattern ... Running all tests instead.` and RESETS the
 * patterns to [], so the run widens to the full suite and stays green
 * (empirically: exit 0, whole suite listed). The #5 substring fallback
 * matched neither that nor sense; an invalid regex is now an offender with
 * the true rationale — the cited gate silently stops meaning what the
 * invariant cites. Same verification fixed the match model: patterns are
 * per-argv-token and OR'd, compiled case-INSENSITIVELY, and a leading `./`
 * anchors at the root (@jest/pattern TestPathPatternsExecutor). (2) manual
 * is the weakest checks branch — its census is pinned exactly, so drifting
 * INTO manual (or strengthening out of it) REDs until the pin is moved
 * consciously. (3) the #5 regexes themselves had no direct pins
 * (session-239 lesson): NPM_TEST_FORM / splitPatternArgs /
 * evaluateNpmTestPatterns / firstResolvablePathToken each get a contract
 * table at the bottom of this file.
 *
 * Test-stage follow-up #7 (run 20260826-134614 test-stage eval, 94/100): the
 * #6 mirror cited jest 30 semantics with no tie to the installed package —
 * a jest upgrade could change @jest/pattern's behavior while every mirror
 * leg stayed green against semantics that no longer exist. The real module
 * is now loaded via createRequire (js-yaml precedent; transitive dep via
 * the jest toolchain, no direct dep, no @types) and tied to the mirror two
 * ways: the installed version is pinned exactly (upgrade → RED → re-verify
 * the mirror legs, then move the pin consciously), and a conformance
 * battery cross-checks the mirror's selection verdicts and invalid-regex
 * classification against the real TestPathPatternsExecutor / isValid().
 * Also fixes the #6 citation drift it surfaced: the jest RUNNER is 30.4.2
 * but the @jest/pattern PACKAGE the mirror mirrors is 30.4.0. And
 * splitPatternArgs' shell-edge scope (no escapes / unbalanced quotes) is
 * now documented at the helper instead of silently unwritten.
 *
 * Test-stage follow-up #8 (run 20260826-143546 implementation stage): the
 * mapping and claim SURFACE was still unverified. The evidence leg resolves
 * `source` paths for terms/invariants/ambiguities/queue, but neither the 82
 * `path::descriptor` code_symbols in mappings.yml (Q2 pinned them non-empty
 * only) nor the `source` field of a claims.ndjson line was ever resolved —
 * a typo'd path or a descriptor gone stale after a refactor passed
 * silently. Closing it surfaced one real casualty the bootstrap shipped:
 * mappings.yml cited `timeline-strategy.ts::class TimelineLayoutStrategy`,
 * mixing the kebab V1 family file (which exports `class TimelineStrategy`)
 * with the class of the separate PascalCase V2 file — fixed in the same
 * diff, together with the ontology definition prose that repeated the
 * stale name. Descriptor teeth are classified (code-shaped /
 * slash-compound / prose, mirroring the manual-checks weak-branch
 * precedent) and the classifier is pinned in its own describe
 * (session-239 lesson).
 *
 * Test-stage follow-up #9/#10 (runs 20260826-144330 / -155632): #9 pinned
 * evidence quotes to their `#Lx` line windows (before it, the verbatim leg
 * stripped the fragment and substring-checked the WHOLE file, so a quote
 * still verbatim elsewhere in the file kept a drifted anchor green forever;
 * its first run caught two live stale anchors). #10 extends the anchor
 * contract to the surfaces that cite locations WITHOUT a quote:
 * claims.ndjson sources get the bounds half (a window pointing past EOF —
 * the cited file shrank via split/refactor/trim — is location drift the #8
 * path-existence leg cannot see), and every cited source gets typo teeth
 * (`#L12a`, `#L12-L` fail the anchor grammar and previously degraded
 * silently to the file-level contract parseLineAnchor hands to headings).
 * Both new helpers are pinned in the contract describe (session-239 lesson).
 *
 * Test-stage follow-up #11 (run 20260826-160430 test stage; the residuals of the 20260826-143546 implement eval plus the charter sibling-site gap):
 * the resolution contracts covered invariants checks, YAML evidence,
 * mappings descriptors — but two surfaces still escaped them entirely.
 * (1) charter.yml, Source-of-Truth #1, had its OWN gates unread: §5.1
 * milestone `acceptance` entries and `work_policy.quality_gates` passed
 * unvalidated (the Charter shape did not even carry them). They now resolve
 * through the SAME per-type contract as invariant checks via a shared
 * `checkTargetOffenders` resolver (one definition, two call sites — the
 * missed-sibling-site class). The first run caught a real casualty: MS-001
 * declared `type: test` on the command-form gate `npm run verify:all` —
 * corrected to `type: command` in the same diff (the script is real).
 * (2) claims.ndjson records: `artifact_type`/`about`/`claim_type` passed
 * unread (now pinned to the FULL concept-sync C-1 schema enums, not the
 * observed subset), nothing related claim_type to confidence even though
 * Rule 1 of the sync 絶対的指針 makes the pair an obligation (推測は
 * hypothesis, confidence ≤ 0.4 — 5 bootstrap claims sat at 0.5, clamped in
 * the same diff).
 *
 * Rebase note (2026-08-27): #11 was authored in parallel with #10 and its
 * claims-anchor leg restated #10's window-fits contract inline; the rebased
 * branch keeps #10's helper-backed leg and #11's vocabulary cross-field leg.
 *
 * Test-stage follow-up #13 (run 20260826-172306 test stage; residuals of the
 * 20260826-163645 implement eval): #12's census enforced §B-10's LINE form
 * for claims but not the byte form ("10k lines OR 10MB" — a handful of
 * pathological lines stays under 10k while blowing past 10MB), and nothing
 * caught a silently RAISED cap (invariants_max 60 → 600 would keep an
 * over-cap store green forever; the #12 key-set pin only has teeth for
 * delete/rename). Both closed: claims_max_bytes joins the census (28.5KB
 * today, Buffer.byteLength over the read source), and every ceiling value
 * is pinned to the §B-10 numbers so raising one is a deliberate,
 * diff-visible change to BOTH the pin and ontology_budget.yml.
 *
 * Test-stage follow-up #14 (run 20260826-174327 test stage; residuals of the
 * 20260826-172306 test eval + one sibling-site it did not call out): the #13
 * value pin covered file_ceilings ONLY — the Q4/Q6 leg compares against
 * budget.limits / budget.ratios, whose values were unpinned, so
 * total_terms_max 80 → 800 (or draft_ratio_max 0.30 → 1.0) silently disarmed
 * those caps the same way #13's teeth disarmed for file_ceilings. The spec's
 * §C-8 ontology_budget example is the authority for those numbers, so they
 * are pinned now too. Also resolved the eval's redundancy note: the census
 * leg's key-set pin duplicated the value pin's coverage (toEqual fails on
 * extra/missing keys), so the key-set expect was removed — the pinned-values
 * leg is the single authority for keys AND values.
 *
 * Test-stage follow-up #15 (run 20260826-180241 test stage; residual of the
 * 20260826-174327 test eval): the byte census read Buffer.byteLength of the
 * DECODED text — §B-10 caps the FILE, and decode→re-encode is not
 * size-preserving (an invalid sequence decodes to U+FFFD and re-encodes to
 * 3 bytes). The census now reads the statSync size (disk truth), with an
 * equality leg pinning it to the decoded length so any divergence REDs
 * instead of passing silently. The eval's other suggestion (metrics-side
 * draft-ratio / queue-pending derivation legs) was verified ALREADY
 * covered: the metrics legs pin both to the recount that the Q4/Q6 leg
 * checks against budget.ratios.
 *
 * Scope decisions (conscious, keep future edits honest):
 *   - Evidence QUOTES are pinned modulo whitespace: single-line quotes are
 *     exact substrings, multi-line excerpts may be flattened with single
 *     spaces (both sides collapse `\s+` before comparing). A quote that
 *     paraphrases instead of excerpting must END with `…`/`...` — that is
 *     the escape hatch, and using it without being a paraphrase is a data
 *     bug. An elision (marker in the middle) is NOT an escape: both flanks
 *     must literally occur in the source, in order. Residual gap, accepted:
 *     a verbatim quote that genuinely ends in source-code `...` reads as a
 *     paraphrase — the ratio cap bounds how often that can happen.
 *     (Source FILE existence is still checked separately — that is what
 *     caught the bootstrap's `tests/export/__tests__/xss-security.test.ts`
 *     → `src/export/...` typo.)
 *   - gc_actions.deprecated has NO independent machine source: B-9 deprecates
 *     stale domain terms, but the ontology status enum is draft|stable only
 *     and tombstones record deletions, not deprecations. Only the count's
 *     type/range is pinned; when a representation lands, derive it here.
 *   - js-yaml is loaded via createRequire (transitive dep via the eslint
 *     toolchain; no direct dep, no @types package). If it ever disappears,
 *     the require throws loud here instead of the guard silently greening —
 *     the interop canary below makes that failure mode legible.
 *   - Paths anchor on freeze-guard's import.meta.url-derived REPO_ROOT /
 *     resolveSource, never process.cwd() (cwd-discipline rule).
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { REPO_ROOT, resolveSource, readSource } from '@tests/guards/freeze-guard';
import {
  collectTombstoneViolations,
  isUnverifiedParaphrase,
  malformedAnchorFragment,
  parseLineAnchor,
  stripTrailingMarker,
  verifyAnchorFits,
  verifyAnchorWindow,
  verifyQuoteExcerpt,
  type TombstoneEntry,
} from '@tests/guards/concept-quote-contract';

const nodeRequire = createRequire(import.meta.url);
const yamlLoad = (nodeRequire('js-yaml') as { load: (input: string) => unknown })
  .load;

// The REAL pattern engine the #6 mirror imitates (@jest/pattern ships with
// the jest toolchain as a transitive dep — same load strategy as js-yaml
// above; if it ever disappears, this require throws loud here instead of
// the conformance legs below silently greening). Structural type only: the
// conformance describe uses isValid() and toExecutor().isMatch(), nothing
// else, so an API reshape fails as a leg rather than a TypeError elsewhere.
const jestPattern = nodeRequire('@jest/pattern') as {
  TestPathPatterns: new (
    patterns: string[],
  ) => {
    isValid(): boolean;
    toExecutor(options: {
      rootDir: string;
    }): { isMatch(absPath: string): boolean };
  };
};

// ---------------------------------------------------------------------------
// Local shapes for the machine-generated .concept YAML/JSON subset. Parsed
// data is cast to these and then structurally asserted below, so a shape
// drift in the generator fails as a leg here rather than as a TypeError in
// an unrelated assertion.
// ---------------------------------------------------------------------------
interface Evidence {
  source: string;
  quote: string;
}
interface TermEntry {
  id: string;
  layer: string;
  status: string;
  related_terms?: string[];
  evidence?: Evidence[];
}
interface InvariantEntry {
  id: string;
  status: string;
  strength: string;
  related_terms?: string[];
  evidence?: Evidence[];
  checks?: { type: string; target: string }[];
}
interface AmbiguityEntry {
  id: string;
  term: string;
  evidence?: Evidence[];
  auto_decision?: { status: string; decision_key: string };
}
interface QueueItem {
  id: string;
  decision: string;
  auto_merge_candidates?: { term: string; similarity?: number }[];
  evidence?: Evidence[];
}
interface Budget {
  limits: {
    total_terms_max: number;
    core_max: number;
    domain_max: number;
    aux_max: number;
  };
  ratios: { draft_ratio_max: number; queue_pending_max: number };
  file_ceilings: {
    invariants_max: number;
    ambiguities_max: number;
    conflicts_max: number;
    mappings_max: number;
    term_queue_max: number;
    claims_max_lines: number;
    claims_max_bytes: number;
  };
}
interface Charter {
  product_goal: { north_star: string };
  milestones: {
    id: string;
    name: string;
    status: string;
    priority: string;
    acceptance: { type: string; target: string }[];
  }[];
  work_policy: {
    default_mode: string;
    quality_gates: { must_pass: string[] };
  };
}
interface Metrics {
  run_id: string;
  total_terms: number;
  by_layer: { core: number; domain: number; aux: number };
  draft_ratio: number;
  invariants_total: number;
  queue_pending: number;
  claims_retained_lines: number;
  decisions_md_lines: number;
  gc_actions: { merged: number; deleted: number; deprecated: number };
}
interface Claim {
  term_canonical: string;
  confidence: number;
  priority: string;
  source: string;
  artifact_type: string;
  about: string;
  claim_type: string;
}

function loadYaml<T>(rel: string): T {
  return yamlLoad(readSource(rel)) as T;
}

const ontology = loadYaml<{ canonical_terms: Record<string, TermEntry> }>(
  '.concept/ontology.yml',
);
const invariants = loadYaml<{ invariants: InvariantEntry[] }>(
  '.concept/invariants.yml',
);
const mappings = loadYaml<{ mappings: Record<string, MappingEntry> }>(
  '.concept/mappings.yml',
);
interface MappingEntry {
  code_symbols?: string[];
}
const termQueue = loadYaml<{ queue: QueueItem[] }>('.concept/term_queue.yml');
const ambiguities = loadYaml<{ ambiguities: AmbiguityEntry[] }>(
  '.concept/ambiguities.yml',
);
const budget = loadYaml<Budget>('.concept/ontology_budget.yml');
const charter = loadYaml<Charter>('.concept/charter.yml');
const autopilot = loadYaml<{ commands: Record<string, string> }>(
  '.concept/autopilot.yml',
);
// conflicts is allowed to be an empty array — parse-only leg (plus the
// B-10 ceiling census below).
const conflicts = loadYaml<{ conflicts: unknown[] }>('.concept/conflicts.yml');
const tombstones = loadYaml<{ tombstones: TombstoneEntry[] }>(
  '.concept/tombstones.yml',
);

// Raw bytes kept alongside the parses: the INV-TEST-010 byte-dialect leg
// below needs the on-disk form, not the parsed value.
const metricsRaw = readSource('.concept/ontology_metrics.json');
const runStateRaw = readSource('.concept/run_state.json');
const metrics = JSON.parse(metricsRaw) as Metrics;
const runState = JSON.parse(runStateRaw) as {
  last_run_id: string;
  claims_retained_lines: number;
};

const termNames = Object.keys(ontology.canonical_terms);
const termEntries = Object.entries(ontology.canonical_terms);

const layerCounts: Record<string, number> = {};
let draftCount = 0;
for (const term of Object.values(ontology.canonical_terms)) {
  layerCounts[term.layer] = (layerCounts[term.layer] ?? 0) + 1;
  if (term.status === 'draft') draftCount += 1;
}

const claimsNdjson = readSource('.concept/claims.ndjson');
const claimLines = claimsNdjson.split('\n').filter((line) => line.trim() !== '');
// B-10 caps claims.ndjson at 10k lines OR 10MB. The byte form is what a
// line-count census can never see: a handful of pathological lines stays far
// under 10k while blowing past the size cap.
const claimsNdjsonBytes = Buffer.byteLength(claimsNdjson, 'utf8');
// §B-10's "10MB" caps the FILE, so the byte census below reads the on-disk
// size (statSync), not the re-encoded decoded length — the two can diverge
// on invalid UTF-8 (a stray 0xFF decodes to U+FFFD and re-encodes to 3
// bytes), and the equality leg fails loudly if they ever do.
const claimsOnDiskBytes = statSync(resolveSource('.concept/claims.ndjson')).size;
const decisionsMdLines = lineCountOf(readSource('.concept/decisions.md'));

/** wc -l convention: split on \n and drop one trailing empty fragment. */
function lineCountOf(text: string): number {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

// The tracked .concept inventory (repo-autopilot §3 fixed layout). `archive/`
// is gitignored but its presence is allowed.
const CONCEPT_FILES = [
  'ambiguities.yml',
  'autopilot.yml',
  'charter.yml',
  'claims.ndjson',
  'conflicts.yml',
  'decisions.md',
  'invariants.yml',
  'mappings.yml',
  'ontology.yml',
  'ontology_budget.yml',
  'ontology_metrics.json',
  'run_state.json',
  'term_queue.yml',
  'tombstones.yml',
] as const;

// term_queue decision vocabulary — concept-sync C-7 schema (`decision:
// "pending|merged|rejected|accepted"`). A typo'd or novel value REDs the
// vocabulary leg below and must be added here consciously; silently counting
// as neither pending nor merged would skew the metrics derivations.
const QUEUE_DECISIONS = new Set(['pending', 'merged', 'rejected', 'accepted']);

// claims.ndjson record vocabulary — concept-sync C-1 schema enums, pinned as
// the FULL schema set, not the observed subset: a legitimately novel-but-
// schema-legal value (`db`, `lifecycle`, …) must pass, a typo'd `spek` must
// RED until the schema itself changes. Same posture as QUEUE_DECISIONS.
const CLAIM_ARTIFACT_TYPES = new Set([
  'spec',
  'design',
  'code',
  'test',
  'db',
  'ops',
  'unknown',
]);
const CLAIM_ABOUT = new Set([
  'definition',
  'lifecycle',
  'boundary',
  'invariant',
  'transition',
  'data_constraint',
  'error_handling',
]);
const CLAIM_TYPES = new Set(['fact', 'hypothesis']);

// Repo contract: every quality-gate command is `npm [run] <script>` (CI and
// local gates are npm scripts only — AGENTS.md 検証コマンド). A command that
// is not npm-form passes ONLY by being listed verbatim here (empty today).
// Anything else is a typo'd or dead gate the old leg let through silently.
const RAW_COMMAND_ALLOWLIST: readonly string[] = [];

// A manual check target is a free-form instruction (§5.4 defines no richer
// schema), but "manual と自称すれば何でも通る" was the eval's contract-strength
// gap — a manual gate that cannot name a file or directory it touches is
// unfalsifiable prose. Minimum structural pin: ≥1 path-like token (contains
// `/` or ends in a known file extension) resolves under resolveSource.
// Deliberately NOT all-tokens-must-exist: instructions like INV-ARCH-003's
// `ls src/（types/config/utils/lib 不在確認）` name absent paths on purpose.
const PATH_LIKE_TOKEN = /[A-Za-z0-9_.\-/]+/g;
const PATH_EXTENSION = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|html|css)$/;
function firstResolvablePathToken(target: string): string | null {
  for (const token of target.match(PATH_LIKE_TOKEN) ?? []) {
    if (!(token.includes('/') || PATH_EXTENSION.test(token))) continue;
    const trimmed = token.replace(/\/+$/, ''); // `src/` anchors on `src`
    if (trimmed !== '' && existsSync(resolveSource(trimmed))) return trimmed;
  }
  return null;
}

// Strict shape of a test-type `npm test` invocation: bare `npm test`, or
// `npm test -- <patterns>` where the tail holds argv-style patterns (quotes
// group). Anything else starting with `npm` is malformed (the old
// `/^npm test\b/` hatch let both `-- "typo"` and `npm test-foo` through).
const NPM_TEST_FORM = /^npm test(?:\s+--\s+(.+))?$/;

// Repo-relative *.test.* / *.spec.* files under tests/ — the universe a
// `-- pattern` argument must select from. walkProductionFiles is NOT usable
// here: it skips exactly the test files this leg needs to see.
function collectTestFilePaths(dirRel = 'tests'): string[] {
  const acc: string[] = [];
  for (const entry of readdirSync(resolveSource(dirRel))) {
    const rel = `${dirRel}/${entry}`;
    if (statSync(resolveSource(rel)).isDirectory()) {
      acc.push(...collectTestFilePaths(rel));
    } else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}
const testFilePaths = collectTestFilePaths();

/**
 * Split a `--` tail shell-style: quoted spans group, bare runs split on space.
 * Shell escapes (`\ `, `\"`), unbalanced, and mixed quotes are NOT handled —
 * inputs are single-line YAML-authored tails from invariants.yml, not
 * arbitrary shell. Residual divergence is fail-loud or narrows the run (a
 * mis-split fragment whose reconstruction matches nothing makes jest exit 1
 * "No tests found"), never the silent full-suite widening that the
 * invalid-regex offender class exists to catch.
 */
function splitPatternArgs(tail: string): string[] {
  const args: string[] = [];
  for (const m of tail.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    args.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return args;
}

type PatternSelection =
  | { ok: true }
  | { ok: false; reason: 'invalid-regex'; pattern: string }
  | { ok: false; reason: 'selects-nothing' };

/**
 * jest 30 `--testPathPatterns` semantics, mirrored from the installed
 * @jest/pattern TestPathPatternsExecutor (30.4.0, this repo — the jest
 * RUNNER is 30.4.2; the pinned conformance describe below holds the
 * mirror to this exact package version):
 *   - each argv token is its own pattern and patterns are OR'd;
 *   - every pattern compiles case-INSENSITIVELY against the repo-relative
 *     path, with a leading `./` anchoring at the root (`./foo` ≙ `^foo`);
 *   - an INVALID regex never substring-matches — jest-config's
 *     buildTestPathPatterns downgrades it to the empty pattern list with
 *     `Invalid testPattern ... Running all tests instead.` (verified: exit 0,
 *     full suite). The gate then silently widens to everything, so it is an
 *     offender here, not a pass; and `-- typo` (selects nothing) makes jest
 *     exit 1 with "No tests found" (verified) — also an offender.
 */
function evaluateNpmTestPatterns(tail: string): PatternSelection {
  let anyMatch = false;
  for (const pattern of splitPatternArgs(tail)) {
    const regexStr = pattern.replace(/^\.\//, '^'); // `./` → root anchor
    let selector: RegExp;
    try {
      selector = new RegExp(regexStr, 'i');
    } catch {
      return { ok: false, reason: 'invalid-regex', pattern };
    }
    if (testFilePaths.some((p) => selector.test(p))) anyMatch = true;
  }
  return anyMatch ? { ok: true } : { ok: false, reason: 'selects-nothing' };
}

/**
 * Resolve one §5.4/C-11 checks-shaped target against repo truth. Follow-up
 * Follow-up #11: extracted from the invariants checks leg so charter milestone
 * acceptance can resolve through the SAME contract — one definition, two
 * call sites, no fork (the missed-sibling-site bug class). Returns offender
 * strings WITHOUT the `<id>: ` prefix; callers prepend their own label.
 * A `type` outside the three branches resolves nothing and stays silent —
 * vocabulary enforcement is the caller's leg, not this helper's.
 */
function checkTargetOffenders(
  type: string,
  target: string,
  scripts: ReadonlySet<string>,
): string[] {
  const offenders: string[] = [];
  if (type === 'test') {
    if (/^npm\b/.test(target)) {
      const m = target.match(NPM_TEST_FORM);
      if (m === null) {
        offenders.push(`malformed npm test form: ${target}`);
      } else if (m[1] !== undefined) {
        const selection = evaluateNpmTestPatterns(m[1]);
        if (!selection.ok) {
          offenders.push(
            selection.reason === 'invalid-regex'
              ? `npm test pattern is an invalid regex — jest downgrades it to the FULL suite ("Running all tests instead"), the gate stops meaning what the invariant cites: ${selection.pattern}`
              : `npm test pattern selects no test file (jest exits 1 "No tests found"): ${target}`,
          );
        }
      }
    } else if (!existsSync(resolveSource(target))) {
      offenders.push(`test target not on disk: ${target}`);
    }
  } else if (type === 'command') {
    const match = target.match(/^npm (?:run )?(\S+)$/);
    if (!match || !scripts.has(match[1])) {
      offenders.push(`command is not a real script: ${target}`);
    }
  } else if (type === 'manual') {
    if (firstResolvablePathToken(target) === null) {
      offenders.push(`manual target has no resolvable path anchor: ${target}`);
    }
  }
  return offenders;
}

// A §5.5 code_symbol is `<path>::<descriptor>`. Follow-up #8: nothing
// resolved EITHER side, so a typo'd path (the bug class the evidence leg
// caught at bootstrap) or a descriptor gone stale after a refactor passed
// silently — the live probe found exactly that (see header). Descriptor
// teeth are classified like the checks-target branches: strong where a
// machine truth exists, path-existence-only where it does not.
//   - slash compounds (`msToFrame/frameToMs`): every member token must
//     occur in the mapped file — one renamed member REDs;
//   - code-shaped (keyword-prefixed `class X`/`function X`/… or a bare
//     identifier): the literal must occur in the mapped file;
//   - free prose (`Express server`, `spine validator`): nothing to verify
//     a label against — the documented weak branch.
// A directory anchor passes `fileText === null`: prose stays legal there,
// but a compound or code-shaped descriptor on a directory REDs (it claims
// a verifiable member the anchor cannot ground).
const CODE_DESCRIPTOR_KEYWORD =
  /^(?:class|function|interface|type|const|enum|def) /;
const BARE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function codeDescriptorOffenders(
  descriptor: string,
  fileText: string | null,
): string[] {
  const offenders: string[] = [];
  if (descriptor.includes('/')) {
    for (const member of descriptor.split('/')) {
      const token = member.trim();
      if (token === '') {
        offenders.push(`empty member in "${descriptor}"`);
      } else if (fileText === null || !fileText.includes(token)) {
        offenders.push(`member "${token}" of "${descriptor}" not found`);
      }
    }
    return offenders;
  }
  if (
    CODE_DESCRIPTOR_KEYWORD.test(descriptor) ||
    BARE_IDENTIFIER.test(descriptor)
  ) {
    if (fileText === null || !fileText.includes(descriptor)) {
      offenders.push(`"${descriptor}" not found`);
    }
  }
  return offenders;
}

// A code_symbol path absent from disk is legal ONLY when the repo itself
// declares it generated — derived from .gitignore's LITERAL lines (no glob
// metacharacters, no `!` negation; leading/trailing `/` normalized away).
// specs/_doc_spine.yml (.gitignore:332 "auto-generated spine manifest",
// see also spine-anchor-contract.ts) is the live case: a clean checkout
// never contains it, so an existsSync-only contract would RED on every
// fresh CI clone. Globs are deliberately NOT interpreted — half-parsed
// gitignore semantics would silently over-allow; a glob-covered absent
// path REDs and must be handled consciously (derive or re-anchor).
const GITIGNORE_LITERAL_PATHS: ReadonlySet<string> = new Set(
  readSource('.gitignore')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line !== '' &&
        !line.startsWith('#') &&
        !line.startsWith('!') &&
        !/[*?[\]]/.test(line), // gitignore globs are `*`/`?`/`[]` — NOT `.`
    )
    .map((line) => line.replace(/^\//, '').replace(/\/+$/, '')),
);

describe('concept-sync consistency guard (.concept/ bootstrap 5fd0dd60)', () => {
  it('js-yaml interop canary: load() round-trips a known snippet', () => {
    // If the createRequire interop broke (load === undefined), every loadYaml
    // call would throw a bare TypeError and the whole suite would error out
    // opaquely. Pin the happy path first so the failure reads legibly.
    expect(yamlLoad('a: ["x", "y"]')).toEqual({ a: ['x', 'y'] });
  });

  it('inventory: exactly the 14 tracked .concept files exist, no stray entries', () => {
    // A deleted/renamed managed file must fail here rather than surface as a
    // vacuous pass elsewhere; an unexpected extra file violates the fixed
    // directory layout (repo-autopilot §3 "これ以外のファイルを追加しない").
    // `archive/` is the one gitignored-but-allowed entry.
    const entries = readdirSync(join(REPO_ROOT, '.concept'));
    const managed = entries.filter((e) => e !== 'archive');
    expect(managed.sort()).toEqual([...CONCEPT_FILES].sort());
  });

  it('metrics: total_terms equals the ontology canonical_terms count', () => {
    expect(termNames.length).toBeGreaterThanOrEqual(30); // anti-vacuous floor
    expect(metrics.total_terms).toBe(termNames.length);
  });

  it('metrics: by_layer equals the recounted layer census (no hidden 4th layer)', () => {
    // toEqual (not property-by-property) so an unknown layer value showing up
    // as an extra key fails loudly here, and the three keys must sum to total.
    expect(metrics.by_layer).toEqual(layerCounts);
    expect(
      metrics.by_layer.core + metrics.by_layer.domain + metrics.by_layer.aux,
    ).toBe(metrics.total_terms);
  });

  it('metrics: draft_ratio is the 2-decimal rounding of the recounted ratio', () => {
    expect(metrics.draft_ratio).toBe(
      Math.round((draftCount / termNames.length) * 100) / 100,
    );
  });

  it('metrics: invariants_total equals the invariants.yml entry count', () => {
    // Q3増産 run: every other entity census (terms, by_layer, claims lines,
    // decisions lines, queue decisions, tombstones) already had its
    // metrics↔entity derivation — the invariant count alone could drift
    // silently (a deleted INV- left the stale number blessing the file).
    expect(metrics.invariants_total).toBe(invariants.invariants.length);
  });

  it('metrics: queue_pending equals the pending decisions in term_queue', () => {
    const pending = termQueue.queue.filter((q) => q.decision === 'pending');
    expect(metrics.queue_pending).toBe(pending.length);
  });

  it('metrics: claims_retained_lines equals the ndjson line count (and run_state agrees)', () => {
    expect(claimLines.length).toBeGreaterThanOrEqual(40); // anti-vacuous floor
    expect(metrics.claims_retained_lines).toBe(claimLines.length);
    expect(runState.claims_retained_lines).toBe(claimLines.length);
  });

  it('metrics: decisions_md_lines equals decisions.md line count', () => {
    expect(metrics.decisions_md_lines).toBe(decisionsMdLines);
  });

  it('metrics: gc_actions.merged equals the merged decisions in term_queue', () => {
    const merged = termQueue.queue.filter((q) => q.decision === 'merged');
    expect(metrics.gc_actions.merged).toBe(merged.length);
  });

  it('metrics: gc_actions.deleted equals the tombstones count (one tombstone per GC deletion)', () => {
    // B-9: every GC deletion must leave a tombstone, so the counter and the
    // tombstone list cannot drift apart. (Currently 0 = 0; RED-verified by
    // mutation — see commit message.)
    expect(metrics.gc_actions.deleted).toBe(tombstones.tombstones.length);
  });

  it('metrics: gc_actions.deprecated is a non-negative integer count', () => {
    // No independent machine source exists (see header scope note): ontology
    // status is draft|stable and tombstones only record deletions. Pin the
    // shape until a representation lands, then derive it here.
    expect(Number.isInteger(metrics.gc_actions.deprecated)).toBe(true);
    expect(metrics.gc_actions.deprecated).toBeGreaterThanOrEqual(0);
  });

  it('gc: tombstones reference only deleted terms — term gone from canonical_terms, former_id unreused', () => {
    // B-9 backfill contract (eval follow-up #2, weakness 3): a tombstone is
    // the receipt for a GC deletion, so its term must NOT be a canonical
    // term anymore, and its former TERM- id must not have been reused by a
    // surviving term. Real data is empty today — the malformed /
    // still-canonical / id-reused branches are proven RED-able by the
    // fixture pins in the concept-quote-contract describe below, so the
    // first real deletion lands on a leg already carrying teeth.
    const liveIds = new Set(termEntries.map(([, t]) => t.id));
    expect(
      collectTombstoneViolations(
        tombstones.tombstones,
        ontology.canonical_terms,
        liveIds,
      ),
    ).toEqual([]);
  });

  it('metrics: run_id matches run_state.last_run_id', () => {
    expect(metrics.run_id).toBe(runState.last_run_id);
  });

  it('references: ontology related_terms all resolve to canonical terms', () => {
    const dangling: string[] = [];
    for (const [name, term] of termEntries) {
      for (const related of term.related_terms ?? []) {
        if (!(related in ontology.canonical_terms)) {
          dangling.push(`${name} -> ${related}`);
        }
      }
    }
    // Pre-fix bootstrap shipped 5 of these (BrowserTranscriber /
    // CanvasCalculator / ActualVideoRenderer / BatchProcessingAPI /
    // FrameworkIntegratedPipeline). related_terms must be canonical-only —
    // new concepts go through term_queue, never a bare reference.
    expect(dangling).toEqual([]);
  });

  it('references: invariant related_terms all resolve to canonical terms', () => {
    const dangling: string[] = [];
    for (const inv of invariants.invariants) {
      for (const related of inv.related_terms ?? []) {
        if (!(related in ontology.canonical_terms)) {
          dangling.push(`${inv.id} -> ${related}`);
        }
      }
    }
    // Anti-vacuous floor, ratcheted 10 → 26 by the Q3増産 run (16 bootstrap
    // invariants + 10 extracted from guard bug-class headers). Lowering it is
    // a conscious regression decision, never a cleanup side effect.
    expect(invariants.invariants.length).toBeGreaterThanOrEqual(26);
    expect(dangling).toEqual([]);
  });

  it('checks: every invariant carries ≥1 check with a schema type and a resolvable target', () => {
    // Every invariant names how it is enforced under `checks`; the Q3増産
    // run cites one guard test per new invariant there. Nothing resolved
    // those targets, so a typo'd path or a dead gate would pass silently —
    // the same blind spot the evidence-source leg closed for evidence.
    // Contract per §5.4 / C-11:
    //   - test    → target is a repo path that exists on disk (file or dir;
    //               resolveSource routes src/<core-four>/ into @stv/core),
    //               or a STRICT `npm test [-- "pattern"]` invocation whose
    //               pattern selects ≥1 real test file (NPM_TEST_FORM)
    //   - command → `npm [run] <script>` where the script exists in
    //               package.json (same derivation as the autopilot leg).
    //               npm-form is this repo's entire gate vocabulary (AGENTS.md
    //               検証コマンド) — a non-npm command here is a data bug to
    //               fix, never a form to allowlist open-endedly
    //   - manual  → free-form instruction that must still anchor on the
    //               repo: ≥1 path-like token resolving on disk
    expect(testFilePaths.length).toBeGreaterThanOrEqual(400); // selector floor
    const pkg = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
    };
    const scripts = new Set(Object.keys(pkg.scripts));
    const checkTypes = new Set(['test', 'command', 'manual']);
    const offenders: string[] = [];
    for (const inv of invariants.invariants) {
      const checks = inv.checks ?? [];
      if (checks.length === 0) offenders.push(`${inv.id}: no checks entry`);
      for (const check of checks) {
        if (!checkTypes.has(check.type)) {
          offenders.push(`${inv.id}: unknown check type "${check.type}"`);
        }
        if (check.target.trim() === '') {
          offenders.push(`${inv.id}: empty check target`);
        }
        // Follow-up #11: the per-type resolution now lives in the shared
        // checkTargetOffenders resolver (pinned below) so charter acceptance
        // runs the identical contract.
        for (const offender of checkTargetOffenders(
          check.type,
          check.target,
          scripts,
        )) {
          offenders.push(`${inv.id}: ${offender}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('checks: manual-type census is pinned exactly — drifting into the weakest branch must be a conscious act', () => {
    // Eval #6: a manual target is verified only structurally (≥1 resolvable
    // path token), the weakest of the three checks branches. The census is
    // EXACT — a new manual check, or converting an existing one to/from
    // manual, REDs here until this list is edited on purpose. The default
    // direction for a new invariant is test/command; manual is the escape
    // hatch for contracts no command can express (INV-ARCH-003's absent-dir
    // review), not a convenience.
    const manualIds = invariants.invariants
      .filter((inv) => (inv.checks ?? []).some((c) => c.type === 'manual'))
      .map((inv) => inv.id);
    expect(manualIds).toEqual([
      'INV-ARCH-001',
      'INV-ARCH-003',
      'INV-PIPE-002',
      'INV-TEST-002',
    ]);
  });

  it('references: ambiguity terms and queue merge candidates resolve to canonical terms', () => {
    const dangling: string[] = [];
    for (const amb of ambiguities.ambiguities) {
      if (!(amb.term in ontology.canonical_terms)) {
        dangling.push(`${amb.id} -> ${amb.term}`);
      }
    }
    for (const item of termQueue.queue) {
      for (const cand of item.auto_merge_candidates ?? []) {
        if (!(cand.term in ontology.canonical_terms)) {
          dangling.push(`${item.id} -> ${cand.term}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('mapping coverage: mappings keys and canonical terms are the same set, each with ≥1 code_symbol (Q2)', () => {
    const mapKeys = Object.keys(mappings.mappings);
    expect(mapKeys.length).toBeGreaterThanOrEqual(30); // anti-vacuous floor
    expect(mapKeys.filter((k) => !(k in ontology.canonical_terms))).toEqual([]);
    expect(
      termNames.filter((n) => !(n in mappings.mappings)),
    ).toEqual([]);
    const withoutSymbols = mapKeys.filter(
      (k) => (mappings.mappings[k].code_symbols ?? []).length === 0,
    );
    expect(withoutSymbols).toEqual([]);
  });

  it('mappings: every code_symbol path resolves on disk; code-shaped descriptors occur in the mapped file', () => {
    // Follow-up #8, leg 1 — the mapping-side twin of the evidence-source
    // leg. Q2 verified code_symbols were NON-EMPTY, never that they point
    // anywhere real: a typo'd path or a `<file>::<symbol>` pair gone stale
    // after a refactor drifted silently. The first run of this leg caught
    // the bootstrap's `timeline-strategy.ts::class TimelineLayoutStrategy`
    // (the V1 kebab file exports `class TimelineStrategy`; the Layout*
    // class lives in the separate PascalCase V2 file) — fixed in the same
    // diff. `resolveSource` routes src/<core-four>/ into @stv/core exactly
    // like the evidence leg, so historical paths keep resolving.
    const missing: string[] = [];
    const stale: string[] = [];
    for (const [name, entry] of Object.entries(mappings.mappings)) {
      for (const symbol of entry.code_symbols ?? []) {
        const sep = symbol.indexOf('::');
        if (sep < 0) {
          missing.push(`${name}: not <path>::<descriptor> form: ${symbol}`);
          continue;
        }
        const path = symbol.slice(0, sep).replace(/\/+$/, ''); // dir anchors
        const resolved = resolveSource(path);
        if (!existsSync(resolved)) {
          if (!GITIGNORE_LITERAL_PATHS.has(path)) {
            // Declared generated-and-absent paths are the one legal miss
            // (see GITIGNORE_LITERAL_PATHS); everything else is a typo or a
            // post-refactor orphan the old non-empty-only leg let through.
            missing.push(`${name}: ${path}`);
          }
          continue;
        }
        // A directory anchor (GuardHarness → tests/guards/) has no file
        // text; existence is its whole contract (see the classifier note).
        const fileText = statSync(resolved).isDirectory()
          ? null
          : readFileSync(resolved, 'utf8');
        for (const offender of codeDescriptorOffenders(
          symbol.slice(sep + 2),
          fileText,
        )) {
          stale.push(`${name}: ${symbol} [${offender}]`);
        }
      }
    }
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('evidence: every term has ≥1 evidence entry (Q8)', () => {
    const bare = termNames.filter(
      (name) => (ontology.canonical_terms[name].evidence ?? []).length === 0,
    );
    expect(bare).toEqual([]);
  });

  it('evidence: every referenced source file exists on disk (terms, invariants, ambiguities, queue)', () => {
    // resolveSource routes src/<core-four>/... into @stv/core — the same
    // routing readSource uses, so evidence pinned at historical paths keeps
    // resolving after the stv-core split.
    const missing: string[] = [];
    const check = (source: string, label: string): void => {
      const path = source.split('#')[0];
      if (!existsSync(resolveSource(path))) missing.push(`${label}: ${source}`);
    };
    for (const [name, term] of termEntries) {
      for (const ev of term.evidence ?? []) check(ev.source, `term ${name}`);
    }
    for (const inv of invariants.invariants) {
      for (const ev of inv.evidence ?? []) check(ev.source, inv.id);
    }
    for (const amb of ambiguities.ambiguities) {
      for (const ev of amb.evidence ?? []) check(ev.source, amb.id);
    }
    for (const item of termQueue.queue) {
      for (const ev of item.evidence ?? []) check(ev.source, item.id);
    }
    // Pre-fix bootstrap shipped a wrong prefix here (tests/export/__tests__/
    // xss-security.test.ts → src/export/__tests__/...) in two entries.
    expect(missing).toEqual([]);
  });

  it('evidence: quotes are verbatim excerpts; mid-quote `…`/`...` elide fragments that must appear in source order', () => {
    // Contract: a quote is (a) a verbatim excerpt — whitespace-normalized
    // substring, single-line or flattened multi-line — or (b) an elided
    // excerpt, where every `…`/`...` INSIDE the quote stands for omitted
    // text: each flanking fragment must be a substring of the source AND
    // the fragments must occur in source order (a fabricated or reordered
    // elision fails), with each fragment ≥5 trimmed chars (a 1-2 char
    // fragment matches anywhere and weaves `X…a…Y` fabrications through —
    // eval follow-up #3, weakness 1). Only a TRAILING marker declares a
    // paraphrase (skipped here, bounded by the ratio leg below). The
    // bootstrap shipped 15 marker-less paraphrases and 5 quotes whose
    // "elided" fragments were not actually verbatim — both fixed in the
    // respective data-fix diffs.
    const offenders: string[] = [];
    const check = (label: string, ev: Evidence): void => {
      const offender = verifyQuoteExcerpt(
        ev.quote,
        readSource(ev.source.split('#')[0]),
      );
      if (offender) offenders.push(`${label}: ${ev.source} [${offender}]`);
    };
    for (const [name, term] of termEntries) {
      for (const ev of term.evidence ?? []) check(`term ${name}`, ev);
    }
    for (const inv of invariants.invariants) {
      for (const ev of inv.evidence ?? []) check(inv.id, ev);
    }
    for (const amb of ambiguities.ambiguities) {
      for (const ev of amb.evidence ?? []) check(amb.id, ev);
    }
    for (const item of termQueue.queue) {
      for (const ev of item.evidence ?? []) check(item.id, ev);
    }
    expect(offenders).toEqual([]);
  });

  it('evidence: line anchors bracket their quote — #Lx/#Lx-Ly windows pin to live code, not just to the file', () => {
    // The verbatim leg strips the anchor (`source.split('#')[0]`) and
    // substring-checks the WHOLE file, so a quote that stays verbatim
    // SOMEWHERE in the file keeps a drifted `#L62-L65` green forever —
    // evidence claims a line location nothing verifies (eval follow-up #8,
    // the anchor-drift gap). Contract: for every line-anchored source, the
    // quote's fragments must occur inside the anchored window of the live
    // file; a window that no longer contains the quote (or no longer fits
    // the file) is drift and fails here. Bare-path sources keep the
    // file-level contract above; paraphrases stay ratio-capped.
    let anchored = 0;
    const offenders: string[] = [];
    const check = (label: string, ev: Evidence): void => {
      if (!parseLineAnchor(ev.source)) return; // bare path — file-level legs
      anchored++;
      const file = ev.source.split('#')[0];
      const offender = verifyAnchorWindow(
        ev.quote,
        ev.source,
        readSource(file).split('\n'),
      );
      if (offender) offenders.push(`${label}: ${ev.source} [${offender}]`);
    };
    for (const [name, term] of termEntries) {
      for (const ev of term.evidence ?? []) check(`term ${name}`, ev);
    }
    for (const inv of invariants.invariants) {
      for (const ev of inv.evidence ?? []) check(inv.id, ev);
    }
    for (const amb of ambiguities.ambiguities) {
      for (const ev of amb.evidence ?? []) check(amb.id, ev);
    }
    for (const item of termQueue.queue) {
      for (const ev of item.evidence ?? []) check(item.id, ev);
    }
    // Anti-vacuous floor: 84 anchored entries today (57 single-line +
    // 27 ranged). Mass anchor-stripping (deleting `#L…` fragments to
    // escape the window check) must fall through THIS floor loudly, not
    // silently empty the leg. Raise with the census, never silently.
    expect(anchored).toBeGreaterThanOrEqual(80);
    expect(offenders).toEqual([]);
  });

  it('evidence: paraphrase-marker quotes stay ≤ 30% of all evidence (escape hatch cannot become the norm)', () => {
    // A trailing `…`/`...` exempts a quote from substring verification —
    // without this cap, stamping the marker onto fabricated quotes would
    // pass the verbatim leg for free (eval follow-up #2, weakness 1). The
    // marker stays cheap for genuine paraphrases but not for wholesale
    // evasion. 15/117 = 12.8% today.
    const all: Evidence[] = [];
    for (const [, term] of termEntries) all.push(...(term.evidence ?? []));
    for (const inv of invariants.invariants) all.push(...(inv.evidence ?? []));
    for (const amb of ambiguities.ambiguities) all.push(...(amb.evidence ?? []));
    for (const item of termQueue.queue) all.push(...(item.evidence ?? []));
    expect(all.length).toBeGreaterThanOrEqual(100); // anti-vacuous floor
    const paraphrases = all
      .filter((ev) => isUnverifiedParaphrase(ev.quote))
      .map((ev) => ev.source);
    expect(paraphrases.length / all.length).toBeLessThanOrEqual(0.3);
    // Ratchet under the 0.30 contract ceiling (eval follow-up #3): current
    // 15/117 = 12.8%, so this fires after ~3 marker-stamped quotes land
    // without matching verbatim evidence — drift the cap alone would let
    // hide inside its 2.3x headroom. Raise consciously, never silently.
    expect(paraphrases.length / all.length).toBeLessThanOrEqual(0.15);
  });

  it('claims: every ndjson line parses and invariants hold (Q5 leg)', () => {
    // Floor lives HERE (not only in the metrics leg) so the unmapped ratio at
    // the bottom is well-defined by construction — 0 retained lines would
    // make it NaN (fail-closed, but with an unreadable failure).
    expect(claimLines.length).toBeGreaterThan(0);
    const badTerm: string[] = [];
    const badConfidence: string[] = [];
    const badPriority: string[] = [];
    const priorities = new Set(['P0', 'P1', 'P2', 'P3']);
    let unmapped = 0;
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim; // throws loud on malformed ndjson
      if (claim.term_canonical === '__UNMAPPED__') {
        unmapped += 1;
      } else if (!(claim.term_canonical in ontology.canonical_terms)) {
        badTerm.push(claim.term_canonical);
      }
      if (
        !(
          typeof claim.confidence === 'number' &&
          claim.confidence >= 0 &&
          claim.confidence <= 1
        )
      ) {
        badConfidence.push(String(claim.confidence));
      }
      if (!priorities.has(claim.priority)) badPriority.push(claim.priority);
    }
    expect(badTerm).toEqual([]);
    expect(badConfidence).toEqual([]);
    expect(badPriority).toEqual([]);
    expect(unmapped / claimLines.length).toBeLessThanOrEqual(0.2); // Q5
  });

  it('claims: every claim source path exists on disk (same routing as evidence)', () => {
    // Follow-up #8, leg 2 — the Q5 leg above parses
    // term_canonical/confidence/priority but never resolved `source`, so a
    // typo'd or post-refactor-moved path in claims.ndjson passed silently:
    // the same blind spot the evidence leg closed for the YAML entities.
    const missing: string[] = [];
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim; // shape pinned by the Q5 leg
      const path = claim.source.split('#')[0];
      if (!existsSync(resolveSource(path))) missing.push(claim.source);
    }
    expect(missing).toEqual([]);
  });

  it('claims: record vocabulary is the C-1 schema; Rule-1 cross-field — a hypothesis never carries confidence > 0.4', () => {
    // Follow-up #11, leg 2 — the Q5 leg pins priority / confidence range /
    // term_canonical, but artifact_type / about / claim_type passed unread,
    // and nothing related claim_type to confidence even though Rule 1 of the
    // sync system's 絶対的指針 makes the pair an obligation: 出典なしの事実を
    // 確定として書かない — 推測は hypothesis, confidence ≤ 0.4. This is the
    // value+operator-in-ONE-place class: the two fields live in the same
    // record, so only a cross-field leg can see a hypothesis graded like a
    // sourced fact. First run caught 5 bootstrap claims typed hypothesis at
    // confidence 0.5 — clamped to the 0.4 band ceiling in the same diff.
    const offenders: string[] = [];
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim;
      if (!CLAIM_ARTIFACT_TYPES.has(claim.artifact_type)) {
        offenders.push(
          `${claim.source}: artifact_type "${claim.artifact_type}" outside the C-1 schema`,
        );
      }
      if (!CLAIM_ABOUT.has(claim.about)) {
        offenders.push(
          `${claim.source}: about "${claim.about}" outside the C-1 schema`,
        );
      }
      if (!CLAIM_TYPES.has(claim.claim_type)) {
        offenders.push(
          `${claim.source}: claim_type "${claim.claim_type}" outside fact|hypothesis`,
        );
      }
      if (claim.claim_type === 'hypothesis' && claim.confidence > 0.4) {
        offenders.push(
          `${claim.source}: hypothesis at confidence ${claim.confidence} — Rule-1 band is ≤ 0.4`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('claims: line anchors fit their file — a claim citing #Lx past EOF is location drift', () => {
    // Follow-up #9 pinned evidence QUOTES to their #Lx windows (a quote still
    // verbatim elsewhere in the file no longer keeps a drifted anchor green).
    // claims.ndjson cites the same `path#L7` / `path#L62-L65` shape with NO
    // quote to substring-verify, so #8's path-existence leg is all that
    // guards it — a cited file that shrinks below its window (split, refactor,
    // trim) leaves the claim pointing past EOF, green forever. The bounds
    // half is the whole contract a quote-less citation can carry: the window
    // must EXIST in the live file (same `split('\n')` line convention as the
    // evidence anchor leg).
    let anchored = 0;
    const offenders: string[] = [];
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim; // shape pinned by the Q5 leg
      if (!parseLineAnchor(claim.source)) continue; // bare path — #8's leg
      anchored++;
      const offender = verifyAnchorFits(
        claim.source,
        readSource(claim.source.split('#')[0]).split('\n').length,
      );
      if (offender) offenders.push(`${claim.source} [${offender}]`);
    }
    // Anti-vacuous floor: 42 anchored claims today (of 73 sources). Mass
    // anchor-stripping must fall through this floor loudly, not silently
    // empty the leg. Raise with the census, never silently.
    expect(anchored).toBeGreaterThanOrEqual(40);
    expect(offenders).toEqual([]);
  });

  it('claims: retained lines keep the ledger compact byte form (INV-TEST-009)', () => {
    // Eval follow-up (run 20260827-180028): 101 of the 112 retained entries
    // were written compact (`{"run_id":"…"`) but 11 landed as spaced JSON
    // (`{"run_id": "…"`) — byte-identical to JSON.parse, so every semantic
    // leg above stayed green while the ledger's byte style silently split
    // into two dialects. A line-diffed append-only ledger needs ONE byte
    // form: an appender copying the nearest spaced neighbor would keep
    // widening the minority dialect forever, and ndjson tooling that keys
    // on the line prefix (the same convention `wc -l`/byte censuses lean on)
    // sees two shapes where the schema says one. The pin is the line PREFIX
    // (`{"run_id":"` — run_id is first in every record), not a whole-line
    // regex: values are free prose and may contain any bytes.
    const spaced = claimLines.filter((line) => !line.startsWith('{"run_id":"'));
    expect(spaced).toEqual([]);
  });

  it('state files: run_state/ontology_metrics keep one JSON byte dialect (INV-TEST-010)', () => {
    // Eval follow-up (run 20260827-220857): the two machine-written JSON
    // state files had drifted into OPPOSITE dialects — run_state.json compact
    // single-line (no trailing newline, landed that run), ontology_metrics.json
    // pretty-printed 13 lines. JSON.parse is byte-blind, so every semantic leg
    // above stayed green while the dialects split — the same failure mode
    // INV-TEST-009 closed for claims.ndjson, one file class over. State files
    // are rewritten (not appended) every cycle by a different agent hand, so a
    // dialect split here means every future run's diff noise is dialect
    // roulette, and byte-level review can't tell a value change from a
    // re-format. The pin: each file's bytes must equal its own parsed value
    // re-serialized by JSON.stringify plus one trailing newline (POSIX text
    // hygiene — claims.ndjson ends in \n too). Expected bytes are DERIVED from
    // the parsed content, never hand-pinned, so the leg cannot go stale; it
    // catches pretty-printing, spaced separators, missing/extra trailing
    // newlines, interior newlines, and a BOM in one equality.
    const stateFiles: ReadonlyArray<[string, string]> = [
      ['.concept/run_state.json', runStateRaw],
      ['.concept/ontology_metrics.json', metricsRaw],
    ];
    const offenders = stateFiles
      .filter(([, raw]) => raw !== `${JSON.stringify(JSON.parse(raw))}\n`)
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it('sources: a `#L…`-shaped fragment that fails the anchor grammar is a typo, not a heading', () => {
    // parseLineAnchor returns null for every non-anchor fragment BY DESIGN
    // (bare paths and heading slugs keep the file-level contract), so a
    // typo'd anchor (`#L12a`, `#L12-L`) degrades silently to file-level: the
    // citation keeps claiming a line location nothing resolves, and the #9/#10
    // window legs skip it as if it were a heading. Teeth, wherever a source
    // is cited (evidence entities + claims): a fragment that starts `L`+digit
    // but fails the grammar is an offender. Case-sensitive by design —
    // `#l10n` is the heading-slug shape this contract leaves alone.
    const offenders: string[] = [];
    const check = (label: string, source: string): void => {
      const offender = malformedAnchorFragment(source);
      if (offender) offenders.push(`${label}: ${source} [${offender}]`);
    };
    for (const [name, term] of termEntries) {
      for (const ev of term.evidence ?? []) check(`term ${name}`, ev.source);
    }
    for (const inv of invariants.invariants) {
      for (const ev of inv.evidence ?? []) check(inv.id, ev.source);
    }
    for (const amb of ambiguities.ambiguities) {
      for (const ev of amb.evidence ?? []) check(amb.id, ev.source);
    }
    for (const item of termQueue.queue) {
      for (const ev of item.evidence ?? []) check(item.id, ev.source);
    }
    for (const line of claimLines) {
      check('claim', (JSON.parse(line) as Claim).source);
    }
    expect(offenders).toEqual([]);
  });

  it('budget: terms / layers / draft ratio / queue pending inside ontology_budget limits (Q4, Q6)', () => {
    expect(termNames.length).toBeLessThanOrEqual(budget.limits.total_terms_max);
    expect(layerCounts.core ?? 0).toBeLessThanOrEqual(budget.limits.core_max);
    expect(layerCounts.domain ?? 0).toBeLessThanOrEqual(
      budget.limits.domain_max,
    );
    expect(layerCounts.aux ?? 0).toBeLessThanOrEqual(budget.limits.aux_max);
    expect(draftCount / termNames.length).toBeLessThanOrEqual(
      budget.ratios.draft_ratio_max,
    );
    expect(
      termQueue.queue.filter((q) => q.decision === 'pending').length,
    ).toBeLessThanOrEqual(budget.ratios.queue_pending_max);
  });

  it('budget: B-10 file ceilings — every store under its ontology_budget file_ceilings cap', () => {
    // 10_concept_sync_system §B-10 sets per-store ceilings (invariants 60,
    // ambiguities 50, conflicts 50, mappings 200, term_queue 50, claims
    // 10k lines / 10MB). The Q4/Q6 leg above covers term-count limits only —
    // nothing held the OTHER stores to their caps, so a future増産 run
    // could push invariants past 60 (or mappings past 200) and stay green.
    // The caps live in ontology_budget.yml (repo-internal source of
    // truth), not hardcoded here. Key-set and value teeth both live in the
    // pinned-values leg below (toEqual fails on extra/missing keys too) —
    // #14 removed this leg's own key-set expect, which duplicated that
    // coverage; a deleted or renamed ceiling REDs the pin instead of being
    // silently compared against `undefined` here.
    const fc = budget.file_ceilings;
    const counts: Array<[string, number, number]> = [
      ['invariants', invariants.invariants.length, fc.invariants_max],
      ['ambiguities', ambiguities.ambiguities.length, fc.ambiguities_max],
      ['conflicts', conflicts.conflicts.length, fc.conflicts_max],
      ['mappings', Object.keys(mappings.mappings).length, fc.mappings_max],
      ['term_queue', termQueue.queue.length, fc.term_queue_max],
      // B-10 caps claims at 10k lines OR 10MB — both forms are enforced
      // (tens of KB today, so neither is near binding). The byte form reads
      // the on-disk size: the cap governs the file, not the decoded text.
      ['claims lines', claimLines.length, fc.claims_max_lines],
      ['claims bytes', claimsOnDiskBytes, fc.claims_max_bytes],
    ];
    const offenders = counts
      .filter(([name, count, cap]) => count > cap)
      .map(([name, count, cap]) => `${name}: ${count} > cap ${cap}`);
    expect(offenders).toEqual([]);
  });

  it('budget: claims byte census reads the disk — stat size equals the decoded byte length', () => {
    // The census's byte input is the statSync size (the file is what §B-10
    // caps). This leg trips when the decoded/re-encoded length stops being
    // a faithful proxy for it: invalid UTF-8 decodes to U+FFFD and
    // re-encodes to 3 bytes, so a 1-byte corruption today OVER-counts (the
    // safe direction), but the drift is not bounded by anything and must
    // never pass silently. A BOM stays byte-equal (U+FEFF re-encodes to its
    // own 3 bytes) — it is instead caught by the JSON.parse leg, which
    // rejects a non-object first line.
    expect(claimsOnDiskBytes).toBe(claimsNdjsonBytes);
  });

  it('budget: B-10/§C-8 budget values pinned (cap inflation REDs)', () => {
    // The census leg catches a store OVER its cap, but nothing caught a
    // silently RAISED cap: invariants_max 60 → 600 (or total_terms_max 80 →
    // 800, which disarms the Q4/Q6 leg above) would keep an over-cap store
    // green forever. The upstream authority is 10_concept_sync_system —
    // §B-10's table ("|claims.ndjson|最大 10,000行 or 10MB|", terms 最大 80)
    // and §C-8's ontology_budget.yml example (limits/ratios verbatim) — so
    // the numbers are pinned here; raising one must be a deliberate,
    // diff-visible change to BOTH this pin and ontology_budget.yml.
    // toEqual also fails on extra/missing keys, so this leg is the single
    // authority for key-set AND values (the census leg's duplicate key-set
    // expect was removed in #14).
    expect(budget.limits).toEqual({
      total_terms_max: 80,
      core_max: 20,
      domain_max: 30,
      aux_max: 30,
    });
    expect(budget.ratios).toEqual({
      // YAML `0.30` loads as JS 0.3.
      draft_ratio_max: 0.3,
      queue_pending_max: 30,
    });
    expect(budget.file_ceilings).toEqual({
      invariants_max: 60,
      ambiguities_max: 50,
      conflicts_max: 50,
      mappings_max: 200,
      term_queue_max: 50,
      claims_max_lines: 10000,
      // §B-10's "or 10MB" is unit-ambiguous; read as MiB (10 × 1024 × 1024
      // = 10485760) because the stricter reading fails safe — a decimal-MB
      // intent makes this cap 4.9% tighter than required, never looser. If
      // the spec ever states decimal explicitly, update this pin to 1e7.
      claims_max_bytes: 10 * 1024 * 1024,
    });
    // ttl_runs / merge are deliberately unpinned: no guard leg consumes
    // them, so pinning would freeze values nothing verifies against.
  });

  it('budget: decisions.md stays ≤ 200 lines (Rule 6 cache ceiling)', () => {
    expect(decisionsMdLines).toBeLessThanOrEqual(200);
  });

  it('AUTO cache: applied ambiguities have their decisions.md section; every section links a real ambiguity', () => {
    // decisions.md is the ACTIVE AUTO-decision cache (regenerable, Rule 6).
    // The増産 run added AMB-PROC-001 and its `## AUTO:ConceptSync.Q3-...`
    // section in one diff — but nothing pinned the correspondence, so a
    // future run recording only one side would drift silently. Both
    // directions: (1) every applied auto_decision decision_key has its
    // section; (2) every section's `Linked:` line names an ambiguity whose
    // own decision_key is that section, or carries the explicit なし marker
    // (the bootstrap direct-entry decision is run-level, no ambiguity).
    const md = readSource('.concept/decisions.md');
    const sectionKeys = [...md.matchAll(/^## (AUTO:\S+)$/gm)].map((m) => m[1]);
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length); // no dup sections
    const appliedKeys = ambiguities.ambiguities
      .map((a) => a.auto_decision)
      .filter(
        (d): d is { status: string; decision_key: string } =>
          d?.status === 'applied',
      )
      .map((d) => d.decision_key);
    expect(appliedKeys.length).toBeGreaterThan(0); // anti-vacuous
    const missingSection = appliedKeys.filter((k) => !sectionKeys.includes(k));
    expect(missingSection).toEqual([]);
    const ambById = new Map(ambiguities.ambiguities.map((a) => [a.id, a]));
    const offenders: string[] = [];
    for (const section of md.split(/^## /m).slice(1)) {
      const [keyLine, ...body] = section.split('\n');
      const key = keyLine.trim();
      const linkedLine = body.find((l) => l.startsWith('- Linked:'));
      // Eval follow-up #5: decisions.md's contract (§3 layout / C-10) covers
      // AUTO-decision sections. The duplicate check above is AUTO:-scoped, so
      // demanding Linked from EVERY `##` section was asymmetric — a legit
      // future non-AUTO heading (release notes, cache-regen provenance…)
      // would RED spuriously. Linked is REQUIRED of AUTO: sections; a Linked
      // line a non-AUTO section does carry is still validated below, so a
      // stray AMB- reference cannot hide in a prose section.
      if (linkedLine === undefined) {
        if (key.startsWith('AUTO:')) {
          offenders.push(`${key}: section has no Linked line`);
        }
        continue;
      }
      const linked = linkedLine.slice('- Linked:'.length).trim();
      if (/^AMB-/.test(linked)) {
        const amb = ambById.get(linked);
        if (!amb) {
          offenders.push(`${key}: links unknown ambiguity ${linked}`);
        } else if (amb.auto_decision?.decision_key !== key) {
          offenders.push(
            `${key}: links ${linked} whose decision_key is ${amb.auto_decision?.decision_key ?? '(none)'}`,
          );
        }
      } else if (!linked.includes('なし')) {
        offenders.push(
          `${key}: Linked is neither an AMB- id nor the explicit none marker: ${linked}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('vocabulary: layer/status/strength/term ids use the schema enums, ids unique', () => {
    const layers = new Set(['core', 'domain', 'aux']);
    const statuses = new Set(['stable', 'draft']);
    const strengths = new Set(['hard', 'soft']);
    expect(
      termNames.filter((n) => !layers.has(ontology.canonical_terms[n].layer)),
    ).toEqual([]);
    expect(
      termNames.filter((n) => !statuses.has(ontology.canonical_terms[n].status)),
    ).toEqual([]);
    expect(
      invariants.invariants
        .filter((i) => !strengths.has(i.strength))
        .map((i) => i.id),
    ).toEqual([]);
    // §5.4 gives invariants the same draft|stable status enum as terms, and
    // the 26-entry batch (16 bootstrap + 10増産) is exactly where a duplicate
    // INV- id or a typo'd status would slip through uncounted — the strength
    // check alone never looked at either.
    expect(
      invariants.invariants
        .filter((i) => !statuses.has(i.status))
        .map((i) => i.id),
    ).toEqual([]);
    const invariantIds = invariants.invariants.map((i) => i.id);
    expect(new Set(invariantIds).size).toBe(invariantIds.length); // no duplicate INV- ids
    expect(
      invariantIds.filter((id) => !/^INV-[A-Z]+-\d+$/.test(id)),
    ).toEqual([]); // INV-<CLASS>-<NNN> namespace
    const termIds = termEntries.map(([, t]) => t.id);
    expect(new Set(termIds).size).toBe(termIds.length); // no duplicate TERM- ids
    const queueIds = termQueue.queue.map((q) => q.id);
    expect(new Set(queueIds).size).toBe(queueIds.length);
    // A value outside the C-7 vocabulary counts as neither pending nor merged
    // and silently skews the metrics derivations above — reject it outright.
    expect(
      termQueue.queue
        .filter((q) => !QUEUE_DECISIONS.has(q.decision))
        .map((q) => q.id),
    ).toEqual([]);
  });

  it('charter: north_star filled and ≥1 milestone present (Q7)', () => {
    expect(charter.product_goal.north_star.length).toBeGreaterThan(0);
    expect(charter.milestones.length).toBeGreaterThanOrEqual(1);
    const milestoneStatuses = new Set(['planned', 'active', 'done', 'blocked']);
    for (const ms of charter.milestones) {
      expect(ms.id.length).toBeGreaterThan(0);
      expect(ms.name.length).toBeGreaterThan(0);
      expect(milestoneStatuses.has(ms.status)).toBe(true);
    }
  });

  it('charter: milestone acceptance targets resolve like invariant checks; milestone vocabulary and gates are real', () => {
    // Follow-up #11, leg 1 — charter.yml is Source-of-Truth #1, yet its OWN
    // gates were the least verified surface in .concept/: §5.1 milestone
    // `acceptance` entries and `work_policy.quality_gates` passed unread
    // (the Charter shape did not even carry them), so a typo'd path or a
    // dead gate blessed by the top of the hierarchy drifted silently — the
    // same blind spot the checks-target leg closed for invariants (#4).
    // Resolution goes through the shared checkTargetOffenders resolver, so
    // the contract cannot fork between the two call sites. First run caught
    // a real casualty: MS-001 declared `type: test` on the command-form
    // gate `npm run verify:all` — a gate that selects no tests mislabeled
    // as one; corrected to `type: command` in the same diff.
    const pkg = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
    };
    const scripts = new Set(Object.keys(pkg.scripts));
    const acceptanceTypes = new Set(['test', 'command', 'manual']); // C-11
    const priorities = new Set(['P0', 'P1', 'P2']); // §5.1
    const modes = new Set(['pr', 'commit', 'dry_run']); // §5.1 work_policy
    const offenders: string[] = [];
    const msIds = charter.milestones.map((ms) => ms.id);
    expect(new Set(msIds).size).toBe(msIds.length); // no duplicate MS- ids
    for (const ms of charter.milestones) {
      if (!priorities.has(ms.priority)) {
        offenders.push(`${ms.id}: priority "${ms.priority}" outside P0|P1|P2`);
      }
      const acceptance = ms.acceptance ?? [];
      if (acceptance.length === 0) {
        // A milestone without an acceptance gate is unfalsifiable — same
        // rationale as the invariants `no checks entry` offender.
        offenders.push(`${ms.id}: no acceptance entry`);
      }
      for (const acc of acceptance) {
        if (!acceptanceTypes.has(acc.type)) {
          offenders.push(`${ms.id}: unknown acceptance type "${acc.type}"`);
        }
        if (acc.target.trim() === '') {
          offenders.push(`${ms.id}: empty acceptance target`);
        }
        for (const offender of checkTargetOffenders(
          acc.type,
          acc.target,
          scripts,
        )) {
          offenders.push(`${ms.id} acceptance: ${offender}`);
        }
      }
    }
    expect(modes.has(charter.work_policy.default_mode)).toBe(true);
    const gates = charter.work_policy.quality_gates.must_pass;
    expect(gates.length).toBeGreaterThan(0); // anti-vacuous
    expect(gates.filter((g) => !scripts.has(g))).toEqual([]);
    expect(offenders).toEqual([]);
  });

  it('autopilot: commands are npm-form referencing real scripts; non-npm needs the explicit allowlist', () => {
    const pkg = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
    };
    const scripts = Object.keys(pkg.scripts);
    const missingScripts: string[] = [];
    const nonConforming: string[] = [];
    for (const [key, command] of Object.entries(autopilot.commands)) {
      const match = command.match(/^npm (?:run )?(\S+)$/);
      if (match) {
        if (!scripts.includes(match[1])) missingScripts.push(`${key}: ${command}`);
      } else if (!RAW_COMMAND_ALLOWLIST.includes(command)) {
        // Empty strings and raw binaries alike: a command that is neither
        // `npm [run] <real script>` nor consciously allowlisted is an
        // unvalidated gate — the eval called the old non-empty-only check a
        // dead-quality-gate blind spot (e.g. a typo'd `npx ts-check` passes).
        nonConforming.push(`${key}: ${command || '(empty)'}`);
      }
    }
    expect(missingScripts).toEqual([]); // npm-form → script must exist
    expect(nonConforming).toEqual([]); // anything else → contract violation
  });
});

// ----------------------------------------------------------------------
// concept-quote-contract helper pins (import path — session-239 receipt)
//
// The quote/tombstone legs above consume stripTrailingMarker /
// isUnverifiedParaphrase / verifyQuoteExcerpt / collectTombstoneViolations
// from concept-quote-contract.ts. Before follow-up #3 these were inline
// closures only ever exercised through the live `.concept/` data, so their
// edge cases had no direct pins (eval weakness 2) and the tombstone
// branches were structurally dead while tombstones = 0 (eval weakness 4).
// Pin the helpers' own contracts HERE so a regression in the module fails
// in this file, next to the legs that depend on it — a pin that drifted
// from the guard's logic would be vacuous, hence the shared module.
describe('concept-quote-contract helpers (import path) — contract pin', () => {
  it('stripTrailingMarker: leaves marker-less quotes untouched (incl. whitespace tail)', () => {
    expect(stripTrailingMarker('export class Foo {')).toBe('export class Foo {');
    expect(stripTrailingMarker('plain quote  ')).toBe('plain quote');
  });

  it('stripTrailingMarker: strips one trailing `…` or `...` suffix only', () => {
    expect(stripTrailingMarker('looks like foo…')).toBe('looks like foo');
    expect(stripTrailingMarker('looks like foo...')).toBe('looks like foo');
    expect(stripTrailingMarker('trailing space …')).toBe('trailing space ');
    // 4 dots: only the `...` suffix is a marker — the 4th `.` is content.
    expect(stripTrailingMarker('four dots....')).toBe('four dots.');
  });

  it('isUnverifiedParaphrase: true only for a quote whose sole marker is the trailing suffix', () => {
    expect(isUnverifiedParaphrase('no marker at all')).toBe(false);
    expect(isUnverifiedParaphrase('')).toBe(false);
    expect(isUnverifiedParaphrase('paraphrase…')).toBe(true);
    expect(isUnverifiedParaphrase('paraphrase...')).toBe(true);
    // Sloppy forms still route to the ratio-capped paraphrase bucket…
    expect(isUnverifiedParaphrase('four dots....')).toBe(true);
    expect(isUnverifiedParaphrase('…')).toBe(true); // marker-only body is empty
    // …but any marker surviving in the body means elision, not paraphrase.
    expect(isUnverifiedParaphrase('head…tail')).toBe(false);
    expect(isUnverifiedParaphrase('head...tail')).toBe(false);
    expect(isUnverifiedParaphrase('head…tail...')).toBe(false); // mixed markers
    expect(isUnverifiedParaphrase('head...tail…')).toBe(false);
  });

  it('verifyQuoteExcerpt: verbatim excerpt passes; whitespace flattens; miss fails', () => {
    const source = 'export function renderChart(\n  options: RenderOptions,\n) {';
    expect(verifyQuoteExcerpt('export function renderChart(', source)).toBeNull();
    expect(
      verifyQuoteExcerpt('renderChart( options: RenderOptions, )', source),
    ).toBeNull(); // multi-line flattened both sides
    expect(verifyQuoteExcerpt('export function renderTable(', source)).toBe(
      'not verbatim: export function renderTable(',
    );
  });

  it('verifyQuoteExcerpt: in-order elision passes; reordered or fabricated fragments fail', () => {
    const source = 'alpha anchor … middle noise … omega anchor';
    expect(verifyQuoteExcerpt('alpha anchor…omega anchor', source)).toBeNull();
    // Reorder is reported on the fragment that cannot be placed after the
    // previous one — here `alpha anchor`, which only occurs BEFORE `omega`.
    expect(verifyQuoteExcerpt('omega anchor…alpha anchor', source)).toMatch(
      /^not verbatim: alpha anchor$/,
    );
    expect(
      verifyQuoteExcerpt('alpha anchor…FABRICATED MIDDLE…omega anchor', source),
    ).toMatch(/^not verbatim: FABRICATED MIDDLE$/);
  });

  it('verifyQuoteExcerpt: elided fragments below the 5-char floor fail (X…a…Y weaving)', () => {
    // A 1-char middle matches anywhere between the flanks, so `head…x…tail`
    // would pass order+substring verification while omitting nothing real.
    const source = 'head anchor beta gamma tail anchor';
    expect(verifyQuoteExcerpt('head anchor…a…tail anchor', source)).toMatch(
      /^fragment too short/,
    );
    // Short flank at the end is equally unverifiable — and a lone short
    // fragment after a leading marker cannot skip the floor either.
    expect(verifyQuoteExcerpt('head anchor…x', source)).toMatch(
      /^fragment too short/,
    );
    expect(verifyQuoteExcerpt('…x', source)).toMatch(/^fragment too short/);
  });

  it('verifyQuoteExcerpt: the floor scopes to elided quotes — a plain short quote stays substring-verified', () => {
    // Scope decision: a marker-less quote is a full substring pin however
    // short; the floor exists because elision fragments are the weaving
    // vector, not because short quotes are invalid evidence.
    expect(verifyQuoteExcerpt('beta', 'alpha beta gamma')).toBeNull();
    expect(verifyQuoteExcerpt('delta', 'alpha beta gamma')).toBe(
      'not verbatim: delta',
    );
  });

  it('verifyQuoteExcerpt: trailing-marker paraphrase is exempt (bounded by the ratio leg)', () => {
    const source = 'completely unrelated source text';
    expect(verifyQuoteExcerpt('a loose summary of the source…', source)).toBeNull();
  });

  it('parseLineAnchor: recognizes #L12 / #L12-L15 / #L12-15; normalizes reversed ranges; null otherwise', () => {
    expect(parseLineAnchor('src/a.ts#L12')).toEqual({ start: 12, end: 12 });
    expect(parseLineAnchor('docs/x.md#L12-L15')).toEqual({ start: 12, end: 15 });
    expect(parseLineAnchor('docs/x.md#L12-15')).toEqual({ start: 12, end: 15 });
    // Reversed bounds are a typo, not a different window — same inclusivity.
    expect(parseLineAnchor('docs/x.md#L15-L12')).toEqual({ start: 12, end: 15 });
    // Anything else is not a line anchor and must NOT be treated as an
    // error: bare paths and heading fragments keep the file-level contract.
    expect(parseLineAnchor('src/a.ts')).toBeNull();
    expect(parseLineAnchor('docs/x.md#overview')).toBeNull();
    expect(parseLineAnchor('src/a.ts#L12x')).toBeNull();
  });

  it('verifyAnchorWindow: quote verbatim elsewhere in the file but outside the window FAILS (the file-level blind spot)', () => {
    const lines = ['alpha line', 'beta line', 'gamma line', 'delta line'];
    expect(verifyAnchorWindow('beta line', 'f.ts#L2', lines)).toBeNull();
    // `beta line` IS in the file — the verbatim leg stays green — but L2
    // no longer brackets it. Only this window check can see that drift.
    expect(verifyAnchorWindow('beta line', 'f.ts#L3', lines)).toMatch(
      /^not verbatim: beta line$/,
    );
    expect(verifyAnchorWindow('beta line', 'f.ts#L1-L3', lines)).toBeNull(); // ranged window covers
  });

  it('verifyAnchorWindow: multi-line quotes flatten across the window; anchors past EOF report the range, not a miss', () => {
    const lines = ['alpha', 'beta', 'gamma'];
    expect(verifyAnchorWindow('beta gamma', 'f.ts#L2-L3', lines)).toBeNull();
    expect(verifyAnchorWindow('alpha beta', 'f.ts#L2-L3', lines)).toMatch(
      /^not verbatim: alpha beta$/,
    );
    expect(verifyAnchorWindow('gamma', 'f.ts#L4', lines)).toMatch(
      /^anchor L4-L4 outside file \(3 lines\)$/,
    );
    expect(verifyAnchorWindow('gamma', 'f.ts#L2-L9', lines)).toMatch(
      /^anchor L2-L9 outside file \(3 lines\)$/,
    );
  });

  it('verifyAnchorWindow: bare paths stay null (file-level contract); paraphrases stay exempt (ratio-capped)', () => {
    const lines = ['alpha'];
    expect(verifyAnchorWindow('zzz', 'f.ts', lines)).toBeNull();
    expect(
      verifyAnchorWindow('loose summary of the window…', 'f.ts#L1', lines),
    ).toBeNull();
  });

  it('verifyAnchorFits: bounds-only window check for quote-less citations (claims)', () => {
    // The message mirrors verifyAnchorWindow's out-of-range branch so a
    // claims offender reads the same as an evidence one.
    expect(verifyAnchorFits('f.ts#L3', 3)).toBeNull(); // exact EOF fits
    expect(verifyAnchorFits('f.ts#L2-L3', 3)).toBeNull();
    expect(verifyAnchorFits('f.ts#L4', 3)).toMatch(
      /^anchor L4-L4 outside file \(3 lines\)$/,
    );
    expect(verifyAnchorFits('f.ts#L2-L9', 3)).toMatch(
      /^anchor L2-L9 outside file \(3 lines\)$/,
    );
    // `L0` parses (the grammar is \d+) but 0 is not a 1-based line — the
    // bounds branch is what catches it.
    expect(verifyAnchorFits('f.ts#L0', 3)).toMatch(
      /^anchor L0-L0 outside file \(3 lines\)$/,
    );
    // No anchor → file-level contract (the #8 existence leg governs).
    expect(verifyAnchorFits('f.ts', 3)).toBeNull();
    expect(verifyAnchorFits('f.ts#overview', 3)).toBeNull();
  });

  it('malformedAnchorFragment: `L`+digit prefix that fails the grammar is a typo offender', () => {
    expect(malformedAnchorFragment('f.ts#L12a')).toMatch(
      /^malformed line anchor: #L12a$/,
    );
    expect(malformedAnchorFragment('f.ts#L12-L')).toMatch(
      /^malformed line anchor: #L12-L$/,
    );
    expect(malformedAnchorFragment('f.ts#L12-L15-L20')).not.toBeNull();
    expect(malformedAnchorFragment('f.ts#L12#L15')).not.toBeNull(); // second hash breaks the shape
    // Well-formed anchors, bare paths and heading slugs stay null.
    expect(malformedAnchorFragment('f.ts#L12')).toBeNull();
    expect(malformedAnchorFragment('f.ts#L12-L15')).toBeNull();
    expect(malformedAnchorFragment('f.ts#L12-15')).toBeNull();
    expect(malformedAnchorFragment('f.ts')).toBeNull();
    expect(malformedAnchorFragment('docs/x.md#overview')).toBeNull();
    // Case-sensitive by design: `#l10n` is the heading-slug convention.
    expect(malformedAnchorFragment('docs/i18n.md#l10n')).toBeNull();
  });

  it('collectTombstoneViolations: empty list and clean tombstones yield no violations', () => {
    expect(collectTombstoneViolations([], {}, new Set())).toEqual([]);
    expect(
      collectTombstoneViolations(
        [{ term: 'DeletedConcept', former_id: 'TERM-DELETED-001' }],
        { SurvivingConcept: { id: 'TERM-SURVIVING-001' } },
        new Set(['TERM-SURVIVING-001']),
      ),
    ).toEqual([]);
  });

  it('collectTombstoneViolations: malformed / still-canonical / id-reused each report their branch', () => {
    const canonical = { LiveConcept: { id: 'TERM-LIVE-001' } };
    const liveIds = new Set(['TERM-LIVE-001']);
    const violations = collectTombstoneViolations(
      [
        { term: '', former_id: 'TERM-X-001' }, // blank term
        { term: 'NoPrefix', former_id: 'X-002' }, // former_id lacks TERM-
        { term: 'LiveConcept', former_id: 'TERM-GONE-003' }, // resurrected
        { term: 'Recycled', former_id: 'TERM-LIVE-001' }, // id reused
      ],
      canonical,
      liveIds,
    );
    expect(violations.length).toBe(4);
    expect(violations[0]).toMatch(/^malformed: /);
    expect(violations[1]).toMatch(/^malformed: /);
    expect(violations[2]).toBe('still-canonical: LiveConcept');
    expect(violations[3]).toBe('id-reused-by-live-term: TERM-LIVE-001');
  });
});

// ----------------------------------------------------------------------
// checks-target helper pins (local closures — session-239 lesson, #6)
//
// NPM_TEST_FORM / splitPatternArgs / evaluateNpmTestPatterns /
// firstResolvablePathToken run against the live invariants.yml data (one
// `npm test -- "guards"` entry, four manual entries) — never against a
// shape they reject, because the live data is clean. Eval #6: pin the
// helpers' own contracts so a future regex edit cannot silently reopen the
// hatches #5/#6 closed while the live data stays green. The jest-behavior
// expectations cite the installed jest 30.4.2: @jest/pattern
// TestPathPatternsExecutor (per-token union, 'i' flag, `./`→`^` anchor)
// and jest-config buildTestPathPatterns (invalid → "Running all tests
// instead", verified exit 0; no-match → exit 1 "No tests found").
describe('checks-target helpers (local) — contract pin', () => {
  it('NPM_TEST_FORM: bare and `-- patterns` forms parse; the #5 hatches stay closed', () => {
    const bare = 'npm test'.match(NPM_TEST_FORM);
    expect(bare?.[0]).toBe('npm test');
    expect(bare?.[1]).toBeUndefined();
    expect('npm test -- "guards"'.match(NPM_TEST_FORM)?.[1]).toBe('"guards"');
    // Multi-token tails are VALID input (jest ORs the tokens) — the
    // evaluator judges them; the form does not reject them (eval #5's
    // weakness 3: they must not read as "selects no test file" offenders).
    expect('npm test -- zzz-absent guards'.match(NPM_TEST_FORM)).not.toBeNull();
    expect('npm test-foo'.match(NPM_TEST_FORM)).toBeNull(); // not a command
    expect('npm test --guards'.match(NPM_TEST_FORM)).toBeNull(); // `--` must be its own token
    expect('npm test run'.match(NPM_TEST_FORM)).toBeNull(); // stray tail after bare form
    expect('npm run test'.match(NPM_TEST_FORM)).toBeNull(); // command-branch form
  });

  it('splitPatternArgs: quoted spans group, bare runs split, order preserved', () => {
    expect(splitPatternArgs('"a b" c')).toEqual(['a b', 'c']);
    expect(splitPatternArgs("'x y' z")).toEqual(['x y', 'z']);
    expect(splitPatternArgs('guards')).toEqual(['guards']);
    expect(splitPatternArgs('   ')).toEqual([]);
  });

  it('evaluateNpmTestPatterns: case-insensitive substring-regex union across tokens, `./` anchors at root', () => {
    expect(evaluateNpmTestPatterns('"guards"')).toEqual({ ok: true });
    expect(evaluateNpmTestPatterns('EXPORT')).toEqual({ ok: true }); // jest compiles with the 'i' flag
    expect(evaluateNpmTestPatterns('zzz-absent guards')).toEqual({ ok: true }); // per-token union
    expect(evaluateNpmTestPatterns('./tests/guards')).toEqual({ ok: true }); // `./` ≙ `^` root anchor
    expect(evaluateNpmTestPatterns('./no-such-prefix')).toEqual({
      ok: false,
      reason: 'selects-nothing',
    });
    expect(evaluateNpmTestPatterns('zzz-absent-entirely')).toEqual({
      ok: false,
      reason: 'selects-nothing',
    });
  });

  it('evaluateNpmTestPatterns: an invalid regex is an offender even when another token matches', () => {
    // jest does not error — it prints "Running all tests instead." and
    // widens to the full suite (verified), so #5's substring fallback read
    // a silently-widened gate as green. Report the raw offending token.
    expect(evaluateNpmTestPatterns('"([unclosed"')).toEqual({
      ok: false,
      reason: 'invalid-regex',
      pattern: '([unclosed',
    });
    expect(evaluateNpmTestPatterns('guards "+unclosed"')).toEqual({
      ok: false,
      reason: 'invalid-regex',
      pattern: '+unclosed',
    });
  });

  it('firstResolvablePathToken: first slash/extension token that exists on disk; absent-only prose fails', () => {
    expect(firstResolvablePathToken('ls src/ のディレクトリ構成レビュー')).toBe('src');
    expect(firstResolvablePathToken('verify package.json scripts')).toBe('package.json');
    // INV-ARCH-003 deliberately names absent dirs — `src/` ahead of them is
    // the resolvable anchor that satisfies the floor (all-tokens-must-exist
    // is consciously NOT the contract).
    expect(firstResolvablePathToken('ls src/（types/config/utils/lib 不在確認）')).toBe('src');
    expect(firstResolvablePathToken('review the architecture by intuition')).toBeNull();
    expect(firstResolvablePathToken('types/config/utils/lib は存在しない')).toBeNull();
    expect(firstResolvablePathToken('/')).toBeNull(); // bare slash trims to empty
  });

  it('checkTargetOffenders: per-branch verdicts for BOTH call sites (invariants checks + charter acceptance)', () => {
    // Follow-up #11: the resolver is shared by two legs now, so a regression
    // in any branch fails BOTH surfaces at once — pin each branch's verdict
    // shape here, next to the sub-helpers it composes.
    const scripts = new Set(['test', 'verify:all']);
    // test branch, npm form
    expect(checkTargetOffenders('test', 'npm test -- "guards"', scripts)).toEqual(
      [],
    );
    // The charter MS-001 pre-fix shape: a command-form gate mislabeled as a
    // test is malformed under the test branch, not merely weak.
    expect(checkTargetOffenders('test', 'npm run verify:all', scripts)).toEqual([
      'malformed npm test form: npm run verify:all',
    ]);
    // test branch, disk form
    expect(checkTargetOffenders('test', 'package.json', scripts)).toEqual([]);
    expect(checkTargetOffenders('test', 'no-such-file.ts', scripts)).toEqual([
      'test target not on disk: no-such-file.ts',
    ]);
    // command branch
    expect(checkTargetOffenders('command', 'npm run verify:all', scripts)).toEqual(
      [],
    );
    expect(checkTargetOffenders('command', 'npm run nope', scripts)).toEqual([
      'command is not a real script: npm run nope',
    ]);
    // manual branch
    expect(checkTargetOffenders('manual', 'ls src/ のレビュー', scripts)).toEqual(
      [],
    );
    expect(checkTargetOffenders('manual', 'review by intuition', scripts)).toEqual(
      ['manual target has no resolvable path anchor: review by intuition'],
    );
    // Types outside the three branches are the CALLER's vocabulary leg —
    // the resolver itself stays silent rather than guessing a branch.
    expect(checkTargetOffenders('rubber', 'anything', scripts)).toEqual([]);
  });
});

// ----------------------------------------------------------------------
// code-symbol descriptor classifier (local closure — session-239 lesson, #8)
//
// codeDescriptorOffenders runs against the live mappings.yml data (82
// entries), which today is clean — so the classifier's branches are only
// exercised by shapes the live data does not contain. Pin them HERE so a
// future edit cannot silently reopen the classification (e.g. dropping the
// bare-identifier arm, or letting prose into the verified bucket) while
// the live data stays green.
describe('code-symbol descriptor classifier (local) — contract pin', () => {
  const text =
    'export class TreeStrategy implements LayoutStrategy {\n  run(): void {}\n}\nexport function msToFrame(): number { return 0; }\nexport function frameToMs(): number { return 0; }\n';

  it('code-shaped descriptors (keyword form or bare identifier) are verified literals', () => {
    expect(codeDescriptorOffenders('class TreeStrategy', text)).toEqual([]);
    expect(codeDescriptorOffenders('TreeStrategy', text)).toEqual([]);
    expect(codeDescriptorOffenders('function msToFrame', text)).toEqual([]);
    // Generic type args ride along with the keyword form (LLMCache<T>).
    expect(
      codeDescriptorOffenders(
        'class LLMCache<T>',
        'export class LLMCache<T> extends Base {}',
      ),
    ).toEqual([]);
    expect(codeDescriptorOffenders('class TreeStrategyX', text)).toEqual([
      '"class TreeStrategyX" not found',
    ]);
    expect(codeDescriptorOffenders('RenamedAway', text)).toEqual([
      '"RenamedAway" not found',
    ]);
  });

  it('slash compounds verify every member token, empty members included', () => {
    expect(codeDescriptorOffenders('msToFrame/frameToMs', text)).toEqual([]);
    expect(codeDescriptorOffenders('TreeStrategy/msToFrame', text)).toEqual(
      [],
    );
    expect(codeDescriptorOffenders('msToFrame/frameToMsX', text)).toEqual([
      'member "frameToMsX" of "msToFrame/frameToMsX" not found',
    ]);
    // Split order is preserved so the failure names every bad member.
    expect(codeDescriptorOffenders('zz//yy', text)).toEqual([
      'member "zz" of "zz//yy" not found',
      'empty member in "zz//yy"',
      'member "yy" of "zz//yy" not found',
    ]);
  });

  it('prose descriptors stay path-existence-only; directory anchors reject verifiable shapes', () => {
    // Prose has no machine truth to pin against — the documented weak
    // branch (same precedent as manual checks).
    expect(codeDescriptorOffenders('Express server', text)).toEqual([]);
    expect(codeDescriptorOffenders('spine validator', null)).toEqual([]);
    // A null fileText (directory anchor) cannot ground a compound or a
    // code-shaped descriptor, and that is an offender, not a free pass.
    expect(codeDescriptorOffenders('msToFrame/frameToMs', null)).toEqual([
      'member "msToFrame" of "msToFrame/frameToMs" not found',
      'member "frameToMs" of "msToFrame/frameToMs" not found',
    ]);
    expect(codeDescriptorOffenders('class TreeStrategy', null)).toEqual([
      '"class TreeStrategy" not found',
    ]);
  });

  it('GITIGNORE_LITERAL_PATHS derives from literal .gitignore lines only', () => {
    // The live dependency: the spine manifest is gitignored, so the mapping
    // leg's existsSync contract must keep honouring it (removing the
    // .gitignore line without regenerating the artifact REDs the live leg).
    expect(GITIGNORE_LITERAL_PATHS.has('specs/_doc_spine.yml')).toBe(true);
    // Glob lines are NOT interpreted (half-parsed gitignore semantics would
    // silently over-allow) — the derivation must keep skipping them.
    expect(GITIGNORE_LITERAL_PATHS.has('*.env')).toBe(false);
    expect(GITIGNORE_LITERAL_PATHS.has('*.pyc')).toBe(false);
    // Comments never enter the set.
    expect([...GITIGNORE_LITERAL_PATHS].some((p) => p.startsWith('#'))).toBe(
      false,
    );
  });
});

// ----------------------------------------------------------------------
// jest-pattern conformance (real module) — eval follow-up #7
//
// The mirror above hardcodes jest 30 selection semantics with no tie to the
// installed package, so a jest upgrade could change @jest/pattern's
// behavior while every mirror leg stayed green against semantics that no
// longer exist. Two closures (eval suggestions 1+2, js-yaml createRequire
// precedent for the load):
//   - version pin: the installed @jest/pattern must be the exact version
//     the mirror was verified against — an upgrade REDs here until the
//     mirror legs are re-verified and the pin moved consciously;
//   - delegation cross-check: for a battery of tails, the mirror's verdict
//     must equal the REAL TestPathPatternsExecutor fed the same split
//     tokens over the live test-file universe, and the mirror's
//     invalid-regex classification must equal the real isValid() — mirror
//     drift now REDs at the very upgrade that changes semantics, not
//     whenever someone happens to re-audit the prose.
//
// Fail-loud prerequisite for the conformance legs below.
//
// Prerequisite semantics — a missing package is an environment defect, not
// version drift: observed 2026-08-28, a worktree hardlink-copied
// mid-install had node_modules/@jest entirely absent (parent repo intact)
// and the raw ENOENT read like a main breakage. Each message fragment
// routes that reader — the path names WHAT is missing, "incomplete
// node_modules" the defect, "not a version drift" the non-cause, cp -al
// the reinstall route npm ci alone does not fix.
//
// Pin design — a named helper (session-239: a check only exercised through
// live data has no contract) so the diagnostic leg can drive BOTH branches
// through the real fs: the probe dir cannot exist on any checkout (no fs
// mock — jest.mock of builtins is a no-op under this ESM setup), the real
// @jest/pattern dir the healthy branch. One JEST_PACKAGE_PREFIX keeps
// probe and package on the same path form.
const JEST_PACKAGE_PREFIX = 'node_modules/@jest/';
const JEST_PATTERN_DIR = `${JEST_PACKAGE_PREFIX}pattern`;
const JEST_PROBE_DIR = `${JEST_PACKAGE_PREFIX}__missing_probe__`;

function requireInstalledPackage(packageDir: string): void {
  if (!existsSync(resolveSource(join(packageDir, 'package.json')))) {
    throw new Error(
      `${packageDir} is not installed — incomplete node_modules ` +
        '(worktree hardlink-copy mid-install / partial npm ci), not a version drift. ' +
        'Reinstall (npm ci, or re-run the worktree copy: cp -al the parent ' +
        "checkout's node_modules) before judging this leg.",
    );
  }
}

describe('jest-pattern conformance (real @jest/pattern module) — eval follow-up #7', () => {
  it('prerequisite: installed @jest/pattern is exactly the version the mirror was verified against', () => {
    // Fail-loud guard: see requireInstalledPackage above for why a missing
    // package REDs with a named cause instead of a raw ENOENT.
    requireInstalledPackage(JEST_PATTERN_DIR);
    const pkg = JSON.parse(
      readSource(`${JEST_PATTERN_DIR}/package.json`),
    ) as { name: string; version: string };
    // RED here means jest was upgraded: re-verify the mirror legs in the
    // checks-target describe (per-token union, 'i' flag, `./`→`^` anchor,
    // invalid handling) against the NEW behavior, then move this pin as a
    // conscious act. A silent pass-through is exactly the drift this leg
    // exists to make impossible.
    expect(`${pkg.name}@${pkg.version}`).toBe('@jest/pattern@30.4.0');
  });

  it('diagnostic: the missing-package branch names the environment cause, never version drift', () => {
    // Permanent pin; what each fragment MEANS lives in the 'Prerequisite
    // semantics' paragraph above (single source). Leg-specific: the form
    // split — the path expectation DERIVES from JEST_PROBE_DIR (the constant
    // the helper consumed) and so cannot drift from the package the
    // prerequisite checks; the prose fragments stay regex — nothing derives
    // them.
    expect(() => requireInstalledPackage(JEST_PROBE_DIR)).toThrow(
      `${JEST_PROBE_DIR} is not installed`,
    );
    expect(() => requireInstalledPackage(JEST_PROBE_DIR)).toThrow(
      /incomplete node_modules/,
    );
    expect(() => requireInstalledPackage(JEST_PROBE_DIR)).toThrow(
      /not a version drift/,
    );
    expect(() => requireInstalledPackage(JEST_PROBE_DIR)).toThrow(/cp -al/);
    // Healthy branch: the exact package the prerequisite leg checks.
    expect(() => requireInstalledPackage(JEST_PATTERN_DIR)).not.toThrow();
  });

  it('mirror selection verdicts equal the real executor over the live test-file universe', () => {
    // Each case asserts BOTH engines produce the documented verdict, so the
    // leg REDs on a mirror edit AND on a real-module behavior change — the
    // two can no longer drift apart silently.
    const cases: { tail: string; expectMatch: boolean; why: string }[] = [
      { tail: '"guards"', expectMatch: true, why: 'plain quoted substring' },
      { tail: 'EXPORT', expectMatch: true, why: "'i' flag on both sides" },
      { tail: 'zzz-absent guards', expectMatch: true, why: 'per-token OR union' },
      { tail: './tests/guards', expectMatch: true, why: '`./` ≙ `^` root anchor' },
      { tail: './no-such-prefix', expectMatch: false, why: 'anchored prefix selects nothing' },
      { tail: 'zzz-absent-entirely', expectMatch: false, why: 'no token matches' },
    ];
    for (const { tail, expectMatch } of cases) {
      // Embed the tail so a failure names the offending case instead of
      // diffing two bare booleans.
      expect([tail, evaluateNpmTestPatterns(tail).ok]).toEqual([
        tail,
        expectMatch,
      ]); // mirror
      const executor = new jestPattern.TestPathPatterns(
        splitPatternArgs(tail),
      ).toExecutor({ rootDir: REPO_ROOT });
      const realMatch = testFilePaths.some((p) =>
        executor.isMatch(join(REPO_ROOT, p)),
      );
      expect([tail, realMatch]).toEqual([tail, expectMatch]); // real module
    }
  });

  it('mirror invalid-regex classification equals the real isValid()', () => {
    // The real engine classifies validity via isValid() (toRegex throws →
    // false); jest-config's full-suite downgrade of an invalid pattern is
    // the RUNNER's behavior (verified empirically in #6), so it stays a
    // documented mirror rationale rather than a delegable fact.
    for (const pattern of ['([unclosed', '+unclosed', '*star']) {
      expect(evaluateNpmTestPatterns(pattern)).toEqual({
        ok: false,
        reason: 'invalid-regex',
        pattern,
      });
      expect(new jestPattern.TestPathPatterns([pattern]).isValid()).toBe(false);
    }
    // Valid-but-unmatched or metacharacter-carrying patterns are selection
    // questions, not validity questions — the classifier must not trip.
    // (The quoted tail matters: unquoted, the space inside `[- ]` splits the
    // token shell-style and `concept[-` alone is genuinely invalid — the
    // first run of this leg RED'd on exactly that, the mirror behaving
    // correctly and the case prose being wrong.)
    for (const pattern of ['zzz-absent', 'a|b', 'concept[- ]sync']) {
      expect(new jestPattern.TestPathPatterns([pattern]).isValid()).toBe(true);
    }
    expect(evaluateNpmTestPatterns('"concept[- ]sync"').ok).toBe(true);
  });

  // One grammar, two readers: this leg's `.test()` checks the form, the
  // binding census below reads the same capture groups, so the form contract
  // and the pointer contract cannot drift into two definitions.
  const CI_RUN_FORM =
    /^ci-run:https:\/\/github\.com\/nobu007\/speech-to-visuals\/actions\/runs\/(\d+) \(PR #(\d+) checks 全 SUCCESS/;

  it('claims: ci-run preconditions stay machine-readable — scheme, run id, and PR binding are one grammar (2-phase closure evidence)', () => {
    // Test-stage follow-up (run 20260906-174248-544001): the 2-phase closure
    // 定型 (established by baseline iter3, PR #114) records a merged PR's CI
    // run URL in the claim's `preconditions` so the evidence is re-verifiable
    // without parsing prose — applied to the PR #117 reland claim and then
    // the PR #119 core-split reland claim (commit 8838e3dd, this run's
    // implement stage). That append had no pinned contract: nothing REDs if a
    // future appender drops the `ci-run:` scheme, links the URL bare, or
    // points at another repo — every semantic leg above stays green because
    // JSON.parse is shape-blind to string content. The grammar pins what
    // makes the entry machine-readable: `ci-run:` scheme + this repo's
    // actions/runs path + numeric run id + the `(PR #N checks 全 SUCCESS`
    // binding parenthetical. The trigger is any precondition CONTAINING
    // `actions/runs` OR self-prefixed `ci-run:` — an actions URL in any form
    // (prefixed, bare, markdown-linked) must be full-form, and the prefix
    // alone is a promise: a `ci-run:` entry with no URL behind it REDs too
    // (pre-fix it rode the census unchecked). Prose-only conditions (no URL,
    // no prefix) stay free-form by design. The closure's phase sequencing
    // (claim first lands with `preconditions:[]`; the URL is appended after
    // checks green) is why the census pins the entries that HAVE a URL
    // instead of demanding one from every recovery-tagged claim: dropping an
    // already-recorded URL is evidence loss (census REDs), and appending a
    // new one REDs until the pin is consciously bumped. RED-verified by
    // mutation: stripping the `ci-run:` prefix trips the grammar leg;
    // reverting 8838e3dd's preconditions back to `[]` trips the census.
    const ciRunClaimRunIds: string[] = [];
    const malformed: string[] = [];
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim & {
        run_id: string;
        preconditions?: string[];
      };
      const preconditions = claim.preconditions ?? [];
      if (preconditions.some((entry) => entry.startsWith('ci-run:'))) {
        ciRunClaimRunIds.push(claim.run_id);
      }
      for (const entry of preconditions) {
        if (!entry.includes('actions/runs') && !entry.startsWith('ci-run:'))
          continue;
        if (!CI_RUN_FORM.test(entry)) {
          malformed.push(`${claim.source}: ${entry.slice(0, 60)}…`);
        }
      }
    }
    expect(malformed).toEqual([]);
    expect(ciRunClaimRunIds).toEqual([
      '2026-09-07T02:00:00Z', // PR #114 — baseline iter3 (定型の初出)
      '2026-09-07T03:00:00Z', // PR #117 — phase-300 reland
      '2026-09-07T04:00:00Z', // PR #119 — core-split boundary reland (8838e3dd)
      '2026-09-07T06:00:00Z', // PR #123 — TASK-0322 post-merge baseline
      '2026-09-07T07:00:00Z', // PR #124 — ci-run binding leg (test stage)
      '2026-09-07T08:00:00Z', // PR #126 — grammar prefix axis + dual-bump 再実測 (iter2)
    ]);
  });

  it('claims: ci-run census binds each run_id to its exact actions run and PR — a rewritten URL REDs, not just a malformed one', () => {
    // Test-stage follow-up (run 20260906-193657-756267, implement b304863b =
    // PR #123's 3→4 census bump): the grammar leg above pins the FORM and the
    // run_id census pins WHICH claims carry a URL, but neither pins the
    // pointer itself — swapping any recorded URL for a different
    // well-formed actions run id keeps both green while the machine-readable
    // evidence silently points elsewhere. The 2-phase closure's audit value
    // IS the pointer, so the census grows a binding axis: run_id →
    // (actions run id, PR number), exact-pinned beside the run_id array it
    // completes. A future URL append bumps BOTH pins in one conscious edit
    // (adjacent legs, same file) — bumping one without the other REDs the
    // stale leg. RED-verified by mutation: editing the run digits inside a
    // claims.ndjson precondition (…34054608558 → …34054608559) trips ONLY
    // this leg, with the grammar and census legs green.
    const bindings: Array<[string, string, string]> = [];
    for (const line of claimLines) {
      const claim = JSON.parse(line) as Claim & {
        run_id: string;
        preconditions?: string[];
      };
      for (const entry of claim.preconditions ?? []) {
        const matched = CI_RUN_FORM.exec(entry);
        if (matched) bindings.push([claim.run_id, matched[1], matched[2]]);
      }
    }
    expect(bindings).toEqual([
      ['2026-09-07T02:00:00Z', '34044355255', '114'], // PR #114 — baseline iter3 (定型の初出)
      ['2026-09-07T03:00:00Z', '34047886832', '117'], // PR #117 — phase-300 reland
      ['2026-09-07T04:00:00Z', '34048776764', '119'], // PR #119 — core-split boundary reland
      ['2026-09-07T06:00:00Z', '34054608558', '123'], // PR #123 — TASK-0322 post-merge baseline
      ['2026-09-07T07:00:00Z', '34056353082', '124'], // PR #124 — binding leg 新設 (dual bump 初回)
      ['2026-09-07T08:00:00Z', '34057620069', '126'], // PR #126 — grammar prefix axis (dual bump 2 回目)
    ]);
  });
});
