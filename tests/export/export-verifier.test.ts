/**
 * Tests for REQ-093: Export Completeness Verification
 *
 * Validates binary format verification, SVG validation, PDF verification,
 * JSON validation, and error handling.
 */

import {
  ExportVerifier,
  verifyExport,
  VerificationResult,
  DEFAULT_VERIFICATION_OPTIONS,
} from '../../src/export/export-verifier';

// ---------------------------------------------------------------------------
// Helpers to create synthetic file data
// ---------------------------------------------------------------------------

/** Create a minimal MP4-like buffer with ftyp box at offset 4 */
function makeMp4(size = 1024): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  // Write ftyp at offset 4
  const ftyp = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70];
  for (let i = 0; i < ftyp.length; i++) view[4 + i] = ftyp[i];
  return buf;
}

/** Create a minimal WebM-like buffer with EBML header */
function makeWebM(size = 1024): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  const ebml = [0x1A, 0x45, 0xDF, 0xA3];
  for (let i = 0; i < ebml.length; i++) view[i] = ebml[i];
  return buf;
}

/** Create a minimal GIF89a buffer */
function makeGif(size = 1024): ArrayBuffer {
  const header = 'GIF89a';
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  for (let i = 0; i < header.length; i++) view[i] = header.charCodeAt(i);
  return buf;
}

/** Create a minimal PNG buffer */
function makePng(size = 1024): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < sig.length; i++) view[i] = sig[i];
  return buf;
}

/** Create a minimal PDF buffer with one page */
function makePdf(pageCount = 1): ArrayBuffer {
  let content = '%PDF-1.4\n';
  for (let i = 0; i < pageCount; i++) {
    content += `1 0 obj\n<< /Type /Page >>\nendobj\n`;
  }
  content += '%%EOF\n';
  return new TextEncoder().encode(content).buffer;
}

