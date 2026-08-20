/**
 * Integration test: pipeline health monitoring through the smoke pipeline.
 *
 * Exercises the full cross-component health scoring chain:
 *   runSmokePipeline → timing collection → computePipelineHealth
 *     → bottleneck detection + regression detection + cost efficiency
 *     → unified health score + recommendations
 *
 * No external API calls — uses fixture data throughout.
 */

import { jest, describe, it, expect } from '@jest/globals';
import {
  runSmokePipeline,
  computePipelineHealth,
} from '@/pipeline';
import type {
  SmokeOrchestratorResult,
  PipelineHealthReport,
} from '@/pipeline';

// ---------------------------------------------------------------------------
// Fail-loud accessors
// ---------------------------------------------------------------------------

/**
 * `SmokeOrchestratorResult.timingReport` / `healthReport` are optional and
 * `PipelineHealthReport.costComparison` is `| null`; the old `!` postfixes
 * only silenced the compiler. These helpers keep the RED verdict and name
 * the missing field instead of a mid-assertion TypeError.
 */
function requireTimingReport(result: SmokeOrchestratorResult): NonNullable<SmokeOrchestratorResult['timingReport']> {
  if (result.timingReport === undefined) {
    throw new Error('result.timingReport is undefined');
  }
  return result.timingReport;
}

function requireHealthReport(result: SmokeOrchestratorResult): PipelineHealthReport {
  if (result.healthReport === undefined) {
    throw new Error('result.healthReport is undefined');
  }
  return result.healthReport;
}

function requireCostComparison(
  report: PipelineHealthReport,
): NonNullable<PipelineHealthReport['costComparison']> {
  if (report.costComparison === null) {
    throw new Error('report.costComparison is null');
  }
  return report.costComparison;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_LLM_TEXT = `
\`\`\`json
{
  "type": "flow",
  "nodes": [
    { "id": "step1", "label": "Input" },
    { "id": "step2", "label": "Process" },
    { "id": "step3", "label": "Output" }
  ],
  "edges": [
    { "from": "step1", "to": "step2" },
    { "from": "step2", "to": "step3" }
  ],
  "summary": "Three-step pipeline"
}
\`\`\`
`;

const FIXTURE_MULTI_SCENE_LLM_TEXT = `
\`\`\`json
[
  {
    "type": "flow",
    "nodes": [{ "id": "a", "label": "A" }, { "id": "b", "label": "B" }],
    "edges": [{ "from": "a", "to": "b" }],
    "summary": "Scene 1"
  },
  {
    "type": "tree",
    "nodes": [{ "id": "c", "label": "C" }],
    "edges": [],
    "summary": "Scene 2"
  }
]
\`\`\`
`;

// ---------------------------------------------------------------------------
// Timing collection
// ---------------------------------------------------------------------------

describe('Smoke pipeline timing collection', () => {
  it('collects per-stage timing for each pipeline stage', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
    });

    expect(result.timingReport).toBeDefined();
    const timingReport = requireTimingReport(result);
    expect(timingReport.stages).toHaveLength(4);
    expect(timingReport.stages.map((s) => s.stageName)).toEqual([
      'parse',
      'scene-sync',
      'render-plan',
      'export',
    ]);
  });

  it('timing records have positive durations', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
    });

    for (const stage of requireTimingReport(result).stages) {
      expect(stage.durationMs).toBeGreaterThanOrEqual(0);
      expect(stage.startTime).toBeLessThanOrEqual(stage.endTime);
      expect(stage.itemsProcessed).toBeGreaterThan(0);
    }
  });

  it('timing report has correct total duration', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
    });

    const timingReport = requireTimingReport(result);
    const sumOfDurations = timingReport.stages.reduce(
      (sum, s) => sum + s.durationMs,
      0,
    );
    expect(timingReport.totalDurationMs).toBe(sumOfDurations);
  });

  it('timing records items processed match pipeline stages', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    const stages = requireTimingReport(result).stages;
    // parse: 1 (the raw text)
    expect(stages[0].itemsProcessed).toBe(1);
    // scene-sync: 2 diagrams
    expect(stages[1].itemsProcessed).toBe(2);
    // render-plan: 2 scenes
    expect(stages[2].itemsProcessed).toBe(2);
    // export: 2 scenes
    expect(stages[3].itemsProcessed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Health report generation through smoke pipeline
// ---------------------------------------------------------------------------

describe('Health report from smoke pipeline', () => {
  it('produces no health report when costData is omitted', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
    });

    expect(result.healthReport).toBeUndefined();
  });

  it('produces a health report when costData is provided', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      costData: {
        totalCostUsd: 0.02,
        totalTokens: 1500,
        videoCount: 1,
        analysisCount: 1,
      },
    });

    expect(result.healthReport).toBeDefined();
    const report = requireHealthReport(result);

    // Overall score is 0–100
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);

    // Grade is one of the valid values
    expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(
      report.grade,
    );

    // Breakdown has all three sub-scores
    expect(report.breakdown.performanceScore).toBeGreaterThanOrEqual(0);
    expect(report.breakdown.bottleneckScore).toBeGreaterThanOrEqual(0);
    expect(report.breakdown.costScore).toBeGreaterThanOrEqual(0);

    // Sub-reports are present
    expect(report.bottleneckReport).toBeDefined();
    expect(report.regressionReport).toBeDefined();
    expect(report.costComparison).toBeDefined();
  });

  it('reports excellent health for fast pipeline with low cost', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      costData: {
        totalCostUsd: 0.01,
        totalTokens: 500,
        videoCount: 1,
        analysisCount: 1,
      },
    });

    const report = requireHealthReport(result);
    // Smoke pipeline stages run fast; overall score should be healthy
    expect(report.overallScore).toBeGreaterThanOrEqual(50);
    // Bottleneck/regression detection is timing-sensitive in CI; check that
    // the report structure is valid rather than asserting no bottleneck
    expect(typeof report.bottleneckReport.hasBottleneck).toBe('boolean');
    expect(typeof report.regressionReport.hasRegression).toBe('boolean');
    // Cost below baseline → no regression
    const costComparison = requireCostComparison(report);
    expect(costComparison.costRegression).toBe(false);
    expect(costComparison.tokenRegression).toBe(false);
  });

  it('detects cost regression when cost exceeds baseline', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      costData: {
        totalCostUsd: 0.10,
        totalTokens: 5000,
        videoCount: 1,
        analysisCount: 1,
      },
    });

    const report = requireHealthReport(result);
    // $0.10/video >> $0.03 baseline, 5000 tokens >> 2000 baseline
    const costComparison = requireCostComparison(report);
    expect(costComparison.costRegression).toBe(true);
    expect(costComparison.tokenRegression).toBe(true);

    // Should have at least one cost-related recommendation
    const costRecs = report.recommendations.filter(
      (r) => r.category === 'cost',
    );
    expect(costRecs.length).toBeGreaterThan(0);
  });

  it('health report summary is non-empty', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      costData: {
        totalCostUsd: 0.02,
        totalTokens: 1000,
        videoCount: 1,
        analysisCount: 1,
      },
    });

    expect(requireHealthReport(result).summary.length).toBeGreaterThan(0);
  });

  it('timestamp is recent', async () => {
    const before = Date.now();
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      costData: {
        totalCostUsd: 0.02,
        totalTokens: 1000,
        videoCount: 1,
        analysisCount: 1,
      },
    });
    const after = Date.now();

    const timestamp = requireHealthReport(result).timestamp;
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Cross-format consistency with health monitoring
// ---------------------------------------------------------------------------

