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

  test('should accept APNG using PNG signature', () => {
    const result = verifier.verify('apng', makePng());
    expect(result.valid).toBe(true);
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
