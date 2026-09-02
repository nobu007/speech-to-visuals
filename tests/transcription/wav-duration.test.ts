/**
 * TASK-0314 contract tests — WAV header 由来音声長導出 helper (REQ-422 RTF 分母).
 *
 * All expectations are hand-computed from byteRate and data chunk size
 * (durationMs = dataChunkSize / byteRate × 1000) over synthetic bytes, so the
 * pins do not depend on any real audio file. Unit contract: milliseconds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWavHeader, readWavDurationMs } from '../../src/transcription/wav-duration';

interface WavSpec {
  audioFormat?: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** Explicit byteRate override (defaults to sampleRate × channels × bitsPerSample / 8). */
  byteRate?: number;
  dataChunkSize: number;
  /** Chunk emission order; defaults to ['fmt ', 'data']. */
  order?: Array<'fmt ' | 'data'>;
  /** Insert a LIST chunk between the emitted chunks (jfk.wav layout witness). */
  withListChunk?: boolean;
  riffMagic?: string;
  waveMagic?: string;
  /** Declare a data chunk size larger than the appended payload (size 不整合). */
  oversizeDataChunk?: number;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function asciiBytes(text: string): number[] {
  return text.split('').map((c) => c.charCodeAt(0));
}

function buildWav(spec: WavSpec): Uint8Array {
  const {
    channels,
    sampleRate,
    bitsPerSample,
    dataChunkSize,
  } = spec;
  const audioFormat = spec.audioFormat ?? 1;
  const byteRate = spec.byteRate ?? (sampleRate * channels * bitsPerSample) / 8;
  const order = spec.order ?? ['fmt ', 'data'];

  // Assemble as byte segments to avoid spreading huge arrays (stack overflow).
  const segments: Uint8Array[] = [];
  const push = (...parts: number[] | Uint8Array[]) => {
    for (const part of parts) segments.push(part instanceof Uint8Array ? part : new Uint8Array(part));
  };
  const num = (values: number[]) => new Uint8Array(values);
  const lit = (text: string) => new Uint8Array(asciiBytes(text));

  let dataRemaining = dataChunkSize;
  const emitChunk = (id: string, declaredSize: number, payload: Uint8Array) => {
    push(lit(id), num(u32(declaredSize)), payload);
    if (payload.length % 2 === 1) push(num([0])); // word-alignment pad byte
  };
  for (const id of order) {
    if (id === 'fmt ') {
      emitChunk('fmt ', 16, num([
        ...u16(audioFormat),
        ...u16(channels),
        ...u32(sampleRate),
        ...u32(byteRate),
        ...u16((channels * bitsPerSample) / 8), // blockAlign
        ...u16(bitsPerSample),
      ]));
    } else {
      const payload = new Uint8Array(dataRemaining); // zeros
      dataRemaining = 0; // data payload is emitted only once even if listed twice
      emitChunk('data', spec.oversizeDataChunk ?? dataChunkSize, payload);
    }
    if (spec.withListChunk) {
      emitChunk('LIST', 8, lit('INFOtask'));
    }
  }

  const chunkAreaLength = segments.reduce((sum, s) => sum + s.length, 0);
  const out = new Uint8Array(12 + chunkAreaLength);
  out.set(lit(spec.riffMagic ?? 'RIFF'), 0);
  out.set(num(u32(4 + chunkAreaLength)), 4); // 'WAVE' + chunk area
  out.set(lit(spec.waveMagic ?? 'WAVE'), 8);
  let cursor = 12;
  for (const s of segments) {
    out.set(s, cursor);
    cursor += s.length;
  }
  return out;
}

