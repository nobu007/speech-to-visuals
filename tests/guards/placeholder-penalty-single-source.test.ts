/**
 * @jest-environment node
 */
/**
 * REQ-430 (AX-3 / D-3) — disclosed-placeholder quality-penalty structural
 * guard (TC-423-02 census legs).
 *
 * The penalty closed the "permanently-green gate" hole where an
 * all-engines-dead run that fell through to the disclosed placeholder still
 * aggregated transcriptionAccuracy 0.90 — above the 0.85 learner/monitor
 * gate band. That hole was created by THREE aggregation sites sharing one
 * estimator, so the fix must stay single-sourced across exactly those sites:
 * a penalty applied at only one pipeline (the MISSED-SIBLING-SITE class this
 * repo keeps re-learning) would silently re-open the gate on the other two.
 *
 * This guard pins the STRUCTURE, not just the value:
 *  - the penalty value is a named constant (no frozen decimal at the branch)
 *  - the estimator applies it in ONE branch, input-derived only via the
 *    exported transcriber predicate (no second estimation path)
 *  - all THREE aggregation sites wire the recovery outcome through
 *  - the transcriber's own isFallback derivation uses the same predicate
 *
 * A behavioral unit suite (quality-estimators __tests__, the three pipeline
 * unit suites, transcriber-recovery-chain seam) pins the values; this file
 * fails loudly when a refactor drops a site or re-inlines the constant.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { resolveSource } from '@tests/guards/freeze-guard';
import {
  DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY,
  estimateTranscriptionAccuracy,
} from '@/pipeline/quality-estimators';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir) or differ under
// --maxWorkers>1 — cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(new URL('.', import.meta.url).pathname, '..', '..');

const estimatorSrc = readFileSync(
  resolveSource('src/pipeline/quality-estimators.ts'),
  'utf8',
);
const transcriberSrc = readFileSync(
  resolve(REPO_ROOT, 'src/transcription/transcriber.ts'),
  'utf8',
);
const mainPipelineSrc = readFileSync(
  resolve(REPO_ROOT, 'src/pipeline/main-pipeline.ts'),
  'utf8',
);
const simplePipelineSrc = readFileSync(
  resolve(REPO_ROOT, 'src/pipeline/simple-pipeline.ts'),
  'utf8',
);
const fipSrc = readFileSync(
  resolve(REPO_ROOT, 'src/pipeline/framework-integrated-pipeline.ts'),
  'utf8',
);

/** Strip comments (block + line) so doc references don't satisfy the census. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The body of `estimateTranscriptionAccuracy` (up to the next top-level doc). */
function estimatorFunctionBody(): string {
  const start = stripComments(estimatorSrc).indexOf('export function estimateTranscriptionAccuracy');
  const end = stripComments(estimatorSrc).indexOf('export function', start + 1);
  return stripComments(estimatorSrc).slice(start, end === -1 ? undefined : end);
}

describe('REQ-430 penalty — named constant (TC-423-02)', () => {
  it('the penalty value is defined ONCE as an exported named constant', () => {
    expect(
      (estimatorSrc.match(/export const DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY/g) ?? []).length,
    ).toBe(1);
  });

  it('the penalty branch returns the CONSTANT, not a frozen decimal', () => {
    const body = estimatorFunctionBody();
    expect(body).toContain('DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY');
    // The penalty branch must not re-inline the value: extract every numeric
    // literal the penalty branch returns and reject a bare 0.5-style return
    // beside the flag check.
    expect(body).toMatch(
      /endedAtDisclosedPlaceholder[^;]*\)[\s\S]{0,200}return DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY;/,
    );
  });

  it('the constant sits BELOW the 0.85 improvement/blocker threshold band (fail-closed)', () => {
    expect(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY).toBeGreaterThan(0);
    expect(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY).toBeLessThan(0.85);
  });
});

describe('REQ-430 penalty — single derivation authority (TC-423-01 input)', () => {
  it('transcriber.ts exports the endedAtDisclosedPlaceholder predicate', () => {
    expect(stripComments(transcriberSrc)).toMatch(
      /export function endedAtDisclosedPlaceholder/,
    );
  });

  it('the transcriber isFallback derivation uses the SAME predicate (no parallel read)', () => {
    expect(stripComments(transcriberSrc)).toMatch(
      /isFallback: endedAtDisclosedPlaceholder\(outcome\)/,
    );
  });

  it('the estimator consumes the DERIVED flag only — no segment/string second estimation path', () => {
    const body = estimatorFunctionBody();
    expect(body).toContain('endedAtDisclosedPlaceholder');
    // The context is a flag object; the estimator must not import from the
    // transcription layer (cycle + second authority) nor match segment text.
    expect(stripComments(estimatorSrc)).not.toContain("from '@/transcription");
    expect(stripComments(estimatorSrc)).not.toContain("from '../transcription");
  });
});

describe('REQ-430 penalty — all three aggregation sites wired (MISSED-SIBLING-SITE census)', () => {
  it('MainPipeline.buildQualityMetrics derives the flag from the transcriber getter', () => {
    const src = stripComments(mainPipelineSrc);
    expect(src).toContain('estimateTranscriptionAccuracy(');
    expect(src).toContain('endedAtDisclosedPlaceholder(');
    expect(src).toContain('getRecoveryOutcome()');
  });

  it('SimplePipeline derives the flag from the transcriber getter', () => {
    const src = stripComments(simplePipelineSrc);
    expect(src).toContain('estimateTranscriptionAccuracy(');
    expect(src).toContain('endedAtDisclosedPlaceholder(');
    expect(src).toContain('getRecoveryOutcome()');
  });

  it('FrameworkIntegratedPipeline derives the flag from the inner MainPipeline getter', () => {
    const src = stripComments(fipSrc);
    expect(src).toContain('qualityEstimators.estimateTranscriptionAccuracy(');
    expect(src).toContain('endedAtDisclosedPlaceholder(');
    expect(src).toContain('getTranscriptionRecoveryOutcome()');
  });
});

describe('REQ-430 penalty — behavioral cross-check at the guard layer', () => {
  it('the estimator penalizes a placeholder-terminated context even with scenes present', () => {
    const signals = {
      success: true,
      scenes: [{ type: 'flow', nodes: [], edges: [], startMs: 0, durationMs: 4000, summary: '', keyphrases: [] }],
      duration: 4000,
    } as Parameters<typeof estimateTranscriptionAccuracy>[0];
    expect(
      estimateTranscriptionAccuracy(signals, { endedAtDisclosedPlaceholder: true }),
    ).toBe(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY);
    expect(
      estimateTranscriptionAccuracy(signals, { endedAtDisclosedPlaceholder: false }),
    ).toBe(0.9);
  });
});
