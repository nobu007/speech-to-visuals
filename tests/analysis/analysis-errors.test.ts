/**
 * Tests for analysis error classes (src/analysis/analysis-errors.ts)
 *
 * Verifies:
 *  - Correct inheritance hierarchy
 *  - errorType and stage metadata
 *  - context propagation
 *  - LLMParsingError preview extraction
 *  - name property on each subclass
 */

import { describe, it, expect } from '@jest/globals';
import {
  AnalysisError,
  LLMParsingError,
  LLMResponseError,
  DiagramStructureError,
  AnalyzerInitError,
} from '@/analysis/analysis-errors';

describe('AnalysisError base class', () => {
  it('sets name, message, errorType, stage', () => {
    const err = new AnalysisError('test', 'FILE_FORMAT_INVALID', 'test_stage');
    expect(err.name).toBe('AnalysisError');
    expect(err.message).toBe('test');
    expect(err.errorType).toBe('FILE_FORMAT_INVALID');
    expect(err.stage).toBe('test_stage');
    expect(err.context).toBeUndefined();
  });

  it('carries optional context', () => {
    const ctx = { foo: 'bar', count: 42 };
    const err = new AnalysisError('msg', 'LLM_API_ERROR', 's', ctx);
    expect(err.context).toEqual(ctx);
  });

  it('is an instance of Error', () => {
    const err = new AnalysisError('x', 'FILE_FORMAT_INVALID', 'x');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AnalysisError);
  });
});

describe('LLMParsingError', () => {
  it('sets errorType to FILE_FORMAT_INVALID and stage to json_parsing', () => {
    const err = new LLMParsingError('bad json');
    expect(err.errorType).toBe('FILE_FORMAT_INVALID');
    expect(err.stage).toBe('json_parsing');
    expect(err.name).toBe('LLMParsingError');
  });

  it('extracts preview from context when available', () => {
    const err = new LLMParsingError('bad', { preview: 'some text preview' });
    expect(err.preview).toBe('some text preview');
  });

  it('leaves preview undefined when context has no preview', () => {
    const err = new LLMParsingError('bad', { other: 'value' });
    expect(err.preview).toBeUndefined();
  });

  it('leaves preview undefined when no context', () => {
    const err = new LLMParsingError('bad');
    expect(err.preview).toBeUndefined();
  });

  it('ignores non-string preview', () => {
    const err = new LLMParsingError('bad', { preview: 123 });
    expect(err.preview).toBeUndefined();
  });

  it('is an instance of both AnalysisError and Error', () => {
    const err = new LLMParsingError('x');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AnalysisError);
    expect(err).toBeInstanceOf(LLMParsingError);
  });
});

describe('LLMResponseError', () => {
  it('sets errorType to LLM_API_ERROR and stage to llm_response', () => {
    const err = new LLMResponseError('empty response');
    expect(err.errorType).toBe('LLM_API_ERROR');
    expect(err.stage).toBe('llm_response');
    expect(err.name).toBe('LLMResponseError');
  });
});

describe('DiagramStructureError', () => {
  it('sets errorType to FILE_FORMAT_INVALID and stage to diagram_validation', () => {
    const err = new DiagramStructureError('missing nodes');
    expect(err.errorType).toBe('FILE_FORMAT_INVALID');
    expect(err.stage).toBe('diagram_validation');
    expect(err.name).toBe('DiagramStructureError');
  });
});

describe('AnalyzerInitError', () => {
  it('sets errorType to LLM_API_ERROR and stage to analyzer_init', () => {
    const err = new AnalyzerInitError('not initialized');
    expect(err.errorType).toBe('LLM_API_ERROR');
    expect(err.stage).toBe('analyzer_init');
    expect(err.name).toBe('AnalyzerInitError');
  });
});
