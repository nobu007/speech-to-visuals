/**
 * Phase 60 Integration Tests: Analysis Typed Errors → ErrorClassifier
 *
 * REQ-158: AnalysisError subclasses (LLMResponseError, DiagramStructureError,
 * AnalyzerInitError) round-trip through the ErrorClassifier with correct
 * errorType, stage, severity, and recoverability.
 *
 * Verifies that the analysis module's typed error classes — now used in
 * llm-service.ts, gemini-analyzer.ts, and language-detector.ts in place of
 * raw `throw new Error()` — are properly triaged by the ErrorClassifier
 * without regex fallback.
 */

import { jest } from '@jest/globals';
import type { ClassifiedError } from '@/quality/error-classifier';

// ---------- Imports ----------

let ErrorClassifier: typeof import('@/quality/error-classifier').ErrorClassifier;
let AnalysisError: typeof import('@/analysis/analysis-errors').AnalysisError;
let LLMResponseError: typeof import('@/analysis/analysis-errors').LLMResponseError;
let DiagramStructureError: typeof import('@/analysis/analysis-errors').DiagramStructureError;
let AnalyzerInitError: typeof import('@/analysis/analysis-errors').AnalyzerInitError;

beforeAll(async () => {
  const ecMod = await import('@/quality/error-classifier');
  ErrorClassifier = ecMod.ErrorClassifier;

  const aeMod = await import('@/analysis/analysis-errors');
  AnalysisError = aeMod.AnalysisError;
  LLMResponseError = aeMod.LLMResponseError;
  DiagramStructureError = aeMod.DiagramStructureError;
  AnalyzerInitError = aeMod.AnalyzerInitError;
});

// ---------- REQ-158: Analysis Typed Errors → ErrorClassifier ----------

describe('REQ-158: AnalysisError subclasses → ErrorClassifier integration', () => {
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
    if (classified === undefined) {
      throw new Error('classifier did not classify the thrown error');
    }
    return classified;
  }

  // --- LLMResponseError (replaces raw throws in llm-service.ts) ---

  it('LLMResponseError classifies as LLM_API_ERROR with stage llm_response', () => {
    const error = new LLMResponseError('Empty response from LLM');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.stage).toBe('llm_response');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('LLMResponseError round-trip: throw → catch → classify', () => {
    const error = new LLMResponseError('Empty response from streaming LLM', {
      streaming: true,
      promptTokens: 150,
    });
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.stage).toBe('llm_response');
    expect(classified.suggestedAction).toBeDefined();
    const originalErr = classified.originalError as InstanceType<typeof LLMResponseError>;
    expect(originalErr.context).toEqual({ streaming: true, promptTokens: 150 });
  });

  // --- DiagramStructureError (replaces raw throw in gemini-analyzer.ts) ---

  it('DiagramStructureError classifies as FILE_FORMAT_INVALID with stage diagram_validation', () => {
    const error = new DiagramStructureError('Invalid diagram data structure from LLM');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('diagram_validation');
    expect(classified.severity).toBe('medium');
    expect(classified.recoverable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('DiagramStructureError round-trip: throw → catch → classify', () => {
    const error = new DiagramStructureError('Missing required nodes array', {
      rawResponse: '{"type":"flow"}',
    });
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('diagram_validation');
    expect(classified.userMessage).toBeDefined();
  });

  // --- AnalyzerInitError (replaces raw throw in language-detector.ts) ---

  it('AnalyzerInitError classifies as LLM_API_ERROR with stage analyzer_init', () => {
    const error = new AnalyzerInitError('Kuromoji tokenizer is not initialized');
    const classified = classifier.classify(error);

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.stage).toBe('analyzer_init');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
  });

  it('AnalyzerInitError round-trip: throw → catch → classify', () => {
    const error = new AnalyzerInitError('Call initializeKuromoji() first.');
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.stage).toBe('analyzer_init');
    expect(classified.suggestedAction).toBeTruthy();
  });

  // --- Cross-cutting validation ---

  it('all AnalysisError subclasses produce non-UNKNOWN classification', () => {
    const errors = [
      new LLMResponseError('Empty response'),
      new DiagramStructureError('Invalid structure'),
      new AnalyzerInitError('Not initialized'),
    ];

    for (const error of errors) {
      const classified = classifier.classify(error);
      expect(classified.type).not.toBe('UNKNOWN');
      expect(classified.severity).toBeDefined();
      expect(classified.recoverable).toBeDefined();
      expect(classified.suggestedAction).toBeDefined();
    }
  });

  it('AnalysisError base class round-trip: throw → classify', () => {
    const error = new AnalysisError(
      'Generic analysis failure',
      'FILE_FORMAT_INVALID',
      'json_parsing',
    );
    const classified = classifyThrownError(error);

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    expect(classified.stage).toBe('json_parsing');
  });

  it('batch classification handles mixed analysis errors correctly', () => {
    const errors = [
      new LLMResponseError('Empty LLM response'),
      new DiagramStructureError('No nodes in diagram'),
      new AnalyzerInitError('Tokenizer not ready'),
      new LLMResponseError('Streaming LLM returned empty'),
    ];

    const classified = classifier.classifyBatch(errors);

    expect(classified).toHaveLength(4);
    expect(classified[0].type).toBe('LLM_API_ERROR');
    expect(classified[1].type).toBe('FILE_FORMAT_INVALID');
    expect(classified[2].type).toBe('LLM_API_ERROR');
    expect(classified[3].type).toBe('LLM_API_ERROR');

    // All have proper stages from the typed error, not 'unknown'
    expect(classified[0].stage).toBe('llm_response');
    expect(classified[1].stage).toBe('diagram_validation');
    expect(classified[2].stage).toBe('analyzer_init');
    expect(classified[3].stage).toBe('llm_response');
  });

  it('updates classification statistics after analysis errors', () => {
    classifier.classify(new LLMResponseError('Empty'));
    classifier.classify(new DiagramStructureError('Invalid'));
    classifier.classify(new LLMResponseError('Also empty'));

    const stats = classifier.getStatistics();

    expect(stats.total).toBe(3);
    expect(stats.byType['LLM_API_ERROR']).toBe(2);
    expect(stats.byType['FILE_FORMAT_INVALID']).toBe(1);
    expect(stats.mostCommonType).toBe('LLM_API_ERROR');
  });

  it('AnalysisError subclass typed errorType takes precedence over context stage', () => {
    const error = new DiagramStructureError('Bad structure');
    // Pass a different stage in context - typed error's own should win
    const classified = classifier.classify(error, { stage: 'some_other_stage' });

    expect(classified.type).toBe('FILE_FORMAT_INVALID');
    // Stage should come from the typed error, not the context
    expect(classified.stage).toBe('diagram_validation');
  });
});
