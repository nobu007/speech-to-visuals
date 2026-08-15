/**
 * @jest-environment jsdom
 */
/**
 * Transcription language detection — migration oracle (single-source round 22).
 *
 * Four TranscriptionResult producers had four different language behaviors
 * for the same concept ("what language is this transcript in?"):
 *
 *   - transcriber.ts          → detectLanguage() delegation (canonical)
 *   - whisper-transcriber.ts  → hand-rolled [kana|kanji] regex: ANY CJK
 *                               ideograph means 'ja', everything else 'en'
 *   - streaming-transcriber.ts→ hardcoded 'ja' regardless of content
 *   - browser-transcriber.ts  → hardcoded 'en' (EXCLUDED: Web Speech
 *                               recognition is pinned to lang='en-US', so the
 *                               language is a prior there, not detected)
 *
 * This file pins the migration the way the round-21 sentence-boundary oracle
 * did (delta table + equivalence + source anchors):
 *
 *  - DELTA: rows where the hand-rolled shapes disagreed with the canonical
 *    detector — Chinese-only transcripts mislabeled 'ja' (which selects a
 *    Japanese LLM prompt downstream), es/fr/de collapsed to 'en', and
 *    streaming's English mock output labeled 'ja'.
 *  - EQUIVALENCE: rows where all shapes already agreed (kana→ja, plain
 *    English→en) must stay identical after the migration.
 *  - SOURCE ANCHORS: whisper/streaming import the shared helper; no
 *    src/transcription file hand-rolls the Japanese character class.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WhisperTranscriber } from '@/transcription/whisper-transcriber';
import { StreamingTranscriber } from '@/transcription/streaming-transcriber';
import type { TranscriptionSegment } from '@/transcription/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

const seg = (id: number, text: string, start = 0, end = 5000): TranscriptionSegment => ({
  id,
  start,
  end,
  text,
  confidence: 0.9,
});

/** The hand-rolled membership whisper used before round 22 (replica). */
const legacyWhisperLanguage = (text: string): string =>
  /[぀-ゟ゠-ヿ一-鿿]/.test(text) ? 'ja' : 'en';

// ---------------------------------------------------------------------------
// The canonical expectation table — absolute values, not derived from the
// code under test. Same rows the analysis language-detector is pinned to.
// ---------------------------------------------------------------------------

const EXPECTED_LANGUAGE: Array<[string, string]> = [
  ['今日は天気ですね', 'ja'],
  ['音声認識システムを構築する', 'ja'],
  ['The quick brown fox jumps', 'en'],
  // Delta rows — whisper said 'ja' (regex hits kanji), streaming said 'ja'
  ['系统架构设计完成', 'zh'],
  ['El niño está aquí ¿verdad?', 'es'],
  ["Garçon, l'hôtel est très beau", 'fr'],
  ['Straße und Grüße', 'de'],
];

describe('whisper detectLanguageFromSegments — canonical language table', () => {
  const whisper = new WhisperTranscriber({ language: 'auto' }) as unknown as {
    detectLanguageFromSegments(segments: TranscriptionSegment[]): string;
  };

  test.each(EXPECTED_LANGUAGE)('%j → %s', (text, expected) => {
    expect(whisper.detectLanguageFromSegments([seg(0, text)])).toBe(expected);
  });

  test('multi-segment input: language from the joined text', () => {
    const segments = [seg(0, 'システムの'), seg(1, '構築を'), seg(2, '行う')];
    expect(whisper.detectLanguageFromSegments(segments)).toBe('ja');
  });

  test('config language never reaches detection (passthrough stays in transcribe)', () => {
    // language:'ja' config must be honored by transcribe() without calling
    // detection at all — pinned by tests/transcription/whisper-transcriber.test.ts
    // ('returns the configured language'); here we only pin that the
    // detection path itself is content-derived.
    const configured = new WhisperTranscriber({ language: 'ja' }) as unknown as {
      detectLanguageFromSegments(segments: TranscriptionSegment[]): string;
    };
    expect(configured.detectLanguageFromSegments([seg(0, 'English text')])).toBe('en');
  });
});

describe('whisper delta rows — the drift this round closes', () => {
  const deltaRows = EXPECTED_LANGUAGE.filter(
    ([text, expected]) => legacyWhisperLanguage(text) !== expected,
  );

  test('the delta is non-empty (the family was really drifted)', () => {
    expect(deltaRows.length).toBeGreaterThanOrEqual(4); // zh + es + fr + de
  });

  test.each(deltaRows)('%j: legacy said %s, canonical says %s', (text, expected) => {
    // These are exactly the rows where the pre-migration membership was
    // wrong. Documenting the legacy value keeps the delta reviewable.
    expect(legacyWhisperLanguage(text)).not.toBe(expected);
    const whisper = new WhisperTranscriber({ language: 'auto' }) as unknown as {
      detectLanguageFromSegments(segments: TranscriptionSegment[]): string;
    };
    expect(whisper.detectLanguageFromSegments([seg(0, text)])).toBe(expected);
  });
});

describe('streaming-transcriber — content-derived language (was hardcoded ja)', () => {
  // Same Audio/URL mocks the canonical streaming suite uses: without them the
  // metadata load never resolves and transcribeStream hangs.
  const createMockAudio = () => () => {
    const audio = {
      onloadedmetadata: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
      duration: 10,
    };
    queueMicrotask(() => {
      if (audio.onloadedmetadata) audio.onloadedmetadata();
    });
    return audio;
  };
  const origURL = global.URL;

  beforeEach(() => {
    (global as unknown as { Audio: jest.Mock }).Audio = jest.fn(createMockAudio()) as jest.Mock;
    Object.defineProperty(global, 'URL', {
      value: {
        ...origURL,
        createObjectURL: jest.fn(() => 'blob:test'),
        revokeObjectURL: jest.fn(),
      },
      writable: true,
    });
  });

  test(
    'English mock chunk output is labeled en, not ja',
    async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });
      const result = await transcriber.transcribeStream('test-audio.wav');
      expect(result.success).toBe(true);
      expect(result.language).toBe('en');
    },
    30000,
  );
});

// ---------------------------------------------------------------------------
// Source anchors — the migration is real in the source, not just behavior
// ---------------------------------------------------------------------------

describe('source anchors', () => {
  const read = (rel: string): string =>
    readFileSync(path.join(repoRoot, rel), 'utf-8');

  test('whisper-transcriber delegates to the shared helper', () => {
    const src = read('src/transcription/whisper-transcriber.ts');
    expect(src).toMatch(/from '\.\/language-detection'/);
  });

  test('streaming-transcriber delegates to the shared helper', () => {
    const src = read('src/transcription/streaming-transcriber.ts');
    expect(src).toMatch(/from '\.\/language-detection'/);
  });

  test('transcriber.ts no longer keeps a private Language→code map', () => {
    const src = read('src/transcription/transcriber.ts');
    expect(src).not.toMatch(/languageMap/);
    expect(src).toMatch(/from '\.\/language-detection'/);
  });

  test('no src/transcription file hand-rolls the Japanese character class', () => {
    const dir = path.join(repoRoot, 'src', 'transcription');
    const files = [
      'whisper-transcriber.ts',
      'streaming-transcriber.ts',
      'transcriber.ts',
      'browser-transcriber.ts',
      'language-detection.ts',
    ];
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), 'utf-8');
      expect(src).not.toMatch(/\\u3040-\\u309F/);
    }
  });
});
