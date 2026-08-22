/**
 * Score-ladder class — ONE repo-wide census (REQ-393 / Phase 191).
 *
 * The class — the third facet of the frozen-measurement family, after the
 * REQ-391 value census (`field: 0.9` object literals) and the REQ-392
 * contract census (`field?: number` with no producer): a SCORE-shaped value
 * (quality / confidence / accuracy / health / rate …) is selected by a
 * comparison or fallback whose CONDITION carries no measurement — a success
 * flag, a count, a sample size, an absent field — and lands on a frozen
 * decimal that claims graded quality. REQ-372..392 eradicated such sites
 * one at a time (monitor legs, framework checks, the REQ-389 re-frozen third
 * scale); this census is the steering's audit-pass-first enumeration of the
 * whole remaining shape:
 *
 *   1. DISCOVERY walks the entire production surface (repo src/ plus the
 *      installed @stv/core core-four) for lines where a ternary selects a
 *      bare-decimal false leg, or `??`/`||` falls back to a bare decimal,
 *      AND a measurement-token identifier appears on the line (config
 *      vocabulary — threshold/min/max/… — never counts as the token).
 *   2. ALLOWED holds every discovered key with a sharp reason. The honest
 *      residents of this shape are: disclosed binary gates (success → 1.0,
 *      failure → 0.0), bands over MEASURED inputs (bytes, renderTime),
 *      config knobs under metric-shaped names (encoder quality levels,
 *      eviction policy), and neutral 0.5 priors for genuinely absent INPUTS.
 *   3. ERADICATED holds the ten REQ-393 legs: six SimplePipeline
 *      continuousLearner quality bands (0.9/0.3, count ladders, a 0.8+conf
 *      rescale over the measured layout confidence, `?? 0.8` aestheticScore
 *      fallback) and four confidence fallbacks that dressed ABSENT
 *      measurements as 0.9/0.8 (Web Speech final, placeholder chunk,
 *      Remotion captions, video scene confidence).
 *
 * Ceiling (documented, same honesty as REQ-392's name-level ceiling):
 * discovery is LINE-level, so a ladder split across lines escapes it. The
 * eradicated multiline legs are therefore pinned by the negative anchors
 * below — their literal shapes are RED in any form — and a re-injected
 * single-line ladder trips the ERADICATED-reappearance test.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

/** field-name fragment that promises a measured value (REQ-391 vocabulary). */
const MEASUREMENT_TOKENS = [
  'accuracy', 'confidence', 'precision', 'recall', 'coverage', 'health',
  'latency', 'throughput', 'usage', 'performance', 'quality', 'gain',
  'effectiveness', 'current', 'prediction', 'complexity', 'score', 'rate',
] as const;

/** field-name fragment that marks CONFIG, not a measurement (REQ-391 vocabulary). */
const CONFIG_TOKENS = [
  'threshold', 'min', 'max', 'target', 'weight', 'limit', 'default',
  'budget', 'factor', 'interval', 'cap',
] as const;

/** A ternary whose false leg is a bare decimal (`cond ? x : 0.5)`). */
const TERNARY_LITERAL_LEG = /\?[^?;]*:\s*(-?\d+\.\d+)\s*[;,)]/;

/** A nullish/logical fallback to a bare decimal (`x ?? 0.9`, `x || 1.0`). */
const FALLBACK_LITERAL = /(\?\?|\|\|)\s*(-?\d+\.\d+)/;

/** Assignment target on the line, when present — the natural roster key. */
const ASSIGN_TARGET = /(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/;

function isMeasurementFieldName(field: string): boolean {
  const lower = field.toLowerCase();
  if (CONFIG_TOKENS.some((t) => lower.includes(t))) return false;
  return MEASUREMENT_TOKENS.some((t) => lower.includes(t));
}

/** Every `file::identifier` key on the production surface with a ladder/fallback literal. */
function discoverLadderKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const rel of walkProductionSurface()) {
    readSource(rel).split('\n').forEach((line, idx) => {
      if (isCommentLine(line)) return;
      if (!TERNARY_LITERAL_LEG.test(line) && !FALLBACK_LITERAL.test(line)) return;
      const identifiers = line.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
      const measurementNamed = identifiers.filter(isMeasurementFieldName);
      if (measurementNamed.length === 0) return;
      const assigned = ASSIGN_TARGET.exec(line);
      const identifier = assigned ? assigned[1] : measurementNamed[0];
      const key = `${rel}::${identifier}`;
      const sites = keys.get(key) ?? [];
      sites.push(`${rel}:${idx + 1}`);
      keys.set(key, sites);
    });
  }
  return keys;
}

