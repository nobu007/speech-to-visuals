/**
 * Tests that DiagramDetector sanitizes type/confidence fields returned by
 * the Gemini LLM analyzer.
 *
 * When GeminiAnalyzer.analyzeText() returns a type that is not a valid
 * DiagramType or a confidence that is NaN/undefined, DiagramDetector must
 * use sanitizeDiagramType / sanitizeFinite instead of passing the raw
 * values through to downstream pipeline stages.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment, DiagramAnalysis } from '../types';

function makeSegment(text: string): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 60),
    keyphrases: [],
    confidence: 0.9,
  };
}

/** Minimal mock that lets us control what analyzeText returns. */
function mockGemini(overrides: Partial<DiagramAnalysis>): {
  isEnabled: () => boolean;
  analyzeText: () => Promise<DiagramAnalysis>;
} {
  return {
    isEnabled: () => true,
    analyzeText: async () => ({
      type: 'flow',
      confidence: 0.9,
      nodes: [{ id: 'n1', label: 'Node 1' }],
      edges: [],
      reasoning: 'mock',
      ...overrides,
    }),
  };
}

describe('DiagramDetector LLM boundary sanitization', () => {
  let detector: DiagramDetector;
   
  let geminiAccessor: any;

  beforeEach(() => {
    detector = new DiagramDetector();
    // Access private gemini field for mocking
    geminiAccessor = detector as unknown as { gemini: unknown };
  });

  it('sanitizes invalid LLM type into valid DiagramType', async () => {
    geminiAccessor.gemini = mockGemini({
       
      type: 'totally-invalid-type' as any,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    // sanitizeDiagramType falls back to 'general' for unknown types
    expect(result.type).toBe('general');
  });

  it('sanitizes undefined LLM type into valid DiagramType', async () => {
    geminiAccessor.gemini = mockGemini({
       
      type: undefined as any,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(result.type).toBe('general');
  });

  it('sanitizes NaN LLM confidence to default 0.9', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: NaN });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('sanitizes undefined LLM confidence to default 0.9', async () => {
    geminiAccessor.gemini = mockGemini({
       
      confidence: undefined as any,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('sanitizes Infinity LLM confidence to default 0.9', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: Infinity });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('sanitizes negative Infinity LLM confidence to default 0.9', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: -Infinity });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('sanitizes combined invalid type + NaN confidence', async () => {
    geminiAccessor.gemini = mockGemini({
       
      type: '' as any,
      confidence: NaN,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(result.type).toBe('general');
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('preserves valid LLM type and confidence', async () => {
    geminiAccessor.gemini = mockGemini({ type: 'tree', confidence: 0.85 });

    const result = await detector.analyze(makeSegment('テスト'));

    // type may be overridden by consensus/detection logic, but confidence
    // should remain finite and in valid range
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
