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
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { REPO_ROOT, resolveSource, readSource } from '@tests/guards/freeze-guard';

const nodeRequire = createRequire(import.meta.url);
const yamlLoad = (nodeRequire('js-yaml') as { load: (input: string) => unknown })
  .load;

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
  strength: string;
  related_terms?: string[];
  evidence?: Evidence[];
}
interface AmbiguityEntry {
  id: string;
  term: string;
  evidence?: Evidence[];
}
interface QueueItem {
  id: string;
  decision: string;
  auto_merge_candidates?: { term: string; similarity?: number }[];
  evidence?: Evidence[];
}
interface TombstoneEntry {
  term: string;
  former_id: string;
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

// A paraphrase marker is a TRAILING `…`/`...` suffix and nothing else. A
// marker elsewhere in the quote is an elision inside a verbatim excerpt and
// does NOT exempt the quote from substring verification.
function stripTrailingMarker(quote: string): string {
  const trimmed = quote.replace(/\s+$/, '');
  if (trimmed.endsWith('…')) return trimmed.slice(0, -1);
  if (trimmed.endsWith('...')) return trimmed.slice(0, -3);
  return trimmed;
}

// True when the quote is exempt from substring verification: it carried a
// trailing marker and its body has no (mid-quote) elision markers left.
// These are the quotes the paraphrase-ratio cap below bounds.
function isUnverifiedParaphrase(quote: string): boolean {
  if (!quote) return false;
  const trimmed = quote.replace(/\s+$/, '');
  const body = stripTrailingMarker(trimmed);
  return body.length !== trimmed.length && !/…|\.\.\./.test(body);
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
    // surviving term. This consumes the TombstoneEntry fields the previous
    // commit typed but never read. Empty today — structural until the first
    // real deletion lands, at which point this leg has data to bite on.
    const liveIds = new Set(termEntries.map(([, t]) => t.id));
    const bad: string[] = [];
    for (const tomb of tombstones.tombstones) {
      if (!tomb.term || !/^TERM-/.test(tomb.former_id)) {
        bad.push(`malformed: ${JSON.stringify(tomb)}`);
      }
      if (tomb.term in ontology.canonical_terms) {
        bad.push(`still-canonical: ${tomb.term}`);
      }
      if (liveIds.has(tomb.former_id)) {
        bad.push(`id-reused-by-live-term: ${tomb.former_id}`);
      }
    }
    expect(bad).toEqual([]);
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
    expect(invariants.invariants.length).toBeGreaterThanOrEqual(10);
    expect(dangling).toEqual([]);
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
    // elision fails). Only a TRAILING marker declares a paraphrase (skipped
    // here, bounded by the ratio leg below). The bootstrap shipped 15
    // marker-less paraphrases and 5 quotes whose "elided" fragments were
    // not actually verbatim — both fixed in the respective data-fix diffs.
    const norm = (text: string): string => text.replace(/\s+/g, ' ');
    const offenders: string[] = [];
    const check = (label: string, ev: Evidence): void => {
      if (!ev.quote || isUnverifiedParaphrase(ev.quote)) {
        return; // empty handled by existence/Q8 legs; trailing … = paraphrase
      }
      const content = norm(readSource(ev.source.split('#')[0]));
      const body = stripTrailingMarker(ev.quote);
      let pos = 0;
      for (const fragment of body.split(/…|\.\.\./)) {
        const needle = norm(fragment.trim());
        if (!needle) continue; // marker at start/end of an elision
        const at = content.indexOf(needle, pos);
        if (at === -1) {
          offenders.push(`${label}: ${ev.source} [not verbatim: ${needle.slice(0, 50)}]`);
          return;
        }
        pos = at + needle.length; // next fragment must occur AFTER this one
      }
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
