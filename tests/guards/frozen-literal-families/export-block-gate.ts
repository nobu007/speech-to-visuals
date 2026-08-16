import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 28 (export block gate single-source): the strict-mode gate that
   * turns a failed export validation into a blocked export lived in THREE
   * sites with TWO shapes — byte-identical filter+throw twins in
   * multi-format-exporter.ts and enhanced-export-engine.ts
   * (FormatValidationError with the findings detail payload), plus the same
   * filter+message re-typed in production-exporter.ts (PipelineConfigError
   * without the payload). All three guard the SAME payloads: a drifted
   * filter or message at one site would block different findings or report
   * a different reason than the other export paths for the identical scene.
   * Canonical: evaluateExportBlock in src/export/export-content-validator.ts
   * (blocked delegates to the validator's own !passed verdict).
   *
   * NOT banned (legitimate other shapes, verified round 28): the canonical
   * module's own logging-count filters (same file, excluded below); the
   * error-handling severity checks in monitoring/production-error-handler.ts
   * and quality/enhanced-error-recovery.ts (`=== 'high' || === 'critical'`
   * alert routing over error records, not validation findings); and test
   * files (the walk skips __tests__ and *.test.*).
   */
  {
    id: 'export block gate single-sourced in export-content-validator (round 28)',
    roots: ['src'],
    exclude: {
      'src/export/export-content-validator.ts': 'the canonical source itself',
    },
    patterns: [
      // The canonical block-reason message literal, re-frozen anywhere else.
      /Export blocked:/,
      // The gate filter shape over validation findings, re-rolled at a site.
      /findings\.filter\(\s*\(f\)\s*=>\s*f\.severity\s*===\s*'high'\s*\)/,
    ],
    minSweptFiles: 200,
  },
];
