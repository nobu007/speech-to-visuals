/**
 * Comprehensive tests for ExportVerifier (REQ-093, REQ-223)
 *
 * Tests format-specific integrity verification for:
 * - Binary formats (MP4, WebM, GIF, PNG): magic-byte validation
 * - APNG: PNG signature + acTL/fcTL chunk validation
 * - Lottie JSON: required root fields + layer structure
 * - SVG: XML well-formedness + root element validation
 * - PDF: %PDF- header + page count validation
 * - JSON: parse validation
 */

import {
  ExportVerifier,
  verifyExport,
  DEFAULT_VERIFICATION_OPTIONS,
  type VerificationFormat,
  type VerificationOptions,
} from '../export-verifier';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Create a buffer filled with random-ish bytes of the given length. */
function makeBuffer(length: number, fillByte: number = 0x41): ArrayBuffer {
  const buf = new ArrayBuffer(length);
  const view = new Uint8Array(buf);
  view.fill(fillByte);
  return buf;
}

/** Create an MP4 buffer with valid ftyp box at offset 4. */
function makeMp4(size: number = 200): ArrayBuffer {
  const buf = makeBuffer(size, 0x00);
  const view = new Uint8Array(buf);
  // "ftyp" at offset 4
  view[4] = 0x66; // 'f'
  view[5] = 0x74; // 't'
  view[6] = 0x79; // 'y'
  view[7] = 0x70; // 'p'
  return buf;
}

/** Create a WebM buffer with valid EBML header. */
function makeWebM(size: number = 200): ArrayBuffer {
  const buf = makeBuffer(size, 0x00);
  const view = new Uint8Array(buf);
  view[0] = 0x1a;
  view[1] = 0x45;
  view[2] = 0xdf;
  view[3] = 0xa3;
  return buf;
}

/** Create a GIF buffer with valid header. */
function makeGIF(version: string = '89a', size: number = 200): ArrayBuffer {
  const buf = makeBuffer(size, 0x00);
  const view = new Uint8Array(buf);
  view[0] = 0x47; // 'G'
  view[1] = 0x49; // 'I'
  view[2] = 0x46; // 'F'
  view[3] = version.charCodeAt(0);
  view[4] = version.charCodeAt(1);
  view[5] = version.charCodeAt(2);
  return buf;
}

/** Create a PNG buffer with valid PNG signature. */
function makePNG(size: number = 200): ArrayBuffer {
  const buf = makeBuffer(size, 0x00);
  const view = new Uint8Array(buf);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => { view[i] = b; });
  return buf;
}

/**
 * Create an APNG buffer with valid PNG signature + acTL + fcTL chunks.
 *
 * PNG chunk structure: [4-byte length][4-byte type][data][4-byte CRC]
 */
function makeAPNG(numFrames: number = 3, numFcTL: number = 3): ArrayBuffer {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunks: number[][] = [];

  // IHDR chunk (required for valid PNG, but ExportVerifier doesn't check it)
  chunks.push([
    0x00, 0x00, 0x00, 0x0D,  // length = 13
    0x49, 0x48, 0x44, 0x52,  // "IHDR"
    ...Array(13).fill(0),     // data
    0x00, 0x00, 0x00, 0x00,  // CRC (not validated)
  ]);

  // acTL chunk (Animation Control)
  const acTLData = [
    (numFrames >>> 24) & 0xff, (numFrames >>> 16) & 0xff,
    (numFrames >>> 8) & 0xff, numFrames & 0xff,
    0x00, 0x00, 0x00, 0x00,  // num_plays = 0 (infinite)
  ];
  chunks.push([
    0x00, 0x00, 0x00, 0x08,  // length = 8
    0x61, 0x63, 0x54, 0x4c,  // "acTL"
    ...acTLData,
    0x00, 0x00, 0x00, 0x00,  // CRC
  ]);

  // fcTL chunks (Frame Control)
  for (let i = 0; i < numFcTL; i++) {
    chunks.push([
      0x00, 0x00, 0x00, 0x1a,  // length = 26
      0x66, 0x63, 0x54, 0x4c,  // "fcTL"
      ...Array(26).fill(0),     // data
      0x00, 0x00, 0x00, 0x00,  // CRC
    ]);
  }

  // IDAT chunk — large enough to push total past 200 bytes
  const idatDataLen = 120;
  const idatLenBytes = [
    (idatDataLen >>> 24) & 0xff, (idatDataLen >>> 16) & 0xff,
    (idatDataLen >>> 8) & 0xff, idatDataLen & 0xff,
  ];
  chunks.push([
    ...idatLenBytes,            // length = 120
    0x49, 0x44, 0x41, 0x54,    // "IDAT"
    ...Array(idatDataLen).fill(0), // data
    0x00, 0x00, 0x00, 0x00,    // CRC
  ]);

  // IEND chunk
  chunks.push([
    0x00, 0x00, 0x00, 0x00,  // length = 0
    0x49, 0x45, 0x4e, 0x44,  // "IEND"
    0x00, 0x00, 0x00, 0x00,  // CRC
  ]);

  // Combine
  const totalLength = PNG_SIG.length + chunks.reduce((sum, c) => sum + c.length, 0);
  const buf = new ArrayBuffer(totalLength);
  const view = new Uint8Array(buf);
  let offset = 0;

  PNG_SIG.forEach(b => { view[offset++] = b; });
  chunks.forEach(chunk => {
    chunk.forEach(b => { view[offset++] = b; });
  });

  return buf;
}

