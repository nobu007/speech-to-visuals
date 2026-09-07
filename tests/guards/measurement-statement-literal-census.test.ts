/**
 * Measurement-statement-literal class — ONE repo-wide census (REQ-394 / Phase 192).
 *
 * The fourth facet of the frozen-measurement family, after the REQ-391 value
 * census (`field: 0.9` object literals), the REQ-392 contract census
 * (`field?: number` with no producer), and the REQ-393 score-ladder census
 * (ternary/false-leg and `??`/`||` fallback literals): a bare frozen decimal
 * (or ≥2-digit integer) as the WHOLE VALUE of a statement — a
 * `return <literal>;` from a measurement-named function, or a
 * `const/let <measurement-name> = <literal>;` initializer. REQ-391's regex is
 * object-literal-shaped (`field\s*:\s*literal`) and REQ-393's is
 * condition-shaped, so a function that simply RETURNS a frozen 0.9 — or binds
 * one to a `score`/`confidence`/`accuracy`-named variable — was invisible to
 * all three.
 *
 * The steering's audit-pass-first directive ("enumerate every constant-fixture
 * candidate over src/**, confirm the remaining count is 0, then fix") was run
 * over this facet BEFORE this census: 16 sites (15 keys) enumerated across the
 * production surface, every one already holding a legitimate classification —
 * canonical estimator bands, measured-adjustment heuristic bases, a named
 * fail-closed ceiling, and one defect-9-adjudicated BY-DESIGN no-baseline leg.
 * Zero fabricated sites remained, so unlike REQ-391/392/393 this census ships
 * NO eradication: it locks in the confirmed-zero state and forces a conscious
 * classification of every future site of the shape. The census's own first run
 * then beat the manual enumeration by 3 keys (the `export const` named
 * disclosed confidence constants of REQ-391/393 — the hand-run audit regex had
 * no `export` prefix), the same completeness-beats-grep effect REQ-391 saw.
 *
 * Because the real tree is clean, the discovery's own liveness is held by the
 * synthetic-fixture test below (the REQ-388 spine-census precedent: a detector
 * whose only witnesses are synthetic cannot rot silently).
 *
 * Ceiling (documented, same honesty as REQ-393's line-level ceiling): the
 * return-shape attributes a literal to the NEAREST enclosing declaration line
 * — `function name(…)`, a method `name(…) {`, or an arrow binding
 * `const name = … => {`. A literal returned through a helper whose own name
 * carries no measurement token (e.g. `return nearCertainty();`) escapes; the
 * binding shape only sees direct literal initializers, not expressions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

/** identifier fragment that promises a measured value (REQ-391 vocabulary). */
const MEASUREMENT_TOKENS = [
  'accuracy', 'confidence', 'precision', 'recall', 'coverage', 'health',
  'latency', 'throughput', 'usage', 'performance', 'quality', 'gain',
  'effectiveness', 'current', 'prediction', 'complexity', 'score', 'rate',
] as const;

/** identifier fragment that marks CONFIG, not a measurement (REQ-391 vocabulary). */
const CONFIG_TOKENS = [
  'threshold', 'min', 'max', 'target', 'weight', 'limit', 'default',
  'budget', 'factor', 'interval', 'cap',
] as const;

/** REQ-391's literal shape: a bare decimal or a ≥2-digit integer. */
const LITERAL_VALUE = String.raw`-?\d+\.\d+|-?\d{2,}`;

/** `const/let/var <name> (: type)? = <literal>;` — the binding-initializer shape. */
const BINDING_LITERAL = new RegExp(
  String.raw`^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(` + LITERAL_VALUE + String.raw`)\s*;`,
);

/** `return <literal>;` — the whole-statement frozen return shape. */
const RETURN_LITERAL = new RegExp(
  String.raw`^\s*return\s+(` + LITERAL_VALUE + String.raw`)\s*;`,
);

/** `return …Math.random…` — random jitter in a return (REQ-391's ban, return shape). */
const RETURN_RANDOM = /^\s*return\s+[^;]*Math\.random/;

/**
 * Control keywords that syntactically resemble a named function declaration
 * (`if (…) {`, `for (…) {`, …) — excluded from enclosing-name resolution.
 */
const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'function',
  'new', 'do', 'else', 'try',
]);

/**
 * The nearest declaration line ABOVE a return — `function name(…)`, a method
 * `name(…) {`, or an arrow binding `const name = … => {`. Returns the bound
 * name, or null when no opener is found within the scan window.
 */