describe('ExportVerifier', () => {
  let verifier: ExportVerifier;

  beforeEach(() => {
    verifier = new ExportVerifier();
  });

  // -----------------------------------------------------------------------
  // MP4 verification
  // -----------------------------------------------------------------------

  test('should accept valid MP4 data', () => {
    const result = verifier.verify('mp4', makeMp4());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metadata.magicBytesValid).toBe(true);
  });

  test('should reject MP4 with invalid magic bytes', () => {
    const buf = new ArrayBuffer(1024);
    const view = new Uint8Array(buf);
    view[4] = 0xFF; // Wrong byte at ftyp position

    const result = verifier.verify('mp4', buf);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('MP4');
  });

  // -----------------------------------------------------------------------
  // WebM verification
  // -----------------------------------------------------------------------

  test('should accept valid WebM data', () => {
    const result = verifier.verify('webm', makeWebM());
    expect(result.valid).toBe(true);
    expect(result.metadata.magicBytesValid).toBe(true);
  });

  test('should reject WebM with invalid magic bytes', () => {
    const buf = new ArrayBuffer(1024);
    const view = new Uint8Array(buf);
    view[0] = 0x00; // Not EBML

    const result = verifier.verify('webm', buf);
    expect(result.valid).toBe(false);
  });

  // -----------------------------------------------------------------------
  // GIF verification
  // -----------------------------------------------------------------------

  test('should accept valid GIF89a data', () => {
    const result = verifier.verify('gif', makeGif());
    expect(result.valid).toBe(true);
    expect(result.metadata.gifVersion).toBe('89a');
  });

  test('should accept GIF87a and warn about version', () => {
    const header = 'GIF87a';
    const buf = new ArrayBuffer(1024);
    const view = new Uint8Array(buf);
    for (let i = 0; i < header.length; i++) view[i] = header.charCodeAt(i);

    const result = verifier.verify('gif', buf);
    expect(result.valid).toBe(true);
  });

  test('should reject GIF with invalid header', () => {
    const buf = new ArrayBuffer(1024);
    const view = new Uint8Array(buf);
    const wrongHeader = 'XXXXXX';
    for (let i = 0; i < wrongHeader.length; i++) view[i] = wrongHeader.charCodeAt(i);

    const result = verifier.verify('gif', buf);
    expect(result.valid).toBe(false);
  });

  // -----------------------------------------------------------------------
  // PNG/APNG verification
  // -----------------------------------------------------------------------

  test('should accept valid PNG data', () => {
    const result = verifier.verify('png', makePng());
    expect(result.valid).toBe(true);
  });

  test('should reject plain PNG when verified as APNG format (missing acTL)', () => {
    // APNG requires an acTL chunk — a plain PNG is not a valid APNG
    const result = verifier.verify('apng', makePng());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('APNG missing acTL (Animation Control) chunk — not an animated PNG');
  });

  test('should reject PNG with invalid signature', () => {
    const buf = new ArrayBuffer(1024);
    // All zeros — not a PNG
    const result = verifier.verify('png', buf);
    expect(result.valid).toBe(false);
  });

  // -----------------------------------------------------------------------
  // PDF verification
  // -----------------------------------------------------------------------

  test('should accept valid PDF with pages', () => {
    const result = verifier.verify('pdf', makePdf(3));
    expect(result.valid).toBe(true);
    expect(result.metadata.pdfHeaderValid).toBe(true);
    expect(result.metadata.pageCount).toBe(3);
  });

  test('should reject PDF with no pages', () => {
    // Create a PDF with only /Type /Pages (catalog), no /Page
    const content = '%PDF-1.4\n1 0 obj\n<< /Type /Pages >>\nendobj\n%%EOF\n';
    const data = new TextEncoder().encode(content).buffer;
    const v = new ExportVerifier({ minFileSizeBytes: 1 });
    const result = v.verify('pdf', data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('PDF contains no pages');
  });

  test('should reject data without %PDF- header', () => {
    const data = new TextEncoder().encode('Not a PDF file but padded to be large enough to pass size check').buffer;
    const v = new ExportVerifier({ minFileSizeBytes: 1 });
    const result = v.verify('pdf', data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing %PDF- header');
  });

  // -----------------------------------------------------------------------
  // SVG verification
  // -----------------------------------------------------------------------

  test('should accept valid SVG string', () => {
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
    const result = verifier.verifySvgString(svg);
    expect(result.valid).toBe(true);
    expect(result.metadata.viewBox).toBe('0 0 100 100');
  });

  test('should reject SVG without root element', () => {
    const result = verifier.verifySvgString('<div>not an svg</div>');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing <svg> root element');
  });

  test('should reject SVG without closing tag', () => {
    const result = verifier.verifySvgString('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing closing </svg> tag');
  });

  test('should reject empty SVG', () => {
    const result = verifier.verifySvgString('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('SVG content is empty');
  });

  test('should warn about missing XML declaration', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const result = verifier.verifySvgString(svg);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Missing XML declaration');
  });

  // -----------------------------------------------------------------------
  // JSON verification
  // -----------------------------------------------------------------------

  test('should accept valid JSON', () => {
    const data = new TextEncoder().encode('{"key": "value", "nested": {"a": 1}}').buffer;
    const v = new ExportVerifier({ minFileSizeBytes: 1 });
    const result = v.verify('json', data);
    expect(result.valid).toBe(true);
    expect(result.metadata.topLevelKeys).toBe(2);
  });

  test('should reject invalid JSON', () => {
    const data = new TextEncoder().encode('{not valid json but long enough to pass size check}').buffer;
    const v = new ExportVerifier({ minFileSizeBytes: 1 });
    const result = v.verify('json', data);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  // -----------------------------------------------------------------------
  // Common file-size checks
  // -----------------------------------------------------------------------

  test('should reject empty file', () => {
    const result = verifier.verify('mp4', new ArrayBuffer(0));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Exported file is empty (0 bytes)');
  });

  test('should reject file below minimum size', () => {
    const v = new ExportVerifier({ minFileSizeBytes: 1000 });
    const result = v.verify('mp4', makeMp4(50)); // 50 bytes
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('below minimum');
  });

  test('should report file size in result', () => {
    const data = makeMp4(2048);
    const result = verifier.verify('mp4', data);
    expect(result.fileSize).toBe(2048);
  });

  // -----------------------------------------------------------------------
  // Standalone verifyExport function
  // -----------------------------------------------------------------------

  test('verifyExport convenience function should work', () => {
    const result = verifyExport('gif', makeGif());
    expect(result.valid).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Default options
  // -----------------------------------------------------------------------

  test('should use correct default options', () => {
    expect(DEFAULT_VERIFICATION_OPTIONS.minFileSizeBytes).toBe(100);
    expect(DEFAULT_VERIFICATION_OPTIONS.deepValidation).toBe(true);
    expect(DEFAULT_VERIFICATION_OPTIONS.minPageCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Unknown format
  // -----------------------------------------------------------------------

  test('should verify SVG from ArrayBuffer', () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
    const data = new TextEncoder().encode(svgContent).buffer;
    const v = new ExportVerifier({ minFileSizeBytes: 1 });
    const result = v.verify('svg', data);
    expect(result.valid).toBe(true);
    expect(result.metadata.viewBox).toBe('0 0 100 100');
  });
});

// ---------------------------------------------------------------------------
// REQ-223: APNG chunk-level verification
// ---------------------------------------------------------------------------

describe('ExportVerifier – APNG chunk verification (REQ-223)', () => {
  /**
   * Build a minimal APNG buffer:
   * PNG sig + IHDR + acTL + one fcTL + IDAT + IEND
   */
  function makeApng(opts?: { numFrames?: number; numPlays?: number; omitAcTL?: boolean; omitFcTL?: boolean }): ArrayBuffer {
    const numFrames = opts?.numFrames ?? 1;
    const numPlays = opts?.numPlays ?? 0;

    const parts: Uint8Array[] = [];

    // PNG signature (8 bytes)
    parts.push(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

    // IHDR chunk: 1×1 8-bit RGBA
    const ihdrData = new Uint8Array(13);
    ihdrData[0] = 0; ihdrData[1] = 0; ihdrData[2] = 0; ihdrData[3] = 1; // width=1
    ihdrData[4] = 0; ihdrData[5] = 0; ihdrData[6] = 0; ihdrData[7] = 1; // height=1
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 6;  // color type (RGBA)
    parts.push(makePngChunk('IHDR', ihdrData));

    // acTL chunk (animation control)
    if (!opts?.omitAcTL) {
      const actlData = new Uint8Array(8);
      actlData[0] = (numFrames >>> 24) & 0xff;
      actlData[1] = (numFrames >>> 16) & 0xff;
      actlData[2] = (numFrames >>> 8) & 0xff;
      actlData[3] = numFrames & 0xff;
      actlData[4] = (numPlays >>> 24) & 0xff;
      actlData[5] = (numPlays >>> 16) & 0xff;
      actlData[6] = (numPlays >>> 8) & 0xff;
      actlData[7] = numPlays & 0xff;
      parts.push(makePngChunk('acTL', actlData));
    }

    // fcTL chunk (frame control) for first frame
    if (!opts?.omitFcTL) {
      const fctlData = new Uint8Array(26);
      // sequence_number = 0 (4 bytes, all zeros)
      // width = 1 (offset 4)
      fctlData[4] = 0; fctlData[5] = 0; fctlData[6] = 0; fctlData[7] = 1;
      // height = 1 (offset 8)
      fctlData[8] = 0; fctlData[9] = 0; fctlData[10] = 0; fctlData[11] = 1;
      // x_offset = 0, y_offset = 0, delay_num = 1, delay_den = 10
      fctlData[20] = 0; fctlData[21] = 1; // delay_num
      fctlData[22] = 0; fctlData[23] = 10; // delay_den
      fctlData[24] = 0; // dispose_op
      fctlData[25] = 0; // blend_op
      parts.push(makePngChunk('fcTL', fctlData));
    }

    // IDAT chunk: minimal 1×1 RGBA pixel (zlib store)
    const rawRow = new Uint8Array([0, 0, 0, 0, 255]); // filter=0 + RGBA(0,0,0,255)
    const zlibData = zlibStoreCompress(rawRow);
    parts.push(makePngChunk('IDAT', zlibData));

    // IEND
    parts.push(makePngChunk('IEND', new Uint8Array(0)));

    // Concat
    const total = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      result.set(p, offset);
      offset += p.length;
    }
    return result.buffer;
  }

  /** Build a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC */
  function makePngChunk(type: string, data: Uint8Array): Uint8Array {
    const len = data.length;
    const buf = new Uint8Array(4 + 4 + len + 4);
    // Length (BE)
    buf[0] = (len >>> 24) & 0xff;
    buf[1] = (len >>> 16) & 0xff;
    buf[2] = (len >>> 8) & 0xff;
    buf[3] = len & 0xff;
    // Type
    for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
    // Data
    buf.set(data, 8);
    // CRC (over type + data)
    const crc = crc32(buf, 4, 4 + len);
    buf[8 + len] = (crc >>> 24) & 0xff;
    buf[8 + len + 1] = (crc >>> 16) & 0xff;
    buf[8 + len + 2] = (crc >>> 8) & 0xff;
    buf[8 + len + 3] = crc & 0xff;
    return buf;
  }

  /** Minimal zlib "store" (no compression, just header + data + adler32) */
  function zlibStoreCompress(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(2 + 5 + data.length + 4);
    // zlib header: CMF=0x78, FLG=0x01 (no dict, level 0)
    out[0] = 0x78;
    out[1] = 0x01;
    // Stored block: BFINAL=1, BTYPE=00
    const blockLen = data.length;
    out[2] = 0x01; // BFINAL=1, BTYPE=00
    out[3] = blockLen & 0xff;
    out[4] = (blockLen >> 8) & 0xff;
    out[5] = ~blockLen & 0xff;
    out[6] = (~blockLen >> 8) & 0xff;
    out.set(data, 7);
    // Adler-32
    const adler = adler32(data);
    const adlerOffset = 2 + 5 + data.length;
    out[adlerOffset] = (adler >>> 24) & 0xff;
    out[adlerOffset + 1] = (adler >>> 16) & 0xff;
    out[adlerOffset + 2] = (adler >>> 8) & 0xff;
    out[adlerOffset + 3] = adler & 0xff;
    return out;
  }

  // Minimal CRC-32 and Adler-32 for test helpers
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  function crc32(buf: Uint8Array, offset: number, end: number): number {
    let crc = 0xffffffff;
    for (let i = offset; i < end; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function adler32(data: Uint8Array): number {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  }

  let verifier: ExportVerifier;

  beforeEach(() => {
    verifier = new ExportVerifier({ minFileSizeBytes: 1 });
  });

  test('should accept valid APNG with acTL and fcTL', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 1 }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metadata.apngHasAcTL).toBe(true);
    expect(result.metadata.apngAcTLNumFrames).toBe(1);
    expect(result.metadata.apngFcTLCount).toBe(1);
  });

  test('should accept APNG with multiple declared frames', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 3 }));
    expect(result.valid).toBe(true);
    expect(result.metadata.apngAcTLNumFrames).toBe(3);
    // Only 1 fcTL in our test data but numFrames=3 → warning
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('should reject APNG missing acTL chunk', () => {
    const result = verifier.verify('apng', makeApng({ omitAcTL: true }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('APNG missing acTL (Animation Control) chunk — not an animated PNG');
  });

  test('should reject APNG with acTL declaring 0 frames', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('APNG acTL declares 0 animation frames');
  });

  test('should warn when fcTL count is less than acTL num_frames', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 5 }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'APNG fcTL count (1) less than acTL num_frames (5)',
    );
  });

  test('should warn when acTL present but no fcTL chunks', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 1, omitFcTL: true }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('APNG has acTL but no fcTL (Frame Control) chunks found');
  });

  test('should record acTL num_plays metadata', () => {
    const result = verifier.verify('apng', makeApng({ numFrames: 1, numPlays: 3 }));
    expect(result.metadata.apngAcTLNumPlays).toBe(3);
  });

  test('should still accept plain PNG (no acTL) when verified as png format', () => {
    const pngBuf = new ArrayBuffer(200);
    const view = new Uint8Array(pngBuf);
    const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < sig.length; i++) view[i] = sig[i];
    const result = verifier.verify('png', pngBuf);
    expect(result.valid).toBe(true);
    // Plain PNG should not have APNG metadata
    expect(result.metadata.apngHasAcTL).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// REQ-223: Lottie JSON structural verification
// ---------------------------------------------------------------------------

describe('ExportVerifier – Lottie verification (REQ-223)', () => {
  /** Create a valid Lottie JSON buffer */
  function makeLottie(overrides?: Record<string, unknown>): ArrayBuffer {
    const base: Record<string, unknown> = {
      v: '5.7.4',
      fr: 30,
      ip: 0,
      op: 90,
      w: 1920,
      h: 1080,
      nm: 'TestAnimation',
      layers: [
        { ddd: 0, ind: 0, ty: 4, nm: 'Shape Layer 1', sr: 1, ip: 0, op: 90 },
      ],
    };
    const merged = { ...base, ...overrides };
    return new TextEncoder().encode(JSON.stringify(merged)).buffer;
  }

  let verifier: ExportVerifier;

  beforeEach(() => {
    verifier = new ExportVerifier({ minFileSizeBytes: 1 });
  });

  test('should accept valid Lottie JSON', () => {
    const result = verifier.verify('lottie', makeLottie());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metadata.lottieVersion).toBe('5.7.4');
    expect(result.metadata.lottieFrameRate).toBe(30);
    expect(result.metadata.lottieLayerCount).toBe(1);
  });

  test('should extract Lottie metadata', () => {
    const result = verifier.verify('lottie', makeLottie());
    expect(result.metadata.lottieDimensions).toEqual({ width: 1920, height: 1080 });
    expect(result.metadata.lottieFrameRange).toEqual({ ip: 0, op: 90 });
  });

  test('should reject invalid JSON as Lottie', () => {
    const data = new TextEncoder().encode('not json at all but long enough').buffer;
    const result = verifier.verify('lottie', data);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Lottie JSON parse error');
  });

  test('should reject Lottie missing required fields', () => {
    const result = verifier.verify('lottie', makeLottie({ v: undefined, fr: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie missing required field: "v" (version string)');
    expect(result.errors).toContain('Lottie missing required field: "fr" (frame rate)');
  });

  test('should reject Lottie with non-positive frame rate', () => {
    const result = verifier.verify('lottie', makeLottie({ fr: -5 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie frame rate (fr) must be positive');
  });

  test('should reject Lottie where op <= ip', () => {
    const result = verifier.verify('lottie', makeLottie({ ip: 100, op: 50 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie out-point (op) must be greater than in-point (ip)');
  });

  test('should reject Lottie with non-positive width', () => {
    const result = verifier.verify('lottie', makeLottie({ w: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie width (w) must be positive');
  });

  test('should reject Lottie with non-positive height', () => {
    const result = verifier.verify('lottie', makeLottie({ h: -10 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie height (h) must be positive');
  });

  test('should warn about empty layers array', () => {
    const result = verifier.verify('lottie', makeLottie({ layers: [] }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Lottie has empty layers array — animation will be blank');
  });

  test('should warn about unsupported Lottie version', () => {
    const result = verifier.verify('lottie', makeLottie({ v: '3.0.0' }));
    expect(result.warnings).toContain('Lottie version "3.0.0" may not be widely supported');
  });

  test('should accept Lottie version 4.x without warning', () => {
    const result = verifier.verify('lottie', makeLottie({ v: '4.8.0' }));
    expect(result.warnings).not.toContain(expect.stringContaining('may not be widely supported'));
  });

  test('should deep-validate layer structure', () => {
    const badLayers = [
      { nm: 'Layer without ty' }, // missing ty
    ];
    const result = verifier.verify('lottie', makeLottie({ layers: badLayers }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie layer[0] missing required "ty" (type) field');
  });

  test('should warn about layers missing ip/op in deep validation', () => {
    const incompleteLayers = [
      { ty: 4, nm: 'Incomplete Layer' }, // has ty but no ip/op
    ];
    const result = verifier.verify('lottie', makeLottie({ layers: incompleteLayers }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Lottie layer[0] missing ip/op frame boundaries');
  });

  test('should skip layer deep validation when deepValidation is false', () => {
    const v = new ExportVerifier({ minFileSizeBytes: 1, deepValidation: false });
    const badLayers = [{ nm: 'No ty' }];
    const result = v.verify('lottie', makeLottie({ layers: badLayers }));
    // No error for missing ty because deep validation is off
    expect(result.errors).toHaveLength(0);
  });

  test('should handle Lottie with null fields', () => {
    const result = verifier.verify('lottie', makeLottie({ fr: null, w: null }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Lottie missing required field: "fr" (frame rate)');
    expect(result.errors).toContain('Lottie missing required field: "w" (width)');
  });

  test('verifyExport convenience works for Lottie', () => {
    const result = verifyExport('lottie', makeLottie(), { minFileSizeBytes: 1 });
    expect(result.valid).toBe(true);
  });
});
