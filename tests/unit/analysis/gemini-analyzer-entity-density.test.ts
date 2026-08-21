/**
 * GeminiAnalyzer entityExtractionF1 delegation (Phase 172 / TASK-0258).
 *
 * The detection-time recordMetrics call derives entityExtractionF1 from the
 * canonical density→score scale (scoreNodeDensity in quality-estimators)
 * instead of the previous fabricated `nodes.length > 0 ? 0.85 : 0.3`. That
 * 0.85 exceeded the 0.80 entity threshold on every non-empty extraction, so
 * the entityExtractionF1 gate was permanently green while real quality
 * signals — a singleton extraction (0.70, below the bar) or an over-dense
 * one (>10 → 0.50) — went unreported. These witnesses pin the delegated
 * scale; re-injecting the fabricated pair fails them (MW-040 mutation set).
 *
 * ESM note: the QualityMonitor is intercepted with
 * `jest.unstable_mockModule` + dynamic import of the analyzer (jest.mock is a
 * no-op for import interception in this ESM setup).
 */

import { jest } from '@jest/globals';

/** Module-level mock fn — the factory closure hands this to the analyzer. */
const recordMetricsMock = jest.fn();

jest.unstable_mockModule('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: () => ({
    setPhaseIteration: () => undefined,
    recordMetrics: recordMetricsMock,
    generateReport: () => ({ recommendations: [] }),
    logIteration: () => undefined,
    getLatestMetrics: () => ({}),
  }),
}));

const { GeminiAnalyzer } = await import('@/analysis/gemini-analyzer');
const { LLMService } = await import('@/analysis/llm-service');
type LLMServiceType = InstanceType<typeof LLMService>;

/** Build the parser (private) and run it on an LLM-response JSON payload. */
function parseDiagram(nodes: Array<{ id: string; label: string }>): void {
  const analyzer = new GeminiAnalyzer(
    undefined,
    { isEnabled: () => true } as unknown as LLMServiceType,
  );
  const createEnhancedParser = (
    analyzer as unknown as {
      createEnhancedParser(): (responseText: string) => unknown;
    }
  ).createEnhancedParser();
  createEnhancedParser(JSON.stringify({ type: 'flow', nodes, edges: [] }));
}

describe('GeminiAnalyzer — entityExtractionF1 delegates to scoreNodeDensity', () => {
  beforeEach(() => {
    recordMetricsMock.mockClear();
  });

  it('records 0.90 for a healthy 2–10 node extraction', () => {
    parseDiagram([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ]);

    const payload = recordMetricsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.entityExtractionF1).toBe(0.9);
  });

  it('records 0.70 for a singleton extraction — below the 0.80 entity bar, a real signal', () => {
    // The fabricated predecessor returned 0.85 here: permanently green gate.
    parseDiagram([{ id: 'only', label: 'Only node' }]);

    const payload = recordMetricsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.entityExtractionF1).toBe(0.7);
  });

  it('records 0.50 for an over-dense (>10 node) extraction', () => {
    parseDiagram(
      Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, label: `node ${i}` })),
    );

    const payload = recordMetricsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.entityExtractionF1).toBe(0.5);
  });

  it('records 0 when nothing valid was extracted', () => {
    // Empty nodes array still parses (type present) — extraction produced
    // nothing, which is a hard 0, not the fabricated 0.3 "partial" score and
    // not scoreNodeDensity(0)=0.50 (0.50 is for degenerate density, not for
    // an empty extraction).
    parseDiagram([]);

    const payload = recordMetricsMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.entityExtractionF1).toBe(0);
  });
});
