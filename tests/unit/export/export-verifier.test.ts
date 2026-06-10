/**
 * Tests for ExportVerifier — REQ-093 export completeness verification.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ExportVerifier,
  verifyExport,
  DEFAULT_VERIFICATION_OPTIONS,
  type VerificationFormat,
  type VerificationResult,
} from '@/export/export-verifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid MP4 ArrayBuffer (ftyp box at offset 4). */
function makeMp4(size = 256): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  // MP4 ftyp magic bytes [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] at offset 4
  const magic = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70];
  magic.forEach((b, i) => { view[4 + i] = b; });
  return buf;
}

/** Build a valid WebM ArrayBuffer (EBML header). */
function makeWebm(size = 256): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  view[0] = 0x1a;
  view[1] = 0x45;
  view[2] = 0xdf;
  view[3] = 0xa3;
  return buf;
}

/** Build a valid GIF89a ArrayBuffer. */
function makeGif(size = 256): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  view[0] = 0x47; // G
  view[1] = 0x49; // I
  view[2] = 0x46; // F
  view[3] = 0x38; // 8
  view[4] = 0x39; // 9
  view[5] = 0x61; // a
  return buf;
}

/** Build a valid PNG ArrayBuffer. */
function makePng(size = 256): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => { view[i] = b; });
  return buf;
}

/** Build a valid PDF ArrayBuffer with at least one page. */
function makePdf(size = 512): ArrayBuffer {
  const text = '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n';
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const buf = new ArrayBuffer(Math.max(size, encoded.length));
  const view = new Uint8Array(buf);
  view.set(encoded);
  return buf;
}

/** Build a valid SVG string. */
function makeSvg(): string {
  return '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
}

/** Build a valid JSON ArrayBuffer padded with spaces to at least minSize bytes. */
function makeJson(obj: unknown = { key: 'value' }, minSize = 200): ArrayBuffer {
  const json = JSON.stringify(obj);
  // Pad with spaces inside the JSON string to keep it valid
  const padded = json + ' '.repeat(Math.max(0, minSize - json.length));
  return new TextEncoder().encode(padded).buffer;
}

/** ArrayBuffer full of zeroes (invalid for any binary format). */
function makeInvalid(size = 256): ArrayBuffer {
  return new ArrayBuffer(size);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportVerifier', () => {
  describe('binary format verification', () => {
    it('accepts a valid MP4 file', () => {
      const v = new ExportVerifier();
      const result = v.verify('mp4', makeMp4());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.magicBytesValid).toBe(true);
    });

    it('rejects an invalid MP4 file', () => {
      const v = new ExportVerifier();
      const result = v.verify('mp4', makeInvalid());
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts a valid WebM file', () => {
      const v = new ExportVerifier();
      const result = v.verify('webm', makeWebm());
      expect(result.valid).toBe(true);
      expect(result.metadata.magicBytesValid).toBe(true);
    });

    it('rejects an invalid WebM file', () => {
      const v = new ExportVerifier();
      const result = v.verify('webm', makeInvalid());
      expect(result.valid).toBe(false);
    });

    it('accepts a valid GIF89a file', () => {
      const v = new ExportVerifier();
      const result = v.verify('gif', makeGif());
      expect(result.valid).toBe(true);
      expect(result.metadata.gifVersion).toBe('89a');
    });

    it('accepts a valid PNG file', () => {
      const v = new ExportVerifier();
      const result = v.verify('png', makePng());
      expect(result.valid).toBe(true);
    });

    it('rejects plain PNG when verified as APNG (missing acTL chunk)', () => {
      const v = new ExportVerifier();
      const result = v.verify('apng', makePng());
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('APNG missing acTL (Animation Control) chunk — not an animated PNG');
    });
  });

  describe('PDF verification', () => {
    it('accepts a valid PDF with at least one page', () => {
      const v = new ExportVerifier();
      const result = v.verify('pdf', makePdf());
      expect(result.valid).toBe(true);
      expect(result.metadata.pdfHeaderValid).toBe(true);
      expect(result.metadata.pageCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects data without %PDF- header', () => {
      const v = new ExportVerifier();
      const result = v.verify('pdf', makeInvalid());
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('%PDF-')]));
    });

    it('rejects PDF with zero pages', () => {
      const v = new ExportVerifier();
      const text = '%PDF-1.4\n trailer\n';
      const buf = new TextEncoder().encode(text).buffer;
      const result = v.verify('pdf', buf);
      expect(result.valid).toBe(false);
    });
  });

  describe('SVG verification', () => {
    it('accepts a valid SVG string', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString(makeSvg());
      expect(result.valid).toBe(true);
      expect(result.format).toBe('svg');
      expect(result.metadata.viewBox).toBe('0 0 100 100');
    });

    it('extracts width and height metadata', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString(makeSvg());
      expect(result.metadata.width).toBe('100');
      expect(result.metadata.height).toBe('100');
    });

    it('rejects empty SVG', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString('');
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('empty')]));
    });

    it('rejects SVG without root element', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString('<div>not an svg</div>');
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('<svg>')]));
    });

    it('rejects SVG without closing tag', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString('<svg xmlns="http://www.w3.org/2000/svg">');
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('</svg>')]));
    });

    it('warns about missing XML declaration', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString('<svg></svg>');
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('XML declaration')]));
    });

    it('detects mismatched svg tags', () => {
      const v = new ExportVerifier();
      const result = v.verifySvgString('<svg><svg></svg>');
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Mismatched')]));
    });

    it('verifies SVG from ArrayBuffer via verify()', () => {
      const v = new ExportVerifier();
      const data = new TextEncoder().encode(makeSvg()).buffer;
      const result = v.verify('svg', data);
      expect(result.valid).toBe(true);
    });
  });

  describe('JSON verification', () => {
    it('accepts valid JSON', () => {
      const v = new ExportVerifier();
      const result = v.verify('json', makeJson({ a: 1, b: 2 }));
      expect(result.valid).toBe(true);
      expect(result.metadata.topLevelKeys).toBe(2);
    });

    it('rejects invalid JSON', () => {
      const v = new ExportVerifier();
      // Pad invalid JSON to exceed minFileSizeBytes (100)
      const text = '{invalid json !!!' + ' '.repeat(200) + '}';
      const data = new TextEncoder().encode(text).buffer;
      const result = v.verify('json', data);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid JSON')]));
    });
  });

  describe('file size checks', () => {
    it('rejects an empty file', () => {
      const v = new ExportVerifier();
      const result = v.verify('mp4', new ArrayBuffer(0));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('empty')]));
    });

    it('rejects files below minimum size', () => {
      const v = new ExportVerifier({ minFileSizeBytes: 500 });
      const result = v.verify('json', makeJson());
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('below minimum')]));
    });

    it('skips format-specific checks when size check fails', () => {
      const v = new ExportVerifier({ minFileSizeBytes: 99999 });
      const result = v.verify('mp4', makeMp4());
      expect(result.valid).toBe(false);
      // Should only have size error, no magic byte error
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('DEFAULT_VERIFICATION_OPTIONS', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_VERIFICATION_OPTIONS.minFileSizeBytes).toBe(100);
      expect(DEFAULT_VERIFICATION_OPTIONS.deepValidation).toBe(true);
      expect(DEFAULT_VERIFICATION_OPTIONS.minPageCount).toBe(1);
    });
  });

  describe('verifyExport convenience function', () => {
    it('delegates to ExportVerifier.verify', () => {
      const result = verifyExport('json', makeJson({ ok: true }));
      expect(result.valid).toBe(true);
    });
  });
});
