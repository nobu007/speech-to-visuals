/**
 * Unpopulated-contract class — ONE repo-wide census (REQ-392 / Phase 190).
 *
 * The class: an OPTIONAL numeric field whose NAME promises a measurement
 * (`accuracy?`, `qualityScore?`, `cacheHitRate?`, …) declared on a contract
 * interface that NO production site ever populates. REQ-383..387 closed this
 * class site-by-site (assessPerformance legs, memoryUsage producer) after
 * finding each by hand; this census is the audit-pass-first enumeration the
 * steering asked for, in the same shape as the REQ-391 measurement-fixture
 * census and the spine-anchor census:
 *
 *   1. DISCOVERY walks the entire production surface (repo src/ + the
 *      installed @stv/core core-four) for `field?: number` declarations
 *      whose name carries a measurement token (vocabulary shared with the
 *      REQ-391 census, plus f1/completeness) and no config token.
 *   2. PRODUCER CHECK answers, per field name, whether any production line
 *      WRITES the field (object-literal key, `.field =` assignment, or a JSX
 *      prop). Granularity is honest about its ceiling: it is NAME-level, so
 *      it proves a field is name-orphaned (zero writers anywhere) — the
 *      `entityExtractionF1Score` shape — but cannot see WHICH interface a
 *      writer feeds. Interface-level dead legs whose name has writers in
 *      other shapes (`relationAccuracy`, `cacheHitRate`, `currentSize`) are
 *      therefore held by the ERADICATED ledger + negative anchors below,
 *      which their re-introduction would trip.
 *   3. ROSTER: LIVE rows must keep a producer (losing the last one is RED —
 *      a measurement contract went dark); INPUT-CONTRACT rows are optional
 *      component/option inputs where "unset" is a legitimate state (a UI
 *      prop no page passes yet) and must GAIN a reason, and if a producer
 *      ever appears the row must be promoted to LIVE; ERADICATED rows are
 *      the dead legs REQ-392 deleted — their reappearance is RED.
 *
 * A future ground-truth producer MAY re-introduce a deleted field — the
 * census then forces that producer to exist in the same change, which is
 * precisely what REQ-389's "keep the hatch open for ground truth" decision
 * could not guarantee by prose alone.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

/** field-name fragment that promises a measured value (REQ-391 vocabulary + f1/completeness). */
const MEASUREMENT_TOKENS = [
  'accuracy', 'confidence', 'precision', 'recall', 'coverage', 'health',
  'latency', 'throughput', 'usage', 'performance', 'quality', 'gain',
  'effectiveness', 'current', 'prediction', 'complexity', 'score', 'rate',
  'f1', 'completeness',
] as const;

/** field-name fragment that marks CONFIG, not a measurement (REQ-391 vocabulary). */
const CONFIG_TOKENS = [
  'threshold', 'min', 'max', 'target', 'weight', 'limit', 'default',
  'budget', 'factor', 'interval', 'cap',
] as const;

/** An optional numeric contract member: `field?: number` (incl. `number | null`). */
const OPTIONAL_NUMERIC_DECL =
  /^\s*(?:readonly\s+)?([a-z][A-Za-z0-9]*)\?\s*:\s*number\b/;

function isMeasurementFieldName(field: string): boolean {
  const lower = field.toLowerCase();
  if (CONFIG_TOKENS.some((t) => lower.includes(t))) return false;
  return MEASUREMENT_TOKENS.some((t) => lower.includes(t));
}

/** All `file::field` keys on the production surface with an optional numeric measurement-shaped member. */
function discoverContractKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const rel of walkProductionSurface()) {
    readSource(rel).split('\n').forEach((line, idx) => {
      if (isCommentLine(line)) return;
      const m = OPTIONAL_NUMERIC_DECL.exec(line);
      if (!m) return;
      const [, field] = m;
      if (!isMeasurementFieldName(field)) return;
      const key = `${rel}::${field}`;
      const sites = keys.get(key) ?? [];
      sites.push(`${rel}:${idx + 1}`);
      keys.set(key, sites);
    });
  }
  return keys;
}

/**
 * Production lines that WRITE `field`:
 *  - object-literal key whose value is not a bare type annotation
 *    (`memoryUsage: getHeapUsed()` yes, `memoryUsage: number;` no),
 *  - `.field =` assignment,
 *  - JSX prop `field={…}`.
 * Declaration lines (`field?: number`) never count.
 */
