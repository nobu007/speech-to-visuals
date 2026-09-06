/**
 * Real whisper.cpp inference wiring (README「音声認識の現状」server path).
 *
 * WhisperTranscriber.transcribe() attempts actual whisper-node inference
 * before any placeholder emitter. The attempt only produces segments when
 * every link holds: not a browser, the binary+model existence gate is open,
 * the whisper-node module exposes its default callable, and whisper returned
 * usable rows. Everything else falls through to the disclosed placeholder
 * (`placeholder: true`, PLACEHOLDER_SEGMENT_CONFIDENCE) — the pipeline's
 * priority routing never sees a fabricated success.
 *
 * The backend and the gate paths are injectable (WhisperRuntime), so the
 * legs below exercise the contract without a compiled whisper.cpp. The
 * environment-parity leg pins the DEFAULT probe: in CI there is no compiled
 * `main` binary, so the gate stays closed and the disclosed placeholder is
 * what ships.
 */

import {
  WhisperTranscriber,
  PLACEHOLDER_SEGMENT_CONFIDENCE,
  convertWhisperRows,
  parseWhisperSrtSidecar,
  parseWhisperTimestampToMs,
  resolveWhisperInferencePaths,
  type RawWhisperRow,
  type WhisperBackend,
  type WhisperInferencePaths,
} from '../whisper-transcriber';

/** Fixed inference paths for the injected-runtime legs (trusted as-is, no fs probe). */
const INJECTED_PATHS: WhisperInferencePaths = {
  binaryPath: '/fake/whisper.cpp/main',
  modelPath: '/fake/models/ggml-base.bin',
};

/** Minimal MP3-shaped File (sync word 0xFF 0xE0) that passes validation. */
function createValidMp3(): File {
  const buffer = new ArrayBuffer(64);
  const view = new Uint8Array(buffer);
  view[0] = 0xff;
  view[1] = 0xe0;
  return new File([buffer], 'inference-probe.mp3', { type: 'audio/mpeg' });
}

/** whisper-node success shape: parsed "HH:MM:SS.mmm" rows. */
const REAL_ROWS: RawWhisperRow[] = [
  { start: '00:00:01.500', end: '00:00:03.000', speech: '  hello world  ' },
  { start: '00:00:04.000', end: '00:00:06.250', speech: 'second segment' },
];

/** Build a transcriber whose inference path is fully injected. */
function makeTranscriber(backend: WhisperBackend): WhisperTranscriber {
  return new WhisperTranscriber(
    { model: 'base', language: 'auto' },
    { backend, inferencePaths: INJECTED_PATHS }
  );
}

describe('WhisperTranscriber: real inference wiring', () => {
  it('reports placeholder: false with converted segments when whisper returns rows', async () => {
    const calls: Array<{ path: string; options?: { modelPath?: string } }> = [];
    const transcriber = makeTranscriber(async (path, options) => {
      calls.push({ path, options });
      return REAL_ROWS;
    });

    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(false);
    expect(result.success).toBe(true);
    expect(result.segments).toEqual([
      { id: 0, start: 1500, end: 3000, text: 'hello world' },
      { id: 1, start: 4000, end: 6250, text: 'second segment' },
    ]);

    // The staged temp file carries the original extension and the resolved
    // model path is forwarded to the backend.
    expect(calls).toHaveLength(1);
    expect(calls[0].path.endsWith('.mp3')).toBe(true);
    expect(calls[0].options?.modelPath).toBe(INJECTED_PATHS.modelPath);
  });

  it('forwards a non-auto language to whisper as whisperOptions.language', async () => {
    const calls: Array<{ options?: { whisperOptions?: { language?: string } } }> = [];
    const transcriber = new WhisperTranscriber(
      { model: 'base', language: 'ja' },
      {
        backend: async (path, options) => {
          calls.push({ options });
          return REAL_ROWS;
        },
        inferencePaths: INJECTED_PATHS,
      }
    );

    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(false);
    expect(calls[0].options?.whisperOptions?.language).toBe('ja');
  });

  it('keeps real-segment confidence unmeasured (undefined), not a dressed-up number', async () => {
    const transcriber = makeTranscriber(async () => REAL_ROWS);
    const result = await transcriber.transcribe(createValidMp3());

    for (const segment of result.segments) {
      expect(segment.confidence).toBeUndefined();
    }
    // Caption rendering reads undefined as null ("unmeasured"), not a value.
    for (const caption of result.captions ?? []) {
      expect(caption.confidence).toBeNull();
    }
  });

  it('falls back to the disclosed placeholder when whisper resolves undefined (its error-swallow shape)', async () => {
    const transcriber = makeTranscriber(async () => undefined);
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    for (const segment of result.segments) {
      expect(segment.confidence).toBe(PLACEHOLDER_SEGMENT_CONFIDENCE);
    }
  });

  it('falls back to the disclosed placeholder when the backend throws', async () => {
    const transcriber = makeTranscriber(async () => {
      throw new Error('whisper.cpp exited non-zero');
    });
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
  });

  it('falls back to the disclosed placeholder when whisper returns zero usable rows', async () => {
    const transcriber = makeTranscriber(async () => []);
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
  });

  it('never attempts inference when the runtime force-disables it (inferencePaths: null)', async () => {
    let called = false;
    const transcriber = new WhisperTranscriber(
      { model: 'base' },
      {
        backend: async () => {
          called = true;
          return REAL_ROWS;
        },
        inferencePaths: null,
      }
    );

    const result = await transcriber.transcribe(createValidMp3());

    expect(called).toBe(false);
    expect(result.placeholder).toBe(true);
  });

  it('accepts a Node filesystem path (server route) and returns the disclosed placeholder', async () => {
    // The batch pipeline / accuracy harness pass real file paths. The server
    // path must read the bytes from disk and return the disclosed placeholder
    // when the gate is closed — not throw "browser environment" like it used
    // to, which pushed the pipeline into its own emergency fallback.
    const fs = await import('fs');
    const os = await import('os');
    const path = `${os.tmpdir()}/stv-server-path-probe.wav`;
    fs.writeFileSync(path, Buffer.from('RIFF-probe-bytes'));

    try {
      const transcriber = new WhisperTranscriber({ model: 'base' });
      const result = await transcriber.transcribe(path);

      expect(result.placeholder).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(path);
    }
  });

  it('environment parity: default probe stays closed without a compiled binary (CI shape)', async () => {
    // No runtime injection: the production path probes the real filesystem.
    // CI installs whisper-node's whisper.cpp SOURCE but never compiles `main`
    // and has no ggml model, so the gate must be closed and the result must
    // be the disclosed placeholder — the shipped default until
    // `npx whisper-node download` + `make` have run.
    const transcriber = new WhisperTranscriber({ model: 'base' });
    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(true);
    expect(result.success).toBe(true);
    for (const segment of result.segments) {
      expect(segment.confidence).toBe(PLACEHOLDER_SEGMENT_CONFIDENCE);
    }
  });
});

