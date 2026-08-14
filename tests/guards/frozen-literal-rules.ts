/**
 * Registry of frozen-literal single-source rules (round 8 extraction).
 *
 * Each entry replaces the hand-rolled discovery sweep of one per-family guard
 * test. Adding a new frozen-constant family = one entry here; the registry
 * test (frozen-literal-registry.test.ts) sweeps every entry with the shared
 * walk in freeze-guard.ts. Value pins, consumer-import pins, and behavioral
 * pins stay in the per-family test files — this registry is ONLY the "no site
 * re-freezes the literal" discovery sweep.
 *
 * Rules are ordered by the round that closed them (fps … quality-thresholds).
 * Keep every exclusion reason inline — the registry test fails an exclusion
 * that lost its reason.
 */

import type { FrozenLiteralRule } from './freeze-guard';

/** Common: co-located __tests__ hold fixtures, not production thresholds. */
export const FROZEN_LITERAL_RULES: FrozenLiteralRule[] = [
  /**
   * Round 4 (REQ-296 + sibling-shape extension): DEFAULT_FPS = 30 lives only
   * in src/remotion/scene-synchronizer.ts. Banned shapes cover const
   * redeclaration, `|| 30` / `?? 30` fallbacks, and the `const fps = 30`
   * local alias that feeds Lottie/composition frame math directly.
   */
  {
    id: 'default-fps (30) single-sourced in scene-synchronizer',
    roots: ['src'],
    exclude: {
      'src/remotion/scene-synchronizer.ts': 'the canonical source itself',
    },
    patterns: [
      /\bconst\s+DEFAULT_FPS\s*=\s*30\s*;/,
      /\bfps\b\s*\|\|\s*30\b/,
      /\bconst\s+fps\s*=\s*30\b/,
      /\bfps\s*\?\?\s*30\b/,
    ],
    minSweptFiles: 50,
  },

  /**
   * Round 4 (layout-quality desync): the composite layout-quality pass bar
   * 0.7 — scorer's pass bar and optimizer's stop bar are the SAME judgment.
   * Exclusions are different concepts that merely share the value 0.7
   * (detection confidence; pipeline criterion gates).
   */
  {
    id: 'layout-quality threshold (0.7) single-sourced in layout-quality-composite',
    roots: ['src/visualization', 'src/pipeline'],
    exclude: {
      'src/visualization/layout-quality-composite.ts': 'the canonical source itself',
      'src/analysis/scene-segmenter.ts':
        'DETECTION confidence (diagram-type), not layout geometry — different concept',
      'src/quality/quality-gate.ts':
        'pipeline criterion gates, not layout geometry — different concept',
    },
    patterns: [
      /(DEFAULT_THRESHOLD|DEFAULT_LAYOUT_QUALITY_THRESHOLD)\s*=\s*0\.7\b/,
      /\bthreshold\s*:\s*0\.7\b/,
    ],
  },

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

  /**
   * Round 5: TARGET_ASPECT_RATIO derived from default canvas dims — no
   * visualization module may declare or inline `16 / 9` in any spacing shape.
   * (The canonical file holds no 16/9 literal at all — it derives — but the
   * exclusion stays explicit.) The CSS string `aspectRatio: '16/9'` in
   * InteractiveResultViewer.tsx is a browser style value on a different
   * layer, outside the src/visualization sweep boundary.
   */
  {
    id: 'target aspect ratio (16/9) single-sourced in canvas-dimensions',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/canvas-dimensions.ts': 'the canonical source itself (derives the ratio)',
    },
    patterns: [/16\s*\/\s*9/],
    minSweptFiles: 20,
  },

  /**
   * Round 6: DEFAULT_NODE_WIDTH/HEIGHT (120/60) live only in
   * node-dimensions.ts. Banned sibling shapes: object literal
   * (`nodeHeight: 60`), local const, and `||` fallback. Per-diagram-type
   * tuned dimensions (advanced-layouts 100/50, 140/70; FallbackLayoutStrategy
   * 140/line-47 80) and `nodeSeparation: 60` are different concepts and do
   * NOT match these shapes.
   */
  {
    id: 'node dimensions (120/60) single-sourced in node-dimensions',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/node-dimensions.ts': 'the canonical source itself',
    },
    patterns: [/nodeWidth\s*(:|=|\|\|)\s*120\b/, /nodeHeight\s*(:|=|\|\|)\s*60\b/],
  },

  /**
   * Round 7 (09a): error-rate warning/critical boundaries (0.05/0.10/0.15)
   * live only in error-rate-thresholds.ts. Two line shapes: same-line
   * `errorRate … 0.05` coupling (any order via predicate), and the
   * next-line `warning: 0.05` / `critical: 0.15` threshold-shape assignment
   * that catches multi-line setAlertThreshold calls.
   * production-config.ts is the documented exclusion: a UI-editable default
   * coupled to the engine threshold is its own defect class (09a precedent).
   */
  {
    id: 'error-rate thresholds (0.05/0.10/0.15) single-sourced in error-rate-thresholds',
    roots: ['src'],
    exclude: {
      'src/monitoring/error-rate-thresholds.ts': 'the canonical source itself',
      'src/config/production-config.ts':
        'user-editable alertThresholds default — see 09a module header',
    },
    patterns: [
      (line) => /errorRate/i.test(line) && /\b0\.05\b|\b0\.10\b|\b0\.15\b/.test(line),
      /(warning|critical|maxErrorRate|errorRateThreshold)\s*:\s*(0\.05|0\.10|0\.15)\b/,
    ],
  },

  /**
   * Round 7: quality-gate threshold defaults (ratios 0.85/0.75/0.80/0.70,
   * renderTime 30000, memoryUsage 512) live only in quality-thresholds.ts.
   * Patterns are scoped per KEY so metric-shaped lines do not false-positive
   * (`memoryUsage: 0.85` is a stubbed score, not a byte budget — round 7
   * lesson). `layoutOverlap: 0` is the documented disable sentinel and is
   * intentionally not swept (0 is indistinguishable from metric-zero).
   * Both field-NAME spellings of the relation variant are covered.
   */
  {
    id: 'quality-gate threshold defaults single-sourced in quality-thresholds',
    roots: ['src'],
    exclude: {
      'src/framework/quality-thresholds.ts': 'the canonical source itself',
    },
    patterns: [
      /^\s*(?:transcriptionAccuracy|sceneSegmentationF1|entityExtractionF1|relationAccuracy|relationshipAccuracy|edgeCompleteness|edgeRatioQuality)\s*:\s*(?:0\.85|0\.75|0\.80|0\.70)\s*[,})]/,
      /^\s*renderTime\s*:\s*30000\s*[,})]/,
      /^\s*memoryUsage\s*:\s*512\s*[,})*/]/,
    ],
  },

  /**
   * Round 9: analysis-layer LLM retry defaults (maxRetries 3, baseDelay 1000,
   * maxDelay 10000) live only in retry-strategy.ts as the exported
   * DEFAULT_RETRY_OPTIONS. The pipeline-layer retry system
   * (src/pipeline/retry.ts — ErrorClassifier-driven, 500ms base) is a
   * different concept and lives outside this sweep boundary.
   */
  {
    id: 'analysis retry defaults (3/1000/10000) single-sourced in retry-strategy',
    roots: ['src/analysis'],
    exclude: {
      'src/analysis/retry-strategy.ts': 'the canonical source itself',
    },
    patterns: [
      /maxRetries\s*(:|=|\|\||\?\?)\s*3\b/,
      /baseDelay\s*:\s*1000\b/,
      /maxDelay\s*:\s*10000\b/,
    ],
    minSweptFiles: 20,
  },

  /**
   * Round 10 (08ba narrowed to its clean half): the label-driven node-width
   * constants charWidth 8 / padding 20 live only in layout-utils.ts. Before
   * this round, six strategies (Tree/Flowchart/Network/Timeline/ConceptMap/
   * Comparison) hand-rolled the IDENTICAL formula `label*8+20 clamped to
   * [base, base*2]` next to the shared calculateNodeWidth util, and
   * BaseLayoutEngine + DagreLayoutStrategy froze their own
   * DEFAULT_CHAR_WIDTH/DEFAULT_PADDING locals. NOT swept (different
   * concepts): the util's omitted-field padding default `?? 16` (pinned by
   * layout-bug-fixes.test.ts — callers that omit padding get tighter
   * packing by design), smart-label-sizer's `charWidthFactor: 8`
   * (font-scaled sizer, not the fixed px estimate), and advanced-layouts'
   * `text.length * 8 + 40` (different formula and padding, different
   * concept — the patterns below do not match it).
   */
  {
    id: 'label-width constants (charWidth 8 / padding 20) single-sourced in layout-utils',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/layout-utils.ts': 'the canonical source itself',
    },
    patterns: [
      /const\s+(DEFAULT_)?CHAR_WIDTH\s*=\s*8\b/,
      /const\s+charWidth\s*=\s*8\b/,
      /charWidth\s*\?\?\s*8\b/,
      /const\s+(DEFAULT_)?PADDING\s*=\s*20\b/,
      /const\s+padding\s*=\s*20\b/,
    ],
    minSweptFiles: 20,
  },
];