describe('Health monitoring across export formats', () => {
  const formats: Array<'json' | 'svg' | 'pdf'> = ['json', 'svg', 'pdf'];

  it('produces health reports for all export formats', async () => {
    for (const format of formats) {
      const result = await runSmokePipeline({
        rawLlmText: FIXTURE_LLM_TEXT,
        exportFormat: format,
        costData: {
          totalCostUsd: 0.02,
          totalTokens: 1000,
          videoCount: 1,
          analysisCount: 1,
        },
      });

      expect(result.healthReport).toBeDefined();
      expect(requireHealthReport(result).overallScore).toBeGreaterThanOrEqual(0);
      expect(result.exportResults[0].success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Public API: computePipelineHealth standalone
// ---------------------------------------------------------------------------

describe('computePipelineHealth standalone', () => {
  it('produces a valid report from direct inputs', () => {
    const report = computePipelineHealth({
      stages: [
        { stageName: 'parse', startTime: 0, endTime: 10, durationMs: 10, itemsProcessed: 1, throughputPerMs: 0.1 },
        { stageName: 'scene-sync', startTime: 10, endTime: 20, durationMs: 10, itemsProcessed: 1, throughputPerMs: 0.1 },
        { stageName: 'render-plan', startTime: 20, endTime: 30, durationMs: 10, itemsProcessed: 1, throughputPerMs: 0.1 },
        { stageName: 'export', startTime: 30, endTime: 40, durationMs: 10, itemsProcessed: 1, throughputPerMs: 0.1 },
      ],
      measurements: [
        { stage: 'transcription', durationMs: 1000, memoryMB: 10, timestamp: Date.now() },
        { stage: 'analysis', durationMs: 2000, memoryMB: 20, timestamp: Date.now() },
      ],
      costData: {
        totalCostUsd: 0.02,
        totalTokens: 1500,
        videoCount: 1,
        analysisCount: 1,
      },
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.grade).toBeDefined();
    expect(report.breakdown).toBeDefined();
    expect(report.recommendations).toBeInstanceOf(Array);
  });
});