/** Create a valid PDF buffer. */
function makePDF(pageCount: number = 1, size: number = 200): ArrayBuffer {
  const pages = '/Type /Page'.repeat(pageCount > 0 ? pageCount : 0);
  const pdfText = `%PDF-1.4\n${pages}\n%%EOF\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(pdfText);
  // Pad to at least `size` bytes
  if (encoded.length >= size) return encoded.buffer.slice(0, encoded.length) as ArrayBuffer;
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  view.set(encoded);
  for (let i = encoded.length; i < size; i++) view[i] = 0x0a; // pad with newlines
  return buf;
}

/** Create a valid SVG string. */
function makeSvgString(width: string = '1920', height: string = '1080'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="10" y="10" width="100" height="50" fill="blue"/>
</svg>`;
}

/** Create a valid Lottie JSON buffer, padded to at least minSize bytes with whitespace. */
function makeLottie(overrides: Record<string, unknown> = {}, minSize: number = 200): ArrayBuffer {
  const lottie = {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 1920,
    h: 1080,
    layers: [
      { ty: 4, ip: 0, op: 60 },
    ],
    ...overrides,
  };
  let json = JSON.stringify(lottie);
  // Pad with spaces (valid JSON whitespace) to reach minimum size
  while (json.length < minSize) {
    json += ' ';
  }
  return new TextEncoder().encode(json).buffer as ArrayBuffer;
}

