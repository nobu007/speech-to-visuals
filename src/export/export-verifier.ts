/**
 * REQ-093: Export Completeness Verification
 *
 * Verifies exported files for format-specific integrity:
 * - Binary formats (MP4/WebM/GIF/APNG): non-zero file size + magic-byte check
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
  | 'json';

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
  mp4:  [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp box (offset 4)
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
