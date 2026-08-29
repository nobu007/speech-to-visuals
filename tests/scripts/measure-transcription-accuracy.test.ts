/**
 * measure-transcription-accuracy.ts — metric core pins.
 *
 * README「音声認識の現状」: transcription accuracy is UNMEASURED until computed
 * against a reference. The WER/CER math here is what any future recorded
 * number in QUALITY_METRICS §3.1 will be divided by, so every convention
 * (normalization, tokenization, denominators, micro-averages) is pinned to
 * hand-computable cases. A drifted formula would silently re-scale every
 * recorded accuracy claim — these legs make that a RED, not a quiet rebase.
 */
import {
  normalizeText,
  tokenize,
  charSequence,
  levenshtein,
  computeWer,
  computeCer,
  discoverCorpus,
  summarize,
  buildReport,
  parseAccuracyArgv,
} from '../../scripts/measure-transcription-accuracy';

describe('normalizeText / tokenize / charSequence', () => {
  it('collapses case, whitespace runs, and leading/trailing space', () => {
    expect(normalizeText('  The   QUICK\tbrown\nfox  ')).toBe('the quick brown fox');
  });

  it('NFC-normalizes decomposed code points before comparing', () => {
    // The contract that matters: decomposed and precomposed forms of the SAME
    // visible character normalize to one sequence.
    expect(normalizeText('が'.normalize('NFD'))).toBe(normalizeText('が'));
    expect(charSequence('が'.normalize('NFD'))).toEqual(['が']);
  });

  it('tokenizes on whitespace; empty text yields no tokens', () => {
    expect(tokenize('hello  world')).toEqual(['hello', 'world']);
    expect(tokenize('   ')).toEqual([]);
  });

  it('CER sequence drops whitespace and keeps surrogate pairs intact', () => {
    expect(charSequence('a b')).toEqual(['a', 'b']);
    expect(charSequence('𠮷野家')).toEqual(['𠮷', '野', '家']);
  });
});

describe('levenshtein', () => {
  it('empty sequences are pure deletions/insertions', () => {
    expect(levenshtein([], ['a', 'b'])).toMatchObject({
      distance: 2,
      insertions: 2,
      deletions: 0,
      substitutions: 0,
    });
    expect(levenshtein(['a'], [])).toMatchObject({
      distance: 1,
      deletions: 1,
      insertions: 0,
    });
  });

  it('counts substitutions, deletions and insertions on a mixed case', () => {
    // ref:   t h e <del:quick> c a t
    // hyp:   t w o <ins:->     c a t s   → hmm hand-computed below instead.
    const result = levenshtein(['the', 'quick', 'brown', 'fox'], ['the', 'lazy', 'fox']);
    // Optimal: keep "the"; substitute quick→lazy; delete brown; keep fox.
    expect(result).toMatchObject({
      distance: 2,
      substitutions: 1,
      deletions: 1,
      insertions: 0,
      referenceLength: 4,
      hypothesisLength: 3,
    });
  });

  it('split of ops sums to the distance', () => {
    const ref = ['a', 'b', 'c', 'd', 'e'];
    const hyp = ['x', 'b', 'd', 'e', 'f', 'g'];
    const result = levenshtein(ref, hyp);
    expect(result.substitutions + result.deletions + result.insertions).toBe(result.distance);
  });
});

describe('computeWer', () => {
  it('identical text (after normalization) is 0', () => {
    expect(computeWer('The Quick Brown Fox', 'the quick   brown\nfox').wer).toBe(0);
  });

  it('one substitution in ten reference tokens is 0.1', () => {
    const result = computeWer(
      'one two three four five six seven eight nine ten',
      'one two three four five six seven eight nine zen'
    );
    expect(result.wer).toBeCloseTo(0.1, 12);
    expect(result.substitutions).toBe(1);
  });

  it('counts pure deletions against the reference denominator', () => {
    // ref 5 tokens, hyp drops 2 → 2/5
    const result = computeWer('a b c d e', 'a b c');
    expect(result.wer).toBeCloseTo(0.4, 12);
    expect(result.deletions).toBe(2);
  });

  it('counts pure insertions against the reference denominator', () => {
    // ref 2 tokens, hyp adds 3 → 3/2 (>1 is legitimate for insertions)
    const result = computeWer('a b', 'a b x y z');
    expect(result.wer).toBeCloseTo(1.5, 12);
    expect(result.insertions).toBe(3);
  });

  it('empty reference is null (unmeasurable), never 0 or a division error', () => {
    expect(computeWer('', 'some hypothesis').wer).toBeNull();
    expect(computeWer('   ', 'some hypothesis').wer).toBeNull();
  });
});

