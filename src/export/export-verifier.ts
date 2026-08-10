/**
 * REQ-093: Export Completeness Verification
 * REQ-223: APNG chunk-level & Lottie JSON structural verification
 *
 * Verifies exported files for format-specific integrity:
 * - Binary formats (MP4/WebM/GIF/PNG): non-zero file size + magic-byte check
 * - APNG: PNG signature + acTL/fcTL chunk validation + frame count
 * - Lottie JSON: required root fields (v, fr, ip, op, w, h, layers) + layer structure
 * - SVG: XML well-formedness + root element validation
 * - PDF: %PDF- header + page count validation
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationFormat =
  | 'mp4'
  | 'webm'
  | 'gif'
  | 'apng'
  | 'png'
  | 'svg'
  | 'pdf'
  | 'json'
  | 'lottie';

export interface VerificationOptions {
  /** Minimum acceptable file size in bytes (default 100) */
  minFileSizeBytes: number;
  /** Whether to perform deep content validation (default true) */
  deepValidation: boolean;
  /** Expected minimum page/frame count for multi-page formats (default 1) */
  minPageCount: number;
}

export interface VerificationResult {
  /** Whether the export passed verification */
  valid: boolean;
  /** The format that was verified */
  format: VerificationFormat;
  /** File size in bytes (if available) */
  fileSize: number;
  /** List of errors found */
  errors: string[];
  /** List of warnings (non-fatal issues) */
  warnings: string[];
  /** Format-specific metadata from verification */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Magic-byte constants
// ---------------------------------------------------------------------------

const MAGIC_BYTES: Record<string, number[]> = {
  mp4:  [0x66, 0x74, 0x79, 0x70],                            // "ftyp" at offset 4
  webm: [0x1A, 0x45, 0xDF, 0xA3],                           // EBML header
  gif:  [0x47, 0x49, 0x46],                                  // "GIF"
  png:  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],  // PNG signature
  pdf:  [0x25, 0x50, 0x44, 0x46],                            // "%PDF"
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_VERIFICATION_OPTIONS: VerificationOptions = {
  minFileSizeBytes: 100,
  deepValidation: true,
  minPageCount: 1,
};

// ---------------------------------------------------------------------------
// ExportVerifier
// ---------------------------------------------------------------------------

export class ExportVerifier {
  private readonly options: VerificationOptions;

  constructor(options: Partial<VerificationOptions> = {}) {
    this.options = { ...DEFAULT_VERIFICATION_OPTIONS, ...options };
  }

  /**
   * Verify an exported file given its content as ArrayBuffer.
   * Dispatches to the appropriate format-specific verifier.
   */
  verify(format: VerificationFormat, data: ArrayBuffer): VerificationResult {
    const fileSize = data.byteLength;
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Common: file size check
    if (fileSize === 0) {
      errors.push('Exported file is empty (0 bytes)');
    } else if (fileSize < this.options.minFileSizeBytes) {
      errors.push(
        `Exported file size (${fileSize} bytes) is below minimum (${this.options.minFileSizeBytes} bytes)`,
      );
    }

    // Format-specific checks
    if (errors.length === 0) {
      this.verifyByFormat(format, data, errors, warnings, metadata);
    }

    const valid = errors.length === 0;

    if (valid) {
      logger.info('[ExportVerifier] Verification passed', { format, fileSize });
    } else {
      logger.warn('[ExportVerifier] Verification failed', { format, fileSize, errors });
    }

    return { valid, format, fileSize, errors, warnings, metadata };
  }

  /**
   * Verify an SVG string for XML well-formedness.
   */
  verifySvgString(svgContent: string): VerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: Record<string, unknown> = {};

    const fileSize = new TextEncoder().encode(svgContent).length;

    if (svgContent.trim().length === 0) {
      errors.push('SVG content is empty');
    }

    // Check for SVG root element
    if (!svgContent.includes('<svg')) {
      errors.push('Missing <svg> root element');
    }

    // Check XML declaration (optional but recommended)
    if (!svgContent.includes('<?xml')) {
      warnings.push('Missing XML declaration');
    }

    // Check closing tag
    if (!svgContent.includes('</svg>')) {
      errors.push('Missing closing </svg> tag');
    }

