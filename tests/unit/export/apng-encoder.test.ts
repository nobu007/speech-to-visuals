/**
 * APNG encoder tests
 *
 * Verifies the lightweight APNG encoder produces valid binary output:
 * - PNG signature correctness
 * - Chunk structure (IHDR, acTL, fcTL, IDAT, fdAT, IEND)
 * - Error handling for invalid inputs
 * - CRC-32 correctness
 * - Delay calculation from fps
 * - parsePngChunks utility round-trip
 */

import { encodeAPNG, parsePngChunks, type ApngFrameInput, type PngChunkInfo } from '@/export/apng-encoder';
import { FormatValidationError } from '@/pipeline/pipeline-errors';

// Fail-loud chunk lookup: the encoder's contract says every asserted chunk
// type is present in the stream. The old `chunks.find(…)!.data` TypeError
// red; the throw keeps the same RED verdict naming the missing chunk type
// (and the one preceding `expect(ihdr).toBeDefined()` pair folds in).
function requireChunk(chunks: PngChunkInfo[], type: string): PngChunkInfo {
  const chunk = chunks.find((c) => c.type === type);
  if (chunk === undefined) throw new Error(`expected a ${type} chunk in the encoded APNG`);
  return chunk;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a solid-color RGBA frame. */
function solidFrame(width: number, height: number, r: number, g: number, b: number, a = 255): ApngFrameInput {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { data, width, height };
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('encodeAPNG', () => {
  // ---- Validation ----

  it('throws FormatValidationError on empty frames array', () => {
    expect(() => encodeAPNG([], { fps: 30 })).toThrow(FormatValidationError);
    expect(() => encodeAPNG([], { fps: 30 })).toThrow('at least one frame');
  });

  it('throws FormatValidationError on zero fps', () => {
    const frame = solidFrame(2, 2, 0xff, 0, 0);
    expect(() => encodeAPNG([frame], { fps: 0 })).toThrow(FormatValidationError);
    expect(() => encodeAPNG([frame], { fps: 0 })).toThrow('fps must be positive');
  });

  it('throws FormatValidationError on negative fps', () => {
    const frame = solidFrame(2, 2, 0xff, 0, 0);
    expect(() => encodeAPNG([frame], { fps: -1 })).toThrow(FormatValidationError);
  });

  it('throws FormatValidationError on zero-width frame', () => {
    const frame = solidFrame(0, 2, 0, 0, 0);
    expect(() => encodeAPNG([frame], { fps: 30 })).toThrow(FormatValidationError);
    expect(() => encodeAPNG([frame], { fps: 30 })).toThrow('dimensions must be positive');
  });

  it('throws FormatValidationError on zero-height frame', () => {
    const frame = solidFrame(2, 0, 0, 0, 0);
    expect(() => encodeAPNG([frame], { fps: 30 })).toThrow(FormatValidationError);
  });

  // ---- Single-frame output ----

  it('starts with a valid PNG signature', () => {
    const frame = solidFrame(2, 2, 0xff, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    expect(buf.length).toBeGreaterThan(8);
    for (let i = 0; i < 8; i++) {
      expect(buf[i]).toBe(PNG_SIG[i]);
    }
  });

  it('produces correct chunk types for a single frame', () => {
    const frame = solidFrame(4, 4, 0, 0xff, 0);
    const buf = encodeAPNG([frame], { fps: 10 });
    const chunks = parsePngChunks(buf);

    const types = chunks.map(c => c.type);
    expect(types).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'IEND']);
  });

  it('encodes IHDR with correct dimensions and RGBA color type', () => {
    const w = 16;
    const h = 8;
    const frame = solidFrame(w, h, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);

    const ihdr = requireChunk(chunks, 'IHDR');

    // IHDR data: width(4) + height(4) + bitdepth(1) + colortype(1) + compression(1) + filter(1) + interlace(1)
    const dv = ihdr.data;
    const width = (dv[0] << 24) | (dv[1] << 16) | (dv[2] << 8) | dv[3];
    const height = (dv[4] << 24) | (dv[5] << 16) | (dv[6] << 8) | dv[7];
    expect(width).toBe(w);
    expect(height).toBe(h);
    expect(dv[8]).toBe(8);  // bit depth
    expect(dv[9]).toBe(6);  // color type RGBA
  });

  it('encodes acTL with correct frame count', () => {
    const frames = [solidFrame(2, 2, 0xff, 0, 0), solidFrame(2, 2, 0, 0xff, 0)];
    const buf = encodeAPNG(frames, { fps: 10 });
    const chunks = parsePngChunks(buf);

    const actl = requireChunk(chunks, 'acTL');
    const numFrames = (actl.data[0] << 24) | (actl.data[1] << 16) | (actl.data[2] << 8) | actl.data[3];
    expect(numFrames).toBe(2);
  });

  it('defaults numPlays to 0 (infinite loop)', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);

    const actl = requireChunk(chunks, 'acTL');
    const numPlays = (actl.data[4] << 24) | (actl.data[5] << 16) | (actl.data[6] << 8) | actl.data[7];
    expect(numPlays).toBe(0);
  });

  it('respects numPlays option when provided', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30, numPlays: 5 });
    const chunks = parsePngChunks(buf);

    const actl = requireChunk(chunks, 'acTL');
    const numPlays = (actl.data[4] << 24) | (actl.data[5] << 16) | (actl.data[6] << 8) | actl.data[7];
    expect(numPlays).toBe(5);
  });

  // ---- Multi-frame output ----

  it('produces fcTL + fdAT for each additional frame', () => {
    const frames = [
      solidFrame(3, 3, 0xff, 0, 0),
      solidFrame(3, 3, 0, 0xff, 0),
      solidFrame(3, 3, 0, 0, 0xff),
    ];
    const buf = encodeAPNG(frames, { fps: 24 });
    const chunks = parsePngChunks(buf);

    const types = chunks.map(c => c.type);
    // First frame: fcTL + IDAT, subsequent: fcTL + fdAT
    expect(types).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND']);
  });

  it('increments sequence numbers across fcTL and fdAT chunks', () => {
    const frames = [
      solidFrame(2, 2, 0xff, 0, 0),
      solidFrame(2, 2, 0, 0xff, 0),
    ];
    const buf = encodeAPNG(frames, { fps: 10 });
    const chunks = parsePngChunks(buf);

    // First fcTL seq = 0
    const fctl0 = requireChunk(chunks, 'fcTL');
    const seq0 = (fctl0.data[0] << 24) | (fctl0.data[1] << 16) | (fctl0.data[2] << 8) | fctl0.data[3];
    expect(seq0).toBe(0);

    // fdAT seq should be 2 (fcTL#1 seq=1, fdAT seq=2)
    const fdat = requireChunk(chunks, 'fdAT');
    const fdatSeq = (fdat.data[0] << 24) | (fdat.data[1] << 16) | (fdat.data[2] << 8) | fdat.data[3];
    expect(fdatSeq).toBe(2);
  });

  // ---- Frame delay ----

  it('encodes frame delay as the 1/fps rational in seconds', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);

    const fctl = requireChunk(chunks, 'fcTL');
    // delay_num at offset 20, delay_den at offset 22 (big-endian u16).
    // Per the APNG spec the frame delay is delay_num/delay_den in SECONDS, so a
    // 30fps frame (1/30 s ≈ 33.33ms) is encoded as the exact rational 1/30:
    // delayNum=1, delayDen=30. Encoding it as ms (e.g. 3333/100) makes decoders
    // read 33.33 SECONDS per frame — an animation ~1000x too slow.
    const delayNum = (fctl.data[20] << 8) | fctl.data[21];
    const delayDen = (fctl.data[22] << 8) | fctl.data[23];
    expect(delayNum).toBe(1);
    expect(delayDen).toBe(30);
  });

  // ---- Binary integrity ----

  it('ends with IEND chunk', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);
    const last = chunks[chunks.length - 1];
    expect(last.type).toBe('IEND');
    expect(last.data.length).toBe(0);
  });

  it('produces deterministic output for same input', () => {
    const frame = solidFrame(4, 4, 0xab, 0xcd, 0xef);
    const buf1 = encodeAPNG([frame], { fps: 30 });
    const buf2 = encodeAPNG([frame], { fps: 30 });
    expect(buf1).toEqual(buf2);
  });
});

describe('parsePngChunks', () => {
  it('throws EncodingError on invalid PNG signature', async () => {
    const bad = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { EncodingError } = await import('@/pipeline/pipeline-errors');
    expect(() => parsePngChunks(bad)).toThrow(EncodingError);
  });

  it('round-trips: encode then parse yields all expected chunks', () => {
    const frames = [solidFrame(3, 3, 0xff, 0, 0), solidFrame(3, 3, 0, 0, 0xff)];
    const buf = encodeAPNG(frames, { fps: 15, numPlays: 3 });
    const chunks = parsePngChunks(buf);

    expect(chunks.length).toBe(7); // IHDR + acTL + fcTL + IDAT + fcTL + fdAT + IEND
    expect(chunks[0].type).toBe('IHDR');
    expect(chunks[chunks.length - 1].type).toBe('IEND');
  });
});
