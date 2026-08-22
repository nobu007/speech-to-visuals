/**
 * Measurement-fixture class — ONE repo-wide census (REQ-391 / Phase 189).
 *
 * The class: a field whose NAME promises a measurement (accuracy, confidence,
 * performance, health, current, …) is populated with a bare numeric literal —
 * or with Math.random() — so a frozen constant (or noise) is published as if
 * it were a reading. REQ-383..390 closed this class facet-by-facet (quality
 * legs, compliance legs, framework checks, memoryUsage producer), each found
 * by hand in a separate iteration. This census is the proactive one-pass
 * answer the steering asked for, in the same shape as the defect-9 roster and
 * the spine-anchor census:
 *
 *   1. DISCOVERY walks the ENTIRE production surface (this repo's src/ plus
 *      the installed @stv/core core-four) for measurement-named fields
 *      assigned bare numeric literals, skipping config vocabulary
 *      (threshold/min/max/target/weight/limit/default/budget/factor/
 *      interval/cap) and documented non-measurement exemptions.
 *   2. ALLOWED holds every discovered key with a sharp, non-circular reason —
 *      a heuristic confidence annotated on a REAL measured breach is fine; a
 *      bare "0.95 accuracy" with no measurement behind it is not. A new site
 *      cannot ship unclassified (completeness), and a roster row whose site
 *      disappeared must be removed (no stale rows).
 *   3. ERADICATED holds the fixture keys this phase removed; their
 *      reappearance is RED. The wholesale-fixture module
 *      src/monitoring/production-monitoring-excellence.ts must stay deleted.
 *   4. RANDOM BAN: Math.random() may never manufacture a measurement value —
 *      random jitter mimics reading variance and is MORE deceptive than a
 *      frozen constant (the transcription placeholder confidences it used to
 *      dress up are now deterministic named constants).
 *
 * Granularity is file::field, not file:line — lines move on every edit; the
 * census exists to force a CONSCIOUS classification of each measurement-shaped
 * literal, not to pin layout.
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync } from 'fs';
import {
  REPO_ROOT,
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

/** field-name fragment that promises a measured value. */
const MEASUREMENT_TOKENS = [
  'accuracy', 'confidence', 'precision', 'recall', 'coverage', 'health',
  'latency', 'throughput', 'usage', 'performance', 'quality', 'gain',
  'effectiveness', 'current', 'prediction', 'complexity', 'score', 'rate',
] as const;

/** field-name fragment that marks CONFIG, not a measurement. */
const CONFIG_TOKENS = [
  'threshold', 'min', 'max', 'target', 'weight', 'limit', 'default',
  'budget', 'factor', 'interval', 'cap',
] as const;

/**
 * Field names the vocabulary matches but that are provably not measurements.
 * Every entry needs a reason (hygiene test below); an undocumented exemption
 * is how a census rots.
 */
const EXEMPT_FIELDS: Record<string, string> = {
  healthy: 'api/routes/health.ts status-code map key (200) — an HTTP code, not a reading.',
  unhealthy: 'api/routes/health.ts status-code map key (503) — an HTTP code, not a reading.',
};

/** A measurement-named field assigned a bare decimal or ≥2-digit integer. */
const MEASUREMENT_LITERAL =
  /([A-Za-z][A-Za-z0-9]*)\s*:\s*(-?\d+\.\d+|-?\d{2,})\s*(?=[,})]|\/\/)/;

/** Math.random() inside a measurement-named field value — banned outright. */
const RANDOM_MEASUREMENT =
  /(accuracy|confidence|precision|recall|coverage|health|latency|throughput|usage|performance|quality|gain|effectiveness|score|rate)[A-Za-z]*\s*:[^,\n}]*Math\.random/i;

function isMeasurementFieldName(field: string): boolean {
  const lower = field.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(EXEMPT_FIELDS, field)) return false;
  if (CONFIG_TOKENS.some((t) => lower.includes(t))) return false;
  return MEASUREMENT_TOKENS.some((t) => lower.includes(t));
}