describe('convertWhisperRows', () => {
  it('returns null for undefined/null (whisper-node swallowed an error)', () => {
    expect(convertWhisperRows(undefined)).toBeNull();
    expect(convertWhisperRows(null)).toBeNull();
  });

  it('returns null for an empty array (indistinguishable from a failed run)', () => {
    expect(convertWhisperRows([])).toBeNull();
  });

  it('drops rows with unparseable timestamps, empty speech, or end <= start', () => {
    const rows: RawWhisperRow[] = [
      { start: 'not-a-timestamp', end: '00:00:02.000', speech: 'dropped' },
      { start: '00:00:00.000', end: '00:00:01.000', speech: '   ' },
      { start: '00:00:05.000', end: '00:00:05.000', speech: 'zero length' },
      { start: '00:00:05.000', end: '00:00:04.000', speech: 'reversed' },
      { start: '00:00:00.000', end: '00:00:01.000', speech: 'kept' },
    ];

    expect(convertWhisperRows(rows)).toEqual([{ id: 0, start: 0, end: 1000, text: 'kept' }]);
  });

  it('renumbers ids contiguously after dropping rows', () => {
    const rows: RawWhisperRow[] = [
      { start: 'bad', end: 'bad', speech: 'dropped' },
      { start: '00:00:00.000', end: '00:00:01.000', speech: 'first' },
      { start: '00:00:01.000', end: '00:00:02.000', speech: 'second' },
    ];

    const segments = convertWhisperRows(rows);
    expect(segments?.map((s) => s.id)).toEqual([0, 1]);
  });
});

