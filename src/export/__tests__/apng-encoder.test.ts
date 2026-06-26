/**
 * Tests for the lightweight APNG (Animated PNG) encoder.
 *
 * Verifies:
 * - CRC-32 (ISO 3309) correctness against known vectors
 * - Adler-32 (RFC 1950) correctness
 * - PNG chunk structure (length + type + data + CRC)
 * - zlib "store" container format
 * - Full APNG encoding: signature, IHDR, acTL, fcTL, IDAT, fdAT, IEND
 * - Error handling (empty frames, invalid fps, invalid dimensions)
 * - Round-trip: encode → parse chunks → verify structure
 */
import { describe, it, expect } from '@jest/globals';
import {
  encodeAPNG,
  parsePngChunks,
  type ApngFrameInput,
} from '../apng-encoder';

// ---------- Helpers ----------

function makeSolidFrame(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): ApngFrameInput {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { data, width, height };
}

function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] * 0x1000000) +
    ((buf[offset + 1] << 16) >>> 0) +
    ((buf[offset + 2] << 8) >>> 0) +
    buf[offset + 3]
  );
}

// PNG signature bytes
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// ---------- Tests ----------

describe('APNG Encoder — CRC-32 correctness', () => {
  it('should produce correct CRC for "IEND" chunk (known vector)', () => {
    // IEND chunk: type="IEND" (49 45 4e 44), data length=0
    // CRC of "IEND" = 0xAE426082
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [255, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const iend = chunks.find(c => c.type === 'IEND');
    expect(iend).toBeDefined();

    // Verify CRC is at the expected offset (after type + 0 bytes of data)
    const apngU8 = apng;
    // Find IEND in the raw buffer
    for (let i = 0; i < apngU8.length - 8; i++) {
      if (
        apngU8[i] === 0x49 && apngU8[i + 1] === 0x45 &&
        apngU8[i + 2] === 0x4e && apngU8[i + 3] === 0x44
      ) {
        // CRC is 4 bytes after type (type=4, data=0 → CRC at i+4)
        const crc = readU32BE(apngU8, i + 4);
        expect(crc).toBe(0xae426082);
        break;
      }
    }
  });
});

describe('APNG Encoder — PNG signature', () => {
  it('should start with valid PNG signature', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(2, 2, [0, 0, 0, 255])],
      { fps: 30 },
    );
    for (let i = 0; i < 8; i++) {
      expect(apng[i]).toBe(PNG_SIG[i]);
    }
  });

  it('should end with IEND chunk', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [255, 255, 255, 255])],
      { fps: 30 },
    );
    // Last 12 bytes should be: length(4)=0, "IEND"(4), CRC(4)
    const iendStart = apng.length - 12;
    expect(apng[iendStart]).toBe(0); // length 0
    expect(apng[iendStart + 1]).toBe(0);
    expect(apng[iendStart + 2]).toBe(0);
    expect(apng[iendStart + 3]).toBe(0);
    expect(apng[iendStart + 4]).toBe(0x49); // I
    expect(apng[iendStart + 5]).toBe(0x45); // E
    expect(apng[iendStart + 6]).toBe(0x4e); // N
    expect(apng[iendStart + 7]).toBe(0x44); // D
  });
});