describe('computeCer', () => {
  it('identical Japanese text is 0', () => {
    expect(computeCer('今日は天気がいいですね', '今日は天気がいいですね').cer).toBe(0);
  });

  it('two character substitutions in five is 0.4', () => {
    const result = computeCer('今日は天気', '今日は大雨');
    expect(result.cer).toBeCloseTo(0.4, 12);
    expect(result.substitutions).toBe(2);
    expect(result.referenceChars).toBe(5);
  });

  it('ignores whitespace differences (a spacing-only change is CER 0)', () => {
    expect(computeCer('こんにちは世界', 'こんにちは   世界').cer).toBe(0);
  });

  it('empty reference is null', () => {
    expect(computeCer('', 'テキスト').cer).toBeNull();
  });
});

describe('discoverCorpus', () => {
  const refs = new Map([
    ['a.txt', 'reference a'],
    ['b.txt', 'reference b'],
    ['orphan.txt', 'reference orphan'],
    ['empty.txt', '   \n'],
  ]);

  it('pairs audio with same-basename references and skips the rest with reasons', () => {
    const { pairs, skipped } = discoverCorpus(
      ['a.wav', 'b.mp3', 'no-ref.ogg', 'notes.txt', 'orphan.txt', 'empty.txt'],
      refs
    );

    expect(pairs.map((p) => p.file)).toEqual(['a.wav', 'b.mp3']);
    expect(pairs[0].reference).toBe('reference a');
    expect(skipped).toEqual([
      { file: 'empty.txt', reason: 'orphan reference (empty)' },
      { file: 'no-ref.ogg', reason: 'no reference transcript: no-ref.txt not found' },
      { file: 'orphan.txt', reason: 'orphan reference (no matching audio file)' },
    ]);
  });

  it('ignores non-audio files entirely', () => {
    const { pairs, skipped } = discoverCorpus(['readme.md', 'data.json'], new Map());
    expect(pairs).toEqual([]);
    expect(skipped).toEqual([]);
  });
});

describe('summarize / buildReport', () => {
  function measurement(
    reference: string,
    hypothesis: string,
    overrides: Partial<{ file: string; inferenceRan: boolean }> = {}
  ) {
    return {
      file: 'x.wav',
      reference,
      hypothesis,
      inferenceRan: true,
      segments: 1,
      processingTimeMs: 10,
      wer: computeWer(reference, hypothesis),
      cer: computeCer(reference, hypothesis),
      ...overrides,
    };
  }

  it('micro-averages over pooled reference lengths, not per-file means', () => {
    const m1 = measurement('a b c d e', 'a b c d x'); // 1 sub / 5 ref tokens
    const m2 = measurement(
      'a b c d e f g h i j', // 10 ref tokens
      'a b c d e f g h i x y z' // 1 sub (j→x) + 2 ins = 3 errors
    );

    const summary = summarize([m1, m2]);
    // micro: (1 + 3) / (5 + 10) = 4/15 — NOT the per-file mean (0.2 + 0.3)/2 = 0.25
    expect(summary.aggregateWer).toBeCloseTo(4 / 15, 12);
  });

  it('splits real-inference runs from placeholder runs', () => {
    const summary = summarize([
      measurement('a', 'a', { inferenceRan: true }),
      measurement('a', 'a', { inferenceRan: false }),
      measurement('a', 'a', { inferenceRan: false }),
    ]);
    expect(summary).toMatchObject({
      filesMeasured: 3,
      realInferenceRuns: 1,
      placeholderRuns: 2,
    });
  });

  it('aggregateWer is null when every reference is empty (nothing measured)', () => {
    const summary = summarize([measurement('', 'text')]);
    expect(summary.aggregateWer).toBeNull();
    expect(summary.filesMeasured).toBe(1);
  });

  it('buildReport stamps the schema and copies inputs', () => {
    const report = buildReport('public/audio', [measurement('a b', 'a b')], [
      { file: 'z.wav', reason: 'no reference transcript: z.txt not found' },
    ]);
    expect(report.schema).toBe('stv-transcription-accuracy/1');
    expect(report.corpus).toBe('public/audio');
    expect(report.files).toHaveLength(1);
    expect(report.skipped).toHaveLength(1);
    expect(report.summary.filesMeasured).toBe(1);
    expect(report.generatedAt).toBeUndefined();
  });
});

describe('parseAccuracyArgv', () => {
  it('defaults the corpus to public/audio', () => {
    expect(parseAccuracyArgv([])).toEqual({ corpus: 'public/audio' });
  });

  it('parses --corpus and --output', () => {
    expect(parseAccuracyArgv(['--corpus', 'x', '--output', 'y.json'])).toEqual({
      corpus: 'x',
      output: 'y.json',
    });
  });

  it.each([
    [['--corpus']],
    [['--corpus', '--output', 'y.json']],
    [['--wat', 'x']],
    [['--corpus', 'x', 'stray']],
  ])('rejects malformed argv %p', (argv) => {
    const parsed = parseAccuracyArgv(argv);
    expect('error' in parsed).toBe(true);
  });
});
