/**
 * Phase 63 Integration Tests: Export Typed Errors → ErrorClassifier
 *
 * REQ-166: ExportError, EncodingError, FormatValidationError, and
 * PipelineConfigError (used in production-exporter.ts) round-trip through
 * the ErrorClassifier with correct errorType, stage, severity, and
 * recoverability.
 *
 * Verifies that the export module's typed error classes — now used in
 * apng-encoder.ts, enhanced-export-engine.ts, multi-format-exporter.ts,
 * and production-exporter.ts in place of raw `throw new Error()` — are
 * properly triaged by the ErrorClassifier without regex fallback.
 */

import { jest } from '@jest/globals';
import type { ClassifiedError } from '@/quality/error-classifier';

// ---------- Imports ----------

let ErrorClassifier: typeof import('@/quality/error-classifier').ErrorClassifier;
let ExportError: typeof import('@/pipeline/pipeline-errors').ExportError;
let EncodingError: typeof import('@/pipeline/pipeline-errors').EncodingError;
let FormatValidationError: typeof import('@/pipeline/pipeline-errors').FormatValidationError;
let PipelineConfigError: typeof import('@/pipeline/pipeline-errors').PipelineConfigError;

beforeAll(async () => {
  const ecMod = await import('@/quality/error-classifier');
  ErrorClassifier = ecMod.ErrorClassifier;

  const peMod = await import('@/pipeline/pipeline-errors');
  ExportError = peMod.ExportError;
  EncodingError = peMod.EncodingError;
  FormatValidationError = peMod.FormatValidationError;
  PipelineConfigError = peMod.PipelineConfigError;
});

// ---------- REQ-166: Export Typed Errors → ErrorClassifier ----------

describe('REQ-166: Export typed errors → ErrorClassifier integration', () => {
  let classifier: InstanceType<typeof ErrorClassifier>;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  function classifyThrownError(error: Error): ClassifiedError {
    let classified: ClassifiedError | undefined;
    try {
      throw error;
    } catch (err) {
      if (err instanceof Error) {
        classified = classifier.classify(err);
      }
    }
    expect(classified).toBeDefined();
    return classified!;
  }

  // --- ExportError (replaces raw throws in enhanced-export-engine.ts, multi-format-exporter.ts) ---

  it('ExportError classifies as RENDERING_ERROR with stage export', () => {
    const error = new ExportError('Unsupported format: bmp', 'bmp');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('export');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('ExportError round-trip: throw → catch → classify', () => {
    const error = new ExportError('4K resolution not supported for GIF format', 'gif', {
      resolution: '4k',
    });
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('export');
    expect(classified.suggestedAction).toBeDefined();
    const originalErr = classified.originalError as InstanceType<typeof ExportError>;
    expect(originalErr.format).toBe('gif');
  });

  it('ExportError for canvas context failure', () => {
    const error = new ExportError('Failed to get canvas context', 'png');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('export');
  });

  // --- EncodingError (replaces raw throws in apng-encoder.ts parsePngChunks) ---

  it('EncodingError classifies as RENDERING_ERROR with stage encoding', () => {
    const error = new EncodingError('Invalid PNG signature at byte 3', 'apng');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('encoding');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('EncodingError round-trip: throw → catch → classify', () => {
    const error = new EncodingError('Invalid PNG signature at byte 0', 'apng', {
      byteOffset: 0,
    });
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('RENDERING_ERROR');
    expect(classified.stage).toBe('encoding');
    expect(classified.userMessage).toBeDefined();
    const originalErr = classified.originalError as InstanceType<typeof EncodingError>;
    expect(originalErr.encoder).toBe('apng');
  });

  // --- FormatValidationError (replaces raw throws in apng-encoder.ts, enhanced-export-engine.ts) ---

  it('FormatValidationError classifies as FILE_FORMAT_INVALID with stage export_validation', () => {
    const error = new FormatValidationError('APNG requires at least one frame', 'apng');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('export_validation');
    expect(classified.severity).toBe('medium');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('FormatValidationError round-trip: throw → catch → classify', () => {
    const error = new FormatValidationError('APNG fps must be positive', 'apng');
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('export_validation');
    expect(classified.suggestedAction).toBeTruthy();
  });

  it('FormatValidationError for invalid scene data', () => {
    const error = new FormatValidationError('Invalid scene data provided', 'unknown');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('export_validation');
  });

  it('FormatValidationError for invalid export configuration', () => {
    const error = new FormatValidationError('Invalid export configuration', 'unknown');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('export_validation');
  });

  // --- PipelineConfigError (used in production-exporter.ts for preset not found) ---

  it('PipelineConfigError classifies as FILE_FORMAT_INVALID with stage configuration', () => {
    const error = new PipelineConfigError('presetName', 'Preset not found: ultra-hd');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('configuration');
    expect(classified.severity).toBe('medium');
    expect(classified.recoverable).toBe(true);
  });

  it('PipelineConfigError round-trip: throw → catch → classify', () => {
    const error = new PipelineConfigError('presetName', 'Preset not found: custom');
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('configuration');
    const originalErr = classified.originalError as InstanceType<typeof PipelineConfigError>;
    expect(originalErr.parameter).toBe('presetName');
  });

  // --- Cross-cutting validation ---

  it('all export typed errors produce non-UNKNOWN classification', () => {
    const errors = [
      new ExportError('Unsupported format', 'bmp'),
      new EncodingError('Invalid PNG signature at byte 0', 'apng'),
      new FormatValidationError('Invalid config', 'unknown'),
      new PipelineConfigError('preset', 'Not found'),
    ];

    for (const error of errors) {
      const classified = classifier.classify(error);
      expect(classified.type).not.toBe('UNKNOWN');
      expect(classified.severity).toBeDefined();
      expect(classified.recoverable).toBeDefined();
      expect(classified.suggestedAction).toBeDefined();
    }
  });

  it('batch classification handles mixed export errors correctly', () => {
    const errors = [
      new ExportError('Unsupported format: tiff', 'tiff'),
      new FormatValidationError('APNG requires at least one frame', 'apng'),
      new EncodingError('Invalid PNG signature at byte 2', 'apng'),
      new ExportError('Canvas rendering failed', 'canvas'),
    ];

    const classified = classifier.classifyBatch(errors);

    expect(classified).toHaveLength(4);
    expect(classified[0].type).toBe('RENDERING_ERROR');
    expect(classified[0].stage).toBe('export');
    expect(classified[1].type).toBe('FILE_FORMAT_INVALID');
    expect(classified[1].stage).toBe('export_validation');
    expect(classified[2].type).toBe('RENDERING_ERROR');
    expect(classified[2].stage).toBe('encoding');
    expect(classified[3].type).toBe('RENDERING_ERROR');
    expect(classified[3].stage).toBe('export');
  });

  it('updates classification statistics after export errors', () => {
    classifier.classify(new ExportError('Format error', 'gif'));
    classifier.classify(new FormatValidationError('Invalid frame', 'apng'));
    classifier.classify(new ExportError('Canvas error', 'png'));

    const stats = classifier.getStatistics();

    expect(stats.total).toBe(3);
    expect(stats.byType['RENDERING_ERROR']).toBe(2);
    expect(stats.byType['FILE_FORMAT_INVALID']).toBe(1);
  });

  it('ExportError typed errorType takes precedence over context stage', () => {
    const error = new ExportError('Format not supported', 'webp');
    const classified = classifier.classify(error, { stage: 'some_other_stage' });

    expect(classified.type).toBe('RENDERING_ERROR');
    // Stage should come from the typed error, not the context
    expect(classified.stage).toBe('export');
  });
});