function producerSites(field: string): string[] {
  const objLiteral = new RegExp(
    `^\\s*${field}\\s*:(?!\\s*(?:number|string|boolean)\\b)`,
  );
  const assignment = new RegExp(`\\.${field}\\s*=[^=]`);
  const jsxProp = new RegExp(`\\b${field}\\s*=\\s*\\{`);
  const sites: string[] = [];
  for (const rel of walkProductionSurface()) {
    readSource(rel).split('\n').forEach((line, idx) => {
      if (isCommentLine(line)) return;
      if (OPTIONAL_NUMERIC_DECL.test(line)) return;
      if (objLiteral.test(line) || assignment.test(line) || jsxProp.test(line)) {
        sites.push(`${rel}:${idx + 1}`);
      }
    });
  }
  return sites;
}

/** Every discovered optional measurement contract, classified. */
const ROSTER: Record<string, { verdict: 'LIVE' | 'INPUT-CONTRACT' | 'ERADICATED'; reason: string }> = {
  // --- LIVE: measurement contracts with real producers (site cited) ---
  'src/framework/iteration-logger.ts::memoryUsage': {
    verdict: 'LIVE',
    reason: 'IterationLog input fed by SimplePipeline logIteration({ metrics: successMetrics }) — the pipeline QualityMetrics.memoryUsage (MB) every recordMetrics caller writes (SimplePipeline both paths, extractQualityMetrics).',
  },
  'src/pipeline/types.ts::memoryUsage': {
    verdict: 'LIVE',
    reason: 'ExtendedPipelineMetrics bytes contract — MainPipeline’s REQ-387 measured-only producer (peak heap snapshots + fresh memory-backend reading, omit-when-unmeasured).',
  },
  'src/pipeline/types.ts::layoutQualityScore': {
    verdict: 'LIVE',
    reason: 'PipelineOrchestrator averages the per-layout quality scores it computed (scoredCount>0 ? totalScore/scoredCount : 0) — its ONLY producer, so deleting that site must RED here.',
  },
  'src/pipeline/types.ts::labelOverflowScore': {
    verdict: 'LIVE',
    reason: 'PipelineOrchestrator label-overflow aggregate over the measured truncation scan (totalLabels>0 ? …).',
  },
  'src/pipeline/scene-graph-builder.ts::layoutConfidence': {
    verdict: 'LIVE',
    reason: 'SimplePipeline passes `layoutConfidence: lr.confidence` into buildSceneGraph; the builder reads it via the documented `\'layoutConfidence\' in input` presence check (never truthiness).',
  },
  'src/pipeline/simple-pipeline.ts::qualityScore': {
    verdict: 'LIVE',
    reason: 'SimplePipeline result/config legs fed from its own qualityScore computation (confidenceScore: qualityScore/100 boundary) and api/routes/pipeline.ts writers.',
  },
  'src/pipeline/quality-monitor.ts::transcriptionAccuracy': {
    verdict: 'LIVE',
    reason: 'PipelineOrchestrator records the measured mean segment confidence; SimplePipeline records estimateTranscriptionAccuracy(qualitySignals).',
  },
  'src/pipeline/quality-monitor.ts::sceneSegmentationF1': {
    verdict: 'LIVE',
    reason: 'SimplePipeline records estimateSegmentationQuality(qualitySignals) (canonical quality-estimators delegation).',
  },
  'src/pipeline/quality-monitor.ts::entityExtractionF1': {
    verdict: 'LIVE',
    reason: 'gemini-analyzer records scoreNodeDensity(nodes.length) (canonical density→score scale, empty extraction hard 0); PipelineOrchestrator records measured mean diagram confidence.',
  },
  'src/pipeline/quality-monitor.ts::relationshipAccuracy': {
    verdict: 'LIVE',
    reason: 'gemini-analyzer records the diagram relation confidence on every detection sample (its only producer).',
  },
  'src/pipeline/quality-monitor.ts::edgeCompleteness': {
    verdict: 'LIVE',
    reason: 'gemini-analyzer records the measured edge ratio as completeness on every detection sample.',
  },
  'src/pipeline/quality-monitor.ts::edgeRatioQuality': {
    verdict: 'LIVE',
    reason: 'gemini-analyzer records the measured edge ratio (same scan, ratio reading) on every detection sample.',
  },
  'src/pipeline/quality-monitor.ts::confidenceScore': {
    verdict: 'LIVE',
    reason: 'SimplePipeline publishes qualityScore/100 on the success path and the disclosed fail-closed 0 on the failure path.',
  },
  'src/components/PipelineProgress.tsx::qualityScore': {
    verdict: 'LIVE',
    reason: 'Progress payload written by api/routes/pipeline.ts (`qualityScore` assign/obj sites) and read for display.',
  },
  'src/components/Iteration43Interface.tsx::accuracy': {
    verdict: 'LIVE',
    reason: 'Iteration event metrics payload produced by main-pipeline’s evaluateIteration accuracy leg; the demo UI only displays it.',
  },
  'src/components/Iteration43Interface.tsx::performance': {
    verdict: 'LIVE',
    reason: 'Iteration event metrics payload leg (performance assessors) produced by the framework pipelines; display-only in the UI.',
  },
  'src/components/Iteration43Interface.tsx::quality': {
    verdict: 'LIVE',
    reason: 'Iteration event metrics payload leg produced by the framework pipelines; display-only in the UI.',
  },
  'src/components/PerformanceMetricsVisualization.tsx::quality': {
    verdict: 'LIVE',
    reason: 'Display prop fed by pipeline result payloads (`quality:` writers across video-generator / api routes / simple-pipeline).',
  },
  'src/remotion/NodeAnimation.tsx::currentFrame': {
    verdict: 'LIVE',
    reason: 'actual-video-renderer passes the live frame into every animation prop object (currentFrame writers in its scene builders).',
  },
  'src/remotion/EdgeAnimation.tsx::currentFrame': {
    verdict: 'LIVE',
    reason: 'actual-video-renderer passes the live frame into every animation prop object (same writers as NodeAnimation).',
  },
  'src/monitoring/health-check-service.ts::latency': {
    verdict: 'LIVE',
    reason: 'Every component check returns `latency: Date.now() - startTime` (10 in-file producers) — measured wall-clock per check.',
  },
  'src/quality/adaptive-quality-gates.ts::currentValue': {
    verdict: 'LIVE',
    reason: 'Gate-evaluation result field set from extractMetricValue(snapshot) per gate — the measured-or-null REQ-359 contract leg (`null` fails loud).',
  },
  'src/transcription/types.ts::confidence': {
    verdict: 'LIVE',
    reason: 'Segment confidence written by every transcriber path (rule-based/whisper placeholder constant/browser) into transcription results.',
  },
  'src/visualization/types.ts::confidence': {
    verdict: 'LIVE',
    reason: 'Diagram/layout confidence written by analyzers and detectors (rule-based-analyzer et al.) into visualization payloads.',
  },
  'src/export/multi-format-exporter.ts::quality': {
    verdict: 'LIVE',
    reason: 'Export OPTIONS member (encoder quality LEVEL on a config scale — same classification as @stv-core export-preset `quality` in the REQ-391 census), passed by export option writers; a knob, not a reading.',
  },
  'src/visualization/layout-quality-composite.ts::balanceScore': {
    verdict: 'LIVE',
    reason: 'VisualBalanceScorer.overallScore written into the composite input/output legs in the same module (balanceScore: balance.overallScore).',
  },
  // --- @stv/core core-four (same census authority as REQ-391) ---
  'src/types/api/index.ts::confidence': {
    verdict: 'LIVE',
    reason: 'API response confidence populated by repo-side analyzer/transcriber `confidence:` writers that build these payloads.',
  },
  'src/types/diagram.ts::confidence': {
    verdict: 'LIVE',
    reason: 'Diagram confidence populated by repo-side analyzer writers (rule-based/gemini paths) into @stv/core diagram payloads.',
  },
  'src/types/api.ts::qualityScore': {
    verdict: 'LIVE',
    reason: 'API payload qualityScore written by api/routes/pipeline.ts (`qualityScore` assign/obj sites).',
  },
  // --- INPUT-CONTRACT: optional input where "unset" is legitimate ---
  'src/components/PipelineProgress.tsx::initialQualityScore': {
    verdict: 'INPUT-CONTRACT',
    reason: 'Presentational initial-state prop (doc: "useful for SSR / testing") — no page currently passes it; the live value arrives via WebSocket events and replaces initial state. An optional INPUT, not a published measurement; if a parent ever passes it, promote this row to LIVE (the INPUT row must then keep its producer).',
  },
  // --- ERADICATED: the unpopulated contracts REQ-392 deleted ---
  'src/pipeline/types.ts::entityExtractionF1Score': {
    verdict: 'ERADICATED',
    reason: '"if ground truth is available" F1 field with ZERO producers (only tests set it) — assessLLMExtractionQuality’s measured branch was a permanently-dead hatch around the REQ-389 canonical-estimator delegation. Deleted; a ground-truth producer may re-introduce it WITH a writer (this census then enforces the writer).',
  },
  'src/pipeline/types.ts::relationAccuracy': {
    verdict: 'ERADICATED',
    reason: 'Same dead pair — every `relationAccuracy` writer feeds the framework’s own QualityMetrics (auto-improvement-engine shape), never this ExtendedPipelineMetrics leg; field-NAME variant trap (relationAccuracy / relationshipAccuracy / entityExtractionF1 three-spelling web).',
  },
  'src/pipeline/quality-monitor.ts::cacheHitRate': {
    verdict: 'ERADICATED',
    reason: 'No recordMetrics caller ever fed the pipeline monitor a cacheHitRate — the cache-warming recommendation and the improvement-detector opportunity could never fire. The system’s LIVE channel is llm-service measured cache stats → RTPM llm snapshot (s.llm.cacheHitRate), consumed by HealthCheckService and the adaptive gates; this never-wired duplicate leg is deleted instead of cross-wired.',
  },
  'src/performance/intelligent-cache.ts::currentSize': {
    verdict: 'ERADICATED',
    reason: 'Decorative "alias for totalEntries" that getStats never wrote — the health snapshot read `stats.currentSize ?? stats.totalEntries` had a permanently-undefined left operand. Alias deleted; the snapshot sources totalEntries directly.',
  },
};