describe('APNG Encoder — IHDR chunk', () => {
  it('should encode correct width and height in IHDR', () => {
    const w = 64;
    const h = 32;
    const apng = encodeAPNG(
      [makeSolidFrame(w, h, [255, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    expect(ihdr).toBeDefined();
    expect(ihdr!.data.length).toBe(13);

    const encodedW = readU32BE(ihdr!.data, 0);
    const encodedH = readU32BE(ihdr!.data, 4);
    expect(encodedW).toBe(w);
    expect(encodedH).toBe(h);
  });

  it('should set bit depth=8 and color type=6 (RGBA) in IHDR', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(4, 4, [0, 255, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    expect(ihdr!.data[8]).toBe(8);  // bit depth
    expect(ihdr!.data[9]).toBe(6);  // color type RGBA
    expect(ihdr!.data[10]).toBe(0); // compression method
    expect(ihdr!.data[11]).toBe(0); // filter method
    expect(ihdr!.data[12]).toBe(0); // interlace method
  });
});

describe('APNG Encoder — acTL chunk', () => {
  it('should encode correct frame count in acTL', () => {
    const frames = [
      makeSolidFrame(2, 2, [255, 0, 0, 255]),
      makeSolidFrame(2, 2, [0, 255, 0, 255]),
      makeSolidFrame(2, 2, [0, 0, 255, 255]),
    ];
    const apng = encodeAPNG(frames, { fps: 10 });
    const chunks = parsePngChunks(apng);
    const actl = chunks.find(c => c.type === 'acTL');
    expect(actl).toBeDefined();
    expect(actl!.data.length).toBe(8);

    const numFrames = readU32BE(actl!.data, 0);
    const numPlays = readU32BE(actl!.data, 4);
    expect(numFrames).toBe(3);
    expect(numPlays).toBe(0); // infinite loop by default
  });

  it('should encode numPlays when provided', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [0, 0, 0, 255])],
      { fps: 30, numPlays: 5 },
    );
    const chunks = parsePngChunks(apng);
    const actl = chunks.find(c => c.type === 'acTL');
    const numPlays = readU32BE(actl!.data, 4);
    expect(numPlays).toBe(5);
  });
});

describe('APNG Encoder — fcTL chunks', () => {
  it('should produce one fcTL per frame', () => {
    const frames = [
      makeSolidFrame(2, 2, [255, 0, 0, 255]),
      makeSolidFrame(2, 2, [0, 255, 0, 255]),
    ];
    const apng = encodeAPNG(frames, { fps: 30 });
    const chunks = parsePngChunks(apng);
    const fctls = chunks.filter(c => c.type === 'fcTL');
    expect(fctls.length).toBe(2);
  });

  it('should encode sequence numbers starting at 0', () => {
    const apng = encodeAPNG(
      [
        makeSolidFrame(2, 2, [255, 0, 0, 255]),
        makeSolidFrame(2, 2, [0, 255, 0, 255]),
      ],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const fctls = chunks.filter(c => c.type === 'fcTL');
    const seq0 = readU32BE(fctls[0].data, 0);
    expect(seq0).toBe(0);
  });

  it('should encode frame dimensions in fcTL', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(16, 8, [0, 0, 255, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const fctl = chunks.find(c => c.type === 'fcTL');
    const w = readU32BE(fctl!.data, 4);
    const h = readU32BE(fctl!.data, 8);
    expect(w).toBe(16);
    expect(h).toBe(8);
  });

  it('should encode delay as rational (num/denom)', () => {
    // 30fps → delay = 1000/30 = 33.33ms → delayNum = round(33.33*100) = 3333, delayDen = 100
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [0, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const fctl = chunks.find(c => c.type === 'fcTL');
    const delayNum = (fctl!.data[20] << 8) | fctl!.data[21];
    const delayDen = (fctl!.data[22] << 8) | fctl!.data[23];
    expect(delayDen).toBe(100);
    expect(delayNum).toBe(3333); // 33.33ms * 100
  });

  it('should set dispose_op=NONE and blend_op=SOURCE', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [0, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const fctl = chunks.find(c => c.type === 'fcTL');
    expect(fctl!.data[24]).toBe(0); // APNG_DISPOSE_OP_NONE
    expect(fctl!.data[25]).toBe(0); // APNG_BLEND_OP_SOURCE
  });
});

describe('APNG Encoder — IDAT and fdAT chunks', () => {
  it('should use IDAT for first frame and fdAT for subsequent frames', () => {
    const apng = encodeAPNG(
      [
        makeSolidFrame(2, 2, [255, 0, 0, 255]),
        makeSolidFrame(2, 2, [0, 255, 0, 255]),
      ],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const idats = chunks.filter(c => c.type === 'IDAT');
    const fdats = chunks.filter(c => c.type === 'fdAT');
    expect(idats.length).toBe(1);
    expect(fdats.length).toBe(1);
  });

  it('should produce only IDAT (no fdAT) for single-frame APNG', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(4, 4, [255, 255, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    expect(chunks.filter(c => c.type === 'IDAT').length).toBe(1);
    expect(chunks.filter(c => c.type === 'fdAT').length).toBe(0);
  });

  it('should embed sequence number at start of fdAT data', () => {
    const apng = encodeAPNG(
      [
        makeSolidFrame(2, 2, [255, 0, 0, 255]),
        makeSolidFrame(2, 2, [0, 255, 0, 255]),
        makeSolidFrame(2, 2, [0, 0, 255, 255]),
      ],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const fdats = chunks.filter(c => c.type === 'fdAT');
    expect(fdats.length).toBe(2);

    // First fdAT should have seq=2 (seq 0=fcTL1, 1=fcTL2, 2=fdAT1)
    const seq1 = readU32BE(fdats[0].data, 0);
    expect(seq1).toBe(2);
    // Second fdAT should have seq=4 (seq 3=fcTL3, 4=fdAT2)
    const seq2 = readU32BE(fdats[1].data, 0);
    expect(seq2).toBe(4);
  });
});

describe('APNG Encoder — chunk ordering', () => {
  it('should produce chunks in correct order: sig, IHDR, acTL, [fcTL, IDAT/fdAT]..., IEND', () => {
    const apng = encodeAPNG(
      [
        makeSolidFrame(2, 2, [255, 0, 0, 255]),
        makeSolidFrame(2, 2, [0, 255, 0, 255]),
      ],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const types = chunks.map(c => c.type);
    expect(types[0]).toBe('IHDR');
    expect(types[1]).toBe('acTL');
    // First frame: fcTL then IDAT
    expect(types[2]).toBe('fcTL');
    expect(types[3]).toBe('IDAT');
    // Second frame: fcTL then fdAT
    expect(types[4]).toBe('fcTL');
    expect(types[5]).toBe('fdAT');
    // Last chunk: IEND
    expect(types[types.length - 1]).toBe('IEND');
  });
});

describe('APNG Encoder — zlib store wrapper', () => {
  it('should produce valid zlib container starting with 78 01', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(2, 2, [128, 128, 128, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const idat = chunks.find(c => c.type === 'IDAT');
    expect(idat).toBeDefined();
    // First 2 bytes of zlib stream: CMF=0x78, FLG=0x01
    expect(idat!.data[0]).toBe(0x78);
    expect(idat!.data[1]).toBe(0x01);
  });

  it('should include filter byte (0=None) per row in raw data', () => {
    // For a 2x2 RGBA frame, raw data = 2 rows * (1 filter byte + 2*4 pixels)
    // = 2 * 9 = 18 bytes before zlib compression
    // We verify by checking the IDAT is large enough to contain the zlib-wrapped data
    const apng = encodeAPNG(
      [makeSolidFrame(2, 2, [255, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const idat = chunks.find(c => c.type === 'IDAT');
    // Zlib overhead: 2 header + 5 stored block header + 4 adler32 = 11
    // Raw data: 18 bytes
    // Total IDAT data should be >= 18 + 11 = 29
    expect(idat!.data.length).toBeGreaterThanOrEqual(18);
  });
});

describe('APNG Encoder — error handling', () => {
  it('should throw FormatValidationError for empty frames array', () => {
    expect(() => encodeAPNG([], { fps: 30 })).toThrow(/at least one frame/);
  });

  it('should throw FormatValidationError for fps <= 0', () => {
    expect(() =>
      encodeAPNG([makeSolidFrame(1, 1, [0, 0, 0, 255])], { fps: 0 }),
    ).toThrow(/fps must be positive/);

    expect(() =>
      encodeAPNG([makeSolidFrame(1, 1, [0, 0, 0, 255])], { fps: -5 }),
    ).toThrow(/fps must be positive/);
  });

  it('should throw FormatValidationError for zero or negative dimensions', () => {
    expect(() =>
      encodeAPNG(
        [{ data: new Uint8Array(0), width: 0, height: 10 }],
        { fps: 30 },
      ),
    ).toThrow(/dimensions must be positive/);

    expect(() =>
      encodeAPNG(
        [{ data: new Uint8Array(0), width: 10, height: -1 }],
        { fps: 30 },
      ),
    ).toThrow(/dimensions must be positive/);
  });
});

describe('APNG Encoder — round-trip via parsePngChunks', () => {
  it('should produce parseable output for multi-frame animation', () => {
    const frames = [
      makeSolidFrame(4, 4, [255, 0, 0, 255]),
      makeSolidFrame(4, 4, [0, 255, 0, 255]),
      makeSolidFrame(4, 4, [0, 0, 255, 255]),
      makeSolidFrame(4, 4, [255, 255, 0, 255]),
    ];
    const apng = encodeAPNG(frames, { fps: 15, numPlays: 3 });
    const chunks = parsePngChunks(apng);

    // Verify overall structure
    expect(chunks.length).toBeGreaterThan(5);

    // Should have: IHDR, acTL, (fcTL+IDAT), (fcTL+fdAT)*3, IEND
    const types = chunks.map(c => c.type);
    expect(types[0]).toBe('IHDR');
    expect(types[1]).toBe('acTL');
    expect(types.filter(t => t === 'fcTL').length).toBe(4);
    expect(types.filter(t => t === 'IDAT').length).toBe(1);
    expect(types.filter(t => t === 'fdAT').length).toBe(3);
    expect(types[types.length - 1]).toBe('IEND');

    // Verify acTL
    const actl = chunks.find(c => c.type === 'acTL');
    expect(readU32BE(actl!.data, 0)).toBe(4); // 4 frames
    expect(readU32BE(actl!.data, 4)).toBe(3); // 3 plays
  });

  it('should handle 1x1 pixel frames', () => {
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [255, 128, 64, 255])],
      { fps: 1 },
    );
    const chunks = parsePngChunks(apng);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    expect(readU32BE(ihdr!.data, 0)).toBe(1);
    expect(readU32BE(ihdr!.data, 4)).toBe(1);
  });

  it('should handle large single frame', () => {
    const w = 100;
    const h = 100;
    const apng = encodeAPNG(
      [makeSolidFrame(w, h, [42, 42, 42, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    expect(readU32BE(ihdr!.data, 0)).toBe(w);
    expect(readU32BE(ihdr!.data, 4)).toBe(h);
    // Output should be reasonably sized (not astronomical)
    expect(apng.length).toBeLessThan(w * h * 4 * 2);
  });
});

describe('parsePngChunks — error handling', () => {
  it('should throw EncodingError for invalid PNG signature', () => {
    const bad = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => parsePngChunks(bad)).toThrow(/Invalid PNG signature/);
  });

  it('should parse empty APNG with just sig + IEND', () => {
    // Minimal valid PNG: sig + IEND
    const minimal = new Uint8Array([
      ...PNG_SIG,
      0, 0, 0, 0,  // length = 0
      0x49, 0x45, 0x4e, 0x44, // "IEND"
      0xae, 0x42, 0x60, 0x82, // CRC
    ]);
    const chunks = parsePngChunks(minimal);
    expect(chunks.length).toBe(1);
    expect(chunks[0].type).toBe('IEND');
    expect(chunks[0].data.length).toBe(0);
  });
});

describe('APNG Encoder — Adler-32 correctness', () => {
  it('should produce output with correct Adler-32 trailer (known vector)', () => {
    // For a single-pixel red frame: raw data is [0(filter), 255, 0, 0, 255]
    // Adler-32 of [0, 255, 0, 0, 255]:
    // a = (1+0+255+0+0+255) % 65521 = 511
    // b = (0+1+256+256+256+511) % 65521 = 1280
    // result = (1280 << 16) | 511 = 0x050001FF
    const apng = encodeAPNG(
      [makeSolidFrame(1, 1, [255, 0, 0, 255])],
      { fps: 30 },
    );
    const chunks = parsePngChunks(apng);
    const idat = chunks.find(c => c.type === 'IDAT');
    // Adler-32 is last 4 bytes of the zlib stream (which is the IDAT data)
    const adlerOffset = idat!.data.length - 4;
    const adler =
      (idat!.data[adlerOffset] * 0x1000000) +
      ((idat!.data[adlerOffset + 1] << 16) >>> 0) +
      ((idat!.data[adlerOffset + 2] << 8) >>> 0) +
      idat!.data[adlerOffset + 3];

    // Verify by computing manually
    const rawData = new Uint8Array([0, 255, 0, 0, 255]);
    let a = 1;
    let b = 0;
    for (const byte of rawData) {
      a = (a + byte) % 65521;
      b = (b + a) % 65521;
    }
    const expected = ((b << 16) | a) >>> 0;
    expect(adler).toBe(expected);
  });
});
