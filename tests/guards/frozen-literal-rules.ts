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

  /**
   * Round 11: default layout spacing values (nodeSeparation 50,
   * edgeSeparation 10, rankSeparation 50, margin 50) live only in
   * layout-spacing.ts. Banned shapes cover default-config object literals,
   * local consts, and the `|| 50` / `|| 10` partial-config fallbacks in dagre
   * setup, the network sizer, the timeline margins, and the layout worker.
   * NOT swept (different concepts, stay literal): per-diagram-type TUNED
   * separations (Tree/Timeline 80, Comparison 70, Network 60, Flowchart rank
   * 70, Tree rank 100/`|| 100`), and the src/visualization/layout strategy
   * system's own base config — that system deliberately defaults
   * nodeSeparation to 30 (pinned by src/test/layout/LayoutStrategy.test.ts),
   * so its equal-valued 10/50s belong to a different default set.
   */
  {
    id: 'layout spacing defaults (50/10/50/50) single-sourced in layout-spacing',
    roots: ['src/visualization', 'src/workers'],
    exclude: {
      'src/visualization/layout-spacing.ts': 'the canonical source itself',
      'src/visualization/layout/strategies/LayoutStrategy.ts':
        'separate default-config system (nodeSeparation 30, pinned by src/test/layout/LayoutStrategy.test.ts)',
    },
    patterns: [
      /\b(nodeSeparation|edgeSeparation|rankSeparation|marginX|marginY)\s*(:|=)\s*(50|10)\b/,
      /\b(nodeSeparation|edgeSeparation|rankSeparation|marginX|marginY)\s*\|\|\s*(50|10)\b/,
    ],
    minSweptFiles: 30,
  },

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

  /**
   * Round 13: the per-diagram-type Japanese display title lives only in
   * DIAGRAM_TYPE_TITLES (src/types/diagram.ts). Before this round,
   * video-generator's generateSceneTitle and DiagramScene's rendered title
   * each froze their own `type → title` map and the two had ALREADY drifted
   * (flowchart 「プロセスフロー」 vs 「フローチャート」, general 「ダイアグラム」
   * vs 「一般」) — the scene list and the rendered video frame disagreed on
   * the same scene's title. The banned shape is the object-literal member
   * `<diagramType>: '<title string>'` for any key of the union and any of the
   * known title variants (including DiagramPreview's badge wordings, so a NEW
   * site cannot smuggle a fourth map under different wording). The
   * diagram-detector keyword arrays (`'マインドマップ', …` inside `[]`) and the
   * `'cycle,timeline': '循環タイムライン'` hybrid-name table use quoted keys /
   * bare array elements, which the unquoted-key shape cannot match.
   * DiagramPreview's badge map is a different surface (UI shorthand on the
   * preview card, not the video title) and stays local by design.
   */
  {
    id: 'diagram-type titles single-sourced in DIAGRAM_TYPE_TITLES (types/diagram)',
    roots: ['src'],
    exclude: {
      'src/types/diagram.ts': 'the canonical source itself',
      'src/components/DiagramPreview.tsx':
        'UI badge shorthand on the preview card — different surface/wording than the video title',
    },
    patterns: [
      /^\s*(flow|flowchart|tree|timeline|matrix|cycle|comparison|network|conceptmap|mindmap|general):\s*'(プロセスフロー|フローチャート|階層構造|ツリー構造|タイムライン|比較表|マトリクス|循環プロセス|サイクル図|比較|比較図|ネットワーク|ネットワーク図|コンセプトマップ|マインドマップ|一般|汎用図|ダイアグラム)'/,
    ],
    minSweptFiles: 200,
  },

  /**
   * Round 14: an average over `Object.values(x).reduce(...)` must derive its
   * denominator from the averaged keyset (`.length`), never a hardcoded count.
   * Before this round, quality-monitor's three compliance scorers each divided
   * by a literal `/ 5` next to a 5-key object — correct today, but adding a
   * sixth criterion silently changes the scale of the score (a 6×1.0 keyset
   * would max out at 1.2, and thresholds like `< 0.9` trip on perfect runs).
   * The banned shape is the same-line `reduce(...) / <integer>`; sibling shapes
   * that already derive (`… / Object.keys(x).length`, `… / values.length`)
   * do not match. There is no canonical source to exclude — the correct shape
   * IS deriving from the keyset at each site.
   */
  {
    id: 'mean denominators derive from the averaged keyset (no hardcoded /N)',
    roots: ['src'],
    patterns: [
      // Greedy callback match: the reduce callback itself contains `)`, so the
      // banned denominator is the LAST `)` on the line followed by `/ <int>`.
      /Object\.values\([^)]*\)\s*\.reduce\(.*\)\s*\/\s*\d+\b/,
      /Object\.keys\([^)]*\)\s*\.reduce\(.*\)\s*\/\s*\d+\b/,
    ],
    minSweptFiles: 200,
  },
];