/** Live classification of every ladder/fallback site discovery currently finds. */
const ALLOWED: Record<string, string> = {
  // --- neutral priors for genuinely absent INPUTS (disclosed, not dressed) ---
  'src/analysis/llm-service.ts::confidence':
    'Neutral 0.5 prior when the LLM output omits diagramType confidence entirely — the same disclosed-neutral classification REQ-391 gave extractDiagramType; the input is absent, the prior says "unknown", not "good".',
  'src/visualization/layout-quality-composite.ts::balanceVal':
    'Composite-input default (module doc: "Handles missing scores by substituting defaults") — 0.5 keeps an unmeasured leg at the scale midpoint instead of claiming quality; balanceScore itself is a REQ-392 LIVE contract.',
  // --- config knobs under metric-shaped names ---
  'src/export/multi-format-exporter.ts::quality':
    'Encoder quality LEVEL default (0.95 on a 0-1 knob scale) — the same classification the REQ-391/392 censuses gave export-preset `quality`; a knob, not a reading.',
  'src/export/production-exporter.ts::quality':
    'Bitrate quality-multiplier map (draft 0.5 … ultra 2.0) with a map-default `|| 1.0` — encoder config, not a measurement.',
  'src/optimization/smart-parameter-tuner.ts::audioQuality':
    'The tuner’s DOCUMENTED audio-quality default — REQ-391 deliberately dropped the orchestrator’s fabricated quality argument so this documented `?? 0.8` default applies; the input is optional metadata, the default is disclosed config.',
  'src/optimization/adaptive-content-processor.ts::audioQuality':
    'Fingerprint normalization over the same optional audio-quality metadata, mirroring the tuner’s documented default (REQ-391 decision) — input default, not a published reading.',
  'src/performance/intelligent-cache.ts::baseEvictionRate':
    'Eviction-policy aggressiveness knob keyed on MEASURED memoryPressure (0.25 vs 0.15) — cache policy config; the measurement is the pressure input, not the rate knob.',
  'src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts::adjustment':
    'Annealing temperature schedule (0.95/1.05 around a measured acceptance rate) — an optimizer hyperparameter step, not a published score.',
  // --- disclosed binary gates / bands over MEASURED inputs ---
  'src/quality/quality-gate.ts::score':
    'Disclosed binary gate rows (`valid ? 1.0 : 0.0`) — the gate’s own pass/fail idiom; the expected===0 vacuous-truth rows of the same file are separately held by the defect-9 roster.',
  'src/quality/quality-monitor.ts::successScore':
    'Disclosed binary success score (`result.success ? 1.0 : 0.0`) — the idiom REQ-393 adopted for the video leg; claims pass/fail, not graded quality.',
  'src/quality/quality-monitor.ts::outputQuality':
    'Disclosed binary output-presence score (`result.outputPath ? 1.0 : 0.0`) — same idiom.',
  'src/quality/quality-monitor.ts::memoryUsageBytes':
    'Memory-efficiency band over the MEASURED peak-bytes reading (<256MB → 1.0 else 0.5) — the src/quality monitor’s own scale (dual-scale contract, Phase 180); input is measured.',
  'src/framework/recursive-custom-instructions.ts::currentState':
    'Framework quality-check budget legs (REQ-390/Phase 188 design, comment in-file): binary 1/0.5 over the MEASURED renderTime/memoryUsage that recordStageSuccess writes — the comparison input is a reading, the legs are the disclosed scale.',
  // --- config-side `??` on gate thresholds (matched via sibling identifiers) ---
  'src/transcription/streaming-transcriber.ts::confidence':
    'The fallback literal on this line belongs to `config.minConfidence ?? 0.7` — a CONFIG default on the acceptance gate; the segment-confidence read beside it falls back to NaN, deliberately, so unmeasured segments fail the gate.',
  'src/transcription/streaming-transcriber.ts::segmentConfidence':
    'Same config-side `minConfidence ?? 0.7` gate default (line moved with the REQ-393 edit) — not a measurement fallback.',
  // --- UI form-input parse fallbacks ---
  'src/components/ProductionDashboard.tsx::errorRate':
    'React form input: `parseFloat(e.target.value) || 0.01` reverts an unparseable threshold FIELD to its displayed default — UI state, not a published measurement.',
  'src/components/ProductionDashboard.tsx::memoryUsage':
    'Same form-input parse fallback for the memory-usage threshold field — UI state.',
};

