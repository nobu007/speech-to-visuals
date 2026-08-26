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
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { REPO_ROOT, resolveSource, readSource } from '@tests/guards/freeze-guard';
import {
  collectTombstoneViolations,
  isUnverifiedParaphrase,
  stripTrailingMarker,
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
}
interface Charter {
  product_goal: { north_star: string };
  milestones: { id: string; name: string; status: string }[];
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
// conflicts is allowed to be an empty array — parse-only leg.
loadYaml<{ conflicts: unknown[] }>('.concept/conflicts.yml');
const tombstones = loadYaml<{ tombstones: TombstoneEntry[] }>(
  '.concept/tombstones.yml',
);

const metrics = JSON.parse(
  readSource('.concept/ontology_metrics.json'),
) as Metrics;
const runState = JSON.parse(
  readSource('.concept/run_state.json'),
) as { last_run_id: string; claims_retained_lines: number };

const termNames = Object.keys(ontology.canonical_terms);
const termEntries = Object.entries(ontology.canonical_terms);

const layerCounts: Record<string, number> = {};
let draftCount = 0;
for (const term of Object.values(ontology.canonical_terms)) {
  layerCounts[term.layer] = (layerCounts[term.layer] ?? 0) + 1;
  if (term.status === 'draft') draftCount += 1;
}

const claimLines = readSource('.concept/claims.ndjson')
  .split('\n')
  .filter((line) => line.trim() !== '');
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
        if (check.type === 'test') {
          if (/^npm\b/.test(check.target)) {
            const m = check.target.match(NPM_TEST_FORM);
            if (m === null) {
              offenders.push(`${inv.id}: malformed npm test form: ${check.target}`);
            } else if (m[1] !== undefined) {
              const selection = evaluateNpmTestPatterns(m[1]);
              if (!selection.ok) {
                offenders.push(
                  selection.reason === 'invalid-regex'
                    ? `${inv.id}: npm test pattern is an invalid regex — jest downgrades it to the FULL suite ("Running all tests instead"), the gate stops meaning what the invariant cites: ${selection.pattern}`
                    : `${inv.id}: npm test pattern selects no test file (jest exits 1 "No tests found"): ${check.target}`,
                );
              }
            }
          } else if (!existsSync(resolveSource(check.target))) {
            offenders.push(`${inv.id}: test target not on disk: ${check.target}`);
          }
        } else if (check.type === 'command') {
          const match = check.target.match(/^npm (?:run )?(\S+)$/);
          if (!match || !scripts.has(match[1])) {
            offenders.push(`${inv.id}: command is not a real script: ${check.target}`);
          }
        } else if (check.type === 'manual') {
          if (firstResolvablePathToken(check.target) === null) {
            offenders.push(
              `${inv.id}: manual target has no resolvable path anchor: ${check.target}`,
            );
          }
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
describe('jest-pattern conformance (real @jest/pattern module) — eval follow-up #7', () => {
  it('prerequisite: installed @jest/pattern is exactly the version the mirror was verified against', () => {
    const pkg = JSON.parse(
      readSource('node_modules/@jest/pattern/package.json'),
    ) as { name: string; version: string };
    // RED here means jest was upgraded: re-verify the mirror legs in the
    // checks-target describe (per-token union, 'i' flag, `./`→`^` anchor,
    // invalid handling) against the NEW behavior, then move this pin as a
    // conscious act. A silent pass-through is exactly the drift this leg
    // exists to make impossible.
    expect(`${pkg.name}@${pkg.version}`).toBe('@jest/pattern@30.4.0');
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
});
