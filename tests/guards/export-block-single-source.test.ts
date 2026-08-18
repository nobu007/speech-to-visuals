/**
 * Round 28 single-source guard: the export injection-block gate.
 *
 * Before this module the gate that turns a failed strict-mode export
 * validation into a blocked export was hand-rolled in THREE production
 * sites with TWO shapes:
 *
 *   - src/export/multi-format-exporter.ts (MultiFormatExporter.export) and
 *     src/export/enhanced-export-engine.ts (EnhancedExportEngine
 *     prepareExport) carried a byte-identical block: filter the
 *     high-severity findings, throw FormatValidationError with the
 *     "Export blocked: …" message and the findings detail payload;
 *   - src/export/production-exporter.ts (ProductionExporter.createExportJob)
 *     re-typed the same filter + message but threw PipelineConfigError
 *     without the details payload.
 *
 * All three guard the SAME payloads: a drifted filter or message at one
 * site would make that export path block on different findings, or report
 * a different reason, than the other two for the identical scene —
 * invariant-split on a security chokepoint (same class as the round 26
 * JWT secret chain).
 *
 * This file pins (a) the canonical decision against the historic inline
 * gate replicated verbatim as the oracle (zero delta over a matrix of
 * validation outcomes), (b) cross-path behavioral identity — the SAME
 * malicious payload produces the IDENTICAL block message on all three
 * real export paths, and does not block any of them in non-strict mode —
 * and (c) source anchors that all three sites delegate to the canonical
 * helper. The discovery sweep ("no src file outside the validator quotes
 * the block message or re-rolls the high-severity findings filter") lives
 * in tests/guards/frozen-literal-rules.ts, rule
 * 'export block gate single-sourced in export-content-validator (round 28)'.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  evaluateExportBlock,
  validateSceneGraphForExport,
  validateExportPayload,
  type ValidationResult,
  type ContentFinding,
} from '@/export/export-content-validator';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import { EnhancedExportEngine } from '@/export/enhanced-export-engine';
import { ProductionExporter } from '@/export/production-exporter';
import { FormatValidationError, PipelineConfigError } from '@/pipeline/pipeline-errors';
import type { SceneGraph, NodeDatum } from '@stv/core/types/diagram';
import type { EnhancedSceneGraph } from '@/visualization/advanced-visual-engine';

// ---------------------------------------------------------------------------
// Env fixture: EXPORT_STRICT_VALIDATION saved/restored around every test
// ---------------------------------------------------------------------------

const ENV_KEY = 'EXPORT_STRICT_VALIDATION';
let savedStrict: string | undefined;

beforeEach(() => {
  savedStrict = process.env[ENV_KEY];
});

afterEach(() => {
  if (savedStrict === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedStrict;
});

// ---------------------------------------------------------------------------
// (a) Zero-delta oracle vs the historic inline gate
// ---------------------------------------------------------------------------

/**
 * The pre-round-28 inline gate, replicated verbatim as the oracle. The three
 * sites all computed the block decision with exactly this filter and message
 * (inside their `!validation.passed` branch — the formula below is what they
 * froze; the sites only consumed it when blocking).
 */
function historicInlineGate(
  validation: ValidationResult,
): { blocked: boolean; message: string; details: { findings: Array<{ field: string; pattern: string }> } } {
  const highFindings = validation.findings.filter((f) => f.severity === 'high');
  return {
    blocked: !validation.passed,
    message:
      `Export blocked: ${highFindings.length} high-severity injection pattern(s) detected` +
      ` (${highFindings.map((f) => f.pattern).join(', ')})`,
    details: { findings: highFindings.map((f) => ({ field: f.field, pattern: f.pattern })) },
  };
}

function finding(severity: 'high' | 'medium', field: string, pattern: string): ContentFinding {
  return { field, pattern, severity, preview: `<${pattern}@${field}>` };
}