/** Ladders/fallbacks eradicated by REQ-393 — any reappearance is RED. */
const ERADICATED: Record<string, string> = {
  'src/pipeline/simple-pipeline.ts::transcriptionQuality':
    'Learner transcription leg `success && segments>0 ? 0.9 : 0.3` — the frozen 0.9 sat above the learner’s 0.85 improvement threshold on every success, so quality-degradation detection never saw real transcription quality. Now meanSegmentConfidence (canonical estimator over the transcriber’s own per-segment confidences).',
  'src/pipeline/simple-pipeline.ts::segmentationQuality':
    'Learner segmentation leg `0.7 + (count/10) * 0.25 : 0.3` scored segment COUNT, not segmentation quality. Now meanSegmentConfidence over ContentSegment.confidence (the segmenter’s measured max-of-merged-confidences derivation). Multiline shape — pinned by the negative anchors too.',
  'src/pipeline/simple-pipeline.ts::confidence':
    'Enhanced-layout bridge `qualityMetrics?.aestheticScore ?? 0.8` dressed an absent aestheticScore as a good layout. Now `?? 0` — the fail value keeps "unmeasured" distinguishable from "measured good" (aestheticScore itself is derived, REQ-391).',
  'src/pipeline/simple-pipeline.ts::layoutQuality':
    'Learner layout leg `min(0.95, 0.8 + lr.confidence * 0.15) : 0.3` re-froze a ≥0.8 floor OVER the measured layout confidence. Now the measured `sanitizeFinite(lr.confidence)` directly, fail-closed 0. Multiline shape — pinned by the negative anchors too.',
  'src/pipeline/simple-pipeline.ts::diagram_pipeline':
    'Learner diagram-pipeline leg `scenes.length > 0 ? 0.9 : 0.3` — a half-failing stage still read 0.9. Now the MEASURED scene yield (scenes/segments). The re-injected literal carries no measurement-token identifier, so this row is enforced by the negative anchors.',
  'src/pipeline/simple-pipeline.ts::videoQuality':
    'Learner video leg `success ? 0.95 : 0.3` claimed graded quality the result never measured (and 0.3-on-failure still scored "degraded-but-passing"). Now the disclosed binary `success ? 1 : 0` — the quality-monitor successScore idiom.',
  'src/transcription/transcriber.ts::confidence':
    'Remotion caption `confidence: segment.confidence ?? 0.9` — Caption.confidence is `number | null`; null is the type’s own "no measurement" value. A missing segment confidence must not read as near-certainty.',
  'src/transcription/whisper-transcriber.ts::confidence':
    'Same caption `?? 0.9` in the Whisper path’s caption generator — now `?? null`.',
  'src/transcription/browser-transcriber.ts::confidence':
    'Web Speech final-result `?? 0.9` — an absent final confidence read as 0.9. Now the named neutral FINAL_NO_CONFIDENCE_STANDIN (0.5), the same disclosed convention as interim chunks.',
  'src/transcription/streaming-transcriber.ts::segmentConfidence-fallback':
    'NOT a live key — placeholder note (REQ-391 `confidence-random-jitter` pattern): the final-chunk confidence fallback `… : 0.8` is now the module’s own named PLACEHOLDER_CHUNK_CONFIDENCE. The bare `segmentConfidence` identifier is still discovered via the LIVE config-default line (`minConfidence ?? 0.7`, classified in ALLOWED), so the eradicated fallback lives under this suffixed key and is enforced by the negative anchors.',
  'src/pipeline/video-generator.ts::confidence':
    'Scene-confidence bridge `scene.confidence ?? 0.8` — the in-file comment argued 0.8 masks legit-zero yet still mapped undefined→0.8, silencing the validateRemotionData low-confidence warning. Now `?? 0`, completing that comment’s own argument.',
};