describe('optional-metric producer census (REQ-392)', () => {
  const discovered = discoverContractKeys();

  it('discovery has authority (non-empty census over the production surface)', () => {
    expect(discovered.size).toBeGreaterThanOrEqual(25);
  });

  it('completeness: every discovered optional measurement contract is classified in the ROSTER', () => {
    const unclassified = [...discovered.keys()].filter((k) => !(k in ROSTER));
    expect(
      unclassified.map((k) => `${k} @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('no stale rows (every LIVE / INPUT-CONTRACT row still has a live declaration)', () => {
    const stale = Object.entries(ROSTER)
      .filter(([, v]) => v.verdict !== 'ERADICATED')
      .map(([k]) => k)
      .filter((k) => !discovered.has(k));
    expect(stale).toEqual([]);
  });

  it('every LIVE row keeps a producer (a measurement contract that goes dark is RED)', () => {
    const dark = Object.entries(ROSTER)
      .filter(([, v]) => v.verdict === 'LIVE')
      .map(([k]) => k.split('::')[1])
      .filter((field) => producerSites(field).length === 0);
    expect(dark).toEqual([]);
  });

  it('INPUT-CONTRACT rows stay producer-free or get promoted to LIVE', () => {
    const promoted = Object.entries(ROSTER)
      .filter(([, v]) => v.verdict === 'INPUT-CONTRACT')
      .map(([k, v]) => ({ key: k, producers: producerSites(k.split('::')[1]), reason: v.reason }))
      .filter((r) => r.producers.length > 0);
    expect(promoted).toEqual([]);
  });

  it('eradicated unpopulated contracts stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.entries(ROSTER)
      .filter(([, v]) => v.verdict === 'ERADICATED')
      .map(([k]) => k)
      .filter((k) => discovered.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('every ROSTER entry carries a verdict and a non-empty reason', () => {
    for (const [key, row] of Object.entries(ROSTER)) {
      expect({ key, ...row }).toEqual({
        key,
        verdict: expect.stringMatching(/^(LIVE|INPUT-CONTRACT|ERADICATED)$/),
        reason: expect.stringMatching(/\S/),
      });
    }
  });

  it('negative anchors: the deleted hatches stay deleted (code lines only)', () => {
    const offenders: string[] = [];
    const anchors: Array<[string, RegExp]> = [
      // src/quality/quality-monitor.ts: no ground-truth field read, no branch
      ['src/quality/quality-monitor.ts', /entityExtractionF1Score|\bhasEntity\b|\bhasRelation\b|\brelationAccuracy\b/],
      // pipeline monitor + improvement detector: no never-fed cacheHitRate leg
      ['src/pipeline/quality-monitor.ts', /\bcacheHitRate\b/],
      ['src/pipeline/improvement-detector.ts', /\bcacheHitRate\b/],
      // intelligent-cache: no decorative alias
      ['src/performance/intelligent-cache.ts', /\bcurrentSize\b/],
    ];
    for (const [rel, pattern] of anchors) {
      readSource(rel).split('\n').forEach((line, idx) => {
        if (isCommentLine(line)) return;
        if (pattern.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