/** Every `file::field` key on the production surface with a fixture-shaped literal. */
function discoverFixtureKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const rel of walkProductionSurface()) {
    const lines = readSource(rel).split('\n');
    lines.forEach((line, idx) => {
      if (isCommentLine(line)) return;
      const m = MEASUREMENT_LITERAL.exec(line);
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

/** Live classification of every site the discovery currently finds. */
const ALLOWED: Record<string, string> = {
  // --- design-time tables: the number is a property of the thing described ---
  'src/quality/error-recovery/recovery-strategies.ts::confidence':
    'Static recovery-strategy table: each row describes a DESIGN-TIME strategy (confidence/preventionScore/priority are properties of the strategy itself, set once with the table, not runtime readings).',
  'src/quality/error-recovery/recovery-strategies.ts::preventionScore':
    'Same static strategy table — preventionScore is a design-time property of the strategy row, not a measured outcome.',
  'src/quality/user-guided-error-recovery.ts::successRate':
    'Static manual-recovery strategy table: successRate is the strategy’s design-time estimated success rate (like documentation), not a measurement of a run.',
  // --- heuristic annotations ON measured evidence (the annotation ranks, the evidence measures) ---
  'src/pipeline/improvement-detector.ts::confidence':
    'Rule-strength annotation on opportunities that only fire on a REAL measured threshold breach (latestMetrics.processingTime/memoryUsage) and carry the measured value in currentValue/evidence; confidence ranks the suggestion, it is not the measurement.',
  'src/framework/continuous-learner.ts::confidence':
    'Insight/pattern annotations attached to REAL data windows (avgProcessingTime/avgQuality/successRate computed from recorded runs; evidence arrays cite the actual rows). The annotation ranks the insight; the measurement is in the evidence.',
  'src/framework/continuous-learner.ts::expectedGain':
    'Design-time estimate attached to a SUGGESTION (`expectedGain: 0.3`) whose validationCount/evidence carry the real data — an expectation, explicitly not a published reading.',
  'src/framework/continuous-learner.ts::learningRate':
    'LEARNING_CONFIG hyperparameter (0.1) — a tuning knob, same as any optimizer learning rate.',
  'src/framework/continuous-learner.ts::forgetRate':
    'LEARNING_CONFIG hyperparameter (0.05) — a tuning knob for decay, not a measurement.',
  'src/quality/adaptive-quality-gates.ts::confidence':
    'Adaptation-state SEED (0.1) overwritten by adaptive.confidence = min(0.95, historicalValues.length/100) on every round — a prior, not a published reading.',
  'src/optimization/adaptive-content-processor.ts::confidence':
    'Decision annotations on selectOptimalParameters outcomes (cached-hit 0.95 / error-fallback 0.5) ranking the chosen strategy; measured processingTime is published alongside.',
  // --- thresholds / weights / caps / hyperparameters: config vocabulary under metric-shaped names ---
  'src/analysis/complexity-detector.ts::vocabularyComplexity':
    'WEIGHTS map entry (0.20) — the field NAME is the factor being weighted, the value is its weight ("Weight factors for complexity scoring" table).',
  'src/analysis/complexity-detector.ts::structuralComplexity':
    'WEIGHTS map entry (0.25) — same weight table.',
  'src/analysis/complexity-detector.ts::complexity':
    'FACTOR_WEIGHTS entry `sentence_complexity: 0.25` — a factor WEIGHT (snake_case key; the captured fragment is the weight-table member), same class as WEIGHTS.',
  'src/framework/auto-improvement-engine.ts::overallScore':
    'METRIC_CAPS ratio-cap table (ideal upper bound 100 for the simulate-improvement clamp) — a cap, not a reading.',
  'src/framework/auto-improvement-engine.ts::transcriptionAccuracy':
    'METRIC_CAPS cap (1) + calculateQualityScore weights map (0.15) — the field NAME is the metric being weighted/capped, the value is config.',
  'src/framework/auto-improvement-engine.ts::relationAccuracy':
    'METRIC_CAPS cap (1) + calculateQualityScore weights map (0.15) — same as above.',
  'src/framework/auto-improvement-engine.ts::memoryUsage':
    'calculateQualityScore weights map entry (0.10) — weight, not a memory reading.',
  'src/framework/auto-improvement-engine.ts::successRate':
    'METRIC_CAPS cap (1) + calculateQualityScore weights map (0.10) — config.',
  'src/monitoring/production-error-handler.ts::errorRate':
    'checkErrorThresholds local threshold map (10 errors/minute) — a gate threshold despite the metric-shaped name.',
  'src/monitoring/production-monitor.ts::crashRate':
    'thresholds map (max 10% crash rate, "Custom Instructions Section 5.1") — gate config.',
  'src/monitoring/production-monitor.ts::successRate':
    'thresholds map (min 0.9) — gate config.',
  'src/monitoring/production-monitor.ts::averageLatency':
    'thresholds map (max 60s) — gate config.',
  'src/monitoring/production-monitor.ts::p95Latency':
    'thresholds map (max 90s) — gate config.',
  'src/quality/quality-monitor.ts::processingSuccessRate':
    'thresholds.critical gate entry (0.90) — the fail threshold, not a measured rate.',
  'src/quality/regression-detector.ts::moderate':
    'regressionThresholds percent band (20% degradation triggers "moderate") — a severity threshold; "moderate" merely contains the substring "rate".',
  'src/config/production-config.ts::errorRate':
    '@stv-core alertThresholds entries (0.05/0.1/0.15 warning thresholds) — gate config. (The dead-consumer aspect of alertThresholds is the separate tracked L3, not this class.)',
  'src/config/production-config.ts::quality':
    '@stv-core export-preset `quality: 7..10` — encoder quality LEVEL on a 1-10 config scale, not a measurement.',
  // --- disclosed fail-closed / neutral defaults on no-data paths ---
  'src/analysis/llm-service.ts::confidence':
    'DEFAULT_ANALYSIS_RESULT diagramType confidence 0.0 (total parse failure — disclosed zero, fail-closed) and extractDiagramType neutral prior 0.5 when LLM output omits diagramType entirely.',
  'src/analysis/prompt-templates.ts::confidence':
    'User-SPECIFIED language ⇒ certainty 1.0: no detector guess happened, so "confidence" expresses that the value was given, not measured.',
  'src/quality/enhanced-error-recovery.ts::confidence':
    'generateMinimalOutput diagram_detection fallback `{ type: "flow", confidence: 0.5 }` — neutral disclosed default on the minimal-viable-output error path.',
  'src/transcription/streaming-transcriber.ts::confidence':
    'Interim (not-yet-finalized) chunk confidence 0.5 — WebSpeech interim results carry no confidence; disclosed neutral stand-in until finalization.',
  // --- placeholder pipelines (README「音声認識の現状」disclosed) ---
  'src/pipeline/pipeline-orchestrator.ts::confidence':
    'makeDefaultTranscriptionResult/makeDefaultAnalysisResult fallback outputs — deterministic placeholder content on the failure path, in line with the transcriber placeholder constants (REQ-391).',
  'src/quality/quality-gate.ts::score':
    'expected===0 → score 1.0 vacuous-truth rows: classified BY-DESIGN with a live re-check in the defect-9 roster (quality-gate/entityExtractionRate et al.); no live caller of the evaluator.',
  'src/quality/enhanced-error-recovery.ts::currentValue':
    'createInitialHealthMetrics() constructor seed — the tracker overwrites indicators from measured stage events; defect-9 family error-recovery-health.',
  // --- demo / UI state, disclosed simulation ---
  'src/components/SimplePipelineInterface.tsx::confidence':
    'The /simple demo route’s openly-simulated pipeline ("simulates full pipeline", sample transcript text): the whole result payload including this 0.9 is disclosed sample data, not a hidden fixture.',
  'src/components/Iteration43Interface.tsx::currentIteration':
    'Demo UI initial state for the iteration counter, replaced by live framework events — not a published measurement.',
  'src/components/videoRenderer.ts::currentFrame':
    'React player UI state default (initial frame counter), overwritten by real playback position events — not a published measurement.',
};

/** Fixtures eradicated by REQ-391 — any reappearance is RED. */
const ERADICATED: Record<string, string> = {
  'src/monitoring/production-monitoring-excellence.ts::detectionAccuracy':
    'Wholesale-fixture module deleted with the file (see DELETED_FILES).',
  'src/monitoring/production-monitoring-excellence.ts::accuracy': 'Ditto.',
  'src/monitoring/production-monitoring-excellence.ts::confidence': 'Ditto.',
  'src/monitoring/production-monitoring-excellence.ts::falsePositiveRate': 'Ditto.',
  'src/monitoring/production-monitoring-excellence.ts::responseTimeMs': 'Ditto.',
  'src/monitoring/production-monitoring-excellence.ts::responseTime': 'Ditto.',
  'src/monitoring/production-monitoring-excellence.ts::current': 'Ditto (7 fabricated health indicators).',
  'src/monitoring/production-monitoring-excellence.ts::prediction': 'Ditto.',
  'src/monitoring/performance-dashboard.ts::accuracyScore':
    'Self-admitted fixture (`0.95 // Would be calculated from actual results`) removed with the field — the dashboard has no accuracy measurement source (REQ-391).',
  'src/framework/continuous-learner.ts::currentPerformance':
    'Fabricated field (0.93/0.85/0.8/0) with ZERO readers — deleted, not re-derived (REQ-391).',
  'src/pipeline/main-pipeline.ts::performanceScore':
    'Uniform fabricated eviction bonus (0.8) → neutral 0; duration now the transcription’s own measured length (REQ-391).',
  'src/performance/intelligent-cache.ts::performanceScore':
    'Decorator metadata fixture (0.8) → neutral 0; duration now the measured method elapsed (REQ-391).',
  'src/performance/intelligent-cache.ts::complexity':
    'Decorator metadata fixture (0.5) → neutral 0 — no complexity measurement exists at store time (REQ-391).',
  'src/pipeline/pipeline-orchestrator.ts::quality':
    'Fabricated audio-quality argument to the tuner dropped; the tuner’s documented `?? 0.8` default applies (REQ-391).',
  'src/transcription/whisper-transcriber.ts::confidence':
    'Random-jitter placeholder confidence → deterministic named PLACEHOLDER_SEGMENT_CONFIDENCE at the old range’s lower bound (REQ-391).',
  'src/transcription/streaming-transcriber.ts::confidence-random-jitter':
    'NOT a live key — placeholder note: the random-jitter chunk confidence (`0.75 + Math.random()*0.2`) became deterministic PLACEHOLDER_CHUNK_CONFIDENCE (REQ-391); its reappearance in ANY form is caught by the Math.random ban below, and the surviving interim-0.5 site of the same field is classified in ALLOWED (file::field granularity cannot hold both, so the random shape lives here as this note + the ban test).',
  'src/visualization/enhanced-zero-overlap-layout.ts::aestheticScore':
    'Self-admitted `0.85 // Simulated high score` → deriveAestheticScore weighted composite over the measured legs (REQ-391).',
  'src/visualization/enhanced-zero-overlap-layout.ts::compactnessScore':
    'Self-admitted `0.8 // Simulated` → canvasUtilization identity (bounding-box compactness, measured) (REQ-391).',
  'src/visualization/enhanced-zero-overlap-layout.ts::readabilityScore':
    'Self-admitted `0.9 // Simulated` → penalty model on measured overlap/spacing counts — the <0.7 warning gate could never fire on a constant 0.9 (REQ-391).',
  'src/analysis/gemini-analyzer.ts::currentTimeoutMs':
    'Frozen 30000 stand-in → LIVE getAdaptiveTimeout() (P95×buffer clamped [15s,60s]; the frozen value stayed at the default forever) (REQ-391).',
  'src/visualization/layout-engine.ts::confidence':
    'Simple-mode hardcoded 1.0 ("assumes high confidence") → the same calculateLayoutConfidence evaluation every other path runs — the identical bypass the complex path was cured of (DROPS class e0f269af) (REQ-391).',
};

/** Modules deleted wholesale because every metric they published was a fixture. */
const DELETED_FILES: Record<string, string> = {
  'src/monitoring/production-monitoring-excellence.ts':
    'Every published metric was a hardcoded literal or Math.random() draw (97.8% detection accuracy, random 5–20% optimization gains, 7 fabricated health indicators, fabricated alert-category accuracy). Only live consumer was destroy() in the API shutdown list — removed with the module (REQ-391).',
};

describe('measurement-fixture census (REQ-391)', () => {
  const discovered = discoverFixtureKeys();

  it('discovery has authority (non-empty census over the production surface)', () => {
    expect(discovered.size).toBeGreaterThanOrEqual(10);
  });

  it('completeness: every discovered measurement-shaped literal is classified in ALLOWED', () => {
    const unclassified = [...discovered.keys()].filter((k) => !(k in ALLOWED));
    expect(
      unclassified.map((k) => `${k} @ ${discovered.get(k)!.join(', ')}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry still has a live site)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !discovered.has(k));
    expect(stale).toEqual([]);
  });

  it('every ALLOWED / ERADICATED / EXEMPT entry carries a non-empty reason', () => {
    for (const [map, name] of [
      [ALLOWED, 'ALLOWED'],
      [ERADICATED, 'ERADICATED'],
      [EXEMPT_FIELDS, 'EXEMPT_FIELDS'],
      [DELETED_FILES, 'DELETED_FILES'],
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

  it('eradicated fixtures stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => discovered.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared @ ${discovered.get(k)!.join(', ')}`),
    ).toEqual([]);
  });

  it('wholesale-fixture modules stay deleted', () => {
    for (const [rel, reason] of Object.entries(DELETED_FILES)) {
      expect({
        file: rel,
        exists: existsSync(`${REPO_ROOT}/${rel}`),
        reason,
      }).toMatchObject({ file: rel, exists: false });
    }
  });

  it('Math.random never manufactures a measurement value', () => {
    const offenders: string[] = [];
    for (const rel of walkProductionSurface()) {
      readSource(rel).split('\n').forEach((line, idx) => {
        if (isCommentLine(line)) return;
        if (RANDOM_MEASUREMENT.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
