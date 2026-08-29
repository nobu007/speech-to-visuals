#!/usr/bin/env -S node
/**
 * Transcription accuracy harness — reference vs hypothesis WER/CER.
 *
 * README「音声認識の現状」milestone 1: real transcription accuracy is UNMEASURED
 * until it is computed against a reference transcript. This script pairs each
 * corpus audio file with a same-basename `.txt` reference, runs the
 * transcription pipeline, and emits a JSON trace with per-file and aggregate
 * error rates.
 *
 * Corpus convention (populated by D-5):
 *   <corpus>/<name>.<audio-ext>   audio (wav/mp3/ogg/m4a)
 *   <corpus>/<name>.txt           reference transcript (UTF-8)
 *
 * Metric conventions (pinned by tests/scripts/measure-transcription-accuracy.test.ts):
 *   - normalize: NFC → lowercase → collapse whitespace → trim.
 *   - WER tokens: whitespace-split of the normalized text (for Japanese, which
 *     has no whitespace, WER is sentence-granular — read CER for it).
 *   - CER chars: the normalized text with whitespace REMOVED, code-point
 *     sequence (Array.from, surrogate-pair safe).
 *   - rate denominators are the REFERENCE length; an empty reference yields
 *     null (unmeasurable), never a fabricated 0 or 1.
 *   - aggregates are micro-averages: Σ edit distance / Σ reference length.
 *
 * A run in which every transcription was the disclosed placeholder is NOT a
 * measurement: the script exits 1 so no placeholder run can be recorded as
 * an accuracy number (QUALITY_METRICS §3.1 requires real-inference traces).
 *
 * Usage:
 *   npx tsx scripts/measure-transcription-accuracy.ts --corpus public/audio [--output trace.json]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AUDIO_EXTENSIONS = ['wav', 'mp3', 'ogg', 'm4a'] as const;

// ---------------------------------------------------------------------------
// Pure metric core (exported for tests)
// ---------------------------------------------------------------------------

/** NFC → lowercase → single-space whitespace → trim. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** WER token sequence: whitespace-split of the normalized text. */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

/** CER character sequence: normalized text minus whitespace, code points. */
export function charSequence(text: string): string[] {
  return Array.from(normalizeText(text).replace(/ /g, ''));
}

export interface LevenshteinResult {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceLength: number;
  hypothesisLength: number;
}

/**
 * Unit-cost edit distance with the substitution/insertion/deletion split of a
 * minimal alignment (substitution preferred on ties, so equal items align).
 * O(n·m) time and op-matrix memory — fine for transcript-length sequences.
 */
export function levenshtein(reference: readonly string[], hypothesis: readonly string[]): LevenshteinResult {
  const n = reference.length;
  const m = hypothesis.length;
  const empty: LevenshteinResult = {
    distance: Math.max(n, m),
    substitutions: 0,
    deletions: n,
    insertions: m,
    referenceLength: n,
    hypothesisLength: m,
  };
  if (n === 0 || m === 0) return empty;

  const width = m + 1;
  const ops = new Uint8Array((n + 1) * width); // 0 = sub/match, 1 = delete, 2 = insert
  let previous = new Uint32Array(width);
  for (let j = 0; j <= m; j++) previous[j] = j;

  for (let i = 1; i <= n; i++) {
    const current = new Uint32Array(width);
    current[0] = i;
    ops[i * width] = 1;
    for (let j = 1; j <= m; j++) {
      const substitutionCost = previous[j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1);
      const deletionCost = previous[j] + 1;
      const insertionCost = current[j - 1] + 1;
      let best = substitutionCost;
      let op = 0;
      if (deletionCost < best) {
        best = deletionCost;
        op = 1;
      }
      if (insertionCost < best) {
        best = insertionCost;
        op = 2;
      }
      current[j] = best;
      ops[i * width + j] = op;
    }
    previous = current;
  }

  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const op = ops[i * width + j];
      if (op === 0) {
        if (reference[i - 1] !== hypothesis[j - 1]) substitutions++;
        i--;
        j--;
      } else if (op === 1) {
        deletions++;
        i--;
      } else {
        insertions++;
        j--;
      }
    } else if (i > 0) {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return {
    distance: previous[m],
    substitutions,
    deletions,
    insertions,
    referenceLength: n,
    hypothesisLength: m,
  };
}

export interface WerResult {
  /** Σ edit ops / reference tokens; null when the reference has no tokens. */
  wer: number | null;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceTokens: number;
  hypothesisTokens: number;
}