describe('score-ladder census (REQ-393)', () => {
  const discovered = discoverLadderKeys();

  it('discovery has authority (non-empty census over the production surface)', () => {
    expect(discovered.size).toBeGreaterThanOrEqual(10);
  });

  it('completeness: every discovered ladder/fallback literal is classified in ALLOWED', () => {
    const unclassified = [...discovered.keys()].filter((k) => !(k in ALLOWED));
    expect(
      unclassified.map((k) => `${k} @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry still has a live site)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !discovered.has(k));
    expect(stale).toEqual([]);
  });

  it('every ALLOWED / ERADICATED entry carries a non-empty reason', () => {
    for (const [map, name] of [
      [ALLOWED, 'ALLOWED'],
      [ERADICATED, 'ERADICATED'],
    ] as const) {
      for (const [key, reason] of Object.entries(map)) {
        expect({ name, key, reason }).toEqual({
          name,
          key,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it('eradicated ladders stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => discovered.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('negative anchors: the eradicated literal shapes stay out of their files (code lines only)', () => {
    const offenders: string[] = [];
    const anchors: Array<[string, RegExp]> = [
      // SimplePipeline learner legs — includes the MULTILINE shapes line-level
      // discovery cannot see (`0.7 + (count…` and `0.8 + (((lr.confidence…`
      // wrap across lines).
      ['src/pipeline/simple-pipeline.ts', /\?\s*0\.9\s*:\s*0\.3|0\.7\s*\+\s*\(contentSegments\.length|0\.8\s*\+\s*\(\(\(lr\.confidence|\?\?\s*0\.8|\?\s*0\.95\s*:\s*0\.3/],
      ['src/transcription/transcriber.ts', /confidence\s*\?\?\s*0\.9/],
      ['src/transcription/whisper-transcriber.ts', /confidence\s*\?\?\s*0\.9/],
      ['src/transcription/browser-transcriber.ts', /confidence\s*\?\?\s*0\.9/],
      ['src/transcription/streaming-transcriber.ts', /confidence\s*>\s*0\s*\?\s*confidence\s*:\s*0\.8/],
      ['src/pipeline/video-generator.ts', /scene\.confidence\s*\?\?\s*0\.8/],
    ];
    for (const [rel, pattern] of anchors) {
      readSource(rel).split('\n').forEach((line, idx) => {
        if (isCommentLine(line)) return;
        if (pattern.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the canonical mean-segment-confidence estimator exists and stays measured-only', () => {
    // The delegation target for the transcription/segmentation legs: its own
    // source must average ONLY finite numeric confidences (absent → 0), never
    // mint a value. Source-anchored so moving the function fails loud here.
    const source = readSource('src/pipeline/quality-estimators.ts');
    expect(source).toMatch(
      /export function meanSegmentConfidence\([\s\S]*?typeof c === 'number' && Number\.isFinite\(c\) \? c : 0;/,
    );
    expect(source.match(/meanSegmentConfidence/g)?.length).toBeGreaterThanOrEqual(1);
    // Both consumers delegate (SimplePipeline legs + orchestrator record).
    expect(readSource('src/pipeline/simple-pipeline.ts')).toMatch(/meanSegmentConfidence\(transcriptionResult\.segments/);
    expect(readSource('src/pipeline/simple-pipeline.ts')).toMatch(/meanSegmentConfidence\(contentSegments/);
    expect(readSource('src/pipeline/pipeline-orchestrator.ts')).toMatch(/meanSegmentConfidence\(segments\)/);
  });
});