    // Basic XML well-formedness: count opening and closing tags for <svg>
    const svgOpenCount = (svgContent.match(/<svg[\s>]/g) || []).length;
    const svgCloseCount = (svgContent.match(/<\/svg>/g) || []).length;
    if (svgOpenCount !== svgCloseCount) {
      errors.push(
        `Mismatched <svg> tags: ${svgOpenCount} opening, ${svgCloseCount} closing`,
      );
    }

    // Extract metadata
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      metadata.viewBox = viewBoxMatch[1];
    }

    const widthMatch = svgContent.match(/\bwidth="([^"]+)"/);
    const heightMatch = svgContent.match(/\bheight="([^"]+)"/);
    if (widthMatch) metadata.width = widthMatch[1];
    if (heightMatch) metadata.height = heightMatch[1];

    const valid = errors.length === 0;
    return { valid, format: 'svg', fileSize, errors, warnings, metadata };
  }

  // -------
  // Private
  // -------

  private verifyByFormat(
    format: VerificationFormat,
    data: ArrayBuffer,
    errors: string[],
    warnings: string[],
    metadata: Record<string, unknown>,
  ): void {
    switch (format) {
      case 'mp4':
        this.verifyBinary('mp4', data, 4, errors, metadata); // MP4 ftyp at offset 4
        break;
      case 'webm':
        this.verifyBinary('webm', data, 0, errors, metadata);
        break;
      case 'gif':
        this.verifyBinary('gif', data, 0, errors, metadata);
        // Check GIF version
        if (errors.length === 0) {
          const view = new Uint8Array(data);
          const version = String.fromCharCode(view[3], view[4], view[5]);
          metadata.gifVersion = version;
          if (version !== '89a' && version !== '87a') {
            warnings.push(`Unusual GIF version: ${version}`);
          }
        }
        break;
      case 'apng':
        this.verifyBinary('png', data, 0, errors, metadata);
        if (errors.length === 0) {
          this.verifyApngChunks(data, errors, warnings, metadata);
        }
        break;
      case 'png':
        this.verifyBinary('png', data, 0, errors, metadata);
        break;
      case 'pdf':
        this.verifyPdf(data, errors, metadata);
        break;
      case 'svg':
        // SVG from ArrayBuffer — decode to string and validate
        this.verifySvgFromBuffer(data, errors, warnings, metadata);
        break;
      case 'json':
        this.verifyJson(data, errors, metadata);
        break;
      case 'lottie':
        this.verifyLottie(data, errors, warnings, metadata);
        break;
      default:
        warnings.push(`No specific verification for format: ${format}`);
    }
  }

  private verifyBinary(
    formatKey: string,
    data: ArrayBuffer,
    offset: number,
    errors: string[],
    metadata: Record<string, unknown>,
  ): void {
    const expected = MAGIC_BYTES[formatKey];
    if (!expected) return;

    const view = new Uint8Array(data);
    if (view.length < offset + expected.length) {
      errors.push(
        `File too short to contain ${formatKey.toUpperCase()} magic bytes`,
      );
      return;
    }

    for (let i = 0; i < expected.length; i++) {
      if (view[offset + i] !== expected[i]) {
        errors.push(
          `Invalid ${formatKey.toUpperCase()} magic byte at offset ${offset + i}: ` +
          `expected 0x${expected[i].toString(16).padStart(2, '0')}, ` +
          `got 0x${view[offset + i].toString(16).padStart(2, '0')}`,
        );
        return;
      }
    }

    metadata.magicBytesValid = true;
  }

  private verifyPdf(
    data: ArrayBuffer,
    errors: string[],
    metadata: Record<string, unknown>,
  ): void {
    const view = new Uint8Array(data);

    // Check %PDF- header
    const header = '%PDF-';
    for (let i = 0; i < header.length; i++) {
      if (view[i] !== header.charCodeAt(i)) {
        errors.push('Missing %PDF- header');
        return;
      }
    }

    metadata.pdfHeaderValid = true;

    // Count pages by searching for /Type /Page (not /Pages)
    const text = new TextDecoder('latin1').decode(data);
    const pagePattern = /\/Type\s*\/Page(?!s)/g;
    const pageCount = (text.match(pagePattern) || []).length;
    metadata.pageCount = pageCount;

    if (pageCount === 0) {
      errors.push('PDF contains no pages');
    } else if (pageCount < this.options.minPageCount) {
      errors.push(
        `PDF has ${pageCount} page(s), expected at least ${this.options.minPageCount}`,
      );
    }
  }

  private verifySvgFromBuffer(
    data: ArrayBuffer,
    errors: string[],
    warnings: string[],
    metadata: Record<string, unknown>,
  ): void {
    const text = new TextDecoder().decode(data);

    if (!text.includes('<svg')) {
      errors.push('Missing <svg> root element');
    }
    if (!text.includes('</svg>')) {
      errors.push('Missing closing </svg> tag');
    }

    // Extract metadata
    const viewBoxMatch = text.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) metadata.viewBox = viewBoxMatch[1];
  }

  private verifyJson(
    data: ArrayBuffer,
    errors: string[],
    metadata: Record<string, unknown>,
  ): void {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      metadata.topLevelKeys = Object.keys(parsed).length;
    } catch (e) {
      errors.push(
        `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // REQ-223: APNG chunk-level verification
  // ---------------------------------------------------------------------------

  /**
   * Validate APNG-specific chunks (acTL, fcTL) beyond the basic PNG signature.
   *
   * APNG is a valid PNG that additionally contains:
   * - `acTL` (Animation Control) chunk: declares total frames & play count
   * - `fcTL` (Frame Control) chunks: one per animation frame
   */
  private verifyApngChunks(
    data: ArrayBuffer,
    errors: string[],
    warnings: string[],
    metadata: Record<string, unknown>,
  ): void {
    const view = new Uint8Array(data);

    // PNG chunks start after the 8-byte signature.
    // Each chunk: 4-byte length + 4-byte type + data + 4-byte CRC = 12 bytes overhead.
    const PNG_SIG_LEN = 8;
    let offset = PNG_SIG_LEN;
    let foundAcTL = false;
    let fcTLCount = 0;
    let acTLNumFrames = 0;
    let acTLNumPlays = 0;

    while (offset + 12 <= view.length) {
      const chunkLen = readU32BE(view, offset);
      const chunkType = String.fromCharCode(
        view[offset + 4], view[offset + 5], view[offset + 6], view[offset + 7],
      );

      if (chunkType === 'acTL') {
        foundAcTL = true;
        // acTL data: 4 bytes num_frames + 4 bytes num_plays
        if (offset + 8 + 8 <= view.length) {
          acTLNumFrames = readU32BE(view, offset + 8);
          acTLNumPlays = readU32BE(view, offset + 8 + 4);
        }
      } else if (chunkType === 'fcTL') {
        fcTLCount++;
      }

      // Advance: 4 (length) + 4 (type) + chunkLen (data) + 4 (CRC)
      const nextOffset = offset + 4 + 4 + chunkLen + 4;
      if (nextOffset <= offset) break; // overflow guard
      offset = nextOffset;
    }

    metadata.apngHasAcTL = foundAcTL;
    metadata.apngAcTLNumFrames = acTLNumFrames;
    metadata.apngAcTLNumPlays = acTLNumPlays;
    metadata.apngFcTLCount = fcTLCount;

    if (!foundAcTL) {
      errors.push('APNG missing acTL (Animation Control) chunk — not an animated PNG');
      return;
    }

    if (acTLNumFrames === 0) {
      errors.push('APNG acTL declares 0 animation frames');
      return;
    }

    if (fcTLCount === 0) {
      warnings.push('APNG has acTL but no fcTL (Frame Control) chunks found');
    } else if (fcTLCount < acTLNumFrames) {
      warnings.push(
        `APNG fcTL count (${fcTLCount}) less than acTL num_frames (${acTLNumFrames})`,
      );
    }

    if (this.options.deepValidation && fcTLCount > acTLNumFrames) {
      errors.push(
        `APNG fcTL count (${fcTLCount}) exceeds acTL num_frames (${acTLNumFrames})`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // REQ-223: Lottie JSON structural verification
  // ---------------------------------------------------------------------------

  /**
   * Validate a Lottie animation JSON for structural correctness.
   *
   * Required root fields per Lottie 5.x spec:
   * - `v`  : version string (e.g. "5.7.4")
   * - `fr` : frame rate (positive number)
   * - `ip` : in-point frame (number)
   * - `op` : out-point frame (number, must be > ip)
   * - `w`  : width (positive number)
   * - `h`  : height (positive number)
   * - `layers`: array of layer objects
   */
  private verifyLottie(
    data: ArrayBuffer,
    errors: string[],
    warnings: string[],
    metadata: Record<string, unknown>,
  ): void {
    let parsed: Record<string, unknown>;
    try {
      const text = new TextDecoder().decode(data);
      parsed = JSON.parse(text);
    } catch (e) {
      errors.push(
        `Lottie JSON parse error: ${e instanceof Error ? e.message : 'parse error'}`,
      );
      return;
    }

    // Required root fields
    const requiredFields: Array<[string, string]> = [
      ['v', 'version string'],
      ['fr', 'frame rate'],
      ['ip', 'in-point'],
      ['op', 'out-point'],
      ['w', 'width'],
      ['h', 'height'],
      ['layers', 'layers array'],
    ];

    for (const [field, description] of requiredFields) {
      if (parsed[field] === undefined || parsed[field] === null) {
        errors.push(`Lottie missing required field: "${field}" (${description})`);
      }
    }

    // Version check
    if (typeof parsed.v === 'string') {
      metadata.lottieVersion = parsed.v;
      const versionMatch = parsed.v.match(/^(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10);
        if (major < 4 || major > 5) {
          warnings.push(`Lottie version "${parsed.v}" may not be widely supported`);
        }
      }
    }

    // Numeric field validation.
    // Use Number.isFinite (NOT `typeof === 'number'`) because JSON.parse
    // coerces the literal `1e400` to `Infinity`, which `typeof` accepts as
    // a number. Pushing `Infinity` into metadata breaks downstream frame
    // loops (frame count = op * fr overflows) and silently disables the
    // `<= 0` checks below (Infinity > 0). The Lottie spec only ever
    // encodes finite numbers for these fields.
    const fr = parsed.fr;
    if (typeof fr === 'number' && Number.isFinite(fr)) {
      metadata.lottieFrameRate = fr;
      if (fr <= 0) errors.push('Lottie frame rate (fr) must be positive');
    }

    const w = parsed.w;
    const h = parsed.h;
    if (typeof w === 'number' && typeof h === 'number' && Number.isFinite(w) && Number.isFinite(h)) {
      metadata.lottieDimensions = { width: w, height: h };
      if (w <= 0) errors.push('Lottie width (w) must be positive');
      if (h <= 0) errors.push('Lottie height (h) must be positive');
    }

    const ip = parsed.ip;
    const op = parsed.op;
    if (typeof ip === 'number' && typeof op === 'number' && Number.isFinite(ip) && Number.isFinite(op)) {
      metadata.lottieFrameRange = { ip, op };
      if (op <= ip) {
        errors.push('Lottie out-point (op) must be greater than in-point (ip)');
      }
    }

    // Layer validation
    if (Array.isArray(parsed.layers)) {
      metadata.lottieLayerCount = parsed.layers.length;
      if (parsed.layers.length === 0) {
        warnings.push('Lottie has empty layers array — animation will be blank');
      } else if (this.options.deepValidation) {
        for (let i = 0; i < parsed.layers.length; i++) {
          const layer = parsed.layers[i] as Record<string, unknown>;
          const ty = layer.ty;
          const layerIp = layer.ip;
          const layerOp = layer.op;
          if (typeof ty !== 'number' || !Number.isFinite(ty)) {
            errors.push(`Lottie layer[${i}] missing or non-finite required "ty" (type) field`);
          }
          if (typeof layerIp !== 'number' || typeof layerOp !== 'number'
              || !Number.isFinite(layerIp) || !Number.isFinite(layerOp)) {
            warnings.push(`Lottie layer[${i}] missing or non-finite ip/op frame boundaries`);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone verification helper
// ---------------------------------------------------------------------------

/**
 * Convenience function to verify an export result.
 */
export function verifyExport(
  format: VerificationFormat,
  data: ArrayBuffer,
  options?: Partial<VerificationOptions>,
): VerificationResult {
  const verifier = new ExportVerifier(options);
  return verifier.verify(format, data);
}

// ---------------------------------------------------------------------------
// PNG chunk parsing helper
// ---------------------------------------------------------------------------

/** Read a big-endian unsigned 32-bit integer from a Uint8Array. */
function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] << 24) |
    (buf[offset + 1] << 16) |
    (buf[offset + 2] << 8) |
    buf[offset + 3]
  ) >>> 0;
}
