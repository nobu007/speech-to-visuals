/**
 * Sentence-boundary definitions — the single source for every sentence
 * splitter in src/analysis (single-source round 21).
 *
 * WHAT USED TO DRIFT. Seven splitters hand-rolled their own terminator class
 * and the membership silently diverged four ways (no `\n`, no full-width
 * `！？`, a `。`-less context extractor, a lone `;`-bearing phrase splitter).
 * TC-309 pinned the decimal-safe '.' arm but could not see terminator
 * membership at all. Consequences ranged from contradictory complexity
 * factors (one detector, two sentence definitions) to unsplit Japanese
 * exclamatory text reaching node labels whole.
 *
 * THE CANONICAL MEMBERSHIP of a sentence boundary:
 *   - a RUN of terminal punctuation — 。！？ (full-width) and !? (ASCII)
 *   - a newline
 *   - an English '.' ONLY when followed by whitespace or end-of-string
 *     (decimal-safe: a bare '.' inside the class would tear "2.5",
 *     "192.168.1.1", "2.0" — TC-309)
 *
 * Guarded by the frozen-literal registry (tests/guards/frozen-literal-rules.ts,
 * 'sentence-boundary terminators single-sourced' entry): no src/analysis file
 * outside this module may hand-roll a split class containing CJK terminators.
 */
/** Regex source of the canonical boundary — the membership, spelled once. */
export const SENTENCE_BOUNDARY_SOURCE = '[。！？!?\\n]+|\\.(?:\\s+|$)';

/**
 * Canonical sentence splitter. Use for sentence COUNTS, node labels,
 * summaries, and term contexts. Post-filtering (min length, slice) stays at
 * each call site — this module owns only WHERE a boundary is.
 */
export const SENTENCE_BOUNDARY_REGEX = new RegExp(SENTENCE_BOUNDARY_SOURCE);

/**
 * Phrase-level splitter for key-phrase extraction: everything above PLUS
 * ';' (a clause/step separator, not a sentence terminator — splitting on it
 * would deflate sentence-length metrics, which is why it lives here and not
 * in SENTENCE_BOUNDARY_REGEX).
 */
export const PHRASE_BOUNDARY_SOURCE = '[。！？!?;\\n]+|\\.(?:\\s+|$)';
export const PHRASE_BOUNDARY_REGEX = new RegExp(PHRASE_BOUNDARY_SOURCE);
