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

import { encodeAPNG, parsePngChunks, type ApngFrameInput } from '@/export/apng-encoder';
import { FormatValidationError } from '@/pipeline/pipeline-errors';

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

    const ihdr = chunks.find(c => c.type === 'IHDR')!;
    expect(ihdr).toBeDefined();

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

    const actl = chunks.find(c => c.type === 'acTL')!;
    const numFrames = (actl.data[0] << 24) | (actl.data[1] << 16) | (actl.data[2] << 8) | actl.data[3];
    expect(numFrames).toBe(2);
  });

  it('defaults numPlays to 0 (infinite loop)', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);

    const actl = chunks.find(c => c.type === 'acTL')!;
    const numPlays = (actl.data[4] << 24) | (actl.data[5] << 16) | (actl.data[6] << 8) | actl.data[7];
    expect(numPlays).toBe(0);
  });

  it('respects numPlays option when provided', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30, numPlays: 5 });
    const chunks = parsePngChunks(buf);

    const actl = chunks.find(c => c.type === 'acTL')!;
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
    const fctl0 = chunks.find(c => c.type === 'fcTL')!;
    const seq0 = (fctl0.data[0] << 24) | (fctl0.data[1] << 16) | (fctl0.data[2] << 8) | fctl0.data[3];
    expect(seq0).toBe(0);

    // fdAT seq should be 2 (fcTL#1 seq=1, fdAT seq=2)
    const fdat = chunks.find(c => c.type === 'fdAT')!;
    const fdatSeq = (fdat.data[0] << 24) | (fdat.data[1] << 16) | (fdat.data[2] << 8) | fdat.data[3];
    expect(fdatSeq).toBe(2);
  });

  // ---- Frame delay ----

  it('computes delay numerator from fps', () => {
    const frame = solidFrame(2, 2, 0, 0, 0);
    const buf = encodeAPNG([frame], { fps: 30 });
    const chunks = parsePngChunks(buf);

    const fctl = chunks.find(c => c.type === 'fcTL')!;
    // delay_num at offset 20 (big-endian u16)
    const delayNum = (fctl.data[20] << 8) | fctl.data[21];
    const delayDen = (fctl.data[22] << 8) | fctl.data[23];
    // 30fps → 33.33ms → delayNum ≈ 3333, delayDen = 100
    expect(delayDen).toBe(100);
    expect(delayNum).toBe(Math.round((1000 / 30) * 100));
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
  it('throws EncodingError on invalid PNG signature', () => {
    const bad = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { EncodingError } = require('@/pipeline/pipeline-errors');
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