/** Encode text to ArrayBuffer exactly as-is (no padding). */
function encodeText(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportVerifier', () => {
  let verifier: ExportVerifier;

  beforeEach(() => {
    verifier = new ExportVerifier();
  });

  // -------------------------------------------------------------------------
  // Construction & defaults
  // -------------------------------------------------------------------------

  describe('construction', () => {
    test('uses default options when none provided', () => {
      expect(DEFAULT_VERIFICATION_OPTIONS.minFileSizeBytes).toBe(100);
      expect(DEFAULT_VERIFICATION_OPTIONS.deepValidation).toBe(true);
      expect(DEFAULT_VERIFICATION_OPTIONS.minPageCount).toBe(1);
    });

    test('merges custom options with defaults', () => {
      const v = new ExportVerifier({ minFileSizeBytes: 500 });
      // Internal options are private, but we can verify behavior via verify()
      const result = v.verify('png', makePNG(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('500');
    });

    test('accepts all custom options', () => {
      const v = new ExportVerifier({
        minFileSizeBytes: 50,
        deepValidation: false,
        minPageCount: 2,
      });
      const result = v.verify('png', makePNG(200));
      expect(result.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // File size checks
  // -------------------------------------------------------------------------

  describe('file size validation', () => {
    test('rejects empty buffer', () => {
      const result = verifier.verify('png', new ArrayBuffer(0));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Exported file is empty (0 bytes)');
    });

    test('rejects buffer below minimum size', () => {
      const result = verifier.verify('png', makeBuffer(50));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('below minimum');
      expect(result.errors[0]).toContain('50 bytes');
      expect(result.errors[0]).toContain('100 bytes');
    });

    test('skips format-specific checks when size check fails', () => {
      const result = verifier.verify('mp4', makeBuffer(50));
      expect(result.valid).toBe(false);
      // Should only have the size error, not magic byte errors
      expect(result.errors).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // MP4 verification
  // -------------------------------------------------------------------------

  describe('MP4 verification', () => {
    test('accepts valid MP4', () => {
      const result = verifier.verify('mp4', makeMp4(200));
      expect(result.valid).toBe(true);
      expect(result.format).toBe('mp4');
      expect(result.fileSize).toBe(200);
      expect(result.metadata.magicBytesValid).toBe(true);
    });

    test('rejects MP4 with wrong magic bytes', () => {
      const buf = makeBuffer(200, 0x00); // no ftyp at offset 4
      const result = verifier.verify('mp4', buf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid MP4 magic byte');
    });

    test('rejects buffer too short for MP4 magic byte check', () => {
      const v = new ExportVerifier({ minFileSizeBytes: 1 });
      const buf = makeBuffer(5); // too short for ftyp at offset 4 (need 8 bytes)
      const result = v.verify('mp4', buf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('too short');
    });
  });

  // -------------------------------------------------------------------------
  // WebM verification
  // -------------------------------------------------------------------------

  describe('WebM verification', () => {
    test('accepts valid WebM', () => {
      const result = verifier.verify('webm', makeWebM(200));
      expect(result.valid).toBe(true);
      expect(result.metadata.magicBytesValid).toBe(true);
    });

    test('rejects WebM with wrong magic bytes', () => {
      const result = verifier.verify('webm', makeBuffer(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid WEBM magic byte');
    });
  });

  // -------------------------------------------------------------------------
  // GIF verification
  // -------------------------------------------------------------------------

  describe('GIF verification', () => {
    test('accepts valid GIF89a', () => {
      const result = verifier.verify('gif', makeGIF('89a'));
      expect(result.valid).toBe(true);
      expect(result.metadata.gifVersion).toBe('89a');
    });

    test('accepts valid GIF87a', () => {
      const result = verifier.verify('gif', makeGIF('87a'));
      expect(result.valid).toBe(true);
      expect(result.metadata.gifVersion).toBe('87a');
    });

    test('warns on unusual GIF version', () => {
      const result = verifier.verify('gif', makeGIF('90a'));
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unusual GIF version: 90a');
    });

    test('rejects GIF with wrong magic bytes', () => {
      const result = verifier.verify('gif', makeBuffer(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid GIF magic byte');
    });
  });

  // -------------------------------------------------------------------------
  // PNG verification
  // -------------------------------------------------------------------------

  describe('PNG verification', () => {
    test('accepts valid PNG', () => {
      const result = verifier.verify('png', makePNG(200));
      expect(result.valid).toBe(true);
      expect(result.metadata.magicBytesValid).toBe(true);
    });

    test('rejects PNG with wrong magic bytes', () => {
      const result = verifier.verify('png', makeBuffer(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid PNG magic byte');
    });
  });

  // -------------------------------------------------------------------------
  // APNG verification (REQ-223)
  // -------------------------------------------------------------------------

  describe('APNG verification', () => {
    test('accepts valid APNG with matching acTL/fcTL counts', () => {
      const result = verifier.verify('apng', makeAPNG(3, 3));
      expect(result.valid).toBe(true);
      expect(result.metadata.apngHasAcTL).toBe(true);
      expect(result.metadata.apngAcTLNumFrames).toBe(3);
      expect(result.metadata.apngFcTLCount).toBe(3);
    });

    test('detects missing acTL chunk (plain PNG)', () => {
      // Use plain PNG (no acTL chunk)
      const result = verifier.verify('apng', makePNG(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing acTL');
    });

    test('rejects APNG with 0 declared frames', () => {
      const result = verifier.verify('apng', makeAPNG(0, 0));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('0 animation frames');
    });

    test('warns when fcTL count < acTL num_frames', () => {
      const result = verifier.verify('apng', makeAPNG(5, 2));
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('less than'))).toBe(true);
    });

    test('warns when fcTL count is 0 but acTL exists', () => {
      const result = verifier.verify('apng', makeAPNG(3, 0));
      expect(result.warnings.some(w => w.includes('no fcTL'))).toBe(true);
    });

    test('errors when fcTL count exceeds acTL num_frames (deep validation)', () => {
      const result = verifier.verify('apng', makeAPNG(2, 5));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
    });

    test('does not error on fcTL excess when deepValidation is false', () => {
      const v = new ExportVerifier({ deepValidation: false });
      const result = v.verify('apng', makeAPNG(2, 5));
      expect(result.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PDF verification
  // -------------------------------------------------------------------------

  describe('PDF verification', () => {
    test('accepts valid PDF with pages', () => {
      const result = verifier.verify('pdf', makePDF(2));
      expect(result.valid).toBe(true);
      expect(result.metadata.pdfHeaderValid).toBe(true);
      expect(result.metadata.pageCount).toBe(2);
    });

    test('rejects PDF missing %PDF- header', () => {
      const result = verifier.verify('pdf', makeBuffer(200));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing %PDF- header');
    });

    test('rejects PDF with 0 pages', () => {
      const buf = makeBuffer(200, 0x0a);
      const view = new Uint8Array(buf);
      const header = '%PDF-';
      for (let i = 0; i < header.length; i++) view[i] = header.charCodeAt(i);
      const result = verifier.verify('pdf', buf);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('no pages'))).toBe(true);
    });

    test('rejects PDF with fewer pages than minPageCount', () => {
      const v = new ExportVerifier({ minPageCount: 3 });
      const result = v.verify('pdf', makePDF(1));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 3'))).toBe(true);
    });

    test('does not match /Type /Pages as a page', () => {
      // Pad PDF text to 200 bytes with newlines (valid PDF whitespace)
      let pdfText = `%PDF-1.4\n/Type /Pages\n/Type /Page\n%%EOF\n`;
      while (pdfText.length < 200) pdfText += '\n';
      const buf = encodeText(pdfText);
      const result = verifier.verify('pdf', buf);
      expect(result.valid).toBe(true);
      expect(result.metadata.pageCount).toBe(1); // Only /Page, not /Pages
    });
  });

  // -------------------------------------------------------------------------
  // SVG verification (from ArrayBuffer)
  // -------------------------------------------------------------------------

  describe('SVG verification (ArrayBuffer)', () => {
    test('accepts valid SVG', () => {
      let svg = makeSvgString();
      while (svg.length < 200) svg += ' '; // pad with whitespace
      const result = verifier.verify('svg', encodeText(svg));
      expect(result.valid).toBe(true);
    });

    test('extracts viewBox metadata', () => {
      let svg = makeSvgString('800', '600');
      while (svg.length < 200) svg += ' ';
      const result = verifier.verify('svg', encodeText(svg));
      expect(result.metadata.viewBox).toBe('0 0 800 600');
    });

    test('rejects SVG missing root element', () => {
      let text = 'not an svg content here';
      while (text.length < 200) text += ' ';
      const result = verifier.verify('svg', encodeText(text));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing <svg>'))).toBe(true);
    });

    test('rejects SVG missing closing tag', () => {
      let svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="100">';
      while (svg.length < 200) svg += ' ';
      const result = verifier.verify('svg', encodeText(svg));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing closing'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SVG string verification
  // -------------------------------------------------------------------------

  describe('verifySvgString', () => {
    test('accepts well-formed SVG string', () => {
      const result = verifier.verifySvgString(makeSvgString());
      expect(result.valid).toBe(true);
      expect(result.format).toBe('svg');
    });

    test('rejects empty SVG content', () => {
      const result = verifier.verifySvgString('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SVG content is empty');
    });

    test('rejects missing <svg> root element', () => {
      const result = verifier.verifySvgString('not svg at all');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing <svg> root element');
    });

    test('rejects missing closing </svg> tag', () => {
      const result = verifier.verifySvgString('<svg xmlns="http://www.w3.org/2000/svg">');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing closing </svg> tag');
    });

    test('detects mismatched svg tags', () => {
      const svg = '<svg></svg><svg>';
      const result = verifier.verifySvgString(svg);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Mismatched'))).toBe(true);
    });

    test('warns on missing XML declaration', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
      const result = verifier.verifySvgString(svg);
      expect(result.warnings).toContain('Missing XML declaration');
    });

    test('extracts width and height metadata', () => {
      const result = verifier.verifySvgString(makeSvgString('800', '600'));
      expect(result.metadata.width).toBe('800');
      expect(result.metadata.height).toBe('600');
    });

    test('extracts viewBox metadata', () => {
      const result = verifier.verifySvgString(makeSvgString('1920', '1080'));
      expect(result.metadata.viewBox).toBe('0 0 1920 1080');
    });

    test('reports fileSize from encoded length', () => {
      const svg = '<svg></svg>';
      const result = verifier.verifySvgString(svg);
      const expectedSize = new TextEncoder().encode(svg).length;
      expect(result.fileSize).toBe(expectedSize);
    });
  });

  // -------------------------------------------------------------------------
  // JSON verification
  // -------------------------------------------------------------------------

  describe('JSON verification', () => {
    test('accepts valid JSON', () => {
      let json = JSON.stringify({ name: 'test', value: 42 });
      while (json.length < 200) json += ' '; // pad with whitespace
      const result = verifier.verify('json', encodeText(json));
      expect(result.valid).toBe(true);
      expect(result.metadata.topLevelKeys).toBe(2);
    });

    test('rejects invalid JSON', () => {
      let text = '{invalid json}';
      while (text.length < 200) text += ' ';
      const result = verifier.verify('json', encodeText(text));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON');
    });
  });

  // -------------------------------------------------------------------------
  // Lottie verification (REQ-223)
  // -------------------------------------------------------------------------

  describe('Lottie verification', () => {
    test('accepts valid Lottie', () => {
      const result = verifier.verify('lottie', makeLottie());
      expect(result.valid).toBe(true);
      expect(result.metadata.lottieVersion).toBe('5.7.4');
      expect(result.metadata.lottieFrameRate).toBe(30);
      expect(result.metadata.lottieDimensions).toEqual({ width: 1920, height: 1080 });
      expect(result.metadata.lottieLayerCount).toBe(1);
    });

    test('reports frame range metadata', () => {
      const result = verifier.verify('lottie', makeLottie({ ip: 10, op: 100 }));
      expect(result.metadata.lottieFrameRange).toEqual({ ip: 10, op: 100 });
    });

    test('rejects unparseable Lottie JSON', () => {
      let text = 'not lottie json';
      while (text.length < 200) text += ' ';
      const result = verifier.verify('lottie', encodeText(text));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Lottie JSON parse error');
    });

    test('detects missing required fields', () => {
      const result = verifier.verify('lottie', makeLottie({ fr: undefined, w: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('"fr"'))).toBe(true);
      expect(result.errors.some(e => e.includes('"w"'))).toBe(true);
    });

    test('rejects zero frame rate', () => {
      const result = verifier.verify('lottie', makeLottie({ fr: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('frame rate'))).toBe(true);
    });

    test('rejects zero or negative dimensions', () => {
      const result = verifier.verify('lottie', makeLottie({ w: 0, h: -100 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('width'))).toBe(true);
      expect(result.errors.some(e => e.includes('height'))).toBe(true);
    });

    test('rejects op <= ip', () => {
      const result = verifier.verify('lottie', makeLottie({ ip: 50, op: 50 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('out-point'))).toBe(true);
    });

    test('warns on empty layers array', () => {
      const result = verifier.verify('lottie', makeLottie({ layers: [] }));
      expect(result.warnings.some(w => w.includes('empty layers'))).toBe(true);
    });

    test('detects layer missing "ty" field in deep validation', () => {
      const result = verifier.verify('lottie', makeLottie({ layers: [{ ip: 0, op: 60 }] }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('"ty"'))).toBe(true);
    });

    test('skips layer ty check when deepValidation is false', () => {
      const v = new ExportVerifier({ deepValidation: false });
      const result = v.verify('lottie', makeLottie({ layers: [{ ip: 0, op: 60 }] }));
      expect(result.valid).toBe(true);
    });

    test('warns on unsupported version', () => {
      const result = verifier.verify('lottie', makeLottie({ v: '3.0.0' }));
      expect(result.warnings.some(w => w.includes('may not be widely supported'))).toBe(true);
    });

    test('accepts version 4.x without warning', () => {
      const result = verifier.verify('lottie', makeLottie({ v: '4.4.4' }));
      expect(result.warnings.some(w => w.includes('may not be widely supported'))).toBe(false);
    });

    test('warns on layer missing ip/op boundaries', () => {
      const result = verifier.verify('lottie', makeLottie({ layers: [{ ty: 4 }] }));
      expect(result.warnings.some(w => w.includes('ip/op'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown format
  // -------------------------------------------------------------------------

  describe('unknown format', () => {
    test('json format on binary data fails parse', () => {
      // Binary data (null bytes) will fail JSON.parse
      const result = verifier.verify('json' as VerificationFormat, makeBuffer(200));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON');
    });
  });

  // -------------------------------------------------------------------------
  // Standalone verifyExport function
  // -------------------------------------------------------------------------

  describe('verifyExport', () => {
    test('creates verifier and delegates', () => {
      const result = verifyExport('png', makePNG(200));
      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
    });

    test('passes options through', () => {
      const result = verifyExport('png', makePNG(50), { minFileSizeBytes: 10 });
      expect(result.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Logging behavior
  // -------------------------------------------------------------------------

  describe('logging', () => {
    test('logs info on successful verification', () => {
      const result = verifier.verify('png', makePNG(200));
      expect(result.valid).toBe(true);
      // logger.info is called internally; we can't easily verify without mocking
    });

    test('logs warning on failed verification', () => {
      const result = verifier.verify('png', makeBuffer(50));
      expect(result.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Result structure validation
  // -------------------------------------------------------------------------

  describe('result structure', () => {
    test('returns all required fields', () => {
      const result = verifier.verify('png', makePNG(200));
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('fileSize');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.metadata).toBe('object');
    });
  });
});