export function computeWer(reference: string, hypothesis: string): WerResult {
  const ops = levenshtein(tokenize(reference), tokenize(hypothesis));
  return {
    wer: ops.referenceLength > 0 ? ops.distance / ops.referenceLength : null,
    substitutions: ops.substitutions,
    deletions: ops.deletions,
    insertions: ops.insertions,
    referenceTokens: ops.referenceLength,
    hypothesisTokens: ops.hypothesisLength,
  };
}

export interface CerResult {
  /** Σ edit ops / reference chars; null when the reference has no chars. */
  cer: number | null;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceChars: number;
  hypothesisChars: number;
}

export function computeCer(reference: string, hypothesis: string): CerResult {
  const ops = levenshtein(charSequence(reference), charSequence(hypothesis));
  return {
    cer: ops.referenceLength > 0 ? ops.distance / ops.referenceLength : null,
    substitutions: ops.substitutions,
    deletions: ops.deletions,
    insertions: ops.insertions,
    referenceChars: ops.referenceLength,
    hypothesisChars: ops.hypothesisLength,
  };
}

// ---------------------------------------------------------------------------
// Corpus pairing + report assembly (pure over injected inputs)
// ---------------------------------------------------------------------------

export interface CorpusPair {
  file: string;
  reference: string;
}

export interface CorpusDiscovery {
  pairs: CorpusPair[];
  skipped: Array<{ file: string; reason: string }>;
}

/**
 * Pair `name.<audio-ext>` files with same-basename `.txt` references.
 * Pure over the filename list — the CLI lists the directory.
 */
export function discoverCorpus(filenames: readonly string[], references: ReadonlyMap<string, string>): CorpusDiscovery {
  const pairs: CorpusPair[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  const pairedTxt = new Set<string>();

  for (const filename of filenames) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (!AUDIO_EXTENSIONS.includes(ext as (typeof AUDIO_EXTENSIONS)[number])) continue;
    const base = filename.slice(0, -(ext.length + 1));
    const txt = `${base}.txt`;
    const reference = references.get(txt);
    pairedTxt.add(txt);
    if (reference === undefined) {
      skipped.push({ file: filename, reason: `no reference transcript: ${txt} not found` });
    } else if (reference.trim().length === 0) {
      skipped.push({ file: filename, reason: `empty reference transcript: ${txt}` });
    } else {
      pairs.push({ file: filename, reference });
    }
  }

  for (const [txt, reference] of references) {
    if (pairedTxt.has(txt)) continue;
    const reason = reference.trim().length === 0 ? 'empty' : 'no matching audio file';
    skipped.push({ file: txt, reason: `orphan reference (${reason})` });
  }

  pairs.sort((a, b) => a.file.localeCompare(b.file));
  skipped.sort((a, b) => a.file.localeCompare(b.file));
  return { pairs, skipped };
}

export interface FileMeasurement {
  file: string;
  reference: string;
  hypothesis: string;
  /** false when the pipeline returned the disclosed placeholder — not a measurement. */
  inferenceRan: boolean;
  segments: number;
  processingTimeMs: number;
  wer: WerResult;
  cer: CerResult;
}

export interface AccuracySummary {
  filesMeasured: number;
  realInferenceRuns: number;
  placeholderRuns: number;
  aggregateWer: number | null;
  aggregateCer: number | null;
}

export interface AccuracyReport {
  schema: 'stv-transcription-accuracy/1';
  corpus: string;
  /** Set by the CLI at emission time (absent in pure buildReport output). */
  generatedAt?: string;
  files: FileMeasurement[];
  skipped: Array<{ file: string; reason: string }>;
  summary: AccuracySummary;
}

export function summarize(measurements: readonly FileMeasurement[]): AccuracySummary {
  const totalWerErrors = measurements.reduce(
    (sum, m) => sum + m.wer.substitutions + m.wer.deletions + m.wer.insertions,
    0
  );
  const totalRefTokens = measurements.reduce((sum, m) => sum + m.wer.referenceTokens, 0);
  const totalCerErrors = measurements.reduce(
    (sum, m) => sum + m.cer.substitutions + m.cer.deletions + m.cer.insertions,
    0
  );
  const totalRefChars = measurements.reduce((sum, m) => sum + m.cer.referenceChars, 0);
  return {
    filesMeasured: measurements.length,
    realInferenceRuns: measurements.filter((m) => m.inferenceRan).length,
    placeholderRuns: measurements.filter((m) => !m.inferenceRan).length,
    aggregateWer: totalRefTokens > 0 ? totalWerErrors / totalRefTokens : null,
    aggregateCer: totalRefChars > 0 ? totalCerErrors / totalRefChars : null,
  };
}