describe('parseWhisperTimestampToMs', () => {
  it.each([
    ['00:00:00.000', 0],
    ['00:00:14.310', 14310],
    ['01:02:03.500', 3723500],
    ['12:34:56', 45296000],
    ['02:03.500', 123500], // hours part omitted (whisper -ml short output tolerance)
  ])('parses %s to %d ms', (input, expected) => {
    expect(parseWhisperTimestampToMs(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1:2:3:4', '00:00:14,310', '00:00:14.3100'])(
    'rejects %s',
    (input) => {
      expect(parseWhisperTimestampToMs(input)).toBeNull();
    }
  );
});

describe('resolveWhisperInferencePaths', () => {
  const MODEL = 'base' as const;

  function makeFs(existing: readonly string[]) {
    return (p: string) => existing.includes(p);
  }

  const ROOT = '/proj';
  const CPP = `${ROOT}/node_modules/whisper-node/lib/whisper.cpp`;

  it('resolves the pair when binary and model both exist', () => {
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/main`, `${CPP}/models/ggml-base.bin`]),
      startDir: ROOT,
    });

    expect(paths).toEqual({
      binaryPath: `${CPP}/main`,
      modelPath: `${CPP}/models/ggml-base.bin`,
    });
  });

  it('returns null when the compiled binary is missing (CI shape)', () => {
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/models/ggml-base.bin`]), // no `main`
      startDir: ROOT,
    });

    expect(paths).toBeNull();
  });

  it('returns null when the model is missing', () => {
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/main`]),
      startDir: ROOT,
    });

    expect(paths).toBeNull();
  });

  it('returns null when no whisper-node install is found at all', () => {
    expect(
      resolveWhisperInferencePaths(MODEL, { exists: () => false, startDir: ROOT })
    ).toBeNull();
  });

  it('prefers STV_WHISPER_MODEL when that file exists', () => {
    const custom = '/opt/models/ggml-large.bin';
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/main`, custom, `${CPP}/models/ggml-base.bin`]),
      startDir: ROOT,
      env: { STV_WHISPER_MODEL: custom },
    });

    expect(paths?.modelPath).toBe(custom);
  });

  it('falls back to the whisper-node layout when STV_WHISPER_MODEL does not exist', () => {
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/main`, `${CPP}/models/ggml-base.bin`]),
      startDir: ROOT,
      env: { STV_WHISPER_MODEL: '/gone/ggml.bin' },
    });

    expect(paths?.modelPath).toBe(`${CPP}/models/ggml-base.bin`);
  });

  it('walks up from a nested start directory (whisper-node chdir defense)', () => {
    const paths = resolveWhisperInferencePaths(MODEL, {
      exists: makeFs([CPP, `${CPP}/main`, `${CPP}/models/ggml-base.bin`]),
      startDir: `${CPP}/examples/stream`,
    });

    expect(paths?.binaryPath).toBe(`${CPP}/main`);
  });
});

describe('SRT sidecar (whisper-node first-row-drop defense)', () => {
  // whisper-node's stdout parser `shift()`s the first transcript row away
  // (upstream tsToArray); a backend that resolved the tail row while
  // whisper.cpp wrote the complete `-osrt` sidecar is the real success shape.
  const SIDECAR_SRT = [
    '1',
    '00:00:00,000 --> 00:00:08,000',
    'And so, my fellow Americans, ask not what your country can do for you,',
    '',
    '2',
    '00:00:08,000 --> 00:00:11,000',
    'ask what you can do for your country.',
    '',
  ].join('\n');

  it('prefers the complete sidecar over the first-row-dropped stdout rows', async () => {
    const fs = await import('fs');
    const transcriber = makeTranscriber(async (path) => {
      fs.writeFileSync(`${path}.srt`, SIDECAR_SRT);
      return [REAL_ROWS[1]];
    });

    const result = await transcriber.transcribe(createValidMp3());

    expect(result.placeholder).toBe(false);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({ start: 0, end: 8000 });
    expect(result.segments[0]?.text).toContain('ask not what your country');
    expect(result.segments[1]).toMatchObject({ start: 8000, end: 11000 });
    expect(result.segments[1]?.text).toContain('ask what you can do for your country');
  });

  it('removes the sidecar together with the staged temp file', async () => {
    const fs = await import('fs');
    let sidecar = '';
    const transcriber = makeTranscriber(async (path) => {
      sidecar = `${path}.srt`;
      fs.writeFileSync(sidecar, SIDECAR_SRT);
      return REAL_ROWS;
    });

    await transcriber.transcribe(createValidMp3());

    expect(fs.existsSync(sidecar)).toBe(false);
  });

  it('puts the process cwd back after the backend call (whisper-node execs "./main" from its own dir)', async () => {
    // whisper-node's shell layer execs the RELATIVE "./main", so the real
    // backend runs with the process inside lib/whisper.cpp. The transcriber
    // must leave the cwd where the caller started it, or every later
    // cwd-relative write (scripts, pipeline artifacts) lands in node_modules.
    const os = await import('os');
    const before = process.cwd();
    const transcriber = makeTranscriber(async () => {
      process.chdir(os.tmpdir());
      return REAL_ROWS;
    });

    try {
      const result = await transcriber.transcribe(createValidMp3());

      expect(result.placeholder).toBe(false);
      expect(process.cwd()).toBe(before);
    } finally {
      if (process.cwd() !== before) process.chdir(before);
    }
  });
});

describe('parseWhisperSrtSidecar', () => {
  it('normalizes comma-millisecond SRT stamps to the dot form the row parser accepts', () => {
    const rows = parseWhisperSrtSidecar(
      ['1', '00:00:00,000 --> 00:00:01,500', 'one', '', '2', '00:00:01,500 --> 00:00:02,000', 'two', ''].join('\n')
    );

    expect(rows).toEqual([
      { start: '00:00:00.000', end: '00:00:01.500', speech: 'one' },
      { start: '00:00:01.500', end: '00:00:02.000', speech: 'two' },
    ]);
  });

  it('skips blocks without a stamp line and joins multi-line speech', () => {
    const rows = parseWhisperSrtSidecar(
      ['junk preamble', '', '3', '00:00:05,000 --> 00:00:09,000', 'first line', 'second line', ''].join('\n')
    );

    expect(rows).toEqual([{ start: '00:00:05.000', end: '00:00:09.000', speech: 'first line second line' }]);
  });

  it('returns an empty array for content with no usable block (falls through to stdout rows)', () => {
    expect(parseWhisperSrtSidecar('')).toEqual([]);
    expect(parseWhisperSrtSidecar('no stamps here')).toEqual([]);
  });
});