describe('evaluateExportBlock canonical decision (round 28)', () => {
  const matrix: Array<[string, ValidationResult]> = [
    ['clean payload — passed, no findings', { passed: true, findings: [] }],
    ['non-strict with high findings — still passes', { passed: true, findings: [finding('high', 'summary', 'script-tag')] }],
    ['non-strict mixed severities', {
      passed: true,
      findings: [finding('medium', 'nodes[0].label', 'event-handler'), finding('high', 'summary', 'javascript-protocol')],
    }],
    ['strict blocked on a single high finding', {
      passed: false,
      findings: [finding('high', 'summary', 'script-tag')],
    }],
    ['strict blocked with mixed severities — only highs reach message and details', {
      passed: false,
      findings: [
        finding('medium', 'nodes[0].label', 'event-handler'),
        finding('high', 'summary', 'script-tag'),
        finding('high', 'nodes[1].label', 'img-onerror'),
      ],
    }],
    ['strict blocked on zero highs (structurally impossible today, gate must still follow the verdict)', {
      passed: false,
      findings: [finding('medium', 'summary', 'meta-tag')],
    }],
  ];

  it.each(matrix)('zero delta vs historic inline gate: %s', (_name, validation) => {
    const canonical = evaluateExportBlock(validation);
    const historic = historicInlineGate(validation);
    expect(canonical.blocked).toBe(historic.blocked);
    // blocked always mirrors the validator's own verdict — never re-derived.
    expect(canonical.blocked).toBe(!validation.passed);
    expect(canonical.message).toBe(historic.message);
    expect(canonical.details).toEqual(historic.details);
  });

  it('message names every high pattern in findings order, joined with ", "', () => {
    const validation: ValidationResult = {
      passed: false,
      findings: [
        finding('medium', 'a', 'event-handler'),
        finding('high', 'summary', 'script-tag'),
        finding('high', 'x', 'base-tag'),
      ],
    };
    expect(evaluateExportBlock(validation).message).toBe(
      'Export blocked: 2 high-severity injection pattern(s) detected (script-tag, base-tag)',
    );
  });

  it('details payload maps field+pattern of the high findings only', () => {
    const validation: ValidationResult = {
      passed: false,
      findings: [
        finding('medium', 'a', 'event-handler'),
        finding('high', 'summary', 'script-tag'),
      ],
    };
    expect(evaluateExportBlock(validation).details).toEqual({
      findings: [{ field: 'summary', pattern: 'script-tag' }],
    });
  });

  it('fuzz: randomized finding mixes stay identical to the historic gate', () => {
    for (let i = 0; i < 50; i++) {
      const findings: ContentFinding[] = [];
      for (let j = 0; j <= i % 7; j++) {
        findings.push(
          finding(j % 2 === 0 ? 'high' : 'medium', `f${i}-${j}`, `pattern-${i}-${j}`),
        );
      }
      // Cover both verdict polarities for the same finding mix.
      for (const passed of [true, false]) {
        const validation: ValidationResult = { passed, findings };
        const canonical = evaluateExportBlock(validation);
        const historic = historicInlineGate(validation);
        expect([canonical.blocked, canonical.message, canonical.details])
          .toEqual([historic.blocked, historic.message, historic.details]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Fixtures for the real-path tests
// ---------------------------------------------------------------------------

const HIGH_SEVERITY_PAYLOAD = '<script>alert(1)</script>';

function makeScene(summary: string): SceneGraph {
  return {
    id: 'round-28-scene',
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number },
      { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    startMs: 0,
    durationMs: 5000,
    summary,
    keyphrases: ['round', '28'],
    layout: { nodes: [], edges: [] },
  };
}

function makeEnhancedScene(summary: string): EnhancedSceneGraph {
  return {
    ...makeScene(summary),
    visualStyle: { theme: 'default', colorScheme: 'blue' },
    animations: [],
    background: { type: 'solid' as const, primary: '#ffffff', opacity: 1 },
    // visualStyle below is only a partial of VisualStyle; the exporter reads
  // just these two fields in tests, so assert the full SUT type here.
  } as unknown as EnhancedSceneGraph;
}

// ---------------------------------------------------------------------------
// (b) Cross-path behavioral identity on the three REAL export paths
// ---------------------------------------------------------------------------

describe('all three export paths block with the SAME message (round 28 drift oracle)', () => {
  it('strict mode: identical block message from MultiFormatExporter and ProductionExporter', async () => {
    process.env[ENV_KEY] = 'true';

    const expected = evaluateExportBlock(
      validateSceneGraphForExport(makeScene(HIGH_SEVERITY_PAYLOAD), { strict: true }),
    ).message;
    expect(expected).toContain('script-tag');

    // Path 1: MultiFormatExporter.export throws FormatValidationError.
    const mfExporter = new MultiFormatExporter();
    const mfError = await mfExporter
      .export(makeScene(HIGH_SEVERITY_PAYLOAD), { format: 'svg' })
      .then(() => { throw new Error('expected a block'); }, (e: unknown) => e);
    expect(mfError).toBeInstanceOf(FormatValidationError);
    expect((mfError as FormatValidationError).message).toBe(expected);
    expect((mfError as FormatValidationError).format).toBe('svg');
    expect((mfError as FormatValidationError).context).toEqual({
      format: 'svg',
      findings: [{ field: 'summary', pattern: 'script-tag' }],
    });

    // Path 2: ProductionExporter.createExportJob rejects with the same text
    // (historically via PipelineConfigError — the error type each site
    // throws is that site's contract; the shared invariant is the decision).
    const prodExporter = new ProductionExporter(2);
    const prodError = await prodExporter
      .createExportJob('round-28', [makeEnhancedScene(HIGH_SEVERITY_PAYLOAD)], {
        width: 1920, height: 1080, fps: 30, quality: 'high',
        format: 'mp4', includeAudio: true, exportCaption: true,
      })
      .then(() => { throw new Error('expected a block'); }, (e: unknown) => e);
    expect(prodError).toBeInstanceOf(PipelineConfigError);
    expect((prodError as Error).message).toBe(expected);
  });

  it('strict mode: EnhancedExportEngine surfaces the same message on its failed result', async () => {
    process.env[ENV_KEY] = 'true';

    const expected = evaluateExportBlock(
      validateExportPayload({ scenes: [{ summary: HIGH_SEVERITY_PAYLOAD }] }, undefined, { strict: true }),
    ).message;

    // exportVideo catches stage errors and returns a failed ExportResult —
    // the engine's channel for the block is result.error, and it must carry
    // the identical canonical message.
    const engine = new EnhancedExportEngine(2, false);
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, summary: HIGH_SEVERITY_PAYLOAD }] },
      {
        format: 'mp4',
        quality: { resolution: '1080p', fps: 30, bitrate: 'medium', hdr: false },
        settings: { loop: false, includeAudio: true, watermark: false, compression: 'medium', optimization: 'balanced' },
      },
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe(expected);
  });

  it('non-strict mode (default): the same payload blocks NONE of the paths', async () => {
    delete process.env[ENV_KEY];

    // MultiFormatExporter proceeds to a successful SVG export.
    const mfExporter = new MultiFormatExporter();
    const svg = await mfExporter.export(makeScene(HIGH_SEVERITY_PAYLOAD), { format: 'svg' });
    expect(svg.success).toBe(true);

    // ProductionExporter proceeds past the gate to job creation.
    const prodExporter = new ProductionExporter(2);
    const jobId = await prodExporter.createExportJob('round-28-open', [makeEnhancedScene(HIGH_SEVERITY_PAYLOAD)], {
      width: 1920, height: 1080, fps: 30, quality: 'high',
      format: 'mp4', includeAudio: true, exportCaption: true,
    });
    expect(typeof jobId).toBe('string');

    // EnhancedExportEngine proceeds past the gate (its result, whatever the
    // later stages do in jsdom, must not be a block message).
    const engine = new EnhancedExportEngine(2, false);
    const result = await engine.exportVideo(
      { scenes: [{ duration: 1, summary: HIGH_SEVERITY_PAYLOAD }] },
      {
        format: 'mp4',
        quality: { resolution: '1080p', fps: 30, bitrate: 'medium', hdr: false },
        settings: { loop: false, includeAudio: true, watermark: false, compression: 'medium', optimization: 'balanced' },
      },
    );
    expect(result.error ?? '').not.toMatch(/^Export blocked:/);
  });
});

// ---------------------------------------------------------------------------
// (c) Source anchors: every site delegates, none re-freezes the gate
// ---------------------------------------------------------------------------

describe('export-block source anchors (round 28)', () => {
  const SITES = [
    'src/export/multi-format-exporter.ts',
    'src/export/enhanced-export-engine.ts',
    'src/export/production-exporter.ts',
  ] as const;

  it.each(SITES)('%s delegates to the canonical gate', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/import\s*\{[^}]*evaluateExportBlock[^}]*\}\s*from\s*'\.\/export-content-validator'/);
    expect(src).toMatch(/evaluateExportBlock\(/);
    // The pre-round-28 inline shapes must not come back.
    expect(src).not.toMatch(/Export blocked:/);
    expect(src).not.toMatch(/findings\.filter\(\s*\(f\)\s*=>\s*f\.severity\s*===\s*'high'\s*\)/);
  });

  it('the block message literal lives ONLY in the canonical validator module', () => {
    const canonical = readSource('src/export/export-content-validator.ts');
    expect(canonical).toMatch(/Export blocked:/);
    expect(canonical).toMatch(/findings\.filter\(\s*\(f\)\s*=>\s*f\.severity\s*===\s*'high'\s*\)/);
  });
});
