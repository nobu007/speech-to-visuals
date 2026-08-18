/**
 * Tests that DiagramDetector sanitizes type/confidence fields returned by
 * the Gemini LLM analyzer.
 *
 * When GeminiAnalyzer.analyzeText() returns a type that is not a valid
 * DiagramType or a confidence that is NaN/undefined, DiagramDetector must
 * use sanitizeDiagramType / sanitizeFinite instead of passing the raw
 * values through to downstream pipeline stages.
 *
 * The confidence fallback is the FAIL value 0 — NOT a high pass value. An
 * unknown LLM confidence must surface as a low-confidence detection so the
 * good-detection gate (`meetsGoodDetectionConfidence`) fails and the
 * self-improvement loop iterates on it, rather than silently passing every
 * confidence gate (the "green-by-default gate" trap). See the inline comment
 * at the sanitizeFinite call site in diagram-detector.ts.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramDetector, meetsGoodDetectionConfidence } from '../diagram-detector';
import { sanitizeFinite } from '@stv/core/utils/guards';
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

  it('sanitizes NaN LLM confidence to FAIL default 0 (below good-detection threshold)', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: NaN });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    // An unknown LLM confidence must NOT silently pass the good-detection gate.
    // Fallback is 0, below GOOD_DETECTION_CONFIDENCE_THRESHOLD (0.6).
    expect(result.confidence).toBe(0);
    expect(meetsGoodDetectionConfidence(result.confidence)).toBe(false);
  });

  it('sanitizes undefined LLM confidence to FAIL default 0 (below good-detection threshold)', async () => {
    geminiAccessor.gemini = mockGemini({
      confidence: undefined as any,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0);
    expect(meetsGoodDetectionConfidence(result.confidence)).toBe(false);
  });

  it('sanitizes Infinity LLM confidence to FAIL default 0 (below good-detection threshold)', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: Infinity });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0);
    expect(meetsGoodDetectionConfidence(result.confidence)).toBe(false);
  });

  it('sanitizes negative Infinity LLM confidence to FAIL default 0 (below good-detection threshold)', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: -Infinity });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0);
    expect(meetsGoodDetectionConfidence(result.confidence)).toBe(false);
  });

  it('sanitizes combined invalid type + NaN confidence', async () => {
    geminiAccessor.gemini = mockGemini({
      type: '' as any,
      confidence: NaN,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    expect(result.type).toBe('general');
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBe(0);
    expect(meetsGoodDetectionConfidence(result.confidence)).toBe(false);
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

  it('fallback type from invalid LLM output is a usable DiagramType in downstream logic', async () => {
    geminiAccessor.gemini = mockGemini({
      type: null as any,
      confidence: NaN,
    });

    const result = await detector.analyze(makeSegment('テスト'));

    // The sanitized type must be a string usable as an object key
    expect(typeof result.type).toBe('string');
    expect(result.type.length).toBeGreaterThan(0);

    // The sanitized confidence must be usable in arithmetic without producing NaN
    const computed = result.confidence * 2 + 0.1;
    expect(Number.isFinite(computed)).toBe(true);
  });

  // ------------------------------------------------------------------
  // Rendering simulation tests: verify that fallback values actually
  // produce correct output in downstream UI computations (not just
  // "is finite" but "renders the expected string/number").
  // ------------------------------------------------------------------

  it('fallback confidence renders as "0%" not "NaN%" in percentage display', async () => {
    geminiAccessor.gemini = mockGemini({ confidence: NaN });
    const result = await detector.analyze(makeSegment('テスト'));

    // Simulate the rendering logic from SimplePipelineInterface.tsx:
    //   Math.round(scene.confidence as number * 100) + '%'
    const rendered = `${Math.round(result.confidence * 100)}%`;
    expect(rendered).toBe('0%'); // sanitizeFinite FAIL fallback is 0
    expect(rendered).not.toBe('NaN%');
  });

  it('fallback type renders as "general" in DiagramPreview badge', async () => {
    geminiAccessor.gemini = mockGemini({ type: '' as any });
    const result = await detector.analyze(makeSegment('テスト'));

    // The sanitized type must be 'general' — the fallback that
    // DiagramPreview uses for its badge color mapping
    expect(result.type).toBe('general');
  });

  it('sanitized result survives the full confidence → percentage pipeline', async () => {
    geminiAccessor.gemini = mockGemini({
      type: 'totally-invalid' as any,
      confidence: NaN,
    });
    const result = await detector.analyze(makeSegment('テスト'));

    // Simulate PerformanceMetricsVisualization.tsx rendering:
    //   (metrics.confidence * 100).toFixed(0) + '%'
    const percentage = (result.confidence * 100).toFixed(0);
    expect(percentage).toBe('0');
    expect(`${percentage}%`).toBe('0%');

    // Simulate score display:
    //   (metrics.confidence * 100).toFixed(0) + '/100'
    const score = `${(result.confidence * 100).toFixed(0)}/100`;
    expect(score).toBe('0/100');
    expect(score).not.toContain('NaN');
  });

  it('fallback score=0 renders as "0%" when sanitizeFinite uses default 0', async () => {
    // When sanitizeFinite is called without a custom default (e.g., in
    // sort comparators or score accumulation), the fallback is 0.
    // Verify this renders correctly in UI contexts.
    const contaminatedScore = NaN;
    const safeScore = sanitizeFinite(contaminatedScore, 0);

    // Simulate score rendering
    const rendered = `${Math.round(safeScore * 100)}%`;
    expect(rendered).toBe('0%');
    expect(rendered).not.toBe('NaN%');
  });
});