function enclosingFunctionName(lines: string[], returnIdx: number): string | null {
  for (let j = returnIdx - 1; j >= 0 && returnIdx - j <= 60; j--) {
    const line = lines[j];
    const fn = line.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (fn) return fn[1];
    const arrow = line.match(
      /^\s*(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^=]*=>\s*\{\s*$/,
    );
    if (arrow) return arrow[1];
    const method = line.match(
      /(?:^|[^.A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{=]*\)\s*(?::[^{=]+)?\{\s*$/,
    );
    if (method && !CONTROL_KEYWORDS.has(method[1])) return method[1];
  }
  return null;
}

function isMeasurementFieldName(field: string): boolean {
  const lower = field.toLowerCase();
  if (CONFIG_TOKENS.some((t) => lower.includes(t))) return false;
  return MEASUREMENT_TOKENS.some((t) => lower.includes(t));
}

/**
 * Discover every statement-level frozen literal bound to a measurement-named
 * identifier in ONE source text. Pure (rel, text) → keys so the liveness test
 * can drive the same scanner over synthetic fixtures.
 */
export function discoverStatementLiterals(
  rel: string,
  text: string,
): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  const lines = text.split('\n');
  const push = (identifier: string, lineNo: number) => {
    const key = `${rel}::${identifier}`;
    const sites = keys.get(key) ?? [];
    sites.push(`${rel}:${lineNo}`);
    keys.set(key, sites);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    const binding = line.match(BINDING_LITERAL);
    if (binding && isMeasurementFieldName(binding[1])) {
      push(binding[1], i + 1);
      continue;
    }
    if (RETURN_LITERAL.test(line) || RETURN_RANDOM.test(line)) {
      const fn = enclosingFunctionName(lines, i);
      if (fn !== null && isMeasurementFieldName(fn)) push(fn, i + 1);
    }
  }
  return keys;
}

/** Live classification of every statement literal discovery currently finds. */
const ALLOWED: Record<string, string> = {
  // --- canonical estimator bands (single sources REQ-389/393 built) ---
  'src/pipeline/quality-estimators.ts::score':
    'estimateSegmentationQuality base 0.7 of the canonical scene-count/duration band — both bonuses are MEASURED (scene count, average duration) and the function fail-closes to 0 on empty/failed runs.',
  'src/pipeline/quality-estimators.ts::scoreNodeDensity':
    'The canonical density→score scale (0.90/0.70/0.50) over the MEASURED nodes-per-scene — the documented band contract both extraction sites delegate to (REQ-389); callers guard count>0 before the 0.50 degenerate leg.',
  'src/pipeline/quality-estimators.ts::estimateRelationAccuracy':
    'Measured edges-per-scene band (≥1 → 0.85, else 0.60) with a fail-0 guard — the literal legs are the documented scale of a measured input.',
  'src/pipeline/quality-estimators.ts::DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY':
    'REQ-430 (AX-3) fail-closed penalty floor for transcription runs whose measurement is impossible (recovery chain ended at the disclosed placeholder) — a disclosed band deliberately below the 0.85 gate, consumed only via the named constant so aggregation sites cannot drift from it; it never stands in for an unmade measurement on a real-engine run.',
  // --- measured-adjustment heuristic bases (disclosed base ± MEASURED deltas) ---
  'src/analysis/gemini-analyzer.ts::INITIAL_LLM_CONFIDENCE':
    'Named heuristic prior for the LLM detection-time confidence, decremented 0.1 per MEASURED structural defect (sparse edgeRatio, disconnected nodes, unexpected cycles) — a disclosed base of a measured-penalty band, not a published reading.',
  'src/analysis/language-detector.ts::confidence':
    'Neutral 0.5 prior that every branch overwrites with MEASURED script-ratio evidence (kana/CJK/latin ratios, diacritical scores) — it never survives as a final value.',
  'src/visualization/strategies/LayoutEvaluator.ts::confidence':
    'calculateLayoutConfidence disclosed base 0.8 ± MEASURED adjustments (overlap count, processing time, structure presence), clamped — REQ-391 classified the complex-path twin the same way.',
  'src/pipeline/video-generator.ts::score':
    'Heuristic quality of a COMPLETED generation: base 0.8 + bonuses for MEASURED properties (processingTime, fileSize, resolution), clamped — grades a finished artifact, never stands in for an unmade measurement.',
  'src/export/enhanced-export-engine.ts::score':
    'calculateExportScore band over a completed export: base 0.6 + config-format bonuses + one MEASURED size-efficiency bonus (outputSize/duration), clamped — same completed-artifact heuristic family.',
  'src/optimization/adaptive-content-processor.ts::confidence':
    'Strategy-selection heuristic: base 0.8 adjusted by measured characteristics (audioQuality band, fingerprint history hit, diagramLikelihood), clamped — disclosed heuristic, REQ-391/393 gave the sibling audioQuality defaults the same family.',
  'src/optimization/smart-parameter-tuner.ts::accuracy':
    'predictPerformance is a disclosed PREDICTION model (name + "Base performance prediction" comment): priors adjusted by parameters and content characteristics, bounded — a forecast of hypothetical settings, not a published reading of a run.',
  'src/optimization/smart-parameter-tuner.ts::confidence':
    'Optimization-confidence heuristic over the same disclosed-prediction family: base 0.8 + measured-history/audio-quality adjustments, clamped.',
  // --- deduction ladders and disclosed fail-closed ceilings ---
  'src/pipeline/quality-monitor.ts::score':
    'Base-100 deduction ladder over MEASURED violations — REQ-375 already hardened its bonuses to require measured values (null layoutOverlap collects nothing).',
  'src/pipeline/quality-monitor.ts::MEASURED_QUALITY_ABSENT_SCORE_CEILING':
    'Named DISCLOSED fail-closed ceiling (59) that CAPS the aggregate when measured quality is absent — the anti-fabrication leg itself; deleting it would reopen the permanently-green gate this ceiling closes.',
  'src/quality/quality-monitor.ts::assessMemoryUsage':
    'Memory-efficiency band over the MEASURED peak-bytes reading (≤128MB → 1.0 … >256MB → 0.0) with explicit null when unmeasured — REQ-393 classified the sibling `memoryUsageBytes` leg the same way (0-1 side of the dual-scale contract).',
  // --- adjudicated elsewhere (reclassification belongs to THAT roster) ---
  'src/pipeline/pipeline-health-score.ts::scoreCost':
    '`return 100;` no-baseline leg — adjudicated BY-DESIGN by the defect-9 roster ("a null comparison is legitimately absent, not a manufactured pass") and pinned by defect-9-silent-pass-consolidated-regression + quality-monitor-empty-layout-silent-pass-regression; reopening it is a defect-9 roster decision, not this census\'s.',
  // --- named disclosed placeholder/neutral constants (REQ-391/393 outcomes) ---
  'src/transcription/browser-transcriber.ts::FINAL_NO_CONFIDENCE_STANDIN':
    'Named neutral 0.5 published when Web Speech supplies no final confidence — REQ-393\'s disclosed convention (parity with interim chunks); says "no reading", not "measured near-certainty".',
  'src/transcription/streaming-transcriber.ts::PLACEHOLDER_CHUNK_CONFIDENCE':
    'Named placeholder 0.75 (lower bound of the former `0.75 + Math.random()*0.2`) for synthetic interim chunks that carry no confidence reading — REQ-391\'s de-randomization constant; disclosed by name.',
  'src/transcription/whisper-transcriber.ts::PLACEHOLDER_SEGMENT_CONFIDENCE':
    'Named placeholder 0.95 (lower bound of the former `0.95 + Math.random()*0.05`) for placeholder segments — REQ-391\'s de-randomization constant; disclosed by name.',
};

describe('measurement-statement-literal census (REQ-394)', () => {
  const discovered = new Map<string, string[]>();
  for (const rel of walkProductionSurface()) {
    for (const [key, sites] of discoverStatementLiterals(rel, readSource(rel))) {
      discovered.set(key, [...(discovered.get(key) ?? []), ...sites]);
    }
  }

  it('discovery has authority (non-empty census over the production surface)', () => {
    expect(discovered.size).toBeGreaterThanOrEqual(10);
  });

  it('completeness: every discovered statement literal is classified in ALLOWED', () => {
    const unclassified = [...discovered.keys()].filter((k) => !(k in ALLOWED));
    expect(
      unclassified.map((k) => `${k} @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry still has a live site)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !discovered.has(k));
    expect(stale).toEqual([]);
  });

  it('every ALLOWED entry carries a non-empty reason', () => {
    for (const [key, reason] of Object.entries(ALLOWED)) {
      expect({ key, reason }).toEqual({
        key,
        reason: expect.stringMatching(/\S/),
      });
    }
  });

  it('no Math.random() return in a measurement-named function (REQ-391 ban, return shape)', () => {
    const offenders: string[] = [];
    for (const rel of walkProductionSurface()) {
      const lines = readSource(rel).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line)) continue;
        if (!RETURN_RANDOM.test(line)) continue;
        const fn = enclosingFunctionName(lines, i);
        if (fn !== null && isMeasurementFieldName(fn)) {
          offenders.push(`${rel}:${i + 1}: ${fn} → ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the scanner catches the fabricated shapes', () => {
    const rel = 'synthetic://facet4.ts';
    const source = [
      // fabricated binding initializer — MUST be discovered.
      'const healthScore = 0.95;',
      // fabricated frozen return from a measurement-named function — MUST be.
      'export function estimateOverallHealth(): number {',
      '  return 0.9;',
      '}',
      // random jitter return in a measurement-named function — MUST be.
      'function estimateConfidence(): number {',
      '  return Math.random() * 0.2 + 0.8;',
      '}',
      // decoys — must NOT be discovered:
      'const maxConfidenceThreshold = 0.9;', // config token
      'const retryCount = 30;', // no measurement token
      'function getPageTitle(): string {', // non-measurement fn…
      '  return 42 as unknown as string;', // …and non-literal return
      '}',
      'function getPageNumber(): number {',
      '  return 7;', // single-digit int: below the REQ-391 literal shape
      '}',
    ].join('\n');
    const keys = discoverStatementLiterals(rel, source);
    expect([...keys.keys()].sort()).toEqual([
      'synthetic://facet4.ts::estimateConfidence',
      'synthetic://facet4.ts::estimateOverallHealth',
      'synthetic://facet4.ts::healthScore',
    ]);
  });
});
