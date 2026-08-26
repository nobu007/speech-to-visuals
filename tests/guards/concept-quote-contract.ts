/**
 * Concept-quote contract helpers — the pure verification logic the
 * concept-sync consistency guard (tests/guards/concept-sync-consistency.test.ts)
 * runs over `.concept/` evidence quotes and tombstones.
 *
 * Extracted from the guard's inline closures by its test-stage follow-up #3
 * (run 20260826-114716 eval): the helpers were only ever exercised through
 * the live `.concept/` data, so their edge cases had no direct unit pins
 * (session-239 lesson: pin the imported test helper itself) and the
 * tombstone backfill leg was structural-only with 0 real tombstones.
 * Exported here so the guard and its contract pins share ONE definition —
 * a pin that drifts from the guard's logic is a vacuous pin.
 *
 * Two contracts live here:
 *
 *   Quote verification — a quote is (a) a verbatim excerpt
 *   (whitespace-normalized substring, single-line or flattened multi-line),
 *   (b) an elided excerpt where every `…`/`...` INSIDE the quote stands for
 *   omitted text: each non-empty flanking fragment must be a substring of
 *   the source AND occur in source order, or (c) a paraphrase, declared by
 *   a TRAILING `…`/`...` suffix alone, which is exempt from verification
 *   and bounded by the guard's paraphrase-ratio cap instead.
 *
 *   Tombstone backfill — a tombstone is the receipt for a GC deletion, so
 *   its term must no longer be canonical and its former TERM- id must not
 *   have been reused by a surviving term.
 */

/** Minimum trimmed length for a fragment of an ELIDED quote (see below). */
export const MIN_ELISION_FRAGMENT_CHARS = 5;

// Why elided fragments carry a floor when plain quotes do not: a 1-2 char
// fragment matches almost anywhere in the source, so a fabricated quote of
// the shape `X…a…Y` (real head/tail, junk middle) weaves through the
// order-checking substring verification for free. A plain short quote is
// still a full substring pin — weak as evidence, but not a weaving vector.
export interface TombstoneEntry {
  term: string;
  former_id: string;
}

/** Collapse all whitespace runs to single spaces (quote and source alike). */
function norm(text: string): string {
  return text.replace(/\s+/g, ' ');
}

// A paraphrase marker is a TRAILING `…`/`...` suffix and nothing else. A
// marker elsewhere in the quote is an elision inside a verbatim excerpt and
// does NOT exempt the quote from substring verification.
export function stripTrailingMarker(quote: string): string {
  const trimmed = quote.replace(/\s+$/, '');
  if (trimmed.endsWith('…')) return trimmed.slice(0, -1);
  if (trimmed.endsWith('...')) return trimmed.slice(0, -3);
  return trimmed;
}

/**
 * True when the quote is exempt from substring verification: it carried a
 * trailing marker and its body has no (mid-quote) elision markers left.
 * These are the quotes the guard's paraphrase-ratio cap bounds.
 */
export function isUnverifiedParaphrase(quote: string): boolean {
  if (!quote) return false;
  const trimmed = quote.replace(/\s+$/, '');
  const body = stripTrailingMarker(trimmed);
  return body.length !== trimmed.length && !/…|\.\.\./.test(body);
}

/**
 * Verify one evidence quote against its (raw, on-disk) source content.
 * Returns null when the quote is acceptable — a verbatim excerpt, a
 * well-formed in-order elision, or a trailing-marker paraphrase (exempt;
 * bounded by the ratio cap) — and an offender reason string otherwise.
 */
export function verifyQuoteExcerpt(
  quote: string,
  sourceContent: string,
): string | null {
  if (!quote || isUnverifiedParaphrase(quote)) {
    return null; // empty handled by the guard's existence legs; … = paraphrase
  }
  const content = norm(sourceContent);
  const body = stripTrailingMarker(quote);
  const elided = /…|\.\.\./.test(body);
  let pos = 0;
  for (const fragment of body.split(/…|\.\.\./)) {
    const needle = norm(fragment.trim());
    if (!needle) continue; // marker at start/end of an elision
    if (elided && needle.length < MIN_ELISION_FRAGMENT_CHARS) {
      return `fragment too short (<${MIN_ELISION_FRAGMENT_CHARS} chars after trim): ${needle.slice(0, 50)}`;
    }
    const at = content.indexOf(needle, pos);
    if (at === -1) {
      return `not verbatim: ${needle.slice(0, 50)}`;
    }
    pos = at + needle.length; // next fragment must occur AFTER this one
  }
  return null;
}

/**
 * B-9 deletion-backfill violations for a tombstone list: malformed entries
 * (blank term or non-TERM- former_id), terms that are still canonical, and
 * former ids reused by a surviving term. Empty input → [] (the guard's
 * real data is empty today; the pins exercise the branches with fixtures).
 */
export function collectTombstoneViolations(
  tombstones: readonly TombstoneEntry[],
  canonicalTerms: Readonly<Record<string, unknown>>,
  liveIds: ReadonlySet<string>,
): string[] {
  const bad: string[] = [];
  for (const tomb of tombstones) {
    if (!tomb.term || !/^TERM-/.test(tomb.former_id ?? '')) {
      bad.push(`malformed: ${JSON.stringify(tomb)}`);
    }
    if (tomb.term in canonicalTerms) {
      bad.push(`still-canonical: ${tomb.term}`);
    }
    if (liveIds.has(tomb.former_id)) {
      bad.push(`id-reused-by-live-term: ${tomb.former_id}`);
    }
  }
  return bad;
}