export function buildReport(
  corpus: string,
  measurements: readonly FileMeasurement[],
  skipped: ReadonlyArray<{ file: string; reason: string }>
): AccuracyReport {
  return {
    schema: 'stv-transcription-accuracy/1',
    corpus,
    files: [...measurements],
    skipped: [...skipped],
    summary: summarize(measurements),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseAccuracyArgv(
  args: readonly string[]
): { corpus: string; output?: string } | { error: string } {
  const parsed: { corpus?: string; output?: string } = {};
  const rest = [...args];
  while (rest.length > 0 && rest[0].startsWith('--')) {
    const flag = rest.shift() as string;
    if (flag === '--corpus' || flag === '--output') {
      const value = rest.shift();
      if (value === undefined || value.startsWith('--')) {
        return { error: `${flag} requires a value — usage: measure-transcription-accuracy.ts --corpus <dir> [--output <file.json>]` };
      }
      if (flag === '--corpus') parsed.corpus = value;
      else parsed.output = value;
    } else {
      return { error: `unknown option: ${flag} — usage: measure-transcription-accuracy.ts --corpus <dir> [--output <file.json>]` };
    }
  }
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  if (parsed.corpus === undefined) parsed.corpus = 'public/audio';
  return { corpus: parsed.corpus, output: parsed.output };
}

const isMain =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const parsed = parseAccuracyArgv(process.argv.slice(2));
  if ('error' in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(2);
  }

  const corpusDir = resolve(parsed.corpus);
  let filenames: string[];
  try {
    filenames = readdirSync(corpusDir);
  } catch (error) {
    process.stderr.write(
      `corpus directory not readable: ${corpusDir} (${error instanceof Error ? error.message : String(error)})\n` +
        'corpus convention: <name>.<wav|mp3|ogg|m4a> paired with <name>.txt reference transcript\n'
    );
    process.exit(2);
  }

  const references = new Map<string, string>();
  for (const filename of filenames) {
    if (filename.toLowerCase().endsWith('.txt')) {
      references.set(filename, readFileSync(join(corpusDir, filename), 'utf-8'));
    }
  }
  const { pairs, skipped } = discoverCorpus(filenames, references);

  // Deferred import keeps the pipeline graph out of unit-test imports of this
  // module's pure core (same idiom as scripts/run-pipeline.ts).
  const { TranscriptionPipeline } = await import('../src/transcription/transcriber');
  const pipeline = new TranscriptionPipeline();

  const measurements: FileMeasurement[] = [];
  for (const pair of pairs) {
    const result = await pipeline.transcribe(join(corpusDir, pair.file));
    const hypothesis = result.segments.map((s) => s.text).join(' ');
    const inferenceRan =
      result.success === true && result.segments.length > 0 && result.placeholder !== true && result.fallback !== true;
    measurements.push({
      file: pair.file,
      reference: pair.reference,
      hypothesis,
      inferenceRan,
      segments: result.segments.length,
      processingTimeMs: Math.round(result.processingTime ?? 0),
      wer: computeWer(pair.reference, hypothesis),
      cer: computeCer(pair.reference, hypothesis),
    });
  }

  const report = buildReport(corpusDir, measurements, skipped);
  report.generatedAt = new Date().toISOString();
  const json = JSON.stringify(report, null, 2);
  if (parsed.output !== undefined) {
    writeFileSync(parsed.output, `${json}\n`, 'utf-8');
    process.stdout.write(`wrote ${parsed.output}\n`);
  } else {
    process.stdout.write(`${json}\n`);
  }

  const { summary } = report;
  process.stderr.write(
    `files measured: ${summary.filesMeasured} (real inference: ${summary.realInferenceRuns}, placeholder: ${summary.placeholderRuns}), skipped: ${skipped.length}\n` +
      `aggregate WER: ${summary.aggregateWer ?? 'n/a'} / CER: ${summary.aggregateCer ?? 'n/a'}\n`
  );
  if (summary.filesMeasured > 0 && summary.realInferenceRuns === 0) {
    process.stderr.write(
      'no real inference ran (whisper.cpp binary/model absent?) — a placeholder run is NOT a measurement; nothing to record in QUALITY_METRICS §3.1\n'
    );
    process.exit(1);
  }
}