describe('parseWavHeader / readWavDurationMs (TASK-0314)', () => {
  describe('hand-computed duration pins over synthetic bytes', () => {
    test('16kHz mono 16bit: byteRate 32,000 × dataChunkSize 320,000 → exactly 10,000 ms', () => {
      const bytes = buildWav({
        channels: 1,
        sampleRate: 16000,
        bitsPerSample: 16,
        dataChunkSize: 320_000,
        withListChunk: true, // unknown chunks (jfk.wav has LIST) must be skipped by the walk
      });
      // Hand calculation: 320,000 byte ÷ 32,000 byte/s = 10 s = 10,000 ms.
      expect(readWavDurationMs(bytes)).toBe(10_000);
    });

    test('16kHz mono 16bit header fields are reported verbatim', () => {
      const header = parseWavHeader(buildWav({
        channels: 1,
        sampleRate: 16000,
        bitsPerSample: 16,
        dataChunkSize: 320_000,
      }));
      expect(header).toEqual({
        audioFormat: 1,
        channels: 1,
        sampleRate: 16_000,
        byteRate: 32_000,
        bitsPerSample: 16,
        dataChunkSize: 320_000,
      });
    });

    test('44.1kHz stereo 16bit: channel count flows into byteRate (176,400) and the duration pin', () => {
      const bytes = buildWav({
        channels: 2,
        sampleRate: 44_100,
        bitsPerSample: 16,
        dataChunkSize: 176_400,
      });
      // Hand calculation: byteRate = 44,100 × 2 ch × 2 byte = 176,400 byte/s,
      // so 176,400 byte of data is exactly 1 s = 1,000 ms.
      expect(parseWavHeader(bytes).byteRate).toBe(176_400);
      expect(readWavDurationMs(bytes)).toBe(1_000);
    });

    test('duration is NOT rounded when byteRate does not divide dataChunkSize', () => {
      const bytes = buildWav({
        channels: 1,
        sampleRate: 16_000,
        bitsPerSample: 16,
        dataChunkSize: 320_001,
      });
      // 320,001 / 32,000 s = 10.00003125 s — returned as-is; rounding belongs to
      // the report formatting in the caller, not to this helper.
      expect(readWavDurationMs(bytes)).toBe(10_000.03125);
    });
  });

  describe('chunk walk is order-independent', () => {
    test('data before fmt yields the identical header and duration', () => {
      const spec: WavSpec = {
        channels: 1,
        sampleRate: 16_000,
        bitsPerSample: 16,
        dataChunkSize: 320_000,
      };
      const fmtFirst = buildWav({ ...spec, order: ['fmt ', 'data'] });
      const dataFirst = buildWav({ ...spec, order: ['data', 'fmt '] });
      expect(parseWavHeader(dataFirst)).toEqual(parseWavHeader(fmtFirst));
      expect(readWavDurationMs(dataFirst)).toBe(readWavDurationMs(fmtFirst));
    });
  });

  describe('fail-loud contracts (throw, never a guessed duration)', () => {
    const validSpec: WavSpec = {
      channels: 1,
      sampleRate: 16_000,
      bitsPerSample: 16,
      dataChunkSize: 32_000,
    };

    test('audioFormat 3 (IEEE float, non-PCM) throws', () => {
      const bytes = buildWav({ ...validSpec, audioFormat: 3 });
      expect(() => parseWavHeader(bytes)).toThrow(/PCM|audioFormat/i);
      expect(() => readWavDurationMs(bytes)).toThrow(/PCM|audioFormat/i);
    });

    test('corrupted RIFF magic throws', () => {
      const bytes = buildWav({ ...validSpec, riffMagic: 'RIFX' });
      expect(() => parseWavHeader(bytes)).toThrow(/RIFF/);
      expect(() => readWavDurationMs(bytes)).toThrow(/RIFF/);
    });

    test('corrupted WAVE magic throws', () => {
      const bytes = buildWav({ ...validSpec, waveMagic: 'WAVX' });
      expect(() => parseWavHeader(bytes)).toThrow(/WAVE/);
    });

    test('missing data chunk (fmt only) throws', () => {
      const bytes = buildWav({ ...validSpec, order: ['fmt '] });
      expect(() => parseWavHeader(bytes)).toThrow(/data/i);
      expect(() => readWavDurationMs(bytes)).toThrow(/data/i);
    });

    test('missing fmt chunk (data only) throws', () => {
      const bytes = buildWav({ ...validSpec, order: ['data'] });
      expect(() => parseWavHeader(bytes)).toThrow(/fmt/i);
    });

    test('declared chunk size exceeding the byte array throws', () => {
      const bytes = buildWav({ ...validSpec, oversizeDataChunk: 320_000 });
      expect(() => parseWavHeader(bytes)).toThrow(/exceed/i);
      expect(() => readWavDurationMs(bytes)).toThrow(/exceed/i);
    });

    test('byteRate 0 (division-by-zero denominator) throws instead of returning Infinity', () => {
      const bytes = buildWav({ ...validSpec, byteRate: 0 });
      expect(() => readWavDurationMs(bytes)).toThrow(/byteRate/i);
    });

    test('truncated byte array (shorter than the 12-byte RIFF header) throws', () => {
      expect(() => parseWavHeader(new Uint8Array(8))).toThrow(/RIFF|short/i);
    });
  });

  describe('unit contract (×1000 bug class countermeasure)', () => {
    test('source doc comment pins the ms unit for readWavDurationMs', () => {
      // Source-anchored guard: the unit is documented next to the signature so a
      // future s/ms/ drift in either the code or the doc surfaces here.
      const sourcePath = fileURLToPath(new URL('../../src/transcription/wav-duration.ts', import.meta.url));
      const source = readFileSync(sourcePath, 'utf8');
      expect(source).toMatch(/戻り値は.*ms/);
      expect(source).toMatch(/dataChunkSize\s*\/\s*byteRate\s*\*\s*1000/);
    });
  });
});
