import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 4 (DEFAULT_SCENE_DURATION_MS triple-freeze): the 5000ms default
   * span for untimed scenes must come from scene-duration-limits.ts.
   */
  {
    id: 'default scene duration (5000ms) single-sourced in scene-duration-limits',
    roots: ['src/pipeline'],
    exclude: {
      'src/pipeline/scene-duration-limits.ts': 'the canonical source itself',
    },
    patterns: [/DEFAULT_SCENE_DURATION_MS\s*=\s*5000\b/, /\bdefaultDuration\s*=\s*5000\b/],
  },

  /**
   * Round 4/08ae file-scoped bans: the pre-single-source clamp shapes must
   * never reappear in the three consumers (local min/max consts, legacy
   * DEFAULT_MIN/MAX redefinitions, and the [3000, 10000] inline clamp that
   * truncated 10–15 s simple-pipeline scenes to 10 s).
   */
  {
    id: 'scene-duration clamp literals banned in the three consumers',
    files: [
      'src/pipeline/main-pipeline.ts',
      'src/pipeline/scene-render-spec-generator.ts',
      'src/pipeline/video-generator.ts',
    ],
    patterns: [
      /const minDuration = \d+;/,
      /const maxDuration = \d+;/,
      /DEFAULT_MIN_SCENE_DURATION_MS = \d+;/,
      /DEFAULT_MAX_SCENE_DURATION_MS = \d+;/,
      /Math\.min\(10000,/,
      /Math\.max\(3000,/,
    ],
  },
];
