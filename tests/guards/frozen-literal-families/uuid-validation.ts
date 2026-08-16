import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 12: the UUID v4 validation regex lives only in uuid-validation.ts.
   * Before this round, four API-layer sites (batch routes, export routes,
   * export-job routes, websocket handler) each hand-rolled the IDENTICAL
   * `UUID_V4_RE` regex — one drift (e.g. dropping the `[89ab]` variant nibble
   * or the `/i` flag) and the same jobId is accepted by one endpoint and
   * 400-rejected by another. Banned shapes cover the local const declaration
   * under any name-shadowing and the raw character-class body itself, so a
   * rename (`const ID_RE = …`) cannot smuggle a copy past the sweep. The
   * test-side copies (tests/integration/*) are outside the src/api boundary.
   */
  {
    id: 'UUID v4 validation regex single-sourced in uuid-validation',
    roots: ['src/api'],
    exclude: {
      'src/api/uuid-validation.ts': 'the canonical source itself',
    },
    patterns: [
      /const\s+\w*UUID\w*_RE\s*=\s*\//,
      /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}/,
    ],
    minSweptFiles: 15,
  },
];
